import React, { useState } from 'react';
import { Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { VisualizationSettings } from '../../../types/reporting';

interface ChartSettingsPanelProps {
  visualizationSettings: VisualizationSettings;
  onSettingsChange: (settings: Partial<VisualizationSettings>) => void;
}

export const ChartSettingsPanel: React.FC<ChartSettingsPanelProps> = ({
  visualizationSettings,
  onSettingsChange,
}) => {
  console.log('⚙️ ChartSettingsPanel render');
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <Settings size={20} className="text-gray-600 mr-2" />
          <h3 className="text-sm font-medium text-gray-900">Chart Settings</h3>
        </div>
        {isExpanded ? (
          <ChevronDown size={20} className="text-gray-400" />
        ) : (
          <ChevronRight size={20} className="text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Chart Size */}
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2">Chart Size</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Width</label>
                <input
                  type="number"
                  value={visualizationSettings?.dimensions?.width || 800}
                  onChange={(e) => onSettingsChange({
                    dimensions: {
                      ...visualizationSettings?.dimensions,
                      width: parseInt(e.target.value) || 800,
                    }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  min="300"
                  max="2000"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Height</label>
                <input
                  type="number"
                  value={visualizationSettings?.dimensions?.height || 400}
                  onChange={(e) => onSettingsChange({
                    dimensions: {
                      ...visualizationSettings?.dimensions,
                      height: parseInt(e.target.value) || 400,
                    }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  min="200"
                  max="1200"
                />
              </div>
            </div>
          </div>

          {/* Color Scheme */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Color Scheme</label>
            <select
              value={Array.isArray(visualizationSettings?.colors?.palette) ? 'category10' : visualizationSettings?.colors?.palette || 'colorblindSafe'}
              onChange={(e) => onSettingsChange({
                colors: {
                  ...visualizationSettings?.colors,
                  palette: e.target.value,
                }
              })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <optgroup label="Colorblind Safe">
                <option value="colorblindSafe">Colorblind Safe</option>
                <option value="accessible">Accessible</option>
                <option value="viridis">Viridis</option>
                <option value="cividis">Cividis</option>
              </optgroup>
              <optgroup label="Standard">
                <option value="category10">Category 10</option>
                <option value="tableau10">Tableau 10</option>
              </optgroup>
              <optgroup label="Monochromatic">
                <option value="blues">Blues</option>
                <option value="greens">Greens</option>
              </optgroup>
            </select>
          </div>

          {/* Display Options */}
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2">Display Options</h4>
            <div className="space-y-1">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={visualizationSettings?.legends?.show !== false}
                  onChange={(e) => onSettingsChange({
                    legends: {
                      ...visualizationSettings?.legends,
                      show: e.target.checked,
                    }
                  })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                />
                <span className="text-sm text-gray-700">Show Legend</span>
              </label>

              {/* Legend Placement - Only show when legend is enabled */}
              {visualizationSettings?.legends?.show !== false && (
                <div className="ml-6 mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Legend Placement</label>
                  <select
                    value={visualizationSettings?.legends?.position || 'right'}
                    onChange={(e) => onSettingsChange({
                      legends: {
                        ...visualizationSettings?.legends,
                        position: e.target.value as any,
                      }
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <optgroup label="Side Positions">
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </optgroup>
                    <optgroup label="Corner Positions">
                      <option value="topLeft">Top Left</option>
                      <option value="topRight">Top Right</option>
                      <option value="bottomLeft">Bottom Left</option>
                      <option value="bottomRight">Bottom Right</option>
                    </optgroup>
                  </select>
                </div>
              )}

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={visualizationSettings?.tooltips?.show !== false}
                  onChange={(e) => onSettingsChange({
                    tooltips: {
                      ...visualizationSettings?.tooltips,
                      show: e.target.checked,
                    }
                  })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                />
                <span className="text-sm text-gray-700">Show Tooltips</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={visualizationSettings?.animations?.enabled !== false}
                  onChange={(e) => onSettingsChange({
                    animations: {
                      ...visualizationSettings?.animations,
                      enabled: e.target.checked,
                    }
                  })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                />
                <span className="text-sm text-gray-700">Enable Animations</span>
              </label>
            </div>
          </div>

          {/* Axis Sorting */}
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2">Axis Sorting</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">X-Axis Sort</label>
                <select
                  value={visualizationSettings?.axes?.x?.sort || 'none'}
                  onChange={(e) => onSettingsChange({
                    axes: {
                      ...visualizationSettings?.axes,
                      x: {
                        ...visualizationSettings?.axes?.x,
                        sort: e.target.value as any,
                      }
                    }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="none">No Sorting</option>
                  <option value="asc">Ascending (A-Z, 0-9)</option>
                  <option value="desc">Descending (Z-A, 9-0)</option>
                  <option value="value_asc">By Value (Low to High)</option>
                  <option value="value_desc">By Value (High to Low)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Y-Axis Sort</label>
                <select
                  value={visualizationSettings?.axes?.y?.sort || 'none'}
                  onChange={(e) => onSettingsChange({
                    axes: {
                      ...visualizationSettings?.axes,
                      y: {
                        ...visualizationSettings?.axes?.y,
                        sort: e.target.value as any,
                      }
                    }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="none">No Sorting</option>
                  <option value="asc">Ascending (A-Z, 0-9)</option>
                  <option value="desc">Descending (Z-A, 9-0)</option>
                  <option value="value_asc">By Value (Low to High)</option>
                  <option value="value_desc">By Value (High to Low)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Y-Axis Scale */}
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2">Y-Axis Scale</h4>
            <label className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={visualizationSettings?.axes?.y?.customScale || false}
                onChange={(e) => onSettingsChange({
                  axes: {
                    ...visualizationSettings?.axes,
                    y: {
                      ...visualizationSettings?.axes?.y,
                      customScale: e.target.checked,
                    }
                  }
                })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
              />
              <span className="text-sm text-gray-700">Use Custom Scale</span>
            </label>

            {visualizationSettings?.axes?.y?.customScale && (
              <div className="space-y-2 ml-6">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Min Value</label>
                  <input
                    type="number"
                    value={visualizationSettings?.axes?.y?.minValue ?? ''}
                    onChange={(e) => onSettingsChange({
                      axes: {
                        ...visualizationSettings?.axes,
                        y: {
                          ...visualizationSettings?.axes?.y,
                          minValue: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        }
                      }
                    })}
                    placeholder="Auto"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Max Value</label>
                  <input
                    type="number"
                    value={visualizationSettings?.axes?.y?.maxValue ?? ''}
                    onChange={(e) => onSettingsChange({
                      axes: {
                        ...visualizationSettings?.axes,
                        y: {
                          ...visualizationSettings?.axes?.y,
                          maxValue: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        }
                      }
                    })}
                    placeholder="Auto"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Tip */}
          <div className="p-2 bg-blue-50 rounded text-xs text-blue-800">
            <strong>Tip:</strong> Changes apply instantly to the chart preview
          </div>
        </div>
      )}
    </div>
  );
};