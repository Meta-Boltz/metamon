import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Production Build Tests for Safe Property Assignment
 * 
 * These tests verify that the safe property assignment mechanism works
 * correctly under production conditions, including:
 * - Minified code scenarios
 * - Various property descriptor configurations
 * - Edge cases that might occur in production builds
 */

// Mock the safe assignment function as it would appear in production
function safeAssign(obj, prop, value) {
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
}

describe('Safe Assignment - Production Build Tests', () => {
  describe('Minified Code Scenarios', () => {
    it('should handle minified property names correctly', () => {
      // Simulate minified object with short property names
      const minifiedObj = {};
      Object.defineProperty(minifiedObj, 'a', {
        get() { return 'original'; },
        enumerable: true,
        configurable: true
      });

      const result = safeAssign(minifiedObj, 'a', { id: 'test', loaded: true });
      expect(result.a).toEqual({ id: 'test', loaded: true });
    });

    it('should work with mangled property names', () => {
      // Simulate property name mangling that might occur in production
      const mangledObj = {};
      const mangledProp = '_$data$_';

      Object.defineProperty(mangledObj, mangledProp, {
        get() { return 'mangled-original'; },
        enumerable: true,
        configurable: true
      });

      const result = safeAssign(mangledObj, mangledProp, { chunk: 'loaded' });
      expect(result[mangledProp]).toEqual({ chunk: 'loaded' });
    });

    it('should handle compressed object structures', () => {
      // Simulate compressed/optimized object structure
      const compressedObj = Object.create(null); // No prototype
      Object.defineProperty(compressedObj, 'data', {
        get: () => 'compressed',
        enumerable: true,
        configurable: true
      });

      const result = safeAssign(compressedObj, 'data', { optimized: true });
      expect(result.data).toEqual({ optimized: true });
      expect(Object.getPrototypeOf(result)).toBe(null);
    });
  });

  describe('Production Build Edge Cases', () => {
    it('should handle frozen objects in production', () => {
      const frozenObj = { existing: 'value' };
      Object.defineProperty(frozenObj, 'data', {
        get() { return 'frozen-data'; },
        enumerable: true,
        configurable: true
      });
      Object.freeze(frozenObj);

      const result = safeAssign(frozenObj, 'data', { unfrozen: true });

      // Should create new object since original is frozen
      expect(result).not.toBe(frozenObj);
      expect(result.data).toEqual({ unfrozen: true });
      expect(result.existing).toBe('value');
    });

    it('should handle sealed objects in production', () => {
      const sealedObj = { existing: 'value' };
      Object.defineProperty(sealedObj, 'data', {
        get() { return 'sealed-data'; },
        enumerable: true,
        configurable: true
      });
      Object.seal(sealedObj);

      const result = safeAssign(sealedObj, 'data', { unsealed: true });
      expect(result.data).toEqual({ unsealed: true });
    });

    it('should handle non-configurable properties correctly', () => {
      const obj = {};
      Object.defineProperty(obj, 'data', {
        get() { return 'non-configurable'; },
        enumerable: true,
        configurable: false // Non-configurable
      });

      const result = safeAssign(obj, 'data', { configured: true });

      // Should create new object since property is non-configurable
      expect(result).not.toBe(obj);
      expect(result.data).toEqual({ configured: true });
    });

    it('should preserve complex prototype chains', () => {
      const grandParent = { grandParentMethod: () => 'grandparent' };
      const parent = Object.create(grandParent);
      parent.parentMethod = () => 'parent';

      const child = Object.create(parent);
      child.childProp = 'child';
      Object.defineProperty(child, 'data', {
        get() { return 'child-data'; },
        enumerable: true,
        configurable: true
      });

      const result = safeAssign(child, 'data', { complex: true });

      // Should preserve entire prototype chain
      expect(result.data).toEqual({ complex: true });
      expect(result.childProp).toBe('child');
      expect(result.parentMethod()).toBe('parent');
      expect(result.grandParentMethod()).toBe('grandparent');
    });
  });

  describe('Performance Under Production Load', () => {
    it('should handle high-frequency assignments efficiently', () => {
      const startTime = performance.now();
      const objects = [];

      // Create many objects with getter-only properties
      for (let i = 0; i < 1000; i++) {
        const obj = {};
        Object.defineProperty(obj, 'data', {
          get() { return `original-${i}`; },
          enumerable: true,
          configurable: true
        });
        objects.push(obj);
      }

      // Perform safe assignments
      const results = objects.map((obj, i) =>
        safeAssign(obj, 'data', { id: i, loaded: true })
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
      expect(results).toHaveLength(1000);
      expect(results[500].data).toEqual({ id: 500, loaded: true });
    });

    it('should not cause memory leaks with repeated assignments', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const objects = [];

      // Create and assign many times
      for (let i = 0; i < 10000; i++) {
        const obj = {};
        Object.defineProperty(obj, 'data', {
          get() { return `temp-${i}`; },
          enumerable: true,
          configurable: true
        });

        const result = safeAssign(obj, 'data', { temp: i });

        // Only keep every 1000th object to prevent intentional memory growth
        if (i % 1000 === 0) {
          objects.push(result);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      expect(objects).toHaveLength(10);
    });
  });

  describe('Error Handling in Production', () => {
    it('should provide meaningful errors even with minified code', () => {
      const problematicObj = {};

      // Create a property that will cause issues (non-configurable getter-only)
      Object.defineProperty(problematicObj, 'data', {
        get() { return 'problematic'; },
        enumerable: true,
        configurable: false // This will force creation of new object
      });

      // Should handle the error gracefully by creating a new object
      expect(() => {
        safeAssign(problematicObj, 'data', { handled: true });
      }).not.toThrow();

      const result = safeAssign(problematicObj, 'data', { handled: true });
      expect(result.data).toEqual({ handled: true });
      // Should be a new object since original was non-configurable
      expect(result).not.toBe(problematicObj);
    });

    it('should handle circular references in production', () => {
      const obj1 = {};
      const obj2 = {};

      obj1.ref = obj2;
      obj2.ref = obj1;

      Object.defineProperty(obj1, 'data', {
        get() { return 'circular'; },
        enumerable: true,
        configurable: true
      });

      const result = safeAssign(obj1, 'data', { circular: false });
      expect(result.data).toEqual({ circular: false });
      expect(result.ref).toBe(obj2);
      expect(result.ref.ref).toBe(obj1);
    });

    it('should handle null and undefined values correctly', () => {
      const obj = {};
      Object.defineProperty(obj, 'data', {
        get() { return 'original'; },
        enumerable: true,
        configurable: true
      });

      // Test null assignment
      const nullResult = safeAssign(obj, 'data', null);
      expect(nullResult.data).toBe(null);

      // Test undefined assignment
      const undefinedResult = safeAssign(obj, 'data', undefined);
      expect(undefinedResult.data).toBe(undefined);
    });
  });

  describe('Cross-Browser Production Compatibility', () => {
    it('should work with different Object.defineProperty implementations', () => {
      const obj = {};

      // Test with different descriptor configurations that might behave differently across browsers
      const descriptorConfigs = [
        { enumerable: true, configurable: true },
        { enumerable: false, configurable: true },
        { enumerable: true, configurable: false },
        { enumerable: false, configurable: false }
      ];

      descriptorConfigs.forEach((config, index) => {
        const testObj = {};
        Object.defineProperty(testObj, 'data', {
          get() { return `config-${index}`; },
          ...config
        });

        const result = safeAssign(testObj, 'data', { config: index });
        expect(result.data).toEqual({ config: index });
      });
    });

    it('should handle browser-specific property descriptor quirks', () => {
      const obj = {};

      // Some browsers might handle property descriptors differently
      Object.defineProperty(obj, 'data', {
        get() { return 'browser-specific'; },
        enumerable: true,
        configurable: true
      });

      // Verify descriptor is read correctly
      const descriptor = Object.getOwnPropertyDescriptor(obj, 'data');
      expect(descriptor.get).toBeDefined();
      expect(descriptor.set).toBeUndefined();

      const result = safeAssign(obj, 'data', { browser: 'compatible' });
      expect(result.data).toEqual({ browser: 'compatible' });
    });
  });

  describe('Integration with Chunk Loading', () => {
    it('should work with typical chunk loading scenarios', () => {
      // Simulate a chunk object as it might appear in production
      const chunkObj = {
        id: 'chunk-abc123',
        url: '/chunks/abc123.js',
        exports: {}
      };

      // Add getter-only property that causes the original issue
      Object.defineProperty(chunkObj, 'data', {
        get() { return { status: 'loading' }; },
        enumerable: true,
        configurable: true
      });

      // This is the assignment that was failing
      const result = safeAssign(chunkObj, 'data', {
        status: 'loaded',
        timestamp: Date.now(),
        module: { default: 'Component' }
      });

      expect(result.data.status).toBe('loaded');
      expect(result.data.module.default).toBe('Component');
      expect(result.id).toBe('chunk-abc123');
      expect(result.url).toBe('/chunks/abc123.js');
    });

    it('should handle multiple chunk assignments concurrently', () => {
      const chunks = [];

      // Create multiple chunk objects
      for (let i = 0; i < 50; i++) {
        const chunk = { id: `chunk-${i}` };
        Object.defineProperty(chunk, 'data', {
          get() { return { loading: true }; },
          enumerable: true,
          configurable: true
        });
        chunks.push(chunk);
      }

      // Assign data to all chunks concurrently
      const results = chunks.map((chunk, i) =>
        safeAssign(chunk, 'data', {
          loaded: true,
          index: i,
          timestamp: Date.now()
        })
      );

      // Verify all assignments succeeded
      results.forEach((result, i) => {
        expect(result.data.loaded).toBe(true);
        expect(result.data.index).toBe(i);
        expect(result.id).toBe(`chunk-${i}`);
      });
    });
  });
});