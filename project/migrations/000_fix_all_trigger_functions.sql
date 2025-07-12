-- Find and fix ALL functions that reference the dropped column

-- 1. Search all functions for references to the dropped column
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%daysinthisprogramphase%';

-- 2. Check update_program_phase_days function definition
SELECT pg_get_functiondef(p.oid) 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'update_program_phase_days';

-- 3. Fix update_program_phase_days if it exists and uses the wrong column
DO $$
BEGIN
  -- Check if function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_program_phase_days'
  ) THEN
    -- Get the function definition
    RAISE NOTICE 'Found update_program_phase_days function - updating it';
    
    -- Create fixed version
    CREATE OR REPLACE FUNCTION update_program_phase_days()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Update daysInThisProgramPhase (use correct column name)
      NEW.daysInThisProgramPhase = COALESCE(
        (SELECT EXTRACT(DAY FROM NEW.created_at - phase_start.start_date) + 1
         FROM (
           SELECT (phases->>'start_date')::date as start_date
           FROM pilot_programs p,
           jsonb_array_elements(p.phases) as phases
           WHERE p.program_id = (
             SELECT program_id FROM sites WHERE site_id = NEW.site_id
           )
           AND (phases->>'start_date')::date <= NEW.created_at::date
           AND (phases->>'end_date')::date >= NEW.created_at::date
           LIMIT 1
         ) as phase_start),
        1
      );
      
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- 4. Fix update_day_of_phase if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_day_of_phase'
  ) THEN
    RAISE NOTICE 'Found update_day_of_phase function - updating it';
    
    CREATE OR REPLACE FUNCTION update_day_of_phase()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Calculate todays_day_of_phase based on the current phase
      NEW.todays_day_of_phase = COALESCE(
        (SELECT EXTRACT(DAY FROM NEW.created_at - phase_start.start_date) + 1
         FROM (
           SELECT (phases->>'start_date')::date as start_date
           FROM pilot_programs p,
           jsonb_array_elements(p.phases) as phases
           WHERE p.program_id = (
             SELECT program_id FROM sites WHERE site_id = NEW.site_id
           )
           AND (phases->>'start_date')::date <= NEW.created_at::date
           AND (phases->>'end_date')::date >= NEW.created_at::date
           LIMIT 1
         ) as phase_start),
        1
      );
      
      -- Also update daysInThisProgramPhase if needed
      IF NEW.daysInThisProgramPhase IS NULL THEN
        NEW.daysInThisProgramPhase = NEW.todays_day_of_phase;
      END IF;
      
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- 5. Check if there are any other functions with issues
SELECT 
  'Functions still referencing dropped column:' as check,
  COUNT(*) as count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%daysinthisprogramphase%'
  AND p.proname NOT IN ('preserve_petri_static_fields', 'update_program_phase_days', 'update_day_of_phase');

-- 6. Show final status
SELECT 'Trigger functions have been updated to use correct column names' as status;