# Comprehensive Partitioning Execution Plan

## Overview
This plan implements a 3-dimensional partitioning strategy: **Program → Site → Time**
- Automatic partition creation for future data
- Zero-downtime migration path
- Full rollback capability

## Architecture Design

### Partition Hierarchy
```
petri_observations_partitioned (by program_id)
├── petri_obs_prog_abc123 (by site_id)
│   ├── petri_obs_prog_abc123_site_def456 (by created_at)
│   │   ├── petri_obs_prog_abc123_site_def456_2025_01
│   │   ├── petri_obs_prog_abc123_site_def456_2025_02
│   │   └── ...
│   └── petri_obs_prog_abc123_site_xyz789 (by created_at)
│       ├── petri_obs_prog_abc123_site_xyz789_2025_01
│       └── ...
└── petri_obs_prog_def123 (by site_id)
    └── ...
```

### Why This Structure?
1. **Program-level partitioning** - Most queries filter by program first
2. **Site-level sub-partitioning** - Enables site-specific analysis
3. **Monthly time partitions** - Manageable size, aligns with reporting
4. **Submission-level alternative** - For ultra-granular session analysis

## Pre-Migration Checklist

### 1. Test Migration Safety
```sql
-- Run safety checks
SELECT * FROM partition_mgmt.pre_migration_check();

-- Test migration in dry-run mode
SELECT * FROM partition_mgmt.safe_migrate_table('petri_observations', true);
```

### 2. Backup Critical Data
```bash
# Full backup
pg_dump -Fc your_database > backup_before_partitioning_$(date +%Y%m%d).dump

# Table-specific backup
pg_dump -t petri_observations -t gasifier_observations > observations_backup.sql
```

### 3. Notify Team
- Schedule maintenance window (2-4 hours for large datasets)
- Prepare rollback plan
- Test in staging environment first

## Migration Execution Steps

### Phase 1: Infrastructure Setup (No Downtime)
```sql
-- 1. Run infrastructure migrations
\i migrations/001_add_company_context.sql
\i migrations/002_create_analytics_infrastructure.sql

-- 2. Create partition management schema
\i migrations/004_comprehensive_partitioning_strategy.sql

-- 3. Set up automated maintenance
\i migrations/005_automated_partition_maintenance.sql

-- 4. Install safety procedures
\i migrations/006_safety_and_rollback.sql

-- 5. Verify setup
SELECT * FROM partition_mgmt.validate_partitions();
```

### Phase 2: Create Partition Structure (No Downtime)
```sql
-- 1. Pre-create partitions for all existing programs
DO $$
DECLARE
  prog RECORD;
BEGIN
  FOR prog IN SELECT program_id FROM pilot_programs LOOP
    PERFORM partition_mgmt.precreate_program_partitions(prog.program_id);
  END LOOP;
END $$;

-- 2. Verify partitions created
SELECT * FROM partition_mgmt.v_partition_stats;
```

### Phase 3: Data Migration (Minimal Downtime)

#### Option A: Online Migration (Recommended)
```sql
-- 1. Create sync triggers (keeps data in sync during migration)
CREATE OR REPLACE FUNCTION sync_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO petri_observations_partitioned VALUES (NEW.*)
  ON CONFLICT (observation_id) DO UPDATE SET
    growth_index = EXCLUDED.growth_index,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_observations
AFTER INSERT OR UPDATE ON petri_observations
FOR EACH ROW EXECUTE FUNCTION sync_to_partitioned();

-- 2. Migrate historical data in batches
SELECT * FROM partition_mgmt.migrate_to_partitioned(
  p_batch_size := 10000,
  p_program_id := NULL  -- Migrate all programs
);

-- 3. Monitor progress
SELECT * FROM partition_mgmt.monitor_migration();

-- 4. Validate migration
SELECT * FROM partition_mgmt.post_migration_validation();

-- 5. Swap tables (brief downtime here)
BEGIN;
ALTER TABLE petri_observations RENAME TO petri_observations_old;
ALTER TABLE petri_observations_partitioned RENAME TO petri_observations;
COMMIT;
```

#### Option B: Maintenance Window Migration
```sql
-- 1. Stop application
-- 2. Migrate all data at once
INSERT INTO petri_observations_partitioned 
SELECT * FROM petri_observations;

-- 3. Swap tables
BEGIN;
ALTER TABLE petri_observations RENAME TO petri_observations_old;
ALTER TABLE petri_observations_partitioned RENAME TO petri_observations;
COMMIT;

-- 4. Restart application
```

### Phase 4: Post-Migration Tasks

```sql
-- 1. Update statistics
ANALYZE petri_observations;

-- 2. Create missing indexes
SELECT partition_mgmt.analyze_all_partitions();

-- 3. Update RLS policies
DROP POLICY IF EXISTS company_isolation_petri ON petri_observations_old;
CREATE POLICY company_isolation_petri ON petri_observations
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- 4. Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;

-- 5. Schedule maintenance
-- Add to cron: 
-- 0 2 * * * psql -c "SELECT partition_mgmt.schedule_maintenance();"
```

## Application Code Updates

### 1. Update TypeScript Types
```bash
npx supabase gen types typescript --project-ref your-project > src/types/supabase.ts
```

### 2. Optimize Queries
```typescript
// Before: Full table scan
const { data } = await supabase
  .from('petri_observations')
  .select('*')
  .eq('program_id', programId)
  .gte('created_at', startDate);

// After: Partition-aware query (much faster)
const { data } = await supabase
  .rpc('get_observations_optimized', {
    p_company_id: companyId,
    p_program_id: programId,
    p_start_date: startDate
  });
```

### 3. Use Drill-Down Functions
```typescript
// Program level
const programData = await supabase
  .from('petri_observations')
  .select('*')
  .eq('program_id', programId);

// Site level (only scans site partition)
const siteData = await supabase
  .from('petri_observations')
  .select('*')
  .eq('program_id', programId)
  .eq('site_id', siteId);

// Submission level (ultra-fast)
const submissionData = await supabase
  .from('petri_observations_by_submission')
  .select('*')
  .eq('submission_id', submissionId);
```

## Monitoring & Maintenance

### Daily Monitoring
```sql
-- Check partition health
SELECT * FROM partition_mgmt.v_partition_stats
WHERE size_bytes > 1073741824  -- Partitions over 1GB
ORDER BY size_bytes DESC;

-- Check query performance
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%petri_observations%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Weekly Maintenance
```sql
-- Update partition statistics
SELECT partition_mgmt.schedule_maintenance();

-- Clean up empty partitions
SELECT partition_mgmt.cleanup_empty_partitions(30);
```

### Monthly Tasks
```sql
-- Pre-create next month's partitions
DO $$
DECLARE
  prog RECORD;
BEGIN
  FOR prog IN 
    SELECT program_id 
    FROM pilot_programs 
    WHERE end_date > CURRENT_DATE
  LOOP
    -- This will create next month's partitions
    PERFORM partition_mgmt.precreate_program_partitions(prog.program_id);
  END LOOP;
END $$;
```

## Rollback Plan

If issues arise:

```sql
-- 1. Quick rollback (if using online migration)
BEGIN;
DROP TABLE petri_observations CASCADE;
ALTER TABLE petri_observations_old RENAME TO petri_observations;
-- Recreate indexes and constraints
COMMIT;

-- 2. Restore from backup
pg_restore -d your_database backup_before_partitioning_20250111.dump

-- 3. Partial rollback (keep partitions but use views)
CREATE VIEW petri_observations AS 
SELECT * FROM petri_observations_old;
```

## Performance Expectations

### Before Partitioning
- Full table scan: 5-30 seconds
- Program filter: 2-10 seconds  
- Site filter: 3-15 seconds
- Date range: 5-20 seconds

### After Partitioning
- Full table scan: Still slow (by design)
- Program filter: **50-200ms** ✨
- Site filter: **20-100ms** ✨
- Date range: **100-500ms** ✨
- Submission filter: **5-20ms** ✨

### Query Examples
```sql
-- This query goes from 10s → 100ms
SELECT COUNT(*), AVG(growth_index)
FROM petri_observations
WHERE program_id = 'abc-123'
  AND site_id = 'def-456'
  AND created_at >= '2025-01-01';

-- This becomes instant (5ms)
SELECT * FROM petri_observations
WHERE submission_id = 'ghi-789';
```

## Success Criteria

✅ All queries using program_id are 50x+ faster
✅ Site-specific queries are 100x+ faster  
✅ No data loss (row counts match)
✅ Automatic partition creation working
✅ Application functioning normally
✅ Rollback plan tested and ready

## Questions to Consider

1. **How much historical data to migrate?**
   - Consider archiving data > 2 years old
   
2. **Partition granularity?**
   - Monthly is recommended, but high-volume sites might need weekly

3. **Maintenance windows?**
   - Plan for 2-4 hours initially
   - Future partitions create automatically (no downtime)

4. **Testing strategy?**
   - Always test in staging first
   - Run performance benchmarks before/after

Remember: The beauty of this design is that once it's set up, it maintains itself! New programs, sites, and submissions automatically get their own partitions.