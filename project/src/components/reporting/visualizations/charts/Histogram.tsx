import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface HistogramProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

export const Histogram: React.FC<HistogramProps> = ({ data, settings, className }) => {
  return (
    <BaseChart
      data={data}
      chartType="histogram"
      settings={settings}
      className={className}
    />
  );
};