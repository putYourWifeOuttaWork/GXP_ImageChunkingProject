-- Test Partition Migration
-- This script helps test the partitioned table performance with sample data

-- 1. Show current state
SELECT 
  'Current State' as report,
  (SELECT COUNT(*) FROM petri_observations) as original_count,
  (SELECT COUNT(*) FROM petri_observations_partitioned) as partitioned_count,
  (SELECT COUNT(DISTINCT program_id) FROM pilot_programs) as total_programs;

-- 2. Migrate one program's data as a test
DO $$
DECLARE
  v_program_id uuid;
  v_program_name text;
  v_count bigint;
  v_start timestamptz;
  v_duration interval;
BEGIN
  -- Get the program with the most observations
  SELECT p.program_id, p.name, COUNT(po.observation_id)
  INTO v_program_id, v_program_name, v_count
  FROM pilot_programs p
  JOIN petri_observations po ON p.program_id = po.program_id
  GROUP BY p.program_id, p.name
  ORDER BY COUNT(po.observation_id) DESC
  LIMIT 1;
  
  RAISE NOTICE 'Migrating program: % (% observations)', v_program_name, v_count;
  
  v_start := clock_timestamp();
  
  -- Migrate the data
  INSERT INTO petri_observations_partitioned
  SELECT * FROM petri_observations
  WHERE program_id = v_program_id
  ON CONFLICT (observation_id, program_id) DO NOTHING;
  
  v_duration := clock_timestamp() - v_start;
  
  RAISE NOTICE 'Migration completed in %', v_duration;
  
  -- Verify
  SELECT COUNT(*) INTO v_count
  FROM petri_observations_partitioned
  WHERE program_id = v_program_id;
  
  RAISE NOTICE 'Verified % observations in partitioned table', v_count;
END $$;

-- 3. Performance comparison
-- Original table query
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT 
  COUNT(*) as obs_count,
  AVG(growth_index) as avg_growth,
  MAX(growth_index) as max_growth
FROM petri_observations
WHERE program_id = (
  SELECT program_id FROM pilot_programs 
  WHERE EXISTS (
    SELECT 1 FROM petri_observations_partitioned 
    WHERE program_id = pilot_programs.program_id
  )
  LIMIT 1
)
AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Partitioned table query (should be much faster)
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT 
  COUNT(*) as obs_count,
  AVG(growth_index) as avg_growth,
  MAX(growth_index) as max_growth
FROM petri_observations_partitioned
WHERE program_id = (
  SELECT program_id FROM pilot_programs 
  WHERE EXISTS (
    SELECT 1 FROM petri_observations_partitioned 
    WHERE program_id = pilot_programs.program_id
  )
  LIMIT 1
)
AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- 4. Show partition pruning in action
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM petri_observations_partitioned
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1);

-- 5. Test cross-program query (uses multiple partitions)
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  p.name as program_name,
  COUNT(pop.observation_id) as obs_count,
  AVG(pop.growth_index) as avg_growth
FROM pilot_programs p
JOIN petri_observations_partitioned pop ON p.program_id = pop.program_id
WHERE pop.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.program_id, p.name;

-- 6. Full migration script (commented out for safety)
/*
-- CAUTION: This migrates ALL data - run during maintenance window
BEGIN;

-- Migrate all observations
INSERT INTO petri_observations_partitioned
SELECT * FROM petri_observations
ON CONFLICT (observation_id, program_id) DO NOTHING;

-- Verify counts match
DO $$
DECLARE
  v_original bigint;
  v_partitioned bigint;
BEGIN
  SELECT COUNT(*) INTO v_original FROM petri_observations;
  SELECT COUNT(*) INTO v_partitioned FROM petri_observations_partitioned;
  
  IF v_original != v_partitioned THEN
    RAISE EXCEPTION 'Count mismatch: original=%, partitioned=%', 
      v_original, v_partitioned;
  END IF;
  
  RAISE NOTICE 'Successfully migrated % observations', v_original;
END $$;

COMMIT;
*/

-- 7. Performance summary function
CREATE OR REPLACE FUNCTION partition_performance_summary()
RETURNS TABLE (
  metric text,
  value text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'Total Partitions'::text, COUNT(*)::text
  FROM pg_inherits
  JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
  WHERE parent.relname = 'petri_observations_partitioned';
  
  RETURN QUERY
  SELECT 'Largest Partition'::text, 
    child.relname || ' (' || pg_size_pretty(pg_relation_size(child.oid)) || ')'
  FROM pg_inherits
  JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
  JOIN pg_class child ON pg_inherits.inhrelid = child.oid
  WHERE parent.relname = 'petri_observations_partitioned'
  ORDER BY pg_relation_size(child.oid) DESC
  LIMIT 1;
  
  RETURN QUERY
  SELECT 'Partition Pruning'::text, 
    CASE 
      WHEN current_setting('enable_partition_pruning') = 'on' 
      THEN 'ENABLED (queries will skip irrelevant partitions)'
      ELSE 'DISABLED'
    END;
  
  RETURN QUERY
  SELECT 'Expected Speedup'::text, 
    '10-50x for single-program queries after migration';
END;
$$ LANGUAGE plpgsql;

-- Run the summary
SELECT * FROM partition_performance_summary();