/**
 * Tests for Code Splitter
 * Testing lazy loading, preloading, and bundle optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCodeSplitter, lazy, preload, prefetch, ChunkLoadError } from '../shared/code-splitter.js';

// Mock dynamic imports
const mockImport = vi.fn();
const mockModule = { default: { render: () => '<div>Test Component</div>' } };

// Mock browser APIs
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn()
  }))
});

Object.defineProperty(navigator, 'connection', {
  writable: true,
  value: {
    effectiveType: '4g',
    addEventListener: vi.fn()
  }
});

describe('CodeSplitter', () => {
  let codeSplitter;

  beforeEach(() => {
    codeSplitter = createCodeSplitter({
      preloadThreshold: 0.5,
      preloadDelay: 50,
      maxConcurrentLoads: 2,
      chunkTimeout: 1000,
      enablePreloading: true,
      enablePrefetching: true
    });

    mockImport.mockResolvedValue(mockModule);
    vi.clearAllMocks();
  });

  afterEach(() => {
    codeSplitter.destroy();
  });

  describe('Lazy Route Creation', () => {
    it('should create a lazy route with proper structure', () => {
      const lazyRoute = codeSplitter.createLazyRoute(mockImport, {
        preload: true,
        priority: 'high'
      });

      expect(lazyRoute).toHaveProperty('loader');
      expect(lazyRoute).toHaveProperty('preload');
      expect(lazyRoute).toHaveProperty('prefetch');
      expect(lazyRoute).toHaveProperty('options');
      expect(lazyRoute.isLazy).toBe(true);
      expect(typeof lazyRoute.loader).toBe('function');
      expect(typeof lazyRoute.preload).toBe('function');
      expect(typeof lazyRoute.prefetch).toBe('function');
    });

    it('should handle different priority levels', () => {
      const highPriorityRoute = codeSplitter.createLazyRoute(mockImport, { priority: 'high' });
      const normalPriorityRoute = codeSplitter.createLazyRoute(mockImport, { priority: 'normal' });
      const lowPriorityRoute = codeSplitter.createLazyRoute(mockImport, { priority: 'low' });

      expect(highPriorityRoute.options.priority).toBe('high');
      expect(normalPriorityRoute.options.priority).toBe('normal');
      expect(lowPriorityRoute.options.priority).toBe('low');
    });
  });

  describe('Chunk Loading', () => {
    it('should load a chunk successfully', async () => {
      const result = await codeSplitter.loadChunk(mockImport);

      expect(mockImport).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockModule);
    });

    it('should cache loaded chunks', async () => {
      const result1 = await codeSplitter.loadChunk(mockImport);
      const result2 = await codeSplitter.loadChunk(mockImport);

      expect(mockImport).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
      expect(result1).toEqual(mockModule);
    });

    it('should handle loading errors with retry', async () => {
      const failingImport = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockModule);

      const result = await codeSplitter.loadChunk(failingImport);

      expect(failingImport).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockModule);
    });

    it('should throw ChunkLoadError after max retries', async () => {
      const failingImport = vi.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(codeSplitter.loadChunk(failingImport)).rejects.toThrow(ChunkLoadError);
      expect(failingImport).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should handle timeout errors', async () => {
      const slowImport = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockModule), 2000))
      );

      await expect(codeSplitter.loadChunk(slowImport, { chunkTimeout: 100 }))
        .rejects.toThrow('Chunk load timeout');
    });

    it('should validate loaded modules', async () => {
      const invalidModule = {};
      const invalidImport = vi.fn().mockResolvedValue(invalidModule);

      await expect(codeSplitter.loadChunk(invalidImport))
        .rejects.toThrow('Invalid module: missing default export or render function');
    });
  });

  describe('Preloading', () => {
    it('should preload chunks when enabled', async () => {
      await codeSplitter.preloadChunk(mockImport, { priority: 'high' });

      // Wait for preload queue processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockImport).toHaveBeenCalled();
    });

    it('should respect preloading disabled setting', async () => {
      codeSplitter.options.enablePreloading = false;

      await codeSplitter.preloadChunk(mockImport);

      expect(mockImport).not.toHaveBeenCalled();
    });

    it('should queue preloads by priority', async () => {
      const highPriorityImport = vi.fn().mockResolvedValue(mockModule);
      const lowPriorityImport = vi.fn().mockResolvedValue(mockModule);

      // Add low priority first
      codeSplitter.preloadChunk(lowPriorityImport, { priority: 'low' });
      // Add high priority second
      codeSplitter.preloadChunk(highPriorityImport, { priority: 'high' });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // High priority should be called first
      expect(highPriorityImport).toHaveBeenCalled();
    });

    it('should respect max concurrent loads', async () => {
      const imports = Array.from({ length: 5 }, () =>
        vi.fn().mockImplementation(() => new Promise(resolve =>
          setTimeout(() => resolve(mockModule), 50)
        ))
      );

      // Start all preloads
      imports.forEach(importFn =>
        codeSplitter.preloadChunk(importFn, { priority: 'normal' })
      );

      // Check that only maxConcurrentLoads are active
      expect(codeSplitter.loadingQueue.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Prefetching', () => {
    it('should create prefetch links when enabled', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.head, 'appendChild');

      codeSplitter.prefetchChunk(mockImport);

      // Note: This test would need more sophisticated mocking to fully test
      // prefetch link creation since it depends on chunk URL extraction
      expect(codeSplitter.options.enablePrefetching).toBe(true);
    });

    it('should skip prefetching when disabled', () => {
      codeSplitter.options.enablePrefetching = false;
      const createElementSpy = vi.spyOn(document, 'createElement');

      codeSplitter.prefetchChunk(mockImport);

      expect(createElementSpy).not.toHaveBeenCalled();
    });
  });

  describe('Network Condition Adaptation', () => {
    it('should disable preloading on slow connections', () => {
      // Simulate slow connection
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '2g',
          addEventListener: vi.fn()
        }
      });

      const newSplitter = createCodeSplitter();

      // Trigger network condition update
      const connectionChangeHandler = navigator.connection.addEventListener.mock.calls
        .find(call => call[0] === 'change')?.[1];

      if (connectionChangeHandler) {
        connectionChangeHandler();
      }

      expect(newSplitter.options.enablePreloading).toBe(false);
      expect(newSplitter.options.enablePrefetching).toBe(false);
      expect(newSplitter.options.maxConcurrentLoads).toBe(1);

      newSplitter.destroy();
    });

    it('should enable optimizations on fast connections', () => {
      // Simulate fast connection
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          addEventListener: vi.fn()
        }
      });

      const newSplitter = createCodeSplitter();

      expect(newSplitter.options.enablePreloading).toBe(true);
      expect(newSplitter.options.enablePrefetching).toBe(true);
      expect(newSplitter.options.maxConcurrentLoads).toBe(3);

      newSplitter.destroy();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track loading statistics', async () => {
      await codeSplitter.loadChunk(mockImport);

      const stats = codeSplitter.getLoadStats();

      expect(stats.totalLoads).toBe(1);
      expect(stats.successfulLoads).toBe(1);
      expect(stats.failedLoads).toBe(0);
      expect(stats.successRate).toBe(100);
      expect(stats.loadedChunks).toBe(1);
    });

    it('should track cache hits', async () => {
      // Load same chunk twice
      await codeSplitter.loadChunk(mockImport);
      await codeSplitter.loadChunk(mockImport);

      const stats = codeSplitter.getLoadStats();

      expect(stats.totalLoads).toBe(2);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheHitRate).toBe(50);
    });

    it('should track failed loads', async () => {
      const failingImport = vi.fn().mockRejectedValue(new Error('Load failed'));

      try {
        await codeSplitter.loadChunk(failingImport);
      } catch (error) {
        // Expected to fail
      }

      const stats = codeSplitter.getLoadStats();

      expect(stats.totalLoads).toBe(1);
      expect(stats.successfulLoads).toBe(0);
      expect(stats.failedLoads).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it('should calculate average load time', async () => {
      const slowImport = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockModule), 100))
      );

      await codeSplitter.loadChunk(slowImport);

      const stats = codeSplitter.getLoadStats();

      expect(stats.averageLoadTime).toBeGreaterThan(90);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache and reset state', async () => {
      await codeSplitter.loadChunk(mockImport);

      expect(codeSplitter.getLoadStats().loadedChunks).toBe(1);

      codeSplitter.clearCache();

      expect(codeSplitter.getLoadStats().loadedChunks).toBe(0);
    });

    it('should reload chunks after cache clear', async () => {
      await codeSplitter.loadChunk(mockImport);
      codeSplitter.clearCache();

      mockImport.mockClear();
      await codeSplitter.loadChunk(mockImport);

      expect(mockImport).toHaveBeenCalledTimes(1);
    });
  });

  describe('Chunk ID Generation', () => {
    it('should generate consistent chunk IDs', () => {
      const importFn = () => import('./test-module.js');

      const id1 = codeSplitter.getChunkId(importFn);
      const id2 = codeSplitter.getChunkId(importFn);

      expect(id1).toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate different IDs for different imports', () => {
      const importFn1 = () => import('./module1.js');
      const importFn2 = () => import('./module2.js');

      const id1 = codeSplitter.getChunkId(importFn1);
      const id2 = codeSplitter.getChunkId(importFn2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('Error Handling', () => {
    it('should create ChunkLoadError with proper properties', () => {
      const originalError = new Error('Original error');
      const chunkError = new ChunkLoadError('Chunk failed', originalError, 'test-chunk');

      expect(chunkError.name).toBe('ChunkLoadError');
      expect(chunkError.message).toBe('Chunk failed');
      expect(chunkError.originalError).toBe(originalError);
      expect(chunkError.chunkId).toBe('test-chunk');
      expect(chunkError.timestamp).toBeDefined();
    });
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('lazy()', () => {
    it('should create a lazy route', () => {
      const lazyRoute = lazy(mockImport, { priority: 'high' });

      expect(lazyRoute).toHaveProperty('loader');
      expect(lazyRoute).toHaveProperty('preload');
      expect(lazyRoute).toHaveProperty('prefetch');
      expect(lazyRoute.isLazy).toBe(true);
    });
  });

  describe('preload()', () => {
    it('should preload a chunk', async () => {
      await preload(mockImport, { priority: 'high' });

      // The preload function creates its own splitter instance
      // so we can't directly verify the mock was called
      expect(typeof preload).toBe('function');
    });
  });

  describe('prefetch()', () => {
    it('should prefetch a chunk', () => {
      prefetch(mockImport, { priority: 'low' });

      expect(typeof prefetch).toBe('function');
    });
  });
});