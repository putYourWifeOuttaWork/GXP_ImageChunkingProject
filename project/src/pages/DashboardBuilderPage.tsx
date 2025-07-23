import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Grid3x3, 
  Plus, 
  Save, 
  Eye, 
  ArrowLeft,
  Layout,
  Type,
  Image,
  BarChart3,
  Frame,
  Code,
  Grip,
  X,
  MoreVertical,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DashboardService } from '../services/dashboardService';
import { ReportManagementService } from '../services/reportManagementService';
import { SavedReport } from '../types/reports';
import { 
  Dashboard, 
  DashboardWidget, 
  DashboardLayout 
} from '../types/reporting/dashboardTypes';
import Button from '../components/common/Button';
import LoadingScreen from '../components/common/LoadingScreen';
import { useAuthStore } from '../stores/authStore';
import { DashboardWidgetPreview } from '../components/dashboards/DashboardWidgetPreview';
import { WidgetConfigModal } from '../components/dashboards/WidgetConfigModal';

// Grid configuration
const GRID_COLS = 12;
const DEFAULT_GRID_ROWS = 8;
const CELL_SIZE = 80;
const GRID_GAP = 16;
const ROW_EXPANSION_THRESHOLD = 2; // Expand when widget is within 2 rows of bottom
const ROW_EXPANSION_AMOUNT = 5; // Add 5 rows at a time

interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DashboardBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const gridRef = useRef<HTMLDivElement>(null);

  // Dashboard state
  const [gridRows, setGridRows] = useState(DEFAULT_GRID_ROWS);
  const [dashboard, setDashboard] = useState<Partial<Dashboard>>({
    name: '',
    description: '',
    layout: {
      type: 'grid',
      columns: GRID_COLS,
      rows: gridRows,
      gap: GRID_GAP,
      padding: 16,
      responsive: true,
      widgets: []
    } as DashboardLayout
  });

  // UI state
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [availableReports, setAvailableReports] = useState<SavedReport[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReports, setShowReports] = useState(true);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configWidget, setConfigWidget] = useState<DashboardWidget | null>(null);

  // Drag state
  const [draggedReport, setDraggedReport] = useState<SavedReport | null>(null);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dropPosition, setDropPosition] = useState<GridPosition | null>(null);

  // Load dashboard if editing
  useEffect(() => {
    if (id) {
      loadDashboard();
    }
    loadReports();
  }, [id]);

  // Check grid expansion when widgets change
  useEffect(() => {
    checkGridExpansion(widgets);
  }, [widgets]);

  const loadDashboard = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const { data: dashboardData, error: dashError } = await DashboardService.getDashboard(id);
      if (dashError) throw dashError;

      const { data: widgetsData, error: widgetsError } = await DashboardService.getWidgets(id);
      if (widgetsError) throw widgetsError;

      if (dashboardData) {
        setDashboard(dashboardData);
        setWidgets(widgetsData || []);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      console.log('Loading reports...');
      // Get all reports
      const data = await ReportManagementService.getAllReports();
      console.log('Reports loaded:', data);
      setAvailableReports(data || []);
    } catch (err) {
      console.error('Error loading reports:', err);
    }
  };

  // Save dashboard
  const saveDashboard = async () => {
    if (!dashboard.name) {
      alert('Please enter a dashboard name');
      return;
    }

    setIsSaving(true);
    try {
      if (id) {
        // Update existing dashboard
        const { error } = await DashboardService.updateDashboard(id, {
          name: dashboard.name,
          description: dashboard.description,
          layout: dashboard.layout,
          updatedAt: new Date().toISOString()
        } as Partial<Dashboard>);
        
        if (error) throw error;

        // Update widgets
        await DashboardService.updateWidgets(id, widgets);
      } else {
        // Create new dashboard
        const { data: newDashboard, error } = await DashboardService.createDashboard(
          dashboard.name,
          dashboard.description || ''
        );
        
        if (error) throw error;
        if (!newDashboard) throw new Error('Failed to create dashboard');

        // Add widgets
        for (const widget of widgets) {
          await DashboardService.addWidget(newDashboard.id, widget);
        }

        // Navigate to the new dashboard
        navigate(`/dashboards/${newDashboard.id}`);
      }
    } catch (err) {
      console.error('Error saving dashboard:', err);
      alert('Failed to save dashboard');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle report drag start
  const handleReportDragStart = (e: React.DragEvent, report: SavedReport) => {
    setDraggedReport(report);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle widget drag start
  const handleWidgetDragStart = (e: React.DragEvent, widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    setDraggedWidget(widgetId);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over grid
  const handleGridDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedReport ? 'copy' : 'move';

    if (!gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (CELL_SIZE + GRID_GAP));
    const y = Math.floor((e.clientY - rect.top) / (CELL_SIZE + GRID_GAP));
    
    const width = draggedReport ? 4 : (widgets.find(w => w.id === draggedWidget)?.position.width || 4);
    const height = draggedReport ? 3 : (widgets.find(w => w.id === draggedWidget)?.position.height || 3);

    setDropPosition({
      x: Math.max(0, Math.min(x, GRID_COLS - width)),
      y: Math.max(0, Math.min(y, gridRows - height)),
      width,
      height
    });
  };

  // Handle drop on grid
  const handleGridDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (!dropPosition) return;

    if (draggedReport) {
      // Find free position for new widget
      const freePosition = findFreePosition(dropPosition, widgets);
      
      // Add new widget from report
      const newWidget: DashboardWidget = {
        id: `widget-${Date.now()}`,
        type: 'report',
        reportId: draggedReport.report_id,
        position: freePosition,
        title: draggedReport.report_name,
        showTitle: true,
        showBorder: true,
        borderRadius: 8,
        shadow: true,
        zIndex: widgets.length,
        isVisible: true,
        isResizable: true,
        isMovable: true,
        configuration: {
          reportConfiguration: {
            showFilters: true,
            showExport: true,
            showRefresh: true,
            autoRefresh: false,
            refreshInterval: 300000 // 5 minutes
          }
        }
      };

      setWidgets([...widgets, newWidget]);
    } else if (draggedWidget) {
      // Find free position for moved widget
      const freePosition = findFreePosition(dropPosition, widgets, draggedWidget);
      
      // Move existing widget
      setWidgets(widgets.map(w => 
        w.id === draggedWidget 
          ? { ...w, position: freePosition }
          : w
      ));
    }

    // Reset drag state
    setDraggedReport(null);
    setDraggedWidget(null);
    setDropPosition(null);
  };

  // Remove widget
  const removeWidget = (widgetId: string) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
    setSelectedWidget(null);
  };

  // Configure widget
  const openWidgetConfig = (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
      setConfigWidget(widget);
      setConfigModalOpen(true);
    }
  };

  // Update widget configuration
  const updateWidgetConfig = (updatedWidget: DashboardWidget) => {
    setWidgets(widgets.map(w => 
      w.id === updatedWidget.id ? updatedWidget : w
    ));
  };

  // Check if grid needs expansion based on widget positions
  const checkGridExpansion = (currentWidgets: DashboardWidget[]) => {
    let maxBottomRow = 0;
    
    currentWidgets.forEach(widget => {
      const bottomRow = widget.position.y + widget.position.height;
      if (bottomRow > maxBottomRow) {
        maxBottomRow = bottomRow;
      }
    });

    // If any widget is within threshold of the bottom, expand
    if (maxBottomRow > gridRows - ROW_EXPANSION_THRESHOLD) {
      const newRows = Math.max(maxBottomRow + ROW_EXPANSION_AMOUNT, gridRows + ROW_EXPANSION_AMOUNT);
      setGridRows(newRows);
      setDashboard(prev => ({
        ...prev,
        layout: {
          ...prev.layout!,
          rows: newRows
        }
      }));
    }
    // Contract grid if there's too much empty space (but keep minimum)
    else if (maxBottomRow < gridRows - ROW_EXPANSION_AMOUNT && gridRows > DEFAULT_GRID_ROWS) {
      const newRows = Math.max(DEFAULT_GRID_ROWS, maxBottomRow + ROW_EXPANSION_THRESHOLD);
      setGridRows(newRows);
      setDashboard(prev => ({
        ...prev,
        layout: {
          ...prev.layout!,
          rows: newRows
        }
      }));
    }
  };

  // Check if two positions overlap
  const checkCollision = (pos1: GridPosition, pos2: GridPosition): boolean => {
    return !(pos1.x + pos1.width <= pos2.x || 
             pos2.x + pos2.width <= pos1.x || 
             pos1.y + pos1.height <= pos2.y || 
             pos2.y + pos2.height <= pos1.y);
  };

  // Find a free position by pushing widgets down
  const findFreePosition = (
    newPosition: GridPosition, 
    currentWidgets: DashboardWidget[], 
    draggedId?: string
  ): GridPosition => {
    let finalPosition = { ...newPosition };
    let hasCollision = true;
    let attempts = 0;
    const maxAttempts = 20;

    while (hasCollision && attempts < maxAttempts) {
      hasCollision = false;
      
      for (const widget of currentWidgets) {
        // Skip the widget being dragged
        if (draggedId && widget.id === draggedId) continue;
        
        if (checkCollision(finalPosition, widget.position)) {
          hasCollision = true;
          // Try moving down first
          finalPosition.y = widget.position.y + widget.position.height;
          
          // If it goes beyond current grid, just use it (grid will expand)
          break;
        }
      }
      attempts++;
    }

    return finalPosition;
  };

  // Add widget by type
  const addWidgetByType = (type: 'text' | 'metric' | 'image' | 'iframe' | 'custom') => {
    const initialPosition = {
      x: 0,
      y: 0,
      width: type === 'text' ? 6 : 3,
      height: type === 'text' ? 3 : 2
    };
    
    // Find free position for new widget
    const freePosition = findFreePosition(initialPosition, widgets);
    
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type,
      position: freePosition,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Widget`,
      showTitle: type !== 'text', // Don't show title for text widgets
      showBorder: type !== 'text', // Don't show border for text widgets
      borderRadius: 8,
      shadow: type !== 'text', // Don't show shadow for text widgets
      zIndex: widgets.length,
      isVisible: true,
      isResizable: true,
      isMovable: true,
      configuration: getDefaultConfigForType(type)
    };

    setWidgets([...widgets, newWidget]);
    setSelectedWidget(newWidget.id);
  };

  // Get default configuration for widget type
  const getDefaultConfigForType = (type: string): any => {
    switch (type) {
      case 'text':
        return {
          textConfiguration: {
            content: 'Click to edit this text widget...',
            fontSize: 14,
            fontFamily: 'inherit',
            color: '#374151',
            alignment: 'left',
            markdown: false
          }
        };
      case 'metric':
        return {
          metricConfiguration: {
            value: 0,
            label: 'New Metric',
            format: 'number',
            color: '#3B82F6',
            trend: {
              direction: 'up',
              percentage: 0
            }
          }
        };
      default:
        return {};
    }
  };

  // Widget resize handlers
  const startResize = (e: React.MouseEvent, widgetId: string, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = widget.position.width;
    const startHeight = widget.position.height;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.round((e.clientX - startX) / (CELL_SIZE + GRID_GAP));
      const deltaY = Math.round((e.clientY - startY) / (CELL_SIZE + GRID_GAP));

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = widget.position.x;
      let newY = widget.position.y;

      if (handle.includes('e')) newWidth = Math.max(2, Math.min(startWidth + deltaX, GRID_COLS - widget.position.x));
      if (handle.includes('w')) {
        newWidth = Math.max(2, startWidth - deltaX);
        newX = Math.max(0, widget.position.x + deltaX);
      }
      if (handle.includes('s')) newHeight = Math.max(2, Math.min(startHeight + deltaY, gridRows - widget.position.y));
      if (handle.includes('n')) {
        newHeight = Math.max(2, startHeight - deltaY);
        newY = Math.max(0, widget.position.y + deltaY);
      }

      setWidgets(widgets.map(w => 
        w.id === widgetId 
          ? { ...w, position: { x: newX, y: newY, width: newWidth, height: newHeight } }
          : w
      ));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingScreen />
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
              <input
                type="text"
                placeholder="Dashboard Name"
                value={dashboard.name}
                onChange={(e) => setDashboard({ ...dashboard, name: e.target.value })}
                className="text-2xl font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 -mx-2"
              />
              <input
                type="text"
                placeholder="Add a description..."
                value={dashboard.description || ''}
                onChange={(e) => setDashboard({ ...dashboard, description: e.target.value })}
                className="text-sm text-gray-600 bg-transparent border-none outline-none focus:ring-2 focus:ring-primary-500 rounded px-2 -mx-2 mt-1 w-full"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant={previewMode ? 'primary' : 'ghost'}
              icon={<Eye size={20} />}
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? 'Edit' : 'Preview'}
            </Button>
            
            <Button
              variant="primary"
              icon={<Save size={20} />}
              onClick={saveDashboard}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Dashboard'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Grid Area */}
        <div className="flex-1 p-6 overflow-auto">
          <div
            ref={gridRef}
            className="relative bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300"
            style={{
              width: GRID_COLS * CELL_SIZE + (GRID_COLS - 1) * GRID_GAP + 32,
              height: gridRows * CELL_SIZE + (gridRows - 1) * GRID_GAP + 32,
              padding: 16
            }}
            onDragOver={handleGridDragOver}
            onDrop={handleGridDrop}
          >
            {/* Grid lines */}
            {!previewMode && (
              <div className="absolute inset-0 pointer-events-none" style={{ padding: 16 }}>
                {Array.from({ length: gridRows }).map((_, row) => (
                  <div key={row} className="flex">
                    {Array.from({ length: GRID_COLS }).map((_, col) => (
                      <div
                        key={col}
                        className="border border-gray-200"
                        style={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          marginRight: col < GRID_COLS - 1 ? GRID_GAP : 0,
                          marginBottom: row < gridRows - 1 ? GRID_GAP : 0
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Drop indicator */}
            {dropPosition && !previewMode && (
              <div
                className="absolute bg-primary-100 border-2 border-primary-500 rounded-lg pointer-events-none z-50"
                style={{
                  left: dropPosition.x * (CELL_SIZE + GRID_GAP) + 16,
                  top: dropPosition.y * (CELL_SIZE + GRID_GAP) + 16,
                  width: dropPosition.width * CELL_SIZE + (dropPosition.width - 1) * GRID_GAP,
                  height: dropPosition.height * CELL_SIZE + (dropPosition.height - 1) * GRID_GAP
                }}
              />
            )}

            {/* Widgets */}
            {widgets.map(widget => {
              // Ensure widget has position data
              const position = widget.position || { x: 0, y: 0, width: 4, height: 3 };
              return (
              <div
                key={widget.id}
                className={`absolute bg-white rounded-lg transition-all ${
                  previewMode ? '' : 'cursor-move hover:shadow-lg'
                } ${selectedWidget === widget.id ? 'ring-2 ring-primary-500' : ''}`}
                style={{
                  left: position.x * (CELL_SIZE + GRID_GAP) + 16,
                  top: position.y * (CELL_SIZE + GRID_GAP) + 16,
                  width: position.width * CELL_SIZE + (position.width - 1) * GRID_GAP,
                  height: position.height * CELL_SIZE + (position.height - 1) * GRID_GAP,
                  border: widget.showBorder ? '1px solid #e5e7eb' : 'none',
                  borderRadius: widget.borderRadius || 8,
                  boxShadow: widget.shadow ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  zIndex: widget.zIndex || 0
                }}
                draggable={!previewMode}
                onDragStart={(e) => handleWidgetDragStart(e, widget.id)}
                onClick={() => !previewMode && setSelectedWidget(widget.id)}
              >
                {/* Widget Preview */}
                <DashboardWidgetPreview
                  widget={widget}
                  isSelected={selectedWidget === widget.id}
                  onConfigureClick={() => openWidgetConfig(widget.id)}
                  onRemove={() => removeWidget(widget.id)}
                  isEditMode={!previewMode}
                />

                {/* Resize handles */}
                {!previewMode && widget.isResizable && selectedWidget === widget.id && (
                  <>
                    <div
                      className="absolute -right-1 -bottom-1 w-3 h-3 bg-primary-500 rounded-full cursor-se-resize"
                      onMouseDown={(e) => startResize(e, widget.id, 'se')}
                    />
                    <div
                      className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary-500 rounded-full cursor-e-resize"
                      onMouseDown={(e) => startResize(e, widget.id, 'e')}
                    />
                    <div
                      className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-3 h-3 bg-primary-500 rounded-full cursor-s-resize"
                      onMouseDown={(e) => startResize(e, widget.id, 's')}
                    />
                  </>
                )}
              </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar - Available Reports */}
        {!previewMode && (
          <div className="w-80 bg-white border-l border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={() => setShowReports(!showReports)}
                className="w-full flex items-center justify-between text-left"
              >
                <h3 className="text-lg font-semibold">Available Reports</h3>
                {showReports ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            
            {showReports && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {availableReports.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No reports available. Create reports in the Report Builder first.
                  </p>
                ) : (
                  availableReports.map(report => (
                    <div
                      key={report.report_id}
                      draggable
                      onDragStart={(e) => handleReportDragStart(e, report)}
                      className="p-3 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <BarChart3 size={20} className="text-gray-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {report.report_name}
                          </h4>
                          {report.description && (
                            <p className="text-xs text-gray-500 truncate">
                              {report.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="p-4 border-t border-gray-200 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Widget Types</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'text', icon: Type, label: 'Text' },
                    { type: 'image', icon: Image, label: 'Image' },
                    { type: 'metric', icon: BarChart3, label: 'Metric' },
                    { type: 'iframe', icon: Frame, label: 'IFrame' },
                    { type: 'custom', icon: Code, label: 'Custom' }
                  ].map(({ type, icon: Icon, label }) => (
                    <button
                      key={type}
                      className="p-2 text-center border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!['text', 'metric'].includes(type)}
                      title={['text', 'metric'].includes(type) ? `Add ${label} widget` : 'Coming soon'}
                      onClick={() => addWidgetByType(type as any)}
                    >
                      <Icon size={20} className="mx-auto mb-1 text-gray-600" />
                      <span className="text-xs text-gray-600">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Widget Configuration Modal */}
      {configWidget && (
        <WidgetConfigModal
          isOpen={configModalOpen}
          onClose={() => {
            setConfigModalOpen(false);
            setConfigWidget(null);
          }}
          widget={configWidget}
          onSave={updateWidgetConfig}
        />
      )}
    </div>
  );
};

export default DashboardBuilderPage;