import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Eye, Download, Filter } from 'lucide-react';
import { ImagePreviewModal } from '../../common/ImagePreviewModal';

interface DataPoint {
  dimensions: Record<string, any>;
  measures: Record<string, any>;
  metadata?: {
    observation_id?: string;
    submission_id?: string;
    site_id?: string;
    program_id?: string;
    petri_code?: string;
    gasifier_code?: string;
    created_at?: string;
    image_url?: string;
    placement?: string;
    fungicide_used?: string;
    petri_growth_stage?: string;
    x_position?: number;
    y_position?: number;
    growth_index?: number;
    todays_day_of_phase?: number;
    daysinthisprogramphase?: number;
    // Related table data from JOINs
    program_name?: string;
    site_name?: string;
    global_submission_id?: number;
  };
}

interface DataViewerProps {
  data: DataPoint[];
  isVisible: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  title: string;
  config: {
    dimensions: Array<{ field: string; displayName: string; dataType: string }>;
    measures: Array<{ field: string; displayName: string; aggregation?: string }>;
  };
  brushSelection?: [[number, number], [number, number]];
}

export const DataViewer: React.FC<DataViewerProps> = ({
  data,
  isVisible,
  onClose,
  position,
  title,
  config,
  brushSelection
}) => {
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState('');
  const [selectedTab, setSelectedTab] = useState<'table' | 'summary'>('table');
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageModalData, setImageModalData] = useState<any[]>([]);
  const [imageModalStartIndex, setImageModalStartIndex] = useState(0);

  // Helper function to construct drill-down URLs
  const constructDrillDownUrl = (row: DataPoint): string | null => {
    // Get properties from metadata first, then fallback to direct row properties
    const submissionId = row.metadata?.submission_id || (row as any).submission_id;
    const siteId = row.metadata?.site_id || (row as any).site_id;
    const programId = row.metadata?.program_id || (row as any).program_id;

    // For observation records: /programs/{program_id}/sites/{site_id}/submissions/{submission_id}/edit
    if (submissionId && siteId && programId) {
      return `/programs/${programId}/sites/${siteId}/submissions/${submissionId}/edit`;
    }
    
    // For site records: /programs/{program_id}/sites/{site_id}
    if (siteId && programId) {
      return `/programs/${programId}/sites/${siteId}`;
    }
    
    // For program records: /programs/{program_id}
    if (programId) {
      return `/programs/${programId}`;
    }
    
    return null;
  };

  // Helper function to handle image preview - now supports multiple images!
  const handleImagePreview = (clickedRow: DataPoint) => {
    console.log('🔍 Handling image preview for:', { 
      clickedRow, 
      totalData: data.length,
      clickedRowImageUrl: clickedRow.metadata?.image_url || (clickedRow as any).image_url
    });
    
    // Create image data array from ALL available data (for carousel functionality)
    const imageData = data.map((row, index) => {
      // Get properties from metadata first, then fallback to direct row properties
      const imageUrl = row.metadata?.image_url || (row as any).image_url;
      const petriCode = row.metadata?.petri_code || (row as any).petri_code;
      const gasifierCode = row.metadata?.gasifier_code || (row as any).gasifier_code;
      const createdAt = row.metadata?.created_at || (row as any).created_at;
      const placement = row.metadata?.placement || (row as any).placement;
      const observationId = row.metadata?.observation_id || (row as any).observation_id;
      const programName = row.metadata?.program_name || (row as any).program_name || 
                        row.pilot_programs?.name || row.segmentMetadata?.program_id_name;
      const siteName = row.metadata?.site_name || (row as any).site_name ||
                     row.sites?.name || row.segmentMetadata?.site_id_name;
      const globalSubmissionId = row.metadata?.global_submission_id || (row as any).global_submission_id ||
                               row.submissions?.global_submission_id;

      // Determine the observation type
      const observationType = petriCode ? 'petri' : gasifierCode ? 'gasifier' : 'unknown';
      
      console.log(`📸 Row ${index}:`, {
        imageUrl: imageUrl?.substring(0, 60) + '...',
        petriCode,
        gasifierCode,
        hasImage: !!imageUrl
      });
      
      return {
        url: imageUrl || null,
        metadata: {
          petri_code: petriCode,
          gasifier_code: gasifierCode,
          created_at: createdAt,
          placement: placement,
          observation_id: observationId,
          type: observationType as 'petri' | 'gasifier',
          program_name: programName,
          site_name: siteName,
          global_submission_id: globalSubmissionId,
          row_index: index, // Track which row this image belongs to
          growth_index: row.measures?.growth_index || (row as any).growth_index,
          // Add additional context for carousel navigation
          dimensions: row.dimensions,
          measures: row.measures
        }
      };
    });

    // Filter to only include records that have images
    const filteredImageData = imageData.filter(item => item.url);
    
    console.log('🎠 Image carousel data:', { 
      totalRecords: data.length,
      totalImages: filteredImageData.length,
      allImageUrls: imageData.map((img, i) => `${i}: ${img.url ? 'HAS_IMAGE' : 'NO_IMAGE'}`),
      filteredImageUrls: filteredImageData.map((img, i) => `${i}: ${img.url?.substring(0, 50)}...`)
    });

    // Find the index of the clicked row to start the carousel at the right position
    const clickedRowImageUrl = clickedRow.metadata?.image_url || (clickedRow as any).image_url;
    const startIndex = filteredImageData.findIndex(img => img.url === clickedRowImageUrl);
    
    console.log('🎯 Starting carousel:', {
      clickedRowImageUrl: clickedRowImageUrl?.substring(0, 50) + '...',
      startIndex,
      totalFilteredImages: filteredImageData.length
    });
    
    setImageModalData(filteredImageData);
    setImageModalStartIndex(Math.max(0, startIndex)); // Ensure non-negative index
    setImageModalVisible(true);
  };

  // Filter data based on search text
  const filteredData = data.filter(row => {
    if (!filterText) return true;
    
    const searchText = filterText.toLowerCase();
    
    // Search in dimensions
    const dimensionMatch = Object.values(row.dimensions).some(value => 
      String(value).toLowerCase().includes(searchText)
    );
    
    // Search in measures
    const measureMatch = Object.values(row.measures).some(value => 
      String(value).toLowerCase().includes(searchText)
    );
    
    // Search in metadata
    const metadataMatch = row.metadata ? Object.values(row.metadata).some(value => 
      String(value).toLowerCase().includes(searchText)
    ) : false;
    
    return dimensionMatch || measureMatch || metadataMatch;
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortField) return 0;
    
    let aValue = a.dimensions[sortField] || a.measures[sortField] || a.metadata?.[sortField as keyof typeof a.metadata];
    let bValue = b.dimensions[sortField] || b.measures[sortField] || b.metadata?.[sortField as keyof typeof b.metadata];
    
    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
    if (bValue == null) return sortDirection === 'asc' ? -1 : 1;
    
    // Convert to numbers if both are numeric
    const aNum = Number(aValue);
    const bNum = Number(bValue);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    // String comparison
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    if (sortDirection === 'asc') {
      return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
    } else {
      return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
    }
  });

  // Calculate summary statistics
  const summary = {
    totalRecords: data.length,
    filteredRecords: filteredData.length,
    uniqueValues: {} as Record<string, number>,
    measureStats: {} as Record<string, { min: number; max: number; avg: number; count: number }>
  };

  // Calculate unique values for dimensions
  config.dimensions.forEach(dim => {
    const uniqueVals = new Set(data.map(row => row.dimensions[dim.field]).filter(v => v != null));
    summary.uniqueValues[dim.field] = uniqueVals.size;
  });

  // Calculate measure statistics
  config.measures.forEach(measure => {
    const values = data.map(row => row.measures[measure.field])
      .filter(v => v != null && !isNaN(Number(v)))
      .map(v => Number(v));
    
    if (values.length > 0) {
      summary.measureStats[measure.field] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        count: values.length
      };
    }
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatValue = (value: any, dataType?: string) => {
    if (value == null) return '-';
    
    // Check if it's a date string (YYYY-MM-DD format)
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      const date = new Date(value);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear().toString().slice(-2);
      
      // If it includes time, show it
      if (value.includes('T') || dataType === 'timestamp') {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');
        return `${month}/${day}/${year} ${displayHours}:${displayMinutes} ${ampm}`;
      }
      
      // Otherwise just show the date
      return `${month}/${day}/${year}`;
    }
    
    if (typeof value === 'number') {
      return dataType === 'numeric' ? value.toFixed(2) : value.toString();
    }
    
    return String(value);
  };

  const handleRecordAction = (action: string, row: DataPoint) => {
    switch (action) {
      case 'external_link':
        const url = constructDrillDownUrl(row);
        if (url) {
          window.open(url, '_blank');
        }
        break;
      case 'preview':
        handleImagePreview(row);
        break;
    }
  };

  // Center the modal in the viewport regardless of brush position
  const getCenterPosition = () => {
    const viewerWidth = 550;
    const viewerHeight = Math.min(500, window.innerHeight * 0.8); // Max 80% of viewport height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Center horizontally and vertically in viewport
    const x = Math.max(20, (viewportWidth - viewerWidth) / 2);
    const y = Math.max(20, (viewportHeight - viewerHeight) / 2);
    
    return { x, y, width: viewerWidth, height: viewerHeight };
  };
  
  const centerPosition = getCenterPosition();
  
  const viewerStyle = {
    position: 'fixed' as const,
    left: centerPosition.x,
    top: centerPosition.y,
    width: centerPosition.width,
    maxHeight: centerPosition.height,
    zIndex: 1000,
  };

  // Handle click outside to close
  useEffect(() => {
    if (!isVisible) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const modal = document.querySelector('[data-modal="data-viewer"]');
      
      if (modal && !modal.contains(target)) {
        onClose();
      }
    };
    
    // Add event listener after a brief delay to prevent immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);
  
  // Early return after all hooks
  if (!isVisible || !data.length) return null;
  
  return (
    <div 
      data-modal="data-viewer"
      style={viewerStyle}
      className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">
            {filteredData.length} of {data.length} records
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => setSelectedTab('table')}
          className={`px-4 py-2 text-sm font-medium ${
            selectedTab === 'table' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Data Table
        </button>
        <button
          onClick={() => setSelectedTab('summary')}
          className={`px-4 py-2 text-sm font-medium ${
            selectedTab === 'summary' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Summary
        </button>
      </div>

      {/* Search/Filter */}
      <div className="p-3 border-b border-gray-200 flex-shrink-0">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search data..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Content - Scrollable Area */}
      <div className="flex-1 overflow-auto min-h-0">
        {selectedTab === 'table' ? (
          <div className="min-w-full">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {/* Dimension columns */}
                  {config.dimensions.map(dim => (
                    <th
                      key={dim.field}
                      onClick={() => handleSort(dim.field)}
                      className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center space-x-1">
                        <span>{dim.displayName}</span>
                        {sortField === dim.field && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  
                  {/* Measure columns */}
                  {config.measures.map(measure => (
                    <th
                      key={measure.field}
                      onClick={() => handleSort(measure.field)}
                      className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center space-x-1">
                        <span>{measure.displayName}</span>
                        {sortField === measure.field && (
                          <span className="text-blue-600">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {/* Dimension cells */}
                    {config.dimensions.map(dim => (
                      <td key={dim.field} className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {formatValue(row.dimensions[dim.field], dim.dataType)}
                      </td>
                    ))}
                    
                    {/* Measure cells */}
                    {config.measures.map(measure => (
                      <td key={measure.field} className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {formatValue(row.measures[measure.field], 'numeric')}
                      </td>
                    ))}
                    
                    {/* Actions */}
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      <div className="flex space-x-2">
                        {constructDrillDownUrl(row) && (
                          <button
                            onClick={() => handleRecordAction('external_link', row)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Open in New Tab"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleRecordAction('preview', row)}
                          className="text-green-600 hover:text-green-800"
                          title="Preview Image"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Summary Statistics */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Data Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Records:</span>
                  <span className="ml-2 font-medium">{summary.totalRecords}</span>
                </div>
                <div>
                  <span className="text-gray-600">Filtered Records:</span>
                  <span className="ml-2 font-medium">{summary.filteredRecords}</span>
                </div>
              </div>
            </div>

            {/* Dimension Summary */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Dimensions</h4>
              <div className="space-y-2 text-sm">
                {config.dimensions.map(dim => (
                  <div key={dim.field} className="flex justify-between">
                    <span className="text-gray-600">{dim.displayName}:</span>
                    <span className="font-medium">{summary.uniqueValues[dim.field]} unique values</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Measure Statistics */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Measures</h4>
              <div className="space-y-3 text-sm">
                {config.measures.map(measure => {
                  const stats = summary.measureStats[measure.field];
                  if (!stats) return null;
                  
                  return (
                    <div key={measure.field} className="border border-gray-200 rounded p-3">
                      <h5 className="font-medium text-gray-900 mb-2">{measure.displayName}</h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>Min: <span className="font-medium">{stats.min.toFixed(2)}</span></div>
                        <div>Max: <span className="font-medium">{stats.max.toFixed(2)}</span></div>
                        <div>Avg: <span className="font-medium">{stats.avg.toFixed(2)}</span></div>
                        <div>Count: <span className="font-medium">{stats.count}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-xs text-gray-600 flex-shrink-0">
        <span>Click and drag to select data range</span>
        <button className="flex items-center space-x-1 text-blue-600 hover:text-blue-800">
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isVisible={imageModalVisible}
        onClose={() => setImageModalVisible(false)}
        images={imageModalData}
        title={config.measures.length > 0 ? config.measures[0].displayName : "Observation Image Preview"}
        initialIndex={imageModalStartIndex}
      />
    </div>
  );
};