-- Growth velocity calculation for petri_observations_partitioned
-- Formula: growth_velocity = (current_growth_index - previous_growth_index) / days_between_observations
-- Bucketed by petri_code and program_id

-- Step 1: Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS petri_growth_velocity_trigger ON petri_observations_partitioned CASCADE;
DROP FUNCTION IF EXISTS calculate_growth_velocity() CASCADE;

-- Step 2: Create function to calculate growth velocity
CREATE OR REPLACE FUNCTION calculate_growth_velocity()
RETURNS TRIGGER AS $$
DECLARE
    prev_growth_index numeric;
    prev_observation_date date;
    days_between numeric;
    growth_change numeric;
BEGIN
    -- Only calculate if we have growth_index
    IF NEW.growth_index IS NULL THEN
        NEW.growth_velocity := NULL;
        RETURN NEW;
    END IF;
    
    -- Find the previous observation for this petri
    SELECT 
        growth_index,
        created_at::date
    INTO 
        prev_growth_index,
        prev_observation_date
    FROM petri_observations_partitioned
    WHERE petri_code = NEW.petri_code 
    AND program_id = NEW.program_id
    AND created_at < NEW.created_at
    AND growth_index IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no previous observation, this is the first one
    IF prev_growth_index IS NULL THEN
        -- First observation has velocity of growth_index/1 day
        NEW.growth_velocity := NEW.growth_index;
        RETURN NEW;
    END IF;
    
    -- Calculate days between observations (minimum 1 day)
    days_between := GREATEST(1, (NEW.created_at::date - prev_observation_date));
    
    -- Calculate growth change
    growth_change := NEW.growth_index - prev_growth_index;
    
    -- Calculate velocity: change per day
    NEW.growth_velocity := growth_change / days_between;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger
CREATE TRIGGER petri_growth_velocity_trigger
    BEFORE INSERT OR UPDATE OF growth_index ON petri_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_growth_velocity();

-- Step 4: Update existing records with growth velocity
WITH velocity_calc AS (
    SELECT 
        observation_id,
        petri_code,
        program_id,
        created_at,
        growth_index,
        LAG(growth_index) OVER (
            PARTITION BY petri_code, program_id 
            ORDER BY created_at
        ) as prev_growth_index,
        LAG(created_at::date) OVER (
            PARTITION BY petri_code, program_id 
            ORDER BY created_at
        ) as prev_date
    FROM petri_observations_partitioned
    WHERE growth_index IS NOT NULL
)
UPDATE petri_observations_partitioned AS p
SET growth_velocity = 
    CASE 
        WHEN vc.prev_growth_index IS NULL THEN vc.growth_index  -- First observation
        ELSE (vc.growth_index - vc.prev_growth_index) / 
             GREATEST(1, (vc.created_at::date - vc.prev_date))
    END
FROM velocity_calc vc
WHERE p.observation_id = vc.observation_id
AND p.growth_index IS NOT NULL;

-- Step 5: Verify the calculation with sample data
SELECT 
    petri_code,
    created_at::date as observation_date,
    growth_index,
    growth_velocity,
    ROUND(growth_velocity::numeric, 4) as velocity_rounded,
    CASE 
        WHEN growth_velocity > 5 THEN 'Rapid growth'
        WHEN growth_velocity > 2 THEN 'Strong growth'
        WHEN growth_velocity > 0 THEN 'Positive growth'
        WHEN growth_velocity = 0 THEN 'No change'
        WHEN growth_velocity > -2 THEN 'Slight decline'
        ELSE 'Significant decline'
    END as growth_status
FROM petri_observations_partitioned
WHERE growth_index IS NOT NULL
ORDER BY petri_code, created_at
LIMIT 30;

-- Step 6: Summary statistics by petri
SELECT 
    petri_code,
    COUNT(*) as observation_count,
    ROUND(AVG(growth_velocity)::numeric, 4) as avg_velocity,
    ROUND(MIN(growth_velocity)::numeric, 4) as min_velocity,
    ROUND(MAX(growth_velocity)::numeric, 4) as max_velocity,
    ROUND(STDDEV(growth_velocity)::numeric, 4) as velocity_stddev,
    CASE 
        WHEN AVG(growth_velocity) > 2 THEN 'High growth rate'
        WHEN AVG(growth_velocity) > 0 THEN 'Positive growth rate'
        WHEN AVG(growth_velocity) = 0 THEN 'Stable'
        ELSE 'Declining'
    END as overall_trend
FROM petri_observations_partitioned
WHERE growth_velocity IS NOT NULL
GROUP BY petri_code
ORDER BY petri_code;

-- Step 7: Check for any NULL velocities that should have values
SELECT 
    petri_code,
    COUNT(*) as null_velocity_count
FROM petri_observations_partitioned
WHERE growth_index IS NOT NULL
AND growth_velocity IS NULL
GROUP BY petri_code
HAVING COUNT(*) > 0;