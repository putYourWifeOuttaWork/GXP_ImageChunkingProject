import React, { useState, useEffect } from 'react';
import { ChevronRight, Zap, TrendingUp, Filter } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Filter as FilterType } from '../../../types/reporting/reportTypes';

interface SmartFilterSuggestionsProps {
  currentFilters: FilterType[];
  dataSources: any[];
  onAddFilter: (filter: FilterType) => void;
  className?: string;
}

interface FilterSuggestion {
  type: 'program' | 'site' | 'date' | 'submission';
  speedup: string;
  label: string;
  description: string;
  filter: Partial<FilterType>;
  priority: number;
}

export const SmartFilterSuggestions: React.FC<SmartFilterSuggestionsProps> = ({
  currentFilters,
  dataSources,
  onAddFilter,
  className = ''
}) => {
  const [suggestions, setSuggestions] = useState<FilterSuggestion[]>([]);
  const [recentPrograms, setRecentPrograms] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [performanceLevel, setPerformanceLevel] = useState<'slow' | 'moderate' | 'fast' | 'optimal'>('slow');

  useEffect(() => {
    analyzeSuggestionsAndPerformance();
    loadRecentPrograms();
  }, [currentFilters]);

  const loadRecentPrograms = async () => {
    // Load user's recent programs based on their activity
    const { data } = await supabase
      .from('pilot_programs')
      .select('program_id, name')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) {
      setRecentPrograms(data);
    }
  };

  const analyzeSuggestionsAndPerformance = () => {
    const newSuggestions: FilterSuggestion[] = [];
    
    // Check current filter state
    const hasProgramFilter = currentFilters.some(f => f.field === 'program_id');
    const hasSiteFilter = currentFilters.some(f => f.field === 'site_id');
    const hasDateFilter = currentFilters.some(f => f.field === 'created_at' || f.field === 'date_range');
    
    // Determine performance level
    if (hasProgramFilter && hasSiteFilter && hasDateFilter) {
      setPerformanceLevel('optimal');
    } else if (hasProgramFilter && (hasSiteFilter || hasDateFilter)) {
      setPerformanceLevel('fast');
    } else if (hasProgramFilter) {
      setPerformanceLevel('moderate');
    } else {
      setPerformanceLevel('slow');
    }
    
    // Generate suggestions based on what's missing
    if (!hasProgramFilter) {
      newSuggestions.push({
        type: 'program',
        speedup: '10-50x faster',
        label: 'Add Program Filter',
        description: 'Filtering by program enables partition optimization',
        filter: {
          field: 'program_id',
          operator: 'equals',
          type: 'text'
        },
        priority: 1
      });
    }
    
    if (hasProgramFilter && !hasSiteFilter) {
      newSuggestions.push({
        type: 'site',
        speedup: '2-5x faster',
        label: 'Add Site Filter',
        description: 'Further narrow your results by site',
        filter: {
          field: 'site_id',
          operator: 'equals',
          type: 'text'
        },
        priority: 2
      });
    }
    
    if (!hasDateFilter) {
      newSuggestions.push({
        type: 'date',
        speedup: '2-10x faster',
        label: 'Add Date Range',
        description: 'Recent data queries are much faster',
        filter: {
          field: 'created_at',
          operator: 'greater_than',
          type: 'date',
          value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        priority: 3
      });
    }
    
    setSuggestions(newSuggestions.sort((a, b) => a.priority - b.priority));
  };

  const getPerformanceIcon = () => {
    const icons = {
      slow: <div className="w-2 h-2 bg-red-500 rounded-full" />,
      moderate: <div className="w-2 h-2 bg-yellow-500 rounded-full" />,
      fast: <div className="w-2 h-2 bg-blue-500 rounded-full" />,
      optimal: <div className="w-2 h-2 bg-green-500 rounded-full" />
    };
    return icons[performanceLevel];
  };

  const getPerformanceMessage = () => {
    const messages = {
      slow: 'Query will scan entire table',
      moderate: 'Using partition optimization',
      fast: 'Highly optimized query',
      optimal: 'Maximum performance'
    };
    return messages[performanceLevel];
  };

  if (suggestions.length === 0 && performanceLevel === 'optimal') {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-600 ${className}`}>
        <Zap className="w-4 h-4" />
        <span>Query fully optimized!</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Inline performance indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          {getPerformanceIcon()}
          <span className="text-gray-600">{getPerformanceMessage()}</span>
        </div>
        
        {suggestions.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <TrendingUp className="w-3 h-3" />
            Optimize ({suggestions.length})
          </button>
        )}
      </div>

      {/* Expandable suggestions */}
      {isExpanded && suggestions.length > 0 && (
        <div className="mt-3 space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs font-medium text-blue-900 mb-2">
            Speed up your query:
          </div>
          
          {suggestions.map((suggestion, index) => (
            <div key={index} className="group">
              <div className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {suggestion.label}
                    </span>
                    <span className="text-xs text-green-600 font-medium">
                      {suggestion.speedup}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {suggestion.description}
                  </p>
                  
                  {/* Quick add buttons for program filter */}
                  {suggestion.type === 'program' && recentPrograms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {recentPrograms.slice(0, 3).map(program => (
                        <button
                          key={program.program_id}
                          onClick={() => {
                            onAddFilter({
                              id: `filter_${Date.now()}`,
                              field: 'program_id',
                              operator: 'equals',
                              value: program.program_id,
                              type: 'text',
                              name: 'Program',
                              label: program.name,
                              dataSource: dataSources[0]?.id
                            } as FilterType);
                            setIsExpanded(false);
                          }}
                          className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
                        >
                          {program.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};