-- Fix Partitioned Table Column Mismatch

BEGIN;

-- 1. First, let's see what columns are missing
DO $$
DECLARE
  v_missing_columns text;
BEGIN
  SELECT string_agg(column_name || ' ' || data_type, ', ')
  INTO v_missing_columns
  FROM information_schema.columns
  WHERE table_name = 'petri_observations'
    AND table_schema = 'public'
    AND column_name NOT IN (
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'petri_observations_partitioned'
      AND table_schema = 'public'
    );
    
  IF v_missing_columns IS NOT NULL THEN
    RAISE NOTICE 'Missing columns: %', v_missing_columns;
  END IF;
END $$;

-- 2. Drop the existing partitioned table and recreate with correct structure
DROP TABLE IF EXISTS petri_observations_partitioned CASCADE;

-- 3. Create new partitioned table copying EXACT structure
CREATE TABLE petri_observations_partitioned (
  LIKE petri_observations INCLUDING DEFAULTS INCLUDING IDENTITY INCLUDING GENERATED
);

-- 4. Now alter it to be partitioned and adjust primary key
ALTER TABLE petri_observations_partitioned DROP CONSTRAINT IF EXISTS petri_observations_pkey;
ALTER TABLE petri_observations_partitioned 
  ADD PRIMARY KEY (observation_id, program_id);

-- 5. Convert to partitioned table
-- First, get the exact column definition for partitioning
DO $$
DECLARE
  v_sql text;
BEGIN
  -- PostgreSQL requires recreating the table as partitioned
  -- So we'll use a temporary table approach
  
  -- Create temp table with exact structure
  CREATE TEMP TABLE temp_petri_structure AS 
  SELECT * FROM petri_observations WHERE 1=0;
  
  -- Get the column list
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
  INTO v_sql
  FROM information_schema.columns
  WHERE table_name = 'petri_observations'
    AND table_schema = 'public';
  
  RAISE NOTICE 'Columns: %', v_sql;
END $$;

-- 6. Recreate as partitioned (the right way)
DROP TABLE IF EXISTS petri_observations_partitioned CASCADE;

-- Create with exact column structure
CREATE TABLE petri_observations_partitioned (
  observation_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  petri_code character varying,
  growth_index numeric,
  notes text,
  flag_for_review boolean DEFAULT false,
  submission_id uuid NOT NULL,
  image_urls text[],
  outdoor_temperature numeric,
  outdoor_humidity numeric,
  images_above text[],
  images_below text[],
  site_id uuid NOT NULL,
  program_id uuid NOT NULL,
  growth_color character varying,
  company_id uuid NOT NULL,
  todays_day_of_phase integer,
  growth_progression numeric,
  growth_velocity numeric,
  daysInThisProgramPhase integer,
  program_name character varying,
  -- Primary key includes partition key
  PRIMARY KEY (observation_id, program_id),
  -- Foreign keys
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id),
  FOREIGN KEY (site_id) REFERENCES sites(site_id),
  FOREIGN KEY (program_id) REFERENCES pilot_programs(program_id),
  FOREIGN KEY (company_id) REFERENCES companies(company_id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
) PARTITION BY LIST (program_id);

-- 7. Create indexes
CREATE INDEX idx_petri_part_company_program_time 
  ON petri_observations_partitioned(company_id, program_id, created_at DESC);
CREATE INDEX idx_petri_part_submission 
  ON petri_observations_partitioned(submission_id);
CREATE INDEX idx_petri_part_site_time 
  ON petri_observations_partitioned(site_id, created_at DESC);

-- 8. Create default partition
CREATE TABLE petri_obs_default 
PARTITION OF petri_observations_partitioned DEFAULT;

-- 9. Create partitions for existing programs
DO $$
DECLARE
  prog RECORD;
  partition_name text;
BEGIN
  FOR prog IN 
    SELECT program_id, name FROM pilot_programs
  LOOP
    partition_name := 'petri_obs_prog_' || replace(prog.program_id::text, '-', '_');
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_class 
      WHERE relname = partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF petri_observations_partitioned FOR VALUES IN (%L)',
        partition_name,
        prog.program_id
      );
      
      RAISE NOTICE 'Created partition % for program %', partition_name, prog.name;
    END IF;
  END LOOP;
END $$;

-- 10. Enable RLS
ALTER TABLE petri_observations_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_isolation_petri_part ON petri_observations_partitioned
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- 11. Verify column match
SELECT 
  'Column Count After Fix' as status,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'petri_observations' AND table_schema = 'public') as original_columns,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'petri_observations_partitioned' AND table_schema = 'public') as partitioned_columns,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'petri_observations' AND table_schema = 'public') = 
         (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'petri_observations_partitioned' AND table_schema = 'public')
    THEN 'MATCH - Ready for migration'
    ELSE 'MISMATCH - Check columns'
  END as result;

COMMIT;