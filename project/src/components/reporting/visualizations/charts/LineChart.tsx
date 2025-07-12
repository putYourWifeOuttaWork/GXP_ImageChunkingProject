import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface LineChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
}

export const LineChart: React.FC<LineChartProps> = ({ data, settings, className, onDataSelect }) => {
  return (
    <BaseChart
      data={data}
      settings={settings}
      chartType="line"
      className={className}
      onDataSelect={onDataSelect}
    />
  );
};