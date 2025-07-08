// Dashboard configuration types

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  
  // Ownership and access
  createdByUserId: string;
  companyId: string;
  isPublic: boolean;
  
  // Configuration
  refreshFrequency?: number;
  autoRefresh: boolean;
  themeConfig: ThemeConfiguration;
  
  // Metadata
  tags: string[];
  viewCount: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface DashboardLayout {
  type: 'grid' | 'free' | 'tabs' | 'stack';
  columns: number;
  rows: number;
  gap: number;
  padding: number;
  responsive: boolean;
  breakpoints?: ResponsiveBreakpoints;
  widgets: DashboardWidget[];
}

export interface DashboardWidget {
  id: string;
  type: 'report' | 'text' | 'image' | 'metric' | 'iframe' | 'custom';
  reportId?: string;
  
  // Position and size
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Appearance
  title?: string;
  showTitle: boolean;
  showBorder: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  shadow?: boolean;
  
  // Behavior
  zIndex: number;
  isVisible: boolean;
  isResizable: boolean;
  isMovable: boolean;
  
  // Content-specific configuration
  configuration: WidgetConfiguration;
  
  // Responsive behavior
  responsive?: ResponsiveWidgetConfiguration;
}

export interface WidgetConfiguration {
  // Report widget
  reportConfiguration?: {
    showFilters: boolean;
    showExport: boolean;
    showRefresh: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    filterOverrides?: any[];
  };
  
  // Text widget
  textConfiguration?: {
    content: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    alignment: 'left' | 'center' | 'right' | 'justify';
    markdown: boolean;
  };
  
  // Image widget
  imageConfiguration?: {
    src: string;
    alt: string;
    fit: 'contain' | 'cover' | 'fill' | 'scale-down';
    alignment: 'center' | 'top' | 'bottom' | 'left' | 'right';
  };
  
  // Metric widget
  metricConfiguration?: {
    value: number;
    label: string;
    format: string;
    color: string;
    icon?: string;
    comparison?: {
      value: number;
      label: string;
      color: string;
    };
    trend?: {
      direction: 'up' | 'down' | 'stable';
      percentage: number;
      color: string;
    };
  };
  
  // IFrame widget
  iframeConfiguration?: {
    src: string;
    sandbox: string;
    allowFullscreen: boolean;
  };
  
  // Custom widget
  customConfiguration?: {
    component: string;
    props: any;
  };
}

export interface ResponsiveWidgetConfiguration {
  mobile: Partial<DashboardWidget>;
  tablet: Partial<DashboardWidget>;
  desktop: Partial<DashboardWidget>;
}

export interface ResponsiveBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface ThemeConfiguration {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  
  typography: {
    fontFamily: string;
    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
      xxl: number;
    };
    fontWeight: {
      light: number;
      regular: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  
  borderRadius: {
    none: number;
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
  
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

// Dashboard state management
export interface DashboardState {
  dashboard: Dashboard | null;
  widgets: DashboardWidget[];
  selectedWidgets: string[];
  draggedWidget: string | null;
  isEditing: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Layout state
  layout: DashboardLayout;
  viewport: {
    width: number;
    height: number;
    breakpoint: 'mobile' | 'tablet' | 'desktop';
  };
  
  // Interaction state
  interactions: {
    zoom: number;
    pan: { x: number; y: number };
    selection: { x: number; y: number; width: number; height: number } | null;
  };
}

// Dashboard actions
export type DashboardAction = 
  | { type: 'LOAD_DASHBOARD'; payload: Dashboard }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'ADD_WIDGET'; payload: DashboardWidget }
  | { type: 'UPDATE_WIDGET'; payload: { id: string; updates: Partial<DashboardWidget> } }
  | { type: 'REMOVE_WIDGET'; payload: string }
  | { type: 'SELECT_WIDGET'; payload: string }
  | { type: 'DESELECT_WIDGET'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_DRAGGED_WIDGET'; payload: string | null }
  | { type: 'UPDATE_LAYOUT'; payload: Partial<DashboardLayout> }
  | { type: 'SET_VIEWPORT'; payload: { width: number; height: number; breakpoint: string } }
  | { type: 'UPDATE_INTERACTIONS'; payload: Partial<DashboardState['interactions']> };

// Dashboard template
export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  layout: DashboardLayout;
  previewImage?: string;
  tags: string[];
  usageCount: number;
  rating: number;
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
}

// Dashboard sharing
export interface DashboardShare {
  id: string;
  dashboardId: string;
  shareType: 'view' | 'edit' | 'embed';
  accessLevel: 'public' | 'company' | 'users' | 'password';
  password?: string;
  expiresAt?: string;
  allowedUsers?: string[];
  embedConfiguration?: {
    allowInteraction: boolean;
    showHeader: boolean;
    showFilters: boolean;
    theme: 'light' | 'dark' | 'auto';
    customCSS?: string;
  };
  createdBy: string;
  createdAt: string;
  viewCount: number;
  lastViewed?: string;
}

// Dashboard export
export interface DashboardExport {
  format: 'pdf' | 'png' | 'svg' | 'ppt' | 'html';
  layout: 'current' | 'print' | 'mobile' | 'tablet' | 'desktop';
  quality: 'low' | 'medium' | 'high';
  includeFilters: boolean;
  includeInteractivity: boolean;
  customDimensions?: {
    width: number;
    height: number;
  };
  filename?: string;
  metadata?: {
    title: string;
    author: string;
    subject: string;
    keywords: string[];
  };
}

// Dashboard analytics
export interface DashboardAnalytics {
  dashboardId: string;
  metrics: {
    totalViews: number;
    uniqueUsers: number;
    averageViewTime: number;
    bounceRate: number;
    interactionRate: number;
    exportCount: number;
    shareCount: number;
  };
  
  userEngagement: Array<{
    userId: string;
    viewCount: number;
    totalTime: number;
    interactions: number;
    lastVisit: string;
  }>;
  
  widgetAnalytics: Array<{
    widgetId: string;
    widgetType: string;
    viewCount: number;
    interactionCount: number;
    averageViewTime: number;
    errorCount: number;
  }>;
  
  timeSeriesData: Array<{
    date: string;
    views: number;
    users: number;
    interactions: number;
  }>;
  
  popularFilters: Array<{
    filterId: string;
    filterName: string;
    usageCount: number;
    averageResultCount: number;
  }>;
}

// Dashboard collaboration
export interface DashboardCollaboration {
  dashboardId: string;
  collaborators: DashboardCollaborator[];
  comments: DashboardComment[];
  changeLog: DashboardChange[];
  permissions: DashboardPermissions;
}

export interface DashboardCollaborator {
  userId: string;
  userName: string;
  role: 'owner' | 'editor' | 'viewer';
  permissions: string[];
  invitedBy: string;
  invitedAt: string;
  lastActivity: string;
  status: 'active' | 'pending' | 'inactive';
}

export interface DashboardComment {
  id: string;
  widgetId?: string;
  position?: { x: number; y: number };
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
  replies?: DashboardComment[];
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface DashboardChange {
  id: string;
  type: 'widget_added' | 'widget_updated' | 'widget_removed' | 'layout_changed' | 'settings_changed';
  description: string;
  userId: string;
  userName: string;
  changes: any;
  timestamp: string;
  reverted?: boolean;
  revertedBy?: string;
  revertedAt?: string;
}

export interface DashboardPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canExport: boolean;
  canComment: boolean;
  canInvite: boolean;
  canManagePermissions: boolean;
  restrictedWidgets?: string[];
  restrictedActions?: string[];
}

// Dashboard notifications
export interface DashboardNotification {
  id: string;
  dashboardId: string;
  type: 'data_update' | 'error' | 'threshold_breach' | 'comment' | 'share' | 'export_complete';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  userId: string;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
  actionUrl?: string;
  metadata?: any;
}

// Dashboard automation
export interface DashboardAutomation {
  id: string;
  dashboardId: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  lastExecuted?: string;
  executionCount: number;
  errorCount: number;
}

export interface AutomationTrigger {
  type: 'schedule' | 'data_change' | 'threshold' | 'manual';
  configuration: any;
}

export interface AutomationCondition {
  type: 'data_value' | 'time_range' | 'user_action' | 'system_status';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface AutomationAction {
  type: 'export' | 'email' | 'webhook' | 'notification' | 'refresh' | 'custom';
  configuration: any;
}

// Dashboard versioning
export interface DashboardVersion {
  id: string;
  dashboardId: string;
  version: number;
  name: string;
  description?: string;
  configuration: Dashboard;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
  changeLog: string[];
  size: number;
  checksum: string;
}