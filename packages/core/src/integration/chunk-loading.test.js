/**
 * Integration tests for chunk loading across different export patterns and frameworks
 * 
 * These tests verify that the chunk loading mechanism works correctly with:
 * - Different module export patterns (ESM, CommonJS, UMD)
 * - Various framework integrations (React, Vue, Svelte)
 * - Complex property descriptor scenarios
 * - Real-world chunk loading scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeAssign } from '../utils/safe-assign';
import { ChunkNetworkError, classifyChunkError } from '../utils/chunk-error';
import { withRetry } from '../utils/chunk-retry';

// Mock different module formats
const createESMModule = (exports = {}) => {
  const module = Object.create(null);

  Object.keys(exports).forEach(key => {
    const value = exports[key];
    if (typeof value === 'object' && value.descriptor) {
      Object.defineProperty(module, key, value.descriptor);
    } else {
      module[key] = value;
    }
  });

  return module;
};

// Mock framework-specific components
const createReactComponent = (name = 'TestComponent') => ({
  $$typeof: Symbol.for('react.element'),
  type: function Component() {
    return { type: 'div', props: { children: name } };
  },
  props: {},
  key: null,
  ref: null
});

const createVueComponent = (name = 'TestComponent') => ({
  name,
  setup() {
    return { message: `Hello from ${name}` };
  },
  template: `<div>{{ message }}</div>`
});

const createSvelteComponent = (name = 'TestComponent') => ({
  $$render: (result, props, bindings, slots) => {
    return `<div>${name}</div>`;
  },
  $$props: {},
  $$slots: {}
});

const createCommonJSModule = (exports = {}) => {
  const module = { exports: {} };

  Object.keys(exports).forEach(key => {
    const value = exports[key];
    if (typeof value === 'object' && value.descriptor) {
      Object.defineProperty(module.exports, key, value.descriptor);
    } else {
      module.exports[key] = value;
    }
  });

  return module;
};

const createUMDModule = (exports = {}) => {
  const module = {
    exports: {},
    __esModule: true
  };

  Object.keys(exports).forEach(key => {
    const value = exports[key];
    if (typeof value === 'object' && value.descriptor) {
      Object.defineProperty(module.exports, key, value.descriptor);
    } else {
      module.exports[key] = value;
    }
  });

  return module;
};

// Mock chunk loader function
const mockChunkLoader = async (chunkId, moduleFactory) => {
  try {
    const module = await moduleFactory();

    // Simulate the property assignment that causes the original error
    const chunkData = { id: chunkId, loaded: true };

    // This is where the TypeError would occur with getter-only properties
    const result = safeAssign(module, 'data', chunkData);

    return result;
  } catch (error) {
    throw classifyChunkError(error, { chunkId });
  }
};

describe('Chunk Loading Integration Tests', () => {
  let originalConsoleError;
  let originalConsoleLog;

  beforeEach(() => {
    // Mock console methods to avoid noise in tests
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    console.error = vi.fn();
    console.log = vi.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    vi.clearAllMocks();
  });

  describe('Different Export Patterns', () => {
    it('should load ESM modules with default export', async () => {
      const chunkId = 'esm-default-export';
      const moduleFactory = async () => createESMModule({
        default: createReactComponent('ESMDefault')
      });

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.default).toBeDefined();
      expect(result.default.type).toBeTypeOf('function');
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should load ESM modules with named exports', async () => {
      const chunkId = 'esm-named-exports';
      const moduleFactory = async () => createESMModule({
        Component: createReactComponent('ESMNamed'),
        utils: { helper: () => 'helper' },
        constant: 42
      });

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.Component).toBeDefined();
      expect(result.utils.helper()).toBe('helper');
      expect(result.constant).toBe(42);
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should handle modules with getter-only properties', async () => {
      const chunkId = 'getter-only-module';
      const moduleFactory = async () => {
        const module = createESMModule({});

        // Add a getter-only property that would cause the original error
        Object.defineProperty(module, 'data', {
          get() { return 'original-data'; },
          enumerable: true,
          configurable: true
        });

        return module;
      };

      const result = await mockChunkLoader(chunkId, moduleFactory);

      // The safe assignment should have worked around the getter-only property
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should load CommonJS modules', async () => {
      const chunkId = 'commonjs-module';
      const moduleFactory = async () => createCommonJSModule({
        default: createVueComponent('CommonJSDefault'),
        helper: () => 'commonjs-helper'
      });

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.exports.default).toBeDefined();
      expect(result.exports.default.name).toBe('CommonJSDefault');
      expect(result.exports.helper()).toBe('commonjs-helper');
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should load UMD modules', async () => {
      const chunkId = 'umd-module';
      const moduleFactory = async () => createUMDModule({
        default: createSvelteComponent('UMDDefault'),
        version: '1.0.0'
      });

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.__esModule).toBe(true);
      expect(result.exports.default).toBeDefined();
      expect(result.exports.default.$$render).toBeTypeOf('function');
      expect(result.exports.version).toBe('1.0.0');
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should handle non-configurable properties', async () => {
      const chunkId = 'non-configurable-module';
      const moduleFactory = async () => {
        const module = createESMModule({
          component: createVueComponent('NonConfigurableTest')
        });

        // Add a non-configurable getter-only property
        Object.defineProperty(module, 'data', {
          get() { return 'non-configurable-data'; },
          enumerable: true,
          configurable: false
        });

        return module;
      };

      const result = await mockChunkLoader(chunkId, moduleFactory);

      // Should create a new object with the assigned property
      expect(result.data).toEqual({ id: chunkId, loaded: true });
      expect(result).not.toBe(await moduleFactory()); // Should be a new object
    });

    it('should handle frozen objects', async () => {
      const chunkId = 'frozen-object';
      const moduleFactory = async () => {
        const module = createESMModule({
          component: createReactComponent('FrozenTest')
        });

        return Object.freeze(module);
      };

      const result = await mockChunkLoader(chunkId, moduleFactory);

      // Should create a new object since the original is frozen
      expect(result.component).toBeDefined();
      expect(result.data).toEqual({ id: chunkId, loaded: true });
      expect(Object.isFrozen(result)).toBe(false); // New object should not be frozen
    });
  });

  describe('Framework-Specific Loading', () => {
    it('should load React components correctly', async () => {
      const chunkId = 'react-component';
      const moduleFactory = async () => createESMModule({
        default: createReactComponent('ReactTest'),
        Component: createReactComponent('NamedReactTest')
      });

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.default.$$typeof).toBe(Symbol.for('react.element'));
      expect(result.Component.$$typeof).toBe(Symbol.for('react.element'));
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should load Vue components correctly', async () => {
      const chunkId = 'vue-component';
      const moduleFactory = async () => createESMModule({
        default: createVueComponent('VueTest'),
        NamedComponent: createVueComponent('NamedVueTest')
      });

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.default.name).toBe('VueTest');
      expect(result.default.setup).toBeTypeOf('function');
      expect(result.NamedComponent.name).toBe('NamedVueTest');
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should load Svelte components correctly', async () => {
      const chunkId = 'svelte-component';
      const moduleFactory = async () => createESMModule({
        default: createSvelteComponent('SvelteTest'),
        NamedComponent: createSvelteComponent('NamedSvelteTest')
      });

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.default.$$render).toBeTypeOf('function');
      expect(result.NamedComponent.$$render).toBeTypeOf('function');
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should handle mixed framework exports', async () => {
      const chunkId = 'mixed-framework';
      const moduleFactory = async () => createESMModule({
        ReactComponent: createReactComponent('MixedReact'),
        VueComponent: createVueComponent('MixedVue'),
        SvelteComponent: createSvelteComponent('MixedSvelte'),
        utils: {
          isReact: (comp) => comp.$$typeof === Symbol.for('react.element'),
          isVue: (comp) => comp.setup && typeof comp.setup === 'function',
          isSvelte: (comp) => comp.$$render && typeof comp.$$render === 'function'
        }
      });

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.utils.isReact(result.ReactComponent)).toBe(true);
      expect(result.utils.isVue(result.VueComponent)).toBe(true);
      expect(result.utils.isSvelte(result.SvelteComponent)).toBe(true);
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });
  });

  describe('Complex Property Descriptor Scenarios', () => {
    it('should handle objects with mixed property types', async () => {
      const chunkId = 'mixed-properties';
      const moduleFactory = async () => {
        const module = createESMModule({});

        // Regular writable property
        module.regularProp = 'regular';

        // Getter-only property
        Object.defineProperty(module, 'getterOnly', {
          get() { return 'getter-value'; },
          enumerable: true,
          configurable: true
        });

        // Getter-setter property
        let _getterSetter = 'initial';
        Object.defineProperty(module, 'getterSetter', {
          get() { return _getterSetter; },
          set(value) { _getterSetter = value; },
          enumerable: true,
          configurable: true
        });

        // Non-enumerable property
        Object.defineProperty(module, 'nonEnumerable', {
          value: 'hidden',
          writable: true,
          enumerable: false,
          configurable: true
        });

        return module;
      };

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.regularProp).toBe('regular');
      expect(result.getterOnly).toBe('getter-value');
      expect(result.getterSetter).toBe('initial');
      expect(result.nonEnumerable).toBe('hidden');
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should handle objects with symbol properties', async () => {
      const chunkId = 'symbol-properties';
      const testSymbol = Symbol('test');
      const moduleFactory = async () => {
        const module = createESMModule({
          component: createSvelteComponent('SymbolTest')
        });

        module[testSymbol] = 'symbol-value';

        return module;
      };

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.component).toBeDefined();
      expect(result[testSymbol]).toBe('symbol-value');
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle dynamic imports with code splitting', async () => {
      const chunkId = 'dynamic-import-test';
      const moduleFactory = async () => {
        // Simulate a dynamically imported module with lazy-loaded dependencies
        const lazyDep = await Promise.resolve({
          utility: () => 'lazy-utility'
        });

        return createESMModule({
          default: createReactComponent('DynamicImport'),
          lazy: lazyDep,
          metadata: {
            chunkId,
            loadTime: Date.now(),
            dependencies: ['lazy-dep']
          }
        });
      };

      const result = await mockChunkLoader(chunkId, moduleFactory);

      expect(result.default).toBeDefined();
      expect(result.lazy.utility()).toBe('lazy-utility');
      expect(result.metadata.chunkId).toBe(chunkId);
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should handle concurrent chunk loading', async () => {
      const createChunkLoader = (id, delay = 10) => async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return createESMModule({
          default: createVueComponent(`Concurrent${id}`)
        });
      };

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(mockChunkLoader(`concurrent-${i}`, createChunkLoader(i)));
      }

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.default.name).toBe(`Concurrent${index}`);
        expect(result.data).toEqual({ id: `concurrent-${index}`, loaded: true });
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle getter-only properties that throw errors', async () => {
      const chunkId = 'property-error-test';
      const moduleFactory = async () => {
        const module = createESMModule({});

        // Create a property that will throw when accessed
        Object.defineProperty(module, 'data', {
          get() {
            throw new TypeError('Cannot set property data of #<Object> which has only a getter');
          },
          enumerable: true,
          configurable: false
        });

        return module;
      };

      // The safeAssign should handle this gracefully and create a new object
      const result = await mockChunkLoader(chunkId, moduleFactory);

      // Should successfully assign the data property despite the getter throwing
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should handle network errors during chunk loading', async () => {
      const chunkId = 'network-error-test';
      const moduleFactory = async () => {
        throw new TypeError('Failed to fetch');
      };

      try {
        await mockChunkLoader(chunkId, moduleFactory);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChunkNetworkError);
        expect(error.chunkId).toBe(chunkId);
      }
    });

    it('should retry failed chunk loads', async () => {
      const chunkId = 'retry-test';
      let attemptCount = 0;

      const moduleFactory = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new TypeError('Failed to fetch');
        }
        return createESMModule({
          default: createReactComponent('RetrySuccess')
        });
      };

      const retryableLoader = withRetry(mockChunkLoader, {
        maxRetries: 3,
        baseDelay: 10 // Short delay for testing
      });

      const result = await retryableLoader(chunkId, moduleFactory);

      expect(attemptCount).toBe(3);
      expect(result.default).toBeDefined();
      expect(result.data).toEqual({ id: chunkId, loaded: true });
    });

    it('should not retry non-retryable errors', async () => {
      const chunkId = 'non-retryable-test';
      let attemptCount = 0;

      const moduleFactory = async () => {
        attemptCount++;
        throw new SyntaxError('Unexpected token');
      };

      const retryableLoader = withRetry(mockChunkLoader, {
        maxRetries: 3,
        baseDelay: 10
      });

      try {
        await retryableLoader(chunkId, moduleFactory);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(attemptCount).toBe(1); // Should not retry syntax errors
        expect(error.name).toBe('ChunkParseError');
      }
    });
  });
});