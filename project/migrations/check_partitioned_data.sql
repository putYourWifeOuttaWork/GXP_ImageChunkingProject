-- Check if partitioned tables have data
SELECT 
    'petri_observations_partitioned' as table_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT program_id) as distinct_programs,
    COUNT(DISTINCT site_id) as distinct_sites,
    COUNT(DISTINCT submission_id) as distinct_submissions
FROM petri_observations_partitioned

UNION ALL

SELECT 
    'gasifier_observations_partitioned' as table_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT program_id) as distinct_programs,
    COUNT(DISTINCT site_id) as distinct_sites,
    COUNT(DISTINCT submission_id) as distinct_submissions
FROM gasifier_observations_partitioned

UNION ALL

-- Check the original tables for comparison
SELECT 
    'petri_observations (original)' as table_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT submission_id) as distinct_programs,
    0 as distinct_sites,
    COUNT(DISTINCT submission_id) as distinct_submissions
FROM petri_observations

UNION ALL

SELECT 
    'gasifier_observations (original)' as table_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT submission_id) as distinct_programs,
    0 as distinct_sites,
    COUNT(DISTINCT submission_id) as distinct_submissions
FROM gasifier_observations;

-- Check a sample of data from partitioned table
SELECT * FROM petri_observations_partitioned LIMIT 5;