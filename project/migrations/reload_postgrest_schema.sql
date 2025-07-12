-- Force PostgREST to reload its schema cache
-- This is necessary after creating new functions

-- Method 1: Using NOTIFY (Supabase method)
NOTIFY pgrst, 'reload schema';

-- Method 2: Alternative NOTIFY
NOTIFY ddl_command_end;

-- Method 3: Touch the function to update its timestamp
-- This sometimes triggers a cache refresh
COMMENT ON FUNCTION get_table_columns(text) IS 'Returns column information for a given table in the public schema. Used by the reporting system for dynamic field discovery.';

-- Verify the function is accessible
DO $$
DECLARE
    v_count integer;
BEGIN
    -- Check if function exists
    SELECT COUNT(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'get_table_columns'
    AND n.nspname = 'public';
    
    IF v_count = 0 THEN
        RAISE EXCEPTION 'Function get_table_columns does not exist in public schema';
    ELSE
        RAISE NOTICE 'Function get_table_columns exists in public schema';
    END IF;
    
    -- Check permissions
    IF NOT has_function_privilege('anon', 'public.get_table_columns(text)', 'EXECUTE') THEN
        RAISE WARNING 'anon role does not have EXECUTE permission on get_table_columns';
        -- Grant permission
        GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO anon;
        RAISE NOTICE 'Granted EXECUTE permission to anon role';
    END IF;
    
    IF NOT has_function_privilege('authenticated', 'public.get_table_columns(text)', 'EXECUTE') THEN
        RAISE WARNING 'authenticated role does not have EXECUTE permission on get_table_columns';
        -- Grant permission
        GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated;
        RAISE NOTICE 'Granted EXECUTE permission to authenticated role';
    END IF;
END $$;

-- Final test
SELECT 'Function test:', count(*) as column_count 
FROM get_table_columns('gasifier_observations');