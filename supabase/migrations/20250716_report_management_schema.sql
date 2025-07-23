-- Report Management System Schema
-- Phase 3: Enterprise Reporting Foundation

-- =====================================================
-- REPORT FOLDERS - Hierarchical folder structure
-- =====================================================
CREATE TABLE IF NOT EXISTS public.report_folders (
  folder_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(company_id) ON DELETE CASCADE,
  parent_folder_id uuid REFERENCES public.report_folders(folder_id) ON DELETE CASCADE,
  folder_name varchar(255) NOT NULL,
  folder_path text, -- Materialized path for fast queries (e.g., "/root/folder1/subfolder")
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  is_archived boolean DEFAULT false,
  folder_order integer DEFAULT 0, -- For custom ordering
  
  -- Folder metadata
  icon varchar(50) DEFAULT 'folder', -- Icon identifier
  color varchar(7) DEFAULT '#6B7280', -- Hex color for folder
  
  -- Constraints
  CONSTRAINT unique_folder_name_per_parent UNIQUE (company_id, parent_folder_id, folder_name),
  CONSTRAINT folder_name_not_empty CHECK (folder_name != '')
);

-- =====================================================
-- FOLDER PERMISSIONS - Who can access what folders
-- =====================================================
CREATE TYPE folder_permission_level AS ENUM ('admin', 'viewer', 'no_access');

CREATE TABLE IF NOT EXISTS public.report_folder_permissions (
  permission_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id uuid NOT NULL REFERENCES public.report_folders(folder_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level folder_permission_level NOT NULL DEFAULT 'viewer',
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz DEFAULT now() NOT NULL,
  
  -- Prevent duplicate permissions
  CONSTRAINT unique_folder_user_permission UNIQUE (folder_id, user_id)
);

-- =====================================================
-- SAVED REPORTS - The actual report configurations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.saved_reports (
  report_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id uuid NOT NULL REFERENCES public.report_folders(folder_id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(company_id) ON DELETE CASCADE,
  report_name varchar(255) NOT NULL,
  description text,
  
  -- Report configuration
  report_type varchar(50) NOT NULL, -- 'standard', 'dashboard', 'portfolio'
  report_config jsonb NOT NULL, -- Full ReportBuilderConfig
  
  -- Data configuration
  data_source_config jsonb NOT NULL, -- Program IDs, date ranges, filters
  
  -- Metadata
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0,
  
  -- State management
  is_draft boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  is_template boolean DEFAULT false, -- Can be used as starting point
  
  -- Performance
  estimated_runtime_ms integer, -- Track query performance
  last_refresh_at timestamptz,
  auto_refresh_enabled boolean DEFAULT false,
  refresh_interval_hours integer,
  
  CONSTRAINT report_name_not_empty CHECK (report_name != '')
);

-- =====================================================
-- REPORT DATA SNAPSHOTS - Cached report data
-- =====================================================
CREATE TABLE IF NOT EXISTS public.report_data_snapshots (
  snapshot_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.saved_reports(report_id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  
  -- Snapshot data
  snapshot_data jsonb NOT NULL, -- Full aggregated data
  raw_data_sample jsonb, -- Sample of raw data for debugging
  
  -- Metadata about the snapshot
  data_timestamp timestamptz NOT NULL, -- When the data was fetched
  snapshot_created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  
  -- Performance metrics
  query_runtime_ms integer,
  data_row_count integer,
  data_size_bytes bigint,
  
  -- Version info
  is_current boolean DEFAULT true,
  change_summary text, -- What changed from previous version
  
  CONSTRAINT unique_version_per_report UNIQUE (report_id, version_number)
);

-- =====================================================
-- REPORT VISUALIZATIONS - Multiple charts per report
-- =====================================================
CREATE TABLE IF NOT EXISTS public.report_visualizations (
  visualization_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.saved_reports(report_id) ON DELETE CASCADE,
  
  -- Visualization config
  visualization_type varchar(50) NOT NULL, -- 'bar', 'line', 'heatmap', etc.
  visualization_config jsonb NOT NULL, -- Chart-specific settings
  display_order integer DEFAULT 0,
  
  -- Layout for dashboards
  layout_config jsonb, -- Grid position, size, etc.
  
  -- Metadata
  title varchar(255),
  subtitle text,
  notes text,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- REPORT VERSION HISTORY - Track all changes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.report_version_history (
  history_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.saved_reports(report_id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  
  -- What changed
  change_type varchar(50) NOT NULL, -- 'created', 'updated', 'restored', 'auto_save'
  change_description text,
  
  -- Previous state (for restoration)
  previous_config jsonb,
  new_config jsonb,
  
  -- Who and when
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now() NOT NULL,
  
  -- For restorations
  restored_from_version integer,
  
  CONSTRAINT unique_version_history UNIQUE (report_id, version_number)
);

-- =====================================================
-- REPORT SUBSCRIPTIONS - Email delivery schedules
-- =====================================================
CREATE TYPE subscription_frequency AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');
CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'cancelled');

CREATE TABLE IF NOT EXISTS public.report_subscriptions (
  subscription_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.saved_reports(report_id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Schedule
  frequency subscription_frequency NOT NULL,
  send_day_of_week integer, -- 0-6 for weekly
  send_day_of_month integer, -- 1-31 for monthly
  send_time time DEFAULT '08:00:00',
  timezone varchar(50) DEFAULT 'UTC',
  
  -- Status
  status subscription_status DEFAULT 'active',
  last_sent_at timestamptz,
  next_send_at timestamptz,
  
  -- Delivery config
  email_format varchar(20) DEFAULT 'pdf', -- 'pdf', 'excel', 'both'
  include_raw_data boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_user_report_subscription UNIQUE (report_id, subscriber_id)
);

-- =====================================================
-- REPORT ACCESS LOGS - Track who views what
-- =====================================================
CREATE TABLE IF NOT EXISTS public.report_access_logs (
  log_id bigserial PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.saved_reports(report_id) ON DELETE CASCADE,
  accessed_by uuid NOT NULL REFERENCES auth.users(id),
  accessed_at timestamptz DEFAULT now() NOT NULL,
  access_type varchar(50) NOT NULL, -- 'view', 'edit', 'export', 'share'
  ip_address inet,
  user_agent text,
  
  -- Performance tracking
  load_time_ms integer,
  export_format varchar(20), -- If exported
  
  -- Indexes for performance
  INDEX idx_report_access_report_id (report_id),
  INDEX idx_report_access_user_time (accessed_by, accessed_at DESC)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_report_folders_company ON public.report_folders(company_id);
CREATE INDEX idx_report_folders_parent ON public.report_folders(parent_folder_id);
CREATE INDEX idx_report_folders_path ON public.report_folders(folder_path);
CREATE INDEX idx_folder_permissions_user ON public.report_folder_permissions(user_id);
CREATE INDEX idx_saved_reports_folder ON public.saved_reports(folder_id);
CREATE INDEX idx_saved_reports_company ON public.saved_reports(company_id);
CREATE INDEX idx_saved_reports_created_by ON public.saved_reports(created_by);
CREATE INDEX idx_report_snapshots_current ON public.report_data_snapshots(report_id, is_current);
CREATE INDEX idx_report_history_report ON public.report_version_history(report_id, version_number DESC);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================
ALTER TABLE public.report_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_folder_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_visualizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_version_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_access_logs ENABLE ROW LEVEL SECURITY;

-- Folder visibility: Company members + those with permissions
CREATE POLICY "Users can view folders they have access to" ON public.report_folders
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.report_folder_permissions
      WHERE folder_id = report_folders.folder_id
      AND user_id = auth.uid()
      AND permission_level != 'no_access'
    )
    OR created_by = auth.uid()
  );

-- Report visibility follows folder permissions
CREATE POLICY "Users can view reports in accessible folders" ON public.saved_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.report_folders rf
      WHERE rf.folder_id = saved_reports.folder_id
      AND (
        rf.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.report_folder_permissions
          WHERE folder_id = rf.folder_id
          AND user_id = auth.uid()
          AND permission_level != 'no_access'
        )
        OR rf.created_by = auth.uid()
      )
    )
  );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get user's permission level for a folder
CREATE OR REPLACE FUNCTION get_folder_permission_level(
  p_folder_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS folder_permission_level AS $$
DECLARE
  v_permission folder_permission_level;
  v_is_owner boolean;
  v_company_id uuid;
BEGIN
  -- Check if user is the folder owner
  SELECT created_by = p_user_id, company_id 
  INTO v_is_owner, v_company_id
  FROM report_folders 
  WHERE folder_id = p_folder_id;
  
  IF v_is_owner THEN
    RETURN 'admin'::folder_permission_level;
  END IF;
  
  -- Check explicit permissions
  SELECT permission_level INTO v_permission
  FROM report_folder_permissions
  WHERE folder_id = p_folder_id AND user_id = p_user_id;
  
  IF v_permission IS NOT NULL THEN
    RETURN v_permission;
  END IF;
  
  -- Check if user is in the same company
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_user_id 
    AND company_id = v_company_id
  ) THEN
    RETURN 'viewer'::folder_permission_level;
  END IF;
  
  RETURN 'no_access'::folder_permission_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update folder paths when moving folders
CREATE OR REPLACE FUNCTION update_folder_paths()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_folder_id IS DISTINCT FROM OLD.parent_folder_id THEN
    -- Update the path for this folder and all descendants
    WITH RECURSIVE folder_tree AS (
      SELECT folder_id, 
             COALESCE(
               (SELECT folder_path || '/' || NEW.folder_name 
                FROM report_folders 
                WHERE folder_id = NEW.parent_folder_id),
               '/' || NEW.folder_name
             ) as new_path
      FROM report_folders
      WHERE folder_id = NEW.folder_id
      
      UNION ALL
      
      SELECT rf.folder_id,
             ft.new_path || '/' || rf.folder_name
      FROM report_folders rf
      JOIN folder_tree ft ON rf.parent_folder_id = ft.folder_id
    )
    UPDATE report_folders
    SET folder_path = folder_tree.new_path
    FROM folder_tree
    WHERE report_folders.folder_id = folder_tree.folder_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_folder_paths_trigger
AFTER UPDATE OF parent_folder_id ON report_folders
FOR EACH ROW
EXECUTE FUNCTION update_folder_paths();

-- =====================================================
-- SAMPLE DATA / DEFAULT FOLDERS
-- =====================================================
-- Create default folder structure for each company (run this after migration)
CREATE OR REPLACE FUNCTION create_default_folders_for_company(p_company_id uuid, p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Create root folders
  INSERT INTO report_folders (company_id, folder_name, folder_path, created_by, icon, color)
  VALUES 
    (p_company_id, 'My Reports', '/My Reports', p_user_id, 'user', '#3B82F6'),
    (p_company_id, 'Shared Reports', '/Shared Reports', p_user_id, 'users', '#10B981'),
    (p_company_id, 'Templates', '/Templates', p_user_id, 'template', '#8B5CF6')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;