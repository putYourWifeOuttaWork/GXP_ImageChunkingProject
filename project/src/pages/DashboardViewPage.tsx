import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit, Share2, Settings, ArrowLeft } from 'lucide-react';
import { DashboardService } from '../services/dashboardService';
import { Dashboard, DashboardWidget, DashboardPermissions } from '../types/reporting/dashboardTypes';
import { DashboardViewer } from '../components/dashboards/DashboardViewer';
import Button from '../components/common/Button';
import LoadingScreen from '../components/common/LoadingScreen';
import { useAuthStore } from '../stores/authStore';

function DashboardViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [permissions, setPermissions] = useState<DashboardPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadDashboard();
    }
  }, [id]);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const [dashboardResult, widgetsResult, permissionsResult] = await Promise.all([
        DashboardService.getDashboard(id!),
        DashboardService.getWidgets(id!),
        DashboardService.getPermissions(id!)
      ]);

      if (dashboardResult.error) throw dashboardResult.error;
      if (widgetsResult.error) throw widgetsResult.error;
      if (permissionsResult.error) throw permissionsResult.error;

      setDashboard(dashboardResult.data);
      setWidgets(widgetsResult.data || []);
      setPermissions(permissionsResult.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingScreen />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {error || 'Dashboard not found'}
          </h2>
          <p className="text-gray-600 mb-4">
            The dashboard you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button
            variant="primary"
            onClick={() => navigate('/dashboards')}
          >
            Back to Dashboards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              icon={<ArrowLeft size={20} />}
              onClick={() => navigate('/dashboards')}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{dashboard.name}</h1>
              {dashboard.description && (
                <p className="text-sm text-gray-600 mt-1">{dashboard.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {permissions?.canEdit && (
              <Button
                variant="ghost"
                icon={<Edit size={20} />}
                onClick={() => navigate(`/dashboards/${id}/edit`)}
              >
                Edit
              </Button>
            )}
            
            {permissions?.canShare && (
              <Button
                variant="ghost"
                icon={<Share2 size={20} />}
                onClick={() => {/* Implement share modal */}}
              >
                Share
              </Button>
            )}
            
            <Button
              variant="ghost"
              icon={<Settings size={20} />}
              onClick={() => {/* Implement settings modal */}}
            >
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Viewer */}
      <div className="flex-1 overflow-hidden">
        <DashboardViewer
          dashboard={dashboard}
          widgets={widgets}
          onRefresh={loadDashboard}
        />
      </div>
    </div>
  );
}

export default DashboardViewPage;