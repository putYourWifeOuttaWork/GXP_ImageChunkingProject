import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Activity,
  Calendar,
  Building,
  Map,
  Beaker
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useReportBuilder } from '../../../hooks/reporting/useReportBuilder';

interface AnalysisPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'program' | 'site' | 'time' | 'comparison';
  requiredFilters: string[];
  reportTemplate: {
    type: 'chart' | 'table' | 'heatmap';
    chartType?: string;
    dimensions: string[];
    measures: string[];
    filters?: any[];
  };
}

export const QuickPartitionAnalysis: React.FC = () => {
  const { 
    setBasicInfo,
    addDataSource,
    addDimension,
    addMeasure,
    addFilter,
    setChartType,
    setActiveStep,
    generatePreview
  } = useReportBuilder();
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const analysisPresets: AnalysisPreset[] = [
    {
      id: 'program-growth-trend',
      name: 'Program Growth Trend',
      description: 'Track growth index over time for a program',
      icon: <TrendingUp className="w-5 h-5" />,
      category: 'program',
      requiredFilters: ['program_id'],
      reportTemplate: {
        type: 'chart',
        chartType: 'line',
        dimensions: ['created_at'],
        measures: ['avg_growth_index', 'max_growth_index'],
        filters: []
      }
    },
    {
      id: 'site-comparison',
      name: 'Site Performance Comparison',
      description: 'Compare growth metrics across sites in a program',
      icon: <BarChart3 className="w-5 h-5" />,
      category: 'site',
      requiredFilters: ['program_id'],
      reportTemplate: {
        type: 'chart',
        chartType: 'bar',
        dimensions: ['site_id'],
        measures: ['avg_growth_index', 'count_observations'],
        filters: []
      }
    },
    {
      id: 'growth-distribution',
      name: 'Growth Stage Distribution',
      description: 'Analyze distribution of growth stages',
      icon: <PieChart className="w-5 h-5" />,
      category: 'program',
      requiredFilters: ['program_id'],
      reportTemplate: {
        type: 'chart',
        chartType: 'pie',
        dimensions: ['petri_growth_stage'],
        measures: ['count_observations'],
        filters: []
      }
    },
    {
      id: 'environmental-impact',
      name: 'Environmental Impact Analysis',
      description: 'Correlate temperature/humidity with growth',
      icon: <Activity className="w-5 h-5" />,
      category: 'program',
      requiredFilters: ['program_id'],
      reportTemplate: {
        type: 'chart',
        chartType: 'scatter',
        dimensions: ['outdoor_temperature'],
        measures: ['avg_growth_index', 'outdoor_humidity'],
        filters: []
      }
    },
    {
      id: 'weekly-summary',
      name: 'Weekly Summary',
      description: 'Week-over-week growth summary',
      icon: <Calendar className="w-5 h-5" />,
      category: 'time',
      requiredFilters: ['program_id'],
      reportTemplate: {
        type: 'table',
        dimensions: ['week_of_year'],
        measures: ['avg_growth_index', 'count_observations', 'avg_outdoor_temperature'],
        filters: []
      }
    },
    {
      id: 'site-heatmap',
      name: 'Site Activity Heatmap',
      description: 'Visualize observation density by site and time',
      icon: <Map className="w-5 h-5" />,
      category: 'site',
      requiredFilters: ['program_id'],
      reportTemplate: {
        type: 'heatmap',
        dimensions: ['site_id', 'day_of_week'],
        measures: ['count_observations'],
        filters: []
      }
    }
  ];

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    const { data, error } = await supabase
      .from('pilot_programs')
      .select('program_id, name, start_date, end_date')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (!error && data) {
      setPrograms(data);
    }
  };

  const handleQuickAnalysis = async (preset: AnalysisPreset) => {
    if (!selectedProgram && preset.requiredFilters.includes('program_id')) {
      alert('Please select a program first');
      return;
    }

    setLoading(true);
    
    try {
      // Build the report configuration
      const reportConfig = {
        name: preset.name,
        description: preset.description,
        type: preset.reportTemplate.type,
        category: 'analytics',
        dataSources: [{
          id: 'petri_observations_partitioned',
          table: 'petri_observations_partitioned',
          name: 'Petri Observations (Optimized)'
        }],
        dimensions: preset.reportTemplate.dimensions.map(dim => ({
          id: `dim_${dim}`,
          field: dim,
          name: dim,
          dataType: dim.includes('date') || dim.includes('created_at') ? 'timestamp' : 'text',
          source: 'petri_observations_partitioned'
        })),
        measures: preset.reportTemplate.measures.map(measure => {
          const [aggregation, ...fieldParts] = measure.split('_');
          const field = fieldParts.join('_');
          return {
            id: `measure_${measure}`,
            field: field,
            name: measure,
            aggregation: aggregation,
            dataType: 'number',
            dataSource: 'petri_observations_partitioned'
          };
        }),
        filters: [
          ...(selectedProgram ? [{
            id: 'filter_program',
            field: 'program_id',
            operator: 'equals',
            value: selectedProgram,
            type: 'text',
            dataSource: 'petri_observations_partitioned'
          }] : []),
          ...(preset.reportTemplate.filters || [])
        ],
        chartType: preset.reportTemplate.chartType,
        visualizationSettings: {
          chartType: preset.reportTemplate.chartType || 'bar'
        }
      };

      // Create the report manually using available methods
      // Set basic info
      setBasicInfo({
        name: reportConfig.name,
        description: reportConfig.description,
        type: reportConfig.type,
        category: reportConfig.category
      });

      // Add data source
      reportConfig.dataSources.forEach(ds => addDataSource(ds));

      // Add dimensions
      reportConfig.dimensions.forEach(dim => addDimension(dim));

      // Add measures  
      reportConfig.measures.forEach(measure => addMeasure(measure));

      // Add filters
      reportConfig.filters.forEach(filter => addFilter(filter));

      // Set chart type
      setChartType(reportConfig.chartType);

      // Generate preview
      generatePreview();
      
    } catch (error) {
      console.error('Error creating quick analysis:', error);
      alert('Failed to create analysis');
    } finally {
      setLoading(false);
    }
  };

  const groupedPresets = {
    program: analysisPresets.filter(p => p.category === 'program'),
    site: analysisPresets.filter(p => p.category === 'site'),
    time: analysisPresets.filter(p => p.category === 'time'),
    comparison: analysisPresets.filter(p => p.category === 'comparison')
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Partition-Optimized Analysis</h2>
        
        {/* Program Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Program for Analysis
          </label>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a program...</option>
            {programs.map((program) => (
              <option key={program.program_id} value={program.program_id}>
                {program.name}
              </option>
            ))}
          </select>
        </div>

        {/* Analysis Templates */}
        <div className="space-y-6">
          {Object.entries(groupedPresets).map(([category, presets]) => (
            <div key={category}>
              <h3 className="text-lg font-medium text-gray-900 mb-3 capitalize">
                {category} Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleQuickAnalysis(preset)}
                    disabled={loading || (!selectedProgram && preset.requiredFilters.includes('program_id'))}
                    className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <div className="text-blue-600 mt-1">{preset.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{preset.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{preset.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Performance Note */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <Beaker className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Partition-Optimized Queries</p>
              <p className="mt-1">
                All these analyses are optimized to use the partition structure, providing 10-100x 
                faster query performance compared to unpartitioned tables.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};