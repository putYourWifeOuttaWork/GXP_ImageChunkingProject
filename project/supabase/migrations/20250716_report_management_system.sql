-- Report Management System
-- Complete database schema with RLS policies for folder-based report organization

-- Create tables
CREATE TABLE IF NOT EXISTS public.report_folders (
  folder_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(company_id),
  parent_folder_id uuid REFERENCES public.report_folders(folder_id),
  folder_name varchar(255) NOT NULL,
  folder_path text, -- Materialized path for efficient querying
  description text,
  color varchar(7) DEFAULT '#3B82F6', -- Hex color code
  icon varchar(50) DEFAULT 'folder',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_archived boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.report_folder_permissions (
  permission_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id uuid NOT NULL REFERENCES public.report_folders(folder_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  permission_level varchar(20) NOT NULL CHECK (permission_level IN ('admin', 'viewer', 'no_access')),
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_reports (
  report_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id uuid NOT NULL REFERENCES public.report_folders(folder_id),
  report_name varchar(255) NOT NULL,
  description text,
  report_type varchar(50) NOT NULL DEFAULT 'standard',
  report_config jsonb NOT NULL,
  data_source_config jsonb NOT NULL,
  is_draft boolean DEFAULT false,
  is_template boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone,
  access_count integer DEFAULT 0,
  company_id uuid NOT NULL REFERENCES public.companies(company_id)
);

CREATE TABLE IF NOT EXISTS public.report_data_snapshots (
  snapshot_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.saved_reports(report_id) ON DELETE CASCADE,
  snapshot_data jsonb NOT NULL,
  snapshot_metadata jsonb,
  data_size_bytes integer,
  query_time_ms integer,
  is_current boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.report_version_history (
  version_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.saved_reports(report_id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  changes_summary text,
  config_snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_access_logs (
  log_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.saved_reports(report_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  access_type varchar(50) NOT NULL, -- 'view', 'edit', 'export', 'share'
  access_details jsonb,
  accessed_at timestamp with time zone DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_folders_company_id ON public.report_folders(company_id);
CREATE INDEX IF NOT EXISTS idx_report_folders_parent_id ON public.report_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_report_folders_path ON public.report_folders(folder_path);
CREATE INDEX IF NOT EXISTS idx_report_folders_created_by ON public.report_folders(created_by);

CREATE INDEX IF NOT EXISTS idx_folder_permissions_folder_id ON public.report_folder_permissions(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_permissions_user_id ON public.report_folder_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_reports_folder_id ON public.saved_reports(folder_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_company_id ON public.saved_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON public.saved_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_reports_updated_at ON public.saved_reports(updated_at);

CREATE INDEX IF NOT EXISTS idx_report_snapshots_report_id ON public.report_data_snapshots(report_id);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_current ON public.report_data_snapshots(report_id, is_current);

CREATE INDEX IF NOT EXISTS idx_version_history_report_id ON public.report_version_history(report_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_report_id ON public.report_access_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON public.report_access_logs(user_id);

-- Enable RLS on all tables
ALTER TABLE public.report_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_folder_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_version_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_folders
CREATE POLICY "Users can view folders in their company or with explicit permissions"
ON public.report_folders FOR SELECT
USING (
  -- Company members can see company folders
  company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  )
  OR
  -- Users with explicit permissions can see folders
  EXISTS (
    SELECT 1 FROM public.report_folder_permissions
    WHERE folder_id = report_folders.folder_id
    AND user_id = auth.uid()
    AND permission_level IN ('admin', 'viewer')
  )
  OR
  -- Folder creators can always see their folders
  created_by = auth.uid()
);

CREATE POLICY "Users can create folders in their company"
ON public.report_folders FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update folders they created or have admin access to"
ON public.report_folders FOR UPDATE
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.report_folder_permissions
    WHERE folder_id = report_folders.folder_id
    AND user_id = auth.uid()
    AND permission_level = 'admin'
  )
);

CREATE POLICY "Users can delete folders they created or have admin access to"
ON public.report_folders FOR DELETE
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.report_folder_permissions
    WHERE folder_id = report_folders.folder_id
    AND user_id = auth.uid()
    AND permission_level = 'admin'
  )
);

-- RLS Policies for report_folder_permissions
CREATE POLICY "Users can view permissions for folders they can access"
ON public.report_folder_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.report_folders
    WHERE folder_id = report_folder_permissions.folder_id
    AND (
      created_by = auth.uid()
      OR
      company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.report_folder_permissions p2
        WHERE p2.folder_id = report_folders.folder_id
        AND p2.user_id = auth.uid()
        AND p2.permission_level IN ('admin', 'viewer')
      )
    )
  )
);

CREATE POLICY "Users can manage permissions for folders they own or have admin access to"
ON public.report_folder_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.report_folders
    WHERE folder_id = report_folder_permissions.folder_id
    AND (
      created_by = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.report_folder_permissions p2
        WHERE p2.folder_id = report_folders.folder_id
        AND p2.user_id = auth.uid()
        AND p2.permission_level = 'admin'
      )
    )
  )
);

-- RLS Policies for saved_reports
CREATE POLICY "Users can view reports in accessible folders"
ON public.saved_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.report_folders
    WHERE folder_id = saved_reports.folder_id
    AND (
      company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.report_folder_permissions
        WHERE folder_id = report_folders.folder_id
        AND user_id = auth.uid()
        AND permission_level IN ('admin', 'viewer')
      )
      OR
      created_by = auth.uid()
    )
  )
);

CREATE POLICY "Users can create reports in accessible folders"
ON public.saved_reports FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.report_folders
    WHERE folder_id = saved_reports.folder_id
    AND (
      company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.report_folder_permissions
        WHERE folder_id = report_folders.folder_id
        AND user_id = auth.uid()
        AND permission_level IN ('admin', 'viewer')
      )
      OR
      created_by = auth.uid()
    )
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update reports they created or have admin access to"
ON public.saved_reports FOR UPDATE
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.report_folders
    WHERE folder_id = saved_reports.folder_id
    AND EXISTS (
      SELECT 1 FROM public.report_folder_permissions
      WHERE folder_id = report_folders.folder_id
      AND user_id = auth.uid()
      AND permission_level = 'admin'
    )
  )
);

CREATE POLICY "Users can delete reports they created or have admin access to"
ON public.saved_reports FOR DELETE
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.report_folders
    WHERE folder_id = saved_reports.folder_id
    AND EXISTS (
      SELECT 1 FROM public.report_folder_permissions
      WHERE folder_id = report_folders.folder_id
      AND user_id = auth.uid()
      AND permission_level = 'admin'
    )
  )
);

-- RLS Policies for report_data_snapshots
CREATE POLICY "Users can view snapshots for reports they can access"
ON public.report_data_snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.saved_reports
    WHERE report_id = report_data_snapshots.report_id
    AND (
      created_by = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.report_folders
        WHERE folder_id = saved_reports.folder_id
        AND (
          company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM public.report_folder_permissions
            WHERE folder_id = report_folders.folder_id
            AND user_id = auth.uid()
            AND permission_level IN ('admin', 'viewer')
          )
          OR
          created_by = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Users can create snapshots for reports they can access"
ON public.report_data_snapshots FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.saved_reports
    WHERE report_id = report_data_snapshots.report_id
    AND (
      created_by = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.report_folders
        WHERE folder_id = saved_reports.folder_id
        AND (
          company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM public.report_folder_permissions
            WHERE folder_id = report_folders.folder_id
            AND user_id = auth.uid()
            AND permission_level IN ('admin', 'viewer')
          )
          OR
          created_by = auth.uid()
        )
      )
    )
  )
);

-- RLS Policies for report_version_history
CREATE POLICY "Users can view version history for reports they can access"
ON public.report_version_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.saved_reports
    WHERE report_id = report_version_history.report_id
    AND (
      created_by = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.report_folders
        WHERE folder_id = saved_reports.folder_id
        AND (
          company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM public.report_folder_permissions
            WHERE folder_id = report_folders.folder_id
            AND user_id = auth.uid()
            AND permission_level IN ('admin', 'viewer')
          )
          OR
          created_by = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Users can create version history for reports they can access"
ON public.report_version_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.saved_reports
    WHERE report_id = report_version_history.report_id
    AND (
      created_by = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.report_folders
        WHERE folder_id = saved_reports.folder_id
        AND (
          company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM public.report_folder_permissions
            WHERE folder_id = report_folders.folder_id
            AND user_id = auth.uid()
            AND permission_level IN ('admin', 'viewer')
          )
          OR
          created_by = auth.uid()
        )
      )
    )
  )
  AND created_by = auth.uid()
);

-- RLS Policies for report_access_logs
CREATE POLICY "Users can view access logs for reports they can access"
ON public.report_access_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.saved_reports
    WHERE report_id = report_access_logs.report_id
    AND (
      created_by = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.report_folders
        WHERE folder_id = saved_reports.folder_id
        AND (
          company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM public.report_folder_permissions
            WHERE folder_id = report_folders.folder_id
            AND user_id = auth.uid()
            AND permission_level IN ('admin', 'viewer')
          )
          OR
          created_by = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Users can create access logs for reports they can access"
ON public.report_access_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.saved_reports
    WHERE report_id = report_access_logs.report_id
    AND (
      created_by = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM public.report_folders
        WHERE folder_id = saved_reports.folder_id
        AND (
          company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM public.report_folder_permissions
            WHERE folder_id = report_folders.folder_id
            AND user_id = auth.uid()
            AND permission_level IN ('admin', 'viewer')
          )
          OR
          created_by = auth.uid()
        )
      )
    )
  )
  AND user_id = auth.uid()
);

-- Helper functions
CREATE OR REPLACE FUNCTION public.update_folder_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_folder_id IS NULL THEN
    NEW.folder_path := NEW.folder_id::text;
  ELSE
    SELECT folder_path || '/' || NEW.folder_id::text
    INTO NEW.folder_path
    FROM public.report_folders
    WHERE folder_id = NEW.parent_folder_id;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_folder_path_trigger
  BEFORE INSERT OR UPDATE ON public.report_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_folder_path();

CREATE TRIGGER update_report_updated_at_trigger
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_report_updated_at();

-- Create function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id uuid)
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT company_id 
    FROM public.users 
    WHERE id = user_id 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;