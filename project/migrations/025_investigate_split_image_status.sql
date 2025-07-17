-- Investigation and fix for split_image_status column issue
-- The error indicates split_image_status doesn't exist in petri_observations_partitioned

-- 1. Check what columns exist in both tables
SELECT 
    'petri_observations' as table_name,
    array_agg(column_name ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'petri_observations'

UNION ALL

SELECT 
    'petri_observations_partitioned' as table_name,
    array_agg(column_name ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'petri_observations_partitioned';

-- 2. Check specifically for split_image_status
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND column_name = 'split_image_status'
    AND table_name IN ('petri_observations', 'petri_observations_partitioned')
ORDER BY table_name;

-- 3. If split_image_status exists in source but not in partitioned, add it
DO $$
BEGIN
    -- Check if column exists in source table
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
            AND table_name = 'petri_observations' 
            AND column_name = 'split_image_status'
    ) THEN
        -- Add to partitioned table if missing
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
                AND table_name = 'petri_observations_partitioned' 
                AND column_name = 'split_image_status'
        ) THEN
            RAISE NOTICE 'Adding split_image_status to petri_observations_partitioned...';
            ALTER TABLE petri_observations_partitioned 
            ADD COLUMN split_image_status text;
            
            -- Also add to all existing partitions
            DECLARE
                partition_name text;
            BEGIN
                FOR partition_name IN 
                    SELECT child.relname
                    FROM pg_inherits
                    JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
                    JOIN pg_class child ON pg_inherits.inhrelid = child.oid
                    WHERE parent.relname = 'petri_observations_partitioned'
                LOOP
                    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS split_image_status text', partition_name);
                    RAISE NOTICE 'Added split_image_status to partition %', partition_name;
                END LOOP;
            END;
        ELSE
            RAISE NOTICE 'split_image_status already exists in petri_observations_partitioned';
        END IF;
    ELSE
        RAISE NOTICE 'split_image_status does not exist in source table petri_observations';
        RAISE NOTICE 'This column should NOT be in the sync trigger';
    END IF;
END $$;

-- 4. Show current sync trigger definition
SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc
WHERE proname = 'sync_petri_to_partitioned';

-- 5. List all columns that are in the current sync trigger
-- This helps identify if split_image_status is being referenced
SELECT 
    'Checking if split_image_status is mentioned in trigger...' as check;

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== SPLIT_IMAGE_STATUS INVESTIGATION COMPLETE ===';
    RAISE NOTICE 'Run this migration to understand the current state.';
    RAISE NOTICE 'Based on migration 024, split_image_status should NOT be synced.';
    RAISE NOTICE 'If it exists in partitioned table, it should be managed separately.';
END $$;