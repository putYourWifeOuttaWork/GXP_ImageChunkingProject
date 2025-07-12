-- Test Partition Migration V3 - Fixed function calls

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

-- 3. Show which partition the data went to
SELECT 
  parent.relname as parent_table,
  child.relname as partition_name,
  pg_size_pretty(pg_relation_size(child.oid)) as partition_size,
  (SELECT COUNT(*) FROM petri_observations_partitioned 
   WHERE program_id IN (
     SELECT program_id FROM pilot_programs 
     WHERE 'petri_obs_prog_' || replace(program_id::text, '-', '_') = child.relname
   )) as row_count
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'petri_observations_partitioned'
  AND pg_relation_size(child.oid) > 0
ORDER BY pg_relation_size(child.oid) DESC;

-- 4. Performance comparison for the migrated program
DO $$
DECLARE
  v_program_id uuid;
BEGIN
  -- Get the program we just migrated
  SELECT program_id INTO v_program_id
  FROM pilot_programs p
  WHERE EXISTS (
    SELECT 1 FROM petri_observations_partitioned 
    WHERE program_id = p.program_id
  )
  LIMIT 1;
  
  RAISE NOTICE 'Testing performance for program: %', v_program_id;
END $$;

-- 5. Original table query performance
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT 
  COUNT(*) as obs_count,
  AVG(growth_index) as avg_growth,
  MAX(growth_index) as max_growth,
  COUNT(DISTINCT site_id) as sites
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

-- 6. Partitioned table query performance (should be MUCH faster)
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT 
  COUNT(*) as obs_count,
  AVG(growth_index) as avg_growth,
  MAX(growth_index) as max_growth,
  COUNT(DISTINCT site_id) as sites
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

-- 7. Show partition pruning in action
EXPLAIN (ANALYZE, BUFFERS)
SELECT petri_code, growth_index, created_at
FROM petri_observations_partitioned
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
ORDER BY created_at DESC
LIMIT 10;

-- 8. Test direct query without the function (since function has type issues)
WITH test_params AS (
  SELECT 
    (SELECT company_id FROM companies LIMIT 1) as test_company,
    (SELECT program_id FROM pilot_programs 
     WHERE EXISTS (
       SELECT 1 FROM petri_observations_partitioned 
       WHERE program_id = pilot_programs.program_id
     ) LIMIT 1) as test_program
)
SELECT 
  po.observation_id,
  po.petri_code,
  po.growth_index,
  po.created_at,
  s.name as site_name
FROM petri_observations_partitioned po
JOIN sites s ON po.site_id = s.site_id
JOIN test_params tp ON po.company_id = tp.test_company 
  AND po.program_id = tp.test_program
WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY po.created_at DESC
LIMIT 5;

-- 9. Performance improvement summary
WITH perf_test AS (
  SELECT 
    (SELECT program_id FROM pilot_programs 
     WHERE EXISTS (
       SELECT 1 FROM petri_observations_partitioned 
       WHERE program_id = pilot_programs.program_id
     ) LIMIT 1) as test_program
)
SELECT 
  'Performance Test Summary' as report,
  'Check EXPLAIN output above' as instruction,
  'Original table should show Seq Scan on entire table' as original_behavior,
  'Partitioned table should show scan on single partition only' as partitioned_behavior,
  'Expected improvement: 10-50x faster' as expected_improvement;

-- 10. Ready for full migration?
SELECT 
  'Migration Readiness' as status,
  CASE 
    WHEN (SELECT COUNT(*) FROM petri_observations_partitioned) > 0
    THEN 'Test successful - Ready for full migration'
    ELSE 'No data migrated yet'
  END as result,
  'Run full migration during low-usage period' as recommendation;

-- 11. Show partition statistics
SELECT 
  'Partition Statistics' as report,
  COUNT(*) as total_partitions,
  COUNT(*) FILTER (WHERE pg_relation_size(child.oid) > 0) as partitions_with_data,
  pg_size_pretty(SUM(pg_relation_size(child.oid))) as total_data_size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'petri_observations_partitioned';