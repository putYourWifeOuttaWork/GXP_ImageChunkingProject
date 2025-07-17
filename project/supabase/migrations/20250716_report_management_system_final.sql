-- Report Management System (Final Fixed Version)
-- First, let's check the users table structure
-- If this fails, we'll create the tables without RLS policies first

-- Create tables WITHOUT foreign key constraints to auth.users
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

-- Create indexes
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
DROP TRIGGER IF EXISTS update_folder_path_trigger ON public.report_folders;
CREATE TRIGGER update_folder_path_trigger
  BEFORE INSERT OR UPDATE ON public.report_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_folder_path();

DROP TRIGGER IF EXISTS update_report_updated_at_trigger ON public.saved_reports;
CREATE TRIGGER update_report_updated_at_trigger
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_report_updated_at();

-- Enable RLS (without policies for now)
ALTER TABLE public.report_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_folder_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_version_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_access_logs ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Now let's add RLS policies that work with your users table structure
-- We'll check different possible column names for the users table

DO $$ 
DECLARE
    user_id_column text;
BEGIN
    -- Check if users table exists and what column name it uses for user ID
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'id'
    ) THEN
        user_id_column := 'id';
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'user_id'
    ) THEN
        user_id_column := 'user_id';
    ELSE
        -- If no users table or different column name, we'll create basic policies
        user_id_column := NULL;
    END IF;

    -- Create RLS policies based on what we found
    IF user_id_column IS NOT NULL THEN
        -- Create policies with proper column reference
        EXECUTE format('
            CREATE POLICY "Users can view folders in their company"
            ON public.report_folders FOR SELECT
            USING (
                company_id IN (
                    SELECT company_id FROM public.users WHERE %I = auth.uid()
                )
                OR created_by = auth.uid()
            )', user_id_column);

        EXECUTE format('
            CREATE POLICY "Users can create folders in their company"
            ON public.report_folders FOR INSERT
            WITH CHECK (
                company_id IN (
                    SELECT company_id FROM public.users WHERE %I = auth.uid()
                )
                AND created_by = auth.uid()
            )', user_id_column);
    ELSE
        -- Create basic policies without users table reference
        CREATE POLICY "Users can view their own folders"
        ON public.report_folders FOR SELECT
        USING (created_by = auth.uid());

        CREATE POLICY "Users can create folders"
        ON public.report_folders FOR INSERT
        WITH CHECK (created_by = auth.uid());
    END IF;

    -- Basic policies that don't depend on users table
    CREATE POLICY "Users can update folders they created"
    ON public.report_folders FOR UPDATE
    USING (created_by = auth.uid());

    CREATE POLICY "Users can delete folders they created"
    ON public.report_folders FOR DELETE
    USING (created_by = auth.uid());

    -- Policies for other tables
    CREATE POLICY "Users can view reports they created"
    ON public.saved_reports FOR SELECT
    USING (created_by = auth.uid());

    CREATE POLICY "Users can create reports"
    ON public.saved_reports FOR INSERT
    WITH CHECK (created_by = auth.uid());

    CREATE POLICY "Users can update their own reports"
    ON public.saved_reports FOR UPDATE
    USING (created_by = auth.uid());

    CREATE POLICY "Users can delete their own reports"
    ON public.saved_reports FOR DELETE
    USING (created_by = auth.uid());

    -- Permissions policies
    CREATE POLICY "Users can view permissions"
    ON public.report_folder_permissions FOR SELECT
    USING (user_id = auth.uid() OR granted_by = auth.uid());

    CREATE POLICY "Users can grant permissions"
    ON public.report_folder_permissions FOR INSERT
    WITH CHECK (granted_by = auth.uid());

    -- Data snapshots policies
    CREATE POLICY "Users can view snapshots for their reports"
    ON public.report_data_snapshots FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.saved_reports
            WHERE report_id = report_data_snapshots.report_id
            AND created_by = auth.uid()
        )
    );

    CREATE POLICY "Users can create snapshots for their reports"
    ON public.report_data_snapshots FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.saved_reports
            WHERE report_id = report_data_snapshots.report_id
            AND created_by = auth.uid()
        )
    );

    -- Version history policies
    CREATE POLICY "Users can view version history for their reports"
    ON public.report_version_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.saved_reports
            WHERE report_id = report_version_history.report_id
            AND created_by = auth.uid()
        )
    );

    CREATE POLICY "Users can create version history"
    ON public.report_version_history FOR INSERT
    WITH CHECK (created_by = auth.uid());

    -- Access logs policies
    CREATE POLICY "Users can view their own access logs"
    ON public.report_access_logs FOR SELECT
    USING (user_id = auth.uid());

    CREATE POLICY "Users can create access logs"
    ON public.report_access_logs FOR INSERT
    WITH CHECK (user_id = auth.uid());

END $$;