-- Fix get_table_columns function
-- This ensures the function exists and is properly configured

-- First, check if the function exists
DO $$
BEGIN
    -- Drop all existing versions to start clean
    DROP FUNCTION IF EXISTS get_table_columns();
    DROP FUNCTION IF EXISTS get_table_columns(text);
    DROP FUNCTION IF EXISTS get_table_columns(p_table_name text);
    
    RAISE NOTICE 'Dropped any existing get_table_columns functions';
END $$;

-- Create the function with proper security
CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
RETURNS TABLE (
    column_name text,
    data_type text,
    is_nullable text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.column_name::text,
        c.data_type::text,
        c.is_nullable::text
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' 
    AND c.table_name = get_table_columns.table_name
    ORDER BY c.ordinal_position;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;

-- Grant execute permission to anon users (for RPC calls)
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION get_table_columns(text) IS 'Returns column information for a given table in the public schema. Used by the reporting system for dynamic field discovery.';

-- Test the function
SELECT * FROM get_table_columns('gasifier_observations') LIMIT 5;

-- Verify function exists in pg_proc
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    r.rolname as owner
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid
WHERE p.proname = 'get_table_columns'
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');