-- Fix the sync triggers to only be on the source tables, not the partitioned tables

-- First check what triggers exist where
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    CASE 
        WHEN tgrelid::regclass::text = 'petri_observations' THEN 'SOURCE TABLE - KEEP'
        WHEN tgrelid::regclass::text = 'gasifier_observations' THEN 'SOURCE TABLE - KEEP'
        ELSE 'PARTITIONED/CHILD TABLE - REMOVE'
    END as action
FROM pg_trigger
WHERE tgname IN ('sync_gasifier_observations_trigger', 'sync_petri_observations_trigger')
ORDER BY action, table_name;

-- The issue is that the trigger was mistakenly created on petri_observations_partitioned
-- which then inherited to all child partitions. We need to drop it from the parent first.

-- Drop triggers from partitioned parent tables (this will cascade to children)
DROP TRIGGER IF EXISTS sync_petri_observations_trigger ON petri_observations_partitioned CASCADE;
DROP TRIGGER IF EXISTS sync_gasifier_observations_trigger ON gasifier_observations_partitioned CASCADE;

-- Drop any other partition triggers that might exist
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Find and drop triggers on all petri partition tables
    FOR r IN (
        SELECT DISTINCT 
            tgname,
            tgrelid::regclass::text as table_name
        FROM pg_trigger
        WHERE tgname = 'sync_petri_observations_trigger'
        AND tgrelid::regclass::text LIKE 'petri_obs_%'
    )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', r.tgname, r.table_name);
    END LOOP;
    
    -- Find and drop triggers on all gasifier partition tables
    FOR r IN (
        SELECT DISTINCT 
            tgname,
            tgrelid::regclass::text as table_name
        FROM pg_trigger
        WHERE tgname = 'sync_gasifier_observations_trigger'
        AND tgrelid::regclass::text LIKE 'gasifier_obs_%'
    )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', r.tgname, r.table_name);
    END LOOP;
END $$;

-- Now verify the triggers are only on the source tables
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    CASE tgenabled 
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        ELSE 'UNKNOWN'
    END as status
FROM pg_trigger
WHERE tgname IN ('sync_gasifier_observations_trigger', 'sync_petri_observations_trigger')
ORDER BY table_name;

-- The result should only show:
-- sync_gasifier_observations_trigger on gasifier_observations
-- sync_petri_observations_trigger on petri_observations