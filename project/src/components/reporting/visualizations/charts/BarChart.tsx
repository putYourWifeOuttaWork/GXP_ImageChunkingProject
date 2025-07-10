import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface BarChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const BarChart: React.FC<BarChartProps> = ({ data, settings, className }) => {
  return (
    <BaseChart
      data={data}
      settings={settings}
      chartType="bar"
      className={className}
    />
  );
};