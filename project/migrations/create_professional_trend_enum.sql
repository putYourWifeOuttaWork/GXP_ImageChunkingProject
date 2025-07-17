-- Create professional ENUM type for trend analysis

-- Step 1: Create ENUM type for trend categories
CREATE TYPE trend_category AS ENUM (
    'CRITICAL_ACCELERATION',
    'HIGH_ACCELERATION',
    'MODERATE_ACCELERATION',
    'STABLE',
    'MODERATE_DECELERATION',
    'HIGH_DECELERATION',
    'CRITICAL_DECELERATION',
    'INSUFFICIENT_DATA'
);

-- Step 2: Add new professional trend column
ALTER TABLE gasifier_observations_partitioned 
ADD COLUMN IF NOT EXISTS trend_category trend_category;

-- Step 3: Create function to calculate professional trend
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
        NEW.trend_category := 'INSUFFICIENT_DATA';
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
    
    NEW.trend_category := trend_result;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger
DROP TRIGGER IF EXISTS gasifier_professional_trend_trigger ON gasifier_observations_partitioned CASCADE;

CREATE TRIGGER gasifier_professional_trend_trigger
    BEFORE INSERT OR UPDATE OF flow_rate, linear_reduction_per_day ON gasifier_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_professional_trend();

-- Step 5: Update existing records
UPDATE gasifier_observations_partitioned
SET trend_category = 
    CASE 
        WHEN linear_reduction_per_day IS NULL OR flow_rate IS NULL THEN 'INSUFFICIENT_DATA'::trend_category
        WHEN linear_reduction_per_day > 0.5 AND flow_rate / 1.0714 > 1.5 THEN 'CRITICAL_ACCELERATION'::trend_category
        WHEN linear_reduction_per_day > 0.5 AND flow_rate / 1.0714 > 1.0 THEN 'HIGH_ACCELERATION'::trend_category
        WHEN linear_reduction_per_day > 0.1 THEN 'MODERATE_ACCELERATION'::trend_category
        WHEN linear_reduction_per_day >= -0.1 AND linear_reduction_per_day <= 0.1 THEN 'STABLE'::trend_category
        WHEN linear_reduction_per_day > -0.5 THEN 'MODERATE_DECELERATION'::trend_category
        WHEN linear_reduction_per_day > -1.0 OR flow_rate / 1.0714 < 0.5 THEN 'HIGH_DECELERATION'::trend_category
        ELSE 'CRITICAL_DECELERATION'::trend_category
    END;

-- Step 6: Create view for trend analysis with descriptions
CREATE OR REPLACE VIEW gasifier_trend_analysis AS
SELECT 
    gasifier_code,
    program_id,
    created_at,
    ROUND(flow_rate::numeric, 4) as flow_rate,
    ROUND(linear_reduction_per_day::numeric, 4) as momentum,
    trend_category,
    CASE trend_category
        WHEN 'CRITICAL_ACCELERATION' THEN 'Critical: Rapid consumption increase above target'
        WHEN 'HIGH_ACCELERATION' THEN 'Warning: Significant consumption increase'
        WHEN 'MODERATE_ACCELERATION' THEN 'Caution: Moderate consumption increase'
        WHEN 'STABLE' THEN 'Normal: Stable consumption rate'
        WHEN 'MODERATE_DECELERATION' THEN 'Good: Moderate consumption decrease'
        WHEN 'HIGH_DECELERATION' THEN 'Excellent: Significant consumption decrease'
        WHEN 'CRITICAL_DECELERATION' THEN 'Review: Extreme consumption decrease'
        WHEN 'INSUFFICIENT_DATA' THEN 'Pending: Insufficient data for analysis'
    END as trend_description,
    CASE trend_category
        WHEN 'CRITICAL_ACCELERATION' THEN 1
        WHEN 'HIGH_ACCELERATION' THEN 2
        WHEN 'MODERATE_ACCELERATION' THEN 3
        WHEN 'STABLE' THEN 4
        WHEN 'MODERATE_DECELERATION' THEN 5
        WHEN 'HIGH_DECELERATION' THEN 6
        WHEN 'CRITICAL_DECELERATION' THEN 7
        WHEN 'INSUFFICIENT_DATA' THEN 8
    END as severity_level
FROM gasifier_observations_partitioned;

-- Step 7: Verify with sample data
SELECT 
    gasifier_code,
    created_at::date as observation_date,
    ROUND(flow_rate::numeric, 2) as flow_rate,
    ROUND(linear_reduction_per_day::numeric, 2) as momentum,
    trend_category,
    CASE trend_category
        WHEN 'CRITICAL_ACCELERATION' THEN 'CRITICAL'
        WHEN 'HIGH_ACCELERATION' THEN 'HIGH'
        WHEN 'MODERATE_ACCELERATION' THEN 'MODERATE'
        WHEN 'STABLE' THEN 'STABLE'
        WHEN 'MODERATE_DECELERATION' THEN 'IMPROVING'
        WHEN 'HIGH_DECELERATION' THEN 'EXCELLENT'
        WHEN 'CRITICAL_DECELERATION' THEN 'REVIEW'
        WHEN 'INSUFFICIENT_DATA' THEN 'N/A'
    END as status
FROM gasifier_observations_partitioned
WHERE flow_rate IS NOT NULL
ORDER BY gasifier_code, created_at
LIMIT 20;

-- Step 8: Summary report by gasifier
SELECT 
    gasifier_code,
    COUNT(*) as total_observations,
    COUNT(*) FILTER (WHERE trend_category = 'CRITICAL_ACCELERATION') as critical_count,
    COUNT(*) FILTER (WHERE trend_category IN ('HIGH_ACCELERATION', 'MODERATE_ACCELERATION')) as acceleration_count,
    COUNT(*) FILTER (WHERE trend_category = 'STABLE') as stable_count,
    COUNT(*) FILTER (WHERE trend_category IN ('MODERATE_DECELERATION', 'HIGH_DECELERATION', 'CRITICAL_DECELERATION')) as deceleration_count,
    MODE() WITHIN GROUP (ORDER BY trend_category) as most_common_trend
FROM gasifier_observations_partitioned
WHERE trend_category IS NOT NULL
GROUP BY gasifier_code
ORDER BY gasifier_code;

-- Optional: Drop the old unprofessional trend column
-- ALTER TABLE gasifier_observations_partitioned DROP COLUMN IF EXISTS trend;