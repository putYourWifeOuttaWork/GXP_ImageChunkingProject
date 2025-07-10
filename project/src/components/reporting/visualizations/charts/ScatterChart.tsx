import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface ScatterChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const ScatterChart: React.FC<ScatterChartProps> = ({ data, settings, className }) => {
  return (
    <BaseChart
      data={data}
      settings={settings}
      chartType="scatter"
      className={className}
    />
  );
};