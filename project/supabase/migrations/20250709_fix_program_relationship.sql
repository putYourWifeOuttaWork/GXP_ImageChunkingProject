-- Fix program_id relationship and update todays_day_of_phase calculation
-- Run this in your Supabase SQL editor for project: avjoiiqbampztgteqrph

-- First, let's check the current state
DO $$
BEGIN
    RAISE NOTICE 'Checking current foreign key constraints on petri_observations...';
END $$;

-- Check if foreign key constraint already exists
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'petri_observations'
    AND kcu.column_name = 'program_id';

-- Convert program_id column to UUID type if it's not already
DO $$
BEGIN
    -- Check if program_id is already UUID type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'petri_observations' 
        AND column_name = 'program_id' 
        AND data_type = 'uuid'
    ) THEN
        -- Convert text to UUID
        ALTER TABLE petri_observations 
        ALTER COLUMN program_id TYPE UUID USING program_id::UUID;
        
        RAISE NOTICE 'Converted program_id column to UUID type';
    ELSE
        RAISE NOTICE 'program_id column is already UUID type';
    END IF;
END $$;

-- Add the foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_petri_observations_program_id' 
        AND table_name = 'petri_observations'
    ) THEN
        ALTER TABLE petri_observations 
        ADD CONSTRAINT fk_petri_observations_program_id 
        FOREIGN KEY (program_id) 
        REFERENCES pilot_programs(program_id);
        
        RAISE NOTICE 'Added foreign key constraint for program_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;
END $$;

-- Recreate the calculation function to ensure it works correctly
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

-- Update all existing records with correct day calculations
DO $$
DECLARE
    records_updated INTEGER;
BEGIN
    RAISE NOTICE 'Starting update of todays_day_of_phase values...';
    
    UPDATE petri_observations 
    SET todays_day_of_phase = calculate_day_of_phase(program_id, created_at)
    WHERE program_id IS NOT NULL AND created_at IS NOT NULL;
    
    GET DIAGNOSTICS records_updated = ROW_COUNT;
    
    RAISE NOTICE 'Updated % records with new day_of_phase calculations', records_updated;
END $$;

-- Create/recreate the trigger for automatic updates
CREATE OR REPLACE FUNCTION update_day_of_phase()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate and set the day of phase for new/updated records
  NEW.todays_day_of_phase := calculate_day_of_phase(NEW.program_id, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_day_of_phase ON petri_observations;

CREATE TRIGGER trigger_update_day_of_phase
  BEFORE INSERT OR UPDATE ON petri_observations
  FOR EACH ROW
  EXECUTE FUNCTION update_day_of_phase();

-- Verification queries
DO $$
BEGIN
    RAISE NOTICE 'Verification Results:';
    RAISE NOTICE '==================';
END $$;

-- Show sample of updated records
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
    ROUND(AVG(todays_day_of_phase), 2) as avg_day
FROM petri_observations
WHERE program_id IS NOT NULL;

-- Check by program
SELECT 
    pp.name as program_name,
    pp.start_date,
    COUNT(po.observation_id) as total_observations,
    MIN(po.todays_day_of_phase) as min_day,
    MAX(po.todays_day_of_phase) as max_day
FROM petri_observations po
JOIN pilot_programs pp ON po.program_id = pp.program_id
GROUP BY pp.name, pp.start_date
ORDER BY pp.start_date;