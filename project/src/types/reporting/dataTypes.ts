// Data structure types for the reporting system

export interface DataPoint {
  id: string;
  dimensions: Record<string, any>;
  measures: Record<string, number>;
  metadata?: Record<string, any>;
  timestamp?: string;
  coordinates?: {
    x: number;
    y: number;
  };
}

export interface AggregatedData {
  data: DataPoint[];
  metadata: DataMetadata;
  aggregations: Record<string, any>;
  totalCount: number;
  filteredCount: number;
  executionTime: number;
  cacheHit: boolean;
}

export interface DataMetadata {
  dimensions: DimensionMetadata[];
  measures: MeasureMetadata[];
  dateRange?: {
    start: string;
    end: string;
  };
  aggregationLevel?: string;
  filters?: FilterMetadata[];
  lastUpdated: string;
}

export interface DimensionMetadata {
  id: string;
  name: string;
  dataType: string;
  uniqueValues: number;
  nullCount: number;
  minValue?: any;
  maxValue?: any;
  distribution?: ValueDistribution[];
}

export interface MeasureMetadata {
  id: string;
  name: string;
  aggregation: string;
  dataType: string;
  sum?: number;
  avg?: number;
  min?: number;
  max?: number;
  count?: number;
  stddev?: number;
  median?: number;
  nullCount: number;
}

export interface ValueDistribution {
  value: any;
  count: number;
  percentage: number;
}

export interface FilterMetadata {
  id: string;
  field: string;
  operator: string;
  value: any;
  appliedCount: number;
  excludedCount: number;
}

// Time series specific data structures
export interface TimeSeriesData {
  timestamp: string;
  values: Record<string, number>;
  dimensions: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TimeSeriesDataset {
  id: string;
  name: string;
  data: TimeSeriesData[];
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  showArea?: boolean;
  yAxisId?: string;
}

// Spatial data structures
export interface SpatialData {
  id: string;
  coordinates: {
    x: number;
    y: number;
    z?: number;
  };
  value: number;
  dimensions: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SpatialDataset {
  id: string;
  name: string;
  data: SpatialData[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ?: number;
    maxZ?: number;
  };
  colorScale?: string[];
  interpolation?: 'linear' | 'cubic' | 'nearest';
}

// Hierarchical data structures
export interface HierarchicalData {
  id: string;
  name: string;
  value: number;
  level: number;
  parent?: string;
  children?: HierarchicalData[];
  dimensions: Record<string, any>;
  metadata?: Record<string, any>;
}

// Scientific data structures for agricultural domain
export interface GrowthData {
  observationId: string;
  petriCode: string;
  timestamp: string;
  growthIndex: number;
  growthStage: string;
  growthProgression: number;
  growthVelocity?: number;
  phase: {
    number: number;
    type: 'control' | 'experimental';
    dayInPhase: number;
  };
  environmental: {
    temperature: number;
    humidity: number;
    outdoorTemperature?: number;
    outdoorHumidity?: number;
  };
  placement: {
    x: number;
    y: number;
    height?: string;
    direction?: string;
  };
  treatments: {
    fungicideUsed: boolean;
    waterSchedule: string;
    chemicalType?: string;
  };
}

export interface GasifierData {
  observationId: string;
  gasifierCode: string;
  timestamp: string;
  measure: number;
  linearReading?: number;
  linearReduction?: number;
  flowRate?: number;
  anomaly: boolean;
  phase: {
    number: number;
    type: 'control' | 'experimental';
    dayInPhase: number;
  };
  environmental: {
    temperature: number;
    humidity: number;
    outdoorTemperature?: number;
    outdoorHumidity?: number;
  };
  placement: {
    x: number;
    y: number;
    height: string;
    direction: string;
    strategy: string;
  };
  chemical: {
    type: string;
    concentration?: number;
  };
}

export interface EnvironmentalData {
  timestamp: string;
  siteId: string;
  programId: string;
  indoor: {
    temperature: number;
    humidity: number;
    airflow: string;
  };
  outdoor: {
    temperature: number;
    humidity: number;
    weather: string;
  };
  calculated: {
    temperatureDifference: number;
    humidityDifference: number;
    dewPoint: number;
    heatIndex: number;
  };
}

// Query result structures
export interface QueryResult {
  data: any[];
  metadata: QueryMetadata;
  executionTime: number;
  cacheHit: boolean;
  totalRows: number;
  filteredRows: number;
  error?: string;
}

export interface QueryMetadata {
  sql: string;
  parameters: Record<string, any>;
  tables: string[];
  joins: string[];
  filters: string[];
  groupBy: string[];
  orderBy: string[];
  limit?: number;
  offset?: number;
}

// Data transformation types
export interface DataTransformation {
  id: string;
  name: string;
  type: 'filter' | 'aggregate' | 'calculate' | 'sort' | 'group' | 'pivot';
  configuration: any;
  order: number;
}

export interface PivotConfiguration {
  rows: string[];
  columns: string[];
  values: string[];
  aggregations: Record<string, string>;
  fillValue?: any;
}

export interface CalculationConfiguration {
  name: string;
  formula: string;
  dependencies: string[];
  dataType: string;
}

// Cache-related types
export interface CacheEntry {
  id: string;
  reportId: string;
  cacheKey: string;
  parametersHash: string;
  data: AggregatedData;
  metadata: Record<string, any>;
  createdAt: string;
  expiresAt: string;
  hitCount: number;
  size: number;
}

export interface CacheStatistics {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  averageExecutionTime: number;
  mostAccessedReports: Array<{
    reportId: string;
    reportName: string;
    hitCount: number;
  }>;
}

// Data validation types
export interface DataValidation {
  field: string;
  rules: ValidationRule[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationRule {
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  parameters: any;
  message: string;
}

export interface ValidationError {
  field: string;
  rule: string;
  message: string;
  value: any;
  rowIndex?: number;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value: any;
  rowIndex?: number;
  severity: 'low' | 'medium' | 'high';
}

// Data quality metrics
export interface DataQualityMetrics {
  completeness: number; // Percentage of non-null values
  accuracy: number; // Percentage of values within expected ranges
  consistency: number; // Percentage of values consistent across related fields
  timeliness: number; // Percentage of recent data
  validity: number; // Percentage of values matching expected format
  uniqueness: number; // Percentage of unique values where uniqueness is expected
}

// Real-time data types
export interface RealtimeDataUpdate {
  reportId: string;
  timestamp: string;
  updateType: 'insert' | 'update' | 'delete';
  data: any;
  affectedRows: number;
  metadata?: Record<string, any>;
}

export interface RealtimeSubscription {
  id: string;
  reportId: string;
  userId: string;
  filters?: any[];
  callback: (update: RealtimeDataUpdate) => void;
  active: boolean;
  createdAt: string;
}