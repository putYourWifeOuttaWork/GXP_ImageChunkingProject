-- Comprehensive diagnostic for RPC functions
-- This will help identify why get_table_columns is returning 404

-- 1. Check current schema and search path
SELECT current_schema(), current_schemas(true);

-- 2. List all functions named get_table_columns in any schema
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.prosecdef as security_definer,
    p.proacl as access_privileges,
    r.rolname as owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON p.proowner = r.oid
WHERE p.proname = 'get_table_columns'
ORDER BY n.nspname, p.proname;

-- 3. Check if function exists in public schema specifically
SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'get_table_columns'
    AND n.nspname = 'public'
);

-- 4. Check execute_raw_sql function (which seems to work)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.prosecdef as security_definer,
    r.rolname as owner
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_roles r ON p.proowner = r.oid
WHERE p.proname = 'execute_raw_sql'
ORDER BY n.nspname, p.proname;

-- 5. Check PostgREST exposed functions
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = ANY(string_to_array(current_setting('pgrst.db_schemas', true), ','))
AND p.proname IN ('get_table_columns', 'execute_raw_sql');

-- 6. Check current user and their permissions
SELECT current_user, session_user;

-- 7. Check if authenticated role has execute permission
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_table_columns'
AND n.nspname = 'public';

-- 8. Check PostgREST configuration
SHOW pgrst.db_schemas;
SHOW search_path;