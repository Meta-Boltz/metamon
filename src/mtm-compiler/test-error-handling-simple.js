#!/usr/bin/env node

/**
 * Simple test for error handling system
 * Tests core functionality without complex mocking
 */

const { CompilationError, RuntimeError, ErrorHandler, ComponentErrorBoundary } = require('./error-handling.js');

console.log('🧪 Testing MTM Error Handling System\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}: ${error.message}`);
    failed++;
  }
}

// Test CompilationError
test('CompilationError.routeConflict creates proper error', () => {
  const error = CompilationError.routeConflict('/home', 'home1.mtm', 'home2.mtm');
  if (error.type !== 'compilation-route-conflict') throw new Error('Wrong error type');
  if (!error.message.includes('Route "/home" is already registered')) throw new Error('Wrong message');
  if (error.suggestions.length === 0) throw new Error('No suggestions provided');
});

test('CompilationError.importResolution creates proper error', () => {
  const error = CompilationError.importResolution('@components/Missing.tsx', 'test.mtm', 5);
  if (error.type !== 'compilation-import-resolution') throw new Error('Wrong error type');
  if (!error.message.includes('Cannot resolve import')) throw new Error('Wrong message');
  if (error.context.line !== 5) throw new Error('Wrong line number');
});

test('CompilationError.frontmatterValidation creates proper error', () => {
  const error = CompilationError.frontmatterValidation('route', 'invalid', 'test.mtm');
  if (error.type !== 'compilation-frontmatter-validation') throw new Error('Wrong error type');
  if (error.context.field !== 'route') throw new Error('Wrong field');
});

// Test RuntimeError
test('RuntimeError.componentMount creates proper error', () => {
  const error = RuntimeError.componentMount('TestComponent', 'Mount failed');
  if (error.type !== 'runtime-component-mount') throw new Error('Wrong error type');
  if (!error.message.includes('Failed to mount component')) throw new Error('Wrong message');
  if (error.recoveryActions.length === 0) throw new Error('No recovery actions');
});

test('RuntimeError.navigation creates proper error', () => {
  const error = RuntimeError.navigation('/invalid', 'Route not found');
  if (error.type !== 'runtime-navigation') throw new Error('Wrong error type');
  if (!error.message.includes('Navigation to "/invalid" failed')) throw new Error('Wrong message');
});

// Test ErrorHandler
test('ErrorHandler tracks errors correctly', () => {
  const handler = new ErrorHandler();
  const error = CompilationError.syntax('Test error', 'test.mtm', 10, 5);

  // Suppress console output
  const originalError = console.error;
  console.error = () => { };

  handler.handleError(error);

  console.error = originalError;

  if (!handler.hasErrors()) throw new Error('Error not tracked');
  if (handler.getErrors().length !== 1) throw new Error('Wrong error count');
});

test('ErrorHandler separates errors and warnings', () => {
  const handler = new ErrorHandler();
  const error = new CompilationError('Error', 'test', { severity: 'error' });
  const warning = new CompilationError('Warning', 'test', { severity: 'warning' });

  // Suppress console output
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => { };
  console.warn = () => { };

  handler.handleError(error);
  handler.handleError(warning);

  console.error = originalError;
  console.warn = originalWarn;

  if (handler.getErrors().length !== 1) throw new Error('Wrong error count');
  if (handler.getWarnings().length !== 1) throw new Error('Wrong warning count');
});

// Test ComponentErrorBoundary
test('ComponentErrorBoundary handles successful render', () => {
  const boundary = new ComponentErrorBoundary('TestComponent');
  const successRender = () => '<div>Success</div>';

  const result = boundary.tryRender(successRender);
  if (result !== '<div>Success</div>') throw new Error('Wrong render result');
  if (boundary.errorCount !== 0) throw new Error('Error count should be 0');
});

test('ComponentErrorBoundary handles failed render', () => {
  const boundary = new ComponentErrorBoundary('TestComponent');
  const failRender = () => {
    throw new Error('Render failed');
  };

  // Suppress console output
  const originalError = console.error;
  console.error = () => { };

  const result = boundary.tryRender(failRender);

  console.error = originalError;

  if (!result.includes('Component Error: TestComponent')) throw new Error('Wrong fallback render');
  if (boundary.errorCount !== 1) throw new Error('Error count should be 1');
});

test('ComponentErrorBoundary resets correctly', () => {
  const boundary = new ComponentErrorBoundary('TestComponent');
  const failRender = () => {
    throw new Error('Render failed');
  };

  // Suppress console output
  const originalError = console.error;
  console.error = () => { };

  boundary.tryRender(failRender);
  boundary.reset();

  console.error = originalError;

  if (boundary.errorCount !== 0) throw new Error('Error count should be reset to 0');
  if (boundary.lastError !== null) throw new Error('Last error should be null');
});

// Test error formatting
test('Error formatting includes suggestions', () => {
  const error = CompilationError.routeConflict('/home', 'home1.mtm', 'home2.mtm');
  const formatted = error.getFormattedMessage();

  if (!formatted.includes('Suggestions:')) throw new Error('Missing suggestions section');
  if (!formatted.includes('1. Change the route')) throw new Error('Missing specific suggestion');
});

test('Error formatting includes recovery actions', () => {
  const error = RuntimeError.componentMount('TestComponent', 'Mount failed');
  const formatted = error.getFormattedMessage();

  if (!formatted.includes('Recovery Actions:')) throw new Error('Missing recovery actions section');
  if (!formatted.includes('1. Check if the component')) throw new Error('Missing specific recovery action');
});

// Test integration with existing components
test('Enhanced parser integration', () => {
  const { EnhancedMTMParser } = require('./enhanced-parser.js');
  const parser = new EnhancedMTMParser();

  const invalidFrontmatter = { route: 'invalid-route', compileJsMode: 'invalid' };
  const errors = parser.validateFrontmatter(invalidFrontmatter, 'test.mtm');

  if (errors.length !== 2) throw new Error('Should have 2 validation errors');
  if (!(errors[0] instanceof CompilationError)) throw new Error('Should return CompilationError instances');
});

test('Route registry integration', () => {
  const { RouteRegistry } = require('./route-registry.js');
  const registry = new RouteRegistry();

  registry.register('/home', { file: 'home1.mtm' });

  try {
    registry.register('/home', { file: 'home2.mtm' });
    throw new Error('Should have thrown route conflict error');
  } catch (error) {
    if (!(error instanceof CompilationError)) throw new Error('Should throw CompilationError');
    if (error.type !== 'compilation-route-conflict') throw new Error('Wrong error type');
  }
});

// Summary
console.log('\n📊 Test Results:');
console.log(`✓ Passed: ${passed}`);
console.log(`✗ Failed: ${failed}`);
console.log(`Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

if (failed === 0) {
  console.log('\n🎉 All core error handling tests passed!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
  process.exit(1);
}