-- Test Analytics Performance After Migration 002

-- 1. First, refresh the materialized view with current data
REFRESH MATERIALIZED VIEW mv_daily_metrics;

-- 2. Show summary of what's in the materialized view
SELECT 
  'Materialized View Summary' as report,
  COUNT(*) as total_rows,
  COUNT(DISTINCT company_id) as companies,
  COUNT(DISTINCT program_id) as programs,
  COUNT(DISTINCT site_id) as sites,
  MIN(metric_date) as earliest_date,
  MAX(metric_date) as latest_date
FROM mv_daily_metrics;

-- 3. Compare query performance: BEFORE (direct query)
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
-- Original complex query
WITH phase_mapping AS (
  SELECT 
    p.program_id,
    p.company_id,
    phase->>'name' as phase_name,
    (phase->>'start_date')::date as phase_start,
    (phase->>'end_date')::date as phase_end
  FROM pilot_programs p,
  jsonb_array_elements(p.phases) as phase
)
SELECT 
  date_trunc('day', po.created_at) as metric_date,
  po.company_id,
  po.program_id,
  COUNT(DISTINCT po.observation_id) as observation_count,
  AVG(po.growth_index) as avg_growth_index
FROM petri_observations po
LEFT JOIN phase_mapping pm 
  ON po.program_id = pm.program_id 
  AND po.created_at::date BETWEEN pm.phase_start AND pm.phase_end
WHERE po.company_id = (SELECT company_id FROM companies LIMIT 1)
  AND po.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY 1, 2, 3;

-- 4. Compare query performance: AFTER (using materialized view)
EXPLAIN (ANALYZE, BUFFERS)
-- New fast query using materialized view
SELECT 
  metric_date,
  company_id,
  program_id,
  observation_count,
  avg_growth_index
FROM mv_daily_metrics
WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
  AND metric_date >= CURRENT_DATE - INTERVAL '30 days';

-- 5. Dashboard-style queries that executives would use

-- Executive Summary: Program Performance Overview
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  c.name as company_name,
  COUNT(DISTINCT m.program_id) as active_programs,
  COUNT(DISTINCT m.site_id) as total_sites,
  SUM(m.observation_count) as total_observations,
  AVG(m.avg_growth_index) as overall_avg_growth,
  MAX(m.max_growth_index) as peak_growth,
  AVG(m.flagged_count) as avg_flags_per_day
FROM mv_daily_metrics m
JOIN companies c ON m.company_id = c.company_id
WHERE m.metric_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.company_id, c.name;

-- Phase Comparison: Which phases are most effective?
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  phase_name,
  COUNT(DISTINCT site_id) as sites_in_phase,
  AVG(avg_growth_index) as avg_growth,
  STDDEV(avg_growth_index) as growth_consistency,
  SUM(observation_count) as total_observations
FROM mv_daily_metrics
WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
  AND phase_name IS NOT NULL
GROUP BY phase_name
ORDER BY avg_growth DESC;

-- 6. Test new effectiveness metrics table (insert sample data)
INSERT INTO effectiveness_metrics (
  company_id, program_id, site_id, calculation_date, phase_name,
  growth_suppression_rate, coverage_effectiveness, treatment_efficiency,
  treatment_cost_usd, pest_damage_prevented_usd, roi_percentage
)
SELECT 
  company_id,
  program_id,
  site_id,
  CURRENT_DATE as calculation_date,
  'Treatment' as phase_name,
  85.5 as growth_suppression_rate,  -- 85.5% reduction
  0.92 as coverage_effectiveness,    -- 92% coverage
  4.2 as treatment_efficiency,       -- 4.2x efficiency
  1250.00 as treatment_cost_usd,
  15600.00 as pest_damage_prevented_usd,
  1148 as roi_percentage            -- 1148% ROI
FROM (
  SELECT DISTINCT company_id, program_id, site_id 
  FROM mv_daily_metrics 
  LIMIT 5
) sample_sites;

-- 7. Query effectiveness metrics (what executives care about)
SELECT 
  c.name as company_name,
  p.name as program_name,
  s.name as site_name,
  e.growth_suppression_rate || '%' as suppression,
  '$' || e.treatment_cost_usd as cost,
  '$' || e.pest_damage_prevented_usd as savings,
  e.roi_percentage || '%' as roi
FROM effectiveness_metrics e
JOIN companies c ON e.company_id = c.company_id
JOIN pilot_programs p ON e.program_id = p.program_id
JOIN sites s ON e.site_id = s.site_id
ORDER BY e.roi_percentage DESC;

-- 8. Performance comparison summary
WITH performance_test AS (
  SELECT 
    'Check EXPLAIN output above for execution times' as note,
    'Original query should show 100+ ms' as before_optimization,
    'Materialized view query should show < 10ms' as after_optimization,
    'This represents 10-100x performance improvement' as expected_improvement
)
SELECT * FROM performance_test;