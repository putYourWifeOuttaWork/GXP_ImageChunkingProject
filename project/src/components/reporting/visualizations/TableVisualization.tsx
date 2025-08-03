import React, { useState, useMemo } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  Search, 
  Filter, 
  Download, 
  Settings,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AggregatedData, VisualizationSettings } from '../../../types/reporting';

interface TableVisualizationProps {
  data: AggregatedData;
  settings: VisualizationSettings;
  className?: string;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export const TableVisualization: React.FC<TableVisualizationProps> = ({
  data,
  settings,
  className = ''
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Extract columns from data
  const columns = useMemo(() => {
    if (!data.data || data.data.length === 0) return [];
    
    const firstRow = data.data[0];
    const cols: Array<{key: string, label: string, type: 'dimension' | 'measure'}> = [];
    
    // Add dimension columns
    Object.keys(firstRow.dimensions || {}).forEach(key => {
      cols.push({
        key: `dimensions.${key}`,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        type: 'dimension'
      });
    });
    
    // Add measure columns
    Object.keys(firstRow.measures || {}).forEach(key => {
      cols.push({
        key: `measures.${key}`,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        type: 'measure'
      });
    });
    
    return cols;
  }, [data.data]);

  // Helper function to get nested value
  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  // Sort and filter data
  const processedData = useMemo(() => {
    if (!data.data) return [];
    
    let filteredData = [...data.data];
    
    // Apply search filter
    if (searchTerm) {
      filteredData = filteredData.filter(row => {
        const searchableText = [
          ...Object.values(row.dimensions || {}),
          ...Object.values(row.measures || {})
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchTerm.toLowerCase());
      });
    }
    
    // Apply sorting
    if (sortConfig) {
      filteredData.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filteredData;
  }, [data.data, searchTerm, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = processedData.slice(startIndex, startIndex + pageSize);

  // Handle sorting
  const handleSort = (column: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig?.key === column && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key: column, direction });
  };

  // Format cell value
  const formatCellValue = (value: any, type: 'dimension' | 'measure') => {
    if (value === null || value === undefined) return '-';
    
    if (type === 'measure' && typeof value === 'number') {
      return value.toLocaleString();
    }
    
    if (type === 'dimension' && value instanceof Date) {
      return value.toLocaleDateString();
    }
    
    return String(value);
  };

  // Handle export
  const handleExport = () => {
    const csvContent = [
      // Header row
      columns.map(col => col.label).join(','),
      // Data rows
      ...processedData.map(row => 
        columns.map(col => {
          const value = getNestedValue(row, col.key);
          return formatCellValue(value, col.type);
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'table_data.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!data.data || data.data.length === 0) {
    return (
      <div className={`p-8 text-center text-gray-500 ${className}`}>
        <div className="text-lg mb-2">No data available</div>
        <div className="text-sm">Please check your data source and filters</div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Table Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search table..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {processedData.length} rows
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    <div className="flex flex-col">
                      <ChevronUp 
                        size={12} 
                        className={`${
                          sortConfig?.key === column.key && sortConfig.direction === 'asc' 
                            ? 'text-blue-600' 
                            : 'text-gray-400'
                        }`} 
                      />
                      <ChevronDown 
                        size={12} 
                        className={`${
                          sortConfig?.key === column.key && sortConfig.direction === 'desc' 
                            ? 'text-blue-600' 
                            : 'text-gray-400'
                        }`} 
                      />
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      column.type === 'measure' 
                        ? 'text-right font-medium text-gray-900' 
                        : 'text-left text-gray-900'
                    }`}
                  >
                    {formatCellValue(getNestedValue(row, column.key), column.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, processedData.length)} of {processedData.length} results
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
            </button>
            
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableVisualization;