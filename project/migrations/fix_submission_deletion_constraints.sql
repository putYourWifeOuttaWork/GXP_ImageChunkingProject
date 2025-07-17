-- Fix Foreign Key Constraints to Allow Submission Deletion
-- This migration updates foreign key constraints to add CASCADE delete behavior

-- ============================================
-- 1. Fix petri_observations_original constraint
-- ============================================

-- First, drop the existing constraint
ALTER TABLE petri_observations_original 
DROP CONSTRAINT IF EXISTS petri_observations_submission_id_fkey;

-- Recreate with CASCADE delete
ALTER TABLE petri_observations_original
ADD CONSTRAINT petri_observations_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- ============================================
-- 2. Fix other tables that reference submissions
-- ============================================

-- Fix gasifier_observations (non-partitioned)
ALTER TABLE gasifier_observations 
DROP CONSTRAINT IF EXISTS gasifier_observations_submission_id_fkey;

ALTER TABLE gasifier_observations
ADD CONSTRAINT gasifier_observations_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- Fix petri_observations (non-partitioned)
ALTER TABLE petri_observations 
DROP CONSTRAINT IF EXISTS petri_observations_submission_id_fkey;

ALTER TABLE petri_observations
ADD CONSTRAINT petri_observations_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- Fix gasifier_observations_partitioned
ALTER TABLE gasifier_observations_partitioned 
DROP CONSTRAINT IF EXISTS gasifier_observations_partitioned_submission_id_fkey;

ALTER TABLE gasifier_observations_partitioned
ADD CONSTRAINT gasifier_observations_partitioned_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- Fix petri_observations_partitioned  
ALTER TABLE petri_observations_partitioned 
DROP CONSTRAINT IF EXISTS petri_observations_partitioned_submission_id_fkey;

ALTER TABLE petri_observations_partitioned
ADD CONSTRAINT petri_observations_partitioned_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- Fix submission_sessions
ALTER TABLE submission_sessions 
DROP CONSTRAINT IF EXISTS submission_sessions_submission_id_fkey;

ALTER TABLE submission_sessions
ADD CONSTRAINT submission_sessions_submission_id_fkey 
FOREIGN KEY (submission_id) 
REFERENCES submissions(submission_id) 
ON DELETE CASCADE;

-- ============================================
-- 3. Optional: Create a safe deletion function
-- ============================================

-- This function provides a way to delete submissions with logging
CREATE OR REPLACE FUNCTION delete_submission_cascade(p_submission_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_petri_count integer;
    v_gasifier_count integer;
    v_session_count integer;
BEGIN
    -- Count related records before deletion
    SELECT COUNT(*) INTO v_petri_count 
    FROM petri_observations 
    WHERE submission_id = p_submission_id;
    
    SELECT COUNT(*) INTO v_gasifier_count 
    FROM gasifier_observations 
    WHERE submission_id = p_submission_id;
    
    SELECT COUNT(*) INTO v_session_count 
    FROM submission_sessions 
    WHERE submission_id = p_submission_id;
    
    -- Log the deletion (optional - remove if you don't have audit table)
    -- INSERT INTO audit_log (action, table_name, record_id, details, user_id)
    -- VALUES ('DELETE', 'submissions', p_submission_id, 
    --         jsonb_build_object(
    --             'petri_observations_deleted', v_petri_count,
    --             'gasifier_observations_deleted', v_gasifier_count,
    --             'submission_sessions_deleted', v_session_count
    --         ), 
    --         auth.uid());
    
    -- Delete the submission (cascades to related tables)
    DELETE FROM submissions WHERE submission_id = p_submission_id;
    
    -- Return summary
    v_result := jsonb_build_object(
        'success', true,
        'submission_id', p_submission_id,
        'deleted_counts', jsonb_build_object(
            'petri_observations', v_petri_count,
            'gasifier_observations', v_gasifier_count,
            'submission_sessions', v_session_count
        )
    );
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION delete_submission_cascade TO authenticated;

-- ============================================
-- 4. Quick verification query
-- ============================================

-- Check all foreign key constraints referencing submissions
SELECT 
    tc.table_name,
    tc.constraint_name,
    rc.delete_rule
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
ORDER BY tc.table_name;

-- ============================================
-- 5. Manual deletion options
-- ============================================

-- Option A: Delete with CASCADE (after running above ALTER statements)
-- DELETE FROM submissions WHERE submission_id = 'your-uuid-here';

-- Option B: Use the function
-- SELECT delete_submission_cascade('your-uuid-here');

-- Option C: Delete related records first, then submission
-- DELETE FROM petri_observations WHERE submission_id = 'your-uuid-here';
-- DELETE FROM gasifier_observations WHERE submission_id = 'your-uuid-here';
-- DELETE FROM submission_sessions WHERE submission_id = 'your-uuid-here';
-- DELETE FROM submissions WHERE submission_id = 'your-uuid-here';