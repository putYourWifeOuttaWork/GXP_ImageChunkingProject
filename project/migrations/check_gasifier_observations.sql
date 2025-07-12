-- Check status of gasifier_observations table

-- 1. Does the table exist?
SELECT 
  'Table Existence Check' as test,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%gasifier%'
ORDER BY tablename;

-- 2. If it exists, how many columns?
SELECT 
  'Gasifier Table Columns' as info,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gasifier_observations';

-- 3. Check all observation tables
SELECT 
  'All Observation Tables' as category,
  table_name,
  table_type,
  CASE 
    WHEN table_name LIKE '%_prog_%' THEN 'Partition Child'
    WHEN table_name LIKE '%_default' THEN 'Default Partition'
    WHEN table_name LIKE '%_original' THEN 'Backup Table'
    ELSE 'Main Table'
  END as table_role
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%observations%'
ORDER BY 
  CASE 
    WHEN table_name = 'petri_observations' THEN 1
    WHEN table_name = 'gasifier_observations' THEN 2
    ELSE 3
  END,
  table_name;