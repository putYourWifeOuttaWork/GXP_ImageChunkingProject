-- Report Management System - Working Version
-- Split into steps to avoid errors

-- STEP 1: Create all tables first
CREATE TABLE IF NOT EXISTS public.report_folders (
  folder_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(company_id),
  parent_folder_id uuid REFERENCES public.report_folders(folder_id),
  folder_name varchar(255) NOT NULL,
  folder_path text,
  description text,
  color varchar(7) DEFAULT '#3B82F6',
  icon varchar(50) DEFAULT 'folder',
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_archived boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.report_folder_permissions (
  permission_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id uuid NOT NULL REFERENCES public.report_folders(folder_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  permission_level varchar(20) NOT NULL CHECK (permission_level IN ('admin', 'viewer', 'no_access')),
  granted_by uuid NOT NULL,
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
  created_by uuid NOT NULL,
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
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_access_logs (
  log_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.saved_reports(report_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  access_type varchar(50) NOT NULL,
  access_details jsonb,
  accessed_at timestamp with time zone DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- STEP 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_report_folders_company_id ON public.report_folders(company_id);
CREATE INDEX IF NOT EXISTS idx_report_folders_parent_id ON public.report_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_report_folders_created_by ON public.report_folders(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_reports_folder_id ON public.saved_reports(folder_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_company_id ON public.saved_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON public.saved_reports(created_by);

-- STEP 3: Create helper functions
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

-- STEP 4: Create triggers
DROP TRIGGER IF EXISTS update_folder_path_trigger ON public.report_folders;
CREATE TRIGGER update_folder_path_trigger
  BEFORE INSERT OR UPDATE ON public.report_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_folder_path();

DROP TRIGGER IF EXISTS update_report_updated_at_trigger ON public.saved_reports;
CREATE TRIGGER update_report_updated_at_trigger
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_report_updated_at();

-- STEP 5: Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;