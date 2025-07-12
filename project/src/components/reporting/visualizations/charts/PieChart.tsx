import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface PieChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
}

export const PieChart: React.FC<PieChartProps> = ({ data, settings, className, onDataSelect }) => {
  return (
    <BaseChart
      data={data}
      settings={settings}
      chartType="pie"
      className={className}
      onDataSelect={onDataSelect}
    />
  );
};