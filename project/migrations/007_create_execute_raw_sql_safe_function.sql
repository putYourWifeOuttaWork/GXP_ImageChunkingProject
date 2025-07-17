-- Migration: Create execute_raw_sql_safe function
-- Purpose: Enable optimized SQL queries in the reporting module
-- Date: 2025-01-13

-- This function allows the reporting module to execute raw SQL queries
-- in a safe manner with proper permissions and result formatting

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.execute_raw_sql_safe(text);

-- Create the function
CREATE OR REPLACE FUNCTION public.execute_raw_sql_safe(query_text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    row_count integer;
BEGIN
    -- Basic SQL injection prevention
    -- Check for dangerous keywords (this is a simple check, not comprehensive)
    IF query_text ~* '(DROP|CREATE|ALTER|TRUNCATE|DELETE|INSERT|UPDATE|GRANT|REVOKE)\s' THEN
        RAISE EXCEPTION 'Unsafe SQL detected';
    END IF;
    
    -- Ensure the query starts with SELECT
    IF NOT (query_text ~* '^\s*SELECT\s') THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;
    
    -- Execute the query and return results as JSON
    EXECUTE format('
        WITH query_result AS (%s)
        SELECT 
            COALESCE(json_agg(row_to_json(query_result.*)), ''[]''::json) as data,
            COUNT(*) as count
        FROM query_result
    ', query_text) INTO result;
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN json_build_object(
            'error', true,
            'message', SQLERRM,
            'detail', SQLSTATE,
            'hint', 'Check your SQL syntax and permissions'
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_raw_sql_safe(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.execute_raw_sql_safe(text) IS 
'Safely executes SELECT queries and returns results as JSON. Used by the reporting module for optimized queries.';

-- Create a simpler version that returns a table (alternative approach)
DROP FUNCTION IF EXISTS public.execute_raw_sql_simple(text);

CREATE OR REPLACE FUNCTION public.execute_raw_sql_simple(query_text text)
RETURNS TABLE(result json)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Basic SQL injection prevention
    IF query_text ~* '(DROP|CREATE|ALTER|TRUNCATE|DELETE|INSERT|UPDATE|GRANT|REVOKE)\s' THEN
        RAISE EXCEPTION 'Unsafe SQL detected';
    END IF;
    
    -- Ensure the query starts with SELECT
    IF NOT (query_text ~* '^\s*SELECT\s') THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;
    
    -- Execute and return results
    RETURN QUERY EXECUTE format('
        SELECT row_to_json(t) as result
        FROM (%s) t
    ', query_text);
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error as a single row
        RETURN QUERY 
        SELECT json_build_object(
            'error', true,
            'message', SQLERRM,
            'detail', SQLSTATE
        )::json;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.execute_raw_sql_simple(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.execute_raw_sql_simple(text) IS 
'Alternative version of execute_raw_sql_safe that returns results as a table of JSON rows.';