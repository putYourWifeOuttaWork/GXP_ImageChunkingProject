-- Fix triggers that reference the dropped column

-- 1. Find all triggers on petri_observations
SELECT 
  tg.trigger_name,
  tg.event_manipulation,
  tg.event_object_table,
  tg.action_statement,
  pg_get_functiondef(p.oid) as function_definition
FROM information_schema.triggers tg
JOIN pg_proc p ON p.proname = tg.action_statement::text
WHERE tg.event_object_table = 'petri_observations'
  AND pg_get_functiondef(p.oid) LIKE '%daysinthisprogramphase%';

-- 2. Show the problematic function
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'preserve_petri_static_fields';

-- 3. Fix the trigger function by updating it to use the correct column name
CREATE OR REPLACE FUNCTION preserve_petri_static_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Preserve original values for static fields
  IF TG_OP = 'UPDATE' THEN
    NEW.created_at = OLD.created_at;
    NEW.site_id = OLD.site_id;
    NEW.submission_id = OLD.submission_id;
    NEW.petri_code = OLD.petri_code;
    
    -- Fix: Use the correct column name (camelCase version)
    IF NEW.daysInThisProgramPhase IS NULL OR NEW.daysInThisProgramPhase = 0 THEN
      NEW.daysInThisProgramPhase = OLD.daysInThisProgramPhase;
    END IF;
    
    -- Preserve other fields that shouldn't change
    IF NEW.x_position IS NULL THEN
      NEW.x_position = OLD.x_position;
    END IF;
    
    IF NEW.y_position IS NULL THEN
      NEW.y_position = OLD.y_position;
    END IF;
    
    IF NEW.footage_from_origin_x IS NULL THEN
      NEW.footage_from_origin_x = OLD.footage_from_origin_x;
    END IF;
    
    IF NEW.footage_from_origin_y IS NULL THEN
      NEW.footage_from_origin_y = OLD.footage_from_origin_y;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. List all triggers to verify
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public'
  AND c.relname = 'petri_observations'
ORDER BY t.tgname;