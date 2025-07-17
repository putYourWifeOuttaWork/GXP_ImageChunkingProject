-- Compute Petri Growth Stage from Growth Index
-- ============================================
-- This migration creates a function to map growth_index values to petri_growth_stage enum values
-- and updates existing records with the computed values.

-- Create function to compute growth stage from growth index
CREATE OR REPLACE FUNCTION compute_petri_growth_stage(growth_index_value NUMERIC)
RETURNS enum_petri_growth_stage AS $$
BEGIN
    -- Handle NULL or negative values
    IF growth_index_value IS NULL OR growth_index_value < 0 THEN
        RETURN 'None'::enum_petri_growth_stage;
    END IF;
    
    -- Map growth index ranges to growth stages
    CASE 
        WHEN growth_index_value >= 1 AND growth_index_value <= 5 THEN
            RETURN 'Trace'::enum_petri_growth_stage;
        WHEN growth_index_value >= 6 AND growth_index_value <= 10 THEN
            RETURN 'Very Low'::enum_petri_growth_stage;
        WHEN growth_index_value >= 11 AND growth_index_value <= 15 THEN
            RETURN 'Low'::enum_petri_growth_stage;
        WHEN growth_index_value >= 16 AND growth_index_value <= 25 THEN
            RETURN 'Moderate'::enum_petri_growth_stage;
        WHEN growth_index_value >= 26 AND growth_index_value <= 35 THEN
            RETURN 'Moderately High'::enum_petri_growth_stage;
        WHEN growth_index_value >= 36 AND growth_index_value <= 50 THEN
            RETURN 'High'::enum_petri_growth_stage;
        WHEN growth_index_value >= 51 AND growth_index_value <= 74 THEN
            RETURN 'Very High'::enum_petri_growth_stage;
        WHEN growth_index_value >= 75 AND growth_index_value <= 85 THEN
            RETURN 'Hazardous'::enum_petri_growth_stage;
        WHEN growth_index_value > 85 THEN
            RETURN 'TNTC Overrun'::enum_petri_growth_stage;
        ELSE
            RETURN 'None'::enum_petri_growth_stage;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test the function with sample values
SELECT 
    growth_index,
    compute_petri_growth_stage(growth_index) as computed_stage
FROM (
    VALUES 
        (0), (3), (8), (12), (20), (30), (45), (60), (80), (90), (NULL)
) AS test_values(growth_index);

-- Update petri_observations_partitioned table
-- Note: This will update ALL partitioned tables that inherit from petri_observations_partitioned
UPDATE petri_observations_partitioned 
SET petri_growth_stage = compute_petri_growth_stage(growth_index)
WHERE growth_index IS NOT NULL 
AND (petri_growth_stage IS NULL OR petri_growth_stage = 'None');

-- Update the default petri_obs_part_default table
UPDATE petri_obs_part_default 
SET petri_growth_stage = compute_petri_growth_stage(growth_index)
WHERE growth_index IS NOT NULL 
AND (petri_growth_stage IS NULL OR petri_growth_stage = 'None');

-- Update individual partition tables (if they have data)
DO $$
DECLARE
    partition_record RECORD;
    update_count INTEGER;
BEGIN
    -- Get all partition table names
    FOR partition_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'petri_obs_prog_%'
    LOOP
        -- Update each partition table
        EXECUTE format('
            UPDATE %I.%I 
            SET petri_growth_stage = compute_petri_growth_stage(growth_index)
            WHERE growth_index IS NOT NULL 
            AND (petri_growth_stage IS NULL OR petri_growth_stage = ''None'')
        ', partition_record.schemaname, partition_record.tablename);
        
        GET DIAGNOSTICS update_count = ROW_COUNT;
        RAISE NOTICE 'Updated % rows in table %', update_count, partition_record.tablename;
    END LOOP;
END $$;

-- Create a trigger to automatically compute growth stage on insert/update
CREATE OR REPLACE FUNCTION trigger_compute_petri_growth_stage()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically compute growth stage when growth_index changes
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.growth_index IS DISTINCT FROM NEW.growth_index) THEN
        NEW.petri_growth_stage = compute_petri_growth_stage(NEW.growth_index);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to the main partitioned table (will apply to all partitions)
DROP TRIGGER IF EXISTS compute_growth_stage_trigger ON petri_observations_partitioned;
CREATE TRIGGER compute_growth_stage_trigger
    BEFORE INSERT OR UPDATE ON petri_observations_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION trigger_compute_petri_growth_stage();

-- Apply trigger to the default partition table
DROP TRIGGER IF EXISTS compute_growth_stage_trigger ON petri_obs_part_default;
CREATE TRIGGER compute_growth_stage_trigger
    BEFORE INSERT OR UPDATE ON petri_obs_part_default
    FOR EACH ROW
    EXECUTE FUNCTION trigger_compute_petri_growth_stage();

-- Verification query to show the distribution of growth stages
SELECT 
    petri_growth_stage,
    COUNT(*) as count,
    MIN(growth_index) as min_growth_index,
    MAX(growth_index) as max_growth_index,
    ROUND(AVG(growth_index), 2) as avg_growth_index
FROM petri_observations_partitioned 
WHERE growth_index IS NOT NULL
GROUP BY petri_growth_stage
ORDER BY 
    CASE petri_growth_stage
        WHEN 'None' THEN 0
        WHEN 'Trace' THEN 1
        WHEN 'Very Low' THEN 2
        WHEN 'Low' THEN 3
        WHEN 'Moderate' THEN 4
        WHEN 'Moderately High' THEN 5
        WHEN 'High' THEN 6
        WHEN 'Very High' THEN 7
        WHEN 'Hazardous' THEN 8
        WHEN 'TNTC Overrun' THEN 9
    END;

-- Show function definition for reference
\df+ compute_petri_growth_stage