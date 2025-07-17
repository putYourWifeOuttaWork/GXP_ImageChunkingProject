-- Rename trend columns to be more specific

-- Step 1: Rename gasifier trend column
ALTER TABLE gasifier_observations_partitioned 
RENAME COLUMN trend TO trend_gasifier_velocity;

-- Step 2: Rename petri trend column  
ALTER TABLE petri_observations_partitioned 
RENAME COLUMN trend TO trend_petri_velocity;

-- Step 3: Update any views that reference the old column names

-- Update gasifier trend analysis view
DROP VIEW IF EXISTS gasifier_trend_analysis CASCADE;
CREATE OR REPLACE VIEW gasifier_trend_analysis AS
SELECT 
    gasifier_code,
    program_id,
    created_at,
    ROUND(flow_rate::numeric, 4) as flow_rate,
    ROUND(linear_reduction_per_day::numeric, 4) as momentum,
    trend_gasifier_velocity,
    CASE trend_gasifier_velocity
        WHEN 'CRITICAL_ACCELERATION' THEN 'Critical: Rapid consumption increase above target'
        WHEN 'HIGH_ACCELERATION' THEN 'Warning: Significant consumption increase'
        WHEN 'MODERATE_ACCELERATION' THEN 'Caution: Moderate consumption increase'
        WHEN 'STABLE' THEN 'Normal: Stable consumption rate'
        WHEN 'MODERATE_DECELERATION' THEN 'Good: Moderate consumption decrease'
        WHEN 'HIGH_DECELERATION' THEN 'Excellent: Significant consumption decrease'
        WHEN 'CRITICAL_DECELERATION' THEN 'Review: Extreme consumption decrease'
        WHEN 'INSUFFICIENT_DATA' THEN 'Pending: Insufficient data for analysis'
    END as trend_description,
    CASE trend_gasifier_velocity
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

-- Update petri trend analysis view
DROP VIEW IF EXISTS petri_trend_analysis CASCADE;
CREATE OR REPLACE VIEW petri_trend_analysis AS
SELECT 
    petri_code,
    program_id,
    created_at,
    growth_index,
    ROUND(growth_velocity::numeric, 4) as growth_velocity,
    trend_petri_velocity,
    CASE trend_petri_velocity
        WHEN 'RAPID_GROWTH' THEN 'Exceptional: Growth velocity > 5.0/day'
        WHEN 'STRONG_GROWTH' THEN 'Excellent: Growth velocity > 2.0/day'
        WHEN 'MODERATE_GROWTH' THEN 'Good: Growth velocity > 0.5/day'
        WHEN 'STABLE_GROWTH' THEN 'Normal: Positive growth detected'
        WHEN 'STAGNANT' THEN 'Alert: No growth detected'
        WHEN 'MODERATE_DECLINE' THEN 'Warning: Culture declining'
        WHEN 'SIGNIFICANT_DECLINE' THEN 'Critical: Rapid decline detected'
        WHEN 'INSUFFICIENT_DATA' THEN 'Pending: Awaiting data'
    END as trend_description,
    CASE trend_petri_velocity
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

-- Update petri control vs test analysis view
DROP VIEW IF EXISTS petri_control_vs_test_analysis CASCADE;
CREATE OR REPLACE VIEW petri_control_vs_test_analysis AS
SELECT 
    COALESCE(
        phase_observation_settings->>'base_petri_code',
        REGEXP_REPLACE(petri_code, '_(Left|Right|_1)$', '')
    ) as base_petri_code,
    program_id,
    created_at,
    petri_code,
    experiment_role,
    growth_index,
    ROUND(growth_velocity::numeric, 4) as growth_velocity,
    trend_petri_velocity,
    CASE experiment_role
        WHEN 'CONTROL' THEN 'Control Group'
        WHEN 'EXPERIMENTAL' THEN 'Experimental Group'
        WHEN 'IGNORE_COMBINED' THEN 'Combined Image (Ignore)'
        WHEN 'INDIVIDUAL_SAMPLE' THEN 'Individual Sample'
        WHEN 'INSUFFICIENT_DATA' THEN 'Unknown Role'
    END as role_description
FROM petri_observations_partitioned
WHERE experiment_role IS NOT NULL;

-- Step 4: Verify the column renames
SELECT 
    'gasifier_observations_partitioned' as table_name,
    'trend_gasifier_velocity' as new_column_name,
    COUNT(*) as row_count,
    COUNT(trend_gasifier_velocity) as non_null_count
FROM gasifier_observations_partitioned

UNION ALL

SELECT 
    'petri_observations_partitioned' as table_name,
    'trend_petri_velocity' as new_column_name,
    COUNT(*) as row_count,
    COUNT(trend_petri_velocity) as non_null_count
FROM petri_observations_partitioned;