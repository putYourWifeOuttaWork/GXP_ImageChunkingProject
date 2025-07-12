-- Flexible Reporting Update Script
-- Works with both partitioned and non-partitioned tables
-- ======================================================

-- 1. Check what tables exist
DO $$
DECLARE
    v_use_partitions boolean := false;
BEGIN
    -- Check if partitioned tables exist
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'petri_observations_partitioned') 
       AND EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'gasifier_observations_partitioned') THEN
        v_use_partitions := true;
        RAISE NOTICE 'Found partitioned tables - will create partition-optimized functions';
    ELSE
        RAISE NOTICE 'Partitioned tables not found - will create functions for regular tables';
    END IF;
END $$;

-- 2. Create/Update get_table_columns function (works for any table)
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

-- 3. Create flexible partition stats function
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
    -- Check if the table is partitioned
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = p_table_name
        AND c.relkind = 'p'  -- 'p' indicates partitioned table
    ) THEN
        -- Return partition information
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
    ELSE
        -- For non-partitioned tables, return table stats
        RETURN QUERY
        SELECT 
            p_table_name::text AS partition_name,
            pg_stat_get_live_tuples(c.oid) AS row_count,
            pg_size_pretty(pg_relation_size(c.oid)) AS size_pretty,
            s.last_analyze AS last_analyzed,
            true AS is_active
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public' 
        AND c.relname = p_table_name;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_partition_stats(text, uuid, uuid) TO authenticated;

-- 4. Create query optimization suggestion function
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
    is_partitioned boolean := false;
BEGIN
    -- Check filter presence
    has_program_filter := p_filters ? 'program_id';
    has_site_filter := p_filters ? 'site_id';
    has_date_filter := p_filters ? 'created_at' OR p_filters ? 'date_range';
    
    -- Check if table is partitioned
    SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
        AND c.relname = p_table_name
        AND c.relkind = 'p'
    ) INTO is_partitioned;
    
    -- Return optimization suggestions
    IF is_partitioned THEN
        -- Partitioned table suggestions
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
    ELSE
        -- Non-partitioned table suggestions
        IF has_program_filter AND has_site_filter AND has_date_filter THEN
            RETURN QUERY
            SELECT 
                'GOOD'::text,
                'Query has appropriate filters for non-partitioned table'::text,
                'Using available indexes'::text;
        ELSE
            RETURN QUERY
            SELECT 
                'SUGGESTION'::text,
                'Consider adding indexes on program_id, site_id, and created_at'::text,
                'Could improve query performance'::text;
            
            IF NOT has_program_filter THEN
                RETURN QUERY
                SELECT 
                    'SUGGESTION'::text,
                    'Adding program_id filter would help even without partitions'::text,
                    'Reduces data scanned'::text;
            END IF;
        END IF;
        
        -- Suggest partitioning
        RETURN QUERY
        SELECT 
            'INFO'::text,
            'Table is not partitioned. Consider implementing partitioning for better performance'::text,
            'Could achieve 10-100x speedup with partitions'::text;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION suggest_query_optimization(text, jsonb) TO authenticated;

-- 5. Create reporting views that work with either table type
CREATE OR REPLACE VIEW v_petri_observations_reporting AS
SELECT 
    p.*,
    pp.name as program_name,
    s.name as site_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'petri_observations_partitioned')
        THEN 'Use program_id filter for best performance'
        ELSE 'Table not partitioned - normal performance'
    END AS performance_hint
FROM (
    -- Use partitioned table if it exists, otherwise use regular table
    SELECT * FROM petri_observations_partitioned
    WHERE EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'petri_observations_partitioned')
    UNION ALL
    SELECT * FROM petri_observations
    WHERE NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'petri_observations_partitioned')
) p
LEFT JOIN pilot_programs pp ON p.program_id = pp.program_id
LEFT JOIN sites s ON p.site_id = s.site_id;

GRANT SELECT ON v_petri_observations_reporting TO authenticated;

-- 6. Test the functions
SELECT 'Testing get_table_columns:' as test;
SELECT * FROM get_table_columns('petri_observations') LIMIT 5;

SELECT 'Testing get_partition_stats:' as test;
SELECT * FROM get_partition_stats('petri_observations') LIMIT 5;

SELECT 'Testing suggest_query_optimization:' as test;
SELECT * FROM suggest_query_optimization(
    'petri_observations',
    '{"program_id": "test-id"}'::jsonb
);

-- 7. Final status report
DO $$
DECLARE
    v_petri_part_exists boolean;
    v_gasifier_part_exists boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'petri_observations_partitioned')
    INTO v_petri_part_exists;
    
    SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'gasifier_observations_partitioned')
    INTO v_gasifier_part_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Reporting System Update Complete ===';
    RAISE NOTICE 'Partition status:';
    RAISE NOTICE '  petri_observations_partitioned: %', 
        CASE WHEN v_petri_part_exists THEN 'EXISTS ✅' ELSE 'NOT FOUND ⚠️' END;
    RAISE NOTICE '  gasifier_observations_partitioned: %', 
        CASE WHEN v_gasifier_part_exists THEN 'EXISTS ✅' ELSE 'NOT FOUND ⚠️' END;
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  ✅ get_table_columns()';
    RAISE NOTICE '  ✅ get_partition_stats()';
    RAISE NOTICE '  ✅ suggest_query_optimization()';
    RAISE NOTICE '';
    
    IF NOT v_petri_part_exists OR NOT v_gasifier_part_exists THEN
        RAISE NOTICE 'ℹ️  To enable partition features, run:';
        RAISE NOTICE '   1. create_partitions_simple.sql';
        RAISE NOTICE '   2. Then re-run this script';
    ELSE
        RAISE NOTICE '🚀 Partition-optimized reporting is ready!';
    END IF;
END $$;

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';