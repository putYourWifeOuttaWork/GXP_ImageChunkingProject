import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, Zap } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { ReportConfiguration as ReportConfig } from '../../../types/reporting/reportTypes';

interface OptimizationSuggestion {
  optimization_type: string;
  suggestion: string;
  expected_speedup: string;
}

interface PartitionOptimizationIndicatorProps {
  reportConfig: ReportConfig;
  className?: string;
}

export const PartitionOptimizationIndicator: React.FC<PartitionOptimizationIndicatorProps> = ({
  reportConfig,
  className = ''
}) => {
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [partitionStats, setPartitionStats] = useState<any>(null);

  useEffect(() => {
    if (reportConfig.filters && reportConfig.filters.length > 0) {
      checkOptimization();
    }
  }, [reportConfig.filters]);

  const checkOptimization = async () => {
    setLoading(true);
    
    // Convert filters to the format expected by the SQL function
    const filterObject = reportConfig.filters?.reduce((acc, filter) => {
      acc[filter.field] = filter.value;
      return acc;
    }, {} as any);

    try {
      // Get optimization suggestions
      const { data: suggestionsData, error: suggestionsError } = await supabase
        .rpc('suggest_query_optimization', {
          p_table_name: reportConfig.dataSources[0]?.table || 'petri_observations_partitioned',
          p_filters: filterObject
        });

      if (!suggestionsError && suggestionsData) {
        setSuggestions(suggestionsData);
      }

      // Get partition stats if we have a program filter
      const programFilter = reportConfig.filters?.find(f => f.field === 'program_id');
      const siteFilter = reportConfig.filters?.find(f => f.field === 'site_id');
      
      if (programFilter) {
        const { data: statsData, error: statsError } = await supabase
          .rpc('get_partition_stats', {
            p_table_name: reportConfig.dataSources[0]?.table || 'petri_observations_partitioned',
            p_program_id: programFilter.value,
            p_site_id: siteFilter?.value || null
          });

          if (!statsError && statsData) {
            setPartitionStats(statsData);
          }
      }
    } catch (error) {
      console.error('Error checking optimization:', error);
    }
    
    setLoading(false);
  };

  const getOptimizationIcon = (type: string) => {
    switch (type) {
      case 'OPTIMAL':
        return <Zap className="w-5 h-5 text-green-500" />;
      case 'VERY_GOOD':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'GOOD':
        return <CheckCircle className="w-5 h-5 text-blue-400" />;
      case 'SUBOPTIMAL':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getOptimizationColor = (type: string) => {
    switch (type) {
      case 'OPTIMAL':
        return 'bg-green-50 border-green-200';
      case 'VERY_GOOD':
        return 'bg-blue-50 border-blue-200';
      case 'GOOD':
        return 'bg-blue-50 border-blue-200';
      case 'SUBOPTIMAL':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-20 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const mainSuggestion = suggestions.find(s => s.optimization_type !== 'SUGGESTION');
  const additionalSuggestions = suggestions.filter(s => s.optimization_type === 'SUGGESTION');

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Optimization Status */}
      {mainSuggestion && (
        <div className={`p-4 rounded-lg border ${getOptimizationColor(mainSuggestion.optimization_type)}`}>
          <div className="flex items-start gap-3">
            {getOptimizationIcon(mainSuggestion.optimization_type)}
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">
                Query Optimization: {mainSuggestion.optimization_type.replace('_', ' ')}
              </h4>
              <p className="text-sm text-gray-600 mt-1">{mainSuggestion.suggestion}</p>
              <p className="text-sm font-medium text-gray-700 mt-2">
                Expected performance: {mainSuggestion.expected_speedup}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Additional Suggestions */}
      {additionalSuggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Optimization Tips
          </h4>
          <ul className="space-y-2">
            {additionalSuggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-blue-800">
                • {suggestion.suggestion} ({suggestion.expected_speedup})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Partition Stats */}
      {partitionStats && partitionStats.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Partition Usage</h4>
          <div className="text-sm text-gray-600">
            <p>Query will use {partitionStats.filter((p: any) => p.is_active).length} active partition(s)</p>
            <p className="mt-1">
              Total rows in scope: {partitionStats.reduce((sum: number, p: any) => sum + (p.row_count || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};