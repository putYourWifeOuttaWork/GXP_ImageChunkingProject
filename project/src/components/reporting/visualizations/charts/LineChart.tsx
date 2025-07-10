import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface LineChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const LineChart: React.FC<LineChartProps> = ({ data, settings, className }) => {
  return (
    <BaseChart
      data={data}
      settings={settings}
      chartType="line"
      className={className}
    />
  );
};