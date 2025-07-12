-- Simplified diagnostic for RPC functions

-- 1. Check current schema and search path
SELECT current_schema(), current_schemas(true);

-- 2. List all functions named get_table_columns
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.prosecdef as security_definer,
    r.rolname as owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON p.proowner = r.oid
WHERE p.proname = 'get_table_columns'
ORDER BY n.nspname, p.proname;

-- 3. Check permissions for the function
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
    has_function_privilege('postgres', p.oid, 'EXECUTE') as postgres_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_table_columns'
AND n.nspname = 'public';

-- 4. Compare with execute_raw_sql (which works)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'execute_raw_sql'
AND n.nspname = 'public';

-- 5. Test the function directly
SELECT * FROM get_table_columns('gasifier_observations') LIMIT 5;

-- 6. Check all roles that have access to the function
SELECT 
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
AND routine_name = 'get_table_columns';

-- 7. Check search_path
SHOW search_path;