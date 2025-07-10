// Core report configuration types

export type ReportCategory = 'analytics' | 'operational' | 'compliance' | 'research' | 'executive';

export type ReportType = 'chart' | 'table' | 'dashboard' | 'export' | 'real_time';

export type ChartType = 
  | 'line'
  | 'bar' 
  | 'scatter'
  | 'heatmap'
  | 'contour'
  | 'box_plot'
  | 'histogram'
  | 'pie'
  | 'donut'
  | 'area'
  | 'growth_progression'
  | 'spatial_effectiveness'
  | 'phase_comparison'
  | 'environmental_correlation';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'stddev' | 'distinct' | 'first' | 'last';

export type DataType = 'string' | 'number' | 'date' | 'boolean' | 'json';

export type SortDirection = 'asc' | 'desc';

// Main report configuration interface
export interface ReportConfiguration {
  id: string;
  name: string;
  description?: string;
  category: ReportCategory;
  type: ReportType;
  
  // Ownership
  createdByUserId: string;
  companyId: string;
  programIds: string[];
  isPublic: boolean;
  isTemplate: boolean;
  
  // Data configuration
  dataSources: DataSource[];
  dimensions: Dimension[];
  measures: Measure[];
  filters: Filter[];
  sorting: SortConfig[];
  
  // Visualization configuration
  chartType: ChartType;
  visualizationSettings: VisualizationSettings;
  
  // Display configuration
  formatting: FormattingOptions;
  interactivity: InteractivityOptions;
  
  // Performance
  queryCacheTtl: number; // in seconds
  autoRefresh: boolean;
  refreshFrequency?: number; // in seconds
  
  // Metadata
  tags: string[];
  version: number;
  lastRefreshedAt?: string;
  viewCount: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Data source configuration
export interface DataSource {
  id: string;
  name: string;
  table: string;
  alias?: string;
  joins?: Join[];
  baseFilters?: Filter[];
  customQuery?: string;
}

export interface Join {
  id: string;
  type: 'inner' | 'left' | 'right' | 'full';
  table: string;
  alias?: string;
  condition: JoinCondition;
}

export interface JoinCondition {
  leftField: string;
  operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'in' | 'not_in';
  rightField: string;
}

// Dimension configuration
export interface Dimension {
  id: string;
  name: string;
  field: string;
  dataSource?: string;
  source?: string; // Alternative property name used in some places
  dataType: DataType;
  format?: string;
  
  // Enum support for categorical dimensions
  enumValues?: string[];
  
  // Hierarchy and grouping
  hierarchyLevel?: number;
  parentDimension?: string;
  customGrouping?: GroupingRule[];
  
  // Display
  displayName?: string;
  description?: string;
  isHidden?: boolean;
  
  // Time dimensions
  granularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  
  // Sorting
  sortOrder?: number;
  sortDirection?: SortDirection;
}

export interface GroupingRule {
  id: string;
  name: string;
  condition: string;
  value: any;
  color?: string;
}

// Measure configuration
export interface Measure {
  id: string;
  name: string;
  field: string;
  dataSource: string;
  aggregation: AggregationType;
  dataType: DataType;
  
  // Calculations
  customCalculation?: string;
  formula?: string;
  
  // Formatting
  format?: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  
  // Display
  displayName?: string;
  description?: string;
  isHidden?: boolean;
  
  // Thresholds and alerts
  thresholds?: Threshold[];
  
  // Sorting
  sortOrder?: number;
  sortDirection?: SortDirection;
}

export interface Threshold {
  id: string;
  name: string;
  operator: '<' | '>' | '<=' | '>=' | '=' | '!=';
  value: number;
  color: string;
  action?: 'highlight' | 'alert' | 'hide';
}

// Sorting configuration
export interface SortConfig {
  field: string;
  direction: SortDirection;
  priority: number;
}

// Formatting options
export interface FormattingOptions {
  theme?: 'light' | 'dark' | 'auto';
  colors?: ColorScheme;
  fonts?: FontConfig;
  spacing?: SpacingConfig;
  borders?: BorderConfig;
  responsive?: ResponsiveConfig;
}

export interface ColorScheme {
  primary: string[];
  secondary: string[];
  accent: string[];
  background: string;
  text: string;
  grid: string;
  axis: string;
}

export interface FontConfig {
  family: string;
  sizes: {
    title: number;
    subtitle: number;
    body: number;
    caption: number;
    axis: number;
  };
  weights: {
    title: number;
    subtitle: number;
    body: number;
    caption: number;
    axis: number;
  };
}

export interface SpacingConfig {
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface BorderConfig {
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
  radius: number;
}

export interface ResponsiveConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  adaptiveLayout: boolean;
  hideElementsOnMobile?: string[];
}

// Interactivity options
export interface InteractivityOptions {
  enableTooltips: boolean;
  enableZoom: boolean;
  enablePan: boolean;
  enableBrush: boolean;
  enableDrillDown: boolean;
  enableCrossFiltering: boolean;
  enableSelection: boolean;
  enableExport: boolean;
  
  // Event handlers
  onDataPointClick?: string; // Function name or code
  onDataPointHover?: string;
  onSelectionChange?: string;
  onZoomChange?: string;
  onFilterChange?: string;
}

// Report metadata
export interface ReportMetadata {
  id: string;
  name: string;
  description?: string;
  category: ReportCategory;
  type: ReportType;
  createdByUserId: string;
  companyId: string;
  tags: string[];
  version: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  lastRefreshedAt?: string;
}

// Report summary for lists
export interface ReportSummary {
  id: string;
  name: string;
  description?: string;
  category: ReportCategory;
  type: ReportType;
  chartType: ChartType;
  isPublic: boolean;
  isTemplate: boolean;
  createdByUserId: string;
  tags: string[];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

// Report version for audit trail
export interface ReportVersion {
  versionId: string;
  reportId: string;
  versionNumber: number;
  configurationSnapshot: ReportConfiguration;
  changeSummary?: string;
  changeType: 'created' | 'updated' | 'deleted' | 'restored';
  createdByUserId: string;
  createdAt: string;
}

// Export configuration
export interface ExportConfiguration {
  format: 'pdf' | 'png' | 'svg' | 'csv' | 'excel' | 'json';
  filename?: string;
  quality?: number; // For image exports
  dimensions?: {
    width: number;
    height: number;
  };
  includeData?: boolean;
  includeMetadata?: boolean;
  compression?: boolean;
}

// Report execution context
export interface ReportExecutionContext {
  userId: string;
  companyId: string;
  programIds?: string[];
  filters?: Filter[];
  dateRange?: {
    start: string;
    end: string;
  };
  timezone?: string;
  locale?: string;
}