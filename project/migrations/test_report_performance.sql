-- Test Report Builder Query Performance

-- 1. Get a sample company and program for testing
WITH test_data AS (
  SELECT 
    c.company_id,
    c.name as company_name,
    p.program_id,
    p.name as program_name
  FROM companies c
  JOIN pilot_programs p ON c.company_id = p.company_id
  LIMIT 1
)
SELECT * FROM test_data;

-- 2. Test typical report builder queries

-- Query 1: Dashboard Summary (should be < 100ms)
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT 
  COUNT(DISTINCT po.observation_id) as total_observations,
  COUNT(DISTINCT po.petri_code) as unique_petris,
  COUNT(DISTINCT po.site_id) as sites_monitored,
  AVG(po.growth_index) as avg_growth,
  MAX(po.growth_index) as max_growth
FROM petri_observations po
WHERE po.company_id = (SELECT company_id FROM companies LIMIT 1)
  AND po.created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Query 2: Time Series for Charts (should be < 200ms)
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  date_trunc('day', created_at) as observation_date,
  COUNT(*) as daily_count,
  AVG(growth_index) as avg_growth,
  MAX(growth_index) as max_growth
FROM petri_observations
WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
  AND program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date_trunc('day', created_at)
ORDER BY observation_date;

-- Query 3: Site Comparison (for TreeMap/Heatmap)
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  s.name as site_name,
  s.type as site_type,
  COUNT(po.observation_id) as observation_count,
  AVG(po.growth_index) as avg_growth,
  STDDEV(po.growth_index) as growth_variance
FROM petri_observations po
JOIN sites s ON po.site_id = s.site_id
WHERE po.company_id = (SELECT company_id FROM companies LIMIT 1)
  AND po.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY s.site_id, s.name, s.type
ORDER BY avg_growth DESC;

-- 3. Test the enhanced view performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  site_name,
  current_program_name,
  COUNT(*) as count,
  AVG(growth_index) as avg_growth
FROM v_petri_observations_enhanced
WHERE company_name = (SELECT name FROM companies LIMIT 1)
GROUP BY site_name, current_program_name;

-- 4. Show actual execution times from the JSON explain
WITH query_plan AS (
  SELECT 
    COUNT(DISTINCT po.observation_id) as total_observations
  FROM petri_observations po
  WHERE po.company_id = (SELECT company_id FROM companies LIMIT 1)
    AND po.created_at >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT 
  'Check the "Execution Time" in the EXPLAIN output above' as note,
  'Times under 50ms are excellent' as performance_guide,
  'Times under 200ms are good' as performance_guide2,
  'Times over 1000ms need optimization' as performance_guide3;