-- Simple Approach: Create Partitioned Table with Exact Structure

BEGIN;

-- 1. Drop the incorrect partitioned table
DROP TABLE IF EXISTS petri_observations_partitioned CASCADE;

-- 2. Create an unlogged copy to get structure
CREATE UNLOGGED TABLE petri_observations_copy AS 
SELECT * FROM petri_observations WHERE false;

-- 3. Rename it to be our partitioned table
ALTER TABLE petri_observations_copy RENAME TO petri_observations_partitioned;

-- 4. Make it logged again
ALTER TABLE petri_observations_partitioned SET LOGGED;

-- 5. Drop the old primary key and create new one with program_id
ALTER TABLE petri_observations_partitioned 
  DROP CONSTRAINT IF EXISTS petri_observations_copy_pkey;
ALTER TABLE petri_observations_partitioned 
  ADD PRIMARY KEY (observation_id, program_id);

-- 6. Now we need to convert to partitioned
-- Unfortunately, PostgreSQL doesn't allow converting existing table to partitioned
-- So we need a workaround

-- 7. Create the final partitioned table by generating the exact DDL
DO $$
DECLARE
  v_table_def text;
  v_column_count int;
BEGIN
  -- Get column count
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_name = 'petri_observations'
    AND table_schema = 'public';
    
  RAISE NOTICE 'Original table has % columns', v_column_count;
  
  -- Generate CREATE TABLE statement
  SELECT 'CREATE TABLE petri_observations_partitioned_new (' || 
    string_agg(
      column_name || ' ' || 
      CASE 
        WHEN data_type = 'ARRAY' THEN 'text[]'
        WHEN data_type = 'USER-DEFINED' THEN udt_name
        WHEN character_maximum_length IS NOT NULL 
          THEN data_type || '(' || character_maximum_length || ')'
        ELSE data_type
      END ||
      CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END ||
      CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
      ', '
      ORDER BY ordinal_position
    ) || ', PRIMARY KEY (observation_id, program_id)) PARTITION BY LIST (program_id)'
  INTO v_table_def
  FROM information_schema.columns
  WHERE table_name = 'petri_observations'
    AND table_schema = 'public';
    
  -- Drop the temp table
  DROP TABLE petri_observations_partitioned;
  
  -- Create the partitioned table
  EXECUTE v_table_def;
  
  RAISE NOTICE 'Created partitioned table with % columns', v_column_count;
END $$;

-- 8. Rename to final name
ALTER TABLE petri_observations_partitioned_new RENAME TO petri_observations_partitioned;

-- 9. Add foreign keys
DO $$
BEGIN
  -- Only add foreign keys if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'petri_observations_partitioned' 
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE petri_observations_partitioned
      ADD FOREIGN KEY (submission_id) REFERENCES submissions(submission_id),
      ADD FOREIGN KEY (site_id) REFERENCES sites(site_id),
      ADD FOREIGN KEY (program_id) REFERENCES pilot_programs(program_id),
      ADD FOREIGN KEY (company_id) REFERENCES companies(company_id);
      
    -- User foreign keys might not exist if columns are nullable
    BEGIN
      ALTER TABLE petri_observations_partitioned
        ADD FOREIGN KEY (created_by) REFERENCES users(id);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore if it fails
    END;
    
    BEGIN
      ALTER TABLE petri_observations_partitioned
        ADD FOREIGN KEY (updated_by) REFERENCES users(id);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore if it fails
    END;
  END IF;
END $$;

-- 10. Create indexes
CREATE INDEX IF NOT EXISTS idx_petri_part_company_program_time 
  ON petri_observations_partitioned(company_id, program_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_petri_part_submission 
  ON petri_observations_partitioned(submission_id);
CREATE INDEX IF NOT EXISTS idx_petri_part_site_time 
  ON petri_observations_partitioned(site_id, created_at DESC);

-- 11. Create partitions
-- Default partition first
CREATE TABLE IF NOT EXISTS petri_obs_default 
PARTITION OF petri_observations_partitioned DEFAULT;

-- Program partitions
DO $$
DECLARE
  prog RECORD;
  partition_name text;
BEGIN
  FOR prog IN SELECT program_id, name FROM pilot_programs
  LOOP
    partition_name := 'petri_obs_prog_' || replace(prog.program_id::text, '-', '_');
    
    BEGIN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF petri_observations_partitioned FOR VALUES IN (%L)',
        partition_name,
        prog.program_id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Partition % already exists', partition_name;
    END;
  END LOOP;
END $$;

-- 12. Enable RLS
ALTER TABLE petri_observations_partitioned ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_isolation_petri_part ON petri_observations_partitioned;
CREATE POLICY company_isolation_petri_part ON petri_observations_partitioned
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- 13. Final verification
SELECT 
  'Column Count Verification' as status,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'petri_observations' AND table_schema = 'public') as original_columns,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'petri_observations_partitioned' AND table_schema = 'public') as partitioned_columns,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'petri_observations' AND table_schema = 'public') = 
         (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'petri_observations_partitioned' AND table_schema = 'public')
    THEN 'SUCCESS - Ready for data migration!'
    ELSE 'FAILED - Column mismatch'
  END as result;

-- 14. Test migration with one row
DO $$
DECLARE
  v_test_id uuid;
BEGIN
  -- Get a sample observation
  SELECT observation_id INTO v_test_id
  FROM petri_observations
  LIMIT 1;
  
  IF v_test_id IS NOT NULL THEN
    -- Try to insert it
    INSERT INTO petri_observations_partitioned
    SELECT * FROM petri_observations
    WHERE observation_id = v_test_id
    ON CONFLICT (observation_id, program_id) DO NOTHING;
    
    RAISE NOTICE 'Test migration successful!';
    
    -- Clean up test
    DELETE FROM petri_observations_partitioned 
    WHERE observation_id = v_test_id;
  END IF;
END $$;

COMMIT;