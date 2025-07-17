import React, { useState, useEffect } from 'react';
import { FacilityFloorPlan } from '../components/mapping/FacilityFloorPlan';
import { useFacilityMappingData } from '../hooks/useFacilityMappingData';
import { supabase } from '../lib/supabaseClient';

// Mock data for testing the facility floor plan
const mockFacilityData = {
  facility_info: {
    site_id: "test-site-1",
    name: "Test Facility A",
    dimensions: { width: 100, height: 80, units: "meters" },
    layout: null
  },
  equipment: [
    {
      equipment_id: "eq-1",
      type: "petri_dish" as const,
      label: "Petri Station 1",
      x: 20,
      y: 30,
      z: 0,
      radius: 5,
      status: "active" as const,
      config: {}
    },
    {
      equipment_id: "eq-2",
      type: "petri_dish" as const,
      label: "Petri Station 2",
      x: 45,
      y: 25,
      z: 0,
      radius: 5,
      status: "active" as const,
      config: {}
    },
    {
      equipment_id: "eq-3",
      type: "gasifier" as const,
      label: "Gasifier Unit A",
      x: 70,
      y: 50,
      z: 0,
      radius: 15,
      status: "active" as const,
      config: {}
    },
    {
      equipment_id: "eq-4",
      type: "sensor" as const,
      label: "Sensor 1",
      x: 30,
      y: 60,
      z: 0,
      radius: 0,
      status: "active" as const,
      config: {}
    },
    {
      equipment_id: "eq-5",
      type: "vent" as const,
      label: "Vent 1",
      x: 15,
      y: 15,
      z: 0,
      radius: 8,
      status: "active" as const,
      config: {}
    },
    {
      equipment_id: "eq-6",
      type: "shelving" as const,
      label: "Storage A",
      x: 85,
      y: 20,
      z: 0,
      radius: 0,
      status: "active" as const,
      config: {}
    },
    {
      equipment_id: "eq-7",
      type: "door" as const,
      label: "Main Door",
      x: 50,
      y: 5,
      z: 0,
      radius: 0,
      status: "active" as const,
      config: {}
    }
  ],
  latest_contours: [
    { x: 25, y: 35, intensity: 0.8, reduction_rate: 0.1 },
    { x: 40, y: 30, intensity: 0.6, reduction_rate: 0.15 },
    { x: 55, y: 45, intensity: 0.9, reduction_rate: 0.05 },
    { x: 35, y: 55, intensity: 0.4, reduction_rate: 0.2 },
    { x: 60, y: 65, intensity: 0.7, reduction_rate: 0.08 },
    { x: 20, y: 20, intensity: 0.3, reduction_rate: 0.25 },
    { x: 75, y: 35, intensity: 0.5, reduction_rate: 0.18 },
    { x: 65, y: 25, intensity: 0.2, reduction_rate: 0.3 },
    { x: 30, y: 70, intensity: 0.6, reduction_rate: 0.12 },
    { x: 80, y: 60, intensity: 0.4, reduction_rate: 0.22 }
  ],
  analytics: {
    total_growth: 2.34,
    effectiveness: 0.72,
    critical_zones: 3,
    projections: {
      "24h": 2.8,
      "7d": 3.2,
      "30d": 4.1
    }
  }
};

export const TestFacilityMapPage: React.FC = () => {
  const [facilityData, setFacilityData] = useState<any>(mockFacilityData);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(true);
  const { getFacilityDetails, loading, error } = useFacilityMappingData();

  // Load available sites
  useEffect(() => {
    const loadSites = async () => {
      try {
        const { data, error } = await supabase
          .from('sites')
          .select('site_id, name, latitude, longitude')
          .limit(10);
        
        if (error) {
          console.error('Error loading sites:', error);
        } else {
          setSites(data || []);
        }
      } catch (err) {
        console.error('Error loading sites:', err);
      }
    };

    loadSites();
  }, []);

  const handleSiteChange = async (siteId: string) => {
    setSelectedSiteId(siteId);
    
    if (siteId && !useMockData) {
      try {
        const data = await getFacilityDetails(siteId);
        setFacilityData(data);
      } catch (err) {
        console.error('Error loading facility data:', err);
      }
    }
  };

  const handleEquipmentClick = (equipment: any) => {
    alert(`Equipment clicked: ${equipment.label}\nType: ${equipment.type}\nStatus: ${equipment.status}`);
  };

  const handleDataModeChange = (useMock: boolean) => {
    setUseMockData(useMock);
    if (useMock) {
      setFacilityData(mockFacilityData);
    } else if (selectedSiteId) {
      handleSiteChange(selectedSiteId);
    }
  };

  return (
    <div className="test-facility-map-page" style={{ padding: '20px' }}>
      <div className="page-header" style={{ marginBottom: '30px' }}>
        <h1>Individual Facility Map Test</h1>
        <p>Testing the FacilityFloorPlan component with interactive equipment and mold growth contours.</p>
      </div>

      {/* Controls */}
      <div className="controls-panel" style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div className="row">
          <div className="col-md-4">
            <label className="form-label">Data Mode:</label>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="dataMode"
                id="mockData"
                checked={useMockData}
                onChange={() => handleDataModeChange(true)}
              />
              <label className="form-check-label" htmlFor="mockData">
                Mock Data (Recommended for testing)
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="dataMode"
                id="realData"
                checked={!useMockData}
                onChange={() => handleDataModeChange(false)}
              />
              <label className="form-check-label" htmlFor="realData">
                Real Data from Database
              </label>
            </div>
          </div>

          {!useMockData && (
            <div className="col-md-4">
              <label className="form-label">Select Site:</label>
              <select
                className="form-select"
                value={selectedSiteId || ''}
                onChange={(e) => handleSiteChange(e.target.value)}
              >
                <option value="">Select a site...</option>
                {sites.map((site) => (
                  <option key={site.site_id} value={site.site_id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="col-md-4">
            <label className="form-label">Current Facility:</label>
            <p className="form-control-plaintext">
              {facilityData?.facility_info?.name || 'No facility selected'}
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {loading && (
        <div className="alert alert-info">
          <div className="d-flex align-items-center">
            <div className="spinner-border spinner-border-sm me-2" role="status"></div>
            Loading facility data...
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Facility Stats */}
      {facilityData && (
        <div className="facility-stats" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '20px'
        }}>
          <div className="stat-card" style={{
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #dee2e6'
          }}>
            <h6 className="text-muted">Total Growth Index</h6>
            <h4 style={{ color: '#dc3545' }}>
              {facilityData.analytics?.total_growth?.toFixed(2) || 'N/A'}
            </h4>
          </div>

          <div className="stat-card" style={{
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #dee2e6'
          }}>
            <h6 className="text-muted">Effectiveness</h6>
            <h4 style={{ color: '#28a745' }}>
              {((facilityData.analytics?.effectiveness || 0) * 100).toFixed(1)}%
            </h4>
          </div>

          <div className="stat-card" style={{
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #dee2e6'
          }}>
            <h6 className="text-muted">Critical Zones</h6>
            <h4 style={{ color: '#ffc107' }}>
              {facilityData.analytics?.critical_zones || 0}
            </h4>
          </div>

          <div className="stat-card" style={{
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #dee2e6'
          }}>
            <h6 className="text-muted">Equipment Count</h6>
            <h4 style={{ color: '#17a2b8' }}>
              {facilityData.equipment?.length || 0}
            </h4>
          </div>
        </div>
      )}

      {/* Main Facility Map */}
      {facilityData && (
        <div className="facility-map-container" style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}>
          <FacilityFloorPlan
            facilityData={facilityData}
            onEquipmentClick={handleEquipmentClick}
            width={1200}
            height={600}
            showContours={true}
            showEffectiveness={true}
          />
        </div>
      )}

      {/* Instructions */}
      <div className="instructions" style={{
        backgroundColor: '#e9ecef',
        padding: '15px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h5>Instructions:</h5>
        <ul>
          <li>Click on equipment to see details</li>
          <li>Use mouse wheel to zoom in/out</li>
          <li>Drag to pan around the facility</li>
          <li>Red areas show mold growth intensity</li>
          <li>Green circles show gasifier effectiveness zones</li>
          <li>Different equipment types have different colors and shapes</li>
        </ul>
      </div>
    </div>
  );
};