// Comprehensive test runner for Enhanced HTML Generator
const { runTests: runUnitTests } = require('./test-enhanced-html-generator.js');
const { runIntegrationTests } = require('./test-enhanced-html-integration.js');

function runAllTests() {
  console.log('🧪 Running Enhanced HTML Generator Test Suite\n');
  console.log('='.repeat(60));

  let allPassed = true;

  // Run unit tests
  console.log('\n📋 UNIT TESTS');
  console.log('-'.repeat(30));
  const unitTestsPassed = runUnitTests();
  allPassed = allPassed && unitTestsPassed;

  // Run integration tests
  console.log('\n🔗 INTEGRATION TESTS');
  console.log('-'.repeat(30));
  const integrationTestsPassed = runIntegrationTests();
  allPassed = allPassed && integrationTestsPassed;

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST SUMMARY');
  console.log('='.repeat(60));

  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('\nThe Enhanced HTML Generator is working correctly with:');
    console.log('✅ Link component processing');
    console.log('✅ Framework component integration');
    console.log('✅ Proper script tag generation');
    console.log('✅ Meta tag generation');
    console.log('✅ Attribute processing');
    console.log('✅ Full compilation integration');
    console.log('\nTask 10 (Create enhanced HTML generator) is COMPLETE! ✨');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('\nPlease review the failed tests above and fix any issues.');
  }

  return allPassed;
}

// Run all tests
if (require.main === module) {
  const success = runAllTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runAllTests };