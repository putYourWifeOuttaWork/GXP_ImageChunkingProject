-- Report Management RLS Policies
-- Run this AFTER the main migration

-- STEP 1: Enable RLS on all tables
ALTER TABLE public.report_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_folder_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_version_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_access_logs ENABLE ROW LEVEL SECURITY;

-- STEP 2: Drop any existing policies
DO $$ 
BEGIN
    -- Drop folder policies if they exist
    DROP POLICY IF EXISTS "Users can view folders they created or in their company" ON public.report_folders;
    DROP POLICY IF EXISTS "Users can create folders" ON public.report_folders;
    DROP POLICY IF EXISTS "Users can update their own folders" ON public.report_folders;
    DROP POLICY IF EXISTS "Users can delete their own folders" ON public.report_folders;
    
    -- Drop report policies if they exist
    DROP POLICY IF EXISTS "Users can view reports they created" ON public.saved_reports;
    DROP POLICY IF EXISTS "Users can create reports" ON public.saved_reports;
    DROP POLICY IF EXISTS "Users can update their own reports" ON public.saved_reports;
    DROP POLICY IF EXISTS "Users can delete their own reports" ON public.saved_reports;
    
    -- Drop permission policies if they exist
    DROP POLICY IF EXISTS "Users can view permissions" ON public.report_folder_permissions;
    DROP POLICY IF EXISTS "Users can grant permissions" ON public.report_folder_permissions;
    DROP POLICY IF EXISTS "Users can manage permissions they granted" ON public.report_folder_permissions;
    DROP POLICY IF EXISTS "Users can revoke permissions they granted" ON public.report_folder_permissions;
    
    -- Drop snapshot policies if they exist
    DROP POLICY IF EXISTS "Users can view snapshots for their reports" ON public.report_data_snapshots;
    DROP POLICY IF EXISTS "Users can create snapshots for their reports" ON public.report_data_snapshots;
    
    -- Drop version history policies if they exist
    DROP POLICY IF EXISTS "Users can view version history" ON public.report_version_history;
    DROP POLICY IF EXISTS "Users can create version history" ON public.report_version_history;
    
    -- Drop access log policies if they exist
    DROP POLICY IF EXISTS "Users can view their access logs" ON public.report_access_logs;
    DROP POLICY IF EXISTS "Users can create access logs" ON public.report_access_logs;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- STEP 3: Create new RLS policies

-- Folder policies
CREATE POLICY "folder_select_policy"
ON public.report_folders FOR SELECT
USING (
    created_by = auth.uid() 
    OR company_id IN (
        SELECT DISTINCT rf.company_id 
        FROM public.report_folders rf
        WHERE rf.created_by = auth.uid()
    )
);

CREATE POLICY "folder_insert_policy"
ON public.report_folders FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "folder_update_policy"
ON public.report_folders FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "folder_delete_policy"
ON public.report_folders FOR DELETE
USING (created_by = auth.uid());

-- Report policies
CREATE POLICY "report_select_policy"
ON public.saved_reports FOR SELECT
USING (created_by = auth.uid());

CREATE POLICY "report_insert_policy"
ON public.saved_reports FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "report_update_policy"
ON public.saved_reports FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "report_delete_policy"
ON public.saved_reports FOR DELETE
USING (created_by = auth.uid());

-- Permission policies
CREATE POLICY "permission_select_policy"
ON public.report_folder_permissions FOR SELECT
USING (user_id = auth.uid() OR granted_by = auth.uid());

CREATE POLICY "permission_insert_policy"
ON public.report_folder_permissions FOR INSERT
WITH CHECK (granted_by = auth.uid());

CREATE POLICY "permission_update_policy"
ON public.report_folder_permissions FOR UPDATE
USING (granted_by = auth.uid());

CREATE POLICY "permission_delete_policy"
ON public.report_folder_permissions FOR DELETE
USING (granted_by = auth.uid());

-- Snapshot policies
CREATE POLICY "snapshot_select_policy"
ON public.report_data_snapshots FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.saved_reports sr
        WHERE sr.report_id = report_data_snapshots.report_id
        AND sr.created_by = auth.uid()
    )
);

CREATE POLICY "snapshot_insert_policy"
ON public.report_data_snapshots FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.saved_reports sr
        WHERE sr.report_id = report_data_snapshots.report_id
        AND sr.created_by = auth.uid()
    )
);

-- Version history policies
CREATE POLICY "version_select_policy"
ON public.report_version_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.saved_reports sr
        WHERE sr.report_id = report_version_history.report_id
        AND sr.created_by = auth.uid()
    )
);

CREATE POLICY "version_insert_policy"
ON public.report_version_history FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Access log policies
CREATE POLICY "log_select_policy"
ON public.report_access_logs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "log_insert_policy"
ON public.report_access_logs FOR INSERT
WITH CHECK (user_id = auth.uid());