-- Migration 003: Simple Partitioning Strategy
-- This implements basic partitioning by program_id for better query performance
-- Simplified version for initial deployment

BEGIN;

-- 1. Check current data distribution
DO $$
DECLARE
  v_row_count bigint;
  v_program_count bigint;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT program_id) 
  INTO v_row_count, v_program_count
  FROM petri_observations;
  
  RAISE NOTICE 'Current petri_observations: % rows across % programs', 
    v_row_count, v_program_count;
END $$;

-- 2. Create partitioned table structure (simpler approach)
-- We'll partition by program_id only for now
CREATE TABLE IF NOT EXISTS petri_observations_partitioned (
  LIKE petri_observations INCLUDING ALL
) PARTITION BY LIST (program_id);

-- 3. Create a default partition for unmapped data
CREATE TABLE IF NOT EXISTS petri_obs_default 
PARTITION OF petri_observations_partitioned DEFAULT;

-- 4. Create partitions for existing programs
DO $$
DECLARE
  prog RECORD;
  partition_name text;
  v_created integer := 0;
BEGIN
  FOR prog IN 
    SELECT DISTINCT p.program_id, p.name, COUNT(po.observation_id) as obs_count
    FROM pilot_programs p
    LEFT JOIN petri_observations po ON p.program_id = po.program_id
    GROUP BY p.program_id, p.name
    ORDER BY obs_count DESC
  LOOP
    -- Create safe partition name (replace hyphens with underscores)
    partition_name := 'petri_obs_prog_' || replace(prog.program_id::text, '-', '_');
    
    -- Check if partition exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = partition_name
      AND n.nspname = 'public'
    ) THEN
      -- Create the partition
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF petri_observations_partitioned FOR VALUES IN (%L)',
        partition_name,
        prog.program_id
      );
      
      v_created := v_created + 1;
      RAISE NOTICE 'Created partition % for program % (% observations)', 
        partition_name, prog.name, prog.obs_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Created % new partitions', v_created;
END $$;

-- 5. Create function to auto-create partitions for new programs
CREATE OR REPLACE FUNCTION auto_create_program_partition()
RETURNS TRIGGER AS $$
DECLARE
  partition_name text;
BEGIN
  -- Generate partition name
  partition_name := 'petri_obs_prog_' || replace(NEW.program_id::text, '-', '_');
  
  -- Check if partition exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = partition_name
    AND n.nspname = 'public'
  ) THEN
    -- Create the partition
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF petri_observations_partitioned FOR VALUES IN (%L)',
      partition_name,
      NEW.program_id
    );
    
    RAISE NOTICE 'Auto-created partition % for new program %', partition_name, NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for auto-partition creation
DROP TRIGGER IF EXISTS create_partition_on_program ON pilot_programs;
CREATE TRIGGER create_partition_on_program
  AFTER INSERT ON pilot_programs
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_program_partition();

-- 7. Create optimized indexes on each partition
DO $$
DECLARE
  part RECORD;
BEGIN
  -- Get all partitions
  FOR part IN 
    SELECT 
      c.relname as partition_name,
      c.oid::regclass as partition_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_inherits i ON i.inhrelid = c.oid
    WHERE n.nspname = 'public'
    AND c.relname LIKE 'petri_obs_prog_%'
    AND c.relkind = 'r'
  LOOP
    -- Create optimized indexes if they don't exist
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (created_at DESC)',
      part.partition_name || '_created_idx',
      part.partition_oid::text
    );
    
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (site_id, created_at DESC)',
      part.partition_name || '_site_idx',
      part.partition_oid::text
    );
    
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (growth_index) WHERE growth_index IS NOT NULL',
      part.partition_name || '_growth_idx',
      part.partition_oid::text
    );
  END LOOP;
END $$;

-- 8. Create a view for testing partition performance
CREATE OR REPLACE VIEW v_partition_test AS
SELECT 
  'original' as table_type,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('petri_observations')) as total_size
FROM petri_observations
UNION ALL
SELECT 
  'partitioned' as table_type,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('petri_observations_partitioned')) as total_size
FROM petri_observations_partitioned;

-- 9. Create helper function for partition-aware queries
CREATE OR REPLACE FUNCTION get_program_observations(
  p_company_id uuid,
  p_program_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
) RETURNS TABLE (
  observation_id uuid,
  petri_code varchar,
  growth_index numeric,
  created_at timestamptz,
  site_name varchar
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.observation_id,
    po.petri_code,
    po.growth_index,
    po.created_at,
    s.name as site_name
  FROM petri_observations po  -- Will use partitioned table after migration
  JOIN sites s ON po.site_id = s.site_id
  WHERE po.company_id = p_company_id
    AND po.program_id = p_program_id
    AND (p_start_date IS NULL OR po.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR po.created_at::date <= p_end_date)
  ORDER BY po.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- 10. Show partition information
SELECT 
  'Partitioning structure created' as status,
  'Run test queries to verify performance' as next_step,
  'Data migration can be done separately' as note;

-- Display partition info
SELECT 
  parent.relname as parent_table,
  child.relname as partition_name,
  pg_size_pretty(pg_relation_size(child.oid)) as partition_size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'petri_observations_partitioned'
ORDER BY child.relname;

COMMIT;