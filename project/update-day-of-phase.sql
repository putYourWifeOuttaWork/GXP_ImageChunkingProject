-- Update todays_day_of_phase column with correct values
-- Run this SQL in your Supabase dashboard SQL editor

-- First, create the calculation function
CREATE OR REPLACE FUNCTION calculate_day_of_phase(
  p_program_id UUID,
  p_created_at TIMESTAMP WITH TIME ZONE
) RETURNS INTEGER AS $$
DECLARE
  program_start_date DATE;
  days_difference INTEGER;
BEGIN
  -- Get the start date of the program
  SELECT start_date INTO program_start_date
  FROM pilot_programs
  WHERE program_id = p_program_id;
  
  -- If no program found, return NULL
  IF program_start_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate days difference (adding 1 to start from day 1, not day 0)
  days_difference := (DATE(p_created_at) - program_start_date) + 1;
  
  -- Return the result (ensuring it's at least 1)
  RETURN GREATEST(days_difference, 1);
END;
$$ LANGUAGE plpgsql;

-- Update all existing records
UPDATE petri_observations 
SET todays_day_of_phase = calculate_day_of_phase(program_id, created_at)
WHERE program_id IS NOT NULL AND created_at IS NOT NULL;

-- Create trigger function to automatically calculate day of phase
CREATE OR REPLACE FUNCTION update_day_of_phase()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate and set the day of phase for new/updated records
  NEW.todays_day_of_phase := calculate_day_of_phase(NEW.program_id, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_day_of_phase ON petri_observations;

-- Create the trigger that fires on INSERT and UPDATE
CREATE TRIGGER trigger_update_day_of_phase
  BEFORE INSERT OR UPDATE ON petri_observations
  FOR EACH ROW
  EXECUTE FUNCTION update_day_of_phase();

-- Verification query: Show sample of updated records
SELECT 
  po.observation_id,
  po.created_at::DATE as observation_date,
  pp.start_date as program_start_date,
  po.todays_day_of_phase,
  pp.name as program_name
FROM petri_observations po
JOIN pilot_programs pp ON po.program_id = pp.program_id
WHERE po.todays_day_of_phase IS NOT NULL
ORDER BY po.created_at
LIMIT 10;

-- Summary statistics
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN todays_day_of_phase IS NOT NULL THEN 1 END) as records_with_day_of_phase,
  MIN(todays_day_of_phase) as min_day,
  MAX(todays_day_of_phase) as max_day,
  AVG(todays_day_of_phase) as avg_day
FROM petri_observations
WHERE program_id IS NOT NULL;