import React, { useState, useMemo, useEffect } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { AggregatedData } from '../../../types/reporting';

interface IsolationFilterProps {
  data: AggregatedData;
  segmentBy: string[];
  onIsolationChange: (isolation: IsolationState) => void;
  initialState?: IsolationState;
  className?: string;
}

export interface IsolationState {
  program_id?: string[];
  site_id?: string[];
  submission_id?: string[];
}

interface SegmentOption {
  value: string;
  label: string;
  globalId?: string; // For sites, track global_site_id
}

export const IsolationFilter: React.FC<IsolationFilterProps> = ({
  data,
  segmentBy,
  onIsolationChange,
  initialState,
  className = ''
}) => {
  console.log('🎯 IsolationFilter render - initialState:', initialState);
  console.log('🎯 IsolationFilter render - segmentBy:', segmentBy);
  
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Use initialState directly instead of maintaining local state
  const isolation = initialState || {};

  // Extract unique values for each segment
  const segmentOptions = useMemo(() => {
    const options: Record<string, SegmentOption[]> = {};
    
    // Only log summary, not all data points
    console.log('IsolationFilter - data received:', {
      dataLength: data.data.length,
      segmentBy
    });
    
    segmentBy.forEach(segment => {
      const uniqueValues = new Map<string, SegmentOption>();
      
      data.data.forEach(row => {
        // Look for segment data in metadata (where segments are stored after query processing)
        let value: string = '';
        let displayName: string = '';
        
        // Use human-readable names when available
        if (segment === 'program_id') {
          // Check for nested relationship data from Supabase query
          const programName = row.pilot_programs?.name || 
                            row.segmentMetadata?.program_id_name ||
                            row.metadata?.segment_program_name;
          const programId = row.program_id || 
                          row.segments?.segment_program_id ||
                          row.metadata?.program_id;
          
          // Debug logging for program name resolution
          if (!programName && row.program_id) {
            console.log('IsolationFilter: No program name found for program_id:', row.program_id, {
              'row.pilot_programs': row.pilot_programs,
              'row.segmentMetadata': row.segmentMetadata,
              'row.metadata': row.metadata
            });
          }
          
          if (programName && programName !== 'Unknown' && programName.trim() !== '') {
            displayName = programName;
            value = programId || 'unknown'; // Use program ID for filtering
          } else {
            // Fallback to program ID
            displayName = programId ? `Program ${programId.toString().substring(0, 8)}` : 'Unknown Program';
            value = programId || 'unknown';
          }
        } else if (segment === 'site_id') {
          // Check for nested relationship data from Supabase query
          const siteName = row.sites?.name || 
                         row.segmentMetadata?.site_id_name ||
                         row.metadata?.segment_site_name || 
                         row.metadata?.site_name;
          const siteId = row.site_id || 
                       row.dimensions?.site_id || 
                       row.segments?.segment_site_id ||
                       row.metadata?.site_id;
          
          // Debug logging for site name resolution
          if (!siteName && siteId && data.data.indexOf(row) < 3) {
            console.log('IsolationFilter: No site name found for site_id:', siteId, {
              'row.sites': row.sites,
              'row.segmentMetadata': row.segmentMetadata,
              'row.segmentMetadata.site_id_name': row.segmentMetadata?.site_id_name,
              'row.metadata': row.metadata,
              'full row keys': Object.keys(row),
              'segmentMetadata keys': row.segmentMetadata ? Object.keys(row.segmentMetadata) : []
            });
          }
          
          if (siteName && siteName !== 'Unknown Site' && siteName.trim() !== '') {
            // Use the site name for display
            displayName = siteName;
            value = siteId || siteName; // Use site_id for filtering
          } else if (siteId) {
            // Fallback to showing a shortened site ID if no name available
            displayName = `Site ${siteId.toString().substring(0, 8)}...`;
            value = siteId;
          } else {
            displayName = 'Unknown Site';
            value = 'unknown';
          }
        } else if (segment === 'submission_id') {
          // Check for nested relationship data from Supabase query
          const globalSubmissionId = row.submissions?.global_submission_id ||
                                   row.segmentMetadata?.submission_id_global ||
                                   row.dimensions?.global_submission_id || 
                                   row.metadata?.global_submission_id || 
                                   row.global_submission_id;
          const submissionId = row.submission_id ||
                             row.dimensions?.submission_id || 
                             row.segments?.segment_submission_id ||
                             row.metadata?.submission_id;
          
          // Debug logging
          if (!globalSubmissionId) {
            console.log('IsolationFilter: No global_submission_id found in row:', {
              dimensions: row.dimensions,
              metadata: row.metadata,
              submission_id: submissionId
            });
          }
          
          if (globalSubmissionId) {
            // Use global_submission_id for display with "#" prefix and date
            const createdAt = row.dimensions?.created_at || row.metadata?.created_at || row.created_at || row.submissions?.created_at;
            
            if (createdAt) {
              try {
                const date = new Date(createdAt);
                const prettyDate = date.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
                displayName = `#${globalSubmissionId.toString()} - ${prettyDate}`;
              } catch (e) {
                displayName = `#${globalSubmissionId.toString()}`;
              }
            } else {
              displayName = `#${globalSubmissionId.toString()}`;
            }
            
            value = submissionId || value; // Use submission_id for WHERE clause filtering
          } else {
            // If no global_submission_id, show the submission_id
            displayName = submissionId ? `Submission ${submissionId.toString().substring(0, 8)}` : 'Unknown Submission';
            value = submissionId || 'unknown';
          }
        }
        
        if (value && !uniqueValues.has(value)) {
          // For sites, extract the global ID from the label if needed
          let globalId: string | undefined;
          if (segment === 'site_id') {
            // Extract global ID from format: "Site Name (ID: 123)" if it exists
            const match = String(displayName).match(/\(ID: (\d+)\)/);
            globalId = match ? match[1] : undefined;
          }
          
          // Create a clean label without UUIDs for sites
          let cleanLabel = displayName;
          if (segment === 'site_id' && displayName && String(displayName).includes('(ID:')) {
            cleanLabel = String(displayName).split('(ID:')[0].trim();
          }
          
          uniqueValues.set(value, {
            value,
            label: cleanLabel || value,
            globalId
          });
        }
      });
      
      options[segment] = Array.from(uniqueValues.values()).sort((a, b) => 
        a.label.localeCompare(b.label)
      );
    });
    
    return options;
  }, [data, segmentBy]);

  const handleToggleValue = (segment: string, value: string) => {
    const currentValues = isolation[segment as keyof IsolationState] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    const newIsolation = {
      ...isolation,
      [segment]: newValues.length > 0 ? newValues : undefined
    };
    
    onIsolationChange(newIsolation);
  };

  const handleClearSegment = (segment: string) => {
    const newState = { ...isolation };
    delete newState[segment as keyof IsolationState];
    onIsolationChange(newState);
  };

  const getSegmentLabel = (segment: string): string => {
    switch (segment) {
      case 'program_id':
        return 'Programs';
      case 'site_id':
        return 'Sites';
      case 'submission_id':
        return 'Submissions';
      default:
        return segment;
    }
  };

  const getActiveCount = (segment: string): number => {
    return isolation[segment as keyof IsolationState]?.length || 0;
  };

  if (segmentBy.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Filter className="w-4 h-4" />
        <span>Isolate data by:</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {segmentBy.map(segment => {
          const options = segmentOptions[segment] || [];
          const activeCount = getActiveCount(segment);
          
          return (
            <div key={segment} className="relative">
              <button
                onClick={() => setActiveDropdown(activeDropdown === segment ? null : segment)}
                className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-400 bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{getSegmentLabel(segment)}</span>
                  {activeCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {activeCount} selected
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${
                  activeDropdown === segment ? 'rotate-180' : ''
                }`} />
              </button>
              
              {activeDropdown === segment && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  <div className="p-2">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500">
                        Select {getSegmentLabel(segment).toLowerCase()} to isolate
                      </span>
                      {activeCount > 0 && (
                        <button
                          onClick={() => handleClearSegment(segment)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    
                    <div className="mt-2 space-y-1">
                      {options.map(option => {
                        const isSelected = isolation[segment as keyof IsolationState]?.includes(option.value) || false;
                        
                        return (
                          <button
                            key={option.value}
                            onClick={() => handleToggleValue(segment, option.value)}
                            className={`w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors ${
                              isSelected ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-gray-900">{option.label}</div>
                                {option.globalId && (
                                  <div className="text-xs text-gray-500">
                                    Global ID: {option.globalId}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Active filters summary */}
      {Object.keys(isolation).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {Object.entries(isolation).map(([segment, values]) => 
            values?.map((value: string) => {
              const option = segmentOptions[segment]?.find(o => o.value === value);
              return (
                <div
                  key={`${segment}-${value}`}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  <span className="text-xs font-medium">{getSegmentLabel(segment)}:</span>
                  <span>{option?.label || value}</span>
                  <button
                    onClick={() => handleToggleValue(segment, value)}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
      
      {/* Click outside to close */}
      {activeDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
};