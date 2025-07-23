import React, { useState, useEffect, useRef } from 'react';
import { SimpleFacilityFloorPlan } from '../components/mapping/SimpleFacilityFloorPlan';
import { supabase } from '../lib/supabaseClient';

// Constants for localStorage caching
const FACILITY_BUILDER_CACHE_KEY = 'gasx_facility_builder_state';
const CACHE_EXPIRY_HOURS = 24;

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
  equipment_type?: string;
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

const SimpleFacilityBuilder: React.FC = () => {
  const [facilityData, setFacilityData] = useState<FacilityData | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [showElementSettings, setShowElementSettings] = useState(false);
  const [showSiteSettings, setShowSiteSettings] = useState(false);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isNewEquipment, setIsNewEquipment] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    facilityX?: number;
    facilityY?: number;
    type: 'facility' | 'equipment';
    equipment?: Equipment;
  } | null>(null);
  const [clipboard, setClipboard] = useState<Equipment[]>([]);
  const [showClipboardToast, setShowClipboardToast] = useState<string | null>(null);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [ghostDragEquipment, setGhostDragEquipment] = useState<Equipment | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [showDebugBoundaries, setShowDebugBoundaries] = useState(false); // Debug mode off by default
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Undo/Redo history
  const [history, setHistory] = useState<Equipment[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isApplyingHistory = useRef(false);
  
  // Refs to maintain current values for keyboard shortcuts
  const selectedEquipmentRef = useRef<Equipment | null>(null);
  const selectedEquipmentIdsRef = useRef<string[]>([]);
  const facilityDataRef = useRef<FacilityData | null>(null);
  
  // Cache utilities
  const saveToCache = () => {
    if (!facilityData || !selectedSiteId) return;
    
    try {
      const cacheData = {
        siteId: selectedSiteId,
        facilityData: facilityData,
        history: history,
        historyIndex: historyIndex,
        timestamp: Date.now(),
        version: '1.0'
      };
      localStorage.setItem(FACILITY_BUILDER_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save facility builder state to cache:', error);
    }
  };

  const loadFromCache = (siteId: string): boolean => {
    try {
      const cached = localStorage.getItem(FACILITY_BUILDER_CACHE_KEY);
      if (!cached) return false;
      
      const cacheData = JSON.parse(cached);
      const { siteId: cachedSiteId, facilityData: cachedFacilityData, history: cachedHistory, historyIndex: cachedHistoryIndex, timestamp, version } = cacheData;
      
      // Check if cache is for the same site
      if (cachedSiteId !== siteId) return false;
      
      // Check if cache is expired
      const hoursAgo = (Date.now() - timestamp) / (1000 * 60 * 60);
      if (hoursAgo > CACHE_EXPIRY_HOURS) {
        localStorage.removeItem(FACILITY_BUILDER_CACHE_KEY);
        return false;
      }
      
      // Version check
      if (version !== '1.0') {
        localStorage.removeItem(FACILITY_BUILDER_CACHE_KEY);
        return false;
      }
      
      // Restore cached state
      setFacilityData(cachedFacilityData);
      setHistory(cachedHistory || [cachedFacilityData.equipment]);
      setHistoryIndex(cachedHistoryIndex || 0);
      setHasUnsavedChanges(true);
      
      showToast('Restored unsaved changes from cache');
      return true;
    } catch (error) {
      console.warn('Failed to load facility builder state from cache:', error);
      localStorage.removeItem(FACILITY_BUILDER_CACHE_KEY);
      return false;
    }
  };

  const clearCache = () => {
    try {
      localStorage.removeItem(FACILITY_BUILDER_CACHE_KEY);
    } catch (error) {
      console.warn('Failed to clear facility builder cache:', error);
    }
  };

  // Update refs when state changes
  useEffect(() => {
    selectedEquipmentRef.current = selectedEquipment;
  }, [selectedEquipment]);
  
  useEffect(() => {
    selectedEquipmentIdsRef.current = selectedEquipmentIds;
  }, [selectedEquipmentIds]);
  
  useEffect(() => {
    facilityDataRef.current = facilityData;
  }, [facilityData]);

  // Load sites on mount
  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select(`
          *,
          pilot_programs (
            program_id,
            name
          )
        `)
        .order('name');
      
      if (error) throw error;
      setSites(data || []);
      
      if (data && data.length > 0 && !selectedSiteId) {
        setSelectedSiteId(data[0].site_id);
      }
    } catch (err) {
      console.error('Error loading sites:', err);
    }
  };

  // Load facility data when site changes
  useEffect(() => {
    if (selectedSiteId) {
      loadFacilityData(selectedSiteId);
    }
  }, [selectedSiteId]);

  const loadFacilityData = async (siteId: string) => {
    // Try to load from cache first
    if (loadFromCache(siteId)) {
      return; // Successfully loaded from cache
    }
    
    try {
      const { data: siteData, error } = await supabase
        .from('sites')
        .select('*')
        .eq('site_id', siteId)
        .single();

      if (error) throw error;

      // Parse equipment from various JSONB columns
      const equipment: Equipment[] = [];
      
      // Parse petri_defaults - default to 0,0 if no position
      if (siteData.petri_defaults && Array.isArray(siteData.petri_defaults)) {
        siteData.petri_defaults.forEach((petri: any) => {
          if (petri.petri_code) {
            equipment.push({
              equipment_id: petri.petri_code,
              type: 'petri_dish',
              label: petri.petri_code,
              x: petri.x_position || 0,
              y: petri.y_position || 0,
              z: 0,
              radius: 5,
              status: 'active',
              config: {
                ...petri,
                plant_type: petri.plant_type || 'Other Fresh Perishable',
                surrounding_water_schedule: petri.surrounding_water_schedule || 'Daily'
              }
            });
          }
        });
      }

      // Parse gasifier_defaults
      if (siteData.gasifier_defaults && Array.isArray(siteData.gasifier_defaults)) {
        siteData.gasifier_defaults.forEach((gasifier: any) => {
          if (gasifier.gasifier_code) {
            const effectiveRadius = gasifier.effectiveness_radius || 
              Math.sqrt((siteData.min_efficacious_gasifier_density_sqft_per_bag || 2000) / Math.PI);
            
            equipment.push({
              equipment_id: gasifier.gasifier_code,
              type: 'gasifier',
              label: gasifier.gasifier_code,
              x: gasifier.footage_from_origin_x || 0,
              y: gasifier.footage_from_origin_y || 0,
              z: 0,
              radius: 15,
              status: 'active',
              config: {
                ...gasifier,
                effectiveness_radius: effectiveRadius
              }
            });
          }
        });
      }

      // Parse door_details
      if (siteData.door_details && Array.isArray(siteData.door_details)) {
        siteData.door_details.forEach((door: any, index: number) => {
          equipment.push({
            equipment_id: door.door_id || `door-${index}`,
            type: 'door',
            label: door.door_id || `Door ${index + 1}`,
            x: door.position?.x || 0,
            y: door.position?.y || 0,
            z: 0,
            radius: 10,
            status: 'active',
            config: door
          });
        });
      }

      // Parse fan_details
      if (siteData.fan_details && Array.isArray(siteData.fan_details)) {
        siteData.fan_details.forEach((fan: any) => {
          if (fan.fanId) {
            equipment.push({
              equipment_id: fan.fanId,
              type: 'fan',
              label: fan.fanId,
              x: fan.directionality?.origin_point?.x || 0,
              y: fan.directionality?.origin_point?.y || 0,
              z: 0,
              radius: 8,
              status: 'active',
              config: fan
            });
          }
        });
      }

      // Also check facility_layout for complete equipment data
      if (siteData.facility_layout && siteData.facility_layout.equipment) {
        // This would be our saved layout data
        // Use it to override positions if available
        const layoutEquipment = siteData.facility_layout.equipment;
        layoutEquipment.forEach((layoutEq: any) => {
          const existingEq = equipment.find(eq => eq.equipment_id === layoutEq.equipment_id);
          if (existingEq) {
            existingEq.x = layoutEq.x;
            existingEq.y = layoutEq.y;
          }
        });
      }

      // Get dimensions - prefer actual length/width fields over facility_dimensions
      // facility_dimensions JSON field might contain outdated data
      let dimensions;
      
      if (siteData.length && siteData.width) {
        // Note: database uses length for x-axis (width) and width for y-axis (height)
        dimensions = {
          width: siteData.length,
          height: siteData.width,
          units: 'feet'
        };
      } else if (siteData.facility_dimensions && siteData.facility_dimensions.width && siteData.facility_dimensions.height) {
        // Use facility_dimensions only if length/width not available
        dimensions = siteData.facility_dimensions;
      } else {
        // Default dimensions
        dimensions = {
          width: 100,
          height: 100,
          units: 'feet'
        };
      }

      const facilityData: FacilityData = {
        facility_info: {
          site_id: siteData.site_id,
          name: siteData.name,
          dimensions,
          layout: siteData.facility_layout,
          min_efficacious_gasifier_density_sqft_per_bag: siteData.min_efficacious_gasifier_density_sqft_per_bag || 2000
        },
        equipment
      };

      setFacilityData(facilityData);
      
      // Initialize history with loaded data
      setHistory([equipment]);
      setHistoryIndex(0);
    } catch (err) {
      console.error('Error loading facility data:', err);
    }
  };

  const handleEquipmentUpdate = (equipment: Equipment[]) => {
    if (!facilityData) return;
    
    // Don't add to history if we're applying history (undo/redo)
    if (!isApplyingHistory.current) {
      // Add current state to history
      const newHistory = [...history.slice(0, historyIndex + 1), equipment];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      // Limit history size to prevent memory issues
      if (newHistory.length > 50) {
        setHistory(newHistory.slice(-50));
        setHistoryIndex(49);
      }
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
    }
    
    setFacilityData({
      ...facilityData,
      equipment
    });
  };
  
  // Save to cache whenever facility data or history changes
  useEffect(() => {
    if (facilityData && selectedSiteId) {
      saveToCache();
    }
  }, [facilityData, history, historyIndex]);
  
  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      isApplyingHistory.current = true;
      const previousState = history[historyIndex - 1];
      setFacilityData({
        ...facilityData!,
        equipment: previousState
      });
      setHistoryIndex(historyIndex - 1);
      showToast('Undo');
      isApplyingHistory.current = false;
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isApplyingHistory.current = true;
      const nextState = history[historyIndex + 1];
      setFacilityData({
        ...facilityData!,
        equipment: nextState
      });
      setHistoryIndex(historyIndex + 1);
      showToast('Redo');
      isApplyingHistory.current = false;
    }
  };

  const handleReset = async () => {
    if (!selectedSiteId) return;
    
    const confirmReset = window.confirm('Are you sure you want to discard all unsaved changes and reload from the database?');
    if (!confirmReset) return;
    
    try {
      // Clear cache
      clearCache();
      
      // Reset unsaved changes flag
      setHasUnsavedChanges(false);
      
      // Reload facility data from database
      await loadFacilityData(selectedSiteId);
      
      showToast('Reset to saved version');
    } catch (error) {
      console.error('Error resetting facility:', error);
      showToast('Error resetting facility');
    }
  };

  const handleSaveLayout = async () => {
    if (!facilityData || !selectedSiteId) return;

    setIsSaving(true);
    try {
      // Update the JSONB columns with new positions
      const petriDefaults = facilityData.equipment
        .filter(eq => eq.type === 'petri_dish')
        .map(eq => ({
          ...eq.config,
          petri_code: eq.equipment_id,
          x_position: eq.x,
          y_position: eq.y
        }));

      const gasifierDefaults = facilityData.equipment
        .filter(eq => eq.type === 'gasifier')
        .map(eq => ({
          ...eq.config,
          gasifier_code: eq.equipment_id,
          footage_from_origin_x: eq.x,
          footage_from_origin_y: eq.y
        }));

      const doorDetails = facilityData.equipment
        .filter(eq => eq.type === 'door')
        .map(eq => ({
          ...eq.config,
          door_id: eq.equipment_id,
          position: { x: eq.x, y: eq.y }
        }));

      const fanDetails = facilityData.equipment
        .filter(eq => eq.type === 'fan')
        .map(eq => ({
          ...eq.config,
          fanId: eq.equipment_id,
          directionality: {
            ...eq.config.directionality,
            origin_point: { x: eq.x, y: eq.y }
          }
        }));

      // Also save a complete layout snapshot
      const layoutToSave = {
        equipment: facilityData.equipment,
        lastModified: new Date().toISOString(),
        version: '1.0'
      };

      // Update the site with new equipment positions
      const updateData: any = {
        facility_layout: layoutToSave,
        facility_dimensions: facilityData.facility_info.dimensions,
        updated_at: new Date().toISOString()
      };

      // Only update JSONB columns if they have data
      if (petriDefaults.length > 0) updateData.petri_defaults = petriDefaults;
      if (gasifierDefaults.length > 0) updateData.gasifier_defaults = gasifierDefaults;
      if (doorDetails.length > 0) updateData.door_details = doorDetails;
      if (fanDetails.length > 0) updateData.fan_details = fanDetails;

      const { error } = await supabase
        .from('sites')
        .update(updateData)
        .eq('site_id', selectedSiteId);

      if (error) throw error;

      // Clear cache after successful save
      clearCache();
      setHasUnsavedChanges(false);
      alert('Facility layout saved successfully!');
    } catch (err) {
      console.error('Error saving layout:', err);
      alert('Error saving facility layout');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToolSelect = (toolType: string) => {
    setSelectedTool(toolType);
    setSelectedEquipment(null);
  };

  const handleEquipmentClick = (equipment: Equipment, event?: MouseEvent) => {
    
    // This is called on double-click to show modal
    setSelectedEquipment(equipment);
    setEditingEquipment({ ...equipment });
    setIsNewEquipment(false);
    
    // Set modal position based on event or default to center
    if (event) {
      // Calculate position that keeps modal fully in viewport
      const modalWidth = 600;
      const modalHeight = 400; // Approximate height
      const padding = 20;
      
      let x = event.clientX;
      let y = event.clientY;
      
      // Adjust if modal would go off right edge
      if (x + modalWidth/2 > window.innerWidth - padding) {
        x = window.innerWidth - modalWidth - padding;
      }
      // Adjust if modal would go off left edge
      if (x - modalWidth/2 < padding) {
        x = modalWidth/2 + padding;
      }
      // Adjust if modal would go off bottom
      if (y + modalHeight > window.innerHeight - padding) {
        y = window.innerHeight - modalHeight - padding;
      }
      // Adjust if modal would go off top
      if (y < padding) {
        y = padding;
      }
      
      setModalPosition({ x, y });
    } else {
      // Default to center of viewport
      setModalPosition({ 
        x: window.innerWidth / 2, 
        y: window.innerHeight / 2 - 100 
      });
    }
    
    setShowElementSettings(true);
  };

  const handleEquipmentSelect = (equipment: Equipment) => {
    
    // This is called on single-click to select/highlight
    setSelectedEquipment(equipment);
    setSelectedTool(null); // Clear any selected tool
  };

  const handleCanvasClick = (x: number, y: number, event?: MouseEvent) => {
    // Handle ghost drag placement
    if (ghostDragEquipment && facilityData) {
      // Update the equipment position
      const updatedEquipment = facilityData.equipment.map(eq =>
        eq.equipment_id === ghostDragEquipment.equipment_id
          ? { ...eq, x, y }
          : eq
      );
      handleEquipmentUpdate(updatedEquipment);
      
      // Clear ghost drag mode
      setGhostDragEquipment(null);
      showToast(`Placed ${ghostDragEquipment.label}`);
      return;
    }
    
    if (!selectedTool || !facilityData) return;

    // Create default config based on equipment type
    let defaultConfig: any = {};
    if (selectedTool === 'petri_dish') {
      defaultConfig = {
        plant_type: 'Other Fresh Perishable',
        surrounding_water_schedule: 'Daily',
        fungicide_used: 'No',
        placement: '',
        placement_dynamics: '',
        notes: ''
      };
    } else if (selectedTool === 'gasifier') {
      // Use site's default effectiveness radius
      defaultConfig = {
        effectiveness_radius: Math.sqrt((facilityData.facility_info.min_efficacious_gasifier_density_sqft_per_bag || 2000) / Math.PI)
      };
    } else if (selectedTool === 'fan') {
      // Default fan configuration
      defaultConfig = {
        magnitude_cfm: 1000,
        direction: 0, // Default pointing right
        percentage_of_time_blowing: 100
      };
    } else if (selectedTool === 'shelving') {
      // Make shelving proportional to facility size
      const facilityWidth = facilityData.facility_info.dimensions.width;
      const facilityHeight = facilityData.facility_info.dimensions.height;
      
      // Default to 20% of facility width, 10% of facility height
      // But with reasonable min/max values
      const shelvingWidth = Math.min(40, Math.max(8, facilityWidth * 0.2));
      const shelvingHeight = Math.min(20, Math.max(4, facilityHeight * 0.1));
      
      console.log('[SHELVING DEFAULT CONFIG]', {
        facilityDimensions: { width: facilityWidth, height: facilityHeight },
        calculatedDimensions: {
          width: facilityWidth * 0.2,
          height: facilityHeight * 0.1
        },
        clampedDimensions: {
          width: shelvingWidth,
          height: shelvingHeight
        },
        finalDimensions: {
          width: Math.round(shelvingWidth),
          height: Math.round(shelvingHeight)
        }
      });
      
      defaultConfig = {
        width: Math.round(shelvingWidth),
        height: Math.round(shelvingHeight),
        material: 'wire',
        labelPosition: 'bottom'
      };
    }

    const newEquipment: Equipment = {
      equipment_id: `${selectedTool}-${Date.now()}`,
      type: selectedTool as any,
      label: `New ${selectedTool.replace('_', ' ')}`,
      x,
      y,
      z: 0,
      radius: selectedTool === 'gasifier' ? 15 : selectedTool === 'fan' ? 8 : 5,
      status: 'active',
      config: defaultConfig
    };

    // Add equipment to the facility
    handleEquipmentUpdate([...facilityData.equipment, newEquipment]);
    
    // Open settings modal for the new equipment
    setEditingEquipment({ ...newEquipment });
    setSelectedEquipment(newEquipment);
    setIsNewEquipment(true);
    
    // Set modal position at click location
    if (event) {
      setModalPosition({ x: event.clientX, y: event.clientY });
    }
    
    setShowElementSettings(true);
    setSelectedTool(null);
  };

  const handleFacilityRightClick = (event: MouseEvent, facilityX?: number, facilityY?: number) => {
    event.preventDefault();
    event.stopPropagation();
    
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      facilityX: facilityX || 0,
      facilityY: facilityY || 0,
      type: 'facility'
    });
  };

  const handleEquipmentRightClick = (equipment: Equipment, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'equipment',
      equipment
    });
  };

  const handleCopy = (items: Equipment[]) => {
    setClipboard(items);
    showToast(`Copied ${items.length} item${items.length > 1 ? 's' : ''}`);
  };

  const handlePaste = (x?: number, y?: number) => {
    if (clipboard.length === 0 || !facilityData) return;
    
    // For single item paste, place directly at cursor
    // For multiple items, maintain relative positions
    let newEquipment: Equipment[];
    
    if (clipboard.length === 1 && x !== undefined && y !== undefined) {
      // Single item - place exactly at cursor position
      // Apply grid snapping for consistent placement
      const gridSize = 1; // Using 1x1 grid as per previous implementation
      const snappedX = Math.round(x / gridSize) * gridSize;
      const snappedY = Math.round(y / gridSize) * gridSize;
      
      newEquipment = [{
        ...clipboard[0],
        equipment_id: `${clipboard[0].type}-${Date.now()}`,
        label: `${clipboard[0].label} (Copy)`,
        x: Math.max(0, Math.min(facilityData.facility_info.dimensions.width, snappedX)),
        y: Math.max(0, Math.min(facilityData.facility_info.dimensions.height, snappedY))
      }];
    } else {
      // Multiple items or no cursor position - maintain relative positions
      const pasteX = x !== undefined ? x : (clipboard[0].x + 20);
      const pasteY = y !== undefined ? y : (clipboard[0].y + 20);
      
      // Calculate offset from first item for maintaining relative positions
      const offsetX = pasteX - clipboard[0].x;
      const offsetY = pasteY - clipboard[0].y;
      
      newEquipment = clipboard.map((item, index) => ({
        ...item,
        equipment_id: `${item.type}-${Date.now()}-${index}`,
        label: `${item.label} (Copy)`,
        x: Math.max(0, Math.min(facilityData.facility_info.dimensions.width, item.x + offsetX)),
        y: Math.max(0, Math.min(facilityData.facility_info.dimensions.height, item.y + offsetY))
      }));
    }
    
    handleEquipmentUpdate([...facilityData.equipment, ...newEquipment]);
    
    // Select the newly pasted items
    const newIds = newEquipment.map(eq => eq.equipment_id);
    setSelectedEquipmentIds(newIds);
    if (newEquipment.length === 1) {
      setSelectedEquipment(newEquipment[0]);
      selectedEquipmentRef.current = newEquipment[0];
    }
    selectedEquipmentIdsRef.current = newIds;
    
    showToast(`Pasted ${newEquipment.length} item${newEquipment.length > 1 ? 's' : ''}`);
  };

  const showToast = (message: string) => {
    setShowClipboardToast(message);
    setTimeout(() => setShowClipboardToast(null), 2000);
  };

  const handleContextMenuAction = (action: string) => {
    if (contextMenu?.type === 'facility') {
      switch (action) {
        case 'site-settings':
          if (selectedSiteId) {
            const site = sites.find(s => s.site_id === selectedSiteId);
            if (site) {
              setEditingSite({ ...site });
              setShowSiteSettings(true);
            }
          }
          break;
        case 'save':
          handleSaveLayout();
          break;
        case 'paste':
          // Always use cursor position when pasting from context menu
          if (contextMenu && contextMenu.facilityX !== undefined && contextMenu.facilityY !== undefined) {
            handlePaste(contextMenu.facilityX, contextMenu.facilityY);
          } else {
            handlePaste();
          }
          break;
      }
    } else if (contextMenu?.type === 'equipment' && contextMenu.equipment) {
      switch (action) {
        case 'settings':
          handleEquipmentClick(contextMenu.equipment, event as any);
          break;
        case 'copy':
          // If multiple items are selected, copy all of them
          if (selectedEquipmentIds.length > 1 && facilityData) {
            const selectedItems = facilityData.equipment.filter(eq => 
              selectedEquipmentIds.includes(eq.equipment_id)
            );
            handleCopy(selectedItems);
          } else {
            handleCopy([contextMenu.equipment]);
          }
          break;
        case 'duplicate':
          if (facilityData) {
            // Check if equipment would be out of bounds
            const newX = contextMenu.equipment.x + 10;
            const newY = contextMenu.equipment.y + 10;
            const facilityWidth = facilityData.facility_info.dimensions.width;
            const facilityHeight = facilityData.facility_info.dimensions.height;
            
            // For shelving, check if it fits
            if (contextMenu.equipment.type === 'shelving' && contextMenu.equipment.config) {
              const shelvingWidth = contextMenu.equipment.config.width || 40;
              const shelvingHeight = contextMenu.equipment.config.height || 20;
              if (newX + shelvingWidth/2 > facilityWidth || newY + shelvingHeight/2 > facilityHeight) {
                showToast('Equipment would be out of bounds', 'error');
                break;
              }
            }
            
            const newEquipment: Equipment = {
              ...contextMenu.equipment,
              equipment_id: `${contextMenu.equipment.type}-${Date.now()}`,
              label: `${contextMenu.equipment.label} (Copy)`,
              x: newX,
              y: newY
            };
            handleEquipmentUpdate([...facilityData.equipment, newEquipment]);
          }
          break;
        case 'delete':
          if (facilityData) {
            const updatedEquipment = facilityData.equipment.filter(
              eq => eq.equipment_id !== contextMenu.equipment.equipment_id
            );
            handleEquipmentUpdate(updatedEquipment);
          }
          break;
        case 'bring-to-front':
          if (facilityData) {
            // Check if we have multiple items selected
            if (selectedEquipmentIds.length > 1) {
              // Handle multiple items
              const selectedItems = facilityData.equipment.filter(
                eq => selectedEquipmentIds.includes(eq.equipment_id)
              );
              const otherEquipment = facilityData.equipment.filter(
                eq => !selectedEquipmentIds.includes(eq.equipment_id)
              );
              // Move all selected items to the end (preserving their relative order)
              handleEquipmentUpdate([...otherEquipment, ...selectedItems]);
              showToast(`Brought ${selectedItems.length} items to front`);
            } else {
              // Single item
              const targetEquipment = contextMenu.equipment;
              const otherEquipment = facilityData.equipment.filter(
                eq => eq.equipment_id !== targetEquipment.equipment_id
              );
              handleEquipmentUpdate([...otherEquipment, targetEquipment]);
              showToast(`Brought ${targetEquipment.label} to front`);
            }
          }
          break;
        case 'send-to-back':
          if (facilityData) {
            // Check if we have multiple items selected
            if (selectedEquipmentIds.length > 1) {
              // Handle multiple items
              const selectedItems = facilityData.equipment.filter(
                eq => selectedEquipmentIds.includes(eq.equipment_id)
              );
              const otherEquipment = facilityData.equipment.filter(
                eq => !selectedEquipmentIds.includes(eq.equipment_id)
              );
              // Move all selected items to the beginning (preserving their relative order)
              handleEquipmentUpdate([...selectedItems, ...otherEquipment]);
              showToast(`Sent ${selectedItems.length} items to back`);
            } else {
              // Single item
              const targetEquipment = contextMenu.equipment;
              const otherEquipment = facilityData.equipment.filter(
                eq => eq.equipment_id !== targetEquipment.equipment_id
              );
              handleEquipmentUpdate([targetEquipment, ...otherEquipment]);
              showToast(`Sent ${targetEquipment.label} to back`);
            }
          }
          break;
      }
    }
    
    setContextMenu(null);
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleContextMenu = (e: MouseEvent) => {
      // Prevent default browser context menu on the whole document
      if (contextMenu) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [contextMenu]);

  // Track mouse position for ghost drag
  useEffect(() => {
    if (!ghostDragEquipment) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [ghostDragEquipment]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + C - Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        // Prioritize multi-selection
        if (selectedEquipmentIdsRef.current.length > 0 && facilityDataRef.current) {
          const selectedItems = facilityDataRef.current.equipment.filter(eq => 
            selectedEquipmentIdsRef.current.includes(eq.equipment_id)
          );
          handleCopy(selectedItems);
        } else if (selectedEquipmentRef.current && facilityDataRef.current) {
          // Get fresh data for single selection
          const currentEquipment = facilityDataRef.current.equipment.find(
            eq => eq.equipment_id === selectedEquipmentRef.current!.equipment_id
          );
          if (currentEquipment) {
            handleCopy([currentEquipment]);
          }
        }
      }
      
      // Ctrl/Cmd + V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
      
      // Ctrl/Cmd + S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveLayout();
      }
      
      // Delete - Delete selected items
      if (e.key === 'Delete') {
        e.preventDefault();
        if (selectedEquipmentRef.current && facilityDataRef.current) {
          const updatedEquipment = facilityDataRef.current.equipment.filter(
            eq => eq.equipment_id !== selectedEquipmentRef.current!.equipment_id
          );
          handleEquipmentUpdate(updatedEquipment);
          setSelectedEquipment(null);
          showToast('Deleted 1 item');
        } else if (selectedEquipmentIdsRef.current.length > 0 && facilityDataRef.current) {
          const updatedEquipment = facilityDataRef.current.equipment.filter(
            eq => !selectedEquipmentIdsRef.current.includes(eq.equipment_id)
          );
          handleEquipmentUpdate(updatedEquipment);
          showToast(`Deleted ${selectedEquipmentIdsRef.current.length} items`);
          setSelectedEquipmentIds([]);
        }
      }
      
      // Escape - Cancel operations
      if (e.key === 'Escape') {
        setSelectedTool(null);
        setContextMenu(null);
        setShowElementSettings(false);
        setShowSiteSettings(false);
        setGhostDragEquipment(null);
      }
      
      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      
      // R - Rotate selected shelving
      if (e.key === 'r' || e.key === 'R') {
        if (selectedEquipmentRef.current && selectedEquipmentRef.current.type === 'shelving' && facilityDataRef.current) {
          e.preventDefault();
          const currentRotation = selectedEquipmentRef.current.config?.rotation || 0;
          const nextRotation = (currentRotation + 90) % 360;
          
          const equipment = selectedEquipmentRef.current;
          const width = equipment.config?.width || 40;
          const height = equipment.config?.height || 20;
          const facilityWidth = facilityDataRef.current.facility_info.dimensions.width;
          const facilityHeight = facilityDataRef.current.facility_info.dimensions.height;
          
          // Calculate new bounding box after rotation
          const angleRad = (nextRotation * Math.PI) / 180;
          const absCos = Math.abs(Math.cos(angleRad));
          const absSin = Math.abs(Math.sin(angleRad));
          const newBoundingHalfWidth = (width / 2) * absCos + (height / 2) * absSin;
          const newBoundingHalfHeight = (width / 2) * absSin + (height / 2) * absCos;
          
          // Check if rotation would cause equipment to go out of bounds
          let newX = equipment.x;
          let newY = equipment.y;
          
          // Adjust position if needed to keep equipment in bounds after rotation
          if (newX - newBoundingHalfWidth < 0) {
            newX = newBoundingHalfWidth;
          } else if (newX + newBoundingHalfWidth > facilityWidth) {
            newX = facilityWidth - newBoundingHalfWidth;
          }
          
          if (newY - newBoundingHalfHeight < 0) {
            newY = newBoundingHalfHeight;
          } else if (newY + newBoundingHalfHeight > facilityHeight) {
            newY = facilityHeight - newBoundingHalfHeight;
          }
          
          console.log('[SHELVING ROTATION] Rotating shelving:', {
            equipment: equipment.equipment_id,
            position: { x: equipment.x, y: equipment.y },
            dimensions: { 
              stored: { width, height },
              visual: {
                at0deg: { width, height },
                at90deg: { width: height, height: width },
                at180deg: { width, height },
                at270deg: { width: height, height: width }
              },
              currentVisual: {
                width: currentRotation === 90 || currentRotation === 270 ? height : width,
                height: currentRotation === 90 || currentRotation === 270 ? width : height
              },
              nextVisual: {
                width: nextRotation === 90 || nextRotation === 270 ? height : width,
                height: nextRotation === 90 || nextRotation === 270 ? width : height
              }
            },
            rotation: { current: currentRotation, next: nextRotation },
            boundingBox: {
              before: {
                halfWidth: (width / 2) * Math.abs(Math.cos(currentRotation * Math.PI / 180)) + (height / 2) * Math.abs(Math.sin(currentRotation * Math.PI / 180)),
                halfHeight: (width / 2) * Math.abs(Math.sin(currentRotation * Math.PI / 180)) + (height / 2) * Math.abs(Math.cos(currentRotation * Math.PI / 180))
              },
              after: {
                halfWidth: newBoundingHalfWidth,
                halfHeight: newBoundingHalfHeight
              }
            },
            positionAdjustment: {
              needed: newX !== equipment.x || newY !== equipment.y,
              newPos: { x: newX, y: newY }
            },
            ISSUE_CHECK: {
              storedDimensionsNeverChange: true,
              visualDimensionsShouldSwapAt90_270: true,
              currentIssue: "Width/height are stored but visual representation should swap"
            }
          });
          
          const updatedEquipment = facilityDataRef.current.equipment.map(eq =>
            eq.equipment_id === selectedEquipmentRef.current!.equipment_id
              ? { ...eq, x: newX, y: newY, config: { ...eq.config, rotation: nextRotation } }
              : eq
          );
          handleEquipmentUpdate(updatedEquipment);
          showToast(`Rotated to ${nextRotation}°`);
        }
      }

      // Shift+Cmd+Up - Bring to front
      if (e.shiftKey && e.metaKey && e.key === 'ArrowUp') {
        e.preventDefault();
        if (facilityDataRef.current) {
          // Check if we have multiple items selected
          if (selectedEquipmentIdsRef.current.length > 1) {
            // Handle multiple items
            const selectedItems = facilityDataRef.current.equipment.filter(
              eq => selectedEquipmentIdsRef.current.includes(eq.equipment_id)
            );
            const otherEquipment = facilityDataRef.current.equipment.filter(
              eq => !selectedEquipmentIdsRef.current.includes(eq.equipment_id)
            );
            handleEquipmentUpdate([...otherEquipment, ...selectedItems]);
            showToast(`Brought ${selectedItems.length} items to front`);
          } else if (selectedEquipmentRef.current) {
            // Single item
            const targetEquipment = facilityDataRef.current.equipment.find(
              eq => eq.equipment_id === selectedEquipmentRef.current!.equipment_id
            );
            if (targetEquipment) {
              const otherEquipment = facilityDataRef.current.equipment.filter(
                eq => eq.equipment_id !== targetEquipment.equipment_id
              );
              handleEquipmentUpdate([...otherEquipment, targetEquipment]);
              showToast(`Brought ${targetEquipment.label} to front`);
            }
          }
        }
      }

      // Shift+Cmd+Down - Send to back
      if (e.shiftKey && e.metaKey && e.key === 'ArrowDown') {
        e.preventDefault();
        if (facilityDataRef.current) {
          // Check if we have multiple items selected
          if (selectedEquipmentIdsRef.current.length > 1) {
            // Handle multiple items
            const selectedItems = facilityDataRef.current.equipment.filter(
              eq => selectedEquipmentIdsRef.current.includes(eq.equipment_id)
            );
            const otherEquipment = facilityDataRef.current.equipment.filter(
              eq => !selectedEquipmentIdsRef.current.includes(eq.equipment_id)
            );
            handleEquipmentUpdate([...selectedItems, ...otherEquipment]);
            showToast(`Sent ${selectedItems.length} items to back`);
          } else if (selectedEquipmentRef.current) {
            // Single item
            const targetEquipment = facilityDataRef.current.equipment.find(
              eq => eq.equipment_id === selectedEquipmentRef.current!.equipment_id
            );
            if (targetEquipment) {
              const otherEquipment = facilityDataRef.current.equipment.filter(
                eq => eq.equipment_id !== targetEquipment.equipment_id
              );
              handleEquipmentUpdate([targetEquipment, ...otherEquipment]);
              showToast(`Sent ${targetEquipment.label} to back`);
            }
          }
        }
      }

      // Escape - Deselect all
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedEquipment(null);
        setSelectedEquipmentIds([]);
        selectedEquipmentRef.current = null;
        selectedEquipmentIdsRef.current = [];
        
        // Also clear any modals
        setShowElementSettings(false);
        setContextMenu(null);
      }
      
      // D key - toggle debug boundaries
      if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowDebugBoundaries(prev => !prev);
        showToast(showDebugBoundaries ? 'Debug boundaries hidden' : 'Debug boundaries shown');
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [clipboard, handleCopy, handlePaste, handleSaveLayout, handleEquipmentUpdate, showToast, handleUndo, handleRedo]);

  const handleSaveSiteSettings = async () => {
    if (!editingSite || !selectedSiteId) return;

    try {
      const { error } = await supabase
        .from('sites')
        .update({
          name: editingSite.name,
          length: editingSite.length,
          width: editingSite.width,
          height: editingSite.height,
          square_footage: editingSite.square_footage,
          cubic_footage: editingSite.cubic_footage,
          min_efficacious_gasifier_density_sqft_per_bag: editingSite.min_efficacious_gasifier_density_sqft_per_bag,
          facility_dimensions: {
            width: editingSite.length || 120,
            height: editingSite.width || 80,
            units: 'feet'
          },
          updated_at: new Date().toISOString()
        })
        .eq('site_id', selectedSiteId);

      if (error) throw error;

      // Reload sites and facility data
      await loadSites();
      await loadFacilityData(selectedSiteId);
      
      setShowSiteSettings(false);
      alert('Site settings saved successfully!');
    } catch (err) {
      console.error('Error saving site settings:', err);
      alert('Error saving site settings');
    }
  };

  const handleDeleteEquipment = () => {
    if (!selectedEquipment || !facilityData) return;

    const updatedEquipment = facilityData.equipment.filter(
      eq => eq.equipment_id !== selectedEquipment.equipment_id
    );
    
    handleEquipmentUpdate(updatedEquipment);
    setSelectedEquipment(null);
    setShowElementSettings(false);
  };

  const handleSaveEquipment = () => {
    if (!editingEquipment || !facilityData) return;

    // Validate shelving dimensions
    if (editingEquipment.type === 'shelving' && editingEquipment.config) {
      const shelvingWidth = editingEquipment.config.width || 40;
      const shelvingHeight = editingEquipment.config.height || 20;
      const facilityWidth = facilityData.facility_info.dimensions.width;
      const facilityHeight = facilityData.facility_info.dimensions.height;
      
      // Check if shelving is larger than facility
      if (shelvingWidth > facilityWidth * 0.8) {
        showToast(`Shelving width (${shelvingWidth}ft) is too large for this facility (${facilityWidth}ft wide)`, 'error');
        return;
      }
      if (shelvingHeight > facilityHeight * 0.8) {
        showToast(`Shelving height (${shelvingHeight}ft) is too large for this facility (${facilityHeight}ft deep)`, 'error');
        return;
      }
      
      // Check if shelving would be out of bounds at current position
      if (editingEquipment.x + shelvingWidth/2 > facilityWidth || 
          editingEquipment.x - shelvingWidth/2 < 0) {
        showToast('Shelving would extend beyond facility boundaries', 'error');
        return;
      }
      if (editingEquipment.y + shelvingHeight/2 > facilityHeight || 
          editingEquipment.y - shelvingHeight/2 < 0) {
        showToast('Shelving would extend beyond facility boundaries', 'error');
        return;
      }
    }

    // For petri dishes, if this is a new equipment and label has changed, update the equipment_id
    let equipmentToSave = editingEquipment;
    if (isNewEquipment && editingEquipment.type === 'petri_dish' && 
        editingEquipment.label && !editingEquipment.label.startsWith('New ')) {
      // Update the equipment_id to match the label
      equipmentToSave = {
        ...editingEquipment,
        equipment_id: editingEquipment.label
      };
    }

    const updatedEquipment = facilityData.equipment.map(eq => 
      eq.equipment_id === editingEquipment.equipment_id ? equipmentToSave : eq
    );
    
    handleEquipmentUpdate(updatedEquipment);
    setShowElementSettings(false);
    setIsNewEquipment(false); // Mark as saved
  };

  const toolbarItems = [
    { id: 'petri_dish', label: 'Petri Dish', icon: '🧫', color: '#059669' },
    { id: 'gasifier', label: 'Gasifier', icon: '💨', color: '#1F2937' },
    { id: 'fan', label: 'Fan', icon: '🌀', color: '#6B7280' },
    { id: 'shelving', label: 'Shelving Unit', icon: '🗄️', color: '#9CA3AF' },
    { id: 'vent', label: 'Vent', icon: '🔲', color: '#6B7280' },
    { id: 'sensor', label: 'Sensor', icon: '📡', color: '#3B82F6' },
    { id: 'door', label: 'Door', icon: '🚪', color: '#EF4444' },
  ];

  return (
    <div className={`simple-facility-builder h-screen flex flex-col bg-gray-50 ${ghostDragEquipment ? 'cursor-grabbing' : ''}`}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              Facility Site Builder
            </h1>
            <div className="text-sm text-gray-600">
              Edit Mode - Drag equipment to position them
            </div>
          </div>

          {/* Site Selection */}
          <div className="flex items-center gap-4">
            <select
              className="px-4 py-2 border border-gray-300 rounded-md"
              value={selectedSiteId || ''}
              onChange={(e) => setSelectedSiteId(e.target.value)}
            >
              <option value="">Select a site...</option>
              {sites.map(site => (
                <option key={site.site_id} value={site.site_id}>
                  {site.name} {site.pilot_programs?.name ? `- ${site.pilot_programs.name}` : ''} ({site.length}x{site.width} ft)
                </option>
              ))}
            </select>

            <button
              onClick={handleSaveLayout}
              disabled={isSaving}
              className={`px-6 py-2 ${hasUnsavedChanges ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-md disabled:opacity-50 relative`}
            >
              {hasUnsavedChanges && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              )}
              {isSaving ? 'Saving...' : hasUnsavedChanges ? '💾 Save Layout (Unsaved Changes)' : '💾 Save Layout'}
            </button>
            
            {hasUnsavedChanges && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                title="Discard changes and reload from database"
              >
                🔄 Reset
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main Canvas Area */}
        <div className="flex-1 relative bg-gray-100 p-6">
          {facilityData ? (
            <SimpleFacilityFloorPlan
              facilityData={facilityData}
              onEquipmentClick={handleEquipmentClick}
              onEquipmentSelect={handleEquipmentSelect}
              onCanvasClick={handleCanvasClick}
              onEquipmentUpdate={handleEquipmentUpdate}
              onFacilityRightClick={handleFacilityRightClick}
              onEquipmentRightClick={handleEquipmentRightClick}
              selectedTool={selectedTool}
              selectedEquipment={selectedEquipment}
              selectedEquipmentIds={selectedEquipmentIds}
              setSelectedEquipmentIds={setSelectedEquipmentIds}
              ghostDragEquipment={ghostDragEquipment}
              cursorPosition={cursorPosition}
              width={900}
              height={500}
              showDebugBoundaries={showDebugBoundaries}
              compact={true}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Select a site to start building</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - Toolbar */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">🛠️ Equipment Toolbar</h3>
            <p className="text-sm text-gray-600 mb-4">
              Click to select, then click on the map to place equipment.
            </p>
            <div className="space-y-2">
              {toolbarItems.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                    selectedTool === tool.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{tool.icon}</span>
                  <span className="font-medium flex-1 text-left">{tool.label}</span>
                  {selectedTool !== tool.id && (
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tool.color }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Instructions</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Right-click for context menu</li>
              <li>• Drag to select multiple items</li>
              <li>• Ctrl+C/V to copy/paste</li>
              <li>• Delete key removes selected</li>
              <li>• Ctrl+S to save layout</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Element Settings Modal */}
      {showElementSettings && editingEquipment && (
        <>
          {/* Backdrop to close on click */}
          <div 
            className="fixed inset-0 z-40 bg-black bg-opacity-10" 
            onClick={() => {
              // Check if this is new equipment
              if (isNewEquipment) {
                if (confirm('This equipment has not been saved. Are you sure you want to cancel?')) {
                  // Remove the unsaved equipment
                  if (facilityData) {
                    const updatedEquipment = facilityData.equipment.filter(
                      eq => eq.equipment_id !== editingEquipment.equipment_id
                    );
                    handleEquipmentUpdate(updatedEquipment);
                  }
                  setShowElementSettings(false);
                  setIsNewEquipment(false);
                }
              } else {
                setShowElementSettings(false);
              }
            }}
          />
          <div 
            className="fixed bg-white rounded-xl shadow-2xl z-50 flex flex-col"
            style={{
              width: '500px',
              maxHeight: '70vh',
              left: `${Math.min(Math.max(20, modalPosition.x - 250), window.innerWidth - 520)}px`,
              top: `${Math.min(Math.max(20, modalPosition.y), window.innerHeight - window.innerHeight * 0.7 - 40)}px`,
              background: 'linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 px-4 py-3 border-b border-gray-200 rounded-t-xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⚙️</span>
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">
                      {editingEquipment.type.charAt(0).toUpperCase() + editingEquipment.type.slice(1).replace(/_/g, ' ')} Settings
                    </h3>
                    <p className="text-xs text-gray-500">{editingEquipment.equipment_id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowElementSettings(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-white/50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto bg-white">
              <div className="space-y-3">
                {/* Basic Info */}
                <div className="bg-gray-50 p-2 rounded flex gap-4">
                  <p className="text-sm font-medium text-gray-600">Type: <span className="text-gray-900">{editingEquipment.type}</span></p>
                  <p className="text-sm font-medium text-gray-600">ID: <span className="text-gray-900">{editingEquipment.equipment_id}</span></p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label:
                  </label>
                  <input
                    type="text"
                    value={editingEquipment.label}
                    onChange={(e) => setEditingEquipment({
                      ...editingEquipment,
                      label: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      X Position:
                    </label>
                    <input
                      type="number"
                      value={editingEquipment.x.toFixed(1)}
                      onChange={(e) => setEditingEquipment({
                        ...editingEquipment,
                        x: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Y Position:
                    </label>
                    <input
                      type="number"
                      value={editingEquipment.y.toFixed(1)}
                      onChange={(e) => setEditingEquipment({
                        ...editingEquipment,
                        y: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Equipment-specific properties - Editable */}
                {editingEquipment.type === 'gasifier' && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">Gasifier Properties</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Chemical Type:</label>
                        <select
                          value={editingEquipment.config.chemical_type || ''}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, chemical_type: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select...</option>
                          <option value="Citronella Blend">Citronella Blend</option>
                          <option value="Essential Oils Blend">Essential Oils Blend</option>
                          <option value="CLO2">CLO2</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Placement Height:</label>
                        <select
                          value={editingEquipment.config.placement_height || ''}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, placement_height: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select...</option>
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Placement Strategy:</label>
                        <select
                          value={editingEquipment.config.placement_strategy || ''}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, placement_strategy: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select...</option>
                          <option value="Centralized Coverage">Centralized Coverage</option>
                          <option value="Perimeter Coverage">Perimeter Coverage</option>
                          <option value="Distributed Coverage">Distributed Coverage</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Directional Placement:</label>
                        <input
                          type="text"
                          value={editingEquipment.config.directional_placement || ''}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, directional_placement: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="e.g., Center-Center, Front-Left"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Effectiveness Area (sq ft):</label>
                        <input
                          type="number"
                          value={editingEquipment.config.effectiveness_radius ? Math.round(Math.PI * Math.pow(editingEquipment.config.effectiveness_radius, 2)) : facilityData?.facility_info.min_efficacious_gasifier_density_sqft_per_bag || 2000}
                          onChange={(e) => {
                            const sqft = parseFloat(e.target.value) || 2000;
                            const radius = Math.sqrt(sqft / Math.PI);
                            setEditingEquipment({
                              ...editingEquipment,
                              config: { ...editingEquipment.config, effectiveness_radius: radius }
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="Area in square feet"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Radius: {editingEquipment.config.effectiveness_radius ? editingEquipment.config.effectiveness_radius.toFixed(1) : Math.sqrt((facilityData?.facility_info.min_efficacious_gasifier_density_sqft_per_bag || 2000) / Math.PI).toFixed(1)} ft
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {editingEquipment.type === 'shelving' && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">Shelving Properties</h4>
                    <div className="space-y-3">
                      {/* Dimensions */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Width (feet):</label>
                          <input
                            type="number"
                            value={editingEquipment.config?.width || 40}
                            onChange={(e) => setEditingEquipment({
                              ...editingEquipment,
                              config: { ...editingEquipment.config, width: parseFloat(e.target.value) || 40 }
                            })}
                            min="4"
                            max={facilityData ? Math.floor(facilityData.facility_info.dimensions.width * 0.8) : 100}
                            step="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Depth (feet):</label>
                          <input
                            type="number"
                            value={editingEquipment.config?.height || 20}
                            onChange={(e) => setEditingEquipment({
                              ...editingEquipment,
                              config: { ...editingEquipment.config, height: parseFloat(e.target.value) || 20 }
                            })}
                            min="2"
                            max={facilityData ? Math.floor(facilityData.facility_info.dimensions.height * 0.8) : 50}
                            step="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      {/* Material Type - Multi-select */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Material Type:</label>
                        <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-3">
                          {['Wood', 'Metal', 'Wire', 'Plastic', 'Composite', 'Stainless Steel'].map(material => (
                            <label key={material} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={editingEquipment.config?.materials?.includes(material) || false}
                                onChange={(e) => {
                                  const currentMaterials = editingEquipment.config?.materials || [];
                                  const newMaterials = e.target.checked
                                    ? [...currentMaterials, material]
                                    : currentMaterials.filter((m: string) => m !== material);
                                  setEditingEquipment({
                                    ...editingEquipment,
                                    config: { ...editingEquipment.config, materials: newMaterials }
                                  });
                                }}
                                className="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700">{material}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      {/* Shelf Configuration */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Number of Shelves:</label>
                          <input
                            type="number"
                            value={editingEquipment.config?.shelf_count || 4}
                            onChange={(e) => setEditingEquipment({
                              ...editingEquipment,
                              config: { ...editingEquipment.config, shelf_count: parseInt(e.target.value) || 4 }
                            })}
                            min="1"
                            max="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Load Capacity (lbs/shelf):</label>
                          <input
                            type="number"
                            value={editingEquipment.config?.load_capacity || 50}
                            onChange={(e) => setEditingEquipment({
                              ...editingEquipment,
                              config: { ...editingEquipment.config, load_capacity: parseInt(e.target.value) || 50 }
                            })}
                            min="10"
                            max="500"
                            step="10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      
                      {/* Rotation Control */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Orientation:</label>
                        <div className="flex gap-2">
                          {[0, 90, 180, 270].map(angle => (
                            <button
                              key={angle}
                              type="button"
                              onClick={() => {
                                console.log('[SHELVING ROTATION] Modal rotation button clicked:', {
                                  equipment: editingEquipment.equipment_id,
                                  position: { x: editingEquipment.x, y: editingEquipment.y },
                                  dimensions: { 
                                    width: editingEquipment.config?.width || 40,
                                    height: editingEquipment.config?.height || 20
                                  },
                                  rotation: { current: editingEquipment.config?.rotation || 0, next: angle }
                                });
                                setEditingEquipment({
                                  ...editingEquipment,
                                  config: { ...editingEquipment.config, rotation: angle }
                                });
                              }}
                              className={`flex-1 py-2 px-3 rounded-md border transition-colors ${
                                (editingEquipment.config?.rotation || 0) === angle
                                  ? 'bg-blue-500 text-white border-blue-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {angle === 0 && '↑'}
                              {angle === 90 && '→'}
                              {angle === 180 && '↓'}
                              {angle === 270 && '←'}
                              <span className="ml-1 text-xs">{angle}°</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {editingEquipment.type === 'petri_dish' && editingEquipment.config && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-semibold mb-2">Petri Dish Properties</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Placement:</label>
                        <select
                          value={editingEquipment.config.placement || ''}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, placement: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select...</option>
                          <option value="Front-Left">Front-Left</option>
                          <option value="Front-Right">Front-Right</option>
                          <option value="Center-Center">Center-Center</option>
                          <option value="Back-Left">Back-Left</option>
                          <option value="Back-Right">Back-Right</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Placement Dynamics:</label>
                        <select
                          value={editingEquipment.config.placement_dynamics || ''}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, placement_dynamics: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select...</option>
                          <option value="Near Door">Near Door</option>
                          <option value="Near Port">Near Port</option>
                          <option value="Near Airflow In">Near Airflow In</option>
                          <option value="Near Airflow Out">Near Airflow Out</option>
                          <option value="Corner">Corner</option>
                          <option value="Central">Central</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fungicide Used:</label>
                        <select
                          value={editingEquipment.config.fungicide_used || ''}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, fungicide_used: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select...</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Water Schedule:</label>
                        <select
                          value={editingEquipment.config.surrounding_water_schedule || 'Daily'}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, surrounding_water_schedule: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="Daily">Daily</option>
                          <option value="Twice Daily">Twice Daily</option>
                          <option value="Every Other Day">Every Other Day</option>
                          <option value="Every Third Day">Every Third Day</option>
                          <option value="Weekly">Weekly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Plant Type:</label>
                        <select
                          value={editingEquipment.config.plant_type || 'Other Fresh Perishable'}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, plant_type: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="Other Fresh Perishable">Other Fresh Perishable</option>
                          <option value="Ornamental Annual">Ornamental Annual</option>
                          <option value="Leafy Greens">Leafy Greens</option>
                          <option value="Herbs">Herbs</option>
                          <option value="Berries">Berries</option>
                        </select>
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes:</label>
                        <textarea
                          value={editingEquipment.config.notes || ''}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { ...editingEquipment.config, notes: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={2}
                          placeholder="Additional notes..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editingEquipment.type === 'fan' && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Fan Properties</h4>
                    <div className="space-y-3">
                      {/* CFM Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Airflow (CFM):
                        </label>
                        <input
                          type="number"
                          value={editingEquipment.config?.magnitude_cfm || 1000}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { 
                              ...editingEquipment.config, 
                              magnitude_cfm: parseInt(e.target.value) || 1000 
                            }
                          })}
                          min="100"
                          max="10000"
                          step="100"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      
                      {/* Direction Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Airflow Direction (degrees):
                        </label>
                        <input
                          type="number"
                          value={editingEquipment.config?.direction || 0}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { 
                              ...editingEquipment.config, 
                              direction: parseInt(e.target.value) % 360 
                            }
                          })}
                          min="0"
                          max="359"
                          step="45"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <p className="text-xs text-gray-500 mt-1">0° = Right, 90° = Down, 180° = Left, 270° = Up</p>
                      </div>
                      
                      {/* Active Percentage */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Active Time (%):
                        </label>
                        <input
                          type="number"
                          value={editingEquipment.config?.percentage_of_time_blowing || 100}
                          onChange={(e) => setEditingEquipment({
                            ...editingEquipment,
                            config: { 
                              ...editingEquipment.config, 
                              percentage_of_time_blowing: Math.min(100, Math.max(0, parseInt(e.target.value) || 100))
                            }
                          })}
                          min="0"
                          max="100"
                          step="10"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editingEquipment.type === 'door' && editingEquipment.config && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-2">Door Properties</h4>
                    {editingEquipment.config.frequency_opened && (
                      <p className="text-sm"><span className="font-medium">Frequency:</span> {editingEquipment.config.frequency_opened}</p>
                    )}
                    {editingEquipment.config.average_duration_minutes && (
                      <p className="text-sm"><span className="font-medium">Avg Duration:</span> {editingEquipment.config.average_duration_minutes} min</p>
                    )}
                  </div>
                )}

                {/* Display all config properties dynamically */}
                {editingEquipment.config && Object.keys(editingEquipment.config).length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">All Properties</h4>
                    <div className="space-y-2">
                      {Object.entries(editingEquipment.config).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium text-gray-600">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                          </span>{' '}
                          <span className="text-gray-900">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value || '-')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw Config Data */}
                <details className="border-t pt-4">
                  <summary className="text-sm font-medium cursor-pointer hover:text-blue-600">
                    View Raw Configuration JSON
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(editingEquipment, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
            
            {/* Footer Actions */}
            <div className="border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex gap-2 rounded-b-xl flex-shrink-0">
              <button
                onClick={handleSaveEquipment}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1.5 rounded-md hover:from-blue-700 hover:to-blue-800 transition-all font-medium text-sm shadow-sm"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  if (isNewEquipment) {
                    // Remove the unsaved equipment
                    if (facilityData) {
                      const updatedEquipment = facilityData.equipment.filter(
                        eq => eq.equipment_id !== editingEquipment.equipment_id
                      );
                      handleEquipmentUpdate(updatedEquipment);
                    }
                  }
                  setShowElementSettings(false);
                  setIsNewEquipment(false);
                }}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm"
              >
                Cancel
              </button>
              {!isNewEquipment && (
                <button
                  onClick={handleDeleteEquipment}
                  className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-md hover:bg-red-50 hover:border-red-300 transition-all font-medium text-sm shadow-sm"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Site Settings Modal */}
      {showSiteSettings && editingSite && (
        <>
          {/* Backdrop to close on click */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowSiteSettings(false)}
          />
          <div className="fixed top-[10vh] left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg w-[600px] max-h-[80vh] z-50 flex flex-col">
            <div className="p-6 pb-0">
              <h3 className="text-lg font-semibold">Site Settings</h3>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site Name:
                </label>
                <input
                  type="text"
                  value={editingSite.name || ''}
                  onChange={(e) => setEditingSite({
                    ...editingSite,
                    name: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Length (ft):
                  </label>
                  <input
                    type="number"
                    value={editingSite.length || ''}
                    onChange={(e) => setEditingSite({
                      ...editingSite,
                      length: parseFloat(e.target.value) || 0,
                      square_footage: (parseFloat(e.target.value) || 0) * (editingSite.width || 0)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width (ft):
                  </label>
                  <input
                    type="number"
                    value={editingSite.width || ''}
                    onChange={(e) => setEditingSite({
                      ...editingSite,
                      width: parseFloat(e.target.value) || 0,
                      square_footage: (editingSite.length || 0) * (parseFloat(e.target.value) || 0)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (ft):
                  </label>
                  <input
                    type="number"
                    value={editingSite.height || ''}
                    onChange={(e) => setEditingSite({
                      ...editingSite,
                      height: parseFloat(e.target.value) || 0,
                      cubic_footage: (editingSite.length || 0) * (editingSite.width || 0) * (parseFloat(e.target.value) || 0)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Square Footage:
                  </label>
                  <input
                    type="number"
                    value={editingSite.square_footage || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cubic Footage:
                  </label>
                  <input
                    type="number"
                    value={editingSite.cubic_footage || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gasifier Coverage (sq ft per bag):
                </label>
                <input
                  type="number"
                  value={editingSite.min_efficacious_gasifier_density_sqft_per_bag || 2000}
                  onChange={(e) => setEditingSite({
                    ...editingSite,
                    min_efficacious_gasifier_density_sqft_per_bag: parseFloat(e.target.value) || 2000
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {/* Additional Site Metadata */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Additional Information</h4>
                
                {editingSite.type && (
                  <p className="text-sm"><span className="font-medium">Type:</span> {editingSite.type}</p>
                )}
                {editingSite.primary_function && (
                  <p className="text-sm"><span className="font-medium">Function:</span> {editingSite.primary_function}</p>
                )}
                {editingSite.construction_material && (
                  <p className="text-sm"><span className="font-medium">Material:</span> {editingSite.construction_material}</p>
                )}
                {editingSite.hvac_system_type && (
                  <p className="text-sm"><span className="font-medium">HVAC:</span> {editingSite.hvac_system_type}</p>
                )}
                {editingSite.ventilation_strategy && (
                  <p className="text-sm"><span className="font-medium">Ventilation:</span> {editingSite.ventilation_strategy}</p>
                )}
              </div>

              {/* Equipment List - Collapsible */}
              {facilityData && facilityData.equipment.length > 0 && (
                <details className="border-t pt-4">
                  <summary className="text-sm font-semibold cursor-pointer hover:text-blue-600 mb-3">
                    Equipment List ({facilityData.equipment.length} items)
                  </summary>
                  <div className="text-xs space-y-1 max-h-64 overflow-y-auto border rounded p-2">
                    {facilityData.equipment.map(eq => {
                      const isAtOrigin = eq.x === 0 && eq.y === 0;
                      const equipmentIcon = {
                        petri_dish: '🧫',
                        gasifier: '💨',
                        fan: '🌀',
                        shelving: '📚',
                        vent: '🔲',
                        sensor: '🔍',
                        door: '🚪'
                      }[eq.type] || '📦';
                      
                      return (
                        <div
                          key={eq.equipment_id}
                          className={`p-2 rounded flex items-center justify-between group ${
                            selectedEquipment?.equipment_id === eq.equipment_id
                              ? 'bg-blue-100 border-blue-300 border'
                              : isAtOrigin 
                                ? 'bg-red-50 border-red-200 border'
                                : 'hover:bg-gray-100'
                          }`}
                        >
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => {
                              // Select and center on equipment
                              handleEquipmentSelect(eq);
                              // Scroll map to center on equipment if needed
                              const mapElement = document.querySelector('.simple-facility-floor-plan');
                              if (mapElement) {
                                mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }}
                          >
                            <div className="font-medium flex items-center gap-1">
                              <span>{equipmentIcon}</span>
                              <span>{eq.label}</span>
                              {isAtOrigin && <span className="text-red-500 text-xs">(needs placement)</span>}
                            </div>
                            <div className="text-gray-500">
                              {eq.type} at ({eq.x.toFixed(1)}, {eq.y.toFixed(1)})
                            </div>
                          </div>
                          
                          {/* Action buttons - visible on hover */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Grab for placement button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Start ghost drag mode
                                setGhostDragEquipment(eq);
                                setSelectedEquipment(eq);
                                setSelectedEquipmentIds([eq.equipment_id]);
                                // Close site settings to see the map
                                setShowSiteSettings(false);
                                showToast(`Moving ${eq.label} - Click to place`);
                              }}
                              className="p-1 hover:bg-green-200 rounded"
                              title="Grab and move"
                            >
                              ✋
                            </button>
                            
                            {/* Bring to front button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const otherEquipment = facilityData.equipment.filter(
                                  item => item.equipment_id !== eq.equipment_id
                                );
                                handleEquipmentUpdate([...otherEquipment, eq]);
                                showToast(`Brought ${eq.label} to front`);
                              }}
                              className="p-1 hover:bg-blue-200 rounded"
                              title="Bring to front"
                            >
                              ⬆️
                            </button>
                            
                            {/* Send to back button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const otherEquipment = facilityData.equipment.filter(
                                  item => item.equipment_id !== eq.equipment_id
                                );
                                handleEquipmentUpdate([eq, ...otherEquipment]);
                                showToast(`Sent ${eq.label} to back`);
                              }}
                              className="p-1 hover:bg-purple-200 rounded"
                              title="Send to back"
                            >
                              ⬇️
                            </button>
                            
                            {/* Delete button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete ${eq.label}?`)) {
                                  const updatedEquipment = facilityData.equipment.filter(
                                    item => item.equipment_id !== eq.equipment_id
                                  );
                                  handleEquipmentUpdate(updatedEquipment);
                                  showToast(`Deleted ${eq.label}`);
                                }
                              }}
                              className="p-1 hover:bg-red-200 rounded"
                              title="Delete equipment"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

            </div>
            
            <div className="p-6 pt-0">
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveSiteSettings}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Save Settings
                </button>
                <button
                  onClick={() => setShowSiteSettings(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          {/* Invisible backdrop to catch clicks outside */}
          <div 
            className="fixed inset-0 z-50" 
            onContextMenu={(e) => e.preventDefault()}
          />
          <div
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[200px]"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              transform: 'translate(-10px, -10px)'
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {contextMenu.type === 'facility' ? (
              <>
                <button
                  onClick={() => handleContextMenuAction('site-settings')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <span className="text-gray-600">⚙️</span>
                  <span>Site Settings</span>
                </button>
                <div className="border-t border-gray-200 my-1" />
                <button
                  onClick={() => handleContextMenuAction('save')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <span className="text-gray-600">💾</span>
                  <span>Save Layout</span>
                </button>
                <button
                  onClick={() => handleContextMenuAction('paste')}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 ${
                    clipboard.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={clipboard.length === 0}
                >
                  <span className="text-gray-600">📋</span>
                  <span>Paste</span>
                  {clipboard.length > 0 && (
                    <span className="text-xs text-gray-500 ml-auto">
                      {clipboard.length} item{clipboard.length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="px-4 py-2 text-sm text-gray-500 font-medium">
                  {contextMenu.equipment?.label}
                </div>
                <div className="border-t border-gray-200 my-1" />
                <button
                  onClick={() => handleContextMenuAction('settings')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <span className="text-gray-600">⚙️</span>
                  <span>Settings</span>
                </button>
                <div className="border-t border-gray-200 my-1" />
                <button
                  onClick={() => handleContextMenuAction('copy')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <span className="text-gray-600">📑</span>
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => handleContextMenuAction('duplicate')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <span className="text-gray-600">📄</span>
                  <span>Duplicate</span>
                </button>
                <button
                  onClick={() => handleContextMenuAction('bring-to-front')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <span className="text-gray-600">⬆️</span>
                  <span>Bring to Front</span>
                </button>
                <button
                  onClick={() => handleContextMenuAction('send-to-back')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3"
                >
                  <span className="text-gray-600">⬇️</span>
                  <span>Send to Back</span>
                </button>
                <div className="border-t border-gray-200 my-1" />
                <button
                  onClick={() => handleContextMenuAction('delete')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-red-600"
                >
                  <span>🗑️</span>
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Clipboard Toast */}
      {showClipboardToast && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in">
          <span>✓</span>
          <span>{showClipboardToast}</span>
        </div>
      )}
      

      {/* Add animation styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default SimpleFacilityBuilder;