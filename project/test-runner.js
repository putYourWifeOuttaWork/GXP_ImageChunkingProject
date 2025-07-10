#!/usr/bin/env node

// Simple test runner to help debug the reporting issues
import { ManualTestRunner } from './src/test-utils/manualTestRunner.js';

console.log('🧪 GasX Reporting System Test Runner');
console.log('====================================\n');

try {
  const allPassed = ManualTestRunner.runAllTests();
  
  if (allPassed) {
    console.log('\n✅ All tests passed! The fixes should be working correctly.');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check the output above.');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
}