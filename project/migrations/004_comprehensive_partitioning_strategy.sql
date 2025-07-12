-- Migration 004: Comprehensive Multi-Dimensional Partitioning Strategy
-- This implements a 3-level hierarchy: Program -> Site -> Time
-- With automatic partition management for future data

BEGIN;

-- =====================================================
-- PART 1: PARTITION MANAGEMENT INFRASTRUCTURE
-- =====================================================

-- Create schema for partition management functions
CREATE SCHEMA IF NOT EXISTS partition_mgmt;

-- Table to track partition metadata
CREATE TABLE partition_mgmt.partition_registry (
  registry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  partition_type text NOT NULL, -- 'program', 'site', 'time'
  partition_key text NOT NULL,
  partition_name text NOT NULL,
  parent_partition text,
  created_at timestamptz DEFAULT now(),
  data_start_date date,
  data_end_date date,
  row_count bigint DEFAULT 0,
  UNIQUE(table_name, partition_name)
);

-- =====================================================
-- PART 2: AUTOMATIC PARTITION CREATION FUNCTIONS
-- =====================================================

-- Function to safely create a partition
CREATE OR REPLACE FUNCTION partition_mgmt.create_partition_safe(
  p_parent_table text,
  p_partition_name text,
  p_partition_sql text
) RETURNS boolean AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Check if partition already exists
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = p_partition_name
    AND n.nspname = 'public'
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    -- Create the partition
    EXECUTE p_partition_sql;
    
    -- Log in registry
    INSERT INTO partition_mgmt.partition_registry 
      (table_name, partition_type, partition_key, partition_name)
    VALUES 
      (p_parent_table, 'mixed', p_partition_name, p_partition_name);
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to create monthly partitions
CREATE OR REPLACE FUNCTION partition_mgmt.ensure_monthly_partition(
  p_parent_table text,
  p_date date
) RETURNS text AS $$
DECLARE
  v_partition_name text;
  v_start_date date;
  v_end_date date;
BEGIN
  -- Calculate partition boundaries
  v_start_date := date_trunc('month', p_date);
  v_end_date := v_start_date + interval '1 month';
  
  -- Generate partition name
  v_partition_name := p_parent_table || '_' || to_char(v_start_date, 'YYYY_MM');
  
  -- Create partition if needed
  PERFORM partition_mgmt.create_partition_safe(
    p_parent_table,
    v_partition_name,
    format(
      'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
      v_partition_name,
      p_parent_table,
      v_start_date,
      v_end_date
    )
  );
  
  RETURN v_partition_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 3: NEW PARTITIONED TABLE STRUCTURE
-- =====================================================

-- Main partitioned table by program_id
CREATE TABLE petri_observations_partitioned (
  LIKE petri_observations INCLUDING ALL
) PARTITION BY LIST (program_id);

-- Default partition for unmapped programs
CREATE TABLE petri_obs_part_default 
  PARTITION OF petri_observations_partitioned DEFAULT;

-- Function to create program partition with site sub-partitions
CREATE OR REPLACE FUNCTION partition_mgmt.create_program_partition(
  p_program_id uuid
) RETURNS void AS $$
DECLARE
  v_partition_name text;
  v_safe_id text;
BEGIN
  -- Create safe partition name
  v_safe_id := 'prog_' || replace(p_program_id::text, '-', '');
  v_partition_name := 'petri_obs_' || v_safe_id;
  
  -- Create program partition (partitioned by site)
  PERFORM partition_mgmt.create_partition_safe(
    'petri_observations_partitioned',
    v_partition_name,
    format(
      'CREATE TABLE %I PARTITION OF petri_observations_partitioned 
       FOR VALUES IN (%L) PARTITION BY LIST (site_id)',
      v_partition_name,
      p_program_id
    )
  );
  
  -- Create default site partition for this program
  PERFORM partition_mgmt.create_partition_safe(
    v_partition_name,
    v_partition_name || '_site_default',
    format(
      'CREATE TABLE %I PARTITION OF %I DEFAULT',
      v_partition_name || '_site_default',
      v_partition_name
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Function to create site partition with time sub-partitions
CREATE OR REPLACE FUNCTION partition_mgmt.create_site_partition(
  p_program_id uuid,
  p_site_id uuid
) RETURNS void AS $$
DECLARE
  v_program_partition text;
  v_site_partition text;
  v_safe_prog_id text;
  v_safe_site_id text;
BEGIN
  -- Create safe IDs
  v_safe_prog_id := 'prog_' || replace(p_program_id::text, '-', '');
  v_safe_site_id := 'site_' || replace(p_site_id::text, '-', '');
  
  v_program_partition := 'petri_obs_' || v_safe_prog_id;
  v_site_partition := v_program_partition || '_' || v_safe_site_id;
  
  -- Ensure program partition exists
  PERFORM partition_mgmt.create_program_partition(p_program_id);
  
  -- Create site partition (partitioned by time)
  PERFORM partition_mgmt.create_partition_safe(
    v_program_partition,
    v_site_partition,
    format(
      'CREATE TABLE %I PARTITION OF %I 
       FOR VALUES IN (%L) PARTITION BY RANGE (created_at)',
      v_site_partition,
      v_program_partition,
      p_site_id
    )
  );
  
  -- Create initial monthly partition
  PERFORM partition_mgmt.ensure_monthly_partition(
    v_site_partition,
    CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 4: AUTOMATIC TRIGGERS
-- =====================================================

-- Trigger function to auto-create partitions on INSERT
CREATE OR REPLACE FUNCTION partition_mgmt.route_insert_to_partition()
RETURNS TRIGGER AS $$
DECLARE
  v_program_partition text;
  v_site_partition text;
  v_time_partition text;
  v_safe_prog_id text;
  v_safe_site_id text;
BEGIN
  -- Ensure all necessary partitions exist
  PERFORM partition_mgmt.create_site_partition(NEW.program_id, NEW.site_id);
  
  -- Create monthly partition if needed
  v_safe_prog_id := 'prog_' || replace(NEW.program_id::text, '-', '');
  v_safe_site_id := 'site_' || replace(NEW.site_id::text, '-', '');
  v_site_partition := 'petri_obs_' || v_safe_prog_id || '_' || v_safe_site_id;
  
  PERFORM partition_mgmt.ensure_monthly_partition(v_site_partition, NEW.created_at);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on the default partition
CREATE TRIGGER auto_create_partitions
  BEFORE INSERT ON petri_obs_part_default
  FOR EACH ROW
  EXECUTE FUNCTION partition_mgmt.route_insert_to_partition();

-- =====================================================
-- PART 5: MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to pre-create partitions for a program's duration
CREATE OR REPLACE FUNCTION partition_mgmt.precreate_program_partitions(
  p_program_id uuid
) RETURNS void AS $$
DECLARE
  v_program record;
  v_site record;
  v_current_date date;
  v_safe_prog_id text;
  v_safe_site_id text;
  v_site_partition text;
BEGIN
  -- Get program details
  SELECT * INTO v_program 
  FROM pilot_programs 
  WHERE program_id = p_program_id;
  
  -- Create program partition
  PERFORM partition_mgmt.create_program_partition(p_program_id);
  
  -- Create partitions for each site
  FOR v_site IN 
    SELECT site_id FROM sites WHERE program_id = p_program_id
  LOOP
    -- Create site partition
    PERFORM partition_mgmt.create_site_partition(p_program_id, v_site.site_id);
    
    -- Pre-create monthly partitions for program duration
    v_safe_prog_id := 'prog_' || replace(p_program_id::text, '-', '');
    v_safe_site_id := 'site_' || replace(v_site.site_id::text, '-', '');
    v_site_partition := 'petri_obs_' || v_safe_prog_id || '_' || v_safe_site_id;
    
    v_current_date := date_trunc('month', v_program.start_date);
    WHILE v_current_date <= v_program.end_date LOOP
      PERFORM partition_mgmt.ensure_monthly_partition(v_site_partition, v_current_date);
      v_current_date := v_current_date + interval '1 month';
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 6: OPTIMIZED QUERY FUNCTIONS
-- =====================================================

-- Function to query with partition pruning hints
CREATE OR REPLACE FUNCTION get_observations_optimized(
  p_company_id uuid,
  p_program_id uuid DEFAULT NULL,
  p_site_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
) RETURNS SETOF petri_observations AS $$
BEGIN
  -- This function helps the planner with partition pruning
  RETURN QUERY
  SELECT po.*
  FROM petri_observations_partitioned po
  WHERE po.company_id = p_company_id
    AND (p_program_id IS NULL OR po.program_id = p_program_id)
    AND (p_site_id IS NULL OR po.site_id = p_site_id)
    AND (p_start_date IS NULL OR po.created_at >= p_start_date)
    AND (p_end_date IS NULL OR po.created_at <= p_end_date);
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- =====================================================
-- PART 7: MONITORING AND MAINTENANCE VIEWS
-- =====================================================

-- View to monitor partition health
CREATE OR REPLACE VIEW partition_mgmt.v_partition_stats AS
WITH partition_sizes AS (
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
  FROM pg_tables
  WHERE tablename LIKE 'petri_obs_%'
    AND schemaname = 'public'
)
SELECT 
  pr.partition_name,
  pr.partition_type,
  pr.created_at,
  pr.row_count,
  ps.size,
  ps.size_bytes
FROM partition_mgmt.partition_registry pr
LEFT JOIN partition_sizes ps ON ps.tablename = pr.partition_name
ORDER BY pr.created_at DESC;

-- Function to update partition statistics
CREATE OR REPLACE FUNCTION partition_mgmt.update_partition_stats()
RETURNS void AS $$
DECLARE
  v_partition record;
  v_count bigint;
BEGIN
  FOR v_partition IN 
    SELECT DISTINCT partition_name, table_name 
    FROM partition_mgmt.partition_registry
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM %I',
      v_partition.partition_name
    ) INTO v_count;
    
    UPDATE partition_mgmt.partition_registry
    SET row_count = v_count
    WHERE partition_name = v_partition.partition_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 8: SAFETY CHECKS AND VALIDATION
-- =====================================================

-- Function to validate partition structure
CREATE OR REPLACE FUNCTION partition_mgmt.validate_partitions()
RETURNS TABLE (
  check_name text,
  status text,
  details text
) AS $$
BEGIN
  -- Check 1: All programs have partitions
  RETURN QUERY
  SELECT 
    'Programs with partitions'::text,
    CASE 
      WHEN COUNT(*) = (SELECT COUNT(*) FROM pilot_programs) 
      THEN 'PASS' 
      ELSE 'FAIL' 
    END,
    format('%s of %s programs have partitions', 
      COUNT(DISTINCT partition_key), 
      (SELECT COUNT(*) FROM pilot_programs))
  FROM partition_mgmt.partition_registry
  WHERE partition_type = 'program';
  
  -- Check 2: No orphaned partitions
  RETURN QUERY
  SELECT 
    'Orphaned partitions'::text,
    CASE 
      WHEN COUNT(*) = 0 
      THEN 'PASS' 
      ELSE 'WARN' 
    END,
    format('%s partitions without data', COUNT(*))
  FROM partition_mgmt.partition_registry
  WHERE row_count = 0
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 day';
  
  -- Add more checks as needed
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 9: MIGRATION HELPER
-- =====================================================

-- Function to migrate existing data in batches
CREATE OR REPLACE FUNCTION partition_mgmt.migrate_to_partitioned(
  p_batch_size integer DEFAULT 10000,
  p_program_id uuid DEFAULT NULL
) RETURNS TABLE (
  migrated_count bigint,
  duration interval
) AS $$
DECLARE
  v_start_time timestamp;
  v_count bigint := 0;
  v_batch_count integer;
BEGIN
  v_start_time := clock_timestamp();
  
  -- Ensure partitions exist for the program
  IF p_program_id IS NOT NULL THEN
    PERFORM partition_mgmt.precreate_program_partitions(p_program_id);
  END IF;
  
  -- Migrate in batches
  LOOP
    WITH batch AS (
      SELECT * FROM petri_observations
      WHERE (p_program_id IS NULL OR program_id = p_program_id)
        AND NOT EXISTS (
          SELECT 1 FROM petri_observations_partitioned p
          WHERE p.observation_id = petri_observations.observation_id
        )
      LIMIT p_batch_size
    )
    INSERT INTO petri_observations_partitioned
    SELECT * FROM batch;
    
    GET DIAGNOSTICS v_batch_count = ROW_COUNT;
    v_count := v_count + v_batch_count;
    
    EXIT WHEN v_batch_count < p_batch_size;
    
    -- Brief pause to avoid overwhelming the system
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RETURN QUERY
  SELECT v_count, clock_timestamp() - v_start_time;
END;
$$ LANGUAGE plpgsql;

COMMIT;