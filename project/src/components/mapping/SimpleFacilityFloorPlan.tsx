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
    min_efficacious_gasifier_density_sqft_per_bag?: number;
  };
  equipment: Equipment[];
}

interface SimpleFacilityFloorPlanProps {
  facilityData: FacilityData;
  onEquipmentClick: (equipment: Equipment, event?: MouseEvent) => void;
  onEquipmentSelect?: (equipment: Equipment) => void;
  onCanvasClick: (x: number, y: number, event?: MouseEvent) => void;
  onEquipmentUpdate?: (equipment: Equipment[]) => void;
  onFacilityRightClick?: (event: MouseEvent, x?: number, y?: number) => void;
  onEquipmentRightClick?: (equipment: Equipment, event: MouseEvent) => void;
  selectedTool: string | null;
  selectedEquipment: Equipment | null;
  selectedEquipmentIds?: string[];
  setSelectedEquipmentIds?: (ids: string[]) => void;
  ghostDragEquipment?: Equipment | null;
  cursorPosition?: { x: number; y: number };
  width?: number;
  height?: number;
  compact?: boolean;
  showDebugBoundaries?: boolean;
}

export const SimpleFacilityFloorPlan: React.FC<SimpleFacilityFloorPlanProps> = ({
  facilityData,
  onEquipmentClick,
  onEquipmentSelect,
  onCanvasClick,
  onEquipmentUpdate,
  onFacilityRightClick,
  onEquipmentRightClick,
  selectedTool,
  selectedEquipment,
  selectedEquipmentIds: externalSelectedIds,
  setSelectedEquipmentIds: externalSetSelectedIds,
  ghostDragEquipment,
  cursorPosition,
  width = 900,
  height = 500,
  compact = true,
  showDebugBoundaries = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const brushOverlayRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [labelPositions, setLabelPositions] = useState<Record<string, string>>({});
  const [draggedEquipment, setDraggedEquipment] = useState<Equipment | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizingEquipment, setResizingEquipment] = useState<Equipment | null>(null);
  const [resizeHandle, setResizeHandle] = useState<number | null>(null);
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  
  // Brush selection state - use external if provided, otherwise internal
  const [isBrushSelecting, setIsBrushSelecting] = useState(false);
  
  // Handle escape key for label deselection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Clear label selection
        setSelectedLabelId(null);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [brushStart, setBrushStart] = useState({ x: 0, y: 0 });
  const [brushEnd, setBrushEnd] = useState({ x: 0, y: 0 });
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const selectedEquipmentIds = externalSelectedIds || internalSelectedIds;
  const setSelectedEquipmentIds = externalSetSelectedIds || setInternalSelectedIds;
  const [isMultiDragging, setIsMultiDragging] = useState(false);
  const [multiDragStartPositions, setMultiDragStartPositions] = useState<Map<string, {x: number, y: number}>>(new Map());


  // Calculate facility bounds with padding
  const padding = compact ? 30 : 50;
  const facilityWidth = facilityData.facility_info.dimensions.width;
  const facilityHeight = facilityData.facility_info.dimensions.height;
  
  // Visual boundary buffer to prevent equipment from appearing to overflow
  // This accounts for stroke widths and visual rendering precision
  // Increased to properly account for SVG padding and stroke rendering
  const visualBoundaryBuffer = 2.0; // Buffer in facility units to ensure visual containment
  
  const scaleX = d3.scaleLinear()
    .domain([0, facilityWidth])
    .range([padding, width - padding]);
  
  const scaleY = d3.scaleLinear()
    .domain([0, facilityHeight])
    .range([padding, height - padding]);

  // Equipment styles matching the mockup
  const equipmentStyles = {
    petri_dish: { color: '#059669', shape: 'circle', size: 10 }, // Green
    gasifier: { color: '#1F2937', shape: 'circle', size: 12 }, // Dark gray/black
    sensor: { color: '#3B82F6', shape: 'circle', size: 8 }, // Blue
    vent: { color: '#6B7280', shape: 'diamond', size: 14 },
    shelving: { color: '#9CA3AF', shape: 'rect', size: 30 },
    door: { color: '#EF4444', shape: 'rect', size: 20 }, // Red
    fan: { color: '#6B7280', shape: 'circle', size: 16 }
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Define gradients
    const defs = svg.append('defs');

    // Calculate grid size based on facility square footage
    const squareFootage = width * height;
    let dynamicGridSize = 1; // Default 1x1 for precision
    if (squareFootage > 100000) {
      dynamicGridSize = 5; // 5x5 for facilities > 100,000 sqft
    } else if (squareFootage > 50000) {
      dynamicGridSize = 2; // 2x2 for facilities > 50,000 sqft
    }
    
    // Force 1x1 grid for all facilities for now
    dynamicGridSize = 1;
    
    
    // Grid snapping function
    const snapToGrid = (value: number, gridSize: number = dynamicGridSize) => {
      return Math.round(value / gridSize) * gridSize;
    };
    
    // Perimeter snapping for doors
    const snapToPerimeter = (x: number, y: number, margin: number = 2) => {
      const distances = [
        { x: margin, y: y, dist: Math.abs(x - margin) }, // Left wall
        { x: facilityWidth - margin, y: y, dist: Math.abs(x - (facilityWidth - margin)) }, // Right wall
        { x: x, y: margin, dist: Math.abs(y - margin) }, // Top wall
        { x: x, y: facilityHeight - margin, dist: Math.abs(y - (facilityHeight - margin)) } // Bottom wall
      ];
      
      const closest = distances.reduce((min, curr) => curr.dist < min.dist ? curr : min);
      return { x: closest.x, y: closest.y };
    };

    // Main drawing group
    const g = svg.append('g');

    // Remove zoom behavior for stable facility
    // Users can drag equipment but not the whole canvas

    // Draw facility background
    const facilityRect = g.append('rect')
      .attr('x', scaleX(0))
      .attr('y', scaleY(0))
      .attr('width', scaleX(facilityWidth) - scaleX(0))
      .attr('height', scaleY(facilityHeight) - scaleY(0))
      .style('fill', '#E0F2FE')  // Light blue background matching mockup
      .style('stroke', '#0EA5E9') // Blue border
      .style('stroke-width', '2px')
      .style('pointer-events', 'all')
      .on('contextmenu', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Cancel any active brush selection
        setIsBrushSelecting(false);
        
        if (onFacilityRightClick) {
          const [mouseX, mouseY] = d3.pointer(event, this);
          const facilityX = scaleX.invert(mouseX);
          const facilityY = scaleY.invert(mouseY);
          onFacilityRightClick(event, facilityX, facilityY);
        }
      })
      .on('click', function(event) {
        event.stopPropagation();
        
        // Handle ghost drag placement first
        if (ghostDragEquipment) {
          const [mouseX, mouseY] = d3.pointer(event, this);
          let facilityX = scaleX.invert(mouseX);
          let facilityY = scaleY.invert(mouseY);
          
          // Apply snapping for placement
          if (ghostDragEquipment.type === 'door') {
            const snapped = snapToPerimeter(facilityX, facilityY);
            facilityX = snapped.x;
            facilityY = snapped.y;
          } else {
            facilityX = snapToGrid(facilityX);
            facilityY = snapToGrid(facilityY);
          }
          
          onCanvasClick(facilityX, facilityY, event);
        } else if (selectedTool) {
          // Single click with tool selected - place equipment
          const [mouseX, mouseY] = d3.pointer(event, this);
          let facilityX = scaleX.invert(mouseX);
          let facilityY = scaleY.invert(mouseY);
          
          // Apply snapping for placement
          if (selectedTool === 'door') {
            const snapped = snapToPerimeter(facilityX, facilityY);
            facilityX = snapped.x;
            facilityY = snapped.y;
          } else {
            facilityX = snapToGrid(facilityX);
            facilityY = snapToGrid(facilityY);
          }
          
          
          // Clear any drag state before placing new equipment
          setIsDragging(false);
          setDraggedEquipment(null);
          hasDraggedRef.current = false;
          onCanvasClick(facilityX, facilityY, event);
        } else if (!isBrushSelecting && !hasDraggedRef.current) {
          // Clear selection if clicking empty space (and not after dragging)
          setSelectedEquipmentIds([]);
          if (onEquipmentSelect) {
            onEquipmentSelect(null);
          }
          
          // Clear label selection and save any editing
          if (editingLabelId) {
            // Save the label if editing
            const equipment = facilityData.equipment.find(eq => eq.equipment_id === editingLabelId);
            if (equipment && onEquipmentUpdate && editingLabelText.trim()) {
              const updatedEquipment = facilityData.equipment.map(eq =>
                eq.equipment_id === editingLabelId
                  ? { ...eq, label: editingLabelText.trim() }
                  : eq
              );
              onEquipmentUpdate(updatedEquipment);
            }
            setEditingLabelId(null);
            setEditingLabelText('');
          }
          setSelectedLabelId(null);
        }
      });

    // Draw grid
    const gridGroup = g.append('g').attr('class', 'grid');
    
    const gridSpacing = 10;
    for (let i = 0; i <= facilityWidth; i += gridSpacing) {
      gridGroup.append('line')
        .attr('x1', scaleX(i))
        .attr('y1', scaleY(0))
        .attr('x2', scaleX(i))
        .attr('y2', scaleY(facilityHeight))
        .style('stroke', '#93C5FD') // Light blue grid lines
        .style('stroke-width', '0.5px')
        .style('opacity', 0.3);
    }
    
    for (let i = 0; i <= facilityHeight; i += gridSpacing) {
      gridGroup.append('line')
        .attr('x1', scaleX(0))
        .attr('y1', scaleY(i))
        .attr('x2', scaleX(facilityWidth))
        .attr('y2', scaleY(i))
        .style('stroke', '#93C5FD') // Light blue grid lines
        .style('stroke-width', '0.5px')
        .style('opacity', 0.3);
    }

    // Add axis labels
    const axisGroup = g.append('g').attr('class', 'axis');
    
    // Debug group for boundary visualization
    const debugGroup = g.append('g')
      .attr('class', 'debug-boundaries')
      .attr('opacity', 0.5)
      .style('display', showDebugBoundaries ? 'block' : 'none');
    
    // X-axis labels
    for (let i = 0; i <= facilityWidth; i += 20) {
      axisGroup.append('text')
        .attr('x', scaleX(i))
        .attr('y', scaleY(0) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#6B7280')
        .text(i);
    }
    
    // Y-axis labels
    for (let i = 0; i <= facilityHeight; i += 20) {
      axisGroup.append('text')
        .attr('x', scaleX(0) - 5)
        .attr('y', scaleY(i))
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '10px')
        .style('fill', '#6B7280')
        .text(i);
    }

    // Draw gasifier effectiveness zones first (so they appear behind equipment)
    const effectivenessGroup = g.append('g').attr('class', 'effectiveness');
    
    facilityData.equipment.filter(eq => eq.type === 'gasifier').forEach(gasifier => {
      // Use gasifier's effectiveness_radius if available, otherwise calculate from site default
      let effectiveRadiusFt = gasifier.config?.effectiveness_radius;
      if (!effectiveRadiusFt) {
        const sqftPerBag = facilityData.facility_info.min_efficacious_gasifier_density_sqft_per_bag || 2000;
        effectiveRadiusFt = Math.sqrt(sqftPerBag / Math.PI);
      }
      const effectiveRadiusPx = scaleX(effectiveRadiusFt) - scaleX(0);
      
      // Create gradient for this gasifier
      const gasifierGradient = defs.append('radialGradient')
        .attr('id', `gasifier-gradient-${gasifier.equipment_id}`)
        .attr('gradientUnits', 'objectBoundingBox');
      
      // Match mockup colors - purple to blue gradient
      gasifierGradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#9333EA') // Purple
        .attr('stop-opacity', 0.4);
      
      gasifierGradient.append('stop')
        .attr('offset', '30%')
        .attr('stop-color', '#7C3AED') // Purple-blue
        .attr('stop-opacity', 0.3);
      
      gasifierGradient.append('stop')
        .attr('offset', '60%')
        .attr('stop-color', '#3B82F6') // Blue
        .attr('stop-opacity', 0.2);
      
      gasifierGradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#60A5FA') // Light blue
        .attr('stop-opacity', 0.05);
      
      // Main gradient fill
      effectivenessGroup.append('circle')
        .attr('cx', scaleX(gasifier.x))
        .attr('cy', scaleY(gasifier.y))
        .attr('r', effectiveRadiusPx)
        .style('fill', `url(#gasifier-gradient-${gasifier.equipment_id})`)
        .style('stroke', 'none')
        .style('pointer-events', 'none');
      
      // Add dashed concentric circles to show effectiveness zones
      const ringCount = 4; // Number of rings
      for (let i = 1; i <= ringCount; i++) {
        const ringRadius = (effectiveRadiusPx * i) / ringCount;
        effectivenessGroup.append('circle')
          .attr('cx', scaleX(gasifier.x))
          .attr('cy', scaleY(gasifier.y))
          .attr('r', ringRadius)
          .style('fill', 'none')
          .style('stroke', '#9333EA')
          .style('stroke-width', '1px')
          .style('stroke-dasharray', '3,3')
          .style('opacity', 0.09375 + (0.0375 * (ringCount - i + 1)))
          .style('pointer-events', 'none');
      }
    });

    // Draw equipment
    const equipmentGroup = g.append('g').attr('class', 'equipment');
    
    // Highlight equipment at 0,0
    const equipmentAt00 = facilityData.equipment.filter(eq => eq.x === 0 && eq.y === 0);
    if (equipmentAt00.length > 0) {
      equipmentGroup.append('circle')
        .attr('cx', scaleX(0))
        .attr('cy', scaleY(0))
        .attr('r', 30)
        .style('fill', 'none')
        .style('stroke', '#EF4444')
        .style('stroke-width', '3px')
        .style('stroke-dasharray', '5,5')
        .style('opacity', 0.5);
      
      equipmentGroup.append('text')
        .attr('x', scaleX(0))
        .attr('y', scaleY(0) - 40)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#EF4444')
        .text(`${equipmentAt00.length} items need positioning`);
    }
    
    facilityData.equipment.forEach(equipment => {
      const style = equipmentStyles[equipment.type];
      if (!style) return;
      
      // If this equipment is being ghost dragged, show it at cursor position instead
      let equipX = equipment.x;
      let equipY = equipment.y;
      let isGhostDragging = false;
      
      if (ghostDragEquipment && equipment.equipment_id === ghostDragEquipment.equipment_id && cursorPosition && svgRef.current) {
        isGhostDragging = true;
        // Convert screen coordinates to SVG coordinates
        const svgRect = svgRef.current.getBoundingClientRect();
        const svgX = cursorPosition.x - svgRect.left;
        const svgY = cursorPosition.y - svgRect.top;
        
        // Convert SVG coordinates to facility coordinates
        equipX = scaleX.invert(svgX);
        equipY = scaleY.invert(svgY);
        
        // Apply grid snapping
        if (equipment.type === 'door') {
          const snapped = snapToPerimeter(equipX, equipY);
          equipX = snapped.x;
          equipY = snapped.y;
        } else {
          equipX = snapToGrid(equipX);
          equipY = snapToGrid(equipY);
        }
      }
      
      const equipGroup = equipmentGroup.append('g')
        .attr('class', `equipment-${equipment.type}`)
        .attr('transform', `translate(${scaleX(equipX)}, ${scaleY(equipY)})`)
        .style('cursor', isGhostDragging ? 'grabbing' : 'grab')
        .style('opacity', isGhostDragging ? 0.7 : 1)
        .style('pointer-events', isGhostDragging ? 'none' : 'all')
        .datum(equipment.equipment_id);

      // Highlight if at origin
      const isAtOrigin = equipment.x === 0 && equipment.y === 0;

      // Check if this equipment is selected (single or multi)
      const isMultiSelected = selectedEquipmentIds.includes(equipment.equipment_id);
      const isSingleSelected = selectedEquipment?.equipment_id === equipment.equipment_id && !isMultiSelected;
      const isSelected = isMultiSelected || isSingleSelected;
      
      if (isSelected) {
        // Different selection indicators for different shapes
        if (equipment.type === 'shelving') {
          // For rectangles, use a rectangular selection
          const rectWidth = equipment.config?.width || style.size * 2;
          const rectHeight = equipment.config?.height || style.size / 2;
          
          // Outer glow for selection
          equipGroup.append('rect')
            .attr('x', -rectWidth / 2 - 8)
            .attr('y', -rectHeight / 2 - 8)
            .attr('width', rectWidth + 16)
            .attr('height', rectHeight + 16)
            .attr('rx', 4)
            .style('fill', 'rgba(16, 185, 129, 0.1)')
            .style('stroke', 'none');
          
          // Selection ring
          equipGroup.append('rect')
            .attr('x', -rectWidth / 2 - 6)
            .attr('y', -rectHeight / 2 - 6)
            .attr('width', rectWidth + 12)
            .attr('height', rectHeight + 12)
            .attr('rx', 4)
            .style('fill', 'none')
            .style('stroke', '#10B981')
            .style('stroke-width', '3px')
            .style('stroke-dasharray', '4,2')
            .style('animation', 'pulse 1s infinite');
        } else {
          // Circular selection for other equipment
          // Outer glow for selection
          equipGroup.append('circle')
            .attr('r', style.size + 12)
            .style('fill', 'rgba(16, 185, 129, 0.1)')
            .style('stroke', 'none');
          
          // Selection ring
          equipGroup.append('circle')
            .attr('r', style.size + 8)
            .style('fill', 'none')
            .style('stroke', '#10B981')
            .style('stroke-width', '3px')
            .style('stroke-dasharray', '4,2')
            .style('animation', 'pulse 1s infinite');
        }
      }

      // Prevent default drag behavior
      equipGroup.style('user-select', 'none');
      
      // Apply rotation if equipment has rotation config
      const rotation = equipment.config?.rotation || 0;
      if (rotation !== 0) {
        equipGroup.attr('transform', 
          `translate(${scaleX(equipX)}, ${scaleY(equipY)}) rotate(${rotation})`
        );
      }
      
      // Draw equipment shape
      if (style.shape === 'circle') {
        equipGroup.append('circle')
          .attr('r', style.size)
          .style('fill', isAtOrigin ? '#FCA5A5' : style.color)
          .style('stroke', '#1F2937')
          .style('stroke-width', '2px');
          
        // Add airflow vector for fans
        if (equipment.type === 'fan' && equipment.config) {
          const cfm = equipment.config.magnitude_cfm || 1000;
          const direction = equipment.config.direction || 0;
          const activePercent = equipment.config.percentage_of_time_blowing || 100;
          
          // Calculate vector length based on CFM (scale: 1000 CFM = 30 pixels)
          const vectorLength = (cfm / 1000) * 30;
          
          // Calculate end point of vector
          const angleRad = (direction * Math.PI) / 180;
          const endX = Math.cos(angleRad) * vectorLength;
          const endY = Math.sin(angleRad) * vectorLength;
          
          // Create airflow vector group
          const airflowGroup = equipGroup.append('g')
            .attr('class', 'airflow-vector')
            .style('opacity', activePercent / 100);
          
          // Draw vector arrow
          airflowGroup.append('line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', endX)
            .attr('y2', endY)
            .style('stroke', '#3B82F6')
            .style('stroke-width', '3px')
            .style('stroke-linecap', 'round');
          
          // Add arrowhead
          const arrowSize = 8;
          const arrowAngle = 30 * Math.PI / 180; // 30 degrees
          
          // Calculate arrowhead points
          const arrowPoint1X = endX - arrowSize * Math.cos(angleRad - arrowAngle);
          const arrowPoint1Y = endY - arrowSize * Math.sin(angleRad - arrowAngle);
          const arrowPoint2X = endX - arrowSize * Math.cos(angleRad + arrowAngle);
          const arrowPoint2Y = endY - arrowSize * Math.sin(angleRad + arrowAngle);
          
          airflowGroup.append('path')
            .attr('d', `M ${arrowPoint1X},${arrowPoint1Y} L ${endX},${endY} L ${arrowPoint2X},${arrowPoint2Y}`)
            .style('stroke', '#3B82F6')
            .style('stroke-width', '3px')
            .style('stroke-linecap', 'round')
            .style('stroke-linejoin', 'round')
            .style('fill', 'none');
          
          // Add CFM label if selected
          if (isSelected) {
            airflowGroup.append('text')
              .attr('x', endX / 2)
              .attr('y', endY / 2 - 5)
              .attr('text-anchor', 'middle')
              .style('font-size', '10px')
              .style('font-weight', 'bold')
              .style('fill', '#3B82F6')
              .text(`${cfm} CFM`);
          }
        }
      } else if (style.shape === 'rect') {
        let rectWidth = style.size;
        let rectHeight = style.size;
        
        // For shelving, use custom dimensions from config if available
        if (equipment.type === 'shelving') {
          // Get dimensions in facility units (feet)
          const widthFt = equipment.config?.width || 40;
          const heightFt = equipment.config?.height || 20;
          const rotation = equipment.config?.rotation || 0;
          
          console.log('[SHELVING RENDER CHECK]', {
            equipment_id: equipment.equipment_id,
            storedDimensions: { width: widthFt, height: heightFt },
            rotation: rotation,
            renderNote: "Rect is drawn with stored dimensions, then rotated by SVG transform"
          });
          
          // Convert to pixel dimensions using scale
          rectWidth = scaleX(widthFt) - scaleX(0);
          rectHeight = scaleY(heightFt) - scaleY(0);
          
          // Main shelving rectangle with lighter fill
          const rect = equipGroup.append('rect')
            .attr('x', -rectWidth / 2)
            .attr('y', -rectHeight / 2)
            .attr('width', rectWidth)
            .attr('height', rectHeight)
            .style('fill', isAtOrigin ? '#FCA5A5' : '#E5E7EB')
            .style('stroke', '#4B5563')
            .style('stroke-width', '2px');
            
          // Debug the actual visual bounds after rotation
          if (rotation === 90 || rotation === 270) {
            console.log('[SHELVING VISUAL BOUNDS]', {
              equipment_id: equipment.equipment_id,
              rectDimensions: { width: rectWidth, height: rectHeight },
              rectPosition: { x: -rectWidth/2, y: -rectHeight/2 },
              rotation: rotation,
              centerPosition: { x: equipment.x, y: equipment.y },
              NOTE: "SVG rotation transforms the rect, so visual bounds after rotation are different",
              rectPixelDimensions: { 
                widthPx: rectWidth, 
                heightPx: rectHeight,
                widthFt: widthFt,
                heightFt: heightFt
              },
              scaleFactors: {
                xScale: `${rectWidth}px for ${widthFt}ft`,
                yScale: `${rectHeight}px for ${heightFt}ft`
              }
            });
          }
          
          // Draw shelf lines based on shelf_count
          const shelfCount = equipment.config?.shelf_count || 4;
          const shelfSpacing = rectHeight / shelfCount;
          
          for (let i = 1; i < shelfCount; i++) {
            equipGroup.append('line')
              .attr('x1', -rectWidth / 2 + 2)
              .attr('y1', -rectHeight / 2 + (i * shelfSpacing))
              .attr('x2', rectWidth / 2 - 2)
              .attr('y2', -rectHeight / 2 + (i * shelfSpacing))
              .style('stroke', '#6B7280')
              .style('stroke-width', '1px');
          }
          
          // Add debug visualization for shelving boundaries
          if (equipment.type === 'shelving' && showDebugBoundaries) {
            const rotation = equipment.config?.rotation || 0;
            const widthFt = equipment.config?.width || 40;
            const heightFt = equipment.config?.height || 20;
            
            // Log actual dimensions being used
            console.log('[SHELVING DIMENSIONS CHECK - RENDER TIME]', {
              equipment_id: equipment.equipment_id,
              storedDims: { width: equipment.config?.width, height: equipment.config?.height },
              rotation: rotation,
              visualAppearance: {
                at0or180: { width: widthFt, height: heightFt },
                at90or270: { width: heightFt, height: widthFt }
              },
              boundingBoxUsed: { halfWidth: boundingHalfWidth, halfHeight: boundingHalfHeight },
              CORE_ISSUE: "Bounding box correctly swaps, but visual expectation is different"
            });
            
            console.log('[SHELVING RENDER] Debug boundaries for:', equipment.equipment_id, {
              position: { x: equipment.x, y: equipment.y },
              dimensions: { width: widthFt, height: heightFt },
              rotation: rotation,
              edges: {
                left: equipment.x - boundingHalfWidth,
                right: equipment.x + boundingHalfWidth,
                top: equipment.y - boundingHalfHeight,
                bottom: equipment.y + boundingHalfHeight
              },
              visualCheck: {
                isFlushRight: Math.abs((equipment.x + boundingHalfWidth) - facilityWidth) < 0.01,
                isFlushLeft: Math.abs((equipment.x - boundingHalfWidth)) < 0.01,
                isFlushTop: Math.abs((equipment.y - boundingHalfHeight)) < 0.01,
                isFlushBottom: Math.abs((equipment.y + boundingHalfHeight) - facilityHeight) < 0.01
              }
            });
            
            // Calculate the actual bounding box of the rotated rectangle
            const halfWidth = widthFt / 2;
            const halfHeight = heightFt / 2;
            
            // For a rotated rectangle, the bounding box size depends on the rotation angle
            const angleRad = (rotation * Math.PI) / 180;
            const absCos = Math.abs(Math.cos(angleRad));
            const absSin = Math.abs(Math.sin(angleRad));
            
            // Calculate the half-extents of the axis-aligned bounding box
            const boundingHalfWidth = halfWidth * absCos + halfHeight * absSin;
            const boundingHalfHeight = halfWidth * absSin + halfHeight * absCos;
            
            // Calculate boundary box in facility coordinates
            const minX = equipment.x - boundingHalfWidth;
            const maxX = equipment.x + boundingHalfWidth;
            const minY = equipment.y - boundingHalfHeight;
            const maxY = equipment.y + boundingHalfHeight;
            
            // Add boundary visualization to debug group
            const boundaryGroup = debugGroup.append('g')
              .attr('class', `debug-boundary-${equipment.equipment_id}`);
            
            // Draw the actual rotated shelving boundary (what the drag logic sees)
            const debugShelving = boundaryGroup.append('g')
              .attr('transform', `translate(${scaleX(equipment.x)}, ${scaleY(equipment.y)}) rotate(${rotation})`);
            
            debugShelving.append('rect')
              .attr('x', -scaleX(widthFt/2) + scaleX(0))
              .attr('y', -scaleY(heightFt/2) + scaleY(0))
              .attr('width', scaleX(widthFt) - scaleX(0))
              .attr('height', scaleY(heightFt) - scaleY(0))
              .style('fill', 'none')
              .style('stroke', '#00FF00')
              .style('stroke-width', '2px')
              .style('stroke-dasharray', '5,5');
            
            // Also draw the effective boundary after rotation (what collision detection uses)
            boundaryGroup.append('rect')
              .attr('x', scaleX(minX))
              .attr('y', scaleY(minY))
              .attr('width', scaleX(maxX) - scaleX(minX))
              .attr('height', scaleY(maxY) - scaleY(minY))
              .style('fill', 'none')
              .style('stroke', '#FF0000')
              .style('stroke-width', '2px')
              .style('stroke-dasharray', '5,5');
            
            // Add debug text
            boundaryGroup.append('text')
              .attr('x', scaleX(equipment.x))
              .attr('y', scaleY(minY) - 10)
              .attr('text-anchor', 'middle')
              .style('font-size', '10px')
              .style('fill', '#FF0000')
              .style('font-weight', 'bold')
              .text(`${equipment.label} R:${rotation}° ${widthFt.toFixed(0)}x${heightFt.toFixed(0)} → BB:${(boundingHalfWidth*2).toFixed(0)}x${(boundingHalfHeight*2).toFixed(0)}`);
            
            // Add legend
            const legendY = scaleY(0) + 20;
            boundaryGroup.append('text')
              .attr('x', scaleX(facilityWidth) - 100)
              .attr('y', legendY)
              .style('font-size', '10px')
              .style('fill', '#00FF00')
              .text('Green: Actual shape');
            
            boundaryGroup.append('text')
              .attr('x', scaleX(facilityWidth) - 100)
              .attr('y', legendY + 15)
              .style('font-size', '10px')
              .style('fill', '#FF0000')
              .text('Red: Collision boundary');
            
            // Show boundary violations
            if (minX < 0 || maxX > facilityWidth || minY < 0 || maxY > facilityHeight) {
              boundaryGroup.append('text')
                .attr('x', scaleX(equipment.x))
                .attr('y', scaleY(maxY) + 15)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', '#FF0000')
                .style('font-weight', 'bold')
                .text(`BOUNDS: X[${minX.toFixed(1)},${maxX.toFixed(1)}] Y[${minY.toFixed(1)},${maxY.toFixed(1)}]`);
            }
          }
          
          // Add small circles at corners to indicate it's resizable when selected
          if (isSelected && equipment.type === 'shelving') {
            const handleSize = 5;
            const handlePositions = [
              { x: -rectWidth / 2, y: -rectHeight / 2 }, // 0: Top-left corner
              { x: rectWidth / 2, y: -rectHeight / 2 },  // 1: Top-right corner
              { x: -rectWidth / 2, y: rectHeight / 2 },  // 2: Bottom-left corner
              { x: rectWidth / 2, y: rectHeight / 2 },   // 3: Bottom-right corner
              { x: 0, y: -rectHeight / 2 },              // 4: Top edge middle
              { x: rectWidth / 2, y: 0 },                // 5: Right edge middle
              { x: 0, y: rectHeight / 2 },               // 6: Bottom edge middle
              { x: -rectWidth / 2, y: 0 }                // 7: Left edge middle
            ];
            
            // Add rotation handle at the top
            const rotateHandle = equipGroup.append('g')
              .attr('class', 'rotate-handle')
              .style('cursor', 'grab');
            
            // Line from center to rotation handle
            rotateHandle.append('line')
              .attr('x1', 0)
              .attr('y1', -rectHeight / 2)
              .attr('x2', 0)
              .attr('y2', -rectHeight / 2 - 20)
              .style('stroke', '#10B981')
              .style('stroke-width', '2px');
            
            // Rotation handle circle
            const rotateCircle = rotateHandle.append('circle')
              .attr('cx', 0)
              .attr('cy', -rectHeight / 2 - 20)
              .attr('r', 6)
              .style('fill', '#10B981')
              .style('stroke', '#065F46')
              .style('stroke-width', '2px')
              .style('cursor', 'grab');
            
            // Add rotation behavior
            rotateCircle.on('mousedown', function(event) {
              event.stopPropagation();
              event.preventDefault();
              
              const centerX = scaleX(equipment.x);
              const centerY = scaleY(equipment.y);
              
              const handleRotationMove = (moveEvent: MouseEvent) => {
                const [mouseX, mouseY] = d3.pointer(moveEvent, svg.node());
                
                // Calculate angle from center to mouse
                const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * 180 / Math.PI + 90;
                
                // Snap to 45-degree increments
                const snappedAngle = Math.round(angle / 45) * 45;
                const normalizedAngle = ((snappedAngle % 360) + 360) % 360;
                
                // Update equipment rotation
                if (onEquipmentUpdate) {
                  const updatedEquipment = facilityData.equipment.map(eq =>
                    eq.equipment_id === currentEquipment.equipment_id
                      ? { ...eq, config: { ...eq.config, rotation: normalizedAngle } }
                      : eq
                  );
                  onEquipmentUpdate(updatedEquipment);
                }
              };
              
              const handleRotationEnd = () => {
                svg.on('mousemove.rotate', null);
                svg.on('mouseup.rotate', null);
                svg.on('mouseleave.rotate', null);
              };
              
              svg.on('mousemove.rotate', handleRotationMove);
              svg.on('mouseup.rotate', handleRotationEnd);
              svg.on('mouseleave.rotate', handleRotationEnd);
            });
            
            handlePositions.forEach((pos, index) => {
              const handle = equipGroup.append('circle')
                .attr('class', `resize-handle resize-handle-${index}`)
                .attr('cx', pos.x)
                .attr('cy', pos.y)
                .attr('r', handleSize)
                .style('fill', '#10B981')
                .style('stroke', '#065F46')
                .style('stroke-width', '1px')
                .style('cursor', () => {
                  const rotation = equipment.config?.rotation || 0;
                  
                  // Adjust cursor based on rotation
                  if (rotation === 0) {
                    if (index === 0 || index === 3) return 'nwse-resize';
                    if (index === 1 || index === 2) return 'nesw-resize';
                    if (index === 4 || index === 6) return 'ns-resize'; // Top/bottom
                    if (index === 5 || index === 7) return 'ew-resize'; // Left/right
                  } else if (rotation === 90) {
                    if (index === 0 || index === 3) return 'nesw-resize';
                    if (index === 1 || index === 2) return 'nwse-resize';
                    if (index === 4 || index === 6) return 'ew-resize'; // Top/bottom
                    if (index === 5 || index === 7) return 'ns-resize'; // Left/right
                  } else if (rotation === 180) {
                    if (index === 0 || index === 3) return 'nwse-resize';
                    if (index === 1 || index === 2) return 'nesw-resize';
                    if (index === 4 || index === 6) return 'ns-resize'; // Top/bottom
                    if (index === 5 || index === 7) return 'ew-resize'; // Left/right
                  } else if (rotation === 270) {
                    if (index === 0 || index === 3) return 'nesw-resize';
                    if (index === 1 || index === 2) return 'nwse-resize';
                    if (index === 4 || index === 6) return 'ew-resize'; // Top/bottom
                    if (index === 5 || index === 7) return 'ns-resize'; // Left/right
                  }
                  return 'pointer';
                })
                .style('pointer-events', 'all');
              
              // Add resize behavior to handles
              handle.on('mousedown', function(event) {
                event.stopPropagation();
                event.preventDefault();
                
                // Capture initial values locally to avoid closure issues
                const startWidth = equipment.config?.width || 40;
                const startHeight = equipment.config?.height || 20;
                const startX = equipment.x;
                const startY = equipment.y;
                const [startMouseX, startMouseY] = d3.pointer(event, svg.node());
                
                // Start resize mode
                setIsResizing(true);
                setResizingEquipment(currentEquipment);
                setResizeHandle(index);
                
                // Add temporary resize handlers to SVG
                const handleResizeMove = (moveEvent: MouseEvent) => {
                  const [currentX, currentY] = d3.pointer(moveEvent, svg.node());
                  const deltaX = scaleX.invert(currentX) - scaleX.invert(startMouseX);
                  const deltaY = scaleY.invert(currentY) - scaleY.invert(startMouseY);
                  
                  // Account for rotation - transform deltas to local space
                  const rotation = currentEquipment.config?.rotation || 0;
                  const angleRad = (rotation * Math.PI) / 180;
                  const cos = Math.cos(angleRad);
                  const sin = Math.sin(angleRad);
                  
                  // Transform mouse delta to local coordinates
                  const localDeltaX = deltaX * cos + deltaY * sin;
                  const localDeltaY = -deltaX * sin + deltaY * cos;
                  
                  let newWidth = startWidth;
                  let newHeight = startHeight;
                  let newX = startX;
                  let newY = startY;
                  
                  // Update dimensions and position based on which handle is being dragged
                  // Use local deltas for correct behavior with rotation
                  switch (index) {
                    case 0: // Top-left - moves position and changes size
                      newWidth = Math.max(1, startWidth - localDeltaX);
                      newHeight = Math.max(1, startHeight - localDeltaY);
                      // Move position in world space
                      newX = startX + deltaX / 2;
                      newY = startY + deltaY / 2;
                      break;
                    case 1: // Top-right - only moves Y position
                      newWidth = Math.max(1, startWidth + localDeltaX);
                      newHeight = Math.max(1, startHeight - localDeltaY);
                      // Move position in world space
                      newX = startX + deltaX / 2;
                      newY = startY + deltaY / 2;
                      break;
                    case 2: // Bottom-left - only moves X position
                      newWidth = Math.max(1, startWidth - localDeltaX);
                      newHeight = Math.max(1, startHeight + localDeltaY);
                      // Move position in world space
                      newX = startX + deltaX / 2;
                      newY = startY + deltaY / 2;
                      break;
                    case 3: // Bottom-right - no position change
                      newWidth = Math.max(1, startWidth + localDeltaX);
                      newHeight = Math.max(1, startHeight + localDeltaY);
                      // Move position in world space
                      newX = startX + deltaX / 2;
                      newY = startY + deltaY / 2;
                      break;
                    case 4: // Top edge (middle)
                      newHeight = Math.max(1, startHeight - localDeltaY);
                      newY = startY + deltaY / 2;
                      break;
                    case 5: // Right edge (middle)
                      newWidth = Math.max(1, startWidth + localDeltaX);
                      newX = startX + deltaX / 2;
                      break;
                    case 6: // Bottom edge (middle)
                      newHeight = Math.max(1, startHeight + localDeltaY);
                      newY = startY + deltaY / 2;
                      break;
                    case 7: // Left edge (middle)
                      newWidth = Math.max(1, startWidth - localDeltaX);
                      newX = startX + deltaX / 2;
                      break;
                  }
                  
                  // Snap dimensions to grid
                  newWidth = Math.round(newWidth);
                  newHeight = Math.round(newHeight);
                  
                  // Calculate effective dimensions for bounds checking
                  const isRotated90or270 = rotation === 90 || rotation === 270;
                  const effectiveWidth = isRotated90or270 ? newHeight : newWidth;
                  const effectiveHeight = isRotated90or270 ? newWidth : newHeight;
                  
                  // Ensure within facility bounds
                  const halfEffectiveWidth = effectiveWidth / 2;
                  const halfEffectiveHeight = effectiveHeight / 2;
                  if (newX - halfEffectiveWidth < 0 || newX + halfEffectiveWidth > facilityWidth ||
                      newY - halfEffectiveHeight < 0 || newY + halfEffectiveHeight > facilityHeight) {
                    return; // Don't update if it would go out of bounds
                  }
                  
                  // Update equipment dimensions and position
                  if (onEquipmentUpdate) {
                    const updatedEquipment = facilityData.equipment.map(eq =>
                      eq.equipment_id === currentEquipment.equipment_id
                        ? { ...eq, x: newX, y: newY, config: { ...eq.config, width: newWidth, height: newHeight } }
                        : eq
                    );
                    onEquipmentUpdate(updatedEquipment);
                  }
                };
                
                const handleResizeEnd = () => {
                  setIsResizing(false);
                  setResizingEquipment(null);
                  setResizeHandle(null);
                  svg.on('mousemove.resize', null);
                  svg.on('mouseup.resize', null);
                  svg.on('mouseleave.resize', null);
                };
                
                svg.on('mousemove.resize', handleResizeMove);
                svg.on('mouseup.resize', handleResizeEnd);
                svg.on('mouseleave.resize', handleResizeEnd);
              });
            });
          }
        } else {
          // Regular rectangle for doors
          equipGroup.append('rect')
            .attr('x', -rectWidth / 2)
            .attr('y', -rectHeight / 2)
            .attr('width', rectWidth)
            .attr('height', rectHeight)
            .style('fill', isAtOrigin ? '#FCA5A5' : style.color)
            .style('stroke', '#1F2937')
            .style('stroke-width', '2px');
        }
      } else if (style.shape === 'triangle') {
        const trianglePoints = [
          [0, -style.size],
          [-style.size * 0.866, style.size / 2],
          [style.size * 0.866, style.size / 2]
        ];
        
        equipGroup.append('polygon')
          .attr('points', trianglePoints.map(p => p.join(',')).join(' '))
          .style('fill', isAtOrigin ? '#FCA5A5' : style.color)
          .style('stroke', '#1F2937')
          .style('stroke-width', '2px');
      } else if (style.shape === 'diamond') {
        const diamondPoints = [
          [0, -style.size],
          [style.size, 0],
          [0, style.size],
          [-style.size, 0]
        ];
        
        equipGroup.append('polygon')
          .attr('points', diamondPoints.map(p => p.join(',')).join(' '))
          .style('fill', isAtOrigin ? '#FCA5A5' : style.color)
          .style('stroke', '#1F2937')
          .style('stroke-width', '2px');
      }

      // Add label with positioning and editing support
      const labelPosition = labelPositions[equipment.equipment_id] || equipment.config?.labelPosition || 'bottom';
      let labelX = 0, labelY = 0;
      let textAnchor = 'middle';
      
      // Calculate label position based on stored position
      // For rotated equipment, we need to adjust positions
      const equipmentRotation = equipment.config?.rotation || 0;
      const isRotated90or270 = equipmentRotation === 90 || equipmentRotation === 270;
      
      // Get dimensions based on rotation
      let effectiveWidth, effectiveHeight;
      
      if (equipment.type === 'shelving') {
        // For shelving, use scaled dimensions
        const widthFt = equipment.config?.width || 40;
        const heightFt = equipment.config?.height || 20;
        const scaledWidth = scaleX(widthFt) - scaleX(0);
        const scaledHeight = scaleY(heightFt) - scaleY(0);
        
        effectiveWidth = isRotated90or270 ? scaledHeight : scaledWidth;
        effectiveHeight = isRotated90or270 ? scaledWidth : scaledHeight;
      } else {
        // For other equipment, use the default size
        effectiveWidth = style.size;
        effectiveHeight = style.size;
      }
      
      // Increase label spacing for better selection
      const labelPadding = 20; // Increased from 5-15 to 20px
      
      switch (labelPosition) {
        case 'center':
          labelX = 0;
          labelY = 0;
          break;
        case 'top':
          labelX = 0;
          labelY = -(effectiveHeight / 2 || 15) - labelPadding;
          break;
        case 'bottom':
          labelX = 0;
          labelY = (effectiveHeight / 2 || 15) + labelPadding;
          break;
        case 'left':
          labelX = -(effectiveWidth / 2 || 15) - labelPadding;
          labelY = 0;
          textAnchor = 'end';
          break;
        case 'right':
          labelX = (effectiveWidth / 2 || 15) + labelPadding;
          labelY = 0;
          textAnchor = 'start';
          break;
        default:
          labelX = 0;
          labelY = (effectiveHeight / 2 || 15) + labelPadding;
      }
      
      // Create label group for interaction
      // Apply counter-rotation to keep text upright
      const labelGroup = equipGroup.append('g')
        .attr('class', 'label-group')
        .attr('transform', `translate(${labelX}, ${labelY}) rotate(${-equipmentRotation})`)
        .style('cursor', 'move');
      
      // Add selection rectangle if selected (with larger hit area)
      if (selectedLabelId === equipment.equipment_id) {
        labelGroup.append('rect')
          .attr('class', 'label-selection')
          .attr('x', textAnchor === 'middle' ? -40 : (textAnchor === 'start' ? -5 : -75))
          .attr('y', -15)
          .attr('width', 80)
          .attr('height', 30)
          .attr('rx', 2)
          .style('fill', 'none')
          .style('stroke', '#000')
          .style('stroke-width', '1px')
          .style('stroke-dasharray', '2,2');
      }
      
      // Add label text (removed editing functionality)
      const labelText = labelGroup.append('text')
        .attr('text-anchor', textAnchor)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#1F2937')
        .style('user-select', 'none')
        .text(equipment.label);
      
      // Add label interaction handlers
      labelGroup
        .on('click', function(event) {
          event.stopPropagation();
          setSelectedLabelId(equipment.equipment_id);
        })
        .on('mousedown', function(event) {
          if (selectedLabelId === equipment.equipment_id) {
            event.stopPropagation();
            event.preventDefault();
            
            // Start label position dragging
            const [startX, startY] = d3.pointer(event, svg.node());
            
            const handleLabelDrag = (dragEvent: MouseEvent) => {
              const [currentX, currentY] = d3.pointer(dragEvent, svg.node());
              const dx = currentX - startX;
              const dy = currentY - startY;
              
              // Determine new position based on drag direction
              let newPosition = labelPosition;
              
              // Calculate relative position to equipment center
              const relX = scaleX.invert(currentX) - equipment.x;
              const relY = scaleY.invert(currentY) - equipment.y;
              
              const threshold = style.size || 20;
              
              if (Math.abs(relX) < threshold / 3 && Math.abs(relY) < threshold / 3) {
                newPosition = 'center';
              } else if (relY < -threshold / 2) {
                newPosition = 'top';
              } else if (relY > threshold / 2) {
                newPosition = 'bottom';
              } else if (relX < -threshold / 2) {
                newPosition = 'left';
              } else if (relX > threshold / 2) {
                newPosition = 'right';
              }
              
              if (newPosition !== labelPosition) {
                setLabelPositions(prev => ({
                  ...prev,
                  [equipment.equipment_id]: newPosition
                }));
                
                // Also update the equipment config to persist the position
                if (onEquipmentUpdate) {
                  const updatedEquipment = facilityData.equipment.map(eq =>
                    eq.equipment_id === equipment.equipment_id
                      ? { ...eq, config: { ...eq.config, labelPosition: newPosition } }
                      : eq
                  );
                  onEquipmentUpdate(updatedEquipment);
                }
              }
            };
            
            const handleLabelDragEnd = () => {
              svg.on('mousemove.label', null);
              svg.on('mouseup.label', null);
            };
            
            svg.on('mousemove.label', handleLabelDrag);
            svg.on('mouseup.label', handleLabelDragEnd);
          }
        });
      
      // Show dimensions if this is shelving being resized
      if (equipment.type === 'shelving' && isResizing && resizingEquipment?.equipment_id === equipment.equipment_id) {
        const currentWidth = equipment.config?.width || 40;
        const currentHeight = equipment.config?.height || 20;
        
        equipGroup.append('text')
          .attr('y', -(currentHeight / 2) - 10)
          .attr('text-anchor', 'middle')
          .style('font-size', '11px')
          .style('font-weight', 'bold')
          .style('fill', '#10B981')
          .style('background', 'white')
          .text(`${currentWidth.toFixed(0)}'×${currentHeight.toFixed(0)}'`);
      }

      // Add coordinates for items at origin (but not when ghost dragging)
      if (isAtOrigin && !isGhostDragging) {
        equipGroup.append('text')
          .attr('y', style.size + 30)
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('fill', '#EF4444')
          .text('(0, 0)');
      }

      // Create drag behavior for this equipment
      const currentEquipment = equipment; // Capture in closure
      let isDraggingThis = false;
      let isMultiDraggingThis = false; // Local flag to track multi-drag state
      let dragStartPos = { x: 0, y: 0 };
      let localMultiDragStartPositions: Map<string, {x: number, y: number}> | null = null;
      let localSelectedIds: string[] = []; // Store selected IDs at drag start
      
      // Handle all mouse interactions manually to control drag vs click behavior
      equipGroup
        .on('mousedown', function(event) {
          event.stopPropagation();
          
          // Ignore right-click events for dragging
          if (event.button === 2) {
            return;
          }
          
          // Disable normal drag if ghost dragging or resizing
          if (isGhostDragging || isResizing) {
            return;
          }
          
          // Store start position
          const [mouseX, mouseY] = d3.pointer(event, svg.node());
          dragStartPos = { x: mouseX, y: mouseY };
          dragStartPosRef.current = dragStartPos;
          
          // Prepare for potential drag
          isDraggingThis = false;
          isMultiDraggingThis = false;
          hasDraggedRef.current = false;
          
          // Check if this is part of a multi-selection
          const isInMultiSelection = selectedEquipmentIds.includes(currentEquipment.equipment_id);
          
          // Handle shift+click for adding to selection
          if (event.shiftKey) {
            const newSelection = [...selectedEquipmentIds];
            if (isInMultiSelection) {
              // Remove from selection
              const index = newSelection.indexOf(currentEquipment.equipment_id);
              if (index > -1) newSelection.splice(index, 1);
            } else {
              // Add to selection
              newSelection.push(currentEquipment.equipment_id);
            }
            setSelectedEquipmentIds(newSelection);
            return;
          }
          
          // If clicking on a non-selected item without shift, clear selection
          if (!isInMultiSelection && selectedEquipmentIds.length > 0) {
            setSelectedEquipmentIds([]);
          }
          
          // Set up mousemove handler on the SVG
          const handleMouseMove = (moveEvent: MouseEvent) => {
            const [currentX, currentY] = d3.pointer(moveEvent, svg.node());
            const distance = Math.sqrt(
              Math.pow(currentX - dragStartPos.x, 2) + 
              Math.pow(currentY - dragStartPos.y, 2)
            );
            
            if (!isDraggingThis && distance > 0) {
            }
            
            // Start dragging if moved more than 5 pixels
            if (distance > 5 && !isDraggingThis) {
              isDraggingThis = true;
              hasDraggedRef.current = true;
              
              // Check if dragging multiple items
              const isInMultiSelection = selectedEquipmentIds.includes(currentEquipment.equipment_id);
              if (isInMultiSelection && selectedEquipmentIds.length > 1) {
                // Multi-drag mode
                isMultiDraggingThis = true; // Set local flag
                localSelectedIds = [...selectedEquipmentIds]; // Capture current selection
                setIsMultiDragging(true);
                // Store initial positions of all selected items
                const positions = new Map<string, {x: number, y: number}>();
                facilityData.equipment.forEach(eq => {
                  if (localSelectedIds.includes(eq.equipment_id)) {
                    positions.set(eq.equipment_id, { x: eq.x, y: eq.y });
                  }
                });
                localMultiDragStartPositions = positions; // Store locally
                setMultiDragStartPositions(positions);
                setDraggedEquipment(currentEquipment); // Track which item initiated the drag
                // Update cursor for all selected items
                equipmentGroup.selectAll('g').each(function() {
                  const g = d3.select(this);
                  const eqId = g.datum() as any;
                  if (localSelectedIds.includes(eqId)) {
                    g.style('cursor', 'grabbing');
                  }
                });
              } else {
                // Single drag mode - if not in selection, clear selection and drag only this item
                if (!isInMultiSelection) {
                  setSelectedEquipmentIds([]);
                }
                setDraggedEquipment(currentEquipment);
                setIsDragging(true);
                d3.select(equipGroup.node()).raise().style('cursor', 'grabbing');
              }
            }
            
            // Continue dragging
            if (isDraggingThis && onEquipmentUpdate) {
              const deltaX = scaleX.invert(currentX) - scaleX.invert(dragStartPos.x);
              const deltaY = scaleY.invert(currentY) - scaleY.invert(dragStartPos.y);
              
              
              if (isMultiDraggingThis && localSelectedIds.length > 1 && localMultiDragStartPositions) {
                
                // Calculate proposed positions for all selected items
                const proposedPositions = new Map<string, {x: number, y: number, canMove: boolean}>();
                const itemsToRemoveFromSelection: string[] = [];
                
                localSelectedIds.forEach(eqId => {
                  // Get fresh equipment data to ensure we have latest dimensions
                  const eq = facilityData.equipment.find(e => e.equipment_id === eqId);
                  const startPos = localMultiDragStartPositions.get(eqId);
                  if (eq && startPos) {
                    let newX = startPos.x + deltaX;
                    let newY = startPos.y + deltaY;
                    
                    // Apply snapping
                    if (eq.type === 'door') {
                      const snapped = snapToPerimeter(newX, newY);
                      newX = snapped.x;
                      newY = snapped.y;
                    } else {
                      // For shelving, add edge snapping
                      if (eq.type === 'shelving' && eq.config) {
                        const widthFt = eq.config.width || 40;
                        const heightFt = eq.config.height || 20;
                        const rotation = eq.config.rotation || 0;
                        
                        console.log('[SHELVING DRAG] Multi-select drag:', eq.equipment_id, {
                          currentPos: { x: eq.x, y: eq.y },
                          newPos: { x: newX, y: newY },
                          dimensions: { width: widthFt, height: heightFt },
                          rotation: rotation
                        });
                        
                        // Calculate the actual bounding box of the rotated rectangle
                        const halfWidth = widthFt / 2;
                        const halfHeight = heightFt / 2;
                        
                        // For edge snapping, we need the bounding box dimensions
                        const angleRad = (rotation * Math.PI) / 180;
                        const absCos = Math.abs(Math.cos(angleRad));
                        const absSin = Math.abs(Math.sin(angleRad));
                        
                        const boundingHalfWidth = halfWidth * absCos + halfHeight * absSin;
                        const boundingHalfHeight = halfWidth * absSin + halfHeight * absCos;
                        
                        // Snap to grid first
                        newX = snapToGrid(newX);
                        newY = snapToGrid(newY);
                        
                        // Edge snapping for flush positioning
                        const edgeSnapThreshold = 0.5;
                        
                        if (Math.abs(newX - boundingHalfWidth) < edgeSnapThreshold) {
                          newX = boundingHalfWidth;
                        }
                        if (Math.abs(newX - (facilityWidth - boundingHalfWidth)) < edgeSnapThreshold) {
                          newX = facilityWidth - boundingHalfWidth;
                        }
                        if (Math.abs(newY - boundingHalfHeight) < edgeSnapThreshold) {
                          newY = boundingHalfHeight;
                        }
                        if (Math.abs(newY - (facilityHeight - boundingHalfHeight)) < edgeSnapThreshold) {
                          newY = facilityHeight - boundingHalfHeight;
                        }
                      } else {
                        newX = snapToGrid(newX);
                        newY = snapToGrid(newY);
                      }
                    }
                    
                    // Check if within bounds (accounting for current dimensions AND rotation)
                    let canMove = true;
                    if (eq.type === 'shelving' && eq.config) {
                      const widthFt = eq.config.width || 40;
                      const heightFt = eq.config.height || 20;
                      const rotation = eq.config.rotation || 0;
                      
                      console.log('[SHELVING BOUNDS CHECK] Multi-select bounds check:', eq.equipment_id);
                      
                      // Calculate the actual bounding box of the rotated rectangle
                      const halfWidth = widthFt / 2;
                      const halfHeight = heightFt / 2;
                      
                      // For a rotated rectangle, the bounding box size depends on the rotation angle
                      const angleRad = (rotation * Math.PI) / 180;
                      const absCos = Math.abs(Math.cos(angleRad));
                      const absSin = Math.abs(Math.sin(angleRad));
                      
                      // Calculate the half-extents of the axis-aligned bounding box
                      const boundingHalfWidth = halfWidth * absCos + halfHeight * absSin;
                      const boundingHalfHeight = halfWidth * absSin + halfHeight * absCos;
                      
                      console.log('[SHELVING BOUNDS CHECK] Calculated bounds:', {
                        boundingBox: { halfWidth: boundingHalfWidth, halfHeight: boundingHalfHeight },
                        bounds: {
                          left: newX - boundingHalfWidth,
                          right: newX + boundingHalfWidth,
                          top: newY - boundingHalfHeight,
                          bottom: newY + boundingHalfHeight
                        },
                        facility: { width: facilityWidth, height: facilityHeight },
                        rotation: rotation,
                        trigValues: { absCos, absSin }
                      });
                      
                      canMove = newX - boundingHalfWidth >= 0 && newX + boundingHalfWidth <= facilityWidth && 
                                newY - boundingHalfHeight >= 0 && newY + boundingHalfHeight <= facilityHeight;
                      
                      if (!canMove) {
                        console.log('[SHELVING BOUNDS CHECK] BLOCKED - Out of bounds!', {
                          violations: {
                            leftEdge: newX - boundingHalfWidth < 0 ? `${(newX - boundingHalfWidth).toFixed(2)} < 0` : 'OK',
                            rightEdge: newX + boundingHalfWidth > facilityWidth ? `${(newX + boundingHalfWidth).toFixed(2)} > ${facilityWidth}` : 'OK',
                            topEdge: newY - boundingHalfHeight < 0 ? `${(newY - boundingHalfHeight).toFixed(2)} < 0` : 'OK',
                            bottomEdge: newY + boundingHalfHeight > facilityHeight ? `${(newY + boundingHalfHeight).toFixed(2)} > ${facilityHeight}` : 'OK'
                          }
                        });
                      }
                      
                      // Debug logging for 0-degree rotation in multi-select
                      if (Math.abs(rotation) < 0.01 && !canMove && newX + boundingHalfWidth > facilityWidth) {
                        console.log('[SHELVING 0° MULTI-SELECT BOUNDS DEBUG]', {
                          equipment: eq.equipment_id,
                          dimensions: { width: widthFt, height: heightFt },
                          rotation: rotation,
                          boundingHalfWidth: boundingHalfWidth,
                          facilityWidth: facilityWidth,
                          maxAllowedX: facilityWidth - boundingHalfWidth,
                          attemptedX: newX,
                          rightEdgePosition: newX + boundingHalfWidth,
                          overshoot: (newX + boundingHalfWidth) - facilityWidth
                        });
                      }
                    } else {
                      canMove = newX >= 0 && newX <= facilityWidth && newY >= 0 && newY <= facilityHeight;
                    }
                    
                    if (!canMove) {
                      // This item hit a wall - remove it from selection
                      itemsToRemoveFromSelection.push(eqId);
                    }
                    
                    proposedPositions.set(eqId, { x: newX, y: newY, canMove });
                  }
                });
                
                // Update equipment positions for items that can move
                const updatedEquipment = facilityData.equipment.map(eq => {
                  if (localSelectedIds.includes(eq.equipment_id)) {
                    const proposed = proposedPositions.get(eq.equipment_id);
                    if (proposed && proposed.canMove) {
                      return { ...eq, x: proposed.x, y: proposed.y };
                    }
                  }
                  return eq;
                });
                
                onEquipmentUpdate(updatedEquipment);
                
                // Remove items that hit walls from selection
                if (itemsToRemoveFromSelection.length > 0) {
                  const newSelection = localSelectedIds.filter(id => !itemsToRemoveFromSelection.includes(id));
                  localSelectedIds = newSelection; // Update local copy
                  setSelectedEquipmentIds(newSelection);
                }
              } else {
                // Single item drag - calculate based on original position + delta
                let newX = currentEquipment.x + deltaX;
                let newY = currentEquipment.y + deltaY;
                
                // Apply snapping
                if (currentEquipment.type === 'door') {
                  const snapped = snapToPerimeter(newX, newY);
                  newX = snapped.x;
                  newY = snapped.y;
                } else {
                  // For shelving, snap to grid but also check for edge snapping
                  if (currentEquipment.type === 'shelving') {
                    // Get fresh equipment data to ensure we have latest rotation
                    const freshEquipment = facilityData.equipment.find(eq => eq.equipment_id === currentEquipment.equipment_id);
                    const widthFt = freshEquipment?.config?.width || currentEquipment.config?.width || 40;
                    const heightFt = freshEquipment?.config?.height || currentEquipment.config?.height || 20;
                    const rotation = freshEquipment?.config?.rotation || currentEquipment.config?.rotation || 0;
                    
                    // Debug logging for dimension source
                    if (Math.abs(rotation) < 0.01 && !hasDraggedRef.current) {
                      console.log('[SHELVING 0° DRAG START DEBUG]', {
                        equipment: currentEquipment.equipment_id,
                        freshConfigWidth: freshEquipment?.config?.width,
                        currentConfigWidth: currentEquipment.config?.width,
                        finalWidth: widthFt,
                        freshConfigHeight: freshEquipment?.config?.height,
                        currentConfigHeight: currentEquipment.config?.height,
                        finalHeight: heightFt,
                        rotation: rotation,
                        facilityWidth: facilityWidth
                      });
                    }
                    
                    // Log the source of rotation value
                    if (currentEquipment.type === 'shelving') {
                      console.log('[SHELVING ROTATION SOURCE]', {
                        equipment: currentEquipment.equipment_id,
                        freshRotation: freshEquipment?.config?.rotation,
                        currentRotation: currentEquipment.config?.rotation,
                        finalRotation: rotation,
                        freshEquipmentExists: !!freshEquipment
                      });
                      
                      // Also log dimensions at drag start
                      console.log('[SHELVING DRAG START DIMENSIONS]', {
                        equipment: currentEquipment.equipment_id,
                        configDimensions: {
                          width: currentEquipment.config?.width,
                          height: currentEquipment.config?.height
                        },
                        freshDimensions: {
                          width: freshEquipment?.config?.width,
                          height: freshEquipment?.config?.height
                        },
                        usedDimensions: {
                          width: widthFt,
                          height: heightFt
                        },
                        position: { x: currentEquipment.x, y: currentEquipment.y }
                      });
                    }
                    
                    // Removed drag logging to focus on rotation issue
                    
                    // Calculate the actual bounding box of the rotated rectangle
                    const halfWidth = widthFt / 2;
                    const halfHeight = heightFt / 2;
                    
                    // For edge snapping, we need the bounding box dimensions
                    const angleRad = (rotation * Math.PI) / 180;
                    const absCos = Math.abs(Math.cos(angleRad));
                    const absSin = Math.abs(Math.sin(angleRad));
                    
                    // This correctly calculates the axis-aligned bounding box
                    const boundingHalfWidth = halfWidth * absCos + halfHeight * absSin;
                    const boundingHalfHeight = halfWidth * absSin + halfHeight * absCos;
                    
                    // CRITICAL DEBUG: Check if calculation matches expected values
                    if (rotation === 270) {
                      const expectedHalfWidth = heightFt / 2;  // At 270°, visual width is the stored height
                      const expectedHalfHeight = widthFt / 2;  // At 270°, visual height is the stored width
                      console.log('[SHELVING 270° CALCULATION CHECK]', {
                        stored: { width: widthFt, height: heightFt },
                        halfValues: { halfWidth, halfHeight },
                        trig: { angleRad, cos: Math.cos(angleRad), sin: Math.sin(angleRad), absCos, absSin },
                        calculation: {
                          formula: 'boundingHalfWidth = halfWidth * absCos + halfHeight * absSin',
                          values: `${halfWidth} * ${absCos} + ${halfHeight} * ${absSin}`,
                          result: boundingHalfWidth
                        },
                        expected: { halfWidth: expectedHalfWidth, halfHeight: expectedHalfHeight },
                        matches: Math.abs(boundingHalfWidth - expectedHalfWidth) < 0.01
                      });
                    }
                    
                    // Debug for 90 and 270 degree rotations - FOCUSED ON THE REAL ISSUE
                    if (Math.abs(rotation - 90) < 0.01 || Math.abs(rotation - 270) < 0.01) {
                      console.log(`[SHELVING ${rotation}° VISUAL VS LOGICAL]`, {
                        equipment: currentEquipment.equipment_id,
                        STORED_DIMENSIONS: { width: widthFt, height: heightFt },
                        VISUAL_APPEARANCE: {
                          description: `At ${rotation}°, a ${widthFt}x${heightFt} shelving APPEARS as ${heightFt}x${widthFt}`,
                          visualWidth: heightFt,
                          visualHeight: widthFt
                        },
                        BOUNDING_BOX_CALC: {
                          formula: "halfWidth * |cos| + halfHeight * |sin|",
                          calculation: `${widthFt/2} * ${absCos} + ${heightFt/2} * ${absSin}`,
                          result: boundingHalfWidth,
                          isCorrect: Math.abs(boundingHalfWidth - heightFt/2) < 0.01
                        },
                        CONSTRAINT: {
                          maxCenterX: facilityWidth - boundingHalfWidth,
                          rightEdgeWhenCentered: (facilityWidth - boundingHalfWidth) + boundingHalfWidth,
                          shouldEqualFacilityWidth: true
                        }
                      });
                    }
                    
                    // Snap to grid first
                    newX = snapToGrid(newX);
                    newY = snapToGrid(newY);
                    
                    // Then check if we're close to edges and snap to them for flush positioning
                    const edgeSnapThreshold = 2; // Within 2 feet of edge for easier snapping
                    
                    // For shelving, we want to allow true flush positioning against walls
                    // Calculate the actual edges of the shelving unit
                    const leftEdge = newX - boundingHalfWidth;
                    const rightEdge = newX + boundingHalfWidth;
                    const topEdge = newY - boundingHalfHeight;
                    const bottomEdge = newY + boundingHalfHeight;
                    
                    // Debug edge calculations for rotated shelving
                    if (currentEquipment.type === 'shelving' && (rotation === 90 || rotation === 270)) {
                      console.log(`[SHELVING ${rotation}° EDGE CALC]`, {
                        equipment: currentEquipment.equipment_id,
                        center: { x: newX, y: newY },
                        boundingHalf: { width: boundingHalfWidth, height: boundingHalfHeight },
                        edges: { left: leftEdge, right: rightEdge, top: topEdge, bottom: bottomEdge },
                        facilityBounds: { width: facilityWidth, height: facilityHeight },
                        distanceToRightWall: facilityWidth - rightEdge,
                        wouldSnapRight: Math.abs(rightEdge - facilityWidth) < edgeSnapThreshold
                      });
                    }
                    
                    // Account for stroke widths in edge snapping
                    // Match the visual boundary buffer for consistent visual containment
                    const strokeAdjustment = visualBoundaryBuffer; // Use same buffer for edge snapping
                    
                    // Left wall - snap if left edge is close to 0
                    if (leftEdge < edgeSnapThreshold && leftEdge > -edgeSnapThreshold) {
                      newX = boundingHalfWidth + strokeAdjustment; // Slight inset for visual alignment
                      console.log('[SHELVING EDGE SNAP] Snapped to left wall');
                    }
                    // Right wall - snap if right edge is close to facility width
                    if (Math.abs(rightEdge - facilityWidth) < edgeSnapThreshold) {
                      newX = facilityWidth - boundingHalfWidth - strokeAdjustment; // Slight inset for visual alignment
                      console.log('[SHELVING EDGE SNAP] Snapped to right wall', {
                        rightEdge: rightEdge,
                        facilityWidth: facilityWidth,
                        threshold: edgeSnapThreshold,
                        newX: newX,
                        boundingHalfWidth: boundingHalfWidth,
                        rotation: rotation,
                        strokeAdjustment: strokeAdjustment,
                        visualNote: "Adjusted for stroke rendering to appear flush"
                      });
                    }
                    // Top wall - snap if top edge is close to 0
                    if (topEdge < edgeSnapThreshold && topEdge > -edgeSnapThreshold) {
                      newY = boundingHalfHeight + strokeAdjustment; // Slight inset for visual alignment
                      console.log('[SHELVING EDGE SNAP] Snapped to top wall');
                    }
                    // Bottom wall - snap if bottom edge is close to facility height
                    if (Math.abs(bottomEdge - facilityHeight) < edgeSnapThreshold) {
                      newY = facilityHeight - boundingHalfHeight - strokeAdjustment; // Slight inset for visual alignment
                      console.log('[SHELVING EDGE SNAP] Snapped to bottom wall');
                    }
                    
                    // Apply boundary clamping to prevent dragging outside facility
                    const originalNewX = newX;
                    const originalNewY = newY;
                    const maxAllowedX = facilityWidth - boundingHalfWidth - visualBoundaryBuffer;
                    const maxAllowedY = facilityHeight - boundingHalfHeight - visualBoundaryBuffer;
                    const minAllowedX = boundingHalfWidth + visualBoundaryBuffer;
                    const minAllowedY = boundingHalfHeight + visualBoundaryBuffer;
                    
                    // Check if position would cause visual overflow before clamping
                    const wouldVisuallyOverflow = {
                      top: newY - boundingHalfHeight < 0,
                      bottom: newY + boundingHalfHeight > facilityHeight,
                      left: newX - boundingHalfWidth < 0,
                      right: newX + boundingHalfWidth > facilityWidth
                    };
                    
                    if (Object.values(wouldVisuallyOverflow).some(v => v)) {
                      console.log('[VISUAL OVERFLOW PREVENTED]', {
                        equipment: currentEquipment.equipment_id,
                        position: { x: newX, y: newY },
                        bounds: {
                          halfWidth: boundingHalfWidth,
                          halfHeight: boundingHalfHeight
                        },
                        edges: {
                          top: newY - boundingHalfHeight,
                          bottom: newY + boundingHalfHeight,
                          left: newX - boundingHalfWidth,
                          right: newX + boundingHalfWidth
                        },
                        facility: { width: facilityWidth, height: facilityHeight },
                        wouldOverflow: wouldVisuallyOverflow,
                        visualBuffer: visualBoundaryBuffer
                      });
                    }
                    
                    // Clamp to ensure equipment stays within visual bounds
                    newX = Math.max(minAllowedX, Math.min(maxAllowedX, newX));
                    newY = Math.max(minAllowedY, Math.min(maxAllowedY, newY));
                    
                    // Special logging for 90/270 degree rotations to debug overflow
                    if ((rotation === 90 || rotation === 270) && (originalNewX !== newX || originalNewY !== newY)) {
                      console.log(`[SHELVING ${rotation}° CLAMPING ACTIVE]`, {
                        equipment: currentEquipment.equipment_id,
                        attempted: { x: originalNewX, y: originalNewY },
                        clamped: { x: newX, y: newY },
                        bounds: {
                          x: { min: boundingHalfWidth, max: maxAllowedX },
                          y: { min: boundingHalfHeight, max: maxAllowedY }
                        },
                        wouldOverflow: {
                          top: originalNewY < boundingHalfHeight,
                          bottom: originalNewY > maxAllowedY,
                          left: originalNewX < boundingHalfWidth,
                          right: originalNewX > maxAllowedX
                        },
                        DEBUG_VISUAL_VS_LOGICAL: {
                          msg: "At 270°, shelving appears tall and narrow",
                          visualWidth: heightFt,
                          visualHeight: widthFt,
                          centerX: newX,
                          rightEdgeX: newX + boundingHalfWidth,
                          spaceToRightWall: facilityWidth - (newX + boundingHalfWidth)
                        }
                      });
                    }
                    
                    // Log when X-axis clamping happens
                    if (originalNewX !== newX && currentEquipment.type === 'shelving') {
                      console.log('[SHELVING X-AXIS CLAMPED DURING DRAG]', {
                        equipment: currentEquipment.equipment_id,
                        attemptedX: originalNewX,
                        clampedX: newX,
                        maxAllowedX: maxAllowedX,
                        boundingHalfWidth: boundingHalfWidth,
                        facilityWidth: facilityWidth,
                        equipmentDimensions: { width: widthFt, height: heightFt },
                        rotation: rotation,
                        distanceFromRightEdge: facilityWidth - newX - boundingHalfWidth
                      });
                    }
                    
                    // Debug logging for 0-degree rotation
                    if (Math.abs(rotation) < 0.01 && originalNewX !== newX) {
                      console.log('[SHELVING 0° CLAMP DEBUG]', {
                        equipment: currentEquipment.equipment_id,
                        dimensions: { width: widthFt, height: heightFt },
                        rotation: rotation,
                        boundingHalfWidth: boundingHalfWidth,
                        facilityWidth: facilityWidth,
                        maxAllowedX: facilityWidth - boundingHalfWidth,
                        attemptedX: originalNewX,
                        clampedX: newX,
                        distanceFromRightWall: facilityWidth - newX
                      });
                    }
                  } else {
                    newX = snapToGrid(newX);
                    newY = snapToGrid(newY);
                  }
                }
                
                // Get fresh equipment data to ensure we have latest dimensions
                const freshEquipmentData = facilityData.equipment.find(eq => eq.equipment_id === currentEquipment.equipment_id);
                
                // Removed drag comparison logging to focus on rotation issue
                
                // Ensure within bounds (accounting for shelving dimensions AND rotation)
                if (freshEquipmentData && freshEquipmentData.type === 'shelving' && freshEquipmentData.config) {
                  const widthFt = freshEquipmentData.config.width || 40;
                  const heightFt = freshEquipmentData.config.height || 20;
                  const rotation = freshEquipmentData.config.rotation || 0;
                  
                  console.log('[SHELVING DRAG END] Final position check:', {
                    equipment: freshEquipmentData.equipment_id,
                    proposedPos: { x: newX, y: newY },
                    dimensions: { width: widthFt, height: heightFt },
                    rotation: rotation
                  });
                  
                  // Calculate the actual bounding box of the rotated rectangle
                  const halfWidth = widthFt / 2;
                  const halfHeight = heightFt / 2;
                  
                  // For a rotated rectangle, the bounding box size depends on the rotation angle
                  const angleRad = (rotation * Math.PI) / 180;
                  const absCos = Math.abs(Math.cos(angleRad));
                  const absSin = Math.abs(Math.sin(angleRad));
                  
                  // Calculate the half-extents of the axis-aligned bounding box
                  const boundingHalfWidth = halfWidth * absCos + halfHeight * absSin;
                  const boundingHalfHeight = halfWidth * absSin + halfHeight * absCos;
                  
                  // Debug the calculation for 90/270 degree cases
                  if (rotation === 90 || rotation === 270) {
                    console.log('[SHELVING BOUNDS CHECK AT DRAG END]', {
                      equipment: freshEquipmentData.equipment_id,
                      rotation: rotation,
                      originalDims: { width: widthFt, height: heightFt },
                      halfDims: { halfWidth, halfHeight },
                      trig: { absCos, absSin },
                      boundingHalf: { width: boundingHalfWidth, height: boundingHalfHeight },
                      position: { x: newX, y: newY },
                      wouldOverflow: {
                        top: newY - boundingHalfHeight < 0,
                        bottom: newY + boundingHalfHeight > facilityHeight,
                        left: newX - boundingHalfWidth < 0,
                        right: newX + boundingHalfWidth > facilityWidth
                      }
                    });
                  }
                  
                  // Add specific debug for 270 degree rotation case
                  if (Math.abs(rotation - 270) < 0.01) {
                    console.log('[SHELVING 270° DEBUG]', {
                      originalDimensions: { width: widthFt, height: heightFt },
                      halfDimensions: { halfWidth, halfHeight },
                      rotation: rotation,
                      angleRad: angleRad,
                      trigValues: { 
                        cos: Math.cos(angleRad), 
                        sin: Math.sin(angleRad),
                        absCos: absCos,
                        absSin: absSin
                      },
                      calculation: {
                        boundingHalfWidth_calc: `${halfWidth} * ${absCos} + ${halfHeight} * ${absSin} = ${boundingHalfWidth}`,
                        boundingHalfHeight_calc: `${halfWidth} * ${absSin} + ${halfHeight} * ${absCos} = ${boundingHalfHeight}`
                      },
                      expectedBounding: {
                        halfWidth: halfHeight, // Should be 10 for 270°
                        halfHeight: halfWidth  // Should be 20 for 270°
                      },
                      actualBounding: {
                        halfWidth: boundingHalfWidth,
                        halfHeight: boundingHalfHeight
                      },
                      maxX: facilityWidth - boundingHalfWidth,
                      currentX: newX
                    });
                  }
                  
                  const originalX = newX;
                  const originalY = newY;
                  
                  // Allow flush positioning with visual boundary buffer
                  const visualBuffer = visualBoundaryBuffer; // Match the buffer used during drag
                  newX = Math.max(boundingHalfWidth + visualBuffer, Math.min(facilityWidth - boundingHalfWidth - visualBuffer, newX));
                  newY = Math.max(boundingHalfHeight + visualBuffer, Math.min(facilityHeight - boundingHalfHeight - visualBuffer, newY));
                  
                  console.log('[SHELVING DRAG END] Bounds clamping:', {
                    equipment: freshEquipmentData.equipment_id,
                    rotation: rotation,
                    dimensions: { width: widthFt, height: heightFt },
                    halfDimensions: { halfWidth, halfHeight },
                    trigonometry: { 
                      angleRad: angleRad,
                      angleDeg: rotation,
                      cos: Math.cos(angleRad),
                      sin: Math.sin(angleRad),
                      absCos: absCos,
                      absSin: absSin
                    },
                    boundingBox: { halfWidth: boundingHalfWidth, halfHeight: boundingHalfHeight },
                    original: { x: originalX, y: originalY },
                    clamped: { x: newX, y: newY },
                    limits: {
                      x: [boundingHalfWidth, facilityWidth - boundingHalfWidth],
                      y: [boundingHalfHeight, facilityHeight - boundingHalfHeight]
                    },
                    facility: { width: facilityWidth, height: facilityHeight },
                    wasClamped: { x: originalX !== newX, y: originalY !== newY }
                  });
                } else {
                  newX = Math.max(0, Math.min(facilityWidth, newX));
                  newY = Math.max(0, Math.min(facilityHeight, newY));
                }
                
                // Update position
                d3.select(equipGroup.node()).attr('transform', `translate(${scaleX(newX)}, ${scaleY(newY)})`);
                
                // Update data
                const updatedEquipment = facilityData.equipment.map(eq => 
                  eq.equipment_id === currentEquipment.equipment_id
                    ? { ...eq, x: newX, y: newY }
                    : eq
                );
                
                onEquipmentUpdate(updatedEquipment);
              }
            }
          };
          
          const handleMouseUp = (upEvent: MouseEvent) => {
            
            // Clean up event listeners
            svg.on('mousemove.drag', null);
            svg.on('mouseup.drag', null);
            svg.on('mouseleave.drag', null);
            
            if (isDraggingThis) {
              // End drag
              setIsDragging(false);
              setDraggedEquipment(null);
              setIsMultiDragging(false);
              setMultiDragStartPositions(new Map());
              // Reset cursor for all equipment
              equipmentGroup.selectAll('g').style('cursor', 'grab');
              isDraggingThis = false;
              isMultiDraggingThis = false;
              localMultiDragStartPositions = null;
            }
          };
          
          // Add temporary event listeners to SVG with namespaces to avoid conflicts
          svg
            .on('mousemove.drag', handleMouseMove)
            .on('mouseup.drag', handleMouseUp)
            .on('mouseleave.drag', handleMouseUp);
        })
        .on('click', function(event) {
          event.stopPropagation();
          
          // Only handle click if we didn't drag
          if (!hasDraggedRef.current && onEquipmentSelect) {
            onEquipmentSelect(currentEquipment);
          }
        })
        .on('dblclick', function(event) {
          event.stopPropagation();
          
          // Clear any drag state
          setIsDragging(false);
          setDraggedEquipment(null);
          hasDraggedRef.current = false;
          
          // Open modal
          onEquipmentClick(currentEquipment, event);
        })
        .on('contextmenu', function(event) {
          event.preventDefault();
          event.stopPropagation();
          
          // Cancel any drag state
          isDraggingThis = false;
          isMultiDraggingThis = false;
          setIsDragging(false);
          setIsMultiDragging(false);
          setIsBrushSelecting(false);
          
          if (onEquipmentRightClick) {
            onEquipmentRightClick(currentEquipment, event);
          }
        });
      
      // Add other event listeners for debugging
      equipGroup
        .on('mouseup', function(event) {
        })
        .on('mouseover', function(event) {
        })
        .on('mouseout', function(event) {
        });
    });




    // Show cursor indicator
    if (selectedTool) {
      svg.style('cursor', 'crosshair');
    } else if (isBrushSelecting) {
      svg.style('cursor', 'crosshair');
    } else {
      svg.style('cursor', 'default');
    }

    // Add title and dimensions
    const titleGroup = svg.append('g');
    
    titleGroup.append('text')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '20px')
      .style('font-weight', 'bold')
      .style('fill', '#1F2937')
      .text(`${facilityData.facility_info.name} - Site Builder`);
    
    titleGroup.append('text')
      .attr('x', width / 2)
      .attr('y', 45)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#6B7280')
      .text(`Dimensions: ${facilityWidth} x ${facilityHeight} ${facilityData.facility_info.dimensions.units}`);
    
    // Add selection counter
    if (selectedEquipmentIds.length > 0) {
      titleGroup.append('text')
        .attr('x', width - padding)
        .attr('y', 25)
        .attr('text-anchor', 'end')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('fill', '#10B981')
        .text(`${selectedEquipmentIds.length} items selected`);
    }
    
    // Add instructions
    const instructionText = selectedTool 
      ? 'Click to place equipment. Equipment snaps to grid.'
      : 'Drag to select multiple items. Click and drag to move. Double-click to edit. Shift+click to add/remove from selection.';
    
    svg.append('text')
      .attr('x', padding)
      .attr('y', height - 10)
      .style('font-size', '12px')
      .style('fill', '#6B7280')
      .text(instructionText);

    // Add CSS for pulse animation
    const style = svg.append('style');
    style.text(`
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `);

  }, [facilityData, selectedTool, selectedEquipment, width, height, isDragging, isMultiDragging, selectedEquipmentIds, onEquipmentUpdate, onEquipmentSelect, onFacilityRightClick, onEquipmentRightClick, onEquipmentClick, onCanvasClick, ghostDragEquipment, cursorPosition, isResizing]);

  // Set up brush selection handlers separately to avoid stale closures
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    
    // Handle brush selection - attach to svg for global handling
    svg
      .on('contextmenu.facility', function(event) {
        // Check if we clicked on equipment or the facility rect
        const clickedOnEquipment = event.composedPath().some((el: any) => {
          return el.classList && (
            el.classList.contains('equipment-petri_dish') ||
            el.classList.contains('equipment-gasifier') ||
            el.classList.contains('equipment-sensor') ||
            el.classList.contains('equipment-vent') ||
            el.classList.contains('equipment-shelving') ||
            el.classList.contains('equipment-door') ||
            el.classList.contains('equipment-fan')
          );
        });
        
        if (!clickedOnEquipment && onFacilityRightClick) {
          event.preventDefault();
          event.stopPropagation();
          
          // Cancel any active states
          setIsBrushSelecting(false);
          setIsDragging(false);
          setIsMultiDragging(false);
          
          const [mouseX, mouseY] = d3.pointer(event, svg.node());
          const facilityX = scaleX.invert(mouseX);
          const facilityY = scaleY.invert(mouseY);
          onFacilityRightClick(event, facilityX, facilityY);
        }
      })
      .on('mousedown.brush', function(event) {
        // Ignore right-click events
        if (event.button === 2) {
          return;
        }
        
        // Check if we clicked on equipment by looking at the event path
        const clickedOnEquipment = event.composedPath().some((el: any) => {
          return el.classList && (
            el.classList.contains('equipment-petri_dish') ||
            el.classList.contains('equipment-gasifier') ||
            el.classList.contains('equipment-sensor') ||
            el.classList.contains('equipment-vent') ||
            el.classList.contains('equipment-shelving') ||
            el.classList.contains('equipment-door') ||
            el.classList.contains('equipment-fan')
          );
        });
        
        if (!selectedTool && !clickedOnEquipment && !ghostDragEquipment) {
          // Start brush selection
          const [mouseX, mouseY] = d3.pointer(event, this);
          setBrushStart({ x: mouseX, y: mouseY });
          setBrushEnd({ x: mouseX, y: mouseY });
          setIsBrushSelecting(true);
        }
      })
      .on('mousemove.brush', function(event) {
        if (isBrushSelecting) {
          const [mouseX, mouseY] = d3.pointer(event, this);
          setBrushEnd({ x: mouseX, y: mouseY });
        }
      })
      .on('mouseup.brush', function(event) {
        if (isBrushSelecting) {
          // Calculate final selection
          const minX = Math.min(brushStart.x, brushEnd.x);
          const maxX = Math.max(brushStart.x, brushEnd.x);
          const minY = Math.min(brushStart.y, brushEnd.y);
          const maxY = Math.max(brushStart.y, brushEnd.y);
          
          const selected: string[] = [];
          facilityData.equipment.forEach(eq => {
            const eqX = scaleX(eq.x);
            const eqY = scaleY(eq.y);
            if (eqX >= minX && eqX <= maxX && eqY >= minY && eqY <= maxY) {
              selected.push(eq.equipment_id);
            }
          });
          
          setSelectedEquipmentIds(selected);
          setIsBrushSelecting(false);
        }
      });
    
    return () => {
      svg.on('contextmenu.facility', null);
      svg.on('mousedown.brush', null);
      svg.on('mousemove.brush', null);
      svg.on('mouseup.brush', null);
    };
  }, [selectedTool, isBrushSelecting, brushStart, brushEnd, facilityData, scaleX, scaleY, onFacilityRightClick, ghostDragEquipment, showDebugBoundaries]);

  // Separate effect for brush overlay - updates immediately
  useEffect(() => {
    
    if (!brushOverlayRef.current || !svgRef.current) return;
    
    const svg = d3.select(brushOverlayRef.current);
    svg.selectAll('*').remove();
    
    if (isBrushSelecting) {
      const minX = Math.min(brushStart.x, brushEnd.x);
      const maxX = Math.max(brushStart.x, brushEnd.x);
      const minY = Math.min(brushStart.y, brushEnd.y);
      const maxY = Math.max(brushStart.y, brushEnd.y);
      
      
      svg.append('rect')
        .attr('class', 'brush-selection')
        .attr('x', minX)
        .attr('y', minY)
        .attr('width', maxX - minX)
        .attr('height', maxY - minY)
        .style('fill', 'rgba(59, 130, 246, 0.1)')
        .style('stroke', '#3B82F6')
        .style('stroke-width', '2px')
        .style('stroke-dasharray', '5,5')
        .style('pointer-events', 'none');
        
      // Update preview selection with throttling
      const selected: string[] = [];
      facilityData.equipment.forEach(eq => {
        const eqX = scaleX(eq.x);
        const eqY = scaleY(eq.y);
        if (eqX >= minX && eqX <= maxX && eqY >= minY && eqY <= maxY) {
          selected.push(eq.equipment_id);
        }
      });
      
      // Only update if selection changed
      if (selected.sort().join(',') !== selectedEquipmentIds.sort().join(',')) {
        setSelectedEquipmentIds(selected);
      }
    }
  }, [isBrushSelecting, brushStart, brushEnd, facilityData, scaleX, scaleY, selectedEquipmentIds]);

  return (
    <div className="simple-facility-floor-plan bg-white rounded-lg shadow-lg" style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          background: '#F8FAFC',
          borderRadius: '8px',
          userSelect: 'none'
        }}
        onMouseDown={(e) => e.preventDefault()}
      />
      <svg
        ref={brushOverlayRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      />
    </div>
  );
};