-- Fix created_at timestamp preservation in sync process
-- The issue: created_at has DEFAULT now() on partitioned table, 
-- so inserts without explicit created_at use current timestamp

-- IMPORTANT: This migration fixes the sync process to explicitly preserve created_at timestamps
-- from source tables when syncing to partitioned tables. Without this, all synced records
-- would get the current timestamp instead of their original creation date.

-- First, let's verify the issue
DO $$
DECLARE
    v_test_count INTEGER;
BEGIN
    -- Count records where created_at differs between tables
    SELECT COUNT(*)
    INTO v_test_count
    FROM petri_observations po
    JOIN petri_observations_partitioned pp ON po.observation_id = pp.observation_id
    WHERE DATE(po.created_at) != DATE(pp.created_at);
    
    RAISE NOTICE 'Found % records with mismatched created_at dates', v_test_count;
END $$;

-- Drop and recreate the sync function to ensure created_at is explicitly handled
CREATE OR REPLACE FUNCTION sync_petri_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert with explicit created_at to override the DEFAULT
        INSERT INTO petri_observations_partitioned (
            observation_id,
            submission_id,
            site_id,
            petri_code,
            image_url,
            fungicide_used,
            surrounding_water_schedule,
            notes,
            created_at,  -- Explicitly set to preserve original timestamp
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
        VALUES (
            NEW.observation_id,
            NEW.submission_id,
            NEW.site_id,
            NEW.petri_code,
            NEW.image_url,
            NEW.fungicide_used,
            NEW.surrounding_water_schedule,
            NEW.notes,
            NEW.created_at,  -- Use the original created_at from source
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
            -- Do NOT update created_at on conflict - preserve original
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
            -- Never update created_at on UPDATE
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

-- Now fix all existing records with wrong created_at
UPDATE petri_observations_partitioned pp
SET created_at = po.created_at
FROM petri_observations po
WHERE pp.observation_id = po.observation_id
  AND DATE(pp.created_at) != DATE(po.created_at);

-- Verify the fix
DO $$
DECLARE
    v_fixed_count INTEGER;
    v_remaining_issues INTEGER;
BEGIN
    -- Count how many we fixed
    GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
    
    -- Check if any issues remain
    SELECT COUNT(*)
    INTO v_remaining_issues
    FROM petri_observations po
    JOIN petri_observations_partitioned pp ON po.observation_id = pp.observation_id
    WHERE DATE(po.created_at) != DATE(pp.created_at);
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Fixed % records with incorrect created_at timestamps', v_fixed_count;
    RAISE NOTICE '📊 Remaining issues: %', v_remaining_issues;
    
    IF v_remaining_issues = 0 THEN
        RAISE NOTICE '🎉 All created_at timestamps are now correctly synchronized!';
    ELSE
        RAISE WARNING '⚠️  There are still % records with mismatched timestamps', v_remaining_issues;
    END IF;
END $$;

-- Sample verification query to check a few records
SELECT 
    'Sample verification' as check_type,
    po.observation_id,
    po.created_at as source_created_at,
    pp.created_at as partitioned_created_at,
    po.created_at = pp.created_at as timestamps_match
FROM petri_observations po
JOIN petri_observations_partitioned pp ON po.observation_id = pp.observation_id
ORDER BY po.created_at DESC
LIMIT 10;