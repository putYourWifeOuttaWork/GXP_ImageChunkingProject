-- Fix facility dimensions to be more realistic based on square footage
-- Previous migration set dimensions too large (100x100 feet = 10,000 sq ft!)

-- Update dimensions to match actual square footage
UPDATE sites 
SET facility_dimensions = jsonb_build_object(
  'width', CASE 
    -- For small spaces (reefers, storage units)
    WHEN square_footage <= 200 THEN ROUND(SQRT(square_footage::numeric) * 1.2)  -- Slightly rectangular
    WHEN square_footage <= 500 THEN ROUND(SQRT(square_footage::numeric) * 1.1)
    WHEN square_footage <= 1000 THEN ROUND(SQRT(square_footage::numeric))
    ELSE ROUND(SQRT(square_footage::numeric))
  END,
  'height', CASE 
    WHEN square_footage <= 200 THEN ROUND(SQRT(square_footage::numeric) * 0.8)  -- Slightly rectangular
    WHEN square_footage <= 500 THEN ROUND(SQRT(square_footage::numeric) * 0.9)
    WHEN square_footage <= 1000 THEN ROUND(SQRT(square_footage::numeric))
    ELSE ROUND(SQRT(square_footage::numeric))
  END,
  'units', 'feet'
)
WHERE square_footage IS NOT NULL;

-- Verify the corrected dimensions
SELECT 
  site_id,
  name,
  square_footage,
  facility_dimensions,
  ROUND((facility_dimensions->>'width')::numeric * (facility_dimensions->>'height')::numeric) as calculated_area,
  facility_layout IS NOT NULL as has_layout
FROM sites
ORDER BY square_footage::numeric
LIMIT 10;

-- Show the changes for your specific sites
SELECT 
  name,
  square_footage::numeric as actual_sq_ft,
  facility_dimensions->>'width' as width_ft,
  facility_dimensions->>'height' as height_ft,
  ROUND((facility_dimensions->>'width')::numeric * (facility_dimensions->>'height')::numeric) as calculated_sq_ft
FROM sites
WHERE name IN ('Reefer (Seed Storage)', 'Storage Unit')
ORDER BY name;