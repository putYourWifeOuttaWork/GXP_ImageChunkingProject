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
}

export const DashboardWidgetPreview: React.FC<DashboardWidgetPreviewProps> = ({
  widget,
  isSelected,
  onConfigureClick,
  onRemove,
  isEditMode
}) => {
  const [data, setData] = useState<AggregatedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportConfig, setReportConfig] = useState<any>(null);

  useEffect(() => {
    if (widget.type === 'report' && widget.reportId) {
      loadWidgetData();
    }
  }, [widget.reportId, widget.configuration?.reportConfiguration?.isolationFilters]);

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

  const renderContent = () => {
    // Handle text widget
    if (widget.type === 'text') {
      const textConfig = widget.configuration?.textConfiguration || {};
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
      return (
        <div className="flex items-center justify-center h-full">
          <LoadingScreen />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-red-600">
          <div className="text-center">
            <p className="font-medium">Error loading data</p>
            <p className="text-sm mt-1">{error}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadWidgetData}
              className="mt-2"
            >
              Try again
            </Button>
          </div>
        </div>
      );
    }

    if (!data || !reportConfig) {
      return <div className="text-gray-500 text-center">No data available</div>;
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
        settings={visualizationSettings}
        chartType={chartType}
        className="h-full"
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
    </div>
  );
};