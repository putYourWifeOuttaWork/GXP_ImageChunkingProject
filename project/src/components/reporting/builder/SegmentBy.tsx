import React, { useState, useEffect, useMemo } from 'react';
import { Layers, ChevronDown, X } from 'lucide-react';
import { DataSource } from '../../../types/reporting';

interface SegmentByProps {
  dataSources: DataSource[];
  selectedSegments: string[];
  onSegmentChange: (segments: string[]) => void;
  className?: string;
}

interface SegmentOption {
  value: string;
  label: string;
  table: string;
  description: string;
}

export const SegmentBy: React.FC<SegmentByProps> = ({
  dataSources,
  selectedSegments,
  onSegmentChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Determine available segmentation options based on selected data sources
  const availableSegments = useMemo(() => {
    const segments: SegmentOption[] = [];
    const tableNames = dataSources.map(ds => ds.table);
    
    // Check if we have observations data
    const hasObservations = tableNames.some(t => 
      t.includes('petri_observations') || 
      t.includes('gasifier_observations')
    );
    
    // Only show segmentation options if we have observations
    if (!hasObservations) return segments;
    
    // Check if we're using partitioned tables
    const hasPartitionedTable = tableNames.some(t => t.includes('_partitioned'));
    
    // For partitioned tables, we can always segment by program and site
    // since these columns are directly in the partitioned tables
    if (hasPartitionedTable) {
      segments.push({
        value: 'program_id',
        label: 'Programs',
        table: 'pilot_programs',
        description: 'Group data by pilot program'
      });
      
      segments.push({
        value: 'site_id',
        label: 'Sites',
        table: 'sites',
        description: 'Group data by site location'
      });
    } else {
      // For non-partitioned tables, only show if the related tables are selected
      if (tableNames.includes('pilot_programs')) {
        segments.push({
          value: 'program_id',
          label: 'Programs',
          table: 'pilot_programs',
          description: 'Group data by pilot program'
        });
      }
      
      if (tableNames.includes('sites')) {
        segments.push({
          value: 'site_id',
          label: 'Sites',
          table: 'sites',
          description: 'Group data by site location'
        });
      }
    }
    
    // Submissions can always be segmented if we have observations
    segments.push({
      value: 'submission_id',
      label: 'Submissions',
      table: 'submissions',
      description: 'Group data by submission batch'
    });
    
    // Check for users - only if users is a selected data source
    if (tableNames.includes('users')) {
      segments.push({
        value: 'user_id',
        label: 'Users',
        table: 'users',
        description: 'Group data by user'
      });
    }
    
    return segments;
  }, [dataSources]);

  const handleToggleSegment = (segmentValue: string) => {
    if (selectedSegments.includes(segmentValue)) {
      onSegmentChange(selectedSegments.filter(s => s !== segmentValue));
    } else {
      onSegmentChange([...selectedSegments, segmentValue]);
    }
  };

  const handleRemoveSegment = (segmentValue: string) => {
    onSegmentChange(selectedSegments.filter(s => s !== segmentValue));
  };

  // Don't show if no segmentation options available
  if (availableSegments.length === 0) {
    return null;
  }

  const selectedSegmentLabels = selectedSegments
    .map(s => availableSegments.find(seg => seg.value === s)?.label)
    .filter(Boolean);

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Layers className="w-4 h-4" />
          <span>Segment by:</span>
        </div>
        
        {/* Selected segments */}
        {selectedSegments.length > 0 ? (
          <div className="flex items-center gap-2">
            {selectedSegments.map(segmentValue => {
              const segment = availableSegments.find(s => s.value === segmentValue);
              if (!segment) return null;
              
              return (
                <div
                  key={segmentValue}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  <span>{segment.label}</span>
                  <button
                    onClick={() => handleRemoveSegment(segmentValue)}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            
            {availableSegments.length > selectedSegments.length && (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-1 px-3 py-1 border border-gray-300 hover:border-gray-400 rounded-full text-sm text-gray-700"
              >
                <span>Add</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 hover:border-gray-400 rounded-lg text-sm"
          >
            <span className="text-gray-600">Select dimensions</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 px-3 py-2">
              Available Dimensions
            </div>
            
            {availableSegments.map(segment => (
              <button
                key={segment.value}
                onClick={() => {
                  handleToggleSegment(segment.value);
                  if (selectedSegments.length === availableSegments.length - 1) {
                    setIsOpen(false);
                  }
                }}
                className={`w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors ${
                  selectedSegments.includes(segment.value) ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {segment.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {segment.description}
                    </div>
                  </div>
                  {selectedSegments.includes(segment.value) && (
                    <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          
          <div className="border-t border-gray-100 p-3 bg-gray-50">
            <p className="text-xs text-gray-600">
              Segmenting your data creates hierarchical groupings that make analysis more meaningful.
            </p>
          </div>
        </div>
      )}
      
      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};