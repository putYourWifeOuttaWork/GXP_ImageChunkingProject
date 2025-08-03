# Database Migration Plan

## Overview
This migration introduces partitioned tables, new report/dashboard tables, and schema cleanup. This is a major migration that requires careful planning and execution.

## Migration Inventory

### New Tables to Create
1. **Report Management**
   - `report_folders`
   - `report_folder_permissions`
   - `saved_reports`
   - `report_data_snapshots`
   - `report_version_history`

2. **Dashboard System**
   - `dashboards`
   - `dashboard_widgets`
   - `dashboard_permissions`

3. **Partitioned Tables**
   - `petri_observations_partitioned`
   - `gasifier_observations_partitioned`

### Views to Create/Update
1. `petri_observations_with_names`
2. `gasifier_observations_with_names`

### Tables to Modify
1. Add missing foreign key constraints
2. Add performance indexes
3. Clean up deprecated columns

### Tables to Remove (After Migration)
1. Old observation tables (after data migration to partitioned)
2. Deprecated temporary tables

## Migration Sequence

### Phase 1: Preparation (No Downtime)
```sql
-- 1. Create backup of current database
pg_dump -h [host] -U [user] -d [database] > backup_$(date +%Y%m%d_%H%M%S).sql

-- 2. Analyze current data volume
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. Check for blocking dependencies
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE contype = 'f'
ORDER BY conrelid::regclass::text;
```

### Phase 2: Create New Structure (No Downtime)

#### 2.1 Report Management Tables
```sql
-- Run migration: 20250716_report_management_schema.sql
-- This creates all report-related tables with proper indexes and RLS

-- Verify creation
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'report%'
ORDER BY table_name;
```

#### 2.2 Dashboard Tables
```sql
-- Run migration: 035_create_dashboard_schema.sql
-- Creates dashboard tables with relationships

-- Verify
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'dashboard%'
ORDER BY table_name;
```

#### 2.3 Partitioned Tables
```sql
-- Create partitioned table structure
CREATE TABLE petri_observations_partitioned (
  LIKE petri_observations INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create partitions for each month
DO $$
DECLARE
  start_date date := '2024-01-01';
  end_date date := '2025-12-01';
  partition_date date;
BEGIN
  partition_date := start_date;
  WHILE partition_date < end_date LOOP
    EXECUTE format(
      'CREATE TABLE petri_observations_y%sm%s PARTITION OF petri_observations_partitioned
      FOR VALUES FROM (%L) TO (%L)',
      to_char(partition_date, 'YYYY'),
      to_char(partition_date, 'MM'),
      partition_date,
      partition_date + interval '1 month'
    );
    partition_date := partition_date + interval '1 month';
  END LOOP;
END$$;
```

### Phase 3: Data Migration (Potential Downtime)

#### 3.1 Migration Strategy Options

**Option A: Online Migration (Preferred)**
```sql
-- Use logical replication to minimize downtime
-- 1. Set up logical replication from old to new tables
-- 2. Let it catch up
-- 3. Quick switch during low-traffic window
```

**Option B: Batch Migration**
```sql
-- Migrate in batches to avoid long locks
DO $$
DECLARE
  batch_size integer := 100000;
  offset_val integer := 0;
  total_rows integer;
BEGIN
  SELECT count(*) INTO total_rows FROM petri_observations;
  
  WHILE offset_val < total_rows LOOP
    INSERT INTO petri_observations_partitioned
    SELECT * FROM petri_observations
    ORDER BY created_at
    LIMIT batch_size
    OFFSET offset_val;
    
    offset_val := offset_val + batch_size;
    
    -- Give other transactions a chance
    PERFORM pg_sleep(0.1);
    
    RAISE NOTICE 'Migrated % of % rows', offset_val, total_rows;
  END LOOP;
END$$;
```

#### 3.2 Verification
```sql
-- Verify row counts match
SELECT 
  (SELECT count(*) FROM petri_observations) AS old_count,
  (SELECT count(*) FROM petri_observations_partitioned) AS new_count;

-- Verify data integrity
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM petri_observations o
      WHERE NOT EXISTS (
        SELECT 1 FROM petri_observations_partitioned p
        WHERE p.observation_id = o.observation_id
      )
    ) THEN 'MISSING DATA'
    ELSE 'ALL DATA MIGRATED'
  END AS migration_status;
```

### Phase 4: Update Dependencies

#### 4.1 Update Views
```sql
-- Drop and recreate views pointing to new tables
DROP VIEW IF EXISTS petri_observations_summary CASCADE;
CREATE VIEW petri_observations_summary AS
SELECT ... FROM petri_observations_partitioned ...;

-- Run migration: 034_create_petri_observations_with_names_view.sql
```

#### 4.2 Update Foreign Keys
```sql
-- Update foreign keys to point to new tables
-- This requires careful coordination
```

#### 4.3 Update Application Code
- Update all table references in queries
- Update Supabase client queries
- Test all data access paths

### Phase 5: Cleanup (After Verification)

#### 5.1 Remove Old Tables
```sql
-- Only after full verification and backup
-- Keep old tables for at least 1 week in production

-- Rename first (safer)
ALTER TABLE petri_observations RENAME TO petri_observations_old;
ALTER TABLE gasifier_observations RENAME TO gasifier_observations_old;

-- Drop after verification period
-- DROP TABLE petri_observations_old;
-- DROP TABLE gasifier_observations_old;
```

#### 5.2 Update Statistics
```sql
-- Update table statistics for query planner
ANALYZE petri_observations_partitioned;
ANALYZE gasifier_observations_partitioned;
VACUUM ANALYZE;
```

## Rollback Plan

### Immediate Rollback (< 1 hour)
```sql
-- 1. Stop application
-- 2. Restore from backup
pg_restore -h [host] -U [user] -d [database] backup_[timestamp].sql

-- 3. Restart application with old code
```

### Partial Rollback
```sql
-- If only some migrations fail
-- 1. Identify failed migrations
-- 2. Run specific rollback scripts
-- 3. Fix issues and retry
```

## Risk Mitigation

### 1. Pre-Migration Testing
- [ ] Run full migration on staging environment
- [ ] Performance test with production data volume
- [ ] Test all application features
- [ ] Verify backups are restorable

### 2. During Migration
- [ ] Monitor database locks
- [ ] Watch for long-running queries
- [ ] Have DBA on standby
- [ ] Communicate with users

### 3. Post-Migration
- [ ] Monitor error logs
- [ ] Check query performance
- [ ] Verify data integrity
- [ ] Keep old tables for safety

## Success Criteria

1. **Data Integrity**
   - Zero data loss
   - All relationships maintained
   - Constraints enforced

2. **Performance**
   - Query performance improved or same
   - No increase in error rates
   - Partition pruning working

3. **Functionality**
   - All features working
   - No user-facing errors
   - Successful rollback tested

## Timeline

- **Day 1**: Staging migration and testing
- **Day 2**: Fix any issues found
- **Day 3**: Production preparation
- **Day 4**: Production migration (2-4 hour window)
- **Day 5-7**: Monitoring and verification

## Command Center Contacts

- **Database Admin**: [Contact]
- **Backend Lead**: [Contact]
- **DevOps**: [Contact]
- **Product Owner**: [Contact]

## Migration Checklist

### Pre-Migration
- [ ] Backup verified
- [ ] Staging tested
- [ ] Rollback tested
- [ ] Team notified
- [ ] Users notified

### During Migration
- [ ] Application stopped
- [ ] Migrations running
- [ ] Progress monitored
- [ ] Issues logged

### Post-Migration
- [ ] Application started
- [ ] Smoke tests passed
- [ ] Performance verified
- [ ] Users notified
- [ ] Monitoring active