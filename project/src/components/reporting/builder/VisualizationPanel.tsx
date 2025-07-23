import React from 'react';
import { BarChart, LineChart, PieChart, Map, TrendingUp, Grid, Zap, Activity, Table, Settings } from 'lucide-react';
import { ChartType, VisualizationSettings, Dimension, Measure } from '../../../types/reporting';

interface VisualizationPanelProps {
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  visualizationSettings: VisualizationSettings;
  onSettingsChange: (settings: Partial<VisualizationSettings>) => void;
  dimensions: Dimension[];
  measures: Measure[];
}

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({
  chartType,
  onChartTypeChange,
  visualizationSettings,
  onSettingsChange,
  dimensions,
  measures,
}) => {
  // Default settings to prevent undefined errors
  const defaultSettings: VisualizationSettings = {
    chartType: chartType || 'line',
    dimensions: { 
      width: 800, 
      height: 400,
      margin: { top: 50, right: 120, bottom: 60, left: 65 }
    },
    colors: {
      palette: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'],
      scheme: 'default',
      diverging: false,
      customColors: {}
    },
    axes: {
      x: {
        show: true,
        label: '',
        gridLines: false,
        tickFormat: 'auto',
        tickAngle: 0,
        tickCount: 'auto',
        sort: 'none'
      },
      y: {
        show: true,
        label: '',
        gridLines: true,
        tickFormat: 'auto',
        tickAngle: 0,
        tickCount: 'auto',
        sort: 'none'
      }
    },
    legends: {
      show: true,
      position: 'bottom',
      orientation: 'horizontal',
      padding: 10,
      itemSpacing: 20,
      fontSize: 12,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#374151',
      backgroundColor: undefined,
      borderColor: undefined,
      borderWidth: 0,
      maxItems: undefined,
      truncateLabels: true,
      truncateLength: 20
    },
    tooltips: {
      show: true,
      format: 'default',
      backgroundColor: '#1F2937',
      textColor: '#F9FAFB',
      borderColor: '#374151',
      borderWidth: 1,
      borderRadius: 6,
      padding: 12,
      fontSize: 12,
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    animations: {
      enabled: true,
      duration: 750,
      easing: 'easeInOut',
      delay: 0
    },
    interactions: {
      zoom: true,
      pan: true,
      hover: true,
      click: true,
      selection: false
    },
    specific: {}
  };
  
  const mergedSettings = {
    ...defaultSettings,
    ...visualizationSettings,
    dimensions: { ...defaultSettings.dimensions, ...visualizationSettings?.dimensions },
    margins: { ...defaultSettings.margins, ...visualizationSettings?.margins },
    displayOptions: { ...defaultSettings.displayOptions, ...visualizationSettings?.displayOptions }
  };
  const chartOptions = [
    // Basic charts
    {
      id: 'line',
      name: 'Line Chart',
      icon: <LineChart size={24} />,
      description: 'Show trends over time',
      category: 'Basic',
      requirements: { minDimensions: 1, minMeasures: 1 },
      bestFor: 'Time series data and trends',
    },
    {
      id: 'bar',
      name: 'Bar Chart',
      icon: <BarChart size={24} />,
      description: 'Compare categories',
      category: 'Basic',
      requirements: { minDimensions: 1, minMeasures: 1 },
      bestFor: 'Comparing values across categories',
    },
    {
      id: 'area',
      name: 'Area Chart',
      icon: <Activity size={24} />,
      description: 'Show cumulative trends',
      category: 'Basic',
      requirements: { minDimensions: 1, minMeasures: 1 },
      bestFor: 'Cumulative data and part-to-whole relationships',
    },
    {
      id: 'pie',
      name: 'Pie Chart',
      icon: <PieChart size={24} />,
      description: 'Show proportions',
      category: 'Basic',
      requirements: { minDimensions: 1, minMeasures: 1 },
      bestFor: 'Part-to-whole relationships with few categories',
    },
    {
      id: 'table',
      name: 'Data Table',
      icon: <Table size={24} />,
      description: 'Display data in rows and columns',
      category: 'Basic',
      requirements: { minDimensions: 0, minMeasures: 0 },
      bestFor: 'Detailed data analysis and precise values',
    },
    
    // Advanced charts
    {
      id: 'scatter',
      name: 'Scatter Plot',
      icon: <Grid size={24} />,
      description: 'Show correlations',
      category: 'Advanced',
      requirements: { minDimensions: 0, minMeasures: 2 },
      bestFor: 'Correlation analysis and outlier detection',
    },
    {
      id: 'heatmap',
      name: 'Heatmap',
      icon: <Map size={24} />,
      description: 'Show patterns in data',
      category: 'Advanced',
      requirements: { minDimensions: 2, minMeasures: 1 },
      bestFor: 'Pattern recognition and density analysis',
    },
    {
      id: 'box_plot',
      name: 'Box Plot',
      icon: <BarChart size={24} />,
      description: 'Show statistical distribution',
      category: 'Advanced',
      requirements: { minDimensions: 1, minMeasures: 1 },
      bestFor: 'Statistical analysis and outlier detection',
    },
    {
      id: 'histogram',
      name: 'Histogram',
      icon: <BarChart size={24} />,
      description: 'Show frequency distribution',
      category: 'Advanced',
      requirements: { minDimensions: 0, minMeasures: 1 },
      bestFor: 'Frequency analysis and distribution patterns',
    },
    {
      id: 'treemap',
      name: 'TreeMap',
      icon: <Grid size={24} />,
      description: 'Show hierarchical data with time animation',
      category: 'Advanced',
      requirements: { minDimensions: 2, minMeasures: 1 },
      bestFor: 'Hierarchical data visualization over time',
    },
    
    // Scientific charts
    {
      id: 'growth_progression',
      name: 'Growth Progression',
      icon: <TrendingUp size={24} />,
      description: 'Agricultural growth analysis',
      category: 'Scientific',
      requirements: { minDimensions: 1, minMeasures: 1 },
      bestFor: 'Petri dish growth tracking over time',
    },
    {
      id: 'spatial_effectiveness',
      name: 'Spatial Effectiveness',
      icon: <Map size={24} />,
      description: 'Placement effectiveness map',
      category: 'Scientific',
      requirements: { minDimensions: 2, minMeasures: 1 },
      bestFor: 'Gasifier placement optimization',
    },
    {
      id: 'phase_comparison',
      name: 'Phase Comparison',
      icon: <BarChart size={24} />,
      description: 'Control vs experimental',
      category: 'Scientific',
      requirements: { minDimensions: 1, minMeasures: 1 },
      bestFor: 'Comparing program phases',
    },
    {
      id: 'environmental_correlation',
      name: 'Environmental Correlation',
      icon: <Zap size={24} />,
      description: 'Environment vs growth',
      category: 'Scientific',
      requirements: { minDimensions: 2, minMeasures: 2 },
      bestFor: 'Environmental factor analysis',
    },
  ];

  const chartCategories = ['Basic', 'Advanced', 'Scientific'];

  const isChartAvailable = (chart: any) => {
    return (
      dimensions.length >= chart.requirements.minDimensions &&
      measures.length >= chart.requirements.minMeasures
    );
  };

  const getChartClassName = (chart: any) => {
    const baseClass = 'p-4 border-2 rounded-lg cursor-pointer transition-all duration-200';
    const available = isChartAvailable(chart);
    
    if (!available) {
      return `${baseClass} border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed`;
    }
    
    if (chartType === chart.id) {
      return `${baseClass} border-primary-500 bg-primary-50 shadow-md`;
    }
    
    return `${baseClass} border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Visualization</h3>
        <p className="text-sm text-gray-600 mb-6">
          Choose the best chart type for your data. Different visualizations work better for different types of analysis.
        </p>
      </div>

      {/* Chart Type Selection */}
      <div className="space-y-6">
        {chartCategories.map((category) => (
          <div key={category}>
            <h4 className="text-sm font-medium text-gray-900 mb-3">{category} Charts</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chartOptions
                .filter(chart => chart.category === category)
                .map((chart) => (
                  <div
                    key={chart.id}
                    className={getChartClassName(chart)}
                    onClick={() => {
                      if (isChartAvailable(chart)) {
                        onChartTypeChange(chart.id as ChartType);
                      }
                    }}
                  >
                    <div className="flex items-center mb-3">
                      <div className={`p-2 rounded-lg ${
                        chartType === chart.id ? 'bg-primary-100' : 'bg-gray-100'
                      }`}>
                        {chart.icon}
                      </div>
                      <div className="ml-3">
                        <h5 className="font-medium text-gray-900">{chart.name}</h5>
                        {!isChartAvailable(chart) && (
                          <p className="text-xs text-red-600">
                            Requires {chart.requirements.minDimensions} dimensions, {chart.requirements.minMeasures} measures
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{chart.description}</p>
                    <p className="text-xs text-gray-500">
                      <strong>Best for:</strong> {chart.bestFor}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Chart Settings Notice */}
      {chartType && (
        <div className="border-t pt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Settings size={20} className="text-blue-600 mr-3 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">Chart Settings</h4>
                <p className="text-sm text-blue-800">
                  Advanced chart settings are now available in the Preview step, where you can see your changes applied instantly to the chart.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Requirements */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <BarChart size={20} className="text-blue-600 mr-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">Visualization Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Line charts work best for time series data</li>
              <li>• Bar charts are ideal for comparing categories</li>
              <li>• Scatter plots reveal correlations between variables</li>
              <li>• Heatmaps show patterns in large datasets</li>
              <li>• Scientific charts are optimized for agricultural data</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Current Selection Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Current Selection</h4>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            <strong>Chart Type:</strong> {chartOptions.find(c => c.id === chartType)?.name || 'None selected'}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Dimensions:</strong> {dimensions.length} selected
          </p>
          <p className="text-sm text-gray-600">
            <strong>Measures:</strong> {measures.length} selected
          </p>
          <p className="text-sm text-gray-600">
            <strong>Size:</strong> {mergedSettings.dimensions.width} × {mergedSettings.dimensions.height}
          </p>
        </div>
      </div>
    </div>
  );
};