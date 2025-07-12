-- Quick Data Migration to Partitioned Tables
-- This script migrates data from original tables to partitioned tables
-- It adds the required program_id and site_id columns by joining with submissions and sites

-- First, check current data counts
SELECT 'Before Migration' as status,
       'petri_observations' as table_name, 
       COUNT(*) as row_count 
FROM petri_observations
UNION ALL
SELECT 'Before Migration' as status,
       'petri_observations_partitioned' as table_name, 
       COUNT(*) as row_count 
FROM petri_observations_partitioned
UNION ALL
SELECT 'Before Migration' as status,
       'gasifier_observations' as table_name, 
       COUNT(*) as row_count 
FROM gasifier_observations
UNION ALL
SELECT 'Before Migration' as status,
       'gasifier_observations_partitioned' as table_name, 
       COUNT(*) as row_count 
FROM gasifier_observations_partitioned;

-- Migrate petri_observations data
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
ON CONFLICT (observation_id, program_id) DO NOTHING;

-- Migrate gasifier_observations data
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
ON CONFLICT (observation_id, program_id) DO NOTHING;

-- Check results after migration
SELECT 'After Migration' as status,
       'petri_observations' as table_name, 
       COUNT(*) as row_count 
FROM petri_observations
UNION ALL
SELECT 'After Migration' as status,
       'petri_observations_partitioned' as table_name, 
       COUNT(*) as row_count 
FROM petri_observations_partitioned
UNION ALL
SELECT 'After Migration' as status,
       'gasifier_observations' as table_name, 
       COUNT(*) as row_count 
FROM gasifier_observations
UNION ALL
SELECT 'After Migration' as status,
       'gasifier_observations_partitioned' as table_name, 
       COUNT(*) as row_count 
FROM gasifier_observations_partitioned;

-- Show sample data from partitioned tables
SELECT 'Sample petri_observations_partitioned' as description, * 
FROM petri_observations_partitioned 
LIMIT 3;

SELECT 'Sample gasifier_observations_partitioned' as description, * 
FROM gasifier_observations_partitioned 
LIMIT 3;