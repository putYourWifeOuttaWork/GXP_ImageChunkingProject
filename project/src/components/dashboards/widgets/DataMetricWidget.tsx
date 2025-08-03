import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { ReportingDataService } from '../../../services/reportingDataService';
import LoadingScreen from '../../common/LoadingScreen';
import { WidgetSkeleton } from '../WidgetSkeleton';
import { ErrorDisplay, commonErrorActions, getErrorType } from '../../common/ErrorDisplay';

interface DataMetricWidgetProps {
  reportId?: string;
  metricField?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  label?: string;
  format?: 'number' | 'currency' | 'percentage';
  color?: string;
  comparisonReportId?: string;
  comparisonType?: 'value' | 'percentage';
  filters?: any[];
}

export const DataMetricWidget: React.FC<DataMetricWidgetProps> = ({
  reportId,
  metricField,
  aggregation = 'count',
  label = 'Metric',
  format = 'number',
  color = '#3B82F6',
  comparisonReportId,
  comparisonType = 'percentage',
  filters = []
}) => {
  const [value, setValue] = useState<number>(0);
  const [comparisonValue, setComparisonValue] = useState<number | null>(null);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [trendPercentage, setTrendPercentage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reportId) {
      loadMetricData();
    } else {
      setLoading(false);
    }
  }, [reportId, metricField, aggregation, filters]);

  const loadMetricData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load report configuration
      const { data: reportData, error: reportError } = await supabase
        .from('saved_reports')
        .select('report_config')
        .eq('report_id', reportId)
        .single();

      if (reportError) throw reportError;
      if (!reportData) throw new Error('Report not found');

      const reportConfig = reportData.report_config;

      // Apply any additional filters
      const finalConfig = {
        ...reportConfig,
        filters: [...(reportConfig.filters || []), ...filters]
      };

      // Fetch report data
      const data = await ReportingDataService.executeReport(finalConfig);

      if (!data) throw new Error('No data returned');

      // Calculate metric value based on aggregation
      let calculatedValue = 0;

      switch (aggregation) {
        case 'count':
          calculatedValue = data.data.length;
          break;
        
        case 'sum':
          if (metricField && data.data.length > 0) {
            calculatedValue = data.data.reduce((sum, row) => {
              const val = parseFloat(row[metricField] || 0);
              return sum + (isNaN(val) ? 0 : val);
            }, 0);
          }
          break;
        
        case 'avg':
          if (metricField && data.data.length > 0) {
            const sum = data.data.reduce((total, row) => {
              const val = parseFloat(row[metricField] || 0);
              return total + (isNaN(val) ? 0 : val);
            }, 0);
            calculatedValue = sum / data.data.length;
          }
          break;
        
        case 'min':
          if (metricField && data.data.length > 0) {
            calculatedValue = Math.min(...data.data.map(row => {
              const val = parseFloat(row[metricField] || 0);
              return isNaN(val) ? Infinity : val;
            }));
            if (calculatedValue === Infinity) calculatedValue = 0;
          }
          break;
        
        case 'max':
          if (metricField && data.data.length > 0) {
            calculatedValue = Math.max(...data.data.map(row => {
              const val = parseFloat(row[metricField] || 0);
              return isNaN(val) ? -Infinity : val;
            }));
            if (calculatedValue === -Infinity) calculatedValue = 0;
          }
          break;
      }

      setValue(calculatedValue);

      // Load comparison data if specified
      if (comparisonReportId) {
        await loadComparisonData(calculatedValue);
      }

    } catch (err) {
      console.error('Error loading metric data:', err);
      setError('Failed to load metric');
    } finally {
      setLoading(false);
    }
  };

  const loadComparisonData = async (currentValue: number) => {
    try {
      const { data: reportData, error: reportError } = await supabase
        .from('saved_reports')
        .select('report_config')
        .eq('report_id', comparisonReportId)
        .single();

      if (reportError || !reportData) return;

      const data = await ReportingDataService.executeReport(reportData.report_config);
      if (!data) return;

      // Calculate comparison value
      let compValue = 0;
      switch (aggregation) {
        case 'count':
          compValue = data.data.length;
          break;
        // ... same logic for other aggregations
      }

      setComparisonValue(compValue);

      // Calculate trend
      if (compValue !== 0) {
        const change = ((currentValue - compValue) / compValue) * 100;
        setTrendPercentage(Math.abs(change));
        setTrend(change > 0 ? 'up' : change < 0 ? 'down' : 'stable');
      }
    } catch (err) {
      console.error('Error loading comparison data:', err);
    }
  };

  const formatValue = (val: number): string => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(val);
    }
    
    if (format === 'percentage') {
      return `${val.toFixed(1)}%`;
    }
    
    if (format === 'number') {
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2
      }).format(val);
    }
    
    return val.toString();
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={24} />;
      case 'down':
        return <TrendingDown size={24} />;
      default:
        return <Minus size={24} />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return <WidgetSkeleton type="metric" showTitle={false} />;
  }

  if (error) {
    return (
      <ErrorDisplay
        type={getErrorType(error)}
        message={error}
        actions={[
          commonErrorActions.retry(loadMetricData)
        ]}
      />
    );
  }

  if (!reportId) {
    return (
      <ErrorDisplay
        type="configuration-error"
        title="No Report Selected"
        message="Please configure this widget to select a report and metric"
        actions={[]}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center">
        <div 
          className="text-5xl font-bold mb-2"
          style={{ color }}
        >
          {formatValue(value)}
        </div>
        
        <div className="text-lg text-gray-600">
          {label}
        </div>
        
        {comparisonValue !== null && (
          <div className="flex items-center justify-center mt-4">
            <span className={`flex items-center text-lg font-medium ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="ml-1">
                {trendPercentage > 0 ? '+' : ''}{trendPercentage.toFixed(1)}%
              </span>
            </span>
          </div>
        )}
        
        {comparisonValue !== null && (
          <div className="mt-2 text-sm text-gray-500">
            vs. previous: {formatValue(comparisonValue)}
          </div>
        )}
      </div>
    </div>
  );
};