-- SAFE: Populate Partitioned Tables - Only using columns that exist
-- ===================================================================

-- Check current state
SELECT 'BEFORE MIGRATION' as status, 'petri_observations' as table_name, COUNT(*) as row_count FROM petri_observations
UNION ALL
SELECT 'BEFORE MIGRATION', 'petri_observations_partitioned', COUNT(*) FROM petri_observations_partitioned
UNION ALL  
SELECT 'BEFORE MIGRATION', 'gasifier_observations', COUNT(*) FROM gasifier_observations
UNION ALL
SELECT 'BEFORE MIGRATION', 'gasifier_observations_partitioned', COUNT(*) FROM gasifier_observations_partitioned;

-- Migrate petri_observations - using only common columns
DO $$
DECLARE
    v_column_list TEXT;
    v_sql TEXT;
BEGIN
    -- Build list of columns that exist in BOTH tables
    SELECT string_agg(c1.column_name, ', ')
    INTO v_column_list
    FROM information_schema.columns c1
    WHERE c1.table_name = 'petri_observations' 
    AND c1.table_schema = 'public'
    AND EXISTS (
        SELECT 1 
        FROM information_schema.columns c2 
        WHERE c2.table_name = 'petri_observations_partitioned' 
        AND c2.table_schema = 'public'
        AND c2.column_name = c1.column_name
    )
    AND c1.column_name NOT IN ('program_id', 'site_id'); -- These we'll get from joins
    
    RAISE NOTICE 'Common columns: %', v_column_list;
    
    -- Build and execute the INSERT
    v_sql := format('
        INSERT INTO petri_observations_partitioned (
            %s,
            program_id,
            site_id
        )
        SELECT 
            %s,
            s.program_id,
            s.site_id
        FROM petri_observations po
        INNER JOIN submissions s ON po.submission_id = s.submission_id
        WHERE s.program_id IS NOT NULL 
          AND s.site_id IS NOT NULL
        ON CONFLICT (observation_id, program_id) DO UPDATE SET
            growth_progression = EXCLUDED.growth_progression,
            growth_index = EXCLUDED.growth_index,
            updated_at = EXCLUDED.updated_at',
        v_column_list,
        'po.' || replace(v_column_list, ', ', ', po.')
    );
    
    EXECUTE v_sql;
    
    RAISE NOTICE 'Petri observations migrated successfully';
END $$;

-- Migrate gasifier_observations - using only common columns
DO $$
DECLARE
    v_column_list TEXT;
    v_sql TEXT;
BEGIN
    -- Build list of columns that exist in BOTH tables
    SELECT string_agg(c1.column_name, ', ')
    INTO v_column_list
    FROM information_schema.columns c1
    WHERE c1.table_name = 'gasifier_observations' 
    AND c1.table_schema = 'public'
    AND EXISTS (
        SELECT 1 
        FROM information_schema.columns c2 
        WHERE c2.table_name = 'gasifier_observations_partitioned' 
        AND c2.table_schema = 'public'
        AND c2.column_name = c1.column_name
    )
    AND c1.column_name NOT IN ('program_id', 'site_id'); -- These we'll get from joins
    
    RAISE NOTICE 'Common columns: %', v_column_list;
    
    -- Build and execute the INSERT
    v_sql := format('
        INSERT INTO gasifier_observations_partitioned (
            %s,
            program_id,
            site_id
        )
        SELECT 
            %s,
            s.program_id,
            s.site_id
        FROM gasifier_observations go
        INNER JOIN submissions s ON go.submission_id = s.submission_id
        WHERE s.program_id IS NOT NULL 
          AND s.site_id IS NOT NULL
        ON CONFLICT (observation_id, program_id) DO UPDATE SET
            updated_at = EXCLUDED.updated_at',
        v_column_list,
        'go.' || replace(v_column_list, ', ', ', go.')
    );
    
    EXECUTE v_sql;
    
    RAISE NOTICE 'Gasifier observations migrated successfully';
END $$;

-- Verify migration
SELECT 'AFTER MIGRATION' as status, 'petri_observations' as table_name, COUNT(*) as row_count FROM petri_observations
UNION ALL
SELECT 'AFTER MIGRATION', 'petri_observations_partitioned', COUNT(*) FROM petri_observations_partitioned
UNION ALL  
SELECT 'AFTER MIGRATION', 'gasifier_observations', COUNT(*) FROM gasifier_observations
UNION ALL
SELECT 'AFTER MIGRATION', 'gasifier_observations_partitioned', COUNT(*) FROM gasifier_observations_partitioned;

-- Show sample data
SELECT 'Sample petri data' as info, observation_id, petri_code, program_id, site_id, growth_index, growth_progression 
FROM petri_observations_partitioned 
LIMIT 5;

-- Analyze tables for query optimization
ANALYZE petri_observations_partitioned;
ANALYZE gasifier_observations_partitioned;