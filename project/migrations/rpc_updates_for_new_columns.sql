-- RPC Updates for New Columns in Sandbox Schema
-- This migration adds necessary RPC support for the new columns added to gasifier and petri observations

-- ============================================
-- 1. ENUM Type Definitions (if not already exist)
-- ============================================

-- Create trend_category enum for gasifier observations
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trend_category') THEN
        CREATE TYPE trend_category AS ENUM (
            'CRITICAL_ACCELERATION',
            'HIGH_ACCELERATION', 
            'MODERATE_ACCELERATION',
            'STABLE',
            'MODERATE_DECELERATION',
            'HIGH_DECELERATION',
            'CRITICAL_DECELERATION',
            'INSUFFICIENT_DATA'
        );
    END IF;
END$$;

-- Create petri_trend_category enum for petri observations
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'petri_trend_category') THEN
        CREATE TYPE petri_trend_category AS ENUM (
            'RAPID_GROWTH',
            'STRONG_GROWTH',
            'MODERATE_GROWTH',
            'STABLE_GROWTH',
            'STAGNANT',
            'MODERATE_DECLINE',
            'SIGNIFICANT_DECLINE',
            'INSUFFICIENT_DATA'
        );
    END IF;
END$$;

-- Create experiment_role_enum for petri observations
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'experiment_role_enum') THEN
        CREATE TYPE experiment_role_enum AS ENUM (
            'CONTROL',
            'EXPERIMENTAL',
            'IGNORE_COMBINED',
            'INDIVIDUAL_SAMPLE',
            'INSUFFICIENT_DATA'
        );
    END IF;
END$$;

-- ============================================
-- 2. RPC Functions for Gasifier Observations
-- ============================================

-- Drop existing RPC functions if they exist
DROP FUNCTION IF EXISTS create_gasifier_observation CASCADE;
DROP FUNCTION IF EXISTS update_gasifier_observation CASCADE;
DROP FUNCTION IF EXISTS get_gasifier_observations CASCADE;

-- Create comprehensive RPC function for inserting gasifier observations
CREATE OR REPLACE FUNCTION create_gasifier_observation(
    p_submission_id uuid,
    p_site_id uuid,
    p_gasifier_code text,
    p_image_url text DEFAULT NULL,
    p_chemical_type chemical_type_enum DEFAULT 'Citronella Blend',
    p_measure numeric DEFAULT NULL,
    p_anomaly boolean DEFAULT false,
    p_notes text DEFAULT NULL,
    p_program_id uuid DEFAULT NULL,
    p_placement_height placement_height_enum DEFAULT NULL,
    p_directional_placement directional_placement_enum DEFAULT NULL,
    p_placement_strategy placement_strategy_enum DEFAULT NULL,
    p_outdoor_temperature numeric DEFAULT NULL,
    p_outdoor_humidity numeric DEFAULT NULL,
    p_order_index integer DEFAULT NULL,
    p_position_x numeric DEFAULT NULL,
    p_position_y numeric DEFAULT NULL,
    p_footage_from_origin_x numeric DEFAULT 0,
    p_footage_from_origin_y numeric DEFAULT 0,
    p_linear_reading real DEFAULT NULL,
    p_flag_for_review boolean DEFAULT false,
    p_company_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_observation_id uuid;
    v_company_id uuid;
BEGIN
    -- Get company_id if not provided
    IF p_company_id IS NULL THEN
        SELECT c.company_id INTO v_company_id
        FROM sites s
        JOIN pilot_programs pp ON s.program_id = pp.program_id
        JOIN companies c ON pp.company_id = c.company_id
        WHERE s.site_id = p_site_id;
    ELSE
        v_company_id := p_company_id;
    END IF;

    -- Insert into partitioned table
    INSERT INTO gasifier_observations_partitioned (
        submission_id,
        site_id,
        gasifier_code,
        image_url,
        chemical_type,
        measure,
        anomaly,
        notes,
        program_id,
        placement_height,
        directional_placement,
        placement_strategy,
        outdoor_temperature,
        outdoor_humidity,
        order_index,
        position_x,
        position_y,
        footage_from_origin_x,
        footage_from_origin_y,
        linear_reading,
        flag_for_review,
        company_id,
        last_updated_by_user_id,
        lastupdated_by
    ) VALUES (
        p_submission_id,
        p_site_id,
        p_gasifier_code,
        p_image_url,
        p_chemical_type,
        p_measure,
        p_anomaly,
        p_notes,
        COALESCE(p_program_id, (SELECT program_id FROM sites WHERE site_id = p_site_id)),
        p_placement_height,
        p_directional_placement,
        p_placement_strategy,
        p_outdoor_temperature,
        p_outdoor_humidity,
        p_order_index,
        p_position_x,
        p_position_y,
        p_footage_from_origin_x,
        p_footage_from_origin_y,
        p_linear_reading,
        p_flag_for_review,
        v_company_id,
        auth.uid(),
        auth.uid()
    ) RETURNING observation_id INTO v_observation_id;

    RETURN v_observation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function for updating gasifier observations
CREATE OR REPLACE FUNCTION update_gasifier_observation(
    p_observation_id uuid,
    p_linear_reading real DEFAULT NULL,
    p_measure numeric DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_anomaly boolean DEFAULT NULL,
    p_flag_for_review boolean DEFAULT NULL
) RETURNS boolean AS $$
BEGIN
    UPDATE gasifier_observations_partitioned
    SET 
        linear_reading = COALESCE(p_linear_reading, linear_reading),
        measure = COALESCE(p_measure, measure),
        notes = COALESCE(p_notes, notes),
        anomaly = COALESCE(p_anomaly, anomaly),
        flag_for_review = COALESCE(p_flag_for_review, flag_for_review),
        updated_at = NOW(),
        last_edit_time = NOW(),
        last_updated_by_user_id = auth.uid(),
        lastupdated_by = auth.uid()
    WHERE observation_id = p_observation_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function for retrieving gasifier observations with computed columns
CREATE OR REPLACE FUNCTION get_gasifier_observations(
    p_program_id uuid DEFAULT NULL,
    p_site_id uuid DEFAULT NULL,
    p_submission_id uuid DEFAULT NULL,
    p_gasifier_code text DEFAULT NULL,
    p_include_computed boolean DEFAULT true
) RETURNS TABLE (
    observation_id uuid,
    submission_id uuid,
    site_id uuid,
    gasifier_code text,
    image_url text,
    chemical_type chemical_type_enum,
    measure numeric,
    anomaly boolean,
    notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    program_id uuid,
    placement_height placement_height_enum,
    directional_placement directional_placement_enum,
    placement_strategy placement_strategy_enum,
    outdoor_temperature numeric,
    outdoor_humidity numeric,
    order_index integer,
    position_x numeric,
    position_y numeric,
    footage_from_origin_x numeric,
    footage_from_origin_y numeric,
    linear_reading real,
    linear_reduction_nominal real,
    linear_reduction_per_day real,
    flow_rate real,
    flag_for_review boolean,
    company_id uuid,
    forecasted_expiration timestamp without time zone,
    trend_gasifier_velocity trend_category
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.observation_id,
        g.submission_id,
        g.site_id,
        g.gasifier_code,
        g.image_url,
        g.chemical_type,
        g.measure,
        g.anomaly,
        g.notes,
        g.created_at,
        g.updated_at,
        g.program_id,
        g.placement_height,
        g.directional_placement,
        g.placement_strategy,
        g.outdoor_temperature,
        g.outdoor_humidity,
        g.order_index,
        g.position_x,
        g.position_y,
        g.footage_from_origin_x,
        g.footage_from_origin_y,
        g.linear_reading,
        CASE WHEN p_include_computed THEN g.linear_reduction_nominal ELSE NULL END,
        CASE WHEN p_include_computed THEN g.linear_reduction_per_day ELSE NULL END,
        CASE WHEN p_include_computed THEN g.flow_rate ELSE NULL END,
        g.flag_for_review,
        g.company_id,
        CASE WHEN p_include_computed THEN g.forecasted_expiration ELSE NULL END,
        CASE WHEN p_include_computed THEN g.trend_gasifier_velocity ELSE NULL END
    FROM gasifier_observations_partitioned g
    WHERE (p_program_id IS NULL OR g.program_id = p_program_id)
      AND (p_site_id IS NULL OR g.site_id = p_site_id)
      AND (p_submission_id IS NULL OR g.submission_id = p_submission_id)
      AND (p_gasifier_code IS NULL OR g.gasifier_code = p_gasifier_code)
    ORDER BY g.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. RPC Functions for Petri Observations
-- ============================================

-- Drop existing RPC functions if they exist
DROP FUNCTION IF EXISTS create_petri_observation CASCADE;
DROP FUNCTION IF EXISTS update_petri_observation CASCADE;
DROP FUNCTION IF EXISTS get_petri_observations CASCADE;

-- Create comprehensive RPC function for inserting petri observations
CREATE OR REPLACE FUNCTION create_petri_observation(
    p_submission_id uuid,
    p_site_id uuid,
    p_petri_code varchar,
    p_image_url text DEFAULT NULL,
    p_fungicide_used fungicide_used_enum DEFAULT 'None',
    p_surrounding_water_schedule surrounding_water_schedule_enum DEFAULT 'None',
    p_notes varchar DEFAULT NULL,
    p_plant_type plant_type_enum DEFAULT 'Other Fresh Perishable',
    p_program_id uuid DEFAULT NULL,
    p_placement petri_placement_enum DEFAULT NULL,
    p_placement_dynamics petri_placement_dynamics_enum DEFAULT NULL,
    p_outdoor_temperature numeric DEFAULT NULL,
    p_outdoor_humidity numeric DEFAULT NULL,
    p_petri_growth_stage petri_growth_stage DEFAULT 'None',
    p_growth_index numeric DEFAULT 0,
    p_order_index integer DEFAULT NULL,
    p_x_position numeric DEFAULT NULL,
    p_y_position numeric DEFAULT NULL,
    p_footage_from_origin_x numeric DEFAULT 0,
    p_footage_from_origin_y numeric DEFAULT 0,
    p_phase_observation_settings jsonb DEFAULT NULL,
    p_flag_for_review boolean DEFAULT false,
    p_company_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_observation_id uuid;
    v_company_id uuid;
BEGIN
    -- Get company_id if not provided
    IF p_company_id IS NULL THEN
        SELECT c.company_id INTO v_company_id
        FROM sites s
        JOIN pilot_programs pp ON s.program_id = pp.program_id
        JOIN companies c ON pp.company_id = c.company_id
        WHERE s.site_id = p_site_id;
    ELSE
        v_company_id := p_company_id;
    END IF;

    -- Insert into partitioned table
    INSERT INTO petri_observations_partitioned (
        submission_id,
        site_id,
        petri_code,
        image_url,
        fungicide_used,
        surrounding_water_schedule,
        notes,
        plant_type,
        program_id,
        placement,
        placement_dynamics,
        outdoor_temperature,
        outdoor_humidity,
        petri_growth_stage,
        growth_index,
        order_index,
        x_position,
        y_position,
        footage_from_origin_x,
        footage_from_origin_y,
        phase_observation_settings,
        flag_for_review,
        company_id,
        last_updated_by_user_id,
        lastupdated_by
    ) VALUES (
        p_submission_id,
        p_site_id,
        p_petri_code,
        p_image_url,
        p_fungicide_used,
        p_surrounding_water_schedule,
        p_notes,
        p_plant_type,
        COALESCE(p_program_id, (SELECT program_id FROM sites WHERE site_id = p_site_id)),
        p_placement,
        p_placement_dynamics,
        p_outdoor_temperature,
        p_outdoor_humidity,
        p_petri_growth_stage,
        p_growth_index,
        p_order_index,
        p_x_position,
        p_y_position,
        p_footage_from_origin_x,
        p_footage_from_origin_y,
        p_phase_observation_settings,
        p_flag_for_review,
        v_company_id,
        auth.uid(),
        auth.uid()
    ) RETURNING observation_id INTO v_observation_id;

    RETURN v_observation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function for updating petri observations
CREATE OR REPLACE FUNCTION update_petri_observation(
    p_observation_id uuid,
    p_growth_index numeric DEFAULT NULL,
    p_petri_growth_stage petri_growth_stage DEFAULT NULL,
    p_notes varchar DEFAULT NULL,
    p_flag_for_review boolean DEFAULT NULL,
    p_phase_observation_settings jsonb DEFAULT NULL
) RETURNS boolean AS $$
BEGIN
    UPDATE petri_observations_partitioned
    SET 
        growth_index = COALESCE(p_growth_index, growth_index),
        petri_growth_stage = COALESCE(p_petri_growth_stage, petri_growth_stage),
        notes = COALESCE(p_notes, notes),
        flag_for_review = COALESCE(p_flag_for_review, flag_for_review),
        phase_observation_settings = COALESCE(p_phase_observation_settings, phase_observation_settings),
        updated_at = NOW(),
        last_edit_time = NOW(),
        last_updated_by_user_id = auth.uid(),
        lastupdated_by = auth.uid()
    WHERE observation_id = p_observation_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function for retrieving petri observations with computed columns
CREATE OR REPLACE FUNCTION get_petri_observations(
    p_program_id uuid DEFAULT NULL,
    p_site_id uuid DEFAULT NULL,
    p_submission_id uuid DEFAULT NULL,
    p_petri_code varchar DEFAULT NULL,
    p_include_computed boolean DEFAULT true
) RETURNS TABLE (
    observation_id uuid,
    submission_id uuid,
    site_id uuid,
    petri_code varchar,
    image_url text,
    fungicide_used fungicide_used_enum,
    surrounding_water_schedule surrounding_water_schedule_enum,
    notes varchar,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    plant_type plant_type_enum,
    program_id uuid,
    placement petri_placement_enum,
    placement_dynamics petri_placement_dynamics_enum,
    outdoor_temperature numeric,
    outdoor_humidity numeric,
    petri_growth_stage petri_growth_stage,
    growth_index numeric,
    order_index integer,
    x_position numeric,
    y_position numeric,
    footage_from_origin_x numeric,
    footage_from_origin_y numeric,
    growth_progression numeric,
    growth_velocity real,
    phase_observation_settings jsonb,
    flag_for_review boolean,
    company_id uuid,
    trend_petri_velocity petri_trend_category,
    experiment_role experiment_role_enum
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.observation_id,
        p.submission_id,
        p.site_id,
        p.petri_code,
        p.image_url,
        p.fungicide_used,
        p.surrounding_water_schedule,
        p.notes,
        p.created_at,
        p.updated_at,
        p.plant_type,
        p.program_id,
        p.placement,
        p.placement_dynamics,
        p.outdoor_temperature,
        p.outdoor_humidity,
        p.petri_growth_stage,
        p.growth_index,
        p.order_index,
        p.x_position,
        p.y_position,
        p.footage_from_origin_x,
        p.footage_from_origin_y,
        CASE WHEN p_include_computed THEN p.growth_progression ELSE NULL END,
        CASE WHEN p_include_computed THEN p.growth_velocity ELSE NULL END,
        p.phase_observation_settings,
        p.flag_for_review,
        p.company_id,
        CASE WHEN p_include_computed THEN p.trend_petri_velocity ELSE NULL END,
        CASE WHEN p_include_computed THEN p.experiment_role ELSE NULL END
    FROM petri_observations_partitioned p
    WHERE (p_program_id IS NULL OR p.program_id = p_program_id)
      AND (p_site_id IS NULL OR p.site_id = p_site_id)
      AND (p_submission_id IS NULL OR p.submission_id = p_submission_id)
      AND (p_petri_code IS NULL OR p.petri_code = p_petri_code)
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. RPC Functions for Analysis and Reporting
-- ============================================

-- Create RPC function for gasifier trend analysis
CREATE OR REPLACE FUNCTION get_gasifier_trend_analysis(
    p_program_id uuid,
    p_start_date timestamp with time zone DEFAULT NULL,
    p_end_date timestamp with time zone DEFAULT NULL
) RETURNS TABLE (
    gasifier_code text,
    latest_trend trend_category,
    avg_flow_rate numeric,
    avg_momentum numeric,
    total_observations bigint,
    forecasted_expiration timestamp without time zone,
    days_until_expiration numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.gasifier_code,
        (SELECT trend_gasifier_velocity 
         FROM gasifier_observations_partitioned 
         WHERE gasifier_code = g.gasifier_code 
           AND program_id = p_program_id 
         ORDER BY created_at DESC 
         LIMIT 1) as latest_trend,
        ROUND(AVG(g.flow_rate)::numeric, 4) as avg_flow_rate,
        ROUND(AVG(g.linear_reduction_per_day)::numeric, 4) as avg_momentum,
        COUNT(*) as total_observations,
        MAX(g.forecasted_expiration) as forecasted_expiration,
        ROUND(EXTRACT(EPOCH FROM (MAX(g.forecasted_expiration) - NOW())) / 86400.0, 2) as days_until_expiration
    FROM gasifier_observations_partitioned g
    WHERE g.program_id = p_program_id
      AND (p_start_date IS NULL OR g.created_at >= p_start_date)
      AND (p_end_date IS NULL OR g.created_at <= p_end_date)
      AND g.flow_rate IS NOT NULL
    GROUP BY g.gasifier_code
    ORDER BY days_until_expiration ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function for petri control vs experimental analysis
CREATE OR REPLACE FUNCTION get_petri_experiment_analysis(
    p_program_id uuid,
    p_start_date timestamp with time zone DEFAULT NULL,
    p_end_date timestamp with time zone DEFAULT NULL
) RETURNS TABLE (
    base_petri_code text,
    control_avg_velocity numeric,
    experimental_avg_velocity numeric,
    velocity_difference numeric,
    control_avg_growth numeric,
    experimental_avg_growth numeric,
    growth_difference numeric,
    control_trend petri_trend_category,
    experimental_trend petri_trend_category
) AS $$
BEGIN
    RETURN QUERY
    WITH petri_aggregates AS (
        SELECT 
            COALESCE(
                phase_observation_settings->>'base_petri_code',
                REGEXP_REPLACE(petri_code, '_(Left|Right|_1)$', '')
            ) as base_code,
            experiment_role,
            AVG(growth_velocity) as avg_velocity,
            AVG(growth_index) as avg_growth,
            (SELECT trend_petri_velocity 
             FROM petri_observations_partitioned p2
             WHERE p2.petri_code = p.petri_code 
               AND p2.program_id = p_program_id
             ORDER BY created_at DESC 
             LIMIT 1) as latest_trend
        FROM petri_observations_partitioned p
        WHERE program_id = p_program_id
          AND (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
          AND experiment_role IN ('CONTROL', 'EXPERIMENTAL')
        GROUP BY base_code, experiment_role, petri_code
    )
    SELECT 
        base_code,
        ROUND(MAX(CASE WHEN experiment_role = 'CONTROL' THEN avg_velocity END)::numeric, 4),
        ROUND(MAX(CASE WHEN experiment_role = 'EXPERIMENTAL' THEN avg_velocity END)::numeric, 4),
        ROUND((MAX(CASE WHEN experiment_role = 'EXPERIMENTAL' THEN avg_velocity END) - 
               MAX(CASE WHEN experiment_role = 'CONTROL' THEN avg_velocity END))::numeric, 4),
        ROUND(MAX(CASE WHEN experiment_role = 'CONTROL' THEN avg_growth END)::numeric, 4),
        ROUND(MAX(CASE WHEN experiment_role = 'EXPERIMENTAL' THEN avg_growth END)::numeric, 4),
        ROUND((MAX(CASE WHEN experiment_role = 'EXPERIMENTAL' THEN avg_growth END) - 
               MAX(CASE WHEN experiment_role = 'CONTROL' THEN avg_growth END))::numeric, 4),
        MAX(CASE WHEN experiment_role = 'CONTROL' THEN latest_trend END),
        MAX(CASE WHEN experiment_role = 'EXPERIMENTAL' THEN latest_trend END)
    FROM petri_aggregates
    GROUP BY base_code
    ORDER BY base_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Grant Permissions
-- ============================================

-- Grant execute permissions on all RPC functions
GRANT EXECUTE ON FUNCTION create_gasifier_observation TO authenticated;
GRANT EXECUTE ON FUNCTION update_gasifier_observation TO authenticated;
GRANT EXECUTE ON FUNCTION get_gasifier_observations TO authenticated;
GRANT EXECUTE ON FUNCTION create_petri_observation TO authenticated;
GRANT EXECUTE ON FUNCTION update_petri_observation TO authenticated;
GRANT EXECUTE ON FUNCTION get_petri_observations TO authenticated;
GRANT EXECUTE ON FUNCTION get_gasifier_trend_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION get_petri_experiment_analysis TO authenticated;

-- ============================================
-- 6. Create indexes for performance
-- ============================================

-- Create indexes on new columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_gasifier_obs_trend ON gasifier_observations_partitioned(trend_gasifier_velocity);
CREATE INDEX IF NOT EXISTS idx_gasifier_obs_forecast ON gasifier_observations_partitioned(forecasted_expiration);
CREATE INDEX IF NOT EXISTS idx_petri_obs_trend ON petri_observations_partitioned(trend_petri_velocity);
CREATE INDEX IF NOT EXISTS idx_petri_obs_experiment ON petri_observations_partitioned(experiment_role);
CREATE INDEX IF NOT EXISTS idx_petri_obs_company ON petri_observations_partitioned(company_id);
CREATE INDEX IF NOT EXISTS idx_gasifier_obs_company ON gasifier_observations_partitioned(company_id);

-- ============================================
-- 7. Add RLS policies for new columns
-- ============================================

-- Enable RLS on partitioned tables
ALTER TABLE gasifier_observations_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE petri_observations_partitioned ENABLE ROW LEVEL SECURITY;

-- Create policies for gasifier observations
CREATE POLICY "Users can view gasifier observations from their company" ON gasifier_observations_partitioned
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert gasifier observations for their company" ON gasifier_observations_partitioned
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update gasifier observations from their company" ON gasifier_observations_partitioned
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Create policies for petri observations
CREATE POLICY "Users can view petri observations from their company" ON petri_observations_partitioned
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert petri observations for their company" ON petri_observations_partitioned
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update petri observations from their company" ON petri_observations_partitioned
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- ============================================
-- 8. Comments for documentation
-- ============================================

COMMENT ON FUNCTION create_gasifier_observation IS 'Creates a new gasifier observation with automatic computation of derived fields';
COMMENT ON FUNCTION update_gasifier_observation IS 'Updates an existing gasifier observation and triggers recomputation of derived fields';
COMMENT ON FUNCTION get_gasifier_observations IS 'Retrieves gasifier observations with optional computed columns';
COMMENT ON FUNCTION create_petri_observation IS 'Creates a new petri observation with automatic computation of growth metrics';
COMMENT ON FUNCTION update_petri_observation IS 'Updates an existing petri observation and triggers recomputation of growth metrics';
COMMENT ON FUNCTION get_petri_observations IS 'Retrieves petri observations with optional computed columns';
COMMENT ON FUNCTION get_gasifier_trend_analysis IS 'Provides trend analysis for gasifier performance by code';
COMMENT ON FUNCTION get_petri_experiment_analysis IS 'Compares control vs experimental petri growth metrics';