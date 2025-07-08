import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Filter, 
  FilterGroup, 
  FilterSet, 
  FilterState, 
  FilterAction as FilterActionType,
  FilterResult,
  FilterSuggestion,
  FilterAnalytics
} from '../../types/reporting';
import { supabase } from '../../lib/supabaseClient';

// Hook for managing filter state
export const useReportFilters = (reportId?: string) => {
  const [filterState, setFilterState] = useState<FilterState>({
    filters: [],
    groups: [],
    activeFilters: [],
    appliedFilters: [],
    errors: [],
    warnings: [],
    isLoading: false,
    lastApplied: '',
    isDirty: false,
  });

  const queryClient = useQueryClient();

  // Filter actions
  const dispatch = useCallback((action: FilterActionType) => {
    setFilterState(prevState => {
      switch (action.type) {
        case 'ADD_FILTER':
          return {
            ...prevState,
            filters: [...prevState.filters, action.payload],
            isDirty: true,
          };

        case 'UPDATE_FILTER':
          return {
            ...prevState,
            filters: prevState.filters.map(filter =>
              filter.id === action.payload.id
                ? { ...filter, ...action.payload.updates }
                : filter
            ),
            isDirty: true,
          };

        case 'REMOVE_FILTER':
          return {
            ...prevState,
            filters: prevState.filters.filter(filter => filter.id !== action.payload),
            activeFilters: prevState.activeFilters.filter(id => id !== action.payload),
            appliedFilters: prevState.appliedFilters.filter(id => id !== action.payload),
            isDirty: true,
          };

        case 'APPLY_FILTERS':
          return {
            ...prevState,
            appliedFilters: action.payload,
            lastApplied: new Date().toISOString(),
            isDirty: false,
          };

        case 'CLEAR_FILTERS':
          return {
            ...prevState,
            activeFilters: [],
            appliedFilters: [],
            isDirty: false,
          };

        case 'LOAD_FILTER_SET':
          return {
            ...prevState,
            filters: action.payload.filters,
            groups: action.payload.groups,
            activeFilters: action.payload.filters.map(f => f.id),
            isDirty: false,
          };

        case 'SAVE_FILTER_SET':
          // Handle saving filter set
          return prevState;

        case 'SET_ERROR':
          return {
            ...prevState,
            errors: [...prevState.errors, action.payload],
          };

        case 'CLEAR_ERROR':
          return {
            ...prevState,
            errors: prevState.errors.filter(error => error.filterId !== action.payload),
          };

        case 'SET_LOADING':
          return {
            ...prevState,
            isLoading: action.payload,
          };

        default:
          return prevState;
      }
    });
  }, []);

  // Add filter
  const addFilter = useCallback((filter: Filter) => {
    dispatch({ type: 'ADD_FILTER', payload: filter });
  }, [dispatch]);

  // Update filter
  const updateFilter = useCallback((id: string, updates: Partial<Filter>) => {
    dispatch({ type: 'UPDATE_FILTER', payload: { id, updates } });
  }, [dispatch]);

  // Remove filter
  const removeFilter = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FILTER', payload: id });
  }, [dispatch]);

  // Apply filters
  const applyFilters = useCallback(async (filterIds: string[]) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const filtersToApply = filterState.filters.filter(f => filterIds.includes(f.id));
      
      // Validate filters
      const errors: any[] = [];
      for (const filter of filtersToApply) {
        if (filter.validation?.required && !filter.value) {
          errors.push({
            filterId: filter.id,
            message: `${filter.label || filter.name} is required`,
            type: 'validation',
          });
        }
      }

      if (errors.length > 0) {
        errors.forEach(error => {
          dispatch({ type: 'SET_ERROR', payload: error });
        });
        return;
      }

      // Apply filters
      dispatch({ type: 'APPLY_FILTERS', payload: filterIds });
      
      // Invalidate related queries
      if (reportId) {
        queryClient.invalidateQueries({ queryKey: ['report-data', reportId] });
      }
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [filterState.filters, dispatch, reportId, queryClient]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
    
    if (reportId) {
      queryClient.invalidateQueries({ queryKey: ['report-data', reportId] });
    }
  }, [dispatch, reportId, queryClient]);

  // Get filter by ID
  const getFilter = useCallback((id: string) => {
    return filterState.filters.find(f => f.id === id);
  }, [filterState.filters]);

  // Get active filters
  const getActiveFilters = useCallback(() => {
    return filterState.filters.filter(f => filterState.activeFilters.includes(f.id));
  }, [filterState.filters, filterState.activeFilters]);

  // Get applied filters
  const getAppliedFilters = useCallback(() => {
    return filterState.filters.filter(f => filterState.appliedFilters.includes(f.id));
  }, [filterState.filters, filterState.appliedFilters]);

  // Validate filter
  const validateFilter = useCallback((filter: Filter) => {
    const errors: string[] = [];
    
    if (filter.validation?.required && !filter.value) {
      errors.push('This field is required');
    }
    
    if (filter.validation?.pattern && typeof filter.value === 'string') {
      const regex = new RegExp(filter.validation.pattern);
      if (!regex.test(filter.value)) {
        errors.push(filter.validation.errorMessage || 'Invalid format');
      }
    }
    
    if (filter.validation?.minValue !== undefined && typeof filter.value === 'number') {
      if (filter.value < filter.validation.minValue) {
        errors.push(`Value must be at least ${filter.validation.minValue}`);
      }
    }
    
    if (filter.validation?.maxValue !== undefined && typeof filter.value === 'number') {
      if (filter.value > filter.validation.maxValue) {
        errors.push(`Value must be at most ${filter.validation.maxValue}`);
      }
    }
    
    return errors;
  }, []);

  // Auto-complete suggestions
  const getFilterSuggestions = useCallback(async (filterId: string, query: string): Promise<FilterSuggestion[]> => {
    const filter = getFilter(filterId);
    if (!filter) return [];

    try {
      // Get suggestions from database
      const { data, error } = await supabase
        .from('filter_suggestions')
        .select('*')
        .eq('filter_id', filterId)
        .ilike('suggestion', `%${query}%`)
        .limit(10);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting filter suggestions:', error);
      return [];
    }
  }, [getFilter]);

  return {
    // State
    filterState,
    
    // Actions
    addFilter,
    updateFilter,
    removeFilter,
    applyFilters,
    clearFilters,
    
    // Getters
    getFilter,
    getActiveFilters,
    getAppliedFilters,
    
    // Utilities
    validateFilter,
    getFilterSuggestions,
    
    // Computed properties
    hasActiveFilters: filterState.activeFilters.length > 0,
    hasAppliedFilters: filterState.appliedFilters.length > 0,
    isDirty: filterState.isDirty,
    isLoading: filterState.isLoading,
    hasErrors: filterState.errors.length > 0,
    hasWarnings: filterState.warnings.length > 0,
  };
};

// Hook for managing filter sets
export const useFilterSets = (companyId: string) => {
  const [filterSets, setFilterSets] = useState<FilterSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load filter sets
  const loadFilterSets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('filter_sets')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setFilterSets(data || []);
    } catch (err) {
      console.error('Error loading filter sets:', err);
      setError('Failed to load filter sets');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Save filter set
  const saveFilterSet = useCallback(async (filterSet: Omit<FilterSet, 'id' | 'createdAt' | 'updatedAt'>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('filter_sets')
        .insert({
          ...filterSet,
          company_id: companyId,
        })
        .select()
        .single();

      if (error) throw error;
      
      setFilterSets(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error saving filter set:', err);
      setError('Failed to save filter set');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  // Delete filter set
  const deleteFilterSet = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('filter_sets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setFilterSets(prev => prev.filter(fs => fs.id !== id));
    } catch (err) {
      console.error('Error deleting filter set:', err);
      setError('Failed to delete filter set');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load filter sets on mount
  useEffect(() => {
    loadFilterSets();
  }, [loadFilterSets]);

  return {
    filterSets,
    isLoading,
    error,
    saveFilterSet,
    deleteFilterSet,
    reload: loadFilterSets,
  };
};

// Hook for filter analytics
export const useFilterAnalytics = (filterId?: string) => {
  const [analytics, setAnalytics] = useState<FilterAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!filterId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('filter_analytics')
        .select('*')
        .eq('filter_id', filterId)
        .single();

      if (error) throw error;
      
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading filter analytics:', err);
      setError('Failed to load filter analytics');
    } finally {
      setIsLoading(false);
    }
  }, [filterId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    analytics,
    isLoading,
    error,
    reload: loadAnalytics,
  };
};

// Hook for cross-filtering
export const useCrossFilter = (filters: Filter[]) => {
  const [crossFilterRelationships, setCrossFilterRelationships] = useState<any[]>([]);
  
  // Auto-detect relationships between filters
  const detectRelationships = useCallback(() => {
    const relationships: any[] = [];
    
    for (let i = 0; i < filters.length; i++) {
      for (let j = i + 1; j < filters.length; j++) {
        const filter1 = filters[i];
        const filter2 = filters[j];
        
        // Check if filters are related (same table, foreign key relationships, etc.)
        if (filter1.dataSource === filter2.dataSource) {
          relationships.push({
            sourceFilter: filter1.id,
            targetFilter: filter2.id,
            field: filter1.field,
            operator: 'equals',
            strength: 0.8,
          });
        }
      }
    }
    
    setCrossFilterRelationships(relationships);
  }, [filters]);

  // Apply cross-filtering
  const applyCrossFilter = useCallback((sourceFilterId: string, value: any) => {
    const relationships = crossFilterRelationships.filter(r => r.sourceFilter === sourceFilterId);
    
    return relationships.map(rel => ({
      filterId: rel.targetFilter,
      value: value,
    }));
  }, [crossFilterRelationships]);

  useEffect(() => {
    detectRelationships();
  }, [detectRelationships]);

  return {
    relationships: crossFilterRelationships,
    applyCrossFilter,
  };
};

// Hook for smart filter suggestions
export const useSmartFilters = (reportId: string, currentFilters: Filter[]) => {
  const [suggestions, setSuggestions] = useState<FilterSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generateSuggestions = useCallback(async () => {
    if (!reportId) return;
    
    setIsLoading(true);
    
    try {
      // Get popular filters for this report
      const { data: popularFilters } = await supabase
        .from('filter_usage')
        .select('filter_id, usage_count')
        .eq('report_id', reportId)
        .order('usage_count', { ascending: false })
        .limit(5);

      // Get filters commonly used together
      const { data: relatedFilters } = await supabase
        .from('filter_correlations')
        .select('*')
        .in('filter_id', currentFilters.map(f => f.id))
        .order('correlation', { ascending: false })
        .limit(3);

      // Combine suggestions
      const allSuggestions: FilterSuggestion[] = [
        ...(popularFilters || []).map(pf => ({
          id: `popular-${pf.filter_id}`,
          type: 'popular_values' as const,
          priority: 1,
          suggestion: pf,
          confidence: 0.8,
          reason: 'Popular filter for this report',
        })),
        ...(relatedFilters || []).map(rf => ({
          id: `related-${rf.filter_id}`,
          type: 'similar_filters' as const,
          priority: 2,
          suggestion: rf,
          confidence: rf.correlation,
          reason: 'Often used with current filters',
        })),
      ];

      setSuggestions(allSuggestions);
    } catch (error) {
      console.error('Error generating smart suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [reportId, currentFilters]);

  useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  return {
    suggestions,
    isLoading,
    refresh: generateSuggestions,
  };
};