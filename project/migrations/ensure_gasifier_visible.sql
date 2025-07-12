-- Ensure gasifier_observations is visible to Report Builder

-- 1. Check why gasifier_observations might not be showing
SELECT 
  'Gasifier Visibility Check' as test,
  table_name,
  COUNT(*) as columns
FROM get_table_columns()
WHERE table_name = 'gasifier_observations'
GROUP BY table_name;

-- 2. If it's not showing, check the raw data
SELECT 
  'Direct Column Check' as test,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gasifier_observations';

-- 3. Test the function with specific table name
SELECT 
  'Function Test' as test,
  COUNT(*) as columns_returned
FROM get_table_columns('gasifier_observations');

-- 4. If gasifier_observations has no columns or is missing, let's check its structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gasifier_observations'
ORDER BY ordinal_position
LIMIT 10;

-- 5. Quick test - can we query it?
SELECT COUNT(*) as row_count
FROM gasifier_observations
LIMIT 1;