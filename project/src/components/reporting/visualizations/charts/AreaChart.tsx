import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface AreaChartProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
  dimensions?: any[];
}

export const AreaChart: React.FC<AreaChartProps> = ({ data, settings, className, onDataSelect, dimensions }) => {
  return (
    <BaseChart
      data={data}
      chartType="area"
      settings={settings}
      className={className}
      onDataSelect={onDataSelect}
      dimensions={dimensions}
    />
  );
};