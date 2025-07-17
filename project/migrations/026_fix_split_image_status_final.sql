-- Final fix for split_image_status column issue
-- The column doesn't exist in petri_observations_partitioned but the trigger is trying to insert it

-- First, check if split_image_status exists in partitioned table
DO $$
DECLARE
    col_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'petri_observations_partitioned' 
        AND column_name = 'split_image_status'
        AND table_schema = 'public'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE NOTICE 'Adding split_image_status column to petri_observations_partitioned...';
        
        -- Add the column to the parent partitioned table
        ALTER TABLE petri_observations_partitioned 
        ADD COLUMN IF NOT EXISTS split_image_status text;
        
        -- Add the column to all existing partitions
        DECLARE
            partition_name text;
        BEGIN
            FOR partition_name IN 
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename LIKE 'petri_obs_%'
            LOOP
                EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS split_image_status text', partition_name);
                RAISE NOTICE 'Added split_image_status to %', partition_name;
            END LOOP;
        END;
    ELSE
        RAISE NOTICE 'split_image_status already exists in petri_observations_partitioned';
    END IF;
END $$;

-- Now recreate the sync function WITHOUT split_image_status in the insert
DROP FUNCTION IF EXISTS sync_petri_to_partitioned() CASCADE;

CREATE OR REPLACE FUNCTION sync_petri_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert only columns that exist in BOTH tables
        INSERT INTO petri_observations_partitioned (
            observation_id,
            submission_id,
            site_id,
            petri_code,
            image_url,
            fungicide_used,
            surrounding_water_schedule,
            notes,
            created_at,
            updated_at,
            lastupdated_by,
            program_id,
            plant_type,
            placement,
            placement_dynamics,
            last_updated_by_user_id,
            last_edit_time,
            outdoor_temperature,
            outdoor_humidity,
            order_index,
            x_position,
            y_position,
            petri_growth_stage,
            growth_index,
            footage_from_origin_x,
            footage_from_origin_y,
            growth_progression,
            growth_velocity,
            phase_observation_settings,
            is_image_split,
            is_split_source,
            split_processed,
            main_petri_id,
            flag_for_review,
            daysinthisprogramphase,
            todays_day_of_phase,
            yesterday_growth_index,
            company_id
            -- NOT including: split_image_status, trend_petri_velocity, experiment_role
        )
        VALUES (
            NEW.observation_id,
            NEW.submission_id,
            NEW.site_id,
            NEW.petri_code,
            NEW.image_url,
            NEW.fungicide_used,
            NEW.surrounding_water_schedule,
            NEW.notes,
            NEW.created_at,
            NEW.updated_at,
            NEW.lastupdated_by,
            NEW.program_id,
            NEW.plant_type,
            NEW.placement,
            NEW.placement_dynamics,
            NEW.last_updated_by_user_id,
            NEW.last_edit_time,
            NEW.outdoor_temperature,
            NEW.outdoor_humidity,
            NEW.order_index,
            NEW.x_position,
            NEW.y_position,
            NEW.petri_growth_stage,
            NEW.growth_index,
            NEW.footage_from_origin_x,
            NEW.footage_from_origin_y,
            NEW.growth_progression,
            NEW.growth_velocity,
            NEW.phase_observation_settings,
            NEW.is_image_split,
            NEW.is_split_source,
            NEW.split_processed,
            NEW.main_petri_id,
            NEW.flag_for_review,
            NEW.daysinthisprogramphase,
            NEW.todays_day_of_phase,
            NEW.yesterday_growth_index,
            NEW.company_id
        )
        ON CONFLICT (observation_id, program_id) DO UPDATE SET
            submission_id = EXCLUDED.submission_id,
            site_id = EXCLUDED.site_id,
            petri_code = EXCLUDED.petri_code,
            image_url = EXCLUDED.image_url,
            fungicide_used = EXCLUDED.fungicide_used,
            surrounding_water_schedule = EXCLUDED.surrounding_water_schedule,
            notes = EXCLUDED.notes,
            updated_at = EXCLUDED.updated_at,
            lastupdated_by = EXCLUDED.lastupdated_by,
            plant_type = EXCLUDED.plant_type,
            placement = EXCLUDED.placement,
            placement_dynamics = EXCLUDED.placement_dynamics,
            last_updated_by_user_id = EXCLUDED.last_updated_by_user_id,
            last_edit_time = EXCLUDED.last_edit_time,
            outdoor_temperature = EXCLUDED.outdoor_temperature,
            outdoor_humidity = EXCLUDED.outdoor_humidity,
            order_index = EXCLUDED.order_index,
            x_position = EXCLUDED.x_position,
            y_position = EXCLUDED.y_position,
            petri_growth_stage = EXCLUDED.petri_growth_stage,
            growth_index = EXCLUDED.growth_index,
            footage_from_origin_x = EXCLUDED.footage_from_origin_x,
            footage_from_origin_y = EXCLUDED.footage_from_origin_y,
            growth_progression = EXCLUDED.growth_progression,
            growth_velocity = EXCLUDED.growth_velocity,
            phase_observation_settings = EXCLUDED.phase_observation_settings,
            is_image_split = EXCLUDED.is_image_split,
            is_split_source = EXCLUDED.is_split_source,
            split_processed = EXCLUDED.split_processed,
            main_petri_id = EXCLUDED.main_petri_id,
            flag_for_review = EXCLUDED.flag_for_review,
            daysinthisprogramphase = EXCLUDED.daysinthisprogramphase,
            todays_day_of_phase = EXCLUDED.todays_day_of_phase,
            yesterday_growth_index = EXCLUDED.yesterday_growth_index,
            company_id = EXCLUDED.company_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE petri_observations_partitioned
        SET
            submission_id = NEW.submission_id,
            site_id = NEW.site_id,
            petri_code = NEW.petri_code,
            image_url = NEW.image_url,
            fungicide_used = NEW.fungicide_used,
            surrounding_water_schedule = NEW.surrounding_water_schedule,
            notes = NEW.notes,
            updated_at = NEW.updated_at,
            lastupdated_by = NEW.lastupdated_by,
            plant_type = NEW.plant_type,
            placement = NEW.placement,
            placement_dynamics = NEW.placement_dynamics,
            last_updated_by_user_id = NEW.last_updated_by_user_id,
            last_edit_time = NEW.last_edit_time,
            outdoor_temperature = NEW.outdoor_temperature,
            outdoor_humidity = NEW.outdoor_humidity,
            order_index = NEW.order_index,
            x_position = NEW.x_position,
            y_position = NEW.y_position,
            petri_growth_stage = NEW.petri_growth_stage,
            growth_index = NEW.growth_index,
            footage_from_origin_x = NEW.footage_from_origin_x,
            footage_from_origin_y = NEW.footage_from_origin_y,
            growth_progression = NEW.growth_progression,
            growth_velocity = NEW.growth_velocity,
            phase_observation_settings = NEW.phase_observation_settings,
            is_image_split = NEW.is_image_split,
            is_split_source = NEW.is_split_source,
            split_processed = NEW.split_processed,
            main_petri_id = NEW.main_petri_id,
            flag_for_review = NEW.flag_for_review,
            daysinthisprogramphase = NEW.daysinthisprogramphase,
            todays_day_of_phase = NEW.todays_day_of_phase,
            yesterday_growth_index = NEW.yesterday_growth_index,
            company_id = NEW.company_id
            -- NOT updating: split_image_status (managed separately)
        WHERE observation_id = NEW.observation_id 
          AND program_id = NEW.program_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM petri_observations_partitioned
        WHERE observation_id = OLD.observation_id
          AND program_id = OLD.program_id;
        
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger on source table only
CREATE TRIGGER sync_petri_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON petri_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_petri_to_partitioned();

-- Clean up any duplicate triggers
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remove triggers from partition tables (keep only on source)
    FOR r IN 
        SELECT DISTINCT c.relname, t.tgname
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE t.tgname = 'sync_petri_observations_trigger'
        AND c.relname LIKE 'petri_obs_%'
    LOOP
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE', r.tgname, r.relname);
            RAISE NOTICE 'Cleaned up trigger % from %', r.tgname, r.relname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not remove trigger % from %: %', r.tgname, r.relname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Verify columns exist
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('petri_observations', 'petri_observations_partitioned')
AND column_name = 'split_image_status'
AND table_schema = 'public'
ORDER BY table_name;

-- Show final state
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ split_image_status column issue RESOLVED!';
    RAISE NOTICE '📝 Column added to petri_observations_partitioned if missing';
    RAISE NOTICE '🔧 Sync trigger updated to exclude split_image_status from sync';
    RAISE NOTICE '🧹 Cleaned up duplicate triggers from partition tables';
    RAISE NOTICE '';
    RAISE NOTICE '✨ Try creating a submission now - it should work!';
END $$;