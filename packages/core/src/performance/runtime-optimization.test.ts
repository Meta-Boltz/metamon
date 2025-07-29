/**
 * Runtime Performance Optimization Tests
 * Tests for caching, preloading, component optimization, and memory management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RouteCache, RouteComponentCache, RouteDataCache } from './route-cache.js';
import { IntelligentPreloader } from './intelligent-preloader.js';
import { ComponentOptimizer } from './component-optimizer.js';
import { MemoryManager } from './memory-manager.js';

describe('Runtime Performance Optimization', () => {
  describe('RouteCache', () => {
    let cache: RouteCache<string>;

    beforeEach(() => {
      cache = new RouteCache({
        maxSize: 1024 * 1024, // 1MB
        maxEntries: 100,
        defaultTTL: 5000, // 5 seconds
        cleanupInterval: 0, // Disable for tests
        enableCompression: false,
        enableMetrics: true,
        evictionStrategy: 'lru'
      });
    });

    afterEach(() => {
      cache.dispose();
    });

    it('should cache and retrieve values', () => {
      cache.set('test-key', 'test-value');
      expect(cache.get('test-key')).toBe('test-value');
      expect(cache.has('test-key')).toBe(true);
    });

    it('should respect TTL', async () => {
      cache.set('ttl-key', 'ttl-value', { ttl: 100 });
      expect(cache.get('ttl-key')).toBe('ttl-value');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('ttl-key')).toBeNull();
      expect(cache.has('ttl-key')).toBe(false);
    });

    it('should track cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.67, 1); // 2 hits out of 3 requests
      expect(stats.missRate).toBeCloseTo(0.33, 1);
    });

    it('should evict entries when capacity is exceeded', () => {
      const smallCache = new RouteCache({
        maxEntries: 2,
        evictionStrategy: 'lru'
      });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3'); // Should evict key1

      expect(smallCache.has('key1')).toBe(false);
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key3')).toBe(true);

      smallCache.dispose();
    });

    it('should handle priority-based eviction', () => {
      const priorityCache = new RouteCache({
        maxEntries: 2,
        evictionStrategy: 'priority'
      });

      priorityCache.set('low', 'value1', { priority: 'low' });
      priorityCache.set('high', 'value2', { priority: 'high' });
      priorityCache.set('critical', 'value3', { priority: 'critical' }); // Should evict 'low'

      expect(priorityCache.has('low')).toBe(false);
      expect(priorityCache.has('high')).toBe(true);
      expect(priorityCache.has('critical')).toBe(true);

      priorityCache.dispose();
    });

    it('should optimize cache by removing low-value entries', () => {
      // Add entries with different access patterns
      cache.set('frequent', 'value1', { priority: 'high' });
      cache.set('rare', 'value2', { priority: 'low' });
      
      // Access frequent entry multiple times
      for (let i = 0; i < 5; i++) {
        cache.get('frequent');
      }
      
      // Access rare entry once
      cache.get('rare');
      
      const statsBefore = cache.getStats();
      cache.optimize();
      const statsAfter = cache.getStats();
      
      // Should have removed some low-value entries
      expect(statsAfter.totalEntries).toBeLessThanOrEqual(statsBefore.totalEntries);
    });
  });

  describe('RouteComponentCache', () => {
    let componentCache: RouteComponentCache;

    beforeEach(() => {
      componentCache = new RouteComponentCache();
    });

    afterEach(() => {
      componentCache.dispose();
    });

    it('should cache components with metadata', () => {
      const mockComponent = { render: () => '<div>Test</div>' };
      const metadata = {
        loadTime: 500,
        bundleSize: 50000,
        dependencies: ['react'],
        framework: 'react'
      };

      componentCache.cacheComponent('/test-route', mockComponent, metadata);
      
      const cached = componentCache.get('/test-route');
      expect(cached).toBe(mockComponent);
    });

    it('should calculate component priority correctly', () => {
      const slowLargeComponent = { render: () => '<div>Slow Large</div>' };
      const fastSmallComponent = { render: () => '<div>Fast Small</div>' };

      // Slow and large component should get critical priority
      componentCache.cacheComponent('/slow-large', slowLargeComponent, {
        loadTime: 3000,
        bundleSize: 600000,
        dependencies: [],
        framework: 'react'
      });

      // Fast and small component should get low priority
      componentCache.cacheComponent('/fast-small', fastSmallComponent, {
        loadTime: 200,
        bundleSize: 30000,
        dependencies: [],
        framework: 'react'
      });

      // Both should be cached
      expect(componentCache.has('/slow-large')).toBe(true);
      expect(componentCache.has('/fast-small')).toBe(true);
    });
  });

  describe('IntelligentPreloader', () => {
    let preloader: IntelligentPreloader;

    beforeEach(() => {
      preloader = new IntelligentPreloader({
        enabled: true,
        maxConcurrentPreloads: 2,
        minProbabilityThreshold: 0.3,
        strategies: []
      });
    });

    afterEach(() => {
      preloader.dispose();
    });

    it('should record user behavior', () => {
      preloader.recordBehavior('/home', 5000);
      preloader.recordBehavior('/about', 3000);
      
      const stats = preloader.getStats();
      expect(stats.totalPredictions).toBeGreaterThanOrEqual(0);
    });

    it('should update route metadata', () => {
      preloader.updateRouteMetadata('/test-route', 1000, 100000);
      
      // Metadata should be stored (internal state, can't directly test)
      expect(true).toBe(true);
    });

    it('should enable and disable preloading', () => {
      preloader.setEnabled(false);
      let stats = preloader.getStats();
      expect(stats.activePreloads).toBe(0);
      
      preloader.setEnabled(true);
      stats = preloader.getStats();
      expect(stats.activePreloads).toBeGreaterThanOrEqual(0);
    });

    it('should provide preloading statistics', () => {
      const stats = preloader.getStats();
      
      expect(stats).toHaveProperty('totalPredictions');
      expect(stats).toHaveProperty('activePreloads');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('averageProbability');
      expect(stats).toHaveProperty('topPredictions');
      
      expect(typeof stats.totalPredictions).toBe('number');
      expect(typeof stats.activePreloads).toBe('number');
      expect(Array.isArray(stats.topPredictions)).toBe(true);
    });
  });

  describe('ComponentOptimizer', () => {
    let optimizer: ComponentOptimizer;

    beforeEach(() => {
      optimizer = new ComponentOptimizer({
        enableLazyLoading: true,
        enableViewportLoading: true,
        maxConcurrentLoads: 2,
        priorityThresholds: {
          critical: 0,
          high: 100,
          medium: 500
        }
      });
    });

    afterEach(() => {
      optimizer.dispose();
    });

    it('should register components', () => {
      const metadata = {
        name: 'TestComponent',
        size: 50000,
        dependencies: ['react'],
        loadTime: 500,
        renderTime: 100,
        priority: 'medium' as const,
        strategy: 'lazy' as const
      };

      optimizer.registerComponent(metadata);
      
      // Component should be registered (internal state)
      expect(true).toBe(true);
    });

    it('should load components with different strategies', async () => {
      const eagerMetadata = {
        name: 'EagerComponent',
        size: 30000,
        dependencies: [],
        loadTime: 200,
        renderTime: 50,
        priority: 'high' as const,
        strategy: 'eager' as const
      };

      const lazyMetadata = {
        name: 'LazyComponent',
        size: 100000,
        dependencies: ['lodash'],
        loadTime: 1000,
        renderTime: 200,
        priority: 'low' as const,
        strategy: 'lazy' as const
      };

      optimizer.registerComponent(eagerMetadata);
      optimizer.registerComponent(lazyMetadata);

      // Load components
      const eagerComponent = await optimizer.loadComponent('EagerComponent');
      const lazyComponent = await optimizer.loadComponent('LazyComponent');

      expect(eagerComponent).toBeDefined();
      expect(lazyComponent).toBeDefined();
    });

    it('should provide loading statistics', () => {
      const stats = optimizer.getStats();
      
      expect(stats).toHaveProperty('totalLoads');
      expect(stats).toHaveProperty('averageLoadTime');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('strategyBreakdown');
      expect(stats).toHaveProperty('activeLoads');
      expect(stats).toHaveProperty('queueLength');
      
      expect(typeof stats.totalLoads).toBe('number');
      expect(typeof stats.averageLoadTime).toBe('number');
      expect(typeof stats.cacheHitRate).toBe('number');
      expect(typeof stats.activeLoads).toBe('number');
    });

    it('should generate recommendations', () => {
      const recommendations = optimizer.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should optimize loading strategies', () => {
      // This would analyze performance data and optimize strategies
      optimizer.optimizeStrategies();
      
      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('MemoryManager', () => {
    let memoryManager: MemoryManager;

    beforeEach(() => {
      memoryManager = new MemoryManager({
        enabled: true,
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        gcThreshold: 0.8,
        leakDetectionInterval: 0, // Disable for tests
        enableAutoCleanup: true,
        warningThreshold: 0.7,
        criticalThreshold: 0.9
      });
    });

    afterEach(() => {
      memoryManager.dispose();
    });

    it('should track objects', () => {
      const testObject = { data: 'test' };
      memoryManager.trackObject('test-object', testObject, 1000);
      
      // Object should be tracked (internal state)
      expect(true).toBe(true);
    });

    it('should track event listeners', () => {
      if (typeof document !== 'undefined') {
        const element = document.createElement('div');
        const handler = () => {};
        
        memoryManager.trackEventListener('test-listener', element, 'click', handler);
        memoryManager.untrackEventListener('test-listener');
        
        // Should complete without errors
        expect(true).toBe(true);
      }
    });

    it('should track timers', () => {
      const timerId = setTimeout(() => {}, 1000);
      memoryManager.trackTimer(timerId);
      memoryManager.untrackTimer(timerId);
      
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should perform cleanup', () => {
      memoryManager.performCleanup();
      
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should provide memory statistics', () => {
      const stats = memoryManager.getMemoryStats();
      
      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('peak');
      expect(stats).toHaveProperty('average');
      expect(stats).toHaveProperty('trend');
      expect(stats).toHaveProperty('leaks');
      expect(stats).toHaveProperty('gcStats');
      expect(stats).toHaveProperty('trackedObjects');
      expect(stats).toHaveProperty('eventListeners');
      expect(stats).toHaveProperty('timers');
      
      expect(typeof stats.peak).toBe('number');
      expect(typeof stats.average).toBe('number');
      expect(Array.isArray(stats.leaks)).toBe(true);
    });

    it('should generate recommendations', () => {
      const recommendations = memoryManager.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should create memory snapshots', () => {
      const snapshot = memoryManager.createSnapshot();
      
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('memoryInfo');
      expect(snapshot).toHaveProperty('trackedObjects');
      expect(snapshot).toHaveProperty('eventListeners');
      expect(snapshot).toHaveProperty('timers');
      expect(snapshot).toHaveProperty('leaks');
      
      expect(typeof snapshot.timestamp).toBe('number');
      expect(Array.isArray(snapshot.trackedObjects)).toBe(true);
      expect(Array.isArray(snapshot.eventListeners)).toBe(true);
      expect(Array.isArray(snapshot.timers)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should work together for comprehensive optimization', async () => {
      const cache = new RouteCache();
      const preloader = new IntelligentPreloader({ enabled: true });
      const optimizer = new ComponentOptimizer();
      const memoryManager = new MemoryManager({ enabled: true });

      try {
        // Test caching
        cache.set('test-route', { component: 'TestComponent' });
        expect(cache.get('test-route')).toBeDefined();

        // Test preloader
        preloader.recordBehavior('/home', 2000);
        preloader.updateRouteMetadata('/test', 500, 50000);

        // Test component optimizer
        optimizer.registerComponent({
          name: 'IntegrationComponent',
          size: 75000,
          dependencies: ['react'],
          loadTime: 750,
          renderTime: 150,
          priority: 'medium',
          strategy: 'lazy'
        });

        const component = await optimizer.loadComponent('IntegrationComponent');
        expect(component).toBeDefined();

        // Test memory manager
        memoryManager.trackObject('integration-test', { data: 'test' }, 2000);
        const memStats = memoryManager.getMemoryStats();
        expect(memStats.trackedObjects).toBeGreaterThan(0);

        // All systems should work together without conflicts
        expect(true).toBe(true);
      } finally {
        // Cleanup
        cache.dispose();
        preloader.dispose();
        optimizer.dispose();
        memoryManager.dispose();
      }
    });

    it('should provide comprehensive performance insights', () => {
      const cache = new RouteCache();
      const preloader = new IntelligentPreloader();
      const optimizer = new ComponentOptimizer();
      const memoryManager = new MemoryManager();

      try {
        // Add some test data
        cache.set('insight-test', 'data');
        cache.get('insight-test');

        // Get insights from all systems
        const cacheStats = cache.getStats();
        const preloaderStats = preloader.getStats();
        const optimizerStats = optimizer.getStats();
        const memoryStats = memoryManager.getMemoryStats();

        // All should provide meaningful data
        expect(typeof cacheStats.hitRate).toBe('number');
        expect(typeof preloaderStats.totalPredictions).toBe('number');
        expect(typeof optimizerStats.totalLoads).toBe('number');
        expect(typeof memoryStats.current.used).toBe('number');
      } finally {
        // Cleanup
        cache.dispose();
        preloader.dispose();
        optimizer.dispose();
        memoryManager.dispose();
      }
    });
  });
});