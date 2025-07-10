import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportingDataService } from '../reportingDataService';
import { ReportConfig } from '../../types/reporting';

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

describe('ReportingDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildQuery', () => {
    it('should build correct SQL query for basic report', () => {
      const config: ReportConfig = {
        id: 'test',
        name: 'Test Report',
        description: 'Test',
        category: 'analytics',
        type: 'chart',
        dataSources: [
          {
            id: 'petri_obs',
            name: 'Petri Observations',
            table: 'petri_observations',
            type: 'table',
            fields: []
          }
        ],
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
        filters: [],
        chartType: 'line',
        visualizationSettings: {},
        createdByUserId: 'test-user',
        companyId: 'test-company',
        programIds: [],
        isPublic: false,
        isTemplate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const query = (ReportingDataService as any).buildQuery(config);
      
      expect(query).toContain('SELECT');
      expect(query).toContain('created_at as Created Date');
      expect(query).toContain('AVG(petri_obs.growth_index) as Growth Index');
      expect(query).toContain('FROM petri_observations as petri_obs');
    });

    it('should handle filters correctly', () => {
      const config: ReportConfig = {
        id: 'test',
        name: 'Test Report',
        description: 'Test',
        category: 'analytics',
        type: 'chart',
        dataSources: [
          {
            id: 'petri_obs',
            name: 'Petri Observations',
            table: 'petri_observations',
            type: 'table',
            fields: []
          }
        ],
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
        filters: [
          {
            id: 'test-filter',
            name: 'Test Filter',
            field: 'fungicide_used',
            dataSource: 'petri_obs',
            type: 'text',
            operator: 'equals',
            value: 'Yes',
            label: 'Fungicide Used'
          }
        ],
        chartType: 'line',
        visualizationSettings: {},
        createdByUserId: 'test-user',
        companyId: 'test-company',
        programIds: [],
        isPublic: false,
        isTemplate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const query = (ReportingDataService as any).buildQuery(config);
      
      expect(query).toContain('WHERE');
      expect(query).toContain("fungicide_used = 'Yes'");
    });
  });

  describe('buildFilterClause', () => {
    it('should build correct filter clause for equals operator', () => {
      const filter = {
        id: 'test-filter',
        name: 'Test Filter',
        field: 'fungicide_used',
        dataSource: 'petri_obs',
        type: 'text' as const,
        operator: 'equals' as const,
        value: 'Yes',
        label: 'Fungicide Used'
      };

      const clause = (ReportingDataService as any).buildFilterClause(filter);
      expect(clause).toBe("fungicide_used = 'Yes'");
    });

    it('should build correct filter clause for contains operator', () => {
      const filter = {
        id: 'test-filter',
        name: 'Test Filter',
        field: 'notes',
        dataSource: 'petri_obs',
        type: 'text' as const,
        operator: 'contains' as const,
        value: 'test',
        label: 'Notes Contains'
      };

      const clause = (ReportingDataService as any).buildFilterClause(filter);
      expect(clause).toBe("notes ILIKE '%test%'");
    });

    it('should build correct filter clause for range operator', () => {
      const filter = {
        id: 'test-filter',
        name: 'Test Filter',
        field: 'growth_index',
        dataSource: 'petri_obs',
        type: 'number' as const,
        operator: 'between' as const,
        value: '10,20',
        label: 'Growth Index Range'
      };

      const clause = (ReportingDataService as any).buildFilterClause(filter);
      expect(clause).toBe("growth_index >= 10 AND growth_index <= 20");
    });
  });

  describe('processQueryResults', () => {
    it('should process raw database results correctly', () => {
      const rawData = [
        {
          created_at: '2025-07-01',
          growth_index: 85,
          indoor_temperature: 22.5
        },
        {
          created_at: '2025-07-02',
          growth_index: 90,
          indoor_temperature: 23.0
        }
      ];

      const config: ReportConfig = {
        id: 'test',
        name: 'Test Report',
        description: 'Test',
        category: 'analytics',
        type: 'chart',
        dataSources: [
          {
            id: 'petri_obs',
            name: 'Petri Observations',
            table: 'petri_observations',
            type: 'table',
            fields: []
          }
        ],
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
        filters: [],
        chartType: 'line',
        visualizationSettings: {},
        createdByUserId: 'test-user',
        companyId: 'test-company',
        programIds: [],
        isPublic: false,
        isTemplate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = (ReportingDataService as any).processQueryResults(rawData, config);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        dimensions: expect.objectContaining({
          'Created Date': '2025-07-01'
        }),
        measures: expect.objectContaining({
          'Growth Index': 85
        })
      });
    });

    it('should handle null and undefined values', () => {
      const rawData = [
        {
          created_at: '2025-07-01',
          growth_index: null,
          indoor_temperature: undefined
        },
        {
          created_at: '2025-07-02',
          growth_index: '',
          indoor_temperature: '-'
        }
      ];

      const config: ReportConfig = {
        id: 'test',
        name: 'Test Report',
        description: 'Test',
        category: 'analytics',
        type: 'chart',
        dataSources: [
          {
            id: 'petri_obs',
            name: 'Petri Observations',
            table: 'petri_observations',
            type: 'table',
            fields: []
          }
        ],
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
        filters: [],
        chartType: 'line',
        visualizationSettings: {},
        createdByUserId: 'test-user',
        companyId: 'test-company',
        programIds: [],
        isPublic: false,
        isTemplate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = (ReportingDataService as any).processQueryResults(rawData, config);
      
      expect(result).toHaveLength(2);
      expect(result[0].measures['Growth Index']).toBe(null);
      expect(result[1].measures['Growth Index']).toBe('');
    });
  });
});