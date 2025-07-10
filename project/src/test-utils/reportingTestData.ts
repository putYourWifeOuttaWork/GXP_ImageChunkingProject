import { ReportConfig, DataSource, Dimension, Measure, Filter, AggregatedData } from '../types/reporting';

export const createMockDataSource = (overrides: Partial<DataSource> = {}): DataSource => ({
  id: 'test-source',
  name: 'Test Data Source',
  table: 'test_table',
  type: 'table',
  fields: [
    {
      name: 'id',
      type: 'uuid',
      displayName: 'ID'
    },
    {
      name: 'created_at',
      type: 'timestamp',
      displayName: 'Created Date'
    },
    {
      name: 'growth_index',
      type: 'number',
      displayName: 'Growth Index'
    },
    {
      name: 'indoor_temperature',
      type: 'number',
      displayName: 'Indoor Temperature'
    },
    {
      name: 'fungicide_used',
      type: 'text',
      displayName: 'Fungicide Used'
    }
  ],
  ...overrides
});

export const createMockDimension = (overrides: Partial<Dimension> = {}): Dimension => ({
  id: 'test-dimension',
  name: 'Test Dimension',
  field: 'created_at',
  displayName: 'Created Date',
  dataSource: 'test-source',
  dataType: 'date',
  source: 'test-source',
  ...overrides
});

export const createMockMeasure = (overrides: Partial<Measure> = {}): Measure => ({
  id: 'test-measure',
  name: 'Test Measure',
  field: 'growth_index',
  dataSource: 'test-source',
  aggregation: 'avg',
  dataType: 'number',
  displayName: 'Average Growth Index',
  ...overrides
});

export const createMockFilter = (overrides: Partial<Filter> = {}): Filter => ({
  id: 'test-filter',
  name: 'Test Filter',
  field: 'fungicide_used',
  dataSource: 'test-source',
  type: 'text',
  operator: 'equals',
  value: 'Yes',
  label: 'Fungicide Used',
  ...overrides
});

export const createMockReportConfig = (overrides: Partial<ReportConfig> = {}): ReportConfig => ({
  id: 'test-report',
  name: 'Test Report',
  description: 'Test Report Description',
  category: 'analytics',
  type: 'chart',
  dataSources: [createMockDataSource()],
  dimensions: [createMockDimension()],
  measures: [createMockMeasure()],
  filters: [],
  chartType: 'line',
  visualizationSettings: {
    chartType: 'line',
    dimensions: {
      width: 800,
      height: 400,
      margin: { top: 20, right: 20, bottom: 30, left: 50 }
    },
    colors: {
      scheme: 'categorical',
      palette: 'category10'
    },
    axes: {
      x: { show: true, scale: 'linear', grid: { show: true } },
      y: { show: true, scale: 'linear', grid: { show: true } }
    },
    legends: {
      show: true,
      position: 'top'
    }
  },
  createdByUserId: 'test-user',
  companyId: 'test-company',
  programIds: [],
  isPublic: false,
  isTemplate: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockAggregatedData = (overrides: Partial<AggregatedData> = {}): AggregatedData => ({
  data: [
    {
      dimensions: { 'Created Date': '2025-07-01' },
      measures: { 'Average Growth Index': 85, 'Indoor Temperature': 22.5 }
    },
    {
      dimensions: { 'Created Date': '2025-07-02' },
      measures: { 'Average Growth Index': 90, 'Indoor Temperature': 23.0 }
    },
    {
      dimensions: { 'Created Date': '2025-07-03' },
      measures: { 'Average Growth Index': 88, 'Indoor Temperature': 22.8 }
    }
  ],
  totalCount: 3,
  filteredCount: 3,
  executionTime: 150,
  cacheHit: false,
  metadata: {
    lastUpdated: new Date().toISOString(),
    dimensions: [createMockDimension()],
    measures: [createMockMeasure()],
    filters: []
  },
  ...overrides
});

export const createMockAggregatedDataWithNulls = (): AggregatedData => ({
  data: [
    {
      dimensions: { 'Created Date': '2025-07-01' },
      measures: { 'Average Growth Index': 85, 'Indoor Temperature': null }
    },
    {
      dimensions: { 'Created Date': '2025-07-02' },
      measures: { 'Average Growth Index': null, 'Indoor Temperature': 23.0 }
    },
    {
      dimensions: { 'Created Date': '2025-07-03' },
      measures: { 'Average Growth Index': '-', 'Indoor Temperature': '' }
    }
  ],
  totalCount: 3,
  filteredCount: 3,
  executionTime: 150,
  cacheHit: false,
  metadata: {
    lastUpdated: new Date().toISOString(),
    dimensions: [createMockDimension()],
    measures: [createMockMeasure()],
    filters: []
  }
});

export const createMockAggregatedDataEmpty = (): AggregatedData => ({
  data: [],
  totalCount: 0,
  filteredCount: 0,
  executionTime: 50,
  cacheHit: false,
  metadata: {
    lastUpdated: new Date().toISOString(),
    dimensions: [],
    measures: [],
    filters: []
  }
});

// Test scenarios for common edge cases
export const createTestScenarios = () => ({
  validData: createMockAggregatedData(),
  dataWithNulls: createMockAggregatedDataWithNulls(),
  emptyData: createMockAggregatedDataEmpty(),
  singleDataPoint: createMockAggregatedData({
    data: [
      {
        dimensions: { 'Created Date': '2025-07-01' },
        measures: { 'Average Growth Index': 85, 'Indoor Temperature': 22.5 }
      }
    ],
    totalCount: 1,
    filteredCount: 1
  }),
  multiSeriesData: createMockAggregatedData({
    data: [
      {
        dimensions: { 'Created Date': '2025-07-01' },
        measures: { 
          'Average Growth Index': 85, 
          'Indoor Temperature': 22.5,
          'Outdoor Temperature': 28.0,
          'Humidity': 65
        }
      },
      {
        dimensions: { 'Created Date': '2025-07-02' },
        measures: { 
          'Average Growth Index': 90, 
          'Indoor Temperature': 23.0,
          'Outdoor Temperature': 29.5,
          'Humidity': 68
        }
      }
    ]
  })
});

// Helper function to create test data with specific characteristics
export const createTestDataWithCharacteristics = (characteristics: {
  hasNulls?: boolean;
  hasEmptyStrings?: boolean;
  hasDashes?: boolean;
  hasZeros?: boolean;
  hasNegatives?: boolean;
  seriesCount?: number;
  dataPointCount?: number;
}) => {
  const { 
    hasNulls = false,
    hasEmptyStrings = false,
    hasDashes = false,
    hasZeros = false,
    hasNegatives = false,
    seriesCount = 2,
    dataPointCount = 3
  } = characteristics;

  const data = [];
  
  for (let i = 0; i < dataPointCount; i++) {
    const dataPoint: any = {
      dimensions: { 'Created Date': `2025-07-${String(i + 1).padStart(2, '0')}` },
      measures: {}
    };

    // Add measure series
    for (let j = 0; j < seriesCount; j++) {
      const measureName = j === 0 ? 'Average Growth Index' : `Measure ${j + 1}`;
      let value: any = 80 + Math.random() * 20; // Random value between 80-100

      // Apply characteristics
      if (hasNulls && i === 0 && j === 0) {
        value = null;
      } else if (hasEmptyStrings && i === 1 && j === 0) {
        value = '';
      } else if (hasDashes && i === 2 && j === 0) {
        value = '-';
      } else if (hasZeros && i === 0 && j === 1) {
        value = 0;
      } else if (hasNegatives && i === 1 && j === 1) {
        value = -5;
      }

      dataPoint.measures[measureName] = value;
    }

    data.push(dataPoint);
  }

  return createMockAggregatedData({
    data,
    totalCount: dataPointCount,
    filteredCount: dataPointCount
  });
};