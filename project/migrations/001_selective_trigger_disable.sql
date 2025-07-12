-- Migration 001 with selective trigger disable
-- Only disable user triggers, not system triggers

BEGIN;

-- 1. Disable only user triggers (not system/constraint triggers)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Disable user triggers on petri_observations
  FOR r IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'petri_observations'::regclass 
    AND NOT tgisinternal  -- Skip internal triggers
    AND tgname NOT LIKE 'RI_ConstraintTrigger%'  -- Skip FK constraint triggers
  LOOP
    EXECUTE format('ALTER TABLE petri_observations DISABLE TRIGGER %I', r.tgname);
  END LOOP;
  
  -- Disable user triggers on gasifier_observations
  FOR r IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'gasifier_observations'::regclass 
    AND NOT tgisinternal
    AND tgname NOT LIKE 'RI_ConstraintTrigger%'
  LOOP
    EXECUTE format('ALTER TABLE gasifier_observations DISABLE TRIGGER %I', r.tgname);
  END LOOP;
  
  -- Disable user triggers on submissions
  FOR r IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'submissions'::regclass 
    AND NOT tgisinternal
    AND tgname NOT LIKE 'RI_ConstraintTrigger%'
  LOOP
    EXECUTE format('ALTER TABLE submissions DISABLE TRIGGER %I', r.tgname);
  END LOOP;
END $$;

-- 2. Add company_id columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'petri_observations' 
    AND column_name = 'company_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE petri_observations 
      ADD COLUMN company_id uuid REFERENCES companies(company_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gasifier_observations' 
    AND column_name = 'company_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE gasifier_observations 
      ADD COLUMN company_id uuid REFERENCES companies(company_id);
  END IF;

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

-- 3. Backfill company_id
UPDATE sites s
SET company_id = p.company_id
FROM pilot_programs p
WHERE s.program_id = p.program_id
  AND s.company_id IS NULL
  AND p.company_id IS NOT NULL;

UPDATE petri_observations po
SET company_id = COALESCE(s.company_id, p.company_id)
FROM submissions sub
JOIN sites s ON sub.site_id = s.site_id
JOIN pilot_programs p ON s.program_id = p.program_id
WHERE po.submission_id = sub.submission_id
  AND po.company_id IS NULL;

UPDATE gasifier_observations go
SET company_id = COALESCE(s.company_id, p.company_id)
FROM submissions sub
JOIN sites s ON sub.site_id = s.site_id
JOIN pilot_programs p ON s.program_id = p.program_id
WHERE go.submission_id = sub.submission_id
  AND go.company_id IS NULL;

UPDATE submissions sub
SET company_id = COALESCE(s.company_id, p.company_id)
FROM sites s
JOIN pilot_programs p ON s.program_id = p.program_id
WHERE sub.site_id = s.site_id
  AND sub.company_id IS NULL;

-- 4. Re-enable user triggers
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Re-enable user triggers on petri_observations
  FOR r IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'petri_observations'::regclass 
    AND NOT tgisinternal
    AND tgname NOT LIKE 'RI_ConstraintTrigger%'
  LOOP
    EXECUTE format('ALTER TABLE petri_observations ENABLE TRIGGER %I', r.tgname);
  END LOOP;
  
  -- Re-enable user triggers on gasifier_observations
  FOR r IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'gasifier_observations'::regclass 
    AND NOT tgisinternal
    AND tgname NOT LIKE 'RI_ConstraintTrigger%'
  LOOP
    EXECUTE format('ALTER TABLE gasifier_observations ENABLE TRIGGER %I', r.tgname);
  END LOOP;
  
  -- Re-enable user triggers on submissions
  FOR r IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'submissions'::regclass 
    AND NOT tgisinternal
    AND tgname NOT LIKE 'RI_ConstraintTrigger%'
  LOOP
    EXECUTE format('ALTER TABLE submissions ENABLE TRIGGER %I', r.tgname);
  END LOOP;
END $$;

-- 5. Check for nulls
DO $$
DECLARE
  v_null_count integer;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM petri_observations WHERE company_id IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Cannot proceed: % petri_observations still have NULL company_id', v_null_count;
  END IF;
END $$;

-- 6. Set NOT NULL constraints
ALTER TABLE petri_observations 
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE gasifier_observations 
  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE submissions 
  ALTER COLUMN company_id SET NOT NULL;

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_petri_company_program_time 
  ON petri_observations(company_id, program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_petri_company_site_time 
  ON petri_observations(company_id, site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gasifier_company_program_time 
  ON gasifier_observations(company_id, program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_company_time 
  ON submissions(company_id, created_at DESC);

-- 8. Create simple view
DROP VIEW IF EXISTS v_petri_observations_enhanced;

CREATE VIEW v_petri_observations_enhanced AS
SELECT 
  po.*,
  s.name as site_name,
  s.type as site_type,
  p.name as current_program_name,
  p.status as program_status,
  c.name as company_name
FROM petri_observations po
JOIN sites s ON po.site_id = s.site_id
JOIN pilot_programs p ON po.program_id = p.program_id
JOIN companies c ON po.company_id = c.company_id;

-- 9. Add RLS
ALTER TABLE petri_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gasifier_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_isolation_petri ON petri_observations;
DROP POLICY IF EXISTS company_isolation_gasifier ON gasifier_observations;
DROP POLICY IF EXISTS company_isolation_submissions ON submissions;

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