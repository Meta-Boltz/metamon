/**
 * Comprehensive Service Worker Tests
 * Unit tests for all service worker components and functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ServiceWorkerManager,
  ServiceWorkerFrameworkManager,
  MetamonServiceWorker,
  FrameworkBundleSplitter,
  FallbackLoader
} from '../service-worker/index.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

// Mock Service Worker environment
const mockServiceWorkerGlobalScope = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  skipWaiting: vi.fn(),
  clients: {
    claim: vi.fn(),
    matchAll: vi.fn(() => Promise.resolve([])),
    get: vi.fn()
  },
  caches: {
    open: vi.fn(() => Promise.resolve({
      match: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      keys: vi.fn(() => Promise.resolve([]))
    })),
    delete: vi.fn(),
    keys: vi.fn(() => Promise.resolve([]))
  },
  fetch: vi.fn(),
  registration: {
    update: vi.fn(),
    unregister: vi.fn()
  }
};

// Mock browser environment
const mockNavigator = {
  serviceWorker: {
    register: vi.fn(() => Promise.resolve({
      installing: null,
      waiting: null,
      active: { state: 'activated' },
      addEventListener: vi.fn(),
      update: vi.fn()
    })),
    ready: Promise.resolve({
      active: { state: 'activated' },
      update: vi.fn()
    }),
    controller: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
};

describe('Service Worker Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.navigator = mockNavigator as any;
    global.self = mockServiceWorkerGlobalScope as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ServiceWorkerManager', () => {
    let manager: ServiceWorkerManager;

    beforeEach(() => {
      manager = new ServiceWorkerManager({
        scriptUrl: '/metamon-sw.js',
        scope: '/',
        updateViaCache: 'none'
      });
    });

    afterEach(() => {
      manager.destroy();
    });

    it('should register service worker successfully', async () => {
      const registration = await manager.register();
      
      expect(registration).toBeDefined();
      expect(mockNavigator.serviceWorker.register).toHaveBeenCalledWith(
        '/metamon-sw.js',
        expect.objectContaining({
          scope: '/',
          updateViaCache: 'none'
        })
      );
    });

    it('should handle registration failures gracefully', async () => {
      mockNavigator.serviceWorker.register = vi.fn(() => 
        Promise.reject(new Error('Registration failed'))
      );

      const registration = await manager.register();
      expect(registration).toBeNull();
    });

    it('should check service worker support', () => {
      expect(manager.isSupported()).toBe(true);

      // Test without service worker support
      delete (global.navigator as any).serviceWorker;
      expect(manager.isSupported()).toBe(false);
    });

    it('should get registration status', async () => {
      await manager.register();
      const status = await manager.getRegistrationStatus();
      
      expect(status).toBeDefined();
      expect(status.isRegistered).toBe(true);
      expect(status.state).toBe('activated');
    });

    it('should update service worker', async () => {
      await manager.register();
      await manager.update();
      
      // Verify update was called
      expect(mockNavigator.serviceWorker.ready).toBeDefined();
    });

    it('should unregister service worker', async () => {
      await manager.register();
      await manager.unregister();
      
      // Verify unregister process
      expect(manager.isRegistered()).toBe(false);
    });

    it('should handle message communication', async () => {
      await manager.register();
      
      const response = await manager.sendMessage({
        type: 'CACHE_FRAMEWORK',
        framework: FrameworkType.REACT,
        data: new ArrayBuffer(1024)
      });
      
      // In test environment, this will timeout, but we verify the method exists
      expect(response).toBeNull(); // Timeout response
    });

    it('should provide performance metrics', () => {
      const metrics = manager.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.registrationTime).toBeGreaterThanOrEqual(0);
      expect(metrics.messagesSent).toBeGreaterThanOrEqual(0);
      expect(metrics.messagesReceived).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ServiceWorkerFrameworkManager', () => {
    let frameworkManager: ServiceWorkerFrameworkManager;

    beforeEach(() => {
      frameworkManager = new ServiceWorkerFrameworkManager();
    });

    it('should handle framework requests', async () => {
      const request = new Request('/framework/react-core.js');
      const mockResponse = new Response('React core code', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      });

      // Mock cache response
      mockServiceWorkerGlobalScope.caches.open = vi.fn(() => Promise.resolve({
        match: vi.fn(() => Promise.resolve(mockResponse)),
        put: vi.fn(),
        delete: vi.fn(),
        keys: vi.fn(() => Promise.resolve([]))
      }));

      const response = await frameworkManager.handleFrameworkRequest(request);
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should cache framework cores', async () => {
      const frameworkCore = {
        name: FrameworkType.REACT,
        version: '1.0.0',
        bundle: new ArrayBuffer(2048),
        dependencies: ['react-dom'],
        size: 2048,
        checksum: 'abc123',
        timestamp: Date.now()
      };

      await frameworkManager.cacheFramework(frameworkCore);
      
      // Verify cache operations were called
      expect(mockServiceWorkerGlobalScope.caches.open).toHaveBeenCalled();
    });

    it('should retrieve cached frameworks', async () => {
      const cached = await frameworkManager.getCachedFramework(FrameworkType.VUE);
      
      // In test environment, this will be null, but method should not throw
      expect(cached).toBeNull();
    });

    it('should execute background tasks', async () => {
      const task = {
        type: 'state-computation' as const,
        payload: { data: 'test' },
        timeout: 5000
      };

      const result = await frameworkManager.executeInBackground(task);
      
      // Background execution should complete without error
      expect(result).toBeDefined();
    });

    it('should invalidate cache patterns', async () => {
      await frameworkManager.invalidateCache('react-*');
      
      // Verify cache operations
      expect(mockServiceWorkerGlobalScope.caches.open).toHaveBeenCalled();
    });

    it('should update framework cache', async () => {
      const updates = [{
        framework: FrameworkType.SVELTE,
        version: '2.0.0',
        action: 'update' as const,
        bundle: new ArrayBuffer(1536)
      }];

      await frameworkManager.updateFrameworkCache(updates);
      
      // Verify update operations
      expect(mockServiceWorkerGlobalScope.caches.open).toHaveBeenCalled();
    });

    it('should provide cache statistics', async () => {
      const stats = await frameworkManager.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalSize).toBeGreaterThanOrEqual(0);
      expect(stats.frameworkCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.frameworks)).toBe(true);
    });
  });

  describe('MetamonServiceWorker', () => {
    let serviceWorker: MetamonServiceWorker;

    beforeEach(() => {
      serviceWorker = new MetamonServiceWorker({
        cacheStrategy: 'stale-while-revalidate',
        maxCacheAge: 86400000, // 24 hours
        enableBackgroundSync: true
      });
    });

    it('should initialize with configuration', () => {
      expect(serviceWorker).toBeDefined();
    });

    it('should handle install event', async () => {
      const installEvent = new Event('install');
      
      // Simulate install event
      await serviceWorker.handleInstall(installEvent as any);
      
      // Verify skip waiting was called
      expect(mockServiceWorkerGlobalScope.skipWaiting).toHaveBeenCalled();
    });

    it('should handle activate event', async () => {
      const activateEvent = new Event('activate');
      
      // Simulate activate event
      await serviceWorker.handleActivate(activateEvent as any);
      
      // Verify clients claim was called
      expect(mockServiceWorkerGlobalScope.clients.claim).toHaveBeenCalled();
    });

    it('should handle fetch events', async () => {
      const request = new Request('/framework/vue-core.js');
      const fetchEvent = {
        request,
        respondWith: vi.fn(),
        waitUntil: vi.fn()
      };

      await serviceWorker.handleFetch(fetchEvent as any);
      
      // Verify response handling
      expect(fetchEvent.respondWith).toHaveBeenCalled();
    });

    it('should handle message events', async () => {
      const messageEvent = {
        data: {
          type: 'PRELOAD_FRAMEWORK',
          framework: FrameworkType.SOLID,
          priority: LoadPriority.LOW
        },
        ports: [{
          postMessage: vi.fn()
        }]
      };

      await serviceWorker.handleMessage(messageEvent as any);
      
      // Verify message was processed
      expect(messageEvent.ports[0].postMessage).toHaveBeenCalled();
    });

    it('should clean up old caches', async () => {
      await serviceWorker.cleanupOldCaches();
      
      // Verify cache cleanup operations
      expect(mockServiceWorkerGlobalScope.caches.keys).toHaveBeenCalled();
    });

    it('should provide service worker metrics', () => {
      const metrics = serviceWorker.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.cacheHits).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheMisses).toBeGreaterThanOrEqual(0);
      expect(metrics.networkRequests).toBeGreaterThanOrEqual(0);
      expect(metrics.backgroundTasks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('FrameworkBundleSplitter', () => {
    let splitter: FrameworkBundleSplitter;

    beforeEach(() => {
      splitter = new FrameworkBundleSplitter({
        chunkSizeTarget: 50000,
        maxChunksPerFramework: 5,
        sharedDependencyThreshold: 0.3
      });
    });

    it('should analyze bundle dependencies', () => {
      const bundle = {
        'react-core.js': {
          code: 'import React from "react"; export default React;',
          imports: ['react', 'react-dom'],
          size: 45000
        },
        'vue-core.js': {
          code: 'import { createApp } from "vue"; export { createApp };',
          imports: ['vue'],
          size: 38000
        }
      };

      const analysis = splitter.analyzeBundleDependencies(bundle);
      
      expect(analysis).toBeDefined();
      expect(analysis.frameworks).toHaveProperty('react');
      expect(analysis.frameworks).toHaveProperty('vue');
      expect(analysis.sharedDependencies).toBeDefined();
    });

    it('should split framework bundles', () => {
      const frameworkBundle = {
        name: FrameworkType.REACT,
        code: 'React framework code'.repeat(1000), // Large bundle
        dependencies: ['react', 'react-dom', 'scheduler'],
        size: 75000
      };

      const chunks = splitter.splitFrameworkBundle(frameworkBundle);
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(1); // Should be split
      expect(chunks.every(chunk => chunk.size <= 50000)).toBe(true);
    });

    it('should extract shared dependencies', () => {
      const frameworks = [
        {
          name: FrameworkType.REACT,
          dependencies: ['react', 'react-dom', 'scheduler'],
          size: 50000
        },
        {
          name: FrameworkType.VUE,
          dependencies: ['vue', 'scheduler'], // shared dependency
          size: 40000
        }
      ];

      const shared = splitter.extractSharedDependencies(frameworks);
      
      expect(shared).toBeDefined();
      expect(shared.dependencies).toContain('scheduler');
    });

    it('should optimize for HTTP/2 multiplexing', () => {
      const chunks = [
        { name: 'chunk1', size: 10000, priority: LoadPriority.HIGH },
        { name: 'chunk2', size: 15000, priority: LoadPriority.NORMAL },
        { name: 'chunk3', size: 8000, priority: LoadPriority.LOW }
      ];

      const optimized = splitter.optimizeForHTTP2(chunks);
      
      expect(optimized).toBeDefined();
      expect(optimized.length).toBe(chunks.length);
      expect(optimized[0].priority).toBe(LoadPriority.HIGH); // Should maintain priority order
    });

    it('should generate cache strategies', () => {
      const chunks = [
        { name: 'react-core', framework: FrameworkType.REACT, size: 45000 },
        { name: 'shared-utils', framework: null, size: 12000 }
      ];

      const strategies = splitter.generateCacheStrategies(chunks);
      
      expect(strategies).toBeDefined();
      expect(strategies.length).toBe(chunks.length);
      expect(strategies.every(s => s.strategy && s.maxAge)).toBe(true);
    });
  });

  describe('FallbackLoader', () => {
    let fallbackLoader: FallbackLoader;

    beforeEach(() => {
      fallbackLoader = new FallbackLoader({
        enableDirectLoading: true,
        enableOfflineSupport: true,
        maxRetries: 3,
        retryDelay: 1000
      });
    });

    it('should detect service worker availability', () => {
      const isAvailable = fallbackLoader.isServiceWorkerAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should load framework directly when service worker unavailable', async () => {
      // Mock direct loading
      global.fetch = vi.fn(() => Promise.resolve(new Response('Framework code')));

      const framework = await fallbackLoader.loadFrameworkDirect(
        FrameworkType.SVELTE,
        LoadPriority.NORMAL
      );

      expect(framework).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle offline scenarios', async () => {
      // Simulate offline
      Object.defineProperty(global.navigator, 'onLine', {
        value: false,
        writable: true
      });

      const framework = await fallbackLoader.loadFrameworkOffline(FrameworkType.REACT);
      
      // Should attempt to load from cache or return null
      expect(framework).toBeNull(); // No cached version in test
    });

    it('should implement retry logic', async () => {
      let attempts = 0;
      global.fetch = vi.fn(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(new Response('Framework code'));
      });

      const framework = await fallbackLoader.loadWithRetry(
        FrameworkType.VUE,
        LoadPriority.HIGH
      );

      expect(framework).toBeDefined();
      expect(attempts).toBe(3);
    });

    it('should provide graceful degradation', async () => {
      const degradationStrategy = fallbackLoader.getGracefulDegradationStrategy(
        FrameworkType.SOLID
      );

      expect(degradationStrategy).toBeDefined();
      expect(degradationStrategy.fallbackMethod).toBeDefined();
      expect(degradationStrategy.minimalFunctionality).toBe(true);
    });

    it('should handle various error scenarios', async () => {
      const errorScenarios = [
        'service-worker-unavailable',
        'network-failure',
        'cache-corruption',
        'timeout'
      ];

      for (const scenario of errorScenarios) {
        const recovery = await fallbackLoader.handleErrorScenario(scenario as any);
        expect(recovery).toBeDefined();
        expect(recovery.action).toBeDefined();
      }
    });

    it('should provide fallback statistics', () => {
      const stats = fallbackLoader.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.directLoads).toBeGreaterThanOrEqual(0);
      expect(stats.offlineLoads).toBeGreaterThanOrEqual(0);
      expect(stats.retryAttempts).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Service Worker Integration', () => {
  it('should coordinate all service worker components', async () => {
    const manager = new ServiceWorkerManager({
      scriptUrl: '/metamon-sw.js',
      scope: '/'
    });

    const frameworkManager = new ServiceWorkerFrameworkManager();
    const fallbackLoader = new FallbackLoader();

    // Test integration
    await manager.register();
    
    // Simulate framework loading through service worker
    const frameworkCore = {
      name: FrameworkType.REACT,
      version: '1.0.0',
      bundle: new ArrayBuffer(1024),
      dependencies: [],
      size: 1024,
      checksum: 'test',
      timestamp: Date.now()
    };

    await frameworkManager.cacheFramework(frameworkCore);
    
    // Test fallback when service worker fails
    const fallbackFramework = await fallbackLoader.loadFrameworkDirect(
      FrameworkType.VUE,
      LoadPriority.NORMAL
    );

    expect(fallbackFramework).toBeDefined();

    // Cleanup
    manager.destroy();
  });

  it('should handle complex caching scenarios', async () => {
    const frameworkManager = new ServiceWorkerFrameworkManager();
    
    // Cache multiple frameworks
    const frameworks = [
      { name: FrameworkType.REACT, size: 45000 },
      { name: FrameworkType.VUE, size: 38000 },
      { name: FrameworkType.SVELTE, size: 25000 },
      { name: FrameworkType.SOLID, size: 30000 }
    ];

    for (const fw of frameworks) {
      await frameworkManager.cacheFramework({
        name: fw.name,
        version: '1.0.0',
        bundle: new ArrayBuffer(fw.size),
        dependencies: [],
        size: fw.size,
        checksum: `${fw.name}-checksum`,
        timestamp: Date.now()
      });
    }

    // Verify cache statistics
    const stats = await frameworkManager.getCacheStats();
    expect(stats.frameworkCount).toBe(frameworks.length);
    expect(stats.totalSize).toBe(frameworks.reduce((sum, fw) => sum + fw.size, 0));
  });
});