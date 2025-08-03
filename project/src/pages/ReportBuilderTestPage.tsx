import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from '../components/common/Button';

const ReportBuilderTestPage: React.FC = () => {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const endTime = Date.now();
      
      setTestResults(prev => [...prev, {
        name: testName,
        success: true,
        result,
        duration: endTime - startTime,
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      const endTime = Date.now();
      console.error(`Test ${testName} failed:`, err);
      
      setTestResults(prev => [...prev, {
        name: testName,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: endTime - startTime,
        timestamp: new Date().toISOString()
      }]);
      
      setError(`Test ${testName} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const testSitesQuery = async () => {
    console.log('Testing Sites query...');
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    console.log('Sites data:', data);
    return { count: data?.length || 0, sample: data?.[0] };
  };

  const testSubmissionsQuery = async () => {
    console.log('Testing Submissions query...');
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    console.log('Submissions data:', data);
    return { count: data?.length || 0, sample: data?.[0] };
  };

  const testProgramsQuery = async () => {
    console.log('Testing Pilot Programs query...');
    const { data, error } = await supabase
      .from('pilot_programs')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    console.log('Pilot Programs data:', data);
    return { count: data?.length || 0, sample: data?.[0] };
  };

  const testSitesWithJoins = async () => {
    console.log('Testing Sites with joins...');
    const { data, error } = await supabase
      .from('sites')
      .select(`
        *,
        pilot_programs (
          program_name,
          status
        )
      `)
      .limit(5);
    
    if (error) throw error;
    console.log('Sites with programs:', data);
    return { count: data?.length || 0, sample: data?.[0] };
  };

  const testPetriObservationsView = async () => {
    console.log('Testing Petri Observations View...');
    const { data, error } = await supabase
      .from('petri_observations_with_names')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    console.log('Petri observations view:', data);
    return { count: data?.length || 0, sample: data?.[0] };
  };

  const clearTests = () => {
    setTestResults([]);
    setError(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Report Builder Debug Tests</h1>
      
      <div className="mb-6 space-x-4">
        <Button
          onClick={() => runTest('Sites Table', testSitesQuery)}
          disabled={loading}
        >
          Test Sites
        </Button>
        
        <Button
          onClick={() => runTest('Submissions Table', testSubmissionsQuery)}
          disabled={loading}
        >
          Test Submissions
        </Button>
        
        <Button
          onClick={() => runTest('Pilot Programs Table', testProgramsQuery)}
          disabled={loading}
        >
          Test Programs
        </Button>
        
        <Button
          onClick={() => runTest('Sites with Joins', testSitesWithJoins)}
          disabled={loading}
        >
          Test Sites + Programs
        </Button>
        
        <Button
          onClick={() => runTest('Petri View', testPetriObservationsView)}
          disabled={loading}
        >
          Test Petri View
        </Button>
        
        <Button
          onClick={clearTests}
          variant="secondary"
        >
          Clear Results
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-4 p-4 bg-blue-50 text-blue-800 rounded-lg">
          Running test...
        </div>
      )}

      <div className="space-y-4">
        {testResults.map((test, index) => (
          <div 
            key={index} 
            className={`p-4 rounded-lg border ${
              test.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold">
                {test.success ? '✅' : '❌'} {test.name}
              </h3>
              <span className="text-sm text-gray-600">
                {test.duration}ms - {new Date(test.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            {test.success ? (
              <div>
                <p className="text-sm text-gray-700">
                  Records: {test.result.count}
                </p>
                {test.result.sample && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-blue-600">
                      View sample data
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                      {JSON.stringify(test.result.sample, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-700">{test.error}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="font-semibold mb-2">Debug Information</h2>
        <p className="text-sm text-gray-700 mb-2">
          This page helps debug data source issues in the report builder.
        </p>
        <p className="text-sm text-gray-700">
          Each test queries a different table to verify:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 mt-2">
          <li>Table exists and is accessible</li>
          <li>Field names match expected schema</li>
          <li>Data can be retrieved successfully</li>
          <li>Joins work correctly</li>
        </ul>
      </div>
    </div>
  );
};

export default ReportBuilderTestPage;