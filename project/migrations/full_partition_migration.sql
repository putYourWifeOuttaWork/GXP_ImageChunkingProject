-- Full Partition Migration Script
-- Run this when ready to migrate all data to partitioned table

-- 1. Pre-migration check
DO $$
DECLARE
  v_original_count bigint;
  v_partitioned_count bigint;
BEGIN
  SELECT COUNT(*) INTO v_original_count FROM petri_observations;
  SELECT COUNT(*) INTO v_partitioned_count FROM petri_observations_partitioned;
  
  RAISE NOTICE 'Original table: % rows', v_original_count;
  RAISE NOTICE 'Partitioned table: % rows (before migration)', v_partitioned_count;
  
  IF v_partitioned_count > 0 THEN
    RAISE WARNING 'Partitioned table already contains data. Continuing will merge data.';
  END IF;
END $$;

-- 2. Create progress tracking function
CREATE OR REPLACE FUNCTION log_migration_progress(
  p_message text,
  p_rows_processed bigint DEFAULT NULL
) RETURNS void AS $$
BEGIN
  RAISE NOTICE '[%] % (Rows: %)', 
    to_char(clock_timestamp(), 'HH24:MI:SS'), 
    p_message, 
    COALESCE(p_rows_processed::text, 'N/A');
END;
$$ LANGUAGE plpgsql;

-- 3. Migrate data program by program for better control
DO $$
DECLARE
  prog RECORD;
  v_total_programs integer;
  v_current_program integer := 0;
  v_total_migrated bigint := 0;
  v_program_rows bigint;
  v_start_time timestamptz;
  v_program_start timestamptz;
BEGIN
  v_start_time := clock_timestamp();
  
  SELECT COUNT(*) INTO v_total_programs FROM pilot_programs;
  
  PERFORM log_migration_progress('Starting migration of ' || v_total_programs || ' programs');
  
  FOR prog IN 
    SELECT p.program_id, p.name, COUNT(po.observation_id) as row_count
    FROM pilot_programs p
    LEFT JOIN petri_observations po ON p.program_id = po.program_id
    GROUP BY p.program_id, p.name
    ORDER BY COUNT(po.observation_id) DESC
  LOOP
    v_current_program := v_current_program + 1;
    v_program_start := clock_timestamp();
    
    -- Skip if no data
    IF prog.row_count = 0 THEN
      PERFORM log_migration_progress(
        format('Program %s/%s: %s - No data to migrate', 
          v_current_program, v_total_programs, prog.name),
        0
      );
      CONTINUE;
    END IF;
    
    -- Migrate this program's data
    BEGIN
      INSERT INTO petri_observations_partitioned
      SELECT * FROM petri_observations
      WHERE program_id = prog.program_id
      ON CONFLICT (observation_id, program_id) DO NOTHING;
      
      GET DIAGNOSTICS v_program_rows = ROW_COUNT;
      v_total_migrated := v_total_migrated + v_program_rows;
      
      PERFORM log_migration_progress(
        format('Program %s/%s: %s - Completed in %s', 
          v_current_program, v_total_programs, prog.name,
          clock_timestamp() - v_program_start),
        v_program_rows
      );
      
    EXCEPTION WHEN OTHERS THEN
      PERFORM log_migration_progress(
        format('ERROR migrating program %s: %s', prog.name, SQLERRM)
      );
      RAISE;
    END;
    
    -- Optional: Add a small delay to reduce load
    -- PERFORM pg_sleep(0.1);
  END LOOP;
  
  PERFORM log_migration_progress(
    format('Migration completed in %s', clock_timestamp() - v_start_time),
    v_total_migrated
  );
END $$;

-- 4. Verify migration success
DO $$
DECLARE
  v_original_count bigint;
  v_partitioned_count bigint;
  v_missing_count bigint;
BEGIN
  SELECT COUNT(*) INTO v_original_count FROM petri_observations;
  SELECT COUNT(*) INTO v_partitioned_count FROM petri_observations_partitioned;
  
  -- Check for any missing records
  SELECT COUNT(*) INTO v_missing_count
  FROM petri_observations o
  WHERE NOT EXISTS (
    SELECT 1 FROM petri_observations_partitioned p
    WHERE p.observation_id = o.observation_id
  );
  
  RAISE NOTICE 'Verification Results:';
  RAISE NOTICE '  Original table: % rows', v_original_count;
  RAISE NOTICE '  Partitioned table: % rows', v_partitioned_count;
  RAISE NOTICE '  Missing records: % rows', v_missing_count;
  
  IF v_missing_count > 0 THEN
    RAISE WARNING 'Some records were not migrated. Investigation needed.';
  ELSIF v_original_count = v_partitioned_count THEN
    RAISE NOTICE 'SUCCESS: All records migrated successfully!';
  END IF;
END $$;

-- 5. Show partition sizes after migration
SELECT 
  'Partition Sizes After Migration' as report,
  child.relname as partition_name,
  pg_size_pretty(pg_relation_size(child.oid)) as size,
  pg_size_pretty(pg_total_relation_size(child.oid)) as total_size_with_indexes
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'petri_observations_partitioned'
ORDER BY pg_relation_size(child.oid) DESC;

-- 6. Create table swap function (for final cutover)
CREATE OR REPLACE FUNCTION swap_to_partitioned_table()
RETURNS void AS $$
BEGIN
  -- This function swaps the tables when you're ready
  -- DO NOT RUN until you've tested thoroughly!
  
  RAISE NOTICE 'Swapping tables...';
  
  -- Rename tables
  ALTER TABLE petri_observations RENAME TO petri_observations_original;
  ALTER TABLE petri_observations_partitioned RENAME TO petri_observations;
  
  -- Update any views that reference the table
  -- (Add any view recreation here if needed)
  
  RAISE NOTICE 'Table swap complete!';
  RAISE NOTICE 'Original table is now: petri_observations_original';
  RAISE NOTICE 'Partitioned table is now: petri_observations';
END;
$$ LANGUAGE plpgsql;

-- 7. Instructions for final cutover
SELECT 
  'Next Steps' as action,
  'Test application with partitioned table' as step_1,
  'When ready, run: SELECT swap_to_partitioned_table();' as step_2,
  'Keep original table for rollback if needed' as step_3;

-- 8. Cleanup
DROP FUNCTION IF EXISTS log_migration_progress(text, bigint);