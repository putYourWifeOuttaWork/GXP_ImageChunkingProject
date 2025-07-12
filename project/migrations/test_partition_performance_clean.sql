-- Comprehensive Performance Test Suite for Partitioned Tables
-- Run each section separately to see performance differences

-- Test 1: Single Program Query (Should use partition pruning)
-- =========================================================

-- Original table
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*), AVG(growth_index), MAX(growth_index)
FROM petri_observations
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1);

-- Partitioned table (should be MUCH faster - look for "Partitions" in plan)
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*), AVG(growth_index), MAX(growth_index)
FROM petri_observations_partitioned
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1);

-- Test 2: Date Range Query with Program Filter
-- ===========================================

-- Original table
EXPLAIN (ANALYZE, BUFFERS)
SELECT DATE(created_at) as obs_date, COUNT(*) as daily_count
FROM petri_observations
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY obs_date;

-- Partitioned table
EXPLAIN (ANALYZE, BUFFERS)
SELECT DATE(created_at) as obs_date, COUNT(*) as daily_count
FROM petri_observations_partitioned  
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY obs_date;

-- Test 3: Cross-Program Aggregation
-- =================================

-- Original table
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  p.name as program_name,
  COUNT(po.observation_id) as obs_count,
  AVG(po.growth_index) as avg_growth
FROM pilot_programs p
LEFT JOIN petri_observations po ON p.program_id = po.program_id
WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.program_id, p.name;

-- Partitioned table
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  p.name as program_name,
  COUNT(po.observation_id) as obs_count,
  AVG(po.growth_index) as avg_growth
FROM pilot_programs p
LEFT JOIN petri_observations_partitioned po ON p.program_id = po.program_id
WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.program_id, p.name;

-- Test 4: Company-Wide Dashboard Query
-- ====================================

-- Original table
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  COUNT(DISTINCT program_id) as active_programs,
  COUNT(DISTINCT site_id) as active_sites,
  COUNT(*) as total_observations,
  AVG(growth_index) as avg_growth
FROM petri_observations
WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Partitioned table
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  COUNT(DISTINCT program_id) as active_programs,
  COUNT(DISTINCT site_id) as active_sites,
  COUNT(*) as total_observations,
  AVG(growth_index) as avg_growth
FROM petri_observations_partitioned
WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Test 5: Materialized View Performance
-- =====================================

-- Direct query (slow)
EXPLAIN (ANALYZE, BUFFERS)
WITH daily_stats AS (
  SELECT 
    DATE(created_at) as metric_date,
    program_id,
    COUNT(*) as observation_count,
    AVG(growth_index) as avg_growth_index
  FROM petri_observations_partitioned
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(created_at), program_id
)
SELECT 
  metric_date,
  SUM(observation_count) as total_obs,
  AVG(avg_growth_index) as overall_avg_growth
FROM daily_stats
GROUP BY metric_date
ORDER BY metric_date;

-- Materialized view query (instant)
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  metric_date,
  SUM(observation_count) as total_obs,
  AVG(avg_growth_index) as overall_avg_growth
FROM mv_daily_metrics
WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY metric_date
ORDER BY metric_date;

-- Performance Summary
-- ==================

WITH test_results AS (
  SELECT 
    'Partitioning Active' as feature,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname LIKE 'petri_obs_prog_%'
      ) THEN 'YES' 
      ELSE 'NO' 
    END as status
  UNION ALL
  SELECT 
    'Partition Pruning Enabled',
    current_setting('enable_partition_pruning')
  UNION ALL
  SELECT 
    'Materialized View Fresh',
    CASE 
      WHEN (
        SELECT MAX(metric_date) 
        FROM mv_daily_metrics
      ) >= CURRENT_DATE - INTERVAL '1 day'
      THEN 'YES'
      ELSE 'NO - Needs Refresh'
    END
  UNION ALL
  SELECT 
    'Index Usage',
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND tablename LIKE 'petri_obs%'
        AND idx_scan > 0
      ) THEN 'YES'
      ELSE 'NO - Check indexes'
    END
)
SELECT * FROM test_results;

-- Partition Statistics
-- ===================

SELECT 
  'Partition Statistics' as report_section,
  child.relname as partition_name,
  pg_size_pretty(pg_relation_size(child.oid)) as data_size,
  pg_size_pretty(pg_total_relation_size(child.oid)) as total_size,
  (pg_stat_get_live_tuples(child.oid) + 
   pg_stat_get_dead_tuples(child.oid))::bigint as row_count
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'petri_observations_partitioned'
ORDER BY pg_relation_size(child.oid) DESC;

-- Expected Performance Improvements
-- ================================

SELECT 
  'Performance Expectations' as report_section,
  query_type,
  expected_improvement,
  reason
FROM (VALUES
  ('Single Program Queries', '10-50x faster', 'Partition pruning eliminates scanning other programs'),
  ('Dashboard Aggregations', '10-100x faster', 'Materialized views pre-compute results'),
  ('Date Range Filters', '5-20x faster', 'Indexes on partitions are smaller and more efficient'),
  ('Company-wide Queries', '2-10x faster', 'Parallel scanning of partitions')
) AS t(query_type, expected_improvement, reason);

-- Quick Performance Check
-- ======================

-- This gives you actual execution times
DO $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_original_time interval;
  v_partitioned_time interval;
  v_program_id uuid;
BEGIN
  -- Get a test program
  SELECT program_id INTO v_program_id FROM pilot_programs LIMIT 1;
  
  -- Test original table
  v_start := clock_timestamp();
  PERFORM COUNT(*) FROM petri_observations WHERE program_id = v_program_id;
  v_original_time := clock_timestamp() - v_start;
  
  -- Test partitioned table
  v_start := clock_timestamp();
  PERFORM COUNT(*) FROM petri_observations_partitioned WHERE program_id = v_program_id;
  v_partitioned_time := clock_timestamp() - v_start;
  
  RAISE NOTICE 'Performance Comparison:';
  RAISE NOTICE '  Original table: %', v_original_time;
  RAISE NOTICE '  Partitioned table: %', v_partitioned_time;
  RAISE NOTICE '  Speedup: %x', 
    ROUND(EXTRACT(milliseconds FROM v_original_time) / 
          NULLIF(EXTRACT(milliseconds FROM v_partitioned_time), 0));
END $$;