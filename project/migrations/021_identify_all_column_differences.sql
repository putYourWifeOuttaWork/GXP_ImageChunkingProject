-- COMPREHENSIVE COLUMN DIFFERENCE ANALYSIS
-- This will identify ALL columns that exist in partitioned tables but NOT in source tables

-- ========================================
-- GASIFIER OBSERVATIONS COLUMN ANALYSIS
-- ========================================

-- Get all columns from gasifier_observations (source table)
WITH source_gasifier_cols AS (
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'gasifier_observations' 
    AND table_schema = 'public'
),
-- Get all columns from gasifier_observations_partitioned
partitioned_gasifier_cols AS (
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'gasifier_observations_partitioned' 
    AND table_schema = 'public'
)
-- Find columns in partitioned but NOT in source
SELECT 
    'GASIFIER' as table_type,
    p.column_name as missing_column,
    p.data_type,
    p.is_nullable,
    'Column exists in gasifier_observations_partitioned but NOT in gasifier_observations' as issue
FROM partitioned_gasifier_cols p
LEFT JOIN source_gasifier_cols s ON p.column_name = s.column_name
WHERE s.column_name IS NULL

UNION ALL

-- ========================================
-- PETRI OBSERVATIONS COLUMN ANALYSIS
-- ========================================

-- Get all columns from petri_observations (source table)
WITH source_petri_cols AS (
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'petri_observations' 
    AND table_schema = 'public'
),
-- Get all columns from petri_observations_partitioned
partitioned_petri_cols AS (
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'petri_observations_partitioned' 
    AND table_schema = 'public'
)
-- Find columns in partitioned but NOT in source
SELECT 
    'PETRI' as table_type,
    p.column_name as missing_column,
    p.data_type,
    p.is_nullable,
    'Column exists in petri_observations_partitioned but NOT in petri_observations' as issue
FROM partitioned_petri_cols p
LEFT JOIN source_petri_cols s ON p.column_name = s.column_name
WHERE s.column_name IS NULL

ORDER BY table_type, missing_column;

-- ========================================
-- DETAILED COLUMN COMPARISON
-- ========================================

-- Show all columns for gasifier tables side by side
SELECT 
    COALESCE(s.column_name, p.column_name) as column_name,
    s.data_type as source_type,
    p.data_type as partitioned_type,
    CASE 
        WHEN s.column_name IS NULL THEN 'MISSING IN SOURCE'
        WHEN p.column_name IS NULL THEN 'MISSING IN PARTITIONED'
        WHEN s.data_type != p.data_type THEN 'TYPE MISMATCH'
        ELSE 'OK'
    END as status
FROM (
    SELECT column_name, data_type, ordinal_position
    FROM information_schema.columns
    WHERE table_name = 'gasifier_observations' AND table_schema = 'public'
) s
FULL OUTER JOIN (
    SELECT column_name, data_type, ordinal_position
    FROM information_schema.columns
    WHERE table_name = 'gasifier_observations_partitioned' AND table_schema = 'public'
) p ON s.column_name = p.column_name
WHERE s.column_name IS NULL OR p.column_name IS NULL OR s.data_type != p.data_type
ORDER BY COALESCE(s.ordinal_position, p.ordinal_position);

-- ========================================
-- CHECK FOR ENUM TYPES THAT MIGHT BE NEEDED
-- ========================================

-- Find all custom enum types used by the partitioned tables
SELECT DISTINCT
    t.typname as enum_type,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM information_schema.columns c
JOIN pg_type t ON t.typname = c.udt_name
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE c.table_name IN ('gasifier_observations_partitioned', 'petri_observations_partitioned')
AND c.table_schema = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- ========================================
-- TRIGGER FUNCTION ANALYSIS
-- ========================================

-- Check which columns the sync trigger is trying to copy that don't exist
SELECT 
    'Sync trigger tries to copy these columns that DO NOT exist in source:' as analysis;

-- For gasifier
SELECT 
    'gasifier_observations' as table_name,
    'forecasted_expiration' as problematic_column,
    'timestamp without time zone' as data_type,
    'Column added by migration but not in source table' as reason
UNION ALL
SELECT 
    'gasifier_observations' as table_name,
    'trend_gasifier_velocity' as problematic_column,
    'trend_category (enum)' as data_type,
    'Column added by migration but not in source table' as reason
UNION ALL
-- For petri
SELECT 
    'petri_observations' as table_name,
    'trend_petri_velocity' as problematic_column,
    'petri_trend_category (enum)' as data_type,
    'Column added by migration but not in source table' as reason
UNION ALL
SELECT 
    'petri_observations' as table_name,
    'experiment_role' as problematic_column,
    'experiment_role (enum)' as data_type,
    'Column added by migration but not in source table' as reason;

-- ========================================
-- COMPREHENSIVE FIX NEEDED
-- ========================================

SELECT 
    '
    THE PROBLEM:
    The sync trigger (migration 018) tries to copy columns from source tables that dont exist there.
    These columns were added ONLY to the partitioned tables by various migrations.
    
    COLUMNS THAT NEED TO BE REMOVED FROM SYNC TRIGGER:
    
    For gasifier_observations_partitioned:
    - forecasted_expiration (timestamp)
    - trend_gasifier_velocity (trend_category enum) 
    - Possibly: trend (varchar or trend_category enum)
    
    For petri_observations_partitioned:
    - trend_petri_velocity (petri_trend_category enum)
    - experiment_role (experiment_role enum)
    - split_image_status (if it exists only in partitioned)
    
    SOLUTION:
    Update the sync trigger functions to NOT copy these calculated columns.
    They should be set to NULL on insert and calculated by triggers on the partitioned table.
    ' as fix_summary;