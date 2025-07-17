-- Create triggers to automatically sync gasifier_observations and petri_observations
-- to their partitioned counterparts on INSERT, UPDATE, and DELETE

-- ========================================
-- GASIFIER OBSERVATIONS SYNC
-- ========================================

-- Function to sync gasifier_observations to gasifier_observations_partitioned
CREATE OR REPLACE FUNCTION sync_gasifier_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert into partitioned table
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
            company_id,
            forecasted_expiration,
            trend_gasifier_velocity
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
            NEW.company_id,
            NEW.forecasted_expiration,
            NEW.trend_gasifier_velocity
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
            company_id = NEW.company_id,
            forecasted_expiration = NEW.forecasted_expiration,
            trend_gasifier_velocity = NEW.trend_gasifier_velocity
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
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for gasifier_observations
DROP TRIGGER IF EXISTS sync_gasifier_observations_trigger ON gasifier_observations;
CREATE TRIGGER sync_gasifier_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON gasifier_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_gasifier_to_partitioned();

-- ========================================
-- PETRI OBSERVATIONS SYNC
-- ========================================

-- Function to sync petri_observations to petri_observations_partitioned
CREATE OR REPLACE FUNCTION sync_petri_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert into partitioned table
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
            program_name,
            lastupdated_by,
            plant_type,
            program_id,
            placement,
            placement_dynamics,
            last_updated_by_user_id,
            last_edit_time,
            outdoor_temperature,
            outdoor_humidity,
            petri_growth_stage,
            growth_index,
            order_index,
            x_position,
            y_position,
            footage_from_origin_x,
            footage_from_origin_y,
            growth_progression,
            growth_aggression,
            growth_velocity,
            todays_day_of_phase,
            is_image_split,
            phase_observation_settings,
            is_missed_observation,
            main_petri_id,
            is_split_source,
            split_processed,
            flag_for_review,
            company_id
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
            NEW.program_name,
            NEW.lastupdated_by,
            NEW.plant_type,
            NEW.program_id,
            NEW.placement,
            NEW.placement_dynamics,
            NEW.last_updated_by_user_id,
            NEW.last_edit_time,
            NEW.outdoor_temperature,
            NEW.outdoor_humidity,
            NEW.petri_growth_stage,
            NEW.growth_index,
            NEW.order_index,
            NEW.x_position,
            NEW.y_position,
            NEW.footage_from_origin_x,
            NEW.footage_from_origin_y,
            NEW.growth_progression,
            NEW.growth_aggression,
            NEW.growth_velocity,
            NEW.todays_day_of_phase,
            NEW.is_image_split,
            NEW.phase_observation_settings,
            NEW.is_missed_observation,
            NEW.main_petri_id,
            NEW.is_split_source,
            NEW.split_processed,
            NEW.flag_for_review,
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
            updated_at = NEW.updated_at,
            program_name = NEW.program_name,
            lastupdated_by = NEW.lastupdated_by,
            plant_type = NEW.plant_type,
            placement = NEW.placement,
            placement_dynamics = NEW.placement_dynamics,
            last_updated_by_user_id = NEW.last_updated_by_user_id,
            last_edit_time = NEW.last_edit_time,
            outdoor_temperature = NEW.outdoor_temperature,
            outdoor_humidity = NEW.outdoor_humidity,
            petri_growth_stage = NEW.petri_growth_stage,
            growth_index = NEW.growth_index,
            order_index = NEW.order_index,
            x_position = NEW.x_position,
            y_position = NEW.y_position,
            footage_from_origin_x = NEW.footage_from_origin_x,
            footage_from_origin_y = NEW.footage_from_origin_y,
            growth_progression = NEW.growth_progression,
            growth_aggression = NEW.growth_aggression,
            growth_velocity = NEW.growth_velocity,
            todays_day_of_phase = NEW.todays_day_of_phase,
            is_image_split = NEW.is_image_split,
            phase_observation_settings = NEW.phase_observation_settings,
            is_missed_observation = NEW.is_missed_observation,
            main_petri_id = NEW.main_petri_id,
            is_split_source = NEW.is_split_source,
            split_processed = NEW.split_processed,
            flag_for_review = NEW.flag_for_review,
            company_id = NEW.company_id
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
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for petri_observations
DROP TRIGGER IF EXISTS sync_petri_observations_trigger ON petri_observations;
CREATE TRIGGER sync_petri_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON petri_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_petri_to_partitioned();

-- ========================================
-- INITIAL DATA SYNC (Optional)
-- ========================================
-- Uncomment these if you want to sync existing data

-- -- Sync existing gasifier observations
-- INSERT INTO gasifier_observations_partitioned
-- SELECT * FROM gasifier_observations
-- ON CONFLICT (observation_id, program_id) DO NOTHING;

-- -- Sync existing petri observations  
-- INSERT INTO petri_observations_partitioned
-- SELECT * FROM petri_observations
-- ON CONFLICT (observation_id, program_id) DO NOTHING;

-- ========================================
-- VERIFICATION
-- ========================================
-- Check trigger status
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname IN ('sync_gasifier_observations_trigger', 'sync_petri_observations_trigger');