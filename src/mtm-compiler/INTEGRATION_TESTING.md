# Enhanced MTM Framework - Integration Testing Guide

This document provides comprehensive information about the integration testing suite for the Enhanced MTM Framework, covering end-to-end navigation flows, multi-framework component interaction, browser compatibility, and production build functionality.

## Overview

The integration testing suite validates the complete Enhanced MTM Framework functionality across different environments and use cases. It ensures that all components work together seamlessly and meet performance benchmarks.

## Test Structure

### Test Categories

1. **Comprehensive Integration Tests** (`comprehensive-integration.test.js`)

   - End-to-end user navigation flows
   - Multi-framework component interaction
   - State management across frameworks
   - Component lifecycle testing

2. **Browser Compatibility Tests** (`browser-compatibility.test.js`)

   - Modern browser feature support
   - Cross-browser DOM compatibility
   - Mobile and touch event handling
   - Performance across different browsers
   - Accessibility compliance

3. **Production Build Tests** (`production-build.test.js`)

   - JavaScript minification and optimization
   - CSS optimization and unused code removal
   - Asset optimization and compression
   - Performance benchmarks
   - Code splitting functionality

4. **Navigation Integration Tests** (`navigation-integration.test.js`)

   - Route discovery and registration
   - Client-side navigation
   - Browser history integration
   - URL updating and bookmarking

5. **Error Handling Tests** (`error-handling.test.js`)
   - Compilation error handling
   - Runtime error recovery
   - Component mounting failures
   - Route resolution errors

## Running Tests

### Quick Start

```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:integration -- --suite comprehensive-integration

# Run smoke tests only
npm run test:integration -- --smoke

# Run with coverage
npm run test:integration -- --coverage

# Run with verbose output
npm run test:integration -- --verbose
```

### Using the Test Runner

```bash
# Direct execution
node src/mtm-compiler/run-integration-tests.js

# With options
node src/mtm-compiler/run-integration-tests.js --suite browser-compatibility --verbose

# CI mode
node src/mtm-compiler/tests/ci-test-suite.js
```

### Jest Commands

```bash
# Run specific test file
npx jest src/mtm-compiler/tests/comprehensive-integration.test.js

# Run with watch mode
npx jest --watch

# Run with coverage
npx jest --coverage

# Run in debug mode
npx jest --detectOpenHandles --forceExit
```

## Test Configuration

### Jest Configuration

The test suite uses Jest with the following key configurations:

- **Environment**: jsdom for DOM simulation
- **Timeout**: 30 seconds per test
- **Coverage**: Enabled with thresholds (70% minimum)
- **Reporters**: HTML, JUnit, and console output
- **Setup**: Custom setup file with global utilities

### Environment Variables

```bash
# Test environment
NODE_ENV=test

# Test timeout (milliseconds)
TEST_TIMEOUT=30000

# Enable debug output
DEBUG_TESTS=true

# Coverage threshold
COVERAGE_THRESHOLD=70
```

## Test Scenarios

### End-to-End Navigation Flow

Tests complete user journeys through the application:

```javascript
// Example test scenario
test("should handle complete user navigation journey", async () => {
  // Create test pages
  const pages = [
    { route: "/", title: "Home" },
    { route: "/about", title: "About" },
    { route: "/react-example", title: "React Example" },
    { route: "/vue-example", title: "Vue Example" },
  ];

  // Initialize navigation system
  await navigation.initialize(tempDir);

  // Test navigation flow: Home → About → React → Vue → Home
  const navigationFlow = [
    { from: "/", to: "/about", expectedTitle: "About Page" },
    { from: "/about", to: "/react-example", expectedTitle: "React Example" },
    {
      from: "/react-example",
      to: "/vue-example",
      expectedTitle: "Vue Example",
    },
    { from: "/vue-example", to: "/", expectedTitle: "Home Page" },
  ];

  // Verify each navigation step
  for (const step of navigationFlow) {
    // Simulate navigation and verify results
  }
});
```

### Multi-Framework Component Interaction

Tests components from different frameworks working together:

```javascript
test("should handle React and Vue components on same page", async () => {
  const mixedContent = `---
route: "/mixed"
title: "Mixed Framework Page"
---

import ReactCounter from "@components/Counter.tsx"
import VueButton from "@components/Button.vue"

$sharedState! = signal('sharedState', { count: 0, message: '' })

<template>
  <div class="mixed-framework">
    <ReactCounter value={$sharedState.count} />
    <VueButton onClick={$handleClick} />
  </div>
</template>`;

  const result = await compiler.compile(mixedContent);

  // Verify both frameworks are integrated
  expect(result.imports).toContainEqual(
    expect.objectContaining({ framework: "react" })
  );
  expect(result.imports).toContainEqual(
    expect.objectContaining({ framework: "vue" })
  );
});
```

### Browser Compatibility Testing

Tests across different browser environments:

```javascript
test("should support ES6+ features in modern browsers", async () => {
  const modernContent = `---
route: "/modern-browser"
compileJsMode: "external.js"
---

$testAsyncAwait = async () => {
  const data = await fetch('/api/data');
  return data.json();
}

<template>
  <button onclick={$testAsyncAwait}>Test Modern Features</button>
</template>`;

  const result = await compiler.compile(modernContent, {
    browserTarget: "es2020",
  });

  expect(result.javascript).toContain("async");
  expect(result.javascript).toContain("await");
});
```

### Production Build Optimization

Tests build optimization and performance:

```javascript
test("should minify JavaScript in production mode", async () => {
  const content = `/* Large unoptimized content */`;

  // Development build
  const devResult = await compiler.compile(content, {
    production: false,
    minify: false,
  });

  // Production build
  const prodResult = await compiler.compile(content, {
    production: true,
    minify: true,
  });

  // Production should be smaller
  expect(prodResult.javascript.length).toBeLessThan(
    devResult.javascript.length
  );
});
```

## Performance Benchmarks

The test suite includes performance benchmarks to ensure the framework meets quality standards:

### Compilation Performance

- **Target**: < 5 seconds for typical pages
- **Measurement**: Time from compile start to completion
- **Threshold**: Fail if > 10 seconds

### Bundle Size

- **Target**: < 1MB for production builds
- **Measurement**: Total JavaScript + CSS size
- **Threshold**: Warn if > 500KB, fail if > 2MB

### Runtime Performance

- **Target**: < 100ms for DOM operations
- **Measurement**: Time for DOM manipulation tasks
- **Threshold**: Fail if > 500ms

### Memory Usage

- **Target**: < 50MB heap usage
- **Measurement**: JavaScript heap size
- **Threshold**: Warn if > 100MB

## Accessibility Testing

Tests ensure the framework generates accessible HTML:

```javascript
test("should maintain accessibility features", async () => {
  const a11yContent = `---
route: "/accessibility"
---

<template>
  <div class="accessible-page">
    <nav aria-label="Main navigation">
      <a href="/home" aria-current="page">Home</a>
    </nav>
    
    <main>
      <h1>Accessible Content</h1>
      <form>
        <label for="name">Name (required)</label>
        <input type="text" id="name" required aria-describedby="name-help" />
        <div id="name-help">Please enter your full name</div>
      </form>
    </main>
    
    <div aria-live="polite" class="sr-only">
      Status updates appear here
    </div>
  </div>
</template>`;

  const result = await compiler.compile(a11yContent);

  // Verify accessibility features
  expect(result.html).toContain("aria-label");
  expect(result.html).toContain("aria-describedby");
  expect(result.html).toContain("aria-live");
  expect(result.html).toContain("sr-only");
});
```

## Continuous Integration

### CI Test Suite

The CI test suite (`ci-test-suite.js`) provides automated testing for continuous integration:

```bash
# Run full CI suite
node src/mtm-compiler/tests/ci-test-suite.js

# Run smoke tests for quick validation
node src/mtm-compiler/tests/ci-test-suite.js --smoke
```

### Test Reports

The CI suite generates comprehensive reports:

- **JSON Report**: Detailed test results and metrics
- **HTML Report**: Visual test report with charts
- **JUnit XML**: For CI system integration
- **Coverage Report**: Code coverage analysis

### GitHub Actions Integration

Example GitHub Actions workflow:

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Run smoke tests
        run: npm run test:smoke

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: src/mtm-compiler/reports/
```

## Debugging Tests

### Debug Mode

Enable debug output for troubleshooting:

```bash
# Enable debug logging
DEBUG_TESTS=true npm run test:integration

# Run specific test with debug
npx jest --detectOpenHandles --verbose comprehensive-integration.test.js
```

### Common Issues

1. **Timeout Errors**

   - Increase timeout in Jest config
   - Check for hanging promises
   - Verify cleanup in afterEach

2. **DOM Errors**

   - Ensure JSDOM is properly configured
   - Check for missing global variables
   - Verify DOM cleanup between tests

3. **File System Errors**

   - Check temp directory permissions
   - Verify cleanup of test artifacts
   - Ensure unique temp directory names

4. **Memory Leaks**
   - Use `--detectOpenHandles` flag
   - Check for unclosed resources
   - Verify mock cleanup

## Test Utilities

### Global Test Utilities

The test setup provides global utilities:

```javascript
// Create temporary test files
const { filePath, tempDir } = testUtils.createMockMTMFile(content);

// Wait for conditions
await testUtils.waitFor(() => element.textContent === "Expected");

// Simulate user interactions
testUtils.simulateClick(button);
testUtils.simulateKeyPress(input, "Enter");

// Measure performance
const result = await testUtils.measurePerformance(async () => {
  return await someAsyncOperation();
}, "operation-name");

// Custom matchers
expect(result.duration).toBeWithinRange(100, 500);
expect(performanceResult).toHavePerformanceWithin(1000);
expect(mtmCode).toContainMTMSyntax();
```

### Mock Components

Test utilities provide mock components for testing:

```javascript
// Create mock components
const componentsDir = testUtils.createMockComponents();

// Mock components are available at:
// - MockReact.tsx (React component)
// - MockVue.vue (Vue component)
// - MockSvelte.svelte (Svelte component)
```

## Best Practices

### Writing Integration Tests

1. **Test Real Scenarios**: Focus on actual user workflows
2. **Use Realistic Data**: Test with representative content
3. **Verify End Results**: Check final output, not implementation details
4. **Clean Up Resources**: Always clean up temp files and mocks
5. **Handle Async Operations**: Use proper async/await patterns

### Performance Testing

1. **Set Realistic Benchmarks**: Based on actual usage patterns
2. **Test Multiple Scenarios**: Different content sizes and complexity
3. **Monitor Trends**: Track performance over time
4. **Profile Bottlenecks**: Identify slow operations

### Accessibility Testing

1. **Test with Screen Readers**: Verify ARIA attributes work
2. **Check Keyboard Navigation**: Ensure all features are accessible
3. **Validate Color Contrast**: Test readability
4. **Test Focus Management**: Verify focus indicators

## Troubleshooting

### Common Test Failures

1. **Route Registration Failures**

   - Check frontmatter syntax
   - Verify route uniqueness
   - Ensure proper file structure

2. **Component Import Failures**

   - Verify component file paths
   - Check framework detection
   - Ensure proper file extensions

3. **Navigation Failures**

   - Check router configuration
   - Verify event handling
   - Test browser history integration

4. **Performance Benchmark Failures**
   - Review system resources
   - Check for memory leaks
   - Optimize test scenarios

### Getting Help

1. **Check Test Logs**: Review detailed error messages
2. **Run Individual Tests**: Isolate failing scenarios
3. **Enable Debug Mode**: Get additional diagnostic information
4. **Review Documentation**: Check framework documentation
5. **File Issues**: Report bugs with reproduction steps

## Contributing

### Adding New Tests

1. **Follow Naming Conventions**: Use descriptive test names
2. **Group Related Tests**: Organize tests in logical suites
3. **Document Test Purpose**: Add clear descriptions
4. **Include Edge Cases**: Test boundary conditions
5. **Update Documentation**: Keep this guide current

### Test Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### Code Quality

- Use ESLint for code consistency
- Follow Jest best practices
- Write clear, readable tests
- Avoid test interdependencies
- Use meaningful assertions

---

This integration testing suite ensures the Enhanced MTM Framework delivers reliable, performant, and accessible web applications across all supported environments and use cases.
