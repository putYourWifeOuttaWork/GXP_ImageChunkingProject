-- Manual schema reload for Supabase
-- Run this in the Supabase SQL Editor

-- Create a temporary function to trigger schema reload
CREATE OR REPLACE FUNCTION temp_schema_reload_trigger()
RETURNS void AS $$
BEGIN
    -- Do nothing, just exist to trigger reload
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop it immediately
DROP FUNCTION temp_schema_reload_trigger();

-- Verify get_table_columns exists and works
SELECT 
    'Function exists' as status,
    exists(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'get_table_columns'
        AND n.nspname = 'public'
    ) as function_exists;

-- Test the function
SELECT * FROM get_table_columns('gasifier_observations') LIMIT 5;