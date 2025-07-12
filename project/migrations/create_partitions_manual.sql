-- Manual Partition Creation Script
-- Creates partitioned tables with explicit column definitions
-- ===========================================================

-- 1. Check source tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'petri_observations') THEN
        RAISE EXCEPTION 'petri_observations table does not exist';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gasifier_observations') THEN
        RAISE EXCEPTION 'gasifier_observations table does not exist';
    END IF;
    RAISE NOTICE 'Source tables verified';
END $$;

-- 2. Create petri_observations_partitioned if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'petri_observations_partitioned'
    ) THEN
        -- Get column definitions from existing table
        EXECUTE (
            SELECT 'CREATE TABLE petri_observations_partitioned (' ||
            string_agg(
                column_name || ' ' || 
                CASE 
                    WHEN data_type = 'ARRAY' THEN udt_name || '[]'
                    WHEN data_type = 'USER-DEFINED' THEN udt_name
                    ELSE data_type
                END ||
                CASE 
                    WHEN character_maximum_length IS NOT NULL 
                    THEN '(' || character_maximum_length || ')'
                    WHEN numeric_precision IS NOT NULL AND numeric_scale IS NOT NULL
                    THEN '(' || numeric_precision || ',' || numeric_scale || ')'
                    ELSE ''
                END ||
                CASE 
                    WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
                    ELSE ''
                END ||
                CASE 
                    WHEN is_nullable = 'NO' THEN ' NOT NULL'
                    ELSE ''
                END,
                ', '
            ) ||
            ', PRIMARY KEY (observation_id, program_id)' ||
            ') PARTITION BY LIST (program_id)'
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'petri_observations'
            AND column_name != 'observation_id' -- We'll handle PK separately
            ORDER BY ordinal_position
        );
        
        -- Create default partition
        CREATE TABLE petri_obs_part_default 
            PARTITION OF petri_observations_partitioned DEFAULT;
            
        -- Copy foreign key constraints
        INSERT INTO pg_constraint (conname, connamespace, contype, condeferrable, condeferred, convalidated, conrelid, contypid, conindid, conparentid, confrelid, confupdtype, confdeltype, confmatchtype, conislocal, coninhcount, connoinherit, conkey, confkey, conpfeqop, conppeqop, conffeqop, conexclop, conbin)
        SELECT 
            replace(c.conname, 'petri_observations', 'petri_observations_partitioned'),
            c.connamespace, c.contype, c.condeferrable, c.condeferred, c.convalidated,
            (SELECT oid FROM pg_class WHERE relname = 'petri_observations_partitioned'),
            c.contypid, c.conindid, c.conparentid, c.confrelid, c.confupdtype, c.confdeltype, c.confmatchtype,
            c.conislocal, c.coninhcount, c.connoinherit, c.conkey, c.confkey, c.conpfeqop, c.conppeqop, c.conffeqop, c.conexclop, c.conbin
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'petri_observations' 
        AND c.contype = 'f'; -- Foreign keys only
        
        RAISE NOTICE 'Created petri_observations_partitioned';
    ELSE
        RAISE NOTICE 'petri_observations_partitioned already exists';
    END IF;
END $$;

-- 3. Create gasifier_observations_partitioned if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'gasifier_observations_partitioned'
    ) THEN
        -- Get column definitions
        EXECUTE (
            SELECT 'CREATE TABLE gasifier_observations_partitioned (' ||
            string_agg(
                column_name || ' ' || 
                CASE 
                    WHEN data_type = 'ARRAY' THEN udt_name || '[]'
                    WHEN data_type = 'USER-DEFINED' THEN udt_name
                    ELSE data_type
                END ||
                CASE 
                    WHEN character_maximum_length IS NOT NULL 
                    THEN '(' || character_maximum_length || ')'
                    WHEN numeric_precision IS NOT NULL AND numeric_scale IS NOT NULL
                    THEN '(' || numeric_precision || ',' || numeric_scale || ')'
                    ELSE ''
                END ||
                CASE 
                    WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
                    ELSE ''
                END ||
                CASE 
                    WHEN is_nullable = 'NO' THEN ' NOT NULL'
                    ELSE ''
                END,
                ', '
            ) ||
            ', PRIMARY KEY (observation_id, program_id)' ||
            ') PARTITION BY LIST (program_id)'
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'gasifier_observations'
            AND column_name != 'observation_id'
            ORDER BY ordinal_position
        );
        
        -- Create default partition
        CREATE TABLE gasifier_obs_part_default 
            PARTITION OF gasifier_observations_partitioned DEFAULT;
            
        RAISE NOTICE 'Created gasifier_observations_partitioned';
    ELSE
        RAISE NOTICE 'gasifier_observations_partitioned already exists';
    END IF;
END $$;

-- 4. Create initial partitions
DO $$
DECLARE
    prog RECORD;
    v_count integer := 0;
BEGIN
    FOR prog IN 
        SELECT program_id, name 
        FROM pilot_programs 
        WHERE program_id IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
    LOOP
        -- Petri
        BEGIN
            EXECUTE format(
                'CREATE TABLE petri_obs_prog_%s PARTITION OF petri_observations_partitioned FOR VALUES IN (%L)',
                replace(prog.program_id::text, '-', ''),
                prog.program_id
            );
            v_count := v_count + 1;
        EXCEPTION WHEN duplicate_table THEN
            NULL;
        END;
        
        -- Gasifier
        BEGIN
            EXECUTE format(
                'CREATE TABLE gasifier_obs_prog_%s PARTITION OF gasifier_observations_partitioned FOR VALUES IN (%L)',
                replace(prog.program_id::text, '-', ''),
                prog.program_id
            );
            v_count := v_count + 1;
        EXCEPTION WHEN duplicate_table THEN
            NULL;
        END;
    END LOOP;
    
    RAISE NOTICE 'Created % partitions', v_count;
END $$;

-- 5. Grant permissions
GRANT ALL ON petri_observations_partitioned TO authenticated;
GRANT ALL ON gasifier_observations_partitioned TO authenticated;
GRANT SELECT ON petri_observations_partitioned TO anon;
GRANT SELECT ON gasifier_observations_partitioned TO anon;

-- 6. Verify results
SELECT 
    'petri_observations_partitioned' as table_name,
    EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'petri_observations_partitioned') as exists,
    (SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE 'petri_obs_prog_%') as partition_count
UNION ALL
SELECT 
    'gasifier_observations_partitioned' as table_name,
    EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'gasifier_observations_partitioned') as exists,
    (SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE 'gasifier_obs_prog_%') as partition_count;

-- Done
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Partition creation complete!';
    RAISE NOTICE 'Next step: Run update_reporting_to_partitions.sql or update_reporting_flexible.sql';
END $$;