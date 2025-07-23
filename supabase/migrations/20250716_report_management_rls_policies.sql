-- Additional RLS policies for report management system

-- =====================================================
-- FOLDER POLICIES
-- =====================================================

-- Allow users to create folders in their company
CREATE POLICY "Users can create folders in their company" ON public.report_folders
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

-- Allow folder owners and admins to update folders
CREATE POLICY "Folder owners and admins can update folders" ON public.report_folders
  FOR UPDATE USING (
    created_by = auth.uid()
    OR get_folder_permission_level(folder_id) = 'admin'
  );

-- Allow folder owners to delete folders
CREATE POLICY "Folder owners can delete folders" ON public.report_folders
  FOR DELETE USING (
    created_by = auth.uid()
  );

-- =====================================================
-- FOLDER PERMISSION POLICIES
-- =====================================================

-- Allow viewing permissions for accessible folders
CREATE POLICY "Users can view permissions for accessible folders" ON public.report_folder_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.report_folders rf
      WHERE rf.folder_id = report_folder_permissions.folder_id
      AND (
        rf.created_by = auth.uid()
        OR get_folder_permission_level(rf.folder_id) = 'admin'
      )
    )
  );

-- Allow folder admins to manage permissions
CREATE POLICY "Folder admins can manage permissions" ON public.report_folder_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.report_folders rf
      WHERE rf.folder_id = report_folder_permissions.folder_id
      AND (
        rf.created_by = auth.uid()
        OR get_folder_permission_level(rf.folder_id) = 'admin'
      )
    )
  );

-- =====================================================
-- REPORT POLICIES
-- =====================================================

-- Allow creating reports in accessible folders
CREATE POLICY "Users can create reports in accessible folders" ON public.saved_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.report_folders rf
      WHERE rf.folder_id = saved_reports.folder_id
      AND get_folder_permission_level(rf.folder_id) IN ('admin', 'viewer')
    )
    AND created_by = auth.uid()
  );

-- Allow updating own reports or with admin permission
CREATE POLICY "Users can update their reports or with admin permission" ON public.saved_reports
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.report_folders rf
      WHERE rf.folder_id = saved_reports.folder_id
      AND get_folder_permission_level(rf.folder_id) = 'admin'
    )
  );

-- Allow deleting own reports or with admin permission
CREATE POLICY "Users can delete their reports or with admin permission" ON public.saved_reports
  FOR DELETE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.report_folders rf
      WHERE rf.folder_id = saved_reports.folder_id
      AND get_folder_permission_level(rf.folder_id) = 'admin'
    )
  );

-- =====================================================
-- DATA SNAPSHOT POLICIES
-- =====================================================

-- Allow viewing snapshots for accessible reports
CREATE POLICY "Users can view snapshots for accessible reports" ON public.report_data_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.saved_reports sr
      JOIN public.report_folders rf ON rf.folder_id = sr.folder_id
      WHERE sr.report_id = report_data_snapshots.report_id
      AND (
        rf.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR get_folder_permission_level(rf.folder_id) != 'no_access'
        OR sr.created_by = auth.uid()
      )
    )
  );

-- Allow creating snapshots for own reports or with admin permission
CREATE POLICY "Users can create snapshots for accessible reports" ON public.report_data_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saved_reports sr
      JOIN public.report_folders rf ON rf.folder_id = sr.folder_id
      WHERE sr.report_id = report_data_snapshots.report_id
      AND (
        sr.created_by = auth.uid()
        OR get_folder_permission_level(rf.folder_id) = 'admin'
      )
    )
    AND created_by = auth.uid()
  );

-- =====================================================
-- VISUALIZATION POLICIES
-- =====================================================

-- Allow viewing visualizations for accessible reports
CREATE POLICY "Users can view visualizations for accessible reports" ON public.report_visualizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.saved_reports sr
      JOIN public.report_folders rf ON rf.folder_id = sr.folder_id
      WHERE sr.report_id = report_visualizations.report_id
      AND (
        rf.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR get_folder_permission_level(rf.folder_id) != 'no_access'
        OR sr.created_by = auth.uid()
      )
    )
  );

-- Allow managing visualizations for own reports or with admin permission
CREATE POLICY "Users can manage visualizations for their reports" ON public.report_visualizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.saved_reports sr
      JOIN public.report_folders rf ON rf.folder_id = sr.folder_id
      WHERE sr.report_id = report_visualizations.report_id
      AND (
        sr.created_by = auth.uid()
        OR get_folder_permission_level(rf.folder_id) = 'admin'
      )
    )
  );

-- =====================================================
-- VERSION HISTORY POLICIES
-- =====================================================

-- Allow viewing history for accessible reports
CREATE POLICY "Users can view history for accessible reports" ON public.report_version_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.saved_reports sr
      JOIN public.report_folders rf ON rf.folder_id = sr.folder_id
      WHERE sr.report_id = report_version_history.report_id
      AND (
        rf.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR get_folder_permission_level(rf.folder_id) != 'no_access'
        OR sr.created_by = auth.uid()
      )
    )
  );

-- Allow creating history entries for own reports or with admin permission
CREATE POLICY "Users can create history for their reports" ON public.report_version_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saved_reports sr
      JOIN public.report_folders rf ON rf.folder_id = sr.folder_id
      WHERE sr.report_id = report_version_history.report_id
      AND (
        sr.created_by = auth.uid()
        OR get_folder_permission_level(rf.folder_id) = 'admin'
      )
    )
    AND changed_by = auth.uid()
  );

-- =====================================================
-- SUBSCRIPTION POLICIES
-- =====================================================

-- Allow users to view their own subscriptions
CREATE POLICY "Users can view their subscriptions" ON public.report_subscriptions
  FOR SELECT USING (
    subscriber_id = auth.uid()
  );

-- Allow users to manage their own subscriptions
CREATE POLICY "Users can manage their subscriptions" ON public.report_subscriptions
  FOR ALL USING (
    subscriber_id = auth.uid()
  );

-- =====================================================
-- ACCESS LOG POLICIES
-- =====================================================

-- Allow users to create their own access logs
CREATE POLICY "Users can create access logs" ON public.report_access_logs
  FOR INSERT WITH CHECK (
    accessed_by = auth.uid()
  );

-- Allow users to view access logs for reports they can admin
CREATE POLICY "Report admins can view access logs" ON public.report_access_logs
  FOR SELECT USING (
    accessed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.saved_reports sr
      JOIN public.report_folders rf ON rf.folder_id = sr.folder_id
      WHERE sr.report_id = report_access_logs.report_id
      AND (
        sr.created_by = auth.uid()
        OR get_folder_permission_level(rf.folder_id) = 'admin'
      )
    )
  );

-- =====================================================
-- CREATE DEFAULT FOLDERS FOR EXISTING COMPANIES
-- =====================================================
DO $$
DECLARE
  company_record RECORD;
  user_record RECORD;
BEGIN
  FOR company_record IN SELECT DISTINCT company_id FROM public.users LOOP
    -- Get the first user from the company as the creator
    SELECT id INTO user_record FROM public.users 
    WHERE company_id = company_record.company_id 
    LIMIT 1;
    
    -- Create default folders if they don't exist
    PERFORM create_default_folders_for_company(
      company_record.company_id, 
      user_record.id
    );
  END LOOP;
END $$;