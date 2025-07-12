-- Check current state of growth data
SELECT 
    'Growth Data Summary' as info,
    COUNT(*) as total_rows,
    COUNT(growth_index) as rows_with_growth_index,
    COUNT(CASE WHEN growth_index = 0 THEN 1 END) as zero_growth_index,
    COUNT(CASE WHEN growth_index > 0 THEN 1 END) as positive_growth_index,
    MIN(growth_index) as min_growth,
    MAX(growth_index) as max_growth,
    AVG(growth_index) as avg_growth
FROM petri_observations_partitioned;

-- Sample data
SELECT 
    'Sample Data' as info,
    observation_id,
    petri_code,
    program_id,
    todays_day_of_phase,
    growth_index,
    growth_progression
FROM petri_observations_partitioned
WHERE growth_index IS NOT NULL
ORDER BY program_id, petri_code, todays_day_of_phase
LIMIT 20;

-- Check if we have any non-zero growth_index values
SELECT DISTINCT growth_index
FROM petri_observations_partitioned
WHERE growth_index != 0
ORDER BY growth_index
LIMIT 10;