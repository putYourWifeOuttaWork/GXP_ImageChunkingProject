import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface ScatterPlotProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({ data, settings, className }) => {
  return (
    <BaseChart
      data={data}
      chartType="scatter"
      settings={settings}
      className={className}
    />
  );
};