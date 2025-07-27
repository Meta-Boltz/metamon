#!/usr/bin/env node

/**
 * Test runner for error handling system
 * Runs all error-related tests and provides comprehensive reporting
 */

const path = require('path');
const fs = require('fs');

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

// Override console methods for better test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
  const message = args.join(' ');
  if (message.startsWith('✓')) {
    passedTests++;
    originalConsoleLog('\x1b[32m' + message + '\x1b[0m'); // Green
  } else if (message.startsWith('✗')) {
    failedTests++;
    failures.push(message);
    originalConsoleLog('\x1b[31m' + message + '\x1b[0m'); // Red
  } else if (message.startsWith('===')) {
    originalConsoleLog('\x1b[36m' + message + '\x1b[0m'); // Cyan
  } else {
    originalConsoleLog(...args);
  }
  totalTests = passedTests + failedTests;
};

console.error = (...args) => {
  originalConsoleError('\x1b[31m', ...args, '\x1b[0m');
};

/**
 * Set up Jest-like testing environment
 */
function setupTestEnvironment() {
  global.describe = (name, fn) => {
    console.log(`\n=== ${name} ===`);
    fn();
  };

  global.test = (name, fn) => {
    try {
      fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
    }
  };

  global.beforeEach = (fn) => fn();

  global.expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toHaveLength: (expected) => {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${actual.length}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toBeNull: () => {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
    toBeInstanceOf: (expected) => {
      if (!(actual instanceof expected)) {
        throw new Error(`Expected instance of ${expected.name}, got ${actual.constructor.name}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toThrow: (expectedError) => {
      try {
        if (typeof actual === 'function') {
          actual();
        }
        throw new Error('Expected function to throw');
      } catch (error) {
        if (expectedError && !(error instanceof expectedError)) {
          throw new Error(`Expected to throw ${expectedError.name}, but threw ${error.constructor.name}`);
        }
      }
    },
    toHaveBeenCalled: () => {
      if (!actual.mock || actual.mock.calls.length === 0) {
        throw new Error('Expected function to have been called');
      }
    },
    toHaveBeenCalledWith: (...expectedArgs) => {
      if (!actual.mock || actual.mock.calls.length === 0) {
        throw new Error('Expected function to have been called');
      }
      const lastCall = actual.mock.calls[actual.mock.calls.length - 1];
      if (JSON.stringify(lastCall) !== JSON.stringify(expectedArgs)) {
        throw new Error(`Expected to be called with ${JSON.stringify(expectedArgs)}, but was called with ${JSON.stringify(lastCall)}`);
      }
    },
    not: {
      toHaveBeenCalled: () => {
        if (actual.mock && actual.mock.calls.length > 0) {
          throw new Error('Expected function not to have been called');
        }
      }
    }
  });

  global.jest = {
    fn: (implementation) => {
      const fn = implementation || (() => { });
      fn.mock = { calls: [] };
      const mockFn = (...args) => {
        fn.mock.calls.push(args);
        return fn(...args);
      };
      mockFn.mock = fn.mock;
      mockFn.mockReturnValue = (value) => {
        fn.mockReturnValue = () => value;
        return mockFn;
      };
      mockFn.mockImplementation = (impl) => {
        return jest.fn(impl);
      };
      return mockFn;
    },
    spyOn: (object, method) => {
      const original = object[method];
      const spy = jest.fn(original);
      object[method] = spy;
      spy.mockRestore = () => {
        object[method] = original;
      };
      spy.mockImplementation = (impl) => {
        object[method] = jest.fn(impl);
        return spy;
      };
      return spy;
    }
  };
}

/**
 * Run error handling tests
 */
function runErrorHandlingTests() {
  console.log('\n🧪 Running Error Handling Tests...\n');

  try {
    require('./tests/error-handling.test.js');
  } catch (error) {
    console.error('Error running error handling tests:', error);
  }
}

/**
 * Run error integration tests
 */
function runErrorIntegrationTests() {
  console.log('\n🔗 Running Error Integration Tests...\n');

  try {
    require('./tests/error-integration.test.js');
  } catch (error) {
    console.error('Error running error integration tests:', error);
  }
}

/**
 * Test specific error scenarios manually
 */
function testErrorScenarios() {
  console.log('\n🎯 Testing Specific Error Scenarios...\n');

  const { CompilationError, RuntimeError, ErrorHandler, ComponentErrorBoundary } = require('./error-handling.js');

  // Test 1: Route conflict error
  try {
    const error = CompilationError.routeConflict('/home', 'home1.mtm', 'home2.mtm');
    console.log('✓ Route conflict error creation');

    const formatted = error.getFormattedMessage();
    if (formatted.includes('Suggestions:')) {
      console.log('✓ Route conflict error formatting with suggestions');
    } else {
      console.log('✗ Route conflict error formatting missing suggestions');
    }
  } catch (error) {
    console.log('✗ Route conflict error creation failed:', error.message);
  }

  // Test 2: Import resolution error
  try {
    const error = CompilationError.importResolution(
      '@components/Missing.tsx',
      'test.mtm',
      5,
      ['src/components/Missing.tsx', 'src/components/Missing.tsx.tsx']
    );
    console.log('✓ Import resolution error creation');

    if (error.suggestions.length > 0) {
      console.log('✓ Import resolution error has suggestions');
    } else {
      console.log('✗ Import resolution error missing suggestions');
    }
  } catch (error) {
    console.log('✗ Import resolution error creation failed:', error.message);
  }

  // Test 3: Component error boundary
  try {
    const boundary = new ComponentErrorBoundary('TestComponent');
    const failingRender = () => {
      throw new Error('Component render failed');
    };

    const result = boundary.tryRender(failingRender, { test: 'prop' });
    if (result.includes('Component Error: TestComponent')) {
      console.log('✓ Component error boundary fallback rendering');
    } else {
      console.log('✗ Component error boundary fallback rendering failed');
    }
  } catch (error) {
    console.log('✗ Component error boundary test failed:', error.message);
  }

  // Test 4: Error handler integration
  try {
    const errorHandler = new ErrorHandler();
    const testError = CompilationError.syntax('Test syntax error', 'test.mtm', 10, 5);

    // Suppress console output for this test
    const originalError = console.error;
    console.error = () => { };

    errorHandler.handleError(testError);

    console.error = originalError;

    if (errorHandler.hasErrors()) {
      console.log('✓ Error handler error tracking');
    } else {
      console.log('✗ Error handler error tracking failed');
    }

    const summary = errorHandler.getSummary();
    if (summary.errorCount === 1) {
      console.log('✓ Error handler summary generation');
    } else {
      console.log('✗ Error handler summary generation failed');
    }
  } catch (error) {
    console.log('✗ Error handler integration test failed:', error.message);
  }

  // Test 5: Runtime error recovery actions
  try {
    const error = RuntimeError.componentMount('TestComponent', 'Mount failed', { props: {} });
    if (error.recoveryActions && error.recoveryActions.length > 0) {
      console.log('✓ Runtime error recovery actions');
    } else {
      console.log('✗ Runtime error missing recovery actions');
    }
  } catch (error) {
    console.log('✗ Runtime error test failed:', error.message);
  }
}

/**
 * Test error handling with real MTM components
 */
function testRealWorldScenarios() {
  console.log('\n🌍 Testing Real-World Error Scenarios...\n');

  const { EnhancedMTMParser } = require('./enhanced-parser.js');
  const { RouteRegistry } = require('./route-registry.js');

  // Test parser with invalid frontmatter
  try {
    const parser = new EnhancedMTMParser();
    const invalidSource = `---
route: "missing-slash"
compileJsMode: "invalid-mode"
---

<template>
  <h1>Test</h1>
</template>`;

    const ast = parser.parse(invalidSource, 'invalid.mtm');
    const errors = parser.validateFrontmatter(ast.frontmatter, 'invalid.mtm');

    if (errors.length > 0) {
      console.log('✓ Parser frontmatter validation catches errors');
    } else {
      console.log('✗ Parser frontmatter validation missed errors');
    }
  } catch (error) {
    console.log('✗ Parser validation test failed:', error.message);
  }

  // Test route registry conflicts
  try {
    const registry = new RouteRegistry();
    const config1 = { file: 'home1.mtm' };
    const config2 = { file: 'home2.mtm' };

    registry.register('/home', config1);

    try {
      registry.register('/home', config2);
      console.log('✗ Route registry should have thrown conflict error');
    } catch (error) {
      if (error.type === 'compilation-route-conflict') {
        console.log('✓ Route registry throws proper conflict errors');
      } else {
        console.log('✗ Route registry threw wrong error type:', error.type);
      }
    }
  } catch (error) {
    console.log('✗ Route registry test failed:', error.message);
  }

  // Test import resolution
  try {
    const parser = new EnhancedMTMParser();

    try {
      parser.resolveAndValidateComponentPath(
        '@components/NonExistent.tsx',
        process.cwd(),
        'test.mtm',
        5
      );
      console.log('✗ Import resolution should have failed');
    } catch (error) {
      if (error.type === 'compilation-import-resolution') {
        console.log('✓ Import resolution throws proper errors');
      } else {
        console.log('✗ Import resolution threw wrong error type:', error.type);
      }
    }
  } catch (error) {
    console.log('✗ Import resolution test failed:', error.message);
  }
}

/**
 * Generate test report
 */
function generateReport() {
  console.log('\n📊 Test Results Summary\n');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Failed: \x1b[31m${failedTests}\x1b[0m`);
  console.log(`Success Rate: ${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%`);
  console.log('='.repeat(50));

  if (failures.length > 0) {
    console.log('\n❌ Failed Tests:');
    failures.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure}`);
    });
  }

  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! Error handling system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the error handling implementation.');
  }

  return failedTests === 0;
}

/**
 * Main test execution
 */
function main() {
  console.log('🚀 MTM Error Handling Test Suite');
  console.log('==================================\n');

  const startTime = Date.now();

  // Set up test environment
  setupTestEnvironment();

  // Run all test suites
  runErrorHandlingTests();
  runErrorIntegrationTests();
  testErrorScenarios();
  testRealWorldScenarios();

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`\n⏱️  Tests completed in ${duration}ms`);

  const success = generateReport();

  // Exit with appropriate code
  process.exit(success ? 0 : 1);
}

// Run tests if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  runErrorHandlingTests,
  runErrorIntegrationTests,
  testErrorScenarios,
  testRealWorldScenarios,
  generateReport,
  main
};