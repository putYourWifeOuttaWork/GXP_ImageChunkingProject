-- Check if the specific site has a company_id
SELECT 
    s.site_id,
    s.site_code,
    s.company_id,
    c.name as company_name
FROM sites s
LEFT JOIN companies c ON s.company_id = c.company_id
WHERE s.site_id = '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9';

-- Also check the program associated with this site
SELECT 
    s.site_id,
    s.site_code,
    s.company_id,
    s.program_id,
    pp.name as program_name,
    pp.company_id as program_company_id
FROM sites s
LEFT JOIN pilot_programs pp ON s.program_id = pp.program_id
WHERE s.site_id = '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9';

-- Check all sites without company_id
SELECT 
    site_id,
    site_code,
    company_id,
    program_id
FROM sites
WHERE company_id IS NULL;