import { supabase } from '../lib/supabaseClient';

export async function runReportMigration() {
  console.log('Running report management migration...');
  
  const migrationSQL = `
    -- Create tables
    CREATE TABLE IF NOT EXISTS public.report_folders (
      folder_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      company_id uuid NOT NULL REFERENCES public.companies(company_id),
      parent_folder_id uuid REFERENCES public.report_folders(folder_id),
      folder_name varchar(255) NOT NULL,
      folder_path text,
      description text,
      color varchar(7) DEFAULT '#3B82F6',
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
      access_type varchar(50) NOT NULL,
      access_details jsonb,
      accessed_at timestamp with time zone DEFAULT now(),
      ip_address inet,
      user_agent text
    );
  `;

  try {
    const { data, error } = await supabase.rpc('execute_raw_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      console.error('Migration error:', error);
      return false;
    }

    console.log('Tables created successfully');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

export async function setupRLSPolicies() {
  console.log('Setting up RLS policies...');
  
  const rlsSQL = `
    -- Enable RLS
    ALTER TABLE public.report_folders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.report_folder_permissions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.report_data_snapshots ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.report_version_history ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.report_access_logs ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view folders in their company" ON public.report_folders;
    DROP POLICY IF EXISTS "Users can create folders in their company" ON public.report_folders;
    DROP POLICY IF EXISTS "Users can update folders they created" ON public.report_folders;
    DROP POLICY IF EXISTS "Users can delete folders they created" ON public.report_folders;

    -- Create RLS policies for report_folders
    CREATE POLICY "Users can view folders in their company"
    ON public.report_folders FOR SELECT
    USING (
      company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
      OR created_by = auth.uid()
    );

    CREATE POLICY "Users can create folders in their company"
    ON public.report_folders FOR INSERT
    WITH CHECK (
      company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
      AND created_by = auth.uid()
    );

    CREATE POLICY "Users can update folders they created"
    ON public.report_folders FOR UPDATE
    USING (created_by = auth.uid());

    CREATE POLICY "Users can delete folders they created"
    ON public.report_folders FOR DELETE
    USING (created_by = auth.uid());
  `;

  try {
    const { data, error } = await supabase.rpc('execute_raw_sql', {
      sql_query: rlsSQL
    });

    if (error) {
      console.error('RLS setup error:', error);
      return false;
    }

    console.log('RLS policies set up successfully');
    return true;
  } catch (error) {
    console.error('RLS setup failed:', error);
    return false;
  }
}

export async function createIndexes() {
  console.log('Creating indexes...');
  
  const indexSQL = `
    CREATE INDEX IF NOT EXISTS idx_report_folders_company_id ON public.report_folders(company_id);
    CREATE INDEX IF NOT EXISTS idx_report_folders_parent_id ON public.report_folders(parent_folder_id);
    CREATE INDEX IF NOT EXISTS idx_report_folders_created_by ON public.report_folders(created_by);
    CREATE INDEX IF NOT EXISTS idx_saved_reports_folder_id ON public.saved_reports(folder_id);
    CREATE INDEX IF NOT EXISTS idx_saved_reports_company_id ON public.saved_reports(company_id);
    CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON public.saved_reports(created_by);
  `;

  try {
    const { data, error } = await supabase.rpc('execute_raw_sql', {
      sql_query: indexSQL
    });

    if (error) {
      console.error('Index creation error:', error);
      return false;
    }

    console.log('Indexes created successfully');
    return true;
  } catch (error) {
    console.error('Index creation failed:', error);
    return false;
  }
}

export async function runFullMigration() {
  console.log('Starting full report management migration...');
  
  const steps = [
    { name: 'Create Tables', fn: runReportMigration },
    { name: 'Setup RLS Policies', fn: setupRLSPolicies },
    { name: 'Create Indexes', fn: createIndexes }
  ];

  for (const step of steps) {
    console.log(`\n--- ${step.name} ---`);
    const success = await step.fn();
    if (!success) {
      console.error(`❌ ${step.name} failed`);
      return false;
    }
    console.log(`✅ ${step.name} completed`);
  }

  console.log('\n🎉 Full migration completed successfully!');
  return true;
}