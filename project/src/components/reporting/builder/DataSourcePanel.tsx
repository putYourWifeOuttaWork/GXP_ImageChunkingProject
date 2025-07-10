import React, { useState, useEffect } from 'react';
import { Plus, Database, Table, Link, Search, Settings, Trash2, X } from 'lucide-react';
import Button from '../../common/Button';
import { DataSource } from '../../../types/reporting';
import { ReportingDataService } from '../../../services/reportingDataService';

interface DataSourcePanelProps {
  dataSources: DataSource[];
  onAddDataSource: (dataSource: DataSource) => void;
  onRemoveDataSource: (id: string) => void;
  onSelectDataSource: (id: string) => void;
  selectedDataSource: string | null;
}

export const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  dataSources,
  onAddDataSource,
  onRemoveDataSource,
  onSelectDataSource,
  selectedDataSource,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [configureDataSource, setConfigureDataSource] = useState<string | null>(null);

  const [availableDataSources, setAvailableDataSources] = useState<DataSource[]>([]);

  useEffect(() => {
    // Load available data sources from the service
    const sources = ReportingDataService.getAvailableDataSources();
    setAvailableDataSources(sources);
  }, []);

  const handleAddDataSource = (sourceId: string) => {
    const source = availableDataSources.find(s => s.id === sourceId);
    if (!source) return;

    onAddDataSource(source);
    setShowAddForm(false);
  };

  const handleRemoveDataSource = (sourceId: string, sourceName: string) => {
    const confirmed = window.confirm(`Are you sure you want to remove "${sourceName}" from your report?`);
    if (confirmed) {
      onRemoveDataSource(sourceId);
    }
  };

  const handleConfigureDataSource = (sourceId: string) => {
    setConfigureDataSource(sourceId);
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
                    <p className="text-xs text-gray-500">{source.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Settings size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfigureDataSource(source.id);
                    }}
                  >
                    Configure
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveDataSource(source.id, source.name);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configure Data Source Dialog */}
      {configureDataSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Configure Data Source</h3>
              <Button
                variant="ghost"
                size="sm"
                icon={<X size={16} />}
                onClick={() => setConfigureDataSource(null)}
              />
            </div>
            
            {(() => {
              const source = dataSources.find(s => s.id === configureDataSource);
              if (!source) return null;
              
              return (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Source Name
                    </label>
                    <p className="text-sm text-gray-900">{source.name}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Table
                    </label>
                    <p className="text-sm text-gray-900">{source.table}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Available Fields
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                      {source.fields.map(field => (
                        <div key={field.name} className="flex justify-between items-center py-1">
                          <span className="text-sm text-gray-900">{field.displayName}</span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {field.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfigureDataSource(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
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
                Select Data Source
              </label>
              <div className="space-y-2">
                {availableDataSources
                  .filter(source => !dataSources.some(selected => selected.id === source.id))
                  .map((source) => (
                    <div
                      key={source.id}
                      className="p-3 border rounded-md cursor-pointer transition-colors border-gray-200 hover:border-gray-300"
                      onClick={() => handleAddDataSource(source.id)}
                    >
                      <div className="flex items-center">
                        <Table size={16} className="text-gray-500 mr-3" />
                        <div>
                          <h5 className="font-medium text-gray-900">{source.name}</h5>
                          <p className="text-sm text-gray-600">{source.description}</p>
                          <p className="text-xs text-gray-500">Table: {source.table}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                
                {/* Show message if all sources are selected */}
                {availableDataSources.filter(source => !dataSources.some(selected => selected.id === source.id)).length === 0 && (
                  <div className="p-4 text-center text-gray-500">
                    <p className="text-sm">All available data sources have been added to your report.</p>
                  </div>
                )}
              </div>
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