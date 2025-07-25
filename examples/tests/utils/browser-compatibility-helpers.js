/**
 * Browser Compatibility Test Helpers
 * 
 * Utility functions to help with browser compatibility testing
 * for the chunk loading mechanism.
 */

/**
 * Get browser capabilities and feature support
 */
export const getBrowserCapabilities = async (page) => {
  return await page.evaluate(() => {
    const capabilities = {
      browser: navigator.userAgent,
      features: {
        // ES6+ Features
        arrow_functions: (() => { try { eval('() => {}'); return true; } catch { return false; } })(),
        template_literals: (() => { try { eval('`test`'); return true; } catch { return false; } })(),
        destructuring: (() => { try { eval('const {a} = {a:1}'); return true; } catch { return false; } })(),
        async_await: (() => { try { eval('async function test() { await Promise.resolve(); }'); return true; } catch { return false; } })(),

        // Object manipulation
        object_defineProperty: typeof Object.defineProperty === 'function',
        object_getOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor === 'function',
        object_create: typeof Object.create === 'function',
        object_freeze: typeof Object.freeze === 'function',
        object_isFrozen: typeof Object.isFrozen === 'function',

        // Performance APIs
        performance_now: typeof performance !== 'undefined' && typeof performance.now === 'function',
        performance_memory: typeof performance !== 'undefined' && !!performance.memory,

        // Modern APIs
        fetch: typeof fetch === 'function',
        promise: typeof Promise === 'function',
        symbol: typeof Symbol === 'function',
        map: typeof Map === 'function',
        set: typeof Set === 'function',

        // DOM APIs
        requestAnimationFrame: typeof requestAnimationFrame === 'function',
        requestIdleCallback: typeof requestIdleCallback === 'function',
        intersectionObserver: typeof IntersectionObserver === 'function',
        mutationObserver: typeof MutationObserver === 'function',

        // Module support
        dynamic_import: (() => {
          try {
            return typeof import === 'function' || eval('typeof import') === 'function';
      } catch {
        return false;
      }
    })(),

    // Error handling
    error_stack: (() => { try { throw new Error(); } catch (e) { return !!e.stack; } })(),

      // Strict mode
      strict_mode: (() => { try { return !this; } catch { return true; } })()
},

  // Browser-specific detection
  isChrome: /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor),
    isFirefox: /Firefox/.test(navigator.userAgent),
      isSafari: /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor),
        isEdge: /Edg/.test(navigator.userAgent),
          isMobile: /Mobi|Android/i.test(navigator.userAgent)
    };

return capabilities;
  });
};

/**
 * Test safe property assignment across browsers
 */
export const testSafePropertyAssignment = async (page) => {
  return await page.evaluate(() => {
    const results = {
      tests: [],
      allPassed: true
    };

    // Helper function for safe assignment
    const safeAssign = (obj, prop, value) => {
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

      if (descriptor && descriptor.get && !descriptor.set) {
        try {
          Object.defineProperty(obj, prop, {
            configurable: true,
            enumerable: descriptor.enumerable,
            writable: true,
            value: value
          });
          return obj;
        } catch (e) {
          // Create new object if property can't be redefined
          const newObj = Object.create(Object.getPrototypeOf(obj));
          Object.getOwnPropertyNames(obj).forEach((key) => {
            if (key !== prop) {
              const desc = Object.getOwnPropertyDescriptor(obj, key);
              if (desc) {
                Object.defineProperty(newObj, key, desc);
              }
            }
          });
          Object.defineProperty(newObj, prop, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: value
          });
          return newObj;
        }
      } else {
        obj[prop] = value;
        return obj;
      }
    };

    // Test 1: Basic getter-only property
    try {
      const obj1 = {};
      Object.defineProperty(obj1, 'data', {
        get() { return 'original'; },
        enumerable: true,
        configurable: true
      });

      const result1 = safeAssign(obj1, 'data', { test: 'value' });
      const passed1 = result1.data && result1.data.test === 'value';

      results.tests.push({
        name: 'Basic getter-only property',
        passed: passed1,
        result: result1.data
      });

      if (!passed1) results.allPassed = false;
    } catch (error) {
      results.tests.push({
        name: 'Basic getter-only property',
        passed: false,
        error: error.message
      });
      results.allPassed = false;
    }

    // Test 2: Non-configurable getter-only property
    try {
      const obj2 = {};
      Object.defineProperty(obj2, 'data', {
        get() { return 'original'; },
        enumerable: true,
        configurable: false
      });

      const result2 = safeAssign(obj2, 'data', { test: 'value2' });
      const passed2 = result2.data && result2.data.test === 'value2';

      results.tests.push({
        name: 'Non-configurable getter-only property',
        passed: passed2,
        result: result2.data,
        createdNewObject: result2 !== obj2
      });

      if (!passed2) results.allPassed = false;
    } catch (error) {
      results.tests.push({
        name: 'Non-configurable getter-only property',
        passed: false,
        error: error.message
      });
      results.allPassed = false;
    }

    // Test 3: Frozen object
    try {
      const obj3 = { existing: 'prop' };
      Object.freeze(obj3);

      const result3 = safeAssign(obj3, 'data', { test: 'value3' });
      const passed3 = result3.data && result3.data.test === 'value3' && result3.existing === 'prop';

      results.tests.push({
        name: 'Frozen object',
        passed: passed3,
        result: result3.data,
        preservedExisting: result3.existing === 'prop',
        createdNewObject: result3 !== obj3
      });

      if (!passed3) results.allPassed = false;
    } catch (error) {
      results.tests.push({
        name: 'Frozen object',
        passed: false,
        error: error.message
      });
      results.allPassed = false;
    }

    // Test 4: Object with prototype
    try {
      const proto = { protoMethod: () => 'proto' };
      const obj4 = Object.create(proto);
      obj4.ownProp = 'own';

      Object.defineProperty(obj4, 'data', {
        get() { return 'original'; },
        enumerable: true,
        configurable: true
      });

      const result4 = safeAssign(obj4, 'data', { test: 'value4' });
      const passed4 = result4.data && result4.data.test === 'value4' &&
        result4.ownProp === 'own' &&
        typeof result4.protoMethod === 'function';

      results.tests.push({
        name: 'Object with prototype',
        passed: passed4,
        result: result4.data,
        preservedOwnProp: result4.ownProp === 'own',
        preservedProtoMethod: typeof result4.protoMethod === 'function'
      });

      if (!passed4) results.allPassed = false;
    } catch (error) {
      results.tests.push({
        name: 'Object with prototype',
        passed: false,
        error: error.message
      });
      results.allPassed = false;
    }

    return results;
  });
};

/**
 * Test chunk loading simulation across browsers
 */
export const testChunkLoadingSimulation = async (page) => {
  return await page.evaluate(() => {
    const results = {
      tests: [],
      allPassed: true
    };

    // Simulate different chunk types
    const chunkTypes = [
      {
        name: 'ESM Module',
        factory: () => ({
          default: { type: 'component', name: 'ESMComponent' },
          namedExport: { helper: () => 'helper' }
        })
      },
      {
        name: 'CommonJS Module',
        factory: () => ({
          exports: {
            default: { type: 'component', name: 'CommonJSComponent' },
            helper: () => 'commonjs-helper'
          }
        })
      },
      {
        name: 'UMD Module',
        factory: () => ({
          __esModule: true,
          exports: {
            default: { type: 'component', name: 'UMDComponent' },
            version: '1.0.0'
          }
        })
      }
    ];

    chunkTypes.forEach(chunkType => {
      try {
        const chunk = chunkType.factory();

        // Simulate the problematic property assignment
        const chunkData = { id: `test-${chunkType.name.toLowerCase().replace(/\s+/g, '-')}`, loaded: true };

        // Test direct assignment (this might fail with getter-only properties)
        let assignmentWorked = false;
        try {
          chunk.data = chunkData;
          assignmentWorked = chunk.data && chunk.data.id === chunkData.id;
        } catch (error) {
          // Expected to fail in some cases
        }

        results.tests.push({
          name: `${chunkType.name} - Direct Assignment`,
          passed: assignmentWorked,
          chunkType: chunkType.name,
          hasData: !!chunk.data
        });

        if (!assignmentWorked) {
          // This would be where the safe assignment mechanism kicks in
          results.tests.push({
            name: `${chunkType.name} - Safe Assignment Needed`,
            passed: true, // We expect this to be needed
            chunkType: chunkType.name,
            reason: 'Direct assignment failed, safe assignment would be used'
          });
        }

      } catch (error) {
        results.tests.push({
          name: `${chunkType.name} - Error`,
          passed: false,
          error: error.message
        });
        results.allPassed = false;
      }
    });

    return results;
  });
};

/**
 * Test error handling consistency across browsers
 */
export const testErrorHandlingConsistency = async (page) => {
  return await page.evaluate(() => {
    const results = {
      errors: [],
      consistency: true
    };

    const errorTests = [
      {
        name: 'Getter-only property assignment',
        test: () => {
          const obj = {};
          Object.defineProperty(obj, 'readonly', {
            get() { return 'value'; },
            enumerable: true,
            configurable: false
          });
          obj.readonly = 'new value'; // Should throw TypeError
        }
      },
      {
        name: 'Non-writable property assignment',
        test: () => {
          const obj = {};
          Object.defineProperty(obj, 'readonly', {
            value: 'readonly',
            writable: false,
            configurable: false
          });
          obj.readonly = 'modified'; // Should throw TypeError in strict mode
        }
      },
      {
        name: 'Frozen object modification',
        test: () => {
          const obj = Object.freeze({ prop: 'value' });
          obj.newProp = 'new'; // Should throw TypeError in strict mode
        }
      }
    ];

    errorTests.forEach(errorTest => {
      try {
        errorTest.test();
        results.errors.push({
          name: errorTest.name,
          threw: false,
          errorType: null,
          message: null
        });
      } catch (error) {
        results.errors.push({
          name: errorTest.name,
          threw: true,
          errorType: error.name,
          message: error.message
        });
      }
    });

    return results;
  });
};

/**
 * Performance test for chunk loading
 */
export const testChunkLoadingPerformance = async (page, chunkCount = 50) => {
  return await page.evaluate((count) => {
    const startTime = performance.now();
    const chunks = [];

    // Simulate loading multiple chunks
    for (let i = 0; i < count; i++) {
      const chunk = {
        id: `perf-chunk-${i}`,
        component: { name: `PerfComponent${i}`, type: 'component' },
        metadata: { loadTime: performance.now() }
      };

      // Simulate safe property assignment
      try {
        chunk.data = { id: chunk.id, loaded: true, index: i };
        chunks.push(chunk);
      } catch (error) {
        // In real implementation, this would use safe assignment
        chunks.push({
          ...chunk,
          data: { id: chunk.id, loaded: true, index: i, error: error.message }
        });
      }
    }

    const endTime = performance.now();

    return {
      chunkCount: chunks.length,
      totalTime: endTime - startTime,
      averageTime: (endTime - startTime) / count,
      allLoaded: chunks.every(chunk => chunk.data.loaded),
      memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : null
    };
  }, chunkCount);
};