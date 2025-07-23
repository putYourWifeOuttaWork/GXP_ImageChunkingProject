-- Create dashboard management schema (simplified version)
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

-- Enable RLS on all tables
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_shares ENABLE ROW LEVEL SECURITY;

-- Dashboard policies
CREATE POLICY "Users can view dashboards they have access to" 
ON dashboards FOR SELECT USING (
  created_by = auth.uid()
  OR is_public = true
  OR EXISTS (
    SELECT 1 FROM dashboard_permissions
    WHERE dashboard_id = dashboards.id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create dashboards"
ON dashboards FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own dashboards"
ON dashboards FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM dashboard_permissions
    WHERE dashboard_id = dashboards.id
    AND user_id = auth.uid()
    AND (permission_level IN ('editor', 'admin') OR can_edit = true)
  )
);

CREATE POLICY "Users can delete their own dashboards"
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

-- Dashboard permissions policies
CREATE POLICY "Users can view permissions for accessible dashboards"
ON dashboard_permissions FOR SELECT USING (
  dashboard_id IN (SELECT id FROM dashboards)
);

CREATE POLICY "Admins can manage permissions"
ON dashboard_permissions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM dashboards
    WHERE id = dashboard_permissions.dashboard_id
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM dashboard_permissions dp
        WHERE dp.dashboard_id = dashboards.id
        AND dp.user_id = auth.uid()
        AND dp.permission_level = 'admin'
      )
    )
  )
);

-- Dashboard shares policies
CREATE POLICY "Users can view shares for their dashboards"
ON dashboard_shares FOR SELECT USING (
  dashboard_id IN (
    SELECT id FROM dashboards
    WHERE created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM dashboard_permissions
      WHERE dashboard_id = dashboards.id
      AND user_id = auth.uid()
      AND can_share = true
    )
  )
);

CREATE POLICY "Users can manage shares for their dashboards"
ON dashboard_shares FOR ALL USING (
  dashboard_id IN (
    SELECT id FROM dashboards
    WHERE created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM dashboard_permissions
      WHERE dashboard_id = dashboards.id
      AND user_id = auth.uid()
      AND can_share = true
    )
  )
);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;