-- Check exact column names in both tables
SELECT 
    c1.column_name as original_column,
    c1.data_type as original_type,
    c2.column_name as partitioned_column,
    c2.data_type as partitioned_type
FROM 
    (SELECT column_name, data_type, ordinal_position 
     FROM information_schema.columns 
     WHERE table_name = 'petri_observations' AND table_schema = 'public') c1
FULL OUTER JOIN 
    (SELECT column_name, data_type, ordinal_position 
     FROM information_schema.columns 
     WHERE table_name = 'petri_observations_partitioned' AND table_schema = 'public') c2
ON c1.column_name = c2.column_name
ORDER BY COALESCE(c1.ordinal_position, c2.ordinal_position);

-- Also show just the partitioned table columns
SELECT 
    '\nColumns in petri_observations_partitioned:' as info;
    
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'petri_observations_partitioned' 
  AND table_schema = 'public'
ORDER BY ordinal_position;