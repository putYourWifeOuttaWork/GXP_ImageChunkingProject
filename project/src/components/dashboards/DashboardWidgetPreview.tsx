import React, { useState, useEffect } from 'react';
import { DashboardWidget } from '../../types/reporting/dashboardTypes';
import { AggregatedData } from '../../types/reporting';
import { ReportingDataService } from '../../services/reportingDataService';
import { BaseChart } from '../reporting/visualizations/base/BaseChart';
import { TableVisualization } from '../reporting/visualizations/TableVisualization';
import LoadingScreen from '../common/LoadingScreen';
import { supabase } from '../../lib/supabaseClient';
import { RichTextWidget } from './widgets/RichTextWidget';
import { DataMetricWidget } from './widgets/DataMetricWidget';
import { ChartSettingsModal } from './ChartSettingsModal';
import { ViewportConfiguration } from '../../types/reporting/visualizationTypes';
import { 
  Settings, 
  Filter, 
  Maximize2, 
  X, 
  BarChart3, 
  RefreshCw,
  ExternalLink 
} from 'lucide-react';
import Button from '../common/Button';
import { WidgetSkeleton } from './WidgetSkeleton';
import { ErrorDisplay, commonErrorActions, getErrorType } from '../common/ErrorDisplay';
import { FacilityAnalyticsWidget } from './widgets/FacilityAnalyticsWidget';

// Deep merge helper function
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

interface DashboardWidgetPreviewProps {
  widget: DashboardWidget;
  isSelected: boolean;
  onConfigureClick: () => void;
  onRemove: () => void;
  isEditMode: boolean;
  onWidgetUpdate?: (widget: DashboardWidget) => void;
}

export const DashboardWidgetPreview: React.FC<DashboardWidgetPreviewProps> = ({
  widget,
  isSelected,
  onConfigureClick,
  onRemove,
  isEditMode,
  onWidgetUpdate
}) => {
  const [data, setData] = useState<AggregatedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportConfig, setReportConfig] = useState<any>(null);
  const [settingsModal, setSettingsModal] = useState<{
    isOpen: boolean;
    currentViewport?: ViewportConfiguration;
  }>({
    isOpen: false
  });

  useEffect(() => {
    if (widget.type === 'report' && widget.reportId) {
      loadWidgetData();
    } else if (widget.type === 'image' && widget.configuration?.imageConfiguration?.src) {
      // Set loading state for images
      setLoading(true);
    }
  }, [widget.reportId, widget.configuration?.reportConfiguration?.isolationFilters, widget.configuration?.imageConfiguration?.src]);

  const loadWidgetData = async () => {
    if (!widget.reportId) return;

    setLoading(true);
    setError(null);

    try {
      // Get report configuration from Supabase
      const { data: reportData, error: reportError } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('report_id', widget.reportId)
        .single();
      
      if (reportError) throw reportError;
      if (!reportData) throw new Error('Report not found');
      
      const baseConfig = reportData.report_config;
      setReportConfig(baseConfig);

      // Apply widget-level overrides
      const isolationFilters = widget.configuration?.reportConfiguration?.isolationFilters || {};
      const chartOverrides = widget.configuration?.reportConfiguration?.chartSettingsOverrides || {};

      // Merge configurations with deep merge for visualization settings
      const finalConfig = {
        ...baseConfig,
        isolationFilters: {
          ...baseConfig.isolationFilters,
          ...isolationFilters
        },
        chartType: chartOverrides.chartType || baseConfig.chartType,
        visualizationSettings: deepMerge(
          baseConfig.visualizationSettings || {},
          chartOverrides.visualizationSettings || {}
        )
      };

      // Fetch data with merged configuration
      const fetchedData = await ReportingDataService.executeReport(finalConfig);

      if (!fetchedData) throw new Error('No data returned');

      setData(fetchedData);
    } catch (err) {
      console.error('Error loading widget data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (newContent: string) => {
    // Update widget configuration with new text content
    if (widget.configuration) {
      widget.configuration.textConfiguration = {
        ...widget.configuration.textConfiguration,
        content: newContent
      };
    }
  };

  const handleSettingsChange = (changes: any) => {
    // Update widget configuration with new settings
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
    
    onWidgetUpdate?.(updatedWidget);
  };

  const handleViewportSave = (viewport: ViewportConfiguration) => {
    // Update widget configuration with new viewport
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
    
    onWidgetUpdate?.(updatedWidget);
  };

  const renderContent = () => {
    // Handle text widget
    if (widget.type === 'text') {
      const textConfig = widget.configuration?.textConfiguration || {};
      
      // Show skeleton briefly for text widgets on initial load
      if (loading && !textConfig.content) {
        return <WidgetSkeleton type="text" showTitle={false} />;
      }
      
      return (
        <RichTextWidget
          content={textConfig.content || ''}
          isEditMode={isEditMode}
          onContentChange={handleTextChange}
        />
      );
    }

    // Handle metric widget
    if (widget.type === 'metric') {
      const metricConfig = widget.configuration?.metricConfiguration || {};
      
      // Show skeleton while loading initial data for metric widget
      if (!metricConfig.reportId || loading) {
        return <WidgetSkeleton type="metric" showTitle={false} />;
      }
      
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
          filters={[]}
        />
      );
    }

    // Handle facility widget
    if (widget.type === 'facility') {
      const facilityConfig = widget.configuration?.facilityConfiguration || {};
      
      return (
        <FacilityAnalyticsWidget
          siteId={facilityConfig.siteId}
          showDatePicker={facilityConfig.showDatePicker}
          showSiteSelector={facilityConfig.showSiteSelector}
          height={300}
          onMetricClick={(metric, value) => {
            console.log('Facility metric clicked:', metric, value);
          }}
        />
      );
    }

    // Handle image widget
    if (widget.type === 'image') {
      const imageConfig = widget.configuration?.imageConfiguration || {};
      
      // Show skeleton while image is loading
      if (loading && imageConfig.src) {
        return <WidgetSkeleton type="image" showTitle={false} />;
      }
      
      return (
        <div className="flex items-center justify-center h-full p-4">
          {imageConfig.src ? (
            <img
              src={imageConfig.src}
              alt={imageConfig.alt || ''}
              className="max-w-full max-h-full"
              style={{
                objectFit: imageConfig.fit || 'contain'
              }}
              onLoad={() => setLoading(false)}
            />
          ) : (
            <div className="text-center text-gray-500">
              <p className="text-sm">No image selected</p>
              <p className="text-xs mt-1">Click settings to add an image</p>
            </div>
          )}
        </div>
      );
    }

    // Handle report widget
    if (widget.type !== 'report' || !widget.reportId) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <BarChart3 size={48} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">{widget.title || 'Empty Widget'}</p>
          </div>
        </div>
      );
    }

    if (loading) {
      return <WidgetSkeleton type="report" showTitle={false} />;
    }

    if (error) {
      return (
        <ErrorDisplay
          type={getErrorType(error)}
          message={error}
          actions={[
            commonErrorActions.retry(loadWidgetData),
            {
              label: 'Configure Widget',
              icon: <Settings size={16} />,
              onClick: onConfigureClick,
              variant: 'secondary'
            }
          ]}
        />
      );
    }

    if (!data || !reportConfig) {
      return (
        <ErrorDisplay
          type="data-not-found"
          message="No data available for this widget"
          actions={[
            commonErrorActions.retry(loadWidgetData),
            commonErrorActions.configure(onConfigureClick)
          ]}
        />
      );
    }

    // Apply widget-level chart overrides with deep merge
    const chartType = widget.configuration?.reportConfiguration?.chartSettingsOverrides?.chartType || reportConfig.chartType || 'bar';
    const visualizationSettings = deepMerge(
      reportConfig.visualizationSettings || {},
      widget.configuration?.reportConfiguration?.chartSettingsOverrides?.visualizationSettings || {}
    );

    if (chartType === 'table') {
      return (
        <TableVisualization
          data={data}
          settings={visualizationSettings}
          className="h-full"
        />
      );
    }

    return (
      <BaseChart
        data={data}
        settings={{
          ...visualizationSettings,
          // Use saved viewport if available, otherwise default with autoFit
          viewport: widget.configuration?.viewport || {
            scale: 1.0,
            panX: 0,
            panY: 0,
            autoFit: true // Only auto-fit if no saved viewport
          }
        }}
        chartType={chartType}
        className="h-full"
        onContextMenu={isEditMode ? (e) => {
          e.preventDefault();
          setSettingsModal({
            isOpen: true,
            currentViewport: widget.configuration?.viewport
          });
        } : undefined}
        onViewportChange={(viewport) => {
          // Update current viewport in modal if open
          if (settingsModal.isOpen) {
            setSettingsModal(prev => ({
              ...prev,
              currentViewport: viewport
            }));
          }
        }}
        onSettingsChange={handleSettingsChange}
      />
    );
  };

  return (
    <div className={`relative h-full group ${widget.type === 'text' ? '' : 'border border-gray-200 rounded-lg shadow-sm'}`}>
      {/* Widget Header - Only show in edit mode */}
      {isEditMode && (
        <div className={`absolute inset-x-0 top-0 h-10 bg-gray-50 border-b border-gray-200 rounded-t-lg flex items-center justify-between px-3 z-10 transition-opacity ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <span className="text-sm font-medium text-gray-700 truncate">
            {widget.title || 'Widget'}
          </span>
          <div className="flex items-center space-x-1">
            {widget.reportId && (
              <Button
                variant="ghost"
                size="sm"
                icon={<ExternalLink size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/reports/builder?edit=${widget.reportId}`, '_blank');
                }}
                title="Open report in new tab"
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                loadWidgetData();
              }}
              title="Refresh data"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onConfigureClick();
              }}
              title="Configure widget"
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<X size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="Remove widget"
            />
          </div>
        </div>
      )}

      {/* Widget Content */}
      <div className={`${isEditMode ? 'pt-10' : ''} h-full p-4 overflow-hidden`}>
        {renderContent()}
      </div>

      {/* Selection Indicator */}
      {isEditMode && isSelected && (
        <div className="absolute inset-0 pointer-events-none border-2 border-primary-500 rounded-lg" />
      )}
      
      {/* Chart Settings Modal */}
      {widget.type === 'report' && data && (
        <ChartSettingsModal
          isOpen={settingsModal.isOpen}
          onClose={() => setSettingsModal({ isOpen: false })}
          visualizationSettings={
            widget.configuration?.reportConfiguration?.chartSettingsOverrides?.visualizationSettings ||
            reportConfig?.visualizationSettings ||
            {}
          }
          currentViewport={settingsModal.currentViewport}
          onSettingsChange={handleSettingsChange}
          onViewportSave={handleViewportSave}
        />
      )}
    </div>
  );
};