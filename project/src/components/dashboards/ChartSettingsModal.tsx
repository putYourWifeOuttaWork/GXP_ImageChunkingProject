import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ChartSettingsPanel } from '../reporting/builder/ChartSettingsPanel';
import { VisualizationSettings, ViewportConfiguration } from '../../types/reporting/visualizationTypes';
import Button from '../common/Button';
import { Portal } from '../common/Portal';

interface ChartSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visualizationSettings: VisualizationSettings;
  currentViewport?: ViewportConfiguration;
  onSettingsChange: (settings: Partial<VisualizationSettings>) => void;
  onViewportSave?: (viewport: ViewportConfiguration) => void;
}

export const ChartSettingsModal: React.FC<ChartSettingsModalProps> = ({
  isOpen,
  onClose,
  visualizationSettings,
  currentViewport,
  onSettingsChange,
  onViewportSave,
}) => {
  const [localSettings, setLocalSettings] = useState<VisualizationSettings>(visualizationSettings);

  useEffect(() => {
    setLocalSettings(visualizationSettings);
  }, [visualizationSettings]);

  if (!isOpen) return null;

  const handleSettingsChange = (changes: Partial<VisualizationSettings>) => {
    const newSettings = { ...localSettings, ...changes };
    setLocalSettings(newSettings);
    onSettingsChange(changes);
  };

  const handleSaveViewport = () => {
    if (currentViewport && onViewportSave) {
      onViewportSave(currentViewport);
    }
  };

  const handleResetView = () => {
    if (onViewportSave) {
      // Save viewport with autoFit enabled to reset to default behavior
      onViewportSave({
        scale: 1.0,
        panX: 0,
        panY: 0,
        autoFit: true
      });
    }
  };

  const handleClose = () => {
    // Reset local settings on close
    setLocalSettings(visualizationSettings);
    onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={handleClose}
        />
        
        {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Chart Settings</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
          <ChartSettingsPanel
            visualizationSettings={localSettings}
            onSettingsChange={handleSettingsChange}
          />
          
          {/* Viewport Settings */}
          {currentViewport && (
            <div className="p-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">View Settings</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Zoom:</span>
                  <span className="font-medium">{Math.round(currentViewport.scale * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pan Position:</span>
                  <span className="font-medium">
                    X: {Math.round(currentViewport.panX * 100)}%, Y: {Math.round(currentViewport.panY * 100)}%
                  </span>
                </div>
              </div>
              {onViewportSave && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleSaveViewport}
                    className="w-full px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-md hover:bg-blue-100 transition-colors"
                  >
                    Save Current View as Default
                  </button>
                  <button
                    onClick={handleResetView}
                    className="w-full px-3 py-2 bg-gray-50 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Reset to Auto-Fit View
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClose}
          >
            Done
          </Button>
        </div>
      </div>
      </div>
    </Portal>
  );
};