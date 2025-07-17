-- Add trend and forecasted_expiration columns to gasifier_observations_partitioned

-- Step 1: Add the new columns
ALTER TABLE gasifier_observations_partitioned 
ADD COLUMN IF NOT EXISTS trend varchar(50),
ADD COLUMN IF NOT EXISTS forecasted_expiration timestamp;

-- Step 2: Create function to calculate trend and forecast
CREATE OR REPLACE FUNCTION calculate_trend_and_forecast()
RETURNS TRIGGER AS $$
DECLARE
    remaining_material float4;
    days_to_expiration float4;
    hours_to_expiration float4;
    trend_description varchar(50);
BEGIN
    -- Calculate trend based on momentum (linear_reduction_per_day)
    IF NEW.linear_reduction_per_day IS NULL THEN
        trend_description := 'No data';
    ELSIF NEW.linear_reduction_per_day > 1.0 THEN
        trend_description := 'Rapidly accelerating ⬆️⬆️';
    ELSIF NEW.linear_reduction_per_day > 0.5 THEN
        trend_description := 'Accelerating ⬆️';
    ELSIF NEW.linear_reduction_per_day > 0.1 THEN
        trend_description := 'Slightly accelerating ↗️';
    ELSIF NEW.linear_reduction_per_day > -0.1 THEN
        trend_description := 'Steady →';
    ELSIF NEW.linear_reduction_per_day > -0.5 THEN
        trend_description := 'Slightly decelerating ↘️';
    ELSIF NEW.linear_reduction_per_day > -1.0 THEN
        trend_description := 'Decelerating ⬇️';
    ELSE
        trend_description := 'Rapidly decelerating ⬇️⬇️';
    END IF;
    
    -- Add flow rate context to trend
    IF NEW.flow_rate IS NOT NULL THEN
        IF NEW.flow_rate > 1.0714 * 2 THEN
            trend_description := trend_description || ' (Critical)';
        ELSIF NEW.flow_rate > 1.0714 * 1.5 THEN
            trend_description := trend_description || ' (High)';
        ELSIF NEW.flow_rate > 1.0714 THEN
            trend_description := trend_description || ' (Above target)';
        ELSIF NEW.flow_rate > 1.0714 * 0.5 THEN
            trend_description := trend_description || ' (On target)';
        ELSE
            trend_description := trend_description || ' (Below target)';
        END IF;
    END IF;
    
    NEW.trend := trend_description;
    
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
DROP TRIGGER IF EXISTS gasifier_trend_forecast_trigger ON gasifier_observations_partitioned CASCADE;

CREATE TRIGGER gasifier_trend_forecast_trigger
    BEFORE INSERT OR UPDATE OF flow_rate, linear_reduction_per_day, linear_reading ON gasifier_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_trend_and_forecast();

-- Step 4: Update existing records
UPDATE gasifier_observations_partitioned
SET trend = CASE 
        WHEN linear_reduction_per_day IS NULL THEN 'No data'
        WHEN linear_reduction_per_day > 1.0 THEN 
            'Rapidly accelerating ⬆️⬆️' || 
            CASE 
                WHEN flow_rate > 1.0714 * 2 THEN ' (Critical)'
                WHEN flow_rate > 1.0714 * 1.5 THEN ' (High)'
                WHEN flow_rate > 1.0714 THEN ' (Above target)'
                WHEN flow_rate > 1.0714 * 0.5 THEN ' (On target)'
                ELSE ' (Below target)'
            END
        WHEN linear_reduction_per_day > 0.5 THEN 
            'Accelerating ⬆️' ||
            CASE 
                WHEN flow_rate > 1.0714 * 2 THEN ' (Critical)'
                WHEN flow_rate > 1.0714 * 1.5 THEN ' (High)'
                WHEN flow_rate > 1.0714 THEN ' (Above target)'
                WHEN flow_rate > 1.0714 * 0.5 THEN ' (On target)'
                ELSE ' (Below target)'
            END
        WHEN linear_reduction_per_day > 0.1 THEN 
            'Slightly accelerating ↗️' ||
            CASE 
                WHEN flow_rate > 1.0714 * 2 THEN ' (Critical)'
                WHEN flow_rate > 1.0714 * 1.5 THEN ' (High)'
                WHEN flow_rate > 1.0714 THEN ' (Above target)'
                WHEN flow_rate > 1.0714 * 0.5 THEN ' (On target)'
                ELSE ' (Below target)'
            END
        WHEN linear_reduction_per_day > -0.1 THEN 
            'Steady →' ||
            CASE 
                WHEN flow_rate > 1.0714 * 2 THEN ' (Critical)'
                WHEN flow_rate > 1.0714 * 1.5 THEN ' (High)'
                WHEN flow_rate > 1.0714 THEN ' (Above target)'
                WHEN flow_rate > 1.0714 * 0.5 THEN ' (On target)'
                ELSE ' (Below target)'
            END
        WHEN linear_reduction_per_day > -0.5 THEN 
            'Slightly decelerating ↘️' ||
            CASE 
                WHEN flow_rate > 1.0714 * 2 THEN ' (Critical)'
                WHEN flow_rate > 1.0714 * 1.5 THEN ' (High)'
                WHEN flow_rate > 1.0714 THEN ' (Above target)'
                WHEN flow_rate > 1.0714 * 0.5 THEN ' (On target)'
                ELSE ' (Below target)'
            END
        WHEN linear_reduction_per_day > -1.0 THEN 
            'Decelerating ⬇️' ||
            CASE 
                WHEN flow_rate > 1.0714 * 2 THEN ' (Critical)'
                WHEN flow_rate > 1.0714 * 1.5 THEN ' (High)'
                WHEN flow_rate > 1.0714 THEN ' (Above target)'
                WHEN flow_rate > 1.0714 * 0.5 THEN ' (On target)'
                ELSE ' (Below target)'
            END
        ELSE 
            'Rapidly decelerating ⬇️⬇️' ||
            CASE 
                WHEN flow_rate > 1.0714 * 2 THEN ' (Critical)'
                WHEN flow_rate > 1.0714 * 1.5 THEN ' (High)'
                WHEN flow_rate > 1.0714 THEN ' (Above target)'
                WHEN flow_rate > 1.0714 * 0.5 THEN ' (On target)'
                ELSE ' (Below target)'
            END
    END,
    forecasted_expiration = CASE 
        WHEN flow_rate IS NOT NULL AND flow_rate > 0 AND linear_reading IS NOT NULL 
        THEN created_at + ((linear_reading / flow_rate * 24) || ' hours')::interval
        ELSE NULL
    END
WHERE flow_rate IS NOT NULL OR linear_reduction_per_day IS NOT NULL;

-- Step 5: Verify with sample data
SELECT 
    gasifier_code,
    created_at,
    ROUND(linear_reading::numeric, 2) as reading,
    ROUND(flow_rate::numeric, 4) as flow_rate,
    ROUND(linear_reduction_per_day::numeric, 4) as momentum,
    trend,
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