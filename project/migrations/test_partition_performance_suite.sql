-- Comprehensive Performance Test Suite for Partitioned Tables

-- Test 1: Single Program Query (Should use partition pruning)
\echo 'Test 1: Single Program Query Performance'
\echo '======================================='

-- Original table
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT COUNT(*), AVG(growth_index), MAX(growth_index)
FROM petri_observations
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1);

-- Partitioned table (should be MUCH faster)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT COUNT(*), AVG(growth_index), MAX(growth_index)
FROM petri_observations_partitioned
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1);

-- Test 2: Date Range Query with Program Filter
\echo '\nTest 2: Date Range Query Performance'
\echo '===================================='

-- Original table
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT DATE(created_at) as obs_date, COUNT(*) as daily_count
FROM petri_observations
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY obs_date;

-- Partitioned table
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT DATE(created_at) as obs_date, COUNT(*) as daily_count
FROM petri_observations_partitioned  
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY obs_date;

-- Test 3: Cross-Program Aggregation
\echo '\nTest 3: Cross-Program Aggregation Performance'
\echo '============================================'

-- Original table
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT 
  p.name as program_name,
  COUNT(po.observation_id) as obs_count,
  AVG(po.growth_index) as avg_growth
FROM pilot_programs p
LEFT JOIN petri_observations po ON p.program_id = po.program_id
WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.program_id, p.name;

-- Partitioned table
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT 
  p.name as program_name,
  COUNT(po.observation_id) as obs_count,
  AVG(po.growth_index) as avg_growth
FROM pilot_programs p
LEFT JOIN petri_observations_partitioned po ON p.program_id = po.program_id
WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.program_id, p.name;

-- Test 4: Company-Wide Dashboard Query
\echo '\nTest 4: Company Dashboard Query Performance'
\echo '=========================================='

-- Original table
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT 
  COUNT(DISTINCT program_id) as active_programs,
  COUNT(DISTINCT site_id) as active_sites,
  COUNT(*) as total_observations,
  AVG(growth_index) as avg_growth
FROM petri_observations
WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Partitioned table
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT 
  COUNT(DISTINCT program_id) as active_programs,
  COUNT(DISTINCT site_id) as active_sites,
  COUNT(*) as total_observations,
  AVG(growth_index) as avg_growth
FROM petri_observations_partitioned
WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Test 5: Materialized View Performance
\echo '\nTest 5: Materialized View Query Performance'
\echo '=========================================='

-- Direct query (slow)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
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
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT 
  metric_date,
  SUM(observation_count) as total_obs,
  AVG(avg_growth_index) as overall_avg_growth
FROM mv_daily_metrics
WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY metric_date
ORDER BY metric_date;

-- Performance Summary
\echo '\nPerformance Test Summary'
\echo '======================='

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
\echo '\nPartition Statistics'
\echo '==================='

SELECT 
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
\echo '\nExpected Performance Improvements'
\echo '================================'
SELECT 
  'Single Program Queries' as query_type,
  '10-50x faster' as expected_improvement,
  'Partition pruning eliminates scanning other programs' as reason
UNION ALL
SELECT 
  'Dashboard Aggregations',
  '10-100x faster',
  'Materialized views pre-compute results'
UNION ALL  
SELECT 
  'Date Range Filters',
  '5-20x faster',
  'Indexes on partitions are smaller and more efficient'
UNION ALL
SELECT 
  'Company-wide Queries',
  '2-10x faster',
  'Parallel scanning of partitions';