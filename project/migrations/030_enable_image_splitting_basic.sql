-- Enable basic image splitting functionality for sandbox
-- This allows users to mark observations as split images but doesn't auto-process them

-- Create the missing complete_petri_split_processing function
CREATE OR REPLACE FUNCTION complete_petri_split_processing(
    main_observation_id UUID,
    left_image_url TEXT,
    right_image_url TEXT
)
RETURNS JSON AS $$
DECLARE
    left_obs_id UUID;
    right_obs_id UUID;
    result JSON;
BEGIN
    -- Find the left and right observations
    SELECT observation_id INTO left_obs_id
    FROM petri_observations
    WHERE main_petri_id = main_observation_id 
    AND phase_observation_settings->>'position' = 'left'
    LIMIT 1;
    
    SELECT observation_id INTO right_obs_id
    FROM petri_observations
    WHERE main_petri_id = main_observation_id 
    AND phase_observation_settings->>'position' = 'right'
    LIMIT 1;
    
    -- Update the left observation with processed image
    IF left_obs_id IS NOT NULL THEN
        UPDATE petri_observations
        SET 
            image_url = left_image_url,
            split_processed = true,
            updated_at = NOW()
        WHERE observation_id = left_obs_id;
    END IF;
    
    -- Update the right observation with processed image
    IF right_obs_id IS NOT NULL THEN
        UPDATE petri_observations
        SET 
            image_url = right_image_url,
            split_processed = true,
            updated_at = NOW()
        WHERE observation_id = right_obs_id;
    END IF;
    
    -- Mark the main observation as processed
    UPDATE petri_observations
    SET 
        split_processed = true,
        updated_at = NOW()
    WHERE observation_id = main_observation_id;
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'main_observation_id', main_observation_id,
        'left_observation_id', left_obs_id,
        'right_observation_id', right_obs_id,
        'message', 'Split processing completed successfully'
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to complete split processing'
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to manually trigger split processing (for testing)
CREATE OR REPLACE FUNCTION trigger_manual_split_processing(observation_id UUID)
RETURNS JSON AS $$
DECLARE
    obs_record RECORD;
    result JSON;
BEGIN
    -- Get the observation record
    SELECT * INTO obs_record 
    FROM petri_observations 
    WHERE observation_id = trigger_manual_split_processing.observation_id
    AND is_split_source = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Observation not found or not a split source',
            'observation_id', observation_id
        );
    END IF;
    
    -- For now, just mark as processed (manual workflow)
    UPDATE petri_observations
    SET 
        split_processed = true,
        updated_at = NOW()
    WHERE observation_id = trigger_manual_split_processing.observation_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Split processing triggered manually',
        'observation_id', observation_id,
        'note', 'Manual processing - images need to be split externally'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check split processing status
CREATE OR REPLACE FUNCTION get_split_processing_status()
RETURNS TABLE(
    main_observation_id UUID,
    petri_code TEXT,
    submission_id UUID,
    image_url TEXT,
    split_processed BOOLEAN,
    created_at TIMESTAMPTZ,
    split_children_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        po.observation_id,
        po.petri_code,
        po.submission_id,
        po.image_url,
        po.split_processed,
        po.created_at,
        (SELECT COUNT(*)::INTEGER 
         FROM petri_observations child 
         WHERE child.main_petri_id = po.observation_id) as split_children_count
    FROM petri_observations po
    WHERE po.is_split_source = true
    ORDER BY po.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION complete_petri_split_processing TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_manual_split_processing TO authenticated;
GRANT EXECUTE ON FUNCTION get_split_processing_status TO authenticated;

-- Show current split observations
SELECT 
    'Split observations in system' as info,
    COUNT(*) as total_count,
    SUM(CASE WHEN is_split_source THEN 1 ELSE 0 END) as source_count,
    SUM(CASE WHEN split_processed THEN 1 ELSE 0 END) as processed_count
FROM petri_observations
WHERE is_image_split = true;

-- Show recent split observations
SELECT 
    observation_id,
    petri_code,
    is_split_source,
    split_processed,
    created_at,
    phase_observation_settings->>'position' as position
FROM petri_observations
WHERE is_image_split = true
ORDER BY created_at DESC
LIMIT 10;

-- Final message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Basic image splitting functionality ENABLED!';
    RAISE NOTICE '📝 What you can now do:';
    RAISE NOTICE '  - Create site templates with split images';
    RAISE NOTICE '  - Submit observations with split image flag';
    RAISE NOTICE '  - Use trigger_manual_split_processing() for testing';
    RAISE NOTICE '  - Use get_split_processing_status() to monitor';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  For full automation, you still need:';
    RAISE NOTICE '  - Python image processing service';
    RAISE NOTICE '  - PYTHON_APP_URL environment variable';
    RAISE NOTICE '  - Automated trigger deployment';
END $$;