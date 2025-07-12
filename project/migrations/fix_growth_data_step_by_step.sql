-- Fix Growth Data Step by Step (avoiding function conflicts)
-- ===========================================================

-- First, drop any existing functions and triggers to avoid conflicts
DROP TRIGGER IF EXISTS auto_calculate_growth_progression ON petri_observations;
DROP TRIGGER IF EXISTS auto_calculate_growth_progression ON petri_observations_partitioned;
DROP FUNCTION IF EXISTS update_growth_progression_trigger();
DROP FUNCTION IF EXISTS update_growth_progression_partitioned_trigger();
DROP FUNCTION IF EXISTS calculate_growth_progression(TEXT, UUID, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS calculate_growth_progression(TEXT, UUID, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS calculate_growth_progression(VARCHAR, UUID, NUMERIC, NUMERIC);

-- Step 1: Copy ALL growth_progression values to growth_index
UPDATE petri_observations
SET growth_index = growth_progression;

UPDATE petri_observations_partitioned
SET growth_index = growth_progression;

-- Show results
SELECT 
    'Original Table' as table_name,
    COUNT(*) as total_rows,
    COUNT(growth_index) as rows_with_growth_index,
    COUNT(growth_progression) as rows_with_growth_progression
FROM petri_observations
UNION ALL
SELECT 
    'Partitioned Table' as table_name,
    COUNT(*) as total_rows,
    COUNT(growth_index) as rows_with_growth_index,
    COUNT(growth_progression) as rows_with_growth_progression
FROM petri_observations_partitioned;

-- Step 2: Calculate growth_progression for petri_observations
WITH daily_growth AS (
    SELECT 
        p1.observation_id,
        p1.petri_code,
        p1.program_id,
        p1.todays_day_of_phase,
        p1.growth_index as current_growth,
        p2.growth_index as previous_growth,
        CASE 
            WHEN p1.todays_day_of_phase = 1 THEN 0
            WHEN p1.todays_day_of_phase IS NULL THEN 0
            WHEN p2.growth_index IS NULL THEN 0
            ELSE COALESCE(p1.growth_index, 0) - COALESCE(p2.growth_index, 0)
        END as calculated_progression
    FROM petri_observations p1
    LEFT JOIN petri_observations p2 
        ON p1.petri_code = p2.petri_code 
        AND p1.program_id = p2.program_id 
        AND p2.todays_day_of_phase = (p1.todays_day_of_phase - 1)
)
UPDATE petri_observations po
SET growth_progression = dg.calculated_progression
FROM daily_growth dg
WHERE po.observation_id = dg.observation_id;

-- Step 3: Calculate growth_progression for petri_observations_partitioned
WITH daily_growth AS (
    SELECT 
        p1.observation_id,
        p1.program_id,
        p1.petri_code,
        p1.todays_day_of_phase,
        p1.growth_index as current_growth,
        p2.growth_index as previous_growth,
        CASE 
            WHEN p1.todays_day_of_phase = 1 THEN 0
            WHEN p1.todays_day_of_phase IS NULL THEN 0
            WHEN p2.growth_index IS NULL THEN 0
            ELSE COALESCE(p1.growth_index, 0) - COALESCE(p2.growth_index, 0)
        END as calculated_progression
    FROM petri_observations_partitioned p1
    LEFT JOIN petri_observations_partitioned p2 
        ON p1.petri_code = p2.petri_code 
        AND p1.program_id = p2.program_id 
        AND p2.todays_day_of_phase = (p1.todays_day_of_phase - 1)
)
UPDATE petri_observations_partitioned po
SET growth_progression = dg.calculated_progression
FROM daily_growth dg
WHERE po.observation_id = dg.observation_id
  AND po.program_id = dg.program_id;

-- Step 4: Verify the results
SELECT 
    'Verification - Original Table' as info,
    petri_code,
    program_id,
    todays_day_of_phase,
    growth_index,
    growth_progression,
    CASE 
        WHEN todays_day_of_phase = 1 THEN 'First Day (should be 0)'
        WHEN growth_progression = 0 THEN 'No growth or missing previous'
        WHEN growth_progression > 0 THEN 'Positive growth'
        ELSE 'Negative growth'
    END as status
FROM petri_observations
WHERE growth_index IS NOT NULL
ORDER BY program_id, petri_code, todays_day_of_phase
LIMIT 10;

SELECT 
    'Verification - Partitioned Table' as info,
    petri_code,
    program_id,
    todays_day_of_phase,
    growth_index,
    growth_progression,
    CASE 
        WHEN todays_day_of_phase = 1 THEN 'First Day (should be 0)'
        WHEN growth_progression = 0 THEN 'No growth or missing previous'
        WHEN growth_progression > 0 THEN 'Positive growth'
        ELSE 'Negative growth'
    END as status
FROM petri_observations_partitioned
WHERE growth_index IS NOT NULL
ORDER BY program_id, petri_code, todays_day_of_phase
LIMIT 10;

-- Final statistics
SELECT 
    'Original Table Stats' as table_name,
    COUNT(*) as total_rows,
    COUNT(growth_index) as rows_with_growth_index,
    COUNT(growth_progression) as rows_with_growth_progression,
    AVG(growth_progression) as avg_daily_growth,
    MAX(growth_progression) as max_daily_growth,
    MIN(growth_progression) as min_daily_growth
FROM petri_observations
WHERE growth_index IS NOT NULL
UNION ALL
SELECT 
    'Partitioned Table Stats' as table_name,
    COUNT(*) as total_rows,
    COUNT(growth_index) as rows_with_growth_index,
    COUNT(growth_progression) as rows_with_growth_progression,
    AVG(growth_progression) as avg_daily_growth,
    MAX(growth_progression) as max_daily_growth,
    MIN(growth_progression) as min_daily_growth
FROM petri_observations_partitioned
WHERE growth_index IS NOT NULL;