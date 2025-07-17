-- Update RLS Policies - Run this after tables are created
-- This replaces the temporary allow-all policies with proper ones

-- First verify tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'report_folders') THEN
        RAISE EXCEPTION 'report_folders table does not exist. Run the main migration first.';
    END IF;
END $$;

-- Drop temporary policies
DROP POLICY IF EXISTS "temp_allow_all_folders" ON public.report_folders;
DROP POLICY IF EXISTS "temp_allow_all_permissions" ON public.report_folder_permissions;
DROP POLICY IF EXISTS "temp_allow_all_reports" ON public.saved_reports;
DROP POLICY IF EXISTS "temp_allow_all_snapshots" ON public.report_data_snapshots;
DROP POLICY IF EXISTS "temp_allow_all_versions" ON public.report_version_history;
DROP POLICY IF EXISTS "temp_allow_all_logs" ON public.report_access_logs;

-- Create proper RLS policies for report_folders
CREATE POLICY "select_folders"
ON public.report_folders FOR SELECT
TO authenticated
USING (
    created_by = auth.uid() 
    OR company_id IN (
        SELECT DISTINCT company_id 
        FROM public.report_folders 
        WHERE created_by = auth.uid()
    )
);

CREATE POLICY "insert_folders"
ON public.report_folders FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND company_id IN (
        SELECT company_id 
        FROM public.companies 
        WHERE company_id = report_folders.company_id
    )
);

CREATE POLICY "update_folders"
ON public.report_folders FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "delete_folders"
ON public.report_folders FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Create RLS policies for saved_reports
CREATE POLICY "select_reports"
ON public.saved_reports FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "insert_reports"
ON public.saved_reports FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "update_reports"
ON public.saved_reports FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "delete_reports"
ON public.saved_reports FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Create RLS policies for report_folder_permissions
CREATE POLICY "select_permissions"
ON public.report_folder_permissions FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR granted_by = auth.uid());

CREATE POLICY "insert_permissions"
ON public.report_folder_permissions FOR INSERT
TO authenticated
WITH CHECK (granted_by = auth.uid());

CREATE POLICY "update_permissions"
ON public.report_folder_permissions FOR UPDATE
TO authenticated
USING (granted_by = auth.uid());

CREATE POLICY "delete_permissions"
ON public.report_folder_permissions FOR DELETE
TO authenticated
USING (granted_by = auth.uid());

-- Create RLS policies for report_data_snapshots
CREATE POLICY "select_snapshots"
ON public.report_data_snapshots FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.saved_reports 
        WHERE report_id = report_data_snapshots.report_id
        AND created_by = auth.uid()
    )
);

CREATE POLICY "insert_snapshots"
ON public.report_data_snapshots FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.saved_reports 
        WHERE report_id = report_data_snapshots.report_id
        AND created_by = auth.uid()
    )
);

-- Create RLS policies for report_version_history
CREATE POLICY "select_versions"
ON public.report_version_history FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.saved_reports 
        WHERE report_id = report_version_history.report_id
        AND created_by = auth.uid()
    )
);

CREATE POLICY "insert_versions"
ON public.report_version_history FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Create RLS policies for report_access_logs
CREATE POLICY "select_logs"
ON public.report_access_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "insert_logs"
ON public.report_access_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());