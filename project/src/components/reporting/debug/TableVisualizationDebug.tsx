import React from 'react';
import { TableVisualization } from '../visualizations/TableVisualization';
import { AggregatedData } from '../../../types/reporting';

// Test data that simulates what would come from the Sites table
const testSitesData: AggregatedData = {
  data: [
    {
      dimensions: {
        site_id: 'site-001',
        name: 'Test Site 1',
        site_type: 'Indoor',
        location: 'Building A'
      },
      measures: {},
      site_id: 'site-001',
      name: 'Test Site 1',
      site_type: 'Indoor',
      location: 'Building A',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      dimensions: {
        site_id: 'site-002',
        name: 'Test Site 2',
        site_type: 'Outdoor',
        location: 'Field B'
      },
      measures: {},
      site_id: 'site-002',
      name: 'Test Site 2',
      site_type: 'Outdoor',
      location: 'Field B',
      created_at: '2024-01-02T00:00:00Z'
    }
  ],
  totalCount: 2,
  filteredCount: 2,
  executionTime: 100,
  cacheHit: false,
  metadata: {
    lastUpdated: new Date().toISOString(),
    dimensions: [
      { field: 'site_id', label: 'Site ID' },
      { field: 'name', label: 'Site Name' },
      { field: 'site_type', label: 'Site Type' },
      { field: 'location', label: 'Location' }
    ],
    measures: [],
    filters: [],
    segments: []
  }
};

export const TableVisualizationDebug: React.FC = () => {
  const [error, setError] = React.useState<Error | null>(null);

  // Error boundary to catch rendering errors
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Caught error:', event.error);
      setError(event.error);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg">
        <h2 className="text-red-800 font-semibold mb-2">Error in TableVisualization</h2>
        <p className="text-red-700">{error.message}</p>
        <pre className="mt-4 p-4 bg-red-100 rounded text-xs overflow-auto">
          {error.stack}
        </pre>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Table Visualization Debug</h1>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="font-semibold mb-2">Test Data Structure</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(testSitesData, null, 2)}
        </pre>
      </div>

      <div className="bg-white rounded-lg shadow">
        <h2 className="font-semibold p-4 border-b">Table Visualization Component</h2>
        <TableVisualization
          data={testSitesData}
          settings={{}}
          className="p-4"
        />
      </div>
    </div>
  );
};

export default TableVisualizationDebug;