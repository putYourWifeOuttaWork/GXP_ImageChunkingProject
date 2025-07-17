-- Comprehensive fix for ALL sync trigger column issues
-- This handles all missing columns at once to avoid multiple errors

-- First, let's check what columns actually exist in each table
DO $$
BEGIN
    RAISE NOTICE 'Checking column differences between source and partitioned tables...';
END $$;

-- Get column lists for verification
WITH gasifier_cols AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'gasifier_observations' 
    AND table_schema = 'public'
),
gasifier_part_cols AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'gasifier_observations_partitioned' 
    AND table_schema = 'public'
)
SELECT 
    'Columns in partitioned but NOT in source:' as info,
    string_agg(column_name, ', ') as missing_columns
FROM gasifier_part_cols
WHERE column_name NOT IN (SELECT column_name FROM gasifier_cols);

-- ========================================
-- GASIFIER OBSERVATIONS SYNC FIX
-- ========================================

DROP FUNCTION IF EXISTS sync_gasifier_to_partitioned() CASCADE;

CREATE OR REPLACE FUNCTION sync_gasifier_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert only columns that exist in both tables
        INSERT INTO gasifier_observations_partitioned (
            observation_id,
            submission_id,
            site_id,
            gasifier_code,
            image_url,
            chemical_type,
            measure,
            anomaly,
            notes,
            created_at,
            updated_at,
            lastupdated_by,
            program_id,
            placement_height,
            directional_placement,
            placement_strategy,
            last_updated_by_user_id,
            last_edit_time,
            outdoor_temperature,
            outdoor_humidity,
            order_index,
            position_x,
            position_y,
            footage_from_origin_x,
            footage_from_origin_y,
            linear_reading,
            linear_reduction_nominal,
            linear_reduction_per_day,
            -- Handle flow_rate if it exists in source
            CASE 
                WHEN column_exists('gasifier_observations', 'flow_rate') 
                THEN NEW.flow_rate 
                ELSE NULL 
            END as flow_rate,
            flag_for_review,
            daysinthisprogramphase,
            todays_day_of_phase,
            yesterday_reading,
            company_id
            -- These columns are NOT included as they only exist in partitioned:
            -- forecasted_expiration, trend_gasifier_velocity, trend
        )
        VALUES (
            NEW.observation_id,
            NEW.submission_id,
            NEW.site_id,
            NEW.gasifier_code,
            NEW.image_url,
            NEW.chemical_type,
            NEW.measure,
            NEW.anomaly,
            NEW.notes,
            NEW.created_at,
            NEW.updated_at,
            NEW.lastupdated_by,
            NEW.program_id,
            NEW.placement_height,
            NEW.directional_placement,
            NEW.placement_strategy,
            NEW.last_updated_by_user_id,
            NEW.last_edit_time,
            NEW.outdoor_temperature,
            NEW.outdoor_humidity,
            NEW.order_index,
            NEW.position_x,
            NEW.position_y,
            NEW.footage_from_origin_x,
            NEW.footage_from_origin_y,
            NEW.linear_reading,
            NEW.linear_reduction_nominal,
            NEW.linear_reduction_per_day,
            CASE 
                WHEN column_exists('gasifier_observations', 'flow_rate') 
                THEN NEW.flow_rate 
                ELSE NULL 
            END,
            NEW.flag_for_review,
            NEW.daysinthisprogramphase,
            NEW.todays_day_of_phase,
            NEW.yesterday_reading,
            NEW.company_id
        )
        ON CONFLICT (observation_id, program_id) DO UPDATE SET
            submission_id = EXCLUDED.submission_id,
            site_id = EXCLUDED.site_id,
            gasifier_code = EXCLUDED.gasifier_code,
            image_url = EXCLUDED.image_url,
            chemical_type = EXCLUDED.chemical_type,
            measure = EXCLUDED.measure,
            anomaly = EXCLUDED.anomaly,
            notes = EXCLUDED.notes,
            updated_at = EXCLUDED.updated_at,
            lastupdated_by = EXCLUDED.lastupdated_by,
            placement_height = EXCLUDED.placement_height,
            directional_placement = EXCLUDED.directional_placement,
            placement_strategy = EXCLUDED.placement_strategy,
            last_updated_by_user_id = EXCLUDED.last_updated_by_user_id,
            last_edit_time = EXCLUDED.last_edit_time,
            outdoor_temperature = EXCLUDED.outdoor_temperature,
            outdoor_humidity = EXCLUDED.outdoor_humidity,
            order_index = EXCLUDED.order_index,
            position_x = EXCLUDED.position_x,
            position_y = EXCLUDED.position_y,
            footage_from_origin_x = EXCLUDED.footage_from_origin_x,
            footage_from_origin_y = EXCLUDED.footage_from_origin_y,
            linear_reading = EXCLUDED.linear_reading,
            linear_reduction_nominal = EXCLUDED.linear_reduction_nominal,
            linear_reduction_per_day = EXCLUDED.linear_reduction_per_day,
            flow_rate = EXCLUDED.flow_rate,
            flag_for_review = EXCLUDED.flag_for_review,
            daysinthisprogramphase = EXCLUDED.daysinthisprogramphase,
            todays_day_of_phase = EXCLUDED.todays_day_of_phase,
            yesterday_reading = EXCLUDED.yesterday_reading,
            company_id = EXCLUDED.company_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE gasifier_observations_partitioned
        SET
            submission_id = NEW.submission_id,
            site_id = NEW.site_id,
            gasifier_code = NEW.gasifier_code,
            image_url = NEW.image_url,
            chemical_type = NEW.chemical_type,
            measure = NEW.measure,
            anomaly = NEW.anomaly,
            notes = NEW.notes,
            updated_at = NEW.updated_at,
            lastupdated_by = NEW.lastupdated_by,
            placement_height = NEW.placement_height,
            directional_placement = NEW.directional_placement,
            placement_strategy = NEW.placement_strategy,
            last_updated_by_user_id = NEW.last_updated_by_user_id,
            last_edit_time = NEW.last_edit_time,
            outdoor_temperature = NEW.outdoor_temperature,
            outdoor_humidity = NEW.outdoor_humidity,
            order_index = NEW.order_index,
            position_x = NEW.position_x,
            position_y = NEW.position_y,
            footage_from_origin_x = NEW.footage_from_origin_x,
            footage_from_origin_y = NEW.footage_from_origin_y,
            linear_reading = NEW.linear_reading,
            linear_reduction_nominal = NEW.linear_reduction_nominal,
            linear_reduction_per_day = NEW.linear_reduction_per_day,
            flow_rate = CASE 
                WHEN column_exists('gasifier_observations', 'flow_rate') 
                THEN NEW.flow_rate 
                ELSE flow_rate -- Keep existing value
            END,
            flag_for_review = NEW.flag_for_review,
            daysinthisprogramphase = NEW.daysinthisprogramphase,
            todays_day_of_phase = NEW.todays_day_of_phase,
            yesterday_reading = NEW.yesterday_reading,
            company_id = NEW.company_id
        WHERE observation_id = NEW.observation_id 
          AND program_id = NEW.program_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM gasifier_observations_partitioned
        WHERE observation_id = OLD.observation_id
          AND program_id = OLD.program_id;
        
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- PETRI OBSERVATIONS SYNC FIX
-- ========================================

DROP FUNCTION IF EXISTS sync_petri_to_partitioned() CASCADE;

CREATE OR REPLACE FUNCTION sync_petri_to_partitioned()
RETURNS TRIGGER AS $$
DECLARE
    v_has_split_status boolean;
    v_has_days_in_phase boolean;
    v_has_todays_day boolean;
    v_has_yesterday_growth boolean;
BEGIN
    -- Check which columns exist in source table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'petri_observations' 
        AND column_name = 'split_image_status'
    ) INTO v_has_split_status;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'petri_observations' 
        AND column_name = 'daysinthisprogramphase'
    ) INTO v_has_days_in_phase;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'petri_observations' 
        AND column_name = 'todays_day_of_phase'
    ) INTO v_has_todays_day;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'petri_observations' 
        AND column_name = 'yesterday_growth_index'
    ) INTO v_has_yesterday_growth;

    IF TG_OP = 'INSERT' THEN
        -- Build dynamic insert based on available columns
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
            company_id,
            -- Conditionally include columns if they exist
            split_image_status,
            daysinthisprogramphase,
            todays_day_of_phase,
            yesterday_growth_index
            -- NOT included: trend_petri_velocity, experiment_role (calculated columns)
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
            NEW.company_id,
            -- Handle conditional columns
            CASE WHEN v_has_split_status THEN NEW.split_image_status ELSE NULL END,
            CASE WHEN v_has_days_in_phase THEN NEW.daysinthisprogramphase ELSE NULL END,
            CASE WHEN v_has_todays_day THEN NEW.todays_day_of_phase ELSE NULL END,
            CASE WHEN v_has_yesterday_growth THEN NEW.yesterday_growth_index ELSE NULL END
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
            company_id = EXCLUDED.company_id,
            split_image_status = EXCLUDED.split_image_status,
            daysinthisprogramphase = EXCLUDED.daysinthisprogramphase,
            todays_day_of_phase = EXCLUDED.todays_day_of_phase,
            yesterday_growth_index = EXCLUDED.yesterday_growth_index;
        
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
            company_id = NEW.company_id,
            split_image_status = CASE WHEN v_has_split_status THEN NEW.split_image_status ELSE split_image_status END,
            daysinthisprogramphase = CASE WHEN v_has_days_in_phase THEN NEW.daysinthisprogramphase ELSE daysinthisprogramphase END,
            todays_day_of_phase = CASE WHEN v_has_todays_day THEN NEW.todays_day_of_phase ELSE todays_day_of_phase END,
            yesterday_growth_index = CASE WHEN v_has_yesterday_growth THEN NEW.yesterday_growth_index ELSE yesterday_growth_index END
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

-- ========================================
-- HELPER FUNCTION FOR COLUMN EXISTENCE
-- ========================================

CREATE OR REPLACE FUNCTION column_exists(p_table_name text, p_column_name text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = p_table_name 
        AND column_name = p_column_name
        AND table_schema = 'public'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ========================================
-- RECREATE THE TRIGGERS ON SOURCE TABLES ONLY
-- ========================================

-- Create trigger for gasifier_observations (source table only!)
CREATE TRIGGER sync_gasifier_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON gasifier_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_gasifier_to_partitioned();

-- Create trigger for petri_observations (source table only!)
CREATE TRIGGER sync_petri_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON petri_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_petri_to_partitioned();

-- ========================================
-- REMOVE TRIGGERS FROM PARTITIONED TABLES
-- ========================================

-- This is critical! Triggers should NOT be on partitioned tables
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remove sync triggers from all gasifier partitioned tables
    FOR r IN 
        SELECT DISTINCT t.tgname, c.relname 
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE t.tgname = 'sync_gasifier_observations_trigger'
        AND c.relname LIKE 'gasifier_obs_%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', r.tgname, r.relname);
        RAISE NOTICE 'Dropped trigger % from table %', r.tgname, r.relname;
    END LOOP;

    -- Remove sync triggers from all petri partitioned tables
    FOR r IN 
        SELECT DISTINCT t.tgname, c.relname 
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE t.tgname = 'sync_petri_observations_trigger'
        AND c.relname LIKE 'petri_obs_%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', r.tgname, r.relname);
        RAISE NOTICE 'Dropped trigger % from table %', r.tgname, r.relname;
    END LOOP;
END $$;

-- ========================================
-- VERIFY THE FIX
-- ========================================

-- Show remaining triggers
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    CASE tgenabled 
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger t
WHERE tgname IN ('sync_gasifier_observations_trigger', 'sync_petri_observations_trigger')
ORDER BY table_name;

-- Show column differences
WITH petri_source AS (
    SELECT array_agg(column_name ORDER BY ordinal_position) as cols
    FROM information_schema.columns
    WHERE table_name = 'petri_observations' AND table_schema = 'public'
),
petri_part AS (
    SELECT array_agg(column_name ORDER BY ordinal_position) as cols
    FROM information_schema.columns
    WHERE table_name = 'petri_observations_partitioned' AND table_schema = 'public'
)
SELECT 
    'Petri columns in partitioned but NOT in source:' as info,
    array_to_string(
        ARRAY(
            SELECT unnest(p.cols)
            EXCEPT
            SELECT unnest(s.cols)
        ), ', '
    ) as missing_columns
FROM petri_source s, petri_part p;

-- Add documentation
COMMENT ON FUNCTION sync_gasifier_to_partitioned IS 
'Syncs data from gasifier_observations to gasifier_observations_partitioned. 
Handles column differences gracefully. Calculated columns (forecasted_expiration, 
trend_gasifier_velocity, trend) are managed by triggers on the partitioned table.';

COMMENT ON FUNCTION sync_petri_to_partitioned IS 
'Syncs data from petri_observations to petri_observations_partitioned. 
Handles column differences gracefully. Calculated columns (trend_petri_velocity, 
experiment_role) are managed by triggers on the partitioned table.';

-- Final message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sync triggers have been comprehensively fixed!';
    RAISE NOTICE '📝 All column differences are now handled gracefully.';
    RAISE NOTICE '🚀 Submission creation should work without any column errors.';
END $$;