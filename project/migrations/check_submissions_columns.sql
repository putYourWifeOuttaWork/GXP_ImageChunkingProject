-- Check column names in submissions table
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'submissions' 
  AND table_schema = 'public'
  AND column_name LIKE '%program%'
ORDER BY ordinal_position;