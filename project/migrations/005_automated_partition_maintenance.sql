-- Migration 005: Automated Partition Maintenance
-- This ensures partitions are created automatically for future data

BEGIN;

-- =====================================================
-- PART 1: AUTOMATIC PARTITION CREATION TRIGGERS
-- =====================================================

-- Trigger when new program is created
CREATE OR REPLACE FUNCTION partition_mgmt.on_program_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Pre-create all partitions for the program duration
  PERFORM partition_mgmt.precreate_program_partitions(NEW.program_id);
  
  -- Also create partitions for gasifier observations
  PERFORM partition_mgmt.create_program_partition_gasifier(NEW.program_id);
  
  RAISE NOTICE 'Created partitions for program %', NEW.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_partition_on_program
  AFTER INSERT ON pilot_programs
  FOR EACH ROW
  EXECUTE FUNCTION partition_mgmt.on_program_created();

-- Trigger when new site is created
CREATE OR REPLACE FUNCTION partition_mgmt.on_site_created()
RETURNS TRIGGER AS $$
DECLARE
  v_program record;
BEGIN
  -- Get program details
  SELECT * INTO v_program 
  FROM pilot_programs 
  WHERE program_id = NEW.program_id;
  
  -- Create site partitions for both petri and gasifier observations
  PERFORM partition_mgmt.create_site_partition(NEW.program_id, NEW.site_id);
  PERFORM partition_mgmt.create_site_partition_gasifier(NEW.program_id, NEW.site_id);
  
  -- Pre-create monthly partitions for program duration
  PERFORM partition_mgmt.precreate_site_time_partitions(
    NEW.program_id, 
    NEW.site_id, 
    v_program.start_date, 
    v_program.end_date
  );
  
  RAISE NOTICE 'Created partitions for site %', NEW.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_partition_on_site
  AFTER INSERT ON sites
  FOR EACH ROW
  EXECUTE FUNCTION partition_mgmt.on_site_created();

-- =====================================================
-- PART 2: SUBMISSION-LEVEL PARTITIONING
-- =====================================================

-- Create submission-partitioned table for ultra-granular queries
CREATE TABLE petri_observations_by_submission (
  LIKE petri_observations INCLUDING ALL
) PARTITION BY LIST (submission_id);

-- Function to create submission partition
CREATE OR REPLACE FUNCTION partition_mgmt.create_submission_partition(
  p_submission_id uuid
) RETURNS void AS $$
DECLARE
  v_partition_name text;
  v_safe_id text;
  v_submission record;
BEGIN
  -- Get submission details
  SELECT s.*, st.program_id 
  INTO v_submission
  FROM submissions s
  JOIN sites st ON s.site_id = st.site_id
  WHERE s.submission_id = p_submission_id;
  
  -- Create safe partition name
  v_safe_id := 'sub_' || replace(p_submission_id::text, '-', '');
  v_partition_name := 'petri_obs_submission_' || v_safe_id;
  
  -- Create partition
  PERFORM partition_mgmt.create_partition_safe(
    'petri_observations_by_submission',
    v_partition_name,
    format(
      'CREATE TABLE %I PARTITION OF petri_observations_by_submission 
       FOR VALUES IN (%L)',
      v_partition_name,
      p_submission_id
    )
  );
  
  -- Create indexes
  EXECUTE format(
    'CREATE INDEX %I ON %I (petri_code, created_at)',
    v_partition_name || '_petri_idx',
    v_partition_name
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 3: GASIFIER OBSERVATIONS PARTITIONING
-- =====================================================

-- Create similar structure for gasifier observations
CREATE TABLE gasifier_observations_partitioned (
  LIKE gasifier_observations INCLUDING ALL
) PARTITION BY LIST (program_id);

CREATE TABLE gasifier_obs_part_default 
  PARTITION OF gasifier_observations_partitioned DEFAULT;

-- Reuse similar functions for gasifier observations
CREATE OR REPLACE FUNCTION partition_mgmt.create_program_partition_gasifier(
  p_program_id uuid
) RETURNS void AS $$
DECLARE
  v_partition_name text;
  v_safe_id text;
BEGIN
  v_safe_id := 'prog_' || replace(p_program_id::text, '-', '');
  v_partition_name := 'gasifier_obs_' || v_safe_id;
  
  PERFORM partition_mgmt.create_partition_safe(
    'gasifier_observations_partitioned',
    v_partition_name,
    format(
      'CREATE TABLE %I PARTITION OF gasifier_observations_partitioned 
       FOR VALUES IN (%L) PARTITION BY LIST (site_id)',
      v_partition_name,
      p_program_id
    )
  );
  
  -- Create default site partition
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

-- =====================================================
-- PART 4: CONSTRAINT EXCLUSION AND OPTIMIZATION
-- =====================================================

-- Enable constraint exclusion for better query planning
ALTER SYSTEM SET constraint_exclusion = 'partition';

-- Function to analyze all partitions
CREATE OR REPLACE FUNCTION partition_mgmt.analyze_all_partitions()
RETURNS void AS $$
DECLARE
  v_partition record;
BEGIN
  FOR v_partition IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND (tablename LIKE 'petri_obs_%' OR tablename LIKE 'gasifier_obs_%')
  LOOP
    EXECUTE format('ANALYZE %I', v_partition.tablename);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 5: VIEWS FOR TRANSPARENT ACCESS
-- =====================================================

-- Create views that automatically use the right partitions
CREATE OR REPLACE VIEW v_observations_unified AS
SELECT 
  po.*,
  'petri' as observation_type,
  s.name as site_name,
  p.name as program_name,
  p.phases as program_phases,
  sub.created_at as submission_date,
  sub.temperature as submission_temperature,
  sub.humidity as submission_humidity
FROM petri_observations_partitioned po
JOIN sites s ON po.site_id = s.site_id
JOIN pilot_programs p ON po.program_id = p.program_id
JOIN submissions sub ON po.submission_id = sub.submission_id
UNION ALL
SELECT 
  go.*,
  'gasifier' as observation_type,
  s.name as site_name,
  p.name as program_name,
  p.phases as program_phases,
  sub.created_at as submission_date,
  sub.temperature as submission_temperature,
  sub.humidity as submission_humidity
FROM gasifier_observations_partitioned go
JOIN sites s ON go.site_id = s.site_id
JOIN pilot_programs p ON go.program_id = p.program_id
JOIN submissions sub ON go.submission_id = sub.submission_id;

-- =====================================================
-- PART 6: PARTITION PRUNING HELPERS
-- =====================================================

-- Function to get partition name for direct queries
CREATE OR REPLACE FUNCTION partition_mgmt.get_partition_name(
  p_table_base text,
  p_program_id uuid,
  p_site_id uuid DEFAULT NULL,
  p_date date DEFAULT NULL
) RETURNS text AS $$
DECLARE
  v_partition_name text;
  v_safe_prog_id text;
  v_safe_site_id text;
BEGIN
  v_safe_prog_id := 'prog_' || replace(p_program_id::text, '-', '');
  v_partition_name := p_table_base || '_' || v_safe_prog_id;
  
  IF p_site_id IS NOT NULL THEN
    v_safe_site_id := 'site_' || replace(p_site_id::text, '-', '');
    v_partition_name := v_partition_name || '_' || v_safe_site_id;
    
    IF p_date IS NOT NULL THEN
      v_partition_name := v_partition_name || '_' || to_char(p_date, 'YYYY_MM');
    END IF;
  END IF;
  
  -- Verify partition exists
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = v_partition_name
  ) THEN
    RETURN v_partition_name;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PART 7: AUTOMATED MAINTENANCE
-- =====================================================

-- Function to drop old empty partitions
CREATE OR REPLACE FUNCTION partition_mgmt.cleanup_empty_partitions(
  p_days_old integer DEFAULT 7
) RETURNS integer AS $$
DECLARE
  v_count integer := 0;
  v_partition record;
BEGIN
  FOR v_partition IN 
    SELECT pr.partition_name 
    FROM partition_mgmt.partition_registry pr
    WHERE pr.row_count = 0
      AND pr.created_at < CURRENT_TIMESTAMP - (p_days_old || ' days')::interval
      AND EXISTS (
        SELECT 1 FROM pg_class WHERE relname = pr.partition_name
      )
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I', v_partition.partition_name);
    DELETE FROM partition_mgmt.partition_registry 
    WHERE partition_name = v_partition.partition_name;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule maintenance
CREATE OR REPLACE FUNCTION partition_mgmt.schedule_maintenance()
RETURNS void AS $$
BEGIN
  -- Update statistics
  PERFORM partition_mgmt.update_partition_stats();
  
  -- Analyze partitions
  PERFORM partition_mgmt.analyze_all_partitions();
  
  -- Cleanup empty partitions older than 30 days
  PERFORM partition_mgmt.cleanup_empty_partitions(30);
  
  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;
END;
$$ LANGUAGE plpgsql;

COMMIT;