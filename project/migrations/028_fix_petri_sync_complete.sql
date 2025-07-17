-- Complete fix for petri_observations sync
-- Recreate the trigger and sync all data

-- First, ensure the sync function exists
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

-- Now create the trigger
DROP TRIGGER IF EXISTS sync_petri_observations_trigger ON petri_observations;
CREATE TRIGGER sync_petri_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON petri_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_petri_to_partitioned();

-- Manual sync all existing records
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
)
SELECT 
    po.observation_id,
    po.submission_id,
    po.site_id,
    po.petri_code,
    po.image_url,
    po.fungicide_used,
    po.surrounding_water_schedule,
    po.notes,
    po.created_at,
    po.updated_at,
    po.lastupdated_by,
    po.program_id,
    po.plant_type,
    po.placement,
    po.placement_dynamics,
    po.last_updated_by_user_id,
    po.last_edit_time,
    po.outdoor_temperature,
    po.outdoor_humidity,
    po.order_index,
    po.x_position,
    po.y_position,
    po.petri_growth_stage,
    po.growth_index,
    po.footage_from_origin_x,
    po.footage_from_origin_y,
    po.growth_progression,
    po.growth_velocity,
    po.phase_observation_settings,
    po.is_image_split,
    po.is_split_source,
    po.split_processed,
    po.main_petri_id,
    po.flag_for_review,
    po.daysinthisprogramphase,
    po.todays_day_of_phase,
    po.yesterday_growth_index,
    po.company_id
FROM petri_observations po
WHERE po.program_id IS NOT NULL
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

-- Final verification
DO $$
DECLARE
    source_count INTEGER;
    partitioned_count INTEGER;
    synced_count INTEGER;
    trigger_exists BOOLEAN;
BEGIN
    -- Count records after sync
    SELECT COUNT(*) INTO source_count FROM petri_observations;
    SELECT COUNT(*) INTO partitioned_count FROM petri_observations_partitioned;
    
    -- Count synced records
    SELECT COUNT(*) INTO synced_count
    FROM petri_observations po
    WHERE EXISTS (
        SELECT 1 FROM petri_observations_partitioned pp
        WHERE pp.observation_id = po.observation_id
    );
    
    -- Check trigger exists
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'sync_petri_observations_trigger'
        AND tgrelid = 'petri_observations'::regclass
    ) INTO trigger_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Final sync results:';
    RAISE NOTICE '  - Records in petri_observations: %', source_count;
    RAISE NOTICE '  - Records in petri_observations_partitioned: %', partitioned_count;
    RAISE NOTICE '  - Records successfully synced: %', synced_count;
    RAISE NOTICE '  - Sync trigger exists: %', trigger_exists;
    
    IF synced_count = source_count THEN
        RAISE NOTICE '✅ ALL RECORDS SYNCHRONIZED!';
    ELSE
        RAISE NOTICE '⚠️  Some records may need attention: % missing', source_count - synced_count;
    END IF;
END $$;

-- Show trigger status
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    CASE tgenabled 
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA ONLY'
        WHEN 'A' THEN 'ALWAYS'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger
WHERE tgname LIKE 'sync_%_observations_trigger'
ORDER BY table_name;