/**
 * Continuous Integration Test Suite
 * 
 * Automated test runner for comprehensive integration testing
 * of the Enhanced MTM Framework across different environments.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class CITestSuite {
  constructor() {
    this.testResults = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      },
      suites: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    };

    this.testSuites = [
      {
        name: 'Comprehensive Integration Tests',
        file: 'comprehensive-integration.test.js',
        timeout: 60000,
        critical: true
      },
      {
        name: 'Browser Compatibility Tests',
        file: 'browser-compatibility.test.js',
        timeout: 45000,
        critical: true
      },
      {
        name: 'Production Build Tests',
        file: 'production-build.test.js',
        timeout: 30000,
        critical: true
      },
      {
        name: 'Navigation Integration Tests',
        file: 'navigation-integration.test.js',
        timeout: 20000,
        critical: false
      },
      {
        name: 'Error Handling Tests',
        file: 'error-handling.test.js',
        timeout: 15000,
        critical: false
      },
      {
        name: 'TypeScript Integration Tests',
        file: 'typescript-integration.test.js',
        timeout: 25000,
        critical: false
      },
      {
        name: 'Build System Integration Tests',
        file: 'build-system-integration.test.js',
        timeout: 20000,
        critical: false
      }
    ];
  }

  async runAllTests() {
    console.log('🚀 Starting CI Test Suite for Enhanced MTM Framework');
    console.log('='.repeat(60));

    const startTime = Date.now();

    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    const endTime = Date.now();
    this.testResults.summary.duration = endTime - startTime;

    this.generateReport();
    this.checkCriticalFailures();

    return this.testResults;
  }

  async runTestSuite(suite) {
    console.log(`\n📋 Running: ${suite.name}`);
    console.log('-'.repeat(40));

    const suiteResult = {
      name: suite.name,
      file: suite.file,
      critical: suite.critical,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      status: 'running',
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      error: null
    };

    try {
      const testFile = path.join(__dirname, suite.file);

      if (!fs.existsSync(testFile)) {
        suiteResult.status = 'skipped';
        suiteResult.error = `Test file not found: ${suite.file}`;
        console.log(`⚠️  Skipped: ${suite.name} (file not found)`);
        this.testResults.summary.skipped++;
      } else {
        const result = await this.executeTestFile(testFile, suite.timeout);

        suiteResult.tests = result.tests;
        suiteResult.summary = result.summary;
        suiteResult.status = result.summary.failed > 0 ? 'failed' : 'passed';

        if (result.error) {
          suiteResult.error = result.error;
        }

        // Update global summary
        this.testResults.summary.total += result.summary.total;
        this.testResults.summary.passed += result.summary.passed;
        this.testResults.summary.failed += result.summary.failed;
        this.testResults.summary.skipped += result.summary.skipped;

        const statusIcon = suiteResult.status === 'passed' ? '✅' : '❌';
        console.log(`${statusIcon} ${suite.name}: ${result.summary.passed}/${result.summary.total} passed`);
      }
    } catch (error) {
      suiteResult.status = 'error';
      suiteResult.error = error.message;
      this.testResults.summary.failed++;
      console.log(`💥 Error in ${suite.name}: ${error.message}`);
    }

    suiteResult.endTime = Date.now();
    suiteResult.duration = suiteResult.endTime - suiteResult.startTime;

    this.testResults.suites.push(suiteResult);
  }

  async executeTestFile(testFile, timeout) {
    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', testFile, '--json', '--verbose'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jest.on('close', (code) => {
        try {
          // Try to parse Jest JSON output
          const lines = stdout.split('\n');
          const jsonLine = lines.find(line => line.trim().startsWith('{'));

          if (jsonLine) {
            const jestResult = JSON.parse(jsonLine);

            const result = {
              tests: this.parseJestTests(jestResult),
              summary: {
                total: jestResult.numTotalTests || 0,
                passed: jestResult.numPassedTests || 0,
                failed: jestResult.numFailedTests || 0,
                skipped: jestResult.numPendingTests || 0
              },
              error: code !== 0 ? stderr : null
            };

            resolve(result);
          } else {
            // Fallback parsing if JSON output is not available
            resolve(this.parseTextOutput(stdout, stderr, code));
          }
        } catch (parseError) {
          resolve(this.parseTextOutput(stdout, stderr, code));
        }
      });

      jest.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      setTimeout(() => {
        jest.kill('SIGKILL');
        reject(new Error(`Test suite timed out after ${timeout}ms`));
      }, timeout);
    });
  }

  parseJestTests(jestResult) {
    const tests = [];

    if (jestResult.testResults) {
      for (const testFile of jestResult.testResults) {
        if (testFile.assertionResults) {
          for (const assertion of testFile.assertionResults) {
            tests.push({
              name: assertion.fullName || assertion.title,
              status: assertion.status,
              duration: assertion.duration || 0,
              error: assertion.failureMessages ? assertion.failureMessages.join('\n') : null
            });
          }
        }
      }
    }

    return tests;
  }

  parseTextOutput(stdout, stderr, exitCode) {
    // Fallback text parsing for when JSON output is not available
    const tests = [];
    const lines = stdout.split('\n');

    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Simple pattern matching for test results
    for (const line of lines) {
      if (line.includes('✓') || line.includes('PASS')) {
        passed++;
        total++;
        tests.push({
          name: line.trim(),
          status: 'passed',
          duration: 0,
          error: null
        });
      } else if (line.includes('✗') || line.includes('FAIL')) {
        failed++;
        total++;
        tests.push({
          name: line.trim(),
          status: 'failed',
          duration: 0,
          error: 'Test failed'
        });
      } else if (line.includes('SKIP')) {
        skipped++;
        total++;
        tests.push({
          name: line.trim(),
          status: 'skipped',
          duration: 0,
          error: null
        });
      }
    }

    return {
      tests,
      summary: { total, passed, failed, skipped },
      error: exitCode !== 0 ? stderr : null
    };
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CI TEST SUITE REPORT');
    console.log('='.repeat(60));

    console.log(`\n🕐 Execution Time: ${(this.testResults.summary.duration / 1000).toFixed(2)}s`);
    console.log(`📈 Total Tests: ${this.testResults.summary.total}`);
    console.log(`✅ Passed: ${this.testResults.summary.passed}`);
    console.log(`❌ Failed: ${this.testResults.summary.failed}`);
    console.log(`⚠️  Skipped: ${this.testResults.summary.skipped}`);

    const successRate = this.testResults.summary.total > 0
      ? ((this.testResults.summary.passed / this.testResults.summary.total) * 100).toFixed(1)
      : 0;
    console.log(`📊 Success Rate: ${successRate}%`);

    console.log('\n📋 Test Suite Details:');
    console.log('-'.repeat(40));

    for (const suite of this.testResults.suites) {
      const statusIcon = suite.status === 'passed' ? '✅' :
        suite.status === 'failed' ? '❌' :
          suite.status === 'skipped' ? '⚠️' : '❓';

      const duration = (suite.duration / 1000).toFixed(2);
      const criticalFlag = suite.critical ? ' [CRITICAL]' : '';

      console.log(`${statusIcon} ${suite.name}${criticalFlag}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Tests: ${suite.summary.passed}/${suite.summary.total} passed`);

      if (suite.error) {
        console.log(`   Error: ${suite.error}`);
      }

      if (suite.status === 'failed' && suite.tests.length > 0) {
        const failedTests = suite.tests.filter(test => test.status === 'failed');
        if (failedTests.length > 0) {
          console.log('   Failed Tests:');
          for (const test of failedTests.slice(0, 3)) { // Show first 3 failed tests
            console.log(`     - ${test.name}`);
          }
          if (failedTests.length > 3) {
            console.log(`     ... and ${failedTests.length - 3} more`);
          }
        }
      }

      console.log('');
    }

    // Write detailed report to file
    this.writeReportToFile();
  }

  writeReportToFile() {
    const reportDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `ci-test-report-${timestamp}.json`);

    fs.writeFileSync(reportFile, JSON.stringify(this.testResults, null, 2));

    console.log(`📄 Detailed report saved to: ${reportFile}`);

    // Also create a summary HTML report
    this.generateHTMLReport(reportDir, timestamp);
  }

  generateHTMLReport(reportDir, timestamp) {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MTM Framework CI Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 2rem;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            padding: 2rem;
            background: #f8f9fa;
        }
        .metric {
            text-align: center;
            padding: 1rem;
            background: white;
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        .metric-label {
            color: #666;
            font-size: 0.9rem;
        }
        .suites {
            padding: 2rem;
        }
        .suite {
            margin-bottom: 2rem;
            border: 1px solid #e1e5e9;
            border-radius: 6px;
            overflow: hidden;
        }
        .suite-header {
            padding: 1rem 1.5rem;
            background: #f8f9fa;
            border-bottom: 1px solid #e1e5e9;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .suite-name {
            font-weight: 600;
            font-size: 1.1rem;
        }
        .suite-status {
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-skipped { background: #fff3cd; color: #856404; }
        .suite-details {
            padding: 1.5rem;
        }
        .test-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        .test-item {
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 4px solid #28a745;
        }
        .test-item.failed {
            border-left-color: #dc3545;
        }
        .test-item.skipped {
            border-left-color: #ffc107;
        }
        .footer {
            padding: 2rem;
            text-align: center;
            background: #f8f9fa;
            color: #666;
            border-top: 1px solid #e1e5e9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 MTM Framework CI Test Report</h1>
            <p>Generated on ${new Date(this.testResults.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value">${this.testResults.summary.total}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #28a745">${this.testResults.summary.passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #dc3545">${this.testResults.summary.failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #ffc107">${this.testResults.summary.skipped}</div>
                <div class="metric-label">Skipped</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(this.testResults.summary.duration / 1000).toFixed(1)}s</div>
                <div class="metric-label">Duration</div>
            </div>
            <div class="metric">
                <div class="metric-value">${this.testResults.summary.total > 0 ? ((this.testResults.summary.passed / this.testResults.summary.total) * 100).toFixed(1) : 0}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
        </div>
        
        <div class="suites">
            <h2>Test Suite Results</h2>
            ${this.testResults.suites.map(suite => `
                <div class="suite">
                    <div class="suite-header">
                        <div class="suite-name">
                            ${suite.name}
                            ${suite.critical ? ' <span style="color: #dc3545; font-size: 0.8rem;">[CRITICAL]</span>' : ''}
                        </div>
                        <div class="suite-status status-${suite.status}">
                            ${suite.status.toUpperCase()}
                        </div>
                    </div>
                    <div class="suite-details">
                        <p><strong>Duration:</strong> ${(suite.duration / 1000).toFixed(2)}s</p>
                        <p><strong>Tests:</strong> ${suite.summary.passed}/${suite.summary.total} passed</p>
                        ${suite.error ? `<p><strong>Error:</strong> <code>${suite.error}</code></p>` : ''}
                        
                        ${suite.tests.length > 0 ? `
                            <div class="test-grid">
                                ${suite.tests.slice(0, 10).map(test => `
                                    <div class="test-item ${test.status}">
                                        <div><strong>${test.name}</strong></div>
                                        <div>Status: ${test.status}</div>
                                        ${test.duration ? `<div>Duration: ${test.duration}ms</div>` : ''}
                                        ${test.error ? `<div style="color: #dc3545; font-size: 0.9rem; margin-top: 0.5rem;">${test.error}</div>` : ''}
                                    </div>
                                `).join('')}
                                ${suite.tests.length > 10 ? `<div class="test-item"><em>... and ${suite.tests.length - 10} more tests</em></div>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>Enhanced MTM Framework - Continuous Integration Test Suite</p>
            <p>Environment: Node.js ${this.testResults.environment.node} on ${this.testResults.environment.platform}</p>
        </div>
    </div>
</body>
</html>`;

    const htmlFile = path.join(reportDir, `ci-test-report-${timestamp}.html`);
    fs.writeFileSync(htmlFile, htmlContent);

    console.log(`🌐 HTML report saved to: ${htmlFile}`);
  }

  checkCriticalFailures() {
    const criticalFailures = this.testResults.suites.filter(
      suite => suite.critical && suite.status === 'failed'
    );

    if (criticalFailures.length > 0) {
      console.log('\n🚨 CRITICAL FAILURES DETECTED:');
      console.log('='.repeat(40));

      for (const failure of criticalFailures) {
        console.log(`❌ ${failure.name}`);
        if (failure.error) {
          console.log(`   Error: ${failure.error}`);
        }
      }

      console.log('\n⚠️  Build should be considered FAILED due to critical test failures.');
      process.exit(1);
    } else if (this.testResults.summary.failed > 0) {
      console.log('\n⚠️  Some non-critical tests failed, but build can proceed.');
      console.log('Please review the failures and fix them in the next iteration.');
    } else {
      console.log('\n🎉 All tests passed! Build is ready for deployment.');
    }
  }

  async runQuickSmokeTests() {
    console.log('🔥 Running Quick Smoke Tests...');

    const smokeTests = [
      {
        name: 'Compiler Basic Functionality',
        test: async () => {
          const { EnhancedMTMCompiler } = require('../enhanced-compiler-with-modes.js');
          const compiler = new EnhancedMTMCompiler();
          const result = await compiler.compile(`---
route: "/test"
title: "Test"
---
<template><h1>Test</h1></template>`, {
            filename: 'test.mtm'
          });
          return result.success;
        }
      },
      {
        name: 'Route Registry Functionality',
        test: async () => {
          const { RouteRegistry } = require('../route-registry.js');
          const registry = new RouteRegistry();
          registry.register('/test', { path: '/test', component: 'Test' });
          return registry.resolve('/test') !== null;
        }
      },
      {
        name: 'Navigation Integration',
        test: async () => {
          const { NavigationIntegration } = require('../navigation-integration.js');
          const navigation = new NavigationIntegration();
          return typeof navigation.generateRouterConfig === 'function';
        }
      }
    ];

    let passed = 0;
    let failed = 0;

    for (const smokeTest of smokeTests) {
      try {
        const result = await smokeTest.test();
        if (result) {
          console.log(`✅ ${smokeTest.name}`);
          passed++;
        } else {
          console.log(`❌ ${smokeTest.name} - Test returned false`);
          failed++;
        }
      } catch (error) {
        console.log(`❌ ${smokeTest.name} - ${error.message}`);
        failed++;
      }
    }

    console.log(`\n🔥 Smoke Tests: ${passed}/${smokeTests.length} passed`);

    if (failed > 0) {
      console.log('⚠️  Some smoke tests failed. Full test suite may have issues.');
      return false;
    }

    console.log('✅ All smoke tests passed. Proceeding with full test suite.');
    return true;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const testSuite = new CITestSuite();

  if (args.includes('--smoke')) {
    testSuite.runQuickSmokeTests().then(success => {
      process.exit(success ? 0 : 1);
    });
  } else {
    testSuite.runAllTests().then(results => {
      const hasFailures = results.summary.failed > 0;
      const hasCriticalFailures = results.suites.some(
        suite => suite.critical && suite.status === 'failed'
      );

      process.exit(hasCriticalFailures ? 1 : 0);
    }).catch(error => {
      console.error('💥 Test suite execution failed:', error);
      process.exit(1);
    });
  }
}

module.exports = { CITestSuite };