-- Flow rate calculation based on total reduction from 15cm
-- Formula: flow_rate = (15 - linear_reading) / days_elapsed
-- Target benchmark: 1.0714 cm/day for 2-week bag life

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS gasifier_flow_rate_trigger ON gasifier_observations_partitioned CASCADE;
DROP FUNCTION IF EXISTS calculate_flow_rate() CASCADE;

-- Create the flow rate calculation function
CREATE OR REPLACE FUNCTION calculate_flow_rate()
RETURNS TRIGGER AS $$
DECLARE
    first_observation_date date;
    days_elapsed integer;
    theoretical_max float4 := 15.0;  -- Starting height of 15cm
BEGIN
    -- Only calculate if we have linear_reading
    IF NEW.linear_reading IS NULL THEN
        NEW.flow_rate := NULL;
        RETURN NEW;
    END IF;
    
    -- Find the date of the first observation for this gasifier
    SELECT MIN(created_at)::date INTO first_observation_date
    FROM gasifier_observations_partitioned
    WHERE gasifier_code = NEW.gasifier_code 
    AND program_id = NEW.program_id
    AND created_at <= NEW.created_at;
    
    -- Calculate days elapsed (minimum 1 day for day 0)
    days_elapsed := GREATEST(1, (NEW.created_at::date - first_observation_date) + 1);
    
    -- Calculate flow rate: (15 - linear_reading) / days_elapsed
    NEW.flow_rate := (theoretical_max - NEW.linear_reading) / days_elapsed::float4;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate flow rate
CREATE TRIGGER gasifier_flow_rate_trigger
    BEFORE INSERT OR UPDATE OF linear_reading ON gasifier_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_flow_rate();

-- Update existing records with flow rate
UPDATE gasifier_observations_partitioned AS g1
SET flow_rate = (
    CASE 
        WHEN g1.linear_reading IS NULL THEN NULL
        ELSE (15.0 - g1.linear_reading) / 
             GREATEST(1, (g1.created_at::date - (
                 SELECT MIN(g2.created_at)::date 
                 FROM gasifier_observations_partitioned g2 
                 WHERE g2.gasifier_code = g1.gasifier_code 
                 AND g2.program_id = g1.program_id
                 AND g2.created_at <= g1.created_at
             )) + 1)::float4
    END
)
WHERE g1.linear_reading IS NOT NULL;

-- Verify the calculation with sample data
SELECT 
    gasifier_code,
    created_at::date as observation_date,
    measure,
    linear_reading,
    linear_reduction_nominal,
    (created_at::date - MIN(created_at::date) OVER (PARTITION BY gasifier_code, program_id)) + 1 as days_elapsed,
    ROUND((15.0 - linear_reading)::numeric, 2) as total_reduction,
    flow_rate,
    ROUND(flow_rate::numeric, 4) as flow_rate_rounded
FROM gasifier_observations_partitioned
WHERE linear_reading IS NOT NULL
ORDER BY gasifier_code, created_at
LIMIT 20;

-- Check average flow rates against benchmark (1.0714 cm/day target)
SELECT 
    gasifier_code,
    COUNT(*) as observation_count,
    ROUND(AVG(flow_rate)::numeric, 4) as avg_flow_rate,
    ROUND(MIN(flow_rate)::numeric, 4) as min_flow_rate,
    ROUND(MAX(flow_rate)::numeric, 4) as max_flow_rate,
    CASE 
        WHEN AVG(flow_rate) < 1.0714 THEN 'Below target (good - longer bag life)'
        WHEN AVG(flow_rate) > 1.0714 THEN 'Above target (shorter bag life)'
        ELSE 'At target'
    END as performance_vs_benchmark
FROM gasifier_observations_partitioned
WHERE flow_rate IS NOT NULL
GROUP BY gasifier_code
ORDER BY gasifier_code;