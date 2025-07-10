-- Fix the program_id relationship in sandbox database
-- Run this in your Supabase SQL editor for project: avjoiiqbampztgteqrph

-- First, check if pilot_programs table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'pilot_programs';

-- If pilot_programs table exists, add the foreign key constraint
-- (Only run this if the table exists and has matching program_id values)
ALTER TABLE petri_observations 
ADD CONSTRAINT fk_petri_observations_program_id 
FOREIGN KEY (program_id) 
REFERENCES pilot_programs(program_id);

-- Then update the todays_day_of_phase values
UPDATE petri_observations 
SET todays_day_of_phase = calculate_day_of_phase(program_id::uuid, created_at)
WHERE program_id IS NOT NULL AND created_at IS NOT NULL;