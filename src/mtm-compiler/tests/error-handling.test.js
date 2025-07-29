/**
 * Unit tests for Error Handling System
 */

const {
  MTMError,
  CompilationError,
  RuntimeError,
  ErrorHandler,
  ComponentErrorBoundary
} = require('../error-handling.js');

describe('Error Handling System', () => {
  describe('MTMError', () => {
    test('should create basic MTM error', () => {
      const error = new MTMError('Test error', 'test-type', { file: 'test.mtm' });

      expect(error.message).toBe('Test error');
      expect(error.type).toBe('test-type');
      expect(error.context.file).toBe('test.mtm');
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('MTMError');
    });

    test('should format error message with context', () => {
      const error = new MTMError('Test error', 'test-type', {
        file: 'test.mtm',
        line: 10,
        column: 5
      });

      const formatted = error.getFormattedMessage();
      expect(formatted).toContain('[test-type] Test error');
      expect(formatted).toContain('File: test.mtm');
      expect(formatted).toContain('Line: 10');
      expect(formatted).toContain('Column: 5');
    });

    test('should convert to JSON', () => {
      const error = new MTMError('Test error', 'test-type', { file: 'test.mtm' });
      const json = error.toJSON();

      expect(json.name).toBe('MTMError');
      expect(json.type).toBe('test-type');
      expect(json.message).toBe('Test error');
      expect(json.context.file).toBe('test.mtm');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('CompilationError', () => {
    test('should create route conflict error', () => {
      const error = CompilationError.routeConflict(
        '/home',
        'pages/home1.mtm',
        'pages/home2.mtm'
      );

      expect(error.type).toBe('compilation-route-conflict');
      expect(error.subtype).toBe('route-conflict');
      expect(error.message).toContain('Route "/home" is already registered');
      expect(error.context.route).toBe('/home');
      expect(error.context.existingFile).toBe('pages/home1.mtm');
      expect(error.context.newFile).toBe('pages/home2.mtm');
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    test('should create dynamic route conflict error', () => {
      const error = CompilationError.dynamicRouteConflict(
        '/user/[id]',
        '/user/[userId]',
        'pages/user1.mtm',
        'pages/user2.mtm'
      );

      expect(error.type).toBe('compilation-dynamic-route-conflict');
      expect(error.message).toContain('Dynamic routes "/user/[id]" and "/user/[userId]" conflict');
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    test('should create import resolution error', () => {
      const error = CompilationError.importResolution(
        '@components/NonExistent.tsx',
        'pages/test.mtm',
        5,
        ['src/components/NonExistent.tsx', 'src/components/NonExistent.tsx.tsx']
      );

      expect(error.type).toBe('compilation-import-resolution');
      expect(error.message).toContain('Cannot resolve import "@components/NonExistent.tsx"');
      expect(error.context.importPath).toBe('@components/NonExistent.tsx');
      expect(error.context.file).toBe('pages/test.mtm');
      expect(error.context.line).toBe(5);
      expect(error.context.searchPaths).toHaveLength(2);
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    test('should create syntax error', () => {
      const error = CompilationError.syntax(
        'Unexpected token',
        'test.mtm',
        10,
        15,
        '$variable = {'
      );

      expect(error.type).toBe('compilation-syntax');
      expect(error.context.file).toBe('test.mtm');
      expect(error.context.line).toBe(10);
      expect(error.context.column).toBe(15);
      expect(error.context.source).toBe('$variable = {');
    });

    test('should create frontmatter validation error', () => {
      const error = CompilationError.frontmatterValidation(
        'route',
        'invalid-route',
        'test.mtm',
        ['/valid-route']
      );

      expect(error.type).toBe('compilation-frontmatter-validation');
      expect(error.context.field).toBe('route');
      expect(error.context.value).toBe('invalid-route');
      expect(error.context.validValues).toEqual(['/valid-route']);
    });

    test('should create framework mismatch error', () => {
      const error = CompilationError.frameworkMismatch(
        'TestComponent',
        'react',
        'vue',
        'test.mtm'
      );

      expect(error.type).toBe('compilation-framework-mismatch');
      expect(error.context.componentName).toBe('TestComponent');
      expect(error.context.expectedFramework).toBe('react');
      expect(error.context.actualFramework).toBe('vue');
      expect(error.severity).toBe('warning');
    });

    test('should format error message with suggestions', () => {
      const error = CompilationError.routeConflict(
        '/home',
        'pages/home1.mtm',
        'pages/home2.mtm'
      );

      const formatted = error.getFormattedMessage();
      expect(formatted).toContain('Suggestions:');
      expect(formatted).toContain('1. Change the route');
    });
  });

  describe('RuntimeError', () => {
    test('should create navigation error', () => {
      const error = RuntimeError.navigation(
        '/nonexistent',
        'Route not found',
        { currentPath: '/home' }
      );

      expect(error.type).toBe('runtime-navigation');
      expect(error.message).toContain('Navigation to "/nonexistent" failed');
      expect(error.context.path).toBe('/nonexistent');
      expect(error.context.reason).toBe('Route not found');
      expect(error.context.currentPath).toBe('/home');
      expect(error.recoveryActions.length).toBeGreaterThan(0);
    });

    test('should create component mount error', () => {
      const error = RuntimeError.componentMount(
        'TestComponent',
        'Props validation failed',
        { props: { invalid: true } }
      );

      expect(error.type).toBe('runtime-component-mount');
      expect(error.message).toContain('Failed to mount component "TestComponent"');
      expect(error.context.componentName).toBe('TestComponent');
      expect(error.context.reason).toBe('Props validation failed');
      expect(error.context.props).toEqual({ invalid: true });
    });

    test('should create state management error', () => {
      const error = RuntimeError.stateManagement(
        'updateSignal',
        'Signal not found',
        { signalName: 'count' }
      );

      expect(error.type).toBe('runtime-state-management');
      expect(error.message).toContain('State management operation "updateSignal" failed');
      expect(error.context.operation).toBe('updateSignal');
      expect(error.context.signalName).toBe('count');
    });

    test('should create framework runtime error', () => {
      const error = RuntimeError.frameworkRuntime(
        'React',
        'Hook called outside component',
        { hook: 'useState' }
      );

      expect(error.type).toBe('runtime-framework-runtime');
      expect(error.message).toContain('React runtime error');
      expect(error.context.framework).toBe('React');
      expect(error.context.hook).toBe('useState');
    });

    test('should format error message with recovery actions', () => {
      const error = RuntimeError.navigation('/nonexistent', 'Route not found');
      const formatted = error.getFormattedMessage();

      expect(formatted).toContain('Recovery Actions:');
      expect(formatted).toContain('1. Check if the route');
    });
  });

  describe('ErrorHandler', () => {
    let errorHandler;

    beforeEach(() => {
      errorHandler = new ErrorHandler();
    });

    test('should register and call error handlers', () => {
      const mockHandler = jest.fn();
      errorHandler.registerHandler('test-error', mockHandler);

      const error = new MTMError('Test', 'test-error');
      errorHandler.handleError(error);

      expect(mockHandler).toHaveBeenCalledWith(error);
    });

    test('should separate errors and warnings', () => {
      const error = new CompilationError('Error', 'test', { severity: 'error' });
      const warning = new CompilationError('Warning', 'test', { severity: 'warning' });

      errorHandler.handleError(error);
      errorHandler.handleError(warning);

      expect(errorHandler.getErrors()).toHaveLength(1);
      expect(errorHandler.getWarnings()).toHaveLength(1);
      expect(errorHandler.hasErrors()).toBe(true);
      expect(errorHandler.hasWarnings()).toBe(true);
    });

    test('should clear errors and warnings', () => {
      const error = new MTMError('Test', 'test-error');
      errorHandler.handleError(error);

      expect(errorHandler.hasErrors()).toBe(true);
      errorHandler.clear();
      expect(errorHandler.hasErrors()).toBe(false);
    });

    test('should provide error summary', () => {
      const error = new CompilationError('Error', 'test', { severity: 'error' });
      const warning = new CompilationError('Warning', 'test', { severity: 'warning' });

      errorHandler.handleError(error);
      errorHandler.handleError(warning);

      const summary = errorHandler.getSummary();
      expect(summary.errorCount).toBe(1);
      expect(summary.warningCount).toBe(1);
      expect(summary.errors).toHaveLength(1);
      expect(summary.warnings).toHaveLength(1);
    });

    test('should handle errors in error handlers gracefully', () => {
      const faultyHandler = jest.fn(() => {
        throw new Error('Handler error');
      });

      errorHandler.registerHandler('test-error', faultyHandler);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new MTMError('Test', 'test-error');
      errorHandler.handleError(error);

      expect(faultyHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error in error handler:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('ComponentErrorBoundary', () => {
    let errorBoundary;
    let mockFallbackRenderer;

    beforeEach(() => {
      mockFallbackRenderer = jest.fn().mockReturnValue('<div>Fallback</div>');
      errorBoundary = new ComponentErrorBoundary('TestComponent', mockFallbackRenderer);
    });

    test('should render component successfully', () => {
      const mockRenderFunction = jest.fn().mockReturnValue('<div>Success</div>');
      const result = errorBoundary.tryRender(mockRenderFunction, { prop: 'value' });

      expect(result).toBe('<div>Success</div>');
      expect(mockRenderFunction).toHaveBeenCalledWith({ prop: 'value' });
      expect(mockFallbackRenderer).not.toHaveBeenCalled();
    });

    test('should render fallback on error', () => {
      const mockRenderFunction = jest.fn().mockImplementation(() => {
        throw new Error('Render error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = errorBoundary.tryRender(mockRenderFunction, { prop: 'value' });

      expect(result).toBe('<div>Fallback</div>');
      expect(mockFallbackRenderer).toHaveBeenCalled();
      expect(errorBoundary.errorCount).toBe(1);
      expect(errorBoundary.lastError).toBeInstanceOf(Error);

      consoleSpy.mockRestore();
    });

    test('should use default fallback renderer', () => {
      const defaultBoundary = new ComponentErrorBoundary('TestComponent');
      const mockRenderFunction = jest.fn().mockImplementation(() => {
        throw new Error('Render error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = defaultBoundary.tryRender(mockRenderFunction);

      expect(result).toContain('Component Error: TestComponent');
      expect(result).toContain('Render error');

      consoleSpy.mockRestore();
    });

    test('should track error count', () => {
      const mockRenderFunction = jest.fn().mockImplementation(() => {
        throw new Error('Render error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      errorBoundary.tryRender(mockRenderFunction);
      errorBoundary.tryRender(mockRenderFunction);

      expect(errorBoundary.errorCount).toBe(2);

      consoleSpy.mockRestore();
    });

    test('should reset error state', () => {
      const mockRenderFunction = jest.fn().mockImplementation(() => {
        throw new Error('Render error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      errorBoundary.tryRender(mockRenderFunction);
      expect(errorBoundary.errorCount).toBe(1);

      errorBoundary.reset();
      expect(errorBoundary.errorCount).toBe(0);
      expect(errorBoundary.lastError).toBeNull();

      consoleSpy.mockRestore();
    });

    test('should include error count in default fallback', () => {
      const defaultBoundary = new ComponentErrorBoundary('TestComponent');
      const mockRenderFunction = jest.fn().mockImplementation(() => {
        throw new Error('Render error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // First error
      defaultBoundary.tryRender(mockRenderFunction);
      // Second error
      const result = defaultBoundary.tryRender(mockRenderFunction);

      expect(result).toContain('Error count: 2');

      consoleSpy.mockRestore();
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

module.exports = {
  MTMError,
  CompilationError,
  RuntimeError,
  ErrorHandler,
  ComponentErrorBoundary
};