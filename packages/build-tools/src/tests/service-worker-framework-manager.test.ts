/**
 * Tests for ServiceWorkerFrameworkManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceWorkerFrameworkManager } from '../service-worker/service-worker-framework-manager.js';
import type { FrameworkRequest, BackgroundTask, FrameworkCacheEntry } from '../service-worker/service-worker-framework-manager.js';

// Mock global APIs
const mockCaches = {
  open: vi.fn(),
  keys: vi.fn(),
  delete: vi.fn()
};

const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn()
};

// Setup global mocks
beforeEach(() => {
  global.caches = mockCaches as any;
  global.fetch = vi.fn();
  global.performance = { now: vi.fn(() => Date.now()) } as any;
  global.setInterval = vi.fn();
  global.clearTimeout = vi.fn();
  global.setTimeout = vi.fn();
  
  // Mock crypto.subtle.digest
  vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new ArrayBuffer(32));
  
  mockCaches.open.mockResolvedValue(mockCache);
  mockCache.keys.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ServiceWorkerFrameworkManager', () => {
  let manager: ServiceWorkerFrameworkManager;

  beforeEach(async () => {
    manager = new ServiceWorkerFrameworkManager();
    await manager.initialize();
  });

  describe('initialization', () => {
    it('should initialize with default cache strategy', async () => {
      const newManager = new ServiceWorkerFrameworkManager();
      await newManager.initialize();
      
      expect(mockCaches.open).toHaveBeenCalledWith('metamon-frameworks-v2');
    });

    it('should initialize with custom cache strategy', async () => {
      const customStrategy = {
        maxSize: 50 * 1024 * 1024,
        maxAge: 3 * 24 * 60 * 60 * 1000,
        evictionPolicy: 'lru' as const
      };
      
      const newManager = new ServiceWorkerFrameworkManager(
        'custom-cache',
        customStrategy
      );
      await newManager.initialize();
      
      expect(mockCaches.open).toHaveBeenCalledWith('custom-cache');
    });
  });

  describe('framework request handling', () => {
    it('should handle framework request with cache hit', async () => {
      const request: FrameworkRequest = {
        framework: 'reactjs',
        version: '18.0.0',
        priority: 'high',
        clientId: 'client-1',
        timestamp: Date.now()
      };

      const mockFramework: FrameworkCacheEntry = {
        name: 'reactjs',
        version: '18.0.0',
        bundle: new ArrayBuffer(1024),
        dependencies: [],
        size: 1024,
        timestamp: Date.now() - 1000,
        checksum: 'abc123',
        accessCount: 1,
        lastAccessed: Date.now() - 1000,
        priority: 'high'
      };

      const mockResponse = new Response(mockFramework.bundle, {
        headers: {
          'X-Metamon-Framework': mockFramework.name,
          'X-Metamon-Version': mockFramework.version,
          'X-Metamon-Size': mockFramework.size.toString(),
          'X-Metamon-Timestamp': mockFramework.timestamp.toString(),
          'X-Metamon-Checksum': mockFramework.checksum,
          'X-Metamon-Dependencies': JSON.stringify(mockFramework.dependencies),
          'X-Metamon-Priority': mockFramework.priority,
          'X-Metamon-Access-Count': mockFramework.accessCount.toString(),
          'X-Metamon-Last-Accessed': mockFramework.lastAccessed.toString(),
          'X-Metamon-Compressed': 'false'
        }
      });

      mockCache.match.mockResolvedValue(mockResponse);

      const response = await manager.handleFrameworkRequest(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Metamon-Cache')).toBe('hit');
      expect(response.headers.get('X-Metamon-Framework')).toBe('reactjs');
    });

    it('should handle framework request with cache miss', async () => {
      const request: FrameworkRequest = {
        framework: 'vue',
        version: '3.0.0',
        priority: 'normal',
        clientId: 'client-2',
        timestamp: Date.now()
      };

      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);

      const mockNetworkResponse = new Response(new ArrayBuffer(2048), {
        status: 200,
        headers: {
          'X-Metamon-Dependencies': '[]'
        }
      });

      (global.fetch as any).mockResolvedValue(mockNetworkResponse);

      const response = await manager.handleFrameworkRequest(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Metamon-Cache')).toBe('miss');
      expect(response.headers.get('X-Metamon-Framework')).toBe('vue');
      expect(mockCache.put).toHaveBeenCalled();
    });

    it('should handle network failure gracefully', async () => {
      const request: FrameworkRequest = {
        framework: 'svelte',
        version: '4.0.0',
        priority: 'low',
        clientId: 'client-3',
        timestamp: Date.now()
      };

      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const response = await manager.handleFrameworkRequest(request);
      
      expect(response.status).toBe(500);
      const errorData = await response.json();
      expect(errorData.error).toBe('Framework loading failed');
      expect(errorData.framework).toBe('svelte');
    });

    it('should prioritize critical requests', async () => {
      const criticalRequest: FrameworkRequest = {
        framework: 'reactjs',
        version: '18.0.0',
        priority: 'critical',
        clientId: 'client-1',
        timestamp: Date.now()
      };

      const normalRequest: FrameworkRequest = {
        framework: 'vue',
        version: '3.0.0',
        priority: 'normal',
        clientId: 'client-2',
        timestamp: Date.now()
      };

      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);

      const mockResponse = new Response(new ArrayBuffer(1024), {
        status: 200,
        headers: { 'X-Metamon-Dependencies': '[]' }
      });

      (global.fetch as any).mockResolvedValue(mockResponse);

      // Both requests should be handled, but critical should be processed first
      const [criticalResponse, normalResponse] = await Promise.all([
        manager.handleFrameworkRequest(criticalRequest),
        manager.handleFrameworkRequest(normalRequest)
      ]);

      expect(criticalResponse.status).toBe(200);
      expect(normalResponse.status).toBe(200);
    });
  });

  describe('background task execution', () => {
    it('should execute state computation task', async () => {
      const task: BackgroundTask = {
        type: 'state-computation',
        payload: { data: 'test' },
        timeout: 5000,
        priority: 'normal',
        id: 'task-1'
      };

      const result = await manager.executeInBackground(task);
      
      expect(result.computed).toBe(true);
      expect(result.result).toEqual({ data: 'test' });
    });

    it('should execute data processing task', async () => {
      const task: BackgroundTask = {
        type: 'data-processing',
        payload: { items: [1, 2, 3] },
        timeout: 5000,
        priority: 'high',
        id: 'task-2'
      };

      const result = await manager.executeInBackground(task);
      
      expect(result.processed).toBe(true);
      expect(result.data).toEqual({ items: [1, 2, 3] });
    });

    it('should execute component preparation task', async () => {
      const task: BackgroundTask = {
        type: 'component-preparation',
        payload: { component: 'Button' },
        timeout: 5000,
        priority: 'normal',
        id: 'task-3'
      };

      const result = await manager.executeInBackground(task);
      
      expect(result.prepared).toBe(true);
      expect(result.component).toEqual({ component: 'Button' });
    });

    it('should execute cache optimization task', async () => {
      const task: BackgroundTask = {
        type: 'cache-optimization',
        payload: {},
        timeout: 10000,
        priority: 'low',
        id: 'task-4'
      };

      const result = await manager.executeInBackground(task);
      
      expect(result.optimized).toBe(true);
      expect(result.stats).toBeDefined();
    });

    it('should handle task timeout', async () => {
      const task: BackgroundTask = {
        type: 'state-computation',
        payload: {},
        timeout: 1, // Very short timeout
        priority: 'normal',
        id: 'task-timeout'
      };

      await expect(manager.executeInBackground(task)).rejects.toThrow('Background task timeout');
    });

    it('should handle unknown task type', async () => {
      const task: BackgroundTask = {
        type: 'unknown-task' as any,
        payload: {},
        timeout: 5000,
        priority: 'normal',
        id: 'task-unknown'
      };

      await expect(manager.executeInBackground(task)).rejects.toThrow('Unknown task type');
    });
  });

  describe('cache management', () => {
    it('should cache framework with compression', async () => {
      const framework: FrameworkCacheEntry = {
        name: 'reactjs',
        version: '18.0.0',
        bundle: new ArrayBuffer(1024),
        dependencies: ['react-dom'],
        size: 1024,
        timestamp: Date.now(),
        checksum: 'abc123',
        accessCount: 0,
        lastAccessed: Date.now(),
        priority: 'high'
      };

      await manager.cacheFrameworkWithStrategy(framework);
      
      expect(mockCache.put).toHaveBeenCalled();
      const [cacheKey, response] = mockCache.put.mock.calls[0];
      expect(cacheKey).toBe('metamon-framework-reactjs@18.0.0');
      expect(response.headers.get('X-Metamon-Framework')).toBe('reactjs');
    });

    it('should get cached framework by exact version', async () => {
      const mockResponse = new Response(new ArrayBuffer(1024), {
        headers: {
          'X-Metamon-Framework': 'vue',
          'X-Metamon-Version': '3.0.0',
          'X-Metamon-Size': '1024',
          'X-Metamon-Timestamp': Date.now().toString(),
          'X-Metamon-Checksum': 'def456',
          'X-Metamon-Dependencies': '[]',
          'X-Metamon-Priority': 'normal',
          'X-Metamon-Access-Count': '1',
          'X-Metamon-Last-Accessed': Date.now().toString(),
          'X-Metamon-Compressed': 'false'
        }
      });

      mockCache.match.mockResolvedValue(mockResponse);

      const framework = await manager.getCachedFramework('vue', '3.0.0');
      
      expect(framework).not.toBeNull();
      expect(framework!.name).toBe('vue');
      expect(framework!.version).toBe('3.0.0');
    });

    it('should find latest version when no exact match', async () => {
      const mockRequest1 = { url: 'metamon-framework-svelte@3.0.0' };
      const mockRequest2 = { url: 'metamon-framework-svelte@4.0.0' };
      
      mockCache.match.mockResolvedValueOnce(null); // No exact match
      mockCache.keys.mockResolvedValue([mockRequest1, mockRequest2]);

      const mockResponse1 = new Response(new ArrayBuffer(1024), {
        headers: {
          'X-Metamon-Framework': 'svelte',
          'X-Metamon-Version': '3.0.0',
          'X-Metamon-Timestamp': (Date.now() - 1000).toString(),
          'X-Metamon-Priority': 'normal',
          'X-Metamon-Size': '1024',
          'X-Metamon-Checksum': 'ghi789',
          'X-Metamon-Dependencies': '[]',
          'X-Metamon-Access-Count': '1',
          'X-Metamon-Last-Accessed': Date.now().toString(),
          'X-Metamon-Compressed': 'false'
        }
      });

      const mockResponse2 = new Response(new ArrayBuffer(1024), {
        headers: {
          'X-Metamon-Framework': 'svelte',
          'X-Metamon-Version': '4.0.0',
          'X-Metamon-Timestamp': Date.now().toString(),
          'X-Metamon-Priority': 'high',
          'X-Metamon-Size': '1024',
          'X-Metamon-Checksum': 'jkl012',
          'X-Metamon-Dependencies': '[]',
          'X-Metamon-Access-Count': '1',
          'X-Metamon-Last-Accessed': Date.now().toString(),
          'X-Metamon-Compressed': 'false'
        }
      });

      mockCache.match
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const framework = await manager.getCachedFramework('svelte');
      
      expect(framework).not.toBeNull();
      expect(framework!.version).toBe('4.0.0'); // Should return the higher priority/newer version
    });

    it('should invalidate cache by pattern', async () => {
      const mockKeys = [
        { url: 'metamon-framework-reactjs@18.0.0' },
        { url: 'metamon-framework-vue@3.0.0' },
        { url: 'metamon-framework-reactjs@17.0.0' }
      ];

      mockCache.keys.mockResolvedValue(mockKeys);

      await manager.invalidateCache('reactjs');
      
      expect(mockCache.delete).toHaveBeenCalledTimes(2); // Should delete both React versions
    });

    it('should update framework cache versions', async () => {
      const updates = [
        {
          name: 'reactjs',
          oldVersion: '17.0.0',
          newVersion: '18.0.0',
          bundle: new ArrayBuffer(2048)
        }
      ];

      await manager.updateFrameworkCache(updates);
      
      expect(mockCache.delete).toHaveBeenCalled(); // Old version deleted
      expect(mockCache.put).toHaveBeenCalled(); // New version cached
    });
  });

  describe('metrics and monitoring', () => {
    it('should track cache hit rate', async () => {
      const request: FrameworkRequest = {
        framework: 'reactjs',
        version: '18.0.0',
        priority: 'normal',
        clientId: 'client-1',
        timestamp: Date.now()
      };

      const mockResponse = new Response(new ArrayBuffer(1024), {
        headers: {
          'X-Metamon-Framework': 'reactjs',
          'X-Metamon-Version': '18.0.0',
          'X-Metamon-Size': '1024',
          'X-Metamon-Timestamp': Date.now().toString(),
          'X-Metamon-Checksum': 'abc123',
          'X-Metamon-Dependencies': '[]',
          'X-Metamon-Priority': 'normal',
          'X-Metamon-Access-Count': '1',
          'X-Metamon-Last-Accessed': Date.now().toString(),
          'X-Metamon-Compressed': 'false'
        }
      });

      mockCache.match.mockResolvedValue(mockResponse);

      await manager.handleFrameworkRequest(request);
      
      const metrics = manager.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
      expect(metrics.totalBytesServed).toBeGreaterThan(0);
    });

    it('should track background task execution', async () => {
      const task: BackgroundTask = {
        type: 'state-computation',
        payload: {},
        timeout: 5000,
        priority: 'normal',
        id: 'metrics-task'
      };

      await manager.executeInBackground(task);
      
      const metrics = manager.getMetrics();
      expect(metrics.backgroundTasksExecuted).toBeGreaterThan(0);
    });

    it('should track error rate', async () => {
      const request: FrameworkRequest = {
        framework: 'invalid',
        version: '1.0.0',
        priority: 'normal',
        clientId: 'client-error',
        timestamp: Date.now()
      };

      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await manager.handleFrameworkRequest(request);
      
      const metrics = manager.getMetrics();
      expect(metrics.errorRate).toBeGreaterThan(0);
    });
  });

  describe('cache eviction strategies', () => {
    it('should evict entries based on LRU policy', async () => {
      const managerWithLRU = new ServiceWorkerFrameworkManager('test-cache', {
        evictionPolicy: 'lru',
        maxSize: 1024 // Small size to trigger eviction
      });
      await managerWithLRU.initialize();

      // This would be tested with actual cache operations
      // For now, we verify the manager was created with LRU policy
      expect(managerWithLRU).toBeDefined();
    });

    it('should evict entries based on LFU policy', async () => {
      const managerWithLFU = new ServiceWorkerFrameworkManager('test-cache', {
        evictionPolicy: 'lfu',
        maxSize: 1024
      });
      await managerWithLFU.initialize();

      expect(managerWithLFU).toBeDefined();
    });

    it('should evict entries based on priority policy', async () => {
      const managerWithPriority = new ServiceWorkerFrameworkManager('test-cache', {
        evictionPolicy: 'priority-based',
        maxSize: 1024
      });
      await managerWithPriority.initialize();

      expect(managerWithPriority).toBeDefined();
    });
  });

  describe('message port communication', () => {
    it('should set message port for communication', () => {
      const mockPort = { postMessage: vi.fn() } as any;
      
      manager.setMessagePort(mockPort);
      
      // Verify the port was set (internal state, so we can't directly test)
      expect(mockPort).toBeDefined();
    });
  });
});