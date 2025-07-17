-- Fix create_submission_session function to include company_id parameter
-- This addresses the error: "null value in column 'company_id' of relation 'submissions' violates not-null constraint"

CREATE OR REPLACE FUNCTION create_submission_session(
  p_program_id UUID,
  p_site_id UUID,
  p_submission_data JSONB,
  p_gasifier_templates JSONB DEFAULT NULL,
  p_petri_templates JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  new_submission_id UUID;
  new_session_id UUID;
  template_gasifier_count INTEGER := 0;
  template_petri_count INTEGER := 0;
  current_user_id UUID;
  result JSONB;
  phase_info RECORD;
  site_company_id UUID;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Get company_id from the site
  SELECT company_id INTO site_company_id
  FROM sites
  WHERE site_id = p_site_id;
  
  IF site_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Site does not have an associated company'
    );
  END IF;
  
  -- Get program phase information
  SELECT * INTO phase_info
  FROM get_current_program_phase_info(p_program_id);
  
  -- Create the submission with proper enum type casting and company_id
  INSERT INTO submissions (
    site_id,
    program_id,
    company_id,  -- Add company_id here
    temperature,
    humidity,
    airflow,
    odor_distance,
    weather,
    notes,
    created_by,
    indoor_temperature,
    indoor_humidity,
    submission_timezone
  )
  VALUES (
    p_site_id,
    p_program_id,
    site_company_id,  -- Use the company_id from the site
    (p_submission_data ->> 'temperature')::numeric,
    (p_submission_data ->> 'humidity')::numeric,
    (p_submission_data ->> 'airflow')::airflow_enum,
    (p_submission_data ->> 'odor_distance')::odor_distance_enum,
    (p_submission_data ->> 'weather')::weather_enum,
    (p_submission_data ->> 'notes')::text,
    current_user_id,
    CASE WHEN p_submission_data ? 'indoor_temperature' AND (p_submission_data ->> 'indoor_temperature') != '' 
      THEN (p_submission_data ->> 'indoor_temperature')::numeric 
      ELSE NULL 
    END,
    CASE WHEN p_submission_data ? 'indoor_humidity' AND (p_submission_data ->> 'indoor_humidity') != '' 
      THEN (p_submission_data ->> 'indoor_humidity')::numeric 
      ELSE NULL 
    END,
    COALESCE(p_submission_data ->> 'submission_timezone', current_setting('TIMEZONE'))
  )
  RETURNING submission_id INTO new_submission_id;
  
  -- Count templates if provided
  IF p_gasifier_templates IS NOT NULL THEN
    template_gasifier_count := jsonb_array_length(p_gasifier_templates);
  END IF;
  
  IF p_petri_templates IS NOT NULL THEN
    template_petri_count := jsonb_array_length(p_petri_templates);
  END IF;
  
  -- Create the session
  INSERT INTO submission_sessions (
    submission_id,
    opened_by_user_id,  -- Changed from user_id to opened_by_user_id
    session_status,
    session_start_time,
    last_activity_time,
    percentage_complete,
    program_id,
    site_id,
    valid_petris_logged,
    valid_gasifiers_logged
  )
  VALUES (
    new_submission_id,
    current_user_id,
    'Opened',  -- Changed from 'Active' to 'Opened' to match enum
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    0, -- Initial percentage complete
    p_program_id,
    p_site_id,
    template_petri_count,
    template_gasifier_count
  )
  RETURNING session_id INTO new_session_id;
  
  -- Create observations from templates if provided
  IF p_gasifier_templates IS NOT NULL THEN
    INSERT INTO gasifier_observations (
      submission_id,
      site_id,
      company_id,  -- Add company_id here
      gasifier_code,
      chemical_type,
      placement_height,
      directional_placement,
      placement_strategy,
      outdoor_temperature,
      outdoor_humidity,
      program_id,
      created_at,
      updated_at,
      measure,
      notes,
      order_index,
      position_x,
      position_y,
      footage_from_origin_x,
      footage_from_origin_y
    )
    SELECT 
      new_submission_id,
      p_site_id,
      site_company_id,  -- Use the company_id from the site
      COALESCE(template->>'gasifier_code', template->>'gasifierCode'),  -- Handle both snake_case and camelCase
      COALESCE((COALESCE(template->>'chemical_type', template->>'chemicalType'))::chemical_type_enum, 'Citronella Blend'::chemical_type_enum),
      CASE 
        WHEN COALESCE(template->>'placement_height', template->>'placementHeight') != '' 
        THEN (COALESCE(template->>'placement_height', template->>'placementHeight'))::placement_height_enum 
        ELSE NULL 
      END,
      CASE 
        WHEN COALESCE(template->>'directional_placement', template->>'directionalPlacement') != '' 
        THEN (COALESCE(template->>'directional_placement', template->>'directionalPlacement'))::directional_placement_enum 
        ELSE NULL 
      END,
      CASE 
        WHEN COALESCE(template->>'placement_strategy', template->>'placementStrategy') != '' 
        THEN (COALESCE(template->>'placement_strategy', template->>'placementStrategy'))::placement_strategy_enum 
        ELSE NULL 
      END,
      (p_submission_data->>'temperature')::numeric,
      (p_submission_data->>'humidity')::numeric,
      p_program_id,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      NULL, -- measure will be filled in later
      NULL, -- notes will be filled in later
      COALESCE((template->>'order_index')::integer, (template->>'orderIndex')::integer),
      COALESCE((template->>'position_x')::numeric, (template->>'positionX')::numeric),
      COALESCE((template->>'position_y')::numeric, (template->>'positionY')::numeric),
      COALESCE((template->>'footage_from_origin_x')::numeric, (template->>'footageFromOriginX')::numeric),
      COALESCE((template->>'footage_from_origin_y')::numeric, (template->>'footageFromOriginY')::numeric)
    FROM jsonb_array_elements(p_gasifier_templates) AS template;
  END IF;
  
  IF p_petri_templates IS NOT NULL THEN
    INSERT INTO petri_observations (
      submission_id,
      site_id,
      company_id,  -- Add company_id here
      petri_code,
      fungicide_used,
      surrounding_water_schedule,
      program_id,
      created_at,
      updated_at,
      petri_growth_stage,  -- Changed from growth to petri_growth_stage
      notes,
      order_index,
      x_position,  -- Changed from position_x to x_position
      y_position,  -- Changed from position_y to y_position
      footage_from_origin_x,
      footage_from_origin_y
    )
    SELECT 
      new_submission_id,
      p_site_id,
      site_company_id,  -- Use the company_id from the site
      COALESCE(template->>'petri_code', template->>'petriCode'),  -- Handle both snake_case and camelCase
      COALESCE((COALESCE(template->>'fungicide_used', template->>'fungicideUsed'))::fungicide_used_enum, 'No'::fungicide_used_enum),
      COALESCE((COALESCE(template->>'surrounding_water_schedule', template->>'surroundingWaterSchedule'))::water_schedule_enum, 'Daily'::water_schedule_enum),
      p_program_id,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      NULL, -- growth will be filled in later
      NULL, -- notes will be filled in later
      COALESCE((template->>'order_index')::integer, (template->>'orderIndex')::integer),
      COALESCE((template->>'x_position')::numeric, (template->>'xPosition')::numeric, (template->>'position_x')::numeric, (template->>'positionX')::numeric),
      COALESCE((template->>'y_position')::numeric, (template->>'yPosition')::numeric, (template->>'position_y')::numeric, (template->>'positionY')::numeric),
      COALESCE((template->>'footage_from_origin_x')::numeric, (template->>'footageFromOriginX')::numeric),
      COALESCE((template->>'footage_from_origin_y')::numeric, (template->>'footageFromOriginY')::numeric)
    FROM jsonb_array_elements(p_petri_templates) AS template;
  END IF;
  
  -- Build result
  result := jsonb_build_object(
    'success', true,
    'submission_id', new_submission_id,
    'session_id', new_session_id,
    'message', 'Submission session created successfully',
    'gasifier_count', template_gasifier_count,
    'petri_count', template_petri_count
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback will happen automatically
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Error creating submission session: %s', SQLERRM)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_submission_session(UUID, UUID, JSONB, JSONB, JSONB) TO authenticated;