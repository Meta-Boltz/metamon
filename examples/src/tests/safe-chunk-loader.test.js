/**
 * Tests for the safe chunk loader implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCodeSplitter, ChunkLoadError } from '../shared/code-splitter.js';

// Mock the safe-assign utility
vi.mock('../../../packages/core/src/utils/safe-assign.js', () => {
  return {
    safeAssign: vi.fn((obj, prop, value) => {
      // Simple mock implementation
      try {
        // For frozen objects or getter-only properties, create a new object
        if (Object.isFrozen(obj) || Object.isSealed(obj)) {
          throw new Error('Object is frozen');
        }

        const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        if (descriptor && descriptor.get && !descriptor.set) {
          throw new Error('Property has getter but no setter');
        }

        obj[prop] = value;
        return obj;
      } catch (e) {
        // Create a new object if direct assignment fails
        const newObj = { ...obj };
        newObj[prop] = value;
        return newObj;
      }
    }),
    safeAssignAll: vi.fn((obj, props) => {
      let result = obj;
      for (const [key, value] of Object.entries(props)) {
        result = module.exports.safeAssign(result, key, value);
      }
      return result;
    }),
    createSafeDescriptor: vi.fn((obj, prop) => {
      if (obj == null) return null;

      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
      if (!descriptor || descriptor.set || descriptor.writable) {
        return null;
      }

      return {
        configurable: true,
        enumerable: descriptor.enumerable,
        writable: true,
        value: descriptor.get ? descriptor.get.call(obj) : undefined
      };
    })
  };
});

describe('Safe Chunk Loader', () => {
  let codeSplitter;

  beforeEach(() => {
    // Create a code splitter with safe assignment enabled
    codeSplitter = createCodeSplitter({
      safeAssignment: true,
      errorHandling: 'strict'
    });

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    codeSplitter.destroy();
  });

  describe('Property Descriptor Handling', () => {
    it('should handle modules with getter-only properties', async () => {
      // Create a mock module with a getter-only property
      const mockModule = {};
      Object.defineProperty(mockModule, 'data', {
        get: () => ({ content: 'original' }),
        enumerable: true,
        configurable: false
      });

      // Mock import function that returns our test module
      const importFn = vi.fn().mockResolvedValue(mockModule);

      // Add a transform that will try to modify the getter-only property
      const result = await codeSplitter.loadChunk(importFn, {
        moduleTransforms: {
          data: { content: 'updated' }
        }
      });

      // The module should be loaded successfully
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.content).toBe('updated');
    });

    it('should handle frozen objects', async () => {
      // Create a frozen mock module
      const mockModule = Object.freeze({
        default: () => 'test',
        version: '1.0.0'
      });

      // Mock import function that returns our frozen module
      const importFn = vi.fn().mockResolvedValue(mockModule);

      // Add a transform that will try to modify the frozen object
      const result = await codeSplitter.loadChunk(importFn, {
        moduleTransforms: {
          version: '2.0.0'
        }
      });

      // The module should be loaded successfully with the updated property
      expect(result).toBeDefined();
      expect(result.version).toBe('2.0.0');
    });
  });

  describe('Error Handling', () => {
    it('should categorize property descriptor errors correctly', async () => {
      // Mock an import function that throws a property descriptor error
      const importFn = vi.fn().mockImplementation(() => {
        const obj = {};
        Object.defineProperty(obj, 'data', {
          get: () => ({}),
          configurable: false
        });

        // Force a TypeError
        obj.data = {};
        return Promise.resolve(obj);
      });

      // Set to strict error handling
      codeSplitter.options.errorHandling = 'strict';

      // The chunk load should fail with a categorized error
      await expect(codeSplitter.loadChunk(importFn)).rejects.toThrow(ChunkLoadError);
      try {
        await codeSplitter.loadChunk(importFn);
      } catch (error) {
        expect(error.category).toBe('property-descriptor');
      }
    });

    it('should provide fallback module with tolerant error handling', async () => {
      // Mock an import function that throws a property descriptor error
      const importFn = vi.fn().mockImplementation(() => {
        const error = new TypeError("Cannot set property 'data' of #<Object> which has only a getter");
        error.name = 'TypeError';
        throw error;
      });

      // Set to tolerant error handling
      codeSplitter.options.errorHandling = 'tolerant';

      // Mock the error categorization to ensure it's detected as a property descriptor error
      const originalLoadChunk = codeSplitter.loadChunk;
      codeSplitter.loadChunk = async function (importFn, options = {}) {
        try {
          return await originalLoadChunk.call(this, importFn, options);
        } catch (error) {
          if (error.message && error.message.includes('getter')) {
            // Force the error category for testing
            error.category = 'property-descriptor';
            throw error;
          }
          throw error;
        }
      };

      try {
        // The chunk load should return a fallback module
        const result = await codeSplitter.loadChunk(importFn);
        expect(result).toBeDefined();
        expect(result.default).toBeInstanceOf(Function);
        expect(result.__loadError).toBeDefined();
        expect(result.__diagnostics).toBeDefined();
      } finally {
        // Restore original method
        codeSplitter.loadChunk = originalLoadChunk;
      }
    });

    it('should include diagnostic information in errors', async () => {
      // Mock an import function that throws a network error
      const importFn = vi.fn().mockImplementation(() => {
        throw new Error("Failed to fetch dynamically imported module");
      });

      // Set to strict error handling
      codeSplitter.options.errorHandling = 'strict';

      // The chunk load should fail with diagnostic information
      try {
        await codeSplitter.loadChunk(importFn);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ChunkLoadError);
        expect(error.getDiagnosticReport).toBeDefined();
        const report = error.getDiagnosticReport();
        expect(report.error).toBeDefined();
        expect(report.error.category).toBeDefined();
      }
    });
  });

  describe('Default Transforms', () => {
    it('should apply default transforms to all modules', async () => {
      // Create a mock module
      const mockModule = {
        default: () => 'test'
      };

      // Mock import function that returns our test module
      const importFn = vi.fn().mockResolvedValue(mockModule);

      // Set default transforms
      codeSplitter.options.defaultTransforms = {
        version: '1.0.0',
        timestamp: 'test-time'
      };

      const result = await codeSplitter.loadChunk(importFn);

      // The module should have the default transforms applied
      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toBe('test-time');
    });
  });
});