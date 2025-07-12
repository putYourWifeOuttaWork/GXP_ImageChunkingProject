-- Safe Partition Creation Script
-- This script checks if partitioned tables exist and creates them if they don't
-- =============================================================================

-- Check if partitioned tables already exist
DO $$
DECLARE
    v_petri_exists boolean;
    v_gasifier_exists boolean;
BEGIN
    -- Check for existence
    SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'petri_observations_partitioned'
    ) INTO v_petri_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'gasifier_observations_partitioned'
    ) INTO v_gasifier_exists;
    
    -- Report status
    IF v_petri_exists THEN
        RAISE NOTICE 'petri_observations_partitioned already exists';
    ELSE
        RAISE NOTICE 'petri_observations_partitioned does not exist - will create';
    END IF;
    
    IF v_gasifier_exists THEN
        RAISE NOTICE 'gasifier_observations_partitioned already exists';
    ELSE
        RAISE NOTICE 'gasifier_observations_partitioned does not exist - will create';
    END IF;
END $$;

-- 1. Create petri_observations_partitioned if it doesn't exist
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'petri_observations_partitioned'
    ) THEN
        -- Create the partitioned table with exact schema match
        CREATE TABLE petri_observations_partitioned (
            observation_id uuid NOT NULL,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            created_by uuid,
            updated_by uuid,
            submission_id uuid NOT NULL,
            site_id uuid NOT NULL,
            program_id uuid NOT NULL,
            petri_code text NOT NULL,
            image_url text,
            placement enum_placement,
            fungicide_used enum_fungicide_used,
            growth_percent numeric(5,2),
            petri_growth_stage enum_petri_growth_stage,
            growth_index numeric(10,2),
            growth_progression numeric(10,2),
            growth_aggression numeric(10,2),
            growth_velocity numeric(10,2),
            -- Environmental fields
            outdoor_temperature numeric(5,2),
            outdoor_humidity numeric(5,2),
            -- Position fields
            x_position numeric(10,2),
            y_position numeric(10,2),
            -- Day tracking
            todays_day_of_phase integer,
            daysinthisprogramphase integer,
            -- Constraints
            PRIMARY KEY (observation_id, program_id),
            CONSTRAINT fk_submission FOREIGN KEY (submission_id) REFERENCES submissions(submission_id),
            CONSTRAINT fk_site FOREIGN KEY (site_id) REFERENCES sites(site_id),
            CONSTRAINT fk_program FOREIGN KEY (program_id) REFERENCES pilot_programs(program_id)
        ) PARTITION BY LIST (program_id);
        
        -- Create default partition
        CREATE TABLE petri_obs_part_default 
            PARTITION OF petri_observations_partitioned DEFAULT;
            
        RAISE NOTICE 'Created petri_observations_partitioned table';
    END IF;
END $$;

-- 2. Create gasifier_observations_partitioned if it doesn't exist
-- --------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'gasifier_observations_partitioned'
    ) THEN
        -- Create the partitioned table
        CREATE TABLE gasifier_observations_partitioned (
            observation_id uuid NOT NULL,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            created_by uuid,
            updated_by uuid,
            submission_id uuid NOT NULL,
            site_id uuid NOT NULL,
            program_id uuid NOT NULL,
            gasifier_code text NOT NULL,
            image_url text,
            chemical_type enum_chemical_type,
            measure numeric(10,2),
            position_x numeric(10,2),
            position_y numeric(10,2),
            linear_reading numeric(10,2),
            -- Constraints
            PRIMARY KEY (observation_id, program_id),
            CONSTRAINT fk_submission FOREIGN KEY (submission_id) REFERENCES submissions(submission_id),
            CONSTRAINT fk_site FOREIGN KEY (site_id) REFERENCES sites(site_id),
            CONSTRAINT fk_program FOREIGN KEY (program_id) REFERENCES pilot_programs(program_id)
        ) PARTITION BY LIST (program_id);
        
        -- Create default partition
        CREATE TABLE gasifier_obs_part_default 
            PARTITION OF gasifier_observations_partitioned DEFAULT;
            
        RAISE NOTICE 'Created gasifier_observations_partitioned table';
    END IF;
END $$;

-- 3. Create partitions for existing programs
-- -----------------------------------------
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
    LOOP
        -- Create petri partition
        partition_name := 'petri_obs_prog_' || replace(prog.program_id::text, '-', '');
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = partition_name
        ) THEN
            BEGIN
                EXECUTE format(
                    'CREATE TABLE %I PARTITION OF petri_observations_partitioned FOR VALUES IN (%L)',
                    partition_name,
                    prog.program_id
                );
                v_created := v_created + 1;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not create partition %: %', partition_name, SQLERRM;
            END;
        END IF;
        
        -- Create gasifier partition
        partition_name := 'gasifier_obs_prog_' || replace(prog.program_id::text, '-', '');
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = partition_name
        ) THEN
            BEGIN
                EXECUTE format(
                    'CREATE TABLE %I PARTITION OF gasifier_observations_partitioned FOR VALUES IN (%L)',
                    partition_name,
                    prog.program_id
                );
                v_created := v_created + 1;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not create partition %: %', partition_name, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Created % new partitions', v_created;
END $$;

-- 4. Create triggers for automatic partition creation
-- --------------------------------------------------

-- Function to auto-create petri partitions
CREATE OR REPLACE FUNCTION auto_create_petri_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_name text;
BEGIN
    partition_name := 'petri_obs_prog_' || replace(NEW.program_id::text, '-', '');
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE tablename = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF petri_observations_partitioned FOR VALUES IN (%L)',
            partition_name,
            NEW.program_id
        );
        RAISE NOTICE 'Auto-created petri partition % for program %', partition_name, NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create gasifier partitions
CREATE OR REPLACE FUNCTION auto_create_gasifier_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_name text;
BEGIN
    partition_name := 'gasifier_obs_prog_' || replace(NEW.program_id::text, '-', '');
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE tablename = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF gasifier_observations_partitioned FOR VALUES IN (%L)',
            partition_name,
            NEW.program_id
        );
        RAISE NOTICE 'Auto-created gasifier partition % for program %', partition_name, NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS auto_create_petri_partition_trigger ON pilot_programs;
CREATE TRIGGER auto_create_petri_partition_trigger
    AFTER INSERT ON pilot_programs
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_petri_partition();

DROP TRIGGER IF EXISTS auto_create_gasifier_partition_trigger ON pilot_programs;
CREATE TRIGGER auto_create_gasifier_partition_trigger
    AFTER INSERT ON pilot_programs
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_gasifier_partition();

-- 5. Create views for easy access
-- -------------------------------
CREATE OR REPLACE VIEW v_petri_observations_partitioned AS
SELECT * FROM petri_observations_partitioned;

CREATE OR REPLACE VIEW v_gasifier_observations_partitioned AS
SELECT * FROM gasifier_observations_partitioned;

-- Grant permissions
GRANT SELECT ON v_petri_observations_partitioned TO authenticated, anon;
GRANT SELECT ON v_gasifier_observations_partitioned TO authenticated, anon;
GRANT ALL ON petri_observations_partitioned TO authenticated;
GRANT ALL ON gasifier_observations_partitioned TO authenticated;

-- 6. Verify partition creation
-- ---------------------------
SELECT 
    'Petri partitions' as table_type,
    COUNT(*) as partition_count
FROM pg_tables 
WHERE tablename LIKE 'petri_obs_prog_%'
UNION ALL
SELECT 
    'Gasifier partitions' as table_type,
    COUNT(*) as partition_count
FROM pg_tables 
WHERE tablename LIKE 'gasifier_obs_prog_%';

-- Report final status
DO $$
DECLARE
    v_petri_count integer;
    v_gasifier_count integer;
BEGIN
    SELECT COUNT(*) INTO v_petri_count
    FROM pg_tables WHERE tablename LIKE 'petri_obs_prog_%';
    
    SELECT COUNT(*) INTO v_gasifier_count
    FROM pg_tables WHERE tablename LIKE 'gasifier_obs_prog_%';
    
    RAISE NOTICE '✅ Partition setup complete!';
    RAISE NOTICE '   - Petri partitions: %', v_petri_count;
    RAISE NOTICE '   - Gasifier partitions: %', v_gasifier_count;
    RAISE NOTICE '   - Auto-creation triggers: ACTIVE';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now run update_reporting_to_partitions.sql';
END $$;