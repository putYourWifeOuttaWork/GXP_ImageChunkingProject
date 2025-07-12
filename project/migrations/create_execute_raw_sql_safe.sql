-- Create a safe execute_raw_sql function for reporting
-- This function only allows SELECT queries, no DDL or DML
-- =====================================================

CREATE OR REPLACE FUNCTION execute_raw_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    query_lower text;
BEGIN
    -- Convert query to lowercase for checking
    query_lower := lower(trim(query));
    
    -- Security checks - only allow SELECT queries
    IF query_lower NOT LIKE 'select%' THEN
        RETURN json_build_object('error', true, 'message', 'Only SELECT queries are allowed');
    END IF;
    
    -- Block dangerous keywords
    IF query_lower ~ '\y(insert|update|delete|drop|create|alter|truncate|grant|revoke)\y' THEN
        RETURN json_build_object('error', true, 'message', 'DDL and DML operations are not allowed');
    END IF;
    
    -- Additional safety check for semicolons (prevent multiple statements)
    IF position(';' in trim(trailing ';' from query)) > 0 THEN
        RETURN json_build_object('error', true, 'message', 'Multiple statements are not allowed');
    END IF;
    
    -- Execute the query and return results as JSON
    BEGIN
        EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
        
        -- If result is NULL (no rows), return empty array
        IF result IS NULL THEN
            result := '[]'::json;
        END IF;
        
        RETURN result;
    EXCEPTION WHEN OTHERS THEN
        -- Return error details
        RETURN json_build_object(
            'error', true,
            'message', SQLERRM,
            'detail', SQLSTATE
        );
    END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_raw_sql(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION execute_raw_sql(text) IS 'Executes SELECT-only SQL queries and returns results as JSON. Used by the reporting system for complex queries.';

-- Test the function
SELECT execute_raw_sql('SELECT COUNT(*) as count FROM petri_observations LIMIT 1');