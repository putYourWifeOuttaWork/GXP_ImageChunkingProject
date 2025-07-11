import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface BoxPlotProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const BoxPlot: React.FC<BoxPlotProps> = ({ data, settings, className }) => {
  return (
    <BaseChart
      data={data}
      chartType="box_plot"
      settings={settings}
      className={className}
    />
  );
};