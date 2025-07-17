import React, { useState, useEffect, useRef } from 'react';
import { EnhancedFacilityFloorPlan } from '../components/mapping/EnhancedFacilityFloorPlan';
import { useFacilityMappingData } from '../hooks/useFacilityMappingData';
import { supabase } from '../lib/supabaseClient';
// Icon components - using inline SVGs instead of heroicons

interface Equipment {
  equipment_id: string;
  type: 'petri_dish' | 'gasifier' | 'sensor' | 'vent' | 'shelving' | 'door' | 'fan';
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  status: 'active' | 'inactive' | 'maintenance';
  config: {
    material?: string;
    [key: string]: any;
  };
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

const EnhancedFacilityMapPage: React.FC = () => {
  const [facilityData, setFacilityData] = useState<FacilityData | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [showElementSettings, setShowElementSettings] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [history, setHistory] = useState<FacilityData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [day, setDay] = useState(5);
  
  const { getFacilityDetails, loading, error } = useFacilityMappingData();

  // Load sites on mount
  useEffect(() => {
    console.log('EnhancedFacilityMapPage mounted');
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      console.log('Loading sites...');
      
      // First, let's check what company the user belongs to
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();
      
      if (userError) {
        console.error('Error getting user company:', userError);
      }
      console.log('User company ID:', userData?.company_id);
      
      // Try simpler query first
      const { data, error, count } = await supabase
        .from('sites')
        .select('*', { count: 'exact' });
      
      console.log('Sites query result:', { data, error, count });
      
      if (error) {
        console.error('Sites query error:', error);
        throw error;
      }
      
      setSites(data || []);
      console.log(`Loaded ${data?.length || 0} sites`);
      
      // Auto-select first site if available
      if (data && data.length > 0) {
        setSelectedSiteId(data[0].site_id);
        loadFacilityData(data[0].site_id);
      } else {
        console.warn('No sites found, using demo mode');
        // Create a demo site
        const demoSite = {
          site_id: 'demo-site-1',
          name: 'Demo Facility',
          facility_dimensions: { width: 120, height: 80, units: 'feet' },
          facility_layout: null,
          program_id: 'demo-program'
        };
        setSites([demoSite]);
        setSelectedSiteId(demoSite.site_id);
        loadFacilityData(demoSite.site_id);
      }
    } catch (err) {
      console.error('Error loading sites:', err);
      // Show a user-friendly message
      alert('Unable to load sites. Please check the console for details.');
    }
  };

  const loadFacilityData = async (siteId: string) => {
    try {
      const data = await getFacilityDetails(siteId);
      setFacilityData(data);
      addToHistory(data);
    } catch (err) {
      console.error('Error loading facility data:', err);
      // Use mock data if no real data
      const mockData = createMockFacilityData(siteId);
      setFacilityData(mockData);
      addToHistory(mockData);
    }
  };

  const createMockFacilityData = (siteId: string): FacilityData => ({
    facility_info: {
      site_id: siteId,
      name: "Test Facility",
      dimensions: { width: 120, height: 80, units: "feet" },
      layout: null
    },
    equipment: [
      { equipment_id: "p1", type: "petri_dish", label: "P1", x: 20, y: 30, z: 0, radius: 5, status: "active", config: {} },
      { equipment_id: "p2", type: "petri_dish", label: "P2", x: 50, y: 60, z: 0, radius: 5, status: "active", config: {} },
      { equipment_id: "p3", type: "petri_dish", label: "P3", x: 80, y: 50, z: 0, radius: 5, status: "active", config: {} },
      { equipment_id: "g1", type: "gasifier", label: "G1", x: 25, y: 55, z: 0, radius: 15, status: "active", config: {} },
      { equipment_id: "g2", type: "gasifier", label: "G2", x: 75, y: 25, z: 0, radius: 15, status: "active", config: {} },
      { equipment_id: "f1", type: "fan", label: "F1", x: 60, y: 15, z: 0, radius: 8, status: "active", config: {} },
      { equipment_id: "f2", type: "fan", label: "F2", x: 60, y: 45, z: 0, radius: 8, status: "active", config: {} },
      { equipment_id: "door1", type: "door", label: "Door 1", x: 0, y: 70, z: 0, radius: 0, status: "active", config: {} },
      { equipment_id: "door2", type: "door", label: "Door 2", x: 20, y: 0, z: 0, radius: 0, status: "active", config: {} },
      { equipment_id: "sh1", type: "shelving", label: "Shelving North", x: 60, y: 5, z: 0, radius: 0, status: "active", config: { material: "Stainless Steel" } },
      { equipment_id: "sh2", type: "shelving", label: "Shelving South", x: 60, y: 60, z: 0, radius: 0, status: "active", config: { material: "Stainless Steel" } },
      { equipment_id: "sh3", type: "shelving", label: "Shelving East", x: 100, y: 40, z: 0, radius: 0, status: "active", config: { material: "Stainless Steel" } },
    ],
    latest_contours: [],
    analytics: {
      total_growth: 2.34,
      effectiveness: 0.72,
      critical_zones: 3
    }
  });

  const addToHistory = (data: FacilityData) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(data)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setFacilityData(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setFacilityData(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  const handleToolSelect = (toolType: string) => {
    setSelectedTool(toolType);
    setSelectedEquipment(null);
  };

  const handleEquipmentClick = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setEditingEquipment({ ...equipment });
    setShowElementSettings(true);
    setSelectedTool(null);
  };

  const handleCanvasClick = (x: number, y: number) => {
    if (!selectedTool || !facilityData) return;

    const newEquipment: Equipment = {
      equipment_id: `${selectedTool}-${Date.now()}`,
      type: selectedTool as any,
      label: `New ${selectedTool.replace('_', ' ')}`,
      x,
      y,
      z: 0,
      radius: selectedTool === 'gasifier' ? 15 : selectedTool === 'fan' ? 8 : 5,
      status: 'active',
      config: {}
    };

    const updatedData = {
      ...facilityData,
      equipment: [...facilityData.equipment, newEquipment]
    };
    
    setFacilityData(updatedData);
    addToHistory(updatedData);
    setSelectedTool(null);
    
    // Auto-select new equipment for editing
    handleEquipmentClick(newEquipment);
  };

  const handleDeleteEquipment = () => {
    if (!selectedEquipment || !facilityData) return;

    const updatedData = {
      ...facilityData,
      equipment: facilityData.equipment.filter(eq => eq.equipment_id !== selectedEquipment.equipment_id)
    };
    
    setFacilityData(updatedData);
    addToHistory(updatedData);
    setSelectedEquipment(null);
    setShowElementSettings(false);
  };

  const handleSaveEquipment = () => {
    if (!editingEquipment || !facilityData) return;

    const updatedData = {
      ...facilityData,
      equipment: facilityData.equipment.map(eq => 
        eq.equipment_id === editingEquipment.equipment_id ? editingEquipment : eq
      )
    };
    
    setFacilityData(updatedData);
    addToHistory(updatedData);
    setShowElementSettings(false);
  };

  const handleSaveSite = async () => {
    if (!facilityData || !selectedSiteId) return;

    try {
      // Save facility layout
      const { error: layoutError } = await supabase
        .from('sites')
        .update({
          facility_layout: facilityData,
          facility_dimensions: facilityData.facility_info.dimensions,
          updated_at: new Date().toISOString()
        })
        .eq('site_id', selectedSiteId);

      if (layoutError) throw layoutError;

      // Save equipment
      const { error: deleteError } = await supabase
        .from('facility_equipment')
        .delete()
        .eq('site_id', selectedSiteId);

      if (deleteError) throw deleteError;

      const equipmentData = facilityData.equipment.map(eq => ({
        site_id: selectedSiteId,
        equipment_type: eq.type,
        label: eq.label,
        position_x: eq.x,
        position_y: eq.y,
        position_z: eq.z,
        effectiveness_radius: eq.radius,
        configuration: eq.config,
        status: eq.status
      }));

      const { error: insertError } = await supabase
        .from('facility_equipment')
        .insert(equipmentData);

      if (insertError) throw insertError;

      alert('Facility layout saved successfully!');
    } catch (err) {
      console.error('Error saving facility:', err);
      alert('Error saving facility layout');
    }
  };

  const toolbarItems = [
    { id: 'draw_airflow', label: 'Draw Airflow', icon: '🌬️' },
    { id: 'fan', label: 'Fan', icon: '🌀' },
    { id: 'shelving', label: 'Shelving', icon: '📦' },
    { id: 'petri_dish', label: 'Petri Dish', icon: '🧫' },
    { id: 'gasifier', label: 'Gasifier', icon: '💨' },
    { id: 'vent', label: 'Vent', icon: '🔲' },
  ];

  return (
    <div className="enhanced-facility-map-page h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Facility + Items + Sensors + Interventions
            </h1>
            <p className="text-lg text-gray-600 mt-1">Day {day}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              className="px-4 py-2 border border-gray-300 rounded-md"
              value={selectedSiteId || ''}
              onChange={(e) => {
                setSelectedSiteId(e.target.value);
                loadFacilityData(e.target.value);
              }}
            >
              <option value="">Select a site...</option>
              {sites.map(site => (
                <option key={site.site_id} value={site.site_id}>
                  {site.name}
                </option>
              ))}
            </select>
            
            <input
              type="number"
              value={day}
              onChange={(e) => setDay(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md"
              min="1"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main Canvas Area */}
        <div className="flex-1 relative bg-gray-100 p-6">
          {facilityData && (
            <EnhancedFacilityFloorPlan
              facilityData={facilityData}
              onEquipmentClick={handleEquipmentClick}
              onCanvasClick={handleCanvasClick}
              selectedTool={selectedTool}
              selectedEquipment={selectedEquipment}
              width={1200}
              height={700}
              day={day}
            />
          )}

          {/* Element Settings Panel */}
          {showElementSettings && editingEquipment && (
            <div className="absolute top-6 right-6 bg-white rounded-lg shadow-lg p-6 w-80">
              <h3 className="text-lg font-semibold mb-4">Element Settings</h3>
              
              <div className="space-y-4">
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

                {editingEquipment.type === 'shelving' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Material:
                    </label>
                    <input
                      type="text"
                      value={editingEquipment.config.material || ''}
                      onChange={(e) => setEditingEquipment({
                        ...editingEquipment,
                        config: { ...editingEquipment.config, material: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveEquipment}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowElementSettings(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 space-y-6">
          {/* Toolbar */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-800 mb-3">📊 Toolbar</h3>
            <div className="space-y-2">
              {toolbarItems.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                    selectedTool === tool.id
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{tool.icon}</span>
                  <span className="font-medium">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Control */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Control</h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 disabled:opacity-50"
                >
                  <span>↶</span>
                  Undo
                </button>
                <button
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 disabled:opacity-50"
                >
                  Redo
                  <span>↷</span>
                </button>
              </div>

              <button
                onClick={handleDeleteEquipment}
                disabled={!selectedEquipment}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50"
              >
                <span>🗑️</span>
                Delete
              </button>

              <button
                onClick={handleSaveSite}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <span>💾</span>
                Save Site
              </button>
            </div>
          </div>

          {/* Customize */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Customize</h3>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
              <span>⚙️</span>
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedFacilityMapPage;