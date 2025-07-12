-- Verify Migration 001 Results

-- 1. Check that company_id is populated everywhere
SELECT 
  'petri_observations' as table_name, 
  COUNT(*) as total_rows,
  COUNT(company_id) as rows_with_company,
  COUNT(*) - COUNT(company_id) as missing_company
FROM petri_observations
UNION ALL
SELECT 
  'gasifier_observations', 
  COUNT(*),
  COUNT(company_id),
  COUNT(*) - COUNT(company_id)
FROM gasifier_observations
UNION ALL
SELECT 
  'submissions', 
  COUNT(*),
  COUNT(company_id),
  COUNT(*) - COUNT(company_id)
FROM submissions;

-- 2. Test the enhanced view
SELECT 
  'Enhanced view record count' as test,
  COUNT(*) as count
FROM v_petri_observations_enhanced;

-- 3. Sample data from enhanced view
SELECT 
  observation_id,
  petri_code,
  site_name,
  current_program_name,
  company_name,
  growth_index,
  created_at
FROM v_petri_observations_enhanced
LIMIT 5;

-- 4. Test query performance with company filter (should be FAST now!)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM petri_observations 
WHERE company_id = (SELECT company_id FROM companies LIMIT 1);

-- 5. Test multi-dimensional query (company + program + time)
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  COUNT(*) as observation_count,
  AVG(growth_index) as avg_growth
FROM petri_observations
WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
  AND program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- 6. Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('petri_observations', 'gasifier_observations', 'submissions')
  AND indexname LIKE '%company%'
ORDER BY tablename, indexname;

-- 7. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('petri_observations', 'gasifier_observations', 'submissions')
ORDER BY tablename, policyname;