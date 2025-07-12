import React, { useState, useMemo, useCallback } from 'react';
import { Eye, RefreshCw, Download, Share, AlertCircle, CheckCircle, BarChart } from 'lucide-react';
import Button from '../../common/Button';
import { AggregatedData } from '../../../types/reporting';
import { IsolationFilter, IsolationState } from './IsolationFilter';
import { BarChart as D3BarChart } from '../visualizations/charts/BarChart';
import { LineChart as D3LineChart } from '../visualizations/charts/LineChart';
import { PieChart as D3PieChart } from '../visualizations/charts/PieChart';
import { AreaChart as D3AreaChart } from '../visualizations/charts/AreaChart';
import { GrowthProgressionChart } from '../visualizations/scientific/GrowthProgressionChart';
import { HeatmapChart } from '../visualizations/charts/HeatmapChart';
import { BoxPlot } from '../visualizations/charts/BoxPlot';
import { ScatterPlot } from '../visualizations/charts/ScatterPlot';
import { Histogram } from '../visualizations/charts/Histogram';
import { TreeMap } from '../visualizations/charts/TreeMap';
import { SpatialEffectivenessMap } from '../visualizations/scientific/SpatialEffectivenessMap';
import { DataViewer } from '../visualizations/DataViewer';

interface PreviewPanelProps {
  previewData: AggregatedData | null;
  isLoading: boolean;
  onGeneratePreview: () => void;
  reportConfig: any;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  previewData,
  isLoading,
  onGeneratePreview,
  reportConfig,
}) => {
  const [isolationState, setIsolationState] = useState<IsolationState>({});
  const [showDataViewer, setShowDataViewer] = useState(false);
  const [selectedData, setSelectedData] = useState<any[]>([]);
  const [dataViewerTitle, setDataViewerTitle] = useState('');
  
  // Filter data based on isolation state
  const filteredData = useMemo(() => {
    if (!previewData || Object.keys(isolationState).length === 0) {
      return previewData;
    }
    
    const filtered = {
      ...previewData,
      data: previewData.data.filter(row => {
        // Check each isolation criteria
        for (const [segment, values] of Object.entries(isolationState)) {
          if (values && values.length > 0) {
            // Look for the value in the correct segment field from the query
            const rowValue = row.dimensions[segment] || row.dimensions[`segment_${segment}`];
            
            // Special handling for different segment types
            if (segment === 'site_id') {
              // The segment_site_id field contains the site name, so we match directly
              const hasMatch = values.some(selectedValue => {
                return rowValue === selectedValue;
              });
              
              if (!hasMatch) return false;
            } else if (segment === 'program_id') {
              // The segment_program_id field contains the program name, so we match directly
              const hasMatch = values.some(selectedValue => {
                return rowValue === selectedValue;
              });
              
              if (!hasMatch) return false;
            } else if (segment === 'submission_id') {
              // For submissions, we filter by the original submission_id (not the display value)
              const hasMatch = values.some(selectedValue => {
                return rowValue === selectedValue;
              });
              
              if (!hasMatch) return false;
            } else {
              // For other segments, simple value matching
              if (!values.includes(rowValue)) {
                return false;
              }
            }
          }
        }
        return true;
      })
    };
    
    // Update counts
    filtered.filteredCount = filtered.data.length;
    
    return filtered;
  }, [previewData, isolationState]);

  // Handler for brush selection and data viewer
  const openDataViewer = useCallback((points: any[], position: { x: number; y: number }, title: string) => {
    setSelectedData(points);
    setDataViewerTitle(title);
    setShowDataViewer(true);
  }, []);
  const hasValidConfig = () => {
    return (
      reportConfig.name &&
      reportConfig.dataSources.length > 0 &&
      reportConfig.measures.length > 0 &&
      reportConfig.chartType
    );
  };

  const renderConfigSummary = () => {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Report Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              <strong>Name:</strong> {reportConfig.name || 'Untitled Report'}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              <strong>Type:</strong> {reportConfig.type || 'Chart'}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              <strong>Category:</strong> {reportConfig.category || 'Analytics'}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Chart Type:</strong> {reportConfig.chartType || 'None'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">
              <strong>Data Sources:</strong> {reportConfig.dataSources.length}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              <strong>Dimensions:</strong> {reportConfig.dimensions.length}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              <strong>Measures:</strong> {reportConfig.measures.length}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Filters:</strong> {reportConfig.filters.length}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderPreviewPlaceholder = () => {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Eye size={32} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Your Report</h3>
        <p className="text-sm text-gray-600 mb-4">
          {hasValidConfig() 
            ? 'Click the button below to generate a preview of your report'
            : 'Complete the report configuration to enable preview'
          }
        </p>
        <Button
          variant="primary"
          icon={<RefreshCw size={16} />}
          onClick={onGeneratePreview}
          disabled={!hasValidConfig() || isLoading}
          loading={isLoading}
        >
          Generate Preview
        </Button>
      </div>
    );
  };

  const renderChart = () => {
    if (!filteredData) {
      return (
        <div 
          className="border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center"
          style={{ 
            width: reportConfig.visualizationSettings.dimensions.width,
            height: reportConfig.visualizationSettings.dimensions.height,
            maxWidth: '100%',
            maxHeight: '500px'
          }}
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 mx-auto">
              <BarChart size={32} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mb-2">
              {reportConfig.chartType.replace('_', ' ').toUpperCase()} Chart
            </p>
            <p className="text-xs text-gray-500">
              {reportConfig.visualizationSettings.dimensions.width} × {reportConfig.visualizationSettings.dimensions.height}
            </p>
          </div>
        </div>
      );
    }

    const chartProps = {
      data: filteredData,
      settings: reportConfig.visualizationSettings,
      className: "border border-gray-200 rounded-lg",
      onDataSelect: openDataViewer // Add brush callback to all charts
    };

    switch (reportConfig.chartType) {
      case 'bar':
        return <D3BarChart {...chartProps} />;
      case 'line':
        return <D3LineChart {...chartProps} />;
      case 'pie':
        return <D3PieChart {...chartProps} />;
      case 'area':
        return <D3AreaChart {...chartProps} />;
      case 'scatter':
        return <ScatterPlot {...chartProps} />;
      case 'box_plot':
        return <BoxPlot {...chartProps} />;
      case 'histogram':
        return <Histogram {...chartProps} />;
      case 'treemap':
        return <TreeMap {...chartProps} />;
      case 'heatmap':
        return <HeatmapChart {...chartProps} />;
      case 'growth_progression':
        return <GrowthProgressionChart {...chartProps} />;
      case 'spatial_effectiveness':
        return <SpatialEffectivenessMap {...chartProps} />;
      default:
        return <D3BarChart {...chartProps} />;
    }
  };

  const renderPreviewContent = () => {
    if (!previewData) return null;

    console.log('PreviewPanel - reportConfig:', reportConfig);
    console.log('PreviewPanel - segmentBy:', reportConfig.segmentBy);
    console.log('PreviewPanel - filters:', reportConfig.filters);
    console.log('PreviewPanel - segments from filters:', reportConfig.filters?.filter((f: any) => f.type === 'segment'));
    console.log('PreviewPanel - previewData sample:', previewData.data[0]);
    console.log('PreviewPanel - all filters:', reportConfig.filters);
    console.log('PreviewPanel - dimensions with multiple values:', Object.keys(previewData.data[0]?.dimensions || {}));

    return (
      <div className="space-y-6">
        {/* Isolation Filter - check both segmentBy and segments in filters */}
        {(() => {
          // Use segments from reportConfig if available
          const segments = reportConfig.segmentBy || reportConfig.selectedSegments || [];
          
          console.log('ReportConfig segmentBy:', reportConfig.segmentBy);
          console.log('ReportConfig selectedSegments:', reportConfig.selectedSegments);
          
          console.log('Isolation filter - segments found:', segments);
          console.log('Isolation filter - available dimensions:', Object.keys(previewData.data[0]?.dimensions || {}));
          
          if (segments.length > 0) {
            return (
              <div className="mb-4">
                <IsolationFilter
                  data={previewData}
                  segmentBy={segments}
                  onIsolationChange={setIsolationState}
                />
              </div>
            );
          }
          return null;
        })()}
        
        {/* Preview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <CheckCircle size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">Total Records</p>
                <p className="text-lg font-semibold text-blue-900">{previewData.totalCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                <CheckCircle size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600">Filtered Records</p>
                <p className="text-lg font-semibold text-green-900">{filteredData ? filteredData.filteredCount : previewData.filteredCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center mr-3">
                <RefreshCw size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-purple-600">Execution Time</p>
                <p className="text-lg font-semibold text-purple-900">{previewData.executionTime}ms</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                <Eye size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-yellow-600">Data Points</p>
                <p className="text-lg font-semibold text-yellow-900">{filteredData ? filteredData.data.length : previewData.data.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Segments Indicator */}
        {reportConfig.segmentBy && reportConfig.segmentBy.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-indigo-900">Active Segments</p>
                  <p className="text-xs text-indigo-700">
                    Data is segmented by: {reportConfig.segmentBy.join(', ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-indigo-900">
                  {(() => {
                    // Count unique segments in the data
                    const uniqueSegments = new Set();
                    reportConfig.segmentBy.forEach((segment: string) => {
                      (filteredData || previewData).data.forEach((row: any) => {
                        if (row.dimensions[segment]) {
                          uniqueSegments.add(row.dimensions[segment]);
                        }
                      });
                    });
                    return uniqueSegments.size;
                  })()}
                </p>
                <p className="text-xs text-indigo-700">Unique segments</p>
              </div>
            </div>
          </div>
        )}

        {/* Chart Preview Area */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">Chart Preview</h4>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw size={16} />}
                onClick={onGeneratePreview}
                disabled={isLoading}
              >
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Download size={16} />}
                disabled={!previewData}
              >
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Share size={16} />}
                disabled={!previewData}
              >
                Share
              </Button>
            </div>
          </div>

          {/* D3 Chart Rendering */}
          {renderChart()}
        </div>

        {/* Data Sample */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Data Sample</h4>
          {(filteredData || previewData).data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {reportConfig.dimensions.map((dim: any) => (
                      <th
                        key={dim.id}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {dim.displayName || dim.name}
                      </th>
                    ))}
                    {reportConfig.measures.map((measure: any) => (
                      <th
                        key={measure.id}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {measure.displayName || measure.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(filteredData || previewData).data.slice(0, 10).map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {reportConfig.dimensions.map((dim: any) => (
                        <td key={dim.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(() => {
                            const value = row.dimensions[dim.field];
                            if (!value) return '-';
                            
                            // Check if it's a date and format it
                            if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                              const date = new Date(value);
                              const month = date.getMonth() + 1;
                              const day = date.getDate();
                              const year = date.getFullYear().toString().slice(-2);
                              return `${month}/${day}/${year}`;
                            }
                            
                            return value;
                          })()}
                        </td>
                      ))}
                      {reportConfig.measures.map((measure: any) => (
                        <td key={measure.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row.measures[measure.field] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-gray-600">No data available for preview</p>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Query Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">
                <strong>Cache Hit:</strong> {previewData.cacheHit ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                <strong>Last Updated:</strong> {previewData.metadata.lastUpdated}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                <strong>Dimensions:</strong> {previewData.metadata.dimensions.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Preview & Test</h3>
        <p className="text-sm text-gray-600 mb-6">
          Review your report configuration and preview the results. Make sure everything looks correct before saving.
        </p>
      </div>

      {renderConfigSummary()}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Generating preview...</p>
          </div>
        </div>
      ) : previewData ? (
        renderPreviewContent()
      ) : (
        renderPreviewPlaceholder()
      )}

      {/* Validation Messages */}
      {!hasValidConfig() && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle size={20} className="text-yellow-600 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-900 mb-1">Configuration Incomplete</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                {!reportConfig.name && <li>• Report name is required</li>}
                {reportConfig.dataSources.length === 0 && <li>• At least one data source is required</li>}
                {reportConfig.measures.length === 0 && <li>• At least one measure is required</li>}
                {!reportConfig.chartType && <li>• Chart type selection is required</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Data Viewer Modal */}
      {showDataViewer && (
        <DataViewer
          data={selectedData}
          isVisible={showDataViewer}
          onClose={() => setShowDataViewer(false)}
          position={{ x: 0, y: 0 }}
          title={dataViewerTitle}
          config={{
            dimensions: reportConfig.dimensions?.map(d => ({
              field: d.field,
              displayName: d.name,
              dataType: d.dataType || 'string'
            })) || [],
            measures: reportConfig.measures?.map(m => ({
              field: m.field,
              displayName: m.name,
              aggregation: m.aggregation
            })) || []
          }}
        />
      )}
    </div>
  );
};