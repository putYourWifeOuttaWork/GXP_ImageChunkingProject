-- Fix custom_reports compatibility
-- This handles the case where custom_reports already exists as a table

-- First, check if custom_reports exists and has data
DO $$
DECLARE
    table_exists boolean;
    has_data boolean;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'custom_reports'
    ) INTO table_exists;

    IF table_exists THEN
        -- Check if it has data
        SELECT EXISTS (
            SELECT 1 FROM public.custom_reports LIMIT 1
        ) INTO has_data;

        IF has_data THEN
            -- If it has data, we need to migrate it to saved_reports
            RAISE NOTICE 'custom_reports table has data, migrating to saved_reports...';
            
            -- Migrate data (adjust column mappings as needed)
            INSERT INTO public.saved_reports (
                report_id,
                folder_id,
                report_name,
                description,
                report_type,
                report_config,
                data_source_config,
                created_by,
                created_at,
                updated_at,
                company_id,
                is_template
            )
            SELECT 
                report_id,
                (SELECT folder_id FROM public.report_folders WHERE folder_name = 'Migrated Reports' LIMIT 1),
                COALESCE(name, 'Untitled Report'),
                description,
                COALESCE(type, 'standard'),
                COALESCE(configuration, '{}'::jsonb),
                '{}'::jsonb, -- Default empty data source config
                created_by,
                created_at,
                updated_at,
                company_id,
                COALESCE(is_template, false)
            FROM public.custom_reports
            ON CONFLICT (report_id) DO NOTHING;

            -- Create a migration folder if it doesn't exist
            INSERT INTO public.report_folders (
                folder_name,
                company_id,
                created_by,
                description,
                color
            )
            SELECT DISTINCT
                'Migrated Reports',
                company_id,
                created_by,
                'Reports migrated from legacy system',
                '#6B7280'
            FROM public.custom_reports
            WHERE NOT EXISTS (
                SELECT 1 FROM public.report_folders 
                WHERE folder_name = 'Migrated Reports'
            )
            LIMIT 1;
        END IF;

        -- Rename the old table
        ALTER TABLE public.custom_reports RENAME TO custom_reports_backup;
        
        -- Create the view
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
        
        RAISE NOTICE 'Successfully created custom_reports view';
    ELSE
        -- If table doesn't exist, just create the view
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
        
        RAISE NOTICE 'Created custom_reports view';
    END IF;
END $$;

-- Ensure the view has proper security
ALTER VIEW public.custom_reports SET (security_invoker = true);