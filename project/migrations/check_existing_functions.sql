-- First, let's see what functions exist and their signatures

-- 1. Check all variations of get_table_columns
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc
WHERE proname = 'get_table_columns'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Check if execute_raw_sql exists
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc
WHERE proname = 'execute_raw_sql'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Look for any custom report query functions
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE '%report%' OR proname LIKE '%query%'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- 4. Test if current get_table_columns works
DO $$
BEGIN
  PERFORM * FROM get_table_columns() LIMIT 1;
  RAISE NOTICE 'get_table_columns() works without hanging';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'get_table_columns() error: %', SQLERRM;
END $$;