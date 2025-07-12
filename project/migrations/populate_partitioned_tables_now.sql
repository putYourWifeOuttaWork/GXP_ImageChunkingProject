-- CRITICAL: Populate Partitioned Tables for Analytics
-- This should have been done when partitioned tables were created!
-- ===================================================================

-- Check current state
SELECT 'BEFORE MIGRATION' as status, 'petri_observations' as table_name, COUNT(*) as row_count FROM petri_observations
UNION ALL
SELECT 'BEFORE MIGRATION', 'petri_observations_partitioned', COUNT(*) FROM petri_observations_partitioned
UNION ALL  
SELECT 'BEFORE MIGRATION', 'gasifier_observations', COUNT(*) FROM gasifier_observations
UNION ALL
SELECT 'BEFORE MIGRATION', 'gasifier_observations_partitioned', COUNT(*) FROM gasifier_observations_partitioned;

-- Migrate petri_observations (excluding daysInThisProgramPhase which doesn't exist in partitioned)
INSERT INTO petri_observations_partitioned (
    observation_id,
    submission_id,
    program_id,
    site_id,
    petri_code,
    fungicide_used,
    growth_progression,
    growth_aggression,
    growth_velocity,
    petri_growth_stage,
    placement,
    outdoor_temperature,
    outdoor_humidity,
    todays_day_of_phase,
    x_position,
    y_position,
    created_at,
    updated_at,
    observation_date,
    image_url,
    growth_index
)
SELECT 
    po.observation_id,
    po.submission_id,
    s.pilot_program_id as program_id,
    s.site_id,
    po.petri_code,
    po.fungicide_used,
    po.growth_progression,
    po.growth_aggression,
    po.growth_velocity,
    po.petri_growth_stage,
    po.placement,
    po.outdoor_temperature,
    po.outdoor_humidity,
    po.todays_day_of_phase,
    po.x_position,
    po.y_position,
    po.created_at,
    po.updated_at,
    po.observation_date,
    po.image_url,
    po.growth_index
FROM petri_observations po
INNER JOIN submissions s ON po.submission_id = s.submission_id
WHERE s.pilot_program_id IS NOT NULL 
  AND s.site_id IS NOT NULL
ON CONFLICT (observation_id, program_id) DO UPDATE SET
    growth_progression = EXCLUDED.growth_progression,
    growth_index = EXCLUDED.growth_index,
    updated_at = EXCLUDED.updated_at;

-- Migrate gasifier_observations
INSERT INTO gasifier_observations_partitioned (
    observation_id,
    submission_id,
    program_id,
    site_id,
    gasifier_code,
    chemical_type,
    linear_reading,
    average_reading,
    growth_progression,
    measure,
    outdoor_temperature,
    outdoor_humidity,
    todays_day_of_phase,
    position_x,
    position_y,
    created_at,
    updated_at,
    image_url
)
SELECT 
    go.observation_id,
    go.submission_id,
    s.pilot_program_id as program_id,
    s.site_id,
    go.gasifier_code,
    go.chemical_type,
    go.linear_reading,
    go.average_reading,
    go.growth_progression,
    go.measure,
    go.outdoor_temperature,
    go.outdoor_humidity,
    go.todays_day_of_phase,
    go.position_x,
    go.position_y,
    go.created_at,
    go.updated_at,
    go.image_url
FROM gasifier_observations go
INNER JOIN submissions s ON go.submission_id = s.submission_id
WHERE s.pilot_program_id IS NOT NULL 
  AND s.site_id IS NOT NULL
ON CONFLICT (observation_id, program_id) DO UPDATE SET
    growth_progression = EXCLUDED.growth_progression,
    updated_at = EXCLUDED.updated_at;

-- Verify migration
SELECT 'AFTER MIGRATION' as status, 'petri_observations' as table_name, COUNT(*) as row_count FROM petri_observations
UNION ALL
SELECT 'AFTER MIGRATION', 'petri_observations_partitioned', COUNT(*) FROM petri_observations_partitioned
UNION ALL  
SELECT 'AFTER MIGRATION', 'gasifier_observations', COUNT(*) FROM gasifier_observations
UNION ALL
SELECT 'AFTER MIGRATION', 'gasifier_observations_partitioned', COUNT(*) FROM gasifier_observations_partitioned;

-- Show sample data
SELECT 'Sample petri_observations_partitioned' as info, * FROM petri_observations_partitioned LIMIT 5;

-- Analyze tables for query optimization
ANALYZE petri_observations_partitioned;
ANALYZE gasifier_observations_partitioned;