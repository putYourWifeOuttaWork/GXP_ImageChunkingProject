import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface BarChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
  dimensions?: any[];
}

export const BarChart: React.FC<BarChartProps> = ({ data, settings, className, onDataSelect, dimensions }) => {
  return (
    <BaseChart
      data={data}
      settings={settings}
      chartType="bar"
      className={className}
      onSeriesToggle={undefined}
      onDataSelect={onDataSelect}
      dimensions={dimensions}
    />
  );
};