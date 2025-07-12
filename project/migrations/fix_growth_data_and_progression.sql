-- Fix Growth Data and Convert growth_progression to Daily Growth Rate
-- ==================================================================

-- Step 1: Backup current data (safety first)
CREATE TABLE IF NOT EXISTS petri_observations_backup_growth AS 
SELECT observation_id, growth_progression, growth_index, petri_code, program_id, todays_day_of_phase 
FROM petri_observations;

-- Step 2: Copy ALL growth_progression values to growth_index (overwrite everything)
UPDATE petri_observations
SET growth_index = growth_progression;

-- Show results of the copy
SELECT 
    'Growth Index Update Results' as description,
    COUNT(*) FILTER (WHERE growth_index IS NOT NULL) as rows_with_growth_index,
    COUNT(*) FILTER (WHERE growth_progression IS NOT NULL) as rows_with_growth_progression,
    COUNT(*) FILTER (WHERE growth_index = growth_progression) as matching_values
FROM petri_observations;

-- Step 3: Calculate new growth_progression values (daily growth rate)
WITH daily_growth AS (
    SELECT 
        p1.observation_id,
        p1.petri_code,
        p1.program_id,
        p1.todays_day_of_phase,
        p1.growth_index as current_growth,
        p2.growth_index as previous_growth,
        CASE 
            WHEN p1.todays_day_of_phase = 1 THEN 0  -- First day
            WHEN p2.growth_index IS NULL THEN 0     -- No previous day found
            ELSE COALESCE(p1.growth_index, 0) - COALESCE(p2.growth_index, 0)
        END as calculated_progression
    FROM petri_observations p1
    LEFT JOIN petri_observations p2 
        ON p1.petri_code = p2.petri_code 
        AND p1.program_id = p2.program_id 
        AND p2.todays_day_of_phase = p1.todays_day_of_phase - 1
)
UPDATE petri_observations po
SET growth_progression = dg.calculated_progression
FROM daily_growth dg
WHERE po.observation_id = dg.observation_id;

-- Step 4: Verify the update
SELECT 
    'Sample Growth Progression Calculations' as description,
    petri_code,
    program_id,
    todays_day_of_phase,
    growth_index,
    growth_progression,
    CASE 
        WHEN todays_day_of_phase = 1 THEN 'First Day (0)'
        ELSE 'Day ' || todays_day_of_phase || ' growth'
    END as calculation_note
FROM petri_observations
WHERE growth_index IS NOT NULL
ORDER BY program_id, petri_code, todays_day_of_phase
LIMIT 20;

-- Step 5: Do the same for partitioned table if it has data
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM petri_observations_partitioned;
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Updating petri_observations_partitioned table...';
        
        -- Copy ALL growth_progression values to growth_index (overwrite everything)
        UPDATE petri_observations_partitioned
        SET growth_index = growth_progression;
        
        -- Calculate new growth_progression values
        WITH daily_growth AS (
            SELECT 
                p1.observation_id,
                p1.program_id,
                p1.petri_code,
                p1.todays_day_of_phase,
                p1.growth_index as current_growth,
                p2.growth_index as previous_growth,
                CASE 
                    WHEN p1.todays_day_of_phase = 1 THEN 0
                    WHEN p2.growth_index IS NULL THEN 0
                    ELSE COALESCE(p1.growth_index, 0) - COALESCE(p2.growth_index, 0)
                END as calculated_progression
            FROM petri_observations_partitioned p1
            LEFT JOIN petri_observations_partitioned p2 
                ON p1.petri_code = p2.petri_code 
                AND p1.program_id = p2.program_id 
                AND p2.todays_day_of_phase = p1.todays_day_of_phase - 1
        )
        UPDATE petri_observations_partitioned po
        SET growth_progression = dg.calculated_progression
        FROM daily_growth dg
        WHERE po.observation_id = dg.observation_id
          AND po.program_id = dg.program_id;
          
        RAISE NOTICE 'Partitioned table updated successfully';
    ELSE
        RAISE NOTICE 'Partitioned table is empty, skipping update';
    END IF;
END $$;

-- Step 6: Create a function to automatically calculate growth_progression
-- This can be used in triggers or views
CREATE OR REPLACE FUNCTION calculate_growth_progression(
    p_petri_code TEXT,
    p_program_id UUID,
    p_day_of_phase NUMERIC,  -- Changed to NUMERIC to match the column type
    p_current_growth_index NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    v_previous_growth NUMERIC;
BEGIN
    -- First day always returns 0
    IF p_day_of_phase = 1 THEN
        RETURN 0;
    END IF;
    
    -- Find previous day's growth_index
    SELECT growth_index INTO v_previous_growth
    FROM petri_observations
    WHERE petri_code = p_petri_code
      AND program_id = p_program_id
      AND todays_day_of_phase = p_day_of_phase - 1::NUMERIC
    LIMIT 1;
    
    -- Calculate progression
    IF v_previous_growth IS NULL THEN
        RETURN 0;
    ELSE
        RETURN COALESCE(p_current_growth_index, 0) - COALESCE(v_previous_growth, 0);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a trigger to auto-update growth_progression
CREATE OR REPLACE FUNCTION update_growth_progression_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.growth_progression := calculate_growth_progression(
        NEW.petri_code,
        NEW.program_id,
        NEW.todays_day_of_phase,
        NEW.growth_index
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to petri_observations
DROP TRIGGER IF EXISTS auto_calculate_growth_progression ON petri_observations;
CREATE TRIGGER auto_calculate_growth_progression
BEFORE INSERT OR UPDATE OF growth_index, todays_day_of_phase
ON petri_observations
FOR EACH ROW
EXECUTE FUNCTION update_growth_progression_trigger();

-- Show final statistics
SELECT 
    'Final Statistics' as description,
    COUNT(*) as total_rows,
    COUNT(growth_index) as rows_with_growth_index,
    COUNT(growth_progression) as rows_with_growth_progression,
    AVG(growth_progression) as avg_daily_growth,
    MAX(growth_progression) as max_daily_growth,
    MIN(growth_progression) as min_daily_growth
FROM petri_observations
WHERE growth_index IS NOT NULL;

-- Step 7: Apply trigger to partitioned table as well
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM petri_observations_partitioned) > 0 THEN
        -- Create trigger function for partitioned table
        CREATE OR REPLACE FUNCTION update_growth_progression_partitioned_trigger()
        RETURNS TRIGGER AS $func$
        DECLARE
            v_previous_growth NUMERIC;
        BEGIN
            -- First day always gets 0
            IF NEW.todays_day_of_phase = 1 THEN
                NEW.growth_progression := 0;
                RETURN NEW;
            END IF;
            
            -- Find previous day's growth_index
            SELECT growth_index INTO v_previous_growth
            FROM petri_observations_partitioned
            WHERE petri_code = NEW.petri_code
              AND program_id = NEW.program_id
              AND todays_day_of_phase = NEW.todays_day_of_phase - 1::NUMERIC
            LIMIT 1;
            
            -- Calculate progression
            IF v_previous_growth IS NULL THEN
                NEW.growth_progression := 0;
            ELSE
                NEW.growth_progression := COALESCE(NEW.growth_index, 0) - COALESCE(v_previous_growth, 0);
            END IF;
            
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;

        -- Apply trigger to partitioned table
        DROP TRIGGER IF EXISTS auto_calculate_growth_progression ON petri_observations_partitioned;
        CREATE TRIGGER auto_calculate_growth_progression
        BEFORE INSERT OR UPDATE OF growth_index, todays_day_of_phase
        ON petri_observations_partitioned
        FOR EACH ROW
        EXECUTE FUNCTION update_growth_progression_partitioned_trigger();
        
        RAISE NOTICE 'Triggers applied to both tables for automatic growth_progression calculation';
    END IF;
END $$;

-- Final verification
SELECT 
    'Verification - Sample Data with Calculated Progression' as description,
    petri_code,
    program_id,
    todays_day_of_phase,
    growth_index,
    growth_progression,
    CASE 
        WHEN todays_day_of_phase = 1 THEN 'First Day (should be 0)'
        WHEN growth_progression = 0 THEN 'No growth or missing previous day'
        WHEN growth_progression > 0 THEN 'Positive growth'
        ELSE 'Negative growth'
    END as growth_status
FROM petri_observations
WHERE growth_index IS NOT NULL
ORDER BY program_id, petri_code, todays_day_of_phase
LIMIT 30;