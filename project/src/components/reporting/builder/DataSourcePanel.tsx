import React, { useState, useEffect } from 'react';
import { Plus, Database, Table, Link, Search, Settings, Trash2, X, CheckCircle, Star } from 'lucide-react';
import Button from '../../common/Button';
import { DataSource, DataSourceField, DataSourceRelationship } from '../../../types/reporting';
import { ReportingDataService } from '../../../services/reportingDataService';
import { supabase } from '../../../lib/supabaseClient';

interface DataSourcePanelProps {
  dataSources: DataSource[];
  onAddDataSource: (dataSource: DataSource) => void;
  onUpdateDataSource: (id: string, updates: Partial<DataSource>) => void;
  onRemoveDataSource: (id: string) => void;
  onSelectDataSource: (id: string) => void;
  selectedDataSource: string | null;
}

export const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  dataSources,
  onAddDataSource,
  onUpdateDataSource,
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
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium text-gray-900">{source.name}</h5>
                      {source.isPrimary && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                          <Star size={12} className="mr-1" />
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Table: {source.table}
                      {source.alias && ` (${source.alias})`}
                    </p>
                    <p className="text-xs text-gray-500">{source.description}</p>
                    {source.selectedFields && source.selectedFields.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {source.selectedFields.length} fields selected
                      </p>
                    )}
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
        <ConfigureDataSourceModal
          dataSource={dataSources.find(s => s.id === configureDataSource)}
          allDataSources={dataSources}
          onClose={() => setConfigureDataSource(null)}
          onUpdate={(updates) => {
            onUpdateDataSource(configureDataSource, updates);
            setConfigureDataSource(null);
          }}
        />
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

// Configure Data Source Modal Component
const ConfigureDataSourceModal: React.FC<{
  dataSource: DataSource | undefined;
  allDataSources: DataSource[];
  onClose: () => void;
  onUpdate: (updates: Partial<DataSource>) => void;
}> = ({ dataSource, allDataSources, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    dataSource?.selectedFields || []
  );
  const [availableFields, setAvailableFields] = useState<DataSourceField[]>(
    dataSource?.availableFields || []
  );
  const [isPrimary, setIsPrimary] = useState(
    dataSource?.isPrimary || false
  );
  const [relationships, setRelationships] = useState<DataSourceRelationship[]>(
    dataSource?.relationships || []
  );
  const [showAddRelationship, setShowAddRelationship] = useState(false);

  // Load available fields when modal opens
  useEffect(() => {
    if (!dataSource || availableFields.length > 0) return;
    
    const loadFields = async () => {
      setLoading(true);
      try {
        const columns = await ReportingDataService.getTableColumns([dataSource]);
        const fields = columns[dataSource.table]?.map(col => ({
          name: col.name,
          displayName: col.displayName,
          dataType: col.type,
          isSelected: selectedFields.includes(col.name) || 
                     (selectedFields.length === 0), // Select all by default if none selected
          isPrimaryKey: col.name === 'id' || col.name.endsWith('_id'),
          isForeignKey: col.name.endsWith('_id') && col.name !== 'id',
          relatedTable: col.name.endsWith('_id') ? col.name.replace('_id', '') : undefined,
          relatedField: col.name.endsWith('_id') ? 'id' : undefined,
        } as DataSourceField)) || [];
        
        setAvailableFields(fields);
        
        // If no fields were previously selected, select all by default
        if (selectedFields.length === 0) {
          setSelectedFields(fields.map(f => f.name));
        }
      } catch (error) {
        console.error('Failed to load fields:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadFields();
  }, [dataSource]);

  const toggleFieldSelection = (fieldName: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldName)
        ? prev.filter(f => f !== fieldName)
        : [...prev, fieldName]
    );
  };

  const handleSave = () => {
    const updates: Partial<DataSource> = {
      selectedFields,
      availableFields: availableFields.map(f => ({
        ...f,
        isSelected: selectedFields.includes(f.name)
      })),
      isPrimary,
      relationships
    };
    
    onUpdate(updates);
  };

  const handleAddRelationship = (newRelation: DataSourceRelationship) => {
    setRelationships([...relationships, newRelation]);
    setShowAddRelationship(false);
  };

  const handleRemoveRelationship = (id: string) => {
    setRelationships(relationships.filter(r => r.id !== id));
  };

  if (!dataSource) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Configure Data Source</h3>
          <Button
            variant="ghost"
            size="sm"
            icon={<X size={16} />}
            onClick={onClose}
          />
        </div>
        
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Source Name
              </label>
              <p className="text-sm text-gray-900">{dataSource.name}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Table
              </label>
              <p className="text-sm text-gray-900">{dataSource.table}</p>
            </div>
          </div>

          {/* Primary/Secondary Designation */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">Data Source Type</h4>
              <Button
                variant={isPrimary ? 'primary' : 'outline'}
                size="sm"
                icon={<Star size={16} />}
                onClick={() => setIsPrimary(!isPrimary)}
              >
                {isPrimary ? 'Primary Source' : 'Secondary Source'}
              </Button>
            </div>
            <p className="text-xs text-gray-600">
              Primary sources are the main focus of your analysis. Secondary sources provide supporting data.
            </p>
          </div>

          {/* Field Selection */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">Select Fields</h4>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFields(availableFields.map(f => f.name))}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFields([])}
                >
                  Clear All
                </Button>
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading fields...</div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                {availableFields.map(field => (
                  <div
                    key={field.name}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <label className="flex items-center cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field.name)}
                        onChange={() => toggleFieldSelection(field.name)}
                        className="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-gray-900 font-medium">
                          {field.displayName}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({field.name})
                        </span>
                      </div>
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {field.dataType}
                      </span>
                      {field.isPrimaryKey && (
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                          PK
                        </span>
                      )}
                      {field.isForeignKey && (
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                          FK
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-xs text-gray-600 mt-2">
              {selectedFields.length} of {availableFields.length} fields selected
            </p>
          </div>

          {/* Relationships */}
          {!isPrimary && allDataSources.filter(ds => ds.id !== dataSource.id).length > 0 && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-900">Relationships</h4>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Link size={16} />}
                  onClick={() => setShowAddRelationship(true)}
                >
                  Add Relationship
                </Button>
              </div>
              
              {relationships.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No relationships defined. Add relationships to connect this data source with others.
                </p>
              ) : (
                <div className="space-y-2">
                  {relationships.map(rel => (
                    <div key={rel.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                      <div className="text-sm">
                        <span className="font-medium">{rel.fromField}</span>
                        <span className="text-gray-500 mx-2">→</span>
                        <span className="font-medium">{rel.toSource}.{rel.toField}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({rel.cardinality}, {rel.joinType} join)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => handleRemoveRelationship(rel.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-2 pt-6 border-t mt-6">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            icon={<CheckCircle size={16} />}
          >
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Add Relationship Dialog */}
      {showAddRelationship && (
        <AddRelationshipDialog
          sourceDataSource={dataSource}
          targetDataSources={allDataSources.filter(ds => ds.id !== dataSource.id)}
          sourceFields={availableFields.filter(f => selectedFields.includes(f.name))}
          onAdd={handleAddRelationship}
          onClose={() => setShowAddRelationship(false)}
        />
      )}
    </div>
  );
};

// Add Relationship Dialog Component
const AddRelationshipDialog: React.FC<{
  sourceDataSource: DataSource;
  targetDataSources: DataSource[];
  sourceFields: DataSourceField[];
  onAdd: (relationship: DataSourceRelationship) => void;
  onClose: () => void;
}> = ({ sourceDataSource, targetDataSources, sourceFields, onAdd, onClose }) => {
  const [fromField, setFromField] = useState('');
  const [toSource, setToSource] = useState('');
  const [toField, setToField] = useState('');
  const [cardinality, setCardinality] = useState<DataSourceRelationship['cardinality']>('many-to-one');
  const [joinType, setJoinType] = useState<DataSourceRelationship['joinType']>('inner');
  const [targetFields, setTargetFields] = useState<DataSourceField[]>([]);
  const [loadingTargetFields, setLoadingTargetFields] = useState(false);

  // Load target fields when target source changes
  useEffect(() => {
    if (!toSource) {
      setTargetFields([]);
      return;
    }
    
    const targetDs = targetDataSources.find(ds => ds.id === toSource);
    if (targetDs?.availableFields && targetDs.availableFields.length > 0) {
      setTargetFields(targetDs.availableFields);
    } else if (targetDs) {
      // If target data source doesn't have available fields loaded, load them
      const loadTargetFields = async () => {
        setLoadingTargetFields(true);
        try {
          const { data: tableColumns } = await supabase
            .rpc('get_table_columns', { table_name: targetDs.table });
          
          if (tableColumns && tableColumns.length > 0) {
            const fields = tableColumns.map(col => ({
              name: col.column_name,
              displayName: col.column_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              dataType: col.data_type === 'integer' ? 'number' : 
                       col.data_type === 'timestamp with time zone' ? 'date' : 
                       col.data_type === 'boolean' ? 'boolean' : 'string',
              isSelected: false,
              isPrimaryKey: col.column_name === 'id' || col.column_name.endsWith('_id'),
              isForeignKey: col.column_name.endsWith('_id') && col.column_name !== 'id',
              relatedTable: col.column_name.endsWith('_id') ? col.column_name.replace('_id', '') : undefined,
              relatedField: col.column_name.endsWith('_id') ? 'id' : undefined,
            }));
            
            setTargetFields(fields);
          }
        } catch (error) {
          console.error('Failed to load target fields:', error);
          setTargetFields([]);
        } finally {
          setLoadingTargetFields(false);
        }
      };
      
      loadTargetFields();
    }
  }, [toSource, targetDataSources]);

  const handleAdd = () => {
    if (!fromField || !toSource || !toField) return;
    
    const newRelationship: DataSourceRelationship = {
      id: `rel_${Date.now()}`,
      fromSource: sourceDataSource.id,
      toSource,
      fromField,
      toField,
      cardinality,
      joinType,
      isRequired: joinType === 'inner'
    };
    
    onAdd(newRelationship);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Add Relationship</h3>
          <Button
            variant="ghost"
            size="sm"
            icon={<X size={16} />}
            onClick={onClose}
          />
        </div>
        
        <div className="space-y-4">
          {/* From Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Field ({sourceDataSource.name})
            </label>
            <select
              value={fromField}
              onChange={(e) => setFromField(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Select field...</option>
              {sourceFields.map(field => (
                <option key={field.name} value={field.name}>
                  {field.displayName} ({field.dataType})
                </option>
              ))}
            </select>
          </div>

          {/* To Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Related Data Source
            </label>
            <select
              value={toSource}
              onChange={(e) => setToSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Select data source...</option>
              {targetDataSources.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </select>
          </div>

          {/* To Field */}
          {toSource && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Field
              </label>
              <select
                value={toField}
                onChange={(e) => setToField(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                disabled={loadingTargetFields}
              >
                <option value="">
                  {loadingTargetFields ? 'Loading fields...' : 'Select field...'}
                </option>
                {targetFields.map(field => (
                  <option key={field.name} value={field.name}>
                    {field.displayName} ({field.dataType})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cardinality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cardinality
            </label>
            <select
              value={cardinality}
              onChange={(e) => setCardinality(e.target.value as DataSourceRelationship['cardinality'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="one-to-one">One to One</option>
              <option value="one-to-many">One to Many</option>
              <option value="many-to-one">Many to One</option>
              <option value="many-to-many">Many to Many</option>
            </select>
          </div>

          {/* Join Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Join Type
            </label>
            <select
              value={joinType}
              onChange={(e) => setJoinType(e.target.value as DataSourceRelationship['joinType'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="inner">Inner Join (matching records only)</option>
              <option value="left">Left Join (all from this source)</option>
              <option value="right">Right Join (all from related source)</option>
              <option value="full">Full Join (all records)</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-6">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={!fromField || !toSource || !toField}
          >
            Add Relationship
          </Button>
        </div>
      </div>
    </div>
  );
};