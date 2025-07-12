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

// Helper function to format dates for display
function formatDateForDisplay(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);
  
  return `${month}/${day}/${year}`;
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

// Enhanced color palettes for multi-series
const COLOR_PALETTES = {
  category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
  tableau10: ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'],
  set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd'],
  viridis: ['#440154', '#31688e', '#35b779', '#fde725'],
  agricultural: ['#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9']
};

// Generate series data from aggregated data
function generateSeriesData(data: any[], colorPalette: string[] = COLOR_PALETTES.category10): SeriesData[] {
  if (!data.length) return [];
  
  const firstItem = data[0];
  const measureKeys = Object.keys(firstItem.measures || {});
  
  return measureKeys.map((measureKey, index) => {
    // Create a proper display name from the measure key
    let displayName = measureKey;
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

// Smart Y-axis scaling for multiple series
function calculateYDomain(seriesData: SeriesData[], visibleOnly: boolean = true): [number, number] {
  const visibleSeries = visibleOnly ? seriesData.filter(s => s.visible) : seriesData;
  
  if (visibleSeries.length === 0) return [0, 100];
  
  const allValues = visibleSeries.flatMap(series => 
    series.data.map(d => d.value).filter(v => v != null && !isNaN(v))
  );
  
  if (allValues.length === 0) return [0, 100];
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const padding = (max - min) * 0.1; // 10% padding
  
  // Always include zero in the domain for proper zero value positioning
  const minDomain = Math.min(0, min - padding);
  const maxDomain = Math.max(max + padding, 10); // Ensure at least some range
  
  return [minDomain, maxDomain];
}

export const BaseChart: React.FC<BaseChartProps> = ({
  data,
  settings,
  chartType,
  className = '',
  onSeriesToggle,
  onDataSelect
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [seriesData, setSeriesData] = useState<SeriesData[]>([]);
  const [legendItems, setLegendItems] = useState<LegendItem[]>([]);
  
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

    const newSeriesData = generateSeriesData(filteredData, COLOR_PALETTES.category10);
    setSeriesData(newSeriesData);
    
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

  function renderHeatmap(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
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

    // Get unique values for each dimension
    let xValues = [...new Set(data.map(d => d.dimensions[xDim]))];
    let yValues = [...new Set(data.map(d => d.dimensions[yDim]))];
    
    // Calculate dynamic margins based on content
    const longestYLabel = Math.max(...yValues.map(v => String(v).length)) * 7; // Approximate char width
    const marginLeft = Math.max(50, Math.min(80, longestYLabel + 10));
    const marginBottom = 70; // For rotated date labels
    const marginTop = 20;
    const marginRight = 100; // For color legend
    
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
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([0, adjustedWidth])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(yValues)
      .range([adjustedHeight, 0])
      .padding(0.05);

    // Create color scale for the heatmap with custom gradient
    const extent = d3.extent(data, d => +d.measures[measure]) as [number, number];
    
    // Custom color interpolator: blue -> green -> yellow -> orange -> red -> purple
    const colorScale = d3.scaleSequential()
      .domain(extent)
      .interpolator((t) => {
        // Define color stops for smooth transitions
        if (t < 0.2) {
          // Blue to green
          return d3.interpolateRgb("#0066CC", "#00AA44")(t * 5);
        } else if (t < 0.4) {
          // Green to yellow
          return d3.interpolateRgb("#00AA44", "#FFDD00")((t - 0.2) * 5);
        } else if (t < 0.6) {
          // Yellow to orange
          return d3.interpolateRgb("#FFDD00", "#FF8800")((t - 0.4) * 5);
        } else if (t < 0.8) {
          // Orange to red
          return d3.interpolateRgb("#FF8800", "#DD0000")((t - 0.6) * 5);
        } else {
          // Red to purple (hottest)
          return d3.interpolateRgb("#DD0000", "#AA00FF")((t - 0.8) * 5);
        }
      });

    // Add axes
    const xAxis = heatmapG.append('g')
      .attr('transform', `translate(0,${adjustedHeight})`)
      .call(d3.axisBottom(xScale));

    // Format x-axis labels
    xAxis.selectAll('text')
      .text((d: any) => {
        if (isXDate && isDateField(d)) {
          const date = new Date(d);
          return formatDateForDisplay(date);
        }
        return d;
      })
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .style('font-size', '10px');

    heatmapG.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '10px');

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height - 5})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(xDim);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 15)
      .attr('x', -(height / 2))
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(yDim);

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
          
          if (callbacks.onHover && settings.tooltips.show) {
            const rect = this.getBoundingClientRect();
            const position = {
              x: rect.left + rect.width / 2,
              y: rect.top
            };
            const tooltipText = `${xDim}: ${d.dimensions[xDim]}\n${yDim}: ${d.dimensions[yDim]}\n${measure}: ${d.measures[measure]}`;
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

    // Create gradient stops matching our custom color scale
    const gradientStops = [
      { offset: '0%', color: '#0066CC' },     // Blue (coldest)
      { offset: '20%', color: '#00AA44' },    // Green
      { offset: '40%', color: '#FFDD00' },    // Yellow
      { offset: '60%', color: '#FF8800' },    // Orange
      { offset: '80%', color: '#DD0000' },    // Red
      { offset: '100%', color: '#AA00FF' }    // Purple (hottest)
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

    legend.append('g')
      .attr('transform', `translate(${legendWidth}, 0)`)
      .call(d3.axisRight(legendScale).ticks(5))
      .selectAll('text')
      .style('font-size', '10px');

    legend.append('text')
      .attr('transform', `translate(${legendWidth + 40}, ${legendHeight / 2}) rotate(90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .text(measure);

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
    const xScale = d3.scaleBand()
      .domain(groups)
      .range([0, width])
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
      .attr('transform', 'rotate(-45)');

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
    const xScale = d3.scaleLinear()
      .domain(d3.extent(values) as [number, number])
      .range([0, width])
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
      .attr('fill', '#3498db')
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

    // Add distribution info box
    const infoGroup = g.append('g')
      .attr('class', 'distribution-info')
      .attr('transform', `translate(${width - 220}, 10)`);

    const infoBox = infoGroup.append('rect')
      .attr('width', 210)
      .attr('height', 140)
      .attr('fill', 'white')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 1)
      .attr('rx', 3)
      .attr('opacity', 0.95);

    const infoData = [
      { label: 'n', value: n },
      { label: 'Mean', value: mean.toFixed(2), color: '#e74c3c' },
      { label: 'Median', value: median.toFixed(2), color: '#27ae60' },
      { label: 'Std Dev', value: stdDev.toFixed(2) },
      { label: 'Skewness', value: skewness.toFixed(3), interpretation: getSkewnessInterpretation(skewness) },
      { label: 'Kurtosis', value: kurtosis.toFixed(3), interpretation: getKurtosisInterpretation(kurtosis) }
    ];

    infoData.forEach((info, i) => {
      const y = 20 + i * 20;
      
      // Add colored line for mean/median
      if (info.color) {
        infoGroup.append('line')
          .attr('x1', 5)
          .attr('x2', 15)
          .attr('y1', y - 5)
          .attr('y2', y - 5)
          .attr('stroke', info.color)
          .attr('stroke-width', 2);
      }
      
      infoGroup.append('text')
        .attr('x', info.color ? 20 : 10)
        .attr('y', y)
        .style('font-size', '11px')
        .style('font-weight', i === 0 ? 'normal' : 'bold')
        .text(`${info.label}: ${info.value}`);
        
      if (info.interpretation) {
        infoGroup.append('text')
          .attr('x', 120)
          .attr('y', y)
          .style('font-size', '10px')
          .style('fill', '#666')
          .style('font-style', 'italic')
          .text(info.interpretation);
      }
    });

    // Normality test result
    const isNormal = Math.abs(skewness) < 0.5 && Math.abs(kurtosis) < 1;
    infoGroup.append('text')
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
    
    if (dimKeys.length < 2 || measureKeys.length < 1) {
      console.warn('TreeMap requires at least 2 dimensions (hierarchy levels and time) and 1 measure');
      return;
    }

    // Identify time dimension (last dimension) and hierarchy dimensions
    const timeDim = dimKeys[dimKeys.length - 1];
    const hierarchyDims = dimKeys.slice(0, -1);
    const measure = measureKeys[0];

    // Get unique time values
    let timeValues = [...new Set(data.map(d => d.dimensions[timeDim]))];
    
    // Sort time values if they are dates
    const isTimeDate = timeValues.length > 0 && isDateField(timeValues[0]);
    if (isTimeDate) {
      timeValues = timeValues.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
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
      const timeData = data.filter(d => d.dimensions[timeDim] === timeValue);
      
      // Build nested structure
      const root: any = {
        name: 'root',
        children: []
      };

      // Group data by hierarchy levels
      const grouped = d3.group(timeData, ...hierarchyDims.map(dim => (d: any) => d.dimensions[dim]));
      
      // Convert to hierarchical structure
      function processGroup(group: any, level: number = 0): any {
        if (level === hierarchyDims.length) {
          // Leaf level - aggregate measures
          const values = Array.isArray(group) ? group : [group];
          return {
            name: 'leaf',
            value: d3.sum(values, (d: any) => +d.measures[measure] || 0)
          };
        }
        
        const children: any[] = [];
        group.forEach((subGroup: any, key: string) => {
          const child = processGroup(subGroup, level + 1);
          if (Array.isArray(child)) {
            children.push({
              name: key,
              children: child
            });
          } else {
            children.push({
              name: key,
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

    // Color scale
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

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
        .attr('fill', (d: any) => {
          const topCategory = d.ancestors().reverse()[1]?.data.name || 'root';
          return colorScale(topCategory);
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      // Add labels to new cells
      cellsEnter.append('text')
        .attr('class', 'cell-label')
        .attr('x', 4)
        .attr('y', 20)
        .style('font-size', '12px')
        .style('font-weight', 'bold');

      // Add value labels to new cells
      cellsEnter.append('text')
        .attr('class', 'cell-value')
        .attr('x', 4)
        .attr('y', 35)
        .style('font-size', '11px');

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

      // Update labels
      cellsMerge.select('.cell-label')
        .text((d: any) => {
          const path = d.ancestors().reverse().slice(1).map((n: any) => n.data.name);
          return path[path.length - 1] || '';
        });

      // Update value labels
      cellsMerge.select('.cell-value')
        .text((d: any) => formatMeasureValue(d.value));

      // Update time display
      controlsGroup.select('.time-display')
        .text(isTimeDate ? formatDateForDisplay(new Date(timeValue)) : timeValue);

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
              const leafData = data.filter(item => 
                hierarchyDims.every((dim, i) => item.dimensions[dim] === path[i]) &&
                item.dimensions[timeDim] === timeValue
              );
              
              const rect = this.getBoundingClientRect();
              callbacks.onPointClick(leafData, { x: rect.left, y: rect.top }, 
                `${path.join(' > ')} at ${timeValue}`);
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
      .text(timeValues[0]);

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
    
    // Dynamic bottom margin based on chart type
    const isBarChart = chartType === 'bar';
    const baseBottomMargin = isBarChart ? 80 : 40;
    
    const margin = legendPosition === 'top' 
      ? { top: 40, right: 20, bottom: baseBottomMargin, left: 60 }
      : legendPosition === 'bottom'
      ? { top: 20, right: 20, bottom: baseBottomMargin + 40, left: 60 }
      : { top: 20, right: 120, bottom: baseBottomMargin, left: 60 };
    const width = settings.dimensions.width - margin.left - margin.right;
    const height = settings.dimensions.height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Render based on chart type with multi-series support
    const chartCallbacks = {
      onPointClick: openDataViewer,
      onBrushEnd: (selection: [[number, number], [number, number]] | null) => {
        setBrushSelection(selection);
      }
    };

    switch (chartType) {
      case 'line':
        renderMultiSeriesLineChart(g, seriesData, width, height, settings, chartCallbacks);
        break;
      case 'bar':
        renderBarChart(g, data.data, width, height, settings, chartCallbacks);
        break;
      case 'area':
        renderAreaChart(g, data.data, width, height, settings, chartCallbacks);
        break;
      case 'pie':
        renderPieChart(g, data.data, width, height, settings);
        break;
      case 'scatter':
        renderScatterPlot(g, data.data, width, height, settings, chartCallbacks);
        break;
      case 'heatmap':
        renderHeatmap(g, data.data, width, height, settings, chartCallbacks);
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
        renderMultiSeriesLineChart(g, seriesData, width, height, settings, chartCallbacks);
    }

    // Add legend if enabled and we have multiple series
    if (settings.legends.show && seriesData.length > 1) {
      const legendPosition = settings.legends?.position || 'top';
      let legendX, legendY;
      
      if (legendPosition === 'top') {
        legendX = margin.left + width / 2;
        legendY = 10;
      } else if (legendPosition === 'bottom') {
        legendX = margin.left + width / 2;
        legendY = margin.top + height + 50;
      } else {
        legendX = width + margin.left + 10;
        legendY = margin.top;
      }
      
      renderLegend(svg, legendItems, legendX, legendY, handleSeriesToggle, legendPosition);
    }

    // Add title if provided
    if (settings.title?.show && settings.title?.text) {
      svg
        .append('text')
        .attr('x', settings.dimensions.width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(settings.title.text);
    }

  }, [data, settings, chartType, seriesData, legendItems, handleSeriesToggle]);

  return (
    <div ref={containerRef} className={`d3-chart-container ${className}`}>
      <svg
        ref={svgRef}
        width={settings.dimensions.width}
        height={settings.dimensions.height}
        className="d3-chart"
      />
      
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

function renderBarChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
  if (!data.length) {
    renderEmptyState(g, width, height, 'No data available', 'Check your filters and data source configuration');
    return;
  }

  // Get the first dimension and measure for basic bar chart
  const firstDimKey = Object.keys(data[0].dimensions)[0];
  const firstMeasureKey = Object.keys(data[0].measures)[0];

  if (!firstDimKey || !firstMeasureKey) return;
  
  // Create composite keys if we have multiple dimensions (including segments)
  const allDimKeys = Object.keys(data[0].dimensions);
  const hasMultipleDimensions = allDimKeys.length > 1;
  
  // If we have multiple dimensions, render as grouped bar chart inline
  if (hasMultipleDimensions) {
    // Inline grouped bar chart implementation
    const dimensionKeys = Object.keys(data[0].dimensions);
    const firstMeasureKey = Object.keys(data[0].measures)[0];
    
    if (!dimensionKeys.length || !firstMeasureKey) return;

    // The first dimension will be our X-axis grouping
    const xDimKey = dimensionKeys[0];
    const groupDimKeys = dimensionKeys.slice(1);
    
    // Get unique values for x-axis - clean up IDs and show human-readable names
    const xValues = [...new Set(data.map(d => {
      const value = d.dimensions[xDimKey];
      // For any field with "(ID: xxx)", extract just the name part
      if (value && value.includes('(ID:')) {
        return value.split('(ID:')[0].trim();
      }
      return value;
    }))].filter(v => v);
    
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
    const x0Scale = d3.scaleBand()
      .domain(xValues)
      .range([0, width])
      .paddingInner(0.1);

    const x1Scale = d3.scaleBand()
      .domain(groupValues)
      .range([0, x0Scale.bandwidth()])
      .padding(0.05);

    // Find max value for Y scale from valid data only
    const maxValue = d3.max(validData, d => +d.measures[firstMeasureKey]) || 0;
    
    const yScale = d3.scaleLinear()
      .domain([0, maxValue * 1.1]) // Add 10% padding
      .range([height, 0]);

    // Create color scale
    const colorScale = d3.scaleOrdinal()
      .domain(groupValues)
      .range(d3.schemeCategory10);

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
        .attr('y', d => yScale(+d.measures[firstMeasureKey]))
        .attr('width', x1Scale.bandwidth())
        .attr('height', d => height - yScale(+d.measures[firstMeasureKey]))
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
          if (callbacks?.onHover && settings.tooltips.show) {
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
            callbacks.onHover([d], position, `${groupKey}: ${value}°F`);
          }
        })
        .on('mouseout', function() {
          d3.select(this).style('opacity', 1);
          if (callbacks?.onHoverEnd) {
            callbacks.onHoverEnd();
          }
        });
    });

    // Add legend for groups
    if (settings.legends.show && groupValues.length > 1) {
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
      return allDimKeys.map(key => d.dimensions[key] || '').join(' | ');
    }
    return d.dimensions[firstDimKey];
  };

  // Check if all values are zero
  const allZero = data.every(d => +d.measures[firstMeasureKey] === 0);
  if (allZero) {
    renderEmptyState(g, width, height, 'All values are zero', 'This may indicate no growth activity or missing data');
  }

  // Use most of the available height, leaving room for labels
  const adjustedHeight = height;

  // Detect if the dimension is a date for proper sorting
  const isDateDimension = isDateField(data[0].dimensions[firstDimKey]);
  
  if (isDateDimension) {
    // Sort data by date for bar charts too
    data = [...data].sort((a, b) => 
      new Date(a.dimensions[firstDimKey]).getTime() - new Date(b.dimensions[firstDimKey]).getTime()
    );
  }

  const domainKeys = data.map(d => getCompositeKey(d));
  console.log('Bar chart X-axis domain keys:', domainKeys);
  
  const xScale = d3.scaleBand()
    .domain(domainKeys)
    .range([0, width])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => +d.measures[firstMeasureKey]) || 0])
    .range([adjustedHeight, 0]);

  const colorScale = d3.scaleOrdinal(d3[settings.colors.palette as keyof typeof d3] || d3.schemeCategory10);

  // Create smart X-axis
  let xAxis: any;
  if (isDateDimension) {
    // For date dimensions, show fewer formatted ticks
    const maxLabels = Math.max(3, Math.floor(width / 80));
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    const tickValues = data.filter((_, i) => i % step === 0).map(d => d.dimensions[firstDimKey]);
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(tickValues)
      .tickFormat(d => formatDateForDisplay(new Date(d as string)));
  } else {
    // For non-date dimensions, smart label spacing
    const maxLabels = Math.max(3, Math.floor(width / 60));
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(data.filter((_, i) => i % step === 0).map(d => getCompositeKey(d)));
  }

  // Add axes with smart formatting
  const xAxisGroup = g.append('g')
    .attr('transform', `translate(0,${adjustedHeight})`)
    .call(xAxis);
    
  // Smart label formatting based on available space
  const labelWidth = xScale.bandwidth();
  const maxLabelChars = Math.max(5, Math.floor(labelWidth / 6)); // Approximate characters that fit
  
  if (data.length > 6 || labelWidth < 60) {
    // Rotate labels for better fit
    xAxisGroup.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')
      .text(function(d: any) {
        const text = String(d);
        // For composite keys, show only the first part before the separator
        if (text.includes(' | ')) {
          const firstPart = text.split(' | ')[0];
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

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Add bars with enhanced interactions
  const bars = g.selectAll('.bar')
    .data(data)
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
    .attr('fill', (d: any, i: number) => colorScale(i.toString()))
    .style('cursor', 'pointer')
    .style('opacity', 0.8);

  // Enhanced hover and click interactions
  if (callbacks) {
    bars
      .on('mouseover', function(event, d) {
        d3.select(this).style('opacity', 1);
        
        if (callbacks.onHover && settings.tooltips.show) {
          const rect = this.getBoundingClientRect();
          const position = {
            x: rect.left + rect.width / 2,
            y: rect.top
          };
          callbacks.onHover([d], position, `${d.dimensions[firstDimKey]}: ${d.measures[firstMeasureKey]}`);
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
          
          data.forEach(dataPoint => {
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
  const x0Scale = d3.scaleBand()
    .domain(xValues)
    .range([0, width])
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

  // Create color scale
  const colorScale = d3.scaleOrdinal()
    .domain(groupValues)
    .range(d3.schemeCategory10);

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
        if (callbacks?.onHover && settings.tooltips.show) {
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
  if (settings.legends.show && groupValues.length > 1) {
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
  const xScale = d3.scaleBand()
    .domain(xValues)
    .range([0, width])
    .padding(0.1);

  // Calculate max value for y-scale
  const maxValue = d3.max(stackData, (d: any) => {
    return d3.sum(Array.from(stackGroups.keys()), (key: string) => d[key] || 0);
  }) || 0;

  const yScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([height, 0]);

  // Create color scale
  const colorScale = d3.scaleOrdinal()
    .domain(Array.from(stackGroups.keys()))
    .range(d3.schemeCategory10);

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
      if (callbacks?.onHover && settings.tooltips.show) {
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

  if (settings.legends.show && legendData.length > 1) {
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
    
    xScale = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([0, width]);
    
    // Smart tick spacing based on width and date range
    const tickCount = Math.max(3, Math.min(8, Math.floor(width / 80)));
    
    xAxis = d3.axisBottom(xScale)
      .ticks(tickCount)
      .tickFormat(d => formatDateForDisplay(d as Date));
      
    // Update data reference for sorted data
    data = sortedData;
  } else {
    // Non-date dimension - use point scale with smart labeling
    xScale = d3.scalePoint()
      .domain(data.map(d => d.dimensions[firstDimKey]))
      .range([0, width]);
    
    // Calculate how many labels we can fit
    const maxLabels = Math.max(3, Math.floor(width / 60));
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(data.filter((_, i) => i % step === 0).map(d => d.dimensions[firstDimKey]));
  }

  // Filter out invalid data for y-scale domain calculation
  console.log('Debug BaseChart: Processing line chart data:', data.slice(0, 3));
  const validYValues = data
    .map(d => d.measures[firstMeasureKey])
    .filter(val => val !== null && val !== undefined && val !== '' && val !== '-')
    .map(val => +val)
    .filter(val => !isNaN(val));
    
  console.log('Debug BaseChart: Valid Y values:', validYValues.slice(0, 5));
  
  const yScale = d3.scaleLinear()
    .domain(validYValues.length > 0 ? d3.extent(validYValues) as [number, number] : [0, 100])
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
      .attr('transform', 'rotate(-45)');
  }

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Add line
  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', 'steelblue')
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
    .attr('fill', 'steelblue');
}

function renderAreaChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
  if (!data.length) return;

  const firstDimKey = Object.keys(data[0].dimensions)[0];
  const measureKeys = Object.keys(data[0].measures);
  const firstMeasureKey = measureKeys[0];

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
    
    xScale = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([0, width]);
    
    // Smart tick spacing
    const tickCount = Math.max(3, Math.min(8, Math.floor(width / 80)));
    
    xAxis = d3.axisBottom(xScale)
      .ticks(tickCount)
      .tickFormat(d => formatDateForDisplay(d as Date));
      
    // Update data reference
    data = sortedData;
  } else {
    // For non-date dimensions, use point scale for continuous area visualization
    xScale = d3.scalePoint()
      .domain(data.map(d => d.dimensions[firstDimKey]))
      .range([0, width])
      .padding(0.5);
    
    // Smart labeling for non-dates
    const maxLabels = Math.max(3, Math.floor(width / 60));
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(data.filter((_, i) => i % step === 0).map(d => d.dimensions[firstDimKey]));
  }

  // Check if we have multiple measures for stacked area
  const isStacked = measureKeys.length > 1;
  const colorScale = d3.scaleOrdinal(d3[settings.colors.palette as keyof typeof d3] || d3.schemeCategory10);

  let yScale: any;
  let areaGenerator: any;
  let stackedData: any[] = [];

  if (isStacked) {
    // Prepare data for stacking
    const stack = d3.stack()
      .keys(measureKeys)
      .value((d: any, key: string) => +d.measures[key] || 0);
    
    stackedData = stack(data);
    
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
      .domain([0, d3.max(data, d => +d.measures[firstMeasureKey]) || 0])
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
      .attr('transform', 'rotate(-45)');
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
      .attr('fill', (d: any, i: number) => colorScale(i.toString()))
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
            if (callbacks.onHover && settings.tooltips.show) {
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
          
          if (callbacks.onHover && settings.tooltips.show) {
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

function renderPieChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings) {
  if (!data.length) return;

  const firstDimKey = Object.keys(data[0].dimensions)[0];
  const firstMeasureKey = Object.keys(data[0].measures)[0];

  if (!firstDimKey || !firstMeasureKey) return;

  const radius = Math.min(width, height) / 2;
  const colorScale = d3.scaleOrdinal(d3[settings.colors.palette as keyof typeof d3] || d3.schemeCategory10);

  const pie = d3.pie<any>()
    .value(d => +d.measures[firstMeasureKey]);

  const arc = d3.arc<any>()
    .innerRadius(0)
    .outerRadius(radius);

  const pieData = pie(data);

  g.attr('transform', `translate(${width / 2},${height / 2})`);

  g.selectAll('.arc')
    .data(pieData)
    .enter().append('g')
    .attr('class', 'arc')
    .append('path')
    .attr('d', arc)
    .attr('fill', (d: any, i: number) => colorScale(i.toString()));

  // Add labels if there's space
  if (settings.legends.show) {
    g.selectAll('.arc')
      .append('text')
      .attr('transform', (d: any) => `translate(${arc.centroid(d)})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text((d: any) => d.data.dimensions[firstDimKey]);
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
  }
) {
  if (!seriesData.length) return;

  const visibleSeries = seriesData.filter(s => s.visible);
  if (!visibleSeries.length) return;

  // Get first data point to determine dimension type
  const firstDataPoint = visibleSeries[0].data[0];
  if (!firstDataPoint) return;

  const firstDimKey = Object.keys(firstDataPoint.dimensions)[0];
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
    
    xScale = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([0, width]);
    
    const tickCount = Math.max(3, Math.min(8, Math.floor(width / 80)));
    xAxis = d3.axisBottom(xScale)
      .ticks(tickCount)
      .tickFormat(d => formatDateForDisplay(d as Date));
  } else {
    // Non-date dimension - use point scale
    const allValues = visibleSeries.flatMap(series => 
      series.data.map(d => d.dimensions[firstDimKey])
    );
    const uniqueValues = [...new Set(allValues)];
    
    xScale = d3.scalePoint()
      .domain(uniqueValues)
      .range([0, width]);
    
    const maxLabels = Math.max(3, Math.floor(width / 60));
    const step = Math.max(1, Math.ceil(uniqueValues.length / maxLabels));
    
    xAxis = d3.axisBottom(xScale)
      .tickValues(uniqueValues.filter((_, i) => i % step === 0));
  }

  // Calculate Y domain across all visible series
  const yDomain = calculateYDomain(visibleSeries, true);
  const yScale = d3.scaleLinear()
    .domain(yDomain)
    .range([height, 0]);

  // Add axes
  const xAxisGroup = g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis);
    
  // Rotate labels if they're crowded
  if (!isDateDimension && xScale.domain().length > 6) {
    xAxisGroup.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');
  }

  g.append('g')
    .call(d3.axisLeft(yScale));

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
    // Add line
    g.append('path')
      .datum(series.data)
      .attr('fill', 'none')
      .attr('stroke', series.color)
      .attr('stroke-width', 2)
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
      .attr('r', 4)
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

  const isHorizontal = position === 'top' || position === 'bottom';
  
  if (isHorizontal) {
    // Calculate total width of all legend items
    const itemWidth = 120; // Approximate width per item
    const totalWidth = legendItems.length * itemWidth;
    const startX = x - totalWidth / 2; // Center horizontally
    
    legend.attr('transform', `translate(${startX}, ${y})`);
    
    const legendGroups = legend.selectAll('.legend-item')
      .data(legendItems)
      .enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d: any, i: number) => `translate(${i * itemWidth}, 0)`)
      .style('cursor', 'pointer')
      .on('click', (event: any, d: LegendItem) => onToggle(d.id));

    // Color indicator
    legendGroups.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', (d: LegendItem) => d.color)
      .attr('opacity', (d: LegendItem) => d.visible ? 1 : 0.3);

    // Text label
    legendGroups.append('text')
      .attr('x', 18)
      .attr('y', 9)
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('font-family', 'Arial, sans-serif')
      .style('fill', (d: LegendItem) => d.visible ? '#333' : '#999')
      .text((d: LegendItem) => d.name);
  } else {
    // Vertical layout (right side)
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

    // Text label
    legendGroups.append('text')
      .attr('x', 18)
      .attr('y', 9)
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('font-family', 'Arial, sans-serif')
      .style('fill', (d: LegendItem) => d.visible ? '#333' : '#999')
      .text((d: LegendItem) => d.name);
  }
}

// Professional scatter plot with advanced statistical analysis
function renderScatterPlot(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
  if (!data.length) return;
  
  const dimKeys = Object.keys(data[0].dimensions);
  const measureKeys = Object.keys(data[0].measures);
  
  if (measureKeys.length < 2) {
    console.warn('Scatter plot requires at least 2 measures');
    return;
  }
  
  const xKey = measureKeys[0];
  const yKey = measureKeys[1];
  const sizeKey = measureKeys[2]; // Optional third measure for bubble size
  const colorKey = dimKeys[0]; // Use first dimension for color grouping
  
  // Extract numeric values
  const xValues = data.map(d => +d.measures[xKey]).filter(v => !isNaN(v));
  const yValues = data.map(d => +d.measures[yKey]).filter(v => !isNaN(v));
  
  // Calculate statistical metrics
  const statistics = calculateBivariateStatistics(xValues, yValues);
  
  // Set up scales with padding
  const xExtent = d3.extent(xValues) as [number, number];
  const yExtent = d3.extent(yValues) as [number, number];
  const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
  const yPadding = (yExtent[1] - yExtent[0]) * 0.1;
  
  const xScale = d3.scaleLinear()
    .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
    .range([0, width])
    .nice();
    
  const yScale = d3.scaleLinear()
    .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
    .range([height, 0])
    .nice();
  
  // Size scale for bubble chart (if third measure exists)
  const sizeScale = sizeKey ? d3.scaleLinear()
    .domain(d3.extent(data, d => +d.measures[sizeKey]) as [number, number])
    .range([4, 20]) : null;
  
  // Color scale for grouping
  const groups = colorKey ? Array.from(new Set(data.map(d => d.dimensions[colorKey]))) : ['All'];
  const colorScale = d3.scaleOrdinal()
    .domain(groups)
    .range(d3.schemeTableau10);
  
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
    drawConfidenceEllipse(g, statistics, xScale, yScale, '#3498db');
  }
  
  // Add density contours for large datasets
  if (data.length > 100) {
    const contourData = calculateDensityContours(data, xKey, yKey, xScale, yScale);
    
    g.append('g')
      .attr('class', 'contours')
      .selectAll('path')
      .data(contourData)
      .enter()
      .append('path')
      .attr('d', d3.geoPath())
      .attr('fill', 'none')
      .attr('stroke', '#3498db')
      .attr('stroke-width', 1)
      .attr('opacity', 0.3);
  }
  
  // Add points
  const dots = g.selectAll('.dot')
    .data(data.filter(d => !isNaN(+d.measures[xKey]) && !isNaN(+d.measures[yKey])))
    .enter()
    .append('circle')
    .attr('class', 'dot')
    .attr('cx', (d: any) => xScale(+d.measures[xKey]))
    .attr('cy', (d: any) => yScale(+d.measures[yKey]))
    .attr('r', (d: any) => sizeScale && sizeKey ? sizeScale(+d.measures[sizeKey]) : 5)
    .attr('fill', (d: any) => colorKey ? colorScale(d.dimensions[colorKey]) : '#3498db')
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