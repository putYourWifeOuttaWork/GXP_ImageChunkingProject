import React, { useState } from 'react';
import { Plus, BarChart, TrendingUp, Calculator, Hash, Percent } from 'lucide-react';
import Button from '../../common/Button';
import { Measure, DataSource } from '../../../types/reporting';

interface MeasurePanelProps {
  measures: Measure[];
  onAddMeasure: (measure: Measure) => void;
  selectedMeasures: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  dataSources: DataSource[];
}

export const MeasurePanel: React.FC<MeasurePanelProps> = ({
  measures,
  onAddMeasure,
  selectedMeasures,
  onSelectionChange,
  dataSources,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMeasure, setNewMeasure] = useState({
    name: '',
    field: '',
    dataSource: '',
    aggregation: 'sum' as const,
    dataType: 'number' as const,
    displayName: '',
  });

  // Available measure fields based on agricultural data model
  const availableMeasures = [
    // Petri observation measures
    { 
      table: 'petri_observations', 
      field: 'growth_index', 
      name: 'Growth Index', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <TrendingUp size={16} />,
      description: 'Average growth index of petri dishes'
    },
    { 
      table: 'petri_observations', 
      field: 'growth_progression', 
      name: 'Growth Progression', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <TrendingUp size={16} />,
      description: 'Average growth progression'
    },
    { 
      table: 'petri_observations', 
      field: 'growth_velocity', 
      name: 'Growth Velocity', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <TrendingUp size={16} />,
      description: 'Average growth velocity'
    },
    { 
      table: 'petri_observations', 
      field: 'daysinthisprogramphase', 
      name: 'Days in Phase', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Average days in current program phase'
    },
    { 
      table: 'petri_observations', 
      field: 'todays_day_of_phase', 
      name: 'Day of Phase', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Current day of program phase'
    },
    { 
      table: 'petri_observations', 
      field: 'outdoor_temperature', 
      name: 'Outdoor Temperature', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Average outdoor temperature'
    },
    { 
      table: 'petri_observations', 
      field: 'outdoor_humidity', 
      name: 'Outdoor Humidity', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Percent size={16} />,
      description: 'Average outdoor humidity'
    },
    
    // Gasifier observation measures
    { 
      table: 'gasifier_observations', 
      field: 'measure', 
      name: 'Gasifier Reading', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <BarChart size={16} />,
      description: 'Average gasifier measurement'
    },
    { 
      table: 'gasifier_observations', 
      field: 'linear_reading', 
      name: 'Linear Reading', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <BarChart size={16} />,
      description: 'Average linear reading'
    },
    { 
      table: 'gasifier_observations', 
      field: 'linear_reduction_per_day', 
      name: 'Daily Reduction', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <TrendingUp size={16} />,
      description: 'Average daily reduction rate'
    },
    { 
      table: 'gasifier_observations', 
      field: 'flow_rate', 
      name: 'Flow Rate', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <BarChart size={16} />,
      description: 'Average flow rate'
    },
    { 
      table: 'gasifier_observations', 
      field: 'footage_from_origin_x', 
      name: 'X Position', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Average X coordinate'
    },
    { 
      table: 'gasifier_observations', 
      field: 'footage_from_origin_y', 
      name: 'Y Position', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Average Y coordinate'
    },
    
    // Submission measures
    { 
      table: 'submissions', 
      field: 'temperature', 
      name: 'Temperature', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Average temperature'
    },
    { 
      table: 'submissions', 
      field: 'humidity', 
      name: 'Humidity', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Percent size={16} />,
      description: 'Average humidity'
    },
    { 
      table: 'submissions', 
      field: 'indoor_temperature', 
      name: 'Indoor Temperature', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Average indoor temperature'
    },
    { 
      table: 'submissions', 
      field: 'indoor_humidity', 
      name: 'Indoor Humidity', 
      aggregation: 'avg' as const,
      dataType: 'number' as const, 
      icon: <Percent size={16} />,
      description: 'Average indoor humidity'
    },
    
    // Site measures
    { 
      table: 'sites', 
      field: 'total_petris', 
      name: 'Total Petris', 
      aggregation: 'sum' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total number of petri dishes'
    },
    { 
      table: 'sites', 
      field: 'total_gasifiers', 
      name: 'Total Gasifiers', 
      aggregation: 'sum' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total number of gasifiers'
    },
    { 
      table: 'sites', 
      field: 'square_footage', 
      name: 'Square Footage', 
      aggregation: 'sum' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total square footage'
    },
    { 
      table: 'sites', 
      field: 'cubic_footage', 
      name: 'Cubic Footage', 
      aggregation: 'sum' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total cubic footage'
    },
    { 
      table: 'sites', 
      field: 'num_vents', 
      name: 'Number of Vents', 
      aggregation: 'sum' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total number of vents'
    },
    
    // Program measures
    { 
      table: 'pilot_programs', 
      field: 'total_submissions', 
      name: 'Total Submissions', 
      aggregation: 'sum' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total number of submissions'
    },
    { 
      table: 'pilot_programs', 
      field: 'total_sites', 
      name: 'Total Sites', 
      aggregation: 'sum' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total number of sites'
    },
    
    // Count measures
    { 
      table: 'petri_observations', 
      field: '*', 
      name: 'Petri Observation Count', 
      aggregation: 'count' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total number of petri observations'
    },
    { 
      table: 'gasifier_observations', 
      field: '*', 
      name: 'Gasifier Observation Count', 
      aggregation: 'count' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total number of gasifier observations'
    },
    { 
      table: 'submissions', 
      field: '*', 
      name: 'Submission Count', 
      aggregation: 'count' as const,
      dataType: 'number' as const, 
      icon: <Hash size={16} />,
      description: 'Total number of submissions'
    },
  ];

  const aggregationOptions = [
    { value: 'sum', label: 'Sum', icon: <Plus size={16} /> },
    { value: 'avg', label: 'Average', icon: <BarChart size={16} /> },
    { value: 'count', label: 'Count', icon: <Hash size={16} /> },
    { value: 'min', label: 'Minimum', icon: <TrendingUp size={16} /> },
    { value: 'max', label: 'Maximum', icon: <TrendingUp size={16} /> },
    { value: 'median', label: 'Median', icon: <BarChart size={16} /> },
    { value: 'stddev', label: 'Standard Deviation', icon: <Calculator size={16} /> },
  ];

  const handleAddMeasure = () => {
    if (!newMeasure.name || !newMeasure.field || !newMeasure.dataSource) return;

    const measure: Measure = {
      id: `meas_${Date.now()}`,
      name: newMeasure.name,
      field: newMeasure.field,
      dataSource: newMeasure.dataSource,
      aggregation: newMeasure.aggregation,
      dataType: newMeasure.dataType,
      displayName: newMeasure.displayName || newMeasure.name,
    };

    onAddMeasure(measure);
    setNewMeasure({ name: '', field: '', dataSource: '', aggregation: 'sum', dataType: 'number', displayName: '' });
    setShowAddForm(false);
  };

  const handleMeasureSelect = (measureDef: any) => {
    const matchingDataSource = dataSources.find(ds => ds.table === measureDef.table);
    if (!matchingDataSource) return;

    setNewMeasure({
      name: measureDef.name,
      field: measureDef.field,
      dataSource: matchingDataSource.id,
      aggregation: measureDef.aggregation,
      dataType: measureDef.dataType,
      displayName: measureDef.name,
    });
  };

  const getIconForAggregation = (aggregation: string) => {
    switch (aggregation) {
      case 'sum':
        return <Plus size={16} className="text-blue-500" />;
      case 'avg':
        return <BarChart size={16} className="text-green-500" />;
      case 'count':
        return <Hash size={16} className="text-purple-500" />;
      case 'min':
      case 'max':
        return <TrendingUp size={16} className="text-orange-500" />;
      default:
        return <Calculator size={16} className="text-gray-500" />;
    }
  };

  const groupedMeasures = availableMeasures.reduce((acc, measure) => {
    if (!acc[measure.table]) {
      acc[measure.table] = [];
    }
    acc[measure.table].push(measure);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Measures</h3>
        <p className="text-sm text-gray-600 mb-6">
          Measures are numerical values that can be aggregated and analyzed. They represent the quantitative aspects of your data.
        </p>
      </div>

      {/* Selected Measures */}
      {measures.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Selected Measures</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {measures.map((measure) => (
              <div
                key={measure.id}
                className="p-3 border border-gray-200 rounded-lg bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getIconForAggregation(measure.aggregation)}
                    <div className="ml-3">
                      <h5 className="font-medium text-gray-900">{measure.displayName || measure.name}</h5>
                      <p className="text-sm text-gray-600">{measure.aggregation}({measure.field})</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                      {measure.aggregation}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                      {measure.dataType}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Measure */}
      {!showAddForm ? (
        <Button
          variant="outline"
          icon={<Plus size={16} />}
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          Add Measure
        </Button>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Add New Measure</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>

          <div className="space-y-4">
            {/* Available Measures by Table */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Measures
              </label>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(groupedMeasures).map(([table, measures]) => {
                  const dataSource = dataSources.find(ds => ds.table === table);
                  if (!dataSource) return null;

                  return (
                    <div key={table} className="space-y-2">
                      <h5 className="text-sm font-medium text-gray-800 bg-gray-100 px-2 py-1 rounded">
                        {dataSource.name}
                      </h5>
                      {measures.map((measure) => (
                        <div
                          key={`${table}-${measure.field}`}
                          className={`p-2 border rounded cursor-pointer transition-colors ${
                            newMeasure.field === measure.field && newMeasure.dataSource === dataSource.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleMeasureSelect(measure)}
                        >
                          <div className="flex items-center">
                            {measure.icon}
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <h6 className="font-medium text-gray-900">{measure.name}</h6>
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                  {measure.aggregation}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{measure.description}</p>
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
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newMeasure.displayName}
                      onChange={(e) => setNewMeasure(prev => ({ ...prev, displayName: e.target.value }))}
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
                      value={newMeasure.field}
                      onChange={(e) => setNewMeasure(prev => ({ ...prev, field: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Database field name"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aggregation Method
                  </label>
                  <select
                    value={newMeasure.aggregation}
                    onChange={(e) => setNewMeasure(prev => ({ ...prev, aggregation: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {aggregationOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
                onClick={handleAddMeasure}
                disabled={!newMeasure.name || !newMeasure.field || !newMeasure.dataSource}
              >
                Add Measure
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <BarChart size={20} className="text-blue-600 mr-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">Measure Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Use Sum for totals (e.g., total revenue, total count)</li>
              <li>• Use Average for rates and ratios (e.g., avg temperature)</li>
              <li>• Use Count for frequency analysis</li>
              <li>• Use Min/Max for range analysis</li>
              <li>• Combine measures for calculated fields</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};