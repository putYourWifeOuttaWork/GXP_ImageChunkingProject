-- Create a view that includes human-readable names for petri_observations
-- This allows users to get site names directly when using petri_observations as the primary data source
-- =====================================================

-- Drop the view if it exists
DROP VIEW IF EXISTS petri_observations_with_names CASCADE;

-- Create the view with site and program names
CREATE VIEW petri_observations_with_names AS
SELECT 
  p.*,
  s.name as site_name,
  s.site_code as site_code,
  s.location as site_location,
  s.site_type as site_type,
  pp.name as program_name,
  sub.global_submission_id as global_submission_id
FROM petri_observations_partitioned p
LEFT JOIN sites s ON p.site_id = s.site_id
LEFT JOIN pilot_programs pp ON p.program_id = pp.program_id
LEFT JOIN submissions sub ON p.submission_id = sub.submission_id;

-- Grant permissions
GRANT SELECT ON petri_observations_with_names TO authenticated;

-- Add comment
COMMENT ON VIEW petri_observations_with_names IS 'Petri observations with human-readable names for sites, programs, and submissions. Use this for reports that need to aggregate petri data while displaying site names.';

-- Create similar view for gasifier observations
DROP VIEW IF EXISTS gasifier_observations_with_names CASCADE;

CREATE VIEW gasifier_observations_with_names AS
SELECT 
  g.*,
  s.name as site_name,
  s.site_code as site_code,
  s.location as site_location,
  s.site_type as site_type,
  pp.name as program_name,
  sub.global_submission_id as global_submission_id
FROM gasifier_observations_partitioned g
LEFT JOIN sites s ON g.site_id = s.site_id
LEFT JOIN pilot_programs pp ON g.program_id = pp.program_id
LEFT JOIN submissions sub ON g.submission_id = sub.submission_id;

-- Grant permissions
GRANT SELECT ON gasifier_observations_with_names TO authenticated;

-- Add comment
COMMENT ON VIEW gasifier_observations_with_names IS 'Gasifier observations with human-readable names for sites, programs, and submissions. Use this for reports that need to aggregate gasifier data while displaying site names.';

-- Test the views
SELECT COUNT(*) as petri_count FROM petri_observations_with_names;
SELECT COUNT(*) as gasifier_count FROM gasifier_observations_with_names;

-- Show sample data from the view
SELECT 
  petri_code,
  site_id,
  site_name,
  program_id,
  program_name,
  growth_index,
  created_at
FROM petri_observations_with_names
LIMIT 5;