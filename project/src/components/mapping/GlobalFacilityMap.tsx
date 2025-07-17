import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { geoPath, geoNaturalEarth1 } from 'd3-geo';
import { feature } from 'topojson-client';

interface FacilityData {
  site_id: string;
  name: string;
  latitude: number;
  longitude: number;
  growth_projection: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface CompanyData {
  company_id: string;
  name: string;
  facilities: FacilityData[];
}

interface GlobalFacilityMapProps {
  companies: CompanyData[];
  onFacilityClick: (facility: FacilityData) => void;
  width?: number;
  height?: number;
}

export const GlobalFacilityMap: React.FC<GlobalFacilityMapProps> = ({
  companies,
  onFacilityClick,
  width = 1200,
  height = 600
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [worldData, setWorldData] = useState<any>(null);
  const [selectedFacility, setSelectedFacility] = useState<FacilityData | null>(null);

  // Load world topology data
  useEffect(() => {
    const loadWorldData = async () => {
      try {
        // You'll need to add world-110m.json to your public folder
        const response = await fetch('/world-110m.json');
        const world = await response.json();
        setWorldData(world);
      } catch (error) {
        console.error('Error loading world data:', error);
      }
    };

    loadWorldData();
  }, []);

  useEffect(() => {
    if (!worldData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Set up projection and path
    const projection = geoNaturalEarth1()
      .scale(width / 6.5)
      .translate([width / 2, height / 2]);

    const path = geoPath().projection(projection);

    // Create main group
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Draw world map
    const countries = feature(worldData, worldData.objects.countries);
    g.selectAll('.country')
      .data(countries.features)
      .enter()
      .append('path')
      .attr('class', 'country')
      .attr('d', path)
      .style('fill', '#f0f0f0')
      .style('stroke', '#ccc')
      .style('stroke-width', '0.5px');

    // Create color scale for growth projections
    const growthExtent = d3.extent(
      companies.flatMap(c => c.facilities.map(f => f.growth_projection))
    ) as [number, number];

    const colorScale = d3.scaleSequential(d3.interpolateReds)
      .domain(growthExtent);

    // Draw facilities as spikes
    companies.forEach(company => {
      const facilityGroup = g.append('g')
        .attr('class', `company-${company.company_id}`);

      company.facilities.forEach(facility => {
        const [x, y] = projection([facility.longitude, facility.latitude]) || [0, 0];
        const spikeHeight = Math.max(10, facility.growth_projection * 50); // Scale factor
        
        // Create spike group
        const spikeGroup = facilityGroup.append('g')
          .attr('class', 'facility-spike')
          .attr('transform', `translate(${x}, ${y})`);

        // Base circle
        spikeGroup.append('circle')
          .attr('r', 8)
          .style('fill', colorScale(facility.growth_projection))
          .style('stroke', '#333')
          .style('stroke-width', '2px')
          .style('opacity', 0.8);

        // Spike
        spikeGroup.append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', 0)
          .attr('y2', -spikeHeight)
          .style('stroke', colorScale(facility.growth_projection))
          .style('stroke-width', '4px')
          .style('opacity', 0.9);

        // Spike top
        spikeGroup.append('circle')
          .attr('cy', -spikeHeight)
          .attr('r', 4)
          .style('fill', colorScale(facility.growth_projection))
          .style('stroke', '#333')
          .style('stroke-width', '1px');

        // Status indicator
        const statusColor = {
          healthy: '#4CAF50',
          warning: '#FF9800',
          critical: '#F44336'
        }[facility.status];

        spikeGroup.append('circle')
          .attr('r', 3)
          .style('fill', statusColor)
          .style('stroke', '#fff')
          .style('stroke-width', '1px');

        // Label
        spikeGroup.append('text')
          .attr('y', 25)
          .attr('text-anchor', 'middle')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .style('fill', '#333')
          .text(facility.name);

        // Click handler
        spikeGroup
          .style('cursor', 'pointer')
          .on('click', (event) => {
            event.stopPropagation();
            setSelectedFacility(facility);
            onFacilityClick(facility);
          })
          .on('mouseover', function() {
            d3.select(this).style('opacity', 1);
            
            // Show tooltip
            const tooltip = d3.select('body').append('div')
              .attr('class', 'facility-tooltip')
              .style('position', 'absolute')
              .style('background', 'rgba(0,0,0,0.8)')
              .style('color', 'white')
              .style('padding', '10px')
              .style('border-radius', '5px')
              .style('pointer-events', 'none')
              .style('opacity', 0);

            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`
              <strong>${facility.name}</strong><br/>
              Growth Projection: ${facility.growth_projection.toFixed(2)}<br/>
              Status: ${facility.status}<br/>
              Company: ${company.name}
            `);
          })
          .on('mousemove', function(event) {
            d3.select('.facility-tooltip')
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this).style('opacity', 0.8);
            d3.selectAll('.facility-tooltip').remove();
          });
      });
    });

    // Add legend
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 200}, 50)`);

    const legendData = [
      { status: 'healthy', color: '#4CAF50', label: 'Healthy' },
      { status: 'warning', color: '#FF9800', label: 'Warning' },
      { status: 'critical', color: '#F44336', label: 'Critical' }
    ];

    legendData.forEach((item, i) => {
      const legendItem = legend.append('g')
        .attr('transform', `translate(0, ${i * 25})`);

      legendItem.append('circle')
        .attr('r', 8)
        .style('fill', item.color);

      legendItem.append('text')
        .attr('x', 15)
        .attr('y', 5)
        .style('font-size', '14px')
        .text(item.label);
    });

    // Add growth projection scale
    const scaleGroup = legend.append('g')
      .attr('transform', 'translate(0, 100)');

    scaleGroup.append('text')
      .attr('y', -10)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Growth Projection');

    const scaleHeight = 100;
    const scaleValues = d3.range(growthExtent[0], growthExtent[1], (growthExtent[1] - growthExtent[0]) / 10);
    
    scaleValues.forEach((value, i) => {
      const y = (i / scaleValues.length) * scaleHeight;
      scaleGroup.append('rect')
        .attr('y', y)
        .attr('width', 20)
        .attr('height', scaleHeight / scaleValues.length)
        .style('fill', colorScale(value));
    });

    scaleGroup.append('text')
      .attr('x', 25)
      .attr('y', 5)
      .style('font-size', '10px')
      .text(growthExtent[1].toFixed(1));

    scaleGroup.append('text')
      .attr('x', 25)
      .attr('y', scaleHeight)
      .style('font-size', '10px')
      .text(growthExtent[0].toFixed(1));

  }, [worldData, companies, width, height, onFacilityClick]);

  return (
    <div className="global-facility-map">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          background: '#f8f9fa',
          border: '1px solid #dee2e6'
        }}
      />
      
      {selectedFacility && (
        <div className="facility-info-panel" style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          minWidth: '200px'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>{selectedFacility.name}</h3>
          <p><strong>Growth Projection:</strong> {selectedFacility.growth_projection.toFixed(2)}</p>
          <p><strong>Status:</strong> {selectedFacility.status}</p>
          <p><strong>Coordinates:</strong> {selectedFacility.latitude.toFixed(4)}, {selectedFacility.longitude.toFixed(4)}</p>
          <button 
            onClick={() => onFacilityClick(selectedFacility)}
            className="btn btn-primary"
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
};