/**
 * Jest Test Setup for Enhanced MTM Framework Integration Tests
 * 
 * This file configures the test environment and provides global utilities
 * for all integration tests.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Global test configuration
global.TEST_TIMEOUT = 30000;
global.TEST_TEMP_DIR = path.join(__dirname, '..', 'temp-test-artifacts');

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
  resources: 'usable',
  runScripts: 'dangerously'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;

// Mock performance API if not available
if (!global.window.performance) {
  global.window.performance = {
    now: () => Date.now(),
    mark: () => { },
    measure: () => { },
    getEntriesByType: () => [],
    getEntriesByName: () => [],
    clearMarks: () => { },
    clearMeasures: () => { }
  };
}

// Mock memory API for testing
if (!global.window.performance.memory) {
  global.window.performance.memory = {
    usedJSHeapSize: 10 * 1024 * 1024, // 10MB
    totalJSHeapSize: 20 * 1024 * 1024, // 20MB
    jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
  };
}

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ message: 'Mock response' }),
    text: () => Promise.resolve('Mock text response')
  })
);

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock CSS.supports
global.CSS = {
  supports: jest.fn(() => true)
};

// Global test utilities
global.testUtils = {
  // Create a temporary directory for test files
  createTempDir: (name = 'test') => {
    const tempDir = path.join(global.TEST_TEMP_DIR, `${name}-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
  },

  // Clean up temporary directory
  cleanupTempDir: (tempDir) => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  },

  // Create a mock MTM file
  createMockMTMFile: (content, filename = 'test.mtm') => {
    const tempDir = global.testUtils.createTempDir('mtm-file');
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    return { filePath, tempDir };
  },

  // Wait for a condition to be true
  waitFor: async (condition, timeout = 5000, interval = 100) => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Mock component files
  createMockComponents: () => {
    const componentsDir = path.join(global.TEST_TEMP_DIR, 'components');
    if (!fs.existsSync(componentsDir)) {
      fs.mkdirSync(componentsDir, { recursive: true });
    }

    // Mock React component
    const reactComponent = `
import React from 'react';
const MockReactComponent = ({ children, ...props }) => {
  return React.createElement('div', { 
    className: 'mock-react-component',
    'data-testid': 'mock-react',
    ...props 
  }, children);
};
export default MockReactComponent;
    `;
    fs.writeFileSync(path.join(componentsDir, 'MockReact.tsx'), reactComponent);

    // Mock Vue component
    const vueComponent = `
<template>
  <div class="mock-vue-component" data-testid="mock-vue">
    <slot />
  </div>
</template>

<script setup>
// Mock Vue component
</script>
    `;
    fs.writeFileSync(path.join(componentsDir, 'MockVue.vue'), vueComponent);

    // Mock Svelte component
    const svelteComponent = `
<div class="mock-svelte-component" data-testid="mock-svelte">
  <slot />
</div>

<script>
  // Mock Svelte component
</script>
    `;
    fs.writeFileSync(path.join(componentsDir, 'MockSvelte.svelte'), svelteComponent);

    return componentsDir;
  },

  // Simulate user interaction
  simulateClick: (element) => {
    const event = new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: dom.window
    });
    element.dispatchEvent(event);
  },

  simulateKeyPress: (element, key, options = {}) => {
    const event = new dom.window.KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options
    });
    element.dispatchEvent(event);
  },

  // Performance measurement utilities
  measurePerformance: async (fn, name = 'test') => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();

    return {
      result,
      duration: end - start,
      name
    };
  },

  // Memory usage utilities
  getMemoryUsage: () => {
    if (process.memoryUsage) {
      return process.memoryUsage();
    }
    return {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0
    };
  }
};

// Global test matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHavePerformanceWithin(received, maxDuration) {
    const pass = received.duration <= maxDuration;
    if (pass) {
      return {
        message: () =>
          `expected ${received.name} (${received.duration}ms) to take longer than ${maxDuration}ms`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received.name} (${received.duration}ms) to complete within ${maxDuration}ms`,
        pass: false,
      };
    }
  },

  toContainMTMSyntax(received) {
    const mtmPatterns = [
      /\$\w+!/,  // Signal declarations
      /\$\w+\s*=/,  // Signal assignments
      /<template>/,  // Template tags
      /\{#if\s+/,  // Conditional blocks
      /\{#each\s+/,  // Loop blocks
      /\{\$\w+\}/  // Signal interpolation
    ];

    const hasPattern = mtmPatterns.some(pattern => pattern.test(received));

    if (hasPattern) {
      return {
        message: () => `expected string not to contain MTM syntax`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected string to contain MTM syntax patterns`,
        pass: false,
      };
    }
  }
});

// Setup cleanup
beforeEach(() => {
  // Clear DOM
  document.body.innerHTML = '';

  // Reset mocks
  jest.clearAllMocks();

  // Reset fetch mock
  global.fetch.mockClear();
});

afterEach(() => {
  // Clean up any test artifacts
  const tempDirs = fs.readdirSync(global.TEST_TEMP_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('test-'))
    .map(dirent => path.join(global.TEST_TEMP_DIR, dirent.name));

  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Console override for cleaner test output
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out known non-critical warnings
  const message = args.join(' ');
  if (
    message.includes('Warning: ReactDOM.render is deprecated') ||
    message.includes('Warning: componentWillMount has been renamed') ||
    message.includes('jsdom: The resource') ||
    message.includes('Not implemented: HTMLCanvasElement')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

console.log('🔧 Test environment setup complete');
console.log(`📁 Temp directory: ${global.TEST_TEMP_DIR}`);
console.log(`⏱️  Test timeout: ${global.TEST_TIMEOUT}ms`);
console.log('✅ Ready to run integration tests');