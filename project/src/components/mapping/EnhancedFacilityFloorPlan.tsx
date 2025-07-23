import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface Equipment {
  equipment_id: string;
  type: 'petri_dish' | 'gasifier' | 'sensor' | 'vent' | 'shelving' | 'door' | 'fan';
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  status: 'active' | 'inactive' | 'maintenance';
  config: any;
}

interface FacilityData {
  facility_info: {
    site_id: string;
    name: string;
    dimensions: { width: number; height: number; units: string };
    layout?: any;
  };
  equipment: Equipment[];
  latest_contours: any[];
  analytics: any;
}

interface EnhancedFacilityFloorPlanProps {
  facilityData: FacilityData;
  onEquipmentClick: (equipment: Equipment) => void;
  onCanvasClick: (x: number, y: number) => void;
  selectedTool: string | null;
  selectedEquipment: Equipment | null;
  width?: number;
  height?: number;
  day?: number;
}

export const EnhancedFacilityFloorPlan: React.FC<EnhancedFacilityFloorPlanProps> = ({
  facilityData,
  onEquipmentClick,
  onCanvasClick,
  selectedTool,
  selectedEquipment,
  width = 1200,
  height = 700,
  day = 1
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEquipment, setDraggedEquipment] = useState<Equipment | null>(null);
  const [tempPosition, setTempPosition] = useState({ x: 0, y: 0 });

  // Calculate facility bounds with padding
  const padding = 50;
  const facilityWidth = facilityData.facility_info.dimensions.width;
  const facilityHeight = facilityData.facility_info.dimensions.height;
  
  const scaleX = d3.scaleLinear()
    .domain([0, facilityWidth])
    .range([padding, width - padding]);
  
  const scaleY = d3.scaleLinear()
    .domain([0, facilityHeight])
    .range([padding, height - padding]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Define patterns and gradients
    const defs = svg.append('defs');

    // Contour gradient for mold growth
    const moldGradient = defs.append('radialGradient')
      .attr('id', 'mold-gradient');
    
    moldGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#ff1744')
      .attr('stop-opacity', 0.8);
    
    moldGradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#ff4569')
      .attr('stop-opacity', 0.5);
    
    moldGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#ff6b8a')
      .attr('stop-opacity', 0.2);

    // Effectiveness gradient
    const effectGradient = defs.append('radialGradient')
      .attr('id', 'effect-gradient');
    
    effectGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#00e676')
      .attr('stop-opacity', 0.3);
    
    effectGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#00e676')
      .attr('stop-opacity', 0.05);

    // Main drawing group
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Draw facility background
    const facilityRect = g.append('rect')
      .attr('x', scaleX(0))
      .attr('y', scaleY(0))
      .attr('width', scaleX(facilityWidth) - scaleX(0))
      .attr('height', scaleY(facilityHeight) - scaleY(0))
      .style('fill', '#e3f2fd')
      .style('stroke', '#1976d2')
      .style('stroke-width', '2px');

    // Draw grid
    const gridGroup = g.append('g').attr('class', 'grid');
    
    // Grid lines
    const gridSpacing = 10;
    for (let i = 0; i <= facilityWidth; i += gridSpacing) {
      gridGroup.append('line')
        .attr('x1', scaleX(i))
        .attr('y1', scaleY(0))
        .attr('x2', scaleX(i))
        .attr('y2', scaleY(facilityHeight))
        .style('stroke', '#90caf9')
        .style('stroke-width', '0.5px')
        .style('opacity', 0.3);
    }
    
    for (let i = 0; i <= facilityHeight; i += gridSpacing) {
      gridGroup.append('line')
        .attr('x1', scaleX(0))
        .attr('y1', scaleY(i))
        .attr('x2', scaleX(facilityWidth))
        .attr('y2', scaleY(i))
        .style('stroke', '#90caf9')
        .style('stroke-width', '0.5px')
        .style('opacity', 0.3);
    }

    // Generate mold growth contours
    const contourGroup = g.append('g').attr('class', 'contours');
    
    // Create mold growth areas based on petri dish positions
    const petriDishes = facilityData.equipment.filter(eq => eq.type === 'petri_dish');
    const gasifiers = facilityData.equipment.filter(eq => eq.type === 'gasifier');
    
    // Calculate mold intensity based on distance from petri dishes and gasifiers
    const contourData: any[] = [];
    const resolution = 5;
    
    for (let x = 0; x <= facilityWidth; x += resolution) {
      for (let y = 0; y <= facilityHeight; y += resolution) {
        let intensity = 0;
        
        // Add intensity from petri dishes
        petriDishes.forEach(petri => {
          const dist = Math.sqrt(Math.pow(x - petri.x, 2) + Math.pow(y - petri.y, 2));
          const growthRate = 0.1 + (day * 0.02); // Growth increases with days
          intensity += Math.max(0, (1 - dist / 30) * growthRate);
        });
        
        // Reduce intensity from gasifiers
        gasifiers.forEach(gas => {
          const dist = Math.sqrt(Math.pow(x - gas.x, 2) + Math.pow(y - gas.y, 2));
          if (dist < gas.radius * 2) {
            intensity *= (dist / (gas.radius * 2)) * 0.3;
          }
        });
        
        if (intensity > 0.1) {
          contourData.push({ x, y, intensity: Math.min(intensity, 1) });
        }
      }
    }

    // Draw contour areas
    const colorScale = d3.scaleSequential(d3.interpolateReds)
      .domain([0, 1]);
    
    // Create Voronoi for smooth contours
    if (contourData.length > 0) {
      const delaunay = d3.Delaunay.from(
        contourData.map(d => [scaleX(d.x), scaleY(d.y)])
      );
      const voronoi = delaunay.voronoi([
        scaleX(0), scaleY(0), 
        scaleX(facilityWidth), scaleY(facilityHeight)
      ]);

      contourData.forEach((point, i) => {
        const cell = voronoi.cellPolygon(i);
        if (cell) {
          contourGroup.append('path')
            .attr('d', d3.line()(cell) + 'Z')
            .style('fill', colorScale(point.intensity))
            .style('opacity', 0.3)
            .style('stroke', 'none');
        }
      });
    }

    // Draw contour lines
    const contourLineGroup = g.append('g').attr('class', 'contour-lines');
    
    [0.2, 0.4, 0.6, 0.8].forEach(level => {
      const points = contourData.filter(d => Math.abs(d.intensity - level) < 0.1);
      if (points.length > 3) {
        const hull = d3.polygonHull(points.map(d => [scaleX(d.x), scaleY(d.y)]));
        if (hull) {
          contourLineGroup.append('path')
            .attr('d', d3.line()(hull) + 'Z')
            .style('fill', 'none')
            .style('stroke', colorScale(level))
            .style('stroke-width', '2px')
            .style('stroke-dasharray', '5,5')
            .style('opacity', 0.6);
        }
      }
    });

    // Draw effectiveness zones around gasifiers
    const effectivenessGroup = g.append('g').attr('class', 'effectiveness');
    
    gasifiers.forEach(gas => {
      // Multiple concentric circles for effectiveness zones
      [1.5, 2, 2.5].forEach((multiplier, index) => {
        effectivenessGroup.append('circle')
          .attr('cx', scaleX(gas.x))
          .attr('cy', scaleY(gas.y))
          .attr('r', (scaleX(gas.radius * multiplier) - scaleX(0)))
          .style('fill', 'none')
          .style('stroke', '#00e676')
          .style('stroke-width', '2px')
          .style('stroke-dasharray', '8,4')
          .style('opacity', 0.3 - index * 0.1);
      });
      
      // Filled effectiveness area
      effectivenessGroup.append('circle')
        .attr('cx', scaleX(gas.x))
        .attr('cy', scaleY(gas.y))
        .attr('r', scaleX(gas.radius * 1.5) - scaleX(0))
        .style('fill', 'url(#effect-gradient)')
        .style('opacity', 0.5);
    });

    // Draw equipment
    const equipmentGroup = g.append('g').attr('class', 'equipment');
    
    // Equipment styles
    const equipmentStyles = {
      petri_dish: { color: '#e91e63', shape: 'circle', size: 12, textColor: 'white' },
      gasifier: { color: '#00bcd4', shape: 'cloud', size: 20, textColor: 'white' },
      sensor: { color: '#2196f3', shape: 'triangle', size: 10, textColor: 'white' },
      vent: { color: '#4caf50', shape: 'diamond', size: 14, textColor: 'white' },
      shelving: { color: '#ff9800', shape: 'rect', size: 30, textColor: 'black' },
      door: { color: '#424242', shape: 'rect', size: 20, textColor: 'white' },
      fan: { color: '#3f51b5', shape: 'circle', size: 16, textColor: 'white' }
    };

    // Draw each equipment
    facilityData.equipment.forEach(equipment => {
      const style = equipmentStyles[equipment.type] || equipmentStyles.petri_dish; // Fallback to petri_dish style
      if (!style) {
        console.warn(`Unknown equipment type: ${equipment.type}`);
        return; // Skip this equipment
      }
      
      const equipGroup = equipmentGroup.append('g')
        .attr('class', `equipment-${equipment.type}`)
        .attr('transform', `translate(${scaleX(equipment.x)}, ${scaleY(equipment.y)})`)
        .style('cursor', 'pointer');

      // Draw equipment shape
      if (equipment.type === 'gasifier') {
        // Draw cloud shape for gasifier
        const cloudPath = d3.path();
        const r = style.size;
        cloudPath.arc(-r/2, 0, r/2, Math.PI, 0, false);
        cloudPath.arc(0, -r/3, r/3, Math.PI, 0, false);
        cloudPath.arc(r/2, 0, r/2, Math.PI, 0, false);
        cloudPath.arc(0, r/3, r/1.5, 0, Math.PI, false);
        cloudPath.closePath();
        
        equipGroup.append('path')
          .attr('d', cloudPath.toString())
          .style('fill', style.color)
          .style('stroke', selectedEquipment?.equipment_id === equipment.equipment_id ? '#ffeb3b' : '#333')
          .style('stroke-width', selectedEquipment?.equipment_id === equipment.equipment_id ? '4px' : '2px');
      } else if (equipment.type === 'door') {
        // Draw door shape
        equipGroup.append('rect')
          .attr('x', -style.size / 8)
          .attr('y', -style.size / 2)
          .attr('width', style.size / 4)
          .attr('height', style.size)
          .style('fill', style.color)
          .style('stroke', '#333')
          .style('stroke-width', '2px');
        
        equipGroup.append('rect')
          .attr('x', -style.size / 8)
          .attr('y', -style.size / 2)
          .attr('width', style.size / 4)
          .attr('height', style.size / 4)
          .style('fill', '#ff0000');
      } else if (style.shape === 'circle') {
        equipGroup.append('circle')
          .attr('r', style.size)
          .style('fill', style.color)
          .style('stroke', selectedEquipment?.equipment_id === equipment.equipment_id ? '#ffeb3b' : '#333')
          .style('stroke-width', selectedEquipment?.equipment_id === equipment.equipment_id ? '4px' : '2px');
      } else if (style.shape === 'rect') {
        const rectWidth = equipment.type === 'shelving' ? style.size * 2 : style.size;
        const rectHeight = equipment.type === 'shelving' ? style.size / 2 : style.size;
        
        equipGroup.append('rect')
          .attr('x', -rectWidth / 2)
          .attr('y', -rectHeight / 2)
          .attr('width', rectWidth)
          .attr('height', rectHeight)
          .style('fill', style.color)
          .style('stroke', selectedEquipment?.equipment_id === equipment.equipment_id ? '#ffeb3b' : '#333')
          .style('stroke-width', selectedEquipment?.equipment_id === equipment.equipment_id ? '4px' : '2px');
      } else if (style.shape === 'triangle') {
        const trianglePoints = [
          [0, -style.size],
          [-style.size * 0.866, style.size / 2],
          [style.size * 0.866, style.size / 2]
        ];
        
        equipGroup.append('polygon')
          .attr('points', trianglePoints.map(p => p.join(',')).join(' '))
          .style('fill', style.color)
          .style('stroke', selectedEquipment?.equipment_id === equipment.equipment_id ? '#ffeb3b' : '#333')
          .style('stroke-width', selectedEquipment?.equipment_id === equipment.equipment_id ? '4px' : '2px');
      } else if (style.shape === 'diamond') {
        const diamondPoints = [
          [0, -style.size],
          [style.size, 0],
          [0, style.size],
          [-style.size, 0]
        ];
        
        equipGroup.append('polygon')
          .attr('points', diamondPoints.map(p => p.join(',')).join(' '))
          .style('fill', style.color)
          .style('stroke', selectedEquipment?.equipment_id === equipment.equipment_id ? '#ffeb3b' : '#333')
          .style('stroke-width', selectedEquipment?.equipment_id === equipment.equipment_id ? '4px' : '2px');
      }

      // Add label
      if (equipment.type === 'petri_dish' || equipment.type === 'gasifier' || equipment.type === 'fan') {
        equipGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 5)
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .style('fill', style.textColor)
          .text(equipment.label);
      } else if (equipment.type === 'shelving') {
        // Rotated text for shelving
        equipGroup.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('font-weight', 'bold')
          .style('fill', style.textColor)
          .text(equipment.label);
      }

      // Click handler
      equipGroup.on('click', (event) => {
        event.stopPropagation();
        onEquipmentClick(equipment);
      });

      // Hover effects
      equipGroup
        .on('mouseover', function() {
          d3.select(this).style('opacity', 0.8);
        })
        .on('mouseout', function() {
          d3.select(this).style('opacity', 1);
        });
    });

    // Draw labels for doors and areas
    const labelGroup = g.append('g').attr('class', 'labels');
    
    labelGroup.append('text')
      .attr('x', scaleX(1))
      .attr('y', scaleY(76))
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', 'white')
      .style('background', 'black')
      .text('Door 1');
    
    labelGroup.append('text')
      .attr('x', scaleX(15))
      .attr('y', scaleY(2))
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', 'white')
      .text('Door 2');
    
    labelGroup.append('text')
      .attr('x', scaleX(5))
      .attr('y', scaleY(5))
      .attr('transform', `rotate(-90 ${scaleX(5)} ${scaleY(5)})`)
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('FRONT');

    // Handle canvas clicks for placing new equipment
    facilityRect.on('click', function(event) {
      if (selectedTool) {
        const [mouseX, mouseY] = d3.pointer(event);
        const facilityX = scaleX.invert(mouseX);
        const facilityY = scaleY.invert(mouseY);
        onCanvasClick(facilityX, facilityY);
      }
    });

    // Show cursor indicator when tool is selected
    if (selectedTool) {
      svg.style('cursor', 'crosshair');
    } else {
      svg.style('cursor', 'default');
    }

  }, [facilityData, selectedTool, selectedEquipment, width, height, day, onEquipmentClick, onCanvasClick]);

  return (
    <div className="enhanced-facility-floor-plan bg-white rounded-lg shadow-lg">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          background: '#fafafa',
          borderRadius: '8px'
        }}
      />
    </div>
  );
};