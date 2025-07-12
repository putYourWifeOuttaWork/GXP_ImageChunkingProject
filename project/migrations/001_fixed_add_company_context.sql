-- Migration 001 (FIXED): Add Company Context for Multi-Tenancy
-- This version handles existing columns and naming conflicts

BEGIN;

-- 1. Add company_id only to tables that don't have it
DO $$
BEGIN
  -- Add to petri_observations if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'petri_observations' 
    AND column_name = 'company_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE petri_observations 
      ADD COLUMN company_id uuid REFERENCES companies(company_id);
  END IF;

  -- Add to gasifier_observations if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gasifier_observations' 
    AND column_name = 'company_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE gasifier_observations 
      ADD COLUMN company_id uuid REFERENCES companies(company_id);
  END IF;

  -- Add to submissions if missing
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

-- 2. Ensure sites have company_id from their programs (only update NULLs)
UPDATE sites s
SET company_id = p.company_id
FROM pilot_programs p
WHERE s.program_id = p.program_id
  AND s.company_id IS NULL
  AND p.company_id IS NOT NULL;

-- 3. Backfill company_id from parent relationships
-- For petri_observations
UPDATE petri_observations po
SET company_id = COALESCE(s.company_id, p.company_id)
FROM submissions sub
JOIN sites s ON sub.site_id = s.site_id
JOIN pilot_programs p ON s.program_id = p.program_id
WHERE po.submission_id = sub.submission_id
  AND po.company_id IS NULL;

-- For gasifier_observations
UPDATE gasifier_observations go
SET company_id = COALESCE(s.company_id, p.company_id)
FROM submissions sub
JOIN sites s ON sub.site_id = s.site_id
JOIN pilot_programs p ON s.program_id = p.program_id
WHERE go.submission_id = sub.submission_id
  AND go.company_id IS NULL;

-- For submissions
UPDATE submissions sub
SET company_id = COALESCE(s.company_id, p.company_id)
FROM sites s
JOIN pilot_programs p ON s.program_id = p.program_id
WHERE sub.site_id = s.site_id
  AND sub.company_id IS NULL;

-- 4. Check if we still have nulls
DO $$
DECLARE
  v_null_petri integer;
  v_null_gasifier integer;
  v_null_submissions integer;
BEGIN
  SELECT COUNT(*) INTO v_null_petri
  FROM petri_observations WHERE company_id IS NULL;
  
  SELECT COUNT(*) INTO v_null_gasifier
  FROM gasifier_observations WHERE company_id IS NULL;
  
  SELECT COUNT(*) INTO v_null_submissions
  FROM submissions WHERE company_id IS NULL;
  
  IF v_null_petri > 0 OR v_null_gasifier > 0 OR v_null_submissions > 0 THEN
    RAISE NOTICE 'Warning: Some records still have NULL company_id:';
    RAISE NOTICE '  Petri observations: %', v_null_petri;
    RAISE NOTICE '  Gasifier observations: %', v_null_gasifier;
    RAISE NOTICE '  Submissions: %', v_null_submissions;
    RAISE EXCEPTION 'Cannot proceed with NULL company_id values. Check data integrity.';
  END IF;
END $$;

-- 5. Set NOT NULL constraints
ALTER TABLE petri_observations 
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE gasifier_observations 
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE submissions 
  ALTER COLUMN company_id SET NOT NULL;

-- 6. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_petri_company_program_time 
  ON petri_observations(company_id, program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_petri_company_site_time 
  ON petri_observations(company_id, site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gasifier_company_program_time 
  ON gasifier_observations(company_id, program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_company_time 
  ON submissions(company_id, created_at DESC);

-- 7. Create helper view (with fixed naming to avoid conflicts)
DROP VIEW IF EXISTS v_petri_observations_enhanced;

CREATE VIEW v_petri_observations_enhanced AS
SELECT 
  po.observation_id,
  po.submission_id,
  po.site_id,
  po.petri_code,
  po.image_url,
  po.fungicide_used,
  po.surrounding_water_schedule,
  po.notes,
  po.created_at,
  po.updated_at,
  po.lastupdated_by,
  po.plant_type,
  po.program_id,
  po.placement,
  po.placement_dynamics,
  po.last_updated_by_user_id,
  po.last_edit_time,
  po.outdoor_temperature,
  po.outdoor_humidity,
  po.petri_growth_stage,
  po.growth_index,
  po.order_index,
  po.x_position,
  po.y_position,
  po.footage_from_origin_x,
  po.footage_from_origin_y,
  po.growth_progression,
  po.growth_aggression,
  po.growth_velocity,
  po.daysInThisProgramPhase as days_in_program_phase,  -- Use consistent naming
  po.todays_day_of_phase,
  po.is_image_split,
  po.phase_observation_settings,
  po.is_missed_observation,
  po.main_petri_id,
  po.is_split_source,
  po.split_processed,
  po.flag_for_review,
  -- Skip the duplicate daysinthisprogramphase column
  po.company_id,
  po.program_name as original_program_name,  -- Keep original field
  -- Additional joined fields
  s.name as site_name,
  s.type as site_type,
  s.square_footage,
  s.cubic_footage,
  p.name as current_program_name,
  p.status as program_status,
  p.start_date as program_start_date,
  p.end_date as program_end_date,
  c.name as company_name,
  -- Calculate which phase this observation belongs to
  (
    SELECT phase->>'name'
    FROM jsonb_array_elements(p.phases) as phase
    WHERE (phase->>'start_date')::date <= po.created_at::date
      AND (phase->>'end_date')::date >= po.created_at::date
    LIMIT 1
  ) as current_phase_name,
  -- Days since program start
  EXTRACT(DAY FROM po.created_at - p.start_date) as days_since_program_start
FROM petri_observations po
JOIN sites s ON po.site_id = s.site_id
JOIN pilot_programs p ON po.program_id = p.program_id
JOIN companies c ON po.company_id = c.company_id;

-- 8. Create similar view for gasifier observations
DROP VIEW IF EXISTS v_gasifier_observations_enhanced;

CREATE VIEW v_gasifier_observations_enhanced AS
SELECT 
  go.*,
  s.name as site_name,
  s.type as site_type,
  p.name as current_program_name,
  p.status as program_status,
  c.name as company_name,
  (
    SELECT phase->>'name'
    FROM jsonb_array_elements(p.phases) as phase
    WHERE (phase->>'start_date')::date <= go.created_at::date
      AND (phase->>'end_date')::date >= go.created_at::date
    LIMIT 1
  ) as current_phase_name
FROM gasifier_observations go
JOIN sites s ON go.site_id = s.site_id
JOIN pilot_programs p ON go.program_id = p.program_id
JOIN companies c ON go.company_id = c.company_id;

-- 9. Add Row Level Security
ALTER TABLE petri_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gasifier_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS company_isolation_petri ON petri_observations;
DROP POLICY IF EXISTS company_isolation_gasifier ON gasifier_observations;
DROP POLICY IF EXISTS company_isolation_submissions ON submissions;

-- Create RLS policies
CREATE POLICY company_isolation_petri ON petri_observations
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY company_isolation_gasifier ON gasifier_observations
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY company_isolation_submissions ON submissions
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- 10. Grant permissions
GRANT SELECT ON v_petri_observations_enhanced TO authenticated;
GRANT SELECT ON v_gasifier_observations_enhanced TO authenticated;

COMMIT;