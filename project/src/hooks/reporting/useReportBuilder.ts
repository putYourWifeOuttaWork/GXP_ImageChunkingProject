import { useState, useCallback, useReducer, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  ReportConfiguration, 
  Dimension, 
  Measure, 
  Filter, 
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
  
  dimensions.forEach(dim => {
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
  
  // Visualization
  chartType: ChartType;
  visualizationSettings: VisualizationSettings;
  
  // UI state
  activeStep: number;
  selectedDataSource: string | null;
  selectedDimensions: string[];
  selectedMeasures: string[];
  selectedSegments: string[];
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
  | { type: 'REMOVE_DIMENSION'; payload: string }
  | { type: 'ADD_MEASURE'; payload: Measure }
  | { type: 'UPDATE_MEASURE'; payload: { id: string; updates: Partial<Measure> } }
  | { type: 'REMOVE_MEASURE'; payload: string }
  | { type: 'ADD_FILTER'; payload: Filter }
  | { type: 'UPDATE_FILTER'; payload: { id: string; updates: Partial<Filter> } }
  | { type: 'REMOVE_FILTER'; payload: string }
  | { type: 'SET_CHART_TYPE'; payload: ChartType }
  | { type: 'UPDATE_VISUALIZATION_SETTINGS'; payload: Partial<VisualizationSettings> }
  | { type: 'SET_ACTIVE_STEP'; payload: number }
  | { type: 'SET_SELECTED_DATA_SOURCE'; payload: string | null }
  | { type: 'SET_SELECTED_DIMENSIONS'; payload: string[] }
  | { type: 'SET_SELECTED_MEASURES'; payload: string[] }
  | { type: 'SET_SELECTED_SEGMENTS'; payload: string[] }
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
    dimensions: { width: 800, height: 400, margin: { top: 20, right: 20, bottom: 30, left: 50 } },
    colors: { scheme: 'categorical', palette: 'category10' },
    axes: { 
      x: { show: true, scale: 'linear', grid: { show: true } },
      y: { show: true, scale: 'linear', grid: { show: true } }
    },
    legends: { show: true, position: 'top', orientation: 'horizontal', padding: 10, itemSpacing: 5, fontSize: 12, fontFamily: 'Arial', color: '#333', interactive: true },
    tooltips: { show: true },
    animations: { enabled: true, duration: 300, easing: 'ease-in-out' },
    interactions: { 
      zoom: { enabled: false, type: 'wheel', extent: [[0, 0], [800, 400]], scaleExtent: [1, 10] },
      pan: { enabled: false, extent: [[0, 0], [800, 400]] },
      brush: { enabled: true, type: 'x', extent: [[0, 0], [800, 400]] },
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
      return {
        ...state,
        visualizationSettings: {
          ...state.visualizationSettings,
          ...action.payload
        },
        isDirty: true
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
      return { ...state, selectedSegments: action.payload };
    
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
    // Only load from cache if no specific report ID is provided
    if (!initialReportId) {
      return loadStateFromCache();
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
  
  // Auto-save functionality
  useEffect(() => {
    if (state.autoSave && state.isDirty && state.isValid && initialReportId) {
      const timeoutId = setTimeout(() => {
        handleSave();
      }, 2000); // Auto-save after 2 seconds of inactivity
      
      return () => clearTimeout(timeoutId);
    }
  }, [state.isDirty, state.isValid, state.autoSave, initialReportId]);
  
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
  
  const removeDimension = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_DIMENSION', payload: id });
  }, []);
  
  const addMeasure = useCallback((measure: Measure) => {
    dispatch({ type: 'ADD_MEASURE', payload: measure });
  }, []);
  
  const updateMeasure = useCallback((id: string, updates: Partial<Measure>) => {
    dispatch({ type: 'UPDATE_MEASURE', payload: { id, updates } });
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
  
  const setChartType = useCallback((chartType: ChartType) => {
    dispatch({ type: 'SET_CHART_TYPE', payload: chartType });
  }, []);
  
  const updateVisualizationSettings = useCallback((settings: Partial<VisualizationSettings>) => {
    dispatch({ type: 'UPDATE_VISUALIZATION_SETTINGS', payload: settings });
  }, []);
  
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
  
  // Save functionality
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
      
      // Add segmentation dimensions if selected
      const segmentDimensions: Dimension[] = [];
      if (state.selectedSegments.length > 0) {
        const primarySource = state.dataSources.find(ds => ds.isPrimary) || state.dataSources[0];
        
        state.selectedSegments.forEach(segmentField => {
          if (!consolidatedDimensions.some(d => d.field === segmentField)) {
            segmentDimensions.push({
              id: `segment_${segmentField}`,
              name: segmentField,
              field: segmentField,
              displayName: segmentField === 'program_id' ? 'Program' : 
                          segmentField === 'site_id' ? 'Site' :
                          segmentField === 'submission_id' ? 'Submission' :
                          segmentField === 'user_id' ? 'User' : segmentField,
              type: 'grouping',
              source: primarySource.id,
              dataType: 'text'
            });
          }
        });
      }
      
      const allDimensions = [...segmentDimensions, ...consolidatedDimensions];
      
      const reportData: any = {
        name: state.name,
        description: state.description,
        category: state.category,
        type: state.type,
        dataSources: state.dataSources,
        dimensions: allDimensions,
        measures: state.measures,
        filters: state.filters,
        segmentBy: state.selectedSegments, // Add segmentBy for SQL query generation
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
      queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
      
      // Clear cache after successful save
      clearStateCache();
    } catch (error) {
      console.error('Error saving report:', error);
      // Re-throw the error so it can be handled by the calling function
      throw error;
    } finally {
      dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  }, [state, initialReportId, updateReport, createReport, queryClient, user, userCompany]);
  
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
      
      // Add segmentation dimensions automatically based on selectedSegments
      const segmentDimensions: Dimension[] = [];
      if (state.selectedSegments.length > 0) {
        // Find the primary data source to use as reference
        const primarySource = state.dataSources.find(ds => ds.isPrimary) || state.dataSources[0];
        
        state.selectedSegments.forEach(segmentField => {
          // Check if dimension already exists
          if (!consolidatedDimensions.some(d => d.field === segmentField)) {
            segmentDimensions.push({
              id: `segment_${segmentField}`,
              name: segmentField,
              field: segmentField,
              displayName: segmentField === 'program_id' ? 'Program' : 
                          segmentField === 'site_id' ? 'Site' :
                          segmentField === 'submission_id' ? 'Submission' :
                          segmentField === 'user_id' ? 'User' : segmentField,
              type: 'grouping',
              source: primarySource.id,
              dataType: 'text'
            });
          }
        });
      }
      
      // Combine regular dimensions with segment dimensions
      const allDimensions = [...segmentDimensions, ...consolidatedDimensions];
      
      // Build report config from current state
      console.log('Debug: generatePreview filters:', state.filters.length, state.filters);
      console.log('Debug: generatePreview segments:', state.selectedSegments);
      console.log('Debug: generatePreview dimensions with segments:', allDimensions.length);
      
      const reportConfig: ReportConfig = {
        id: 'preview',
        name: state.name || 'Preview Report',
        description: state.description || '',
        category: state.category,
        type: state.type,
        dataSources: state.dataSources,
        dimensions: allDimensions,
        measures: state.measures,
        filters: state.filters,
        segmentBy: state.selectedSegments, // Add segmentBy for SQL query generation
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
    removeDimension,
    addMeasure,
    updateMeasure,
    removeMeasure,
    addFilter,
    updateFilter,
    removeFilter,
    setChartType,
    updateVisualizationSettings,
    setActiveStep,
    setSelectedDataSource,
    setSelectedDimensions,
    setSelectedMeasures,
    setSelectedSegments,
    loadReport,
    resetState,
    
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