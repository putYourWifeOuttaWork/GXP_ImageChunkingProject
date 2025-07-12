-- Check and Create Required Enum Types
-- =====================================

-- Check which enums exist
SELECT 
    n.nspname as schema,
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname
ORDER BY t.typname;

-- Create enums if they don't exist
DO $$
BEGIN
    -- enum_placement
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_placement') THEN
        CREATE TYPE enum_placement AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5', 'S1', 'R1');
        RAISE NOTICE 'Created enum_placement';
    END IF;
    
    -- enum_fungicide_used
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_fungicide_used') THEN
        CREATE TYPE enum_fungicide_used AS ENUM ('Yes', 'No');
        RAISE NOTICE 'Created enum_fungicide_used';
    END IF;
    
    -- enum_petri_growth_stage
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_petri_growth_stage') THEN
        CREATE TYPE enum_petri_growth_stage AS ENUM (
            'None', 'Trace', 'Very Low', 'Low', 'Moderate', 
            'Moderately High', 'High', 'Very High', 'Hazardous', 'TNTC Overrun'
        );
        RAISE NOTICE 'Created enum_petri_growth_stage';
    END IF;
    
    -- enum_chemical_type
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_chemical_type') THEN
        CREATE TYPE enum_chemical_type AS ENUM ('Type A', 'Type B', 'Type C');
        RAISE NOTICE 'Created enum_chemical_type';
    END IF;
END $$;

-- Verify all enums exist
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_placement') THEN '✅'
        ELSE '❌'
    END || ' enum_placement' as status
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_fungicide_used') THEN '✅'
        ELSE '❌'
    END || ' enum_fungicide_used'
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_petri_growth_stage') THEN '✅'
        ELSE '❌'
    END || ' enum_petri_growth_stage'
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_chemical_type') THEN '✅'
        ELSE '❌'
    END || ' enum_chemical_type';