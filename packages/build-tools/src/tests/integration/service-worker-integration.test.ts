/**
 * Integration tests for Service Worker Performance Optimization
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  initializeMetamonServiceWorker,
  setupMetamonPerformanceOptimization,
  MetamonServiceWorkerSetup
} from '../service-worker/index.js';

// Mock browser APIs
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

const mockDocument = {
  createElement: vi.fn(),
  head: {
    appendChild: vi.fn()
  }
};

const mockFetch = vi.fn();
const mockMessageChannel = {
  port1: { onmessage: null },
  port2: {}
};

global.MessageChannel = vi.fn(() => mockMessageChannel);
Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true
});
Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true
});
global.fetch = mockFetch;

describe('Service Worker Integration', () => {
  let setup: MetamonServiceWorkerSetup;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize complete service worker setup', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn(),
        update: vi.fn(),
        unregister: vi.fn().mockResolvedValue(true)
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      setup = await initializeMetamonServiceWorker();

      expect(setup.serviceWorkerManager).toBeDefined();
      expect(setup.fallbackLoader).toBeDefined();
      expect(setup.loadFramework).toBeInstanceOf(Function);
      expect(setup.getStats).toBeInstanceOf(Function);
      expect(setup.isServiceWorkerSupported).toBe(true);
    });

    it('should handle service worker initialization failure gracefully', async () => {
      mockServiceWorker.register.mockRejectedValue(new Error('Registration failed'));

      setup = await initializeMetamonServiceWorker();

      expect(setup.isServiceWorkerSupported).toBe(false);
      expect(setup.loadFramework).toBeInstanceOf(Function);
      expect(setup.getStats).toBeInstanceOf(Function);
    });

    it('should work in environments without service worker support', async () => {
      const originalNavigator = global.navigator;
      global.navigator = {} as any;

      setup = await initializeMetamonServiceWorker();

      expect(setup.isServiceWorkerSupported).toBe(false);
      expect(setup.loadFramework).toBeInstanceOf(Function);

      global.navigator = originalNavigator;
    });
  });

  describe('framework loading coordination', () => {
    beforeEach(async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      setup = await initializeMetamonServiceWorker();
    });

    it('should use service worker when available', async () => {
      // Mock service worker cache response
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              payload: { 
                framework: {
                  name: 'reactjs',
                  version: '18.0.0',
                  bundle: new ArrayBuffer(1024),
                  dependencies: [],
                  size: 1024,
                  timestamp: Date.now(),
                  checksum: 'abc123'
                }
              } 
            }
          });
        }
      }, 0);

      await setup.loadFramework('reactjs', 'high');

      // Should not call fallback fetch since service worker handled it
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fallback to direct loading when service worker fails', async () => {
      // Mock service worker error
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              error: 'Service worker cache miss' 
            }
          });
        }
      }, 0);

      // Mock fallback loading
      const mockScript = {
        src: '',
        async: false,
        onload: null as any,
        onerror: null as any,
        setAttribute: vi.fn(),
        textContent: ''
      };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("React fallback");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      await setup.loadFramework('reactjs', 'high');

      expect(mockFetch).toHaveBeenCalledWith(
        '/metamon-framework/reactjs?version=latest&priority=high',
        expect.any(Object)
      );
    });
  });

  describe('performance monitoring', () => {
    beforeEach(async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      setup = await initializeMetamonServiceWorker();
    });

    it('should provide comprehensive statistics', async () => {
      // Mock service worker stats
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              payload: { 
                stats: {
                  totalSize: 2048,
                  entryCount: 2,
                  frameworks: [
                    { name: 'reactjs', version: '18.0.0', size: 1024, timestamp: Date.now() },
                    { name: 'vue', version: '3.0.0', size: 1024, timestamp: Date.now() }
                  ]
                }
              } 
            }
          });
        }
      }, 0);

      const stats = await setup.getStats();

      expect(stats.serviceWorker).toBeDefined();
      expect(stats.serviceWorker.supported).toBe(true);
      expect(stats.serviceWorker.active).toBe(true);
      expect(stats.serviceWorker.cache).toBeDefined();
      expect(stats.fallback).toBeDefined();
    });

    it('should handle service worker stats errors gracefully', async () => {
      // Mock service worker stats error
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              error: 'Stats unavailable' 
            }
          });
        }
      }, 0);

      const stats = await setup.getStats();

      expect(stats.serviceWorker.cacheError).toBe('Stats unavailable');
      expect(stats.fallback).toBeDefined();
    });
  });

  describe('complete setup with auto-initialization', () => {
    it('should auto-initialize critical frameworks', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      // Mock service worker responses for critical frameworks
      let messageCount = 0;
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          // Respond to multiple framework requests
          const responses = [
            { framework: null }, // Cache miss for reactjs
            { framework: null }  // Cache miss for vue
          ];
          
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              payload: responses[messageCount++] || { framework: null }
            }
          });
        }
      }, 0);

      // Mock fallback loading for critical frameworks
      const mockScript = {
        src: '',
        async: false,
        onload: null as any,
        onerror: null as any,
        setAttribute: vi.fn(),
        textContent: ''
      };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Critical framework");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      setup = await setupMetamonPerformanceOptimization({
        autoInitialize: true
      });

      expect(setup).toBeDefined();
      expect(setup.isServiceWorkerSupported).toBe(true);
      
      // Should have attempted to load critical frameworks
      // Note: The exact behavior depends on the implementation
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should skip auto-initialization when disabled', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      setup = await setupMetamonPerformanceOptimization({
        autoInitialize: false
      });

      expect(setup).toBeDefined();
      // Should not have made any framework loading requests
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should make setup available globally', async () => {
      const mockWindow = { MetamonPerformance: undefined };
      global.window = mockWindow as any;

      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      setup = await setupMetamonPerformanceOptimization();

      expect(mockWindow.MetamonPerformance).toBe(setup);
    });
  });

  describe('error resilience', () => {
    it('should handle complete service worker failure gracefully', async () => {
      // Simulate complete service worker failure
      mockServiceWorker.register.mockRejectedValue(new Error('Service worker not supported'));

      setup = await initializeMetamonServiceWorker();

      expect(setup.isServiceWorkerSupported).toBe(false);

      // Should still be able to load frameworks via fallback
      const mockScript = {
        src: '',
        async: false,
        onload: null as any,
        onerror: null as any,
        setAttribute: vi.fn(),
        textContent: ''
      };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Fallback framework");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      await expect(setup.loadFramework('reactjs')).resolves.not.toThrow();
    });

    it('should handle mixed success/failure scenarios', async () => {
      const mockRegistration = {
        active: { postMessage: vi.fn() },
        installing: null,
        waiting: null,
        addEventListener: vi.fn()
      };
      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      setup = await initializeMetamonServiceWorker();

      // Mock service worker success for first framework
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              payload: { 
                framework: {
                  name: 'reactjs',
                  version: '18.0.0',
                  bundle: new ArrayBuffer(1024),
                  dependencies: [],
                  size: 1024,
                  timestamp: Date.now(),
                  checksum: 'abc123'
                }
              } 
            }
          });
        }
      }, 0);

      // First framework should succeed via service worker
      await setup.loadFramework('reactjs');

      // Mock service worker failure for second framework
      setTimeout(() => {
        if (mockMessageChannel.port1.onmessage) {
          mockMessageChannel.port1.onmessage({
            data: { 
              id: expect.any(String), 
              error: 'Framework not found' 
            }
          });
        }
      }, 0);

      // Setup fallback for second framework
      const mockScript = {
        src: '',
        async: false,
        onload: null as any,
        onerror: null as any,
        setAttribute: vi.fn(),
        textContent: ''
      };
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Vue fallback");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      // Second framework should succeed via fallback
      await expect(setup.loadFramework('vue')).resolves.not.toThrow();
    });
  });
});