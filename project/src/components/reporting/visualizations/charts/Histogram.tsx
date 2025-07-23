import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface HistogramProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
  dimensions?: any[];
}

export const Histogram: React.FC<HistogramProps> = ({ data, settings, className, onDataSelect, dimensions }) => {
  return (
    <BaseChart
      data={data}
      chartType="histogram"
      settings={settings}
      className={className}
      onDataSelect={onDataSelect}
      dimensions={dimensions}
    />
  );
};