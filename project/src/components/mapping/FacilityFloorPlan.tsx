import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface EquipmentData {
  equipment_id: string;
  type: 'petri_dish' | 'gasifier' | 'sensor' | 'vent' | 'shelving' | 'door';
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  status: 'active' | 'inactive' | 'maintenance';
  config: any;
}

interface ContourPoint {
  x: number;
  y: number;
  intensity: number;
  reduction_rate?: number;
}

interface FacilityData {
  facility_info: {
    site_id: string;
    name: string;
    dimensions: { width: number; height: number; units: string };
    layout?: any;
  };
  equipment: EquipmentData[];
  latest_contours: ContourPoint[];
  analytics: {
    total_growth: number;
    effectiveness: number;
    critical_zones: number;
    projections: any;
  };
}

interface FacilityFloorPlanProps {
  facilityData: FacilityData;
  onEquipmentClick: (equipment: EquipmentData) => void;
  width?: number;
  height?: number;
  showContours?: boolean;
  showEffectiveness?: boolean;
}

export const FacilityFloorPlan: React.FC<FacilityFloorPlanProps> = ({
  facilityData,
  onEquipmentClick,
  width = 800,
  height = 600,
  showContours = true,
  showEffectiveness = true
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentData | null>(null);
  const [timeAnimation, setTimeAnimation] = useState(false);

  // Scale factors to convert facility coordinates to SVG coordinates
  const facilityWidth = facilityData.facility_info.dimensions.width;
  const facilityHeight = facilityData.facility_info.dimensions.height;
  const scaleX = d3.scaleLinear().domain([0, facilityWidth]).range([50, width - 50]);
  const scaleY = d3.scaleLinear().domain([0, facilityHeight]).range([50, height - 50]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create defs for patterns and gradients
    const defs = svg.append('defs');

    // Create contour gradient
    const contourGradient = defs.append('radialGradient')
      .attr('id', 'contour-gradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');

    contourGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#ff0000')
      .attr('stop-opacity', 0.8);

    contourGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#ff0000')
      .attr('stop-opacity', 0.1);

    // Create effectiveness gradient
    const effectivenessGradient = defs.append('radialGradient')
      .attr('id', 'effectiveness-gradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');

    effectivenessGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#00ff00')
      .attr('stop-opacity', 0.6);

    effectivenessGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#00ff00')
      .attr('stop-opacity', 0.1);

    // Main drawing group
    const g = svg.append('g');

    // Add zoom and pan behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Draw facility background
    g.append('rect')
      .attr('x', scaleX(0))
      .attr('y', scaleY(0))
      .attr('width', scaleX(facilityWidth) - scaleX(0))
      .attr('height', scaleY(facilityHeight) - scaleY(0))
      .style('fill', '#f8f9fa')
      .style('stroke', '#333')
      .style('stroke-width', '2px');

    // Draw grid for reference
    const gridGroup = g.append('g').attr('class', 'grid');
    
    // Vertical grid lines
    for (let i = 0; i <= facilityWidth; i += facilityWidth / 10) {
      gridGroup.append('line')
        .attr('x1', scaleX(i))
        .attr('y1', scaleY(0))
        .attr('x2', scaleX(i))
        .attr('y2', scaleY(facilityHeight))
        .style('stroke', '#e0e0e0')
        .style('stroke-width', '1px');
    }

    // Horizontal grid lines
    for (let i = 0; i <= facilityHeight; i += facilityHeight / 10) {
      gridGroup.append('line')
        .attr('x1', scaleX(0))
        .attr('y1', scaleY(i))
        .attr('x2', scaleX(facilityWidth))
        .attr('y2', scaleY(i))
        .style('stroke', '#e0e0e0')
        .style('stroke-width', '1px');
    }

    // Draw mold growth contours
    if (showContours && facilityData.latest_contours) {
      const contourGroup = g.append('g').attr('class', 'contours');
      
      // Create intensity color scale
      const intensityExtent = d3.extent(facilityData.latest_contours, d => d.intensity) as [number, number];
      const intensityScale = d3.scaleSequential(d3.interpolateReds)
        .domain(intensityExtent);

      // Draw contour areas using Voronoi diagram
      const voronoi = d3.Delaunay.from(
        facilityData.latest_contours.map(d => [scaleX(d.x), scaleY(d.y)])
      ).voronoi([scaleX(0), scaleY(0), scaleX(facilityWidth), scaleY(facilityHeight)]);

      facilityData.latest_contours.forEach((point, i) => {
        const cell = voronoi.cellPolygon(i);
        if (cell) {
          contourGroup.append('path')
            .attr('d', d3.line()(cell) + 'Z')
            .style('fill', intensityScale(point.intensity))
            .style('opacity', 0.4)
            .style('stroke', 'none');
        }
      });

      // Add contour points
      contourGroup.selectAll('.contour-point')
        .data(facilityData.latest_contours)
        .enter()
        .append('circle')
        .attr('class', 'contour-point')
        .attr('cx', d => scaleX(d.x))
        .attr('cy', d => scaleY(d.y))
        .attr('r', 3)
        .style('fill', d => intensityScale(d.intensity))
        .style('stroke', '#333')
        .style('stroke-width', '1px')
        .style('opacity', 0.8);
    }

    // Draw equipment effectiveness zones
    if (showEffectiveness) {
      const effectivenessGroup = g.append('g').attr('class', 'effectiveness-zones');
      
      facilityData.equipment
        .filter(eq => eq.type === 'gasifier' && eq.radius > 0)
        .forEach(equipment => {
          effectivenessGroup.append('circle')
            .attr('cx', scaleX(equipment.x))
            .attr('cy', scaleY(equipment.y))
            .attr('r', scaleX(equipment.radius) - scaleX(0))
            .style('fill', 'url(#effectiveness-gradient)')
            .style('stroke', '#00aa00')
            .style('stroke-width', '2px')
            .style('stroke-dasharray', '5,5')
            .style('opacity', 0.6);
        });
    }

    // Draw equipment
    const equipmentGroup = g.append('g').attr('class', 'equipment');
    
    // Equipment color and shape mapping
    const equipmentConfig = {
      petri_dish: { color: '#ff6b6b', shape: 'circle', size: 8 },
      gasifier: { color: '#4ecdc4', shape: 'rect', size: 12 },
      sensor: { color: '#45b7d1', shape: 'triangle', size: 6 },
      vent: { color: '#96ceb4', shape: 'diamond', size: 10 },
      shelving: { color: '#feca57', shape: 'rect', size: 16 },
      door: { color: '#8b4513', shape: 'rect', size: 14 }
    };

    facilityData.equipment.forEach(equipment => {
      const config = equipmentConfig[equipment.type];
      const equipGroup = equipmentGroup.append('g')
        .attr('class', `equipment-${equipment.type}`)
        .attr('transform', `translate(${scaleX(equipment.x)}, ${scaleY(equipment.y)})`);

      // Draw equipment based on type
      if (config.shape === 'circle') {
        equipGroup.append('circle')
          .attr('r', config.size)
          .style('fill', config.color)
          .style('stroke', '#333')
          .style('stroke-width', '2px');
      } else if (config.shape === 'rect') {
        equipGroup.append('rect')
          .attr('x', -config.size / 2)
          .attr('y', -config.size / 2)
          .attr('width', config.size)
          .attr('height', config.size)
          .style('fill', config.color)
          .style('stroke', '#333')
          .style('stroke-width', '2px');
      } else if (config.shape === 'triangle') {
        const trianglePoints = [
          [0, -config.size],
          [-config.size * 0.866, config.size / 2],
          [config.size * 0.866, config.size / 2]
        ];
        
        equipGroup.append('polygon')
          .attr('points', trianglePoints.map(p => p.join(',')).join(' '))
          .style('fill', config.color)
          .style('stroke', '#333')
          .style('stroke-width', '2px');
      } else if (config.shape === 'diamond') {
        const diamondPoints = [
          [0, -config.size],
          [config.size, 0],
          [0, config.size],
          [-config.size, 0]
        ];
        
        equipGroup.append('polygon')
          .attr('points', diamondPoints.map(p => p.join(',')).join(' '))
          .style('fill', config.color)
          .style('stroke', '#333')
          .style('stroke-width', '2px');
      }

      // Add status indicator
      const statusColors = {
        active: '#4CAF50',
        inactive: '#9E9E9E',
        maintenance: '#FF9800'
      };

      equipGroup.append('circle')
        .attr('cx', config.size / 2)
        .attr('cy', -config.size / 2)
        .attr('r', 3)
        .style('fill', statusColors[equipment.status])
        .style('stroke', '#fff')
        .style('stroke-width', '1px');

      // Add label
      equipGroup.append('text')
        .attr('y', config.size + 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .style('fill', '#333')
        .text(equipment.label);

      // Add click handler
      equipGroup
        .style('cursor', 'pointer')
        .on('click', (event) => {
          event.stopPropagation();
          setSelectedEquipment(equipment);
          onEquipmentClick(equipment);
        })
        .on('mouseover', function() {
          d3.select(this).style('opacity', 0.8);
          
          // Show tooltip
          const tooltip = d3.select('body').append('div')
            .attr('class', 'equipment-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', 'white')
            .style('padding', '10px')
            .style('border-radius', '5px')
            .style('pointer-events', 'none')
            .style('opacity', 0);

          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`
            <strong>${equipment.label}</strong><br/>
            Type: ${equipment.type}<br/>
            Status: ${equipment.status}<br/>
            Position: (${equipment.x.toFixed(1)}, ${equipment.y.toFixed(1)})<br/>
            ${equipment.radius > 0 ? `Effectiveness Radius: ${equipment.radius.toFixed(1)}` : ''}
          `);
        })
        .on('mousemove', function(event) {
          d3.select('.equipment-tooltip')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).style('opacity', 1);
          d3.selectAll('.equipment-tooltip').remove();
        });
    });

    // Add coordinate display
    svg.on('mousemove', function(event) {
      const [mouseX, mouseY] = d3.pointer(event);
      const facilityX = scaleX.invert(mouseX);
      const facilityY = scaleY.invert(mouseY);
      
      // Update coordinate display (you can add a div for this)
      d3.select('#coordinate-display')
        .html(`Facility Coordinates: (${facilityX.toFixed(1)}, ${facilityY.toFixed(1)})`);
    });

    // Add legend
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 150}, 20)`);

    Object.entries(equipmentConfig).forEach(([type, config], i) => {
      const legendItem = legend.append('g')
        .attr('transform', `translate(0, ${i * 20})`);

      if (config.shape === 'circle') {
        legendItem.append('circle')
          .attr('r', 6)
          .style('fill', config.color);
      } else {
        legendItem.append('rect')
          .attr('x', -6)
          .attr('y', -6)
          .attr('width', 12)
          .attr('height', 12)
          .style('fill', config.color);
      }

      legendItem.append('text')
        .attr('x', 15)
        .attr('y', 4)
        .style('font-size', '12px')
        .text(type.replace('_', ' '));
    });

  }, [facilityData, width, height, showContours, showEffectiveness, onEquipmentClick]);

  return (
    <div className="facility-floor-plan">
      <div className="facility-controls" style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => setTimeAnimation(!timeAnimation)}
          className="btn btn-sm btn-secondary"
        >
          {timeAnimation ? 'Pause' : 'Play'} Animation
        </button>
        <span style={{ marginLeft: '20px' }}>
          Growth Index: {facilityData.analytics.total_growth?.toFixed(2) || 'N/A'}
        </span>
        <span style={{ marginLeft: '20px' }}>
          Effectiveness: {((facilityData.analytics.effectiveness || 0) * 100).toFixed(1)}%
        </span>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          background: '#ffffff',
          border: '1px solid #dee2e6',
          borderRadius: '4px'
        }}
      />

      <div id="coordinate-display" style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(255,255,255,0.9)',
        padding: '5px 10px',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        Facility Coordinates: (0.0, 0.0)
      </div>

      {selectedEquipment && (
        <div className="equipment-info-panel" style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          minWidth: '200px'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>{selectedEquipment.label}</h4>
          <p><strong>Type:</strong> {selectedEquipment.type}</p>
          <p><strong>Status:</strong> {selectedEquipment.status}</p>
          <p><strong>Position:</strong> ({selectedEquipment.x.toFixed(1)}, {selectedEquipment.y.toFixed(1)})</p>
          {selectedEquipment.radius > 0 && (
            <p><strong>Effectiveness Radius:</strong> {selectedEquipment.radius.toFixed(1)}</p>
          )}
          <button 
            onClick={() => setSelectedEquipment(null)}
            className="btn btn-sm btn-secondary"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};