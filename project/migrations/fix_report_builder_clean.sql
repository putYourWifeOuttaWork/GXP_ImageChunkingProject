-- Clean Fix for Report Builder Functions

-- 1. First, see all versions of get_table_columns
SELECT 
  oid,
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc
WHERE proname = 'get_table_columns'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Drop ALL versions of get_table_columns
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 'DROP FUNCTION IF EXISTS ' || oid::regprocedure || ';' as drop_cmd
    FROM pg_proc
    WHERE proname = 'get_table_columns'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE r.drop_cmd;
    RAISE NOTICE 'Dropped: %', r.drop_cmd;
  END LOOP;
END $$;

-- 3. Create a single, clean version
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
    AND t.table_type IN ('BASE TABLE', 'PARTITIONED TABLE') -- Include partitioned tables
    -- When no specific table requested, exclude partition children
    AND (
      CASE 
        WHEN p_table_name IS NULL THEN 
          c.table_name NOT LIKE 'petri_obs_prog_%' 
          AND c.table_name NOT LIKE 'petri_obs_default'
          AND c.table_name NOT LIKE 'gasifier_obs_%'
          AND c.table_name NOT LIKE '%_original'
          AND c.table_name NOT LIKE '%_old'
          AND c.table_name NOT LIKE '%_backup'
        ELSE 
          c.table_name = p_table_name
      END
    )
    -- Always exclude system tables
    AND c.table_name NOT LIKE 'pg_%'
    AND c.table_name NOT LIKE '_pg_%'
  ORDER BY c.table_name, c.ordinal_position;
END;
$$;

-- 4. Drop any existing execute_raw_sql functions
DROP FUNCTION IF EXISTS execute_raw_sql(text);

-- 5. Create clean execute_raw_sql
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

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_raw_sql(text) TO authenticated;

-- 7. Test the functions
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Test get_table_columns with specific table
  SELECT COUNT(*) INTO v_count
  FROM get_table_columns('petri_observations');
  
  RAISE NOTICE 'get_table_columns(petri_observations) returned % columns', v_count;
  
  -- Test get_table_columns without parameter
  SELECT COUNT(*) INTO v_count
  FROM get_table_columns(NULL);
  
  RAISE NOTICE 'get_table_columns(NULL) returned % total columns', v_count;
  
  -- Test no parameter (should use default NULL)
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

-- 8. Show what tables the report builder will see
SELECT 
  'Tables visible to Report Builder' as info,
  COUNT(*) as table_count,
  string_agg(table_name, ', ' ORDER BY table_name) as tables
FROM get_table_columns()
GROUP BY table_name
ORDER BY table_name;