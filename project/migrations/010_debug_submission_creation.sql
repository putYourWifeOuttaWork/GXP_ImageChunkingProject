-- Debug query to check site and company relationships
-- Run this to verify your site has a company_id

-- Check if sites have company_id
SELECT 
    s.site_id,
    s.site_code,
    s.company_id,
    c.name as company_name
FROM sites s
LEFT JOIN companies c ON s.company_id = c.company_id
WHERE s.site_id = 'YOUR_SITE_ID_HERE';  -- Replace with the actual site_id from the error

-- Check all sites without company_id
SELECT 
    site_id,
    site_code,
    company_id
FROM sites
WHERE company_id IS NULL;

-- Check the structure of submissions table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'submissions'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check the structure of gasifier_observations table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'gasifier_observations'
    AND table_schema = 'public'
    AND column_name IN ('company_id', 'site_id', 'submission_id')
ORDER BY ordinal_position;

-- Check the structure of petri_observations table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'petri_observations'
    AND table_schema = 'public'
    AND column_name IN ('company_id', 'site_id', 'submission_id')
ORDER BY ordinal_position;