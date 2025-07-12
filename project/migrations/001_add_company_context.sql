-- Migration 001: Add Company Context for Multi-Tenancy
-- This addresses the immediate filtering issues

BEGIN;

-- 1. Add company_id to all observation and submission tables
ALTER TABLE petri_observations 
  ADD COLUMN company_id uuid REFERENCES companies(company_id);

ALTER TABLE gasifier_observations 
  ADD COLUMN company_id uuid REFERENCES companies(company_id);

ALTER TABLE submissions 
  ADD COLUMN company_id uuid REFERENCES companies(company_id);

-- 2. First, ensure sites have company_id from their programs
UPDATE sites s
SET company_id = p.company_id
FROM pilot_programs p
WHERE s.program_id = p.program_id
  AND s.company_id IS NULL;

-- 3. Now backfill company_id from parent relationships
-- For petri_observations, traverse: observation -> submission -> site -> program -> company
UPDATE petri_observations po
SET company_id = p.company_id
FROM submissions sub
JOIN sites s ON sub.site_id = s.site_id
JOIN pilot_programs p ON s.program_id = p.program_id
WHERE po.submission_id = sub.submission_id
  AND po.company_id IS NULL
  AND p.company_id IS NOT NULL;

-- For gasifier_observations
UPDATE gasifier_observations go
SET company_id = p.company_id
FROM submissions sub
JOIN sites s ON sub.site_id = s.site_id
JOIN pilot_programs p ON s.program_id = p.program_id
WHERE go.submission_id = sub.submission_id
  AND go.company_id IS NULL
  AND p.company_id IS NOT NULL;

-- For submissions
UPDATE submissions sub
SET company_id = p.company_id
FROM sites s
JOIN pilot_programs p ON s.program_id = p.program_id
WHERE sub.site_id = s.site_id
  AND sub.company_id IS NULL
  AND p.company_id IS NOT NULL;

-- 4. Check if we still have nulls and provide helpful error message
DO $$
DECLARE
  v_null_count integer;
  v_programs_without_company integer;
BEGIN
  -- Check for programs without company
  SELECT COUNT(*) INTO v_programs_without_company
  FROM pilot_programs
  WHERE company_id IS NULL;
  
  IF v_programs_without_company > 0 THEN
    RAISE NOTICE 'WARNING: % programs do not have company_id set', v_programs_without_company;
    RAISE NOTICE 'You need to update pilot_programs to set company_id first';
    RAISE NOTICE 'Example: UPDATE pilot_programs SET company_id = (SELECT company_id FROM companies WHERE name = ''Your Company'') WHERE company_id IS NULL;';
  END IF;
  
  -- Check for remaining nulls
  SELECT COUNT(*) INTO v_null_count
  FROM petri_observations
  WHERE company_id IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Cannot proceed: % petri_observations still have NULL company_id. This usually means some programs do not have company_id set.', v_null_count;
  END IF;
END $$;

-- 5. Only set NOT NULL if all values are populated
ALTER TABLE petri_observations 
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE gasifier_observations 
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE submissions 
  ALTER COLUMN company_id SET NOT NULL;

-- 4. Create critical performance indexes
CREATE INDEX idx_petri_company_program_time 
  ON petri_observations(company_id, program_id, created_at DESC);

CREATE INDEX idx_petri_company_site_time 
  ON petri_observations(company_id, site_id, created_at DESC);

CREATE INDEX idx_gasifier_company_program_time 
  ON gasifier_observations(company_id, program_id, created_at DESC);

CREATE INDEX idx_submissions_company_time 
  ON submissions(company_id, created_at DESC);

-- 5. Create a helper view for easy filtering
CREATE OR REPLACE VIEW v_petri_observations_enhanced AS
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
  po.daysInThisProgramPhase,
  po.todays_day_of_phase,
  po.is_image_split,
  po.phase_observation_settings,
  po.is_missed_observation,
  po.main_petri_id,
  po.is_split_source,
  po.split_processed,
  po.flag_for_review,
  po.daysinthisprogramphase,
  po.company_id,
  -- Additional joined fields
  s.name as site_name,
  s.type as site_type,
  p.name as current_program_name,  -- Renamed to avoid conflict
  p.status as program_status,
  c.name as company_name,
  -- Calculate which phase this observation belongs to
  (
    SELECT phase->>'name'
    FROM jsonb_array_elements(p.phases) as phase
    WHERE (phase->>'start_date')::date <= po.created_at::date
      AND (phase->>'end_date')::date >= po.created_at::date
    LIMIT 1
  ) as phase_name
FROM petri_observations po
JOIN sites s ON po.site_id = s.site_id
JOIN pilot_programs p ON po.program_id = p.program_id
JOIN companies c ON po.company_id = c.company_id;

-- 6. Add Row Level Security
ALTER TABLE petri_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gasifier_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

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

COMMIT;