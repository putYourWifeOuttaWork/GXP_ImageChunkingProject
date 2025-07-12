-- Fix schema resolution issue for get_table_columns

-- 1. Check what functions exist and their schemas
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_table_columns'
ORDER BY n.nspname, p.proname;

-- 2. Drop any existing functions in wrong schema
DROP FUNCTION IF EXISTS public.get_table_columns();
DROP FUNCTION IF EXISTS public.get_table_columns(text);
DROP FUNCTION IF EXISTS public.get_table_columns(table_name text);

-- 3. Create the function with the exact signature the app expects
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
RETURNS TABLE(
  table_name text,
  column_name text,
  data_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If table_name is provided, return columns for that specific table
  IF table_name IS NOT NULL AND table_name != '' THEN
    RETURN QUERY
    SELECT 
      c.table_name::text,
      c.column_name::text,
      c.data_type::text
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = table_name
    ORDER BY c.ordinal_position;
  ELSE
    -- If no table_name provided, return all tables (excluding partitions and backups)
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
      AND t.table_type IN ('BASE TABLE', 'PARTITIONED TABLE')
      AND c.table_name NOT LIKE 'petri_obs_prog_%'
      AND c.table_name NOT LIKE 'petri_obs_default'
      AND c.table_name NOT LIKE 'gasifier_obs_%'
      AND c.table_name NOT LIKE '%_original'
      AND c.table_name NOT LIKE '%_old'
      AND c.table_name NOT LIKE '%_backup'
      AND c.table_name NOT LIKE 'pg_%'
    ORDER BY c.table_name, c.ordinal_position;
  END IF;
END;
$$;

-- 4. Also create the no-argument version
CREATE OR REPLACE FUNCTION public.get_table_columns()
RETURNS TABLE(
  table_name text,
  column_name text,
  data_type text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.get_table_columns(NULL::text);
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_table_columns() TO anon;

-- 6. Test both versions
DO $$
DECLARE
  v_count integer;
BEGIN
  -- Test with table name
  SELECT COUNT(*) INTO v_count
  FROM public.get_table_columns('petri_observations');
  RAISE NOTICE 'get_table_columns(petri_observations) returned % columns', v_count;
  
  -- Test without arguments
  SELECT COUNT(*) INTO v_count
  FROM public.get_table_columns();
  RAISE NOTICE 'get_table_columns() returned % total columns', v_count;
END $$;

-- 7. Verify the function is visible
SELECT 
  'Function Visibility' as check_type,
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as returns
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_table_columns'
  AND n.nspname = 'public';