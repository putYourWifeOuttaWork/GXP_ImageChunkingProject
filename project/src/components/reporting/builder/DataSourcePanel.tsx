import React, { useState } from 'react';
import { Plus, Database, Table, Link, Search, Settings } from 'lucide-react';
import Button from '../../common/Button';
import { DataSource } from '../../../types/reporting';

interface DataSourcePanelProps {
  dataSources: DataSource[];
  onAddDataSource: (dataSource: DataSource) => void;
  onSelectDataSource: (id: string) => void;
  selectedDataSource: string | null;
}

export const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  dataSources,
  onAddDataSource,
  onSelectDataSource,
  selectedDataSource,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDataSource, setNewDataSource] = useState({
    name: '',
    table: '',
    alias: '',
  });

  // Available tables in the agricultural system
  const availableTables = [
    { name: 'pilot_programs', description: 'Pilot program information' },
    { name: 'sites', description: 'Site details and configurations' },
    { name: 'submissions', description: 'Submission data and environmental conditions' },
    { name: 'petri_observations', description: 'Petri dish observations and growth data' },
    { name: 'gasifier_observations', description: 'Gasifier readings and chemical data' },
    { name: 'users', description: 'User information and profiles' },
    { name: 'companies', description: 'Company information' },
  ];

  const handleAddDataSource = () => {
    if (!newDataSource.name || !newDataSource.table) return;

    const dataSource: DataSource = {
      id: `ds_${Date.now()}`,
      name: newDataSource.name,
      table: newDataSource.table,
      alias: newDataSource.alias || undefined,
      joins: [],
      baseFilters: [],
    };

    onAddDataSource(dataSource);
    setNewDataSource({ name: '', table: '', alias: '' });
    setShowAddForm(false);
  };

  const handleTableSelect = (tableName: string) => {
    setNewDataSource(prev => ({
      ...prev,
      table: tableName,
      name: prev.name || tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data Sources</h3>
        <p className="text-sm text-gray-600 mb-6">
          Select the data sources you want to include in your report. You can add multiple sources and join them together.
        </p>
      </div>

      {/* Existing Data Sources */}
      {dataSources.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Selected Data Sources</h4>
          {dataSources.map((source) => (
            <div
              key={source.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedDataSource === source.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelectDataSource(source.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Database size={20} className="text-gray-500 mr-3" />
                  <div>
                    <h5 className="font-medium text-gray-900">{source.name}</h5>
                    <p className="text-sm text-gray-600">
                      Table: {source.table}
                      {source.alias && ` (${source.alias})`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Settings size={16} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle configure data source
                  }}
                >
                  Configure
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Data Source */}
      {!showAddForm ? (
        <Button
          variant="outline"
          icon={<Plus size={16} />}
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          Add Data Source
        </Button>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Add New Data Source</h4>
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
                Data Source Name
              </label>
              <input
                type="text"
                value={newDataSource.name}
                onChange={(e) => setNewDataSource(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter a descriptive name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table
              </label>
              <div className="space-y-2">
                {availableTables.map((table) => (
                  <div
                    key={table.name}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      newDataSource.table === table.name
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleTableSelect(table.name)}
                  >
                    <div className="flex items-center">
                      <Table size={16} className="text-gray-500 mr-3" />
                      <div>
                        <h5 className="font-medium text-gray-900">{table.name}</h5>
                        <p className="text-sm text-gray-600">{table.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alias (Optional)
              </label>
              <input
                type="text"
                value={newDataSource.alias}
                onChange={(e) => setNewDataSource(prev => ({ ...prev, alias: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Short name for this data source"
              />
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
                onClick={handleAddDataSource}
                disabled={!newDataSource.name || !newDataSource.table}
              >
                Add Data Source
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Database size={20} className="text-blue-600 mr-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">Data Source Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Start with your primary data source (e.g., observations)</li>
              <li>• Add related sources for additional context</li>
              <li>• Use aliases to simplify complex table names</li>
              <li>• Join relationships will be configured automatically</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};