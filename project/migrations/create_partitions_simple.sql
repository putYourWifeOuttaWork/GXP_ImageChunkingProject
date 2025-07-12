-- Simple Partition Creation Script
-- Creates partitioned tables by copying structure from existing tables
-- ===================================================================

-- 1. First ensure we have the tables to copy from
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'petri_observations') THEN
        RAISE EXCEPTION 'petri_observations table does not exist - cannot create partitioned version';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gasifier_observations') THEN
        RAISE EXCEPTION 'gasifier_observations table does not exist - cannot create partitioned version';
    END IF;
    
    RAISE NOTICE 'Source tables exist - proceeding with partition creation';
END $$;

-- 2. Drop existing partitioned tables if they exist (be careful with this in production!)
-- Comment out these lines if you want to preserve existing partitioned tables
-- DROP TABLE IF EXISTS petri_observations_partitioned CASCADE;
-- DROP TABLE IF EXISTS gasifier_observations_partitioned CASCADE;

-- 3. Create petri_observations_partitioned
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'petri_observations_partitioned'
    ) THEN
        -- Create base partitioned table
        CREATE TABLE petri_observations_partitioned (
            LIKE petri_observations INCLUDING DEFAULTS INCLUDING IDENTITY
        );
        
        -- Add partition key to primary key
        ALTER TABLE petri_observations_partitioned DROP CONSTRAINT IF EXISTS petri_observations_pkey;
        ALTER TABLE petri_observations_partitioned ADD PRIMARY KEY (observation_id, program_id);
        
        -- Convert to partitioned table
        -- Note: This syntax requires PostgreSQL 10+
        -- We need to recreate the table as partitioned
        DROP TABLE petri_observations_partitioned;
        
        -- Recreate as partitioned
        CREATE TABLE petri_observations_partitioned (
            LIKE petri_observations INCLUDING DEFAULTS INCLUDING IDENTITY
        ) PARTITION BY LIST (program_id);
        
        -- Re-add the composite primary key
        ALTER TABLE petri_observations_partitioned ADD PRIMARY KEY (observation_id, program_id);
        
        -- Create default partition
        CREATE TABLE petri_obs_part_default 
            PARTITION OF petri_observations_partitioned DEFAULT;
            
        RAISE NOTICE 'Created petri_observations_partitioned';
    ELSE
        RAISE NOTICE 'petri_observations_partitioned already exists';
    END IF;
END $$;

-- 4. Create gasifier_observations_partitioned
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'gasifier_observations_partitioned'
    ) THEN
        -- Create base partitioned table
        CREATE TABLE gasifier_observations_partitioned (
            LIKE gasifier_observations INCLUDING DEFAULTS INCLUDING IDENTITY
        );
        
        -- Add partition key to primary key
        ALTER TABLE gasifier_observations_partitioned DROP CONSTRAINT IF EXISTS gasifier_observations_pkey;
        ALTER TABLE gasifier_observations_partitioned ADD PRIMARY KEY (observation_id, program_id);
        
        -- Convert to partitioned table
        DROP TABLE gasifier_observations_partitioned;
        
        -- Recreate as partitioned
        CREATE TABLE gasifier_observations_partitioned (
            LIKE gasifier_observations INCLUDING DEFAULTS INCLUDING IDENTITY
        ) PARTITION BY LIST (program_id);
        
        -- Re-add the composite primary key
        ALTER TABLE gasifier_observations_partitioned ADD PRIMARY KEY (observation_id, program_id);
        
        -- Create default partition
        CREATE TABLE gasifier_obs_part_default 
            PARTITION OF gasifier_observations_partitioned DEFAULT;
            
        RAISE NOTICE 'Created gasifier_observations_partitioned';
    ELSE
        RAISE NOTICE 'gasifier_observations_partitioned already exists';
    END IF;
END $$;

-- 5. Create initial partitions for existing programs
DO $$
DECLARE
    prog RECORD;
    partition_name text;
    v_created integer := 0;
BEGIN
    FOR prog IN 
        SELECT program_id, name 
        FROM pilot_programs 
        WHERE program_id IS NOT NULL
        LIMIT 10  -- Create first 10 for testing
    LOOP
        -- Petri partition
        partition_name := 'petri_obs_prog_' || replace(prog.program_id::text, '-', '');
        BEGIN
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF petri_observations_partitioned FOR VALUES IN (%L)',
                partition_name,
                prog.program_id
            );
            v_created := v_created + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Partition might already exist
            NULL;
        END;
        
        -- Gasifier partition
        partition_name := 'gasifier_obs_prog_' || replace(prog.program_id::text, '-', '');
        BEGIN
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF gasifier_observations_partitioned FOR VALUES IN (%L)',
                partition_name,
                prog.program_id
            );
            v_created := v_created + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Partition might already exist
            NULL;
        END;
    END LOOP;
    
    RAISE NOTICE 'Created % partitions', v_created;
END $$;

-- 6. Grant permissions
GRANT ALL ON petri_observations_partitioned TO authenticated;
GRANT ALL ON gasifier_observations_partitioned TO authenticated;
GRANT SELECT ON petri_observations_partitioned TO anon;
GRANT SELECT ON gasifier_observations_partitioned TO anon;

-- Also grant on all partitions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'petri_obs_%' 
           OR tablename LIKE 'gasifier_obs_%'
    LOOP
        EXECUTE format('GRANT ALL ON %I TO authenticated', r.tablename);
        EXECUTE format('GRANT SELECT ON %I TO anon', r.tablename);
    END LOOP;
END $$;

-- 7. Verify creation
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'petri_observations_partitioned') 
        THEN '✅ petri_observations_partitioned exists'
        ELSE '❌ petri_observations_partitioned missing'
    END as petri_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'gasifier_observations_partitioned') 
        THEN '✅ gasifier_observations_partitioned exists'
        ELSE '❌ gasifier_observations_partitioned missing'
    END as gasifier_status;

-- Count partitions
SELECT 
    'Petri partitions' as type,
    COUNT(*) as count
FROM pg_tables 
WHERE tablename LIKE 'petri_obs_prog_%'
UNION ALL
SELECT 
    'Gasifier partitions' as type,
    COUNT(*) as count
FROM pg_tables 
WHERE tablename LIKE 'gasifier_obs_prog_%';

-- Test insertion (optional - uncomment to test)
/*
-- Get a sample program_id
WITH sample_program AS (
    SELECT program_id FROM pilot_programs LIMIT 1
)
INSERT INTO petri_observations_partitioned (
    observation_id,
    submission_id,
    site_id,
    program_id,
    petri_code
)
SELECT 
    gen_random_uuid(),
    (SELECT submission_id FROM submissions WHERE program_id = sp.program_id LIMIT 1),
    (SELECT site_id FROM sites WHERE program_id = sp.program_id LIMIT 1),
    sp.program_id,
    'TEST_PETRI_001'
FROM sample_program sp;

SELECT 'Test insert successful' as status;
*/

-- Final message
DO $$
BEGIN
    RAISE NOTICE 'Partition setup complete. You can now run update_reporting_to_partitions.sql';
END $$;