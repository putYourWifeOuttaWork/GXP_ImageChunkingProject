-- Add forecasted_expiration column to gasifier_observations_partitioned

-- Step 1: Add the column
ALTER TABLE gasifier_observations_partitioned 
ADD COLUMN IF NOT EXISTS forecasted_expiration timestamp;

-- Step 2: Create function to calculate forecast
CREATE OR REPLACE FUNCTION calculate_forecast()
RETURNS TRIGGER AS $$
DECLARE
    remaining_material float4;
    days_to_expiration float4;
    hours_to_expiration float4;
BEGIN
    -- Calculate forecasted expiration
    IF NEW.flow_rate IS NOT NULL AND NEW.flow_rate > 0 AND NEW.linear_reading IS NOT NULL THEN
        -- Calculate remaining material (current reading)
        remaining_material := NEW.linear_reading;
        
        -- Calculate days until expiration (when material reaches 0)
        days_to_expiration := remaining_material / NEW.flow_rate;
        
        -- Convert fractional days to hours
        hours_to_expiration := days_to_expiration * 24;
        
        -- Add the interval to current timestamp
        NEW.forecasted_expiration := NEW.created_at + (hours_to_expiration || ' hours')::interval;
    ELSE
        NEW.forecasted_expiration := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger
DROP TRIGGER IF EXISTS gasifier_forecast_trigger ON gasifier_observations_partitioned CASCADE;

CREATE TRIGGER gasifier_forecast_trigger
    BEFORE INSERT OR UPDATE OF flow_rate, linear_reading ON gasifier_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_forecast();

-- Step 4: Update existing records
UPDATE gasifier_observations_partitioned
SET forecasted_expiration = CASE 
    WHEN flow_rate IS NOT NULL AND flow_rate > 0 AND linear_reading IS NOT NULL 
    THEN created_at + ((linear_reading / flow_rate * 24) || ' hours')::interval
    ELSE NULL
END
WHERE flow_rate IS NOT NULL;

-- Step 5: Verify with sample data
SELECT 
    gasifier_code,
    created_at,
    ROUND(linear_reading::numeric, 2) as reading,
    ROUND(flow_rate::numeric, 4) as flow_rate,
    forecasted_expiration,
    CASE 
        WHEN forecasted_expiration IS NOT NULL 
        THEN ROUND(EXTRACT(EPOCH FROM (forecasted_expiration - created_at)) / 86400.0, 1) || ' days'
        ELSE 'N/A'
    END as days_until_expiration
FROM gasifier_observations_partitioned
WHERE flow_rate IS NOT NULL
ORDER BY gasifier_code, created_at
LIMIT 20;

-- Step 6: Summary of forecasted expirations by gasifier
SELECT 
    gasifier_code,
    MIN(forecasted_expiration) as earliest_forecast,
    MAX(forecasted_expiration) as latest_forecast,
    ROUND(AVG(EXTRACT(EPOCH FROM (forecasted_expiration - created_at)) / 86400.0)::numeric, 1) as avg_days_to_expiration,
    CASE 
        WHEN AVG(EXTRACT(EPOCH FROM (forecasted_expiration - created_at)) / 86400.0) < 14 
        THEN 'Below 2-week target'
        WHEN AVG(EXTRACT(EPOCH FROM (forecasted_expiration - created_at)) / 86400.0) > 14 
        THEN 'Exceeds 2-week target'
        ELSE 'Meets 2-week target'
    END as performance
FROM gasifier_observations_partitioned
WHERE forecasted_expiration IS NOT NULL
GROUP BY gasifier_code
ORDER BY gasifier_code;