/**
 * Tests for Service Worker Manager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ServiceWorkerManager, ServiceWorkerConfig, FrameworkCacheEntry } from '../service-worker/service-worker-manager.js';

// Mock service worker APIs
const mockServiceWorker = {
  register: vi.fn(),
  controller: null,
  ready: Promise.resolve({
    active: { postMessage: vi.fn() },
    installing: null,
    waiting: null,
    addEventListener: vi.fn(),
    update: vi.fn(),
    unregister: vi.fn().mockResolvedValue(true)
  })
};

const mockNavigator = {
  serviceWorker: mockServiceWorker
};

// Mock MessageChannel
const mockMessageChannel = {
  port1: { onmessage: null },
  port2: {}
};

global.MessageChannel = vi.fn(() => mockMessageChannel);

// Mock navigator properly
Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true
});

describe('ServiceWorkerManager', () => {
  let manager: ServiceWorkerManager;
  let config: ServiceWorkerConfig;

  beforeEach(() => {
    config = {
      swPath: '/test-sw.js',
      scope: '/',
      frameworkCachePrefix: 'test-framework-',
      maxCacheAge: 24 * 60 * 60 * 1000,
      enableFallback: true,
      fallbackTimeout: 5000,
      isDevelopment: true,
      enableLogging: true
    };

    manager = new ServiceWorkerManager(config);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should detect service worker support', () => {
      const status = manager.getStatus();
      expect(status.isSupported).toBe(true);
    });

    it('should register service worker successfully', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn(),
        update: vi.fn(),
        unregister: vi.fn().mockResolvedValue(true)
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      const status = await manager.initialize();

      expect(mockServiceWorker.register).toHaveBeenCalledWith('/test-sw.js', { scope: '/' });
      expect(status.isRegistered).toBe(true);
      expect(status.registration).toBe(mockRegistration);
    });

    it('should handle service worker registration failure', async () => {
      const error = new Error('Registration failed');
      mockServiceWorker.register.mockRejectedValue(error);

      const status = await manager.initialize();

      expect(status.isRegistered).toBe(false);
      expect(status.error).toBe(error);
    });

    it('should handle unsupported browsers gracefully', () => {
      const unsupportedNavigator = {};
      global.navigator = unsupportedNavigator as any;

      const unsupportedManager = new ServiceWorkerManager(config);
      const status = unsupportedManager.getStatus();

      expect(status.isSupported).toBe(false);
      expect(status.error).toBeInstanceOf(Error);
    });
  });

  describe('framework caching', () => {
    beforeEach(async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      await manager.initialize();
    });

    it('should cache framework successfully', async () => {
      const framework: FrameworkCacheEntry = {
        name: 'react',
        version: '18.0.0',
        bundle: new ArrayBuffer(1024),
        dependencies: ['react-dom'],
        size: 1024,
        timestamp: Date.now(),
        checksum: 'abc123'
      };

      // Mock successful message response
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { id: expect.any(String), payload: { success: true } }
          });
        }
      }, 0);

      await expect(manager.cacheFramework(framework)).resolves.not.toThrow();
    });

    it('should retrieve cached framework', async () => {
      const mockFramework = {
        name: 'vue',
        version: '3.0.0',
        bundle: new ArrayBuffer(512),
        dependencies: [],
        size: 512,
        timestamp: Date.now(),
        checksum: 'def456'
      };

      // Mock message response
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              payload: { framework: mockFramework } 
            }
          });
        }
      }, 0);

      const result = await manager.getCachedFramework('vue', '3.0.0');
      expect(result).toEqual(mockFramework);
    });

    it('should handle cache miss', async () => {
      // Mock empty response
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              payload: { framework: null } 
            }
          });
        }
      }, 0);

      const result = await manager.getCachedFramework('nonexistent');
      expect(result).toBeNull();
    });

    it('should invalidate cache', async () => {
      // Mock successful invalidation
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { id: expect.any(String), payload: { success: true } }
          });
        }
      }, 0);

      await expect(manager.invalidateFrameworkCache('react')).resolves.not.toThrow();
    });
  });

  describe('cache statistics', () => {
    beforeEach(async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      await manager.initialize();
    });

    it('should get cache statistics', async () => {
      const mockStats = {
        totalSize: 2048,
        entryCount: 2,
        frameworks: [
          { name: 'react', version: '18.0.0', size: 1024, timestamp: Date.now() },
          { name: 'vue', version: '3.0.0', size: 1024, timestamp: Date.now() }
        ]
      };

      // Mock stats response
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              payload: { stats: mockStats } 
            }
          });
        }
      }, 0);

      const stats = await manager.getCacheStats();
      expect(stats).toEqual(mockStats);
    });
  });

  describe('background tasks', () => {
    beforeEach(async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      await manager.initialize();
    });

    it('should execute background task', async () => {
      const task = {
        type: 'state-computation',
        payload: { data: 'test' },
        timeout: 1000
      };

      const mockResult = { computed: true };

      // Mock task response
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              payload: { result: mockResult } 
            }
          });
        }
      }, 0);

      const result = await manager.executeBackgroundTask(task);
      expect(result).toEqual(mockResult);
    });

    it('should handle background task timeout', async () => {
      const task = {
        type: 'slow-task',
        payload: {},
        timeout: 100
      };

      // Don't send response to simulate timeout
      await expect(manager.executeBackgroundTask(task)).rejects.toThrow('timeout');
    });
  });

  describe('service worker lifecycle', () => {
    it('should update service worker', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined)
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      await manager.initialize();

      await manager.update();
      expect(mockRegistration.update).toHaveBeenCalled();
    });

    it('should unregister service worker', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn(),
        unregister: vi.fn().mockResolvedValue(true)
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      await manager.initialize();

      const result = await manager.unregister();
      expect(result).toBe(true);
      expect(mockRegistration.unregister).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle message timeout', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      await manager.initialize();

      // Don't send response to simulate timeout
      await expect(manager.getCachedFramework('test')).rejects.toThrow('timeout');
    });

    it('should handle service worker errors', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      await manager.initialize();

      // Mock error response
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              error: 'Service worker error' 
            }
          });
        }
      }, 0);

      await expect(manager.getCachedFramework('test')).rejects.toThrow('Service worker error');
    });
  });

  describe('readiness checks', () => {
    it('should report not ready when not initialized', () => {
      expect(manager.isReady()).toBe(false);
    });

    it('should report ready when properly initialized', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      
      await manager.initialize();
      expect(manager.isReady()).toBe(true);
    });

    it('should throw error when not ready for operations', async () => {
      const framework: FrameworkCacheEntry = {
        name: 'test',
        version: '1.0.0',
        bundle: new ArrayBuffer(100),
        dependencies: [],
        size: 100,
        timestamp: Date.now(),
        checksum: 'test'
      };

      await expect(manager.cacheFramework(framework)).rejects.toThrow('not ready');
    });
  });
});