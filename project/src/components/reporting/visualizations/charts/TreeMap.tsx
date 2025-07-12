import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface TreeMapProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
}

export const TreeMap: React.FC<TreeMapProps> = ({ data, settings, className, onDataSelect }) => {
  return (
    <BaseChart
      data={data}
      chartType="treemap"
      settings={settings}
      className={className}
      onDataSelect={onDataSelect}
    />
  );
};