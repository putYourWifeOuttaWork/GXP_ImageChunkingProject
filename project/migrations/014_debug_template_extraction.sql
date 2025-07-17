-- Debug template extraction to see what's happening

-- First, let's test the JSON extraction directly
WITH test_template AS (
    SELECT '[{"gasifier_code": "G001", "chemical_type": "Citronella Blend", "placement_height": "Medium", "directional_placement": "North", "placement_strategy": "Perimeter", "order_index": 1, "position_x": 10.5, "position_y": 20.5, "footage_from_origin_x": 100, "footage_from_origin_y": 200}]'::jsonb as templates
)
SELECT 
    template->>'gasifier_code' as extracted_code,
    template->>'chemical_type' as extracted_type,
    template
FROM test_template, jsonb_array_elements(templates) AS template;

-- Let's also check what the frontend might be sending by checking what camelCase would extract
WITH test_template AS (
    SELECT '[{"gasifierCode": "G001", "chemicalType": "Citronella Blend", "placementHeight": "Medium", "directionalPlacement": "North", "placementStrategy": "Perimeter", "orderIndex": 1, "positionX": 10.5, "positionY": 20.5, "footageFromOriginX": 100, "footageFromOriginY": 200}]'::jsonb as templates
)
SELECT 
    template->>'gasifierCode' as camel_code,
    template->>'gasifier_code' as snake_code,
    template
FROM test_template, jsonb_array_elements(templates) AS template;

-- Now let's check what the actual templates look like from the frontend
-- by adding some logging to the function
CREATE OR REPLACE FUNCTION debug_template_format(p_templates JSONB)
RETURNS TABLE(key text, value text) AS $$
BEGIN
    IF p_templates IS NOT NULL AND jsonb_array_length(p_templates) > 0 THEN
        RETURN QUERY
        SELECT k::text, v::text
        FROM jsonb_array_elements(p_templates) AS elem(e),
             jsonb_each_text(e) AS item(k, v);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Test with both formats
SELECT * FROM debug_template_format('[{"gasifier_code": "G001", "chemical_type": "CLO2"}]'::jsonb);
SELECT * FROM debug_template_format('[{"gasifierCode": "G001", "chemicalType": "CLO2"}]'::jsonb);