import { useState, useCallback, useReducer, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  ReportConfiguration, 
  Dimension, 
  Measure, 
  Filter, 
  DataSource,
  ChartType,
  VisualizationSettings
} from '../../types/reporting';
import { useCreateReport, useUpdateReport, reportQueryKeys } from './useReportData';

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
    legends: { show: true, position: 'right', orientation: 'vertical', padding: 10, itemSpacing: 5, fontSize: 12, fontFamily: 'Arial', color: '#333', interactive: true },
    tooltips: { show: true },
    animations: { enabled: true, duration: 300, easing: 'ease-in-out' },
    interactions: { 
      zoom: { enabled: false, type: 'wheel', extent: [[0, 0], [800, 400]], scaleExtent: [1, 10] },
      pan: { enabled: false, extent: [[0, 0], [800, 400]] },
      brush: { enabled: false, type: 'x', extent: [[0, 0], [800, 400]] },
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
      return {
        ...state,
        dataSources: [...state.dataSources, action.payload],
        isDirty: true
      };
    
    case 'UPDATE_DATA_SOURCE':
      return {
        ...state,
        dataSources: state.dataSources.map(ds => 
          ds.id === action.payload.id ? { ...ds, ...action.payload.updates } : ds
        ),
        isDirty: true
      };
    
    case 'REMOVE_DATA_SOURCE':
      return {
        ...state,
        dataSources: state.dataSources.filter(ds => ds.id !== action.payload),
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
  const [state, dispatch] = useReducer(reportBuilderReducer, initialState);
  const queryClient = useQueryClient();
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  
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
  
  const loadReport = useCallback((report: ReportConfiguration) => {
    dispatch({ type: 'LOAD_REPORT', payload: report });
  }, []);
  
  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);
  
  // Save functionality
  const handleSave = useCallback(async () => {
    if (!state.isValid) return;
    
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    
    try {
      const reportData: any = {
        name: state.name,
        description: state.description,
        category: state.category,
        type: state.type,
        dataSources: state.dataSources,
        dimensions: state.dimensions,
        measures: state.measures,
        filters: state.filters,
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
          createdByUserId: 'current-user-id', // TODO: Get from auth
          companyId: 'current-company-id', // TODO: Get from auth
          programIds: [],
          isPublic: false,
          isTemplate: false,
        });
      }
      
      dispatch({ type: 'SET_LAST_SAVED', payload: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: reportQueryKeys.lists() });
    } catch (error) {
      console.error('Error saving report:', error);
    } finally {
      dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  }, [state, initialReportId, updateReport, createReport, queryClient]);
  
  // Preview functionality
  const generatePreview = useCallback(async () => {
    if (!state.isValid) return;
    
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    
    try {
      // Generate preview data based on current configuration
      // This would typically involve executing a query with the current settings
      const previewData = {
        data: [], // Mock data for now
        metadata: {
          dimensions: state.dimensions,
          measures: state.measures,
          lastUpdated: new Date().toISOString(),
        },
        totalCount: 0,
        executionTime: 0,
      };
      
      dispatch({ type: 'SET_PREVIEW_DATA', payload: previewData });
    } catch (error) {
      console.error('Error generating preview:', error);
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
    loadReport,
    resetState,
    
    // Operations
    save: handleSave,
    generatePreview,
    
    // Computed properties
    canSave: state.isValid && state.isDirty,
    hasChanges: state.isDirty,
    isLoading: state.isLoading || createReport.isPending || updateReport.isPending,
  };
};