-- COMPREHENSIVE FIX: Add ALL missing columns to source tables
-- This will ensure sync triggers work properly

-- ========================================
-- GASIFIER OBSERVATIONS - ADD MISSING COLUMNS
-- ========================================

-- These columns were added to gasifier_observations_partitioned but NOT to gasifier_observations:

-- 1. forecasted_expiration (from add_trend_and_forecast_columns.sql)
ALTER TABLE gasifier_observations 
ADD COLUMN IF NOT EXISTS forecasted_expiration timestamp;

-- 2. trend_gasifier_velocity (from fix_trend_triggers_corrected.sql)
-- First ensure the enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trend_category') THEN
        CREATE TYPE trend_category AS ENUM (
            'CRITICAL_ACCELERATION',
            'HIGH_ACCELERATION',
            'MODERATE_ACCELERATION',
            'STABLE',
            'MODERATE_DECELERATION',
            'HIGH_DECELERATION',
            'CRITICAL_DECELERATION',
            'INSUFFICIENT_DATA'
        );
    END IF;
END$$;

ALTER TABLE gasifier_observations 
ADD COLUMN IF NOT EXISTS trend_gasifier_velocity trend_category;

-- 3. trend column (from add_trend_and_forecast_columns.sql)
-- This might have been added as varchar(50) or trend_category
ALTER TABLE gasifier_observations 
ADD COLUMN IF NOT EXISTS trend varchar(50);

-- ========================================
-- PETRI OBSERVATIONS - ADD MISSING COLUMNS
-- ========================================

-- These columns were added to petri_observations_partitioned but NOT to petri_observations:

-- 1. trend_petri_velocity (from petri_trend_enum.sql)
-- First ensure the enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'petri_trend_category') THEN
        CREATE TYPE petri_trend_category AS ENUM (
            'EXPLOSIVE_GROWTH',
            'RAPID_GROWTH',
            'MODERATE_GROWTH',
            'STABLE_GROWTH',
            'DECLINING',
            'RAPID_DECLINE',
            'CRITICAL_DECLINE',
            'INSUFFICIENT_DATA'
        );
    END IF;
END$$;

ALTER TABLE petri_observations 
ADD COLUMN IF NOT EXISTS trend_petri_velocity petri_trend_category;

-- 2. experiment_role (from petri_experiment_role_enum.sql)
-- First ensure the enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'experiment_role') THEN
        CREATE TYPE experiment_role AS ENUM (
            'CONTROL',
            'EXPERIMENTAL',
            'REFERENCE',
            'UNKNOWN'
        );
    END IF;
END$$;

ALTER TABLE petri_observations 
ADD COLUMN IF NOT EXISTS experiment_role experiment_role;

-- 3. split_image_status (appears to already exist based on sync trigger)
-- This column is referenced in the sync trigger but let's ensure it exists
ALTER TABLE petri_observations 
ADD COLUMN IF NOT EXISTS split_image_status text;

-- 4. daysinthisprogramphase and todays_day_of_phase (referenced in sync)
ALTER TABLE petri_observations 
ADD COLUMN IF NOT EXISTS daysinthisprogramphase numeric DEFAULT 0;

ALTER TABLE petri_observations 
ADD COLUMN IF NOT EXISTS todays_day_of_phase numeric DEFAULT 0;

-- 5. yesterday_growth_index (referenced in sync)
ALTER TABLE petri_observations 
ADD COLUMN IF NOT EXISTS yesterday_growth_index numeric;

-- ========================================
-- VERIFY ALL COLUMNS NOW MATCH
-- ========================================

-- Check gasifier tables have matching columns
WITH source_cols AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'gasifier_observations' 
    AND table_schema = 'public'
),
partitioned_cols AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'gasifier_observations_partitioned' 
    AND table_schema = 'public'
)
SELECT 
    'Gasifier columns still missing in source:' as check_type,
    array_agg(p.column_name) as missing_columns
FROM partitioned_cols p
LEFT JOIN source_cols s ON p.column_name = s.column_name
WHERE s.column_name IS NULL
HAVING COUNT(*) > 0;

-- Check petri tables have matching columns
WITH source_cols AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'petri_observations' 
    AND table_schema = 'public'
),
partitioned_cols AS (
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'petri_observations_partitioned' 
    AND table_schema = 'public'
)
SELECT 
    'Petri columns still missing in source:' as check_type,
    array_agg(p.column_name) as missing_columns
FROM partitioned_cols p
LEFT JOIN source_cols s ON p.column_name = s.column_name
WHERE s.column_name IS NULL
HAVING COUNT(*) > 0;

-- ========================================
-- UPDATE SYNC TRIGGERS (CRITICAL!)
-- ========================================

-- Now we need to update the sync triggers to handle the new columns properly
-- The sync triggers should copy all columns INCLUDING the new ones

-- Drop and recreate the gasifier sync function
DROP FUNCTION IF EXISTS sync_gasifier_to_partitioned() CASCADE;

CREATE OR REPLACE FUNCTION sync_gasifier_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert into partitioned table with ALL columns
        INSERT INTO gasifier_observations_partitioned 
        SELECT NEW.*
        ON CONFLICT (observation_id, program_id) DO NOTHING;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update in partitioned table
        DELETE FROM gasifier_observations_partitioned
        WHERE observation_id = NEW.observation_id 
          AND program_id = NEW.program_id;
          
        INSERT INTO gasifier_observations_partitioned 
        SELECT NEW.*
        ON CONFLICT (observation_id, program_id) DO NOTHING;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Delete from partitioned table
        DELETE FROM gasifier_observations_partitioned
        WHERE observation_id = OLD.observation_id
          AND program_id = OLD.program_id;
        
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the petri sync function
DROP FUNCTION IF EXISTS sync_petri_to_partitioned() CASCADE;

CREATE OR REPLACE FUNCTION sync_petri_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert into partitioned table with ALL columns
        INSERT INTO petri_observations_partitioned 
        SELECT NEW.*
        ON CONFLICT (observation_id, program_id) DO NOTHING;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update in partitioned table
        DELETE FROM petri_observations_partitioned
        WHERE observation_id = NEW.observation_id 
          AND program_id = NEW.program_id;
          
        INSERT INTO petri_observations_partitioned 
        SELECT NEW.*
        ON CONFLICT (observation_id, program_id) DO NOTHING;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Delete from partitioned table
        DELETE FROM petri_observations_partitioned
        WHERE observation_id = OLD.observation_id
          AND program_id = OLD.program_id;
        
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER sync_gasifier_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON gasifier_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_gasifier_to_partitioned();

CREATE TRIGGER sync_petri_observations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON petri_observations
    FOR EACH ROW
    EXECUTE FUNCTION sync_petri_to_partitioned();

-- ========================================
-- IMPORTANT NOTES
-- ========================================

COMMENT ON FUNCTION sync_gasifier_to_partitioned() IS 
'Syncs ALL columns from gasifier_observations to gasifier_observations_partitioned.
Now includes: forecasted_expiration, trend_gasifier_velocity, trend';

COMMENT ON FUNCTION sync_petri_to_partitioned() IS 
'Syncs ALL columns from petri_observations to petri_observations_partitioned.
Now includes: trend_petri_velocity, experiment_role, split_image_status, 
daysinthisprogramphase, todays_day_of_phase, yesterday_growth_index';

-- ========================================
-- SUMMARY OF CHANGES
-- ========================================
SELECT '
COLUMNS ADDED TO SOURCE TABLES:

gasifier_observations:
- forecasted_expiration (timestamp)
- trend_gasifier_velocity (trend_category enum)
- trend (varchar 50)

petri_observations:
- trend_petri_velocity (petri_trend_category enum)
- experiment_role (experiment_role enum)
- split_image_status (text)
- daysinthisprogramphase (numeric)
- todays_day_of_phase (numeric)
- yesterday_growth_index (numeric)

SYNC TRIGGERS UPDATED:
- Now use SELECT NEW.* to copy ALL columns
- This ensures any future columns are automatically synced
' as summary;