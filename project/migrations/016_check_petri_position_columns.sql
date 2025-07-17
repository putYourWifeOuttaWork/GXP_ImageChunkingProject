-- Check position/coordinate columns in petri_observations
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'petri_observations'
    AND table_schema = 'public'
    AND (column_name LIKE '%position%' OR column_name LIKE '%x%' OR column_name LIKE '%y%' OR column_name LIKE '%footage%')
ORDER BY column_name;

-- Also check all columns to see what we have
SELECT 
    column_name
FROM information_schema.columns
WHERE table_name = 'petri_observations'
    AND table_schema = 'public'
ORDER BY ordinal_position;