import React from 'react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

interface SpatialEffectivenessMapProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
  onDataSelect?: (data: any[], position: { x: number; y: number }, title: string) => void;
}

export const SpatialEffectivenessMap: React.FC<SpatialEffectivenessMapProps> = ({ 
  data, 
  settings, 
  className,
  onDataSelect
}) => {
  // The spatial effectiveness map will be rendered by BaseChart with custom geographic rendering
  return (
    <BaseChart
      data={data}
      chartType="spatial_effectiveness"
      settings={settings}
      className={className}
      onDataSelect={onDataSelect}
    />
  );
};