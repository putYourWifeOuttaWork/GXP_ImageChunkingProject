-- Update Reporting System to Use Partitioned Tables
-- =================================================

-- 1. Create updated RPC functions for partitioned tables
-- ------------------------------------------------------

-- Update get_table_columns to include partitioned tables
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
    -- Handle both regular and partitioned table names
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated, anon;

-- 2. Create helper function to get partition performance stats
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_partition_stats(
    p_table_name text,
    p_program_id uuid DEFAULT NULL,
    p_site_id uuid DEFAULT NULL
)
RETURNS TABLE (
    partition_name text,
    row_count bigint,
    size_pretty text,
    last_analyzed timestamp,
    is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH partition_info AS (
        SELECT 
            c.relname AS partition_name,
            pg_stat_get_live_tuples(c.oid) AS row_count,
            pg_size_pretty(pg_relation_size(c.oid)) AS size_pretty,
            s.last_analyze AS last_analyzed,
            CASE 
                WHEN pg_stat_get_live_tuples(c.oid) > 0 THEN true
                ELSE false
            END AS is_active
        FROM pg_inherits i
        JOIN pg_class parent ON i.inhparent = parent.oid
        JOIN pg_class c ON i.inhrelid = c.oid
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE parent.relname = p_table_name
    )
    SELECT * FROM partition_info
    WHERE (p_program_id IS NULL OR partition_name LIKE '%' || replace(p_program_id::text, '-', '') || '%')
    AND (p_site_id IS NULL OR partition_name LIKE '%' || replace(p_site_id::text, '-', '') || '%')
    ORDER BY partition_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_partition_stats(text, uuid, uuid) TO authenticated;

-- 3. Create function to suggest optimal query approach
-- ---------------------------------------------------

CREATE OR REPLACE FUNCTION suggest_query_optimization(
    p_table_name text,
    p_filters jsonb
)
RETURNS TABLE (
    optimization_type text,
    suggestion text,
    expected_speedup text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_program_filter boolean := false;
    has_site_filter boolean := false;
    has_date_filter boolean := false;
BEGIN
    -- Check which filters are present
    has_program_filter := p_filters ? 'program_id';
    has_site_filter := p_filters ? 'site_id';
    has_date_filter := p_filters ? 'created_at' OR p_filters ? 'date_range';
    
    -- Return optimization suggestions
    IF has_program_filter AND has_site_filter AND has_date_filter THEN
        RETURN QUERY
        SELECT 
            'OPTIMAL'::text,
            'Query is optimally structured for partition pruning'::text,
            '100-500x faster than unpartitioned'::text;
    ELSIF has_program_filter AND has_site_filter THEN
        RETURN QUERY
        SELECT 
            'VERY_GOOD'::text,
            'Query will use program and site partitions effectively'::text,
            '50-100x faster than unpartitioned'::text;
    ELSIF has_program_filter THEN
        RETURN QUERY
        SELECT 
            'GOOD'::text,
            'Query will use program-level partitions'::text,
            '10-50x faster than unpartitioned'::text;
        
        RETURN QUERY
        SELECT 
            'SUGGESTION'::text,
            'Adding site_id filter would improve performance further'::text,
            'Additional 2-5x speedup possible'::text;
    ELSE
        RETURN QUERY
        SELECT 
            'SUBOPTIMAL'::text,
            'Query will scan multiple partitions'::text,
            'Limited speedup (2-5x)'::text;
        
        RETURN QUERY
        SELECT 
            'SUGGESTION'::text,
            'Add program_id filter for major performance boost'::text,
            '10-50x speedup possible'::text;
    END IF;
    
    -- Additional suggestions for date filters
    IF NOT has_date_filter AND (has_program_filter OR has_site_filter) THEN
        RETURN QUERY
        SELECT 
            'SUGGESTION'::text,
            'Adding date range filter would enable time-based partition pruning'::text,
            'Additional 2-10x speedup for recent data'::text;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION suggest_query_optimization(text, jsonb) TO authenticated;

-- 4. Update reporting data sources configuration
-- ---------------------------------------------

-- This would be done in your application code, but here's the SQL representation
/*
UPDATE reporting_configurations
SET 
    data_sources = jsonb_build_array(
        jsonb_build_object(
            'id', 'petri_observations_partitioned',
            'name', 'Petri Observations (Optimized)',
            'table', 'petri_observations_partitioned',
            'description', 'Partitioned petri observations for high-performance queries',
            'performance_notes', 'Best performance with program_id, site_id, and date filters'
        ),
        jsonb_build_object(
            'id', 'gasifier_observations_partitioned',
            'name', 'Gasifier Observations (Optimized)',
            'table', 'gasifier_observations_partitioned',
            'description', 'Partitioned gasifier observations for high-performance queries',
            'performance_notes', 'Best performance with program_id, site_id, and date filters'
        ),
        -- Keep legacy tables for compatibility
        jsonb_build_object(
            'id', 'petri_observations',
            'name', 'Petri Observations (Legacy)',
            'table', 'petri_observations',
            'description', 'Unpartitioned table - consider using partitioned version',
            'performance_notes', 'Slower queries, especially for large datasets'
        )
    )
WHERE config_type = 'data_sources';
*/

-- 5. Create reporting-friendly views with partition hints
-- -------------------------------------------------------

CREATE OR REPLACE VIEW v_petri_observations_reporting AS
SELECT 
    p.observation_id,
    p.created_at,
    p.updated_at,
    p.created_by,
    p.updated_by,
    p.submission_id,
    p.site_id,
    p.program_id,
    p.petri_code,
    p.image_url,
    p.placement,
    p.fungicide_used,
    p.growth_percent,
    p.petri_growth_stage,
    p.growth_index,
    p.growth_progression,
    p.growth_aggression,
    p.growth_velocity,
    p.outdoor_temperature,
    p.outdoor_humidity,
    p.x_position,
    p.y_position,
    p.todays_day_of_phase,
    p.daysinthisprogramphase,
    pp.name as program_name,
    s.name as site_name,
    -- Add partition hint columns for the UI
    'Use program_id filter for ' || COALESCE(pp.name, 'this program') AS partition_hint_program,
    'Use site_id filter for ' || COALESCE(s.name, 'this site') AS partition_hint_site
FROM petri_observations_partitioned p
LEFT JOIN pilot_programs pp ON p.program_id = pp.program_id
LEFT JOIN sites s ON p.site_id = s.site_id;

GRANT SELECT ON v_petri_observations_reporting TO authenticated;

-- 6. Performance testing queries
-- -----------------------------

-- Test partition performance vs regular table
DO $$
DECLARE
    start_time timestamp;
    end_time timestamp;
    partition_time interval;
    regular_time interval;
BEGIN
    -- Test partitioned table
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM petri_observations_partitioned 
    WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
    AND created_at >= CURRENT_DATE - INTERVAL '30 days';
    end_time := clock_timestamp();
    partition_time := end_time - start_time;
    
    -- Test regular table
    start_time := clock_timestamp();
    PERFORM COUNT(*) FROM petri_observations 
    WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
    AND created_at >= CURRENT_DATE - INTERVAL '30 days';
    end_time := clock_timestamp();
    regular_time := end_time - start_time;
    
    RAISE NOTICE 'Partitioned query time: %', partition_time;
    RAISE NOTICE 'Regular query time: %', regular_time;
    RAISE NOTICE 'Speedup: %x', EXTRACT(EPOCH FROM regular_time) / NULLIF(EXTRACT(EPOCH FROM partition_time), 0);
END $$;

-- 7. Notify PostgREST about new functions
-- ---------------------------------------
NOTIFY pgrst, 'reload schema';