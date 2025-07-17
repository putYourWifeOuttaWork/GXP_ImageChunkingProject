-- Fix petri sync by only including columns that exist in both tables

-- First, let's check which columns exist in both tables
WITH source_cols AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'petri_observations' 
    AND table_schema = 'public'
),
partitioned_cols AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'petri_observations_partitioned' 
    AND table_schema = 'public'
)
SELECT 
    'Common columns' as type,
    string_agg(column_name, ', ' ORDER BY column_name) as columns
FROM source_cols
WHERE column_name IN (SELECT column_name FROM partitioned_cols)
UNION ALL
SELECT 
    'Only in source' as type,
    string_agg(column_name, ', ' ORDER BY column_name) as columns
FROM source_cols
WHERE column_name NOT IN (SELECT column_name FROM partitioned_cols)
UNION ALL
SELECT 
    'Only in partitioned' as type,
    string_agg(column_name, ', ' ORDER BY column_name) as columns
FROM partitioned_cols
WHERE column_name NOT IN (SELECT column_name FROM source_cols);

-- Update the sync function to only use columns that exist in both tables
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
            company_id
            -- Excluded columns that don't exist in both tables:
            -- daysinthisprogramphase, todays_day_of_phase, yesterday_growth_index
            -- split_image_status, trend_petri_velocity, experiment_role
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

-- Now sync the missing records with the corrected column list
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
    po.company_id
FROM petri_observations po
WHERE NOT EXISTS (
    SELECT 1 FROM petri_observations_partitioned pp
    WHERE pp.observation_id = po.observation_id
)
AND po.program_id IS NOT NULL
ON CONFLICT (observation_id, program_id) DO NOTHING;

-- Final verification
DO $$
DECLARE
    source_count INTEGER;
    partitioned_count INTEGER;
    synced_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO source_count FROM petri_observations;
    SELECT COUNT(*) INTO partitioned_count FROM petri_observations_partitioned;
    
    SELECT COUNT(*) INTO synced_count
    FROM petri_observations po
    WHERE EXISTS (
        SELECT 1 FROM petri_observations_partitioned pp
        WHERE pp.observation_id = po.observation_id
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Petri sync completed successfully!';
    RAISE NOTICE '📊 Final counts:';
    RAISE NOTICE '  - Source records: %', source_count;
    RAISE NOTICE '  - Partitioned records: %', partitioned_count;
    RAISE NOTICE '  - Successfully synced: %', synced_count;
    
    IF synced_count = source_count THEN
        RAISE NOTICE '🎉 ALL PETRI RECORDS ARE NOW SYNCHRONIZED!';
        RAISE NOTICE '🔄 Future inserts will sync automatically via trigger.';
        RAISE NOTICE '📈 Your analytics should now show all petri data!';
    ELSE
        RAISE NOTICE '⚠️  % records still need attention', source_count - synced_count;
    END IF;
END $$;