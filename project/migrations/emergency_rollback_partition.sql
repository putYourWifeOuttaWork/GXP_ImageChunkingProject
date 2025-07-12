-- Emergency Rollback Script - Use if Report Builder is Broken

-- 1. Check current table state
SELECT 
  'Current Table State' as status,
  tablename,
  CASE 
    WHEN tablename = 'petri_observations' THEN 'CURRENT PRIMARY TABLE'
    WHEN tablename = 'petri_observations_original' THEN 'BACKUP TABLE (original non-partitioned)'
    WHEN tablename = 'petri_observations_partitioned' THEN 'ERROR - should not exist after swap'
    ELSE 'OTHER'
  END as table_role
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename LIKE '%petri_observations%'
ORDER BY tablename;

-- 2. OPTION A: Temporary rollback (just to test if this fixes the issue)
-- This swaps the tables back temporarily
BEGIN;
-- Only run if petri_observations_original exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'petri_observations_original' AND schemaname = 'public') THEN
    -- Swap back to original
    ALTER TABLE petri_observations RENAME TO petri_observations_partitioned_temp;
    ALTER TABLE petri_observations_original RENAME TO petri_observations;
    RAISE NOTICE 'Tables swapped back to original (non-partitioned) version';
  ELSE
    RAISE NOTICE 'No original table found to swap back to';
  END IF;
END $$;
COMMIT;

-- 3. OPTION B: Keep partitioned table but create a view for compatibility
-- This creates a simple view that might work better with the report builder
CREATE OR REPLACE VIEW v_petri_observations_simple AS
SELECT 
  observation_id,
  created_at,
  updated_at,
  created_by,
  updated_by,
  petri_code,
  growth_index,
  notes,
  flag_for_review,
  submission_id,
  image_urls,
  outdoor_temperature,
  outdoor_humidity,
  images_above,
  images_below,
  site_id,
  program_id,
  growth_color,
  company_id,
  todays_day_of_phase,
  growth_progression,
  growth_velocity,
  daysInThisProgramPhase,
  program_name
FROM petri_observations
LIMIT 10000; -- Limit for performance during testing

-- 4. Test queries to see what works
-- Test 1: Direct table query
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM petri_observations WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1);

-- Test 2: Information schema query (what get_table_columns uses)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'petri_observations'
  AND table_schema = 'public'
ORDER BY ordinal_position
LIMIT 10;

-- 5. If you need to fully rollback and keep using partitioned table elsewhere:
-- Create an alias view
-- DROP VIEW IF EXISTS petri_observations_for_reports;
-- CREATE VIEW petri_observations_for_reports AS SELECT * FROM petri_observations_original;

-- 6. Check what the report builder is actually querying
SELECT 
  pid,
  usename,
  application_name,
  state,
  query_start,
  LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE state = 'active'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;