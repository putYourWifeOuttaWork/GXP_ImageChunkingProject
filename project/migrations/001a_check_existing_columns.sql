-- Check if columns already exist before adding them

-- Check which tables already have company_id
SELECT 
  t.table_name,
  CASE 
    WHEN c.column_name IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING'
  END as company_id_status
FROM (
  VALUES 
    ('petri_observations'),
    ('gasifier_observations'),
    ('submissions'),
    ('sites')
) t(table_name)
LEFT JOIN information_schema.columns c 
  ON c.table_name = t.table_name 
  AND c.column_name = 'company_id'
  AND c.table_schema = 'public'
ORDER BY t.table_name;

-- If columns already exist, skip the ADD COLUMN part and go straight to backfilling
-- This is a safer version of migration 001 that checks first

DO $$
BEGIN
  -- Add company_id to petri_observations if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'petri_observations' 
    AND column_name = 'company_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE petri_observations 
      ADD COLUMN company_id uuid REFERENCES companies(company_id);
  END IF;

  -- Add company_id to gasifier_observations if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gasifier_observations' 
    AND column_name = 'company_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE gasifier_observations 
      ADD COLUMN company_id uuid REFERENCES companies(company_id);
  END IF;

  -- Add company_id to submissions if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' 
    AND column_name = 'company_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE submissions 
      ADD COLUMN company_id uuid REFERENCES companies(company_id);
  END IF;
END $$;