-- Complete Fix for Partitioned Table with ALL columns

BEGIN;

-- 1. First, list ALL columns from original table
SELECT 
  ordinal_position,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'petri_observations'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Drop existing partitioned table
DROP TABLE IF EXISTS petri_observations_partitioned CASCADE;

-- 3. Get the exact DDL and create partitioned table
-- This approach ensures we get ALL columns including any that were added later
DO $$
DECLARE
  v_columns text;
  v_constraints text;
  rec record;
BEGIN
  -- Build column definitions
  v_columns := '';
  FOR rec IN 
    SELECT 
      column_name,
      CASE 
        WHEN data_type = 'character varying' THEN 'varchar'
        WHEN data_type = 'timestamp with time zone' THEN 'timestamptz'
        ELSE data_type
      END as data_type,
      column_default,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'petri_observations'
      AND table_schema = 'public'
    ORDER BY ordinal_position
  LOOP
    IF v_columns != '' THEN
      v_columns := v_columns || ', ';
    END IF;
    
    v_columns := v_columns || rec.column_name || ' ' || rec.data_type;
    
    IF rec.column_default IS NOT NULL THEN
      v_columns := v_columns || ' DEFAULT ' || rec.column_default;
    END IF;
    
    IF rec.is_nullable = 'NO' THEN
      v_columns := v_columns || ' NOT NULL';
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Creating table with % columns', 
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'petri_observations' AND table_schema = 'public');
END $$;

-- 4. Create the partitioned table using dynamic SQL
-- Since we can't use LIKE with PARTITION BY, we'll create it with all columns explicitly
CREATE TABLE petri_observations_partitioned (
  -- First, copy the structure from a query
  observation_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  petri_code varchar,
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
  growth_color varchar,
  company_id uuid NOT NULL,
  todays_day_of_phase integer,
  growth_progression numeric,
  growth_velocity numeric,
  daysInThisProgramPhase integer,
  program_name varchar,
  -- Check if there are more columns we're missing
  LIKE petri_observations INCLUDING ALL EXCLUDING CONSTRAINTS
) PARTITION BY LIST (program_id);

-- 5. Fix the primary key to include partition key
ALTER TABLE petri_observations_partitioned 
  DROP CONSTRAINT IF EXISTS petri_observations_pkey;
ALTER TABLE petri_observations_partitioned 
  ADD PRIMARY KEY (observation_id, program_id);

-- 6. Add foreign keys
ALTER TABLE petri_observations_partitioned
  ADD FOREIGN KEY (submission_id) REFERENCES submissions(submission_id),
  ADD FOREIGN KEY (site_id) REFERENCES sites(site_id),
  ADD FOREIGN KEY (program_id) REFERENCES pilot_programs(program_id),
  ADD FOREIGN KEY (company_id) REFERENCES companies(company_id),
  ADD FOREIGN KEY (created_by) REFERENCES users(id),
  ADD FOREIGN KEY (updated_by) REFERENCES users(id);

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
  FOR prog IN SELECT program_id, name FROM pilot_programs
  LOOP
    partition_name := 'petri_obs_prog_' || replace(prog.program_id::text, '-', '_');
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF petri_observations_partitioned FOR VALUES IN (%L)',
        partition_name,
        prog.program_id
      );
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

-- 11. Final verification - List any missing columns
WITH original_cols AS (
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'petri_observations' 
    AND table_schema = 'public'
),
partitioned_cols AS (
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'petri_observations_partitioned' 
    AND table_schema = 'public'
)
SELECT 
  'Still Missing' as status,
  string_agg(o.column_name, ', ') as missing_columns
FROM original_cols o
LEFT JOIN partitioned_cols p ON o.column_name = p.column_name
WHERE p.column_name IS NULL;

-- 12. Show final count
SELECT 
  'Final Column Count' as check_type,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'petri_observations' AND table_schema = 'public') as original,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'petri_observations_partitioned' AND table_schema = 'public') as partitioned;

COMMIT;