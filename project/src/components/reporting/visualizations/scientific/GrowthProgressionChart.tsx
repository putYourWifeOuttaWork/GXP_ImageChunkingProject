import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface GrowthProgressionChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const GrowthProgressionChart: React.FC<GrowthProgressionChartProps> = ({
  data,
  settings,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data?.data?.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = settings.dimensions.width - margin.left - margin.right;
    const height = settings.dimensions.height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates if present
    const parseTime = d3.timeParse('%Y-%m-%d');
    const formatTime = d3.timeFormat('%m/%d');

    // Prepare data - assume we have time-based growth data
    const processedData = data.data.map(d => ({
      ...d,
      date: parseTime(d.dimensions.date) || new Date(d.dimensions.date),
      growth: +d.measures.growth_percentage || +d.measures.area_mm2 || 0,
      phase: d.dimensions.phase || 'Unknown'
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Group data by phase for multiple lines
    const phaseGroups = d3.group(processedData, d => d.phase);

    const xScale = d3.scaleTime()
      .domain(d3.extent(processedData, d => d.date) as [Date, Date])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d.growth) || 100])
      .range([height, 0]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const line = d3.line<any>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.growth))
      .curve(d3.curveMonotoneX);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat(formatTime as any));

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('Growth (%)');

    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + margin.bottom})`)
      .style('text-anchor', 'middle')
      .text('Time');

    // Draw lines for each phase
    phaseGroups.forEach((phaseData, phase) => {
      g.append('path')
        .datum(phaseData)
        .attr('fill', 'none')
        .attr('stroke', colorScale(phase))
        .attr('stroke-width', 2)
        .attr('d', line);

      // Add dots for data points
      g.selectAll(`.dot-${phase.replace(/\s+/g, '-')}`)
        .data(phaseData)
        .enter().append('circle')
        .attr('class', `dot dot-${phase.replace(/\s+/g, '-')}`)
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.growth))
        .attr('r', 4)
        .attr('fill', colorScale(phase));

      // Add tooltips if enabled
      if (settings.tooltips.show) {
        g.selectAll(`.dot-${phase.replace(/\s+/g, '-')}`)
          .append('title')
          .text(d => `${phase}\nDate: ${formatTime(d.date)}\nGrowth: ${d.growth.toFixed(1)}%`);
      }
    });

    // Add legend if enabled
    if (settings.legends.show) {
      const legend = g.selectAll('.legend')
        .data(Array.from(phaseGroups.keys()))
        .enter().append('g')
        .attr('class', 'legend')
        .attr('transform', (d, i) => `translate(${width - 100}, ${i * 20})`);

      legend.append('rect')
        .attr('x', 0)
        .attr('width', 18)
        .attr('height', 18)
        .style('fill', d => colorScale(d));

      legend.append('text')
        .attr('x', 24)
        .attr('y', 9)
        .attr('dy', '.35em')
        .style('text-anchor', 'start')
        .style('font-size', '12px')
        .text(d => d);
    }

    // Add title
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

  }, [data, settings]);

  return (
    <div className={`growth-progression-chart ${className}`}>
      <svg
        ref={svgRef}
        width={settings.dimensions.width}
        height={settings.dimensions.height}
        className="d3-chart"
      />
    </div>
  );
};