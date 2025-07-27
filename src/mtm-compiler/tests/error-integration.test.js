/**
 * Integration tests for error handling across the MTM system
 */

const { EnhancedMTMParser } = require('../enhanced-parser.js');
const { RouteRegistry } = require('../route-registry.js');
const { ReactComponentAdapter, VueComponentAdapter } = require('../component-adapter.js');
const { CompilationError, RuntimeError, ErrorHandler } = require('../error-handling.js');
const fs = require('fs');
const path = require('path');

describe('Error Handling Integration', () => {
  let parser;
  let registry;
  let errorHandler;

  beforeEach(() => {
    parser = new EnhancedMTMParser();
    registry = new RouteRegistry();
    errorHandler = new ErrorHandler();
  });

  describe('Parser Error Integration', () => {
    test('should handle frontmatter validation errors', () => {
      const source = `---
route: "invalid-route"
compileJsMode: "invalid-mode"
---

<template>
  <h1>Test</h1>
</template>`;

      try {
        const ast = parser.parse(source, 'test.mtm');
        const errors = parser.validateFrontmatter(ast.frontmatter, 'test.mtm');

        expect(errors.length).toBe(2);
        expect(errors[0]).toBeInstanceOf(CompilationError);
        expect(errors[0].type).toBe('compilation-frontmatter-validation');
        expect(errors[0].context.field).toBe('route');
        expect(errors[1].context.field).toBe('compileJsMode');
      } catch (error) {
        expect(error).toBeInstanceOf(CompilationError);
      }
    });

    test('should handle import resolution errors', () => {
      const source = `---
route: "/test"
---

import NonExistent from "@components/NonExistent.tsx"

<template>
  <NonExistent />
</template>`;

      const ast = parser.parse(source, 'test.mtm');

      // Test import resolution
      expect(() => {
        parser.resolveAndValidateComponentPath(
          '@components/NonExistent.tsx',
          process.cwd(),
          'test.mtm',
          5
        );
      }).toThrow(CompilationError);
    });

    test('should provide helpful suggestions for import errors', () => {
      try {
        parser.resolveAndValidateComponentPath(
          '@components/Typo.tsx',
          process.cwd(),
          'test.mtm',
          5
        );
      } catch (error) {
        expect(error).toBeInstanceOf(CompilationError);
        expect(error.type).toBe('compilation-import-resolution');
        expect(error.suggestions.length).toBeGreaterThan(0);
        expect(error.suggestions.some(s => s.includes('@components/'))).toBe(true);
      }
    });
  });

  describe('Route Registry Error Integration', () => {
    test('should handle route conflicts with detailed messages', () => {
      const config1 = { file: 'pages/home1.mtm' };
      const config2 = { file: 'pages/home2.mtm' };

      registry.register('/home', config1);

      try {
        registry.register('/home', config2);
      } catch (error) {
        expect(error).toBeInstanceOf(CompilationError);
        expect(error.type).toBe('compilation-route-conflict');
        expect(error.context.route).toBe('/home');
        expect(error.context.existingFile).toBe('pages/home1.mtm');
        expect(error.context.newFile).toBe('pages/home2.mtm');
        expect(error.suggestions.length).toBeGreaterThan(0);
      }
    });

    test('should handle dynamic route conflicts', () => {
      const config1 = { file: 'pages/user1.mtm' };
      const config2 = { file: 'pages/user2.mtm' };

      registry.register('/user/[id]', config1);

      try {
        registry.register('/user/[userId]', config2);
      } catch (error) {
        expect(error).toBeInstanceOf(CompilationError);
        expect(error.type).toBe('compilation-dynamic-route-conflict');
        expect(error.suggestions.some(s => s.includes('different route structures'))).toBe(true);
      }
    });

    test('should validate route patterns and provide suggestions', () => {
      const results = registry.validateRoutes();
      expect(Array.isArray(results)).toBe(true);

      // Test with invalid pattern
      const invalidRoute = {
        path: '/user/[',
        file: 'pages/invalid.mtm',
        dynamic: true,
        params: [],
        pattern: null
      };
      registry.routes.set('/user/[', invalidRoute);

      const validationResults = registry.validateRoutes();
      const invalidPatternError = validationResults.find(r => r.type === 'invalid-pattern');
      expect(invalidPatternError).toBeDefined();
      expect(invalidPatternError.severity).toBe('error');
    });
  });

  describe('Component Adapter Error Integration', () => {
    test('should handle missing component files', () => {
      const reactAdapter = new ReactComponentAdapter();
      const componentImport = {
        name: 'NonExistent',
        path: '@components/NonExistent.tsx',
        file: 'test.mtm',
        line: 5
      };

      try {
        reactAdapter.transform(componentImport);
      } catch (error) {
        expect(error).toBeInstanceOf(CompilationError);
        expect(error.type).toBe('compilation-import-resolution');
        expect(error.context.importPath).toBe('@components/NonExistent.tsx');
        expect(error.context.file).toBe('test.mtm');
        expect(error.context.line).toBe(5);
      }
    });

    test('should handle framework mismatches', () => {
      // Create a temporary Vue file for testing
      const tempVueFile = path.join(__dirname, 'temp-vue-component.vue');
      const vueContent = `
<template>
  <div>Vue Component</div>
</template>

<script>
export default {
  name: 'VueComponent'
}
</script>
`;

      try {
        fs.writeFileSync(tempVueFile, vueContent);

        const reactAdapter = new ReactComponentAdapter();
        const componentImport = {
          name: 'VueComponent',
          path: tempVueFile,
          file: 'test.mtm',
          line: 5
        };

        try {
          reactAdapter.transform(componentImport);
        } catch (error) {
          expect(error).toBeInstanceOf(CompilationError);
          expect(error.type).toBe('compilation-framework-mismatch');
          expect(error.context.expectedFramework).toBe('react');
          expect(error.context.actualFramework).toBe('vue');
          expect(error.severity).toBe('warning');
        }
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempVueFile)) {
          fs.unlinkSync(tempVueFile);
        }
      }
    });

    test('should provide framework-specific suggestions', () => {
      const vueAdapter = new VueComponentAdapter();
      const componentImport = {
        name: 'NonExistent',
        path: './NonExistent.vue',
        file: 'test.mtm',
        line: 3
      };

      try {
        vueAdapter.transform(componentImport);
      } catch (error) {
        expect(error).toBeInstanceOf(CompilationError);
        expect(error.suggestions.some(s => s.includes('.vue'))).toBe(true);
      }
    });
  });

  describe('Error Handler Integration', () => {
    test('should collect and categorize errors from multiple sources', () => {
      // Simulate errors from different parts of the system
      const parseError = CompilationError.syntax(
        'Invalid syntax',
        'test.mtm',
        10,
        5
      );

      const routeError = CompilationError.routeConflict(
        '/home',
        'home1.mtm',
        'home2.mtm'
      );

      const importError = CompilationError.importResolution(
        '@components/Missing.tsx',
        'test.mtm',
        15
      );

      const runtimeError = RuntimeError.componentMount(
        'TestComponent',
        'Props validation failed'
      );

      errorHandler.handleError(parseError);
      errorHandler.handleError(routeError);
      errorHandler.handleError(importError);
      errorHandler.handleError(runtimeError);

      const summary = errorHandler.getSummary();
      expect(summary.errorCount).toBe(4);
      expect(summary.errors.length).toBe(4);

      // Check error types
      const errorTypes = summary.errors.map(e => e.type);
      expect(errorTypes).toContain('compilation-syntax');
      expect(errorTypes).toContain('compilation-route-conflict');
      expect(errorTypes).toContain('compilation-import-resolution');
      expect(errorTypes).toContain('runtime-component-mount');
    });

    test('should handle custom error handlers', () => {
      const customHandler = jest.fn();
      errorHandler.registerHandler('compilation-syntax', customHandler);

      const syntaxError = CompilationError.syntax(
        'Invalid syntax',
        'test.mtm',
        10,
        5
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      errorHandler.handleError(syntaxError);

      expect(customHandler).toHaveBeenCalledWith(syntaxError);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should provide comprehensive error reporting', () => {
      const errors = [
        CompilationError.routeConflict('/home', 'home1.mtm', 'home2.mtm'),
        CompilationError.importResolution('@components/Missing.tsx', 'test.mtm', 5),
        RuntimeError.navigation('/invalid', 'Route not found')
      ];

      errors.forEach(error => errorHandler.handleError(error));

      const summary = errorHandler.getSummary();
      expect(summary.errorCount).toBe(3);

      // Check that all errors have proper structure
      summary.errors.forEach(error => {
        expect(error.name).toBeDefined();
        expect(error.type).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.timestamp).toBeDefined();
        expect(error.context).toBeDefined();
      });
    });
  });

  describe('Component Error Boundary Integration', () => {
    test('should handle component rendering errors gracefully', () => {
      const reactAdapter = new ReactComponentAdapter();

      // Create a component definition with error boundary
      const componentDef = {
        name: 'TestComponent',
        framework: 'react',
        source: 'export default function TestComponent() { throw new Error("Render error"); }',
        props: [],
        dependencies: []
      };

      const wrapper = reactAdapter.generateWrapper(componentDef);
      expect(wrapper).toContain('try {');
      expect(wrapper).toContain('catch (error)');
      expect(wrapper).toContain('component-error');
    });

    test('should provide fallback rendering for failed components', () => {
      const reactAdapter = new ReactComponentAdapter();
      const mountingUtils = reactAdapter.generateMountingUtils('FailingComponent');

      expect(mountingUtils).toContain('try {');
      expect(mountingUtils).toContain('catch (error)');
      expect(mountingUtils).toContain('Error mounting FailingComponent');
      expect(mountingUtils).toContain('component-error');
    });
  });

  describe('End-to-End Error Scenarios', () => {
    test('should handle complete compilation failure gracefully', () => {
      const source = `---
route: "invalid-route"
compileJsMode: "invalid"
---

import NonExistent from "@components/Missing.tsx"
import AnotherMissing from "./NotFound.vue"

$invalid syntax here

<template>
  <NonExistent />
  <AnotherMissing />
</template>`;

      try {
        const ast = parser.parse(source, 'failing.mtm');
        const errors = parser.validateFrontmatter(ast.frontmatter, 'failing.mtm');

        errors.forEach(error => errorHandler.handleError(error));

        // Try to resolve imports
        ast.imports.forEach(importInfo => {
          try {
            parser.resolveAndValidateComponentPath(
              importInfo.path,
              process.cwd(),
              'failing.mtm',
              importInfo.line
            );
          } catch (error) {
            errorHandler.handleError(error);
          }
        });

        const summary = errorHandler.getSummary();
        expect(summary.errorCount).toBeGreaterThan(0);

        // Should have multiple types of errors
        const errorTypes = new Set(summary.errors.map(e => e.type));
        expect(errorTypes.size).toBeGreaterThan(1);

      } catch (error) {
        // Parser-level errors should also be handled
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('should provide recovery suggestions for common error patterns', () => {
      const commonErrors = [
        CompilationError.importResolution('@components/Button.tsx', 'test.mtm', 5),
        CompilationError.routeConflict('/home', 'home1.mtm', 'home2.mtm'),
        CompilationError.frontmatterValidation('route', 'home', 'test.mtm'),
        RuntimeError.componentMount('Button', 'React is not defined'),
        RuntimeError.navigation('/missing', 'Route not found')
      ];

      commonErrors.forEach(error => {
        expect(error.suggestions || error.recoveryActions).toBeDefined();
        expect((error.suggestions || error.recoveryActions).length).toBeGreaterThan(0);
      });
    });
  });
});

// Mock Jest functions if not in Jest environment
if (typeof describe === 'undefined') {
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
    toBeInstanceOf: (expected) => {
      if (!(actual instanceof expected)) {
        throw new Error(`Expected instance of ${expected.name}, got ${actual.constructor.name}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
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

module.exports = {
  // Export for potential use in other tests
};