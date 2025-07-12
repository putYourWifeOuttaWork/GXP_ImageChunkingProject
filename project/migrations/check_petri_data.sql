-- Check petri_observations data

-- 1. Check if table has any data
SELECT COUNT(*) as total_records FROM petri_observations;

-- 2. Check growth_index values
SELECT 
    MIN(growth_index) as min_growth_index,
    MAX(growth_index) as max_growth_index,
    AVG(growth_index) as avg_growth_index,
    COUNT(*) as total_with_growth_index,
    COUNT(CASE WHEN growth_index > 0 THEN 1 END) as count_greater_than_zero,
    COUNT(CASE WHEN growth_index IS NULL THEN 1 END) as null_count
FROM petri_observations;

-- 3. Sample data with growth_index
SELECT 
    observation_id,
    petri_code,
    growth_index,
    growth_index::text as growth_index_as_text,
    CASE 
        WHEN growth_index > 0 THEN 'Greater than 0'
        WHEN growth_index = 0 THEN 'Equal to 0'
        WHEN growth_index < 0 THEN 'Less than 0'
        ELSE 'NULL'
    END as growth_index_check
FROM petri_observations
LIMIT 10;

-- 4. Test the exact query being generated
SELECT 
    petri_observations.created_at as created_at, 
    AVG(petri_observations.growth_index) as "Growth Index", 
    AVG(petri_observations.outdoor_humidity) as "Outdoor Humidity" 
FROM petri_observations 
WHERE growth_index > 0 
GROUP BY 1 
ORDER BY 1;

-- 5. Test without filter
SELECT 
    petri_observations.created_at as created_at, 
    AVG(petri_observations.growth_index) as "Growth Index", 
    AVG(petri_observations.outdoor_humidity) as "Outdoor Humidity" 
FROM petri_observations 
GROUP BY 1 
ORDER BY 1
LIMIT 10;