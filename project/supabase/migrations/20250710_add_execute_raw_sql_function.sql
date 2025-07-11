-- Create a function to execute raw SQL queries for complex cross-table filtering
-- This function is used by the reporting system when filters require JOINs across multiple tables

-- Drop function if it exists
DROP FUNCTION IF EXISTS execute_raw_sql(text);

-- Create the function with proper security
CREATE OR REPLACE FUNCTION execute_raw_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    -- Basic SQL injection prevention
    -- Check for dangerous keywords (this is a basic check, not comprehensive)
    IF query ~* '(DROP|ALTER|CREATE|DELETE|INSERT|UPDATE|TRUNCATE|GRANT|REVOKE)\s' THEN
        RAISE EXCEPTION 'Forbidden SQL operation detected';
    END IF;
    
    -- Execute the query and return results as JSON
    EXECUTE format('SELECT json_agg(row_to_json(t)) FROM (%s) t', query) INTO result;
    
    -- Return empty array if no results
    IF result IS NULL THEN
        RETURN '[]'::json;
    END IF;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and return a proper error response
        RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_raw_sql(text) TO authenticated;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION execute_raw_sql(text) IS 'Executes read-only SQL queries for complex reporting filters that require cross-table JOINs. Used by the reporting system for advanced filtering scenarios.';