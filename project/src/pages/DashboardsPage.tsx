import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Grid, 
  List, 
  MoreVertical,
  Eye,
  Edit,
  Share2,
  Trash2,
  Copy,
  Clock,
  Users,
  BarChart3,
  TrendingUp,
  Calendar,
  Star,
  Filter
} from 'lucide-react';
import { DashboardService } from '../services/dashboardService';
import { Dashboard, DashboardTemplate } from '../types/reporting/dashboardTypes';
import Button from '../components/common/Button';
import LoadingScreen from '../components/common/LoadingScreen';
import { useAuthStore } from '../stores/authStore';
import { formatDistanceToNow } from 'date-fns';

interface DashboardCardProps {
  dashboard: Dashboard & { _count?: { dashboard_widgets: number } };
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  viewMode: 'grid' | 'list';
}

const DashboardCard: React.FC<DashboardCardProps> = ({ 
  dashboard, 
  onEdit, 
  onDelete, 
  onDuplicate,
  onShare,
  viewMode 
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const widgetCount = dashboard._count?.dashboard_widgets || 0;

  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="p-3 bg-primary-100 rounded-lg">
              <BarChart3 size={24} className="text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 
                className="text-lg font-semibold text-gray-900 truncate cursor-pointer hover:text-primary-600"
                onClick={() => navigate(`/dashboards/${dashboard.id}`)}
              >
                {dashboard.name}
              </h3>
              {dashboard.description && <p className="text-sm text-gray-600 truncate">{dashboard.description}</p>}
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center">
                <Grid size={16} className="mr-1" />
                {widgetCount} widgets
              </div>
              <div className="flex items-center">
                <Eye size={16} className="mr-1" />
                {dashboard.viewCount || 0} views
              </div>
              <div className="flex items-center">
                <Clock size={16} className="mr-1" />
                {formatDistanceToNow(new Date(dashboard.updatedAt || dashboard.createdAt), { addSuffix: true })}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Eye size={16} />}
              onClick={() => navigate(`/dashboards/${dashboard.id}`)}
            >
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Edit size={16} />}
              onClick={onEdit}
            >
              Edit
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                icon={<MoreVertical size={16} />}
                onClick={() => setShowMenu(!showMenu)}
              />
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => {
                      onShare();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center"
                  >
                    <Share2 size={16} className="mr-2" />
                    Share
                  </button>
                  <button
                    onClick={() => {
                      onDuplicate();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center"
                  >
                    <Copy size={16} className="mr-2" />
                    Duplicate
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center text-red-600"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      <div 
        className="h-48 bg-gradient-to-br from-primary-100 to-primary-200 p-6 cursor-pointer relative"
        onClick={() => navigate(`/dashboards/${dashboard.id}`)}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <BarChart3 size={120} className="text-primary-600" />
        </div>
        <div className="relative">
          <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
            {dashboard.name}
          </h3>
          {dashboard.description && (
            <p className="text-sm text-gray-700 line-clamp-2">
              {dashboard.description}
            </p>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div className="flex items-center">
            <Grid size={16} className="mr-1" />
            {widgetCount} widgets
          </div>
          <div className="flex items-center">
            <Eye size={16} className="mr-1" />
            {dashboard.viewCount || 0} views
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Updated {formatDistanceToNow(new Date(dashboard.updatedAt || dashboard.createdAt), { addSuffix: true })}
          </div>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              icon={<Eye size={16} />}
              onClick={() => navigate(`/dashboards/${dashboard.id}`)}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Edit size={16} />}
              onClick={onEdit}
            />
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                icon={<MoreVertical size={16} />}
                onClick={() => setShowMenu(!showMenu)}
              />
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => {
                      onShare();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center"
                  >
                    <Share2 size={16} className="mr-2" />
                    Share
                  </button>
                  <button
                    onClick={() => {
                      onDuplicate();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center"
                  >
                    <Copy size={16} className="mr-2" />
                    Duplicate
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center text-red-600"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'mine' | 'shared'>('all');
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    loadDashboards();
    loadTemplates();
  }, [filterBy]);

  const loadDashboards = async () => {
    setIsLoading(true);
    try {
      const filters: any = {};
      if (filterBy === 'mine' && user) {
        filters.userId = user.id;
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }

      const { data, error } = await DashboardService.listDashboards(filters);
      if (error) throw error;
      
      setDashboards(data || []);
    } catch (err) {
      console.error('Error loading dashboards:', err);
      setError('Failed to load dashboards');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await DashboardService.getTemplates();
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const handleCreateDashboard = (templateId?: string) => {
    if (templateId) {
      // Create from template
      navigate(`/dashboards/new?template=${templateId}`);
    } else {
      navigate('/dashboards/new');
    }
  };

  const handleDeleteDashboard = async (dashboard: Dashboard) => {
    if (!confirm(`Are you sure you want to delete "${dashboard.name}"?`)) return;

    try {
      const { error } = await DashboardService.deleteDashboard(dashboard.id);
      if (error) throw error;
      
      setDashboards(dashboards.filter(d => d.id !== dashboard.id));
    } catch (err) {
      console.error('Error deleting dashboard:', err);
      alert('Failed to delete dashboard');
    }
  };

  const handleDuplicateDashboard = async (dashboard: Dashboard) => {
    const name = prompt('Name for duplicated dashboard:', `${dashboard.name} (Copy)`);
    if (!name) return;

    try {
      // Create new dashboard with same layout
      const { data, error } = await DashboardService.createDashboard(
        name,
        dashboard.description || '',
        dashboard.id // Use as template
      );
      
      if (error) throw error;
      if (data) {
        navigate(`/dashboards/${data.id}/edit`);
      }
    } catch (err) {
      console.error('Error duplicating dashboard:', err);
      alert('Failed to duplicate dashboard');
    }
  };

  const filteredDashboards = dashboards.filter(dashboard => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        dashboard.name.toLowerCase().includes(query) ||
        dashboard.description?.toLowerCase().includes(query) ||
        dashboard.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboards</h1>
        <p className="text-gray-600">Create and manage interactive dashboards with your reports</p>
      </div>

      {/* Actions Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search dashboards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Dashboards</option>
              <option value="mine">My Dashboards</option>
              <option value="shared">Shared with Me</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              icon={<Grid size={18} />}
              onClick={() => setViewMode('grid')}
            />
            <Button
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              size="sm"
              icon={<List size={18} />}
              onClick={() => setViewMode('list')}
            />
            <div className="w-px h-6 bg-gray-300 mx-2" />
            <Button
              variant="primary"
              icon={<Plus size={20} />}
              onClick={() => setShowTemplates(true)}
            >
              Create Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Grid/List */}
      {filteredDashboards.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No dashboards yet</h3>
          <p className="text-gray-600 mb-4">Create your first dashboard to get started</p>
          <Button
            variant="primary"
            icon={<Plus size={20} />}
            onClick={() => setShowTemplates(true)}
          >
            Create Dashboard
          </Button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 
          'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 
          'space-y-4'
        }>
          {filteredDashboards.map(dashboard => (
            <DashboardCard
              key={dashboard.id}
              dashboard={dashboard}
              viewMode={viewMode}
              onEdit={() => navigate(`/dashboards/${dashboard.id}/edit`)}
              onDelete={() => handleDeleteDashboard(dashboard)}
              onDuplicate={() => handleDuplicateDashboard(dashboard)}
              onShare={() => navigate(`/dashboards/${dashboard.id}/share`)}
            />
          ))}
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-semibold">Create New Dashboard</h2>
              <p className="text-gray-600 mt-1">Start from scratch or choose a template</p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Blank Dashboard Option */}
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4">Start from Scratch</h3>
                <button
                  onClick={() => {
                    setShowTemplates(false);
                    handleCreateDashboard();
                  }}
                  className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 transition text-center"
                >
                  <Plus size={48} className="mx-auto text-gray-400 mb-2" />
                  <h4 className="font-medium text-gray-900">Blank Dashboard</h4>
                  <p className="text-sm text-gray-600 mt-1">Start with an empty canvas</p>
                </button>
              </div>
              
              {/* Templates */}
              {templates.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Templates</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setShowTemplates(false);
                          handleCreateDashboard(template.id);
                        }}
                        className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition text-left"
                      >
                        <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded mb-3 flex items-center justify-center">
                          <BarChart3 size={48} className="text-gray-400" />
                        </div>
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{template.description}</p>
                        {template.rating !== undefined && (
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <Star size={14} className="mr-1" />
                            {template.rating.toFixed(1)}
                            <span className="mx-2">•</span>
                            {template.usageCount || 0} uses
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowTemplates(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardsPage;