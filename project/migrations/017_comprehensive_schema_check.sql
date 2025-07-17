-- COMPREHENSIVE SCHEMA CHECK FOR SUBMISSION CREATION

-- 1. Check exact structure of submissions table
SELECT '=== SUBMISSIONS TABLE ===' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'submissions'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check exact structure of submission_sessions table
SELECT '=== SUBMISSION_SESSIONS TABLE ===' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'submission_sessions'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check exact structure of gasifier_observations table
SELECT '=== GASIFIER_OBSERVATIONS TABLE ===' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'gasifier_observations'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check exact structure of petri_observations table
SELECT '=== PETRI_OBSERVATIONS TABLE ===' as section;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'petri_observations'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Check what the gasifier_defaults look like in the database
SELECT '=== SAMPLE GASIFIER DEFAULTS ===' as section;
SELECT 
    site_id,
    gasifier_defaults
FROM sites
WHERE site_id = '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9';

-- 6. Check what the petri_defaults look like in the database
SELECT '=== SAMPLE PETRI DEFAULTS ===' as section;
SELECT 
    site_id,
    petri_defaults
FROM sites
WHERE site_id = '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9';

-- 7. Check existing gasifier observations to see what data looks like
SELECT '=== SAMPLE GASIFIER OBSERVATIONS ===' as section;
SELECT * FROM gasifier_observations
WHERE site_id = '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9'
LIMIT 2;

-- 8. Check existing petri observations to see what data looks like
SELECT '=== SAMPLE PETRI OBSERVATIONS ===' as section;
SELECT * FROM petri_observations
WHERE site_id = '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9'
LIMIT 2;

-- 9. Check the get_current_program_phase_info function return structure
SELECT '=== PROGRAM PHASE INFO FUNCTION ===' as section;
SELECT * FROM get_current_program_phase_info('3ed8dc59-2744-41f9-b751-038ea2385063');

-- 10. Check all enum types we're using
SELECT '=== ENUM TYPES ===' as section;
SELECT 
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
    'airflow_enum',
    'odor_distance_enum', 
    'weather_enum',
    'chemical_type_enum',
    'placement_height_enum',
    'directional_placement_enum',
    'placement_strategy_enum',
    'fungicide_enum',
    'water_schedule_enum',
    'session_status_enum'
)
GROUP BY t.typname;