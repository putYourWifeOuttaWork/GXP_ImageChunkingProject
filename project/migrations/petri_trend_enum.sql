-- Create professional ENUM type for petri growth trend analysis

-- Step 1: Create ENUM type for petri trend categories
CREATE TYPE petri_trend_category AS ENUM (
    'RAPID_GROWTH',
    'STRONG_GROWTH',
    'MODERATE_GROWTH',
    'STABLE_GROWTH',
    'STAGNANT',
    'MODERATE_DECLINE',
    'SIGNIFICANT_DECLINE',
    'INSUFFICIENT_DATA'
);

-- Step 2: Add trend column to petri_observations_partitioned
ALTER TABLE petri_observations_partitioned 
ADD COLUMN IF NOT EXISTS trend petri_trend_category;

-- Step 3: Create function to calculate petri trend
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
        NEW.trend := 'INSUFFICIENT_DATA';
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
    
    NEW.trend := trend_result;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger
DROP TRIGGER IF EXISTS petri_trend_trigger ON petri_observations_partitioned CASCADE;

CREATE TRIGGER petri_trend_trigger
    BEFORE INSERT OR UPDATE OF growth_velocity, growth_index ON petri_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_petri_trend();

-- Step 5: Update existing records
UPDATE petri_observations_partitioned
SET trend = 
    CASE 
        WHEN growth_velocity IS NULL OR growth_index IS NULL THEN 'INSUFFICIENT_DATA'::petri_trend_category
        WHEN growth_velocity > 5.0 THEN 'RAPID_GROWTH'::petri_trend_category
        WHEN growth_velocity > 2.0 THEN 'STRONG_GROWTH'::petri_trend_category
        WHEN growth_velocity > 0.5 THEN 'MODERATE_GROWTH'::petri_trend_category
        WHEN growth_velocity > 0.0 THEN 'STABLE_GROWTH'::petri_trend_category
        WHEN growth_velocity = 0.0 THEN 'STAGNANT'::petri_trend_category
        WHEN growth_velocity > -2.0 THEN 'MODERATE_DECLINE'::petri_trend_category
        ELSE 'SIGNIFICANT_DECLINE'::petri_trend_category
    END;

-- Step 6: Create view for petri trend analysis
CREATE OR REPLACE VIEW petri_trend_analysis AS
SELECT 
    petri_code,
    program_id,
    created_at,
    growth_index,
    ROUND(growth_velocity::numeric, 4) as growth_velocity,
    trend,
    CASE trend
        WHEN 'RAPID_GROWTH' THEN 'Exceptional: Growth velocity > 5.0/day'
        WHEN 'STRONG_GROWTH' THEN 'Excellent: Growth velocity > 2.0/day'
        WHEN 'MODERATE_GROWTH' THEN 'Good: Growth velocity > 0.5/day'
        WHEN 'STABLE_GROWTH' THEN 'Normal: Positive growth detected'
        WHEN 'STAGNANT' THEN 'Alert: No growth detected'
        WHEN 'MODERATE_DECLINE' THEN 'Warning: Culture declining'
        WHEN 'SIGNIFICANT_DECLINE' THEN 'Critical: Rapid decline detected'
        WHEN 'INSUFFICIENT_DATA' THEN 'Pending: Awaiting data'
    END as trend_description,
    CASE trend
        WHEN 'RAPID_GROWTH' THEN 1
        WHEN 'STRONG_GROWTH' THEN 2
        WHEN 'MODERATE_GROWTH' THEN 3
        WHEN 'STABLE_GROWTH' THEN 4
        WHEN 'STAGNANT' THEN 5
        WHEN 'MODERATE_DECLINE' THEN 6
        WHEN 'SIGNIFICANT_DECLINE' THEN 7
        WHEN 'INSUFFICIENT_DATA' THEN 8
    END as priority_level
FROM petri_observations_partitioned;

-- Step 7: Verify with sample data
SELECT 
    petri_code,
    created_at::date as observation_date,
    growth_index,
    ROUND(growth_velocity::numeric, 2) as velocity,
    trend
FROM petri_observations_partitioned
WHERE growth_velocity IS NOT NULL
ORDER BY petri_code, created_at
LIMIT 30;

-- Step 8: Summary report by petri showing trend distribution
SELECT 
    petri_code,
    COUNT(*) as total_observations,
    COUNT(*) FILTER (WHERE trend = 'RAPID_GROWTH') as rapid_growth_count,
    COUNT(*) FILTER (WHERE trend IN ('STRONG_GROWTH', 'MODERATE_GROWTH')) as growth_count,
    COUNT(*) FILTER (WHERE trend = 'STABLE_GROWTH') as stable_count,
    COUNT(*) FILTER (WHERE trend = 'STAGNANT') as stagnant_count,
    COUNT(*) FILTER (WHERE trend IN ('MODERATE_DECLINE', 'SIGNIFICANT_DECLINE')) as decline_count,
    MODE() WITHIN GROUP (ORDER BY trend) as most_common_trend
FROM petri_observations_partitioned
WHERE trend IS NOT NULL
GROUP BY petri_code
ORDER BY petri_code;

-- Step 9: Alert report - cultures needing attention
SELECT 
    petri_code,
    program_id,
    MAX(created_at) as last_observation,
    ROUND(AVG(growth_velocity)::numeric, 2) as avg_velocity,
    MODE() WITHIN GROUP (ORDER BY trend) as dominant_trend,
    CASE 
        WHEN COUNT(*) FILTER (WHERE trend = 'SIGNIFICANT_DECLINE') > 2 THEN 'CRITICAL - Multiple decline events'
        WHEN COUNT(*) FILTER (WHERE trend = 'STAGNANT') > 3 THEN 'WARNING - Prolonged stagnation'
        WHEN AVG(growth_velocity) < -1 THEN 'ALERT - Net decline'
        ELSE 'OK'
    END as alert_status
FROM petri_observations_partitioned
WHERE trend IS NOT NULL
GROUP BY petri_code, program_id
HAVING COUNT(*) FILTER (WHERE trend IN ('SIGNIFICANT_DECLINE', 'STAGNANT')) > 0
ORDER BY alert_status, petri_code;