import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface HeatmapChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({ data, settings, className }) => {
  return (
    <BaseChart
      data={data}
      chartType="heatmap"
      settings={settings}
      className={className}
    />
  );
};