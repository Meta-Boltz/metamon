/**
 * Integration tests for ServiceWorkerFrameworkManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceWorkerFrameworkManager } from '../../service-worker/service-worker-framework-manager.js';
import type { FrameworkRequest, BackgroundTask } from '../../service-worker/service-worker-framework-manager.js';

// Mock service worker environment
const mockServiceWorkerGlobalScope = {
  addEventListener: vi.fn(),
  skipWaiting: vi.fn(),
  clients: {
    claim: vi.fn()
  },
  caches: {
    open: vi.fn(),
    keys: vi.fn(),
    delete: vi.fn()
  }
};

const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn()
};

const mockCrypto = {
  subtle: {
    digest: vi.fn()
  }
};

// Setup global mocks for service worker environment
beforeEach(() => {
  global.self = mockServiceWorkerGlobalScope as any;
  global.caches = mockServiceWorkerGlobalScope.caches as any;
  global.crypto = mockCrypto as any;
  global.fetch = vi.fn();
  global.performance = { now: vi.fn(() => Date.now()) } as any;
  global.setInterval = vi.fn();
  global.clearTimeout = vi.fn();
  global.setTimeout = vi.fn();
  
  mockServiceWorkerGlobalScope.caches.open.mockResolvedValue(mockCache);
  mockCache.keys.mockResolvedValue([]);
  mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ServiceWorkerFrameworkManager Integration', () => {
  let manager: ServiceWorkerFrameworkManager;

  beforeEach(async () => {
    manager = new ServiceWorkerFrameworkManager('test-cache', {
      maxSize: 10 * 1024 * 1024, // 10MB for testing
      maxAge: 60 * 60 * 1000, // 1 hour for testing
      evictionPolicy: 'priority-based',
      compressionEnabled: false, // Disable for simpler testing
      preloadThreshold: 0.8
    });
    await manager.initialize();
  });

  describe('end-to-end framework loading', () => {
    it('should handle complete framework loading workflow', async () => {
      // Setup mock network response
      const mockBundle = new ArrayBuffer(1024);
      const mockNetworkResponse = new Response(mockBundle, {
        status: 200,
        headers: {
          'X-Metamon-Dependencies': JSON.stringify(['react-dom']),
          'Content-Type': 'application/javascript'
        }
      });

      (global.fetch as any).mockResolvedValue(mockNetworkResponse);
      mockCache.match.mockResolvedValue(null); // No cache hit initially
      mockCache.keys.mockResolvedValue([]);

      // Create framework request
      const request: FrameworkRequest = {
        framework: 'reactjs',
        version: '18.0.0',
        priority: 'critical',
        clientId: 'integration-test',
        timestamp: Date.now()
      };

      // First request should fetch from network and cache
      const response1 = await manager.handleFrameworkRequest(request);
      
      expect(response1.status).toBe(200);
      expect(response1.headers.get('X-Metamon-Cache')).toBe('miss');
      expect(response1.headers.get('X-Metamon-Framework')).toBe('reactjs');
      expect(mockCache.put).toHaveBeenCalled();

      // Setup cache hit for second request
      const cachedResponse = new Response(mockBundle, {
        headers: {
          'X-Metamon-Framework': 'reactjs',
          'X-Metamon-Version': '18.0.0',
          'X-Metamon-Size': '1024',
          'X-Metamon-Timestamp': Date.now().toString(),
          'X-Metamon-Checksum': 'test-checksum',
          'X-Metamon-Dependencies': JSON.stringify(['react-dom']),
          'X-Metamon-Priority': 'critical',
          'X-Metamon-Access-Count': '1',
          'X-Metamon-Last-Accessed': Date.now().toString(),
          'X-Metamon-Compressed': 'false'
        }
      });

      mockCache.match.mockResolvedValue(cachedResponse);

      // Second request should serve from cache
      const response2 = await manager.handleFrameworkRequest(request);
      
      expect(response2.status).toBe(200);
      expect(response2.headers.get('X-Metamon-Cache')).toBe('hit');
    });

    it('should handle multiple concurrent framework requests', async () => {
      const mockBundle1 = new ArrayBuffer(1024);
      const mockBundle2 = new ArrayBuffer(2048);

      const mockResponse1 = new Response(mockBundle1, {
        status: 200,
        headers: { 'X-Metamon-Dependencies': '[]' }
      });

      const mockResponse2 = new Response(mockBundle2, {
        status: 200,
        headers: { 'X-Metamon-Dependencies': '[]' }
      });

      (global.fetch as any)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);

      const requests: FrameworkRequest[] = [
        {
          framework: 'reactjs',
          version: '18.0.0',
          priority: 'critical',
          clientId: 'test-1',
          timestamp: Date.now()
        },
        {
          framework: 'vue',
          version: '3.0.0',
          priority: 'high',
          clientId: 'test-2',
          timestamp: Date.now()
        }
      ];

      // Handle concurrent requests
      const responses = await Promise.all(
        requests.map(req => manager.handleFrameworkRequest(req))
      );

      expect(responses).toHaveLength(2);
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      expect(mockCache.put).toHaveBeenCalledTimes(2);
    });
  });

  describe('background task integration', () => {
    it('should execute background tasks while handling framework requests', async () => {
      // Setup framework request
      const mockBundle = new ArrayBuffer(1024);
      const mockResponse = new Response(mockBundle, {
        status: 200,
        headers: { 'X-Metamon-Dependencies': '[]' }
      });

      (global.fetch as any).mockResolvedValue(mockResponse);
      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);

      const frameworkRequest: FrameworkRequest = {
        framework: 'svelte',
        version: '4.0.0',
        priority: 'normal',
        clientId: 'bg-test',
        timestamp: Date.now()
      };

      const backgroundTask: BackgroundTask = {
        type: 'data-processing',
        payload: { data: 'background-test' },
        timeout: 5000,
        priority: 'low',
        id: 'bg-task-1'
      };

      // Execute both concurrently
      const [frameworkResponse, taskResult] = await Promise.all([
        manager.handleFrameworkRequest(frameworkRequest),
        manager.executeInBackground(backgroundTask)
      ]);

      expect(frameworkResponse.status).toBe(200);
      expect(taskResult.processed).toBe(true);
      expect(taskResult.data).toEqual({ data: 'background-test' });

      // Verify metrics include background task execution
      const metrics = manager.getMetrics();
      expect(metrics.backgroundTasksExecuted).toBeGreaterThan(0);
    });

    it('should handle cache optimization background task', async () => {
      const optimizationTask: BackgroundTask = {
        type: 'cache-optimization',
        payload: {},
        timeout: 10000,
        priority: 'low',
        id: 'cache-opt-1'
      };

      const result = await manager.executeInBackground(optimizationTask);
      
      expect(result.optimized).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalSize).toBeDefined();
      expect(result.stats.entryCount).toBeDefined();
    });
  });

  describe('cache strategy integration', () => {
    it('should apply priority-based eviction when cache is full', async () => {
      // Create manager with very small cache size
      const smallCacheManager = new ServiceWorkerFrameworkManager('small-cache', {
        maxSize: 2048, // Very small cache
        evictionPolicy: 'priority-based'
      });
      await smallCacheManager.initialize();

      // Mock cache stats to simulate full cache
      const mockKeys = [
        { url: 'metamon-framework-low-priority@1.0.0' },
        { url: 'metamon-framework-high-priority@1.0.0' }
      ];

      mockCache.keys.mockResolvedValue(mockKeys);

      const lowPriorityResponse = new Response(new ArrayBuffer(1024), {
        headers: {
          'X-Metamon-Framework': 'low-priority',
          'X-Metamon-Version': '1.0.0',
          'X-Metamon-Size': '1024',
          'X-Metamon-Timestamp': (Date.now() - 1000).toString(),
          'X-Metamon-Priority': 'low',
          'X-Metamon-Access-Count': '1',
          'X-Metamon-Last-Accessed': (Date.now() - 1000).toString(),
          'X-Metamon-Checksum': 'low-checksum',
          'X-Metamon-Dependencies': '[]',
          'X-Metamon-Compressed': 'false'
        }
      });

      const highPriorityResponse = new Response(new ArrayBuffer(1024), {
        headers: {
          'X-Metamon-Framework': 'high-priority',
          'X-Metamon-Version': '1.0.0',
          'X-Metamon-Size': '1024',
          'X-Metamon-Timestamp': Date.now().toString(),
          'X-Metamon-Priority': 'critical',
          'X-Metamon-Access-Count': '1',
          'X-Metamon-Last-Accessed': Date.now().toString(),
          'X-Metamon-Checksum': 'high-checksum',
          'X-Metamon-Dependencies': '[]',
          'X-Metamon-Compressed': 'false'
        }
      });

      mockCache.match
        .mockResolvedValueOnce(lowPriorityResponse)
        .mockResolvedValueOnce(highPriorityResponse);

      // Add a new framework that should trigger eviction
      const newFramework = {
        name: 'new-framework',
        version: '1.0.0',
        bundle: new ArrayBuffer(1024),
        dependencies: [],
        size: 1024,
        timestamp: Date.now(),
        checksum: 'new-checksum',
        accessCount: 0,
        lastAccessed: Date.now(),
        priority: 'normal' as const
      };

      await smallCacheManager.cacheFrameworkWithStrategy(newFramework);

      // Verify that cache operations were performed
      expect(mockCache.put).toHaveBeenCalled();
    });

    it('should handle cache invalidation patterns', async () => {
      const mockKeys = [
        { url: 'metamon-framework-reactjs@17.0.0' },
        { url: 'metamon-framework-reactjs@18.0.0' },
        { url: 'metamon-framework-vue@3.0.0' }
      ];

      mockCache.keys.mockResolvedValue(mockKeys);

      // Invalidate all React frameworks
      await manager.invalidateCache('reactjs');

      // Should delete React entries but not Vue
      expect(mockCache.delete).toHaveBeenCalledTimes(2);
    });

    it('should update framework versions correctly', async () => {
      const updates = [
        {
          name: 'reactjs',
          oldVersion: '17.0.0',
          newVersion: '18.0.0',
          bundle: new ArrayBuffer(2048)
        },
        {
          name: 'vue',
          oldVersion: '2.7.0',
          newVersion: '3.0.0',
          bundle: new ArrayBuffer(1536)
        }
      ];

      await manager.updateFrameworkCache(updates);

      // Should delete old versions and cache new ones
      expect(mockCache.delete).toHaveBeenCalledTimes(2);
      expect(mockCache.put).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling integration', () => {
    it('should handle network failures gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network unavailable'));
      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);

      const request: FrameworkRequest = {
        framework: 'failed-framework',
        version: '1.0.0',
        priority: 'normal',
        clientId: 'error-test',
        timestamp: Date.now()
      };

      const response = await manager.handleFrameworkRequest(request);
      
      expect(response.status).toBe(500);
      const errorData = await response.json();
      expect(errorData.error).toBe('Framework loading failed');
      expect(errorData.framework).toBe('failed-framework');
    });

    it('should handle background task failures', async () => {
      const failingTask: BackgroundTask = {
        type: 'state-computation',
        payload: null, // This might cause an error
        timeout: 1, // Very short timeout
        priority: 'normal',
        id: 'failing-task'
      };

      await expect(manager.executeInBackground(failingTask)).rejects.toThrow();
    });

    it('should handle cache corruption gracefully', async () => {
      // Simulate corrupted cache response
      const corruptedResponse = new Response(new ArrayBuffer(1024), {
        headers: {
          // Missing required headers
          'X-Metamon-Framework': 'corrupted',
          // Other headers missing
        }
      });

      mockCache.match.mockResolvedValue(corruptedResponse);

      const framework = await manager.getCachedFramework('corrupted');
      
      // Should handle missing headers gracefully
      expect(framework).not.toBeNull();
      expect(framework!.name).toBe('corrupted');
      expect(framework!.version).toBe(''); // Default for missing header
    });
  });

  describe('performance metrics integration', () => {
    it('should track comprehensive metrics across operations', async () => {
      // Perform various operations
      const mockBundle = new ArrayBuffer(1024);
      const mockResponse = new Response(mockBundle, {
        status: 200,
        headers: { 'X-Metamon-Dependencies': '[]' }
      });

      (global.fetch as any).mockResolvedValue(mockResponse);
      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);

      // Framework request (cache miss)
      await manager.handleFrameworkRequest({
        framework: 'metrics-test',
        version: '1.0.0',
        priority: 'normal',
        clientId: 'metrics',
        timestamp: Date.now()
      });

      // Background task
      await manager.executeInBackground({
        type: 'data-processing',
        payload: {},
        timeout: 5000,
        priority: 'low',
        id: 'metrics-bg'
      });

      const metrics = manager.getMetrics();
      
      expect(metrics.cacheHitRate).toBeDefined();
      expect(metrics.averageLoadTime).toBeGreaterThan(0);
      expect(metrics.backgroundTasksExecuted).toBeGreaterThan(0);
      expect(metrics.totalBytesServed).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeDefined();
    });
  });
});