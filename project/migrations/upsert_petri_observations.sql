-- SQL snippet to upsert petri observations from CSV data
-- This uses PostgreSQL's ON CONFLICT functionality for upserting

-- First, create a temporary table to load the CSV data
CREATE TEMP TABLE temp_petri_import (
    observation_id UUID,
    petri_code TEXT,
    fungicide_used TEXT,
    growth_index NUMERIC,
    notes TEXT,
    growth_progression NUMERIC,
    growth_aggression NUMERIC
);

-- Copy data from CSV file (adjust path as needed)
-- Option 1: If running from psql client
\copy temp_petri_import FROM '/Users/thefinalmachine/Downloads/Petri_observation_Review_for_grounding_AI_Andrew  and Austin_AMEdits - Copy of Sheet 1 - Petri_observation_Rev (2).csv' WITH CSV HEADER;

-- Option 2: If you have the CSV data in a different location or using a different method
-- You can also use COPY command (requires superuser):
-- COPY temp_petri_import FROM '/path/to/your/file.csv' WITH CSV HEADER;

-- Now perform the upsert
INSERT INTO petri_observations (
    observation_id,
    petri_code,
    fungicide_used,
    growth_index,
    notes,
    growth_progression,
    growth_aggression,
    -- Set default values for required fields not in CSV
    submission_id,
    site_id,
    program_id,
    created_at,
    updated_at
)
SELECT 
    t.observation_id,
    t.petri_code,
    t.fungicide_used::fungicide_used_enum, -- Cast to enum type
    t.growth_index,
    t.notes,
    t.growth_progression,
    t.growth_aggression,
    -- You'll need to provide these values or join with existing data
    -- For now, using placeholders - adjust based on your needs
    NULL::UUID as submission_id,  -- Replace with actual submission_id
    NULL::UUID as site_id,        -- Replace with actual site_id
    NULL::UUID as program_id,      -- Replace with actual program_id
    COALESCE(p.created_at, NOW()) as created_at,
    NOW() as updated_at
FROM temp_petri_import t
LEFT JOIN petri_observations p ON p.observation_id = t.observation_id
ON CONFLICT (observation_id) DO UPDATE SET
    petri_code = EXCLUDED.petri_code,
    fungicide_used = EXCLUDED.fungicide_used,
    growth_index = EXCLUDED.growth_index,
    notes = EXCLUDED.notes,
    growth_progression = EXCLUDED.growth_progression,
    growth_aggression = EXCLUDED.growth_aggression,
    updated_at = NOW();

-- Clean up temporary table
DROP TABLE temp_petri_import;

-- Alternatively, if you want to update only specific fields and preserve others:
/*
INSERT INTO petri_observations (observation_id, petri_code, fungicide_used, growth_index, notes, growth_progression, growth_aggression)
SELECT 
    observation_id,
    petri_code,
    fungicide_used::fungicide_used_enum,
    growth_index,
    notes,
    growth_progression,
    growth_aggression
FROM temp_petri_import
ON CONFLICT (observation_id) DO UPDATE SET
    growth_index = EXCLUDED.growth_index,
    growth_progression = EXCLUDED.growth_progression,
    growth_aggression = EXCLUDED.growth_aggression,
    notes = CASE 
        WHEN EXCLUDED.notes IS NOT NULL AND EXCLUDED.notes != '' 
        THEN EXCLUDED.notes 
        ELSE petri_observations.notes 
    END,
    updated_at = NOW()
WHERE 
    petri_observations.growth_index IS DISTINCT FROM EXCLUDED.growth_index OR
    petri_observations.growth_progression IS DISTINCT FROM EXCLUDED.growth_progression OR
    petri_observations.growth_aggression IS DISTINCT FROM EXCLUDED.growth_aggression;
*/

-- To check what will be updated before running:
/*
SELECT 
    t.observation_id,
    p.growth_index as current_growth_index,
    t.growth_index as new_growth_index,
    p.growth_progression as current_progression,
    t.growth_progression as new_progression,
    p.growth_aggression as current_aggression,
    t.growth_aggression as new_aggression
FROM temp_petri_import t
JOIN petri_observations p ON p.observation_id = t.observation_id
WHERE 
    p.growth_index IS DISTINCT FROM t.growth_index::numeric OR
    p.growth_progression IS DISTINCT FROM t.growth_progression::numeric OR
    p.growth_aggression IS DISTINCT FROM t.growth_aggression::numeric;
*/