-- Manual sync of all petri_observations to petri_observations_partitioned
-- This ensures all existing data is properly synced and the trigger is working

BEGIN;

-- First, let's check the current state
DO $$
DECLARE
    source_count INTEGER;
    partitioned_count INTEGER;
    trigger_enabled BOOLEAN;
BEGIN
    -- Count records in source table
    SELECT COUNT(*) INTO source_count FROM petri_observations;
    
    -- Count records in partitioned table
    SELECT COUNT(*) INTO partitioned_count FROM petri_observations_partitioned;
    
    -- Check if trigger is enabled
    SELECT tgenabled = 'O' INTO trigger_enabled
    FROM pg_trigger 
    WHERE tgname = 'sync_petri_observations_trigger'
    AND tgrelid = 'petri_observations'::regclass;
    
    RAISE NOTICE 'Current state:';
    RAISE NOTICE '  - Records in petri_observations: %', source_count;
    RAISE NOTICE '  - Records in petri_observations_partitioned: %', partitioned_count;
    RAISE NOTICE '  - Records missing: %', source_count - partitioned_count;
    RAISE NOTICE '  - Sync trigger enabled: %', trigger_enabled;
END $$;

-- Ensure the trigger is enabled
ALTER TABLE petri_observations ENABLE TRIGGER sync_petri_observations_trigger;

-- Manual sync all records that have program_id
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
ON CONFLICT (observation_id, program_id) 
DO UPDATE SET
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

-- Also sync records where program_id might be NULL but can be derived from submission
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
    s.program_id, -- Get program_id from submission
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
JOIN submissions s ON po.submission_id = s.submission_id
WHERE po.program_id IS NULL
AND s.program_id IS NOT NULL
ON CONFLICT (observation_id, program_id) DO NOTHING;

-- Verify the sync worked
DO $$
DECLARE
    source_count INTEGER;
    partitioned_count INTEGER;
    synced_count INTEGER;
BEGIN
    -- Count records after sync
    SELECT COUNT(*) INTO source_count FROM petri_observations;
    SELECT COUNT(*) INTO partitioned_count FROM petri_observations_partitioned;
    
    -- Count how many records are properly synced
    SELECT COUNT(*) INTO synced_count
    FROM petri_observations po
    WHERE EXISTS (
        SELECT 1 FROM petri_observations_partitioned pp
        WHERE pp.observation_id = po.observation_id
    );
    
    RAISE NOTICE '';
    RAISE NOTICE 'Sync completed:';
    RAISE NOTICE '  - Records in petri_observations: %', source_count;
    RAISE NOTICE '  - Records in petri_observations_partitioned: %', partitioned_count;
    RAISE NOTICE '  - Records successfully synced: %', synced_count;
    RAISE NOTICE '  - Records still missing: %', source_count - synced_count;
    
    IF source_count - synced_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Some records could not be synced. Checking why...';
        
        -- Show sample of unsynced records
        FOR r IN 
            SELECT po.observation_id, po.submission_id, po.program_id, po.created_at
            FROM petri_observations po
            WHERE NOT EXISTS (
                SELECT 1 FROM petri_observations_partitioned pp
                WHERE pp.observation_id = po.observation_id
            )
            LIMIT 5
        LOOP
            RAISE NOTICE 'Unsynced: observation_id=%, submission_id=%, program_id=%, created_at=%',
                r.observation_id, r.submission_id, r.program_id, r.created_at;
        END LOOP;
    END IF;
END $$;

-- Ensure trigger remains enabled for future syncs
ALTER TABLE petri_observations ENABLE ALWAYS TRIGGER sync_petri_observations_trigger;

-- Show trigger status
SELECT 
    tgname as trigger_name,
    CASE tgenabled 
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA ONLY'
        WHEN 'A' THEN 'ALWAYS'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger
WHERE tgname = 'sync_petri_observations_trigger'
AND tgrelid = 'petri_observations'::regclass;

COMMIT;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Manual sync of petri_observations completed!';
    RAISE NOTICE '📝 All existing records have been synced to the partitioned table.';
    RAISE NOTICE '🔄 The sync trigger is ENABLED for future inserts/updates.';
    RAISE NOTICE '🎯 Your analytics should now show all petri data!';
END $$;