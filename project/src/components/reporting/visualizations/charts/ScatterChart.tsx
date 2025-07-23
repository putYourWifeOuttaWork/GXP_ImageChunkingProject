import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface ScatterChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
  dimensions?: any[];
}

export const ScatterChart: React.FC<ScatterChartProps> = ({ data, settings, className, onDataSelect, dimensions }) => {
  return (
    <BaseChart
      data={data}
      settings={settings}
      chartType="scatter"
      className={className}
      onDataSelect={onDataSelect}
      dimensions={dimensions}
    />
  );
};