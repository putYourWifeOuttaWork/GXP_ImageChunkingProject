import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface PieChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const PieChart: React.FC<PieChartProps> = ({ data, settings, className }) => {
  return (
    <BaseChart
      data={data}
      settings={settings}
      chartType="pie"
      className={className}
    />
  );
};