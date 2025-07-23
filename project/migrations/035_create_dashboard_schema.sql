-- Create dashboard management schema
-- =====================================================

-- 1. Dashboard main table
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Layout configuration
  layout_type VARCHAR(20) DEFAULT 'grid' CHECK (layout_type IN ('grid', 'free', 'tabs', 'stack')),
  layout_config JSONB DEFAULT '{"columns": 12, "rows": 8, "gap": 16, "padding": 16}',
  
  -- Ownership and access
  created_by UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(company_id),
  is_public BOOLEAN DEFAULT false,
  
  -- Settings
  refresh_frequency INTEGER DEFAULT 0, -- in seconds, 0 means no auto-refresh
  auto_refresh BOOLEAN DEFAULT false,
  theme_config JSONB DEFAULT '{}',
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dashboards_company_id ON dashboards(company_id);
CREATE INDEX idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX idx_dashboards_tags ON dashboards USING GIN(tags);

-- 2. Dashboard widgets table
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  
  -- Widget type and content
  widget_type VARCHAR(20) NOT NULL CHECK (widget_type IN ('report', 'text', 'image', 'metric', 'iframe', 'custom')),
  report_id UUID REFERENCES saved_reports(id) ON DELETE SET NULL,
  
  -- Position and size (grid units)
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 4,
  height INTEGER NOT NULL DEFAULT 3,
  
  -- Appearance
  title VARCHAR(255),
  show_title BOOLEAN DEFAULT true,
  show_border BOOLEAN DEFAULT true,
  background_color VARCHAR(20),
  border_color VARCHAR(20),
  border_radius INTEGER DEFAULT 8,
  has_shadow BOOLEAN DEFAULT true,
  
  -- Behavior
  z_index INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  is_resizable BOOLEAN DEFAULT true,
  is_movable BOOLEAN DEFAULT true,
  
  -- Configuration
  configuration JSONB DEFAULT '{}',
  responsive_config JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dashboard_widgets_dashboard_id ON dashboard_widgets(dashboard_id);
CREATE INDEX idx_dashboard_widgets_report_id ON dashboard_widgets(report_id);

-- 3. Dashboard permissions table
CREATE TABLE IF NOT EXISTS dashboard_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission_level VARCHAR(20) NOT NULL CHECK (permission_level IN ('viewer', 'editor', 'admin')),
  
  -- Granular permissions
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_share BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  can_comment BOOLEAN DEFAULT true,
  
  -- Metadata
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(dashboard_id, user_id)
);

-- Create indexes
CREATE INDEX idx_dashboard_permissions_dashboard_id ON dashboard_permissions(dashboard_id);
CREATE INDEX idx_dashboard_permissions_user_id ON dashboard_permissions(user_id);

-- 4. Dashboard shares (public/embed links)
CREATE TABLE IF NOT EXISTS dashboard_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  
  -- Share configuration
  share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('view', 'edit', 'embed')),
  access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('public', 'company', 'users', 'password')),
  password_hash TEXT, -- For password-protected shares
  expires_at TIMESTAMPTZ,
  allowed_users UUID[], -- Array of user IDs for restricted access
  
  -- Embed configuration
  embed_config JSONB DEFAULT '{
    "allowInteraction": true,
    "showHeader": true,
    "showFilters": true,
    "theme": "light"
  }',
  
  -- Tracking
  share_token VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dashboard_shares_dashboard_id ON dashboard_shares(dashboard_id);
CREATE INDEX idx_dashboard_shares_share_token ON dashboard_shares(share_token);

-- 5. Dashboard version history
CREATE TABLE IF NOT EXISTS dashboard_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  
  -- Version info
  version_number INTEGER NOT NULL,
  name VARCHAR(255),
  description TEXT,
  
  -- Snapshot of dashboard state
  dashboard_config JSONB NOT NULL,
  widgets_config JSONB NOT NULL,
  
  -- Metadata
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT false,
  size_bytes INTEGER,
  checksum VARCHAR(64),
  
  UNIQUE(dashboard_id, version_number)
);

-- Create indexes
CREATE INDEX idx_dashboard_versions_dashboard_id ON dashboard_versions(dashboard_id);
CREATE INDEX idx_dashboard_versions_created_at ON dashboard_versions(created_at);

-- 6. Dashboard comments
CREATE TABLE IF NOT EXISTS dashboard_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  widget_id UUID REFERENCES dashboard_widgets(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES dashboard_comments(id) ON DELETE CASCADE,
  
  -- Comment content
  content TEXT NOT NULL,
  position_x INTEGER,
  position_y INTEGER,
  
  -- Status
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  
  -- Metadata
  author_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dashboard_comments_dashboard_id ON dashboard_comments(dashboard_id);
CREATE INDEX idx_dashboard_comments_widget_id ON dashboard_comments(widget_id);
CREATE INDEX idx_dashboard_comments_author_id ON dashboard_comments(author_id);

-- 7. Dashboard analytics
CREATE TABLE IF NOT EXISTS dashboard_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  
  -- User tracking
  user_id UUID,
  session_id VARCHAR(255),
  
  -- Event data
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}',
  widget_id UUID REFERENCES dashboard_widgets(id) ON DELETE SET NULL,
  
  -- Context
  viewport_width INTEGER,
  viewport_height INTEGER,
  device_type VARCHAR(20),
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dashboard_analytics_dashboard_id ON dashboard_analytics(dashboard_id);
CREATE INDEX idx_dashboard_analytics_user_id ON dashboard_analytics(user_id);
CREATE INDEX idx_dashboard_analytics_created_at ON dashboard_analytics(created_at);

-- 8. Dashboard templates
CREATE TABLE IF NOT EXISTS dashboard_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  
  -- Template configuration
  layout_config JSONB NOT NULL,
  widgets_config JSONB NOT NULL,
  preview_image_url TEXT,
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  
  -- Access
  created_by UUID NOT NULL,
  company_id UUID REFERENCES companies(company_id),
  is_public BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dashboard_templates_category ON dashboard_templates(category);
CREATE INDEX idx_dashboard_templates_tags ON dashboard_templates USING GIN(tags);
CREATE INDEX idx_dashboard_templates_company_id ON dashboard_templates(company_id);

-- Add foreign key constraints to users table
-- =====================================================
-- Note: We'll add FK constraints after verifying the users table structure
-- For now, we'll rely on application-level validation

-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_templates ENABLE ROW LEVEL SECURITY;

-- Dashboard policies
CREATE POLICY "Users can view dashboards they have access to" 
ON dashboards FOR SELECT USING (
  created_by = auth.uid()
  OR is_public = true
  OR company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM dashboard_permissions
    WHERE dashboard_id = dashboards.id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create dashboards in their company"
ON dashboards FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "Users can update their own dashboards or those they have edit permission for"
ON dashboards FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM dashboard_permissions
    WHERE dashboard_id = dashboards.id
    AND user_id = auth.uid()
    AND (permission_level IN ('editor', 'admin') OR can_edit = true)
  )
);

CREATE POLICY "Users can delete their own dashboards or those they have admin permission for"
ON dashboards FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM dashboard_permissions
    WHERE dashboard_id = dashboards.id
    AND user_id = auth.uid()
    AND permission_level = 'admin'
  )
);

-- Widget policies (inherit from dashboard)
CREATE POLICY "Users can view widgets on accessible dashboards"
ON dashboard_widgets FOR SELECT USING (
  dashboard_id IN (SELECT id FROM dashboards)
);

CREATE POLICY "Users can manage widgets on editable dashboards"
ON dashboard_widgets FOR ALL USING (
  dashboard_id IN (
    SELECT id FROM dashboards
    WHERE created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM dashboard_permissions
      WHERE dashboard_id = dashboards.id
      AND user_id = auth.uid()
      AND (permission_level IN ('editor', 'admin') OR can_edit = true)
    )
  )
);

-- Helper functions
-- =====================================================

-- Function to create a new dashboard with default widgets
CREATE OR REPLACE FUNCTION create_dashboard_with_defaults(
  p_name VARCHAR,
  p_description TEXT,
  p_company_id UUID,
  p_user_id UUID,
  p_template_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_dashboard_id UUID;
  v_template_config JSONB;
BEGIN
  -- Create the dashboard
  INSERT INTO dashboards (name, description, company_id, created_by)
  VALUES (p_name, p_description, p_company_id, p_user_id)
  RETURNING id INTO v_dashboard_id;
  
  -- If template provided, copy widgets
  IF p_template_id IS NOT NULL THEN
    SELECT widgets_config INTO v_template_config
    FROM dashboard_templates
    WHERE id = p_template_id;
    
    -- Create widgets from template
    INSERT INTO dashboard_widgets (
      dashboard_id, widget_type, position_x, position_y, 
      width, height, configuration
    )
    SELECT 
      v_dashboard_id,
      (widget->>'widget_type')::VARCHAR,
      (widget->>'position_x')::INTEGER,
      (widget->>'position_y')::INTEGER,
      (widget->>'width')::INTEGER,
      (widget->>'height')::INTEGER,
      widget->'configuration'
    FROM jsonb_array_elements(v_template_config) AS widget;
    
    -- Increment template usage
    UPDATE dashboard_templates
    SET usage_count = usage_count + 1
    WHERE id = p_template_id;
  END IF;
  
  RETURN v_dashboard_id;
END;
$$ LANGUAGE plpgsql;

-- Function to track dashboard analytics
CREATE OR REPLACE FUNCTION track_dashboard_event(
  p_dashboard_id UUID,
  p_user_id UUID,
  p_event_type VARCHAR,
  p_event_data JSONB DEFAULT '{}',
  p_widget_id UUID DEFAULT NULL,
  p_viewport_width INTEGER DEFAULT NULL,
  p_viewport_height INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO dashboard_analytics (
    dashboard_id, user_id, event_type, event_data,
    widget_id, viewport_width, viewport_height
  )
  VALUES (
    p_dashboard_id, p_user_id, p_event_type, p_event_data,
    p_widget_id, p_viewport_width, p_viewport_height
  );
  
  -- Update view count for specific events
  IF p_event_type = 'view' THEN
    UPDATE dashboards
    SET view_count = view_count + 1
    WHERE id = p_dashboard_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_dashboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dashboards_updated_at
  BEFORE UPDATE ON dashboards
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboard_updated_at();

CREATE TRIGGER update_dashboard_widgets_updated_at
  BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboard_updated_at();

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;