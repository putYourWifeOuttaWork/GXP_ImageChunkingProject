-- Create experiment role ENUM for control vs test growth analysis

-- Step 1: Create ENUM type for experiment roles
CREATE TYPE experiment_role AS ENUM (
    'CONTROL',
    'EXPERIMENTAL', 
    'IGNORE_COMBINED',
    'INDIVIDUAL_SAMPLE',
    'INSUFFICIENT_DATA'
);

-- Step 2: Add experiment_role column
ALTER TABLE petri_observations_partitioned 
ADD COLUMN IF NOT EXISTS experiment_role experiment_role;

-- Step 3: Create function to extract experiment role from phase_observation_settings
CREATE OR REPLACE FUNCTION calculate_experiment_role()
RETURNS TRIGGER AS $$
DECLARE
    settings_json jsonb;
    position_value text;
    role_result experiment_role;
BEGIN
    -- Get the phase_observation_settings JSON
    settings_json := NEW.phase_observation_settings;
    
    -- Handle NULL or empty JSON
    IF settings_json IS NULL OR settings_json = '{}'::jsonb THEN
        -- For petri codes without split data, determine by naming pattern
        IF NEW.petri_code ~ '_Left$' THEN
            NEW.experiment_role := 'CONTROL';
        ELSIF NEW.petri_code ~ '_Right$' THEN
            NEW.experiment_role := 'EXPERIMENTAL';
        ELSIF NEW.petri_code ~ '_(Left|Right|_1)$' THEN
            NEW.experiment_role := 'INDIVIDUAL_SAMPLE';
        ELSE
            NEW.experiment_role := 'INDIVIDUAL_SAMPLE';  -- Main samples without splits
        END IF;
        RETURN NEW;
    END IF;
    
    -- Extract position from JSON
    position_value := settings_json->>'position';
    
    -- Categorize based on position
    CASE position_value
        WHEN 'main' THEN
            role_result := 'IGNORE_COMBINED';  -- Image of both together, ignore for analysis
        WHEN 'left' THEN
            role_result := 'CONTROL';          -- Left = control
        WHEN 'right' THEN
            role_result := 'EXPERIMENTAL';     -- Right = experimental
        ELSE
            role_result := 'INSUFFICIENT_DATA';
    END CASE;
    
    NEW.experiment_role := role_result;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger
DROP TRIGGER IF EXISTS petri_experiment_role_trigger ON petri_observations_partitioned CASCADE;

CREATE TRIGGER petri_experiment_role_trigger
    BEFORE INSERT OR UPDATE OF phase_observation_settings, petri_code ON petri_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION calculate_experiment_role();

-- Step 5: Update existing records
UPDATE petri_observations_partitioned
SET experiment_role = 
    CASE 
        WHEN phase_observation_settings IS NULL OR phase_observation_settings = '{}'::jsonb THEN
            CASE 
                WHEN petri_code ~ '_Left$' THEN 'CONTROL'::experiment_role
                WHEN petri_code ~ '_Right$' THEN 'EXPERIMENTAL'::experiment_role
                WHEN petri_code ~ '_(Left|Right|_1)$' THEN 'INDIVIDUAL_SAMPLE'::experiment_role
                ELSE 'INDIVIDUAL_SAMPLE'::experiment_role
            END
        WHEN phase_observation_settings->>'position' = 'main' THEN 'IGNORE_COMBINED'::experiment_role
        WHEN phase_observation_settings->>'position' = 'left' THEN 'CONTROL'::experiment_role
        WHEN phase_observation_settings->>'position' = 'right' THEN 'EXPERIMENTAL'::experiment_role
        ELSE 'INSUFFICIENT_DATA'::experiment_role
    END;

-- Step 6: Create view for control vs test analysis
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
    trend,
    CASE experiment_role
        WHEN 'CONTROL' THEN 'Control Group'
        WHEN 'EXPERIMENTAL' THEN 'Experimental Group'
        WHEN 'IGNORE_COMBINED' THEN 'Combined Image (Ignore)'
        WHEN 'INDIVIDUAL_SAMPLE' THEN 'Individual Sample'
        WHEN 'INSUFFICIENT_DATA' THEN 'Unknown Role'
    END as role_description
FROM petri_observations_partitioned
WHERE experiment_role IS NOT NULL;

-- Step 7: Verify the categorization
SELECT 
    experiment_role,
    COUNT(*) as observation_count,
    COUNT(DISTINCT petri_code) as unique_petri_count,
    ARRAY_AGG(DISTINCT petri_code ORDER BY petri_code) FILTER (WHERE petri_code IS NOT NULL) as sample_codes
FROM petri_observations_partitioned
WHERE experiment_role IS NOT NULL
GROUP BY experiment_role
ORDER BY experiment_role;

-- Step 8: Sample analysis for control vs test velocity comparison
SELECT 
    base_petri_code,
    program_id,
    COUNT(*) FILTER (WHERE experiment_role = 'EXPERIMENTAL') as experimental_observations,
    COUNT(*) FILTER (WHERE experiment_role = 'CONTROL') as control_observations,
    ROUND(AVG(growth_velocity) FILTER (WHERE experiment_role = 'EXPERIMENTAL')::numeric, 4) as avg_experimental_velocity,
    ROUND(AVG(growth_velocity) FILTER (WHERE experiment_role = 'CONTROL')::numeric, 4) as avg_control_velocity,
    CASE 
        WHEN AVG(growth_velocity) FILTER (WHERE experiment_role = 'EXPERIMENTAL') > 
             AVG(growth_velocity) FILTER (WHERE experiment_role = 'CONTROL')
        THEN 'Experimental outperforming control'
        WHEN AVG(growth_velocity) FILTER (WHERE experiment_role = 'EXPERIMENTAL') < 
             AVG(growth_velocity) FILTER (WHERE experiment_role = 'CONTROL')
        THEN 'Control outperforming experimental'
        ELSE 'Similar performance'
    END as performance_comparison
FROM petri_control_vs_test_analysis
WHERE experiment_role IN ('EXPERIMENTAL', 'CONTROL')
AND growth_velocity IS NOT NULL
GROUP BY base_petri_code, program_id
HAVING COUNT(*) FILTER (WHERE experiment_role = 'EXPERIMENTAL') > 0 
   AND COUNT(*) FILTER (WHERE experiment_role = 'CONTROL') > 0
ORDER BY base_petri_code;