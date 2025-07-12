-- Diagnostic: Find schema issues like duplicate columns

-- 1. Check for columns with similar names (case variations)
WITH column_analysis AS (
  SELECT 
    table_name,
    column_name,
    LOWER(column_name) as column_lower,
    data_type,
    ordinal_position
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('petri_observations', 'gasifier_observations', 'sites', 'submissions')
)
SELECT 
  table_name,
  STRING_AGG(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as duplicate_columns,
  COUNT(*) as count
FROM column_analysis
GROUP BY table_name, column_lower
HAVING COUNT(*) > 1
ORDER BY table_name, column_lower;

-- 2. Show all columns for petri_observations to see the duplicates
SELECT 
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'petri_observations'
  AND (
    LOWER(column_name) LIKE '%days%program%'
    OR LOWER(column_name) LIKE '%program%name%'
  )
ORDER BY ordinal_position;

-- 3. Check for other potential issues
SELECT 
  'Columns that might be duplicates' as issue_type,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'petri_observations'
  AND column_name IN (
    'daysInThisProgramPhase',
    'daysinthisprogramphase',
    'program_name',
    'lastupdated_by',
    'last_updated_by_user_id'
  )
ORDER BY column_name;

-- 4. Recommendation for fixing duplicate columns
SELECT 
  'To fix duplicate columns, run:' as action,
  'ALTER TABLE ' || table_name || ' DROP COLUMN ' || column_name || ';' as sql_command
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'petri_observations'
  AND column_name = 'daysinthisprogramphase';  -- Drop the lowercase version