-- Migration 000: Fix Company Relationships
-- Run this BEFORE migration 001 if you get null company_id errors

-- 1. Diagnostic: Check the current state
SELECT 'Checking company relationships...' as status;

-- Check how many companies exist
SELECT COUNT(*) as company_count, 
       STRING_AGG(name, ', ') as company_names 
FROM companies;

-- Check programs without company_id
SELECT 'Programs without company_id:' as check_type,
       COUNT(*) as count,
       STRING_AGG(name, ', ' ORDER BY name) as names
FROM pilot_programs
WHERE company_id IS NULL;

-- Check sites without company_id (even though it's not required yet)
SELECT 'Sites without company_id:' as check_type,
       COUNT(*) as count
FROM sites s
WHERE company_id IS NULL;

-- Check data distribution
WITH data_summary AS (
  SELECT 
    p.company_id,
    c.name as company_name,
    COUNT(DISTINCT p.program_id) as program_count,
    COUNT(DISTINCT s.site_id) as site_count,
    COUNT(DISTINCT sub.submission_id) as submission_count,
    COUNT(DISTINCT po.observation_id) as petri_count
  FROM pilot_programs p
  LEFT JOIN companies c ON p.company_id = c.company_id
  LEFT JOIN sites s ON p.program_id = s.program_id
  LEFT JOIN submissions sub ON s.site_id = sub.site_id
  LEFT JOIN petri_observations po ON sub.submission_id = po.submission_id
  GROUP BY p.company_id, c.name
)
SELECT * FROM data_summary ORDER BY company_name;

-- 2. Fix Option A: If you have only one company (most common case)
DO $$
DECLARE
  v_company_count integer;
  v_single_company_id uuid;
  v_programs_updated integer;
BEGIN
  -- Count companies
  SELECT COUNT(*) INTO v_company_count FROM companies;
  
  -- Get the company_id if there's only one
  IF v_company_count = 1 THEN
    SELECT company_id INTO v_single_company_id FROM companies LIMIT 1;
  END IF;
  
  IF v_company_count = 1 THEN
    -- Update all programs to use this company
    UPDATE pilot_programs 
    SET company_id = v_single_company_id 
    WHERE company_id IS NULL;
    
    GET DIAGNOSTICS v_programs_updated = ROW_COUNT;
    
    RAISE NOTICE 'Updated % programs to use company_id %', 
                 v_programs_updated, v_single_company_id;
  ELSIF v_company_count = 0 THEN
    RAISE NOTICE 'No companies found! You need to create at least one company first.';
    RAISE NOTICE 'Example: INSERT INTO companies (name, description) VALUES (''Your Company Name'', ''Description'');';
  ELSE
    RAISE NOTICE 'Multiple companies found. You need to manually assign programs to companies.';
  END IF;
END $$;

-- 3. Fix Option B: Create a default company if none exists
DO $$
DECLARE
  v_company_count integer;
  v_default_company_id uuid;
BEGIN
  SELECT COUNT(*) INTO v_company_count FROM companies;
  
  IF v_company_count = 0 THEN
    -- Create a default company
    INSERT INTO companies (name, description, created_at, updated_at)
    VALUES ('Default Company', 'Automatically created for migration', NOW(), NOW())
    RETURNING company_id INTO v_default_company_id;
    
    -- Update all programs
    UPDATE pilot_programs 
    SET company_id = v_default_company_id 
    WHERE company_id IS NULL;
    
    RAISE NOTICE 'Created default company with ID % and updated all programs', v_default_company_id;
  END IF;
END $$;

-- 4. Fix Option C: Manual assignment helper
-- This generates UPDATE statements for you to review and run
SELECT 'UPDATE pilot_programs SET company_id = ''[COMPANY_ID]'' WHERE program_id = ''' || program_id || '''; -- ' || name as update_sql
FROM pilot_programs
WHERE company_id IS NULL
ORDER BY name;

-- 5. Verify the fix
SELECT 'After fixes - Programs without company_id:' as check_type,
       COUNT(*) as count
FROM pilot_programs
WHERE company_id IS NULL;

-- 6. Show the hierarchy is now complete
WITH hierarchy_check AS (
  SELECT 
    'Program -> Company' as relationship,
    COUNT(*) as total,
    SUM(CASE WHEN p.company_id IS NOT NULL THEN 1 ELSE 0 END) as valid_count,
    SUM(CASE WHEN p.company_id IS NULL THEN 1 ELSE 0 END) as null_count
  FROM pilot_programs p
  
  UNION ALL
  
  SELECT 
    'Site -> Program' as relationship,
    COUNT(*) as total,
    SUM(CASE WHEN s.program_id IS NOT NULL THEN 1 ELSE 0 END) as valid_count,
    SUM(CASE WHEN s.program_id IS NULL THEN 1 ELSE 0 END) as null_count
  FROM sites s
  
  UNION ALL
  
  SELECT 
    'Submission -> Site' as relationship,
    COUNT(*) as total,
    SUM(CASE WHEN sub.site_id IS NOT NULL THEN 1 ELSE 0 END) as valid_count,
    SUM(CASE WHEN sub.site_id IS NULL THEN 1 ELSE 0 END) as null_count
  FROM submissions sub
  
  UNION ALL
  
  SELECT 
    'Observation -> Submission' as relationship,
    COUNT(*) as total,
    SUM(CASE WHEN po.submission_id IS NOT NULL THEN 1 ELSE 0 END) as valid_count,
    SUM(CASE WHEN po.submission_id IS NULL THEN 1 ELSE 0 END) as null_count
  FROM petri_observations po
)
SELECT * FROM hierarchy_check;

-- 7. If everything looks good, you can now run migration 001_add_company_context.sql