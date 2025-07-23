/**
 * Run System Validation
 * 
 * This script runs comprehensive system validation tests to ensure the MTM system
 * is ready for deployment. It validates all requirements, tests real-world scenarios,
 * and generates a detailed report.
 */

import { SystemValidator } from './comprehensive-system-validation';
import { RealWorldValidator } from './real-world-validation';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

async function runSystemValidation() {
  console.log('🚀 Starting Comprehensive System Validation');
  console.log('==========================================');
  
  // Create reports directory if it doesn't exist
  const reportsDir = join(process.cwd(), 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  
  // Run system architecture validation
  console.log('\n📋 Validating System Architecture...');
  const systemValidator = new SystemValidator();
  await systemValidator.validateProjectStructure();
  await systemValidator.validateBuildSystem();
  await systemValidator.validateDocumentation();
  await systemValidator.validateExamplesBuild();
  await systemValidator.validateMTMFiles();
  await systemValidator.validateMigrationTools();
  await systemValidator.validatePerformanceFeatures();
  await systemValidator.validateTestCoverage();
  await systemValidator.validateRequirementsCompliance();
  await systemValidator.validateDeploymentReadiness();
  
  const systemReport = systemValidator.generateReport();
  writeFileSync(join(reportsDir, 'system-validation-report.md'), systemReport);
  
  // Run real-world validation
  console.log('\n🌍 Validating Real-World Scenarios...');
  const realWorldValidator = new RealWorldValidator();
  await realWorldValidator.validateSystemArchitecture();
  await realWorldValidator.validateRequirementsCompliance();
  await realWorldValidator.validatePerformanceFeatures();
  await realWorldValidator.validateMigrationSystem();
  await realWorldValidator.validateDocumentation();
  await realWorldValidator.validateTestCoverage();
  await realWorldValidator.validateDeploymentReadiness();
  await realWorldValidator.validateRealWorldScenarios();
  await realWorldValidator.validateSystemIntegration();
  
  const realWorldReport = realWorldValidator.generateReport();
  writeFileSync(join(reportsDir, 'real-world-validation-report.md'), realWorldReport);
  
  // Generate comprehensive report
  const systemResults = systemValidator.results || [];
  const realWorldResults = realWorldValidator.getResults();
  
  const passedSystem = systemResults.filter(r => r.status === 'PASS').length;
  const failedSystem = systemResults.filter(r => r.status === 'FAIL').length;
  const skippedSystem = systemResults.filter(r => r.status === 'SKIP').length;
  
  const passedRealWorld = realWorldResults.filter(r => r.status === 'PASS').length;
  const failedRealWorld = realWorldResults.filter(r => r.status === 'FAIL').length;
  const skippedRealWorld = realWorldResults.filter(r => r.status === 'SKIP').length;
  
  const totalPassed = passedSystem + passedRealWorld;
  const totalFailed = failedSystem + failedRealWorld;
  const totalSkipped = skippedSystem + skippedRealWorld;
  const totalTests = systemResults.length + realWorldResults.length;
  
  const successRate = ((totalPassed / (totalTests - totalSkipped)) * 100).toFixed(1);
  
  const comprehensiveReport = `
# Comprehensive System Validation Report

Generated: ${new Date().toISOString()}

## Summary

- ✅ Passed: ${totalPassed}
- ❌ Failed: ${totalFailed}
- ⚠️ Skipped: ${totalSkipped}
- Total Tests: ${totalTests}

**Success Rate: ${successRate}%**

## System Architecture Validation

${systemResults.filter(r => r.test.includes('Architecture') || r.test.includes('Project Structure')).map(r => 
  `- ${r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️'} ${r.test}: ${r.message}`
).join('\n')}

## Requirements Compliance

${realWorldResults.filter(r => r.test.startsWith('Requirement')).map(r => 
  `- ${r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️'} ${r.test}: ${r.message}`
).join('\n')}

## Performance Validation

${systemResults.filter(r => r.test.includes('Performance')).concat(
  realWorldResults.filter(r => r.test.includes('Performance'))
).map(r => 
  `- ${r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️'} ${r.test}: ${r.message}`
).join('\n')}

## Deployment Readiness

${systemResults.filter(r => r.test.includes('Deployment')).concat(
  realWorldResults.filter(r => r.test.includes('Deployment'))
).map(r => 
  `- ${r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️'} ${r.test}: ${r.message}`
).join('\n')}

## Documentation and Migration

${systemResults.filter(r => r.test.includes('Documentation') || r.test.includes('Migration')).concat(
  realWorldResults.filter(r => r.test.includes('Documentation') || r.test.includes('Migration'))
).map(r => 
  `- ${r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️'} ${r.test}: ${r.message}`
).join('\n')}

## Test Coverage

${systemResults.filter(r => r.test.includes('Test')).concat(
  realWorldResults.filter(r => r.test.includes('Test'))
).map(r => 
  `- ${r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️'} ${r.test}: ${r.message}`
).join('\n')}

## Deployment Recommendation

${totalFailed === 0 ? 
  '✅ **READY FOR PRODUCTION DEPLOYMENT**\n\nAll validation tests have passed. The system meets all requirements and is ready for production deployment.' : 
  totalFailed <= 3 ? 
  '⚠️ **DEPLOYMENT POSSIBLE WITH MINOR ISSUES**\n\nThe system has a few minor issues that should be addressed, but deployment is possible.' :
  '❌ **NOT READY FOR DEPLOYMENT**\n\nThe system has significant issues that must be resolved before deployment.'}

## Next Steps

${totalFailed === 0 ? 
  '1. Proceed with production deployment\n2. Set up monitoring and alerting\n3. Implement continuous validation' : 
  totalFailed <= 3 ? 
  '1. Address the minor issues identified in this report\n2. Re-run validation tests\n3. Proceed with deployment if all critical tests pass' :
  '1. Resolve the critical issues identified in this report\n2. Focus on requirements compliance and system architecture\n3. Re-run validation tests after fixes'}

For detailed reports, see:
- [System Validation Report](./system-validation-report.md)
- [Real-World Validation Report](./real-world-validation-report.md)
`;
  
  writeFileSync(join(reportsDir, 'comprehensive-validation-report.md'), comprehensiveReport);
  
  console.log('\n✅ Validation Complete!');
  console.log(`Success Rate: ${successRate}%`);
  console.log(`Reports saved to: ${reportsDir}`);
  
  return {
    success: totalFailed === 0,
    successRate,
    totalPassed,
    totalFailed,
    totalSkipped,
    totalTests
  };
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runSystemValidation().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export { runSystemValidation };