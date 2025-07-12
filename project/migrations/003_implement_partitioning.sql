-- Migration 003: Implement Partitioning Strategy
-- This creates partitioned tables for better query performance

BEGIN;

-- 1. Create new partitioned table structure
CREATE TABLE petri_observations_v2 (
  LIKE petri_observations INCLUDING ALL
) PARTITION BY LIST (program_id);

-- 2. Create function to automatically create program partitions
CREATE OR REPLACE FUNCTION create_program_partition()
RETURNS TRIGGER AS $$
DECLARE
  partition_name text;
  program_uuid text;
BEGIN
  -- Get the program_id as text
  program_uuid := NEW.program_id::text;
  partition_name := 'petri_obs_prog_' || replace(program_uuid, '-', '_');
  
  -- Check if partition exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = partition_name
    AND n.nspname = 'public'
  ) THEN
    -- Create the partition
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF petri_observations_v2 FOR VALUES IN (%L)',
      partition_name,
      NEW.program_id
    );
    
    -- Create indexes on the partition
    EXECUTE format(
      'CREATE INDEX %I ON %I (created_at DESC)',
      partition_name || '_created_idx',
      partition_name
    );
    
    EXECUTE format(
      'CREATE INDEX %I ON %I (site_id, created_at DESC)',
      partition_name || '_site_idx',
      partition_name
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on pilot_programs to auto-create partitions
CREATE TRIGGER create_partition_on_program_insert
  AFTER INSERT ON pilot_programs
  FOR EACH ROW
  EXECUTE FUNCTION create_program_partition();

-- 4. Create partitions for existing programs
DO $$
DECLARE
  prog RECORD;
  partition_name text;
BEGIN
  FOR prog IN SELECT program_id FROM pilot_programs LOOP
    partition_name := 'petri_obs_prog_' || replace(prog.program_id::text, '-', '_');
    
    -- Create partition if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = partition_name
      AND n.nspname = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF petri_observations_v2 FOR VALUES IN (%L)',
        partition_name,
        prog.program_id
      );
      
      -- Create indexes
      EXECUTE format(
        'CREATE INDEX %I ON %I (created_at DESC)',
        partition_name || '_created_idx',
        partition_name
      );
      
      EXECUTE format(
        'CREATE INDEX %I ON %I (site_id, created_at DESC)',
        partition_name || '_site_idx',
        partition_name
      );
    END IF;
  END LOOP;
END $$;

-- 5. Create a default partition for any unmapped data
CREATE TABLE petri_obs_default PARTITION OF petri_observations_v2 DEFAULT;

-- 6. Create similar structure for gasifier observations
CREATE TABLE gasifier_observations_v2 (
  LIKE gasifier_observations INCLUDING ALL
) PARTITION BY LIST (program_id);

-- Create default partition
CREATE TABLE gasifier_obs_default PARTITION OF gasifier_observations_v2 DEFAULT;

-- 7. Create views that union both old and new tables during migration
CREATE OR REPLACE VIEW v_petri_observations AS
SELECT * FROM petri_observations
UNION ALL
SELECT * FROM petri_observations_v2;

-- 8. Create optimized query functions
CREATE OR REPLACE FUNCTION get_petri_observations_by_phase(
  p_company_id uuid,
  p_program_id uuid,
  p_phase_name varchar
) RETURNS TABLE (
  observation_id uuid,
  petri_code varchar,
  growth_index numeric,
  created_at timestamptz,
  site_id uuid,
  site_name varchar
) AS $$
BEGIN
  RETURN QUERY
  WITH phase_dates AS (
    SELECT 
      (phase->>'start_date')::date as start_date,
      (phase->>'end_date')::date as end_date
    FROM pilot_programs p,
    jsonb_array_elements(p.phases) as phase
    WHERE p.program_id = p_program_id
      AND phase->>'name' = p_phase_name
    LIMIT 1
  )
  SELECT 
    po.observation_id,
    po.petri_code,
    po.growth_index,
    po.created_at,
    po.site_id,
    s.name as site_name
  FROM petri_observations po
  JOIN sites s ON po.site_id = s.site_id
  JOIN phase_dates pd ON po.created_at::date BETWEEN pd.start_date AND pd.end_date
  WHERE po.company_id = p_company_id
    AND po.program_id = p_program_id
  ORDER BY po.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Create function for site-specific time series
CREATE OR REPLACE FUNCTION get_site_growth_timeline(
  p_company_id uuid,
  p_site_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
) RETURNS TABLE (
  observation_date date,
  avg_growth numeric,
  max_growth numeric,
  observation_count bigint,
  phase_name varchar
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.created_at::date as observation_date,
    AVG(po.growth_index) as avg_growth,
    MAX(po.growth_index) as max_growth,
    COUNT(*) as observation_count,
    get_phase_for_date(po.program_id, po.created_at) as phase_name
  FROM petri_observations po
  WHERE po.company_id = p_company_id
    AND po.site_id = p_site_id
    AND (p_start_date IS NULL OR po.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR po.created_at::date <= p_end_date)
  GROUP BY po.created_at::date, po.program_id
  ORDER BY observation_date;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;