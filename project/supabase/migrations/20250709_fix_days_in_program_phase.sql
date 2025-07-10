-- Fix daysinthisprogramphase column to show planned duration of each program
-- This should be calculated from start_date to end_date of the program

-- First, let's see the current state
SELECT 
    pp.name as program_name,
    pp.start_date,
    pp.end_date,
    (pp.end_date - pp.start_date) + 1 as calculated_program_duration,
    COUNT(po.observation_id) as total_observations,
    MAX(po.todays_day_of_phase) as max_day_reached,
    po.daysinthisprogramphase as current_days_in_program_phase
FROM petri_observations po
JOIN pilot_programs pp ON po.program_id = pp.program_id
GROUP BY pp.name, pp.start_date, pp.end_date, po.daysinthisprogramphase
ORDER BY pp.start_date;

-- Create function to calculate planned duration of program phase
CREATE OR REPLACE FUNCTION calculate_program_phase_duration(
    p_program_id UUID
) RETURNS INTEGER AS $$
DECLARE
    program_duration INTEGER;
    prog_start_date DATE;
    prog_end_date DATE;
BEGIN
    -- Get the start and end dates of the program
    SELECT pilot_programs.start_date, pilot_programs.end_date 
    INTO prog_start_date, prog_end_date
    FROM pilot_programs
    WHERE pilot_programs.program_id = p_program_id;
    
    -- If no program found or missing dates, return NULL
    IF prog_start_date IS NULL OR prog_end_date IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Calculate the total duration (end_date - start_date + 1)
    program_duration := (prog_end_date - prog_start_date) + 1;
    
    RETURN program_duration;
END;
$$ LANGUAGE plpgsql;

-- Update all records with the planned duration of their program phase
DO $$
DECLARE
    records_updated INTEGER;
BEGIN
    RAISE NOTICE 'Starting update of daysinthisprogramphase values...';
    
    UPDATE petri_observations 
    SET daysinthisprogramphase = calculate_program_phase_duration(program_id)
    WHERE program_id IS NOT NULL;
    
    GET DIAGNOSTICS records_updated = ROW_COUNT;
    
    RAISE NOTICE 'Updated % records with planned program phase duration', records_updated;
END $$;

-- Create trigger function to automatically update daysinthisprogramphase
CREATE OR REPLACE FUNCTION update_program_phase_days()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new record is inserted or updated, set the planned duration for this program
    -- This ensures all records in the program have the same daysinthisprogramphase value
    
    NEW.daysinthisprogramphase := calculate_program_phase_duration(NEW.program_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires before insert or update
DROP TRIGGER IF EXISTS trigger_update_program_phase_days ON petri_observations;

CREATE TRIGGER trigger_update_program_phase_days
    BEFORE INSERT OR UPDATE ON petri_observations
    FOR EACH ROW
    EXECUTE FUNCTION update_program_phase_days();

-- Verification: Show results by program
SELECT 
    pp.name as program_name,
    pp.start_date,
    pp.end_date,
    (pp.end_date - pp.start_date) + 1 as calculated_duration,
    COUNT(po.observation_id) as total_observations,
    MAX(po.todays_day_of_phase) as max_day_reached,
    MIN(po.daysinthisprogramphase) as min_days_in_program,
    MAX(po.daysinthisprogramphase) as max_days_in_program,
    CASE 
        WHEN MIN(po.daysinthisprogramphase) = MAX(po.daysinthisprogramphase) 
        AND MIN(po.daysinthisprogramphase) = (pp.end_date - pp.start_date) + 1
        THEN 'Correct ✅' 
        ELSE 'Incorrect ❌' 
    END as validation_check
FROM petri_observations po
JOIN pilot_programs pp ON po.program_id = pp.program_id
GROUP BY pp.name, pp.start_date, pp.end_date
ORDER BY pp.start_date;

-- Show sample records to verify
SELECT 
    po.observation_id,
    po.created_at::DATE as observation_date,
    pp.name as program_name,
    pp.start_date,
    pp.end_date,
    (pp.end_date - pp.start_date) + 1 as expected_duration,
    po.todays_day_of_phase,
    po.daysinthisprogramphase,
    CASE 
        WHEN po.daysinthisprogramphase = (pp.end_date - pp.start_date) + 1
        THEN 'Correct ✅' 
        ELSE 'Incorrect ❌' 
    END as validation
FROM petri_observations po
JOIN pilot_programs pp ON po.program_id = pp.program_id
ORDER BY pp.start_date, po.created_at
LIMIT 15;