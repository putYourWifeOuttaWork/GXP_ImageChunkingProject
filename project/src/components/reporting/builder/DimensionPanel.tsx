import React, { useState } from 'react';
import { Plus, Grid, Calendar, MapPin, Tag, Type, Hash, Trash2 } from 'lucide-react';
import Button from '../../common/Button';
import { Dimension, DataSource } from '../../../types/reporting';

interface DimensionPanelProps {
  dimensions: Dimension[];
  onAddDimension: (dimension: Dimension) => void;
  onRemoveDimension: (id: string) => void;
  selectedDimensions: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  dataSources: DataSource[];
  availableDimensions: Dimension[];
}

export const DimensionPanel: React.FC<DimensionPanelProps> = ({
  dimensions,
  onAddDimension,
  onRemoveDimension,
  selectedDimensions,
  onSelectionChange,
  dataSources,
  availableDimensions,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDimension, setNewDimension] = useState({
    name: '',
    field: '',
    dataSource: '',
    dataType: 'string' as const,
    displayName: '',
  });

  const handleAddDimension = () => {
    if (!newDimension.name || !newDimension.field || !newDimension.dataSource) return;

    const dimension: Dimension = {
      id: `dim_${Date.now()}`,
      name: newDimension.name,
      field: newDimension.field,
      source: newDimension.dataSource,
      dataType: newDimension.dataType,
      displayName: newDimension.displayName || newDimension.name,
    };

    onAddDimension(dimension);
    setNewDimension({ name: '', field: '', dataSource: '', dataType: 'string', displayName: '' });
    setShowAddForm(false);
  };

  const handleDimensionSelect = (dimensionDef: Dimension) => {
    onAddDimension(dimensionDef);
    setShowAddForm(false);
  };

  const handleRemoveDimension = (dimensionId: string, dimensionName: string) => {
    const confirmed = window.confirm(`Are you sure you want to remove dimension "${dimensionName}"?`);
    if (confirmed) {
      onRemoveDimension(dimensionId);
    }
  };

  const getIcon = (dataType: string) => {
    switch (dataType) {
      case 'text':
        return <Type size={16} className="text-gray-500" />;
      case 'date':
      case 'timestamp':
        return <Calendar size={16} className="text-gray-500" />;
      case 'numeric':
      case 'integer':
        return <Hash size={16} className="text-gray-500" />;
      default:
        return <Type size={16} className="text-gray-500" />;
    }
  };

  const groupedDimensions = availableDimensions.reduce((acc, dim) => {
    const sourceId = (dim as any).source || dim.dataSource;
    if (!acc[sourceId]) {
      acc[sourceId] = [];
    }
    acc[sourceId].push(dim);
    return acc;
  }, {} as Record<string, Dimension[]>);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Dimensions</h3>
        <p className="text-sm text-gray-600 mb-6">
          Dimensions are categorical fields that you can group and filter by. They help you break down your data for analysis.
        </p>
      </div>

      {/* Selected Dimensions */}
      {dimensions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Selected Dimensions</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dimensions.map((dimension) => (
              <div
                key={dimension.id}
                className="p-3 bg-primary-50 border border-primary-200 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getIcon(dimension.dataType)}
                    <div>
                      <h5 className="font-medium text-gray-900">{dimension.displayName}</h5>
                      <p className="text-sm text-gray-600">{dimension.source}.{dimension.field}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={() => handleRemoveDimension(dimension.id, dimension.displayName || dimension.name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Dimension */}
      {!showAddForm ? (
        <Button
          variant="outline"
          icon={<Plus size={16} />}
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          Add Dimension
        </Button>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Add New Dimension</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Dimensions
              </label>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(groupedDimensions).map(([sourceId, dims]) => {
                  const dataSource = dataSources.find(ds => ds.id === sourceId);
                  if (!dataSource || dims.length === 0) return null;

                  return (
                    <div key={sourceId} className="space-y-2">
                      <h5 className="text-sm font-medium text-gray-800 bg-gray-100 px-2 py-1 rounded">
                        {dataSource.name}
                      </h5>
                      {dims.map((dim) => (
                        <div
                          key={dim.id}
                          className="p-2 border rounded cursor-pointer transition-colors border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          onClick={() => handleDimensionSelect(dim)}
                        >
                          <div className="flex items-center">
                            {getIcon(dim.dataType)}
                            <div className="ml-3">
                              <h6 className="font-medium text-gray-900">{dim.displayName}</h6>
                              <p className="text-sm text-gray-600">{dim.field}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Grid size={20} className="text-blue-600 mr-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">Dimension Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Use dimensions to group and categorize your data</li>
              <li>• Text fields work well as dimensions (status, type, name)</li>
              <li>• Date fields can be grouped by day, week, month, or year</li>
              <li>• Choose dimensions that will provide meaningful insights</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};