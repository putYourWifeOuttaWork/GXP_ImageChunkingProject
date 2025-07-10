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
      id: `series_${measureKey}`,
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
  onSeriesToggle
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
    setDataViewer({
      isVisible: true,
      data: points,
      position: { x: position.x, y: position.y },
      title
    });
  }, []);

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

  useEffect(() => {
    if (!svgRef.current || !data?.data?.length || !seriesData.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Adjust margins based on legend position
    const legendPosition = settings.legends?.position || 'top';
    const margin = legendPosition === 'top' 
      ? { top: 60, right: 30, bottom: 40, left: 50 }
      : legendPosition === 'bottom'
      ? { top: 20, right: 30, bottom: 80, left: 50 }
      : { top: 20, right: 120, bottom: 40, left: 50 };
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

function renderBarChart(g: any, data: any[], width: number, height: number, settings: VisualizationSettings, callbacks?: any) {
  if (!data.length) return;

  // Get the first dimension and measure for basic bar chart
  const firstDimKey = Object.keys(data[0].dimensions)[0];
  const firstMeasureKey = Object.keys(data[0].measures)[0];

  if (!firstDimKey || !firstMeasureKey) return;

  // Detect if the dimension is a date for proper sorting
  const isDateDimension = isDateField(data[0].dimensions[firstDimKey]);
  
  if (isDateDimension) {
    // Sort data by date for bar charts too
    data = [...data].sort((a, b) => 
      new Date(a.dimensions[firstDimKey]).getTime() - new Date(b.dimensions[firstDimKey]).getTime()
    );
  }

  const xScale = d3.scaleBand()
    .domain(data.map(d => d.dimensions[firstDimKey]))
    .range([0, width])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => +d.measures[firstMeasureKey]) || 0])
    .range([height, 0]);

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
      .tickValues(data.filter((_, i) => i % step === 0).map(d => d.dimensions[firstDimKey]));
  }

  // Add axes with smart formatting
  const xAxisGroup = g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis);
    
  // Rotate labels if there are too many bars
  if (data.length > 6) {
    xAxisGroup.selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');
  }

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Add bars with enhanced interactions
  const bars = g.selectAll('.bar')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', (d: any) => xScale(d.dimensions[firstDimKey]))
    .attr('width', xScale.bandwidth())
    .attr('y', (d: any) => yScale(+d.measures[firstMeasureKey]))
    .attr('height', (d: any) => height - yScale(+d.measures[firstMeasureKey]))
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
      .extent([[0, 0], [width, height]])
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
              const barX = xScale(d.dimensions[firstDimKey]) || 0;
              const barWidth = xScale.bandwidth();
              const barY = yScale(+d.measures[firstMeasureKey]);
              const barHeight = height - barY;
              
              // Check if bar overlaps with brush selection
              const isSelected = barX < x1 && barX + barWidth > x0 && barY < y1 && barY + barHeight > y0;
              return isSelected ? 1 : 0.3;
            })
            .style('stroke', function(d: any) {
              const barX = xScale(d.dimensions[firstDimKey]) || 0;
              const barWidth = xScale.bandwidth();
              const barY = yScale(+d.measures[firstMeasureKey]);
              const barHeight = height - barY;
              
              // Check if bar overlaps with brush selection
              const isSelected = barX < x1 && barX + barWidth > x0 && barY < y1 && barY + barHeight > y0;
              return isSelected ? '#000' : 'none';
            })
            .style('stroke-width', function(d: any) {
              const barX = xScale(d.dimensions[firstDimKey]) || 0;
              const barWidth = xScale.bandwidth();
              const barY = yScale(+d.measures[firstMeasureKey]);
              const barHeight = height - barY;
              
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
            const barX = xScale(dataPoint.dimensions[firstDimKey]) || 0;
            const barWidth = xScale.bandwidth();
            const barY = yScale(+dataPoint.measures[firstMeasureKey]);
            const barHeight = height - barY;
            
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

    g.append('g')
      .attr('class', 'brush')
      .call(brush);
  }

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
    const xValues = [...new Set(data.map(d => d.dimensions[xDim]))];
    const yValues = [...new Set(data.map(d => d.dimensions[yDim]))];

    // Create scales
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(yValues)
      .range([height, 0])
      .padding(0.05);

    // Create color scale for the heatmap
    const extent = d3.extent(data, d => +d.measures[measure]) as [number, number];
    const colorScale = d3.scaleSequential()
      .domain(extent)
      .interpolator(d3.interpolateViridis);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + 50})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(xDim);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - 40)
      .attr('x', 0 - (height / 2))
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(yDim);

    // Create cells
    const cells = g.selectAll('.cell')
      .data(data)
      .enter().append('rect')
      .attr('class', 'cell')
      .attr('x', (d: any) => xScale(d.dimensions[xDim]) || 0)
      .attr('y', (d: any) => yScale(d.dimensions[yDim]) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d: any) => colorScale(+d.measures[measure]))
      .style('cursor', 'pointer')
      .style('stroke', '#fff')
      .style('stroke-width', 1);

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
    const legendWidth = 20;
    const legendHeight = height;
    const legendScale = d3.scaleLinear()
      .domain(extent)
      .range([legendHeight, 0]);

    const legend = g.append('g')
      .attr('transform', `translate(${width + 20}, 0)`);

    // Create gradient for legend
    const gradientId = `heatmap-gradient-${Date.now()}`;
    const gradient = g.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', colorScale(extent[0] + t * (extent[1] - extent[0])));
    }

    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', `url(#${gradientId})`);

    legend.append('g')
      .attr('transform', `translate(${legendWidth}, 0)`)
      .call(d3.axisRight(legendScale).ticks(5));

    legend.append('text')
      .attr('transform', `translate(${legendWidth + 35}, ${legendHeight / 2}) rotate(90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(measure);
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

  const xScale = d3.scaleLinear()
    .domain(d3.extent(data, d => +d.measures[xKey]) as [number, number])
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain(d3.extent(data, d => +d.measures[yKey]) as [number, number])
    .range([height, 0]);

  const colorScale = d3.scaleOrdinal(d3[settings.colors.palette as keyof typeof d3] || d3.schemeCategory10);

  // Add axes with labels
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale));

  g.append('g')
    .call(d3.axisLeft(yScale));

  // Add axis labels
  g.append('text')
    .attr('transform', `translate(${width / 2}, ${height + 35})`)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .text(xKey);

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 0 - 35)
    .attr('x', 0 - (height / 2))
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .text(yKey);

  // Add points with enhanced interactions
  const dots = g.selectAll('.dot')
    .data(data)
    .enter().append('circle')
    .attr('class', 'dot')
    .attr('cx', (d: any) => xScale(+d.measures[xKey]))
    .attr('cy', (d: any) => yScale(+d.measures[yKey]))
    .attr('r', 4)
    .attr('fill', (d: any, i: number) => colorScale(i.toString()))
    .style('cursor', 'pointer')
    .style('opacity', 0.7)
    .style('stroke', '#fff')
    .style('stroke-width', 1);

  // Enhanced hover and click interactions
  if (callbacks) {
    dots
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('r', 6)
          .style('opacity', 1);
        
        if (callbacks.onHover && settings.tooltips.show) {
          const circle = this.getBoundingClientRect();
          const position = {
            x: circle.left + circle.width / 2,
            y: circle.top
          };
          const tooltipText = `${xKey}: ${d.measures[xKey]}\n${yKey}: ${d.measures[yKey]}`;
          callbacks.onHover([d], position, tooltipText);
        }
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('r', 4)
          .style('opacity', 0.7);
        if (callbacks.onHoverEnd) {
          callbacks.onHoverEnd();
        }
      })
      .on('click', function(event, d) {
        if (callbacks.onPointClick) {
          const circle = this.getBoundingClientRect();
          const position = {
            x: circle.left + circle.width / 2,
            y: circle.top + circle.height / 2
          };
          callbacks.onPointClick([d], position, `Point: ${d.measures[xKey]}, ${d.measures[yKey]}`);
        }
      });
  }

  // Add brush selection for scatter plots
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
            
            // Check if point is within brush selection
            if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
              brushedData.push(dataPoint);
            }
          });
          
          if (brushedData.length > 0 && callbacks.onPointClick) {
            const position = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
            callbacks.onPointClick(brushedData, position, `Selected Points (${brushedData.length})`);
          }
          
          // Clear brush selection
          d3.select(this).call(brush.move, null);
        }
      });

    g.append('g')
      .attr('class', 'brush')
      .call(brush);
  }

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
    const xValues = [...new Set(data.map(d => d.dimensions[xDim]))];
    const yValues = [...new Set(data.map(d => d.dimensions[yDim]))];

    // Create scales
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(yValues)
      .range([height, 0])
      .padding(0.05);

    // Create color scale for the heatmap
    const extent = d3.extent(data, d => +d.measures[measure]) as [number, number];
    const colorScale = d3.scaleSequential()
      .domain(extent)
      .interpolator(d3.interpolateViridis);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + 50})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(xDim);

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - 40)
      .attr('x', 0 - (height / 2))
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(yDim);

    // Create cells
    const cells = g.selectAll('.cell')
      .data(data)
      .enter().append('rect')
      .attr('class', 'cell')
      .attr('x', (d: any) => xScale(d.dimensions[xDim]) || 0)
      .attr('y', (d: any) => yScale(d.dimensions[yDim]) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d: any) => colorScale(+d.measures[measure]))
      .style('cursor', 'pointer')
      .style('stroke', '#fff')
      .style('stroke-width', 1);

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
    const legendWidth = 20;
    const legendHeight = height;
    const legendScale = d3.scaleLinear()
      .domain(extent)
      .range([legendHeight, 0]);

    const legend = g.append('g')
      .attr('transform', `translate(${width + 20}, 0)`);

    // Create gradient for legend
    const gradientId = `heatmap-gradient-${Date.now()}`;
    const gradient = g.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', colorScale(extent[0] + t * (extent[1] - extent[0])));
    }

    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', `url(#${gradientId})`);

    legend.append('g')
      .attr('transform', `translate(${legendWidth}, 0)`)
      .call(d3.axisRight(legendScale).ticks(5));

    legend.append('text')
      .attr('transform', `translate(${legendWidth + 35}, ${legendHeight / 2}) rotate(90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(measure);
  }
}