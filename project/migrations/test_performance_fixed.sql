-- Performance Summary (Fixed)
-- ===========================

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
    'Partitions Created',
    COUNT(*)::text
  FROM pg_class 
  WHERE relname LIKE 'petri_obs_prog_%'
)
SELECT * FROM test_results;

-- Partition Statistics
-- ===================

SELECT 
  'Partition Statistics' as report_section,
  child.relname as partition_name,
  pg_size_pretty(pg_relation_size(child.oid)) as data_size,
  pg_size_pretty(pg_total_relation_size(child.oid)) as total_size_with_indexes
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'petri_observations_partitioned'
ORDER BY pg_relation_size(child.oid) DESC;

-- Quick Performance Comparison
-- ===========================

DO $$
DECLARE
  v_start timestamptz;
  v_original_time interval;
  v_partitioned_time interval;
  v_program_id uuid;
  v_count bigint;
BEGIN
  -- Get a test program with data
  SELECT program_id INTO v_program_id 
  FROM petri_observations_partitioned 
  GROUP BY program_id 
  ORDER BY COUNT(*) DESC 
  LIMIT 1;
  
  IF v_program_id IS NOT NULL THEN
    -- Test original table
    v_start := clock_timestamp();
    SELECT COUNT(*) INTO v_count FROM petri_observations WHERE program_id = v_program_id;
    v_original_time := clock_timestamp() - v_start;
    
    -- Test partitioned table
    v_start := clock_timestamp();
    SELECT COUNT(*) INTO v_count FROM petri_observations_partitioned WHERE program_id = v_program_id;
    v_partitioned_time := clock_timestamp() - v_start;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Performance Test Results:';
    RAISE NOTICE '========================';
    RAISE NOTICE 'Test Program ID: %', v_program_id;
    RAISE NOTICE 'Row Count: %', v_count;
    RAISE NOTICE 'Original Table Time: %', v_original_time;
    RAISE NOTICE 'Partitioned Table Time: %', v_partitioned_time;
    
    IF EXTRACT(milliseconds FROM v_partitioned_time) > 0 THEN
      RAISE NOTICE 'Speed Improvement: %x faster', 
        ROUND(EXTRACT(milliseconds FROM v_original_time)::numeric / 
              EXTRACT(milliseconds FROM v_partitioned_time)::numeric, 1);
    END IF;
  ELSE
    RAISE NOTICE 'No data found in partitioned table to test';
  END IF;
END $$;

-- Data Distribution Check
-- ======================

SELECT 
  'Data Distribution' as report,
  p.name as program_name,
  COUNT(po.*) as observations_in_partition,
  pg_size_pretty(pg_relation_size('petri_obs_prog_' || replace(p.program_id::text, '-', '_'))) as partition_size
FROM pilot_programs p
LEFT JOIN petri_observations_partitioned po ON p.program_id = po.program_id
GROUP BY p.program_id, p.name
ORDER BY COUNT(po.*) DESC;

-- Final Migration Status
-- =====================

SELECT 
  'Migration Status Summary' as report,
  (SELECT COUNT(*) FROM petri_observations) as original_table_rows,
  (SELECT COUNT(*) FROM petri_observations_partitioned) as partitioned_table_rows,
  CASE 
    WHEN (SELECT COUNT(*) FROM petri_observations) = 
         (SELECT COUNT(*) FROM petri_observations_partitioned)
    THEN 'SUCCESS - All data migrated'
    ELSE 'WARNING - Row count mismatch'
  END as status;

-- Ready for Production?
-- ====================

WITH readiness_check AS (
  SELECT 
    CASE 
      WHEN (SELECT COUNT(*) FROM petri_observations) = 
           (SELECT COUNT(*) FROM petri_observations_partitioned)
      THEN 'YES'
      ELSE 'NO - Data mismatch'
    END as data_migrated,
    CASE
      WHEN COUNT(*) > 0 THEN 'YES'
      ELSE 'NO'
    END as partitions_exist,
    CASE
      WHEN (SELECT COUNT(*) FROM mv_daily_metrics) > 0 
      THEN 'YES'
      ELSE 'NO - Run REFRESH MATERIALIZED VIEW mv_daily_metrics'
    END as materialized_view_ready
  FROM pg_class WHERE relname LIKE 'petri_obs_prog_%'
)
SELECT 
  'Production Readiness Check' as status,
  data_migrated,
  partitions_exist,
  materialized_view_ready,
  CASE 
    WHEN data_migrated = 'YES' 
     AND partitions_exist = 'YES' 
     AND materialized_view_ready = 'YES'
    THEN 'READY FOR PRODUCTION! Run: SELECT swap_to_partitioned_table();'
    ELSE 'NOT READY - Check issues above'
  END as recommendation
FROM readiness_check;