import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface BoxPlotProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
}

export const BoxPlot: React.FC<BoxPlotProps> = ({ data, settings, className, onDataSelect }) => {
  return (
    <BaseChart
      data={data}
      chartType="box_plot"
      settings={settings}
      className={className}
      onDataSelect={onDataSelect}
    />
  );
};