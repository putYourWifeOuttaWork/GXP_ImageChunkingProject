import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface ScatterPlotProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({ data, settings, className, onDataSelect }) => {
  return (
    <BaseChart
      data={data}
      chartType="scatter"
      settings={settings}
      className={className}
      onDataSelect={onDataSelect}
    />
  );
};