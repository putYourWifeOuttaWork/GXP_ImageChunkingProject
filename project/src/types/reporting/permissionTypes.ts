// Permission and access control types for the reporting system

export type PermissionType = 'read' | 'write' | 'admin';

export type PermissionTarget = 'user' | 'role' | 'company' | 'public';

export interface ReportPermission {
  id: string;
  reportId: string;
  targetType: PermissionTarget;
  targetId?: string; // user_id, role, company_id, null for public
  permissionType: PermissionType;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  conditions?: PermissionCondition[];
  metadata?: any;
}

export interface PermissionCondition {
  type: 'time_range' | 'ip_address' | 'location' | 'device' | 'data_filter' | 'custom';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'between' | 'matches';
  value: any;
  description?: string;
}

export interface DashboardPermission {
  id: string;
  dashboardId: string;
  targetType: PermissionTarget;
  targetId?: string;
  permissionType: PermissionType;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  conditions?: PermissionCondition[];
  widgetPermissions?: WidgetPermission[];
  metadata?: any;
}

export interface WidgetPermission {
  widgetId: string;
  permissionType: PermissionType;
  hidden?: boolean;
  readOnly?: boolean;
  customRestrictions?: string[];
}

// Permission evaluation context
export interface PermissionContext {
  userId: string;
  userRole: string;
  companyId: string;
  ipAddress?: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
  device?: {
    type: string;
    os: string;
    browser: string;
  };
  timestamp: string;
  sessionId?: string;
  metadata?: any;
}

// Permission evaluation result
export interface PermissionEvaluation {
  hasPermission: boolean;
  permissionType: PermissionType | null;
  reasons: string[];
  restrictions: PermissionRestriction[];
  expiresAt?: string;
  grantedBy?: string;
  evaluatedAt: string;
  cacheable: boolean;
  cacheKey?: string;
}

export interface PermissionRestriction {
  type: 'data_filter' | 'time_limit' | 'feature_limit' | 'export_limit' | 'custom';
  description: string;
  value: any;
  severity: 'info' | 'warning' | 'error';
}

// Permission templates for common scenarios
export interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  permissions: PermissionTemplateRule[];
  conditions: PermissionCondition[];
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  usageCount: number;
}

export interface PermissionTemplateRule {
  resourceType: 'report' | 'dashboard' | 'data_source' | 'filter';
  permissionType: PermissionType;
  scope: 'all' | 'owned' | 'company' | 'program' | 'site' | 'custom';
  scopeValue?: string;
  conditions?: PermissionCondition[];
}

// Permission inheritance and hierarchies
export interface PermissionHierarchy {
  id: string;
  name: string;
  description: string;
  levels: PermissionLevel[];
  inheritance: InheritanceRule[];
  overrides: PermissionOverride[];
}

export interface PermissionLevel {
  id: string;
  name: string;
  level: number;
  permissions: string[];
  parent?: string;
  children: string[];
}

export interface InheritanceRule {
  fromLevel: string;
  toLevel: string;
  inherit: boolean;
  restrictions?: string[];
}

export interface PermissionOverride {
  id: string;
  targetType: PermissionTarget;
  targetId: string;
  level: string;
  permissions: string[];
  reason: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
}

// Permission auditing and logging
export interface PermissionAuditLog {
  id: string;
  userId: string;
  action: PermissionAction;
  resourceType: 'report' | 'dashboard' | 'data_source' | 'filter' | 'system';
  resourceId: string;
  permissionType: PermissionType;
  granted: boolean;
  reason: string;
  context: PermissionContext;
  timestamp: string;
  sessionId?: string;
  metadata?: any;
}

export type PermissionAction = 
  | 'view'
  | 'edit'
  | 'delete'
  | 'share'
  | 'export'
  | 'create'
  | 'clone'
  | 'publish'
  | 'unpublish'
  | 'grant_permission'
  | 'revoke_permission'
  | 'change_owner'
  | 'archive'
  | 'restore';

// Permission caching
export interface PermissionCache {
  userId: string;
  resourceType: string;
  resourceId: string;
  permissionType: PermissionType;
  hasPermission: boolean;
  restrictions: PermissionRestriction[];
  cachedAt: string;
  expiresAt: string;
  cacheKey: string;
  version: number;
}

// Permission notifications
export interface PermissionNotification {
  id: string;
  type: 'permission_granted' | 'permission_revoked' | 'permission_expired' | 'permission_request';
  userId: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  permissionType: PermissionType;
  grantedBy?: string;
  message: string;
  createdAt: string;
  read: boolean;
  actionUrl?: string;
}

// Permission requests and approvals
export interface PermissionRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  permissionType: PermissionType;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: any;
}

// Permission delegation
export interface PermissionDelegation {
  id: string;
  delegatorId: string;
  delegateeId: string;
  resourceType: string;
  resourceId: string;
  permissionType: PermissionType;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  revokedAt?: string;
  revokedBy?: string;
  conditions?: PermissionCondition[];
}

// Permission groups for batch management
export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  permissions: ReportPermission[];
  members: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  autoAssign: boolean;
  assignmentRules?: PermissionAssignmentRule[];
}

export interface PermissionAssignmentRule {
  type: 'user_role' | 'company' | 'department' | 'custom';
  condition: string;
  value: any;
  action: 'add' | 'remove';
}

// Permission analytics
export interface PermissionAnalytics {
  resourceId: string;
  resourceType: string;
  metrics: {
    totalPermissions: number;
    activePermissions: number;
    expiredPermissions: number;
    revokedPermissions: number;
    uniqueUsers: number;
    averagePermissionDuration: number;
  };
  permissionDistribution: Array<{
    permissionType: PermissionType;
    count: number;
    percentage: number;
  }>;
  userEngagement: Array<{
    userId: string;
    userName: string;
    permissionType: PermissionType;
    lastAccess: string;
    accessCount: number;
  }>;
  trends: Array<{
    date: string;
    granted: number;
    revoked: number;
    expired: number;
  }>;
}

// Permission compliance and governance
export interface PermissionCompliance {
  id: string;
  name: string;
  description: string;
  rules: ComplianceRule[];
  violations: ComplianceViolation[];
  lastCheck: string;
  nextCheck: string;
  status: 'compliant' | 'non_compliant' | 'pending';
  createdBy: string;
  createdAt: string;
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  type: 'mandatory' | 'recommended' | 'prohibited';
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoRemediation?: string;
}

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  resourceType: string;
  resourceId: string;
  userId?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

// Permission API types
export interface PermissionAPI {
  checkPermission(
    userId: string,
    resourceType: string,
    resourceId: string,
    permissionType: PermissionType,
    context?: PermissionContext
  ): Promise<PermissionEvaluation>;
  
  grantPermission(
    resourceType: string,
    resourceId: string,
    targetType: PermissionTarget,
    targetId: string,
    permissionType: PermissionType,
    grantedBy: string,
    conditions?: PermissionCondition[]
  ): Promise<ReportPermission>;
  
  revokePermission(
    permissionId: string,
    revokedBy: string,
    reason?: string
  ): Promise<void>;
  
  listPermissions(
    resourceType: string,
    resourceId: string,
    includeInherited?: boolean
  ): Promise<ReportPermission[]>;
  
  bulkGrantPermissions(
    permissions: Omit<ReportPermission, 'id' | 'grantedAt'>[]
  ): Promise<ReportPermission[]>;
  
  bulkRevokePermissions(
    permissionIds: string[],
    revokedBy: string,
    reason?: string
  ): Promise<void>;
}