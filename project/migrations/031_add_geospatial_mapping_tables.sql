-- Add geospatial mapping tables for facility visualization
-- This extends your existing schema to support multi-scale mapping

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geospatial columns to existing sites table
ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS elevation INTEGER,
ADD COLUMN IF NOT EXISTS facility_layout JSONB,
ADD COLUMN IF NOT EXISTS facility_dimensions JSONB; -- {width: number, height: number, units: 'meters'|'feet'}

-- Create facility equipment table
CREATE TABLE IF NOT EXISTS facility_equipment (
    equipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(site_id) ON DELETE CASCADE,
    equipment_type VARCHAR(50) NOT NULL, -- 'petri_dish', 'gasifier', 'sensor', 'vent', 'shelving', 'door'
    label VARCHAR(100),
    position_x DECIMAL(10, 6) NOT NULL, -- X coordinate in facility
    position_y DECIMAL(10, 6) NOT NULL, -- Y coordinate in facility
    position_z DECIMAL(10, 6) DEFAULT 0, -- Z coordinate (height)
    effectiveness_radius DECIMAL(10, 6), -- Area of influence in facility units
    configuration JSONB, -- Equipment-specific settings
    installation_date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'maintenance'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    company_id UUID REFERENCES companies(company_id)
);

-- Create mold growth contours table
CREATE TABLE IF NOT EXISTS mold_growth_contours (
    contour_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(site_id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    contour_data JSONB NOT NULL, -- Array of {x, y, intensity} points
    contour_type VARCHAR(50) DEFAULT 'mold_growth', -- 'mold_growth', 'effectiveness', 'prediction'
    data_source VARCHAR(50) DEFAULT 'observation', -- 'observation', 'prediction', 'simulation'
    interpolation_method VARCHAR(50) DEFAULT 'kriging', -- 'kriging', 'idw', 'spline'
    resolution INTEGER DEFAULT 100, -- Grid resolution used for interpolation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    company_id UUID REFERENCES companies(company_id)
);

-- Create facility analytics aggregates table
CREATE TABLE IF NOT EXISTS facility_analytics (
    analytics_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(site_id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    total_mold_growth_index DECIMAL(10, 4),
    average_effectiveness DECIMAL(5, 4), -- Percentage 0-1
    critical_zones_count INTEGER DEFAULT 0,
    equipment_efficiency JSONB, -- Per-equipment efficiency metrics
    environmental_factors JSONB, -- Temperature, humidity, airflow
    growth_projections JSONB, -- 24h, 7d, 30d projections
    recommendations JSONB, -- Automated recommendations
    created_at TIMESTAMPTZ DEFAULT NOW(),
    company_id UUID REFERENCES companies(company_id)
);

-- Create spatial indexes for performance
CREATE INDEX IF NOT EXISTS idx_sites_location ON sites USING GIST (ST_Point(longitude, latitude));
CREATE INDEX IF NOT EXISTS idx_equipment_position ON facility_equipment USING GIST (ST_Point(position_x, position_y));
CREATE INDEX IF NOT EXISTS idx_contours_site_time ON mold_growth_contours (site_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_site_date ON facility_analytics (site_id, analysis_date);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_equipment_site_type ON facility_equipment (site_id, equipment_type);
CREATE INDEX IF NOT EXISTS idx_contours_site_type ON mold_growth_contours (site_id, contour_type);

-- Create RLS policies
ALTER TABLE facility_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE mold_growth_contours ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_analytics ENABLE ROW LEVEL SECURITY;

-- Equipment access policy
CREATE POLICY "Users can view equipment from their company"
ON facility_equipment FOR SELECT
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Contours access policy
CREATE POLICY "Users can view contours from their company"
ON mold_growth_contours FOR SELECT
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Analytics access policy
CREATE POLICY "Users can view analytics from their company"
ON facility_analytics FOR SELECT
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Function to calculate mold growth contours from observations
CREATE OR REPLACE FUNCTION generate_mold_growth_contours(
    p_site_id UUID,
    p_timestamp TIMESTAMPTZ DEFAULT NOW(),
    p_resolution INTEGER DEFAULT 100
)
RETURNS JSON AS $$
DECLARE
    contour_data JSON;
    facility_bounds JSON;
BEGIN
    -- Get facility dimensions
    SELECT facility_dimensions INTO facility_bounds
    FROM sites WHERE site_id = p_site_id;
    
    -- Generate contour data based on recent observations
    -- This is a simplified example - real implementation would use spatial interpolation
    WITH recent_observations AS (
        SELECT 
            equipment.position_x,
            equipment.position_y,
            equipment.effectiveness_radius,
            COALESCE(po.growth_index, 0) as growth_intensity,
            COALESCE(go.linear_reduction_per_day, 0) as reduction_rate
        FROM facility_equipment equipment
        LEFT JOIN petri_observations po ON equipment.equipment_id::text = po.petri_code
        LEFT JOIN gasifier_observations go ON equipment.equipment_id::text = go.gasifier_code
        WHERE equipment.site_id = p_site_id
        AND equipment.equipment_type IN ('petri_dish', 'gasifier')
        AND (po.created_at > p_timestamp - INTERVAL '24 hours' OR go.created_at > p_timestamp - INTERVAL '24 hours')
    )
    SELECT json_agg(
        json_build_object(
            'x', position_x,
            'y', position_y,
            'intensity', growth_intensity,
            'reduction_rate', reduction_rate,
            'radius', effectiveness_radius
        )
    ) INTO contour_data
    FROM recent_observations;
    
    -- Insert the contour data
    INSERT INTO mold_growth_contours (site_id, timestamp, contour_data, company_id)
    VALUES (
        p_site_id,
        p_timestamp,
        contour_data,
        (SELECT company_id FROM sites WHERE site_id = p_site_id)
    );
    
    RETURN contour_data;
END;
$$ LANGUAGE plpgsql;

-- Function to get facility mapping data for D3 visualization
CREATE OR REPLACE FUNCTION get_facility_mapping_data(p_site_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'facility_info', json_build_object(
            'site_id', s.site_id,
            'name', s.name,
            'latitude', s.latitude,
            'longitude', s.longitude,
            'dimensions', s.facility_dimensions,
            'layout', s.facility_layout
        ),
        'equipment', (
            SELECT json_agg(
                json_build_object(
                    'equipment_id', equipment_id,
                    'type', equipment_type,
                    'label', label,
                    'x', position_x,
                    'y', position_y,
                    'z', position_z,
                    'radius', effectiveness_radius,
                    'status', status,
                    'config', configuration
                )
            )
            FROM facility_equipment
            WHERE site_id = p_site_id
        ),
        'latest_contours', (
            SELECT contour_data
            FROM mold_growth_contours
            WHERE site_id = p_site_id
            ORDER BY timestamp DESC
            LIMIT 1
        ),
        'analytics', (
            SELECT json_build_object(
                'total_growth', total_mold_growth_index,
                'effectiveness', average_effectiveness,
                'critical_zones', critical_zones_count,
                'projections', growth_projections
            )
            FROM facility_analytics
            WHERE site_id = p_site_id
            ORDER BY analysis_date DESC
            LIMIT 1
        )
    ) INTO result
    FROM sites s
    WHERE s.site_id = p_site_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get global facilities overview
CREATE OR REPLACE FUNCTION get_global_facilities_overview()
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_build_object(
            'companies', json_agg(
                json_build_object(
                    'company_id', c.company_id,
                    'name', c.name,
                    'facilities', company_facilities.facilities
                )
            )
        )
        FROM companies c
        LEFT JOIN (
            SELECT 
                s.company_id,
                json_agg(
                    json_build_object(
                        'site_id', s.site_id,
                        'name', s.name,
                        'latitude', s.latitude,
                        'longitude', s.longitude,
                        'growth_projection', COALESCE(fa.total_mold_growth_index, 0),
                        'status', CASE 
                            WHEN fa.critical_zones_count > 5 THEN 'critical'
                            WHEN fa.critical_zones_count > 2 THEN 'warning'
                            ELSE 'healthy'
                        END
                    )
                ) as facilities
            FROM sites s
            LEFT JOIN facility_analytics fa ON s.site_id = fa.site_id
            WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
            GROUP BY s.company_id
        ) company_facilities ON c.company_id = company_facilities.company_id
        WHERE c.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON facility_equipment TO authenticated;
GRANT ALL ON mold_growth_contours TO authenticated;
GRANT ALL ON facility_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION generate_mold_growth_contours TO authenticated;
GRANT EXECUTE ON FUNCTION get_facility_mapping_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_facilities_overview TO authenticated;

-- Sample data population (for testing)
-- This would be populated based on your actual facility layouts
INSERT INTO facility_equipment (site_id, equipment_type, label, position_x, position_y, effectiveness_radius, company_id)
SELECT 
    s.site_id,
    'petri_dish',
    'Petri Station ' || (ROW_NUMBER() OVER()),
    (random() * 100)::decimal(10,6),
    (random() * 100)::decimal(10,6),
    15.0,
    s.company_id
FROM sites s
WHERE s.site_id IN (SELECT DISTINCT site_id FROM petri_observations LIMIT 5);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Geospatial mapping tables created successfully!';
    RAISE NOTICE '📊 Added tables:';
    RAISE NOTICE '   - facility_equipment: Equipment positioning and config';
    RAISE NOTICE '   - mold_growth_contours: Spatial contour data';
    RAISE NOTICE '   - facility_analytics: Aggregated facility metrics';
    RAISE NOTICE '🌍 Functions created:';
    RAISE NOTICE '   - get_global_facilities_overview(): Global facility map data';
    RAISE NOTICE '   - get_facility_mapping_data(): Individual facility details';
    RAISE NOTICE '   - generate_mold_growth_contours(): Spatial interpolation';
    RAISE NOTICE '🎯 Ready for D3.js visualization integration!';
END $$;