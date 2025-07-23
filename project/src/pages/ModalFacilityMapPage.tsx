import React, { useState, useEffect } from 'react';
import { ModalFacilityFloorPlan } from '../components/mapping/ModalFacilityFloorPlan';
import { useFacilityMappingData } from '../hooks/useFacilityMappingData';
import { supabase } from '../lib/supabaseClient';
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

const ModalFacilityMapPage: React.FC = () => {
  const [mode, setMode] = useState<MapMode>('analysis');
  const [facilityData, setFacilityData] = useState<FacilityData | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [showElementSettings, setShowElementSettings] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);

  // Load sites on mount
  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
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

  // Load facility data when site or mode changes
  useEffect(() => {
    if (selectedSiteId) {
      if (mode === 'analysis') {
        loadAnalysisData(selectedSiteId, selectedDate);
      } else {
        loadEditData(selectedSiteId);
      }
    }
  }, [selectedSiteId, mode, selectedDate]);

  const loadAnalysisData = async (siteId: string, date: Date) => {
    setIsLoading(true);
    try {
      // Load site data
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('site_id', siteId)
        .single();

      if (siteError) throw siteError;

      // Load observations for the selected date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: observations, error: obsError } = await supabase
        .from('petri_observations')
        .select(`
          *,
          submissions!inner (
            site_id,
            submission_date
          )
        `)
        .eq('submissions.site_id', siteId)
        .gte('submissions.submission_date', startOfDay.toISOString())
        .lte('submissions.submission_date', endOfDay.toISOString());

      if (obsError) console.error('Error loading observations:', obsError);

      // Create facility data with observations
      const facilityData: FacilityData = {
        facility_info: {
          site_id: siteData.site_id,
          name: siteData.name,
          dimensions: siteData.facility_dimensions || { width: 120, height: 80, units: 'feet' },
          layout: siteData.facility_layout
        },
        equipment: siteData.facility_layout?.equipment || [],
        observations: observations || [],
        latest_contours: generateContoursFromObservations(observations || [], siteData.facility_layout?.equipment || []),
        analytics: calculateAnalytics(observations || [])
      };

      setFacilityData(facilityData);

      // Load available dates with observations
      loadAvailableDates(siteId);
    } catch (err) {
      console.error('Error loading analysis data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEditData = async (siteId: string) => {
    setIsLoading(true);
    try {
      const { data: siteData, error } = await supabase
        .from('sites')
        .select('*')
        .eq('site_id', siteId)
        .single();

      if (error) throw error;

      const facilityData: FacilityData = {
        facility_info: {
          site_id: siteData.site_id,
          name: siteData.name,
          dimensions: siteData.facility_dimensions || { width: 120, height: 80, units: 'feet' },
          layout: siteData.facility_layout
        },
        equipment: siteData.facility_layout?.equipment || []
      };

      setFacilityData(facilityData);
    } catch (err) {
      console.error('Error loading edit data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableDates = async (siteId: string) => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('submission_date')
        .eq('site_id', siteId)
        .order('submission_date', { ascending: false });

      if (error) throw error;

      const uniqueDates = Array.from(new Set(
        data?.map(d => new Date(d.submission_date).toDateString()) || []
      )).map(dateStr => new Date(dateStr));

      setAvailableDates(uniqueDates);
    } catch (err) {
      console.error('Error loading dates:', err);
    }
  };

  const generateContoursFromObservations = (observations: any[], equipment: Equipment[]) => {
    // Generate contour data based on petri observations
    const contours: any[] = [];
    
    observations.forEach(obs => {
      if (obs.growth_index && obs.x_position !== null && obs.y_position !== null) {
        contours.push({
          x: obs.x_position,
          y: obs.y_position,
          intensity: obs.growth_index / 10, // Normalize to 0-1
          observation_id: obs.observation_id
        });
      }
    });

    return contours;
  };

  const calculateAnalytics = (observations: any[]) => {
    const totalGrowth = observations.reduce((sum, obs) => sum + (obs.growth_index || 0), 0);
    const avgGrowth = observations.length > 0 ? totalGrowth / observations.length : 0;
    const criticalZones = observations.filter(obs => (obs.growth_index || 0) > 7).length;

    return {
      total_growth: totalGrowth,
      average_growth: avgGrowth,
      critical_zones: criticalZones,
      observation_count: observations.length
    };
  };

  const handleSaveLayout = async () => {
    if (!facilityData || !selectedSiteId) return;

    setIsSaving(true);
    try {
      const layoutToSave = {
        equipment: facilityData.equipment,
        lastModified: new Date().toISOString(),
        version: '1.0'
      };

      const { error } = await supabase
        .from('sites')
        .update({
          facility_layout: layoutToSave,
          facility_dimensions: facilityData.facility_info.dimensions,
          updated_at: new Date().toISOString()
        })
        .eq('site_id', selectedSiteId);

      if (error) throw error;

      alert('Facility layout saved successfully!');
    } catch (err) {
      console.error('Error saving layout:', err);
      alert('Error saving facility layout');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEquipmentUpdate = (equipment: Equipment[]) => {
    if (!facilityData) return;
    setFacilityData({
      ...facilityData,
      equipment
    });
  };

  const handleToolSelect = (toolType: string) => {
    setSelectedTool(toolType);
    setSelectedEquipment(null);
  };

  const handleEquipmentClick = (equipment: Equipment) => {
    if (mode === 'edit') {
      setSelectedEquipment(equipment);
      setEditingEquipment({ ...equipment });
      setShowElementSettings(true);
    }
  };

  const handleCanvasClick = (x: number, y: number) => {
    if (mode !== 'edit' || !selectedTool || !facilityData) return;

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

    handleEquipmentUpdate([...facilityData.equipment, newEquipment]);
    setSelectedTool(null);
  };

  const toolbarItems = [
    { id: 'petri_dish', label: 'Petri Dish', icon: '🧫' },
    { id: 'gasifier', label: 'Gasifier', icon: '💨' },
    { id: 'fan', label: 'Fan', icon: '🌀' },
    { id: 'shelving', label: 'Shelving', icon: '📦' },
    { id: 'vent', label: 'Vent', icon: '🔲' },
    { id: 'sensor', label: 'Sensor', icon: '📡' },
  ];

  return (
    <div className="modal-facility-map-page h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              Facility Mapping System
            </h1>
            
            {/* Mode Toggle */}
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => setMode('analysis')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${
                  mode === 'analysis'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                📊 Analysis Mode
              </button>
              <button
                onClick={() => setMode('edit')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${
                  mode === 'edit'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                ✏️ Edit Mode
              </button>
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
                  {site.name} ({site.square_footage} sq ft)
                </option>
              ))}
            </select>

            {mode === 'analysis' && (
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-md"
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main Canvas Area */}
        <div className="flex-1 relative bg-gray-100 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="sr-only">Loading...</span>
                </div>
                <p className="mt-2">Loading facility data...</p>
              </div>
            </div>
          ) : facilityData ? (
            <ModalFacilityFloorPlan
              facilityData={facilityData}
              mode={mode}
              onEquipmentClick={handleEquipmentClick}
              onCanvasClick={handleCanvasClick}
              onEquipmentUpdate={handleEquipmentUpdate}
              selectedTool={selectedTool}
              selectedEquipment={selectedEquipment}
              width={1200}
              height={700}
              selectedDate={selectedDate}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Select a site to view the facility map</p>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 space-y-6">
          {mode === 'analysis' ? (
            <>
              {/* Analysis Mode Info */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">📊 Analysis Mode</h3>
                <p className="text-sm text-blue-700 mb-3">
                  View facility snapshots based on observation data for the selected date.
                </p>
                
                {facilityData?.analytics && (
                  <div className="space-y-2">
                    <div className="bg-white rounded p-3">
                      <div className="text-sm text-gray-600">Total Observations</div>
                      <div className="text-xl font-bold text-gray-900">
                        {facilityData.analytics.observation_count}
                      </div>
                    </div>
                    <div className="bg-white rounded p-3">
                      <div className="text-sm text-gray-600">Average Growth Index</div>
                      <div className="text-xl font-bold text-gray-900">
                        {facilityData.analytics.average_growth.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white rounded p-3">
                      <div className="text-sm text-gray-600">Critical Zones</div>
                      <div className="text-xl font-bold text-red-600">
                        {facilityData.analytics.critical_zones}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Available Dates */}
              {availableDates.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Available Dates</h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {availableDates.map(date => (
                      <button
                        key={date.toISOString()}
                        onClick={() => setSelectedDate(date)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          date.toDateString() === selectedDate.toDateString()
                            ? 'bg-blue-100 text-blue-700'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {format(date, 'MMM d, yyyy')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Edit Mode Toolbar */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-3">✏️ Edit Mode</h3>
                <p className="text-sm text-green-700 mb-3">
                  Design your facility layout by placing equipment.
                </p>
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

              {/* Save Button */}
              <button
                onClick={handleSaveLayout}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm" />
                    Saving...
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    Save Layout
                  </>
                )}
              </button>
            </>
          )}

          {/* Legend */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Legend</h3>
            <div className="space-y-2 text-sm">
              {mode === 'analysis' ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-600"></div>
                    <span>High Growth (7-10)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                    <span>Medium Growth (4-6)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
                    <span>Low Growth (1-3)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span>No Growth (0)</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gray-500"></div>
                    <span>Petri Dish</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-cyan-600"></div>
                    <span>Gasifier</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                    <span>Fan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-600"></div>
                    <span>Shelving</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalFacilityMapPage;