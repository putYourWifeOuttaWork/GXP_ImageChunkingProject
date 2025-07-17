// Report Management Types

export type FolderPermissionLevel = 'admin' | 'viewer' | 'no_access';
export type ReportType = 'standard' | 'dashboard' | 'portfolio';
export type SubscriptionFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface ReportFolder {
  folder_id: string;
  company_id: string;
  parent_folder_id: string | null;
  folder_name: string;
  folder_path: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  folder_order: number;
  icon: string;
  color: string;
  
  // Computed/joined fields
  permission_level?: FolderPermissionLevel;
  child_count?: number;
  report_count?: number;
  children?: ReportFolder[];
}

export interface ReportFolderPermission {
  permission_id: string;
  folder_id: string;
  user_id: string;
  permission_level: FolderPermissionLevel;
  granted_by: string;
  granted_at: string;
  
  // Joined fields
  user?: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface SavedReport {
  report_id: string;
  folder_id: string;
  company_id: string;
  report_name: string;
  description: string | null;
  report_type: ReportType;
  report_config: any; // ReportBuilderConfig from existing types
  data_source_config: {
    program_ids: string[];
    date_range: {
      start: string;
      end: string;
    };
    filters: Record<string, any>;
  };
  created_by: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  access_count: number;
  is_draft: boolean;
  is_archived: boolean;
  is_template: boolean;
  estimated_runtime_ms: number | null;
  last_refresh_at: string | null;
  auto_refresh_enabled: boolean;
  refresh_interval_hours: number | null;
  
  // Computed fields
  current_snapshot?: ReportDataSnapshot;
  visualizations?: ReportVisualization[];
  creator?: {
    id: string;
    email: string;
    full_name: string;
  };
}

export interface ReportDataSnapshot {
  snapshot_id: string;
  report_id: string;
  version_number: number;
  snapshot_data: any; // AggregatedData from existing types
  raw_data_sample: any | null;
  data_timestamp: string;
  snapshot_created_at: string;
  created_by: string;
  query_runtime_ms: number | null;
  data_row_count: number | null;
  data_size_bytes: number | null;
  is_current: boolean;
  change_summary: string | null;
}

export interface ReportVisualization {
  visualization_id: string;
  report_id: string;
  visualization_type: string;
  visualization_config: any;
  display_order: number;
  layout_config: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  title: string | null;
  subtitle: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportVersionHistory {
  history_id: string;
  report_id: string;
  version_number: number;
  change_type: 'created' | 'updated' | 'restored' | 'auto_save';
  change_description: string | null;
  previous_config: any | null;
  new_config: any | null;
  changed_by: string;
  changed_at: string;
  restored_from_version: number | null;
}

export interface ReportSubscription {
  subscription_id: string;
  report_id: string;
  subscriber_id: string;
  frequency: SubscriptionFrequency;
  send_day_of_week: number | null;
  send_day_of_month: number | null;
  send_time: string;
  timezone: string;
  status: SubscriptionStatus;
  last_sent_at: string | null;
  next_send_at: string | null;
  email_format: 'pdf' | 'excel' | 'both';
  include_raw_data: boolean;
  created_at: string;
  updated_at: string;
}

// UI State Types
export interface FolderTreeNode extends ReportFolder {
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: FolderTreeNode[];
}

export interface ReportManagementState {
  folders: FolderTreeNode[];
  selectedFolderId: string | null;
  selectedReportId: string | null;
  isCreatingFolder: boolean;
  isCreatingReport: boolean;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'date' | 'accessed';
  sortOrder: 'asc' | 'desc';
}

// API Request/Response Types
export interface CreateFolderRequest {
  parent_folder_id?: string;
  folder_name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface SaveReportRequest {
  folder_id: string;
  report_name: string;
  description?: string;
  report_type: ReportType;
  report_config: any;
  data_source_config: any;
  is_draft?: boolean;
  is_template?: boolean;
}

export interface ShareFolderRequest {
  folder_id: string;
  user_emails: string[];
  permission_level: FolderPermissionLevel;
}

export interface MoveReportRequest {
  report_id: string;
  target_folder_id: string;
}

export interface RefreshReportRequest {
  report_id: string;
  save_snapshot?: boolean;
}