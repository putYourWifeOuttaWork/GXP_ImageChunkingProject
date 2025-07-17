-- Fix custom_reports compatibility (safe version)
-- First, let's see what columns actually exist

-- Show the actual structure of custom_reports
DO $$
DECLARE
    col_record RECORD;
    col_list TEXT := '';
BEGIN
    -- List all columns in custom_reports
    FOR col_record IN 
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'custom_reports'
        ORDER BY ordinal_position
    LOOP
        col_list := col_list || col_record.column_name || ' (' || col_record.data_type || '), ';
    END LOOP;
    
    RAISE NOTICE 'custom_reports columns: %', col_list;
END $$;

-- Now do the migration based on what columns actually exist
DO $$
DECLARE
    table_exists boolean;
    has_data boolean;
    has_type_column boolean;
    has_name_column boolean;
    has_configuration_column boolean;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'custom_reports'
    ) INTO table_exists;

    IF table_exists THEN
        -- Check which columns exist
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'custom_reports'
            AND column_name = 'type'
        ) INTO has_type_column;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'custom_reports'
            AND column_name = 'name'
        ) INTO has_name_column;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'custom_reports'
            AND column_name = 'configuration'
        ) INTO has_configuration_column;

        -- Check if it has data
        SELECT EXISTS (
            SELECT 1 FROM public.custom_reports LIMIT 1
        ) INTO has_data;

        IF has_data THEN
            RAISE NOTICE 'custom_reports has data, preparing migration...';
            
            -- First ensure we have a folder to migrate to
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
                AND company_id = custom_reports.company_id
            );

            -- Now migrate the data with dynamic column mapping
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
                cr.report_id,
                rf.folder_id,
                CASE 
                    WHEN has_name_column THEN COALESCE(cr.name, 'Untitled Report')
                    ELSE 'Migrated Report'
                END,
                cr.description,
                'standard', -- Default report type since column doesn't exist
                CASE 
                    WHEN has_configuration_column THEN COALESCE(cr.configuration, '{}'::jsonb)
                    ELSE '{}'::jsonb
                END,
                '{}'::jsonb, -- Default empty data source config
                cr.created_by,
                cr.created_at,
                cr.updated_at,
                cr.company_id,
                COALESCE(cr.is_template, false)
            FROM public.custom_reports cr
            INNER JOIN public.report_folders rf ON rf.folder_name = 'Migrated Reports' 
                AND rf.company_id = cr.company_id
            ON CONFLICT (report_id) DO NOTHING;
            
            RAISE NOTICE 'Data migration completed';
        END IF;

        -- Rename the old table
        ALTER TABLE public.custom_reports RENAME TO custom_reports_backup;
        RAISE NOTICE 'Renamed custom_reports to custom_reports_backup';
        
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