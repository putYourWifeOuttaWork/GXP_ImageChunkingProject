import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RefreshCw, 
  Fullscreen, 
  Settings, 
  Download,
  Filter,
  Calendar,
  ChevronDown,
  X
} from 'lucide-react';
import { Dashboard, DashboardWidget } from '../../types/reporting/dashboardTypes';
import { AggregatedData } from '../../types/reporting';
import { ReportingDataService } from '../../services/reportingDataService';
import { BaseChart } from '../reporting/visualizations/base/BaseChart';
import { TableVisualization } from '../reporting/visualizations/TableVisualization';
import Button from '../common/Button';
import LoadingScreen from '../common/LoadingScreen';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { ChartSettingsModal } from './ChartSettingsModal';
import { ViewportConfiguration } from '../../types/reporting/visualizationTypes';
import { DashboardService } from '../../services/dashboardService';
import { DataMetricWidget } from './widgets/DataMetricWidget';
import { WidgetSkeleton } from './WidgetSkeleton';
import { ErrorDisplay, commonErrorActions, getErrorType } from '../common/ErrorDisplay';
import { FacilityAnalyticsWidget } from './widgets/FacilityAnalyticsWidget';

interface DashboardViewerProps {
  dashboard: Dashboard;
  widgets: DashboardWidget[];
  isEmbedded?: boolean;
  isEditMode?: boolean;
  onRefresh?: () => void;
}

interface WidgetData {
  [widgetId: string]: {
    data: AggregatedData | null;
    loading: boolean;
    error: string | null;
    lastRefreshed: Date | null;
  };
}

export const DashboardViewer: React.FC<DashboardViewerProps> = ({
  dashboard,
  widgets,
  isEmbedded = false,
  isEditMode = false,
  onRefresh
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetData, setWidgetData] = useState<WidgetData>({});
  const [globalFilters, setGlobalFilters] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Chart settings modal state
  const [settingsModal, setSettingsModal] = useState<{
    isOpen: boolean;
    widgetId: string | null;
    widget: DashboardWidget | null;
    currentViewport?: ViewportConfiguration;
  }>({
    isOpen: false,
    widgetId: null,
    widget: null
  });

  // Load widget data
  useEffect(() => {
    widgets.forEach(widget => {
      if (widget.type === 'report' && widget.reportId) {
        loadWidgetData(widget);
      }
    });
  }, [widgets]);

  // Auto-refresh
  useEffect(() => {
    if (dashboard.autoRefresh && dashboard.refreshFrequency && dashboard.refreshFrequency > 0) {
      const interval = setInterval(() => {
        handleRefreshAll();
      }, dashboard.refreshFrequency * 1000);

      return () => clearInterval(interval);
    }
  }, [dashboard.autoRefresh, dashboard.refreshFrequency]);

  const loadWidgetData = async (widget: DashboardWidget) => {
    if (!widget.reportId) return;

    setWidgetData(prev => ({
      ...prev,
      [widget.id]: {
        ...prev[widget.id],
        loading: true,
        error: null
      }
    }));

    try {
      // Get report configuration from Supabase with cache bypass
      const timestamp = new Date().getTime();
      const { data: reportData, error: reportError } = await supabase
        .from('saved_reports')
        .select(`*, updated_at`)
        .eq('report_id', widget.reportId)
        .single();
      
      if (reportError) throw reportError;
      if (!reportData) throw new Error('Report not found');
      
      const report = {
        configuration: reportData.report_config
      };
      
      console.log('Loaded report configuration for widget:', {
        widgetId: widget.id,
        reportId: widget.reportId,
        reportName: reportData.report_name,
        visualizationSettings: report.configuration?.visualizationSettings,
        colorPalette: report.configuration?.visualizationSettings?.colors?.palette
      });

      // Apply global filters and widget overrides
      const filters = [
        ...report.configuration.filters,
        ...globalFilters,
        ...(widget.configuration?.reportConfiguration?.filterOverrides || [])
      ];

      // Apply widget-level isolation filters
      const isolationFilters = widget.configuration?.reportConfiguration?.isolationFilters || {};
      const finalConfig = {
        ...report.configuration,
        filters,
        isolationFilters: {
          ...report.configuration.isolationFilters,
          ...isolationFilters
        }
      };

      // Apply date range if set
      if (dateRange.start && dateRange.end) {
        filters.push({
          field: 'created_at',
          operator: 'between',
          value: [dateRange.start.toISOString(), dateRange.end.toISOString()]
        });
      }

      // Fetch data with merged configuration
      const data = await ReportingDataService.executeReport(finalConfig);

      if (!data) throw new Error('No data returned');

      // Include report config in the data metadata
      const enrichedData = {
        ...data,
        metadata: {
          ...data.metadata,
          reportConfig: report.configuration
        }
      };
      
      console.log('Widget data loaded:', {
        widgetId: widget.id,
        reportId: widget.reportId,
        reportConfig: report.configuration,
        chartType: report.configuration?.chartType,
        dataRows: data?.data?.length
      });

      setWidgetData(prev => ({
        ...prev,
        [widget.id]: {
          data: enrichedData,
          loading: false,
          error: null,
          lastRefreshed: new Date()
        }
      }));
    } catch (error) {
      console.error('Error loading widget data:', error);
      setWidgetData(prev => ({
        ...prev,
        [widget.id]: {
          data: null,
          loading: false,
          error: 'Failed to load data',
          lastRefreshed: null
        }
      }));
    }
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    
    const reportWidgets = widgets.filter(w => w.type === 'report' && w.reportId);
    await Promise.all(reportWidgets.map(loadWidgetData));
    
    setIsRefreshing(false);
    onRefresh?.();
  };

  const handleRefreshWidget = async (widget: DashboardWidget) => {
    // Clear existing data to force a fresh load
    setWidgetData(prev => ({
      ...prev,
      [widget.id]: {
        ...prev[widget.id],
        data: null,
        loading: true,
        error: null
      }
    }));
    
    // Reload the widget data
    await loadWidgetData(widget);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleWidgetSettingsChange = async (widgetId: string, changes: any) => {
    // Find the widget
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    // Update the widget configuration locally
    const updatedWidget = {
      ...widget,
      configuration: {
        ...widget.configuration,
        reportConfiguration: {
          ...widget.configuration?.reportConfiguration,
          chartSettingsOverrides: {
            ...widget.configuration?.reportConfiguration?.chartSettingsOverrides,
            visualizationSettings: {
              ...widget.configuration?.reportConfiguration?.chartSettingsOverrides?.visualizationSettings,
              ...changes
            }
          }
        }
      }
    };

    // Update in database
    await DashboardService.updateWidget(widgetId, updatedWidget);
    
    // Reload the widget data to apply changes
    if (widget.type === 'report' && widget.reportId) {
      loadWidgetData(widget);
    }
  };

  const handleViewportSave = async (widgetId: string, viewport: ViewportConfiguration) => {
    // Find the widget
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;

    // Update the widget configuration with the viewport
    // When user explicitly saves a viewport, set autoFit to false
    const updatedWidget = {
      ...widget,
      configuration: {
        ...widget.configuration,
        viewport: {
          ...viewport,
          autoFit: false // User has saved a custom view, don't auto-fit
        }
      }
    };

    // Update in database
    await DashboardService.updateWidget(widgetId, updatedWidget);
  };

  const renderWidget = (widget: DashboardWidget) => {
    const cellSize = 80;
    const gap = 16;

    const style: React.CSSProperties = {
      position: 'absolute',
      left: widget.position.x * (cellSize + gap),
      top: widget.position.y * (cellSize + gap),
      width: widget.position.width * cellSize + (widget.position.width - 1) * gap,
      height: widget.position.height * cellSize + (widget.position.height - 1) * gap,
      backgroundColor: widget.backgroundColor || 'white',
      borderRadius: widget.borderRadius || 8,
      zIndex: widget.zIndex,
      display: widget.isVisible ? 'block' : 'none'
    };

    // Remove borders for text widgets
    if (widget.type !== 'text' && widget.showBorder) {
      style.border = `1px solid ${widget.borderColor || '#e5e7eb'}`;
    }

    // Remove shadow for text widgets
    if (widget.type !== 'text' && widget.shadow) {
      style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
    }

    return (
      <div key={widget.id} style={style} className="overflow-hidden">
        {widget.showTitle && (
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">{widget.title}</h3>
            {widget.type === 'report' && (
              <div className="flex items-center space-x-2">
                {widgetData[widget.id]?.lastRefreshed && (
                  <span className="text-xs text-gray-500">
                    Updated {formatDistanceToNow(widgetData[widget.id].lastRefreshed!, { addSuffix: true })}
                  </span>
                )}
                <button
                  onClick={() => handleRefreshWidget(widget)}
                  className="p-1 hover:bg-gray-100 rounded"
                  disabled={widgetData[widget.id]?.loading}
                >
                  <RefreshCw 
                    size={14} 
                    className={`text-gray-600 ${widgetData[widget.id]?.loading ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className={`${widget.showTitle ? 'h-[calc(100%-3rem)]' : 'h-full'} p-4 overflow-auto`}>
          {renderWidgetContent(widget)}
        </div>
      </div>
    );
  };

  const renderWidgetContent = (widget: DashboardWidget) => {
    // Calculate widget dimensions for chart sizing
    const cellSize = 80;
    const gap = 16;
    const padding = 16; // Account for widget padding
    const titleHeight = 48; // Account for title bar if shown
    
    const widgetWidth = widget.position.width * cellSize + (widget.position.width - 1) * gap;
    const widgetHeight = widget.position.height * cellSize + (widget.position.height - 1) * gap;
    
    // Calculate inner dimensions for chart content
    const containerWidth = widgetWidth - (padding * 2);
    const containerHeight = widgetHeight - (widget.showTitle ? titleHeight + padding : padding * 2);
    
    // Get saved chart dimensions or use container dimensions
    const savedDimensions = widget.configuration?.reportConfiguration?.chartSettingsOverrides?.visualizationSettings?.dimensions;
    const chartWidth = savedDimensions?.width || containerWidth;
    const chartHeight = savedDimensions?.height || containerHeight;
    switch (widget.type) {
      case 'report':
        if (!widget.reportId) {
          return <div className="text-gray-500">No report selected</div>;
        }

        const widgetState = widgetData[widget.id];
        
        if (!widgetState || widgetState.loading) {
          return <WidgetSkeleton type="report" showTitle={false} />;
        }

        if (widgetState.error) {
          return (
            <ErrorDisplay
              type={getErrorType(widgetState.error)}
              message={widgetState.error}
              actions={[
                commonErrorActions.retry(() => handleRefreshWidget(widget)),
                {
                  label: 'Edit Report',
                  icon: <Settings size={16} />,
                  onClick: () => window.open(`/reports/builder?edit=${widget.reportId}`, '_blank'),
                  variant: 'secondary'
                }
              ]}
            />
          );
        }

        if (!widgetState.data) {
          return (
            <ErrorDisplay
              type="data-not-found"
              message="No data returned from this report"
              actions={[
                commonErrorActions.retry(() => handleRefreshWidget(widget)),
                {
                  label: 'Check Report Filters',
                  icon: <Filter size={16} />,
                  onClick: () => window.open(`/reports/builder?edit=${widget.reportId}`, '_blank'),
                  variant: 'secondary'
                }
              ]}
            />
          );
        }

        // Get the report configuration from widget data
        const reportConfig = widgetState.data?.metadata?.reportConfig;
        
        if (!reportConfig) {
          console.error('No report configuration found in widget data', {
            widgetId: widget.id,
            metadata: widgetState.data?.metadata
          });
          return (
            <ErrorDisplay
              type="configuration-error"
              title="Report Configuration Missing"
              message="The report configuration could not be loaded"
              details={`Report ID: ${widget.reportId}`}
              actions={[
                commonErrorActions.retry(() => handleRefreshWidget(widget)),
                commonErrorActions.configure(() => window.open(`/reports/builder?edit=${widget.reportId}`, '_blank'))
              ]}
            />
          );
        }
        
        // Apply widget-level chart overrides
        const widgetChartOverrides = widget.configuration?.reportConfiguration?.chartSettingsOverrides;
        const chartType = widgetChartOverrides?.chartType || reportConfig.chartType || 'bar';
        const visualizationSettings = {
          ...reportConfig.visualizationSettings,
          ...(widgetChartOverrides?.visualizationSettings || {})
        };
        
        console.log('Rendering widget:', {
          widgetId: widget.id,
          widgetTitle: widget.title,
          chartType,
          reportVisualizationSettings: reportConfig.visualizationSettings,
          widgetOverrides: widgetChartOverrides?.visualizationSettings,
          finalVisualizationSettings: visualizationSettings,
          hasData: !!widgetState.data?.data,
          dataLength: widgetState.data?.data?.length,
          widgetDimensions: {
            widgetWidth,
            widgetHeight,
            chartWidth,
            chartHeight,
            gridPosition: widget.position
          }
        });

        // Render table or chart based on type
        if (chartType === 'table') {
          return (
            <TableVisualization
              data={widgetState.data}
              settings={visualizationSettings}
              className="h-full"
            />
          );
        }

        // Get saved dimensions or use container dimensions as defaults
        const savedChartDimensions = widget.configuration?.reportConfiguration?.chartSettingsOverrides?.visualizationSettings?.dimensions;
        const finalDimensions = {
          width: savedChartDimensions?.width || containerWidth,
          height: savedChartDimensions?.height || containerHeight,
          margin: savedChartDimensions?.margin || {
            top: 30,
            right: 60,
            bottom: 40,
            left: 50
          }
        };
        
        // Debug viewport configuration
        console.log('Widget viewport configuration:', {
          widgetId: widget.id,
          widgetTitle: widget.title,
          hasConfiguration: !!widget.configuration,
          hasViewport: !!widget.configuration?.viewport,
          viewport: widget.configuration?.viewport,
          savedDimensions: savedChartDimensions
        });

        return (
          <div className="w-full h-full overflow-auto">
            <BaseChart
              data={widgetState.data}
              settings={{
                ...visualizationSettings,
                // Override dimensions with final calculated dimensions
                dimensions: finalDimensions,
                // Use saved viewport if available, otherwise default with autoFit
                viewport: widget.configuration?.viewport || {
                  scale: 1.0,
                  panX: 0,
                  panY: 0,
                  autoFit: true // Only auto-fit if no saved viewport
                }
              }}
              chartType={chartType}
              className="dashboard-widget-chart"
            onContextMenu={isEditMode ? (e) => {
              setSettingsModal({
                isOpen: true,
                widgetId: widget.id,
                widget: widget,
                currentViewport: widget.configuration?.viewport
              });
            } : undefined}
            onViewportChange={(viewport) => {
              // Update the current viewport in the modal if it's open
              if (settingsModal.widgetId === widget.id) {
                setSettingsModal(prev => ({
                  ...prev,
                  currentViewport: viewport
                }));
              }
            }}
            onSettingsChange={(changes) => {
              // Handle settings changes from the modal
              handleWidgetSettingsChange(widget.id, changes);
            }}
          />
          </div>
        );

      case 'text':
        const textConfig = widget.configuration?.textConfiguration;
        return (
          <div
            className="h-full overflow-auto p-4"
            style={{
              fontSize: textConfig?.fontSize || 14,
              fontFamily: textConfig?.fontFamily || 'inherit',
              color: textConfig?.color || '#374151',
              textAlign: textConfig?.alignment || 'left'
            }}
          >
            {/* Always render as HTML since RichTextWidget saves HTML */}
            <div 
              className="rich-text-widget-content"
              dangerouslySetInnerHTML={{ __html: textConfig?.content || '' }} 
            />
          </div>
        );

      case 'metric':
        const metricConfig = widget.configuration?.metricConfiguration || {};
        return (
          <DataMetricWidget
            reportId={metricConfig.reportId}
            metricField={metricConfig.metricField}
            aggregation={metricConfig.aggregation}
            label={metricConfig.label}
            format={metricConfig.format}
            color={metricConfig.color}
            comparisonReportId={metricConfig.comparisonReportId}
            comparisonType={metricConfig.comparisonType}
            filters={globalFilters}
          />
        );

      case 'facility':
        const facilityConfig = widget.configuration?.facilityConfiguration || {};
        // Calculate height based on widget position
        const facilityHeight = (widget.position.height * 80 + (widget.position.height - 1) * 16) - 100;
        return (
          <FacilityAnalyticsWidget
            siteId={facilityConfig.siteId}
            showDatePicker={facilityConfig.showDatePicker}
            showSiteSelector={facilityConfig.showSiteSelector}
            height={facilityHeight}
            onMetricClick={(metric, value) => {
              console.log('Facility metric clicked in dashboard:', metric, value);
            }}
          />
        );

      case 'image':
        const imageConfig = widget.configuration?.imageConfiguration;
        return (
          <div className="flex items-center justify-center h-full">
            <img
              src={imageConfig?.src || ''}
              alt={imageConfig?.alt || ''}
              className="max-w-full max-h-full"
              style={{
                objectFit: imageConfig?.fit || 'contain'
              }}
            />
          </div>
        );

      case 'iframe':
        const iframeConfig = widget.configuration?.iframeConfiguration;
        return (
          <iframe
            src={iframeConfig?.src || ''}
            className="w-full h-full border-0"
            sandbox={iframeConfig?.sandbox || 'allow-scripts allow-same-origin'}
            allowFullScreen={iframeConfig?.allowFullscreen}
          />
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            Widget type not supported: {widget.type}
          </div>
        );
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : ''} bg-gray-50`}
    >
      {/* Header (if not embedded) */}
      {!isEmbedded && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{dashboard.name}</h1>
              {dashboard.description && (
                <p className="text-sm text-gray-600 mt-1">{dashboard.description}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                icon={<Filter size={20} />}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </Button>
              
              <Button
                variant="ghost"
                icon={<RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />}
                onClick={handleRefreshAll}
                disabled={isRefreshing}
              >
                Refresh All
              </Button>
              
              <Button
                variant="ghost"
                icon={<Fullscreen size={20} />}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </Button>
              
              <Button
                variant="ghost"
                icon={<Download size={20} />}
                onClick={() => {/* Implement export */}}
              >
                Export
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && !isEmbedded && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  className="px-3 py-2 border border-gray-300 rounded-md"
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  className="px-3 py-2 border border-gray-300 rounded-md"
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                />
              </div>
            </div>
            
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                widgets.forEach(w => {
                  if (w.type === 'report' && w.reportId) {
                    loadWidgetData(w);
                  }
                });
              }}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Dashboard Canvas */}
      <div className="relative overflow-auto p-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div 
          className="relative"
          style={{
            width: (dashboard.layout?.columns || 12) * 80 + ((dashboard.layout?.columns || 12) - 1) * (dashboard.layout?.gap || 16),
            height: (dashboard.layout?.rows || 8) * 80 + ((dashboard.layout?.rows || 8) - 1) * (dashboard.layout?.gap || 16),
            minWidth: '100%'
          }}
        >
          {widgets.map(renderWidget)}
        </div>
      </div>
      
      {/* Chart Settings Modal */}
      {settingsModal.widget && settingsModal.widgetId && (
        <ChartSettingsModal
          isOpen={settingsModal.isOpen}
          onClose={() => setSettingsModal({ isOpen: false, widgetId: null, widget: null })}
          visualizationSettings={
            settingsModal.widget.configuration?.reportConfiguration?.chartSettingsOverrides?.visualizationSettings ||
            widgetData[settingsModal.widgetId]?.data?.metadata?.reportConfig?.visualizationSettings ||
            {}
          }
          currentViewport={settingsModal.currentViewport}
          onSettingsChange={(changes) => {
            if (settingsModal.widgetId) {
              handleWidgetSettingsChange(settingsModal.widgetId, changes);
            }
          }}
          onViewportSave={(viewport) => {
            if (settingsModal.widgetId) {
              handleViewportSave(settingsModal.widgetId, viewport);
            }
          }}
        />
      )}
    </div>
  );
};