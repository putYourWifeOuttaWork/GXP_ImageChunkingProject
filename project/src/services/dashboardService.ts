import { supabase } from '../lib/supabaseClient';
import { 
  Dashboard, 
  DashboardWidget, 
  DashboardShare,
  DashboardTemplate,
  DashboardVersion,
  DashboardComment,
  DashboardCollaborator,
  DashboardPermissions,
  DashboardLayout
} from '../types/reporting/dashboardTypes';

// Helper function to convert snake_case to camelCase
function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (obj instanceof Array) return obj.map(toCamelCase);
  if (typeof obj !== 'object') return obj;
  
  const camelObj: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = toCamelCase(obj[key]);
  }
  
  // Special case: rename layoutConfig to layout for dashboards
  if (camelObj.layoutConfig) {
    camelObj.layout = camelObj.layoutConfig;
    delete camelObj.layoutConfig;
  }
  
  // Special case: combine position fields for widgets
  if (camelObj.positionX !== undefined && camelObj.positionY !== undefined) {
    camelObj.position = {
      x: camelObj.positionX,
      y: camelObj.positionY,
      width: camelObj.width || 4,
      height: camelObj.height || 3
    };
    delete camelObj.positionX;
    delete camelObj.positionY;
    // Don't delete width and height as they might be used elsewhere
  }
  
  return camelObj;
}

export class DashboardService {
  // Dashboard CRUD operations
  static async createDashboard(
    name: string,
    description: string,
    layout?: DashboardLayout,
    templateId?: string
  ): Promise<{ data: Dashboard | null; error: any }> {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError;

      const { data: user } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

      if (!user) throw new Error('User not found');

      // Create dashboard directly
      const { data: dashboard, error } = await supabase
        .from('dashboards')
        .insert({
          name,
          description,
          company_id: user.company_id,
          created_by: userData.user.id,
          layout_config: layout || {
            type: 'grid',
            columns: 12,
            rows: 8,
            gap: 16,
            padding: 16,
            responsive: true,
            widgets: []
          }
        })
        .select()
        .single();

      if (error) throw error;

      // Convert to camelCase
      const mappedData = dashboard ? toCamelCase(dashboard) : null;

      return { data: mappedData, error: null };
    } catch (error) {
      console.error('Error creating dashboard:', error);
      return { data: null, error };
    }
  }

  static async getDashboard(id: string): Promise<{ data: Dashboard | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select(`
          *,
          created_by_user:users!dashboards_created_by_fkey(id, email, full_name),
          company:companies(company_id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Track view event (commented out until function exists in database)
      // const { data: userData } = await supabase.auth.getUser();
      // if (userData.user) {
      //   await this.trackEvent(id, 'view', {});
      // }

      // Convert snake_case to camelCase
      const mappedData = data ? toCamelCase(data) : null;

      return { data: mappedData, error: null };
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      return { data: null, error };
    }
  }

  static async updateDashboard(
    id: string,
    updates: Partial<Dashboard>
  ): Promise<{ data: Dashboard | null; error: any }> {
    try {
      // Convert camelCase to snake_case for database
      const dbUpdates: any = {};
      for (const key in updates) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (key === 'layout') {
          dbUpdates['layout_config'] = updates[key];
        } else {
          dbUpdates[snakeKey] = updates[key as keyof Dashboard];
        }
      }

      const { data, error } = await supabase
        .from('dashboards')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Convert back to camelCase
      const mappedData = data ? toCamelCase(data) : null;

      return { data: mappedData, error: null };
    } catch (error) {
      console.error('Error updating dashboard:', error);
      return { data: null, error };
    }
  }

  static async deleteDashboard(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('dashboards')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      return { error };
    }
  }

  static async listDashboards(
    filters?: {
      companyId?: string;
      userId?: string;
      tags?: string[];
      search?: string;
    }
  ): Promise<{ data: Dashboard[] | null; error: any }> {
    try {
      let query = supabase
        .from('dashboards')
        .select(`
          *,
          created_by_user:users!dashboards_created_by_fkey(id, email, full_name),
          _count:dashboard_widgets(count)
        `)
        .order('updated_at', { ascending: false });

      if (filters?.companyId) {
        query = query.eq('company_id', filters.companyId);
      }

      if (filters?.userId) {
        query = query.eq('created_by', filters.userId);
      }

      if (filters?.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Convert snake_case to camelCase
      const mappedData = data ? data.map(toCamelCase) : null;

      return { data: mappedData, error: null };
    } catch (error) {
      console.error('Error listing dashboards:', error);
      return { data: null, error };
    }
  }

  // Widget management
  static async getWidgets(dashboardId: string): Promise<{ data: DashboardWidget[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .select(`
          *,
          report:saved_reports(
            report_id,
            report_name,
            description,
            report_type,
            report_config
          )
        `)
        .eq('dashboard_id', dashboardId)
        .order('z_index', { ascending: true });

      if (error) throw error;

      // Map widgets properly with position data
      const mappedData = data ? data.map(widget => this.mapWidgetFromDb(widget)) : null;

      return { data: mappedData, error: null };
    } catch (error) {
      console.error('Error fetching widgets:', error);
      return { data: null, error };
    }
  }

  static async updateWidgets(
    dashboardId: string,
    widgets: DashboardWidget[]
  ): Promise<{ error: any }> {
    try {
      // First, delete all existing widgets
      const { error: deleteError } = await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('dashboard_id', dashboardId);

      if (deleteError) throw deleteError;

      // Then insert all new widgets
      if (widgets.length > 0) {
        const widgetsToInsert = widgets.map(widget => ({
          dashboard_id: dashboardId,
          widget_type: widget.type,
          report_id: widget.reportId || null,
          position_x: widget.position.x,
          position_y: widget.position.y,
          width: widget.position.width,
          height: widget.position.height,
          title: widget.title,
          show_title: widget.showTitle,
          show_border: widget.showBorder,
          background_color: widget.backgroundColor,
          border_color: widget.borderColor,
          border_radius: widget.borderRadius,
          has_shadow: widget.shadow,
          z_index: widget.zIndex,
          is_visible: widget.isVisible,
          is_resizable: widget.isResizable,
          is_movable: widget.isMovable,
          configuration: widget.configuration
        }));

        const { error: insertError } = await supabase
          .from('dashboard_widgets')
          .insert(widgetsToInsert);

        if (insertError) throw insertError;
      }

      return { error: null };
    } catch (error) {
      console.error('Error updating widgets:', error);
      return { error };
    }
  }

  static async addWidget(
    dashboardId: string,
    widget: Omit<DashboardWidget, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ data: DashboardWidget | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('dashboard_widgets')
        .insert({
          dashboard_id: dashboardId,
          widget_type: widget.type,
          report_id: widget.reportId,
          position_x: widget.position.x,
          position_y: widget.position.y,
          width: widget.position.width,
          height: widget.position.height,
          title: widget.title,
          show_title: widget.showTitle,
          show_border: widget.showBorder,
          background_color: widget.backgroundColor,
          border_color: widget.borderColor,
          border_radius: widget.borderRadius,
          has_shadow: widget.shadow,
          z_index: widget.zIndex,
          is_visible: widget.isVisible,
          is_resizable: widget.isResizable,
          is_movable: widget.isMovable,
          configuration: widget.configuration,
          responsive_config: widget.responsive
        })
        .select()
        .single();

      if (error) throw error;

      // Track widget add event
      await this.trackEvent(dashboardId, 'widget_added', { widgetId: data.id }, data.id);

      return { data: this.mapWidgetFromDb(data), error: null };
    } catch (error) {
      console.error('Error adding widget:', error);
      return { data: null, error };
    }
  }

  static async updateWidget(
    widgetId: string,
    updates: Partial<DashboardWidget>
  ): Promise<{ data: DashboardWidget | null; error: any }> {
    try {
      const updateData: any = {};
      
      if (updates.position) {
        updateData.position_x = updates.position.x;
        updateData.position_y = updates.position.y;
        updateData.width = updates.position.width;
        updateData.height = updates.position.height;
      }
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.showTitle !== undefined) updateData.show_title = updates.showTitle;
      if (updates.showBorder !== undefined) updateData.show_border = updates.showBorder;
      if (updates.backgroundColor !== undefined) updateData.background_color = updates.backgroundColor;
      if (updates.configuration !== undefined) updateData.configuration = updates.configuration;
      if (updates.zIndex !== undefined) updateData.z_index = updates.zIndex;

      const { data, error } = await supabase
        .from('dashboard_widgets')
        .update(updateData)
        .eq('id', widgetId)
        .select()
        .single();

      if (error) throw error;

      // Track widget update event
      await this.trackEvent(data.dashboard_id, 'widget_updated', { widgetId, updates }, widgetId);

      return { data: this.mapWidgetFromDb(data), error: null };
    } catch (error) {
      console.error('Error updating widget:', error);
      return { data: null, error };
    }
  }

  static async removeWidget(widgetId: string): Promise<{ error: any }> {
    try {
      // Get widget info before deletion for tracking
      const { data: widget } = await supabase
        .from('dashboard_widgets')
        .select('dashboard_id')
        .eq('id', widgetId)
        .single();

      const { error } = await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('id', widgetId);

      if (error) throw error;

      // Track widget remove event
      if (widget) {
        await this.trackEvent(widget.dashboard_id, 'widget_removed', { widgetId });
      }

      return { error: null };
    } catch (error) {
      console.error('Error removing widget:', error);
      return { error };
    }
  }

  static async updateWidgetPositions(
    updates: Array<{ id: string; position: DashboardWidget['position'] }>
  ): Promise<{ error: any }> {
    try {
      const promises = updates.map(update =>
        supabase
          .from('dashboard_widgets')
          .update({
            position_x: update.position.x,
            position_y: update.position.y,
            width: update.position.width,
            height: update.position.height
          })
          .eq('id', update.id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error('Failed to update some widget positions');
      }

      return { error: null };
    } catch (error) {
      console.error('Error updating widget positions:', error);
      return { error };
    }
  }

  // Dashboard sharing
  static async createShare(
    dashboardId: string,
    shareConfig: Omit<DashboardShare, 'id' | 'share_token' | 'created_at' | 'view_count'>
  ): Promise<{ data: DashboardShare | null; error: any }> {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError;

      const { data, error } = await supabase
        .from('dashboard_shares')
        .insert({
          dashboard_id: dashboardId,
          share_type: shareConfig.shareType,
          access_level: shareConfig.accessLevel,
          password_hash: shareConfig.password ? await this.hashPassword(shareConfig.password) : null,
          expires_at: shareConfig.expiresAt,
          allowed_users: shareConfig.allowedUsers,
          embed_config: shareConfig.embedConfiguration,
          created_by: userData.user.id
        })
        .select()
        .single();

      if (error) throw error;

      return { data: this.mapShareFromDb(data), error: null };
    } catch (error) {
      console.error('Error creating share:', error);
      return { data: null, error };
    }
  }

  static async getShareByToken(token: string): Promise<{ data: DashboardShare | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('dashboard_shares')
        .select(`
          *,
          dashboard:dashboards(*)
        `)
        .eq('share_token', token)
        .single();

      if (error) throw error;

      // Check if share is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        throw new Error('Share link has expired');
      }

      // Update view count
      await supabase
        .from('dashboard_shares')
        .update({ 
          view_count: data.view_count + 1,
          last_viewed_at: new Date().toISOString()
        })
        .eq('id', data.id);

      return { data: this.mapShareFromDb(data), error: null };
    } catch (error) {
      console.error('Error fetching share:', error);
      return { data: null, error };
    }
  }

  // Dashboard permissions
  static async getPermissions(dashboardId: string): Promise<{ data: DashboardPermissions | null; error: any }> {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError;

      // Check if user is owner
      const { data: dashboard } = await supabase
        .from('dashboards')
        .select('created_by')
        .eq('id', dashboardId)
        .single();

      if (dashboard?.created_by === userData.user.id) {
        // Owner has all permissions
        return {
          data: {
            canEdit: true,
            canDelete: true,
            canShare: true,
            canExport: true,
            canComment: true,
            canInvite: true,
            canManagePermissions: true
          },
          error: null
        };
      }

      // Check explicit permissions
      const { data: permission } = await supabase
        .from('dashboard_permissions')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .eq('user_id', userData.user.id)
        .single();

      if (permission) {
        return {
          data: {
            canEdit: permission.can_edit || permission.permission_level !== 'viewer',
            canDelete: permission.can_delete || permission.permission_level === 'admin',
            canShare: permission.can_share || permission.permission_level === 'admin',
            canExport: permission.can_export || true,
            canComment: permission.can_comment || true,
            canInvite: permission.permission_level === 'admin',
            canManagePermissions: permission.permission_level === 'admin'
          },
          error: null
        };
      }

      // Default viewer permissions
      return {
        data: {
          canEdit: false,
          canDelete: false,
          canShare: false,
          canExport: true,
          canComment: true,
          canInvite: false,
          canManagePermissions: false
        },
        error: null
      };
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return { data: null, error };
    }
  }

  static async grantPermission(
    dashboardId: string,
    userId: string,
    permissionLevel: 'viewer' | 'editor' | 'admin'
  ): Promise<{ error: any }> {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError;

      const permissions = {
        viewer: { can_edit: false, can_delete: false, can_share: false },
        editor: { can_edit: true, can_delete: false, can_share: false },
        admin: { can_edit: true, can_delete: true, can_share: true }
      };

      const { error } = await supabase
        .from('dashboard_permissions')
        .upsert({
          dashboard_id: dashboardId,
          user_id: userId,
          permission_level: permissionLevel,
          ...permissions[permissionLevel],
          granted_by: userData.user.id
        });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Error granting permission:', error);
      return { error };
    }
  }

  // Dashboard templates
  static async getTemplates(
    category?: string
  ): Promise<{ data: DashboardTemplate[] | null; error: any }> {
    try {
      let query = supabase
        .from('dashboard_templates')
        .select('*')
        .order('usage_count', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Convert snake_case to camelCase
      const mappedData = data ? data.map(toCamelCase) : null;

      return { data: mappedData, error: null };
    } catch (error) {
      console.error('Error fetching templates:', error);
      return { data: null, error };
    }
  }

  // Dashboard versioning
  static async saveVersion(
    dashboardId: string,
    name?: string,
    description?: string
  ): Promise<{ data: DashboardVersion | null; error: any }> {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError;

      // Get current dashboard state
      const { data: dashboard } = await this.getDashboard(dashboardId);
      const { data: widgets } = await this.getWidgets(dashboardId);

      if (!dashboard) throw new Error('Dashboard not found');

      // Get next version number
      const { data: lastVersion } = await supabase
        .from('dashboard_versions')
        .select('version_number')
        .eq('dashboard_id', dashboardId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const versionNumber = (lastVersion?.version_number || 0) + 1;

      const { data, error } = await supabase
        .from('dashboard_versions')
        .insert({
          dashboard_id: dashboardId,
          version_number: versionNumber,
          name: name || `Version ${versionNumber}`,
          description,
          dashboard_config: dashboard,
          widgets_config: widgets,
          created_by: userData.user.id,
          size_bytes: JSON.stringify({ dashboard, widgets }).length,
          checksum: await this.generateChecksum({ dashboard, widgets })
        })
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error saving version:', error);
      return { data: null, error };
    }
  }

  static async restoreVersion(versionId: string): Promise<{ error: any }> {
    try {
      const { data: version, error: versionError } = await supabase
        .from('dashboard_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (versionError) throw versionError;

      // Update dashboard
      const { error: dashboardError } = await this.updateDashboard(
        version.dashboard_id,
        version.dashboard_config
      );

      if (dashboardError) throw dashboardError;

      // Clear existing widgets
      const { error: deleteError } = await supabase
        .from('dashboard_widgets')
        .delete()
        .eq('dashboard_id', version.dashboard_id);

      if (deleteError) throw deleteError;

      // Restore widgets
      const widgets = version.widgets_config as any[];
      const { error: widgetError } = await supabase
        .from('dashboard_widgets')
        .insert(widgets.map((w: any) => ({
          ...w,
          dashboard_id: version.dashboard_id,
          id: undefined // Let DB generate new IDs
        })));

      if (widgetError) throw widgetError;

      return { error: null };
    } catch (error) {
      console.error('Error restoring version:', error);
      return { error };
    }
  }

  // Analytics and tracking
  static async trackEvent(
    dashboardId: string,
    eventType: string,
    eventData: any = {},
    widgetId?: string
  ): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      await supabase.rpc('track_dashboard_event', {
        p_dashboard_id: dashboardId,
        p_user_id: userData?.user?.id || null,
        p_event_type: eventType,
        p_event_data: eventData,
        p_widget_id: widgetId || null,
        p_viewport_width: window.innerWidth,
        p_viewport_height: window.innerHeight
      });
    } catch (error) {
      console.error('Error tracking event:', error);
      // Don't throw - tracking failures shouldn't break functionality
    }
  }

  static async getAnalytics(
    dashboardId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase
        .from('dashboard_analytics')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .gte('created_at', timeRange.start.toISOString())
        .lte('created_at', timeRange.end.toISOString());

      if (error) throw error;

      // Aggregate analytics data
      const analytics = {
        totalViews: data.filter(e => e.event_type === 'view').length,
        uniqueUsers: new Set(data.map(e => e.user_id).filter(Boolean)).size,
        interactions: data.filter(e => e.event_type.includes('interact')).length,
        widgetStats: this.aggregateWidgetStats(data),
        timeSeriesData: this.generateTimeSeriesData(data, timeRange)
      };

      return { data: analytics, error: null };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return { data: null, error };
    }
  }

  // Helper methods
  private static mapWidgetFromDb(dbWidget: any): DashboardWidget {
    return {
      id: dbWidget.id,
      type: dbWidget.widget_type,
      reportId: dbWidget.report_id,
      position: {
        x: dbWidget.position_x,
        y: dbWidget.position_y,
        width: dbWidget.width,
        height: dbWidget.height
      },
      title: dbWidget.title,
      showTitle: dbWidget.show_title,
      showBorder: dbWidget.show_border,
      backgroundColor: dbWidget.background_color,
      borderColor: dbWidget.border_color,
      borderRadius: dbWidget.border_radius,
      shadow: dbWidget.has_shadow,
      zIndex: dbWidget.z_index,
      isVisible: dbWidget.is_visible,
      isResizable: dbWidget.is_resizable,
      isMovable: dbWidget.is_movable,
      configuration: dbWidget.configuration,
      responsive: dbWidget.responsive_config
    };
  }

  private static mapShareFromDb(dbShare: any): DashboardShare {
    return {
      id: dbShare.id,
      dashboardId: dbShare.dashboard_id,
      shareType: dbShare.share_type,
      accessLevel: dbShare.access_level,
      password: undefined, // Never return password
      expiresAt: dbShare.expires_at,
      allowedUsers: dbShare.allowed_users,
      embedConfiguration: dbShare.embed_config,
      createdBy: dbShare.created_by,
      createdAt: dbShare.created_at,
      viewCount: dbShare.view_count,
      lastViewed: dbShare.last_viewed_at,
      shareToken: dbShare.share_token // Add this field
    };
  }

  private static async hashPassword(password: string): Promise<string> {
    // Simple hash for demo - in production use bcrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private static async generateChecksum(data: any): Promise<string> {
    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const dataBuffer = encoder.encode(dataStr);
    const hash = await crypto.subtle.digest('SHA-256', dataBuffer);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private static aggregateWidgetStats(events: any[]): any {
    const widgetStats: Record<string, any> = {};
    
    events.forEach(event => {
      if (event.widget_id) {
        if (!widgetStats[event.widget_id]) {
          widgetStats[event.widget_id] = {
            views: 0,
            interactions: 0,
            errors: 0
          };
        }
        
        if (event.event_type === 'widget_view') widgetStats[event.widget_id].views++;
        if (event.event_type.includes('interact')) widgetStats[event.widget_id].interactions++;
        if (event.event_type === 'widget_error') widgetStats[event.widget_id].errors++;
      }
    });
    
    return widgetStats;
  }

  private static generateTimeSeriesData(events: any[], timeRange: { start: Date; end: Date }): any[] {
    // Group events by day
    const dailyData: Record<string, any> = {};
    
    events.forEach(event => {
      const date = new Date(event.created_at).toISOString().split('T')[0];
      
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          views: 0,
          users: new Set(),
          interactions: 0
        };
      }
      
      if (event.event_type === 'view') dailyData[date].views++;
      if (event.user_id) dailyData[date].users.add(event.user_id);
      if (event.event_type.includes('interact')) dailyData[date].interactions++;
    });
    
    // Convert to array and include user count
    return Object.values(dailyData).map(day => ({
      date: day.date,
      views: day.views,
      users: day.users.size,
      interactions: day.interactions
    }));
  }
}