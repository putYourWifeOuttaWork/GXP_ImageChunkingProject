-- Migration 003: Simple Partitioning Strategy (Fixed)
-- This implements basic partitioning by program_id for better query performance
-- Fixed version that handles unique constraint requirements

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

-- 2. Create partitioned table structure
-- Note: We must manually define the structure because INCLUDING ALL 
-- would copy constraints that conflict with partitioning requirements
CREATE TABLE IF NOT EXISTS petri_observations_partitioned (
  observation_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  
  -- Core fields
  petri_code varchar,
  growth_index numeric,
  growth_color varchar,
  growth_progression numeric,
  growth_velocity numeric,
  
  -- Location/context
  submission_id uuid NOT NULL,
  site_id uuid NOT NULL,
  program_id uuid NOT NULL,
  company_id uuid NOT NULL,
  
  -- Metadata fields
  notes text,
  flag_for_review boolean DEFAULT false,
  
  -- Environmental data
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  
  -- Phase tracking
  todays_day_of_phase integer,
  daysInThisProgramPhase integer,
  program_name varchar,
  
  -- Images
  image_urls text[],
  images_above text[],
  images_below text[],
  
  -- Additional fields from original table
  PRIMARY KEY (observation_id, program_id), -- Include partition key in PK
  
  -- Foreign keys
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id),
  FOREIGN KEY (site_id) REFERENCES sites(site_id),
  FOREIGN KEY (program_id) REFERENCES pilot_programs(program_id),
  FOREIGN KEY (company_id) REFERENCES companies(company_id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
) PARTITION BY LIST (program_id);

-- 3. Create indexes on the parent table
CREATE INDEX idx_petri_part_company_program_time 
  ON petri_observations_partitioned(company_id, program_id, created_at DESC);

CREATE INDEX idx_petri_part_submission 
  ON petri_observations_partitioned(submission_id);

CREATE INDEX idx_petri_part_site_time 
  ON petri_observations_partitioned(site_id, created_at DESC);

CREATE INDEX idx_petri_part_growth 
  ON petri_observations_partitioned(growth_index) 
  WHERE growth_index IS NOT NULL;

-- 4. Create a default partition for unmapped data
CREATE TABLE IF NOT EXISTS petri_obs_default 
PARTITION OF petri_observations_partitioned DEFAULT;

-- 5. Create partitions for existing programs
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

-- 6. Create function to auto-create partitions for new programs
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

-- 7. Create trigger for auto-partition creation
DROP TRIGGER IF EXISTS create_partition_on_program ON pilot_programs;
CREATE TRIGGER create_partition_on_program
  AFTER INSERT ON pilot_programs
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_program_partition();

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

-- 10. Enable Row Level Security on partitioned table
ALTER TABLE petri_observations_partitioned ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policy matching the original table
CREATE POLICY company_isolation_petri_part ON petri_observations_partitioned
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- 12. Show partition information
SELECT 
  'Partitioning structure created' as status,
  'Fixed unique constraint issue' as fix_applied,
  'Run test queries to verify performance' as next_step;

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