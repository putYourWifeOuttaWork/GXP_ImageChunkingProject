import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DashboardWidget } from '../../types/reporting/dashboardTypes';
import { ChartType, VisualizationSettings } from '../../types/reporting';
import Button from '../common/Button';
import { supabase } from '../../lib/supabaseClient';
import { IsolationFilterSelect } from './IsolationFilterSelect';
import { ChartSettingsPanel } from '../reporting/builder/ChartSettingsPanel';

interface WidgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget: DashboardWidget;
  onSave: (updatedWidget: DashboardWidget) => void;
}

export const WidgetConfigModal: React.FC<WidgetConfigModalProps> = ({
  isOpen,
  onClose,
  widget,
  onSave
}) => {
  const [title, setTitle] = useState(widget.title || '');
  const [showTitle, setShowTitle] = useState(widget.showTitle ?? true);
  const [showBorder, setShowBorder] = useState(widget.showBorder ?? true);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [isolationFilters, setIsolationFilters] = useState<Record<string, string[]>>({});
  const [visualizationSettings, setVisualizationSettings] = useState<VisualizationSettings>({});
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [reportConfig, setReportConfig] = useState<any>(null);
  
  // Metric widget specific state
  const [metricReportId, setMetricReportId] = useState('');
  const [metricField, setMetricField] = useState('');
  const [metricAggregation, setMetricAggregation] = useState<'count' | 'sum' | 'avg' | 'min' | 'max'>('count');
  const [metricLabel, setMetricLabel] = useState('');
  const [metricFormat, setMetricFormat] = useState<'number' | 'currency' | 'percentage'>('number');
  const [metricColor, setMetricColor] = useState('#3B82F6');
  const [availableReports, setAvailableReports] = useState<any[]>([]);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [showTrend, setShowTrend] = useState(false);
  const [comparisonReportId, setComparisonReportId] = useState('');
  const [comparisonType, setComparisonType] = useState<'value' | 'percentage'>('percentage');
  
  // Text widget specific state
  const [textContent, setTextContent] = useState('');
  const [textFontSize, setTextFontSize] = useState(14);
  const [textAlignment, setTextAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');

  useEffect(() => {
    // Initialize report widget configuration
    if (widget.configuration?.reportConfiguration) {
      const config = widget.configuration.reportConfiguration;
      setIsolationFilters(config.isolationFilters || {});
      
      if (config.chartSettingsOverrides) {
        setChartType(config.chartSettingsOverrides.chartType || 'bar');
        setVisualizationSettings(config.chartSettingsOverrides.visualizationSettings || {});
      }
    }
    
    // Initialize metric widget configuration
    if (widget.type === 'metric' && widget.configuration?.metricConfiguration) {
      const metricConfig = widget.configuration.metricConfiguration;
      setMetricReportId(metricConfig.reportId || '');
      setMetricField(metricConfig.metricField || '');
      setMetricAggregation(metricConfig.aggregation || 'count');
      setMetricLabel(metricConfig.label || 'Metric');
      setMetricFormat(metricConfig.format || 'number');
      setMetricColor(metricConfig.color || '#3B82F6');
      setShowTrend(!!metricConfig.comparisonReportId);
      setComparisonReportId(metricConfig.comparisonReportId || '');
      setComparisonType(metricConfig.comparisonType || 'percentage');
    }
    
    // Initialize text widget configuration
    if (widget.type === 'text' && widget.configuration?.textConfiguration) {
      const textConfig = widget.configuration.textConfiguration;
      setTextContent(textConfig.content || '');
      setTextFontSize(textConfig.fontSize || 14);
      setTextAlignment(textConfig.alignment || 'left');
    }
    
    // Load report configuration to get available filters
    if (widget.reportId) {
      loadReportConfig();
    }
    
    // Load available reports for metric widget
    if (widget.type === 'metric') {
      loadAvailableReports();
    }
  }, [widget]);

  const loadReportConfig = async () => {
    if (!widget.reportId) return;

    try {
      const { data: reportData, error } = await supabase
        .from('saved_reports')
        .select('report_config')
        .eq('report_id', widget.reportId)
        .single();
      
      if (error) throw error;
      if (reportData?.report_config) {
        setReportConfig(reportData.report_config);
        setChartType(reportData.report_config.chartType || 'bar');
        setVisualizationSettings(reportData.report_config.visualizationSettings || {});
        
        // Extract available segments for isolation filters
        // Segments are what the report is grouped by (program_id, site_id, etc.)
        const segments = reportData.report_config.selectedSegments || reportData.report_config.segmentBy || [];
        setAvailableSegments(segments);
      }
    } catch (err) {
      console.error('Error loading report config:', err);
    }
  };

  const loadAvailableReports = async () => {
    try {
      const { data: reports, error } = await supabase
        .from('saved_reports')
        .select('report_id, report_name, report_config')
        .order('report_name');
      
      if (!error && reports) {
        setAvailableReports(reports);
        
        // If a report is already selected, load its fields
        if (metricReportId) {
          const selectedReport = reports.find(r => r.report_id === metricReportId);
          if (selectedReport) {
            loadReportFields(selectedReport.report_config);
          }
        }
      }
    } catch (err) {
      console.error('Error loading available reports:', err);
    }
  };

  const loadReportFields = (reportConfig: any) => {
    const fields: any[] = [];
    
    // Add measures as available fields
    if (reportConfig.measures && reportConfig.measures.length > 0) {
      reportConfig.measures.forEach((measure: any) => {
        fields.push({
          field: measure.field,
          label: measure.label || measure.field,
          type: 'measure'
        });
      });
    }
    
    // Add dimensions that can be counted
    if (reportConfig.dimensions && reportConfig.dimensions.length > 0) {
      reportConfig.dimensions.forEach((dimension: any) => {
        fields.push({
          field: dimension.field,
          label: dimension.label || dimension.field,
          type: 'dimension'
        });
      });
    }
    
    setAvailableFields(fields);
  };

  const handleMetricReportChange = (reportId: string) => {
    setMetricReportId(reportId);
    
    // Load fields for the selected report
    const selectedReport = availableReports.find(r => r.report_id === reportId);
    if (selectedReport) {
      loadReportFields(selectedReport.report_config);
      
      // Auto-set label from report name if not already set
      if (!metricLabel) {
        setMetricLabel(`${selectedReport.report_name} - ${metricAggregation}`);
      }
    }
  };

  const handleSave = () => {
    let configuration = { ...widget.configuration };

    // Handle report widget configuration
    if (widget.type === 'report') {
      configuration.reportConfiguration = {
        ...(widget.configuration?.reportConfiguration || {
          showFilters: true,
          showExport: true,
          showRefresh: true,
          autoRefresh: false,
          refreshInterval: 300000
        }),
        isolationFilters,
        chartSettingsOverrides: {
          chartType,
          visualizationSettings
        }
      };
    }
    
    // Handle metric widget configuration
    else if (widget.type === 'metric') {
      configuration.metricConfiguration = {
        reportId: metricReportId,
        metricField: metricField,
        aggregation: metricAggregation,
        label: metricLabel,
        format: metricFormat,
        color: metricColor,
        ...(showTrend && comparisonReportId && {
          comparisonReportId: comparisonReportId,
          comparisonType: comparisonType
        })
      };
    }
    
    // Handle text widget configuration
    else if (widget.type === 'text') {
      configuration.textConfiguration = {
        content: textContent,
        fontSize: textFontSize,
        alignment: textAlignment,
        fontFamily: 'inherit',
        color: '#374151',
        markdown: false
      };
    }

    const updatedWidget: DashboardWidget = {
      ...widget,
      title,
      showTitle,
      showBorder,
      configuration
    };

    onSave(updatedWidget);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Configure Widget</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Basic Settings */}
          <div>
            <h3 className="text-lg font-medium mb-4">Basic Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Widget Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter widget title"
                />
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showTitle}
                    onChange={(e) => setShowTitle(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">Show Title</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showBorder}
                    onChange={(e) => setShowBorder(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">Show Border</span>
                </label>
              </div>
            </div>
          </div>

          {/* Metric Widget Settings */}
          {widget.type === 'metric' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Metric Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Report
                  </label>
                  <select
                    value={metricReportId}
                    onChange={(e) => handleMetricReportChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select a report...</option>
                    {availableReports.map(report => (
                      <option key={report.report_id} value={report.report_id}>
                        {report.report_name}
                      </option>
                    ))}
                  </select>
                </div>

                {metricReportId && availableFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Metric Field
                      </label>
                      <select
                        value={metricField}
                        onChange={(e) => setMetricField(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Count all records</option>
                        {availableFields.map(field => (
                          <option key={field.field} value={field.field}>
                            {field.label} ({field.type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Aggregation
                      </label>
                      <select
                        value={metricAggregation}
                        onChange={(e) => setMetricAggregation(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="count">Count</option>
                        {metricField && (
                          <>
                            <option value="sum">Sum</option>
                            <option value="avg">Average</option>
                            <option value="min">Minimum</option>
                            <option value="max">Maximum</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={metricLabel}
                      onChange={(e) => setMetricLabel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter metric label"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Format
                    </label>
                    <select
                      value={metricFormat}
                      onChange={(e) => setMetricFormat(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="number">Number</option>
                      <option value="currency">Currency</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={metricColor}
                    onChange={(e) => setMetricColor(e.target.value)}
                    className="h-10 w-full"
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showTrend}
                      onChange={(e) => setShowTrend(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Show Trend Comparison</span>
                  </label>
                </div>

                {showTrend && (
                  <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comparison Report
                      </label>
                      <select
                        value={comparisonReportId}
                        onChange={(e) => setComparisonReportId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select comparison report...</option>
                        {availableReports
                          .filter(r => r.report_id !== metricReportId)
                          .map(report => (
                            <option key={report.report_id} value={report.report_id}>
                              {report.report_name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comparison Type
                      </label>
                      <select
                        value={comparisonType}
                        onChange={(e) => setComparisonType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="percentage">Percentage Change</option>
                        <option value="value">Value Difference</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Text Widget Settings */}
          {widget.type === 'text' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Text Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content
                  </label>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={4}
                    placeholder="Enter text content..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Font Size
                    </label>
                    <input
                      type="number"
                      value={textFontSize}
                      onChange={(e) => setTextFontSize(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="10"
                      max="48"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alignment
                    </label>
                    <select
                      value={textAlignment}
                      onChange={(e) => setTextAlignment(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                      <option value="justify">Justify</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chart Settings - Only for report widgets */}
          {widget.type === 'report' && (
          <div>
            <h3 className="text-lg font-medium mb-4">Chart Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chart Type
                </label>
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as ChartType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="bar">Bar Chart</option>
                  <option value="line">Line Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="donut">Donut Chart</option>
                  <option value="area">Area Chart</option>
                  <option value="scatter">Scatter Plot</option>
                  <option value="heatmap">Heatmap</option>
                  <option value="treemap">Treemap</option>
                  <option value="table">Table</option>
                </select>
              </div>

              {/* Advanced Chart Settings */}
              <div className="mt-4">
                <ChartSettingsPanel
                  visualizationSettings={visualizationSettings}
                  onSettingsChange={(updates) => setVisualizationSettings({
                    ...visualizationSettings,
                    ...updates
                  })}
                />
              </div>
            </div>
          </div>
          )}

          {/* Isolation Filters - Only for report widgets */}
          {widget.type === 'report' && (
          <div>
            <h3 className="text-lg font-medium mb-4">Isolation Filters</h3>
            <p className="text-sm text-gray-600 mb-4">
              Apply filters that will only affect this widget, allowing you to show different data slices in the same dashboard.
            </p>
            
            {availableSegments.length > 0 ? (
              <div className="space-y-4">
                {availableSegments.map((segment: string) => {
                  // Map segment IDs to user-friendly labels
                  const segmentLabels: Record<string, string> = {
                    'program_id': 'Program',
                    'site_id': 'Site',
                    'submission_id': 'Submission',
                    'facility_id': 'Facility',
                    'global_site_id': 'Global Site'
                  };
                  
                  const label = segmentLabels[segment] || segment;
                  
                  return (
                    <div key={segment}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Filter by {label}
                      </label>
                      <IsolationFilterSelect
                        segment={segment}
                        reportId={widget.reportId || ''}
                        value={isolationFilters[segment] || []}
                        onChange={(values) => {
                          if (values.length > 0) {
                            setIsolationFilters({
                              ...isolationFilters,
                              [segment]: values
                            });
                          } else {
                            const newFilters = { ...isolationFilters };
                            delete newFilters[segment];
                            setIsolationFilters(newFilters);
                          }
                        }}
                        placeholder={`Select ${label.toLowerCase()}s...`}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  No segments available for isolation filtering.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  To use isolation filters, the report must have segments (grouping) configured in the report builder.
                </p>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};