import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReportBuilder } from '../useReportBuilder';

// Mock dependencies
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'test-user', email: 'test@example.com' }
  }))
}));

vi.mock('../../useCompanies', () => ({
  useCompanies: vi.fn(() => ({
    userCompany: { company_id: 'test-company-uuid' }
  }))
}));

vi.mock('../useReportData', () => ({
  useCreateReport: vi.fn(() => ({
    mutateAsync: vi.fn(() => Promise.resolve({ id: 'new-report-id' })),
    isPending: false
  })),
  useUpdateReport: vi.fn(() => ({
    mutateAsync: vi.fn(() => Promise.resolve({ id: 'updated-report-id' })),
    isPending: false
  })),
  reportQueryKeys: {
    lists: vi.fn(() => ['reports', 'list'])
  }
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn()
  }))
}));

vi.mock('../../../services/reportingDataService', () => ({
  ReportingDataService: {
    getAvailableDimensions: vi.fn(() => []),
    getAvailableMeasures: vi.fn(() => []),
    executeReport: vi.fn(() => Promise.resolve({
      data: [],
      totalCount: 0,
      filteredCount: 0,
      executionTime: 0,
      cacheHit: false,
      metadata: {
        lastUpdated: new Date().toISOString(),
        dimensions: [],
        measures: [],
        filters: []
      }
    }))
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('useReportBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useReportBuilder());

    expect(result.current.state.name).toBe('');
    expect(result.current.state.description).toBe('');
    expect(result.current.state.dataSources).toEqual([]);
    expect(result.current.state.dimensions).toEqual([]);
    expect(result.current.state.measures).toEqual([]);
    expect(result.current.state.filters).toEqual([]);
    expect(result.current.state.chartType).toBe('line');
  });

  it('should set report name', () => {
    const { result } = renderHook(() => useReportBuilder());

    act(() => {
      result.current.setName('Test Report');
    });

    expect(result.current.state.name).toBe('Test Report');
  });

  it('should set report description', () => {
    const { result } = renderHook(() => useReportBuilder());

    act(() => {
      result.current.setDescription('Test Description');
    });

    expect(result.current.state.description).toBe('Test Description');
  });

  it('should add data source', () => {
    const { result } = renderHook(() => useReportBuilder());

    const testDataSource = {
      id: 'test-source',
      name: 'Test Source',
      table: 'test_table',
      type: 'table' as const,
      fields: []
    };

    act(() => {
      result.current.addDataSource(testDataSource);
    });

    expect(result.current.state.dataSources).toContain(testDataSource);
  });

  it('should remove data source', () => {
    const { result } = renderHook(() => useReportBuilder());

    const testDataSource = {
      id: 'test-source',
      name: 'Test Source',
      table: 'test_table',
      type: 'table' as const,
      fields: []
    };

    act(() => {
      result.current.addDataSource(testDataSource);
    });

    expect(result.current.state.dataSources).toContain(testDataSource);

    act(() => {
      result.current.removeDataSource('test-source');
    });

    expect(result.current.state.dataSources).not.toContain(testDataSource);
  });

  it('should add dimension', () => {
    const { result } = renderHook(() => useReportBuilder());

    const testDimension = {
      id: 'test-dimension',
      name: 'Test Dimension',
      field: 'test_field',
      displayName: 'Test Dimension',
      dataSource: 'test-source',
      dataType: 'string' as const,
      source: 'test-source'
    };

    act(() => {
      result.current.addDimension(testDimension);
    });

    expect(result.current.state.dimensions).toContain(testDimension);
  });

  it('should add measure', () => {
    const { result } = renderHook(() => useReportBuilder());

    const testMeasure = {
      id: 'test-measure',
      name: 'Test Measure',
      field: 'test_field',
      dataSource: 'test-source',
      aggregation: 'avg' as const,
      dataType: 'number' as const,
      displayName: 'Test Measure'
    };

    act(() => {
      result.current.addMeasure(testMeasure);
    });

    expect(result.current.state.measures).toContain(testMeasure);
  });

  it('should add filter', () => {
    const { result } = renderHook(() => useReportBuilder());

    const testFilter = {
      id: 'test-filter',
      name: 'Test Filter',
      field: 'test_field',
      dataSource: 'test-source',
      type: 'text' as const,
      operator: 'equals' as const,
      value: 'test-value',
      label: 'Test Filter'
    };

    act(() => {
      result.current.addFilter(testFilter);
    });

    expect(result.current.state.filters).toContain(testFilter);
  });

  it('should remove filter', () => {
    const { result } = renderHook(() => useReportBuilder());

    const testFilter = {
      id: 'test-filter',
      name: 'Test Filter',
      field: 'test_field',
      dataSource: 'test-source',
      type: 'text' as const,
      operator: 'equals' as const,
      value: 'test-value',
      label: 'Test Filter'
    };

    act(() => {
      result.current.addFilter(testFilter);
    });

    expect(result.current.state.filters).toContain(testFilter);

    act(() => {
      result.current.removeFilter('test-filter');
    });

    expect(result.current.state.filters).not.toContain(testFilter);
  });

  it('should reset state', () => {
    const { result } = renderHook(() => useReportBuilder());

    // Add some data
    act(() => {
      result.current.setName('Test Report');
      result.current.setDescription('Test Description');
    });

    expect(result.current.state.name).toBe('Test Report');
    expect(result.current.state.description).toBe('Test Description');

    // Reset state
    act(() => {
      result.current.resetState();
    });

    expect(result.current.state.name).toBe('');
    expect(result.current.state.description).toBe('');
    expect(result.current.state.dataSources).toEqual([]);
    expect(result.current.state.dimensions).toEqual([]);
    expect(result.current.state.measures).toEqual([]);
    expect(result.current.state.filters).toEqual([]);
  });

  it('should clear localStorage cache on reset', () => {
    const { result } = renderHook(() => useReportBuilder());

    act(() => {
      result.current.resetState();
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('gasx_report_builder_state');
  });

  it('should indicate if report is valid', () => {
    const { result } = renderHook(() => useReportBuilder());

    // Initially invalid
    expect(result.current.state.isValid).toBe(false);

    // Add required data
    act(() => {
      result.current.setName('Test Report');
      result.current.addDataSource({
        id: 'test-source',
        name: 'Test Source',
        table: 'test_table',
        type: 'table',
        fields: []
      });
      result.current.addMeasure({
        id: 'test-measure',
        name: 'Test Measure',
        field: 'test_field',
        dataSource: 'test-source',
        aggregation: 'avg',
        dataType: 'number',
        displayName: 'Test Measure'
      });
    });

    // Should be valid now
    expect(result.current.state.isValid).toBe(true);
  });

  it('should track if report has changes', () => {
    const { result } = renderHook(() => useReportBuilder());

    // Initially no changes
    expect(result.current.hasChanges).toBe(false);

    // Make a change
    act(() => {
      result.current.setName('Test Report');
    });

    // Should have changes now
    expect(result.current.hasChanges).toBe(true);
  });

  it('should cache state to localStorage', () => {
    const { result } = renderHook(() => useReportBuilder());

    act(() => {
      result.current.setName('Test Report');
    });

    // Should have called setItem to cache the state
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'gasx_report_builder_state',
      expect.stringContaining('Test Report')
    );
  });

  it('should load state from localStorage cache', () => {
    const cachedState = {
      state: {
        name: 'Cached Report',
        description: 'Cached Description',
        category: 'analytics',
        type: 'chart',
        dataSources: [],
        dimensions: [],
        measures: [],
        filters: [],
        chartType: 'line',
        visualizationSettings: {},
        isDirty: false,
        isValid: false,
        isLoading: false,
        errors: {},
        warnings: {},
        lastSaved: null
      },
      reportId: null,
      timestamp: Date.now(),
      version: '1.0'
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedState));

    const { result } = renderHook(() => useReportBuilder());

    expect(result.current.state.name).toBe('Cached Report');
    expect(result.current.state.description).toBe('Cached Description');
  });
});