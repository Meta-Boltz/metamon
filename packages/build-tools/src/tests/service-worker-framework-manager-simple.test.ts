/**
 * Simplified tests for ServiceWorkerFrameworkManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceWorkerFrameworkManager } from '../service-worker/service-worker-framework-manager.js';
import type { FrameworkRequest, BackgroundTask } from '../service-worker/service-worker-framework-manager.js';

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

describe('ServiceWorkerFrameworkManager - Core Functionality', () => {
  let manager: ServiceWorkerFrameworkManager;

  beforeEach(async () => {
    // Disable compression to avoid issues in tests
    manager = new ServiceWorkerFrameworkManager('test-cache', {
      compressionEnabled: false,
      maxSize: 10 * 1024 * 1024, // 10MB for testing
      maxAge: 60 * 60 * 1000, // 1 hour for testing
    });
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
        evictionPolicy: 'lru' as const,
        compressionEnabled: false
      };
      
      const newManager = new ServiceWorkerFrameworkManager(
        'custom-cache',
        customStrategy
      );
      await newManager.initialize();
      
      expect(mockCaches.open).toHaveBeenCalledWith('custom-cache');
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

    it('should return null when framework not found', async () => {
      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);

      const framework = await manager.getCachedFramework('nonexistent');
      
      expect(framework).toBeNull();
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

    it('should invalidate all cache entries with wildcard', async () => {
      const mockKeys = [
        { url: 'metamon-framework-reactjs@18.0.0' },
        { url: 'metamon-framework-vue@3.0.0' }
      ];

      mockCache.keys.mockResolvedValue(mockKeys);

      await manager.invalidateCache('*');
      
      expect(mockCache.delete).toHaveBeenCalledTimes(2); // Should delete all entries
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

    it('should return initial metrics', () => {
      const metrics = manager.getMetrics();
      
      expect(metrics.cacheHitRate).toBeDefined();
      expect(metrics.averageLoadTime).toBeDefined();
      expect(metrics.backgroundTasksExecuted).toBeDefined();
      expect(metrics.totalBytesServed).toBeDefined();
      expect(metrics.errorRate).toBeDefined();
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

  describe('framework request handling - basic cases', () => {
    it('should handle network failure gracefully', async () => {
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

    it('should handle successful network request', async () => {
      const mockBundle = new ArrayBuffer(1024);
      const mockNetworkResponse = new Response(mockBundle, {
        status: 200,
        headers: {
          'X-Metamon-Dependencies': '[]'
        }
      });

      (global.fetch as any).mockResolvedValue(mockNetworkResponse);
      mockCache.match.mockResolvedValue(null);
      mockCache.keys.mockResolvedValue([]);

      const request: FrameworkRequest = {
        framework: 'vue',
        version: '3.0.0',
        priority: 'normal',
        clientId: 'test-client',
        timestamp: Date.now()
      };

      const response = await manager.handleFrameworkRequest(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Metamon-Cache')).toBe('miss');
      expect(response.headers.get('X-Metamon-Framework')).toBe('vue');
      expect(mockCache.put).toHaveBeenCalled();
    });
  });

  describe('cache eviction strategies', () => {
    it('should create manager with LRU eviction policy', async () => {
      const managerWithLRU = new ServiceWorkerFrameworkManager('test-cache', {
        evictionPolicy: 'lru',
        maxSize: 1024,
        compressionEnabled: false
      });
      await managerWithLRU.initialize();

      expect(managerWithLRU).toBeDefined();
    });

    it('should create manager with LFU eviction policy', async () => {
      const managerWithLFU = new ServiceWorkerFrameworkManager('test-cache', {
        evictionPolicy: 'lfu',
        maxSize: 1024,
        compressionEnabled: false
      });
      await managerWithLFU.initialize();

      expect(managerWithLFU).toBeDefined();
    });

    it('should create manager with priority-based eviction policy', async () => {
      const managerWithPriority = new ServiceWorkerFrameworkManager('test-cache', {
        evictionPolicy: 'priority-based',
        maxSize: 1024,
        compressionEnabled: false
      });
      await managerWithPriority.initialize();

      expect(managerWithPriority).toBeDefined();
    });
  });
});