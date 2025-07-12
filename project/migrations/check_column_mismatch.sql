-- Check Column Mismatch Between Tables

-- 1. List all columns in original table
SELECT 
  'Original Table Columns' as table_info,
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_name = 'petri_observations'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. List all columns in partitioned table
SELECT 
  'Partitioned Table Columns' as table_info,
  column_name,
  data_type,
  ordinal_position
FROM information_schema.columns
WHERE table_name = 'petri_observations_partitioned'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Find missing columns
SELECT 
  'Missing in Partitioned' as issue,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'petri_observations'
  AND table_schema = 'public'
  AND column_name NOT IN (
    SELECT column_name 
    FROM information_schema.columns
    WHERE table_name = 'petri_observations_partitioned'
    AND table_schema = 'public'
  )
ORDER BY ordinal_position;

-- 4. Count columns
SELECT 
  'Column Count Comparison' as check_type,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'petri_observations' AND table_schema = 'public') as original_columns,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'petri_observations_partitioned' AND table_schema = 'public') as partitioned_columns;