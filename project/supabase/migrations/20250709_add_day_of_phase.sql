-- Add todays_day_of_phase column to petri_observations table
-- This column will store the day number within the program phase when the observation was created

-- Add the column
ALTER TABLE petri_observations 
ADD COLUMN todays_day_of_phase INTEGER;

-- Create a function to calculate the day of phase
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

-- Create trigger function to automatically calculate day of phase
CREATE OR REPLACE FUNCTION update_day_of_phase()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate and set the day of phase for new/updated records
  NEW.todays_day_of_phase := calculate_day_of_phase(NEW.program_id, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger that fires on INSERT and UPDATE
CREATE TRIGGER trigger_update_day_of_phase
  BEFORE INSERT OR UPDATE ON petri_observations
  FOR EACH ROW
  EXECUTE FUNCTION update_day_of_phase();

-- Update existing records to populate the new column
-- First, let's see what we're working with
DO $$
DECLARE
  total_records INTEGER;
  records_with_program INTEGER;
  records_updated INTEGER;
BEGIN
  -- Count total records
  SELECT COUNT(*) INTO total_records FROM petri_observations;
  
  -- Count records with program_id
  SELECT COUNT(*) INTO records_with_program 
  FROM petri_observations 
  WHERE program_id IS NOT NULL AND created_at IS NOT NULL;
  
  RAISE NOTICE 'Starting retroactive update for todays_day_of_phase column';
  RAISE NOTICE 'Total petri_observations records: %', total_records;
  RAISE NOTICE 'Records with program_id and created_at: %', records_with_program;
  
  -- Perform the update
  UPDATE petri_observations 
  SET todays_day_of_phase = calculate_day_of_phase(program_id, created_at)
  WHERE program_id IS NOT NULL AND created_at IS NOT NULL;
  
  -- Get count of updated records
  GET DIAGNOSTICS records_updated = ROW_COUNT;
  
  RAISE NOTICE 'Successfully updated % records', records_updated;
END $$;

-- Verification query: Show sample of updated records
DO $$
DECLARE
  sample_record RECORD;
BEGIN
  RAISE NOTICE 'Sample of updated records:';
  RAISE NOTICE '========================';
  
  FOR sample_record IN (
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
    LIMIT 5
  ) LOOP
    RAISE NOTICE 'Observation: % | Date: % | Program Start: % | Day of Phase: % | Program: %', 
      sample_record.observation_id, 
      sample_record.observation_date, 
      sample_record.program_start_date, 
      sample_record.todays_day_of_phase,
      sample_record.program_name;
  END LOOP;
END $$;

-- Create an index on the new column for better query performance
CREATE INDEX idx_petri_observations_day_of_phase ON petri_observations(todays_day_of_phase);

-- Add a comment to document the column
COMMENT ON COLUMN petri_observations.todays_day_of_phase IS 
'The day number within the program phase when this observation was created. Day 1 = program start date. This value is immutable once set.';

-- Optional: Add a check constraint to ensure positive values
ALTER TABLE petri_observations 
ADD CONSTRAINT check_day_of_phase_positive 
CHECK (todays_day_of_phase IS NULL OR todays_day_of_phase > 0);