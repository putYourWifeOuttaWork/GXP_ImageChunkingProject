import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Grid3x3, 
  Plus, 
  Save, 
  Eye, 
  Settings, 
  Share2, 
  ArrowLeft,
  Layout,
  Type,
  Image,
  BarChart3,
  Frame,
  Code,
  Grip,
  X,
  Maximize2,
  Minimize2,
  MoreVertical,
  Trash2,
  Copy,
  Layers
} from 'lucide-react';
import { DashboardService } from '../services/dashboardService';
import { ReportManagementService } from '../services/reportManagementService';
import { 
  Dashboard, 
  DashboardWidget, 
  DashboardLayout,
  DashboardPermissions 
} from '../types/reporting/dashboardTypes';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuthStore } from '../stores/authStore';

// Grid configuration
const GRID_COLS = 12;
const GRID_ROWS = 8;
const CELL_SIZE = 80;
const GRID_GAP = 16;

interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  isDragging: boolean;
  widgetId: string | null;
  startPosition: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
  isResizing: boolean;
  resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | null;
  originalSize: { width: number; height: number } | null;
}

const DashboardBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const gridRef = useRef<HTMLDivElement>(null);

  // State
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [permissions, setPermissions] = useState<DashboardPermissions | null>(null);
  const [availableReports, setAvailableReports] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    widgetId: null,
    startPosition: null,
    currentPosition: null,
    isResizing: false,
    resizeHandle: null,
    originalSize: null
  });

  // Load dashboard and widgets
  useEffect(() => {
    loadDashboard();
    loadAvailableReports();
  }, [id]);

  const loadDashboard = async () => {
    if (!id) {
      // New dashboard
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [dashboardResult, widgetsResult, permissionsResult] = await Promise.all([
        DashboardService.getDashboard(id),
        DashboardService.getWidgets(id),
        DashboardService.getPermissions(id)
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

  const loadAvailableReports = async () => {
    try {
      const { data, error } = await ReportManagementService.searchReports();
      if (error) throw error;
      setAvailableReports(data || []);
    } catch (err) {
      console.error('Error loading reports:', err);
    }
  };

  // Save dashboard
  const saveDashboard = async () => {
    setIsSaving(true);
    try {
      if (dashboard) {
        // Update existing dashboard
        await DashboardService.updateDashboard(dashboard.id, {
          name: dashboard.name,
          description: dashboard.description,
          layout: dashboard.layout,
          tags: dashboard.tags
        });

        // Update widget positions
        const positionUpdates = widgets.map(w => ({
          id: w.id,
          position: w.position
        }));
        await DashboardService.updateWidgetPositions(positionUpdates);
      } else {
        // Create new dashboard
        const name = prompt('Dashboard Name:') || 'Untitled Dashboard';
        const description = prompt('Description (optional):') || '';
        
        const { data, error } = await DashboardService.createDashboard(name, description);
        if (error) throw error;
        
        if (data) {
          navigate(`/dashboards/${data.id}/edit`);
        }
      }
    } catch (err) {
      console.error('Error saving dashboard:', err);
      setError('Failed to save dashboard');
    } finally {
      setIsSaving(false);
    }
  };

  // Add widget
  const addWidget = async (type: DashboardWidget['type'], reportId?: string) => {
    if (!dashboard) return;

    const newWidget: Omit<DashboardWidget, 'id' | 'created_at' | 'updated_at'> = {
      type,
      reportId,
      position: {
        x: 0,
        y: 0,
        width: 4,
        height: 3
      },
      title: type === 'report' && reportId ? 
        availableReports.find(r => r.id === reportId)?.name || 'Report' : 
        type.charAt(0).toUpperCase() + type.slice(1),
      showTitle: true,
      showBorder: true,
      backgroundColor: undefined,
      borderColor: undefined,
      borderRadius: 8,
      shadow: true,
      zIndex: widgets.length,
      isVisible: true,
      isResizable: true,
      isMovable: true,
      configuration: getDefaultConfiguration(type),
      responsive: undefined
    };

    try {
      const { data, error } = await DashboardService.addWidget(dashboard.id, newWidget);
      if (error) throw error;
      
      if (data) {
        setWidgets([...widgets, data]);
        setShowAddPanel(false);
      }
    } catch (err) {
      console.error('Error adding widget:', err);
      setError('Failed to add widget');
    }
  };

  // Update widget
  const updateWidget = async (widgetId: string, updates: Partial<DashboardWidget>) => {
    try {
      const { data, error } = await DashboardService.updateWidget(widgetId, updates);
      if (error) throw error;
      
      if (data) {
        setWidgets(widgets.map(w => w.id === widgetId ? { ...w, ...updates } : w));
      }
    } catch (err) {
      console.error('Error updating widget:', err);
    }
  };

  // Remove widget
  const removeWidget = async (widgetId: string) => {
    if (!confirm('Are you sure you want to remove this widget?')) return;

    try {
      const { error } = await DashboardService.removeWidget(widgetId);
      if (error) throw error;
      
      setWidgets(widgets.filter(w => w.id !== widgetId));
      setSelectedWidget(null);
    } catch (err) {
      console.error('Error removing widget:', err);
      setError('Failed to remove widget');
    }
  };

  // Drag and drop handlers
  const handleMouseDown = (e: React.MouseEvent, widgetId: string, isResize: boolean = false, handle?: 'nw' | 'ne' | 'sw' | 'se') => {
    if (previewMode) return;
    
    e.preventDefault();
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    setDragState({
      isDragging: !isResize,
      widgetId,
      startPosition: { x: e.clientX, y: e.clientY },
      currentPosition: { x: e.clientX, y: e.clientY },
      isResizing: isResize,
      resizeHandle: handle || null,
      originalSize: { width: widget.position.width, height: widget.position.height }
    });

    setSelectedWidget(widgetId);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.widgetId || !dragState.startPosition) return;

    const deltaX = e.clientX - dragState.startPosition.x;
    const deltaY = e.clientY - dragState.startPosition.y;

    if (dragState.isDragging) {
      // Update widget position
      const widget = widgets.find(w => w.id === dragState.widgetId);
      if (!widget || !gridRef.current) return;

      const gridRect = gridRef.current.getBoundingClientRect();
      const cellWidth = gridRect.width / GRID_COLS;
      const cellHeight = gridRect.height / GRID_ROWS;

      const newX = Math.max(0, Math.min(GRID_COLS - widget.position.width, 
        Math.round((widget.position.x * cellWidth + deltaX) / cellWidth)));
      const newY = Math.max(0, Math.min(GRID_ROWS - widget.position.height, 
        Math.round((widget.position.y * cellHeight + deltaY) / cellHeight)));

      if (newX !== widget.position.x || newY !== widget.position.y) {
        setWidgets(widgets.map(w => 
          w.id === dragState.widgetId 
            ? { ...w, position: { ...w.position, x: newX, y: newY } }
            : w
        ));
      }
    } else if (dragState.isResizing && dragState.originalSize) {
      // Update widget size
      const widget = widgets.find(w => w.id === dragState.widgetId);
      if (!widget || !gridRef.current) return;

      const gridRect = gridRef.current.getBoundingClientRect();
      const cellWidth = gridRect.width / GRID_COLS;
      const cellHeight = gridRect.height / GRID_ROWS;

      let newWidth = dragState.originalSize.width;
      let newHeight = dragState.originalSize.height;

      switch (dragState.resizeHandle) {
        case 'se':
          newWidth = Math.max(2, Math.min(GRID_COLS - widget.position.x, 
            Math.round((dragState.originalSize.width * cellWidth + deltaX) / cellWidth)));
          newHeight = Math.max(2, Math.min(GRID_ROWS - widget.position.y, 
            Math.round((dragState.originalSize.height * cellHeight + deltaY) / cellHeight)));
          break;
        // Add other resize handles as needed
      }

      if (newWidth !== widget.position.width || newHeight !== widget.position.height) {
        setWidgets(widgets.map(w => 
          w.id === dragState.widgetId 
            ? { ...w, position: { ...w.position, width: newWidth, height: newHeight } }
            : w
        ));
      }
    }

    setDragState(prev => ({ ...prev, currentPosition: { x: e.clientX, y: e.clientY } }));
  }, [dragState, widgets]);

  const handleMouseUp = useCallback(async () => {
    if (dragState.widgetId && (dragState.isDragging || dragState.isResizing)) {
      const widget = widgets.find(w => w.id === dragState.widgetId);
      if (widget) {
        await updateWidget(widget.id, { position: widget.position });
      }
    }

    setDragState({
      isDragging: false,
      widgetId: null,
      startPosition: null,
      currentPosition: null,
      isResizing: false,
      resizeHandle: null,
      originalSize: null
    });
  }, [dragState, widgets]);

  useEffect(() => {
    if (dragState.isDragging || dragState.isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Helper functions
  const getDefaultConfiguration = (type: DashboardWidget['type']): any => {
    switch (type) {
      case 'text':
        return {
          textConfiguration: {
            content: 'Enter your text here...',
            fontSize: 14,
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#374151',
            alignment: 'left',
            markdown: false
          }
        };
      case 'metric':
        return {
          metricConfiguration: {
            value: 0,
            label: 'Metric Label',
            format: '0,0',
            color: '#3B82F6',
            trend: {
              direction: 'up',
              percentage: 0,
              color: '#10B981'
            }
          }
        };
      default:
        return {};
    }
  };

  const getWidgetIcon = (type: DashboardWidget['type']) => {
    switch (type) {
      case 'report': return <BarChart3 size={16} />;
      case 'text': return <Type size={16} />;
      case 'image': return <Image size={16} />;
      case 'metric': return <BarChart3 size={16} />;
      case 'iframe': return <Frame size={16} />;
      case 'custom': return <Code size={16} />;
      default: return <Layout size={16} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
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
              <h1 className="text-2xl font-semibold text-gray-900">
                {dashboard?.name || 'New Dashboard'}
              </h1>
              {dashboard?.description && (
                <p className="text-sm text-gray-600 mt-1">{dashboard.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              icon={<Plus size={20} />}
              onClick={() => setShowAddPanel(!showAddPanel)}
              disabled={!dashboard || previewMode}
            >
              Add Widget
            </Button>
            
            <Button
              variant="ghost"
              icon={previewMode ? <Grid3x3 size={20} /> : <Eye size={20} />}
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? 'Edit' : 'Preview'}
            </Button>
            
            <Button
              variant="primary"
              icon={<Save size={20} />}
              onClick={saveDashboard}
              loading={isSaving}
              disabled={!permissions?.canEdit}
            >
              Save
            </Button>
            
            <Button
              variant="ghost"
              icon={<Share2 size={20} />}
              onClick={() => navigate(`/dashboards/${dashboard?.id}/share`)}
              disabled={!dashboard || !permissions?.canShare}
            >
              Share
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Add Widget Panel */}
        {showAddPanel && !previewMode && (
          <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add Widget</h3>
            
            {/* Widget Types */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Widget Types</h4>
              <div className="space-y-2">
                <button
                  onClick={() => setShowAddPanel(false)}
                  className="w-full flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <Type size={20} className="mr-3 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium">Text</div>
                    <div className="text-sm text-gray-600">Add formatted text or markdown</div>
                  </div>
                </button>
                
                <button
                  onClick={() => addWidget('metric')}
                  className="w-full flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <BarChart3 size={20} className="mr-3 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium">Metric</div>
                    <div className="text-sm text-gray-600">Display a key metric</div>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Available Reports */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Reports</h4>
              <div className="space-y-2">
                {availableReports.map(report => (
                  <button
                    key={report.id}
                    onClick={() => addWidget('report', report.id)}
                    className="w-full flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-left"
                  >
                    <BarChart3 size={20} className="mr-3 text-gray-600" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{report.name}</div>
                      <div className="text-sm text-gray-600 truncate">{report.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="flex-1 p-6 overflow-auto">
          <div 
            ref={gridRef}
            className="relative bg-white rounded-lg shadow-sm"
            style={{
              width: GRID_COLS * CELL_SIZE + (GRID_COLS - 1) * GRID_GAP,
              height: GRID_ROWS * CELL_SIZE + (GRID_ROWS - 1) * GRID_GAP,
              minWidth: '100%',
              minHeight: '100%'
            }}
          >
            {/* Grid lines (edit mode only) */}
            {!previewMode && (
              <div className="absolute inset-0">
                {Array.from({ length: GRID_ROWS }).map((_, row) =>
                  Array.from({ length: GRID_COLS }).map((_, col) => (
                    <div
                      key={`${row}-${col}`}
                      className="absolute border border-gray-100"
                      style={{
                        left: col * (CELL_SIZE + GRID_GAP),
                        top: row * (CELL_SIZE + GRID_GAP),
                        width: CELL_SIZE,
                        height: CELL_SIZE
                      }}
                    />
                  ))
                )}
              </div>
            )}

            {/* Widgets */}
            {widgets.map(widget => (
              <div
                key={widget.id}
                className={`absolute transition-all ${
                  selectedWidget === widget.id ? 'ring-2 ring-primary-500' : ''
                } ${widget.showBorder ? 'border border-gray-200' : ''} ${
                  widget.shadow ? 'shadow-md' : ''
                } ${!previewMode ? 'cursor-move' : ''}`}
                style={{
                  left: widget.position.x * (CELL_SIZE + GRID_GAP),
                  top: widget.position.y * (CELL_SIZE + GRID_GAP),
                  width: widget.position.width * CELL_SIZE + (widget.position.width - 1) * GRID_GAP,
                  height: widget.position.height * CELL_SIZE + (widget.position.height - 1) * GRID_GAP,
                  backgroundColor: widget.backgroundColor || 'white',
                  borderColor: widget.borderColor,
                  borderRadius: widget.borderRadius,
                  zIndex: widget.zIndex
                }}
                onClick={() => !previewMode && setSelectedWidget(widget.id)}
              >
                {/* Widget Header */}
                {!previewMode && (
                  <div
                    className="absolute inset-x-0 top-0 h-10 bg-gray-50 border-b border-gray-200 flex items-center px-3 cursor-move"
                    onMouseDown={(e) => handleMouseDown(e, widget.id)}
                    style={{
                      borderTopLeftRadius: widget.borderRadius,
                      borderTopRightRadius: widget.borderRadius
                    }}
                  >
                    <Grip size={16} className="text-gray-400 mr-2" />
                    <div className="flex-1 flex items-center">
                      {getWidgetIcon(widget.type)}
                      <span className="ml-2 text-sm font-medium text-gray-700 truncate">
                        {widget.title}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        className="p-1 hover:bg-gray-200 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Open widget settings
                        }}
                      >
                        <Settings size={14} />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-200 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWidget(widget.id);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Widget Content */}
                <div className={`${!previewMode ? 'mt-10' : ''} p-4 h-full overflow-auto`}>
                  {renderWidgetContent(widget)}
                </div>

                {/* Resize Handle */}
                {!previewMode && selectedWidget === widget.id && widget.isResizable && (
                  <div
                    className="absolute bottom-0 right-0 w-4 h-4 bg-primary-500 cursor-se-resize"
                    onMouseDown={(e) => handleMouseDown(e, widget.id, true, 'se')}
                    style={{
                      borderBottomRightRadius: widget.borderRadius
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  function renderWidgetContent(widget: DashboardWidget) {
    switch (widget.type) {
      case 'report':
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <BarChart3 size={48} className="mx-auto mb-2" />
              <p>Report: {widget.title}</p>
              {previewMode && <p className="text-sm mt-2">Report will render here</p>}
            </div>
          </div>
        );
      
      case 'text':
        const textConfig = widget.configuration?.textConfiguration;
        return (
          <div
            style={{
              fontSize: textConfig?.fontSize || 14,
              fontFamily: textConfig?.fontFamily || 'inherit',
              color: textConfig?.color || '#374151',
              textAlign: textConfig?.alignment || 'left'
            }}
          >
            {textConfig?.content || 'Text widget'}
          </div>
        );
      
      case 'metric':
        const metricConfig = widget.configuration?.metricConfiguration;
        return (
          <div className="text-center">
            <div 
              className="text-4xl font-bold"
              style={{ color: metricConfig?.color || '#3B82F6' }}
            >
              {metricConfig?.value || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {metricConfig?.label || 'Metric'}
            </div>
            {metricConfig?.trend && (
              <div className="flex items-center justify-center mt-2">
                <span className={`text-sm ${
                  metricConfig.trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metricConfig.trend.direction === 'up' ? '↑' : '↓'} {metricConfig.trend.percentage}%
                </span>
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              {getWidgetIcon(widget.type)}
              <p className="mt-2">{widget.type} widget</p>
            </div>
          </div>
        );
    }
  }
};

export default DashboardBuilderPage;