-- Simpler approach to find and fix trigger functions

-- 1. List all trigger functions on petri_observations
SELECT DISTINCT
  p.proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'petri_observations'::regclass
  AND p.proname NOT LIKE 'RI_%'  -- Skip foreign key triggers
ORDER BY p.proname;

-- 2. Check the source of specific functions that might have the issue
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc
WHERE proname IN (
  'preserve_petri_static_fields',
  'update_program_phase_days',
  'update_day_of_phase',
  'log_petri_observation_history'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Since we know preserve_petri_static_fields was already fixed, 
-- let's check if the error is from a different function
-- First, let's disable the problematic triggers temporarily
ALTER TABLE petri_observations DISABLE TRIGGER update_petri_observation_metadata;
ALTER TABLE petri_observations DISABLE TRIGGER trigger_update_program_phase_days;
ALTER TABLE petri_observations DISABLE TRIGGER trigger_update_day_of_phase;

-- 4. Try to run a simple update to see which trigger fails
-- This will help identify the exact problematic function
DO $$
DECLARE
  v_test_id uuid;
BEGIN
  -- Get a sample observation ID
  SELECT observation_id INTO v_test_id
  FROM petri_observations
  LIMIT 1;
  
  IF v_test_id IS NOT NULL THEN
    -- Try a simple update
    UPDATE petri_observations 
    SET notes = notes
    WHERE observation_id = v_test_id;
    
    RAISE NOTICE 'Update succeeded without the disabled triggers';
  END IF;
END $$;

-- 5. Re-enable triggers
ALTER TABLE petri_observations ENABLE TRIGGER update_petri_observation_metadata;
ALTER TABLE petri_observations ENABLE TRIGGER trigger_update_program_phase_days;
ALTER TABLE petri_observations ENABLE TRIGGER trigger_update_day_of_phase;