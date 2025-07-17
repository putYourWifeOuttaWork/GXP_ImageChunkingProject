-- Test the create_submission_session function with actual data
-- This will help us see the exact error

-- First, let's check if the function exists with the right signature
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'create_submission_session';

-- Test creating a submission with minimal data
SELECT create_submission_session(
    '3ed8dc59-2744-41f9-b751-038ea2385063'::UUID,  -- program_id (Sandhill Period 2)
    '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9'::UUID,  -- site_id
    jsonb_build_object(
        'temperature', 84,
        'humidity', 75,
        'airflow', 'Open',
        'odor_distance', '5-10ft',
        'weather', 'Cloudy',
        'notes', 'Test submission'
    ),
    NULL,  -- No gasifier templates for this test
    NULL   -- No petri templates for this test
);

-- If the above fails, let's check what columns exist in submissions table
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'submissions' 
AND table_schema = 'public'
AND column_name = 'company_id';

-- Check if there are any recent failed submission attempts
SELECT 
    submission_id,
    site_id,
    company_id,
    created_at
FROM submissions
WHERE site_id = '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9'
ORDER BY created_at DESC
LIMIT 5;