-- Fix the duplicate table issue in the summary query

-- 1. First, let's see what the function actually returns
SELECT DISTINCT table_name, COUNT(*) as column_count
FROM get_table_columns()
GROUP BY table_name
ORDER BY table_name;

-- 2. The issue was in the final query - it was grouping incorrectly
-- Here's the correct summary query:
SELECT 
  'Tables visible to Report Builder' as info,
  COUNT(DISTINCT table_name) as unique_table_count,
  string_agg(DISTINCT table_name, ', ' ORDER BY table_name) as tables
FROM get_table_columns();

-- 3. Let's also check if gasifier_observations is available
SELECT 
  'Observation Tables Status' as check_type,
  table_name,
  COUNT(*) as column_count
FROM get_table_columns()
WHERE table_name LIKE '%observations%'
GROUP BY table_name
ORDER BY table_name;

-- 4. Check if the report builder can now see the correct tables
SELECT 
  'Report Builder Tables' as category,
  table_name,
  COUNT(*) as columns
FROM get_table_columns()
WHERE table_name IN ('petri_observations', 'gasifier_observations', 'submissions', 'sites', 'pilot_programs')
GROUP BY table_name
ORDER BY 
  CASE table_name
    WHEN 'petri_observations' THEN 1
    WHEN 'gasifier_observations' THEN 2
    WHEN 'submissions' THEN 3
    WHEN 'sites' THEN 4
    WHEN 'pilot_programs' THEN 5
  END;

-- 5. Now refresh your browser and check if the Report Builder loads properly!