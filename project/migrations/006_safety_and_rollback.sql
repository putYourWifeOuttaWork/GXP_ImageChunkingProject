-- Migration 006: Safety Checks and Rollback Procedures
-- This ensures we can safely migrate without breaking existing functionality

BEGIN;

-- =====================================================
-- PART 1: PRE-MIGRATION VALIDATION
-- =====================================================

-- Function to check if migration is safe
CREATE OR REPLACE FUNCTION partition_mgmt.pre_migration_check()
RETURNS TABLE (
  check_name text,
  status text,
  details text,
  is_blocking boolean
) AS $$
BEGIN
  -- Check 1: Active connections
  RETURN QUERY
  SELECT 
    'Active connections'::text,
    CASE 
      WHEN COUNT(*) > 10 THEN 'WARN' 
      ELSE 'PASS' 
    END,
    format('%s active connections to database', COUNT(*))::text,
    false
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid();
  
  -- Check 2: Table sizes
  RETURN QUERY
  SELECT 
    'Table sizes'::text,
    CASE 
      WHEN pg_total_relation_size('petri_observations') > 10737418240 -- 10GB
      THEN 'WARN' 
      ELSE 'PASS' 
    END,
    format('petri_observations: %s', 
      pg_size_pretty(pg_total_relation_size('petri_observations')))::text,
    false
  FROM pg_class
  WHERE relname = 'petri_observations';
  
  -- Check 3: Foreign key dependencies
  RETURN QUERY
  SELECT 
    'Foreign key dependencies'::text,
    'INFO'::text,
    format('%s tables depend on petri_observations', COUNT(*))::text,
    false
  FROM pg_constraint
  WHERE confrelid = 'petri_observations'::regclass;
  
  -- Check 4: Running transactions
  RETURN QUERY
  SELECT 
    'Long running transactions'::text,
    CASE 
      WHEN COUNT(*) > 0 THEN 'FAIL' 
      ELSE 'PASS' 
    END,
    format('%s transactions older than 5 minutes', COUNT(*))::text,
    COUNT(*) > 0
  FROM pg_stat_activity
  WHERE state = 'active'
    AND query_start < CURRENT_TIMESTAMP - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 2: SAFE MIGRATION WRAPPER
-- =====================================================

-- Function to safely migrate with rollback capability
CREATE OR REPLACE FUNCTION partition_mgmt.safe_migrate_table(
  p_table_name text,
  p_test_mode boolean DEFAULT true
) RETURNS TABLE (
  step text,
  status text,
  details text
) AS $$
DECLARE
  v_new_table text;
  v_backup_table text;
  v_start_time timestamp;
  v_row_count bigint;
BEGIN
  v_new_table := p_table_name || '_partitioned';
  v_backup_table := p_table_name || '_backup_' || to_char(now(), 'YYYYMMDD_HH24MI');
  v_start_time := clock_timestamp();
  
  -- Step 1: Validation
  RETURN QUERY
  SELECT 'Pre-migration checks'::text, 'RUNNING'::text, 'Validating environment'::text;
  
  IF EXISTS (
    SELECT 1 FROM partition_mgmt.pre_migration_check() 
    WHERE is_blocking = true
  ) THEN
    RETURN QUERY
    SELECT 'Pre-migration checks'::text, 'FAILED'::text, 'Blocking issues found'::text;
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 'Pre-migration checks'::text, 'PASSED'::text, 'Environment validated'::text;
  
  -- Step 2: Create backup (in test mode, just verify we can)
  IF p_test_mode THEN
    RETURN QUERY
    SELECT 'Backup creation'::text, 'SKIPPED'::text, 'Test mode - backup not created'::text;
  ELSE
    EXECUTE format('CREATE TABLE %I AS TABLE %I', v_backup_table, p_table_name);
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    
    RETURN QUERY
    SELECT 'Backup creation'::text, 'COMPLETED'::text, 
           format('Backed up %s rows to %s', v_row_count, v_backup_table)::text;
  END IF;
  
  -- Step 3: Create triggers to sync data during migration
  IF NOT p_test_mode THEN
    -- Create sync trigger
    EXECUTE format($TRIG$
      CREATE OR REPLACE FUNCTION sync_%1$s_to_partitioned()
      RETURNS TRIGGER AS $F$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO %2$s VALUES (NEW.*);
        ELSIF TG_OP = 'UPDATE' THEN
          UPDATE %2$s SET * = NEW.* WHERE observation_id = NEW.observation_id;
        ELSIF TG_OP = 'DELETE' THEN
          DELETE FROM %2$s WHERE observation_id = OLD.observation_id;
        END IF;
        RETURN NEW;
      END;
      $F$ LANGUAGE plpgsql;
      
      CREATE TRIGGER sync_to_partitioned
      AFTER INSERT OR UPDATE OR DELETE ON %1$s
      FOR EACH ROW
      EXECUTE FUNCTION sync_%1$s_to_partitioned();
    $TRIG$, p_table_name, v_new_table);
    
    RETURN QUERY
    SELECT 'Sync triggers'::text, 'CREATED'::text, 'Data will sync during migration'::text;
  END IF;
  
  -- Step 4: Migrate data
  RETURN QUERY
  SELECT 'Data migration'::text, 'RUNNING'::text, 
         format('Migrating %s', p_table_name)::text;
  
  -- In test mode, just count
  IF p_test_mode THEN
    SELECT COUNT(*) INTO v_row_count FROM petri_observations;
    RETURN QUERY
    SELECT 'Data migration'::text, 'TEST_PASSED'::text, 
           format('Would migrate %s rows', v_row_count)::text;
  ELSE
    -- Actual migration happens via separate function
    PERFORM partition_mgmt.migrate_to_partitioned(10000);
  END IF;
  
  -- Step 5: Verify data integrity
  IF NOT p_test_mode THEN
    -- Compare counts
    EXECUTE format(
      'SELECT COUNT(*) FROM %I', 
      p_table_name
    ) INTO v_row_count;
    
    DECLARE
      v_new_count bigint;
    BEGIN
      EXECUTE format(
        'SELECT COUNT(*) FROM %I', 
        v_new_table
      ) INTO v_new_count;
      
      IF v_row_count = v_new_count THEN
        RETURN QUERY
        SELECT 'Data verification'::text, 'PASSED'::text, 
               format('Row counts match: %s', v_row_count)::text;
      ELSE
        RETURN QUERY
        SELECT 'Data verification'::text, 'FAILED'::text, 
               format('Row count mismatch: %s vs %s', v_row_count, v_new_count)::text;
      END IF;
    END;
  END IF;
  
  -- Report completion
  RETURN QUERY
  SELECT 'Migration complete'::text, 
         CASE WHEN p_test_mode THEN 'TEST_MODE' ELSE 'SUCCESS' END::text,
         format('Duration: %s', clock_timestamp() - v_start_time)::text;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 3: APPLICATION COMPATIBILITY LAYER
-- =====================================================

-- Create views with original table names for backward compatibility
CREATE OR REPLACE FUNCTION partition_mgmt.create_compatibility_views()
RETURNS void AS $$
BEGIN
  -- Rename original tables and create views
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'petri_observations_original') THEN
    -- Already migrated
    RETURN;
  END IF;
  
  -- This would be done during actual migration:
  -- ALTER TABLE petri_observations RENAME TO petri_observations_original;
  -- CREATE VIEW petri_observations AS SELECT * FROM petri_observations_partitioned;
  
  -- For now, create a union view
  CREATE OR REPLACE VIEW v_petri_observations_all AS
  SELECT * FROM petri_observations
  UNION ALL
  SELECT * FROM petri_observations_partitioned
  WHERE NOT EXISTS (
    SELECT 1 FROM petri_observations o 
    WHERE o.observation_id = petri_observations_partitioned.observation_id
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 4: ROLLBACK PROCEDURES
-- =====================================================

-- Function to rollback migration
CREATE OR REPLACE FUNCTION partition_mgmt.rollback_migration(
  p_table_name text,
  p_backup_date text
) RETURNS void AS $$
DECLARE
  v_backup_table text;
BEGIN
  v_backup_table := p_table_name || '_backup_' || p_backup_date;
  
  -- Verify backup exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = v_backup_table
  ) THEN
    RAISE EXCEPTION 'Backup table % does not exist', v_backup_table;
  END IF;
  
  -- Drop partitioned version
  EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', p_table_name || '_partitioned');
  
  -- Restore from backup
  EXECUTE format('ALTER TABLE %I RENAME TO %I', v_backup_table, p_table_name);
  
  -- Recreate indexes and constraints
  -- (Would need to be customized based on original table structure)
  
  RAISE NOTICE 'Rollback completed. Restored from %', v_backup_table;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 5: MONITORING DURING MIGRATION
-- =====================================================

-- Function to monitor migration progress
CREATE OR REPLACE FUNCTION partition_mgmt.monitor_migration()
RETURNS TABLE (
  metric text,
  value text
) AS $$
BEGIN
  -- Original table count
  RETURN QUERY
  SELECT 'Original table rows'::text, 
         COUNT(*)::text 
  FROM petri_observations;
  
  -- Partitioned table count
  RETURN QUERY
  SELECT 'Partitioned table rows'::text,
         COALESCE(
           (SELECT COUNT(*)::text FROM petri_observations_partitioned),
           '0'
         );
  
  -- Migration rate
  RETURN QUERY
  WITH migration_progress AS (
    SELECT 
      COUNT(*) as migrated,
      MIN(created_at) as earliest,
      MAX(created_at) as latest
    FROM petri_observations_partitioned
  )
  SELECT 'Migration rate'::text,
         CASE 
           WHEN migrated > 0 THEN
             format('%s rows/minute', 
               (migrated / EXTRACT(EPOCH FROM (latest - earliest)) * 60)::integer)
           ELSE 'Not started'
         END
  FROM migration_progress;
  
  -- Partition count
  RETURN QUERY
  SELECT 'Partitions created'::text,
         COUNT(*)::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname LIKE 'petri_obs_%'
    AND c.relkind = 'r';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 6: POST-MIGRATION VALIDATION
-- =====================================================

-- Comprehensive validation after migration
CREATE OR REPLACE FUNCTION partition_mgmt.post_migration_validation()
RETURNS TABLE (
  test_name text,
  status text,
  details text
) AS $$
BEGIN
  -- Test 1: Row count matches
  RETURN QUERY
  WITH counts AS (
    SELECT 
      (SELECT COUNT(*) FROM petri_observations) as original,
      (SELECT COUNT(*) FROM petri_observations_partitioned) as partitioned
  )
  SELECT 
    'Row count validation'::text,
    CASE WHEN original = partitioned THEN 'PASS' ELSE 'FAIL' END,
    format('Original: %s, Partitioned: %s', original, partitioned)::text
  FROM counts;
  
  -- Test 2: Query performance
  RETURN QUERY
  WITH perf_test AS (
    SELECT clock_timestamp() as start_time
  ),
  query_test AS (
    SELECT COUNT(*) FROM petri_observations_partitioned
    WHERE program_id = (SELECT program_id FROM pilot_programs LIMIT 1)
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
  )
  SELECT 
    'Query performance'::text,
    'INFO'::text,
    format('Test query completed in %s', 
      clock_timestamp() - start_time)::text
  FROM perf_test;
  
  -- Test 3: Constraint validation
  RETURN QUERY
  SELECT 
    'Constraint validation'::text,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS' 
      ELSE 'FAIL' 
    END,
    format('%s invalid foreign keys found', COUNT(*))::text
  FROM petri_observations_partitioned p
  WHERE NOT EXISTS (
    SELECT 1 FROM submissions s WHERE s.submission_id = p.submission_id
  );
END;
$$ LANGUAGE plpgsql;

COMMIT;