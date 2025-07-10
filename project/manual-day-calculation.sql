-- Manual day calculation for sandbox database
-- Replace the start_date values with your actual program start dates

-- For program_id: 711262df-cf5e-47cd-bb7c-f5d92804fea9
-- Replace '2025-06-17' with the actual start date of this program
UPDATE petri_observations 
SET todays_day_of_phase = (DATE(created_at) - DATE('2025-06-17')) + 1
WHERE program_id = '711262df-cf5e-47cd-bb7c-f5d92804fea9' 
AND created_at IS NOT NULL;

-- If you have other program IDs, add similar UPDATE statements for each:
-- UPDATE petri_observations 
-- SET todays_day_of_phase = (DATE(created_at) - DATE('YYYY-MM-DD')) + 1
-- WHERE program_id = 'other-program-uuid' 
-- AND created_at IS NOT NULL;

-- Ensure minimum value of 1
UPDATE petri_observations 
SET todays_day_of_phase = 1 
WHERE todays_day_of_phase < 1;

-- Verify the results
SELECT 
  program_id,
  created_at::date,
  todays_day_of_phase,
  COUNT(*) as record_count
FROM petri_observations 
WHERE program_id IS NOT NULL
GROUP BY program_id, created_at::date, todays_day_of_phase
ORDER BY program_id, created_at::date;