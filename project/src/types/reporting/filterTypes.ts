// Filter configuration types for the reporting system

export type FilterOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_null'
  | 'is_not_null'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'between'
  | 'not_between'
  | 'in'
  | 'not_in'
  | 'regex'
  | 'custom';

export type FilterType = 
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'range'
  | 'daterange'
  | 'spatial'
  | 'hierarchical'
  | 'custom';

export type FilterLogic = 'and' | 'or';

// Base filter interface
export interface Filter {
  id: string;
  name: string;
  field: string;
  dataSource?: string;
  type: FilterType;
  operator: FilterOperator;
  value: any;
  logic?: FilterLogic;
  
  // Relationship configuration for cross-table filtering
  relationshipPath?: RelationshipPath[];
  targetTable?: string;
  
  // UI configuration
  label?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  hidden?: boolean;
  
  // Validation
  validation?: FilterValidation;
  
  // Conditional logic
  dependsOn?: string[];
  conditionalLogic?: ConditionalLogic[];
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

// Defines the path through related tables to reach the filter field
export interface RelationshipPath {
  fromTable: string;
  toTable: string;
  joinField: string;
  foreignField: string;
  joinType?: 'INNER' | 'LEFT' | 'RIGHT';
}

// Filter validation
export interface FilterValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  customValidator?: string;
  errorMessage?: string;
}

// Conditional logic for filters
export interface ConditionalLogic {
  condition: FilterCondition;
  action: FilterAction;
}

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
  logic?: FilterLogic;
}

export interface FilterAction {
  type: 'show' | 'hide' | 'enable' | 'disable' | 'set_value' | 'clear_value' | 'set_options';
  value?: any;
  options?: any[];
}

// Specific filter types

// Text filter
export interface TextFilter extends Filter {
  type: 'text';
  value: string;
  caseSensitive?: boolean;
  trim?: boolean;
  multiline?: boolean;
}

// Number filter
export interface NumberFilter extends Filter {
  type: 'number';
  value: number | [number, number];
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

// Date filter
export interface DateFilter extends Filter {
  type: 'date' | 'datetime';
  value: string | [string, string];
  format?: string;
  timezone?: string;
  minDate?: string;
  maxDate?: string;
  presets?: DatePreset[];
}

export interface DatePreset {
  id: string;
  name: string;
  value: [string, string];
  relative?: boolean;
}

// Boolean filter
export interface BooleanFilter extends Filter {
  type: 'boolean';
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
}

// Select filter
export interface SelectFilter extends Filter {
  type: 'select' | 'multiselect';
  value: any | any[];
  options: FilterOption[];
  allowCustom?: boolean;
  searchable?: boolean;
  maxSelections?: number;
}

export interface FilterOption {
  value: any;
  label: string;
  group?: string;
  disabled?: boolean;
  color?: string;
  icon?: string;
  metadata?: any;
}

// Range filter
export interface RangeFilter extends Filter {
  type: 'range';
  value: [number, number];
  min: number;
  max: number;
  step?: number;
  marks?: RangeMark[];
  showInput?: boolean;
}

export interface RangeMark {
  value: number;
  label: string;
  color?: string;
}

// Spatial filter
export interface SpatialFilter extends Filter {
  type: 'spatial';
  value: SpatialFilterValue;
  bounds: SpatialBounds;
  coordinateSystem?: 'cartesian' | 'geographic';
}

export interface SpatialFilterValue {
  type: 'point' | 'circle' | 'rectangle' | 'polygon' | 'custom';
  coordinates: number[][] | number[];
  radius?: number;
  properties?: any;
}

export interface SpatialBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// Hierarchical filter
export interface HierarchicalFilter extends Filter {
  type: 'hierarchical';
  value: string | string[];
  hierarchy: HierarchyLevel[];
  multiSelect?: boolean;
  showSearch?: boolean;
  expandAll?: boolean;
}

export interface HierarchyLevel {
  id: string;
  name: string;
  level: number;
  parent?: string;
  children?: string[];
  count?: number;
  metadata?: any;
}

// Custom filter
export interface CustomFilter extends Filter {
  type: 'custom';
  value: any;
  component: string;
  configuration: any;
  validator?: string;
}

// Filter group for organizing filters
export interface FilterGroup {
  id: string;
  name: string;
  description?: string;
  filters: Filter[];
  logic: FilterLogic;
  collapsed?: boolean;
  conditional?: ConditionalLogic[];
}

// Filter set for saving and sharing filter combinations
export interface FilterSet {
  id: string;
  name: string;
  description?: string;
  filters: Filter[];
  groups: FilterGroup[];
  isDefault?: boolean;
  isPublic?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

// Filter application result
export interface FilterResult {
  sql: string;
  parameters: Record<string, any>;
  affectedRows: number;
  executionTime: number;
  errors?: FilterError[];
  warnings?: FilterWarning[];
}

export interface FilterError {
  filterId: string;
  message: string;
  type: 'validation' | 'execution' | 'syntax';
  details?: any;
}

export interface FilterWarning {
  filterId: string;
  message: string;
  type: 'performance' | 'data_quality' | 'compatibility';
  details?: any;
}

// Filter analytics
export interface FilterAnalytics {
  filterId: string;
  usageCount: number;
  averageExecutionTime: number;
  errorRate: number;
  popularValues: Array<{
    value: any;
    count: number;
    percentage: number;
  }>;
  correlations: Array<{
    filterId: string;
    filterName: string;
    correlation: number;
  }>;
}

// Filter suggestions
export interface FilterSuggestion {
  id: string;
  type: 'auto_complete' | 'similar_filters' | 'popular_values' | 'data_driven';
  priority: number;
  suggestion: any;
  confidence: number;
  reason: string;
  metadata?: any;
}

// Cross-filtering configuration
export interface CrossFilterConfiguration {
  enabled: boolean;
  mode: 'automatic' | 'manual';
  relationships: CrossFilterRelationship[];
  defaultLogic: FilterLogic;
}

export interface CrossFilterRelationship {
  sourceFilter: string;
  targetFilter: string;
  field: string;
  operator: FilterOperator;
  bidirectional?: boolean;
  strength?: number;
}

// Filter persistence
export interface FilterPersistence {
  enabled: boolean;
  scope: 'session' | 'user' | 'global';
  key: string;
  expiration?: number;
  encrypt?: boolean;
}

// Filter UI configuration
export interface FilterUIConfiguration {
  layout: 'sidebar' | 'top' | 'bottom' | 'modal' | 'inline';
  collapsible: boolean;
  searchable: boolean;
  sortable: boolean;
  groupable: boolean;
  showClearAll: boolean;
  showApplyButton: boolean;
  showSaveButton: boolean;
  showLoadButton: boolean;
  autoApply: boolean;
  debounceTime: number;
  maxHeight?: number;
  theme?: 'light' | 'dark' | 'auto';
}

// Filter state management
export interface FilterState {
  filters: Filter[];
  groups: FilterGroup[];
  activeFilters: string[];
  appliedFilters: string[];
  errors: FilterError[];
  warnings: FilterWarning[];
  isLoading: boolean;
  lastApplied: string;
  isDirty: boolean;
}

// Filter actions
export type FilterAction = 
  | { type: 'ADD_FILTER'; payload: Filter }
  | { type: 'UPDATE_FILTER'; payload: { id: string; updates: Partial<Filter> } }
  | { type: 'REMOVE_FILTER'; payload: string }
  | { type: 'APPLY_FILTERS'; payload: string[] }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'LOAD_FILTER_SET'; payload: FilterSet }
  | { type: 'SAVE_FILTER_SET'; payload: Omit<FilterSet, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'SET_ERROR'; payload: FilterError }
  | { type: 'CLEAR_ERROR'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean };

// Agricultural domain-specific filter types
export interface GrowthStageFilter extends SelectFilter {
  value: string | string[];
  options: Array<{
    value: string;
    label: string;
    color: string;
    threshold: number;
  }>;
}

export interface PhaseFilter extends Filter {
  type: 'select';
  value: string | string[];
  phases: Array<{
    id: string;
    name: string;
    type: 'control' | 'experimental';
    startDate: string;
    endDate: string;
  }>;
}

export interface PlacementFilter extends SpatialFilter {
  placementTypes: Array<{
    id: string;
    name: string;
    coordinates: [number, number];
    effectiveness?: number;
  }>;
}

export interface EnvironmentalFilter extends Filter {
  type: 'range';
  value: [number, number];
  units: string;
  idealRange?: [number, number];
  alertThresholds?: {
    low: number;
    high: number;
  };
}

export interface ChemicalTypeFilter extends SelectFilter {
  value: string | string[];
  options: Array<{
    value: string;
    label: string;
    category: string;
    concentration?: number;
    effectiveness?: number;
  }>;
}

// Predefined relationship paths for common cross-table filtering scenarios
export const COMMON_RELATIONSHIP_PATHS = {
  // From observations to program fields
  observationsToProgramDates: [
    {
      fromTable: 'petri_observations',
      toTable: 'submissions',
      joinField: 'submission_id',
      foreignField: 'submission_id',
      joinType: 'INNER' as const
    },
    {
      fromTable: 'submissions',
      toTable: 'sites',
      joinField: 'site_id',
      foreignField: 'site_id',
      joinType: 'INNER' as const
    },
    {
      fromTable: 'sites',
      toTable: 'pilot_programs',
      joinField: 'program_id',
      foreignField: 'program_id',
      joinType: 'INNER' as const
    }
  ],
  
  // From observations to site fields
  observationsToSite: [
    {
      fromTable: 'petri_observations',
      toTable: 'sites',
      joinField: 'site_id',
      foreignField: 'site_id',
      joinType: 'INNER' as const
    }
  ],
  
  // From observations to submission fields
  observationsToSubmission: [
    {
      fromTable: 'petri_observations',
      toTable: 'submissions',
      joinField: 'submission_id',
      foreignField: 'submission_id',
      joinType: 'INNER' as const
    }
  ],
  
  // From submissions to program fields
  submissionsToProgram: [
    {
      fromTable: 'submissions',
      toTable: 'sites',
      joinField: 'site_id',
      foreignField: 'site_id',
      joinType: 'INNER' as const
    },
    {
      fromTable: 'sites',
      toTable: 'pilot_programs',
      joinField: 'program_id',
      foreignField: 'program_id',
      joinType: 'INNER' as const
    }
  ],
  
  // From submissions to site fields
  submissionsToSite: [
    {
      fromTable: 'submissions',
      toTable: 'sites',
      joinField: 'site_id',
      foreignField: 'site_id',
      joinType: 'INNER' as const
    }
  ],
  
  // From sites to program fields
  sitesToProgram: [
    {
      fromTable: 'sites',
      toTable: 'pilot_programs',
      joinField: 'program_id',
      foreignField: 'program_id',
      joinType: 'INNER' as const
    }
  ]
};

// Helper function to determine relationship path based on source and target tables
export function getRelationshipPath(sourceTable: string, targetTable: string): RelationshipPath[] | null {
  const key = `${sourceTable}To${targetTable.charAt(0).toUpperCase() + targetTable.slice(1)}`;
  const paths = COMMON_RELATIONSHIP_PATHS as any;
  return paths[key] || null;
}