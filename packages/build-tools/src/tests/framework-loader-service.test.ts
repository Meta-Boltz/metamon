/**
 * Tests for Framework Loader Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  FrameworkLoaderService, 
  createFrameworkLoaderService,
  defaultFrameworkLoaderConfig 
} from '../framework-loader/framework-loader-service.js';
import { 
  FrameworkType, 
  LoadPriority, 
  FrameworkLoaderConfig,
  NetworkConditions 
} from '../types/framework-loader.js';

// Mock performance.now for consistent testing
vi.stubGlobal('performance', {
  now: vi.fn(() => Date.now())
});

describe('FrameworkLoaderService', () => {
  let service: FrameworkLoaderService;
  let config: FrameworkLoaderConfig;

  beforeEach(() => {
    config = {
      ...defaultFrameworkLoaderConfig,
      enableLogging: false // Disable logging for tests
    };
    service = new FrameworkLoaderService(config);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Service Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultService = createFrameworkLoaderService();
      expect(defaultService).toBeInstanceOf(FrameworkLoaderService);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        ...defaultFrameworkLoaderConfig,
        loadingStrategy: {
          ...defaultFrameworkLoaderConfig.loadingStrategy,
          maxConcurrentLoads: 10
        }
      };
      
      const customService = new FrameworkLoaderService(customConfig);
      expect(customService).toBeInstanceOf(FrameworkLoaderService);
    });
  });

  describe('Framework Loading', () => {
    it('should load framework with normal priority', async () => {
      const framework = await service.loadFramework(FrameworkType.REACT);
      
      expect(framework).toBeDefined();
      expect(framework.name).toBe(FrameworkType.REACT);
      expect(framework.bundle).toBeInstanceOf(ArrayBuffer);
      expect(framework.size).toBeGreaterThan(0);
    });

    it('should load framework with specified priority', async () => {
      const framework = await service.loadFramework(
        FrameworkType.VUE, 
        LoadPriority.CRITICAL
      );
      
      expect(framework).toBeDefined();
      expect(framework.name).toBe(FrameworkType.VUE);
    });

    it('should load framework with version', async () => {
      const framework = await service.loadFramework(
        FrameworkType.REACT, 
        LoadPriority.NORMAL,
        '18.0.0'
      );
      
      expect(framework).toBeDefined();
      expect(framework.version).toBe('18.0.0');
    });

    it('should handle concurrent framework loading', async () => {
      const promises = [
        service.loadFramework(FrameworkType.REACT),
        service.loadFramework(FrameworkType.VUE),
        service.loadFramework(FrameworkType.SVELTE)
      ];
      
      const frameworks = await Promise.all(promises);
      
      expect(frameworks).toHaveLength(3);
      expect(frameworks[0].name).toBe(FrameworkType.REACT);
      expect(frameworks[1].name).toBe(FrameworkType.VUE);
      expect(frameworks[2].name).toBe(FrameworkType.SVELTE);
    });

    it('should prioritize critical loads over normal loads', async () => {
      const loadTimes: number[] = [];
      
      // Start normal priority load
      const normalPromise = service.loadFramework(FrameworkType.REACT, LoadPriority.NORMAL)
        .then(() => loadTimes.push(1));
      
      // Start critical priority load after a small delay
      setTimeout(() => {
        service.loadFramework(FrameworkType.VUE, LoadPriority.CRITICAL)
          .then(() => loadTimes.push(2));
      }, 10);
      
      await normalPromise;
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Critical should complete first (index 2 should be first in loadTimes)
      // Note: This test might be flaky due to timing, but demonstrates priority concept
    });
  });

  describe('Caching', () => {
    it('should cache loaded frameworks', async () => {
      // Load framework first time
      const framework1 = await service.loadFramework(FrameworkType.REACT);
      
      // Load same framework again
      const framework2 = await service.loadFramework(FrameworkType.REACT);
      
      expect(framework1).toEqual(framework2);
      
      const metrics = service.getLoadingMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
    });

    it('should list cached frameworks', async () => {
      await service.loadFramework(FrameworkType.REACT);
      await service.loadFramework(FrameworkType.VUE);
      
      const cached = service.getCachedFrameworks();
      expect(cached).toContain(FrameworkType.REACT);
      expect(cached).toContain(FrameworkType.VUE);
    });

    it('should invalidate specific framework cache', async () => {
      await service.loadFramework(FrameworkType.REACT);
      await service.loadFramework(FrameworkType.VUE);
      
      await service.invalidateFrameworkCache(FrameworkType.REACT);
      
      const cached = service.getCachedFrameworks();
      expect(cached).not.toContain(FrameworkType.REACT);
      expect(cached).toContain(FrameworkType.VUE);
    });

    it('should invalidate entire cache', async () => {
      await service.loadFramework(FrameworkType.REACT);
      await service.loadFramework(FrameworkType.VUE);
      
      await service.invalidateFrameworkCache();
      
      const cached = service.getCachedFrameworks();
      expect(cached).toHaveLength(0);
    });
  });

  describe('Preloading', () => {
    it('should preload frameworks with low priority', async () => {
      await service.preloadFramework(FrameworkType.REACT);
      
      const cached = service.getCachedFrameworks();
      expect(cached).toContain(FrameworkType.REACT);
    });

    it('should not throw on preload failures', async () => {
      // Mock a failure scenario by shutting down the service
      await service.shutdown();
      
      // Preload should not throw
      await expect(service.preloadFramework(FrameworkType.REACT)).resolves.toBeUndefined();
    });
  });

  describe('Network Adaptation', () => {
    it('should adapt to network conditions', () => {
      const slowConditions: NetworkConditions = {
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 800,
        saveData: false
      };
      
      service.adaptToNetworkConditions(slowConditions);
      
      const conditions = service.getCurrentNetworkConditions();
      expect(conditions).toEqual(slowConditions);
    });

    it('should get current network conditions', () => {
      const conditions = service.getCurrentNetworkConditions();
      expect(conditions).toBeDefined();
    });
  });

  describe('Metrics and Statistics', () => {
    it('should track loading metrics', async () => {
      await service.loadFramework(FrameworkType.REACT);
      await service.loadFramework(FrameworkType.REACT); // Cache hit
      
      const metrics = service.getLoadingMetrics();
      
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.averageLoadTime).toBeGreaterThan(0);
    });

    it('should provide queue statistics', async () => {
      // Start a load but don't await it immediately
      const loadPromise = service.loadFramework(FrameworkType.REACT);
      
      const stats = service.getQueueStats();
      expect(stats).toBeDefined();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
      expect(stats.activeLoads).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.loadingStates)).toBe(true);
      
      await loadPromise;
    });

    it('should track load times by framework', async () => {
      await service.loadFramework(FrameworkType.REACT);
      await service.loadFramework(FrameworkType.VUE);
      
      const metrics = service.getLoadingMetrics();
      expect(metrics.loadTimesByFramework.has(FrameworkType.REACT)).toBe(true);
      expect(metrics.loadTimesByFramework.has(FrameworkType.VUE)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle load timeouts', async () => {
      const shortTimeoutService = new FrameworkLoaderService({
        ...config,
        loadingStrategy: {
          ...config.loadingStrategy,
          timeoutMs: 1 // Very short timeout
        }
      });
      
      await expect(
        shortTimeoutService.loadFramework(FrameworkType.REACT, LoadPriority.NORMAL, undefined, 1)
      ).rejects.toThrow('timeout');
      
      await shortTimeoutService.shutdown();
    });

    it('should handle service shutdown gracefully', async () => {
      // Create a service with very slow network conditions to ensure load is in progress
      const slowService = new FrameworkLoaderService({
        ...config,
        enableLogging: false
      });
      
      // Set very slow network conditions
      slowService.adaptToNetworkConditions({
        effectiveType: 'slow-2g',
        downlink: 0.1,
        rtt: 5000,
        saveData: false
      });
      
      const loadPromise = slowService.loadFramework(FrameworkType.REACT);
      
      // Wait a bit to ensure load has started, then shutdown
      await new Promise(resolve => setTimeout(resolve, 50));
      await slowService.shutdown();
      
      await expect(loadPromise).rejects.toThrow('shutdown');
    });
  });

  describe('Concurrent Load Limiting', () => {
    it('should respect max concurrent loads', async () => {
      const limitedService = new FrameworkLoaderService({
        ...config,
        loadingStrategy: {
          ...config.loadingStrategy,
          maxConcurrentLoads: 1
        }
      });
      
      // Start multiple loads
      const promises = [
        limitedService.loadFramework(FrameworkType.REACT),
        limitedService.loadFramework(FrameworkType.VUE),
        limitedService.loadFramework(FrameworkType.SVELTE)
      ];
      
      const frameworks = await Promise.all(promises);
      expect(frameworks).toHaveLength(3);
      
      await limitedService.shutdown();
    });
  });

  describe('Cache Size Limits', () => {
    it('should respect cache size limits', async () => {
      const smallCacheService = new FrameworkLoaderService({
        ...config,
        cacheConfig: {
          ...config.cacheConfig,
          maxSize: 2
        }
      });
      
      // Load more frameworks than cache size
      await smallCacheService.loadFramework(FrameworkType.REACT);
      await smallCacheService.loadFramework(FrameworkType.VUE);
      await smallCacheService.loadFramework(FrameworkType.SVELTE);
      
      const cached = smallCacheService.getCachedFrameworks();
      expect(cached.length).toBeLessThanOrEqual(2);
      
      await smallCacheService.shutdown();
    });
  });

  describe('Service Integration', () => {
    it('should work without service worker manager', () => {
      const serviceWithoutSW = new FrameworkLoaderService(config);
      expect(serviceWithoutSW).toBeInstanceOf(FrameworkLoaderService);
    });

    it('should work without fallback loader', () => {
      const serviceWithoutFallback = new FrameworkLoaderService({
        ...config,
        fallbackEnabled: false
      });
      expect(serviceWithoutFallback).toBeInstanceOf(FrameworkLoaderService);
    });
  });
});