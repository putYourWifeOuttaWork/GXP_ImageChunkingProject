-- Fix Report Builder Functions After Partition Migration

-- 1. Check if the functions exist and what they're doing
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc
WHERE proname IN ('get_table_columns', 'execute_raw_sql')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Drop and recreate get_table_columns to handle partitioned tables
DROP FUNCTION IF EXISTS get_table_columns();
DROP FUNCTION IF EXISTS get_table_columns(text);

-- 3. Create fixed version that works with partitioned tables
CREATE OR REPLACE FUNCTION get_table_columns(p_table_name text DEFAULT NULL)
RETURNS TABLE(
  table_name text,
  column_name text,
  data_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.table_name::text,
    c.column_name::text,
    c.data_type::text
  FROM information_schema.columns c
  JOIN information_schema.tables t 
    ON c.table_name = t.table_name 
    AND c.table_schema = t.table_schema
  WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    -- Handle partitioned tables - use parent table
    AND (
      (p_table_name IS NULL AND c.table_name NOT LIKE '%_prog_%' AND c.table_name NOT LIKE '%_default' AND c.table_name NOT LIKE '%_original')
      OR (p_table_name IS NOT NULL AND c.table_name = p_table_name)
    )
    -- Exclude internal/system tables
    AND c.table_name NOT LIKE 'pg_%'
    AND c.table_name NOT LIKE '_pg_%'
    -- Exclude backup tables
    AND c.table_name NOT LIKE '%_old'
    AND c.table_name NOT LIKE '%_backup'
    AND c.table_name NOT LIKE '%_original'
  ORDER BY c.table_name, c.ordinal_position;
END;
$$;

-- 4. Create overloaded version for backward compatibility
CREATE OR REPLACE FUNCTION get_table_columns()
RETURNS TABLE(
  table_name text,
  column_name text,
  data_type text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM get_table_columns(NULL);
$$;

-- 5. Fix execute_raw_sql if it exists
CREATE OR REPLACE FUNCTION execute_raw_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Security check: only allow SELECT queries
  IF NOT (LOWER(TRIM(query)) LIKE 'select%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Additional security checks
  IF query ~* '(drop|create|alter|insert|update|delete|truncate|grant|revoke)' THEN
    RAISE EXCEPTION 'DDL and DML operations are not allowed';
  END IF;
  
  -- Execute the query and return results as JSON
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::json);
EXCEPTION
  WHEN OTHERS THEN
    -- Return error as JSON
    RETURN json_build_object(
      'error', true,
      'message', SQLERRM
    );
END;
$$;

-- 6. Test the functions
DO $$
DECLARE
  v_result record;
  v_count integer;
BEGIN
  -- Test get_table_columns with specific table
  SELECT COUNT(*) INTO v_count
  FROM get_table_columns('petri_observations');
  
  RAISE NOTICE 'get_table_columns(petri_observations) returned % columns', v_count;
  
  -- Test get_table_columns without parameter
  SELECT COUNT(*) INTO v_count
  FROM get_table_columns();
  
  RAISE NOTICE 'get_table_columns() returned % total columns', v_count;
  
  -- Test execute_raw_sql
  BEGIN
    PERFORM execute_raw_sql('SELECT COUNT(*) FROM petri_observations LIMIT 1');
    RAISE NOTICE 'execute_raw_sql test passed';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'execute_raw_sql test failed: %', SQLERRM;
  END;
END $$;

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION get_table_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_raw_sql(text) TO authenticated;

-- 8. Create a helper view to see available tables for report builder
CREATE OR REPLACE VIEW v_report_builder_tables AS
SELECT DISTINCT
  table_name,
  table_type,
  CASE 
    WHEN table_name LIKE '%_observations' THEN 1
    WHEN table_name = 'submissions' THEN 2
    WHEN table_name = 'sites' THEN 3
    WHEN table_name = 'pilot_programs' THEN 4
    ELSE 5
  END as sort_order
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT LIKE '%_prog_%' -- Exclude partition tables
  AND table_name NOT LIKE '%_default' -- Exclude default partitions
  AND table_name NOT LIKE '%_original' -- Exclude backup tables
  AND table_name NOT LIKE '%_old'
  AND table_name NOT IN ('schema_migrations', 'spatial_ref_sys')
ORDER BY sort_order, table_name;

-- 9. Quick diagnostic
SELECT 
  'Function Status Check' as test,
  COUNT(*) as function_count,
  string_agg(proname, ', ') as functions
FROM pg_proc
WHERE proname IN ('get_table_columns', 'execute_raw_sql')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');