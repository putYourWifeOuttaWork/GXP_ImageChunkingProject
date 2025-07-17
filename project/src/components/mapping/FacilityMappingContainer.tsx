import React, { useState, useEffect } from 'react';
import { GlobalFacilityMap } from './GlobalFacilityMap';
import { FacilityFloorPlan } from './FacilityFloorPlan';
import { useFacilityMappingData } from '../../hooks/useFacilityMappingData';

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

interface ViewState {
  mode: 'global' | 'facility';
  selectedFacility: FacilityData | null;
}

export const FacilityMappingContainer: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>({
    mode: 'global',
    selectedFacility: null
  });
  
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [facilityData, setFacilityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { 
    getGlobalFacilities, 
    getFacilityDetails, 
    generateContours,
    loading: hookLoading,
    error: hookError 
  } = useFacilityMappingData();

  // Load global facilities on component mount
  useEffect(() => {
    const loadGlobalData = async () => {
      try {
        setLoading(true);
        const globalData = await getGlobalFacilities();
        setCompanies(globalData.companies || []);
        setError(null);
      } catch (err) {
        console.error('Error loading global facilities:', err);
        setError('Failed to load facility data');
      } finally {
        setLoading(false);
      }
    };

    loadGlobalData();
  }, []);

  // Load facility details when switching to facility view
  useEffect(() => {
    const loadFacilityData = async () => {
      if (viewState.mode === 'facility' && viewState.selectedFacility) {
        try {
          setLoading(true);
          const details = await getFacilityDetails(viewState.selectedFacility.site_id);
          setFacilityData(details);
          setError(null);
        } catch (err) {
          console.error('Error loading facility details:', err);
          setError('Failed to load facility details');
        } finally {
          setLoading(false);
        }
      }
    };

    loadFacilityData();
  }, [viewState.mode, viewState.selectedFacility]);

  const handleFacilityClick = (facility: FacilityData) => {
    setViewState({
      mode: 'facility',
      selectedFacility: facility
    });
  };

  const handleBackToGlobal = () => {
    setViewState({
      mode: 'global',
      selectedFacility: null
    });
    setFacilityData(null);
  };

  const handleEquipmentClick = (equipment: any) => {
    console.log('Equipment clicked:', equipment);
    // Here you could open a modal or sidebar with equipment details
  };

  const handleRefreshContours = async () => {
    if (viewState.selectedFacility) {
      try {
        setLoading(true);
        await generateContours(viewState.selectedFacility.site_id);
        // Reload facility data to get updated contours
        const updatedDetails = await getFacilityDetails(viewState.selectedFacility.site_id);
        setFacilityData(updatedDetails);
        setError(null);
      } catch (err) {
        console.error('Error refreshing contours:', err);
        setError('Failed to refresh contour data');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="facility-mapping-container">
        <div className="loading-spinner" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          fontSize: '18px'
        }}>
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span style={{ marginLeft: '10px' }}>Loading facility data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="facility-mapping-container">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">Error Loading Facility Data</h4>
          <p>{error}</p>
          <button 
            className="btn btn-outline-danger" 
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="facility-mapping-container">
      {/* Navigation Header */}
      <div className="mapping-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6'
      }}>
        <div className="navigation-breadcrumb">
          <h2 style={{ margin: 0 }}>
            {viewState.mode === 'global' ? (
              'Global Facility Overview'
            ) : (
              <>
                <button 
                  className="btn btn-link p-0 me-2"
                  onClick={handleBackToGlobal}
                  style={{ textDecoration: 'none' }}
                >
                  ← Global
                </button>
                {viewState.selectedFacility?.name}
              </>
            )}
          </h2>
        </div>
        
        <div className="mapping-controls">
          {viewState.mode === 'facility' && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={handleRefreshContours}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Contours'}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="mapping-content" style={{ padding: '20px' }}>
        {viewState.mode === 'global' ? (
          <GlobalFacilityMap
            companies={companies}
            onFacilityClick={handleFacilityClick}
            width={1200}
            height={600}
          />
        ) : (
          facilityData && (
            <div>
              <div className="facility-summary" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px',
                marginBottom: '20px'
              }}>
                <div className="stat-card" style={{
                  backgroundColor: 'white',
                  padding: '15px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <h5>Total Growth Index</h5>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                    {facilityData.analytics?.total_growth?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                
                <div className="stat-card" style={{
                  backgroundColor: 'white',
                  padding: '15px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <h5>Effectiveness</h5>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                    {((facilityData.analytics?.effectiveness || 0) * 100).toFixed(1)}%
                  </p>
                </div>
                
                <div className="stat-card" style={{
                  backgroundColor: 'white',
                  padding: '15px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <h5>Critical Zones</h5>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                    {facilityData.analytics?.critical_zones || 0}
                  </p>
                </div>
                
                <div className="stat-card" style={{
                  backgroundColor: 'white',
                  padding: '15px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <h5>Equipment Count</h5>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                    {facilityData.equipment?.length || 0}
                  </p>
                </div>
              </div>

              <FacilityFloorPlan
                facilityData={facilityData}
                onEquipmentClick={handleEquipmentClick}
                width={1200}
                height={600}
                showContours={true}
                showEffectiveness={true}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
};