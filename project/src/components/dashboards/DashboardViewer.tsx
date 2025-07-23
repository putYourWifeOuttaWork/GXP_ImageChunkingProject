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

interface DashboardViewerProps {
  dashboard: Dashboard;
  widgets: DashboardWidget[];
  isEmbedded?: boolean;
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
      // Get report configuration from Supabase
      const { data: reportData, error: reportError } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('report_id', widget.reportId)
        .single();
      
      if (reportError) throw reportError;
      if (!reportData) throw new Error('Report not found');
      
      const report = {
        configuration: reportData.report_config
      };

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
        
        <div className={`${widget.showTitle ? 'h-[calc(100%-3rem)]' : 'h-full'} p-4`}>
          {renderWidgetContent(widget)}
        </div>
      </div>
    );
  };

  const renderWidgetContent = (widget: DashboardWidget) => {
    switch (widget.type) {
      case 'report':
        if (!widget.reportId) {
          return <div className="text-gray-500">No report selected</div>;
        }

        const widgetState = widgetData[widget.id];
        
        if (!widgetState || widgetState.loading) {
          return (
            <div className="flex items-center justify-center h-full">
              <LoadingScreen />
            </div>
          );
        }

        if (widgetState.error) {
          return (
            <div className="flex items-center justify-center h-full text-red-600">
              <div className="text-center">
                <p className="font-medium">Error loading data</p>
                <p className="text-sm mt-1">{widgetState.error}</p>
                <button
                  onClick={() => handleRefreshWidget(widget)}
                  className="mt-4 text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  Try again
                </button>
              </div>
            </div>
          );
        }

        if (!widgetState.data) {
          return <div className="text-gray-500">No data available</div>;
        }

        // Get the report configuration from widget data
        const reportConfig = widgetState.data?.metadata?.reportConfig;
        
        if (!reportConfig) {
          console.error('No report configuration found in widget data', {
            widgetId: widget.id,
            metadata: widgetState.data?.metadata
          });
          return (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="font-medium">Unable to load visualization</p>
                <p className="text-sm mt-1">Report configuration is missing</p>
              </div>
            </div>
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
          chartType,
          hasData: !!widgetState.data?.data,
          dataLength: widgetState.data?.data?.length
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

        return (
          <BaseChart
            data={widgetState.data}
            settings={visualizationSettings}
            chartType={chartType}
            className="h-full"
          />
        );

      case 'text':
        const textConfig = widget.configuration?.textConfiguration;
        return (
          <div
            className="prose max-w-none h-full overflow-auto p-4"
            style={{
              fontSize: textConfig?.fontSize || 14,
              fontFamily: textConfig?.fontFamily || 'inherit',
              color: textConfig?.color || '#374151',
              textAlign: textConfig?.alignment || 'left'
            }}
          >
            {textConfig?.markdown ? (
              <div dangerouslySetInnerHTML={{ __html: textConfig.content || '' }} />
            ) : (
              <p className="whitespace-pre-wrap">{textConfig?.content || ''}</p>
            )}
          </div>
        );

      case 'metric':
        const metricConfig = widget.configuration?.metricConfiguration;
        const formatMetricValue = (val: number | string): string => {
          if (typeof val === 'string') return val;
          
          if (metricConfig?.format === 'currency') {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(val);
          }
          
          if (metricConfig?.format === 'percentage') {
            return `${val}%`;
          }
          
          if (metricConfig?.format === 'number') {
            return new Intl.NumberFormat('en-US').format(val);
          }
          
          return val.toString();
        };

        return (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <div 
                className="text-5xl font-bold mb-2"
                style={{ color: metricConfig?.color || '#3B82F6' }}
              >
                {formatMetricValue(metricConfig?.value || 0)}
              </div>
              <div className="text-lg text-gray-600">
                {metricConfig?.label || 'Metric'}
              </div>
              {metricConfig?.trend && (
                <div className="flex items-center justify-center mt-4">
                  <span className={`text-lg font-medium ${
                    metricConfig.trend.direction === 'up' ? 'text-green-600' : 
                    metricConfig.trend.direction === 'down' ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {metricConfig.trend.direction === 'up' ? '↑' : 
                     metricConfig.trend.direction === 'down' ? '↓' : '→'} 
                    {metricConfig.trend.percentage > 0 ? '+' : ''}{metricConfig.trend.percentage}%
                  </span>
                </div>
              )}
              {metricConfig?.comparison && (
                <div className="mt-2 text-sm text-gray-500">
                  vs. {metricConfig.comparison.label}: {formatMetricValue(metricConfig.comparison.value)}
                </div>
              )}
            </div>
          </div>
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
    </div>
  );
};