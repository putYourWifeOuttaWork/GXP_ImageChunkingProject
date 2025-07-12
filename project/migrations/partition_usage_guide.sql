-- Partition Usage Guide: Leveraging the New Partitioning System
-- =============================================================

-- 1. CHECKING PARTITION STATUS
-- ----------------------------

-- View all partitions for a table
SELECT 
    schemaname,
    tablename as partition_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename LIKE 'petri_obs_%' 
ORDER BY tablename;

-- Check partition health and statistics
SELECT * FROM partition_mgmt.partition_statistics 
ORDER BY last_analyzed DESC;

-- See which partitions would be used for a specific query
EXPLAIN (ANALYZE, BUFFERS, PARTITION) 
SELECT * FROM petri_observations_partitioned 
WHERE program_id = 'your-program-id' 
AND created_at >= '2025-01-01';

-- 2. OPTIMIZED QUERY PATTERNS
-- ---------------------------

-- Fast program-specific queries (uses partition pruning)
SELECT 
    COUNT(*) as observation_count,
    AVG(growth_index) as avg_growth,
    MAX(growth_index) as max_growth
FROM petri_observations_partitioned
WHERE program_id = 'prg00000-0000-4000-8000-000000000001'
AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Ultra-fast site-specific queries
SELECT *
FROM petri_observations_partitioned
WHERE program_id = 'prg00000-0000-4000-8000-000000000001'
AND site_id = 'sit00000-0000-4000-8000-000000000001'
AND created_at >= '2025-01-01'
ORDER BY created_at DESC
LIMIT 100;

-- Efficient date range queries
SELECT 
    DATE_TRUNC('day', created_at) as observation_date,
    COUNT(*) as daily_count,
    AVG(growth_index) as avg_growth
FROM petri_observations_partitioned
WHERE created_at BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY 1
ORDER BY 1;

-- 3. MATERIALIZED VIEW USAGE FOR DASHBOARDS
-- -----------------------------------------

-- Refresh materialized views (done automatically via maintenance)
REFRESH MATERIALIZED VIEW CONCURRENTLY partition_mgmt.mv_program_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY partition_mgmt.mv_site_daily_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY partition_mgmt.mv_growth_progression;

-- Use materialized views for instant dashboard queries
SELECT * FROM partition_mgmt.mv_program_stats 
WHERE program_id = 'your-program-id';

SELECT * FROM partition_mgmt.mv_site_daily_stats 
WHERE site_id = 'your-site-id' 
AND stats_date >= CURRENT_DATE - INTERVAL '7 days';

-- 4. REPORTING OPTIMIZATIONS
-- -------------------------

-- For the reporting builder, prefer partitioned tables
-- Update your data sources to use:
-- - petri_observations_partitioned (instead of petri_observations)
-- - gasifier_observations_partitioned (instead of gasifier_observations)

-- Example optimized reporting query
WITH program_data AS (
    SELECT 
        p.program_id,
        p.site_id,
        DATE_TRUNC('day', p.created_at) as observation_date,
        COUNT(*) as observation_count,
        AVG(p.growth_index) as avg_growth_index,
        AVG(p.outdoor_temperature) as avg_temperature,
        AVG(p.outdoor_humidity) as avg_humidity
    FROM petri_observations_partitioned p
    WHERE p.program_id = 'prg00000-0000-4000-8000-000000000001'
    AND p.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY 1, 2, 3
)
SELECT 
    pd.*,
    s.name as site_name,
    pp.name as program_name
FROM program_data pd
JOIN sites s ON pd.site_id = s.site_id
JOIN pilot_programs pp ON pd.program_id = pp.program_id
ORDER BY pd.observation_date DESC;

-- 5. MAINTENANCE OPERATIONS
-- ------------------------

-- Run manual maintenance (usually automated via cron)
SELECT partition_mgmt.schedule_maintenance();

-- Pre-create partitions for a new program
SELECT partition_mgmt.precreate_program_partitions('new-program-id');

-- Analyze specific partitions after bulk load
ANALYZE petri_obs_prog_abc123_site_def456_2025_01;

-- Check for empty partitions that can be cleaned up
SELECT partition_mgmt.cleanup_empty_partitions();

-- 6. MONITORING PARTITION PERFORMANCE
-- -----------------------------------

-- View partition access patterns
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename LIKE '%_partitioned%'
ORDER BY n_tup_ins DESC;

-- Check partition sizes and growth
SELECT 
    parent.relname AS parent_table,
    child.relname AS partition_name,
    pg_size_pretty(pg_relation_size(child.oid)) AS partition_size,
    pg_stat_get_live_tuples(child.oid) AS live_rows
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname IN ('petri_observations_partitioned', 'gasifier_observations_partitioned')
ORDER BY parent.relname, pg_relation_size(child.oid) DESC;

-- 7. BEST PRACTICES
-- ----------------

/*
1. Always include program_id in WHERE clauses for best performance
2. When possible, also include site_id and date ranges
3. Use the _partitioned tables for all new queries
4. Leverage materialized views for dashboard aggregations
5. Monitor partition statistics regularly
6. Run maintenance during low-traffic periods
7. Pre-create partitions for known future programs
*/