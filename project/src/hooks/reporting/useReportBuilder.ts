import { useState, useCallback, useReducer, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  ReportConfiguration, 
  Dimension, 
  Measure, 
  Filter, 
  FilterGroup,
  DataSource,
  ChartType,
  VisualizationSettings,
  AggregatedData,
  ReportConfig
} from '../../types/reporting';
import { useCreateReport, useUpdateReport, reportQueryKeys } from './useReportData';
import { ReportingDataService } from '../../services/reportingDataService';
import { useAuthStore } from '../../stores/authStore';
import { useCompanies } from '../useCompanies';

// Constants for localStorage
const REPORT_BUILDER_CACHE_KEY = 'gasx_report_builder_state';
const CACHE_EXPIRY_HOURS = 24;

// Cache utilities
const saveStateToCache = (state: ReportBuilderState, reportId?: string) => {
  try {
    const cacheData = {
      state,
      reportId: reportId || null,
      timestamp: Date.now(),
      version: '1.0'
    };
    localStorage.setItem(REPORT_BUILDER_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to save report builder state to cache:', error);
  }
};

const loadStateFromCache = (): { state: ReportBuilderState | null; reportId: string | null } => {
  try {
    const cached = localStorage.getItem(REPORT_BUILDER_CACHE_KEY);
    if (!cached) return { state: null, reportId: null };
    
    const cacheData = JSON.parse(cached);
    const { state, reportId, timestamp, version } = cacheData;
    
    // Check if cache is expired
    const hoursAgo = (Date.now() - timestamp) / (1000 * 60 * 60);
    if (hoursAgo > CACHE_EXPIRY_HOURS) {
      localStorage.removeItem(REPORT_BUILDER_CACHE_KEY);
      return { state: null, reportId: null };
    }
    
    // Version check for future compatibility
    if (version !== '1.0') {
      localStorage.removeItem(REPORT_BUILDER_CACHE_KEY);
      return { state: null, reportId: null };
    }
    
    return { state, reportId };
  } catch (error) {
    console.warn('Failed to load report builder state from cache:', error);
    localStorage.removeItem(REPORT_BUILDER_CACHE_KEY);
    return { state: null, reportId: null };
  }
};

const clearStateCache = () => {
  try {
    console.log('Debug: Clearing localStorage cache for key:', REPORT_BUILDER_CACHE_KEY);
    localStorage.removeItem(REPORT_BUILDER_CACHE_KEY);
    console.log('Debug: Cache cleared successfully');
  } catch (error) {
    console.warn('Failed to clear report builder cache:', error);
  }
};

// Helper function to consolidate duplicate dimensions
const consolidateDimensions = (dimensions: Dimension[]): Dimension[] => {
  const dimensionMap = new Map<string, Dimension>();
  
  // Filter out any invalid dimensions first
  const validDimensions = dimensions.filter(dim => dim && dim.field);
  
  if (validDimensions.length !== dimensions.length) {
    console.warn(`Filtered out ${dimensions.length - validDimensions.length} invalid dimensions`);
  }
  
  validDimensions.forEach(dim => {
    
    // Use field name as the key for consolidation
    const key = dim.field;
    
    if (dimensionMap.has(key)) {
      // Dimension field already exists, keep the first one but update display name if needed
      const existing = dimensionMap.get(key)!;
      
      // If the existing dimension has a generic name and this one has a better display name, update it
      if (!existing.displayName || existing.displayName === existing.name) {
        if (dim.displayName && dim.displayName !== dim.name) {
          existing.displayName = dim.displayName;
        }
      }
    } else {
      // New dimension field, add it
      dimensionMap.set(key, { ...dim });
    }
  });
  
  return Array.from(dimensionMap.values());
};

// Report builder state
export interface ReportBuilderState {
  // Basic info
  name: string;
  description: string;
  category: string;
  type: string;
  
  // Data configuration
  dataSources: DataSource[];
  dimensions: Dimension[];
  measures: Measure[];
  filters: Filter[];
  filterGroups?: FilterGroup[];
  
  // Visualization
  chartType: ChartType;
  visualizationSettings: VisualizationSettings;
  
  // UI state
  activeStep: number;
  selectedDataSource: string | null;
  selectedDimensions: string[];
  selectedMeasures: string[];
  selectedSegments: string[];
  isolationFilters: Record<string, string[]>; // Selected isolation filter values
  previewData: any;
  
  // Validation
  errors: Record<string, string>;
  warnings: Record<string, string>;
  
  // Persistence
  isDirty: boolean;
  isValid: boolean;
  isLoading: boolean;
  autoSave: boolean;
  lastSaved: string | null;
}

// Actions for report builder
type ReportBuilderAction = 
  | { type: 'SET_BASIC_INFO'; payload: { name?: string; description?: string; category?: string; type?: string } }
  | { type: 'ADD_DATA_SOURCE'; payload: DataSource }
  | { type: 'UPDATE_DATA_SOURCE'; payload: { id: string; updates: Partial<DataSource> } }
  | { type: 'REMOVE_DATA_SOURCE'; payload: string }
  | { type: 'ADD_DIMENSION'; payload: Dimension }
  | { type: 'UPDATE_DIMENSION'; payload: { id: string; updates: Partial<Dimension> } }
  | { type: 'SET_DIMENSIONS'; payload: Dimension[] }
  | { type: 'REMOVE_DIMENSION'; payload: string }
  | { type: 'ADD_MEASURE'; payload: Measure }
  | { type: 'UPDATE_MEASURE'; payload: { id: string; updates: Partial<Measure> } }
  | { type: 'SET_MEASURES'; payload: Measure[] }
  | { type: 'REMOVE_MEASURE'; payload: string }
  | { type: 'ADD_FILTER'; payload: Filter }
  | { type: 'UPDATE_FILTER'; payload: { id: string; updates: Partial<Filter> } }
  | { type: 'REMOVE_FILTER'; payload: string }
  | { type: 'SET_FILTER_GROUPS'; payload: FilterGroup[] }
  | { type: 'ADD_FILTER_GROUP'; payload: FilterGroup }
  | { type: 'UPDATE_FILTER_GROUP'; payload: { id: string; updates: Partial<FilterGroup> } }
  | { type: 'REMOVE_FILTER_GROUP'; payload: string }
  | { type: 'SET_CHART_TYPE'; payload: ChartType }
  | { type: 'UPDATE_VISUALIZATION_SETTINGS'; payload: Partial<VisualizationSettings> }
  | { type: 'SET_ACTIVE_STEP'; payload: number }
  | { type: 'SET_SELECTED_DATA_SOURCE'; payload: string | null }
  | { type: 'SET_SELECTED_DIMENSIONS'; payload: string[] }
  | { type: 'SET_SELECTED_MEASURES'; payload: string[] }
  | { type: 'SET_SELECTED_SEGMENTS'; payload: string[] }
  | { type: 'SET_ISOLATION_FILTERS'; payload: Record<string, string[]> }
  | { type: 'SET_PREVIEW_DATA'; payload: any }
  | { type: 'SET_ERRORS'; payload: Record<string, string> }
  | { type: 'SET_WARNINGS'; payload: Record<string, string> }
  | { type: 'SET_IS_DIRTY'; payload: boolean }
  | { type: 'SET_IS_VALID'; payload: boolean }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_LAST_SAVED'; payload: string }
  | { type: 'RESET_STATE' }
  | { type: 'LOAD_REPORT'; payload: ReportConfiguration };

// Initial state
const initialState: ReportBuilderState = {
  name: '',
  description: '',
  category: 'analytics',
  type: 'chart',
  dataSources: [],
  dimensions: [],
  measures: [],
  filters: [],
  chartType: 'line',
  visualizationSettings: {
    chartType: 'line',
    dimensions: { width: 1000, height: 400, margin: { top: 20, right: 20, bottom: 30, left: 50 } },
    colors: { scheme: 'categorical', palette: 'category10' },
    axes: { 
      x: { show: true, scale: 'linear', grid: { show: true } },
      y: { show: true, scale: 'linear', grid: { show: true } }
    },
    legends: { show: true, position: 'top', orientation: 'horizontal', padding: 10, itemSpacing: 5, fontSize: 12, fontFamily: 'Arial', color: '#333', interactive: true },
    tooltips: { show: true },
    animations: { enabled: true, duration: 300, easing: 'ease-in-out' },
    interactions: { 
      zoom: { enabled: false, type: 'wheel', extent: [[0, 0], [1000, 400]], scaleExtent: [1, 10] },
      pan: { enabled: false, extent: [[0, 0], [1000, 400]] },
      brush: { enabled: true, type: 'x', extent: [[0, 0], [1000, 400]] },
      selection: { enabled: true, mode: 'single' },
      hover: { enabled: true },
      click: { enabled: true, action: 'select' }
    },
    specific: {}
  },
  activeStep: 0,
  selectedDataSource: null,
  selectedDimensions: [],
  selectedMeasures: [],
  selectedSegments: [],
  isolationFilters: {},
  previewData: null,
  errors: {},
  warnings: {},
  isDirty: false,
  isValid: false,
  isLoading: false,
  autoSave: true,
  lastSaved: null,
};

// Reducer for report builder state
const reportBuilderReducer = (state: ReportBuilderState, action: ReportBuilderAction): ReportBuilderState => {
  switch (action.type) {
    case 'SET_BASIC_INFO':
      return { 
        ...state, 
        ...action.payload, 
        isDirty: true 
      };
    
    case 'ADD_DATA_SOURCE':
      // If this is the first data source, make it primary automatically
      const isFirstDataSource = state.dataSources.length === 0;
      const newDataSource = {
        ...action.payload,
        isPrimary: isFirstDataSource ? true : action.payload.isPrimary || false
      };
      
      return {
        ...state,
        dataSources: [...state.dataSources, newDataSource],
        isDirty: true
      };
    
    case 'UPDATE_DATA_SOURCE':
      // If setting a data source as primary, ensure all others are not primary
      let updatedDataSources = state.dataSources;
      
      if (action.payload.updates.isPrimary === true) {
        // First, set all data sources to not primary
        updatedDataSources = state.dataSources.map(ds => ({
          ...ds,
          isPrimary: false
        }));
      }
      
      // Now apply the update to the target data source
      updatedDataSources = updatedDataSources.map(ds => 
        ds.id === action.payload.id ? { ...ds, ...action.payload.updates } : ds
      );
      
      // Ensure at least one data source is primary if any exist
      const hasPrimary = updatedDataSources.some(ds => ds.isPrimary);
      if (!hasPrimary && updatedDataSources.length > 0) {
        updatedDataSources[0].isPrimary = true;
      }
      
      return {
        ...state,
        dataSources: updatedDataSources,
        isDirty: true
      };
    
    case 'REMOVE_DATA_SOURCE':
      const filteredDataSources = state.dataSources.filter(ds => ds.id !== action.payload);
      
      // Check if we removed the primary data source
      const removedDataSource = state.dataSources.find(ds => ds.id === action.payload);
      const wasRemovedPrimary = removedDataSource?.isPrimary;
      
      // If we removed the primary and there are still data sources left, make the first one primary
      if (wasRemovedPrimary && filteredDataSources.length > 0) {
        filteredDataSources[0].isPrimary = true;
      }
      
      return {
        ...state,
        dataSources: filteredDataSources,
        isDirty: true
      };
    
    case 'ADD_DIMENSION':
      return {
        ...state,
        dimensions: [...state.dimensions, action.payload],
        isDirty: true
      };
    
    case 'UPDATE_DIMENSION':
      return {
        ...state,
        dimensions: state.dimensions.map(dim => 
          dim.id === action.payload.id ? { ...dim, ...action.payload.updates } : dim
        ),
        isDirty: true
      };
    
    case 'SET_DIMENSIONS':
      return {
        ...state,
        dimensions: action.payload,
        isDirty: true
      };
    
    case 'REMOVE_DIMENSION':
      return {
        ...state,
        dimensions: state.dimensions.filter(dim => dim.id !== action.payload),
        selectedDimensions: state.selectedDimensions.filter(id => id !== action.payload),
        isDirty: true
      };
    
    case 'ADD_MEASURE':
      return {
        ...state,
        measures: [...state.measures, action.payload],
        isDirty: true
      };
    
    case 'UPDATE_MEASURE':
      return {
        ...state,
        measures: state.measures.map(measure => 
          measure.id === action.payload.id ? { ...measure, ...action.payload.updates } : measure
        ),
        isDirty: true
      };
    
    case 'SET_MEASURES':
      return {
        ...state,
        measures: action.payload,
        isDirty: true
      };
    
    case 'REMOVE_MEASURE':
      return {
        ...state,
        measures: state.measures.filter(measure => measure.id !== action.payload),
        selectedMeasures: state.selectedMeasures.filter(id => id !== action.payload),
        isDirty: true
      };
    
    case 'ADD_FILTER':
      return {
        ...state,
        filters: [...state.filters, action.payload],
        isDirty: true
      };
    
    case 'UPDATE_FILTER':
      return {
        ...state,
        filters: state.filters.map(filter => 
          filter.id === action.payload.id ? { ...filter, ...action.payload.updates } : filter
        ),
        isDirty: true
      };
    
    case 'REMOVE_FILTER':
      return {
        ...state,
        filters: state.filters.filter(filter => filter.id !== action.payload),
        isDirty: true
      };
    
    case 'SET_FILTER_GROUPS':
      return {
        ...state,
        filterGroups: action.payload,
        isDirty: true
      };
    
    case 'ADD_FILTER_GROUP':
      return {
        ...state,
        filterGroups: [...(state.filterGroups || []), action.payload],
        isDirty: true
      };
    
    case 'UPDATE_FILTER_GROUP':
      return {
        ...state,
        filterGroups: (state.filterGroups || []).map(group =>
          group.id === action.payload.id ? { ...group, ...action.payload.updates } : group
        ),
        isDirty: true
      };
    
    case 'REMOVE_FILTER_GROUP':
      return {
        ...state,
        filterGroups: (state.filterGroups || []).filter(group => group.id !== action.payload),
        isDirty: true
      };
    
    case 'SET_CHART_TYPE':
      return {
        ...state,
        chartType: action.payload,
        visualizationSettings: {
          ...state.visualizationSettings,
          chartType: action.payload
        },
        isDirty: true
      };
    
    case 'UPDATE_VISUALIZATION_SETTINGS':
      // Deep merge the visualization settings
      const updatedVisualizationSettings = {
        ...state.visualizationSettings,
        ...action.payload,
        // Ensure nested objects are properly merged
        dimensions: action.payload.dimensions ? {
          ...state.visualizationSettings.dimensions,
          ...action.payload.dimensions
        } : state.visualizationSettings.dimensions,
        colors: action.payload.colors ? {
          ...state.visualizationSettings.colors,
          ...action.payload.colors
        } : state.visualizationSettings.colors,
        axes: action.payload.axes ? {
          ...state.visualizationSettings.axes,
          ...action.payload.axes,
          x: action.payload.axes?.x ? {
            ...state.visualizationSettings.axes?.x,
            ...action.payload.axes.x
          } : state.visualizationSettings.axes?.x,
          y: action.payload.axes?.y ? {
            ...state.visualizationSettings.axes?.y,
            ...action.payload.axes.y
          } : state.visualizationSettings.axes?.y
        } : state.visualizationSettings.axes,
        legends: action.payload.legends ? {
          ...state.visualizationSettings.legends,
          ...action.payload.legends
        } : state.visualizationSettings.legends,
        tooltips: action.payload.tooltips ? {
          ...state.visualizationSettings.tooltips,
          ...action.payload.tooltips
        } : state.visualizationSettings.tooltips,
        animations: action.payload.animations ? {
          ...state.visualizationSettings.animations,
          ...action.payload.animations
        } : state.visualizationSettings.animations
      };
      
      return {
        ...state,
        visualizationSettings: updatedVisualizationSettings,
        // Don't mark as dirty for visualization settings changes
        // These are UI preferences that don't need to trigger auto-save
        isDirty: state.isDirty
      };
    
    case 'SET_ACTIVE_STEP':
      return { ...state, activeStep: action.payload };
    
    case 'SET_SELECTED_DATA_SOURCE':
      return { ...state, selectedDataSource: action.payload };
    
    case 'SET_SELECTED_DIMENSIONS':
      return { ...state, selectedDimensions: action.payload };
    
    case 'SET_SELECTED_MEASURES':
      return { ...state, selectedMeasures: action.payload };
    
    case 'SET_SELECTED_SEGMENTS':
      console.log('🎯 SET_SELECTED_SEGMENTS:', action.payload, 'Previous:', state.selectedSegments);
      return { ...state, selectedSegments: action.payload, isDirty: true };
    
    case 'SET_ISOLATION_FILTERS':
      return { ...state, isolationFilters: action.payload, isDirty: true };
    
    case 'SET_PREVIEW_DATA':
      return { ...state, previewData: action.payload };
    
    case 'SET_ERRORS':
      return { ...state, errors: action.payload };
    
    case 'SET_WARNINGS':
      return { ...state, warnings: action.payload };
    
    case 'SET_IS_DIRTY':
      return { ...state, isDirty: action.payload };
    
    case 'SET_IS_VALID':
      return { ...state, isValid: action.payload };
    
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_LAST_SAVED':
      return { ...state, lastSaved: action.payload, isDirty: false };
    
    case 'RESET_STATE':
      return initialState;
    
    case 'LOAD_REPORT':
      console.log('📥 LOAD_REPORT - segmentBy:', action.payload.segmentBy, 'isolationFilters:', action.payload.isolationFilters);
      console.log('📥 LOAD_REPORT - current state segments:', state.selectedSegments, 'current isolation:', state.isolationFilters);
      return {
        ...state,
        name: action.payload.name,
        description: action.payload.description || '',
        category: action.payload.category,
        type: action.payload.type,
        dataSources: action.payload.dataSources,
        dimensions: action.payload.dimensions,
        measures: action.payload.measures,
        filters: action.payload.filters,
        selectedSegments: action.payload.segmentBy || state.selectedSegments || [],
        isolationFilters: action.payload.isolationFilters || state.isolationFilters || {},
        chartType: action.payload.chartType,
        visualizationSettings: action.payload.visualizationSettings,
        isDirty: false,
        lastSaved: action.payload.updatedAt
      };
    
    default:
      return state;
  }
};

// Main hook for report builder
export const useReportBuilder = (initialReportId?: string) => {
  // Get current user from auth store
  const { user } = useAuthStore();
  const { userCompany } = useCompanies();
  
  // Initialize state with cache if available
  const [cachedData] = useState(() => {
    // Always try to load from cache to preserve work across refreshes
    const cached = loadStateFromCache();
    
    // If we're editing a specific report
    if (initialReportId) {
      // If cached report ID matches, use cached state
      if (cached.reportId === initialReportId && cached.state) {
        console.log('Loading cached state for report:', initialReportId);
        return cached;
      }
      // Otherwise, don't use cache for a different report
      return { state: null, reportId: null };
    }
    
    // For new reports, always use cached state if available
    // This preserves work across page refreshes
    if (cached.state) {
      console.log('Loading cached state for new report');
      return cached;
    }
    
    return { state: null, reportId: null };
  });
  
  const [state, dispatch] = useReducer(reportBuilderReducer, 
    cachedData.state || initialState
  );
  const queryClient = useQueryClient();
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  
  // Cache state on every change (debounced)
  useEffect(() => {
    if (state.isDirty || state.name || state.dataSources.length > 0 || 
        state.dimensions.length > 0 || state.measures.length > 0) {
      const timeoutId = setTimeout(() => {
        saveStateToCache(state, initialReportId);
      }, 500); // Debounce saves
      
      return () => clearTimeout(timeoutId);
    }
  }, [state, initialReportId]);
  
  // Save functionality (moved up to fix temporal dead zone issue)
  const handleSave = useCallback(async () => {
    if (!state.isValid) {
      throw new Error('Report configuration is not valid');
    }
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    
    try {
      // Consolidate duplicate dimensions before saving
      const consolidatedDimensions = consolidateDimensions(state.dimensions);
      
      // Don't add segments as dimensions - they should remain separate
      // Segments are handled via the segmentBy field in the report config
      
      const reportData: any = {
        name: state.name,
        description: state.description,
        category: state.category,
        type: state.type,
        dataSources: state.dataSources,
        dimensions: consolidatedDimensions,
        measures: state.measures,
        filters: state.filters,
        segmentBy: state.selectedSegments, // Add segmentBy for SQL query generation
        isolationFilters: state.isolationFilters, // Add selected isolation filter values
        chartType: state.chartType,
        visualizationSettings: state.visualizationSettings,
        queryCacheTtl: 3600,
        autoRefresh: false,
        tags: [],
      };
      
      if (initialReportId) {
        await updateReport.mutateAsync({ reportId: initialReportId, updates: reportData });
      } else {
        await createReport.mutateAsync({
          ...reportData,
          createdByUserId: user.id,
          companyId: userCompany?.company_id || null,
          programIds: [],
          isPublic: false,
          isTemplate: false,
        });
      }
      
      dispatch({ type: 'SET_LAST_SAVED', payload: new Date().toISOString() });
      
      // Only invalidate queries if this is not an auto-save
      // Auto-save should not trigger a refetch of the report data
      if (!state.autoSave || !initialReportId) {
        queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
      }
      
      // Don't clear cache after auto-save - we want to preserve the current state
      if (!state.autoSave) {
        clearStateCache();
      }
    } catch (error) {
      console.error('Error saving report:', error);
      // Re-throw the error so it can be handled by the calling function
      throw error;
    } finally {
      dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  }, [state, initialReportId, updateReport, createReport, queryClient, user, userCompany]);
  
  // Auto-save functionality
  useEffect(() => {
    console.log('Auto-save check:', {
      autoSave: state.autoSave,
      isDirty: state.isDirty,
      isValid: state.isValid,
      initialReportId,
      shouldAutoSave: state.autoSave && state.isDirty && state.isValid && initialReportId
    });
    
    if (state.autoSave && state.isDirty && state.isValid && initialReportId) {
      const timeoutId = setTimeout(() => {
        console.log('Auto-saving report...');
        handleSave();
      }, 2000); // Auto-save after 2 seconds of inactivity
      
      return () => clearTimeout(timeoutId);
    }
  }, [state.isDirty, state.isValid, state.autoSave, initialReportId, handleSave]);
  
  // Validation
  useEffect(() => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};
    
    // Basic validation
    if (!state.name.trim()) {
      errors.name = 'Report name is required';
    }
    
    if (state.dataSources.length === 0) {
      errors.dataSources = 'At least one data source is required';
    }
    
    if (state.dimensions.length === 0) {
      warnings.dimensions = 'Consider adding dimensions for better analysis';
    }
    
    if (state.measures.length === 0) {
      errors.measures = 'At least one measure is required';
    }
    
    // Chart-specific validation
    if (state.chartType === 'scatter' && state.dimensions.length < 2) {
      errors.chartType = 'Scatter plots require at least 2 dimensions';
    }
    
    if (state.chartType === 'heatmap' && state.dimensions.length !== 2) {
      errors.chartType = 'Heatmaps require exactly 2 dimensions';
    }
    
    dispatch({ type: 'SET_ERRORS', payload: errors });
    dispatch({ type: 'SET_WARNINGS', payload: warnings });
    dispatch({ type: 'SET_IS_VALID', payload: Object.keys(errors).length === 0 });
  }, [state.name, state.dataSources, state.dimensions, state.measures, state.chartType]);
  
  // Actions
  const setBasicInfo = useCallback((info: { name?: string; description?: string; category?: string; type?: string }) => {
    dispatch({ type: 'SET_BASIC_INFO', payload: info });
  }, []);
  
  const addDataSource = useCallback((dataSource: DataSource) => {
    dispatch({ type: 'ADD_DATA_SOURCE', payload: dataSource });
  }, []);
  
  const updateDataSource = useCallback((id: string, updates: Partial<DataSource>) => {
    dispatch({ type: 'UPDATE_DATA_SOURCE', payload: { id, updates } });
  }, []);
  
  const removeDataSource = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_DATA_SOURCE', payload: id });
  }, []);
  
  const addDimension = useCallback((dimension: Dimension) => {
    dispatch({ type: 'ADD_DIMENSION', payload: dimension });
  }, []);
  
  const updateDimension = useCallback((id: string, updates: Partial<Dimension>) => {
    dispatch({ type: 'UPDATE_DIMENSION', payload: { id, updates } });
  }, []);
  
  const setDimensions = useCallback((dimensions: Dimension[]) => {
    dispatch({ type: 'SET_DIMENSIONS', payload: dimensions });
  }, []);
  
  const removeDimension = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_DIMENSION', payload: id });
  }, []);
  
  const addMeasure = useCallback((measure: Measure) => {
    dispatch({ type: 'ADD_MEASURE', payload: measure });
  }, []);
  
  const updateMeasure = useCallback((id: string, updates: Partial<Measure>) => {
    dispatch({ type: 'UPDATE_MEASURE', payload: { id, updates } });
  }, []);
  
  const setMeasures = useCallback((measures: Measure[]) => {
    dispatch({ type: 'SET_MEASURES', payload: measures });
  }, []);
  
  const removeMeasure = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_MEASURE', payload: id });
  }, []);
  
  const addFilter = useCallback((filter: Filter) => {
    dispatch({ type: 'ADD_FILTER', payload: filter });
  }, []);
  
  const updateFilter = useCallback((id: string, updates: Partial<Filter>) => {
    dispatch({ type: 'UPDATE_FILTER', payload: { id, updates } });
  }, []);
  
  const removeFilter = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FILTER', payload: id });
  }, []);
  
  const updateFilterGroups = useCallback((groups: FilterGroup[]) => {
    dispatch({ type: 'SET_FILTER_GROUPS', payload: groups });
  }, []);
  
  const setChartType = useCallback((chartType: ChartType) => {
    dispatch({ type: 'SET_CHART_TYPE', payload: chartType });
  }, []);
  
  const updateVisualizationSettings = useCallback((settings: Partial<VisualizationSettings>) => {
    console.log('📊 updateVisualizationSettings called with:', settings);
    console.log('📊 Current isDirty state:', state.isDirty);
    dispatch({ type: 'UPDATE_VISUALIZATION_SETTINGS', payload: settings });
  }, [state.isDirty]);
  
  const setActiveStep = useCallback((step: number) => {
    dispatch({ type: 'SET_ACTIVE_STEP', payload: step });
  }, []);
  
  const setSelectedDataSource = useCallback((id: string | null) => {
    dispatch({ type: 'SET_SELECTED_DATA_SOURCE', payload: id });
  }, []);
  
  const setSelectedDimensions = useCallback((ids: string[]) => {
    dispatch({ type: 'SET_SELECTED_DIMENSIONS', payload: ids });
  }, []);
  
  const setSelectedMeasures = useCallback((ids: string[]) => {
    dispatch({ type: 'SET_SELECTED_MEASURES', payload: ids });
  }, []);
  
  const setSelectedSegments = useCallback((segments: string[]) => {
    dispatch({ type: 'SET_SELECTED_SEGMENTS', payload: segments });
  }, []);
  
  const setIsolationFilters = useCallback((filters: Record<string, string[]>) => {
    console.log('🔍 setIsolationFilters called with:', filters);
    console.log('🔍 Current isolation filters:', state.isolationFilters);
    dispatch({ type: 'SET_ISOLATION_FILTERS', payload: filters });
  }, [state.isolationFilters]);
  
  const loadReport = useCallback((report: ReportConfiguration) => {
    dispatch({ type: 'LOAD_REPORT', payload: report });
  }, []);
  
  const resetState = useCallback(() => {
    console.log('Debug: resetState called, clearing cache and resetting state');
    clearStateCache();
    
    // Use the centralized cache clearing method
    ReportingDataService.clearAllCaches();
    
    dispatch({ type: 'RESET_STATE' });
    console.log('Debug: resetState completed');
  }, []);
  
  // Function to manually consolidate dimensions in state
  const consolidateStateDimensions = useCallback(() => {
    const consolidated = consolidateDimensions(state.dimensions);
    // Only update if there were actual duplicates removed
    if (consolidated.length < state.dimensions.length) {
      // Replace all dimensions with consolidated ones
      state.dimensions.forEach(dim => {
        dispatch({ type: 'REMOVE_DIMENSION', payload: dim.id });
      });
      consolidated.forEach(dim => {
        dispatch({ type: 'ADD_DIMENSION', payload: dim });
      });
    }
  }, [state.dimensions]);
  
  // Get available dimensions based on selected data sources
  const getAvailableDimensions = useCallback((): Dimension[] => {
    return ReportingDataService.getAvailableDimensions(state.dataSources);
  }, [state.dataSources]);

  // Get available measures based on selected data sources
  const getAvailableMeasures = useCallback((): Measure[] => {
    return ReportingDataService.getAvailableMeasures(state.dataSources);
  }, [state.dataSources]);

  // Preview functionality
  const generatePreview = useCallback(async (): Promise<AggregatedData | null> => {
    if (!state.isValid || state.dataSources.length === 0 || state.measures.length === 0) {
      return null;
    }
    
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    
    // Create a timeout promise that rejects after 10 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Query timeout: The query is taking too long. You may need to clear the cache.'));
      }, 10000); // 10 second timeout
    });
    
    try {
      // Consolidate duplicate dimensions before creating report config
      const consolidatedDimensions = consolidateDimensions(state.dimensions);
      
      // Don't add segments as dimensions - they should remain separate
      // Segments are handled via the segmentBy field in the report config
      
      // Build report config from current state
      console.log('Debug: generatePreview filters:', state.filters.length, state.filters);
      console.log('Debug: generatePreview segments:', state.selectedSegments);
      console.log('Debug: generatePreview dimensions (without segments):', consolidatedDimensions.length);
      
      const reportConfig: ReportConfig = {
        id: 'preview',
        name: state.name || 'Preview Report',
        description: state.description || '',
        category: state.category,
        type: state.type,
        dataSources: state.dataSources,
        dimensions: consolidatedDimensions,
        measures: state.measures,
        filters: state.filters,
        segmentBy: state.selectedSegments, // Add segmentBy for SQL query generation
        isolationFilters: state.isolationFilters, // Add selected isolation filter values
        chartType: state.chartType,
        visualizationSettings: state.visualizationSettings,
        createdByUserId: '',
        companyId: '',
        programIds: [],
        isPublic: false,
        isTemplate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        queryCacheTtl: 3600,
        autoRefresh: false,
        tags: []
      };

      // Execute report with timeout - race between actual query and timeout
      const executePromise = ReportingDataService.executeReport(reportConfig);
      const previewData = await Promise.race([executePromise, timeoutPromise]);
      
      dispatch({ type: 'SET_PREVIEW_DATA', payload: previewData });
      return previewData;
    } catch (error) {
      console.error('Error generating preview:', error);
      
      // If it's a timeout error, provide specific guidance
      if (error instanceof Error && error.message.includes('timeout')) {
        alert(error.message + '\n\nClick Reset to clear the cache and try again.');
      }
      
      return null;
    } finally {
      dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  }, [state]);
  
  // Function to mark the report as saved (clears unsaved changes)
  const markAsSaved = useCallback(() => {
    dispatch({ type: 'SET_LAST_SAVED', payload: new Date().toISOString() });
  }, []);

  return {
    // State
    state,
    
    // Actions
    setBasicInfo,
    addDataSource,
    updateDataSource,
    removeDataSource,
    addDimension,
    updateDimension,
    setDimensions,
    removeDimension,
    addMeasure,
    updateMeasure,
    setMeasures,
    removeMeasure,
    addFilter,
    updateFilter,
    removeFilter,
    updateFilterGroups,
    setChartType,
    updateVisualizationSettings,
    setActiveStep,
    setSelectedDataSource,
    setSelectedDimensions,
    setSelectedMeasures,
    setSelectedSegments,
    setIsolationFilters,
    loadReport,
    resetState,
    markAsSaved,
    
    // Operations
    save: handleSave,
    generatePreview,
    getAvailableDimensions,
    getAvailableMeasures,
    clearCache: clearStateCache,
    consolidateDimensions: consolidateStateDimensions,
    
    // Computed properties
    canSave: state.isValid && state.isDirty,
    hasChanges: state.isDirty,
    isLoading: state.isLoading || createReport.isPending || updateReport.isPending,
    hasDuplicateDimensions: state.dimensions.length > consolidateDimensions(state.dimensions).length,
    duplicateCount: state.dimensions.length - consolidateDimensions(state.dimensions).length,
  };
};