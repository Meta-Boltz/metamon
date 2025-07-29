#!/usr/bin/env node

/**
 * Browser Compatibility Test Runner
 * 
 * This script runs comprehensive browser compatibility tests for the chunk loading mechanism.
 * It provides detailed reporting and can be used in CI/CD pipelines.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = join(__dirname, '..');

// Configuration
const config = {
  browsers: ['chromium', 'firefox', 'webkit'],
  retries: 3,
  timeout: 60000,
  outputDir: join(examplesDir, 'test-results', 'browser-compatibility'),
  reportFile: join(examplesDir, 'test-results', 'browser-compatibility-report.json')
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logSubsection(title) {
  log(`\n${'-'.repeat(40)}`, 'blue');
  log(`${title}`, 'blue');
  log(`${'-'.repeat(40)}`, 'blue');
}

async function runCommand(command, options = {}) {
  try {
    log(`Running: ${command}`, 'yellow');
    const result = execSync(command, {
      cwd: examplesDir,
      stdio: 'pipe',
      encoding: 'utf8',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
}

async function checkPrerequisites() {
  logSection('Checking Prerequisites');

  // Check if Playwright is installed
  const playwrightCheck = await runCommand('npx playwright --version');
  if (!playwrightCheck.success) {
    log('❌ Playwright not found. Installing...', 'red');
    const installResult = await runCommand('npm install @playwright/test');
    if (!installResult.success) {
      throw new Error('Failed to install Playwright');
    }
  } else {
    log(`✅ Playwright found: ${playwrightCheck.output.trim()}`, 'green');
  }

  // Check if browsers are installed
  log('\nChecking browser installations...', 'blue');
  const browserCheck = await runCommand('npx playwright install --dry-run');
  if (!browserCheck.success || browserCheck.output.includes('needs to be installed')) {
    log('❌ Some browsers need to be installed. Installing...', 'yellow');
    const installBrowsers = await runCommand('npx playwright install');
    if (!installBrowsers.success) {
      log('⚠️  Browser installation failed, but continuing...', 'yellow');
    } else {
      log('✅ Browsers installed successfully', 'green');
    }
  } else {
    log('✅ All browsers are installed', 'green');
  }

  // Check if dev server can start
  log('\nChecking development server...', 'blue');
  try {
    // Start dev server in background
    const serverProcess = execSync('npm run dev &', {
      cwd: examplesDir,
      stdio: 'pipe',
      timeout: 5000
    });

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if server is responding
    const healthCheck = await runCommand('curl -f http://localhost:3000 || wget -q --spider http://localhost:3000');
    if (healthCheck.success) {
      log('✅ Development server is accessible', 'green');
    } else {
      log('⚠️  Development server check failed, but continuing...', 'yellow');
    }
  } catch (error) {
    log('⚠️  Could not verify development server, but continuing...', 'yellow');
  }
}

async function runBrowserCompatibilityTests() {
  logSection('Running Browser Compatibility Tests');

  const testResults = {
    timestamp: new Date().toISOString(),
    browsers: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    }
  };

  // Run tests with the browser compatibility configuration
  const testCommand = 'npx playwright test --config=tests/browser-compatibility.config.js --reporter=json';
  const testResult = await runCommand(testCommand);

  if (testResult.success) {
    log('✅ Browser compatibility tests completed', 'green');

    // Parse test results if available
    try {
      const resultsFile = join(examplesDir, 'test-results', 'browser-compatibility-results.json');
      if (existsSync(resultsFile)) {
        const results = JSON.parse(readFileSync(resultsFile, 'utf8'));

        // Process results by browser
        results.suites?.forEach(suite => {
          suite.specs?.forEach(spec => {
            spec.tests?.forEach(test => {
              test.results?.forEach(result => {
                const browserName = result.workerIndex !== undefined ?
                  config.browsers[result.workerIndex % config.browsers.length] : 'unknown';

                if (!testResults.browsers[browserName]) {
                  testResults.browsers[browserName] = {
                    total: 0,
                    passed: 0,
                    failed: 0,
                    skipped: 0,
                    tests: []
                  };
                }

                testResults.browsers[browserName].total++;
                testResults.summary.total++;

                if (result.status === 'passed') {
                  testResults.browsers[browserName].passed++;
                  testResults.summary.passed++;
                } else if (result.status === 'failed') {
                  testResults.browsers[browserName].failed++;
                  testResults.summary.failed++;
                } else {
                  testResults.browsers[browserName].skipped++;
                  testResults.summary.skipped++;
                }

                testResults.browsers[browserName].tests.push({
                  title: test.title,
                  status: result.status,
                  duration: result.duration,
                  error: result.error?.message
                });
              });
            });
          });
        });
      }
    } catch (error) {
      log(`⚠️  Could not parse test results: ${error.message}`, 'yellow');
    }
  } else {
    log('❌ Browser compatibility tests failed', 'red');
    log(testResult.output, 'red');
    testResults.error = testResult.error;
  }

  return testResults;
}

function generateReport(testResults) {
  logSection('Test Results Summary');

  // Overall summary
  log(`Total Tests: ${testResults.summary.total}`, 'bright');
  log(`✅ Passed: ${testResults.summary.passed}`, 'green');
  log(`❌ Failed: ${testResults.summary.failed}`, 'red');
  log(`⏭️  Skipped: ${testResults.summary.skipped}`, 'yellow');

  // Browser-specific results
  Object.entries(testResults.browsers).forEach(([browser, results]) => {
    logSubsection(`${browser.toUpperCase()} Results`);
    log(`Total: ${results.total}`, 'bright');
    log(`✅ Passed: ${results.passed}`, 'green');
    log(`❌ Failed: ${results.failed}`, 'red');
    log(`⏭️  Skipped: ${results.skipped}`, 'yellow');

    if (results.failed > 0) {
      log('\nFailed Tests:', 'red');
      results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          log(`  • ${test.title}`, 'red');
          if (test.error) {
            log(`    Error: ${test.error}`, 'red');
          }
        });
    }
  });

  // Save detailed report
  try {
    writeFileSync(config.reportFile, JSON.stringify(testResults, null, 2));
    log(`\n📄 Detailed report saved to: ${config.reportFile}`, 'cyan');
  } catch (error) {
    log(`⚠️  Could not save report: ${error.message}`, 'yellow');
  }

  // Generate HTML report link
  const htmlReportPath = join(config.outputDir, 'index.html');
  if (existsSync(htmlReportPath)) {
    log(`🌐 HTML report available at: file://${htmlReportPath}`, 'cyan');
  }
}

function checkCompatibilityIssues(testResults) {
  logSection('Compatibility Analysis');

  const issues = [];

  // Check for browser-specific failures
  Object.entries(testResults.browsers).forEach(([browser, results]) => {
    if (results.failed > 0) {
      const failureRate = (results.failed / results.total) * 100;
      if (failureRate > 10) { // More than 10% failure rate
        issues.push({
          type: 'high_failure_rate',
          browser,
          failureRate: failureRate.toFixed(1),
          message: `${browser} has a high failure rate (${failureRate.toFixed(1)}%)`
        });
      }
    }
  });

  // Check for cross-browser inconsistencies
  const browserNames = Object.keys(testResults.browsers);
  if (browserNames.length > 1) {
    const passRates = browserNames.map(browser => {
      const results = testResults.browsers[browser];
      return {
        browser,
        passRate: results.total > 0 ? (results.passed / results.total) * 100 : 0
      };
    });

    const maxPassRate = Math.max(...passRates.map(r => r.passRate));
    const minPassRate = Math.min(...passRates.map(r => r.passRate));

    if (maxPassRate - minPassRate > 20) { // More than 20% difference
      issues.push({
        type: 'cross_browser_inconsistency',
        message: `Significant pass rate difference between browsers (${minPassRate.toFixed(1)}% - ${maxPassRate.toFixed(1)}%)`,
        details: passRates
      });
    }
  }

  if (issues.length === 0) {
    log('✅ No significant compatibility issues detected', 'green');
  } else {
    log('⚠️  Compatibility issues detected:', 'yellow');
    issues.forEach(issue => {
      log(`  • ${issue.message}`, 'yellow');
    });
  }

  return issues;
}

async function main() {
  try {
    log('🚀 Starting Browser Compatibility Test Suite', 'bright');
    log(`📅 ${new Date().toLocaleString()}`, 'cyan');

    // Check prerequisites
    await checkPrerequisites();

    // Run tests
    const testResults = await runBrowserCompatibilityTests();

    // Generate report
    generateReport(testResults);

    // Check for compatibility issues
    const issues = checkCompatibilityIssues(testResults);

    // Exit with appropriate code
    if (testResults.summary.failed > 0 || issues.some(i => i.type === 'high_failure_rate')) {
      log('\n❌ Browser compatibility tests completed with failures', 'red');
      process.exit(1);
    } else {
      log('\n✅ Browser compatibility tests completed successfully', 'green');
      process.exit(0);
    }

  } catch (error) {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Browser Compatibility Test Runner

Usage: node run-browser-compatibility-tests.js [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Enable verbose output
  --browsers     Comma-separated list of browsers to test (chromium,firefox,webkit)
  --retries      Number of retries for failed tests (default: 3)

Examples:
  node run-browser-compatibility-tests.js
  node run-browser-compatibility-tests.js --browsers chromium,firefox
  node run-browser-compatibility-tests.js --retries 5 --verbose
`);
  process.exit(0);
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});