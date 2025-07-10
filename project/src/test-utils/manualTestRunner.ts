import { ReportingDataService } from '../services/reportingDataService';
import { createMockReportConfig, createTestDataWithCharacteristics } from './reportingTestData';

// Manual test runner for debugging the reporting issues
export class ManualTestRunner {
  
  /**
   * Test the SQL query generation
   */
  static testSQLGeneration() {
    console.log('🧪 Testing SQL Query Generation...');
    
    const config = createMockReportConfig();
    
    try {
      const query = (ReportingDataService as any).buildQuery(config);
      console.log('✅ SQL Query Generated:', query);
      
      // Check for common issues
      if (query.includes('undefined')) {
        console.error('❌ SQL contains undefined values');
        return false;
      }
      
      if (!query.includes('SELECT')) {
        console.error('❌ SQL missing SELECT clause');
        return false;
      }
      
      if (!query.includes('FROM')) {
        console.error('❌ SQL missing FROM clause');
        return false;
      }
      
      console.log('✅ SQL generation test passed');
      return true;
    } catch (error) {
      console.error('❌ SQL generation failed:', error);
      return false;
    }
  }

  /**
   * Test filter clause generation
   */
  static testFilterGeneration() {
    console.log('🧪 Testing Filter Generation...');
    
    const testCases = [
      {
        operator: 'equals',
        field: 'fungicide_used',
        value: 'Yes',
        expected: "fungicide_used = 'Yes'"
      },
      {
        operator: 'contains',
        field: 'notes',
        value: 'test',
        expected: "notes ILIKE '%test%'"
      },
      {
        operator: 'between',
        field: 'growth_index',
        value: '10,20',
        expected: 'growth_index >= 10 AND growth_index <= 20'
      }
    ];

    let allPassed = true;
    
    testCases.forEach(({ operator, field, value, expected }) => {
      const filter = {
        id: 'test',
        name: 'Test',
        field,
        dataSource: 'test',
        type: 'text' as const,
        operator: operator as any,
        value,
        label: 'Test'
      };
      
      try {
        const result = (ReportingDataService as any).buildFilterClause(filter);
        if (result === expected) {
          console.log(`✅ Filter ${operator}: ${result}`);
        } else {
          console.error(`❌ Filter ${operator}: Expected "${expected}", got "${result}"`);
          allPassed = false;
        }
      } catch (error) {
        console.error(`❌ Filter ${operator} failed:`, error);
        allPassed = false;
      }
    });

    return allPassed;
  }

  /**
   * Test data processing with various edge cases
   */
  static testDataProcessing() {
    console.log('🧪 Testing Data Processing...');
    
    const testCases = [
      {
        name: 'Valid Data',
        data: createTestDataWithCharacteristics({ dataPointCount: 3, seriesCount: 2 })
      },
      {
        name: 'Data with Nulls',
        data: createTestDataWithCharacteristics({ 
          hasNulls: true, 
          dataPointCount: 3, 
          seriesCount: 2 
        })
      },
      {
        name: 'Data with Empty Strings',
        data: createTestDataWithCharacteristics({ 
          hasEmptyStrings: true, 
          dataPointCount: 3, 
          seriesCount: 2 
        })
      },
      {
        name: 'Data with Dashes',
        data: createTestDataWithCharacteristics({ 
          hasDashes: true, 
          dataPointCount: 3, 
          seriesCount: 2 
        })
      },
      {
        name: 'Data with Zeros',
        data: createTestDataWithCharacteristics({ 
          hasZeros: true, 
          dataPointCount: 3, 
          seriesCount: 2 
        })
      },
      {
        name: 'Data with Negatives',
        data: createTestDataWithCharacteristics({ 
          hasNegatives: true, 
          dataPointCount: 3, 
          seriesCount: 2 
        })
      }
    ];

    let allPassed = true;

    testCases.forEach(({ name, data }) => {
      try {
        console.log(`\n--- Testing ${name} ---`);
        console.log('Data sample:', JSON.stringify(data.data.slice(0, 2), null, 2));
        
        // Test that we can process the data without errors
        const firstMeasureKey = Object.keys(data.data[0]?.measures || {})[0];
        if (firstMeasureKey) {
          const validValues = data.data
            .map(d => d.measures[firstMeasureKey])
            .filter(val => val !== null && val !== undefined && val !== '' && val !== '-')
            .map(val => +val)
            .filter(val => !isNaN(val));
          
          console.log(`✅ ${name}: Found ${validValues.length} valid values out of ${data.data.length} total`);
          console.log(`   Valid values: [${validValues.join(', ')}]`);
        } else {
          console.log(`⚠️  ${name}: No measure data found`);
        }
        
      } catch (error) {
        console.error(`❌ ${name} failed:`, error);
        allPassed = false;
      }
    });

    return allPassed;
  }

  /**
   * Test localStorage cache functionality
   */
  static testCacheManagement() {
    console.log('🧪 Testing Cache Management...');
    
    const cacheKey = 'gasx_report_builder_state';
    const testData = {
      state: {
        name: 'Test Report',
        filters: []
      },
      timestamp: Date.now()
    };

    try {
      // Test cache write
      localStorage.setItem(cacheKey, JSON.stringify(testData));
      console.log('✅ Cache write successful');
      
      // Test cache read
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.state.name === 'Test Report') {
          console.log('✅ Cache read successful');
        } else {
          console.error('❌ Cache read data mismatch');
          return false;
        }
      } else {
        console.error('❌ Cache read failed');
        return false;
      }
      
      // Test cache clear
      localStorage.removeItem(cacheKey);
      const afterClear = localStorage.getItem(cacheKey);
      if (afterClear === null) {
        console.log('✅ Cache clear successful');
      } else {
        console.error('❌ Cache clear failed');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Cache management failed:', error);
      return false;
    }
  }

  /**
   * Run all tests
   */
  static runAllTests() {
    console.log('🚀 Running All Manual Tests...\n');
    
    const results = {
      sqlGeneration: this.testSQLGeneration(),
      filterGeneration: this.testFilterGeneration(),
      dataProcessing: this.testDataProcessing(),
      cacheManagement: this.testCacheManagement()
    };
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    Object.entries(results).forEach(([testName, passed]) => {
      const status = passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${testName}: ${status}`);
    });
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. Check the logs above for details.');
    }
    
    return allPassed;
  }
}

// Make it available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).ManualTestRunner = ManualTestRunner;
}

export default ManualTestRunner;