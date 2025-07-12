# Production Deployment Guide

## Step 1: Test Full Data Migration in Sandbox

### 1.1 Run Full Migration
```sql
-- Connect to sandbox database
-- Run the full migration script
\i migrations/full_partition_migration.sql

-- This will:
-- - Migrate all programs' data one by one
-- - Show progress for each program
-- - Verify counts match after migration
```

### 1.2 Verify Migration Success
```sql
-- Check that all data was migrated
SELECT 
  'Migration Verification' as check_type,
  (SELECT COUNT(*) FROM petri_observations) as original_count,
  (SELECT COUNT(*) FROM petri_observations_partitioned) as partitioned_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM petri_observations) = 
         (SELECT COUNT(*) FROM petri_observations_partitioned)
    THEN 'SUCCESS - All data migrated'
    ELSE 'FAILED - Count mismatch'
  END as status;

-- Check partition distribution
SELECT 
  p.name as program_name,
  child.relname as partition_name,
  pg_size_pretty(pg_relation_size(child.oid)) as size,
  COUNT(po.*) as observation_count
FROM pilot_programs p
JOIN pg_class child ON 'petri_obs_prog_' || replace(p.program_id::text, '-', '_') = child.relname
LEFT JOIN petri_observations_partitioned po ON p.program_id = po.program_id
GROUP BY p.program_id, p.name, child.relname, child.oid
ORDER BY observation_count DESC;
```

### 1.3 Performance Testing
```sql
-- Run performance comparison
-- This tests 5 different query patterns
\i migrations/test_partition_performance_suite.sql
```

## Step 2: Verify Application Works with Partitioned Tables

### 2.1 Update Database Connection (Temporary Testing)
```typescript
// In your app, temporarily point queries to partitioned table
// Option 1: Create a view that points to partitioned table
CREATE OR REPLACE VIEW petri_observations_test AS
SELECT * FROM petri_observations_partitioned;

// Option 2: Update your data service temporarily
// src/services/reportingDataService.ts
const TABLE_NAME = process.env.USE_PARTITIONED ? 
  'petri_observations_partitioned' : 'petri_observations';
```

### 2.2 Test Critical Application Features
Create a test checklist:

```markdown
## Application Testing Checklist

### Data Display
- [ ] Dashboard loads correctly
- [ ] Observation lists show all data
- [ ] Filtering by program works
- [ ] Filtering by date range works
- [ ] Growth charts display properly

### Data Entry
- [ ] New observations can be created
- [ ] Observations save to correct partition
- [ ] Edit existing observations works
- [ ] Delete operations work

### Reports
- [ ] Report builder queries work
- [ ] Materialized view queries are fast
- [ ] Export functions work correctly
- [ ] Analytics calculations are accurate

### Performance
- [ ] Page load times are acceptable
- [ ] Query response times improved
- [ ] No timeout errors
- [ ] Batch operations complete
```

### 2.3 Automated Testing Script
```sql
-- Create automated test script
CREATE OR REPLACE FUNCTION test_application_queries()
RETURNS TABLE (
  test_name text,
  status text,
  execution_time interval
) AS $$
DECLARE
  v_start timestamptz;
  v_count bigint;
BEGIN
  -- Test 1: Dashboard query
  v_start := clock_timestamp();
  SELECT COUNT(*) INTO v_count
  FROM petri_observations_partitioned
  WHERE company_id = (SELECT company_id FROM companies LIMIT 1)
    AND created_at >= CURRENT_DATE - INTERVAL '30 days';
  
  RETURN QUERY
  SELECT 'Dashboard Query'::text, 
         CASE WHEN v_count > 0 THEN 'PASS' ELSE 'FAIL' END,
         clock_timestamp() - v_start;
  
  -- Test 2: Program filter
  v_start := clock_timestamp();
  SELECT COUNT(*) INTO v_count
  FROM petri_observations_partitioned
  WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1);
  
  RETURN QUERY
  SELECT 'Program Filter'::text,
         CASE WHEN v_count >= 0 THEN 'PASS' ELSE 'FAIL' END,
         clock_timestamp() - v_start;
  
  -- Test 3: Insert operation
  v_start := clock_timestamp();
  BEGIN
    INSERT INTO petri_observations_partitioned (
      observation_id, petri_code, submission_id, site_id, program_id, company_id
    )
    SELECT 
      gen_random_uuid(), 'TEST-' || generate_series,
      submission_id, site_id, program_id, company_id
    FROM petri_observations_partitioned
    LIMIT 1;
    
    -- Rollback test insert
    ROLLBACK;
    
    RETURN QUERY
    SELECT 'Insert Operation'::text, 'PASS'::text, clock_timestamp() - v_start;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY
    SELECT 'Insert Operation'::text, 'FAIL: ' || SQLERRM, clock_timestamp() - v_start;
  END;
  
  -- Add more tests as needed
END;
$$ LANGUAGE plpgsql;

-- Run the tests
SELECT * FROM test_application_queries();
```

## Step 3: Deploy to Production

### 3.1 Pre-Deployment Checklist
```bash
# 1. Backup production database
pg_dump -h db.jycxolmevsvrxmeinxff.supabase.co -U postgres \
  -d postgres -Fc -f prod_backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Notify users of maintenance window
# 3. Prepare rollback plan
# 4. Have monitoring ready
```

### 3.2 Production Migration Plan

#### Option A: Zero-Downtime Migration (Recommended)
```sql
-- 1. Create partitioned structure in production
\i migrations/001_add_company_context.sql
\i migrations/002_create_analytics_infrastructure.sql  
\i migrations/003_simple_partitioning_fixed.sql

-- 2. Set up sync trigger (keeps tables in sync during migration)
CREATE OR REPLACE FUNCTION sync_to_partitioned()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO petri_observations_partitioned VALUES (NEW.*)
    ON CONFLICT (observation_id, program_id) 
    DO UPDATE SET
      growth_index = EXCLUDED.growth_index,
      updated_at = EXCLUDED.updated_at;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM petri_observations_partitioned 
    WHERE observation_id = OLD.observation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_observations
AFTER INSERT OR UPDATE OR DELETE ON petri_observations
FOR EACH ROW EXECUTE FUNCTION sync_to_partitioned();

-- 3. Migrate historical data in batches
\i migrations/full_partition_migration.sql

-- 4. Verify sync is working
SELECT 
  (SELECT COUNT(*) FROM petri_observations) as original,
  (SELECT COUNT(*) FROM petri_observations_partitioned) as partitioned,
  (SELECT MAX(updated_at) FROM petri_observations) as latest_original,
  (SELECT MAX(updated_at) FROM petri_observations_partitioned) as latest_partitioned;

-- 5. Switch application to use partitioned table
BEGIN;
ALTER TABLE petri_observations RENAME TO petri_observations_old;
ALTER TABLE petri_observations_partitioned RENAME TO petri_observations;
COMMIT;

-- 6. Drop sync trigger
DROP TRIGGER IF EXISTS sync_observations ON petri_observations_old;
DROP FUNCTION IF EXISTS sync_to_partitioned();
```

#### Option B: Maintenance Window Migration
```sql
-- 1. During maintenance window
BEGIN;

-- Run all migrations
\i migrations/001_add_company_context.sql
\i migrations/002_create_analytics_infrastructure.sql
\i migrations/003_simple_partitioning_fixed.sql

-- Migrate all data
\i migrations/full_partition_migration.sql

-- Swap tables
ALTER TABLE petri_observations RENAME TO petri_observations_old;
ALTER TABLE petri_observations_partitioned RENAME TO petri_observations;

COMMIT;
```

### 3.3 Post-Deployment Verification
```sql
-- 1. Verify application is working
SELECT * FROM test_application_queries();

-- 2. Check performance improvements
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM petri_observations
WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1);

-- 3. Refresh materialized views
REFRESH MATERIALIZED VIEW mv_daily_metrics;

-- 4. Monitor for errors
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

### 3.4 Rollback Plan (If Needed)
```sql
-- Quick rollback
BEGIN;
ALTER TABLE petri_observations RENAME TO petri_observations_partitioned;
ALTER TABLE petri_observations_old RENAME TO petri_observations;
COMMIT;

-- Full rollback
DROP TABLE petri_observations_partitioned CASCADE;
-- Restore from backup if needed
```

## Monitoring After Deployment

### Set Up Monitoring Queries
```sql
-- Create monitoring function
CREATE OR REPLACE FUNCTION monitor_partition_health()
RETURNS TABLE (
  metric text,
  value text,
  status text
) AS $$
BEGIN
  -- Check row counts
  RETURN QUERY
  SELECT 'Total Observations'::text, 
         COUNT(*)::text,
         'OK'::text
  FROM petri_observations;
  
  -- Check partition balance
  RETURN QUERY
  SELECT 'Partition Balance'::text,
         MAX(cnt)::text || ' / ' || MIN(cnt)::text,
         CASE 
           WHEN MAX(cnt) / NULLIF(MIN(cnt), 0) > 10 
           THEN 'WARNING: Unbalanced'
           ELSE 'OK'
         END
  FROM (
    SELECT COUNT(*) as cnt
    FROM petri_observations
    GROUP BY program_id
  ) counts;
  
  -- Check query performance
  RETURN QUERY
  WITH perf AS (
    SELECT AVG(total_exec_time / calls) as avg_time
    FROM pg_stat_statements
    WHERE query LIKE '%petri_observations%'
      AND calls > 0
  )
  SELECT 'Avg Query Time'::text,
         ROUND(avg_time::numeric, 2) || 'ms',
         CASE 
           WHEN avg_time < 100 THEN 'OK'
           WHEN avg_time < 500 THEN 'WARNING'
           ELSE 'CRITICAL'
         END
  FROM perf;
END;
$$ LANGUAGE plpgsql;

-- Schedule regular checks
SELECT * FROM monitor_partition_health();
```

## Success Criteria

1. **All data migrated**: Original count = Partitioned count
2. **Performance improved**: Query times reduced by 10x+
3. **Application stable**: No errors in production
4. **Users happy**: Dashboards load instantly

## Timeline Estimate

- **Sandbox Testing**: 2-4 hours
- **Application Verification**: 4-8 hours  
- **Production Deployment**: 1-2 hours (or overnight for zero-downtime)
- **Monitoring Period**: 24-48 hours

## Support Resources

- Migration logs: Check `migration_log.txt`
- Rollback scripts: Available in each migration file
- Performance baseline: Captured before migration
- Contact: Database team for emergency support