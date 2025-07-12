-- Direct fix for remaining program without company_id

-- 1. Show which program is missing company_id
SELECT program_id, name, status, company_id 
FROM pilot_programs 
WHERE company_id IS NULL;

-- 2. Show available companies
SELECT company_id, name 
FROM companies;

-- 3. Force update any remaining programs to use the first company
UPDATE pilot_programs 
SET company_id = (SELECT company_id FROM companies LIMIT 1)
WHERE company_id IS NULL;

-- 4. Verify the fix
SELECT 'Programs with NULL company_id after fix:' as check, COUNT(*) 
FROM pilot_programs 
WHERE company_id IS NULL;

-- 5. Now check if there are any observations that would still get NULL
WITH orphan_check AS (
  SELECT 
    po.observation_id,
    po.submission_id,
    sub.site_id,
    s.program_id,
    p.company_id as program_company_id
  FROM petri_observations po
  LEFT JOIN submissions sub ON po.submission_id = sub.submission_id
  LEFT JOIN sites s ON sub.site_id = s.site_id
  LEFT JOIN pilot_programs p ON s.program_id = p.program_id
  WHERE p.company_id IS NULL
)
SELECT COUNT(*) as orphaned_observations
FROM orphan_check;

-- 6. Alternative: Check for broken relationships
SELECT 
  'Observations with no submission' as issue,
  COUNT(*) as count
FROM petri_observations po
WHERE NOT EXISTS (
  SELECT 1 FROM submissions s WHERE s.submission_id = po.submission_id
)
UNION ALL
SELECT 
  'Submissions with no site' as issue,
  COUNT(*) as count
FROM submissions sub
WHERE NOT EXISTS (
  SELECT 1 FROM sites s WHERE s.site_id = sub.site_id
)
UNION ALL
SELECT 
  'Sites with no program' as issue,
  COUNT(*) as count
FROM sites s
WHERE NOT EXISTS (
  SELECT 1 FROM pilot_programs p WHERE p.program_id = s.program_id
);