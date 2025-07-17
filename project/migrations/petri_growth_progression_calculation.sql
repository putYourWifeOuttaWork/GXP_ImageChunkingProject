-- Growth progression calculation for petri_observations_partitioned
-- Formula: growth_progression = current_growth_index - previous_growth_index
-- Bucketed by petri_code and program_id

-- Step 1: Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS petri_growth_progression_trigger ON petri_observations_partitioned CASCADE;
DROP FUNCTION IF EXISTS calculate_growth_progression() CASCADE;

-- Step 2: Create function to calculate growth progression (delta)
CREATE OR REPLACE FUNCTION calculate_growth_progression()
RETURNS TRIGGER AS $$
DECLARE
    prev_growth_index numeric;
BEGIN
    -- Only calculate if we have growth_index
    IF NEW.growth_index IS NULL THEN
        NEW.growth_progression := NULL;
        RETURN NEW;
    END IF;
    
    -- Find the previous growth_index for this petri
    SELECT growth_index INTO prev_growth_index
    FROM petri_observations_partitioned
    WHERE petri_code = NEW.petri_code 
    AND program_id = NEW.program_id
    AND created_at < NEW.created_at
    AND growth_index IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Calculate delta
    IF prev_growth_index IS NOT NULL THEN
        -- Delta = current - previous
        NEW.growth_progression := NEW.growth_index - prev_growth_index;
    ELSE
        -- First observation, delta equals the growth_index itself
        NEW.growth_progression := NEW.growth_index;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger
CREATE TRIGGER petri_growth_progression_trigger
    BEFORE INSERT OR UPDATE OF growth_index ON petri_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_growth_progression();

-- Step 4: Update existing records with growth progression
WITH progression_calc AS (
    SELECT 
        observation_id,
        petri_code,
        program_id,
        created_at,
        growth_index,
        LAG(growth_index) OVER (
            PARTITION BY petri_code, program_id 
            ORDER BY created_at
        ) as prev_growth_index
    FROM petri_observations_partitioned
    WHERE growth_index IS NOT NULL
)
UPDATE petri_observations_partitioned AS p
SET growth_progression = 
    CASE 
        WHEN pc.prev_growth_index IS NULL THEN pc.growth_index  -- First observation
        ELSE pc.growth_index - pc.prev_growth_index            -- Delta calculation
    END
FROM progression_calc pc
WHERE p.observation_id = pc.observation_id
AND p.growth_index IS NOT NULL;

-- Step 5: Verify the calculation with sample data
SELECT 
    petri_code,
    created_at::date as observation_date,
    growth_index,
    growth_progression,
    ROUND(growth_progression::numeric, 4) as progression_rounded,
    growth_velocity,
    CASE 
        WHEN growth_progression > 10 THEN 'Major increase'
        WHEN growth_progression > 5 THEN 'Significant increase'
        WHEN growth_progression > 1 THEN 'Moderate increase'
        WHEN growth_progression > 0 THEN 'Slight increase'
        WHEN growth_progression = 0 THEN 'No change'
        WHEN growth_progression > -5 THEN 'Slight decrease'
        ELSE 'Significant decrease'
    END as progression_category
FROM petri_observations_partitioned
WHERE growth_index IS NOT NULL
ORDER BY petri_code, created_at
LIMIT 30;

-- Step 6: Summary statistics by petri
SELECT 
    petri_code,
    COUNT(*) as observation_count,
    ROUND(AVG(growth_progression)::numeric, 4) as avg_progression,
    ROUND(MIN(growth_progression)::numeric, 4) as min_progression,
    ROUND(MAX(growth_progression)::numeric, 4) as max_progression,
    ROUND(SUM(growth_progression)::numeric, 4) as total_progression,
    ROUND(growth_index::numeric, 4) as final_growth_index
FROM (
    SELECT DISTINCT ON (petri_code, program_id)
        petri_code,
        program_id,
        growth_index,
        growth_progression
    FROM petri_observations_partitioned
    WHERE growth_index IS NOT NULL
    ORDER BY petri_code, program_id, created_at DESC
) latest
JOIN (
    SELECT 
        petri_code,
        program_id,
        AVG(growth_progression) as avg_progression,
        MIN(growth_progression) as min_progression,
        MAX(growth_progression) as max_progression,
        SUM(growth_progression) as total_progression,
        COUNT(*) as observation_count
    FROM petri_observations_partitioned
    WHERE growth_progression IS NOT NULL
    GROUP BY petri_code, program_id
) stats USING (petri_code, program_id)
GROUP BY petri_code, growth_index, avg_progression, min_progression, max_progression, total_progression, observation_count
ORDER BY petri_code;

-- Step 7: Check relationship between progression and velocity
SELECT 
    petri_code,
    ROUND(AVG(growth_progression)::numeric, 2) as avg_daily_progression,
    ROUND(AVG(growth_velocity)::numeric, 2) as avg_velocity,
    CASE 
        WHEN AVG(growth_progression) > 0 AND AVG(growth_velocity) > 0 THEN 'Consistent growth'
        WHEN AVG(growth_progression) < 0 AND AVG(growth_velocity) < 0 THEN 'Consistent decline'
        WHEN AVG(growth_progression) = 0 AND AVG(growth_velocity) = 0 THEN 'Stagnant'
        ELSE 'Inconsistent pattern'
    END as growth_pattern
FROM petri_observations_partitioned
WHERE growth_progression IS NOT NULL 
AND growth_velocity IS NOT NULL
GROUP BY petri_code
ORDER BY petri_code;