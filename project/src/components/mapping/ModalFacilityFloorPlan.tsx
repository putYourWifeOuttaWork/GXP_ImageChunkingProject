import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { format } from 'date-fns';

type MapMode = 'analysis' | 'edit';

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
  latest_contours?: any[];
  analytics?: any;
  observations?: any[];
}

interface ModalFacilityFloorPlanProps {
  facilityData: FacilityData;
  mode: MapMode;
  onEquipmentClick: (equipment: Equipment) => void;
  onCanvasClick: (x: number, y: number) => void;
  onEquipmentUpdate?: (equipment: Equipment[]) => void;
  selectedTool: string | null;
  selectedEquipment: Equipment | null;
  width?: number;
  height?: number;
  selectedDate?: Date;
}

export const ModalFacilityFloorPlan: React.FC<ModalFacilityFloorPlanProps> = ({
  facilityData,
  mode,
  onEquipmentClick,
  onCanvasClick,
  onEquipmentUpdate,
  selectedTool,
  selectedEquipment,
  width = 1200,
  height = 700,
  selectedDate
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEquipment, setDraggedEquipment] = useState<Equipment | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  // Bold color schemes for different modes
  const colorSchemes = {
    analysis: {
      petri_dish: '#DC2626', // Bold red
      gasifier: '#059669', // Bold green
      sensor: '#2563EB', // Bold blue
      vent: '#7C3AED', // Bold purple
      shelving: '#EA580C', // Bold orange
      door: '#525252', // Bold gray
      fan: '#0891B2', // Bold cyan
      background: '#F3F4F6',
      grid: '#D1D5DB',
      border: '#1F2937'
    },
    edit: {
      petri_dish: '#9CA3AF', // Gray for edit mode
      gasifier: '#6B7280', // Gray
      sensor: '#9CA3AF', // Gray
      vent: '#6B7280', // Gray
      shelving: '#9CA3AF', // Gray
      door: '#4B5563', // Dark gray
      fan: '#6B7280', // Gray
      background: '#FFFFFF',
      grid: '#E5E7EB',
      border: '#374151'
    }
  };

  const colors = colorSchemes[mode];

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Define patterns and gradients
    const defs = svg.append('defs');

    // Analysis mode gradient for observations
    if (mode === 'analysis') {
      // Red gradient for high growth
      const redGradient = defs.append('radialGradient')
        .attr('id', 'high-growth-gradient');
      redGradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#DC2626')
        .attr('stop-opacity', 0.9);
      redGradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#DC2626')
        .attr('stop-opacity', 0.2);

      // Orange gradient for medium growth
      const orangeGradient = defs.append('radialGradient')
        .attr('id', 'medium-growth-gradient');
      orangeGradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#EA580C')
        .attr('stop-opacity', 0.8);
      orangeGradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#EA580C')
        .attr('stop-opacity', 0.15);

      // Yellow gradient for low growth
      const yellowGradient = defs.append('radialGradient')
        .attr('id', 'low-growth-gradient');
      yellowGradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#FBBF24')
        .attr('stop-opacity', 0.7);
      yellowGradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#FBBF24')
        .attr('stop-opacity', 0.1);
    }

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
      .style('fill', colors.background)
      .style('stroke', colors.border)
      .style('stroke-width', '3px');

    // Draw grid
    const gridGroup = g.append('g').attr('class', 'grid');
    
    const gridSpacing = 10;
    for (let i = 0; i <= facilityWidth; i += gridSpacing) {
      gridGroup.append('line')
        .attr('x1', scaleX(i))
        .attr('y1', scaleY(0))
        .attr('x2', scaleX(i))
        .attr('y2', scaleY(facilityHeight))
        .style('stroke', colors.grid)
        .style('stroke-width', '1px')
        .style('opacity', 0.5);
    }
    
    for (let i = 0; i <= facilityHeight; i += gridSpacing) {
      gridGroup.append('line')
        .attr('x1', scaleX(0))
        .attr('y1', scaleY(i))
        .attr('x2', scaleX(facilityWidth))
        .attr('y2', scaleY(i))
        .style('stroke', colors.grid)
        .style('stroke-width', '1px')
        .style('opacity', 0.5);
    }

    // In analysis mode, show observation data
    if (mode === 'analysis' && facilityData.observations) {
      const observationGroup = g.append('g').attr('class', 'observations');
      
      facilityData.observations.forEach(obs => {
        if (obs.x_position !== null && obs.y_position !== null) {
          const growthIndex = obs.growth_index || 0;
          let gradientId = 'low-growth-gradient';
          let radius = 20;
          
          if (growthIndex >= 7) {
            gradientId = 'high-growth-gradient';
            radius = 30;
          } else if (growthIndex >= 4) {
            gradientId = 'medium-growth-gradient';
            radius = 25;
          }

          // Draw observation area
          observationGroup.append('circle')
            .attr('cx', scaleX(obs.x_position))
            .attr('cy', scaleY(obs.y_position))
            .attr('r', radius)
            .style('fill', `url(#${gradientId})`)
            .style('stroke', 'none');

          // Draw observation point
          observationGroup.append('circle')
            .attr('cx', scaleX(obs.x_position))
            .attr('cy', scaleY(obs.y_position))
            .attr('r', 5)
            .style('fill', growthIndex >= 7 ? '#DC2626' : growthIndex >= 4 ? '#EA580C' : '#FBBF24')
            .style('stroke', '#FFFFFF')
            .style('stroke-width', '2px');

          // Add growth index label
          observationGroup.append('text')
            .attr('x', scaleX(obs.x_position))
            .attr('y', scaleY(obs.y_position) - 35)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', '#1F2937')
            .style('background', 'white')
            .text(growthIndex.toFixed(1));
        }
      });

      // Draw contour overlay if available
      if (facilityData.latest_contours && facilityData.latest_contours.length > 0) {
        const contourGroup = g.append('g').attr('class', 'contours').style('opacity', 0.3);
        
        // Create heatmap overlay
        const contourData = facilityData.latest_contours;
        const colorScale = d3.scaleSequential(d3.interpolateReds)
          .domain([0, 1]);

        // Create Voronoi for smooth contours
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
              .style('stroke', 'none');
          }
        });
      }
    }

    // Draw equipment
    const equipmentGroup = g.append('g').attr('class', 'equipment');
    
    facilityData.equipment.forEach(equipment => {
      const equipGroup = equipmentGroup.append('g')
        .attr('class', `equipment-${equipment.type}`)
        .attr('transform', `translate(${scaleX(equipment.x)}, ${scaleY(equipment.y)})`)
        .style('cursor', mode === 'edit' ? 'move' : 'pointer');

      // Draw equipment shape with bold colors
      const color = colors[equipment.type];
      const size = equipment.type === 'shelving' ? 30 : 
                   equipment.type === 'gasifier' ? 20 : 
                   equipment.type === 'door' ? 20 : 15;

      if (equipment.type === 'petri_dish') {
        equipGroup.append('circle')
          .attr('r', size)
          .style('fill', color)
          .style('stroke', selectedEquipment?.equipment_id === equipment.equipment_id ? '#FBBF24' : '#1F2937')
          .style('stroke-width', selectedEquipment?.equipment_id === equipment.equipment_id ? '4px' : '2px');
      } else if (equipment.type === 'gasifier') {
        // Cloud shape for gasifier
        const cloudPath = d3.path();
        cloudPath.arc(-size/2, 0, size/2, Math.PI, 0, false);
        cloudPath.arc(0, -size/3, size/3, Math.PI, 0, false);
        cloudPath.arc(size/2, 0, size/2, Math.PI, 0, false);
        cloudPath.arc(0, size/3, size/1.5, 0, Math.PI, false);
        cloudPath.closePath();
        
        equipGroup.append('path')
          .attr('d', cloudPath.toString())
          .style('fill', color)
          .style('stroke', selectedEquipment?.equipment_id === equipment.equipment_id ? '#FBBF24' : '#1F2937')
          .style('stroke-width', selectedEquipment?.equipment_id === equipment.equipment_id ? '4px' : '2px');
      } else {
        // Rectangle for other types
        equipGroup.append('rect')
          .attr('x', -size / 2)
          .attr('y', -size / 2)
          .attr('width', size)
          .attr('height', size)
          .style('fill', color)
          .style('stroke', selectedEquipment?.equipment_id === equipment.equipment_id ? '#FBBF24' : '#1F2937')
          .style('stroke-width', selectedEquipment?.equipment_id === equipment.equipment_id ? '4px' : '2px');
      }

      // Add label
      equipGroup.append('text')
        .attr('y', size + 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#1F2937')
        .text(equipment.label);

      // Add click/drag handlers
      if (mode === 'edit') {
        equipGroup
          .on('mousedown', function(event) {
            event.stopPropagation();
            setIsDragging(true);
            setDraggedEquipment(equipment);
            const [mouseX, mouseY] = d3.pointer(event, g.node());
            setDragOffset({
              x: mouseX - scaleX(equipment.x),
              y: mouseY - scaleY(equipment.y)
            });
          });
      }

      equipGroup.on('click', (event) => {
        event.stopPropagation();
        onEquipmentClick(equipment);
      });
    });

    // Handle drag events for edit mode
    if (mode === 'edit') {
      svg
        .on('mousemove', function(event) {
          if (isDragging && draggedEquipment && onEquipmentUpdate) {
            const [mouseX, mouseY] = d3.pointer(event, g.node());
            const newX = scaleX.invert(mouseX - dragOffset.x);
            const newY = scaleY.invert(mouseY - dragOffset.y);
            
            // Update equipment position
            const updatedEquipment = facilityData.equipment.map(eq => 
              eq.equipment_id === draggedEquipment.equipment_id
                ? { ...eq, x: Math.max(0, Math.min(facilityWidth, newX)), y: Math.max(0, Math.min(facilityHeight, newY)) }
                : eq
            );
            
            onEquipmentUpdate(updatedEquipment);
          }
        })
        .on('mouseup', () => {
          setIsDragging(false);
          setDraggedEquipment(null);
        });

      // Handle canvas clicks for placing new equipment
      facilityRect.on('click', function(event) {
        if (selectedTool) {
          const [mouseX, mouseY] = d3.pointer(event);
          const facilityX = scaleX.invert(mouseX);
          const facilityY = scaleY.invert(mouseY);
          onCanvasClick(facilityX, facilityY);
        }
      });
    }

    // Show cursor indicator when tool is selected in edit mode
    if (mode === 'edit' && selectedTool) {
      svg.style('cursor', 'crosshair');
    } else {
      svg.style('cursor', 'default');
    }

    // Add title and date
    const titleGroup = svg.append('g').attr('class', 'title');
    
    titleGroup.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '20px')
      .style('font-weight', 'bold')
      .style('fill', '#1F2937')
      .text(`${facilityData.facility_info.name} - ${mode === 'analysis' ? 'Analysis' : 'Edit'} Mode`);

    if (mode === 'analysis' && selectedDate) {
      titleGroup.append('text')
        .attr('x', width / 2)
        .attr('y', 50)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('fill', '#6B7280')
        .text(format(selectedDate, 'MMMM d, yyyy'));
    }

  }, [facilityData, mode, selectedTool, selectedEquipment, width, height, selectedDate, isDragging, onEquipmentUpdate]);

  return (
    <div className="modal-facility-floor-plan bg-white rounded-lg shadow-lg">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          background: '#FAFAFA',
          borderRadius: '8px'
        }}
      />
    </div>
  );
};