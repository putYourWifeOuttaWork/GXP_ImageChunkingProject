import React, { useState, useEffect } from 'react';
import { Plus, Filter, Calendar, Type, Hash, Search, Trash2 } from 'lucide-react';
import Button from '../../common/Button';
import { Filter as FilterType, Dimension, Measure, DataSource } from '../../../types/reporting';
import { ReportingDataService } from '../../../services/reportingDataService';

interface FilterPanelProps {
  filters: FilterType[];
  onAddFilter: (filter: FilterType) => void;
  onRemoveFilter: (id: string) => void;
  dimensions: Dimension[];
  measures: Measure[];
  dataSources: DataSource[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onAddFilter,
  onRemoveFilter,
  dimensions,
  measures,
  dataSources,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [dynamicFilterFields, setDynamicFilterFields] = useState<Array<{ id: string; name: string; displayName: string; dataType: string; source: string; field: string }>>([]);
  const [loadingFilterFields, setLoadingFilterFields] = useState(false);
  const [newFilter, setNewFilter] = useState({
    name: '',
    field: '',
    dataSource: '',
    type: 'text' as const,
    operator: 'equals' as const,
    value: '',
    startValue: '', // For range filters
    endValue: '',   // For range filters
    label: '',
  });

  // Fetch dynamic filter fields when dataSources change
  useEffect(() => {
    const fetchFilterFields = async () => {
      if (dataSources.length === 0) {
        setDynamicFilterFields([]);
        return;
      }
      
      setLoadingFilterFields(true);
      try {
        const fields = await ReportingDataService.getAvailableFilterFields(dataSources);
        setDynamicFilterFields(fields);
        console.log('Dynamic filter fields loaded:', fields.length, 'fields');
      } catch (error) {
        console.error('Error loading dynamic filter fields:', error);
        setDynamicFilterFields([]);
      } finally {
        setLoadingFilterFields(false);
      }
    };
    
    fetchFilterFields();
  }, [dataSources]);

  const filterTypes = [
    { value: 'text', label: 'Text', icon: <Type size={16} /> },
    { value: 'number', label: 'Number', icon: <Hash size={16} /> },
    { value: 'date', label: 'Date', icon: <Calendar size={16} /> },
    { value: 'select', label: 'Select', icon: <Search size={16} /> },
    { value: 'multiselect', label: 'Multi Select', icon: <Search size={16} /> },
    { value: 'range', label: 'Range', icon: <Hash size={16} /> },
    { value: 'daterange', label: 'Date Range', icon: <Calendar size={16} /> },
  ];

  const operatorOptions = {
    text: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'not_contains', label: 'Does Not Contain' },
      { value: 'starts_with', label: 'Starts With' },
      { value: 'ends_with', label: 'Ends With' },
      { value: 'is_empty', label: 'Is Empty' },
      { value: 'is_not_empty', label: 'Is Not Empty' },
    ],
    number: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'greater_than', label: 'Greater Than' },
      { value: 'greater_than_or_equal', label: 'Greater Than or Equal' },
      { value: 'less_than', label: 'Less Than' },
      { value: 'less_than_or_equal', label: 'Less Than or Equal' },
      { value: 'between', label: 'Between' },
      { value: 'not_between', label: 'Not Between' },
    ],
    date: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'greater_than', label: 'After' },
      { value: 'less_than', label: 'Before' },
      { value: 'between', label: 'Between' },
    ],
    select: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'in', label: 'In' },
      { value: 'not_in', label: 'Not In' },
    ],
  };

  const handleAddFilter = () => {
    if (!newFilter.name || !newFilter.field || !newFilter.dataSource) return;

    const isRangeOperator = newFilter.operator === 'between' || newFilter.operator === 'not_between';
    const isDateRange = newFilter.type === 'daterange';
    
    // For range filters, validate that both start and end values are provided
    if ((isRangeOperator || isDateRange) && (!newFilter.startValue || !newFilter.endValue)) {
      alert('Please provide both start and end values for range filters');
      return;
    }

    // Construct the filter value based on type
    let filterValue = newFilter.value;
    if (isRangeOperator || isDateRange) {
      // For range filters, combine start and end values
      filterValue = `${newFilter.startValue},${newFilter.endValue}`;
    }

    const filter: FilterType = {
      id: `filter_${Date.now()}`,
      name: newFilter.name,
      field: newFilter.field,
      dataSource: newFilter.dataSource,
      type: newFilter.type,
      operator: newFilter.operator,
      value: filterValue,
      label: newFilter.label || newFilter.name,
    };

    onAddFilter(filter);
    setNewFilter({ 
      name: '', 
      field: '', 
      dataSource: '', 
      type: 'text', 
      operator: 'equals', 
      value: '', 
      startValue: '', 
      endValue: '', 
      label: '' 
    });
    setShowAddForm(false);
  };

  const handleDimensionSelect = (dimension: Dimension) => {
    const sourceId = (dimension as any).source || dimension.dataSource;
    const dataSource = dataSources.find(ds => ds.id === sourceId);
    if (!dataSource) return;

    setNewFilter(prev => ({
      ...prev,
      name: dimension.displayName || dimension.name,
      field: dimension.field,
      dataSource: sourceId,
      type: getFilterTypeForDataType(dimension.dataType),
      label: dimension.displayName || dimension.name,
    }));
  };

  const handleMeasureSelect = (measure: Measure) => {
    const dataSource = dataSources.find(ds => ds.id === measure.dataSource);
    if (!dataSource) return;

    setNewFilter(prev => ({
      ...prev,
      name: measure.name,
      field: measure.field,
      dataSource: measure.dataSource,
      type: 'number',
      label: measure.displayName || measure.name,
    }));
  };

  const getFilterTypeForDataType = (dataType: string): 'text' | 'number' | 'date' | 'select' => {
    switch (dataType) {
      case 'numeric':
      case 'integer':
      case 'number':
        return 'number';
      case 'date':
      case 'timestamp':
        return 'date';
      case 'boolean':
        return 'select';
      default:
        return 'text';
    }
  };

  const handleRemoveFilter = (filterId: string, filterName: string) => {
    const confirmed = window.confirm(`Are you sure you want to remove filter "${filterName}"?`);
    if (confirmed) {
      onRemoveFilter(filterId);
    }
  };

  const getIconForFilterType = (type: string) => {
    switch (type) {
      case 'number':
      case 'range':
        return <Hash size={16} className="text-blue-500" />;
      case 'date':
      case 'daterange':
        return <Calendar size={16} className="text-green-500" />;
      case 'select':
      case 'multiselect':
        return <Search size={16} className="text-purple-500" />;
      default:
        return <Type size={16} className="text-gray-500" />;
    }
  };

  // Organize dynamic filter fields by data source for the dropdown
  const getOrganizedFilterFields = () => {
    const fieldsByDataSource: Record<string, Array<{ field: string; displayName: string; dataType: string; type: string }>> = {};
    
    dynamicFilterFields.forEach(field => {
      const dataSource = dataSources.find(ds => ds.id === field.source);
      if (dataSource) {
        if (!fieldsByDataSource[dataSource.name]) {
          fieldsByDataSource[dataSource.name] = [];
        }
        fieldsByDataSource[dataSource.name].push({
          field: field.field,
          displayName: field.displayName,
          dataType: field.dataType,
          type: 'column'
        });
      }
    });
    
    return fieldsByDataSource;
  };

  const organizedFilterFields = getOrganizedFilterFields();

  // Update field selection logic for dynamic fields
  const handleDynamicFieldSelect = (fieldInfo: string) => {
    const [dataSourceName, fieldName] = fieldInfo.split('.');
    const dataSource = dataSources.find(ds => ds.name === dataSourceName);
    if (!dataSource) return;
    
    const field = dynamicFilterFields.find(f => f.source === dataSource.id && f.field === fieldName);
    if (!field) return;
    
    setNewFilter(prev => ({
      ...prev,
      field: fieldName,
      dataSource: dataSource.id,
      type: getFilterTypeForDataType(field.dataType),
      name: prev.name || field.displayName.replace(` (${dataSource.name})`, ''),
      label: prev.label || field.displayName.replace(` (${dataSource.name})`, '')
    }));
  };

  const renderValueInput = () => {
    const isRangeOperator = newFilter.operator === 'between' || newFilter.operator === 'not_between';
    const isDateRange = newFilter.type === 'daterange';
    
    // Handle date range type or range operators
    if (isDateRange || (newFilter.type === 'date' && isRangeOperator)) {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={newFilter.startValue}
              onChange={(e) => setNewFilter(prev => ({ ...prev, startValue: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={newFilter.endValue}
              onChange={(e) => {
                const endDate = e.target.value;
                const startDate = newFilter.startValue;
                
                // Validate that end date is after start date
                if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
                  alert('End date must be after start date');
                  return;
                }
                
                setNewFilter(prev => ({ ...prev, endValue: endDate }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          {newFilter.startValue && newFilter.endValue && (
            <div className="text-sm text-gray-600">
              Duration: {Math.ceil((new Date(newFilter.endValue).getTime() - new Date(newFilter.startValue).getTime()) / (1000 * 60 * 60 * 24))} days
            </div>
          )}
        </div>
      );
    }
    
    // Handle number range
    if (newFilter.type === 'number' && isRangeOperator) {
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="number"
              value={newFilter.startValue}
              onChange={(e) => setNewFilter(prev => ({ ...prev, startValue: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Min value"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="number"
              value={newFilter.endValue}
              onChange={(e) => {
                const endValue = parseFloat(e.target.value);
                const startValue = parseFloat(newFilter.startValue);
                
                // Validate that end value is greater than start value
                if (!isNaN(startValue) && !isNaN(endValue) && endValue < startValue) {
                  alert('End value must be greater than start value');
                  return;
                }
                
                setNewFilter(prev => ({ ...prev, endValue: e.target.value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Max value"
            />
          </div>
        </div>
      );
    }

    // Regular single value inputs
    switch (newFilter.type) {
      case 'number':
        return (
          <input
            type="number"
            value={newFilter.value}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter number"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={newFilter.value}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        );
      case 'select':
        return (
          <select
            value={newFilter.value}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select value...</option>
            {/* Add options based on field type */}
            {newFilter.field === 'weather' && (
              <>
                <option value="Clear">Clear</option>
                <option value="Cloudy">Cloudy</option>
                <option value="Rain">Rain</option>
              </>
            )}
            {newFilter.field === 'fungicide_used' && (
              <>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </>
            )}
          </select>
        );
      default:
        return (
          <input
            type="text"
            value={newFilter.value}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter text"
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
        <p className="text-sm text-gray-600 mb-6">
          Filters help you narrow down your data to focus on specific subsets. Add filters to refine your analysis.
        </p>
      </div>

      {/* Applied Filters */}
      {filters.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Applied Filters</h4>
          <div className="space-y-2">
            {filters.map((filter) => (
              <div
                key={filter.id}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center">
                  {getIconForFilterType(filter.type)}
                  <div className="ml-3">
                    <h5 className="font-medium text-gray-900">{filter.label || filter.name}</h5>
                    <p className="text-sm text-gray-600">
                      {filter.field} {filter.operator} {filter.value}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                    {filter.type}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={() => handleRemoveFilter(filter.id, filter.label || filter.name)}
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

      {/* Add New Filter */}
      {!showAddForm ? (
        <Button
          variant="outline"
          icon={<Plus size={16} />}
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          Add Filter
        </Button>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Add New Filter</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>

          <div className="space-y-4">
            {/* Quick Add from Dimensions */}
            {dimensions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add from Dimensions
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {dimensions.map((dimension) => (
                    <div
                      key={dimension.id}
                      className="p-2 border border-gray-200 rounded cursor-pointer hover:border-gray-300 transition-colors"
                      onClick={() => handleDimensionSelect(dimension)}
                    >
                      <div className="flex items-center">
                        {getIconForFilterType(getFilterTypeForDataType(dimension.dataType))}
                        <div className="ml-3">
                          <h6 className="font-medium text-gray-900">{dimension.displayName || dimension.name}</h6>
                          <p className="text-sm text-gray-600">{dimension.field}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Add from Measures */}
            {measures.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add from Measures
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {measures.map((measure) => (
                    <div
                      key={measure.id}
                      className="p-2 border border-gray-200 rounded cursor-pointer hover:border-gray-300 transition-colors"
                      onClick={() => handleMeasureSelect(measure)}
                    >
                      <div className="flex items-center">
                        <Hash size={16} className="text-blue-500" />
                        <div className="ml-3">
                          <h6 className="font-medium text-gray-900">{measure.displayName || measure.name}</h6>
                          <p className="text-sm text-gray-600">{measure.aggregation}({measure.field})</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Configuration */}
            <div className="border-t pt-4">
              <h5 className="text-sm font-medium text-gray-700 mb-3">Filter by Any Column</h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field * {loadingFilterFields && <span className="text-gray-500">(Loading...)</span>}
                  </label>
                  <select
                    value={newFilter.field && newFilter.dataSource ? `${dataSources.find(ds => ds.id === newFilter.dataSource)?.name}.${newFilter.field}` : ''}
                    onChange={(e) => handleDynamicFieldSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={loadingFilterFields || dynamicFilterFields.length === 0}
                  >
                    <option value="">
                      {loadingFilterFields 
                        ? 'Loading available fields...' 
                        : dynamicFilterFields.length === 0 
                        ? 'No fields available' 
                        : 'Select any column to filter by...'}
                    </option>
                    {Object.entries(organizedFilterFields).map(([dataSourceName, fields]) => (
                      <optgroup key={dataSourceName} label={`${dataSourceName} (${fields.length} columns)`}>
                        {fields.map(field => (
                          <option key={`${dataSourceName}.${field.field}`} value={`${dataSourceName}.${field.field}`}>
                            {field.field} - {field.displayName.replace(` (${dataSourceName})`, '')}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {dynamicFilterFields.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Showing {dynamicFilterFields.length} columns from {dataSources.length} selected table(s)
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter Name
                  </label>
                  <input
                    type="text"
                    value={newFilter.name}
                    onChange={(e) => setNewFilter(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter filter name (auto-filled from field)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter Type
                    </label>
                    <select
                      value={newFilter.type}
                      onChange={(e) => setNewFilter(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {filterTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Operator
                    </label>
                    <select
                      value={newFilter.operator}
                      onChange={(e) => setNewFilter(prev => ({ ...prev, operator: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {(operatorOptions[newFilter.type] || operatorOptions.text).map(op => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value
                  </label>
                  {renderValueInput()}
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
                onClick={handleAddFilter}
                disabled={!newFilter.name || !newFilter.field || !newFilter.dataSource}
              >
                Add Filter
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Filter size={20} className="text-blue-600 mr-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">Filter Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Filters are applied before aggregation</li>
              <li>• Use date filters for time-based analysis</li>
              <li>• Combine multiple filters for precise results</li>
              <li>• Text filters support wildcards and regex</li>
              <li>• Numeric filters enable range analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};