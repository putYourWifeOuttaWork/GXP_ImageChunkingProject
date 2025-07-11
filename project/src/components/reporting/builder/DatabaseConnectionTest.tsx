import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, Database } from 'lucide-react';
import Button from '../../common/Button';
import { supabase } from '../../../lib/supabaseClient';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

export const DatabaseConnectionTest: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'get_table_columns', status: 'pending', message: 'Testing...' },
    { name: 'execute_raw_sql', status: 'pending', message: 'Testing...' }
  ]);
  
  const runTests = async () => {
    // Reset tests
    setTests([
      { name: 'get_table_columns', status: 'pending', message: 'Testing...' },
      { name: 'execute_raw_sql', status: 'pending', message: 'Testing...' }
    ]);
    
    // Test get_table_columns
    try {
      const { data, error } = await supabase.rpc('get_table_columns', { 
        table_name: 'petri_observations' 
      });
      
      setTests(prev => prev.map(test => 
        test.name === 'get_table_columns' 
          ? {
              ...test,
              status: error ? 'error' : 'success',
              message: error 
                ? `Error: ${error.message}` 
                : `Success! Found ${data?.length || 0} columns`
            }
          : test
      ));
    } catch (err) {
      setTests(prev => prev.map(test => 
        test.name === 'get_table_columns' 
          ? { ...test, status: 'error', message: 'Function not found' }
          : test
      ));
    }
    
    // Test execute_raw_sql
    try {
      const { data, error } = await supabase.rpc('execute_raw_sql', { 
        query: 'SELECT COUNT(*) as count FROM petri_observations LIMIT 1' 
      });
      
      setTests(prev => prev.map(test => 
        test.name === 'execute_raw_sql' 
          ? {
              ...test,
              status: error ? 'error' : 'success',
              message: error 
                ? `Error: ${error.message}` 
                : `Success! Query executed`
            }
          : test
      ));
    } catch (err) {
      setTests(prev => prev.map(test => 
        test.name === 'execute_raw_sql' 
          ? { ...test, status: 'error', message: 'Function not found' }
          : test
      ));
    }
  };
  
  useEffect(() => {
    runTests();
  }, []);
  
  const allTestsPassed = tests.every(test => test.status === 'success');
  
  if (!isVisible) return null;
  
  return (
    <div className={`mb-4 border rounded-lg p-4 ${
      allTestsPassed ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Database size={20} className="text-gray-600" />
          <h4 className="text-sm font-medium text-gray-900">
            Database Function Status
          </h4>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={runTests}
          >
            Retest
          </Button>
          {allTestsPassed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="text-gray-500"
            >
              Hide
            </Button>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        {tests.map(test => (
          <div key={test.name} className="flex items-center space-x-2 text-sm">
            {test.status === 'success' ? (
              <CheckCircle size={16} className="text-green-600" />
            ) : test.status === 'error' ? (
              <XCircle size={16} className="text-red-600" />
            ) : (
              <RefreshCw size={16} className="text-gray-400 animate-spin" />
            )}
            <span className="font-mono text-xs">{test.name}:</span>
            <span className={`text-xs ${
              test.status === 'success' ? 'text-green-700' : 
              test.status === 'error' ? 'text-red-700' : 
              'text-gray-600'
            }`}>
              {test.message}
            </span>
          </div>
        ))}
      </div>
      
      {allTestsPassed && (
        <div className="mt-3 text-xs text-green-700">
          All database functions are working correctly! You can now use all reporting features.
        </div>
      )}
    </div>
  );
};