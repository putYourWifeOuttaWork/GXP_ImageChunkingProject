import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface AreaChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const AreaChart: React.FC<AreaChartProps> = ({ data, settings, className }) => {
  return (
    <BaseChart
      data={data}
      chartType="area"
      settings={settings}
      className={className}
    />
  );
};