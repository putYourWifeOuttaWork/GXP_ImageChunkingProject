-- Create a function to get table columns for dynamic field discovery
-- This function is used by the reporting system to dynamically discover available columns

-- Drop function if it exists
DROP FUNCTION IF EXISTS get_table_columns(text);

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

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION get_table_columns(text) IS 'Returns column information for a given table in the public schema. Used by the reporting system for dynamic field discovery.';