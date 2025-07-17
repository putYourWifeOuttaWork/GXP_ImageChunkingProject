-- Comprehensive Fix for ALL Submission Foreign Key Constraints in Sandbox
-- Based on the sandbox schema analysis

-- ============================================
-- 1. Fix all standard tables
-- ============================================

-- gasifier_observations
ALTER TABLE gasifier_observations 
DROP CONSTRAINT IF EXISTS gasifier_observations_submission_id_fkey;
ALTER TABLE gasifier_observations
ADD CONSTRAINT gasifier_observations_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- petri_observations
ALTER TABLE petri_observations 
DROP CONSTRAINT IF EXISTS petri_observations_submission_id_fkey;
ALTER TABLE petri_observations
ADD CONSTRAINT petri_observations_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- petri_observations_original (if exists)
ALTER TABLE petri_observations_original 
DROP CONSTRAINT IF EXISTS petri_observations_submission_id_fkey;
ALTER TABLE petri_observations_original
ADD CONSTRAINT petri_observations_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- submission_sessions
ALTER TABLE submission_sessions 
DROP CONSTRAINT IF EXISTS submission_sessions_submission_id_fkey;
ALTER TABLE submission_sessions
ADD CONSTRAINT submission_sessions_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- ============================================
-- 2. Fix all partitioned tables
-- ============================================

-- gasifier_observations_partitioned (parent table)
ALTER TABLE gasifier_observations_partitioned 
DROP CONSTRAINT IF EXISTS gasifier_observations_partitioned_submission_id_fkey;
ALTER TABLE gasifier_observations_partitioned
ADD CONSTRAINT gasifier_observations_partitioned_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- petri_observations_partitioned (parent table)
ALTER TABLE petri_observations_partitioned 
DROP CONSTRAINT IF EXISTS petri_observations_partitioned_submission_id_fkey;
ALTER TABLE petri_observations_partitioned
ADD CONSTRAINT petri_observations_partitioned_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- ============================================
-- 3. Fix all partition child tables
-- ============================================

-- Fix all gasifier partition tables
DO $$ 
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'gasifier_obs_%'
    LOOP
        EXECUTE format('
            ALTER TABLE %I 
            DROP CONSTRAINT IF EXISTS %I;
            ALTER TABLE %I
            ADD CONSTRAINT %I 
            FOREIGN KEY (submission_id) 
            REFERENCES submissions(submission_id) 
            ON DELETE CASCADE;
        ', 
        partition_name, 
        partition_name || '_submission_id_fkey',
        partition_name,
        partition_name || '_submission_id_fkey'
        );
    END LOOP;
END $$;

-- Fix all petri partition tables
DO $$ 
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'petri_obs_%'
    LOOP
        EXECUTE format('
            ALTER TABLE %I 
            DROP CONSTRAINT IF EXISTS %I;
            ALTER TABLE %I
            ADD CONSTRAINT %I 
            FOREIGN KEY (submission_id) 
            REFERENCES submissions(submission_id) 
            ON DELETE CASCADE;
        ', 
        partition_name, 
        partition_name || '_submission_id_fkey',
        partition_name,
        partition_name || '_submission_id_fkey'
        );
    END LOOP;
END $$;

-- ============================================
-- 4. Verify all constraints are fixed
-- ============================================

SELECT 
    tc.table_name,
    tc.constraint_name,
    rc.delete_rule,
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN '✓ Fixed'
        ELSE '✗ Needs Fix'
    END as status
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_catalog = rc.constraint_catalog
    AND tc.constraint_schema = rc.constraint_schema
    AND tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON rc.unique_constraint_catalog = ccu.constraint_catalog
    AND rc.unique_constraint_schema = ccu.constraint_schema
    AND rc.unique_constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'submissions'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;