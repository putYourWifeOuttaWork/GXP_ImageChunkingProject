-- Verify Migration 002: Analytics Infrastructure

-- 1. Check new geographic columns on sites table
SELECT 
  'Geographic columns on sites' as test,
  COUNT(*) as columns_added
FROM information_schema.columns 
WHERE table_name = 'sites' 
AND column_name IN ('latitude', 'longitude', 'elevation_ft', 'climate_zone');

-- 2. Check constraints were added
SELECT 
  'Site constraints' as test,
  COUNT(*) as constraints_added
FROM information_schema.table_constraints
WHERE table_name = 'sites'
AND constraint_name IN ('chk_latitude', 'chk_longitude');

-- 3. Verify new analytics tables
SELECT 
  'Analytics tables' as test,
  table_name,
  'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'effectiveness_metrics',
    'aggregate_program_stats',
    'performance_benchmarks'
)
ORDER BY table_name;

-- 4. Check materialized view
SELECT 
  'Materialized view' as test,
  matviewname,
  hasindexes,
  'EXISTS' as status
FROM pg_matviews 
WHERE schemaname = 'public' 
AND matviewname = 'mv_daily_metrics';

-- 5. Check indexes on new tables
SELECT 
  'Indexes' as test,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('effectiveness_metrics', 'aggregate_program_stats', 'mv_daily_metrics')
ORDER BY tablename, indexname;

-- 6. Test the phase detection function
SELECT 
  'Phase function' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'get_phase_for_date'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as status;

-- 7. Check materialized view data (should be empty until refreshed)
SELECT 
  'MV row count' as test,
  COUNT(*) as rows_in_view
FROM mv_daily_metrics;

-- 8. Show column structure of new tables
SELECT 
  'Effectiveness metrics columns' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'effectiveness_metrics'
ORDER BY ordinal_position
LIMIT 10;

-- 9. Test geographic constraints
DO $$
DECLARE
  v_result text;
BEGIN
  -- This should succeed
  BEGIN
    INSERT INTO sites (site_id, name, type, program_id, company_id, latitude, longitude)
    VALUES (gen_random_uuid(), 'Test Site Valid', 'greenhouse', 
            (SELECT program_id FROM pilot_programs LIMIT 1),
            (SELECT company_id FROM companies LIMIT 1),
            45.5, -122.6);
    v_result := 'Valid coordinates accepted';
    ROLLBACK;
  EXCEPTION WHEN OTHERS THEN
    v_result := 'Valid coordinates rejected: ' || SQLERRM;
  END;
  RAISE NOTICE 'Constraint test 1: %', v_result;
  
  -- This should fail
  BEGIN
    INSERT INTO sites (site_id, name, type, program_id, company_id, latitude, longitude)
    VALUES (gen_random_uuid(), 'Test Site Invalid', 'greenhouse',
            (SELECT program_id FROM pilot_programs LIMIT 1),
            (SELECT company_id FROM companies LIMIT 1),
            91, 181);  -- Invalid coordinates
    v_result := 'Invalid coordinates accepted (ERROR!)';
    ROLLBACK;
  EXCEPTION WHEN OTHERS THEN
    v_result := 'Invalid coordinates correctly rejected';
  END;
  RAISE NOTICE 'Constraint test 2: %', v_result;
END $$;

-- 10. Summary
SELECT 
  'Migration 002 Verification Complete' as status,
  NOW() as verified_at;