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
  compact = true
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
      
      effectivenessGroup.append('circle')
        .attr('cx', scaleX(gasifier.x))
        .attr('cy', scaleY(gasifier.y))
        .attr('r', effectiveRadiusPx)
        .style('fill', `url(#gasifier-gradient-${gasifier.equipment_id})`)
        .style('stroke', 'none')
        .style('pointer-events', 'none');
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
      } else if (style.shape === 'rect') {
        let rectWidth = style.size;
        let rectHeight = style.size;
        
        // For shelving, use custom dimensions from config if available
        if (equipment.type === 'shelving') {
          rectWidth = equipment.config?.width || 40;
          rectHeight = equipment.config?.height || 20;
          
          // Main shelving rectangle with lighter fill
          equipGroup.append('rect')
            .attr('x', -rectWidth / 2)
            .attr('y', -rectHeight / 2)
            .attr('width', rectWidth)
            .attr('height', rectHeight)
            .style('fill', isAtOrigin ? '#FCA5A5' : '#E5E7EB')
            .style('stroke', '#4B5563')
            .style('stroke-width', '2px');
          
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
          
          // Add small circles at corners to indicate it's resizable when selected
          if (isSelected && equipment.type === 'shelving') {
            const handleSize = 5;
            const handlePositions = [
              { x: -rectWidth / 2, y: -rectHeight / 2 }, // Top-left
              { x: rectWidth / 2, y: -rectHeight / 2 },  // Top-right
              { x: -rectWidth / 2, y: rectHeight / 2 },  // Bottom-left
              { x: rectWidth / 2, y: rectHeight / 2 }    // Bottom-right
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
                .style('cursor', index === 0 || index === 3 ? 'nwse-resize' : 'nesw-resize')
                .style('pointer-events', 'all');
              
              // Add resize behavior to handles
              handle.on('mousedown', function(event) {
                event.stopPropagation();
                event.preventDefault();
                
                // Capture initial values locally to avoid closure issues
                const startWidth = equipment.config?.width || 40;
                const startHeight = equipment.config?.height || 20;
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
                  
                  let newWidth = startWidth;
                  let newHeight = startHeight;
                  
                  // Update dimensions based on which handle is being dragged
                  switch (index) {
                    case 0: // Top-left
                      newWidth = Math.max(10, startWidth - deltaX * 2);
                      newHeight = Math.max(10, startHeight - deltaY * 2);
                      break;
                    case 1: // Top-right
                      newWidth = Math.max(10, startWidth + deltaX * 2);
                      newHeight = Math.max(10, startHeight - deltaY * 2);
                      break;
                    case 2: // Bottom-left
                      newWidth = Math.max(10, startWidth - deltaX * 2);
                      newHeight = Math.max(10, startHeight + deltaY * 2);
                      break;
                    case 3: // Bottom-right
                      newWidth = Math.max(10, startWidth + deltaX * 2);
                      newHeight = Math.max(10, startHeight + deltaY * 2);
                      break;
                  }
                  
                  // Snap to grid
                  newWidth = snapToGrid(newWidth);
                  newHeight = snapToGrid(newHeight);
                  
                  // Update equipment dimensions
                  if (onEquipmentUpdate) {
                    const updatedEquipment = facilityData.equipment.map(eq =>
                      eq.equipment_id === currentEquipment.equipment_id
                        ? { ...eq, config: { ...eq.config, width: newWidth, height: newHeight } }
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
      const effectiveWidth = isRotated90or270 
        ? (equipment.type === 'shelving' ? (equipment.config?.height || 20) : style.size)
        : (equipment.type === 'shelving' ? (equipment.config?.width || 40) : style.size);
      const effectiveHeight = isRotated90or270
        ? (equipment.type === 'shelving' ? (equipment.config?.width || 40) : style.size)
        : (equipment.type === 'shelving' ? (equipment.config?.height || 20) : style.size);
      
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
                      newX = snapToGrid(newX);
                      newY = snapToGrid(newY);
                    }
                    
                    // Check if within bounds
                    const canMove = newX >= 0 && newX <= facilityWidth && newY >= 0 && newY <= facilityHeight;
                    
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
                  newX = snapToGrid(newX);
                  newY = snapToGrid(newY);
                }
                
                // Ensure within bounds
                newX = Math.max(0, Math.min(facilityWidth, newX));
                newY = Math.max(0, Math.min(facilityHeight, newY));
                
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
  }, [selectedTool, isBrushSelecting, brushStart, brushEnd, facilityData, scaleX, scaleY, onFacilityRightClick, ghostDragEquipment]);

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