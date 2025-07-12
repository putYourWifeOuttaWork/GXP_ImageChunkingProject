import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface AreaChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
}

export const AreaChart: React.FC<AreaChartProps> = ({ data, settings, className, onDataSelect }) => {
  return (
    <BaseChart
      data={data}
      chartType="area"
      settings={settings}
      className={className}
      onDataSelect={onDataSelect}
    />
  );
};