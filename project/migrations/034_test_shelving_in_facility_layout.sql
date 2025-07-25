-- Test migration to verify shelving can be stored in facility_layout
-- This is a test query, not a schema change

-- Check if any sites have shelving in their facility_layout
SELECT 
  s.site_id,
  s.name as site_name,
  s.facility_layout->'equipment' as all_equipment,
  jsonb_array_length(COALESCE(s.facility_layout->'equipment', '[]'::jsonb)) as total_equipment_count,
  (
    SELECT COUNT(*)::int 
    FROM jsonb_array_elements(COALESCE(s.facility_layout->'equipment', '[]'::jsonb)) AS eq
    WHERE eq->>'type' = 'shelving'
  ) as shelving_count
FROM sites s
WHERE s.facility_layout IS NOT NULL
  AND s.facility_layout->'equipment' IS NOT NULL
LIMIT 10;

-- Show a sample of shelving equipment if any exists
SELECT 
  s.site_id,
  s.name as site_name,
  eq.value as shelving_equipment
FROM sites s,
LATERAL jsonb_array_elements(COALESCE(s.facility_layout->'equipment', '[]'::jsonb)) AS eq
WHERE eq->>'type' = 'shelving'
LIMIT 5;