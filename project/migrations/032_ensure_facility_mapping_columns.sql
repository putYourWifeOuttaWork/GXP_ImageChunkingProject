-- Ensure sites table has facility mapping columns
-- This migration adds facility_dimensions and facility_layout if they don't exist

-- Add facility_dimensions column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sites' 
    AND column_name = 'facility_dimensions'
  ) THEN
    ALTER TABLE sites ADD COLUMN facility_dimensions JSONB;
    RAISE NOTICE 'Added facility_dimensions column to sites table';
  ELSE
    RAISE NOTICE 'facility_dimensions column already exists';
  END IF;
END $$;

-- Add facility_layout column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sites' 
    AND column_name = 'facility_layout'
  ) THEN
    ALTER TABLE sites ADD COLUMN facility_layout JSONB;
    RAISE NOTICE 'Added facility_layout column to sites table';
  ELSE
    RAISE NOTICE 'facility_layout column already exists';
  END IF;
END $$;

-- Set default dimensions for existing sites based on square_footage
UPDATE sites 
SET facility_dimensions = jsonb_build_object(
  'width', CASE 
    WHEN square_footage <= 10000 THEN 100
    WHEN square_footage <= 50000 THEN 200
    ELSE 300
  END,
  'height', CASE 
    WHEN square_footage <= 10000 THEN 100
    WHEN square_footage <= 50000 THEN 250
    ELSE 400
  END,
  'units', 'feet'
)
WHERE facility_dimensions IS NULL 
AND square_footage IS NOT NULL;

-- For sites without square_footage, use a default
UPDATE sites 
SET facility_dimensions = jsonb_build_object(
  'width', 120,
  'height', 80,
  'units', 'feet'
)
WHERE facility_dimensions IS NULL;

-- Verify the changes
SELECT 
  site_id,
  name,
  square_footage,
  facility_dimensions,
  facility_layout IS NOT NULL as has_layout
FROM sites
LIMIT 5;