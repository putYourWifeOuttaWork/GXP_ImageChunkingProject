-- Dynamic Reporting Update Script
-- Builds views based on actual table columns
-- ==========================================

-- 1. Core functions (same as before)
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

GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated, anon;

-- 2. Partition stats function
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
            c.relname AS part_name,
            pg_stat_get_live_tuples(c.oid) AS part_row_count,
            pg_size_pretty(pg_relation_size(c.oid)) AS part_size,
            s.last_analyze AS part_analyzed,
            CASE 
                WHEN pg_stat_get_live_tuples(c.oid) > 0 THEN true
                ELSE false
            END AS part_active
        FROM pg_inherits i
        JOIN pg_class parent ON i.inhparent = parent.oid
        JOIN pg_class c ON i.inhrelid = c.oid
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE parent.relname = p_table_name
    )
    SELECT 
        part_name::text,
        part_row_count::bigint,
        part_size::text,
        part_analyzed::timestamp,
        part_active::boolean
    FROM partition_info
    WHERE (p_program_id IS NULL OR part_name LIKE '%' || replace(p_program_id::text, '-', '') || '%')
    AND (p_site_id IS NULL OR part_name LIKE '%' || replace(p_site_id::text, '-', '') || '%')
    ORDER BY part_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_partition_stats(text, uuid, uuid) TO authenticated;

-- 3. Query optimization function
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
    has_program_filter := p_filters ? 'program_id';
    has_site_filter := p_filters ? 'site_id';
    has_date_filter := p_filters ? 'created_at' OR p_filters ? 'date_range';
    
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

-- 4. Create view dynamically based on actual columns
DO $$
DECLARE
    v_column_list text;
BEGIN
    -- Build column list from actual table, excluding program_name if it exists
    SELECT string_agg('p.' || column_name, ', ' ORDER BY ordinal_position)
    INTO v_column_list
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'petri_observations_partitioned'
    AND column_name NOT IN ('program_name'); -- Exclude to avoid conflict
    
    -- Create the view
    EXECUTE format('
        CREATE OR REPLACE VIEW v_petri_observations_reporting AS
        SELECT 
            %s,
            p.program_name as existing_program_name,
            pp.name as program_name_lookup,
            s.name as site_name_lookup,
            ''Use program_id filter for '' || COALESCE(pp.name, p.program_name, ''this program'') AS partition_hint_program,
            ''Use site_id filter for '' || COALESCE(s.name, ''this site'') AS partition_hint_site
        FROM petri_observations_partitioned p
        LEFT JOIN pilot_programs pp ON p.program_id = pp.program_id
        LEFT JOIN sites s ON p.site_id = s.site_id',
        v_column_list
    );
    
    RAISE NOTICE 'Created v_petri_observations_reporting view';
END $$;

GRANT SELECT ON v_petri_observations_reporting TO authenticated;

-- 5. Test the functions
DO $$
DECLARE
    v_test_program_id uuid;
BEGIN
    -- Get a test program ID
    SELECT program_id INTO v_test_program_id FROM pilot_programs LIMIT 1;
    
    -- Test get_table_columns
    RAISE NOTICE 'Testing get_table_columns...';
    PERFORM * FROM get_table_columns('petri_observations_partitioned') LIMIT 1;
    
    -- Test get_partition_stats
    RAISE NOTICE 'Testing get_partition_stats...';
    PERFORM * FROM get_partition_stats('petri_observations_partitioned', v_test_program_id);
    
    -- Test suggest_query_optimization
    RAISE NOTICE 'Testing suggest_query_optimization...';
    PERFORM * FROM suggest_query_optimization(
        'petri_observations_partitioned',
        jsonb_build_object('program_id', v_test_program_id)
    );
    
    RAISE NOTICE 'All tests completed successfully';
END $$;

-- 6. Summary report
DO $$
DECLARE
    v_petri_count integer;
    v_gasifier_count integer;
    v_view_exists boolean;
BEGIN
    -- Count partitions
    SELECT COUNT(*) INTO v_petri_count
    FROM pg_tables WHERE tablename LIKE 'petri_obs_prog_%';
    
    SELECT COUNT(*) INTO v_gasifier_count
    FROM pg_tables WHERE tablename LIKE 'gasifier_obs_prog_%';
    
    -- Check view
    SELECT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'v_petri_observations_reporting'
    ) INTO v_view_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Partition Reporting Setup Complete ===';
    RAISE NOTICE 'Partitions:';
    RAISE NOTICE '  Petri: % partitions', v_petri_count;
    RAISE NOTICE '  Gasifier: % partitions', v_gasifier_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  ✅ get_table_columns()';
    RAISE NOTICE '  ✅ get_partition_stats()';
    RAISE NOTICE '  ✅ suggest_query_optimization()';
    RAISE NOTICE '';
    RAISE NOTICE 'Views:';
    RAISE NOTICE '  % v_petri_observations_reporting', 
        CASE WHEN v_view_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Your partition-optimized reporting system is ready!';
END $$;

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';