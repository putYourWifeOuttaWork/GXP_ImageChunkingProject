-- Simple fix for custom_reports compatibility
-- This version just renames the table and creates a view

DO $$
BEGIN
    -- Check if custom_reports table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'custom_reports'
    ) THEN
        -- Rename the old table to backup
        ALTER TABLE public.custom_reports RENAME TO custom_reports_legacy;
        RAISE NOTICE 'Renamed custom_reports to custom_reports_legacy';
    END IF;
    
    -- Drop view if it somehow exists
    DROP VIEW IF EXISTS public.custom_reports;
    
    -- Create the compatibility view
    CREATE VIEW public.custom_reports AS
    SELECT 
        report_id,
        report_name AS name,
        description,
        report_config AS configuration,
        created_by,
        created_at,
        updated_at,
        company_id,
        is_template,
        'analytics' as category,
        report_type as type,
        last_accessed_at,
        access_count
    FROM public.saved_reports;

    -- Grant permissions
    GRANT ALL ON public.custom_reports TO authenticated;
    
    -- Set security invoker
    ALTER VIEW public.custom_reports SET (security_invoker = true);
    
    RAISE NOTICE 'Successfully created custom_reports compatibility view';
END $$;