-- Test with gasifier templates to reproduce the error

-- First, let's see what a gasifier template looks like from the frontend
-- by checking existing gasifier_observations for this site
SELECT 
    gasifier_code,
    chemical_type,
    placement_height,
    directional_placement,
    placement_strategy,
    position_x,
    position_y,
    footage_from_origin_x,
    footage_from_origin_y,
    order_index
FROM gasifier_observations
WHERE site_id = '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9'
LIMIT 5;

-- Now let's test with a gasifier template that matches the expected format
SELECT create_submission_session(
    '3ed8dc59-2744-41f9-b751-038ea2385063'::UUID,  -- program_id
    '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9'::UUID,  -- site_id
    jsonb_build_object(
        'temperature', 84,
        'humidity', 75,
        'airflow', 'Open',
        'odor_distance', '5-10ft',
        'weather', 'Cloudy',
        'notes', 'Test with templates'
    ),
    jsonb_build_array(
        jsonb_build_object(
            'gasifier_code', 'G001',
            'chemical_type', 'Citronella Blend',
            'placement_height', 'Medium',
            'directional_placement', 'North',
            'placement_strategy', 'Perimeter',
            'order_index', 1,
            'position_x', 10.5,
            'position_y', 20.5,
            'footage_from_origin_x', 100,
            'footage_from_origin_y', 200
        )
    ),
    NULL   -- No petri templates
);

-- Let's also check what the frontend is actually sending
-- by looking at the most recent submission_session
SELECT 
    session_id,
    submission_id,
    session_status,
    valid_gasifiers_logged,
    valid_petris_logged,
    created_at
FROM submission_sessions
WHERE site_id = '3a29d03d-0fcb-4eb8-86f6-83f6537ceba9'
ORDER BY session_start_time DESC
LIMIT 1;