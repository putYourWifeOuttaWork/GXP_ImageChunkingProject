-- Fix sync triggers to handle new columns that only exist in partitioned tables
-- The issue: sync triggers are trying to copy columns that don't exist in source tables

-- ========================================
-- GASIFIER OBSERVATIONS SYNC FIX
-- ========================================

-- Drop the existing sync function and recreate it
DROP FUNCTION IF EXISTS sync_gasifier_to_partitioned() CASCADE;

-- Create updated sync function that handles missing columns
CREATE OR REPLACE FUNCTION sync_gasifier_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert into partitioned table
        -- Note: forecasted_expiration and trend_gasifier_velocity will be NULL
        -- and will be calculated by triggers on the partitioned table
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
            flow_rate,
            flag_for_review,
            daysinthisprogramphase,
            todays_day_of_phase,
            yesterday_reading,
            company_id
            -- forecasted_expiration and trend_gasifier_velocity are NOT copied
            -- they will be calculated by triggers on the partitioned table
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
            NEW.flow_rate,
            NEW.flag_for_review,
            NEW.daysinthisprogramphase,
            NEW.todays_day_of_phase,
            NEW.yesterday_reading,
            NEW.company_id
        )
        ON CONFLICT (observation_id, program_id) DO NOTHING;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update in partitioned table
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
            created_at = NEW.created_at,
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
            flow_rate = NEW.flow_rate,
            flag_for_review = NEW.flag_for_review,
            daysinthisprogramphase = NEW.daysinthisprogramphase,
            todays_day_of_phase = NEW.todays_day_of_phase,
            yesterday_reading = NEW.yesterday_reading,
            company_id = NEW.company_id
            -- Note: forecasted_expiration and trend_gasifier_velocity are NOT updated
            -- They are calculated columns managed by triggers on the partitioned table
        WHERE observation_id = NEW.observation_id 
          AND program_id = NEW.program_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Delete from partitioned table
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

-- Drop the existing sync function and recreate it
DROP FUNCTION IF EXISTS sync_petri_to_partitioned() CASCADE;

-- Create updated sync function that handles missing columns
CREATE OR REPLACE FUNCTION sync_petri_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert into partitioned table
        -- Note: trend_petri_velocity and experiment_role will be NULL
        -- and will be calculated by triggers on the partitioned table
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
            split_image_status,
            flag_for_review,
            daysinthisprogramphase,
            todays_day_of_phase,
            yesterday_growth_index,
            company_id
            -- trend_petri_velocity and experiment_role are NOT copied
            -- they will be calculated by triggers on the partitioned table
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
            NEW.split_image_status,
            NEW.flag_for_review,
            NEW.daysinthisprogramphase,
            NEW.todays_day_of_phase,
            NEW.yesterday_growth_index,
            NEW.company_id
        )
        ON CONFLICT (observation_id, program_id) DO NOTHING;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update in partitioned table
        UPDATE petri_observations_partitioned
        SET
            submission_id = NEW.submission_id,
            site_id = NEW.site_id,
            petri_code = NEW.petri_code,
            image_url = NEW.image_url,
            fungicide_used = NEW.fungicide_used,
            surrounding_water_schedule = NEW.surrounding_water_schedule,
            notes = NEW.notes,
            created_at = NEW.created_at,
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
            split_image_status = NEW.split_image_status,
            flag_for_review = NEW.flag_for_review,
            daysinthisprogramphase = NEW.daysinthisprogramphase,
            todays_day_of_phase = NEW.todays_day_of_phase,
            yesterday_growth_index = NEW.yesterday_growth_index,
            company_id = NEW.company_id
            -- Note: trend_petri_velocity and experiment_role are NOT updated
            -- They are calculated columns managed by triggers on the partitioned table
        WHERE observation_id = NEW.observation_id 
          AND program_id = NEW.program_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Delete from partitioned table
        DELETE FROM petri_observations_partitioned
        WHERE observation_id = OLD.observation_id
          AND program_id = OLD.program_id;
        
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- RECREATE THE TRIGGERS
-- ========================================

-- Create trigger for gasifier_observations
CREATE TRIGGER sync_gasifier_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON gasifier_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_gasifier_to_partitioned();

-- Create trigger for petri_observations
CREATE TRIGGER sync_petri_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON petri_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_petri_to_partitioned();

-- ========================================
-- VERIFY THE FIX
-- ========================================

-- Test by checking if triggers exist and are enabled
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    CASE tgenabled 
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        ELSE 'UNKNOWN'
    END as status,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname IN ('sync_gasifier_observations_trigger', 'sync_petri_observations_trigger')
ORDER BY table_name;

-- Verify columns in source vs partitioned tables
SELECT 
    'gasifier_observations' as table_name,
    array_agg(column_name ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_name = 'gasifier_observations' AND table_schema = 'public'
UNION ALL
SELECT 
    'gasifier_observations_partitioned' as table_name,
    array_agg(column_name ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_name = 'gasifier_observations_partitioned' AND table_schema = 'public';

-- Add comments for documentation
COMMENT ON FUNCTION sync_gasifier_to_partitioned IS 
'Syncs data from gasifier_observations to gasifier_observations_partitioned. 
Does not copy calculated columns (forecasted_expiration, trend_gasifier_velocity) 
which are managed by triggers on the partitioned table.';

COMMENT ON FUNCTION sync_petri_to_partitioned IS 
'Syncs data from petri_observations to petri_observations_partitioned. 
Does not copy calculated columns (trend_petri_velocity, experiment_role) 
which are managed by triggers on the partitioned table.';