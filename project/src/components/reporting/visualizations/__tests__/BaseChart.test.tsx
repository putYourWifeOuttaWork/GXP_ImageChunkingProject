import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseChart } from '../base/BaseChart';
import { AggregatedData, VisualizationSettings } from '../../../../types/reporting';

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    append: vi.fn(() => ({
      attr: vi.fn(() => ({ attr: vi.fn() })),
      style: vi.fn(() => ({ style: vi.fn() })),
      call: vi.fn()
    }))
  })),
  scaleLinear: vi.fn(() => ({
    domain: vi.fn(() => ({ range: vi.fn(() => ({ domain: vi.fn(), range: vi.fn() })) })),
    range: vi.fn(() => ({ domain: vi.fn(), range: vi.fn() }))
  })),
  scaleTime: vi.fn(() => ({
    domain: vi.fn(() => ({ range: vi.fn(() => ({ domain: vi.fn(), range: vi.fn() })) })),
    range: vi.fn(() => ({ domain: vi.fn(), range: vi.fn() }))
  })),
  scaleBand: vi.fn(() => ({
    domain: vi.fn(() => ({ range: vi.fn(() => ({ domain: vi.fn(), range: vi.fn(), bandwidth: vi.fn() })) })),
    range: vi.fn(() => ({ domain: vi.fn(), range: vi.fn(), bandwidth: vi.fn() })),
    bandwidth: vi.fn(() => 50)
  })),
  axisBottom: vi.fn(() => vi.fn()),
  axisLeft: vi.fn(() => vi.fn()),
  line: vi.fn(() => ({
    x: vi.fn(() => ({ y: vi.fn(() => ({ defined: vi.fn(() => vi.fn()) })) })),
    y: vi.fn(() => ({ defined: vi.fn(() => vi.fn()) })),
    defined: vi.fn(() => vi.fn())
  })),
  extent: vi.fn(() => [0, 100]),
  max: vi.fn(() => 100),
  min: vi.fn(() => 0)
}));

describe('BaseChart', () => {
  const mockData: AggregatedData = {
    data: [
      {
        dimensions: { 'Created Date': '2025-07-01' },
        measures: { 'Growth Index': 85, 'Indoor Temperature': 22.5 }
      },
      {
        dimensions: { 'Created Date': '2025-07-02' },
        measures: { 'Growth Index': 90, 'Indoor Temperature': 23.0 }
      }
    ],
    totalCount: 2,
    filteredCount: 2,
    executionTime: 100,
    cacheHit: false,
    metadata: {
      lastUpdated: new Date().toISOString(),
      dimensions: [
        {
          id: 'created_date',
          name: 'Created Date',
          field: 'created_at',
          displayName: 'Created Date',
          dataSource: 'petri_obs',
          dataType: 'date',
          source: 'petri_obs'
        }
      ],
      measures: [
        {
          id: 'growth_index',
          name: 'Growth Index',
          field: 'growth_index',
          dataSource: 'petri_obs',
          aggregation: 'avg',
          dataType: 'number',
          displayName: 'Average Growth Index'
        }
      ],
      filters: []
    }
  };

  const mockSettings: VisualizationSettings = {
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
  };

  it('renders line chart without crashing', () => {
    render(
      <BaseChart
        data={mockData}
        settings={mockSettings}
        chartType="line"
      />
    );
    
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders bar chart without crashing', () => {
    render(
      <BaseChart
        data={mockData}
        settings={mockSettings}
        chartType="bar"
      />
    );
    
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    const emptyData: AggregatedData = {
      ...mockData,
      data: []
    };

    render(
      <BaseChart
        data={emptyData}
        settings={mockSettings}
        chartType="line"
      />
    );
    
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('handles data with null values', () => {
    const dataWithNulls: AggregatedData = {
      ...mockData,
      data: [
        {
          dimensions: { 'Created Date': '2025-07-01' },
          measures: { 'Growth Index': null, 'Indoor Temperature': 22.5 }
        },
        {
          dimensions: { 'Created Date': '2025-07-02' },
          measures: { 'Growth Index': 90, 'Indoor Temperature': null }
        }
      ]
    };

    render(
      <BaseChart
        data={dataWithNulls}
        settings={mockSettings}
        chartType="line"
      />
    );
    
    // Should not crash and render the chart
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('handles data with invalid string values', () => {
    const dataWithInvalidValues: AggregatedData = {
      ...mockData,
      data: [
        {
          dimensions: { 'Created Date': '2025-07-01' },
          measures: { 'Growth Index': '-', 'Indoor Temperature': 22.5 }
        },
        {
          dimensions: { 'Created Date': '2025-07-02' },
          measures: { 'Growth Index': 90, 'Indoor Temperature': '' }
        }
      ]
    };

    render(
      <BaseChart
        data={dataWithInvalidValues}
        settings={mockSettings}
        chartType="line"
      />
    );
    
    // Should not crash and render the chart
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders multi-series data correctly', () => {
    const multiSeriesData: AggregatedData = {
      ...mockData,
      data: [
        {
          dimensions: { 'Created Date': '2025-07-01' },
          measures: { 'Growth Index': 85, 'Indoor Temperature': 22.5 }
        },
        {
          dimensions: { 'Created Date': '2025-07-02' },
          measures: { 'Growth Index': 90, 'Indoor Temperature': 23.0 }
        }
      ]
    };

    render(
      <BaseChart
        data={multiSeriesData}
        settings={mockSettings}
        chartType="line"
      />
    );
    
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});