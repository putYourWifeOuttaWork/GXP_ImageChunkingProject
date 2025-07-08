import React, { useState } from 'react';
import { Plus, Grid, Calendar, MapPin, Tag, Type, Hash } from 'lucide-react';
import Button from '../../common/Button';
import { Dimension, DataSource } from '../../../types/reporting';

interface DimensionPanelProps {
  dimensions: Dimension[];
  onAddDimension: (dimension: Dimension) => void;
  selectedDimensions: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  dataSources: DataSource[];
}

export const DimensionPanel: React.FC<DimensionPanelProps> = ({
  dimensions,
  onAddDimension,
  selectedDimensions,
  onSelectionChange,
  dataSources,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDimension, setNewDimension] = useState({
    name: '',
    field: '',
    dataSource: '',
    dataType: 'string' as const,
    displayName: '',
  });

  // Available dimension fields based on agricultural data model
  const availableDimensions = [
    // Program dimensions
    { 
      table: 'pilot_programs', 
      field: 'name', 
      name: 'Program Name', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'Name of the pilot program'
    },
    { 
      table: 'pilot_programs', 
      field: 'status', 
      name: 'Program Status', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'Status of the pilot program'
    },
    { 
      table: 'pilot_programs', 
      field: 'start_date', 
      name: 'Program Start Date', 
      dataType: 'date' as const, 
      icon: <Calendar size={16} />,
      description: 'Start date of the program'
    },
    
    // Site dimensions
    { 
      table: 'sites', 
      field: 'name', 
      name: 'Site Name', 
      dataType: 'string' as const, 
      icon: <MapPin size={16} />,
      description: 'Name of the site'
    },
    { 
      table: 'sites', 
      field: 'type', 
      name: 'Site Type', 
      dataType: 'string' as const, 
      icon: <Type size={16} />,
      description: 'Type of site (Greenhouse, Production Facility, etc.)'
    },
    { 
      table: 'sites', 
      field: 'primary_function', 
      name: 'Primary Function', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'Primary function of the site'
    },
    
    // Submission dimensions
    { 
      table: 'submissions', 
      field: 'weather', 
      name: 'Weather Conditions', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'Weather conditions during submission'
    },
    { 
      table: 'submissions', 
      field: 'airflow', 
      name: 'Airflow Status', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'Airflow status (Open/Closed)'
    },
    { 
      table: 'submissions', 
      field: 'created_at', 
      name: 'Submission Date', 
      dataType: 'date' as const, 
      icon: <Calendar size={16} />,
      description: 'Date of submission'
    },
    
    // Petri observation dimensions
    { 
      table: 'petri_observations', 
      field: 'petri_code', 
      name: 'Petri Code', 
      dataType: 'string' as const, 
      icon: <Hash size={16} />,
      description: 'Unique code for petri dish'
    },
    { 
      table: 'petri_observations', 
      field: 'fungicide_used', 
      name: 'Fungicide Used', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'Whether fungicide was used'
    },
    { 
      table: 'petri_observations', 
      field: 'plant_type', 
      name: 'Plant Type', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'Type of plant in petri dish'
    },
    { 
      table: 'petri_observations', 
      field: 'petri_growth_stage', 
      name: 'Growth Stage', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'Current growth stage'
    },
    { 
      table: 'petri_observations', 
      field: 'placement', 
      name: 'Placement', 
      dataType: 'string' as const, 
      icon: <MapPin size={16} />,
      description: 'Physical placement of petri dish'
    },
    
    // Gasifier observation dimensions
    { 
      table: 'gasifier_observations', 
      field: 'gasifier_code', 
      name: 'Gasifier Code', 
      dataType: 'string' as const, 
      icon: <Hash size={16} />,
      description: 'Unique code for gasifier'
    },
    { 
      table: 'gasifier_observations', 
      field: 'chemical_type', 
      name: 'Chemical Type', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'Type of chemical used'
    },
    { 
      table: 'gasifier_observations', 
      field: 'placement_height', 
      name: 'Placement Height', 
      dataType: 'string' as const, 
      icon: <MapPin size={16} />,
      description: 'Height placement of gasifier'
    },
    { 
      table: 'gasifier_observations', 
      field: 'directional_placement', 
      name: 'Directional Placement', 
      dataType: 'string' as const, 
      icon: <MapPin size={16} />,
      description: 'Directional placement of gasifier'
    },
    { 
      table: 'gasifier_observations', 
      field: 'anomaly', 
      name: 'Anomaly Flag', 
      dataType: 'boolean' as const, 
      icon: <Tag size={16} />,
      description: 'Whether anomaly was detected'
    },
    
    // User dimensions
    { 
      table: 'users', 
      field: 'company', 
      name: 'Company', 
      dataType: 'string' as const, 
      icon: <Tag size={16} />,
      description: 'User company'
    },
  ];

  const handleAddDimension = () => {
    if (!newDimension.name || !newDimension.field || !newDimension.dataSource) return;

    const dimension: Dimension = {
      id: `dim_${Date.now()}`,
      name: newDimension.name,
      field: newDimension.field,
      dataSource: newDimension.dataSource,
      dataType: newDimension.dataType,
      displayName: newDimension.displayName || newDimension.name,
    };

    onAddDimension(dimension);
    setNewDimension({ name: '', field: '', dataSource: '', dataType: 'string', displayName: '' });
    setShowAddForm(false);
  };

  const handleDimensionSelect = (dimensionDef: any) => {
    const matchingDataSource = dataSources.find(ds => ds.table === dimensionDef.table);
    if (!matchingDataSource) return;

    setNewDimension({
      name: dimensionDef.name,
      field: dimensionDef.field,
      dataSource: matchingDataSource.id,
      dataType: dimensionDef.dataType,
      displayName: dimensionDef.name,
    });
  };

  const getIconForDataType = (dataType: string) => {
    switch (dataType) {
      case 'date':
        return <Calendar size={16} className="text-blue-500" />;
      case 'boolean':
        return <Tag size={16} className="text-green-500" />;
      case 'number':
        return <Hash size={16} className="text-purple-500" />;
      default:
        return <Type size={16} className="text-gray-500" />;
    }
  };

  const groupedDimensions = availableDimensions.reduce((acc, dim) => {
    if (!acc[dim.table]) {
      acc[dim.table] = [];
    }
    acc[dim.table].push(dim);
    return acc;
  }, {} as Record<string, any[]>);

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
                className="p-3 border border-gray-200 rounded-lg bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getIconForDataType(dimension.dataType)}
                    <div className="ml-3">
                      <h5 className="font-medium text-gray-900">{dimension.displayName || dimension.name}</h5>
                      <p className="text-sm text-gray-600">{dimension.field}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                    {dimension.dataType}
                  </span>
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
            {/* Available Dimensions by Table */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Dimensions
              </label>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(groupedDimensions).map(([table, dims]) => {
                  const dataSource = dataSources.find(ds => ds.table === table);
                  if (!dataSource) return null;

                  return (
                    <div key={table} className="space-y-2">
                      <h5 className="text-sm font-medium text-gray-800 bg-gray-100 px-2 py-1 rounded">
                        {dataSource.name}
                      </h5>
                      {dims.map((dim) => (
                        <div
                          key={`${table}-${dim.field}`}
                          className={`p-2 border rounded cursor-pointer transition-colors ${
                            newDimension.field === dim.field && newDimension.dataSource === dataSource.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleDimensionSelect(dim)}
                        >
                          <div className="flex items-center">
                            {dim.icon}
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <h6 className="font-medium text-gray-900">{dim.name}</h6>
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                  {dim.dataType}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{dim.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manual Entry */}
            <div className="border-t pt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Or Enter Manually</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newDimension.displayName}
                    onChange={(e) => setNewDimension(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="How it appears in the report"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Name
                  </label>
                  <input
                    type="text"
                    value={newDimension.field}
                    onChange={(e) => setNewDimension(prev => ({ ...prev, field: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Database field name"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAddDimension}
                disabled={!newDimension.name || !newDimension.field || !newDimension.dataSource}
              >
                Add Dimension
              </Button>
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
              <li>• Date dimensions enable time-based analysis</li>
              <li>• Location dimensions help with spatial analysis</li>
              <li>• Combine multiple dimensions for deeper insights</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};