#!/usr/bin/env node

// TypeScript Integration Test Runner
const { runTypeScriptIntegrationTests } = require('./tests/typescript-integration.test.js');

console.log('🚀 MTM Framework - TypeScript Integration Test Suite\n');
console.log('='.repeat(60));

async function runAllTests() {
  let allTestsPassed = true;

  try {
    // Run TypeScript integration tests
    const typeScriptTestsPassed = runTypeScriptIntegrationTests();
    allTestsPassed = allTestsPassed && typeScriptTestsPassed;

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    allTestsPassed = false;
  }

  console.log('='.repeat(60));

  if (allTestsPassed) {
    console.log('🎉 All TypeScript integration tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some TypeScript integration tests failed.');
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});