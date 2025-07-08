-- Enhanced Reporting System Database Schema
-- Migration: 001_enhanced_reports_schema.sql
-- Run this in your Supabase SQL editor

-- Create enums for the reporting system
CREATE TYPE report_category_enum AS ENUM (
  'analytics',
  'operational',
  'compliance',
  'research',
  'executive'
);

CREATE TYPE report_type_enum AS ENUM (
  'chart',
  'table',
  'dashboard',
  'export',
  'real_time'
);

CREATE TYPE permission_type_enum AS ENUM (
  'read',
  'write',
  'admin'
);

CREATE TYPE chart_type_enum AS ENUM (
  'line',
  'bar',
  'scatter',
  'heatmap',
  'contour',
  'box_plot',
  'histogram',
  'pie',
  'donut',
  'area',
  'growth_progression',
  'spatial_effectiveness',
  'phase_comparison',
  'environmental_correlation'
);

-- Main reports table (enhanced version of custom_reports)
CREATE TABLE public.reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category report_category_enum DEFAULT 'analytics',
  report_type report_type_enum NOT NULL DEFAULT 'chart',
  
  -- Ownership and access
  created_by_user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  program_ids uuid[] DEFAULT '{}', -- Support multiple programs
  is_public boolean DEFAULT false,
  is_template boolean DEFAULT false,
  
  -- Configuration stored as structured JSONB
  data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,
  measures jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb DEFAULT '[]'::jsonb,
  visualization_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Performance and caching
  query_cache_ttl interval DEFAULT interval '1 hour',
  auto_refresh boolean DEFAULT false,
  refresh_frequency interval,
  
  -- Metadata
  tags text[] DEFAULT '{}',
  last_refreshed_at timestamp with time zone,
  view_count integer DEFAULT 0,
  
  -- Audit trail
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  version integer DEFAULT 1,
  
  -- Constraints
  CONSTRAINT reports_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT reports_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id)
);

-- Report access control and permissions
CREATE TABLE public.report_permissions (
  permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  user_id uuid,
  role user_role_enum,
  company_id uuid,
  permission_type permission_type_enum NOT NULL DEFAULT 'read',
  granted_by_user_id uuid NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  
  -- Constraints
  CONSTRAINT report_permissions_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(report_id) ON DELETE CASCADE,
  CONSTRAINT report_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT report_permissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id),
  CONSTRAINT report_permissions_granted_by_user_id_fkey FOREIGN KEY (granted_by_user_id) REFERENCES auth.users(id),
  
  -- Ensure either user_id, role, or company_id is specified
  CONSTRAINT report_permissions_target_check CHECK (
    (user_id IS NOT NULL) OR 
    (role IS NOT NULL) OR 
    (company_id IS NOT NULL)
  )
);

-- Report version history for audit trail
CREATE TABLE public.report_versions (
  version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  version_number integer NOT NULL,
  configuration_snapshot jsonb NOT NULL,
  change_summary text,
  change_type text, -- 'created', 'updated', 'deleted', 'restored'
  created_by_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT report_versions_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(report_id) ON DELETE CASCADE,
  CONSTRAINT report_versions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT report_versions_unique_version UNIQUE (report_id, version_number)
);

-- Dashboards for grouping multiple reports
CREATE TABLE public.dashboards (
  dashboard_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Ownership and access
  created_by_user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  is_public boolean DEFAULT false,
  
  -- Configuration
  refresh_frequency interval,
  auto_refresh boolean DEFAULT false,
  theme_config jsonb DEFAULT '{}'::jsonb,
  
  -- Metadata
  tags text[] DEFAULT '{}',
  view_count integer DEFAULT 0,
  
  -- Audit trail
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT dashboards_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT dashboards_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(company_id)
);

-- Dashboard-report associations with positioning
CREATE TABLE public.dashboard_reports (
  dashboard_id uuid NOT NULL,
  report_id uuid NOT NULL,
  position_x integer NOT NULL DEFAULT 0,
  position_y integer NOT NULL DEFAULT 0,
  width integer NOT NULL DEFAULT 400,
  height integer NOT NULL DEFAULT 300,
  z_index integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  PRIMARY KEY (dashboard_id, report_id),
  CONSTRAINT dashboard_reports_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.dashboards(dashboard_id) ON DELETE CASCADE,
  CONSTRAINT dashboard_reports_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(report_id) ON DELETE CASCADE
);

-- Report query results cache for performance
CREATE TABLE public.report_cache (
  cache_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  cache_key text NOT NULL,
  parameters_hash text NOT NULL,
  result_data jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  hit_count integer DEFAULT 0,
  
  -- Constraints
  CONSTRAINT report_cache_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(report_id) ON DELETE CASCADE,
  CONSTRAINT report_cache_unique_key UNIQUE (report_id, cache_key, parameters_hash)
);

-- Report usage analytics for insights
CREATE TABLE public.report_analytics (
  analytics_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action_type text NOT NULL, -- 'view', 'export', 'share', 'edit', 'delete'
  session_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT report_analytics_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(report_id) ON DELETE CASCADE,
  CONSTRAINT report_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX idx_reports_company_id ON public.reports(company_id);
CREATE INDEX idx_reports_created_by ON public.reports(created_by_user_id);
CREATE INDEX idx_reports_category ON public.reports(category);
CREATE INDEX idx_reports_type ON public.reports(report_type);
CREATE INDEX idx_reports_created_at ON public.reports(created_at);
CREATE INDEX idx_reports_updated_at ON public.reports(updated_at);
CREATE INDEX idx_reports_tags ON public.reports USING gin(tags);
CREATE INDEX idx_reports_program_ids ON public.reports USING gin(program_ids);

CREATE INDEX idx_report_permissions_report_id ON public.report_permissions(report_id);
CREATE INDEX idx_report_permissions_user_id ON public.report_permissions(user_id);
CREATE INDEX idx_report_permissions_company_id ON public.report_permissions(company_id);

CREATE INDEX idx_report_versions_report_id ON public.report_versions(report_id);
CREATE INDEX idx_report_versions_created_at ON public.report_versions(created_at);

CREATE INDEX idx_dashboards_company_id ON public.dashboards(company_id);
CREATE INDEX idx_dashboards_created_by ON public.dashboards(created_by_user_id);

CREATE INDEX idx_report_cache_report_id ON public.report_cache(report_id);
CREATE INDEX idx_report_cache_expires_at ON public.report_cache(expires_at);

CREATE INDEX idx_report_analytics_report_id ON public.report_analytics(report_id);
CREATE INDEX idx_report_analytics_user_id ON public.report_analytics(user_id);
CREATE INDEX idx_report_analytics_created_at ON public.report_analytics(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reports_updated_at 
    BEFORE UPDATE ON public.reports 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboards_updated_at 
    BEFORE UPDATE ON public.dashboards 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for report versioning
CREATE OR REPLACE FUNCTION create_report_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create version if this is an update (not insert)
    IF TG_OP = 'UPDATE' THEN
        -- Increment version number
        NEW.version = OLD.version + 1;
        
        -- Create version record
        INSERT INTO public.report_versions (
            report_id,
            version_number,
            configuration_snapshot,
            change_type,
            created_by_user_id
        ) VALUES (
            NEW.report_id,
            NEW.version,
            jsonb_build_object(
                'data_sources', NEW.data_sources,
                'dimensions', NEW.dimensions,
                'measures', NEW.measures,
                'filters', NEW.filters,
                'visualization_config', NEW.visualization_config
            ),
            'updated',
            NEW.created_by_user_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_report_version_trigger
    BEFORE UPDATE ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION create_report_version();

-- Create trigger for cache cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete expired cache entries
    DELETE FROM public.report_cache 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Run cache cleanup daily
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('cleanup-report-cache', '0 2 * * *', 'SELECT cleanup_expired_cache();');

-- Create view for report analytics summary
CREATE OR REPLACE VIEW public.report_analytics_summary AS
SELECT 
    r.report_id,
    r.name,
    r.category,
    r.report_type,
    COUNT(DISTINCT ra.user_id) as unique_users,
    COUNT(CASE WHEN ra.action_type = 'view' THEN 1 END) as view_count,
    COUNT(CASE WHEN ra.action_type = 'export' THEN 1 END) as export_count,
    COUNT(CASE WHEN ra.action_type = 'share' THEN 1 END) as share_count,
    MAX(ra.created_at) as last_accessed,
    AVG(CASE WHEN ra.action_type = 'view' THEN 1 ELSE 0 END) as avg_views_per_user
FROM public.reports r
LEFT JOIN public.report_analytics ra ON r.report_id = ra.report_id
GROUP BY r.report_id, r.name, r.category, r.report_type;

-- Grant appropriate permissions
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic - can be refined later)
CREATE POLICY "Users can view reports from their company" ON public.reports
    FOR SELECT USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create reports in their company" ON public.reports
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their own reports" ON public.reports
    FOR UPDATE USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own reports" ON public.reports
    FOR DELETE USING (created_by_user_id = auth.uid());

-- Similar policies for other tables...
CREATE POLICY "Users can manage permissions for their reports" ON public.report_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.reports 
            WHERE report_id = report_permissions.report_id 
            AND created_by_user_id = auth.uid()
        )
    );

-- Dashboard policies
CREATE POLICY "Users can view dashboards from their company" ON public.dashboards
    FOR SELECT USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can create dashboards in their company" ON public.dashboards
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- Migration function to move data from custom_reports to reports
CREATE OR REPLACE FUNCTION migrate_custom_reports_to_reports()
RETURNS void AS $$
BEGIN
    -- Insert existing custom_reports into new reports table
    INSERT INTO public.reports (
        report_id,
        name,
        description,
        created_by_user_id,
        company_id,
        program_ids,
        visualization_config,
        created_at,
        updated_at
    )
    SELECT 
        cr.report_id,
        cr.name,
        cr.description,
        cr.created_by_user_id,
        cr.company_id,
        CASE 
            WHEN cr.program_id IS NOT NULL THEN ARRAY[cr.program_id]
            ELSE '{}'::uuid[]
        END,
        COALESCE(cr.configuration, '{}'::jsonb),
        cr.created_at,
        cr.updated_at
    FROM public.custom_reports cr
    WHERE NOT EXISTS (
        SELECT 1 FROM public.reports r WHERE r.report_id = cr.report_id
    );
    
    RAISE NOTICE 'Migration completed successfully';
END;
$$ language 'plpgsql';

-- Uncomment the following line to run the migration
-- SELECT migrate_custom_reports_to_reports();

-- Add helpful comments
COMMENT ON TABLE public.reports IS 'Enhanced reports table with multi-dimensional analysis capabilities';
COMMENT ON TABLE public.report_permissions IS 'Granular access control for reports';
COMMENT ON TABLE public.report_versions IS 'Version history for audit trail and rollback capabilities';
COMMENT ON TABLE public.dashboards IS 'Dashboard containers for grouping multiple reports';
COMMENT ON TABLE public.report_cache IS 'Query result caching for performance optimization';
COMMENT ON TABLE public.report_analytics IS 'Usage analytics for insights and optimization';