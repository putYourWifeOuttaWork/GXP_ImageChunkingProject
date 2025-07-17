import { supabase } from '../lib/supabaseClient';
import type {
  ReportFolder,
  SavedReport,
  CreateFolderRequest,
  SaveReportRequest,
  ShareFolderRequest,
  FolderPermissionLevel,
  ReportDataSnapshot,
  ReportVisualization,
  FolderTreeNode
} from '../types/reports';

export class ReportManagementService {
  // ==================== FOLDERS ====================
  
  /**
   * Get all folders accessible to the current user
   */
  static async getFolders(): Promise<ReportFolder[]> {
    const { data, error } = await supabase
      .from('report_folders')
      .select(`
        *,
        report_folder_permissions!left(permission_level)
      `)
      .order('folder_order', { ascending: true })
      .order('folder_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get folder tree structure
   */
  static async getFolderTree(): Promise<FolderTreeNode[]> {
    const folders = await this.getFolders();
    
    // Build tree structure
    const folderMap = new Map<string, FolderTreeNode>();
    const rootFolders: FolderTreeNode[] = [];
    
    // First pass: create all nodes
    folders.forEach(folder => {
      folderMap.set(folder.folder_id, {
        ...folder,
        children: [],
        isExpanded: false
      });
    });
    
    // Second pass: build tree
    folders.forEach(folder => {
      const node = folderMap.get(folder.folder_id)!;
      if (folder.parent_folder_id) {
        const parent = folderMap.get(folder.parent_folder_id);
        if (parent) {
          parent.children!.push(node);
        }
      } else {
        rootFolders.push(node);
      }
    });
    
    return rootFolders;
  }

  /**
   * Create a new folder
   */
  static async createFolder(request: CreateFolderRequest): Promise<ReportFolder> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', userData.user.id)
      .single();

    if (!userProfile) throw new Error('User profile not found');

    // Calculate folder path
    let folderPath = '/' + request.folder_name;
    if (request.parent_folder_id) {
      const { data: parentFolder } = await supabase
        .from('report_folders')
        .select('folder_path')
        .eq('folder_id', request.parent_folder_id)
        .single();
      
      if (parentFolder) {
        folderPath = parentFolder.folder_path + '/' + request.folder_name;
      }
    }

    const { data, error } = await supabase
      .from('report_folders')
      .insert({
        company_id: userProfile.company_id,
        parent_folder_id: request.parent_folder_id,
        folder_name: request.folder_name,
        folder_path: folderPath,
        description: request.description,
        icon: request.icon || 'folder',
        color: request.color || '#6B7280',
        created_by: userData.user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update folder
   */
  static async updateFolder(
    folderId: string, 
    updates: Partial<ReportFolder>
  ): Promise<ReportFolder> {
    const { data, error } = await supabase
      .from('report_folders')
      .update({
        folder_name: updates.folder_name,
        description: updates.description,
        icon: updates.icon,
        color: updates.color,
        updated_at: new Date().toISOString()
      })
      .eq('folder_id', folderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete folder (and all contents)
   */
  static async deleteFolder(folderId: string): Promise<void> {
    const { error } = await supabase
      .from('report_folders')
      .delete()
      .eq('folder_id', folderId);

    if (error) throw error;
  }

  /**
   * Share folder with users
   */
  static async shareFolder(request: ShareFolderRequest): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    // Get user IDs from emails
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('email', request.user_emails);

    if (!users || users.length === 0) {
      throw new Error('No valid users found');
    }

    // Create permissions
    const permissions = users.map(user => ({
      folder_id: request.folder_id,
      user_id: user.id,
      permission_level: request.permission_level,
      granted_by: userData.user.id
    }));

    const { error } = await supabase
      .from('report_folder_permissions')
      .upsert(permissions, {
        onConflict: 'folder_id,user_id'
      });

    if (error) throw error;
  }

  /**
   * Get folder permissions
   */
  static async getFolderPermissions(folderId: string) {
    const { data, error } = await supabase
      .from('report_folder_permissions')
      .select(`
        *,
        user:users!user_id(id, email, full_name, avatar_url),
        granted_by_user:users!granted_by(id, email, full_name)
      `)
      .eq('folder_id', folderId);

    if (error) throw error;
    return data || [];
  }

  // ==================== REPORTS ====================

  /**
   * Get reports in a folder
   */
  static async getReportsInFolder(folderId: string): Promise<SavedReport[]> {
    const { data, error } = await supabase
      .from('saved_reports')
      .select(`
        *,
        report_data_snapshots!left(
          snapshot_id,
          version_number,
          data_timestamp,
          query_runtime_ms,
          data_row_count,
          is_current
        ),
        report_visualizations(*)
      `)
      .eq('folder_id', folderId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Save a new report
   */
  static async saveReport(request: SaveReportRequest): Promise<SavedReport> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', userData.user.id)
      .single();

    if (!userProfile) throw new Error('User profile not found');

    // Start a transaction
    const { data: report, error: reportError } = await supabase
      .from('saved_reports')
      .insert({
        folder_id: request.folder_id,
        company_id: userProfile.company_id,
        report_name: request.report_name,
        description: request.description,
        report_type: request.report_type,
        report_config: request.report_config,
        data_source_config: request.data_source_config,
        created_by: userData.user.id,
        is_draft: request.is_draft || false,
        is_template: request.is_template || false
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Create initial version history entry
    await supabase
      .from('report_version_history')
      .insert({
        report_id: report.report_id,
        version_number: 1,
        change_type: 'created',
        change_description: 'Initial report creation',
        new_config: request.report_config,
        changed_by: userData.user.id
      });

    return report;
  }

  /**
   * Update existing report
   */
  static async updateReport(
    reportId: string, 
    updates: Partial<SaveReportRequest>
  ): Promise<SavedReport> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    // Get current version
    const { data: currentReport } = await supabase
      .from('saved_reports')
      .select('report_config')
      .eq('report_id', reportId)
      .single();

    // Get next version number
    const { data: versionData } = await supabase
      .from('report_version_history')
      .select('version_number')
      .eq('report_id', reportId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = versionData && versionData.length > 0 
      ? versionData[0].version_number + 1 
      : 1;

    // Update report
    const { data, error } = await supabase
      .from('saved_reports')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('report_id', reportId)
      .select()
      .single();

    if (error) throw error;

    // Create version history entry
    if (updates.report_config) {
      await supabase
        .from('report_version_history')
        .insert({
          report_id: reportId,
          version_number: nextVersion,
          change_type: 'updated',
          change_description: updates.description || 'Report configuration updated',
          previous_config: currentReport?.report_config,
          new_config: updates.report_config,
          changed_by: userData.user.id
        });
    }

    return data;
  }

  /**
   * Save report data snapshot
   */
  static async saveReportSnapshot(
    reportId: string,
    snapshotData: any,
    metadata?: {
      queryRuntimeMs?: number;
      rowCount?: number;
    }
  ): Promise<ReportDataSnapshot> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    // Mark current snapshots as not current
    await supabase
      .from('report_data_snapshots')
      .update({ is_current: false })
      .eq('report_id', reportId)
      .eq('is_current', true);

    // Get next version number
    const { data: versionData } = await supabase
      .from('report_data_snapshots')
      .select('version_number')
      .eq('report_id', reportId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = versionData && versionData.length > 0 
      ? versionData[0].version_number + 1 
      : 1;

    // Create new snapshot
    const { data, error } = await supabase
      .from('report_data_snapshots')
      .insert({
        report_id: reportId,
        version_number: nextVersion,
        snapshot_data: snapshotData,
        data_timestamp: new Date().toISOString(),
        created_by: userData.user.id,
        query_runtime_ms: metadata?.queryRuntimeMs,
        data_row_count: metadata?.rowCount,
        data_size_bytes: JSON.stringify(snapshotData).length,
        is_current: true
      })
      .select()
      .single();

    if (error) throw error;

    // Update report's last refresh time
    await supabase
      .from('saved_reports')
      .update({ 
        last_refresh_at: new Date().toISOString(),
        estimated_runtime_ms: metadata?.queryRuntimeMs 
      })
      .eq('report_id', reportId);

    return data;
  }

  /**
   * Get report with full details
   */
  static async getReport(reportId: string): Promise<SavedReport | null> {
    const { data, error } = await supabase
      .from('saved_reports')
      .select(`
        *,
        report_data_snapshots!left(
          snapshot_id,
          version_number,
          snapshot_data,
          data_timestamp,
          query_runtime_ms,
          data_row_count,
          is_current
        ),
        report_visualizations(*),
        report_folders!inner(folder_name, folder_path)
      `)
      .eq('report_id', reportId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    // Log access
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase
        .from('report_access_logs')
        .insert({
          report_id: reportId,
          accessed_by: userData.user.id,
          access_type: 'view'
        });

      // Update access count and last accessed
      await supabase
        .from('saved_reports')
        .update({ 
          access_count: (data.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('report_id', reportId);
    }

    return data;
  }

  /**
   * Delete report
   */
  static async deleteReport(reportId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_reports')
      .delete()
      .eq('report_id', reportId);

    if (error) throw error;
  }

  /**
   * Move report to different folder
   */
  static async moveReport(reportId: string, targetFolderId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_reports')
      .update({ 
        folder_id: targetFolderId,
        updated_at: new Date().toISOString()
      })
      .eq('report_id', reportId);

    if (error) throw error;
  }

  /**
   * Get user's permission level for a folder
   */
  static async getUserFolderPermission(
    folderId: string
  ): Promise<FolderPermissionLevel> {
    const { data, error } = await supabase
      .rpc('get_folder_permission_level', {
        p_folder_id: folderId
      });

    if (error) throw error;
    return data || 'no_access';
  }

  /**
   * Search reports
   */
  static async searchReports(query: string): Promise<SavedReport[]> {
    const { data, error } = await supabase
      .from('saved_reports')
      .select(`
        *,
        report_folders!inner(folder_name, folder_path)
      `)
      .or(`report_name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get recently accessed reports
   */
  static async getRecentReports(limit: number = 10): Promise<SavedReport[]> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    // First try to get from access logs
    const { data: accessLogs, error: accessError } = await supabase
      .from('report_access_logs')
      .select(`
        report_id,
        accessed_at,
        saved_reports!inner(
          *,
          report_folders!inner(folder_name, folder_path)
        )
      `)
      .eq('accessed_by', userData.user.id)
      .eq('access_type', 'view')
      .order('accessed_at', { ascending: false })
      .limit(limit);

    // If we have access logs, use them
    if (!accessError && accessLogs && accessLogs.length > 0) {
      const uniqueReports = new Map<string, SavedReport>();
      accessLogs.forEach(log => {
        const report = log.saved_reports;
        if (report && !uniqueReports.has(report.report_id)) {
          uniqueReports.set(report.report_id, {
            ...report,
            folder: log.saved_reports.report_folders
          });
        }
      });
      return Array.from(uniqueReports.values());
    }

    // Fallback: get most recently updated reports
    const { data: recentReports, error: recentError } = await supabase
      .from('saved_reports')
      .select(`
        *,
        report_folders!inner(folder_name, folder_path)
      `)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (recentError) throw recentError;
    return recentReports || [];
  }
}