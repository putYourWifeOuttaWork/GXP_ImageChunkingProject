# Migration 002: Analytics Infrastructure - Safe Execution Instructions

## Overview
This migration creates the analytics infrastructure including:
- Geographic data columns for sites
- Materialized views for fast dashboards
- Effectiveness metrics tables
- Performance benchmarks
- Helper functions for phase detection

## Pre-Migration Checklist
- [ ] Backup your database (Supabase does this automatically)
- [ ] Ensure Migration 001 has been successfully completed
- [ ] Have at least 30 minutes available for the migration
- [ ] Notify any active users about potential brief disruption

## Option 1: Run via Supabase Dashboard (RECOMMENDED)

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the entire contents of `migrations/002_create_analytics_infrastructure.sql`
4. Paste into the SQL editor
5. Click "Run" to execute

## Option 2: Run via psql Command Line

If you have psql installed and want to run from command line:

```bash
# For SANDBOX database (recommended for testing first):
psql "postgresql://postgres:postgres@db.avjoiiqbampztgteqrph.supabase.co:5432/postgres" \
  -f migrations/002_create_analytics_infrastructure.sql

# For PRODUCTION database (after testing on sandbox):
psql "postgresql://postgres:pleaseFuckingWorkNow@db.jycxolmevsvrxmeinxff.supabase.co:5432/postgres" \
  -f migrations/002_create_analytics_infrastructure.sql
```

## Option 3: Use the Migration Runner Script

```bash
# Run on sandbox first
./migrations/run_migration.sh migrations/002_create_analytics_infrastructure.sql sandbox

# After testing, run on production
./migrations/run_migration.sh migrations/002_create_analytics_infrastructure.sql production
```

## Post-Migration Verification

Run these queries to verify the migration succeeded:

```sql
-- 1. Check new columns on sites table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sites' 
AND column_name IN ('latitude', 'longitude', 'elevation_ft', 'climate_zone');

-- 2. Check new tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'effectiveness_metrics',
    'aggregate_program_stats',
    'performance_benchmarks'
)
ORDER BY table_name;

-- 3. Check materialized view was created
SELECT matviewname, definition 
FROM pg_matviews 
WHERE schemaname = 'public' 
AND matviewname = 'mv_daily_metrics';

-- 4. Check new indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('effectiveness_metrics', 'aggregate_program_stats')
ORDER BY tablename, indexname;

-- 5. Test the phase detection function
SELECT get_phase_for_date(
    (SELECT program_id FROM pilot_programs LIMIT 1),
    CURRENT_DATE
);
```

## Rollback Instructions (if needed)

If you need to rollback this migration:

```sql
-- Drop the new objects in reverse order
DROP FUNCTION IF EXISTS get_phase_for_date(uuid, timestamptz);
DROP INDEX IF EXISTS idx_gasifier_effectiveness;
DROP INDEX IF EXISTS idx_petri_phase_analysis;
DROP INDEX IF EXISTS idx_petri_growth_analysis;
DROP TABLE IF EXISTS performance_benchmarks;
DROP TABLE IF EXISTS aggregate_program_stats;
DROP TABLE IF EXISTS effectiveness_metrics;
DROP MATERIALIZED VIEW IF EXISTS mv_daily_metrics;

-- Remove the new columns from sites
ALTER TABLE sites 
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS elevation_ft,
  DROP COLUMN IF EXISTS climate_zone;
```

## Expected Performance Impact

- Initial creation: 1-5 minutes depending on data size
- Materialized view refresh: Will need periodic refresh (see maintenance section)
- Query performance: Should improve by 10-100x for dashboard queries

## Next Steps After Migration

1. **Refresh Materialized View**: 
   ```sql
   REFRESH MATERIALIZED VIEW mv_daily_metrics;
   ```

2. **Set Up Automated Refresh** (run once):
   ```sql
   -- Create a function to refresh the materialized view
   CREATE OR REPLACE FUNCTION refresh_analytics_views()
   RETURNS void AS $$
   BEGIN
     REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;
   END;
   $$ LANGUAGE plpgsql;

   -- Schedule it to run daily at 2 AM (requires pg_cron extension)
   -- SELECT cron.schedule('refresh-analytics', '0 2 * * *', 'SELECT refresh_analytics_views();');
   ```

3. **Update TypeScript Types**:
   ```bash
   npx supabase gen types typescript --project-ref jycxolmevsvrxmeinxff > src/types/supabase.ts
   ```

## Questions or Issues?

If you encounter any issues:
1. Check the Supabase logs for detailed error messages
2. Verify Migration 001 completed successfully first
3. Ensure you have sufficient database permissions