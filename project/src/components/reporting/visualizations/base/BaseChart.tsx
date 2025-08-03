import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';
import { DataViewer } from '../DataViewer';

// Enhanced interfaces for multi-series support
interface SeriesData {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  data: any[];
  yScale?: d3.ScaleLinear<number, number>;
}

interface LegendItem {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

interface BaseChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  chartType: string;
  className?: string;
  onSeriesToggle?: (seriesId: string, visible: boolean) => void;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
  dimensions?: any[];
  onViewportChange?: (viewport: { scale: number; panX: number; panY: number }) => void;
  onSettingsChange?: (settings: Partial<VisualizationSettings>) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

// Helper function to detect if a field contains date data
function isDateField(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Check for common date patterns
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2}T/, // ISO 8601
    /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
    /^\d{1,2}\/\d{1,2}\/\d{2}/, // M/D/YY or MM/DD/YY
    /^\d{4}\/\d{2}\/\d{2}/, // YYYY/MM/DD
  ];
  
  return datePatterns.some(pattern => pattern.test(value)) && !isNaN(Date.parse(value));
}

// Helper function to format dates for display with smart notation
function formatDateForDisplay(date: Date, includeTime: boolean = false, hasMultiplePerDay: boolean = false): string {
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  
  if (includeTime || hasMultiplePerDay) {
    const hours = date.getHours();
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    return `${month} ${day}, ${displayHours}${period}`;
  }
  
  // Use shortest notation for dates (Jun 1, Jul 2, etc)
  return `${month} ${day}`;
}

// Helper function to format dimension values for tooltips
function formatDimensionValue(value: any, fieldName: string): string {
  if (!value) return 'N/A';
  
  // Check if it looks like a date
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(value);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  return String(value);
}

// Helper function to format measure values for tooltips
function formatMeasureValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  
  const num = parseFloat(value);
  if (isNaN(num)) return String(value);
  
  // Format based on magnitude
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  } else if (num % 1 === 0) {
    return num.toString();
  } else {
    return num.toFixed(2);
  }
}

// Helper function to format dimension names for display
function formatDimensionName(dimensionName: string): string {
  // Convert snake_case to Title Case and clean up common field names
  return dimensionName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace('Petri Code', 'Petri Dish')
    .replace('Gasifier Code', 'Gasifier Unit')
    .replace('Site Id', 'Site')
    .replace('Created At', 'Date')
    .replace('Submission Id', 'Submission');
}

// Helper function to get date range from data
function getDateRange(data: any[], dateField: string): string | null {
  const dates = data
    .map(d => d.dimensions?.[dateField] || d[dateField])
    .filter(d => d && isDateField(d))
    .map(d => new Date(d));
  
  if (dates.length === 0) return null;
  
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  // Format the date range
  const formatDate = (date: Date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = new Date().getFullYear();
    
    return year === currentYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
  };
  
  if (minDate.toDateString() === maxDate.toDateString()) {
    return formatDate(minDate);
  } else {
    return `${formatDate(minDate)} - ${formatDate(maxDate)}`;
  }
}

// Standard padding for all charts (margins are handled at container level)
const CHART_PADDING = 5;

// Enhanced color palettes for multi-series with accessibility in mind
const COLOR_PALETTES = {
  // Default colorblind-safe palette (based on Paul Tol's colors)
  category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
  tableau10: ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'],
  // Colorblind-safe palettes
  colorblindSafe: ['#0173B2', '#DE8F05', '#029E73', '#CC78BC', '#CA9161', '#FBAFE4', '#949494', '#ECE133', '#56B4E9'],
  accessible: ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#6A994E', '#BC4B51', '#386FA4', '#59A5D8', '#84D2F6'],
  // Scientific palettes
  viridis: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
  cividis: ['#00224e', '#123570', '#3b496c', '#575d6d', '#707173', '#8a8678', '#a59c74', '#c3b369', '#e1cc55', '#fee838'],
  // Monochromatic for professional reports
  blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
  set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd'],
  agricultural: ['#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9'],
  // Darker palette specifically for line charts - better visibility
  darkened: ['#0d5aa7', '#cc5500', '#1a8f1a', '#b51a1a', '#6633a3', '#5c3420', '#c339a0', '#4d4d4d', '#999900', '#0099b3']
};

// Helper function to resolve color palette from settings
function resolveColorPalette(palette: string | string[] | undefined, defaultPalette: string[] = COLOR_PALETTES.set3): string[] {
  if (typeof palette === 'string') {
    // If palette is a string, look it up in COLOR_PALETTES
    return COLOR_PALETTES[palette as keyof typeof COLOR_PALETTES] || defaultPalette;
  } else if (Array.isArray(palette)) {
    // If palette is already an array, use it directly
    return palette;
  } else {
    // Fallback to default
    return defaultPalette;
  }
}

// Generate series data from aggregated data
function generateSeriesData(data: any[], colorPalette: string[] = COLOR_PALETTES.set3, metadata?: any): SeriesData[] {
  if (!data.length) return [];
  
  const firstItem = data[0];
  const measureKeys = Object.keys(firstItem.measures || {});
  
  // Check if we have segment data (from reportingDataService)
  const hasSegments = firstItem.segments && Object.keys(firstItem.segments).length > 0;
  const segmentKeys = hasSegments ? Object.keys(firstItem.segments) : [];
  
  // Also check metadata.segments from the report config
  const segmentsFromMetadata = metadata?.segments || [];
  const configuredSegments = segmentsFromMetadata.length > 0 ? segmentsFromMetadata : 
                            segmentKeys.map(key => key.replace('segment_', ''));
  
  console.log('Generating series data with segments:', { 
    hasSegments, 
    segmentKeys, 
    configuredSegments,
    firstItem,
    metadata 
  });
  
  if (configuredSegments.length > 0) {
    // When we have segments, create one series per unique segment value
    const segmentField = configuredSegments[0]; // Use the first segment for now
    const segmentKey = `segment_${segmentField}`;
    
    // Group data by segment value
    const groupedData = new Map<string, any[]>();
    // Map to store display names for each segment value
    const segmentDisplayNames = new Map<string, string>();
    
    data.forEach(item => {
      // Get segment value from various possible locations
      const segmentValue = item.segments?.[segmentKey] || 
                          item[segmentField] ||
                          item.metadata?.[segmentKey] || 
                          'Unknown';
      
      // Get display name for segments
      let displayName = segmentValue;
      
      if (segmentField === 'program_id') {
        // Try to get program name from nested relationship data or segmentMetadata
        displayName = item.pilot_programs?.name ||
                     item.segmentMetadata?.program_id_name ||
                     item.metadata?.segment_program_name ||
                     `Program ${String(segmentValue).substring(0, 8)}`;
      } else if (segmentField === 'site_id') {
        displayName = item.sites?.name ||
                     item.segmentMetadata?.site_id_name ||
                     item.metadata?.segment_site_name ||
                     `Site ${String(segmentValue).substring(0, 8)}`;
      } else if (segmentField === 'submission_id') {
        const globalId = item.submissions?.global_submission_id ||
                        item.segmentMetadata?.submission_id_global;
        displayName = globalId ? `#${globalId}` : `Submission ${String(segmentValue).substring(0, 8)}`;
      }
      
      console.log('Processing segment for item:', {
        segmentField,
        segmentValue,
        displayName,
        item
      });
      
      if (!groupedData.has(segmentValue)) {
        groupedData.set(segmentValue, []);
        segmentDisplayNames.set(segmentValue, displayName);
      }
      groupedData.get(segmentValue)!.push(item);
    });
    
    // Create one series per segment value, for each measure
    const series: SeriesData[] = [];
    let colorIndex = 0;
    
    measureKeys.forEach(measureKey => {
      // Create a proper display name from the measure key
      let measureDisplayName = measureKey;
      if (measureKey.includes('_')) {
        const parts = measureKey.split('_');
        if (parts.length >= 2 && ['sum', 'avg', 'min', 'max', 'count'].includes(parts[parts.length - 1])) {
          const agg = parts.pop()!.toUpperCase();
          measureDisplayName = `${parts.join(' ').replace(/\b\w/g, l => l.toUpperCase())} (${agg})`;
        } else {
          measureDisplayName = measureKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
      }
      
      groupedData.forEach((segmentData, segmentValue) => {
        // Use display name instead of raw segment value
        const displayName = segmentDisplayNames.get(segmentValue) || segmentValue;
        
        // Only append segment value if it's not "Unknown"
        const seriesName = displayName === 'Unknown' || displayName === 'Unknown Site'
          ? measureDisplayName
          : measureKeys.length > 1 
            ? `${measureDisplayName} - ${displayName}`
            : displayName;
          
        series.push({
          id: `series_${measureKey}_${segmentValue}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
          name: seriesName,
          color: colorPalette[colorIndex % colorPalette.length],
          visible: true,
          data: segmentData.map(d => ({
            ...d,
            value: d.measures[measureKey]
          }))
        });
        colorIndex++;
      });
    });
    
    return series;
  } else {
    // No segments - create one series per measure as before
    return measureKeys.map((measureKey, index) => {
      // Try to get display name from metadata first
      let displayName = measureKey;
      
      if (metadata?.measures) {
        // Find the measure in metadata by matching the field name
        const measureMeta = metadata.measures.find((m: any) => {
          // The measureKey might include aggregation suffix like "flow_rate_avg"
          // So we need to check if the measure field is part of the key
          return measureKey.includes(m.field) || measureKey === m.name;
        });
        
        if (measureMeta?.displayName) {
          displayName = measureMeta.displayName;
          
          // If the measureKey includes aggregation, append it
          const parts = measureKey.split('_');
          if (parts.length >= 2 && ['sum', 'avg', 'min', 'max', 'count'].includes(parts[parts.length - 1])) {
            const agg = parts[parts.length - 1].toUpperCase();
            displayName = `${displayName} (${agg})`;
          }
        } else {
          // Fallback to auto-formatting
          if (measureKey.includes('_')) {
            // Handle cases like "growth_percentage_avg" -> "Growth Percentage (AVG)"
            const parts = measureKey.split('_');
            if (parts.length >= 2 && ['sum', 'avg', 'min', 'max', 'count'].includes(parts[parts.length - 1])) {
              const agg = parts.pop()!.toUpperCase();
              displayName = `${parts.join(' ').replace(/\b\w/g, l => l.toUpperCase())} (${agg})`;
            } else {
              displayName = measureKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
          }
        }
      } else {
        // Fallback to auto-formatting when no metadata
        if (measureKey.includes('_')) {
          // Handle cases like "growth_percentage_avg" -> "Growth Percentage (AVG)"
          const parts = measureKey.split('_');
          if (parts.length >= 2 && ['sum', 'avg', 'min', 'max', 'count'].includes(parts[parts.length - 1])) {
            const agg = parts.pop()!.toUpperCase();
            displayName = `${parts.join(' ').replace(/\b\w/g, l => l.toUpperCase())} (${agg})`;
          } else {
            displayName = measureKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }
        }
      }
      
      return {
        id: `series_${measureKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`, // Sanitize ID for CSS selectors
        name: displayName,
        color: colorPalette[index % colorPalette.length],
        visible: true,
        data: data.map(d => ({
          ...d,
          value: d.measures[measureKey]
        }))
      };
    });
  }
}

// Define fixed ranges for known metrics
const METRIC_FIXED_RANGES: Record<string, { min: number; max: number; label?: string }> = {
  // Petri observations
  'growth_index': { min: 0, max: 10.99, label: 'Growth Index (0-10.99)' },
  'growth_progression': { min: 0, max: 100, label: 'Growth Progression' }, // Assuming percentage
  'growth_aggression': { min: -1000, max: 100, label: 'Growth Aggression' },
  
  // Gasifier observations  
  'measure': { min: 0, max: 10, label: 'Measure (0-10)' },
  'linear_reduction_nominal': { min: 0, max: 6.0, label: 'Linear Reduction Nominal' },
  'linear_reduction_per_day': { min: 0, max: 6.09, label: 'Linear Reduction Per Day' },
  
  // Site/submission metrics
  'indoor_temperature': { min: 32, max: 120, label: 'Temperature (°F)' },
  'temperature': { min: 32, max: 120, label: 'Temperature (°F)' },
  'indoor_humidity': { min: 1, max: 100, label: 'Humidity (%)' },
  'humidity': { min: 1, max: 100, label: 'Humidity (%)' },
  'percentage_complete': { min: 0, max: 100, label: 'Percentage Complete' },
  
  // Location metrics
  'latitude': { min: -90, max: 90, label: 'Latitude' },
  'longitude': { min: -180, max: 180, label: 'Longitude' },
  
  // Common percentage fields (assuming 0-100 for standard percentages)
  'growth_suppression_rate': { min: 0, max: 100, label: 'Growth Suppression Rate (%)' },
  'treatment_efficiency': { min: 0, max: 100, label: 'Treatment Efficiency (%)' },
  'effectiveness_percentage': { min: 0, max: 100, label: 'Effectiveness (%)' },
  'reduction_percentage': { min: 0, max: 100, label: 'Reduction (%)' }
};

// Smart Y-axis scaling for multiple series
function calculateYDomain(
  seriesData: SeriesData[], 
  visibleOnly: boolean = true, 
  measureName?: string, 
  customMin?: number, 
  customMax?: number,
  autoScale?: boolean,
  includeZero?: boolean
): [number, number] {
  const visibleSeries = visibleOnly ? seriesData.filter(s => s.visible) : seriesData;
  
  if (visibleSeries.length === 0) return [0, 100];
  
  // If custom min/max are provided, use them
  if (customMin !== undefined && customMax !== undefined) {
    return [customMin, customMax];
  }
  
  // If autoScale is explicitly false and we have a measure name, check for fixed ranges
  if (!autoScale && measureName) {
    const normalizedMetric = measureName.toLowerCase();
    
    // Check exact match first
    if (METRIC_FIXED_RANGES[normalizedMetric]) {
      return [METRIC_FIXED_RANGES[normalizedMetric].min, METRIC_FIXED_RANGES[normalizedMetric].max];
    }
    
    // Check for partial matches
    for (const [key, range] of Object.entries(METRIC_FIXED_RANGES)) {
      if (normalizedMetric.includes(key) || 
          (key.includes('percentage') && normalizedMetric.endsWith('_percentage')) ||
          (key.includes('percentage') && normalizedMetric.endsWith('_percent')) ||
          (key.includes('rate') && normalizedMetric.endsWith('_rate'))) {
        return [range.min, range.max];
      }
    }
  }
  
  // Only use fixed ranges when autoScale is explicitly false
  if (autoScale === false) {
    // Check if all series have the same name (common case for single measure)
    const uniqueNames = [...new Set(visibleSeries.map(s => s.name))];
    if (uniqueNames.length === 1) {
      const metricName = uniqueNames[0];
      const normalizedMetric = metricName.toLowerCase();
      
      // Check exact match first
      if (METRIC_FIXED_RANGES[normalizedMetric]) {
        return [METRIC_FIXED_RANGES[normalizedMetric].min, METRIC_FIXED_RANGES[normalizedMetric].max];
      }
      
      // Check for partial matches
      for (const [key, range] of Object.entries(METRIC_FIXED_RANGES)) {
        if (normalizedMetric.includes(key) || 
            (key.includes('percentage') && normalizedMetric.endsWith('_percentage')) ||
            (key.includes('percentage') && normalizedMetric.endsWith('_percent')) ||
            (key.includes('rate') && normalizedMetric.endsWith('_rate'))) {
          return [range.min, range.max];
        }
      }
    }
  }
  
  // Fall back to dynamic calculation
  const allValues = visibleSeries.flatMap(series => 
    series.data.map(d => d.value).filter(v => v != null && !isNaN(v))
  );
  
  if (allValues.length === 0) return [0, 100];
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const padding = (max - min) * 0.1; // 10% padding
  
  // Determine if we should include zero
  let shouldIncludeZero = includeZero;
  if (shouldIncludeZero === undefined) {
    // Default behavior: include zero only if data crosses it or if not auto-scaling
    shouldIncludeZero = autoScale === false || (min < 0 && max > 0);
  }
  
  // Calculate domain based on settings
  let minDomain: number;
  let maxDomain: number;
  
  if (autoScale !== false) {
    // Auto-scale to fit data
    minDomain = min - padding;
    maxDomain = max + padding;
    
    // Include zero if requested
    if (shouldIncludeZero) {
      minDomain = Math.min(0, minDomain);
      maxDomain = Math.max(0, maxDomain);
    }
  } else {
    // Traditional scaling (start from 0 for positive data)
    minDomain = shouldIncludeZero || min >= 0 ? 0 : min - padding;
    maxDomain = max + padding;
  }
  
  // Apply custom min/max if provided
  const finalMin = customMin !== undefined ? customMin : minDomain;
  const finalMax = customMax !== undefined ? customMax : maxDomain;
  
  return [finalMin, finalMax];
}

export const BaseChart: React.FC<BaseChartProps> = ({
  data,
  settings,
  chartType,
  className = '',
  onSeriesToggle,
  onDataSelect,
  dimensions: dimensionConfigs,
  onViewportChange,
  onSettingsChange,
  onContextMenu
}) => {
  console.log('BaseChart rendering with settings:', {
    chartType,
    settings,
    colorPalette: settings?.colors?.palette,
    hasColors: !!settings?.colors,
    className
  });
  
  // Extract the actual values we need with defaults
  // For dashboard widgets, use the provided dimensions directly
  const isDashboardWidget = className?.includes('dashboard-widget-chart');
  const dimensions = settings?.dimensions || { width: 800, height: 400 };
  const margins = settings?.margins || settings?.dimensions?.margin || { top: 50, right: 120, bottom: 60, left: 65 };
  const colors = settings?.colors?.palette || ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
  const showLegend = settings?.legends?.show !== false;
  const showGrid = settings?.axes?.y?.gridLines !== false;
  const showTooltips = settings?.tooltips?.show !== false;
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [seriesData, setSeriesData] = useState<SeriesData[]>([]);
  const [legendItems, setLegendItems] = useState<LegendItem[]>([]);
  const [showZeroValues, setShowZeroValues] = useState(false);
  const [hasPositiveAndNegative, setHasPositiveAndNegative] = useState(false);
  
  // Pan and zoom state - start from saved viewport or calculate based on container size
  const savedViewport = settings.viewport;
  
  // Calculate initial scale based on container width and context
  // For small containers (dashboards), zoom out more to fit content
  const calculateInitialScale = () => {
    if (savedViewport?.scale && !savedViewport?.autoFit) return savedViewport.scale;
    
    // Check if we're in dashboard mode
    const isDashboardWidget = className?.includes('dashboard-widget-chart');
    
    // Dashboard widgets should start more zoomed out to show all data
    if (isDashboardWidget) {
      if (dimensions.width < 300) {
        return 0.4; // 40% for tiny dashboard widgets
      } else if (dimensions.width < 500) {
        return 0.5; // 50% for small dashboard widgets
      } else {
        return 0.6; // 60% for larger dashboard widgets
      }
    }
    
    // Regular charts
    if (dimensions.width < 400) {
      return 0.5; // 50% for very small widgets
    } else if (dimensions.width < 600) {
      return 0.6; // 60% for medium widgets
    } else if (dimensions.width < 800) {
      return 0.7; // 70% for larger widgets
    }
    return 0.8; // 80% for full-size charts
  };
  
  const initialScale = calculateInitialScale();
  const [scale, setScale] = useState(initialScale);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Calculate svgHeight here so it's available for fitToData
  const titleSpace = chartType === 'heatmap' ? 0 : 0;
  const baseHeight = (hasPositiveAndNegative && ['line', 'area', 'bar'].includes(chartType)) 
    ? dimensions.height * 1.5 
    : dimensions.height;
  const svgHeight = baseHeight + titleSpace;
  
  // Function to fit chart to container
  const fitToData = useCallback(() => {
    if (!data || dimensions.width <= 0 || svgHeight <= 0) return;
    
    const isDashboardWidget = className?.includes('dashboard-widget-chart');
    
    // For dashboard widgets, use container dimensions as the target
    // For regular charts, use the SVG dimensions
    const containerWidth = dimensions.width;
    const containerHeight = dimensions.height;
    
    // The chart's natural size
    const chartWidth = settings?.dimensions?.width || dimensions.width;
    const chartHeight = settings?.dimensions?.height || svgHeight;
    
    // Add padding to ensure nothing is clipped
    const padding = isDashboardWidget ? 15 : 25;
    const targetWidth = containerWidth - padding * 2;
    const targetHeight = containerHeight - padding * 2;
    
    // Calculate scale to fit the chart in the container
    const scaleX = targetWidth / chartWidth;
    const scaleY = targetHeight / chartHeight;
    
    // Use the smaller scale to ensure everything fits
    let optimalScale = Math.min(scaleX, scaleY);
    
    // Apply a safety factor to ensure all elements are visible
    optimalScale = optimalScale * 0.95;
    
    // Set bounds - don't over-scale or under-scale
    const minScale = 0.3;
    const maxScale = 1.2;
    optimalScale = Math.min(maxScale, Math.max(minScale, optimalScale));
    
    console.log('Fit to data:', {
      container: { width: containerWidth, height: containerHeight },
      chart: { width: chartWidth, height: chartHeight },
      target: { width: targetWidth, height: targetHeight },
      scales: { x: scaleX, y: scaleY, optimal: optimalScale }
    });
    
    setScale(optimalScale);
    
    // Position the scaled content
    const scaledWidth = chartWidth * optimalScale;
    const scaledHeight = chartHeight * optimalScale;
    
    // Align to left with small padding, center vertically
    const offsetX = padding;
    const offsetY = (containerHeight - scaledHeight) / 2;
    
    setPanOffset({ 
      x: Math.max(0, offsetX), 
      y: Math.max(0, offsetY) 
    });
  }, [data, dimensions.width, dimensions.height, svgHeight, className, settings]);
  
  // Debug logging for pan/zoom state changes and notify parent
  useEffect(() => {
    console.log('Pan/Zoom state changed:', { panOffset, scale });
    
    // Notify parent about viewport changes (with percentage-based pan)
    if (onViewportChange && dimensions.width > 0 && dimensions.height > 0) {
      const timeoutId = setTimeout(() => {
        onViewportChange({
          scale,
          panX: panOffset.x / dimensions.width, // Convert to percentage
          panY: panOffset.y / dimensions.height  // Convert to percentage
        });
      }, 500); // Debounce to avoid too many updates
      
      return () => clearTimeout(timeoutId);
    }
  }, [panOffset, scale, onViewportChange, dimensions.width, dimensions.height]);
  
  // Set initial position from saved viewport or calculate centered position
  useEffect(() => {
    console.log('BaseChart viewport initialization:', {
      hasSavedViewport: !!savedViewport,
      savedViewport,
      dimensions: { width: dimensions.width, height: dimensions.height },
      className
    });
    
    if (dimensions.width > 0 && dimensions.height > 0) {
      if (savedViewport && savedViewport.panX !== undefined && savedViewport.panY !== undefined && savedViewport.scale !== undefined) {
        // Restore saved position as percentage of container size
        const offsetX = dimensions.width * savedViewport.panX;
        const offsetY = dimensions.height * savedViewport.panY;
        console.log('Restoring saved viewport:', {
          scale: savedViewport.scale,
          panX: savedViewport.panX,
          panY: savedViewport.panY,
          offsetX,
          offsetY,
          autoFit: savedViewport.autoFit
        });
        setPanOffset({ x: offsetX, y: offsetY });
        setScale(savedViewport.scale);
        
        // If autoFit is explicitly true, still fit to data after restoring position
        if (savedViewport.autoFit === true && data) {
          setTimeout(() => {
            console.log('Auto-fitting chart (autoFit=true in saved viewport)');
            fitToData();
          }, 500);
        }
      } else if (data) {
        // No saved viewport, so auto-fit on initial load
        setTimeout(() => {
          console.log('Auto-fitting chart on initial load (no saved viewport):', { 
            width: dimensions.width,
            height: dimensions.height,
            hasData: !!data,
            className 
          });
          fitToData();
        }, 500); // Delay to ensure SVG is fully rendered
      }
    }
  }, [dimensions.width, dimensions.height]); // Only depend on dimension changes, not data
  
  // Auto-fit when data changes ONLY if user hasn't saved a specific viewport
  useEffect(() => {
    // Only auto-fit if:
    // 1. We have data and valid dimensions
    // 2. AND either no saved viewport exists OR autoFit is explicitly true
    if (data && dimensions.width > 0 && dimensions.height > 0) {
      const shouldAutoFit = !savedViewport || savedViewport.autoFit === true;
      
      if (shouldAutoFit) {
        // Small delay to ensure chart has re-rendered with new data
        const timeoutId = setTimeout(() => {
          console.log('Auto-fitting chart after data change (autoFit enabled)');
          fitToData();
        }, 300);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [data, savedViewport?.autoFit]); // Depend on data and autoFit setting
  
  // Handle wheel events with passive: false to allow preventDefault
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      console.log('Wheel event:', {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey
      });
      
      // Check if it's a pinch zoom gesture (ctrl key or cmd key on Mac)
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomSpeed = 0.01;
        const newScale = Math.max(0.5, Math.min(3, scale - e.deltaY * zoomSpeed));
        
        // Calculate zoom center point relative to container
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Adjust pan to keep zoom centered on cursor (with top-left origin)
        const scaleDiff = newScale / scale;
        const newPanX = x - (x - panOffset.x) * scaleDiff;
        const newPanY = y - (y - panOffset.y) * scaleDiff;
        
        setScale(newScale);
        setPanOffset({ x: newPanX, y: newPanY });
      } else {
        // Pan (normal scroll or two-finger swipe on touchpad)
        const panSpeed = 1;
        setPanOffset({
          x: panOffset.x - e.deltaX * panSpeed,
          y: panOffset.y - e.deltaY * panSpeed
        });
      }
    };
    
    // Add event listener with passive: false
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [scale, panOffset]);
  const [showNavigationHint, setShowNavigationHint] = useState(false);
  const navigationHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // DataViewer state
  const [dataViewer, setDataViewer] = useState<{
    isVisible: boolean;
    data: any[];
    position: { x: number; y: number };
    title: string;
  }>({
    isVisible: false,
    data: [],
    position: { x: 0, y: 0 },
    title: ''
  });

  // Cleanup navigation hint timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationHintTimeoutRef.current) {
        clearTimeout(navigationHintTimeoutRef.current);
      }
    };
  }, []);

  // Brush state
  const [brushSelection, setBrushSelection] = useState<[[number, number], [number, number]] | null>(null);

  // Helper function to get data points at a specific position
  const getDataPointsAtPosition = useCallback((x: number, y: number, tolerance: number = 20) => {
    if (!data?.data?.length) return [];
    
    return data.data.filter(point => {
      // For line charts, we need to check against the scaled position
      // This is a simplified version - in practice, you'd need the actual scales
      return Math.abs(point.x - x) <= tolerance && Math.abs(point.y - y) <= tolerance;
    });
  }, [data]);

  // Helper function to get data points in a brush selection
  const getDataPointsInBrush = useCallback((selection: [[number, number], [number, number]]) => {
    if (!data?.data?.length) return [];
    
    const [[x0, y0], [x1, y1]] = selection;
    
    return data.data.filter(point => {
      // This needs to be implemented based on your actual data structure
      // For now, returning all data as placeholder
      return true;
    });
  }, [data]);

  // Handle opening DataViewer
  const openDataViewer = useCallback((points: any[], position: { x: number; y: number }, title: string) => {
    if (onDataSelect) {
      // Use external callback if provided (from PreviewPanel)
      onDataSelect(points, position, title);
    } else {
      // Fallback to internal modal
      setDataViewer({
        isVisible: true,
        data: points,
        position: { x: position.x, y: position.y },
        title
      });
    }
  }, [onDataSelect]);

  // Handle closing DataViewer
  const closeDataViewer = useCallback(() => {
    setDataViewer(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Generate series data when data changes
  useEffect(() => {
    if (!data?.data?.length) {
      setSeriesData([]);
      setLegendItems([]);
      return;
    }
    

    // Filter data based on settings
    let filteredData = data.data;
    
    // Apply null/zero value filters if specified
    if (settings.interactions?.dataFilters?.hideNullValues) {
      filteredData = filteredData.filter(item => {
        return Object.values(item.measures).some(value => 
          value !== null && value !== undefined && value !== '' && value !== '-'
        );
      });
    }
    
    if (settings.interactions?.dataFilters?.hideZeroValues) {
      filteredData = filteredData.filter(item => {
        return Object.values(item.measures).some(value => {
          const numValue = parseFloat(value);
          return !isNaN(numValue) && numValue !== 0;
        });
      });
    }

    // Apply aggregation based on measure configuration
    const aggregatedData = aggregateData(filteredData, data.metadata);
    
    // Use the color palette from settings or default based on chart type
    const defaultPalette = chartType === 'line' ? COLOR_PALETTES.darkened : COLOR_PALETTES.set3;
    const colorPalette = resolveColorPalette(settings.colors?.palette, defaultPalette);
    
    console.log('Color palette debug:', {
      settingsPalette: settings.colors?.palette,
      resolvedPalette: colorPalette,
      chartType
    });
    
    const newSeriesData = generateSeriesData(aggregatedData, colorPalette, data.metadata);
    setSeriesData(newSeriesData);
    
    // Check if data contains both positive and negative values
    const allValues = newSeriesData.flatMap(series => 
      series.data.map(d => d.value).filter(v => v != null && !isNaN(v))
    );
    
    if (allValues.length > 0) {
      const hasPos = allValues.some(v => v > 0);
      const hasNeg = allValues.some(v => v < 0);
      setHasPositiveAndNegative(hasPos && hasNeg);
    }
    
    const newLegendItems: LegendItem[] = newSeriesData.map(series => ({
      id: series.id,
      name: series.name,
      color: series.color,
      visible: series.visible
    }));
    setLegendItems(newLegendItems);
  }, [data, settings]);


  // Handle series visibility toggle
  const handleSeriesToggle = useCallback((seriesId: string) => {
    setSeriesData(prev => prev.map(series => 
      series.id === seriesId 
        ? { ...series, visible: !series.visible }
        : series
    ));
    
    setLegendItems(prev => prev.map(item => 
      item.id === seriesId 
        ? { ...item, visible: !item.visible }
        : item
    ));
    
    onSeriesToggle?.(seriesId, !seriesData.find(s => s.id === seriesId)?.visible);
  }, [seriesData, onSeriesToggle]);

  function renderHeatmap(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any, metadata?: any, svg?: any, dimensionConfigs?: any[]) {
    if (!data.length) return;

    // For heatmap, we need at least 2 dimensions and 1 measure
    const dimKeys = Object.keys(data[0].dimensions);
    const measureKeys = Object.keys(data[0].measures);
    
    if (dimKeys.length < 2 || measureKeys.length < 1) {
      console.warn('Heatmap requires at least 2 dimensions and 1 measure');
      return;
    }

    const xDim = dimKeys[0];
    const yDim = dimKeys[1];
    const measure = measureKeys[0];
    
    // Get measure display name from metadata
    let measureDisplayName = measure;
    if (metadata?.measures) {
      const measureMeta = metadata.measures.find((m: any) => 
        measure.includes(m.field) || measure === m.name
      );
      if (measureMeta?.displayName) {
        measureDisplayName = measureMeta.displayName;
      }
    }
    
    // Get dimension display names
    let xDimDisplayName = xDim;
    let yDimDisplayName = yDim;
    
    // Try to get display names from dimensionConfigs first, then metadata
    if (dimensionConfigs) {
      const xConfig = dimensionConfigs.find(d => d.field === xDim || d.name === xDim);
      const yConfig = dimensionConfigs.find(d => d.field === yDim || d.name === yDim);
      if (xConfig?.displayName) xDimDisplayName = xConfig.displayName;
      if (yConfig?.displayName) yDimDisplayName = yConfig.displayName;
    } else if (metadata?.dimensions) {
      const xMeta = metadata.dimensions.find((d: any) => d.field === xDim || d.name === xDim);
      const yMeta = metadata.dimensions.find((d: any) => d.field === yDim || d.name === yDim);
      if (xMeta?.displayName) xDimDisplayName = xMeta.displayName;
      if (yMeta?.displayName) yDimDisplayName = yMeta.displayName;
    }

    // Get unique values for each dimension
    let xValues = [...new Set(data.map(d => d.dimensions[xDim]))];
    let yValues = [...new Set(data.map(d => d.dimensions[yDim]))];
    
    // Apply sorting based on settings
    const xSort = settings?.axes?.x?.sort || 'none';
    const ySort = settings?.axes?.y?.sort || 'none';
    
    // Helper function to sort values
    const sortValues = (values: any[], dimension: string, sortType: string) => {
      if (sortType === 'none') return values;
      
      // Check if values are dates
      const isDate = values.every(v => {
        const parsed = new Date(v);
        return !isNaN(parsed.getTime()) && v.toString().includes('-');
      });
      
      if (sortType === 'asc') {
        if (isDate) {
          return values.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        }
        return values.sort((a, b) => {
          if (typeof a === 'string' && typeof b === 'string') {
            return a.localeCompare(b);
          }
          return a - b;
        });
      } else if (sortType === 'desc') {
        if (isDate) {
          return values.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        }
        return values.sort((a, b) => {
          if (typeof a === 'string' && typeof b === 'string') {
            return b.localeCompare(a);
          }
          return b - a;
        });
      } else if (sortType === 'value_asc' || sortType === 'value_desc') {
        // Sort by aggregated measure values
        const valueMap = new Map();
        values.forEach(val => {
          const sum = data
            .filter(d => d.dimensions[dimension] === val)
            .reduce((acc, d) => acc + (+d.measures[measure] || 0), 0);
          valueMap.set(val, sum);
        });
        
        return values.sort((a, b) => {
          const valA = valueMap.get(a) || 0;
          const valB = valueMap.get(b) || 0;
          return sortType === 'value_asc' ? valA - valB : valB - valA;
        });
      }
      
      return values;
    };
    
    // Apply sorting
    xValues = sortValues(xValues, xDim, xSort);
    yValues = sortValues(yValues, yDim, ySort);
    
    // Calculate dynamic margins based on content
    const longestYLabel = Math.max(...yValues.map(v => String(v).length)) * 7; // Approximate char width
    const marginLeft = Math.max(60, Math.min(100, longestYLabel + 20)); // Increased spacing between Y-axis labels and chart
    const marginBottom = 70; // For rotated date labels
    const marginTop = 60; // Increased to accommodate title and subtitle without overlap
    const marginRight = 140; // Increased space for color legend to prevent overflow
    
    const adjustedWidth = width - marginLeft - marginRight;
    const adjustedHeight = height - marginTop - marginBottom;

    // Format dates if x-axis contains dates
    const isXDate = xValues.length > 0 && isDateField(xValues[0]);
    if (isXDate) {
      // Sort dates chronologically
      xValues = xValues.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    }
    
    // Create a group with proper positioning
    const heatmapG = g.append('g')
      .attr('transform', `translate(${marginLeft}, ${marginTop})`);

    // Create scales with adjusted dimensions
    const heatmapPadding = 40; // Add padding to prevent edge cutoff
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([heatmapPadding, adjustedWidth - heatmapPadding])
      .padding(0.1); // Increased padding for better cell separation

    const yScale = d3.scaleBand()
      .domain(yValues)
      .range([adjustedHeight, 0])
      .padding(0.1); // Increased padding for better cell separation

    // Create color scale for the heatmap with colorblind-safe gradient
    const extent = d3.extent(data, d => +d.measures[measure]) as [number, number];
    
    // Use viridis-like colorblind-safe interpolator
    const colorScale = d3.scaleSequential()
      .domain(extent)
      .interpolator((t) => {
        // Enhanced gradient with orange-red at the top
        if (t < 0.2) {
          // Dark blue to blue
          return d3.interpolateRgb("#440154", "#31688e")(t * 5);
        } else if (t < 0.4) {
          // Blue to teal
          return d3.interpolateRgb("#31688e", "#21908c")((t - 0.2) * 5);
        } else if (t < 0.6) {
          // Teal to green
          return d3.interpolateRgb("#21908c", "#5dc863")((t - 0.4) * 5);
        } else if (t < 0.8) {
          // Green to yellow
          return d3.interpolateRgb("#5dc863", "#fde725")((t - 0.6) * 5);
        } else if (t < 0.9) {
          // Yellow to orange
          return d3.interpolateRgb("#fde725", "#ff7f00")((t - 0.8) * 10);
        } else {
          // Orange to red
          return d3.interpolateRgb("#ff7f00", "#d62728")((t - 0.9) * 10);
        }
      });

    // Calculate optimal label density
    const labelWidth = 60; // Approximate width per label
    const availableWidth = adjustedWidth;
    const totalXLabels = xValues.length;
    const labelsPerRow = Math.floor(availableWidth / labelWidth);
    const skipInterval = Math.max(1, Math.ceil(totalXLabels / labelsPerRow));
    
    // Add axes with dynamic label skipping
    const xAxis = heatmapG.append('g')
      .attr('transform', `translate(0,${adjustedHeight})`)
      .call(d3.axisBottom(xScale)
        .tickValues(xValues.filter((_, i) => i % skipInterval === 0)));

    // Format x-axis labels with better readability
    xAxis.selectAll('text')
      .text((d: any) => {
        if (isXDate && isDateField(d)) {
          const date = new Date(d);
          // Check if we have multiple data points per day
          const datesOnSameDay = data.filter(item => {
            const itemDate = new Date(item.dimensions[xDim]);
            return itemDate.toDateString() === date.toDateString();
          }).length;
          return formatDateForDisplay(date, false, datesOnSameDay > 1);
        }
        // Clean up petri/gasifier codes for better readability
        const text = String(d);
        if (text.includes('_')) {
          // Convert "S1_1_Right" to "S1-1-R" or similar
          return text.replace(/_/g, '-').replace('Right', 'R').replace('Left', 'L').replace('Center', 'C');
        }
        return text;
      })
      .attr('transform', 'rotate(-45)') // Better angle for readability
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .style('font-size', '11px') // Slightly larger for better readability
      .append('title') // Add tooltips showing full values
      .text((d: any) => String(d));

    const yAxis = heatmapG.append('g')
      .call(d3.axisLeft(yScale));
    
    // Calculate how many labels we can comfortably fit
    const labelHeight = 12; // Approximate height of a label in pixels
    const minLabelSpacing = 5; // Minimum spacing between labels
    const availableHeightForYLabels = adjustedHeight;
    const totalYLabels = yValues.length;
    const spacePerLabel = availableHeightForYLabels / totalYLabels;
    
    // Determine skip factor based on available space
    let skipFactor = 1;
    if (spacePerLabel < labelHeight + minLabelSpacing) {
      // Not enough space for all labels
      skipFactor = Math.ceil((labelHeight + minLabelSpacing) / spacePerLabel);
    }
    
    // Improve Y-axis label readability
    yAxis.selectAll('text')
      .style('font-size', '10px')
      .text((d: any, i: number) => {
        // Skip labels based on calculated factor
        if (i % skipFactor !== 0) {
          return ''; // Hide this label
        }
        
        // Format Y-axis labels for better readability
        const rawValue = String(d);
        
        // Create a map of raw values to display names for Y dimension
        const yValueDisplayMap = new Map();
        if (dimensionConfigs || metadata?.dimensions) {
          // Find the Y dimension config
          const yConfig = dimensionConfigs?.find(dc => dc.field === yDim || dc.name === yDim) ||
                         metadata?.dimensions?.find((dm: any) => dm.field === yDim || dm.name === yDim);
          
          // If we have options with display names, create the mapping
          if (yConfig?.options) {
            yConfig.options.forEach((opt: any) => {
              yValueDisplayMap.set(opt.value, opt.label || opt.displayName || opt.value);
            });
          }
        }
        
        // Use display name if available
        const text = yValueDisplayMap.get(rawValue) || rawValue;
        
        // Check if this is a date/timestamp
        if (isDateField(text)) {
          const date = new Date(text);
          // Format as "Jan 15" or "Jan 15, '24" depending on year
          const month = date.toLocaleDateString('en-US', { month: 'short' });
          const day = date.getDate();
          const year = date.getFullYear();
          const currentYear = new Date().getFullYear();
          
          // If it's the current year, don't show year
          if (year === currentYear) {
            return `${month} ${day}`;
          } else {
            // Show shortened year for past/future years
            const shortYear = year.toString().slice(-2);
            return `${month} ${day}, '${shortYear}`;
          }
        }
        
        // For non-date long text, truncate
        if (text.length > 20) {
          return text.length > 25 ? `${text.substring(0, 8)}...${text.substring(text.length - 8)}` : text.substring(0, 20) + '...';
        }
        
        return text;
      })
      .style('opacity', (d: any, i: number) => {
        // Make skipped labels invisible but keep tick marks
        return i % skipFactor === 0 ? 1 : 0;
      });
    
    // Add tick marks for all values (even skipped labels)
    yAxis.selectAll('.tick line')
      .style('opacity', (d: any, i: number) => {
        // Show stronger tick marks for labeled values
        return i % skipFactor === 0 ? 1 : 0.3;
      });
    
    // Add tooltips to Y-axis labels showing full values
    yAxis.selectAll('text')
      .append('title')
      .text((d: any) => {
        const rawValue = String(d);
        
        // Create a map of raw values to display names for Y dimension
        const yValueDisplayMap = new Map();
        if (dimensionConfigs || metadata?.dimensions) {
          // Find the Y dimension config
          const yConfig = dimensionConfigs?.find(dc => dc.field === yDim || dc.name === yDim) ||
                         metadata?.dimensions?.find((dm: any) => dm.field === yDim || dm.name === yDim);
          
          // If we have options with display names, create the mapping
          if (yConfig?.options) {
            yConfig.options.forEach((opt: any) => {
              yValueDisplayMap.set(opt.value, opt.label || opt.displayName || opt.value);
            });
          }
        }
        
        // Use display name if available
        return yValueDisplayMap.get(rawValue) || rawValue;
      });

    // Add grid lines for better readability
    heatmapG.selectAll('.grid-line-x')
      .data(xValues)
      .enter()
      .append('line')
      .attr('class', 'grid-line-x')
      .attr('x1', (d: any) => (xScale(d) || 0) + xScale.bandwidth() / 2)
      .attr('x2', (d: any) => (xScale(d) || 0) + xScale.bandwidth() / 2)
      .attr('y1', 0)
      .attr('y2', adjustedHeight)
      .style('stroke', '#e0e0e0')
      .style('stroke-width', 0.5)
      .style('stroke-dasharray', '2,2');

    heatmapG.selectAll('.grid-line-y')
      .data(yValues)
      .enter()
      .append('line')
      .attr('class', 'grid-line-y')
      .attr('x1', 0)
      .attr('x2', adjustedWidth)
      .attr('y1', (d: any) => (yScale(d) || 0) + yScale.bandwidth() / 2)
      .attr('y2', (d: any) => (yScale(d) || 0) + yScale.bandwidth() / 2)
      .style('stroke', '#e0e0e0')
      .style('stroke-width', 0.5)
      .style('stroke-dasharray', '2,2');

    // Add chart title with data context
    const dateRange = getDateRange(data, yDim);
    const dataCount = data.length;
    const titleText = `${measureDisplayName} by ${formatDimensionName(xDim)} and ${formatDimensionName(yDim)}`;
    const subtitleText = dateRange ? `${dateRange} • ${dataCount} observations` : `${dataCount} observations`;
    
    g.append('text')
      .attr('x', width / 2)
      .attr('y', -marginTop + 15) // Closer to top edge
      .style('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', '600')
      .style('fill', '#111827')
      .text(titleText);
    
    g.append('text')
      .attr('x', width / 2)
      .attr('y', -marginTop + 35) // Positioned below title
      .style('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', '400')
      .style('fill', '#6b7280')
      .text(subtitleText);

    // Add axis labels with better formatting
    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height - 5})`)
      .style('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', '500')
      .style('fill', '#555')
      .text(formatDimensionName(xDim));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 15)
      .attr('x', -(height / 2))
      .style('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', '500')
      .style('fill', '#555')
      .text(formatDimensionName(yDim));

    // Create cell groups (rect + text)
    const cellGroups = heatmapG.selectAll('.cell-group')
      .data(data)
      .enter().append('g')
      .attr('class', 'cell-group');

    // Create cells
    const cells = cellGroups.append('rect')
      .attr('class', 'cell')
      .attr('x', (d: any) => xScale(d.dimensions[xDim]) || 0)
      .attr('y', (d: any) => yScale(d.dimensions[yDim]) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d: any) => colorScale(+d.measures[measure]))
      .style('cursor', 'pointer')
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .style('opacity', 1);

    // Calculate appropriate font size based on cell size
    const cellWidth = xScale.bandwidth();
    const cellHeight = yScale.bandwidth();
    const fontSize = Math.min(cellWidth / 4, cellHeight / 3, 12);
    
    // Add value labels to cells
    cellGroups.append('text')
      .attr('class', 'cell-label')
      .attr('x', (d: any) => (xScale(d.dimensions[xDim]) || 0) + xScale.bandwidth() / 2)
      .attr('y', (d: any) => (yScale(d.dimensions[yDim]) || 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', `${fontSize}px`)
      .style('font-weight', 'bold')
      .style('fill', '#fff')  // Use white text for all cells for consistency
      .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')  // Add shadow for better readability
      .style('pointer-events', 'none')
      .text((d: any) => {
        const value = +d.measures[measure];
        return isNaN(value) ? '' : formatMeasureValue(value);
      });

    // Enhanced hover and click interactions
    if (callbacks) {
      cells
        .on('mouseover', function(event, d) {
          d3.select(this)
            .style('stroke', '#000')
            .style('stroke-width', 2);
          
          if (callbacks.onHover && showTooltips) {
            const rect = this.getBoundingClientRect();
            const position = {
              x: rect.left + rect.width / 2,
              y: rect.top
            };
            const formattedValue = formatMeasureValue(d.measures[measure]);
            const tooltipText = `${formatDimensionName(xDim)}: ${d.dimensions[xDim]}\n${formatDimensionName(yDim)}: ${d.dimensions[yDim]}\n${measureDisplayName}: ${formattedValue}`;
            callbacks.onHover([d], position, tooltipText);
          }
        })
        .on('mouseout', function() {
          d3.select(this)
            .style('stroke', '#fff')
            .style('stroke-width', 1);
          if (callbacks.onHoverEnd) {
            callbacks.onHoverEnd();
          }
        })
        .on('click', function(event, d) {
          if (callbacks.onPointClick) {
            const rect = this.getBoundingClientRect();
            const position = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2
            };
            callbacks.onPointClick([d], position, `Cell: ${d.dimensions[xDim]}, ${d.dimensions[yDim]}`);
          }
        });
    }

    // Add a color legend for the heatmap
    const legendWidth = 15;
    const legendHeight = adjustedHeight;
    const legendScale = d3.scaleLinear()
      .domain(extent)
      .range([legendHeight, 0]);

    const legend = heatmapG.append('g')
      .attr('transform', `translate(${adjustedWidth + 20}, 0)`);

    // Create gradient for legend
    const gradientId = `heatmap-gradient-${Date.now()}`;
    const gradient = heatmapG.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    // Create gradient stops matching our colorblind-safe scale
    const gradientStops = [
      { offset: '0%', color: '#440154' },     // Dark purple (low)
      { offset: '25%', color: '#31688e' },    // Blue
      { offset: '50%', color: '#21908c' },    // Teal
      { offset: '75%', color: '#5dc863' },    // Green
      { offset: '100%', color: '#fde725' }    // Yellow (high)
    ];
    
    gradientStops.forEach(stop => {
      gradient.append('stop')
        .attr('offset', stop.offset)
        .attr('stop-color', stop.color);
    });

    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', `url(#${gradientId})`);

    // Add legend scale with better formatting
    legend.append('g')
      .attr('transform', `translate(${legendWidth}, 0)`)
      .call(d3.axisRight(legendScale)
        .ticks(5)
        .tickFormat((d: any) => formatMeasureValue(d))
      )
      .selectAll('text')
      .style('font-size', '11px')
      .style('font-weight', '500');

    // Add legend title with measure name
    legend.append('text')
      .attr('transform', `translate(${legendWidth + 50}, ${legendHeight / 2}) rotate(90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(measureDisplayName);

    // Add min/max labels for clarity
    legend.append('text')
      .attr('x', legendWidth + 5)
      .attr('y', -5)
      .style('font-size', '9px')
      .style('fill', '#666')
      .text('High');

    legend.append('text')
      .attr('x', legendWidth + 5)
      .attr('y', legendHeight + 15)
      .style('font-size', '9px')
      .style('fill', '#666')
      .text('Low');
    
    // Add data summary statistics as a fixed overlay (not affected by zoom)
    const values = data.map(d => +d.measures[measure]).filter(v => !isNaN(v));
    const mean = d3.mean(values) || 0;
    const median = d3.median(values) || 0;
    const stdDev = d3.deviation(values) || 0;
    const coverage = (data.length / (xValues.length * yValues.length) * 100).toFixed(1);
    
    // Create a separate non-zooming layer for stats
    // If svg is provided, use it for fixed positioning; otherwise append to g
    const statsContainer = svg || g.append('svg');
    // Position stats overlay to not block any labels
    const statsX = width + marginLeft - 140;
    const statsY = marginTop + 10; // Position at top to avoid blocking labels
    
    const statsOverlay = statsContainer.append('g')
      .attr('class', 'stats-overlay')
      .attr('transform', svg ? `translate(${statsX}, ${statsY})` : `translate(${width - 140}, 10)`);
    
    // Add collapse/expand functionality
    let isCollapsed = false;
    
    // Collapsible container
    const statsGroup = statsOverlay.append('g');
    
    // Background for stats
    const statsBg = statsGroup.append('rect')
      .attr('x', -10)
      .attr('y', -20)
      .attr('width', 130)
      .attr('height', 90)
      .attr('fill', 'rgba(255, 255, 255, 0.95)')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1)
      .attr('rx', 4)
      .style('cursor', 'pointer');
    
    // Collapse/expand button
    const toggleButton = statsGroup.append('g')
      .style('cursor', 'pointer');
      
    toggleButton.append('rect')
      .attr('x', 100)
      .attr('y', -20)
      .attr('width', 20)
      .attr('height', 20)
      .attr('fill', '#f3f4f6')
      .attr('stroke', '#e5e7eb')
      .attr('rx', 2);
      
    const toggleIcon = toggleButton.append('text')
      .attr('x', 110)
      .attr('y', -5)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('−');
    
    // Stats text container
    const statsTextGroup = statsGroup.append('g');
    
    // Stats text
    const stats = [
      `Mean: ${formatMeasureValue(mean)}`,
      `Median: ${formatMeasureValue(median)}`,
      `Std Dev: ${formatMeasureValue(stdDev)}`,
      `Coverage: ${coverage}%`
    ];
    
    const statTexts = stats.map((stat, i) => {
      return statsTextGroup.append('text')
        .attr('x', 0)
        .attr('y', i * 18)
        .style('font-size', '11px')
        .style('font-weight', i === 3 ? '600' : '400')
        .style('fill', '#374151')
        .text(stat);
    });
    
    // Toggle functionality
    toggleButton.on('click', function() {
      isCollapsed = !isCollapsed;
      if (isCollapsed) {
        statsBg.attr('height', 20);
        statsTextGroup.style('display', 'none');
        toggleIcon.text('+');
      } else {
        statsBg.attr('height', 90);
        statsTextGroup.style('display', 'block');
        toggleIcon.text('−');
      }
    });

    // Add brush for selection
    if (settings.interactions?.brush?.enabled) {
      const brush = d3.brush()
        .extent([[0, 0], [adjustedWidth, adjustedHeight]])
        .on('start', function() {
          // Reset opacity when starting new selection
          cells.style('opacity', 1);
          cellGroups.selectAll('.cell-label').style('opacity', 1);
        })
        .on('brush', function(event) {
          const selection = event.selection;
          if (selection) {
            const [[x0, y0], [x1, y1]] = selection;
            
            // Update cell opacity based on selection
            cells.style('opacity', function(d: any) {
              const cellX = xScale(d.dimensions[xDim]) || 0;
              const cellY = yScale(d.dimensions[yDim]) || 0;
              const cellWidth = xScale.bandwidth();
              const cellHeight = yScale.bandwidth();
              
              // Check if cell is within selection
              const cellCenterX = cellX + cellWidth / 2;
              const cellCenterY = cellY + cellHeight / 2;
              
              return (cellCenterX >= x0 && cellCenterX <= x1 && 
                      cellCenterY >= y0 && cellCenterY <= y1) ? 1 : 0.3;
            });

            // Update label opacity to match cells
            cellGroups.selectAll('.cell-label').style('opacity', function(d: any) {
              const cellX = xScale(d.dimensions[xDim]) || 0;
              const cellY = yScale(d.dimensions[yDim]) || 0;
              const cellWidth = xScale.bandwidth();
              const cellHeight = yScale.bandwidth();
              
              const cellCenterX = cellX + cellWidth / 2;
              const cellCenterY = cellY + cellHeight / 2;
              
              return (cellCenterX >= x0 && cellCenterX <= x1 && 
                      cellCenterY >= y0 && cellCenterY <= y1) ? 1 : 0.3;
            });
          }
        })
        .on('end', function(event) {
          const selection = event.selection;
          if (!selection) {
            // Reset opacity when brush is cleared
            cells.style('opacity', 1);
            cellGroups.selectAll('.cell-label').style('opacity', 1);
          } else {
            // Get selected data points
            const [[x0, y0], [x1, y1]] = selection;
            const selectedData = data.filter((d: any) => {
              const cellX = xScale(d.dimensions[xDim]) || 0;
              const cellY = yScale(d.dimensions[yDim]) || 0;
              const cellWidth = xScale.bandwidth();
              const cellHeight = yScale.bandwidth();
              
              const cellCenterX = cellX + cellWidth / 2;
              const cellCenterY = cellY + cellHeight / 2;
              
              return cellCenterX >= x0 && cellCenterX <= x1 && 
                     cellCenterY >= y0 && cellCenterY <= y1;
            });

            // Trigger the data viewer with selected points
            if (callbacks && callbacks.onPointClick && selectedData.length > 0) {
              const brushRect = {
                x: (x0 + x1) / 2,
                y: (y0 + y1) / 2
              };
              callbacks.onPointClick(selectedData, brushRect, `Selected ${selectedData.length} cells`);
            }
          }
          
          if (callbacks && callbacks.onBrushEnd) {
            callbacks.onBrushEnd(selection);
          }
        });

      heatmapG.append('g')
        .attr('class', 'brush')
        .call(brush);
    }
  }

  // Box Plot rendering function for advanced statistical analysis
  function renderBoxPlot(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
    if (!data.length) return;

    // Get dimension and measure keys
    const dimensionKeys = Object.keys(data[0].dimensions);
    const measureKeys = Object.keys(data[0].measures);
    if (!dimensionKeys.length || !measureKeys.length) return;

    // Group data by first dimension
    const groupKey = dimensionKeys[0];
    const measureKey = measureKeys[0];
    
    const grouped = d3.group(data, d => d.dimensions[groupKey]);
    const groups = Array.from(grouped.keys());

    // Calculate statistics for each group
    const boxData = groups.map(group => {
      const values = grouped.get(group)!
        .map(d => +d.measures[measureKey])
        .filter(v => !isNaN(v))
        .sort((a, b) => a - b);

      if (values.length === 0) return null;

      const q1 = d3.quantile(values, 0.25) || 0;
      const median = d3.quantile(values, 0.5) || 0;
      const q3 = d3.quantile(values, 0.75) || 0;
      const iqr = q3 - q1;
      const lowerWhisker = Math.max(d3.min(values)!, q1 - 1.5 * iqr);
      const upperWhisker = Math.min(d3.max(values)!, q3 + 1.5 * iqr);
      
      // Identify outliers
      const outliers = values.filter(v => v < lowerWhisker || v > upperWhisker);
      
      // Calculate additional statistics for PhD-level analysis
      const mean = d3.mean(values) || 0;
      const variance = d3.variance(values) || 0;
      const stdDev = Math.sqrt(variance);
      const skewness = calculateSkewness(values, mean, stdDev);
      const kurtosis = calculateKurtosis(values, mean, stdDev);
      const ci95 = calculateConfidenceInterval(values, mean, stdDev);

      return {
        group,
        values,
        q1,
        median,
        q3,
        mean,
        lowerWhisker,
        upperWhisker,
        outliers,
        n: values.length,
        stdDev,
        variance,
        skewness,
        kurtosis,
        ci95,
        min: d3.min(values)!,
        max: d3.max(values)!
      };
    }).filter(d => d !== null);

    // Set up scales
    const barPadding = 40; // Add padding to prevent edge cutoff
    const xScale = d3.scaleBand()
      .domain(groups)
      .range([barPadding, width - barPadding])
      .padding(0.2);

    const allValues = data.map(d => +d.measures[measureKey]).filter(v => !isNaN(v));
    const yExtent = d3.extent(allValues) as [number, number];
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;
    
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
      .range([height, 0])
      .nice();

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-30)');

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + 50})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(groupKey);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -(height / 2))
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(measureKey);

    // Create box plot groups
    const boxGroups = g.selectAll('.box-group')
      .data(boxData)
      .enter()
      .append('g')
      .attr('class', 'box-group')
      .attr('transform', (d: any) => `translate(${xScale(d.group)! + xScale.bandwidth() / 2}, 0)`);

    const boxWidth = Math.min(50, xScale.bandwidth() * 0.7);

    // Draw vertical lines (whiskers)
    boxGroups.append('line')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', (d: any) => yScale(d.lowerWhisker))
      .attr('y2', (d: any) => yScale(d.upperWhisker))
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    // Draw whisker caps
    boxGroups.append('line')
      .attr('x1', -boxWidth / 4)
      .attr('x2', boxWidth / 4)
      .attr('y1', (d: any) => yScale(d.lowerWhisker))
      .attr('y2', (d: any) => yScale(d.lowerWhisker))
      .attr('stroke', '#333')
      .attr('stroke-width', 1);

    boxGroups.append('line')
      .attr('x1', -boxWidth / 4)
      .attr('x2', boxWidth / 4)
      .attr('y1', (d: any) => yScale(d.upperWhisker))
      .attr('y2', (d: any) => yScale(d.upperWhisker))
      .attr('stroke', '#333')
      .attr('stroke-width', 1);

    // Draw IQR boxes
    boxGroups.append('rect')
      .attr('x', -boxWidth / 2)
      .attr('y', (d: any) => yScale(d.q3))
      .attr('width', boxWidth)
      .attr('height', (d: any) => yScale(d.q1) - yScale(d.q3))
      .attr('fill', '#69b3a2')
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#333')
      .attr('stroke-width', 1);

    // Draw median line
    boxGroups.append('line')
      .attr('x1', -boxWidth / 2)
      .attr('x2', boxWidth / 2)
      .attr('y1', (d: any) => yScale(d.median))
      .attr('y2', (d: any) => yScale(d.median))
      .attr('stroke', '#333')
      .attr('stroke-width', 2);

    // Draw mean diamond
    boxGroups.append('path')
      .attr('d', (d: any) => {
        const y = yScale(d.mean);
        const size = 6;
        return `M 0,${y - size} L ${size},${y} L 0,${y + size} L ${-size},${y} Z`;
      })
      .attr('fill', '#ff6b6b')
      .attr('stroke', '#333')
      .attr('stroke-width', 1);

    // Draw confidence interval
    boxGroups.append('rect')
      .attr('x', -2)
      .attr('y', (d: any) => yScale(d.ci95.upper))
      .attr('width', 4)
      .attr('height', (d: any) => yScale(d.ci95.lower) - yScale(d.ci95.upper))
      .attr('fill', '#ff6b6b')
      .attr('fill-opacity', 0.3);

    // Draw outliers
    boxGroups.each(function(d: any) {
      d3.select(this)
        .selectAll('.outlier')
        .data(d.outliers)
        .enter()
        .append('circle')
        .attr('class', 'outlier')
        .attr('cx', 0)
        .attr('cy', (v: number) => yScale(v))
        .attr('r', 3)
        .attr('fill', 'none')
        .attr('stroke', '#ff6b6b')
        .attr('stroke-width', 1);
    });

    // Add statistical annotations
    const statsGroup = g.append('g')
      .attr('class', 'stats-annotations')
      .attr('font-size', '10px')
      .attr('fill', '#666');

    boxGroups.each(function(d: any, i: number) {
      const x = xScale(d.group)! + xScale.bandwidth() / 2;
      const annotX = x + boxWidth / 2 + 5;
      
      // Sample size
      statsGroup.append('text')
        .attr('x', annotX)
        .attr('y', yScale(d.median))
        .attr('dy', -15)
        .text(`n=${d.n}`);

      // Show additional stats on hover
      d3.select(this)
        .on('mouseover', function(event: any) {
          const tooltip = g.append('g')
            .attr('class', 'box-tooltip')
            .attr('transform', `translate(${x}, ${yScale(d.q3) - 10})`);

          const rect = tooltip.append('rect')
            .attr('x', -60)
            .attr('y', -100)
            .attr('width', 120)
            .attr('height', 95)
            .attr('fill', 'white')
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .attr('rx', 3);

          const text = tooltip.append('text')
            .attr('x', 0)
            .attr('y', -85)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text(d.group);

          const stats = [
            `μ: ${d.mean.toFixed(2)}`,
            `σ: ${d.stdDev.toFixed(2)}`,
            `Skew: ${d.skewness.toFixed(3)}`,
            `Kurt: ${d.kurtosis.toFixed(3)}`,
            `CI95: [${d.ci95.lower.toFixed(2)}, ${d.ci95.upper.toFixed(2)}]`
          ];

          stats.forEach((stat, idx) => {
            tooltip.append('text')
              .attr('x', 0)
              .attr('y', -65 + idx * 15)
              .attr('text-anchor', 'middle')
              .attr('font-size', '10px')
              .text(stat);
          });
        })
        .on('mouseout', function() {
          g.selectAll('.box-tooltip').remove();
        });
    });

    // Add click handler for detailed data view
    boxGroups
      .style('cursor', 'pointer')
      .on('click', function(event: any, d: any) {
        if (callbacks && callbacks.onPointClick) {
          const detailedData = grouped.get(d.group)!.map(item => ({
            ...item,
            statistics: {
              mean: d.mean,
              median: d.median,
              stdDev: d.stdDev,
              q1: d.q1,
              q3: d.q3,
              min: d.min,
              max: d.max,
              n: d.n,
              skewness: d.skewness,
              kurtosis: d.kurtosis
            }
          }));
          
          const rect = this.getBoundingClientRect();
          callbacks.onPointClick(detailedData, { x: rect.left, y: rect.top }, `${d.group} - Statistical Summary`);
        }
      });

    // Helper functions for statistical calculations
    function calculateSkewness(values: number[], mean: number, stdDev: number): number {
      if (stdDev === 0 || values.length < 3) return 0;
      const n = values.length;
      const m3 = values.reduce((sum, v) => sum + Math.pow(v - mean, 3), 0) / n;
      return m3 / Math.pow(stdDev, 3);
    }

    function calculateKurtosis(values: number[], mean: number, stdDev: number): number {
      if (stdDev === 0 || values.length < 4) return 0;
      const n = values.length;
      const m4 = values.reduce((sum, v) => sum + Math.pow(v - mean, 4), 0) / n;
      return m4 / Math.pow(stdDev, 4) - 3;
    }

    function calculateConfidenceInterval(values: number[], mean: number, stdDev: number): { lower: number, upper: number } {
      const n = values.length;
      const stderr = stdDev / Math.sqrt(n);
      const tValue = 1.96; // 95% confidence interval for large samples
      return {
        lower: mean - tValue * stderr,
        upper: mean + tValue * stderr
      };
    }
  }

  // Professional histogram with distribution analysis
  function renderHistogram(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
    if (!data.length) return;

    // Get the first measure as the value to histogram
    const measureKey = Object.keys(data[0].measures)[0];
    if (!measureKey) return;

    // Extract values and filter out non-numeric
    const values = data
      .map(d => +d.measures[measureKey])
      .filter(v => !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length === 0) return;

    // Calculate statistics
    const mean = d3.mean(values) || 0;
    const stdDev = Math.sqrt(d3.variance(values) || 0);
    const median = d3.median(values) || 0;
    const q1 = d3.quantile(values, 0.25) || 0;
    const q3 = d3.quantile(values, 0.75) || 0;
    const iqr = q3 - q1;
    
    // Calculate skewness and kurtosis
    const n = values.length;
    let m3 = 0, m4 = 0;
    values.forEach(v => {
      const diff = v - mean;
      m3 += Math.pow(diff, 3);
      m4 += Math.pow(diff, 4);
    });
    m3 /= n;
    m4 /= n;
    const skewness = m3 / Math.pow(stdDev, 3);
    const kurtosis = m4 / Math.pow(stdDev, 4) - 3;

    // Determine optimal number of bins using Sturges' rule or Scott's rule
    const sturgesBins = Math.ceil(Math.log2(n) + 1);
    const scottBinWidth = 3.5 * stdDev / Math.pow(n, 1/3);
    const range = d3.max(values)! - d3.min(values)!;
    const scottBins = Math.ceil(range / scottBinWidth);
    const numBins = Math.min(Math.max(sturgesBins, scottBins, 10), 50);

    // Create histogram generator
    const histogram = d3.histogram()
      .domain(d3.extent(values) as [number, number])
      .thresholds(numBins);

    const bins = histogram(values);

    // Set up scales
    const histPadding = 40; // Add padding to prevent edge cutoff
    const xScale = d3.scaleLinear()
      .domain(d3.extent(values) as [number, number])
      .range([histPadding, width - histPadding])
      .nice();

    const yMax = d3.max(bins, d => d.length) || 0;
    const yScale = d3.scaleLinear()
      .domain([0, yMax * 1.1]) // Add some headroom
      .range([height, 0]);

    // Add axes
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale));

    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale));

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + 40})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(measureKey);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -(height / 2))
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Frequency');

    // Draw histogram bars
    const barGroups = g.selectAll('.bar')
      .data(bins)
      .enter()
      .append('g')
      .attr('class', 'bar')
      .style('cursor', 'pointer');

    barGroups.append('rect')
      .attr('x', (d: any) => xScale(d.x0))
      .attr('width', (d: any) => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
      .attr('y', (d: any) => yScale(d.length))
      .attr('height', (d: any) => height - yScale(d.length))
      .attr('fill', resolveColorPalette(settings.colors?.palette)[0]) // Use first color from palette
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#2980b9')
      .attr('stroke-width', 1);

    // Add frequency labels on bars
    barGroups.append('text')
      .attr('x', (d: any) => xScale(d.x0) + (xScale(d.x1) - xScale(d.x0)) / 2)
      .attr('y', (d: any) => yScale(d.length) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text((d: any) => d.length > 0 ? d.length : '');

    // Add normal distribution overlay
    const normalLine = d3.line()
      .x((d: any) => xScale(d.x))
      .y((d: any) => yScale(d.y))
      .curve(d3.curveBasis);

    // Generate points for normal curve
    const xMin = xScale.domain()[0];
    const xMax = xScale.domain()[1];
    const normalPoints = [];
    const numPoints = 100;
    
    for (let i = 0; i <= numPoints; i++) {
      const x = xMin + (xMax - xMin) * i / numPoints;
      const z = (x - mean) / stdDev;
      const phi = Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
      const y = phi * n * (xMax - xMin) / numBins;
      normalPoints.push({ x, y });
    }

    g.append('path')
      .datum(normalPoints)
      .attr('d', normalLine)
      .attr('fill', 'none')
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.8);

    // Add mean, median lines
    g.append('line')
      .attr('x1', xScale(mean))
      .attr('x2', xScale(mean))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '10,5');

    g.append('line')
      .attr('x1', xScale(median))
      .attr('x2', xScale(median))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#27ae60')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');

    // Add distribution info box using consistent styling
    const statsData = [
      { label: 'n', value: n },
      { label: 'Mean', value: mean.toFixed(2) },
      { label: 'Median', value: median.toFixed(2) },
      { label: 'Std Dev', value: stdDev.toFixed(2) },
      { label: 'Skewness', value: `${skewness.toFixed(3)} (${getSkewnessInterpretation(skewness)})` },
      { label: 'Kurtosis', value: `${kurtosis.toFixed(3)} (${getKurtosisInterpretation(kurtosis)})` }
    ];
    
    const statsBox = createStatsBox(g, width - 220, 10, statsData, {
      width: 210,
      height: 140
    });
    
    // Add colored indicators for mean and median
    const infoData = [
      { label: 'Mean', value: mean.toFixed(2), color: '#e74c3c' },
      { label: 'Median', value: median.toFixed(2), color: '#27ae60' }
    ];

    infoData.forEach((info, i) => {
      const y = 40 + i * 20;
      
      // Add colored line for mean/median
      if (info.color) {
        statsBox.append('line')
          .attr('x1', 5)
          .attr('x2', 15)
          .attr('y1', y - 5)
          .attr('y2', y - 5)
          .attr('stroke', info.color)
          .attr('stroke-width', 2);
      }
    });
    
    // Normality test result
    const isNormal = Math.abs(skewness) < 0.5 && Math.abs(kurtosis) < 1;
    statsBox.append('text')
      .attr('x', 10)
      .attr('y', 130)
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', isNormal ? '#27ae60' : '#e67e22')
      .text(isNormal ? '≈ Normal Distribution' : '≠ Normal Distribution');

    // Interactive tooltips on bars
    if (callbacks) {
      barGroups
        .on('mouseover', function(event: any, d: any) {
          d3.select(this).select('rect')
            .attr('fill-opacity', 1);
            
          const binTooltip = g.append('g')
            .attr('class', 'bin-tooltip');
            
          const tooltipX = xScale(d.x0) + (xScale(d.x1) - xScale(d.x0)) / 2;
          const tooltipY = yScale(d.length) - 20;
          
          const tooltipBg = binTooltip.append('rect')
            .attr('x', tooltipX - 60)
            .attr('y', tooltipY - 40)
            .attr('width', 120)
            .attr('height', 35)
            .attr('fill', '#333')
            .attr('opacity', 0.9)
            .attr('rx', 3);
            
          binTooltip.append('text')
            .attr('x', tooltipX)
            .attr('y', tooltipY - 25)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', 'white')
            .text(`Range: ${d.x0.toFixed(1)} - ${d.x1.toFixed(1)}`);
            
          binTooltip.append('text')
            .attr('x', tooltipX)
            .attr('y', tooltipY - 10)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('fill', 'white')
            .style('font-weight', 'bold')
            .text(`Count: ${d.length} (${(d.length / n * 100).toFixed(1)}%)`);
        })
        .on('mouseout', function() {
          d3.select(this).select('rect')
            .attr('fill-opacity', 0.7);
          g.selectAll('.bin-tooltip').remove();
        })
        .on('click', function(event: any, d: any) {
          if (callbacks.onPointClick) {
            const binData = data.filter(item => {
              const value = +item.measures[measureKey];
              return value >= d.x0 && value < d.x1;
            });
            
            const rect = this.getBoundingClientRect();
            callbacks.onPointClick(binData, { x: rect.left, y: rect.top }, 
              `Bin: ${d.x0.toFixed(1)} - ${d.x1.toFixed(1)} (${binData.length} items)`);
          }
        });
    }

    // Helper functions
    function getSkewnessInterpretation(skew: number): string {
      if (Math.abs(skew) < 0.5) return 'Symmetric';
      if (skew > 0) return skew > 1 ? 'Highly Right' : 'Right';
      return skew < -1 ? 'Highly Left' : 'Left';
    }

    function getKurtosisInterpretation(kurt: number): string {
      if (Math.abs(kurt) < 0.5) return 'Normal';
      if (kurt > 0) return kurt > 1 ? 'Heavy Tails' : 'Moderate Tails';
      return kurt < -1 ? 'Light Tails' : 'Flat';
    }
  }

  // Spatial effectiveness map with geographic interpolation
  function renderSpatialEffectivenessMap(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
    if (!data.length) return;

    // Extract geographic data
    const hasLatLng = data.every(d => d.dimensions.latitude !== undefined && d.dimensions.longitude !== undefined);
    if (!hasLatLng) {
      // Show message if no geographic data
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#666')
        .text('Geographic coordinates (latitude/longitude) required for spatial map');
      return;
    }

    // Get measure for effectiveness (first measure)
    const measureKey = Object.keys(data[0].measures)[0];
    if (!measureKey) return;

    // Extract coordinates and values
    const points = data.map(d => ({
      lat: +d.dimensions.latitude,
      lng: +d.dimensions.longitude,
      value: +d.measures[measureKey],
      site: d.dimensions.site_name || d.dimensions.site_id || 'Unknown',
      metadata: d
    })).filter(p => !isNaN(p.lat) && !isNaN(p.lng) && !isNaN(p.value));

    // Calculate bounds
    const latExtent = d3.extent(points, d => d.lat) as [number, number];
    const lngExtent = d3.extent(points, d => d.lng) as [number, number];
    const valueExtent = d3.extent(points, d => d.value) as [number, number];

    // Add padding to bounds
    const latPadding = (latExtent[1] - latExtent[0]) * 0.1;
    const lngPadding = (lngExtent[1] - lngExtent[0]) * 0.1;

    // Create projection - using Albers USA for US data, or Mercator for general
    const projection = d3.geoMercator()
      .center([(lngExtent[0] + lngExtent[1]) / 2, (latExtent[0] + latExtent[1]) / 2])
      .scale(calculateMapScale(latExtent, lngExtent, width, height))
      .translate([width / 2, height / 2]);

    // Create path generator
    const path = d3.geoPath().projection(projection);

    // Color scale for effectiveness
    const colorScale = d3.scaleSequential()
      .domain(valueExtent)
      .interpolator(d3.interpolateRdYlGn); // Red (low) to Yellow to Green (high)

    // Add base map features if available
    const mapGroup = g.append('g').attr('class', 'map-base');
    
    // Add state/region boundaries (placeholder - would need GeoJSON data)
    mapGroup.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#f0f0f0')
      .attr('stroke', '#ccc');

    // Create interpolation grid using inverse distance weighting (IDW)
    const gridSize = 50; // Resolution of interpolation
    const heatmapData = [];
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = (i / gridSize) * width;
        const y = (j / gridSize) * height;
        
        // Convert screen coordinates back to lat/lng
        const [lng, lat] = projection.invert!([x, y]);
        
        // Check if point is within bounds
        if (lat >= latExtent[0] - latPadding && lat <= latExtent[1] + latPadding &&
            lng >= lngExtent[0] - lngPadding && lng <= lngExtent[1] + lngPadding) {
          
          // Inverse distance weighting interpolation
          let sumWeights = 0;
          let sumValues = 0;
          
          points.forEach(point => {
            const pointScreen = projection([point.lng, point.lat]);
            const distance = Math.sqrt(
              Math.pow(x - pointScreen![0], 2) + 
              Math.pow(y - pointScreen![1], 2)
            );
            
            // IDW with power parameter of 2
            const weight = distance === 0 ? 1e10 : 1 / Math.pow(distance, 2);
            sumWeights += weight;
            sumValues += weight * point.value;
          });
          
          const interpolatedValue = sumValues / sumWeights;
          heatmapData.push({ x, y, value: interpolatedValue });
        }
      }
    }

    // Draw heatmap
    const cellSize = width / gridSize;
    g.selectAll('.heat-cell')
      .data(heatmapData)
      .enter()
      .append('rect')
      .attr('class', 'heat-cell')
      .attr('x', d => d.x - cellSize / 2)
      .attr('y', d => d.y - cellSize / 2)
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('fill', d => colorScale(d.value))
      .attr('fill-opacity', 0.6);

    // Add contour lines
    const thresholds = d3.range(valueExtent[0], valueExtent[1], (valueExtent[1] - valueExtent[0]) / 10);
    const contourGroup = g.append('g').attr('class', 'contours');
    
    // Simple contour lines based on thresholds
    thresholds.forEach(threshold => {
      const contourPath = d3.geoPath();
      contourGroup.append('path')
        .attr('d', '') // Would need proper contour algorithm
        .attr('fill', 'none')
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5)
        .attr('stroke-opacity', 0.3);
    });

    // Add site markers
    const siteGroup = g.append('g').attr('class', 'sites');
    
    const sites = siteGroup.selectAll('.site')
      .data(points)
      .enter()
      .append('g')
      .attr('class', 'site')
      .attr('transform', d => {
        const coords = projection([d.lng, d.lat]);
        return `translate(${coords![0]}, ${coords![1]})`;
      })
      .style('cursor', 'pointer');

    // Add circles for sites
    sites.append('circle')
      .attr('r', 8)
      .attr('fill', d => colorScale(d.value))
      .attr('stroke', '#333')
      .attr('stroke-width', 2)
      .attr('fill-opacity', 0.9);

    // Add value labels
    sites.append('text')
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', 'white')
      .text(d => d.value.toFixed(1));

    // Add legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legendGroup = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - legendWidth - 20}, ${height - 40})`);

    // Create gradient for legend
    const gradientId = 'effectiveness-gradient';
    const gradient = g.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('x2', '100%');

    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', colorScale(valueExtent[0] + t * (valueExtent[1] - valueExtent[0])));
    }

    legendGroup.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', `url(#${gradientId})`)
      .attr('stroke', '#333');

    legendGroup.append('text')
      .attr('y', -5)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(`${measureKey} Effectiveness`);

    legendGroup.append('text')
      .attr('y', legendHeight + 15)
      .style('font-size', '11px')
      .text(valueExtent[0].toFixed(1));

    legendGroup.append('text')
      .attr('x', legendWidth)
      .attr('y', legendHeight + 15)
      .attr('text-anchor', 'end')
      .style('font-size', '11px')
      .text(valueExtent[1].toFixed(1));

    // Add time control if temporal data exists
    const hasTime = data.some(d => d.dimensions.date || d.dimensions.created_at);
    if (hasTime) {
      const timeGroup = g.append('g')
        .attr('class', 'time-control')
        .attr('transform', `translate(20, ${height - 40})`);

      timeGroup.append('text')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text('Time: [Animation controls would go here]');
    }

    // Interactive features
    if (callbacks) {
      sites
        .on('mouseover', function(event: any, d: any) {
          d3.select(this).select('circle')
            .attr('r', 12)
            .attr('fill-opacity', 1);

          const tooltip = g.append('g')
            .attr('class', 'map-tooltip');

          const coords = projection([d.lng, d.lat]);
          const tooltipX = coords![0] + 15;
          const tooltipY = coords![1] - 15;

          const tooltipBg = tooltip.append('rect')
            .attr('x', tooltipX)
            .attr('y', tooltipY - 60)
            .attr('width', 150)
            .attr('height', 60)
            .attr('fill', 'white')
            .attr('stroke', '#333')
            .attr('stroke-width', 1)
            .attr('rx', 3);

          const lines = [
            `Site: ${d.site}`,
            `Lat: ${d.lat.toFixed(4)}`,
            `Lng: ${d.lng.toFixed(4)}`,
            `${measureKey}: ${d.value.toFixed(2)}`
          ];

          lines.forEach((line, i) => {
            tooltip.append('text')
              .attr('x', tooltipX + 5)
              .attr('y', tooltipY - 45 + i * 15)
              .style('font-size', '11px')
              .text(line);
          });
        })
        .on('mouseout', function() {
          d3.select(this).select('circle')
            .attr('r', 8)
            .attr('fill-opacity', 0.9);
          g.selectAll('.map-tooltip').remove();
        })
        .on('click', function(event: any, d: any) {
          if (callbacks.onPointClick) {
            const detailedData = data.filter(item => 
              item.dimensions.latitude === d.lat && 
              item.dimensions.longitude === d.lng
            );
            
            const rect = this.getBoundingClientRect();
            callbacks.onPointClick(detailedData, { x: rect.left, y: rect.top }, 
              `Site: ${d.site} - Effectiveness Analysis`);
          }
        });
    }

    // Helper function to calculate appropriate map scale
    function calculateMapScale(latExtent: [number, number], lngExtent: [number, number], width: number, height: number): number {
      const latRange = latExtent[1] - latExtent[0];
      const lngRange = lngExtent[1] - lngExtent[0];
      
      // Rough approximation for Mercator projection
      const latScale = height / latRange * 2;
      const lngScale = width / lngRange * 2;
      
      return Math.min(latScale, lngScale) * 0.8; // 80% to add padding
    }
  }

  // Render animated treemap
  function renderTreeMap(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
    if (!data.length) return;

    // Get dimensions and measures
    const dimKeys = Object.keys(data[0].dimensions);
    const measureKeys = Object.keys(data[0].measures);
    
    if (dimKeys.length < 1 || measureKeys.length < 1) {
      console.warn('TreeMap requires at least 1 dimension and 1 measure');
      return;
    }

    // For segmented data, check if we have segment information in metadata
    const hasSegments = data[0].metadata && data[0].metadata.segment_program_name;
    
    // Build hierarchy based on available data structure
    let hierarchyDims: string[] = [];
    let timeDim: string | null = null;
    
    if (hasSegments) {
      // Use program segmentation as top level, then dimensions
      hierarchyDims = ['segment_program_name', ...dimKeys.filter(dim => dim !== 'created_at')];
      // Look for time dimension
      timeDim = dimKeys.find(dim => dim.includes('date') || dim.includes('time') || dim === 'created_at') || dimKeys[0];
    } else {
      // Identify time dimension (typically last dimension) and hierarchy dimensions
      timeDim = dimKeys.find(dim => isDateField(data[0].dimensions[dim])) || dimKeys[dimKeys.length - 1];
      hierarchyDims = dimKeys.filter(dim => dim !== timeDim);
    }
    
    const measure = measureKeys[0]; // Use first measure for sizing

    // Get unique time values - aggregate by date if dealing with datetime
    let timeValues: string[] = [];
    const isTimeDate = timeDim && data.length > 0 && isDateField(data[0].dimensions[timeDim]);
    
    if (isTimeDate) {
      // For date/time dimensions, extract just the date part (YYYY-MM-DD)
      const uniqueDates = new Set<string>();
      data.forEach(d => {
        const dateValue = d.dimensions[timeDim];
        if (dateValue) {
          // Extract just the date part (YYYY-MM-DD)
          const dateOnly = new Date(dateValue).toISOString().split('T')[0];
          uniqueDates.add(dateOnly);
        }
      });
      timeValues = Array.from(uniqueDates).sort();
    } else {
      // For non-date dimensions, use values as-is
      timeValues = [...new Set(data.map(d => d.dimensions[timeDim]))];
    }

    // Create time control container
    const controlHeight = 60;
    const chartHeight = height - controlHeight;
    
    // Animation state
    let currentTimeIndex = 0;
    let animationInterval: any = null;
    let isPlaying = false;

    // Create main visualization group
    const mainGroup = g.append('g')
      .attr('class', 'treemap-main');

    // Create controls group
    const controlsGroup = g.append('g')
      .attr('class', 'treemap-controls')
      .attr('transform', `translate(0, ${chartHeight + 10})`);

    // Build hierarchical data for a specific time
    function buildHierarchy(timeValue: any) {
      // Filter data for current time
      let timeData: any[];
      
      if (timeDim && isTimeDate) {
        // For date dimensions, filter by matching date part only
        timeData = data.filter(d => {
          const dateValue = d.dimensions[timeDim];
          if (!dateValue) return false;
          const dateOnly = new Date(dateValue).toISOString().split('T')[0];
          return dateOnly === timeValue;
        });
      } else if (timeDim) {
        // For non-date dimensions, exact match
        timeData = data.filter(d => d.dimensions[timeDim] === timeValue);
      } else {
        // No time dimension
        timeData = data;
      }
      
      // Build nested structure
      const root: any = {
        name: 'root',
        children: []
      };

      // Create grouping functions based on hierarchy structure
      const groupingFunctions = hierarchyDims.map(dim => {
        if (dim === 'segment_program_name') {
          return (d: any) => d.metadata?.segment_program_name || 'Unknown Program';
        } else {
          // Check if this dimension is a date field
          const isDateDim = data.length > 0 && isDateField(data[0].dimensions[dim]);
          if (isDateDim) {
            // For date dimensions, group by date only (not datetime)
            return (d: any) => {
              const dateValue = d.dimensions[dim];
              if (!dateValue) return 'Unknown';
              // Extract just the date part (YYYY-MM-DD)
              return new Date(dateValue).toISOString().split('T')[0];
            };
          } else {
            return (d: any) => d.dimensions[dim] || 'Unknown';
          }
        }
      });

      // Group data by hierarchy levels
      const grouped = groupingFunctions.length > 0 
        ? d3.group(timeData, ...groupingFunctions)
        : new Map([['All Data', timeData]]);
      
      // Convert to hierarchical structure
      function processGroup(group: any, level: number = 0, dimValues: string[] = []): any {
        if (level === hierarchyDims.length) {
          // Leaf level - aggregate measures and create meaningful labels
          const values = Array.isArray(group) ? group : [group];
          const totalValue = d3.sum(values, (d: any) => +d.measures[measure] || 0);
          
          // Create a meaningful leaf name based on the path
          let leafName = 'Data Point';
          if (dimValues.length > 0) {
            // Use the last dimension value as the leaf name, or combine them
            const lastDim = hierarchyDims[hierarchyDims.length - 1];
            if (lastDim === 'segment_program_name') {
              leafName = dimValues[dimValues.length - 1] || 'Program Data';
            } else {
              // For non-program dimensions, use the dimension value
              leafName = dimValues[dimValues.length - 1] || `${lastDim}: ${totalValue.toFixed(1)}`;
            }
          }
          
          return {
            name: leafName,
            value: totalValue,
            measureName: measure,
            dataCount: values.length,
            rawData: values
          };
        }
        
        const children: any[] = [];
        group.forEach((subGroup: any, key: string) => {
          const newDimValues = [...dimValues, key];
          const child = processGroup(subGroup, level + 1, newDimValues);
          if (Array.isArray(child)) {
            children.push({
              name: key || 'Unknown',
              children: child,
              level: level,
              dimensionName: hierarchyDims[level]
            });
          } else {
            children.push({
              name: key || 'Unknown',
              level: level,
              dimensionName: hierarchyDims[level],
              ...child
            });
          }
        });
        
        return children;
      }

      root.children = processGroup(grouped, 0);
      return d3.hierarchy(root)
        .sum((d: any) => d.value || 0)
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
    }

    // Enhanced color scale for program-based coloring
    const programNames = hasSegments 
      ? [...new Set(data.map(d => d.metadata?.segment_program_name).filter(Boolean))]
      : ['Default'];
    
    const colorScale = d3.scaleOrdinal()
      .domain(programNames)
      .range(resolveColorPalette(settings.colors?.palette).slice(0, Math.max(programNames.length, 3))); // Use palette from settings
    
    // Function to get color for a node based on its top-level program
    function getNodeColor(d: any): string {
      if (hasSegments) {
        // Find the top-level program name in the hierarchy
        let current = d;
        while (current.parent && current.parent.data.name !== 'root') {
          current = current.parent;
        }
        const programName = current.data.name;
        return colorScale(programName) as string;
      } else {
        // Use the top-level category for coloring
        let current = d;
        while (current.parent && current.parent.data.name !== 'root') {
          current = current.parent;
        }
        return colorScale(current.data.name) as string;
      }
    }

    // Create treemap layout
    const treemapLayout = d3.treemap()
      .size([width, chartHeight])
      .padding(2)
      .round(true);

    // Track cells for smooth transitions
    let currentCells: d3.Selection<any, any, any, any> | null = null;

    // Render treemap for specific time
    function renderTime(timeIndex: number) {
      const timeValue = timeValues[timeIndex];
      const hierarchy = buildHierarchy(timeValue);
      
      treemapLayout(hierarchy);

      // Use a key function to track cells by their path
      const leafData = hierarchy.leaves();
      const keyFn = (d: any) => {
        const path = d.ancestors().reverse().slice(1).map((n: any) => n.data.name);
        return path.join('|');
      };

      // Join data with existing cells
      const cells = mainGroup.selectAll('.cell')
        .data(leafData, keyFn);

      // Exit - remove cells that no longer exist
      cells.exit()
        .transition()
        .duration(750)
        .style('opacity', 0)
        .remove();

      // Enter - create new cells
      const cellsEnter = cells.enter()
        .append('g')
        .attr('class', 'cell')
        .style('opacity', 0);

      // Add rectangles to new cells
      cellsEnter.append('rect')
        .attr('fill', getNodeColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('rx', 2) // Slightly rounded corners
        .style('cursor', 'pointer');

      // Add labels to new cells
      cellsEnter.append('text')
        .attr('class', 'cell-label')
        .attr('x', 4)
        .attr('y', 16)
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', '#333')
        .style('pointer-events', 'none');

      // Add value labels to new cells
      cellsEnter.append('text')
        .attr('class', 'cell-value')
        .attr('x', 4)
        .attr('y', 30)
        .style('font-size', '10px')
        .style('fill', '#666')
        .style('pointer-events', 'none');

      // Add measure name labels to new cells
      cellsEnter.append('text')
        .attr('class', 'cell-measure')
        .attr('x', 4)
        .attr('y', 44)
        .style('font-size', '9px')
        .style('fill', '#888')
        .style('font-style', 'italic')
        .style('pointer-events', 'none');

      // Merge enter and update selections
      const cellsMerge = cellsEnter.merge(cells);

      // Update all cells (both new and existing) with smooth transitions
      cellsMerge.transition()
        .duration(750)
        .style('opacity', 1)
        .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

      // Update rectangles
      cellsMerge.select('rect')
        .transition()
        .duration(750)
        .attr('width', (d: any) => d.x1 - d.x0)
        .attr('height', (d: any) => d.y1 - d.y0);

      // Update labels with improved text wrapping and content
      cellsMerge.select('.cell-label')
        .text((d: any) => {
          const cellWidth = d.x1 - d.x0;
          const cellHeight = d.y1 - d.y0;
          
          // Only show labels if cell is large enough
          if (cellWidth < 40 || cellHeight < 20) return '';
          
          // Get the actual name from the leaf data
          let displayName = d.data.name;
          
          // If it's showing a generic name, build a better one from the hierarchy
          if (displayName === 'Data Point' || displayName === 'leaf') {
            const path = d.ancestors().reverse().slice(1).map((n: any) => n.data.name);
            if (hasSegments && path.length >= 2) {
              // For segmented data: "Program - Petri Code"
              displayName = path.length > 1 ? path.slice(-1)[0] : path[0];
            } else {
              displayName = path[path.length - 1] || 'Data';
            }
          }
          
          // Check if displayName is a date (YYYY-MM-DD format) and format it nicely
          if (displayName && displayName.match(/^\d{4}-\d{2}-\d{2}$/)) {
            displayName = formatDateForDisplay(new Date(displayName), false, false);
          }
          
          // Truncate long names to fit
          const maxLength = Math.floor(cellWidth / 8); // Approximate character width
          if (displayName.length > maxLength) {
            displayName = displayName.substring(0, maxLength - 3) + '...';
          }
          
          return displayName;
        });

      // Update value labels
      cellsMerge.select('.cell-value')
        .text((d: any) => {
          const cellWidth = d.x1 - d.x0;
          const cellHeight = d.y1 - d.y0;
          
          // Only show values if cell is large enough
          if (cellWidth < 40 || cellHeight < 35) return '';
          
          const value = d.value || 0;
          const formattedValue = value < 1000 
            ? value.toFixed(1)
            : value < 1000000 
              ? (value / 1000).toFixed(1) + 'K'
              : (value / 1000000).toFixed(1) + 'M';
          
          return formattedValue;
        });

      // Update measure name labels
      cellsMerge.select('.cell-measure')
        .text((d: any) => {
          const cellWidth = d.x1 - d.x0;
          const cellHeight = d.y1 - d.y0;
          
          // Only show measure names if cell is large enough
          if (cellWidth < 60 || cellHeight < 50) return '';
          
          const measureName = d.data.measureName || measure;
          const maxLength = Math.floor(cellWidth / 7);
          return measureName.length > maxLength 
            ? measureName.substring(0, maxLength - 3) + '...'
            : measureName;
        });

      // Add hover interactions
      cellsMerge
        .on('mouseover', function(event, d) {
          d3.select(this).select('rect')
            .style('stroke', '#333')
            .style('stroke-width', 3);
          
          // Show tooltip with hierarchy information
          if (callbacks?.onPointClick) {
            const path = d.ancestors().reverse().slice(1).map((n: any) => {
              const name = n.data.name;
              // Format dates in path
              if (name && name.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return formatDateForDisplay(new Date(name), false, false);
              }
              return name;
            });
            const tooltipData = [{
              label: 'Path',
              value: path.join(' → '),
              measure: measure,
              measureValue: d.value
            }];
            // You could show a tooltip here
          }
        })
        .on('mouseout', function(event, d) {
          d3.select(this).select('rect')
            .style('stroke', '#fff')
            .style('stroke-width', 2);
        });

      // Update time display
      controlsGroup.select('.time-display')
        .text(isTimeDate ? formatDateForDisplay(new Date(timeValue), false, false) : timeValue);

      // Update slider position
      controlsGroup.select('.time-slider')
        .property('value', timeIndex);

      // Interactive features - apply to merged selection
      if (callbacks) {
        cellsMerge
          .style('cursor', 'pointer')
          .on('mouseover', function(event: any, d: any) {
            d3.select(this).select('rect')
              .transition()
              .duration(100)
              .attr('stroke', '#333')
              .attr('stroke-width', 2);
          })
          .on('mouseout', function() {
            d3.select(this).select('rect')
              .transition()
              .duration(100)
              .attr('stroke', '#fff')
              .attr('stroke-width', 1);
          })
          .on('click', function(event: any, d: any) {
            if (callbacks.onPointClick) {
              const path = d.ancestors().reverse().slice(1).map((n: any) => n.data.name);
              const leafData = data.filter(item => {
                // Check each hierarchy dimension
                const hierarchyMatch = hierarchyDims.every((dim, i) => {
                  const itemValue = dim === 'segment_program_name' 
                    ? item.metadata?.segment_program_name 
                    : item.dimensions[dim];
                  
                  // For date dimensions, compare date part only
                  const isDateDim = itemValue && isDateField(itemValue);
                  if (isDateDim) {
                    const itemDate = new Date(itemValue).toISOString().split('T')[0];
                    return itemDate === path[i];
                  }
                  
                  return itemValue === path[i];
                });
                
                // Check time dimension match
                const timeMatch = !timeDim || !timeValue || (() => {
                  const itemTimeValue = item.dimensions[timeDim];
                  if (isTimeDate && itemTimeValue) {
                    const itemDate = new Date(itemTimeValue).toISOString().split('T')[0];
                    return itemDate === timeValue;
                  }
                  return itemTimeValue === timeValue;
                })();
                
                return hierarchyMatch && timeMatch;
              });
              
              const rect = this.getBoundingClientRect();
              const formattedPath = path.map(p => {
                if (p && p.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  return formatDateForDisplay(new Date(p), false, false);
                }
                return p;
              });
              const formattedTime = isTimeDate && timeValue 
                ? formatDateForDisplay(new Date(timeValue), false, false) 
                : timeValue;
              callbacks.onPointClick(leafData, { x: rect.left, y: rect.top }, 
                `${formattedPath.join(' > ')} at ${formattedTime}`);
            }
          });
      }
    }

    // Create controls
    const buttonSize = 30;
    const sliderWidth = width - 200;

    // Play/Pause button
    const playButton = controlsGroup.append('g')
      .attr('class', 'play-button')
      .style('cursor', 'pointer');

    playButton.append('rect')
      .attr('width', buttonSize)
      .attr('height', buttonSize)
      .attr('rx', 5)
      .attr('fill', '#f0f0f0')
      .attr('stroke', '#333');

    const playIcon = playButton.append('text')
      .attr('x', buttonSize / 2)
      .attr('y', buttonSize / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '16px')
      .text('▶');

    // Time slider
    const sliderGroup = controlsGroup.append('g')
      .attr('transform', `translate(${buttonSize + 20}, 5)`);

    // Slider background
    sliderGroup.append('rect')
      .attr('width', sliderWidth)
      .attr('height', 20)
      .attr('rx', 10)
      .attr('fill', '#e0e0e0');

    // Create foreign object for HTML range input
    const sliderForeign = sliderGroup.append('foreignObject')
      .attr('width', sliderWidth)
      .attr('height', 20);

    const sliderInput = sliderForeign.append('xhtml:input')
      .attr('type', 'range')
      .attr('class', 'time-slider')
      .attr('min', 0)
      .attr('max', timeValues.length - 1)
      .attr('value', 0)
      .style('width', `${sliderWidth}px`)
      .style('margin', '0')
      .on('input', function() {
        currentTimeIndex = +this.value;
        renderTime(currentTimeIndex);
      });

    // Time display
    controlsGroup.append('text')
      .attr('class', 'time-display')
      .attr('x', width - 100)
      .attr('y', 20)
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text(isTimeDate && timeValues[0] ? formatDateForDisplay(new Date(timeValues[0]), false, false) : timeValues[0]);

    // Play/pause functionality
    playButton.on('click', function() {
      isPlaying = !isPlaying;
      playIcon.text(isPlaying ? '❚❚' : '▶');
      
      if (isPlaying) {
        animationInterval = setInterval(() => {
          currentTimeIndex = (currentTimeIndex + 1) % timeValues.length;
          renderTime(currentTimeIndex);
        }, 1000); // 1 second per frame
      } else {
        clearInterval(animationInterval);
      }
    });

    // Add color legend for programs if segmented
    if (hasSegments && programNames.length > 1) {
      // Position legend outside the treemap area
      const legendX = width + 10; // Place to the right of the treemap
      const legendY = 10;
      
      const legendGroup = g.append('g')
        .attr('class', 'treemap-legend')
        .attr('transform', `translate(${legendX}, ${legendY})`);

      legendGroup.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#333')
        .text('Programs:');

      const legendItems = legendGroup.selectAll('.legend-item')
        .data(programNames)
        .enter().append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${(i + 1) * 20})`);

      legendItems.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', d => colorScale(d) as string)
        .attr('stroke', '#333')
        .attr('stroke-width', 1);

      legendItems.append('text')
        .attr('x', 20)
        .attr('y', 12)
        .style('font-size', '11px')
        .style('fill', '#333')
        .text(d => d);
    }

    // Initial render
    renderTime(0);

    // Cleanup on unmount
    return () => {
      if (animationInterval) {
        clearInterval(animationInterval);
      }
    };
  }

  useEffect(() => {
    if (!svgRef.current || !data?.data?.length || !seriesData.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Adjust margins based on legend position and chart type
    const legendPosition = settings.legends?.position || 'top';
    
    // Optimized dynamic margins based on chart type
    const isBarChart = chartType === 'bar';
    const isPieChart = chartType === 'pie';
    const isTreemap = chartType === 'treemap';
    
    // Base margins optimized for each chart type
    const baseBottomMargin = isBarChart ? 60 : (isPieChart ? 20 : 40);
    const axisLabelBottomMargin = ['line', 'area', 'scatter'].includes(chartType) ? 30 : 0;
    
    // Calculate top margin based on legend
    const hasMultipleSeries = seriesData.length > 1;
    const estimatedItemsPerRow = Math.floor(dimensions.width / 180); // Better width calculation
    const estimatedRows = hasMultipleSeries ? Math.ceil(seriesData.length / estimatedItemsPerRow) : 1;
    // Remove top legend space for chart types that don't need it
    const needsTopLegend = hasMultipleSeries && !['heatmap', 'treemap'].includes(chartType);
    const topMarginForLegend = needsTopLegend && legendPosition === 'top'
      ? Math.max(50, estimatedRows * 25 + 15) // Reduced from 30 to 25 per row
      : 15; // Minimal top margin when no legend needed
    
    // Optimized left margin
    const leftMarginWithAxisLabel = ['line', 'area', 'scatter', 'bar'].includes(chartType) ? 65 : 40;
    
    // Right margin optimized - responsive based on viewport width
    const viewportWidth = dimensions.width;
    const isSmallScreen = viewportWidth < 768; // iPad width threshold
    // Significantly increased base margins to prevent edge cutoff
    const baseRightMargin = isPieChart ? 200 : 220;
    // Treemap needs extra right margin for its built-in legend
    const treemapRightMargin = isTreemap ? 320 : 0;
    const responsiveRightMargin = isSmallScreen ? baseRightMargin * 1.5 : baseRightMargin;
    const rightMargin = legendPosition === 'right' ? 300 : (treemapRightMargin || responsiveRightMargin);
    
    // Optimize margins to use full canvas space
    const titleSpace = chartType === 'heatmap' ? 25 : 0; // Minimal space for title
    
    const margin = {
      top: Math.max(10, topMarginForLegend + titleSpace), // Very minimal top margin
      right: Math.min(rightMargin, 120), // Further reduced right margin
      bottom: Math.min(baseBottomMargin + axisLabelBottomMargin, 60), // Reduced bottom margin
      left: leftMarginWithAxisLabel
    };
    
    console.log('Chart margins:', margin, 'Chart type:', chartType);
    const width = dimensions.width - margin.left - margin.right;
    
    // Increase height for charts with positive and negative values
    const heightMultiplier = (hasPositiveAndNegative && ['line', 'area', 'bar'].includes(chartType)) ? 1.5 : 1;
    const baseHeight = dimensions.height * heightMultiplier;
    const height = baseHeight - margin.top - margin.bottom;

    // Create main group
    // For heatmaps, adjust the transform to account for title positioning
    const adjustedTopMargin = chartType === 'heatmap' ? margin.top : margin.top;
    const g = svg
      .append('g')
      .attr('class', 'chart-content')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add a subtle zero line when chart contains positive and negative values
    if (hasPositiveAndNegative && ['line', 'area', 'bar'].includes(chartType)) {
      // This will be drawn by the individual chart renderers, but we can add a note
      console.log('Chart contains both positive and negative values - height increased by 50%');
    }

    // Render based on chart type with multi-series support
    const chartCallbacks = {
      onPointClick: openDataViewer,
      onBrushEnd: (selection: [[number, number], [number, number]] | null) => {
        setBrushSelection(selection);
      }
    };

    switch (chartType) {
      case 'line':
        // Pass dimension metadata to help determine x-axis
        const dimensionConfig = dimensionConfigs?.[0] || data.metadata?.dimensions?.[0]; // First dimension is x-axis
        renderMultiSeriesLineChart(g, seriesData, width, height, settings, chartCallbacks, dimensionConfig);
        break;
      case 'bar':
        renderBarChart(g, data.data, width, height, settings, chartCallbacks, showZeroValues, setShowZeroValues, data.metadata, dimensionConfigs);
        break;
      case 'area':
        // Use multi-series approach for area charts too
        renderMultiSeriesAreaChart(g, seriesData, width, height, settings, chartCallbacks, dimensionConfigs?.[0] || data.metadata?.dimensions?.[0]);
        break;
      case 'pie':
        renderPieChart(g, data.data, width, height, settings, data.metadata);
        break;
      case 'scatter':
        renderScatterPlot(g, data.data, width, height, settings, chartCallbacks, data.metadata);
        break;
      case 'heatmap':
        renderHeatmap(g, data.data, width, height, settings, chartCallbacks, data.metadata, svg, dimensionConfigs);
        break;
      case 'box_plot':
        renderBoxPlot(g, data.data, width, height, settings, chartCallbacks);
        break;
      case 'histogram':
        renderHistogram(g, data.data, width, height, settings, chartCallbacks);
        break;
      case 'treemap':
        renderTreeMap(g, data.data, width, height, settings, chartCallbacks);
        break;
      case 'spatial_effectiveness':
        renderSpatialEffectivenessMap(g, data.data, width, height, settings, chartCallbacks);
        break;
      default:
        renderMultiSeriesLineChart(g, seriesData, width, height, settings, chartCallbacks, dimensionConfigs?.[0] || data.metadata?.dimensions?.[0]);
    }

    // Add legend if enabled and we have multiple series (but not for treemaps/heatmaps which have their own legend)
    if (showLegend && seriesData.length > 1 && !['treemap', 'heatmap'].includes(chartType)) {
      const legendPosition = settings.legends?.position || 'top';
      let legendX, legendY;
      
      switch (legendPosition) {
        case 'top':
          legendX = margin.left + width / 2;
          legendY = margin.top - 10;
          break;
        case 'bottom':
          legendX = margin.left + width / 2;
          legendY = margin.top + height + 30;
          break;
        case 'left':
          legendX = margin.left - 10;
          legendY = margin.top + height / 2;
          break;
        case 'right':
          legendX = width + margin.left + 10;
          legendY = margin.top;
          break;
        case 'topLeft':
          legendX = margin.left;
          legendY = margin.top - 10;
          break;
        case 'topRight':
          legendX = margin.left + width - 100; // Adjust based on legend width
          legendY = margin.top - 10;
          break;
        case 'bottomLeft':
          legendX = margin.left;
          legendY = margin.top + height + 30;
          break;
        case 'bottomRight':
          legendX = margin.left + width - 100; // Adjust based on legend width
          legendY = margin.top + height + 30;
          break;
        default:
          legendX = width + margin.left + 10;
          legendY = margin.top;
      }
      
      renderLegend(svg, legendItems, legendX, legendY, handleSeriesToggle, legendPosition);
    }

    // Add title if provided
    if (settings.title?.show && settings.title?.text) {
      svg
        .append('text')
        .attr('x', dimensions.width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(settings.title.text);
    }

  }, [data, settings, chartType, seriesData, legendItems, handleSeriesToggle, hasPositiveAndNegative]);

  // SVG height is already calculated above for use in fitToData

  return (
    <div 
      ref={containerRef} 
      className={`d3-chart-container ${className}`}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: isDashboardWidget ? '0' : '8px',
        boxShadow: isDashboardWidget ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        border: isDashboardWidget ? 'none' : '1px solid #e5e7eb',
        padding: isDashboardWidget ? '8px' : '16px',
        position: 'relative',
        overflow: 'hidden', // Container should not overflow
        width: '100%',
        height: '100%'
      }}
      onContextMenu={(e) => {
        if (isDashboardWidget && onContextMenu) {
          e.preventDefault();
          onContextMenu(e);
        }
      }}
    >
      {/* Help text when chart is pannable - Hide in dashboard view */}
      {(dimensions.width > 800 || svgHeight > 500) && !className?.includes('dashboard-widget-chart') && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            zIndex: 10,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            opacity: showNavigationHint ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
            visibility: showNavigationHint ? 'visible' : 'hidden'
          }}
        >
          Two-finger swipe to pan • Pinch to zoom • Click and drag to select data
        </div>
      )}
      
      {/* Zoom/Pan controls - Always show */}
      {(
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            display: 'flex',
            gap: '8px',
            zIndex: 20
          }}
        >
        <button
          onClick={fitToData}
          style={{
            padding: '4px 8px',
            backgroundColor: '#10B981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}
        >
          Fit to Data
        </button>
        {(scale !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
          <>
            <button
              onClick={() => {
                setScale(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}
            >
              Reset View
            </button>
            <div
              style={{
                padding: '4px 8px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                borderRadius: '4px',
                fontSize: '12px',
                pointerEvents: 'none'
              }}
            >
              {Math.round(scale * 100)}%
            </div>
          </>
        )}
      </div>
      )}
      <div 
        ref={scrollContainerRef}
        onMouseEnter={() => {
          // Show tooltip after a short delay
          navigationHintTimeoutRef.current = setTimeout(() => {
            setShowNavigationHint(true);
          }, 500); // 500ms delay
        }}
        onMouseLeave={() => {
          // Clear timeout and hide tooltip immediately
          if (navigationHintTimeoutRef.current) {
            clearTimeout(navigationHintTimeoutRef.current);
          }
          setShowNavigationHint(false);
        }}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '600px', // Fixed max height for consistent experience
          overflow: 'hidden', // Hidden to enable panning
          position: 'relative',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          backgroundColor: '#fafafa', // Background for scroll area
          cursor: 'default'
        }}
      >
        <div
          style={{
            width: dimensions.width,
            height: svgHeight,
            position: 'relative',
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: 'top left',
            transition: 'transform 0.1s ease-out',
            pointerEvents: 'auto'
          }}
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={svgHeight}
            className="d3-chart"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              background: 'linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)',
              pointerEvents: 'auto'
            }}
          />
        </div>
      </div>
      
      {/* DataViewer for drill-down functionality */}
      {dataViewer.isVisible && (
        <DataViewer
          data={dataViewer.data}
          isVisible={dataViewer.isVisible}
          onClose={closeDataViewer}
          position={dataViewer.position}
          title={dataViewer.title}
          config={{
            dimensions: data?.metadata?.dimensions || [],
            measures: data?.metadata?.measures || []
          }}
          brushSelection={brushSelection}
        />
      )}
    </div>
  );
};

// Helper function to render empty state message
// Helper function to aggregate data based on measure configuration
function aggregateData(data: any[], metadata?: any): any[] {
  if (!data.length) return data;
  
  // Get dimensions and measures from first data point
  const dimensions = Object.keys(data[0].dimensions);
  const measures = Object.keys(data[0].measures);
  
  // Create a map to track which measures need aggregation
  const measureAggregations = new Map<string, string>();
  
  if (metadata?.measures) {
    measures.forEach(measureKey => {
      const measureMeta = metadata.measures.find((m: any) => 
        measureKey.includes(m.field) || measureKey === m.name
      );
      if (measureMeta?.aggregation && measureMeta.aggregation !== 'none') {
        measureAggregations.set(measureKey, measureMeta.aggregation);
      }
    });
  }
  
  // If no measures need aggregation, return original data
  if (measureAggregations.size === 0) {
    return data;
  }
  
  // Group data by all dimension values
  const groupedData = new Map<string, any[]>();
  
  data.forEach(d => {
    const key = dimensions.map(dim => d.dimensions[dim] || '').join('|||');
    if (!groupedData.has(key)) {
      groupedData.set(key, []);
    }
    groupedData.get(key)!.push(d);
  });
  
  // Apply aggregation to each group
  return Array.from(groupedData.entries()).map(([groupKey, groupRecords]) => {
    const dimensionValues: any = {};
    dimensions.forEach((dim, i) => {
      dimensionValues[dim] = groupKey.split('|||')[i];
    });
    
    const aggregatedMeasures: any = {};
    
    measures.forEach(measureKey => {
      const aggregationType = measureAggregations.get(measureKey) || 'none';
      const values = groupRecords.map(r => +r.measures[measureKey]).filter(v => !isNaN(v));
      
      if (aggregationType === 'none' || values.length === 0) {
        // For 'none' aggregation or no valid values, use first value
        aggregatedMeasures[measureKey] = groupRecords[0].measures[measureKey];
      } else {
        switch (aggregationType) {
          case 'sum':
            aggregatedMeasures[measureKey] = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            aggregatedMeasures[measureKey] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'count':
            aggregatedMeasures[measureKey] = values.length;
            break;
          case 'min':
            aggregatedMeasures[measureKey] = Math.min(...values);
            break;
          case 'max':
            aggregatedMeasures[measureKey] = Math.max(...values);
            break;
          case 'median':
            const sorted = values.sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            aggregatedMeasures[measureKey] = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            break;
          case 'distinct':
            aggregatedMeasures[measureKey] = new Set(values).size;
            break;
          case 'first':
            aggregatedMeasures[measureKey] = values[0] || 0;
            break;
          case 'last':
            aggregatedMeasures[measureKey] = values[values.length - 1] || 0;
            break;
          default:
            aggregatedMeasures[measureKey] = values[0] || 0;
        }
      }
    });
    
    // Return aggregated data point with same structure
    return {
      dimensions: dimensionValues,
      measures: aggregatedMeasures,
      // Keep reference to original records for drill-down
      _originalRecords: groupRecords
    };
  });
}

function renderEmptyState(g: any, width: number, height: number, title: string, subtitle?: string) {
  const messageGroup = g.append('g')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);
  
  // Background circle
  messageGroup.append('circle')
    .attr('r', 60)
    .attr('fill', '#f9fafb')
    .attr('stroke', '#e5e7eb')
    .attr('stroke-width', 2);
  
  // Icon background
  messageGroup.append('circle')
    .attr('cy', -15)
    .attr('r', 25)
    .attr('fill', '#eff6ff');
  
  // Bar chart icon using paths
  const iconGroup = messageGroup.append('g')
    .attr('transform', 'translate(-12, -27)');
  
  iconGroup.append('rect')
    .attr('x', 0)
    .attr('y', 12)
    .attr('width', 6)
    .attr('height', 12)
    .attr('fill', '#3b82f6');
  
  iconGroup.append('rect')
    .attr('x', 9)
    .attr('y', 6)
    .attr('width', 6)
    .attr('height', 18)
    .attr('fill', '#3b82f6');
  
  iconGroup.append('rect')
    .attr('x', 18)
    .attr('y', 0)
    .attr('width', 6)
    .attr('height', 24)
    .attr('fill', '#3b82f6');
  
  // Main message
  messageGroup.append('text')
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px')
    .style('font-weight', '600')
    .style('fill', '#374151')
    .text(title);
  
  // Subtitle if provided
  if (subtitle) {
    messageGroup.append('text')
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#6b7280')
      .text(subtitle);
  }
  
  // Additional help text for zero values
  const hasZeroValues = g.node()?.__data__?.some((d: any) => 
    Object.values(d.measures || {}).some((v: any) => +v === 0)
  );
  
  if (hasZeroValues) {
    messageGroup.append('text')
      .attr('y', 60)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#9ca3af')
      .text('Tip: Some values may be zero');
  }
}

function renderBarChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any, showZeroValues?: boolean, setShowZeroValues?: (value: boolean) => void, metadata?: any, dimensionConfigs?: any[]) {
  if (!data.length) {
    renderEmptyState(g, width, height, 'No data available', 'Check your filters and data source configuration');
    return;
  }

  // Get the first dimension and measure for basic bar chart
  const firstDimKey = Object.keys(data[0].dimensions)[0];
  const firstMeasureKey = Object.keys(data[0].measures)[0];

  if (!firstDimKey || !firstMeasureKey) return;
  
  // Get measure display name from metadata
  let measureDisplayName = firstMeasureKey;
  if (metadata?.measures) {
    const measureMeta = metadata.measures.find((m: any) => 
      firstMeasureKey.includes(m.field) || firstMeasureKey === m.name
    );
    if (measureMeta?.displayName) {
      measureDisplayName = measureMeta.displayName;
    }
  }

  // Apply aggregation based on measure configuration
  const processedData = aggregateData(data, metadata);
  
  // Create composite keys if we have multiple dimensions (including segments)
  const allDimKeys = Object.keys(processedData[0].dimensions);
  const hasMultipleDimensions = allDimKeys.length > 1;
  
  // If we have multiple dimensions, render as grouped bar chart inline
  // For now, disable grouped bar chart for 3+ dimensions as it's too complex
  if (hasMultipleDimensions && allDimKeys.length === 2) {
    console.log('Rendering grouped bar chart for 2 dimensions:', allDimKeys);
    
    // Inline grouped bar chart implementation
    const dimensionKeys = Object.keys(processedData[0].dimensions);
    const firstMeasureKey = Object.keys(processedData[0].measures)[0];
    
    if (!dimensionKeys.length || !firstMeasureKey) {
      console.error('Missing dimensions or measures for grouped bar chart');
      return;
    }

    // The first dimension will be our X-axis grouping
    const xDimKey = dimensionKeys[0];
    const groupDimKeys = dimensionKeys.slice(1);
    
    // Get unique values for x-axis - clean up IDs and show human-readable names
    let xValues = [...new Set(processedData.map(d => {
      const value = d.dimensions[xDimKey];
      // For any field with "(ID: xxx)", extract just the name part
      if (value && value.includes('(ID:')) {
        return value.split('(ID:')[0].trim();
      }
      return value;
    }))].filter(v => v);
    
    // Apply sorting based on settings
    const xSort = settings?.axes?.x?.sort || 'none';
    if (xSort !== 'none') {
      // Helper function to sort values
      const sortXValues = () => {
        // Check if values are dates
        const isDate = xValues.every(v => {
          const parsed = new Date(v);
          return !isNaN(parsed.getTime()) && v.toString().includes('-');
        });
        
        if (xSort === 'asc') {
          if (isDate) {
            return xValues.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          }
          return xValues.sort((a, b) => {
            if (typeof a === 'string' && typeof b === 'string') {
              return a.localeCompare(b);
            }
            return a - b;
          });
        } else if (xSort === 'desc') {
          if (isDate) {
            return xValues.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          }
          return xValues.sort((a, b) => {
            if (typeof a === 'string' && typeof b === 'string') {
              return b.localeCompare(a);
            }
            return b - a;
          });
        } else if (xSort === 'value_asc' || xSort === 'value_desc') {
          // Sort by aggregated measure values
          const valueMap = new Map();
          xValues.forEach(val => {
            const sum = data
              .filter(d => {
                const dVal = d.dimensions[xDimKey];
                const cleanDVal = dVal && dVal.includes('(ID:') ? dVal.split('(ID:')[0].trim() : dVal;
                return cleanDVal === val;
              })
              .reduce((acc, d) => acc + (+d.measures[firstMeasureKey] || 0), 0);
            valueMap.set(val, sum);
          });
          
          return xValues.sort((a, b) => {
            const valA = valueMap.get(a) || 0;
            const valB = valueMap.get(b) || 0;
            return xSort === 'value_asc' ? valA - valB : valB - valA;
          });
        }
        
        return xValues;
      };
      
      xValues = sortXValues();
    }
    
    console.log('X-axis values:', xValues);
    console.log('First data point dimensions:', data[0].dimensions);
    
    // Get unique values for grouping - coalesce sites by name
    const groupValues = [...new Set(data.map(d => 
      groupDimKeys.map(key => {
        const value = d.dimensions[key];
        // For site_id fields, extract just the site name (before "(ID: xxx)")
        if (key === 'site_id' && value && value.includes('(ID:')) {
          return value.split('(ID:')[0].trim();
        }
        // For program_id, also clean up
        if (key === 'program_id' && value && value.includes('(ID:')) {
          return value.split('(ID:')[0].trim();
        }
        return value;
      }).join(' | ')
    ))].filter(v => v);

    console.log('Grouped bar chart - X values:', xValues);
    console.log('Grouped bar chart - Group values:', groupValues);
    console.log('Grouped bar chart - Sample data point:', data[0]);

    // Filter out rows with null values for the chart
    const validData = data.filter(d => d.measures[firstMeasureKey] !== null && d.measures[firstMeasureKey] !== undefined);
    
    if (validData.length === 0) {
      renderEmptyState(g, width, height, 'No valid data', 'All temperature readings are null');
      return;
    }

    // Create scales
    const barPadding = 20; // Add padding to prevent edge cutoff
    const x0Scale = d3.scaleBand()
      .domain(xValues)
      .range([barPadding, width - barPadding])
      .paddingInner(0.1);

    const x1Scale = d3.scaleBand()
      .domain(groupValues)
      .range([0, x0Scale.bandwidth()])
      .padding(0.05);

    // Find min and max values for Y scale from valid data only
    const values = validData.map(d => +d.measures[firstMeasureKey]);
    const minValue = d3.min(values) || 0;
    const maxValue = d3.max(values) || 0;
    
    // Calculate domain with padding
    const padding = (maxValue - minValue) * 0.1;
    const yDomain: [number, number] = minValue < 0 && maxValue > 0 
      ? [Math.min(0, minValue - padding), maxValue + padding]  // Include zero if data crosses it
      : [minValue - padding, maxValue + padding];
    
    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .range([height, 0]);

    // Create color scale using settings palette
    const colorScale = d3.scaleOrdinal()
      .domain(groupValues)
      .range(resolveColorPalette(settings.colors?.palette, COLOR_PALETTES.set3));

    // Add axes
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x0Scale));

    // Format x-axis labels
    xAxis.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-30)')
      .text((d: any) => {
        const text = String(d);
        // Clean up IDs and UUIDs from labels
        if (text.includes('(ID:')) {
          const cleaned = text.split('(ID:')[0].trim();
          return cleaned.length > 20 ? cleaned.substring(0, 18) + '...' : cleaned;
        }
        return text.length > 20 ? text.substring(0, 18) + '...' : text;
      });

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add axis labels
    // X-axis label
    const xAxisLabel = dimensionConfigs?.[0]?.displayName || formatDimensionName(xDimKey);
    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + 50})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(xAxisLabel);

    // Y-axis label - clean up measure name to show only unit
    let cleanMeasureName = measureDisplayName || firstMeasureKey;
    if (cleanMeasureName.includes(' - ')) {
      cleanMeasureName = cleanMeasureName.split(' - ')[0].trim();
    } else if (cleanMeasureName.includes(' (')) {
      cleanMeasureName = cleanMeasureName.split(' (')[0].trim();
    }
    
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -(height / 2))
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(cleanMeasureName);

    // Add zero line if data crosses zero
    if (yDomain[0] < 0 && yDomain[1] > 0) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', yScale(0))
        .attr('y2', yScale(0))
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.7)
        .attr('class', 'zero-line');
    }

    // Create groups for each x value
    const barGroups = g.selectAll('.bar-group')
      .data(xValues)
      .enter().append('g')
      .attr('class', 'bar-group')
      .attr('transform', d => {
        const xPos = x0Scale(d);
        return xPos !== undefined ? `translate(${xPos}, 0)` : 'translate(0, 0)';
      });

    // Add bars within each group
    barGroups.each(function(xValue) {
      const group = d3.select(this);
      const groupData = validData.filter(d => {
        const originalValue = d.dimensions[xDimKey];
        // Clean the original value the same way we cleaned xValues
        const cleanedValue = originalValue && originalValue.includes('(ID:') 
          ? originalValue.split('(ID:')[0].trim() 
          : originalValue;
        return cleanedValue === xValue;
      });
      
      group.selectAll('rect')
        .data(groupData)
        .enter().append('rect')
        .attr('x', d => {
          const groupKey = groupDimKeys.map(key => {
            const value = d.dimensions[key];
            // For site_id fields, extract just the site name (before "(ID: xxx)")
            if (key === 'site_id' && value && value.includes('(ID:')) {
              return value.split('(ID:')[0].trim();
            }
            // For program_id, also clean up
            if (key === 'program_id' && value && value.includes('(ID:')) {
              return value.split('(ID:')[0].trim();
            }
            return value;
          }).join(' | ');
          const xPos = x1Scale(groupKey);
          return xPos !== undefined ? xPos : 0;
        })
        .attr('y', d => {
          const value = +d.measures[firstMeasureKey];
          return value >= 0 ? yScale(value) : yScale(0);
        })
        .attr('width', x1Scale.bandwidth())
        .attr('height', d => {
          const value = +d.measures[firstMeasureKey];
          return Math.abs(yScale(value) - yScale(0));
        })
        .attr('fill', d => {
          const groupKey = groupDimKeys.map(key => {
            const value = d.dimensions[key];
            // For site_id fields, extract just the site name (before "(ID: xxx)")
            if (key === 'site_id' && value && value.includes('(ID:')) {
              return value.split('(ID:')[0].trim();
            }
            // For program_id, also clean up
            if (key === 'program_id' && value && value.includes('(ID:')) {
              return value.split('(ID:')[0].trim();
            }
            return value;
          }).join(' | ');
          return colorScale(groupKey);
        })
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d: any) {
          d3.select(this).style('opacity', 0.8);
          if (callbacks?.onHover && showTooltips) {
            const rect = this.getBoundingClientRect();
            const position = { x: rect.left + rect.width / 2, y: rect.top };
            const groupKey = groupDimKeys.map(key => {
              const value = d.dimensions[key];
              // For site_id fields, extract just the site name (before "(ID: xxx)")
              if (key === 'site_id' && value && value.includes('(ID:')) {
                return value.split('(ID:')[0].trim();
              }
              // For program_id, also clean up
              if (key === 'program_id' && value && value.includes('(ID:')) {
                return value.split('(ID:')[0].trim();
              }
              return value;
            }).join(' | ');
            const value = d.measures[firstMeasureKey];
            const formattedValue = formatMeasureValue(value);
            callbacks.onHover([d], position, `${groupKey}: ${formattedValue} (${measureDisplayName})`);
          }
        })
        .on('mouseout', function() {
          d3.select(this).style('opacity', 1);
          if (callbacks?.onHoverEnd) {
            callbacks.onHoverEnd();
          }
        });
    });

    // Note: For grouped bar charts, the legend is handled by the main chart component
    // We need to ensure the main component knows about all the groups
    console.log('Bar chart groupValues for legend:', groupValues);
    
    // IMPORTANT: The issue is that the main chart component creates a legend based on seriesData
    // which only has 2 series (Temperature and Humidity), but the bar chart creates 6 groups
    // (3 dates × 2 measures). The bar chart's internal legend was positioned outside the visible area.
    // The proper fix would be to either:
    // 1. Update generateSeriesData to properly handle date segments within programs
    // 2. Or create a custom legend for bar charts that shows the actual groups

    // Add brush selection for grouped bar charts
    if (callbacks && settings.interactions.brush.enabled) {
      let brushing = false;
      
      const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on('start', function() {
          brushing = true;
        })
        .on('brush', function(event) {
          if (!brushing) return;
          
          const selection = event.selection;
          if (selection) {
            const [[x0, y0], [x1, y1]] = selection;
            
            // Highlight bars within selection - need to handle grouped structure
            g.selectAll('.bar-group').each(function(this: any) {
              const group = d3.select(this);
              const groupTransform = group.attr('transform');
              const groupX = groupTransform ? parseFloat(groupTransform.match(/translate\(([^,]+)/)?.[1] || '0') : 0;
              
              group.selectAll('rect')
                .style('opacity', function(this: any) {
                  const rect = d3.select(this);
                  const barX = groupX + (+rect.attr('x'));
                  const barY = +rect.attr('y');
                  const barWidth = +rect.attr('width');
                  const barHeight = +rect.attr('height');
                  
                  // Check if bar overlaps with brush selection
                  const barRight = barX + barWidth;
                  const barBottom = barY + barHeight;
                  
                  return (barX < x1 && barRight > x0 && barY < y1 && barBottom > y0) ? 0.8 : 0.3;
                });
            });
          }
        })
        .on('end', function(event) {
          if (!brushing) return;
          brushing = false;
          
          const selection = event.selection;
          if (selection) {
            const [[x0, y0], [x1, y1]] = selection;
            const brushedData: any[] = [];
            
            // For grouped bars, we need to check each bar within each group
            g.selectAll('.bar-group').each(function(this: any) {
              const group = d3.select(this);
              const groupTransform = group.attr('transform');
              const groupX = groupTransform ? parseFloat(groupTransform.match(/translate\(([^,]+)/)?.[1] || '0') : 0;
              
              group.selectAll('rect').each(function(this: any, d: any) {
                const rect = d3.select(this);
                const barX = groupX + (+rect.attr('x'));
                const barY = +rect.attr('y');
                const barWidth = +rect.attr('width');
                const barHeight = +rect.attr('height');
                
                // Check if bar overlaps with brush selection
                const barRight = barX + barWidth;
                const barBottom = barY + barHeight;
                
                if (barX < x1 && barRight > x0 && barY < y1 && barBottom > y0) {
                  // Push the actual data point, not the visual representation
                  brushedData.push(d);
                }
              });
            });
            
            if (brushedData.length > 0 && callbacks.onPointClick) {
              const position = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
              callbacks.onPointClick(brushedData, position, `Selected Bars (${brushedData.length})`);
            }
            
            // Clear brush selection
            d3.select(this).call(brush.move, null);
          }
          
          // Reset all bars to normal opacity
          g.selectAll('.bar-group').selectAll('rect')
            .style('opacity', 0.8);
        });

      // Append brush last so it's on top of bars
      g.append('g')
        .attr('class', 'brush')
        .call(brush)
        .raise(); // Ensure brush is on top
    }

    return; // Exit early for grouped chart
  }
  
  // Create a unique key for each data point
  const getCompositeKey = (d: any) => {
    if (hasMultipleDimensions) {
      // Combine all dimension values for grouping
      const key = allDimKeys.map(key => d.dimensions[key] || '').join(' | ');
      return key;
    }
    return d.dimensions[firstDimKey];
  };
  
  // Debug logging for troubleshooting
  console.log('Bar chart debug:', {
    hasMultipleDimensions,
    allDimKeys,
    firstDataPoint: processedData[0],
    sampleCompositeKey: getCompositeKey(processedData[0]),
    originalDataLength: data.length,
    processedDataLength: processedData.length
  });

  // Check if all values are zero
  const allZero = processedData.every(d => +d.measures[firstMeasureKey] === 0);
  if (allZero) {
    renderEmptyState(g, width, height, 'All values are zero', 'This may indicate no growth activity or missing data');
  }

  // Use most of the available height, leaving room for labels
  const adjustedHeight = height;

  // Detect if the dimension is a date for proper sorting
  const isDateDimension = isDateField(processedData[0].dimensions[firstDimKey]);
  
  // Filter out zero/null values to avoid sparse charts
  let filteredData = processedData;
  let hiddenCount = 0;
  
  // Filter based on showZeroValues setting
  const originalCount = processedData.length;
  if (!showZeroValues) {
    filteredData = processedData.filter(d => {
      const value = d.measures[firstMeasureKey];
      return value !== null && value !== undefined && +value !== 0;
    });
    hiddenCount = originalCount - filteredData.length;
  }
  
  // If all data was filtered out, show empty state
  if (filteredData.length === 0) {
    renderEmptyState(g, width, height, 'No non-zero values found', 'All values are zero or missing');
    return;
  }
  
  // Apply sorting based on settings
  const xSort = settings?.axes?.x?.sort || 'none';
  
  if (xSort !== 'none') {
    if (xSort === 'asc') {
      if (isDateDimension) {
        filteredData = [...filteredData].sort((a, b) => 
          new Date(a.dimensions[firstDimKey]).getTime() - new Date(b.dimensions[firstDimKey]).getTime()
        );
      } else {
        filteredData = [...filteredData].sort((a, b) => {
          const keyA = getCompositeKey(a);
          const keyB = getCompositeKey(b);
          if (typeof keyA === 'string' && typeof keyB === 'string') {
            return keyA.localeCompare(keyB);
          }
          return keyA - keyB;
        });
      }
    } else if (xSort === 'desc') {
      if (isDateDimension) {
        filteredData = [...filteredData].sort((a, b) => 
          new Date(b.dimensions[firstDimKey]).getTime() - new Date(a.dimensions[firstDimKey]).getTime()
        );
      } else {
        filteredData = [...filteredData].sort((a, b) => {
          const keyA = getCompositeKey(a);
          const keyB = getCompositeKey(b);
          if (typeof keyA === 'string' && typeof keyB === 'string') {
            return keyB.localeCompare(keyA);
          }
          return keyB - keyA;
        });
      }
    } else if (xSort === 'value_asc') {
      filteredData = [...filteredData].sort((a, b) => 
        +a.measures[firstMeasureKey] - +b.measures[firstMeasureKey]
      );
    } else if (xSort === 'value_desc') {
      filteredData = [...filteredData].sort((a, b) => 
        +b.measures[firstMeasureKey] - +a.measures[firstMeasureKey]
      );
    }
  } else if (isDateDimension) {
    // Default date sorting if no sort specified
    filteredData = [...filteredData].sort((a, b) => 
      new Date(a.dimensions[firstDimKey]).getTime() - new Date(b.dimensions[firstDimKey]).getTime()
    );
  }

  const domainKeys = filteredData.map(d => getCompositeKey(d));
  console.log('Bar chart X-axis domain keys:', domainKeys);
  console.log('Filtered data sample:', filteredData.slice(0, 3));
  
  // Small padding for scale aesthetics (margins already applied at container level)
  const responsivePadding = 40;
  
  const xScale = d3.scaleBand()
    .domain(domainKeys)
    .range([responsivePadding, width - responsivePadding])
    .padding(0.1);

  // Calculate Y domain with auto-scaling support
  const values = filteredData.map(d => +d.measures[firstMeasureKey]).filter(v => !isNaN(v));
  const minValue = d3.min(values) || 0;
  const maxValue = d3.max(values) || 0;
  
  // Debug logging for auto-scale
  console.log('Bar Chart Y-axis settings:', {
    autoScale: settings.axes?.y?.autoScale,
    includeZero: settings.axes?.y?.includeZero,
    axesY: settings.axes?.y,
    values: values.slice(0, 5),
    minValue,
    maxValue
  });
  
  let yDomain: [number, number];
  if (settings.axes?.y?.autoScale !== false) {
    // Auto-scale to fit data
    const padding = (maxValue - minValue) * 0.1;
    yDomain = [minValue - padding, maxValue + padding];
    if (settings.axes?.y?.includeZero) {
      yDomain = [Math.min(0, yDomain[0]), Math.max(0, yDomain[1])];
    }
    console.log('Using auto-scale, yDomain:', yDomain);
  } else {
    // Traditional scaling (start from 0)
    yDomain = [0, maxValue * 1.1];
    console.log('Using traditional scale, yDomain:', yDomain);
  }
  
  const yScale = d3.scaleLinear()
    .domain(yDomain)
    .range([adjustedHeight, 0]);

  // Use the color palette from settings for bar charts
  const barColorPalette = resolveColorPalette(settings.colors?.palette, COLOR_PALETTES.set3);
  const colorScale = d3.scaleOrdinal(barColorPalette);

  // Create smart X-axis
  let xAxis: any;
  if (isDateDimension) {
    // For date dimensions, show fewer formatted ticks
    const maxLabels = Math.max(3, Math.floor(width / 80));
    const step = Math.max(1, Math.ceil(filteredData.length / maxLabels));
    const tickValues = filteredData.filter((_, i) => i % step === 0).map(d => getCompositeKey(d));
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(tickValues)
      .tickFormat(d => {
        // Extract the original date from the composite key
        const dateStr = hasMultipleDimensions ? d.split(' | ')[0] : d;
        return formatDateForDisplay(new Date(dateStr), false, false);
      });
  } else {
    // For non-date dimensions, smart label spacing
    const maxLabels = Math.max(3, Math.floor(width / 60));
    const step = Math.max(1, Math.ceil(filteredData.length / maxLabels));
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(filteredData.filter((_, i) => i % step === 0).map(d => getCompositeKey(d)));
  }

  // Add axes with smart formatting
  const xAxisGroup = g.append('g')
    .attr('transform', `translate(0,${adjustedHeight})`)
    .call(xAxis);
    
  // Smart label formatting based on available space
  const labelWidth = xScale.bandwidth();
  const maxLabelChars = Math.max(5, Math.floor(labelWidth / 6)); // Approximate characters that fit
  
  if (filteredData.length > 6 || labelWidth < 60) {
    // Rotate labels for better fit
    xAxisGroup.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-30)')
      .text(function(d: any) {
        const text = String(d);
        // For composite keys with 3+ dimensions, show abbreviated version
        if (text.includes(' | ')) {
          const parts = text.split(' | ');
          if (parts.length >= 3) {
            // For 3+ dimensions, show first and last part abbreviated
            const first = parts[0].substring(0, 8);
            const last = parts[parts.length - 1];
            // If last part is a date, format it
            if (last && last.match(/^\d{4}-\d{2}-\d{2}/)) {
              return `${first}...${formatDateForDisplay(new Date(last), false, false)}`;
            }
            return `${first}...${last.substring(0, 8)}`;
          }
          // For 2 dimensions, show first part
          const firstPart = parts[0];
          return firstPart.length > 12 ? firstPart.substring(0, 10) + '...' : firstPart;
        }
        // Truncate with ellipsis if too long
        return text.length > 12 ? text.substring(0, 10) + '...' : text;
      })
      .append('title')
      .text((d: any) => String(d)); // Full text on hover
  } else {
    // For fewer bars, just truncate if needed
    xAxisGroup.selectAll('text')
      .text(function(d: any) {
        const text = String(d);
        return text.length > maxLabelChars ? text.substring(0, maxLabelChars - 2) + '..' : text;
      })
      .append('title')
      .text((d: any) => String(d)); // Full text on hover
  }

  // Configure Y-axis with better tick formatting
  const yAxis = d3.axisLeft(yScale)
    .ticks(Math.min(10, Math.floor(height / 40))) // Reasonable number of ticks
    .tickFormat(d => d3.format('.0f')(d)); // No decimals for cleaner look
    
  g.append('g')
    .call(yAxis);

  // Add axis labels
  // X-axis label
  const xAxisLabel = dimensionConfigs?.[0]?.displayName || formatDimensionName(firstDimKey);
  g.append('text')
    .attr('transform', `translate(${width / 2}, ${adjustedHeight + 50})`)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#333')
    .text(xAxisLabel);

  // Y-axis label - clean up measure name to show only unit
  let cleanMeasureName = measureDisplayName;
  if (cleanMeasureName.includes(' - ')) {
    cleanMeasureName = cleanMeasureName.split(' - ')[0].trim();
  } else if (cleanMeasureName.includes(' (')) {
    cleanMeasureName = cleanMeasureName.split(' (')[0].trim();
  }
  
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -40)
    .attr('x', -(adjustedHeight / 2))
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#333')
    .text(cleanMeasureName);

  // Add bars with enhanced interactions
  const bars = g.selectAll('.bar')
    .data(filteredData)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', (d: any) => {
      const key = getCompositeKey(d);
      const xPos = xScale(key);
      if (xPos === undefined) {
        console.warn('X position undefined for key:', key);
        return 0;
      }
      return xPos;
    })
    .attr('width', xScale.bandwidth())
    .attr('y', (d: any) => {
      const value = +d.measures[firstMeasureKey];
      return value >= 0 ? yScale(value) : yScale(0);
    })
    .attr('height', (d: any) => {
      const value = +d.measures[firstMeasureKey];
      if (value >= 0) {
        return Math.max(0, adjustedHeight - yScale(value));
      } else {
        return Math.max(0, yScale(value) - adjustedHeight);
      }
    })
    .attr('fill', (d: any, i: number) => {
      // Use the color palette from settings for individual bars
      const barColors = resolveColorPalette(settings.colors?.palette, COLOR_PALETTES.set3);
      return barColors[i % barColors.length];
    })
    .style('cursor', 'pointer')
    .style('opacity', 0.8);

  // Enhanced hover and click interactions
  if (callbacks) {
    bars
      .on('mouseover', function(event, d) {
        d3.select(this).style('opacity', 1);
        
        if (callbacks.onHover && showTooltips) {
          const rect = this.getBoundingClientRect();
          const position = {
            x: rect.left + rect.width / 2,
            y: rect.top
          };
          const formattedValue = formatMeasureValue(d.measures[firstMeasureKey]);
          callbacks.onHover([d], position, `${d.dimensions[firstDimKey]}: ${formattedValue} (${measureDisplayName})`);
        }
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 0.8);
        if (callbacks.onHoverEnd) {
          callbacks.onHoverEnd();
        }
      })
      .on('click', function(event, d) {
        if (callbacks.onPointClick) {
          const rect = this.getBoundingClientRect();
          const position = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
          callbacks.onPointClick([d], position, `Bar: ${d.dimensions[firstDimKey]}`);
        }
      });
  }

  // Add brush selection for bar charts with highlighting
  if (callbacks && settings.interactions.brush.enabled) {
    let brushing = false;
    
    const brush = d3.brush()
      .extent([[0, 0], [width, adjustedHeight]])
      .on('start', function() {
        brushing = true;
        // Remove any existing tooltips when brush starts
        if (callbacks.onHoverEnd) {
          callbacks.onHoverEnd();
        }
      })
      .on('brush', function(event) {
        if (!brushing) return;
        
        const selection = event.selection;
        if (selection) {
          const [[x0, y0], [x1, y1]] = selection;
          
          // Highlight bars within selection
          bars
            .style('opacity', function(d: any) {
              const barX = xScale(getCompositeKey(d)) || 0;
              const barWidth = xScale.bandwidth();
              const value = +d.measures[firstMeasureKey];
              const barY = value >= 0 ? yScale(value) : yScale(0);
              const barHeight = value >= 0 ? Math.max(0, adjustedHeight - yScale(value)) : Math.max(0, yScale(value) - adjustedHeight);
              
              // Check if bar overlaps with brush selection
              const isSelected = barX < x1 && barX + barWidth > x0 && barY < y1 && barY + barHeight > y0;
              return isSelected ? 1 : 0.3;
            })
            .style('stroke', function(d: any) {
              const barX = xScale(getCompositeKey(d)) || 0;
              const barWidth = xScale.bandwidth();
              const value = +d.measures[firstMeasureKey];
              const barY = value >= 0 ? yScale(value) : yScale(0);
              const barHeight = value >= 0 ? Math.max(0, adjustedHeight - yScale(value)) : Math.max(0, yScale(value) - adjustedHeight);
              
              // Check if bar overlaps with brush selection
              const isSelected = barX < x1 && barX + barWidth > x0 && barY < y1 && barY + barHeight > y0;
              return isSelected ? '#000' : 'none';
            })
            .style('stroke-width', function(d: any) {
              const barX = xScale(getCompositeKey(d)) || 0;
              const barWidth = xScale.bandwidth();
              const value = +d.measures[firstMeasureKey];
              const barY = value >= 0 ? yScale(value) : yScale(0);
              const barHeight = value >= 0 ? Math.max(0, adjustedHeight - yScale(value)) : Math.max(0, yScale(value) - adjustedHeight);
              
              // Check if bar overlaps with brush selection
              const isSelected = barX < x1 && barX + barWidth > x0 && barY < y1 && barY + barHeight > y0;
              return isSelected ? 2 : 0;
            });
        } else {
          // Reset opacity and stroke when no selection
          bars
            .style('opacity', 0.8)
            .style('stroke', 'none')
            .style('stroke-width', 0);
        }
      })
      .on('end', function(event) {
        if (!brushing) return;
        brushing = false;
        
        const selection = event.selection;
        if (selection) {
          const [[x0, y0], [x1, y1]] = selection;
          const brushedData: any[] = [];
          
          filteredData.forEach(dataPoint => {
            const barX = xScale(getCompositeKey(dataPoint)) || 0;
            const barWidth = xScale.bandwidth();
            const value = +dataPoint.measures[firstMeasureKey];
            const barY = value >= 0 ? yScale(value) : yScale(0);
            const barHeight = value >= 0 ? Math.max(0, adjustedHeight - yScale(value)) : Math.max(0, yScale(value) - adjustedHeight);
            
            // Check if bar overlaps with brush selection
            if (barX < x1 && barX + barWidth > x0 && barY < y1 && barY + barHeight > y0) {
              brushedData.push(dataPoint);
            }
          });
          
          if (brushedData.length > 0 && callbacks.onPointClick) {
            const position = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
            callbacks.onPointClick(brushedData, position, `Selected Bars (${brushedData.length})`);
          }
          
          // Clear brush selection
          d3.select(this).call(brush.move, null);
        }
        
        // Reset all bars to normal opacity and remove stroke after brush ends
        bars
          .style('opacity', 0.8)
          .style('stroke', 'none')
          .style('stroke-width', 0);
      });

    // Append brush last so it's on top of bars
    g.append('g')
      .attr('class', 'brush')
      .call(brush)
      .raise(); // Ensure brush is on top
  }
  
  // Add note about hidden values if any were filtered
  if (hiddenCount > 0 || showZeroValues) {
    const noteText = g.append('text')
      .attr('x', width - 5)
      .attr('y', -5)
      .attr('text-anchor', 'end')
      .style('font-size', '11px')
      .style('fill', '#666')
      .style('font-style', 'italic')
      .style('cursor', 'pointer')
      .text(`${hiddenCount} zero values ${showZeroValues ? 'shown' : 'hidden'} (click to toggle)`)
      .on('click', () => {
        setShowZeroValues(!showZeroValues);
      });
      
    // Add underline on hover
    noteText
      .on('mouseover', function() {
        d3.select(this).style('text-decoration', 'underline');
      })
      .on('mouseout', function() {
        d3.select(this).style('text-decoration', 'none');
      });
  }

}

// Grouped bar chart for multiple dimensions/segments
function renderGroupedBarChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
  if (!data.length) {
    renderEmptyState(g, width, height, 'No data available', 'Check your filters and data source configuration');
    return;
  }

  // Get all dimension keys and measure
  const dimensionKeys = Object.keys(data[0].dimensions);
  const firstMeasureKey = Object.keys(data[0].measures)[0];
  
  if (!dimensionKeys.length || !firstMeasureKey) return;

  // The first dimension will be our X-axis grouping
  const xDimKey = dimensionKeys[0];
  const groupDimKeys = dimensionKeys.slice(1);
  
  // Get unique values for x-axis
  const xValues = [...new Set(data.map(d => d.dimensions[xDimKey]))];
  
  // Get unique values for grouping
  const groupValues = [...new Set(data.map(d => 
    groupDimKeys.map(key => d.dimensions[key]).join(' | ')
  ))].filter(v => v);

  console.log('Grouped bar chart - X values:', xValues);
  console.log('Grouped bar chart - Group values:', groupValues);
  console.log('Grouped bar chart - Sample data point:', data[0]);

  // Create scales
  const barPadding = 40; // Add padding to prevent edge cutoff
  const x0Scale = d3.scaleBand()
    .domain(xValues)
    .range([barPadding, width - barPadding])
    .paddingInner(0.1);

  const x1Scale = d3.scaleBand()
    .domain(groupValues)
    .range([0, x0Scale.bandwidth()])
    .padding(0.05);

  // Find max value for Y scale
  const maxValue = d3.max(data, d => +d.measures[firstMeasureKey]) || 0;
  
  const yScale = d3.scaleLinear()
    .domain([0, maxValue * 1.1]) // Add 10% padding
    .range([height, 0]);

  // Create color scale using settings palette
  const colorScale = d3.scaleOrdinal()
    .domain(groupValues)
    .range(settings.colors?.palette || COLOR_PALETTES.set3);

  // Add axes
  const xAxis = g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x0Scale));

  // Format x-axis labels
  xAxis.selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)')
    .text((d: any) => {
      const text = String(d);
      // Clean up IDs and UUIDs from labels
      if (text.includes('(ID:')) {
        const cleaned = text.split('(ID:')[0].trim();
        return cleaned.length > 20 ? cleaned.substring(0, 18) + '...' : cleaned;
      }
      return text.length > 20 ? text.substring(0, 18) + '...' : text;
    });

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Create groups for each x value
  const barGroups = g.selectAll('.bar-group')
    .data(xValues)
    .enter().append('g')
    .attr('class', 'bar-group')
    .attr('transform', d => `translate(${x0Scale(d)}, 0)`);

  // Add bars within each group
  barGroups.each(function(xValue) {
    const group = d3.select(this);
    const groupData = data.filter(d => d.dimensions[xDimKey] === xValue);
    
    group.selectAll('rect')
      .data(groupData)
      .enter().append('rect')
      .attr('x', d => {
        const groupKey = groupDimKeys.map(key => d.dimensions[key]).join(' | ');
        return x1Scale(groupKey) || 0;
      })
      .attr('y', d => yScale(+d.measures[firstMeasureKey]))
      .attr('width', x1Scale.bandwidth())
      .attr('height', d => height - yScale(+d.measures[firstMeasureKey]))
      .attr('fill', d => {
        const groupKey = groupDimKeys.map(key => d.dimensions[key]).join(' | ');
        return colorScale(groupKey);
      })
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d: any) {
        d3.select(this).style('opacity', 0.8);
        if (callbacks?.onHover && showTooltips) {
          const rect = this.getBoundingClientRect();
          const position = { x: rect.left + rect.width / 2, y: rect.top };
          const groupKey = groupDimKeys.map(key => d.dimensions[key]).join(' | ');
          const value = d.measures[firstMeasureKey];
          callbacks.onHover([d], position, `${groupKey}: ${value}`);
        }
      })
      .on('mouseout', function() {
        d3.select(this).style('opacity', 1);
        if (callbacks?.onHoverEnd) {
          callbacks.onHoverEnd();
        }
      })
      .on('click', function(event, d) {
        if (callbacks?.onPointClick) {
          const rect = this.getBoundingClientRect();
          const position = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          callbacks.onPointClick([d], position, 'Bar Data');
        }
      });
  });

  // Add legend for groups
  if (showLegend && groupValues.length > 1) {
    const legendG = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width + 10}, 20)`);

    const legendItems = legendG.selectAll('.legend-item')
      .data(groupValues)
      .enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`);

    legendItems.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', d => colorScale(d));

    legendItems.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .style('font-size', '12px')
      .text(d => {
        // Parse the grouped key to show human-readable labels
        const text = String(d);
        if (text.includes(' | ')) {
          // Split and clean up the parts
          const parts = text.split(' | ');
          const cleanedParts = parts.map(part => {
            // Remove UUIDs and extract human-readable parts
            if (part.includes('(ID:')) {
              return part.split('(ID:')[0].trim();
            }
            return part;
          });
          const result = cleanedParts.join(' - ');
          return result.length > 30 ? result.substring(0, 28) + '...' : result;
        }
        return text.length > 30 ? text.substring(0, 28) + '...' : text;
      })
      .append('title')
      .text(d => String(d)); // Full text on hover
  }

  // Add brush selection
  if (callbacks && settings.interactions.brush.enabled) {
    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on('brush end', function(event) {
        const selection = event.selection;
        if (selection) {
          const [[x0, y0], [x1, y1]] = selection;
          
          // Find selected bars
          const selectedData: any[] = [];
          barGroups.each(function() {
            const group = d3.select(this);
            group.selectAll('rect').each(function(d: any) {
              const bar = d3.select(this);
              const barX = +bar.attr('x') + (group.node() as any).transform.baseVal[0].matrix.e;
              const barY = +bar.attr('y');
              const barWidth = +bar.attr('width');
              const barHeight = +bar.attr('height');
              
              if (barX < x1 && barX + barWidth > x0 && barY < y1 && barY + barHeight > y0) {
                selectedData.push(d);
                bar.style('opacity', 1).style('stroke', '#000').style('stroke-width', 2);
              } else {
                bar.style('opacity', 0.3).style('stroke', 'none');
              }
            });
          });

          if (event.type === 'end' && callbacks.onPointClick && selectedData.length > 0) {
            callbacks.onPointClick(selectedData, { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, `Selected ${selectedData.length} bars`);
          }
        } else {
          // Reset all bars
          barGroups.selectAll('rect')
            .style('opacity', 1)
            .style('stroke', 'none');
        }
      });

    g.append('g')
      .attr('class', 'brush')
      .call(brush);
  }
}

// Stacked bar chart for multiple dimensions/segments
function renderStackedBarChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
  if (!data.length) {
    renderEmptyState(g, width, height, 'No data available', 'Check your filters and data source configuration');
    return;
  }

  // Get all dimension keys
  const dimensionKeys = Object.keys(data[0].dimensions);
  const firstMeasureKey = Object.keys(data[0].measures)[0];
  
  if (!dimensionKeys.length || !firstMeasureKey) return;

  // The first dimension will be our X-axis, others will be stacked
  const xDimKey = dimensionKeys[0];
  const stackDimKeys = dimensionKeys.slice(1);
  
  // Get unique values for x-axis
  const xValues = [...new Set(data.map(d => d.dimensions[xDimKey]))];
  
  // Get unique values for stacking (combining all stack dimensions)
  const stackGroups = new Map<string, Set<string>>();
  data.forEach(d => {
    const stackKey = stackDimKeys.map(key => d.dimensions[key]).join(' | ');
    if (!stackGroups.has(stackKey)) {
      stackGroups.set(stackKey, new Set());
    }
    stackGroups.get(stackKey)!.add(d.dimensions[xDimKey]);
  });
  
  // Create data structure for stacking
  const stackData: any[] = [];
  xValues.forEach(xVal => {
    const item: any = { x: xVal };
    stackGroups.forEach((_, stackKey) => {
      const dataPoint = data.find(d => 
        d.dimensions[xDimKey] === xVal && 
        stackDimKeys.map(key => d.dimensions[key]).join(' | ') === stackKey
      );
      item[stackKey] = dataPoint ? +dataPoint.measures[firstMeasureKey] : 0;
    });
    stackData.push(item);
  });

  // Create scales
  const barPadding = 40; // Add padding to prevent edge cutoff
  const xScale = d3.scaleBand()
    .domain(xValues)
    .range([barPadding, width - barPadding])
    .padding(0.1);

  // Calculate max value for y-scale
  const maxValue = d3.max(stackData, (d: any) => {
    return d3.sum(Array.from(stackGroups.keys()), (key: string) => d[key] || 0);
  }) || 0;

  const yScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([height, 0]);

  // Create color scale using settings palette
  const colorScale = d3.scaleOrdinal()
    .domain(Array.from(stackGroups.keys()))
    .range(settings.colors?.palette || COLOR_PALETTES.set3);

  // Create stack generator
  const stack = d3.stack()
    .keys(Array.from(stackGroups.keys()))
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(stackData);

  // Add axes
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)');

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Create groups for each series
  const seriesGroups = g.selectAll('.series')
    .data(series)
    .enter().append('g')
    .attr('class', 'series')
    .attr('fill', d => colorScale(d.key));

  // Add bars
  seriesGroups.selectAll('rect')
    .data(d => d)
    .enter().append('rect')
    .attr('x', (d: any) => xScale(d.data.x))
    .attr('y', (d: any) => yScale(d[1]))
    .attr('height', (d: any) => yScale(d[0]) - yScale(d[1]))
    .attr('width', xScale.bandwidth())
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d: any) {
      const parentData = d3.select(this.parentNode).datum() as any;
      const seriesKey = parentData.key;
      if (callbacks?.onHover && showTooltips) {
        const rect = this.getBoundingClientRect();
        const position = { x: rect.left + rect.width / 2, y: rect.top };
        const value = d[1] - d[0];
        callbacks.onHover([d], position, `${seriesKey}: ${value}`);
      }
    })
    .on('mouseout', function() {
      if (callbacks?.onHoverEnd) {
        callbacks.onHoverEnd();
      }
    });

  // Add legend for stacked groups
  const legendData = Array.from(stackGroups.keys()).map(key => ({
    id: key,
    name: key,
    color: colorScale(key),
    visible: true
  }));

  if (showLegend && legendData.length > 1) {
    const legendG = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width + 10}, 20)`);

    const legendItems = legendG.selectAll('.legend-item')
      .data(legendData)
      .enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`);

    legendItems.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', d => d.color);

    legendItems.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .style('font-size', '12px')
      .text(d => d.name.length > 20 ? d.name.substring(0, 18) + '...' : d.name);
  }
}

// Helper function to get metric range
function getMetricRange(metricName: string, data: any[]): { min: number; max: number } {
  // Check if this is a known metric with fixed range
  const normalizedMetric = metricName.toLowerCase();
  
  // Check exact match first
  if (METRIC_FIXED_RANGES[normalizedMetric]) {
    return METRIC_FIXED_RANGES[normalizedMetric];
  }
  
  // Check for partial matches (e.g., ends with "_percentage", "_percent", "_rate")
  for (const [key, range] of Object.entries(METRIC_FIXED_RANGES)) {
    if (normalizedMetric.includes(key) || 
        (key.includes('percentage') && normalizedMetric.endsWith('_percentage')) ||
        (key.includes('percentage') && normalizedMetric.endsWith('_percent')) ||
        (key.includes('rate') && normalizedMetric.endsWith('_rate'))) {
      return range;
    }
  }
  
  // If no fixed range found, calculate from data
  const validValues = data
    .map(d => d.measures[metricName])
    .filter(val => val !== null && val !== undefined && val !== '' && val !== '-')
    .map(val => +val)
    .filter(val => !isNaN(val));
    
  if (validValues.length > 0) {
    const extent = d3.extent(validValues) as [number, number];
    // Add 10% padding for dynamic ranges
    const padding = (extent[1] - extent[0]) * 0.1;
    return { 
      min: extent[0] - padding, 
      max: extent[1] + padding 
    };
  }
  
  // Default fallback
  return { min: 0, max: 100 };
}

function renderLineChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings) {
  if (!data.length) return;

  const firstDimKey = Object.keys(data[0].dimensions)[0];
  const firstMeasureKey = Object.keys(data[0].measures)[0];

  if (!firstDimKey || !firstMeasureKey) return;

  // Detect if the dimension is a date
  const isDateDimension = isDateField(data[0].dimensions[firstDimKey]);
  
  let xScale: any;
  let xAxis: any;
  
  if (isDateDimension) {
    // Parse dates and sort data
    const sortedData = [...data].sort((a, b) => 
      new Date(a.dimensions[firstDimKey]).getTime() - new Date(b.dimensions[firstDimKey]).getTime()
    );
    
    const dates = sortedData.map(d => new Date(d.dimensions[firstDimKey]));
    const [minDate, maxDate] = d3.extent(dates) as [Date, Date];
    
    const areaPadding = 40; // Add padding to prevent edge cutoff
    xScale = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([areaPadding, width - areaPadding]);
    
    // Smart tick spacing based on width and date range
    const tickCount = Math.max(3, Math.min(8, Math.floor(width / 80)));
    
    xAxis = d3.axisBottom(xScale)
      .ticks(tickCount)
      .tickFormat(d => formatDateForDisplay(d as Date, false, false));
      
    // Update data reference for sorted data
    data = sortedData;
  } else {
    // Non-date dimension - use point scale with smart labeling
    const areaPadding = 40; // Add padding to prevent edge cutoff
    xScale = d3.scalePoint()
      .domain(data.map(d => d.dimensions[firstDimKey]))
      .range([areaPadding, width - areaPadding]);
    
    // Calculate how many labels we can fit
    const maxLabels = Math.max(3, Math.floor(width / 60));
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(data.filter((_, i) => i % step === 0).map(d => d.dimensions[firstDimKey]));
  }

  // Get the appropriate range for this metric
  let metricRange = getMetricRange(firstMeasureKey, data);
  
  // Override with custom min/max from settings if custom scale is enabled
  if (settings.axes?.y?.customScale && (settings.axes?.y?.minValue !== undefined || settings.axes?.y?.maxValue !== undefined)) {
    metricRange = {
      min: settings.axes.y.minValue ?? metricRange.min,
      max: settings.axes.y.maxValue ?? metricRange.max
    };
    console.log('Debug BaseChart: Using custom Y-axis range:', metricRange);
  }
  
  console.log('Debug BaseChart: Processing line chart data:', data.slice(0, 3));
  console.log('Debug BaseChart: Using metric range for', firstMeasureKey, ':', metricRange);
  
  // Use fixed range for known metrics or custom settings
  const yScale = d3.scaleLinear()
    .domain([metricRange.min, metricRange.max])
    .range([height, 0]);

  const line = d3.line<any>()
    .x(d => {
      const xValue = d.dimensions[firstDimKey];
      if (isDateDimension) {
        return xScale(new Date(xValue));
      }
      return xScale(xValue) || 0;
    })
    .y(d => {
      const yValue = d.measures[firstMeasureKey];
      // Handle null, undefined, or non-numeric values
      if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
        return null; // This will create gaps in the line
      }
      const numericValue = +yValue;
      return isNaN(numericValue) ? null : yScale(numericValue);
    })
    .defined(d => {
      const yValue = d.measures[firstMeasureKey];
      return yValue !== null && yValue !== undefined && yValue !== '' && yValue !== '-' && !isNaN(+yValue);
    });

  // Add axes with improved styling
  const xAxisGroup = g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis);
    
  // Rotate labels if they're still too crowded
  if (!isDateDimension && data.length > 6) {
    xAxisGroup.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-30)');
  }

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Add line
  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', resolveColorPalette(settings.colors?.palette)[0]) // Use first color from palette
    .attr('stroke-width', 2)
    .attr('d', line);

  // Add points
  g.selectAll('.dot')
    .data(data)
    .enter().append('circle')
    .attr('class', 'dot')
    .attr('cx', (d: any) => isDateDimension ? xScale(new Date(d.dimensions[firstDimKey])) : (xScale(d.dimensions[firstDimKey]) || 0))
    .attr('cy', (d: any) => yScale(+d.measures[firstMeasureKey]))
    .attr('r', 4)
    .attr('fill', resolveColorPalette(settings.colors?.palette)[0]); // Use first color from palette
}

// Multi-series area chart renderer (overlaid, not stacked)
function renderMultiSeriesAreaChart(
  g: any,
  seriesData: SeriesData[],
  width: number,
  height: number,
  settings: VisualizationSettings,
  callbacks?: {
    onPointClick?: (data: any[], position: { x: number; y: number }, title: string) => void;
    onBrushEnd?: (selection: [[number, number], [number, number]] | null) => void;
  },
  dimensionConfig?: any
) {
  if (!seriesData.length) return;

  const visibleSeries = seriesData.filter(s => s.visible);
  if (!visibleSeries.length) return;

  // Get first data point to determine dimension type
  const firstDataPoint = visibleSeries[0].data[0];
  if (!firstDataPoint) return;

  // Small padding for scale aesthetics (margins already applied at container level)
  const responsivePadding = 40;

  // Use configured dimension field if available
  const firstDimKey = dimensionConfig?.field || Object.keys(firstDataPoint.dimensions)[0];
  const isDateDimension = isDateField(firstDataPoint.dimensions[firstDimKey]);

  let xScale: any;
  let xAxis: any;

  if (isDateDimension) {
    // Sort data for each series
    visibleSeries.forEach(series => {
      series.data = [...series.data].sort((a, b) =>
        new Date(a.dimensions[firstDimKey]).getTime() - new Date(b.dimensions[firstDimKey]).getTime()
      );
    });

    // Get date extent across all series
    const allDates = visibleSeries.flatMap(series =>
      series.data.map(d => new Date(d.dimensions[firstDimKey]))
    );
    const [minDate, maxDate] = d3.extent(allDates) as [Date, Date];

    // Add time padding
    const timePadding = (maxDate.getTime() - minDate.getTime()) * 0.02;
    const paddedDomain: [Date, Date] = [
      new Date(minDate.getTime() - timePadding),
      new Date(maxDate.getTime() + timePadding)
    ];

    xScale = d3.scaleTime()
      .domain(paddedDomain)
      .range([responsivePadding, width - responsivePadding]);

    const tickCount = Math.max(3, Math.min(8, Math.floor(width / 80)));
    xAxis = d3.axisBottom(xScale)
      .ticks(tickCount)
      .tickFormat(d => formatDateForDisplay(d as Date, false, false));
  } else {
    // Non-date dimension
    const allValues = visibleSeries.flatMap(series =>
      series.data.map(d => d.dimensions[firstDimKey])
    );
    const uniqueValues = [...new Set(allValues)];

    xScale = d3.scalePoint()
      .domain(uniqueValues)
      .range([responsivePadding, width - responsivePadding])
      .padding(0.1);

    const maxLabels = Math.max(3, Math.floor(width / 70));
    const step = Math.max(1, Math.ceil(uniqueValues.length / maxLabels));

    xAxis = d3.axisBottom(xScale)
      .tickValues(uniqueValues.filter((_, i) => i % step === 0));
  }

  // Calculate Y domain across all processed series
  const customMin = settings.axes?.y?.customScale ? settings.axes?.y?.minValue : undefined;
  const customMax = settings.axes?.y?.customScale ? settings.axes?.y?.maxValue : undefined;
  const autoScale = settings.axes?.y?.autoScale !== false; // Default to true
  const includeZero = settings.axes?.y?.includeZero;
  const yDomain = calculateYDomain(visibleSeries, true, undefined, customMin, customMax, autoScale, includeZero);
  const yScale = d3.scaleLinear()
    .domain(yDomain)
    .range([height, 0]);

  // Add axes
  const xAxisGroup = g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis);

  // Smart label rotation
  const actualDomainLength = xScale.domain().length;
  const needsRotation = actualDomainLength > 8 || (!isDateDimension && actualDomainLength > 6);

  if (needsRotation) {
    xAxisGroup.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');
  }

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Add zero line if data crosses zero
  if (yDomain[0] < 0 && yDomain[1] > 0) {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.7)
      .attr('class', 'zero-line');
  }

  // Create area generator
  const area = d3.area<any>()
    .x(d => {
      const xValue = d.dimensions[firstDimKey];
      if (isDateDimension) {
        return xScale(new Date(xValue));
      }
      return xScale(xValue) || 0;
    })
    .y0(d => {
      // For negative values, the base should be at zero, not the bottom
      const yValue = d.value;
      if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
        return yScale(0);
      }
      const numericValue = parseFloat(yValue);
      if (isNaN(numericValue)) {
        return yScale(0);
      }
      // If data contains negative values, use zero as baseline
      return yDomain[0] < 0 ? yScale(0) : height;
    })
    .y1(d => {
      const yValue = d.value;
      if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
        return yScale(0);
      }
      const numericValue = parseFloat(yValue);
      return isNaN(numericValue) ? yScale(0) : yScale(numericValue);
    })
    .curve(d3.curveMonotoneX)
    .defined(d => {
      const yValue = d.value;
      return yValue !== null && yValue !== undefined && yValue !== '' && yValue !== '-';
    });

  // Render each series
  visibleSeries.forEach((series, i) => {
    // Add area with transparency
    g.append('path')
      .datum(series.data)
      .attr('fill', series.color)
      .attr('fill-opacity', 0.3)
      .attr('stroke', series.color)
      .attr('stroke-width', 2)
      .attr('opacity', series.visible ? 1 : 0.2)
      .attr('d', area)
      .attr('class', `area-series-${series.id}`);

    // Add points for interactivity
    g.selectAll(`.dot-series-${series.id}`)
      .data(series.data)
      .enter().append('circle')
      .attr('class', `dot dot-series-${series.id}`)
      .attr('cx', (d: any) => isDateDimension ? xScale(new Date(d.dimensions[firstDimKey])) : (xScale(d.dimensions[firstDimKey]) || 0))
      .attr('cy', (d: any) => {
        const yValue = d.value;
        if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
          return yScale(0);
        }
        const numericValue = parseFloat(yValue);
        return isNaN(numericValue) ? yScale(0) : yScale(numericValue);
      })
      .attr('r', 3)
      .attr('fill', series.color)
      .attr('opacity', series.visible ? 1 : 0.2)
      .on('mouseover', function(event: any, d: any) {
        const tooltip = d3.select('body').append('div')
          .attr('class', 'chart-tooltip')
          .style('opacity', 0);

        tooltip.transition()
          .duration(200)
          .style('opacity', .9);

        const xValue = formatDimensionValue(d.dimensions[firstDimKey], firstDimKey);
        const yValue = formatMeasureValue(d.value);

        tooltip.html(`<strong>${series.name}</strong><br/>
                     ${firstDimKey}: ${xValue}<br/>
                     Value: ${yValue}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.selectAll('.chart-tooltip').remove();
      });
  });
}

function renderAreaChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any, dimensionConfig?: any, metadata?: any) {
  if (!data.length) return;

  // Apply aggregation based on measure configuration
  const processedData = aggregateData(data, metadata);

  // Use configured dimension field if available, otherwise fall back to first key
  const firstDimKey = dimensionConfig?.field || Object.keys(processedData[0].dimensions)[0];
  const measureKeys = Object.keys(processedData[0].measures);
  const firstMeasureKey = measureKeys[0];

  if (!firstDimKey || !firstMeasureKey) return;

  // Detect if the dimension is a date
  const isDateDimension = isDateField(processedData[0].dimensions[firstDimKey]);
  
  let xScale: any;
  let xAxis: any;
  
  let dataToUse = processedData;
  
  if (isDateDimension) {
    // Parse dates and sort data
    const sortedData = [...processedData].sort((a, b) => 
      new Date(a.dimensions[firstDimKey]).getTime() - new Date(b.dimensions[firstDimKey]).getTime()
    );
    
    const dates = sortedData.map(d => new Date(d.dimensions[firstDimKey]));
    const [minDate, maxDate] = d3.extent(dates) as [Date, Date];
    
    const areaPadding = 40; // Add padding to prevent edge cutoff
    xScale = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([areaPadding, width - areaPadding]);
    
    // Smart tick spacing
    const tickCount = Math.max(3, Math.min(8, Math.floor(width / 80)));
    
    xAxis = d3.axisBottom(xScale)
      .ticks(tickCount)
      .tickFormat(d => formatDateForDisplay(d as Date, false, false));
      
    // Update data reference
    dataToUse = sortedData;
  } else {
    // For non-date dimensions, use point scale for continuous area visualization
    const areaPadding = 40; // Add padding to prevent edge cutoff
    xScale = d3.scalePoint()
      .domain(processedData.map(d => d.dimensions[firstDimKey]))
      .range([areaPadding, width - areaPadding])
      .padding(0.5);
    
    // Smart labeling for non-dates
    const maxLabels = Math.max(3, Math.floor(width / 60));
    const step = Math.max(1, Math.ceil(processedData.length / maxLabels));
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(processedData.filter((_, i) => i % step === 0).map(d => d.dimensions[firstDimKey]));
  }

  // Check if we have multiple measures for stacked area
  const isStacked = measureKeys.length > 1;
  // Use the color palette from settings for bar charts
  const barColorPalette = resolveColorPalette(settings.colors?.palette, COLOR_PALETTES.set3);
  const colorScale = d3.scaleOrdinal(barColorPalette);

  let yScale: any;
  let areaGenerator: any;
  let stackedData: any[] = [];

  if (isStacked) {
    // Prepare data for stacking
    const stack = d3.stack()
      .keys(measureKeys)
      .value((d: any, key: string) => +d.measures[key] || 0);
    
    stackedData = stack(dataToUse);
    
    // Find the maximum y value across all stacks
    const maxY = d3.max(stackedData, layer => d3.max(layer, d => d[1])) || 0;
    
    yScale = d3.scaleLinear()
      .domain([0, maxY])
      .range([height, 0]);
    
    areaGenerator = d3.area<any>()
      .x((d: any) => {
        const xVal = d.data.dimensions[firstDimKey];
        if (isDateDimension) {
          return xScale(new Date(xVal));
        } else {
          return xScale(xVal) || 0;
        }
      })
      .y0(d => yScale(d[0]))
      .y1(d => yScale(d[1]))
      .curve(d3.curveMonotoneX);
  } else {
    // Single area
    yScale = d3.scaleLinear()
      .domain([0, d3.max(dataToUse, d => +d.measures[firstMeasureKey]) || 0])
      .range([height, 0]);
    
    areaGenerator = d3.area<any>()
      .x(d => {
        if (isDateDimension) {
          return xScale(new Date(d.dimensions[firstDimKey]));
        } else {
          return xScale(d.dimensions[firstDimKey]) || 0;
        }
      })
      .y0(height)
      .y1(d => yScale(+d.measures[firstMeasureKey]))
      .curve(d3.curveMonotoneX);
  }

  // Add axes with smart formatting
  const xAxisGroup = g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis);
    
  // Rotate labels for non-date dimensions if needed
  if (!isDateDimension && data.length > 6) {
    xAxisGroup.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-30)');
  }

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Add areas
  if (isStacked) {
    // Render stacked areas
    const areas = g.selectAll('.area-layer')
      .data(stackedData)
      .enter().append('g')
      .attr('class', 'area-layer');
    
    areas.append('path')
      .attr('class', 'area')
      .attr('d', areaGenerator)
      .attr('fill', (d: any, i: number) => {
        // Use the color palette from settings for area charts
        const areaColors = resolveColorPalette(settings.colors?.palette, COLOR_PALETTES.set3);
        return areaColors[i % areaColors.length];
      })
      .attr('fill-opacity', 0.7)
      .style('cursor', 'pointer');
    
    // Add interactive overlays for each stack layer
    if (callbacks) {
      areas.each(function(layerData: any, layerIndex: number) {
        const layer = d3.select(this);
        const measureKey = measureKeys[layerIndex];
        
        // Add invisible circles for hover detection
        layer.selectAll('.hover-dot')
          .data(layerData)
          .enter().append('circle')
          .attr('class', 'hover-dot')
          .attr('cx', (d: any) => {
            const xVal = d.data.dimensions[firstDimKey];
            if (isDateDimension) {
              return xScale(new Date(xVal));
            } else {
              return (xScale(xVal) || 0) + xScale.bandwidth() / 2;
            }
          })
          .attr('cy', (d: any) => yScale(d[1]))
          .attr('r', 5)
          .attr('fill', 'transparent')
          .style('cursor', 'pointer')
          .on('mouseover', function(event: any, d: any) {
            if (callbacks.onHover && showTooltips) {
              const circle = this.getBoundingClientRect();
              const position = {
                x: circle.left + circle.width / 2,
                y: circle.top
              };
              const value = d.data.measures[measureKey];
              const tooltipText = `${d.data.dimensions[firstDimKey]}\n${measureKey}: ${value}`;
              callbacks.onHover([d.data], position, tooltipText);
            }
          })
          .on('mouseout', function() {
            if (callbacks.onHoverEnd) {
              callbacks.onHoverEnd();
            }
          })
          .on('click', function(event: any, d: any) {
            if (callbacks.onPointClick) {
              const circle = this.getBoundingClientRect();
              const position = {
                x: circle.left + circle.width / 2,
                y: circle.top + circle.height / 2
              };
              callbacks.onPointClick([d.data], position, `${measureKey}: ${d.data.dimensions[firstDimKey]}`);
            }
          });
      });
    }
  } else {
    // Single area
    const areaPath = g.append('path')
      .datum(data)
      .attr('class', 'area')
      .attr('fill', colorScale('0'))
      .attr('fill-opacity', 0.7)
      .attr('d', areaGenerator)
      .style('cursor', 'pointer');
    
    // Add a line on top of the area for better definition
    const line = d3.line<any>()
      .x(d => {
        if (isDateDimension) {
          return xScale(new Date(d.dimensions[firstDimKey]));
        } else {
          return xScale(d.dimensions[firstDimKey]) || 0;
        }
      })
      .y(d => yScale(+d.measures[firstMeasureKey]))
      .curve(d3.curveMonotoneX);
    
    g.append('path')
      .datum(data)
      .attr('class', 'area-line')
      .attr('fill', 'none')
      .attr('stroke', colorScale('0'))
      .attr('stroke-width', 2)
      .attr('d', line);
    
    // Add interactive dots
    if (callbacks) {
      const dots = g.selectAll('.dot')
        .data(data)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('cx', (d: any) => {
          if (isDateDimension) {
            return xScale(new Date(d.dimensions[firstDimKey]));
          } else {
            return (xScale(d.dimensions[firstDimKey]) || 0) + xScale.bandwidth() / 2;
          }
        })
        .attr('cy', (d: any) => yScale(+d.measures[firstMeasureKey]))
        .attr('r', 4)
        .attr('fill', colorScale('0'))
        .style('cursor', 'pointer')
        .on('mouseover', function(event: any, d: any) {
          d3.select(this).attr('r', 6);
          
          if (callbacks.onHover && showTooltips) {
            const circle = this.getBoundingClientRect();
            const position = {
              x: circle.left + circle.width / 2,
              y: circle.top
            };
            callbacks.onHover([d], position, `${d.dimensions[firstDimKey]}: ${d.measures[firstMeasureKey]}`);
          }
        })
        .on('mouseout', function() {
          d3.select(this).attr('r', 4);
          if (callbacks.onHoverEnd) {
            callbacks.onHoverEnd();
          }
        })
        .on('click', function(event: any, d: any) {
          if (callbacks.onPointClick) {
            const circle = this.getBoundingClientRect();
            const position = {
              x: circle.left + circle.width / 2,
              y: circle.top + circle.height / 2
            };
            callbacks.onPointClick([d], position, `Point: ${d.dimensions[firstDimKey]}`);
          }
        });
    }
  }

  // Add brush selection
  if (callbacks && settings.interactions.brush.enabled) {
    let brushing = false;
    
    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on('start', function() {
        brushing = true;
        if (callbacks.onHoverEnd) {
          callbacks.onHoverEnd();
        }
      })
      .on('brush', function(event: any) {
        if (!brushing) return;
        
        const selection = event.selection;
        if (selection) {
          const [[x0, y0], [x1, y1]] = selection;
          
          // Highlight area and dots within selection
          if (isStacked) {
            g.selectAll('.area').style('opacity', 0.3);
            g.selectAll('.hover-dot').style('opacity', function(d: any) {
              const cx = parseFloat(d3.select(this).attr('cx'));
              const cy = parseFloat(d3.select(this).attr('cy'));
              return (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) ? 1 : 0;
            });
          } else {
            g.select('.area').style('opacity', 0.3);
            g.selectAll('.dot').style('opacity', function(d: any) {
              const cx = parseFloat(d3.select(this).attr('cx'));
              const cy = parseFloat(d3.select(this).attr('cy'));
              return (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) ? 1 : 0.3;
            });
          }
        }
      })
      .on('end', function(event: any) {
        if (!brushing) return;
        brushing = false;
        
        const selection = event.selection;
        if (selection) {
          const [[x0, y0], [x1, y1]] = selection;
          const brushedData: any[] = [];
          
          data.forEach(dataPoint => {
            let x: number;
            if (isDateDimension) {
              x = xScale(new Date(dataPoint.dimensions[firstDimKey]));
            } else {
              x = xScale(dataPoint.dimensions[firstDimKey]) || 0;
            }
            
            // Check all measures for stacked area
            let inSelection = false;
            if (isStacked) {
              let y0Sum = 0;
              measureKeys.forEach(key => {
                const value = +dataPoint.measures[key] || 0;
                const y1 = yScale(y0Sum + value);
                const y0Val = yScale(y0Sum);
                if (x >= x0 && x <= x1 && ((y1 >= y0 && y1 <= y1) || (y0Val >= y0 && y0Val <= y1))) {
                  inSelection = true;
                }
                y0Sum += value;
              });
            } else {
              const y = yScale(+dataPoint.measures[firstMeasureKey]);
              inSelection = x >= x0 && x <= x1 && y >= y0 && y <= y1;
            }
            
            if (inSelection) {
              brushedData.push(dataPoint);
            }
          });
          
          if (brushedData.length > 0 && callbacks.onPointClick) {
            const position = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
            callbacks.onPointClick(brushedData, position, `Selected Area (${brushedData.length} points)`);
          }
          
          // Clear brush selection
          d3.select(this).call(brush.move, null);
        }
        
        // Reset opacity
        if (isStacked) {
          g.selectAll('.area').style('opacity', 0.7);
          g.selectAll('.hover-dot').style('opacity', 0);
        } else {
          g.select('.area').style('opacity', 0.7);
          g.selectAll('.dot').style('opacity', 1);
        }
      });

    g.append('g')
      .attr('class', 'brush')
      .call(brush);
  }
}

function renderPieChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, metadata?: any) {
  if (!data.length) return;

  // Apply aggregation based on measure configuration
  const processedData = aggregateData(data, metadata);

  const firstDimKey = Object.keys(processedData[0].dimensions)[0];
  const firstMeasureKey = Object.keys(processedData[0].measures)[0];

  if (!firstDimKey || !firstMeasureKey) return;

  const radius = Math.min(width, height) / 2;
  // Use the color palette from settings for bar charts
  const barColorPalette = resolveColorPalette(settings.colors?.palette, COLOR_PALETTES.set3);
  const colorScale = d3.scaleOrdinal(barColorPalette);

  const pie = d3.pie<any>()
    .value(d => +d.measures[firstMeasureKey]);

  const arc = d3.arc<any>()
    .innerRadius(0)
    .outerRadius(radius);

  const pieData = pie(processedData);

  g.attr('transform', `translate(${width / 2},${height / 2})`);

  g.selectAll('.arc')
    .data(pieData)
    .enter().append('g')
    .attr('class', 'arc')
    .append('path')
    .attr('d', arc)
    .attr('fill', (d: any, i: number) => colorScale(i.toString()));

  // Add labels with better positioning to avoid overlap
  if (data.length <= 8) { // Only show labels if not too many slices
    const labelArc = d3.arc<any>()
      .innerRadius(radius * 0.7)
      .outerRadius(radius * 0.7);
    
    g.selectAll('.arc')
      .append('text')
      .attr('transform', (d: any) => {
        const [x, y] = labelArc.centroid(d);
        return `translate(${x}, ${y})`;
      })
      .style('text-anchor', (d: any) => {
        const midAngle = (d.startAngle + d.endAngle) / 2;
        return midAngle < Math.PI ? 'start' : 'end';
      })
      .style('font-size', '10px')
      .style('fill', '#333')
      .style('font-weight', 'bold')
      .text((d: any) => {
        const percentage = ((d.endAngle - d.startAngle) / (2 * Math.PI) * 100).toFixed(1);
        // Only show label if slice is big enough
        if (percentage < 3) return '';
        
        const label = d.data.dimensions[firstDimKey];
        // Truncate long labels
        return label.length > 10 ? label.substring(0, 10) + '...' : label;
      })
      .append('title') // Add tooltip for full text
      .text((d: any) => {
        const percentage = ((d.endAngle - d.startAngle) / (2 * Math.PI) * 100).toFixed(1);
        return `${d.data.dimensions[firstDimKey]}: ${d.data.measures[firstMeasureKey]} (${percentage}%)`;
      });
  }
}

// Multi-series line chart renderer
function renderMultiSeriesLineChart(
  g: any, 
  seriesData: SeriesData[], 
  width: number, 
  height: number, 
  settings: VisualizationSettings,
  callbacks?: {
    onPointClick?: (data: any[], position: { x: number; y: number }, title: string) => void;
    onBrushEnd?: (selection: [[number, number], [number, number]] | null) => void;
  },
  dimensionConfig?: any
) {
  if (!seriesData.length) return;

  const visibleSeries = seriesData.filter(s => s.visible);
  if (!visibleSeries.length) return;

  // Get first data point to determine dimension type
  const firstDataPoint = visibleSeries[0].data[0];
  if (!firstDataPoint) return;

  // Small padding for scale aesthetics (margins already applied at container level)
  const responsivePadding = 40;

  // Use configured dimension field if available, otherwise fall back to first key
  const firstDimKey = dimensionConfig?.field || Object.keys(firstDataPoint.dimensions)[0];
  const isDateDimension = isDateField(firstDataPoint.dimensions[firstDimKey]);
  
  // Declare brushing state for use in hover zones
  let brushing = false;
  
  let xScale: any;
  let xAxis: any;
  
  if (isDateDimension) {
    // Parse dates and sort data for each series
    visibleSeries.forEach(series => {
      series.data = [...series.data].sort((a, b) => 
        new Date(a.dimensions[firstDimKey]).getTime() - new Date(b.dimensions[firstDimKey]).getTime()
      );
    });
    
    // Get date extent across all series
    const allDates = visibleSeries.flatMap(series => 
      series.data.map(d => new Date(d.dimensions[firstDimKey]))
    );
    const [minDate, maxDate] = d3.extent(allDates) as [Date, Date];
    
    // Add time padding to prevent edge cutoff
    const timePadding = (maxDate.getTime() - minDate.getTime()) * 0.02; // 2% padding
    const paddedDomain: [Date, Date] = [
      new Date(minDate.getTime() - timePadding),
      new Date(maxDate.getTime() + timePadding)
    ];
    
    xScale = d3.scaleTime()
      .domain(paddedDomain)
      .range([responsivePadding, width - responsivePadding]);
    
    const tickCount = Math.max(3, Math.min(8, Math.floor(width / 80)));
    xAxis = d3.axisBottom(xScale)
      .ticks(tickCount)
      .tickFormat(d => formatDateForDisplay(d as Date, false, false));
  } else {
    // Non-date dimension - use point scale
    const allValues = visibleSeries.flatMap(series => 
      series.data.map(d => d.dimensions[firstDimKey])
    );
    const uniqueValues = [...new Set(allValues)];
    
    xScale = d3.scalePoint()
      .domain(uniqueValues)
      .range([responsivePadding, width - responsivePadding])
      .padding(0.1);
    
    // Calculate label properties for intelligent rotation
    const maxLabelLength = Math.max(...uniqueValues.map(v => String(v).length));
    const labelWidth = maxLabelLength * 6; // Approx 6px per character
    const availableSpacePerLabel = (width - 2 * responsivePadding) / uniqueValues.length;
    const needsRotation = labelWidth > availableSpacePerLabel * 0.9;
    
    const maxLabels = Math.max(3, Math.floor(width / (needsRotation ? 50 : 70)));
    const step = Math.max(1, Math.ceil(uniqueValues.length / maxLabels));
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(uniqueValues.filter((_, i) => i % step === 0));
  }

  // Calculate Y domain across all processed series
  const customMin = settings.axes?.y?.customScale ? settings.axes?.y?.minValue : undefined;
  const customMax = settings.axes?.y?.customScale ? settings.axes?.y?.maxValue : undefined;
  const autoScale = settings.axes?.y?.autoScale !== false; // Default to true
  const includeZero = settings.axes?.y?.includeZero;
  
  // Debug logging for line chart auto-scale
  console.log('Line Chart Y-axis settings:', {
    autoScale,
    includeZero,
    customMin,
    customMax,
    axesY: settings.axes?.y,
    seriesData: visibleSeries.map(s => ({
      name: s.name,
      values: s.data.map(d => d.value).slice(0, 5)
    }))
  });
  
  const yDomain = calculateYDomain(visibleSeries, true, undefined, customMin, customMax, autoScale, includeZero);
  console.log('Line Chart calculated Y domain:', yDomain);
  
  const yScale = d3.scaleLinear()
    .domain(yDomain)
    .range([height, 0]);

  // Add axes
  const xAxisGroup = g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis);
    
  // Smart label rotation based on calculated density
  const actualDomainLength = xScale.domain().length;
  const estimatedLabelWidth = isDateDimension ? 70 : Math.max(...xScale.domain().map((d: any) => String(d).length)) * 6;
  const totalLabelSpace = actualDomainLength * estimatedLabelWidth;
  const needsRotation = totalLabelSpace > width * 0.8;
  
  if (needsRotation || (!isDateDimension && actualDomainLength > 8)) {
    const rotationAngle = totalLabelSpace > width * 1.5 ? -45 : -30;
    xAxisGroup.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', `rotate(${rotationAngle})`);
  }

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Add zero line if data crosses zero
  if (yDomain[0] < 0 && yDomain[1] > 0) {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.7)
      .attr('class', 'zero-line');
  }

  // Add axis labels for better clarity
  // X-axis label
  g.append('text')
    .attr('transform', `translate(${width / 2}, ${height + 40})`)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#333')
    .text(dimensionConfig?.displayName || dimensionConfig?.label || formatDimensionName(firstDimKey));

  // Y-axis label - show combined measure names if multiple measures
  // Extract just the measure type (e.g., "Growth Index" from "Growth Index - Sandhill PD. 1")
  const cleanMeasureNames = [...new Set(visibleSeries.map(s => {
    // Remove everything after " - " or " (" to get just the measure name
    const name = s.name;
    if (name.includes(' - ')) {
      return name.split(' - ')[0].trim();
    } else if (name.includes(' (')) {
      return name.split(' (')[0].trim();
    }
    return name;
  }))];
  
  const yAxisLabel = cleanMeasureNames.length === 1 
    ? cleanMeasureNames[0] 
    : cleanMeasureNames.length <= 3 
      ? cleanMeasureNames.join(' / ')
      : `Multiple Measures (${cleanMeasureNames.length})`;
  
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -40)
    .attr('x', -(height / 2))
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#333')
    .text(yAxisLabel);

  // Create line generator
  const line = d3.line<any>()
    .x(d => {
      const xValue = d.dimensions[firstDimKey];
      if (isDateDimension) {
        return xScale(new Date(xValue));
      }
      return xScale(xValue) || 0;
    })
    .y(d => {
      const yValue = d.value;
      // Handle null, undefined, or non-numeric values - position at zero for visibility
      if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
        return yScale(0);
      }
      const numericValue = parseFloat(yValue);
      return isNaN(numericValue) ? yScale(0) : yScale(numericValue);
    })
    .defined(d => {
      const yValue = d.value;
      // Show all points, including null/zero values
      return true;
    });

  // Render each series
  visibleSeries.forEach(series => {
    // Add line with thicker stroke for better visibility
    g.append('path')
      .datum(series.data)
      .attr('fill', 'none')
      .attr('stroke', series.color)
      .attr('stroke-width', 3)
      .attr('opacity', series.visible ? 1 : 0.2)
      .attr('d', line)
      .attr('class', `line-series-${series.id}`);

    // Add points
    g.selectAll(`.dot-series-${series.id}`)
      .data(series.data)
      .enter().append('circle')
      .attr('class', `dot dot-series-${series.id}`)
      .attr('cx', (d: any) => isDateDimension ? xScale(new Date(d.dimensions[firstDimKey])) : (xScale(d.dimensions[firstDimKey]) || 0))
      .attr('cy', (d: any) => {
        const yValue = d.value;
        // Handle null, undefined, empty string, and zero values properly
        if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
          return yScale(0); // Position null values at zero line
        }
        const numericValue = parseFloat(yValue);
        if (isNaN(numericValue)) {
          return yScale(0); // Position invalid values at zero line
        }
        return yScale(numericValue);
      })
      .attr('r', 5)
      .attr('fill', (d: any) => {
        const yValue = d.value;
        // Use a different color/style for null values
        if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
          return '#cccccc'; // Light gray for null values
        }
        const numericValue = parseFloat(yValue);
        if (isNaN(numericValue)) {
          return '#cccccc'; // Light gray for invalid values
        }
        return series.color;
      })
      .attr('opacity', series.visible ? 1 : 0.2)
      .attr('stroke', (d: any) => {
        const yValue = d.value;
        // Add border for null values to make them more visible
        if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
          return '#999999';
        }
        const numericValue = parseFloat(yValue);
        if (isNaN(numericValue)) {
          return '#999999';
        }
        return 'none';
      })
      .attr('stroke-width', (d: any) => {
        const yValue = d.value;
        if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
          return 1;
        }
        const numericValue = parseFloat(yValue);
        if (isNaN(numericValue)) {
          return 1;
        }
        return 0;
      })
      .on('mouseover', function(event, d) {
        // Remove any existing tooltips
        g.selectAll('.node-tooltip, .tooltip').remove();
        
        // Create simple hover tooltip for this specific node
        const tooltip = g.append('g')
          .attr('class', 'node-tooltip');
        
        const cx = parseFloat(d3.select(this).attr('cx'));
        const cy = parseFloat(d3.select(this).attr('cy'));
        
        // Calculate tooltip content and size first
        const dimensionEntries = Object.entries(d.dimensions || {});
        const measureEntries = Object.entries(d.measures || {});
        const tooltipWidth = 180;
        const tooltipHeight = 16 + (dimensionEntries.length + measureEntries.length) * 16 + 8;
        
        // Smart positioning to avoid chart boundaries
        let offsetX = 15;
        let offsetY = -tooltipHeight - 5;
        
        // Adjust horizontal position if too close to right edge
        if (cx + offsetX + tooltipWidth > width) {
          offsetX = -(tooltipWidth + 15);
        }
        
        // Adjust vertical position if too close to top edge
        if (cy + offsetY < 0) {
          offsetY = 15;
        }
        
        tooltip.attr('transform', `translate(${cx + offsetX}, ${cy + offsetY})`);
        
        // Background
        tooltip.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', tooltipWidth)
          .attr('height', tooltipHeight)
          .attr('fill', 'rgba(0, 0, 0, 0.9)')
          .attr('stroke', '#666')
          .attr('stroke-width', 1)
          .attr('rx', 6);
        
        let yPos = 16;
        
        // Show dimensions
        dimensionEntries.forEach(([key, value]) => {
          tooltip.append('text')
            .attr('x', 10)
            .attr('y', yPos)
            .attr('fill', 'white')
            .style('font-size', '12px')
            .text(`${key}: ${formatDimensionValue(value, key)}`);
          yPos += 16;
        });
        
        // Show measures
        measureEntries.forEach(([key, value]) => {
          tooltip.append('text')
            .attr('x', 10)
            .attr('y', yPos)
            .attr('fill', 'white')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .text(`${key}: ${formatMeasureValue(value)}`);
          yPos += 16;
        });
      })
      .on('mouseout', function(event) {
        g.selectAll('.node-tooltip').remove();
      })
      .on('click', function(event, d) {
        // Get all data points at this dimension value
        const dimensionKey = Object.keys(d.dimensions)[0];
        const dimensionValue = d.dimensions[dimensionKey];
        
        // Collect all raw data points for this dimension value
        const allDataAtPoint = visibleSeries.flatMap(s => 
          s.data.filter(dataPoint => dataPoint.dimensions[dimensionKey] === dimensionValue)
        );
        
        if (callbacks?.onPointClick && allDataAtPoint.length > 0) {
          const rect = g.node().getBoundingClientRect();
          const position = {
            x: event.clientX || rect.left + parseFloat(this.getAttribute('cx')),
            y: event.clientY || rect.top + parseFloat(this.getAttribute('cy'))
          };
          
          const title = `Data for ${formatDimensionValue(dimensionValue, dimensionKey)}`;
          callbacks.onPointClick(allDataAtPoint, position, title);
        }
      });
  });

  // Add hover zones for better multi-point detection
  const uniqueXValues = [...new Set(visibleSeries.flatMap(s => 
    s.data.map(d => d.dimensions[firstDimKey])
  ))];
  
  // Sort properly for dates or regular values
  if (isDateDimension) {
    uniqueXValues.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  } else {
    uniqueXValues.sort();
  }
  
  uniqueXValues.forEach((xValue, index) => {
    const x = isDateDimension ? xScale(new Date(xValue)) : xScale(xValue);
    if (x === undefined || x === null) return;
    
    // Get all points at this X coordinate
    const allPointsAtX = visibleSeries.flatMap(s => 
      s.data.filter(d => d.dimensions[firstDimKey] === xValue)
    );
    
    if (allPointsAtX.length === 0) return;
    
    // Calculate hover zone width based on spacing
    let hoverWidth = 20;
    if (index < uniqueXValues.length - 1) {
      const nextX = isDateDimension ? xScale(new Date(uniqueXValues[index + 1])) : xScale(uniqueXValues[index + 1]);
      if (nextX !== undefined && nextX !== null) {
        hoverWidth = Math.min(40, Math.abs(nextX - x) * 0.8);
      }
    }
    
    // Create hover zone with very low priority
    g.append('rect')
      .attr('class', 'hover-zone')
      .attr('x', x - hoverWidth/2)
      .attr('y', 0)
      .attr('width', hoverWidth)
      .attr('height', height)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .style('pointer-events', 'none') // Disable hover zone events for now to debug
      .lower() // Put hover zones below dots so dots get events first
      .on('click', function(event) {
        if (callbacks?.onPointClick && allPointsAtX.length > 0) {
          const chartContainer = g.node().getBoundingClientRect();
          const position = {
            x: event.clientX || chartContainer.left + x,
            y: event.clientY || chartContainer.top + height / 2
          };
          
          const title = `Data for ${formatDimensionValue(xValue, firstDimKey)}`;
          callbacks.onPointClick(allPointsAtX, position, title);
        }
      });
  });

  // Ensure all dots are raised above hover zones for proper event handling
  g.selectAll('.dot').raise();

  // Add D3 brush for range selection
  if (callbacks?.onBrushEnd) {
    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on('start', function() {
        brushing = true;
        // Remove existing tooltips when brush starts
        g.selectAll('.tooltip, .node-tooltip').remove();
      })
      .on('brush', function(event) {
        if (!brushing) return;
        
        const selection = event.selection;
        if (selection) {
          // Highlight points within selection
          g.selectAll('.dot')
            .style('opacity', function(d: any) {
              const cx = parseFloat(d3.select(this).attr('cx'));
              const cy = parseFloat(d3.select(this).attr('cy'));
              const [[x0, y0], [x1, y1]] = selection;
              return (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) ? 1 : 0.3;
            });
        } else {
          // Reset opacity when no selection
          g.selectAll('.dot').style('opacity', 1);
        }
      })
      .on('end', function(event) {
        if (!brushing) return;
        
        const selection = event.selection;
        if (selection) {
          // Get all data points within the brushed area
          const [[x0, y0], [x1, y1]] = selection;
          const brushedData: any[] = [];
          
          visibleSeries.forEach(series => {
            series.data.forEach(dataPoint => {
              const cx = isDateDimension ? 
                xScale(new Date(dataPoint.dimensions[firstDimKey])) : 
                xScale(dataPoint.dimensions[firstDimKey]) || 0;
              
              // Use the same Y coordinate calculation as the circles
              const yValue = dataPoint.value;
              let cy;
              if (yValue === null || yValue === undefined || yValue === '' || yValue === '-') {
                cy = yScale(0); // Position null values at zero line
              } else {
                const numericValue = parseFloat(yValue);
                cy = isNaN(numericValue) ? yScale(0) : yScale(numericValue);
              }
              
              if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
                brushedData.push(dataPoint);
              }
            });
          });
          
          if (brushedData.length > 0) {
            // Get chart container position for DataViewer
            const chartContainer = g.node().getBoundingClientRect();
            const position = {
              x: chartContainer.left + (x0 + x1) / 2,
              y: chartContainer.top + (y0 + y1) / 2
            };
            
            const title = `Selected Data Range (${brushedData.length} points)`;
            
            // Store brush selection
            callbacks.onBrushEnd(selection as [[number, number], [number, number]]);
            
            // Open the DataViewer modal
            if (callbacks.onPointClick) {
              callbacks.onPointClick(brushedData, position, title);
            }
          } else {
            // Even if no data captured, still try to open modal for debugging
            console.log('No data captured in brush selection', { x0, y0, x1, y1, visibleSeries });
            
            const chartContainer = g.node().getBoundingClientRect();
            const position = {
              x: chartContainer.left + (x0 + x1) / 2,
              y: chartContainer.top + (y0 + y1) / 2
            };
            
            if (callbacks.onPointClick) {
              callbacks.onPointClick([], position, 'No Data Selected');
            }
          }
        }
        
        // Reset brushing state and clear selection
        brushing = false;
        
        // Use setTimeout to avoid infinite recursion when clearing brush
        setTimeout(() => {
          const brushGroup = g.select('.brush');
          if (brushGroup.node()) {
            brushGroup.call(brush.move, null);
          }
        }, 50);
        
        // Reset point opacity
        g.selectAll('.dot').style('opacity', 1);
      });

    // Add brush to the chart
    const brushGroup = g.append('g')
      .attr('class', 'brush')
      .call(brush);
      
    // Style the brush
    brushGroup.selectAll('.overlay')
      .style('pointer-events', 'all')
      .style('cursor', 'crosshair');
      
    brushGroup.selectAll('.selection')
      .style('fill', 'rgba(0, 123, 255, 0.2)')
      .style('stroke', 'rgba(0, 123, 255, 0.5)')
      .style('stroke-width', 1);
      
    // Add global click handler to reset brush if needed
    g.on('click', function(event) {
      if (event.target === this && brushing) {
        brushing = false;
        brushGroup.call(brush.move, null);
        g.selectAll('.dot').style('opacity', 1);
      }
    });
  }
}

// Legend renderer
function renderLegend(svg: any, legendItems: LegendItem[], x: number, y: number, onToggle: (seriesId: string) => void, position: string = 'right') {
  const legend = svg.append('g')
    .attr('class', 'legend');

  const isHorizontal = ['top', 'bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'].includes(position);
  
  if (isHorizontal) {
    // Create temporary text elements to measure actual widths
    const tempText = svg.append('g').style('visibility', 'hidden');
    const textWidths = legendItems.map(item => {
      const text = tempText.append('text')
        .style('font-size', '12px')
        .style('font-family', 'Arial, sans-serif')
        .text(item.name);
      const width = text.node()?.getBBox().width || 0;
      text.remove();
      return width;
    });
    tempText.remove();
    
    // Calculate dynamic spacing with minimum padding
    const minPadding = 24; // Space for color indicator + padding
    const itemPadding = 15; // Extra padding between items
    const maxTextWidth = 200; // Increased max width before truncation
    const itemWidths = textWidths.map(width => Math.min(width, maxTextWidth) + minPadding + itemPadding);
    
    // Check if items fit in available width (use actual chart width)
    const availableWidth = Math.max(600, x * 1.8); // Use chart area width
    const totalWidth = itemWidths.reduce((sum, width) => sum + width, 0);
    
    // Calculate optimal layout
    let rows: number[][] = [];
    let currentRow: number[] = [];
    let currentRowWidth = 0;
    
    itemWidths.forEach((width, i) => {
      if (currentRowWidth + width > availableWidth && currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [i];
        currentRowWidth = width;
      } else {
        currentRow.push(i);
        currentRowWidth += width;
      }
    });
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
    
    const rowHeight = 25; // Increased row height for better spacing
    const legendHeight = rows.length * rowHeight;
    
    // Position legend based on position type
    // Only center for top/bottom positions, not corners
    const shouldCenter = position === 'top' || position === 'bottom';
    const legendXOffset = shouldCenter ? x - availableWidth / 2 : x;
    legend.attr('transform', `translate(${legendXOffset}, ${y - legendHeight + 10})`);
    
    const legendGroups = legend.selectAll('.legend-item')
      .data(legendItems)
      .enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d: any, i: number) => {
        // Find which row this item is in
        let rowIndex = 0;
        let itemIndex = 0;
        for (let r = 0; r < rows.length; r++) {
          if (rows[r].includes(i)) {
            rowIndex = r;
            itemIndex = rows[r].indexOf(i);
            break;
          }
        }
        
        // Calculate x position within the row
        let xPos = 0;
        for (let j = 0; j < itemIndex; j++) {
          const itemIdx = rows[rowIndex][j];
          xPos += itemWidths[itemIdx];
        }
        
        // Center the row only for top/bottom positions
        const rowWidth = rows[rowIndex].reduce((sum, idx) => sum + itemWidths[idx], 0);
        const rowOffset = shouldCenter ? (availableWidth - rowWidth) / 2 : 0;
        
        return `translate(${rowOffset + xPos}, ${rowIndex * rowHeight})`;
      })
      .style('cursor', 'pointer')
      .on('click', (event: any, d: LegendItem) => onToggle(d.id));

    // Color indicator
    legendGroups.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', (d: LegendItem) => d.color)
      .attr('opacity', (d: LegendItem) => d.visible ? 1 : 0.3);

    // Text label with improved truncation
    const textElements = legendGroups.append('text')
      .attr('x', 18)
      .attr('y', 9)
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('font-family', 'Arial, sans-serif')
      .style('fill', (d: LegendItem) => d.visible ? '#333' : '#999')
      .text((d: LegendItem, i: number) => {
        const maxTextWidth = 180; // Increased max width for better readability
        if (textWidths[i] > maxTextWidth) {
          // More conservative truncation
          let truncated = d.name;
          // Find good break points (after dashes, spaces)
          const breakPoints = [' - ', ' ', '-'];
          for (const breakPoint of breakPoints) {
            const parts = d.name.split(breakPoint);
            if (parts.length > 1) {
              // Try to keep meaningful parts
              for (let j = parts.length - 1; j > 0; j--) {
                const candidate = parts.slice(0, j).join(breakPoint);
                const testText = svg.append('text')
                  .style('font-size', '12px')
                  .style('font-family', 'Arial, sans-serif')
                  .style('visibility', 'hidden')
                  .text(candidate + '...');
                const testWidth = testText.node()?.getBBox().width || 0;
                testText.remove();
                if (testWidth <= maxTextWidth) {
                  return candidate + '...';
                }
              }
            }
          }
          
          // Fallback to character truncation if no good break points
          while (truncated.length > 5) {
            truncated = truncated.slice(0, -1);
            const testText = svg.append('text')
              .style('font-size', '12px')
              .style('font-family', 'Arial, sans-serif')
              .style('visibility', 'hidden')
              .text(truncated + '...');
            const testWidth = testText.node()?.getBBox().width || 0;
            testText.remove();
            if (testWidth <= maxTextWidth) {
              return truncated + '...';
            }
          }
        }
        return d.name;
      });
    
    // Add tooltip for full text
    textElements.append('title')
      .text((d: LegendItem) => d.name);
  } else {
    // Vertical layout (right side) - keep existing logic
    legend.attr('transform', `translate(${x}, ${y})`);
    
    const legendGroups = legend.selectAll('.legend-item')
      .data(legendItems)
      .enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d: any, i: number) => `translate(0, ${i * 20})`)
      .style('cursor', 'pointer')
      .on('click', (event: any, d: LegendItem) => onToggle(d.id));

    // Color indicator
    legendGroups.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', (d: LegendItem) => d.color)
      .attr('opacity', (d: LegendItem) => d.visible ? 1 : 0.3);

    // Text label with truncation for very long names
    legendGroups.append('text')
      .attr('x', 18)
      .attr('y', 9)
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('font-family', 'Arial, sans-serif')
      .style('fill', (d: LegendItem) => d.visible ? '#333' : '#999')
      .text((d: LegendItem) => {
        const maxLength = 25; // Characters before truncation
        return d.name.length > maxLength ? d.name.substring(0, maxLength) + '...' : d.name;
      })
      .append('title') // Add tooltip for full text
      .text((d: LegendItem) => d.name);
  }
}

// Consistent statistics box styling function
function createStatsBox(g: any, x: number, y: number, stats: Array<{label: string, value: string | number}>, options?: {
  width?: number;
  height?: number;
  fontSize?: number;
  backgroundColor?: string;
  textColor?: string;
}) {
  const opts = {
    width: 180,
    height: 20 + stats.length * 20,
    fontSize: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    textColor: '#333',
    ...options
  };
  
  const statsGroup = g.append('g')
    .attr('class', 'stats-box')
    .attr('transform', `translate(${x}, ${y})`);
  
  // Background
  statsGroup.append('rect')
    .attr('width', opts.width)
    .attr('height', opts.height)
    .attr('fill', opts.backgroundColor)
    .attr('stroke', '#e0e0e0')
    .attr('stroke-width', 1)
    .attr('rx', 4)
    .style('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.1))');
  
  // Stats text
  stats.forEach((stat, i) => {
    statsGroup.append('text')
      .attr('x', 10)
      .attr('y', 20 + i * 20)
      .style('font-size', `${opts.fontSize}px`)
      .style('font-family', 'Arial, sans-serif')
      .style('fill', opts.textColor)
      .text(`${stat.label}: ${stat.value}`);
  });
  
  return statsGroup;
}

// Professional scatter plot with advanced statistical analysis
function renderScatterPlot(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any, metadata?: any) {
  if (!data.length) return;
  
  // Apply aggregation based on measure configuration
  const processedData = aggregateData(data, metadata);
  
  const dimKeys = Object.keys(processedData[0].dimensions);
  const measureKeys = Object.keys(processedData[0].measures);
  
  if (measureKeys.length < 2) {
    console.warn('Scatter plot requires at least 2 measures');
    return;
  }
  
  const xKey = measureKeys[0];
  const yKey = measureKeys[1];
  const sizeKey = measureKeys[2]; // Optional third measure for bubble size
  const colorKey = dimKeys[0]; // Use first dimension for color grouping
  
  // Extract numeric values
  const xValues = processedData.map(d => +d.measures[xKey]).filter(v => !isNaN(v));
  const yValues = processedData.map(d => +d.measures[yKey]).filter(v => !isNaN(v));
  
  // Calculate statistical metrics
  const statistics = calculateBivariateStatistics(xValues, yValues);
  
  // Set up scales with padding
  const xExtent = d3.extent(xValues) as [number, number];
  const yExtent = d3.extent(yValues) as [number, number];
  const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
  const yPadding = (yExtent[1] - yExtent[0]) * 0.1;
  
  // Small padding for scale aesthetics (margins already applied at container level)
  const responsivePadding = 40;
  
  const xScale = d3.scaleLinear()
    .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
    .range([responsivePadding, width - responsivePadding])
    .nice();
    
  const yScale = d3.scaleLinear()
    .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
    .range([height, 0])
    .nice();
  
  // Size scale for bubble chart (if third measure exists)
  const sizeScale = sizeKey ? d3.scaleLinear()
    .domain(d3.extent(processedData, d => +d.measures[sizeKey]) as [number, number])
    .range([4, 20]) : null;
  
  // Color scale for grouping
  const groups = colorKey ? Array.from(new Set(processedData.map(d => d.dimensions[colorKey]))) : ['All'];
  const colorScale = d3.scaleOrdinal()
    .domain(groups)
    .range(resolveColorPalette(settings.colors?.palette, COLOR_PALETTES.tableau10));
  
  // Add grid lines
  const xGridlines = g.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale)
      .tickSize(-height)
      .tickFormat(() => ''))
    .style('stroke-dasharray', '3,3')
    .style('opacity', 0.3);
    
  const yGridlines = g.append('g')
    .attr('class', 'grid')
    .call(d3.axisLeft(yScale)
      .tickSize(-width)
      .tickFormat(() => ''))
    .style('stroke-dasharray', '3,3')
    .style('opacity', 0.3);
  
  // Add axes
  const xAxis = g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale));
    
  const yAxis = g.append('g')
    .call(d3.axisLeft(yScale));
  
  // Add axis labels
  g.append('text')
    .attr('transform', `translate(${width / 2}, ${height + 40})`)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text(xKey);
    
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -40)
    .attr('x', -(height / 2))
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text(yKey);
  
  // Add regression line
  if (statistics.regression) {
    const { slope, intercept } = statistics.regression;
    const x1 = xScale.domain()[0];
    const x2 = xScale.domain()[1];
    const y1 = slope * x1 + intercept;
    const y2 = slope * x2 + intercept;
    
    g.append('line')
      .attr('class', 'regression-line')
      .attr('x1', xScale(x1))
      .attr('y1', yScale(y1))
      .attr('x2', xScale(x2))
      .attr('y2', yScale(y2))
      .attr('stroke', '#e74c3c')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.8);
    
    // Add regression equation
    g.append('text')
      .attr('x', width - 10)
      .attr('y', 20)
      .attr('text-anchor', 'end')
      .style('font-size', '12px')
      .style('fill', '#e74c3c')
      .text(`y = ${slope.toFixed(3)}x + ${intercept.toFixed(3)}`);
  }
  
  // Add confidence ellipse
  if (statistics.covariance !== 0) {
    drawConfidenceEllipse(g, statistics, xScale, yScale, resolveColorPalette(settings.colors?.palette)[0]);
  }
  
  // Add density contours for large datasets
  if (processedData.length > 100) {
    const contourData = calculateDensityContours(processedData, xKey, yKey, xScale, yScale);
    
    g.append('g')
      .attr('class', 'contours')
      .selectAll('path')
      .data(contourData)
      .enter()
      .append('path')
      .attr('d', d3.geoPath())
      .attr('fill', 'none')
      .attr('stroke', resolveColorPalette(settings.colors?.palette)[0])
      .attr('stroke-width', 1)
      .attr('opacity', 0.3);
  }
  
  // Add points
  const dots = g.selectAll('.dot')
    .data(processedData.filter(d => !isNaN(+d.measures[xKey]) && !isNaN(+d.measures[yKey])))
    .enter()
    .append('circle')
    .attr('class', 'dot')
    .attr('cx', (d: any) => xScale(+d.measures[xKey]))
    .attr('cy', (d: any) => yScale(+d.measures[yKey]))
    .attr('r', (d: any) => sizeScale && sizeKey ? sizeScale(+d.measures[sizeKey]) : 5)
    .attr('fill', (d: any) => colorKey ? colorScale(d.dimensions[colorKey]) : resolveColorPalette(settings.colors?.palette)[0])
    .style('cursor', 'pointer')
    .style('opacity', 0.7)
    .style('stroke', '#fff')
    .style('stroke-width', 1);
  
  // Add quadrant lines if appropriate
  if (xScale.domain()[0] < 0 && xScale.domain()[1] > 0) {
    g.append('line')
      .attr('x1', xScale(0))
      .attr('x2', xScale(0))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('opacity', 0.3);
  }
  
  if (yScale.domain()[0] < 0 && yScale.domain()[1] > 0) {
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('opacity', 0.3);
  }
  
  // Add statistical summary (positioned in top-right corner of chart)
  const statsGroup = g.append('g')
    .attr('class', 'statistics')
    .attr('transform', `translate(${width - 210}, -40)`); // Position in top-right with padding
  
  // Add a help icon
  const helpIcon = statsGroup.append('g')
    .style('cursor', 'help');
    
  helpIcon.append('circle')
    .attr('cx', 10)
    .attr('cy', 10)
    .attr('r', 8)
    .attr('fill', '#3498db')
    .attr('opacity', 0.8);
    
  helpIcon.append('text')
    .attr('x', 10)
    .attr('y', 14)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', 'white')
    .text('?');
  
  // Add toggle button
  const toggleButton = statsGroup.append('g')
    .attr('transform', 'translate(180, 0)')
    .style('cursor', 'pointer');
    
  toggleButton.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', 20)
    .attr('height', 20)
    .attr('fill', '#f8f9fa')
    .attr('stroke', '#ddd')
    .attr('stroke-width', 1)
    .attr('rx', 3);
    
  toggleButton.append('text')
    .attr('x', 10)
    .attr('y', 14)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text('−');
  
  const statsContent = statsGroup.append('g')
    .attr('class', 'stats-content')
    .attr('transform', 'translate(0, 25)');
  
  const statsBackground = statsContent.append('rect')
    .attr('width', 200)
    .attr('height', 100)
    .attr('fill', 'white')
    .attr('stroke', '#ddd')
    .attr('stroke-width', 1)
    .attr('rx', 3)
    .attr('opacity', 0.95)
    .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
  
  const statsData = [
    { label: 'n', value: statistics.n, tooltip: 'Sample size: The number of data points in your dataset' },
    { label: 'r', value: statistics.correlation.toFixed(3), tooltip: 'Correlation coefficient: Measures the strength and direction of the relationship between variables (-1 to +1)\n• Close to +1: Strong positive relationship\n• Close to -1: Strong negative relationship\n• Close to 0: No linear relationship' },
    { label: 'R²', value: statistics.rSquared.toFixed(3), tooltip: 'R-squared: The proportion of variance explained by the relationship (0 to 1)\n• 0.7 or higher: Strong relationship\n• 0.3-0.7: Moderate relationship\n• Below 0.3: Weak relationship' },
    { label: 'p-value', value: statistics.pValue.toFixed(4), tooltip: 'P-value: The probability that this relationship occurred by chance\n• < 0.05: Statistically significant\n• < 0.01: Highly significant\n• < 0.001: Extremely significant\n• ≥ 0.05: Not statistically significant' }
  ];
  
  statsData.forEach((stat, i) => {
    const textElement = statsContent.append('text')
      .attr('x', 10)
      .attr('y', 20 + i * 20)
      .style('font-size', '11px')
      .style('font-weight', i === 0 ? 'normal' : 'bold')
      .style('fill', stat.label === 'p-value' && statistics.pValue < 0.05 ? '#27ae60' : '#333')
      .style('cursor', 'help')
      .text(`${stat.label} = ${stat.value}`);
      
    // Add hover tooltip for each stat (use closure to capture current stat and index)
    (function(currentStat, currentIndex) {
      textElement.on('mouseover', function(event) {
      const tooltip = g.append('g')
        .attr('class', 'stat-tooltip');
        
      const lines = currentStat.tooltip.split('\n');
      const maxWidth = Math.max(...lines.map(line => line.length * 6));
      const tooltipHeight = lines.length * 15 + 10;
      
      // Smart positioning: place tooltip below stats box if near top, otherwise above
      let tooltipX, tooltipY;
      
      if (currentIndex <= 1) {
        // For first two stats (n and r), position below the stats box
        tooltipX = width - 300;
        tooltipY = 40 + (currentIndex * 30);
      } else {
        // For last two stats (R² and p-value), position to the left
        tooltipX = Math.max(50, width - 450); // Ensure it doesn't go off the left edge
        tooltipY = -20 + ((currentIndex - 2) * 30);
      }
      
      // If tooltip would go off the left edge, position it below instead
      if (tooltipX < 50) {
        tooltipX = width - 300;
        tooltipY = 80 + (currentIndex * 20);
      }
      
      // Add a pointer triangle from tooltip to stat
      const statX = width - 200;
      const statY = 5 + currentIndex * 20;
      
      tooltip.append('path')
        .attr('d', () => {
          // Create a small triangle pointing to the stat
          const tipX = tooltipX > statX ? tooltipX : tooltipX + maxWidth;
          const tipY = tooltipY + tooltipHeight / 2;
          return `M ${tipX} ${tipY} L ${statX} ${statY} L ${tipX} ${tipY + 10} Z`;
        })
        .attr('fill', '#333')
        .attr('opacity', 0.95);
      
      // Add shadow effect
      const shadow = tooltip.append('defs')
        .append('filter')
        .attr('id', 'tooltip-shadow')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');
      
      shadow.append('feDropShadow')
        .attr('dx', 2)
        .attr('dy', 2)
        .attr('stdDeviation', 3)
        .attr('flood-opacity', 0.3);
      
      const tooltipBg = tooltip.append('rect')
        .attr('x', tooltipX)
        .attr('y', tooltipY)
        .attr('width', maxWidth)
        .attr('height', tooltipHeight)
        .attr('fill', '#333')
        .attr('opacity', 0.95)
        .attr('rx', 4)
        .attr('filter', 'url(#tooltip-shadow)');
        
      lines.forEach((line, lineIdx) => {
        tooltip.append('text')
          .attr('x', tooltipX + 5)
          .attr('y', tooltipY + 15 + lineIdx * 15)
          .style('font-size', '11px')
          .style('fill', 'white')
          .text(line);
      });
      
      // Highlight the hovered stat
      d3.select(this)
        .style('font-weight', 'bold')
        .style('text-decoration', 'underline');
    })
    .on('mouseout', function() {
      g.selectAll('.stat-tooltip').remove();
      
      // Remove highlight
      d3.select(this)
        .style('font-weight', currentIndex === 0 ? 'normal' : 'bold')
        .style('text-decoration', 'none');
    });
    })(stat, i); // Pass current stat and index to closure
  });
  
  // Add significance indicator
  if (statistics.pValue < 0.001) {
    statsContent.append('text')
      .attr('x', 150)
      .attr('y', 80)
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', '#27ae60')
      .text('***');
  } else if (statistics.pValue < 0.01) {
    statsContent.append('text')
      .attr('x', 150)
      .attr('y', 80)
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', '#27ae60')
      .text('**');
  } else if (statistics.pValue < 0.05) {
    statsContent.append('text')
      .attr('x', 150)
      .attr('y', 80)
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', '#27ae60')
      .text('*');
  }
  
  // Help icon tooltip
  helpIcon.on('mouseover', function(event) {
    const helpTooltip = g.append('g')
      .attr('class', 'help-tooltip');
      
    const helpText = [
      'Statistical Analysis Guide:',
      '',
      'This box shows key statistics about',
      'the relationship between your variables.',
      '',
      'Hover over each value to learn more!',
      '',
      'Click − to minimize the statistics box.'
    ];
    
    const maxWidth = 250;
    const tooltipHeight = helpText.length * 15 + 20;
    
    helpTooltip.append('rect')
      .attr('x', width - 250)
      .attr('y', 30)
      .attr('width', maxWidth)
      .attr('height', tooltipHeight)
      .attr('fill', '#333')
      .attr('opacity', 0.95)
      .attr('rx', 4);
      
    helpText.forEach((line, idx) => {
      helpTooltip.append('text')
        .attr('x', width - 240)
        .attr('y', 45 + idx * 15)
        .style('font-size', '11px')
        .style('fill', 'white')
        .style('font-weight', idx === 0 ? 'bold' : 'normal')
        .text(line);
    });
  })
  .on('mouseout', function() {
    g.selectAll('.help-tooltip').remove();
  });
  
  // Toggle functionality
  let isExpanded = true;
  toggleButton.on('click', function() {
    isExpanded = !isExpanded;
    
    statsContent.transition()
      .duration(300)
      .style('opacity', isExpanded ? 1 : 0)
      .style('display', isExpanded ? 'block' : 'none');
      
    toggleButton.select('text')
      .text(isExpanded ? '−' : '+');
      
    if (!isExpanded) {
      // Show mini stats when collapsed
      statsGroup.append('text')
        .attr('class', 'mini-stats')
        .attr('x', 90)
        .attr('y', 14)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', statistics.pValue < 0.05 ? '#27ae60' : '#666')
        .text(`r = ${statistics.correlation.toFixed(2)}`);
    } else {
      statsGroup.selectAll('.mini-stats').remove();
    }
  });
  
  // Enhanced interactions
  if (callbacks) {
    dots
      .on('mouseover', function(event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', (sizeScale && sizeKey ? sizeScale(+d.measures[sizeKey]) : 5) * 1.5)
          .style('opacity', 1);
        
        // Create detailed tooltip
        const tooltip = g.append('g')
          .attr('class', 'point-tooltip');
        
        const x = xScale(+d.measures[xKey]);
        const y = yScale(+d.measures[yKey]);
        
        const tooltipRect = tooltip.append('rect')
          .attr('x', x + 10)
          .attr('y', y - 40)
          .attr('width', 150)
          .attr('height', 60)
          .attr('fill', 'white')
          .attr('stroke', '#333')
          .attr('stroke-width', 1)
          .attr('rx', 3);
        
        const tooltipData = [
          `${xKey}: ${(+d.measures[xKey]).toFixed(2)}`,
          `${yKey}: ${(+d.measures[yKey]).toFixed(2)}`
        ];
        
        if (sizeKey) {
          tooltipData.push(`${sizeKey}: ${(+d.measures[sizeKey]).toFixed(2)}`);
        }
        
        if (colorKey) {
          tooltipData.unshift(`${colorKey}: ${d.dimensions[colorKey]}`);
        }
        
        tooltipData.forEach((text, i) => {
          tooltip.append('text')
            .attr('x', x + 20)
            .attr('y', y - 20 + i * 15)
            .style('font-size', '11px')
            .text(text);
        });
      })
      .on('mouseout', function(event: any, d: any) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', sizeScale && sizeKey ? sizeScale(+d.measures[sizeKey]) : 5)
          .style('opacity', 0.7);
        
        g.selectAll('.point-tooltip').remove();
      })
      .on('click', function(event: any, d: any) {
        if (callbacks.onPointClick) {
          const detailedData = [{
            ...d,
            statistics: {
              xValue: +d.measures[xKey],
              yValue: +d.measures[yKey],
              predictedY: statistics.regression ? 
                statistics.regression.slope * (+d.measures[xKey]) + statistics.regression.intercept : null,
              residual: statistics.regression ? 
                (+d.measures[yKey]) - (statistics.regression.slope * (+d.measures[xKey]) + statistics.regression.intercept) : null,
              standardizedResidual: null // Would need to calculate
            }
          }];
          
          const rect = this.getBoundingClientRect();
          callbacks.onPointClick(detailedData, { x: rect.left, y: rect.top }, 
            `Data Point Analysis`);
        }
      });
  }
  
  // Add lasso selection for advanced selection
  if (callbacks && settings.interactions.brush.enabled) {
    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on('end', function(event) {
        const selection = event.selection;
        if (selection) {
          const [[x0, y0], [x1, y1]] = selection;
          const brushedData: any[] = [];
          
          data.forEach(dataPoint => {
            const cx = xScale(+dataPoint.measures[xKey]);
            const cy = yScale(+dataPoint.measures[yKey]);
            
            if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
              brushedData.push(dataPoint);
            }
          });
          
          if (brushedData.length > 0) {
            // Calculate statistics for selected points
            const selectedX = brushedData.map(d => +d.measures[xKey]);
            const selectedY = brushedData.map(d => +d.measures[yKey]);
            const selectedStats = calculateBivariateStatistics(selectedX, selectedY);
            
            if (callbacks.onPointClick) {
              const enrichedData = brushedData.map(d => ({
                ...d,
                selectionStatistics: selectedStats
              }));
              
              const position = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
              callbacks.onPointClick(enrichedData, position, 
                `Selected ${brushedData.length} points (r=${selectedStats.correlation.toFixed(3)})`);
            }
          }
          
          // Clear brush selection
          d3.select(this).call(brush.move, null);
        }
      });
      
    g.append('g')
      .attr('class', 'brush')
      .call(brush);
  }
  
  // Helper function to calculate bivariate statistics
  function calculateBivariateStatistics(xVals: number[], yVals: number[]) {
    const n = Math.min(xVals.length, yVals.length);
    const xMean = d3.mean(xVals) || 0;
    const yMean = d3.mean(yVals) || 0;
    const xStdDev = Math.sqrt(d3.variance(xVals) || 0);
    const yStdDev = Math.sqrt(d3.variance(yVals) || 0);
    
    // Calculate covariance
    let covariance = 0;
    for (let i = 0; i < n; i++) {
      covariance += (xVals[i] - xMean) * (yVals[i] - yMean);
    }
    covariance /= (n - 1);
    
    // Calculate correlation
    const correlation = covariance / (xStdDev * yStdDev);
    const rSquared = correlation * correlation;
    
    // Calculate regression coefficients
    const slope = covariance / (xStdDev * xStdDev);
    const intercept = yMean - slope * xMean;
    
    // Calculate p-value (simplified t-test)
    const tStatistic = correlation * Math.sqrt((n - 2) / (1 - rSquared));
    const degreesOfFreedom = n - 2;
    // Approximate p-value (would need a proper t-distribution for accuracy)
    const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic) / Math.sqrt(degreesOfFreedom)));
    
    return {
      n,
      xMean,
      yMean,
      xStdDev,
      yStdDev,
      covariance,
      correlation,
      rSquared,
      regression: { slope, intercept },
      pValue
    };
  }
  
  // Helper function for confidence ellipse
  function drawConfidenceEllipse(g: any, stats: any, xScale: any, yScale: any, color: string) {
    const confidence = 0.95;
    const chiSquared = 5.991; // 95% confidence for 2 degrees of freedom
    
    const a = stats.xStdDev * Math.sqrt(chiSquared);
    const b = stats.yStdDev * Math.sqrt(chiSquared);
    const theta = Math.atan2(2 * stats.covariance, stats.xStdDev * stats.xStdDev - stats.yStdDev * stats.yStdDev) / 2;
    
    const ellipse = g.append('ellipse')
      .attr('cx', xScale(stats.xMean))
      .attr('cy', yScale(stats.yMean))
      .attr('rx', Math.abs(xScale(stats.xMean + a) - xScale(stats.xMean)))
      .attr('ry', Math.abs(yScale(stats.yMean) - yScale(stats.yMean + b)))
      .attr('transform', `rotate(${theta * 180 / Math.PI}, ${xScale(stats.xMean)}, ${yScale(stats.yMean)})`)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.5);
  }
  
  // Helper function for density contours
  function calculateDensityContours(data: any[], xKey: string, yKey: string, xScale: any, yScale: any) {
    // Simplified density estimation
    const bandwidth = 20;
    const thresholds = 5;
    
    // This is a placeholder - in production, use d3.contourDensity()
    return [];
  }
  
  // Approximate normal CDF
  function normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return 0.5 * (1.0 + sign * y);
  }
}