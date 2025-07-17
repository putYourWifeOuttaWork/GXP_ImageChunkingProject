-- Fix triggers and functions to use new trend column names

-- Step 1: Update gasifier trend function to use new column name
CREATE OR REPLACE FUNCTION calculate_professional_trend()
RETURNS TRIGGER AS $$
DECLARE
    momentum_value float4;
    flow_value float4;
    performance_factor float4;
    trend_result trend_category;
BEGIN
    momentum_value := NEW.linear_reduction_per_day;
    flow_value := NEW.flow_rate;
    
    -- Handle NULL cases
    IF momentum_value IS NULL OR flow_value IS NULL THEN
        NEW.trend_gasifier_velocity := 'INSUFFICIENT_DATA';
        RETURN NEW;
    END IF;
    
    -- Calculate performance factor (how far from target)
    performance_factor := flow_value / 1.0714;
    
    -- Determine trend based on momentum and performance
    IF momentum_value > 0.5 AND performance_factor > 1.5 THEN
        trend_result := 'CRITICAL_ACCELERATION';
    ELSIF momentum_value > 0.5 AND performance_factor > 1.0 THEN
        trend_result := 'HIGH_ACCELERATION';
    ELSIF momentum_value > 0.1 THEN
        trend_result := 'MODERATE_ACCELERATION';
    ELSIF momentum_value >= -0.1 AND momentum_value <= 0.1 THEN
        trend_result := 'STABLE';
    ELSIF momentum_value > -0.5 THEN
        trend_result := 'MODERATE_DECELERATION';
    ELSIF momentum_value > -1.0 OR performance_factor < 0.5 THEN
        trend_result := 'HIGH_DECELERATION';
    ELSE
        trend_result := 'CRITICAL_DECELERATION';
    END IF;
    
    NEW.trend_gasifier_velocity := trend_result;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Update petri trend function to use new column name
CREATE OR REPLACE FUNCTION calculate_petri_trend()
RETURNS TRIGGER AS $$
DECLARE
    velocity_value numeric;
    growth_value numeric;
    trend_result petri_trend_category;
BEGIN
    velocity_value := NEW.growth_velocity;
    growth_value := NEW.growth_index;
    
    -- Handle NULL cases
    IF velocity_value IS NULL OR growth_value IS NULL THEN
        NEW.trend_petri_velocity := 'INSUFFICIENT_DATA';
        RETURN NEW;
    END IF;
    
    -- Determine trend based on velocity and current growth level
    IF velocity_value > 5.0 THEN
        trend_result := 'RAPID_GROWTH';
    ELSIF velocity_value > 2.0 THEN
        trend_result := 'STRONG_GROWTH';
    ELSIF velocity_value > 0.5 THEN
        trend_result := 'MODERATE_GROWTH';
    ELSIF velocity_value > 0.0 THEN
        trend_result := 'STABLE_GROWTH';
    ELSIF velocity_value = 0.0 THEN
        trend_result := 'STAGNANT';
    ELSIF velocity_value > -2.0 THEN
        trend_result := 'MODERATE_DECLINE';
    ELSE
        trend_result := 'SIGNIFICANT_DECLINE';
    END IF;
    
    NEW.trend_petri_velocity := trend_result;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Update forecast function to use new column name
CREATE OR REPLACE FUNCTION calculate_trend_and_forecast()
RETURNS TRIGGER AS $$
DECLARE
    remaining_material float4;
    days_to_expiration float4;
    hours_to_expiration float4;
    momentum_value float4;
    flow_value float4;
    performance_factor float4;
    trend_result trend_category;
BEGIN
    momentum_value := NEW.linear_reduction_per_day;
    flow_value := NEW.flow_rate;
    
    -- Calculate trend based on momentum and performance
    IF momentum_value IS NULL OR flow_value IS NULL THEN
        NEW.trend_gasifier_velocity := 'INSUFFICIENT_DATA';
    ELSE
        -- Calculate performance factor (how far from target)
        performance_factor := flow_value / 1.0714;
        
        -- Determine trend based on momentum and performance
        IF momentum_value > 0.5 AND performance_factor > 1.5 THEN
            trend_result := 'CRITICAL_ACCELERATION';
        ELSIF momentum_value > 0.5 AND performance_factor > 1.0 THEN
            trend_result := 'HIGH_ACCELERATION';
        ELSIF momentum_value > 0.1 THEN
            trend_result := 'MODERATE_ACCELERATION';
        ELSIF momentum_value >= -0.1 AND momentum_value <= 0.1 THEN
            trend_result := 'STABLE';
        ELSIF momentum_value > -0.5 THEN
            trend_result := 'MODERATE_DECELERATION';
        ELSIF momentum_value > -1.0 OR performance_factor < 0.5 THEN
            trend_result := 'HIGH_DECELERATION';
        ELSE
            trend_result := 'CRITICAL_DECELERATION';
        END IF;
        
        NEW.trend_gasifier_velocity := trend_result;
    END IF;
    
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

-- Step 4: Drop and recreate gasifier triggers with correct column references
DROP TRIGGER IF EXISTS gasifier_trend_trigger ON gasifier_observations_partitioned CASCADE;
DROP TRIGGER IF EXISTS gasifier_trend_forecast_trigger ON gasifier_observations_partitioned CASCADE;

CREATE TRIGGER gasifier_trend_trigger
    BEFORE INSERT OR UPDATE OF flow_rate, linear_reduction_per_day ON gasifier_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_professional_trend();

CREATE TRIGGER gasifier_forecast_trend_trigger
    BEFORE INSERT OR UPDATE OF flow_rate, linear_reduction_per_day, linear_reading ON gasifier_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_trend_and_forecast();

-- Step 5: Drop and recreate petri triggers with correct column references
DROP TRIGGER IF EXISTS petri_trend_trigger ON petri_observations_partitioned CASCADE;

CREATE TRIGGER petri_trend_trigger
    BEFORE INSERT OR UPDATE OF growth_velocity, growth_index ON petri_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_petri_trend();

-- Step 6: Test the triggers by updating a sample record
-- This will verify the triggers work with the new column names

-- Test gasifier trigger
UPDATE gasifier_observations_partitioned 
SET linear_reduction_per_day = linear_reduction_per_day 
WHERE gasifier_code = (SELECT gasifier_code FROM gasifier_observations_partitioned WHERE gasifier_code IS NOT NULL LIMIT 1);

-- Test petri trigger  
UPDATE petri_observations_partitioned 
SET growth_index = growth_index 
WHERE petri_code = (SELECT petri_code FROM petri_observations_partitioned WHERE petri_code IS NOT NULL LIMIT 1);

-- Step 7: Verify triggers are working
SELECT 
    'gasifier_observations_partitioned' as table_name,
    COUNT(*) as total_rows,
    COUNT(trend_gasifier_velocity) as trend_count,
    COUNT(forecasted_expiration) as forecast_count
FROM gasifier_observations_partitioned

UNION ALL

SELECT 
    'petri_observations_partitioned' as table_name,
    COUNT(*) as total_rows,
    COUNT(trend_petri_velocity) as trend_count,
    NULL as forecast_count
FROM petri_observations_partitioned;