-- Check the exact column names in both tables
SELECT 
    table_name,
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('petri_observations', 'petri_observations_partitioned')
  AND column_name ILIKE '%days%'
ORDER BY table_name, ordinal_position;

-- Also check all columns in partitioned table
SELECT 
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'petri_observations_partitioned'
ORDER BY ordinal_position;