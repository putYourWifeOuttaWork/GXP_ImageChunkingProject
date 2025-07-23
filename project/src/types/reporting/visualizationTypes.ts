// Visualization configuration types for D3-based charts

export interface VisualizationSettings {
  chartType: string;
  dimensions: {
    width: number;
    height: number;
    margin: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  colors: ColorConfiguration;
  axes: AxesConfiguration;
  legends: LegendConfiguration;
  tooltips: TooltipConfiguration;
  animations: AnimationConfiguration;
  interactions: InteractionConfiguration;
  specific: Record<string, any>; // Chart-specific settings
}

// Color configuration
export interface ColorConfiguration {
  scheme: 'categorical' | 'sequential' | 'diverging' | 'custom';
  palette: string | string[];
  domain?: any[];
  range?: string[];
  interpolation?: 'linear' | 'log' | 'sqrt' | 'pow';
  opacity?: number;
  gradients?: GradientConfiguration[];
}

export interface GradientConfiguration {
  id: string;
  type: 'linear' | 'radial';
  stops: Array<{
    offset: number;
    color: string;
    opacity?: number;
  }>;
  direction?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

// Axes configuration
export interface AxesConfiguration {
  x: AxisConfiguration;
  y: AxisConfiguration;
  y2?: AxisConfiguration; // Secondary y-axis
}

export interface AxisConfiguration {
  show: boolean;
  title?: string;
  scale: 'linear' | 'log' | 'sqrt' | 'pow' | 'time' | 'ordinal' | 'band';
  domain?: [any, any];
  range?: [number, number];
  format?: string;
  tickCount?: number;
  tickSize?: number;
  tickValues?: any[];
  tickFormat?: string;
  customScale?: boolean;
  minValue?: number;
  maxValue?: number;
  sort?: 'none' | 'asc' | 'desc' | 'value_asc' | 'value_desc';
  grid: {
    show: boolean;
    color?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  };
  line: {
    show: boolean;
    color?: string;
    strokeWidth?: number;
  };
  labels: {
    show: boolean;
    rotation?: number;
    fontSize?: number;
    color?: string;
    padding?: number;
  };
}

// Legend configuration
export interface LegendConfiguration {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  orientation: 'horizontal' | 'vertical';
  padding: number;
  itemSpacing: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  interactive: boolean;
}

// Tooltip configuration
export interface TooltipConfiguration {
  show: boolean;
  format?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  fontSize?: number;
  fontFamily?: string;
  followCursor?: boolean;
  delay?: number;
  duration?: number;
  customTemplate?: string;
}

// Animation configuration
export interface AnimationConfiguration {
  enabled: boolean;
  duration: number;
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce' | 'elastic';
  delay?: number;
  stagger?: number;
  onEnter?: AnimationKeyframe[];
  onUpdate?: AnimationKeyframe[];
  onExit?: AnimationKeyframe[];
}

export interface AnimationKeyframe {
  property: string;
  value: any;
  duration?: number;
  easing?: string;
  delay?: number;
}

// Interaction configuration
export interface InteractionConfiguration {
  zoom: {
    enabled: boolean;
    type: 'wheel' | 'drag' | 'both';
    extent: [[number, number], [number, number]];
    scaleExtent: [number, number];
  };
  pan: {
    enabled: boolean;
    extent: [[number, number], [number, number]];
  };
  brush: {
    enabled: boolean;
    type: 'x' | 'y' | 'xy';
    extent: [[number, number], [number, number]];
  };
  selection: {
    enabled: boolean;
    mode: 'single' | 'multiple';
    highlightColor?: string;
  };
  hover: {
    enabled: boolean;
    highlightColor?: string;
    cursor?: string;
  };
  click: {
    enabled: boolean;
    action: 'select' | 'filter' | 'drill-down' | 'custom';
  };
  dataFilters: {
    hideNullValues: boolean;
    hideZeroValues: boolean;
  };
}

// Chart-specific configuration types

// Line chart configuration
export interface LineChartConfiguration {
  lines: LineConfiguration[];
  markers: MarkerConfiguration;
  areas: AreaConfiguration;
  interpolation: 'linear' | 'step' | 'basis' | 'cardinal' | 'monotone';
  tension: number;
  connectNulls: boolean;
}

export interface LineConfiguration {
  id: string;
  strokeWidth: number;
  strokeColor: string;
  strokeDasharray?: string;
  opacity: number;
  show: boolean;
}

export interface MarkerConfiguration {
  show: boolean;
  shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'star';
  size: number;
  strokeWidth: number;
  strokeColor: string;
  fillColor: string;
  opacity: number;
}

export interface AreaConfiguration {
  show: boolean;
  fillColor: string;
  fillOpacity: number;
  baseline: 'zero' | 'wiggle' | 'silhouette' | 'expand';
}

// Bar chart configuration
export interface BarChartConfiguration {
  bars: BarConfiguration;
  grouping: 'grouped' | 'stacked' | 'normalized';
  spacing: {
    group: number;
    bar: number;
  };
  cornerRadius: number;
  minBarWidth: number;
  maxBarWidth: number;
}

export interface BarConfiguration {
  strokeWidth: number;
  strokeColor: string;
  fillColor: string;
  opacity: number;
  gradient?: GradientConfiguration;
}

// Heatmap configuration
export interface HeatmapConfiguration {
  cells: CellConfiguration;
  colorScale: ColorScaleConfiguration;
  borders: BorderConfiguration;
  labels: CellLabelConfiguration;
  interpolation: 'nearest' | 'linear' | 'cubic';
}

export interface CellConfiguration {
  shape: 'rectangle' | 'circle' | 'hexagon';
  padding: number;
  borderRadius: number;
  minValue?: number;
  maxValue?: number;
}

export interface ColorScaleConfiguration {
  type: 'linear' | 'log' | 'sqrt' | 'pow' | 'quantile' | 'quantize';
  domain: [number, number];
  range: string[];
  interpolation: 'rgb' | 'hsl' | 'lab' | 'hcl';
  reverse: boolean;
  nullColor: string;
}

export interface CellLabelConfiguration {
  show: boolean;
  fontSize: number;
  fontFamily: string;
  color: string;
  format?: string;
  threshold?: number; // Only show labels for values above threshold
}

// Scatter plot configuration
export interface ScatterPlotConfiguration {
  points: PointConfiguration;
  regression: RegressionConfiguration;
  clusters: ClusterConfiguration;
  density: DensityConfiguration;
}

export interface PointConfiguration {
  shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'cross' | 'plus';
  size: number | string; // number or field name for size encoding
  sizeRange: [number, number];
  strokeWidth: number;
  strokeColor: string;
  fillColor: string;
  opacity: number;
  jitter: number;
}

export interface RegressionConfiguration {
  show: boolean;
  type: 'linear' | 'polynomial' | 'exponential' | 'logarithmic' | 'power';
  order?: number; // for polynomial regression
  confidence: boolean;
  confidenceLevel: number;
  lineColor: string;
  lineWidth: number;
  confidenceColor: string;
  confidenceOpacity: number;
}

export interface ClusterConfiguration {
  enabled: boolean;
  algorithm: 'kmeans' | 'hierarchical' | 'dbscan';
  k?: number; // number of clusters for k-means
  colors: string[];
  showCentroids: boolean;
  showHulls: boolean;
}

export interface DensityConfiguration {
  show: boolean;
  type: 'contour' | 'heatmap' | 'violin';
  bandwidth: number;
  levels: number;
  colors: string[];
  opacity: number;
}

// Growth progression chart (scientific)
export interface GrowthProgressionConfiguration {
  stages: GrowthStageConfiguration[];
  phases: PhaseConfiguration[];
  trajectories: TrajectoryConfiguration;
  annotations: AnnotationConfiguration[];
  comparison: ComparisonConfiguration;
}

export interface GrowthStageConfiguration {
  id: string;
  name: string;
  value: number;
  color: string;
  icon?: string;
  threshold?: number;
}

export interface PhaseConfiguration {
  id: string;
  name: string;
  type: 'control' | 'experimental';
  startDay: number;
  endDay: number;
  color: string;
  pattern?: string;
}

export interface TrajectoryConfiguration {
  smoothing: boolean;
  smoothingFactor: number;
  showVelocity: boolean;
  velocityColor: string;
  showAcceleration: boolean;
  accelerationColor: string;
}

export interface AnnotationConfiguration {
  id: string;
  type: 'line' | 'area' | 'point' | 'text';
  position: {
    x: number;
    y: number;
  };
  content: string;
  color: string;
  fontSize?: number;
  backgroundColor?: string;
}

export interface ComparisonConfiguration {
  enabled: boolean;
  baseline: 'control' | 'previous' | 'average' | 'custom';
  baselineValue?: number;
  showDifference: boolean;
  differenceColor: string;
  showPercentChange: boolean;
  percentChangeColor: string;
}

// Spatial effectiveness map (scientific)
export interface SpatialEffectivenessConfiguration {
  spatial: SpatialConfiguration;
  effectiveness: EffectivenessConfiguration;
  overlays: OverlayConfiguration[];
  zones: ZoneConfiguration[];
}

export interface SpatialConfiguration {
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  gridSize: number;
  interpolation: 'linear' | 'cubic' | 'nearest' | 'idw';
  coordinateSystem: 'cartesian' | 'polar';
}

export interface EffectivenessConfiguration {
  metric: 'growth_reduction' | 'efficacy_rate' | 'coverage_area' | 'custom';
  scale: 'linear' | 'log' | 'sqrt';
  colorScale: ColorScaleConfiguration;
  contourLevels: number;
  showContours: boolean;
  contourColor: string;
}

export interface OverlayConfiguration {
  id: string;
  type: 'points' | 'lines' | 'areas' | 'text';
  data: any[];
  style: any;
  interactive: boolean;
  zIndex: number;
}

export interface ZoneConfiguration {
  id: string;
  name: string;
  type: 'dead_zone' | 'high_efficacy' | 'low_efficacy' | 'custom';
  boundaries: Array<{x: number; y: number}>;
  color: string;
  opacity: number;
  pattern?: string;
  showLabel: boolean;
}

// Export configuration for visualizations
export interface VisualizationExportConfiguration {
  format: 'svg' | 'png' | 'pdf' | 'canvas';
  width: number;
  height: number;
  scale: number;
  quality: number;
  backgroundColor: string;
  includeStyles: boolean;
  includeInteractivity: boolean;
  filename?: string;
}

// Responsive configuration
export interface ResponsiveVisualizationConfiguration {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  adaptations: {
    mobile: Partial<VisualizationSettings>;
    tablet: Partial<VisualizationSettings>;
    desktop: Partial<VisualizationSettings>;
  };
  autoResize: boolean;
  maintainAspectRatio: boolean;
}

// Accessibility configuration
export interface AccessibilityConfiguration {
  enabled: boolean;
  colorBlindFriendly: boolean;
  highContrast: boolean;
  screenReader: {
    enabled: boolean;
    description: string;
    dataTable: boolean;
  };
  keyboard: {
    enabled: boolean;
    tabIndex: number;
    keyBindings: Record<string, string>;
  };
  alternativeText: string;
  ariaLabels: Record<string, string>;
}