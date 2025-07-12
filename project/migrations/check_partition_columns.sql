-- Check actual columns in partitioned tables
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'petri_observations_partitioned'
ORDER BY ordinal_position;