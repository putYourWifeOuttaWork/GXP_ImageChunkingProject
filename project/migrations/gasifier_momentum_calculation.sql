-- Momentum calculation: Change in flow_rate between consecutive observations
-- Formula: momentum = current_flow_rate - previous_flow_rate
-- Positive = accelerating consumption, Negative = decelerating consumption

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS gasifier_momentum_trigger ON gasifier_observations_partitioned CASCADE;
DROP FUNCTION IF EXISTS calculate_momentum() CASCADE;

-- Create the momentum calculation function
CREATE OR REPLACE FUNCTION calculate_momentum()
RETURNS TRIGGER AS $$
DECLARE
    prev_flow_rate float4;
BEGIN
    -- Only calculate if we have flow_rate
    IF NEW.flow_rate IS NULL THEN
        NEW.linear_reduction_per_day := NULL;
        RETURN NEW;
    END IF;
    
    -- Find the previous flow_rate for this gasifier
    SELECT flow_rate INTO prev_flow_rate
    FROM gasifier_observations_partitioned
    WHERE gasifier_code = NEW.gasifier_code 
    AND program_id = NEW.program_id
    AND created_at < NEW.created_at
    AND flow_rate IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Calculate momentum (change in flow_rate)
    IF prev_flow_rate IS NOT NULL THEN
        NEW.linear_reduction_per_day := NEW.flow_rate - prev_flow_rate;
    ELSE
        -- First observation has no previous, so momentum is 0
        NEW.linear_reduction_per_day := 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate momentum
CREATE TRIGGER gasifier_momentum_trigger
    BEFORE INSERT OR UPDATE OF flow_rate ON gasifier_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_momentum();

-- Update existing records with momentum
WITH momentum_calc AS (
    SELECT 
        observation_id,
        gasifier_code,
        program_id,
        created_at,
        flow_rate,
        LAG(flow_rate) OVER (
            PARTITION BY gasifier_code, program_id 
            ORDER BY created_at
        ) as prev_flow_rate
    FROM gasifier_observations_partitioned
    WHERE flow_rate IS NOT NULL
)
UPDATE gasifier_observations_partitioned AS g
SET linear_reduction_per_day = 
    CASE 
        WHEN mc.prev_flow_rate IS NULL THEN 0  -- First observation
        ELSE mc.flow_rate - mc.prev_flow_rate  -- Change in flow_rate
    END
FROM momentum_calc mc
WHERE g.observation_id = mc.observation_id
AND g.flow_rate IS NOT NULL;

-- Verify the calculation with sample data
SELECT 
    gasifier_code,
    created_at::date as observation_date,
    ROUND(linear_reading::numeric, 2) as linear_reading,
    ROUND(flow_rate::numeric, 4) as flow_rate,
    ROUND(linear_reduction_per_day::numeric, 4) as momentum,
    CASE 
        WHEN linear_reduction_per_day > 0 THEN 'Accelerating ↑'
        WHEN linear_reduction_per_day < 0 THEN 'Decelerating ↓'
        WHEN linear_reduction_per_day = 0 THEN 'Steady →'
        ELSE 'No data'
    END as momentum_direction
FROM gasifier_observations_partitioned
WHERE flow_rate IS NOT NULL
ORDER BY gasifier_code, created_at
LIMIT 30;

-- Summary statistics for momentum by gasifier
SELECT 
    gasifier_code,
    COUNT(*) as observation_count,
    ROUND(AVG(linear_reduction_per_day)::numeric, 4) as avg_momentum,
    ROUND(MIN(linear_reduction_per_day)::numeric, 4) as max_deceleration,
    ROUND(MAX(linear_reduction_per_day)::numeric, 4) as max_acceleration,
    CASE 
        WHEN AVG(linear_reduction_per_day) > 0 THEN 'Overall accelerating'
        WHEN AVG(linear_reduction_per_day) < 0 THEN 'Overall decelerating'
        ELSE 'Overall steady'
    END as trend
FROM gasifier_observations_partitioned
WHERE linear_reduction_per_day IS NOT NULL
GROUP BY gasifier_code
ORDER BY gasifier_code;