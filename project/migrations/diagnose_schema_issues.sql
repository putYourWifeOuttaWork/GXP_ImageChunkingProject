-- Diagnose Schema Issues After Migration

-- 1. Check if the functions exist
SELECT 
  'Function Check' as test,
  proname as function_name,
  pronargs as arg_count,
  pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname IN ('get_table_columns', 'execute_raw_sql')
ORDER BY proname;

-- 2. Check current table structure
SELECT 
  'Table Check' as test,
  tablename,
  CASE 
    WHEN tablename = 'petri_observations' THEN 'PRIMARY (partitioned)'
    WHEN tablename = 'petri_observations_original' THEN 'BACKUP (original)'
    WHEN tablename = 'petri_observations_partitioned' THEN 'ERROR - Should not exist'
    ELSE 'OTHER'
  END as status
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename LIKE '%petri_observations%'
ORDER BY tablename;

-- 3. Check if views need updating
SELECT 
  'View Dependencies' as test,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
AND definition LIKE '%petri_observations%'
LIMIT 5;

-- 4. Test the get_table_columns function
DO $$
BEGIN
  -- Try to execute the function that's hanging
  PERFORM get_table_columns();
  RAISE NOTICE 'get_table_columns() executed successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error executing get_table_columns(): %', SQLERRM;
END $$;

-- 5. Check for any blocking queries
SELECT 
  'Blocking Queries' as test,
  pid,
  usename,
  application_name,
  client_addr,
  query_start,
  state,
  LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE state != 'idle'
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;

-- 6. Check RLS policies (might be blocking)
SELECT 
  'RLS Status' as test,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'petri_observations'
ORDER BY policyname;

-- 7. Quick fix attempt - recreate get_table_columns if it's the issue
CREATE OR REPLACE FUNCTION get_table_columns()
RETURNS TABLE(table_name text, column_name text, data_type text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    t.table_name::text,
    c.column_name::text,
    c.data_type::text
  FROM information_schema.tables t
  JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name != 'petri_observations_original' -- Exclude backup table
  ORDER BY t.table_name, c.ordinal_position;
$$;