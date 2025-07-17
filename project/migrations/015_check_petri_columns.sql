-- Check what columns exist in petri_observations table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'petri_observations'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Specifically check for growth-related columns
SELECT 
    column_name
FROM information_schema.columns
WHERE table_name = 'petri_observations'
    AND table_schema = 'public'
    AND column_name LIKE '%growth%';