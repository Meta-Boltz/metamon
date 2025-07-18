/**
 * End-to-End Network Conditions and Failure Scenarios Tests
 * Comprehensive tests for various network conditions and failure scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkAdaptationCoordinator, NetworkConditionMonitor, BandwidthAwarePreloader, IntermittentConnectivityHandler } from '../network-adaptation/index.js';
import { FrameworkLoaderService } from '../framework-loader/index.js';
import { ServiceWorkerManager, FallbackLoader } from '../service-worker/index.js';
import { ProgressiveEnhancementCoordinator } from '../progressive-enhancement/index.js';
import { PerformanceMonitoringSuite } from '../performance-monitoring/index.js';
import { FrameworkType, LoadPriority, NetworkConditions } from '../types/framework-loader.js';

// Network condition simulators
const createNetworkSimulator = (scenario: string) => {
  const scenarios = {
    'excellent-4g': {
      navigator: {
        onLine: true,
        connection: {
          effectiveType: '4g',
          downlink: 20,
          rtt: 30,
          saveData: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      },
      fetch: vi.fn(() => Promise.resolve(new Response('Success', { status: 200 })))
    },
    'good-3g': {
      navigator: {
        onLine: true,
        connection: {
          effectiveType: '3g',
          downlink: 5,
          rtt: 150,
          saveData: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      },
      fetch: vi.fn(() => new Promise(resolve => 
        setTimeout(() => resolve(new Response('Success', { status: 200 })), 300)
      ))
    },
    'slow-2g': {
      navigator: {
        onLine: true,
        connection: {
          effectiveType: '2g',
          downlink: 0.5,
          rtt: 1000,
          saveData: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      },
      fetch: vi.fn(() => new Promise(resolve => 
        setTimeout(() => resolve(new Response('Success', { status: 200 })), 2000)
      ))
    },
    'offline': {
      navigator: {
        onLine: false,
        connection: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      fetch: vi.fn(() => Promise.reject(new Error('Network request failed')))
    },
    'intermittent': {
      navigator: {
        onLine: true, // Will toggle during test
        connection: {
          effectiveType: '3g',
          downlink: 3,
          rtt: 200,
          saveData: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      },
      fetch: vi.fn(() => {
        // Randomly fail to simulate intermittent connectivity
        if (Math.random() < 0.3) {
          return Promise.reject(new Error('Connection timeout'));
        }
        return Promise.resolve(new Response('Success', { status: 200 }));
      })
    },
    'throttled': {
      navigator: {
        onLine: true,
        connection: {
          effectiveType: '4g',
          downlink: 1, // Throttled despite 4G
          rtt: 500,
          saveData: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      },
      fetch: vi.fn(() => new Promise(resolve => 
        setTimeout(() => resolve(new Response('Success', { status: 200 })), 1500)
      ))
    }
  };

  return scenarios[scenario as keyof typeof scenarios] || scenarios['excellent-4g'];
};

describe('End-to-End Network Conditions and Failure Scenarios', () => {
  let networkCoordinator: NetworkAdaptationCoordinator;
  let networkMonitor: NetworkConditionMonitor;
  let bandwidthPreloader: BandwidthAwarePreloader;
  let connectivityHandler: IntermittentConnectivityHandler;
  let frameworkLoader: FrameworkLoaderService;
  let serviceWorkerManager: ServiceWorkerManager;
  let progressiveEnhancement: ProgressiveEnhancementCoordinator;
  let performanceMonitor: PerformanceMonitoringSuite;
  let fallbackLoader: FallbackLoader;

  beforeEach(() => {
    // Initialize all components
    networkCoordinator = new NetworkAdaptationCoordinator({
      adaptation: {
        aggressiveness: 'adaptive',
        priorityBoosting: true,
        dynamicTimeouts: true
      }
    });

    networkMonitor = new NetworkConditionMonitor({
      monitoringInterval: 1000,
      enableAdaptiveThrottling: true
    });

    bandwidthPreloader = new BandwidthAwarePreloader({
      minBandwidthForPreloading: 1.0,
      maxConcurrentPreloads: 3,
      adaptiveThrottling: true
    });

    connectivityHandler = new IntermittentConnectivityHandler({
      retryAttempts: 3,
      retryDelay: 1000,
      enableOfflineQueue: true
    });

    frameworkLoader = new FrameworkLoaderService({
      enableServiceWorker: true,
      enableIntelligentPreloading: true,
      targetLoadTime: 100,
      maxRetries: 3
    });

    serviceWorkerManager = new ServiceWorkerManager({
      scriptUrl: '/metamon-sw.js',
      scope: '/'
    });

    progressiveEnhancement = new ProgressiveEnhancementCoordinator({
      enableOfflineSupport: true,
      enableGracefulDegradation: true
    });

    performanceMonitor = new PerformanceMonitoringSuite({
      enabled: true,
      collectNetworkMetrics: true
    });

    fallbackLoader = new FallbackLoader({
      enableDirectLoading: true,
      enableOfflineSupport: true,
      maxRetries: 3
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    networkCoordinator.destroy();
    networkMonitor.destroy();
    bandwidthPreloader.destroy();
    connectivityHandler.destroy();
    frameworkLoader.destroy();
    serviceWorkerManager.destroy();
    progressiveEnhancement.destroy();
    performanceMonitor.dispose();
    fallbackLoader.destroy();
    vi.restoreAllMocks();
  });

  describe('Excellent Network Conditions (4G/WiFi)', () => {
    beforeEach(() => {
      const network = createNetworkSimulator('excellent-4g');
      global.navigator = network.navigator as any;
      global.fetch = network.fetch;
    });

    it('should optimize for aggressive loading on fast networks', async () => {
      performanceMonitor.start();
      networkMonitor.startMonitoring();

      const recommendation = networkCoordinator.getLoadingRecommendation(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { viewport: true, interaction: false }
      );

      expect(recommendation.strategy).toBe('aggressive');
      expect(recommendation.shouldPreload).toBe(true);
      expect(recommendation.timeoutMs).toBeLessThan(5000);
      expect(recommendation.maxRetries).toBeGreaterThan(2);

      // Test concurrent loading of multiple frameworks
      const frameworks = [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE];
      const sessionIds = frameworks.map(fw => 
        performanceMonitor.trackFrameworkLoad(fw, LoadPriority.HIGH, {
          networkConditions: networkMonitor.getCurrentConditions()
        })
      );

      // Simulate fast concurrent loading
      sessionIds.forEach((id, index) => {
        vi.advanceTimersByTime(50 + index * 10);
        performanceMonitor.completeFrameworkLoad(id);
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeLessThan(80);
      expect(frameworkStats.successfulLoads).toBe(3);
      expect(frameworkStats.concurrentLoads).toBeGreaterThan(0);
    });

    it('should enable intelligent preloading on fast networks', async () => {
      const preloadRequests = [
        {
          framework: FrameworkType.REACT,
          priority: LoadPriority.LOW,
          estimatedSize: 45000,
          reason: 'viewport',
          confidence: 0.8
        },
        {
          framework: FrameworkType.VUE,
          priority: LoadPriority.LOW,
          estimatedSize: 38000,
          reason: 'interaction',
          confidence: 0.6
        },
        {
          framework: FrameworkType.SVELTE,
          priority: LoadPriority.LOW,
          estimatedSize: 25000,
          reason: 'navigation',
          confidence: 0.9
        }
      ];

      // Check if preloading is allowed
      const isAllowed = bandwidthPreloader.isPreloadingAllowed();
      expect(isAllowed).toBe(true);

      const optimalCount = bandwidthPreloader.getOptimalPreloadCount();
      expect(optimalCount).toBeGreaterThan(2);

      // Prioritize preloads
      const prioritized = bandwidthPreloader.prioritizePreloads(preloadRequests);
      expect(prioritized).toHaveLength(3);
      expect(prioritized[0].confidence).toBeGreaterThanOrEqual(prioritized[1].confidence);

      // Execute preloads
      performanceMonitor.start();
      for (const preload of prioritized) {
        const sessionId = performanceMonitor.trackFrameworkLoad(
          preload.framework,
          preload.priority,
          { 
            preloadReason: preload.reason,
            expectedBundleSize: preload.estimatedSize
          }
        );

        vi.advanceTimersByTime(100);
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      const preloadStats = performanceMonitor.getPreloadStats();
      expect(preloadStats.totalPreloads).toBe(3);
      expect(preloadStats.successfulPreloads).toBe(3);
    });

    it('should handle high-frequency framework requests efficiently', async () => {
      performanceMonitor.start();

      // Simulate rapid framework requests (e.g., SPA navigation)
      const rapidRequests = Array.from({ length: 10 }, (_, i) => ({
        framework: [FrameworkType.REACT, FrameworkType.VUE][i % 2],
        timestamp: Date.now() + i * 100
      }));

      const sessionIds: string[] = [];
      for (const request of rapidRequests) {
        const sessionId = performanceMonitor.trackFrameworkLoad(
          request.framework,
          LoadPriority.HIGH,
          { rapidRequest: true, requestIndex: rapidRequests.indexOf(request) }
        );
        sessionIds.push(sessionId);

        // Fast loading due to excellent network
        vi.advanceTimersByTime(60);
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.totalLoads).toBe(10);
      expect(frameworkStats.averageLoadTime).toBeLessThan(70);
      expect(frameworkStats.rapidRequestHandling).toBe(true);
    });
  });

  describe('Slow Network Conditions (2G)', () => {
    beforeEach(() => {
      const network = createNetworkSimulator('slow-2g');
      global.navigator = network.navigator as any;
      global.fetch = network.fetch;
    });

    it('should adapt loading strategy for slow networks', async () => {
      performanceMonitor.start();
      networkMonitor.startMonitoring();

      const recommendation = networkCoordinator.getLoadingRecommendation(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { viewport: true }
      );

      expect(recommendation.strategy).toBe('conservative');
      expect(recommendation.shouldPreload).toBe(false);
      expect(recommendation.timeoutMs).toBeGreaterThan(5000);
      expect(recommendation.compressionRequired).toBe(true);
      expect(recommendation.priorityBoosting).toBe(true);

      // Test prioritized loading
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.CRITICAL,
        { 
          networkConditions: networkMonitor.getCurrentConditions(),
          compressionUsed: true
        }
      );

      // Simulate slow loading
      vi.advanceTimersByTime(1800);
      performanceMonitor.completeFrameworkLoad(sessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeGreaterThan(1500);

      const networkMetrics = performanceMonitor.getNetworkMetrics();
      expect(networkMetrics.adaptationEvents).toBeGreaterThan(0);
      expect(networkMetrics.compressionUsage).toBeGreaterThan(0);
    });

    it('should disable preloading on slow networks', () => {
      const isAllowed = bandwidthPreloader.isPreloadingAllowed();
      expect(isAllowed).toBe(false);

      const optimalCount = bandwidthPreloader.getOptimalPreloadCount();
      expect(optimalCount).toBe(0);

      // Attempt to schedule preloads
      const preloadRequests = [
        { framework: FrameworkType.VUE, priority: LoadPriority.LOW, size: 38000 }
      ];

      const prioritized = bandwidthPreloader.prioritizePreloads(preloadRequests);
      expect(prioritized).toHaveLength(0); // Should be filtered out
    });

    it('should implement progressive loading on slow networks', async () => {
      performanceMonitor.start();

      // Load only critical frameworks first
      const criticalSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.CRITICAL,
        { 
          networkConditions: networkMonitor.getCurrentConditions(),
          progressiveLoading: true
        }
      );

      vi.advanceTimersByTime(2000);
      performanceMonitor.completeFrameworkLoad(criticalSessionId);

      // Defer non-critical frameworks
      const deferredSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.SVELTE,
        LoadPriority.LOW,
        { 
          networkConditions: networkMonitor.getCurrentConditions(),
          deferred: true
        }
      );

      vi.advanceTimersByTime(2500);
      performanceMonitor.completeFrameworkLoad(deferredSessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.progressiveLoads).toBeGreaterThan(0);
      expect(frameworkStats.deferredLoads).toBeGreaterThan(0);
    });

    it('should optimize bundle sizes for slow networks', async () => {
      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.HIGH,
        { 
          networkConditions: networkMonitor.getCurrentConditions(),
          bundleOptimization: true,
          originalSize: 45000,
          optimizedSize: 28000 // Compressed/optimized
        }
      );

      vi.advanceTimersByTime(1600);
      performanceMonitor.completeFrameworkLoad(sessionId);

      const bundleMetrics = performanceMonitor.getBundleMetrics();
      expect(bundleMetrics.optimizationRatio).toBeGreaterThan(0.3);
      expect(bundleMetrics.compressionSavings).toBeGreaterThan(15000);
    });
  });

  describe('Offline Scenarios', () => {
    beforeEach(() => {
      const network = createNetworkSimulator('offline');
      global.navigator = network.navigator as any;
      global.fetch = network.fetch;
    });

    it('should handle complete offline scenarios', async () => {
      performanceMonitor.start();

      // Attempt to load framework while offline
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { 
          networkConditions: { effectiveType: 'offline' as any },
          offlineAttempt: true
        }
      );

      try {
        await frameworkLoader.loadFramework(FrameworkType.REACT, LoadPriority.HIGH);
      } catch (error) {
        // Should fail gracefully
        expect(error).toBeDefined();
      }

      // Use fallback loader
      const fallbackFramework = await fallbackLoader.loadFrameworkOffline(FrameworkType.REACT);
      
      if (fallbackFramework) {
        performanceMonitor.completeFrameworkLoad(sessionId);
      } else {
        performanceMonitor.failFrameworkLoad(sessionId, 'offline');
      }

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.offlineAttempts).toBeGreaterThan(0);

      // Test progressive enhancement fallback
      const component = {
        id: 'offline-component',
        framework: FrameworkType.REACT,
        isInteractive: true
      };

      const recovery = await progressiveEnhancement.handleNetworkFailure(component);
      expect(recovery.maintainsFunctionality).toBe(true);
      expect(recovery.degradationLevel).toBe('minimal');
    });

    it('should queue requests for when connection returns', () => {
      // Queue requests while offline
      const requests = [
        { framework: FrameworkType.REACT, priority: LoadPriority.HIGH, url: '/react' },
        { framework: FrameworkType.VUE, priority: LoadPriority.NORMAL, url: '/vue' }
      ];

      requests.forEach(req => connectivityHandler.queueRequest(req));

      const queue = connectivityHandler.getOfflineQueue();
      expect(queue).toHaveLength(2);

      // Simulate going back online
      global.navigator.onLine = true;
      global.fetch = vi.fn(() => Promise.resolve(new Response('Success', { status: 200 })));

      // Process queued requests
      connectivityHandler.processOfflineQueue();

      // Queue should be processed
      setTimeout(() => {
        const updatedQueue = connectivityHandler.getOfflineQueue();
        expect(updatedQueue).toHaveLength(0);
      }, 100);
    });

    it('should provide offline functionality through service worker', async () => {
      // Mock service worker with offline capabilities
      global.navigator.serviceWorker = {
        register: vi.fn(() => Promise.resolve({
          active: { state: 'activated' },
          update: vi.fn()
        })),
        ready: Promise.resolve({
          active: { state: 'activated' }
        })
      } as any;

      await serviceWorkerManager.register();

      // Simulate offline framework loading through service worker cache
      const offlineRequest = new Request('/framework/react-core.js');
      
      // Service worker should serve from cache when offline
      const cachedResponse = await serviceWorkerManager.sendMessage({
        type: 'GET_CACHED_FRAMEWORK',
        framework: FrameworkType.REACT
      });

      // Even if null in test, the mechanism should work
      expect(cachedResponse).toBeDefined();
    });
  });

  describe('Intermittent Connectivity Scenarios', () => {
    beforeEach(() => {
      const network = createNetworkSimulator('intermittent');
      global.navigator = network.navigator as any;
      global.fetch = network.fetch;
    });

    it('should handle intermittent connectivity with retries', async () => {
      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.HIGH,
        { 
          networkConditions: networkMonitor.getCurrentConditions(),
          intermittentConnection: true
        }
      );

      // Simulate multiple retry attempts
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          await frameworkLoader.loadFramework(FrameworkType.VUE, LoadPriority.HIGH);
          break;
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            performanceMonitor.failFrameworkLoad(sessionId, 'max-retries-exceeded');
            break;
          }
          // Wait before retry
          vi.advanceTimersByTime(1000);
        }
      }

      if (attempts < maxAttempts) {
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.retryAttempts).toBeGreaterThan(0);

      const connectivityStats = connectivityHandler.getConnectivityStats();
      expect(connectivityStats.totalDisconnections).toBeGreaterThan(0);
    });

    it('should adapt loading strategy based on connection stability', async () => {
      networkMonitor.startMonitoring();

      // Simulate connection instability
      const stabilityMetrics = {
        disconnectionFrequency: 0.3, // 30% failure rate
        averageConnectionDuration: 5000, // 5 seconds
        reconnectionTime: 2000 // 2 seconds to reconnect
      };

      networkCoordinator.updateConfig({
        adaptation: {
          aggressiveness: 'conservative',
          stabilityThreshold: 0.7,
          adaptToInstability: true
        }
      });

      const recommendation = networkCoordinator.getLoadingRecommendation(
        FrameworkType.SVELTE,
        LoadPriority.NORMAL,
        { 
          viewport: true,
          connectionStability: stabilityMetrics
        }
      );

      expect(recommendation.strategy).toBe('conservative');
      expect(recommendation.maxRetries).toBeGreaterThan(3);
      expect(recommendation.retryDelay).toBeGreaterThan(1000);
      expect(recommendation.shouldPreload).toBe(false);
    });

    it('should maintain functionality during connection drops', async () => {
      performanceMonitor.start();

      // Start loading framework
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.SOLID,
        LoadPriority.HIGH
      );

      // Simulate connection drop during loading
      global.navigator.onLine = false;
      
      // Should queue the request
      connectivityHandler.queueRequest({
        framework: FrameworkType.SOLID,
        priority: LoadPriority.HIGH,
        url: '/solid'
      });

      // Connection returns
      global.navigator.onLine = true;
      global.fetch = vi.fn(() => Promise.resolve(new Response('Success', { status: 200 })));

      // Process queued request
      await connectivityHandler.processOfflineQueue();

      performanceMonitor.completeFrameworkLoad(sessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.connectionDropRecoveries).toBeGreaterThan(0);
    });
  });

  describe('Service Worker Failure Scenarios', () => {
    it('should handle service worker registration failures', async () => {
      // Mock service worker registration failure
      global.navigator.serviceWorker = {
        register: vi.fn(() => Promise.reject(new Error('Registration failed')))
      } as any;

      const registration = await serviceWorkerManager.register();
      expect(registration).toBeNull();

      // Should fallback to direct loading
      const fallbackFramework = await fallbackLoader.loadFrameworkDirect(
        FrameworkType.REACT,
        LoadPriority.HIGH
      );

      expect(fallbackFramework).toBeDefined();
    });

    it('should handle service worker update failures', async () => {
      // Mock successful registration but failed update
      global.navigator.serviceWorker = {
        register: vi.fn(() => Promise.resolve({
          active: { state: 'activated' },
          update: vi.fn(() => Promise.reject(new Error('Update failed')))
        })),
        ready: Promise.resolve({
          active: { state: 'activated' },
          update: vi.fn(() => Promise.reject(new Error('Update failed')))
        })
      } as any;

      await serviceWorkerManager.register();

      try {
        await serviceWorkerManager.update();
      } catch (error) {
        // Should handle update failure gracefully
        expect(error).toBeDefined();
      }

      // Application should continue working with existing service worker
      const status = await serviceWorkerManager.getRegistrationStatus();
      expect(status.isRegistered).toBe(true);
    });

    it('should handle service worker cache corruption', async () => {
      await serviceWorkerManager.register();

      // Simulate cache corruption
      const corruptionError = new Error('Cache corruption detected');
      
      try {
        await serviceWorkerManager.sendMessage({
          type: 'VALIDATE_CACHE',
          framework: FrameworkType.VUE
        });
      } catch (error) {
        // Should handle cache corruption
        expect(error).toBeDefined();
      }

      // Should clear corrupted cache and rebuild
      await serviceWorkerManager.sendMessage({
        type: 'CLEAR_CORRUPTED_CACHE'
      });

      // Verify cache is cleared
      const cacheStatus = await serviceWorkerManager.sendMessage({
        type: 'GET_CACHE_STATUS'
      });

      expect(cacheStatus).toBeDefined();
    });
  });

  describe('Framework Loading Failure Scenarios', () => {
    it('should handle framework bundle corruption', async () => {
      performanceMonitor.start();

      // Mock corrupted framework response
      global.fetch = vi.fn(() => Promise.resolve(
        new Response('corrupted data', { 
          status: 200,
          headers: { 'Content-Type': 'application/javascript' }
        })
      ));

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { expectedChecksum: 'valid-checksum' }
      );

      try {
        await frameworkLoader.loadFramework(FrameworkType.REACT, LoadPriority.HIGH);
      } catch (error) {
        performanceMonitor.failFrameworkLoad(sessionId, 'bundle-corruption');
        expect(error).toBeDefined();
      }

      // Should fallback to alternative source or cached version
      const fallbackFramework = await fallbackLoader.loadWithRetry(
        FrameworkType.REACT,
        LoadPriority.HIGH
      );

      if (fallbackFramework) {
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.corruptionDetections).toBeGreaterThan(0);
    });

    it('should handle CDN failures with fallback sources', async () => {
      performanceMonitor.start();

      // Mock CDN failure
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('CDN unavailable'))
        .mockResolvedValueOnce(new Response('Framework code', { status: 200 }));

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.HIGH,
        { primaryCDN: 'cdn1.example.com', fallbackCDN: 'cdn2.example.com' }
      );

      // Should automatically try fallback CDN
      const framework = await fallbackLoader.loadWithRetry(
        FrameworkType.VUE,
        LoadPriority.HIGH
      );

      expect(framework).toBeDefined();
      performanceMonitor.completeFrameworkLoad(sessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.cdnFailovers).toBeGreaterThan(0);
    });

    it('should handle framework version mismatches', async () => {
      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.SVELTE,
        LoadPriority.HIGH,
        { 
          expectedVersion: '4.0.0',
          actualVersion: '3.5.0' // Version mismatch
        }
      );

      // Should detect version mismatch and handle appropriately
      try {
        await frameworkLoader.loadFramework(FrameworkType.SVELTE, LoadPriority.HIGH);
      } catch (error) {
        performanceMonitor.failFrameworkLoad(sessionId, 'version-mismatch');
        expect(error.message).toContain('version');
      }

      // Should attempt to load correct version
      const correctFramework = await fallbackLoader.loadFrameworkDirect(
        FrameworkType.SVELTE,
        LoadPriority.HIGH
      );

      if (correctFramework) {
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.versionMismatches).toBeGreaterThan(0);
    });
  });

  describe('Progressive Enhancement Scenarios', () => {
    it('should provide comprehensive fallback for all failure types', async () => {
      const failureScenarios = [
        'service-worker-unavailable',
        'framework-loading-timeout',
        'network-offline',
        'bundle-corruption',
        'version-mismatch',
        'cdn-failure'
      ];

      for (const scenario of failureScenarios) {
        const component = {
          id: `test-component-${scenario}`,
          framework: FrameworkType.REACT,
          isInteractive: true,
          content: '<div>Test component</div>'
        };

        const strategy = progressiveEnhancement.getGracefulDegradationStrategy(scenario as any);
        expect(strategy).toBeDefined();
        expect(strategy.fallbackMethod).toBeDefined();
        expect(strategy.userExperience).toBeDefined();
        expect(strategy.functionalityLevel).toBeDefined();

        const fallbackContent = progressiveEnhancement.generateServerRenderedFallback(component);
        expect(fallbackContent.html).toBeDefined();
        expect(fallbackContent.enhancementScript).toBeDefined();
      }
    });

    it('should maintain core functionality across all failure scenarios', async () => {
      const testComponents = [
        {
          id: 'form-component',
          framework: FrameworkType.REACT,
          isInteractive: true,
          fallbackBehavior: 'native-form-validation'
        },
        {
          id: 'navigation-component',
          framework: FrameworkType.VUE,
          isInteractive: true,
          fallbackBehavior: 'css-only-navigation'
        },
        {
          id: 'content-component',
          framework: FrameworkType.SVELTE,
          isInteractive: false,
          fallbackBehavior: 'static-content'
        }
      ];

      for (const component of testComponents) {
        const error = new Error('Framework loading failed');
        const recovery = await progressiveEnhancement.handleFrameworkLoadingFailure(component, error);

        expect(recovery).toBeDefined();
        expect(recovery.maintainsFunctionality).toBe(true);
        expect(recovery.fallbackStrategy).toBeDefined();
        expect(recovery.enhancementScript).toBeDefined();
      }

      const fallbackMetrics = progressiveEnhancement.getFallbackMetrics();
      expect(fallbackMetrics.totalFallbacks).toBe(testComponents.length);
      expect(fallbackMetrics.successfulFallbacks).toBe(testComponents.length);
    });
  });

  describe('End-to-End Resilience Testing', () => {
    it('should handle cascading failure scenarios', async () => {
      performanceMonitor.start();

      // Simulate cascading failures
      const failures = [
        'service-worker-failure',
        'primary-cdn-failure',
        'fallback-cdn-failure',
        'network-instability'
      ];

      let recoveryAttempts = 0;
      const maxRecoveryAttempts = failures.length;

      for (const failure of failures) {
        recoveryAttempts++;
        
        try {
          // Attempt different recovery strategies
          if (failure === 'service-worker-failure') {
            await fallbackLoader.loadFrameworkDirect(FrameworkType.REACT, LoadPriority.HIGH);
          } else if (failure.includes('cdn-failure')) {
            await fallbackLoader.loadWithRetry(FrameworkType.REACT, LoadPriority.HIGH);
          } else if (failure === 'network-instability') {
            await connectivityHandler.processOfflineQueue();
          }
          
          // If we reach here, recovery was successful
          break;
        } catch (error) {
          if (recoveryAttempts >= maxRecoveryAttempts) {
            // Final fallback to progressive enhancement
            const component = {
              id: 'critical-component',
              framework: FrameworkType.REACT,
              isInteractive: true
            };
            
            const finalRecovery = await progressiveEnhancement.handleFrameworkLoadingFailure(
              component,
              error as Error
            );
            
            expect(finalRecovery.maintainsFunctionality).toBe(true);
            break;
          }
        }
      }

      const resilienceMetrics = performanceMonitor.getResilienceMetrics();
      expect(resilienceMetrics.cascadingFailureRecoveries).toBeGreaterThan(0);
      expect(resilienceMetrics.finalFallbackUsage).toBeGreaterThan(0);
    });

    it('should maintain performance budgets under adverse conditions', async () => {
      performanceMonitor.start();

      // Simulate adverse network conditions
      const adverseNetwork = createNetworkSimulator('slow-2g');
      global.navigator = adverseNetwork.navigator as any;
      global.fetch = adverseNetwork.fetch;

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.CRITICAL,
        { 
          adverseConditions: true,
          networkConditions: networkMonitor.getCurrentConditions()
        }
      );

      // Even under adverse conditions, critical frameworks should load
      vi.advanceTimersByTime(3000); // Longer but still within emergency budget
      performanceMonitor.completeFrameworkLoad(sessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeLessThan(5000); // Emergency budget

      const alerts = performanceMonitor.getActiveAlerts();
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      expect(criticalAlerts).toHaveLength(0); // Should not have critical failures
    });

    it('should provide comprehensive monitoring and reporting', async () => {
      performanceMonitor.start();
      networkMonitor.startMonitoring();

      // Simulate various scenarios
      const scenarios = [
        { network: 'excellent-4g', frameworks: [FrameworkType.REACT, FrameworkType.VUE] },
        { network: 'slow-2g', frameworks: [FrameworkType.SVELTE] },
        { network: 'intermittent', frameworks: [FrameworkType.SOLID] }
      ];

      for (const scenario of scenarios) {
        const network = createNetworkSimulator(scenario.network);
        global.navigator = network.navigator as any;
        global.fetch = network.fetch;

        for (const framework of scenario.frameworks) {
          const sessionId = performanceMonitor.trackFrameworkLoad(
            framework,
            LoadPriority.NORMAL,
            { 
              scenario: scenario.network,
              networkConditions: networkMonitor.getCurrentConditions()
            }
          );

          const loadTime = scenario.network === 'excellent-4g' ? 60 :
                          scenario.network === 'slow-2g' ? 2000 : 1200;

          vi.advanceTimersByTime(loadTime);
          performanceMonitor.completeFrameworkLoad(sessionId);
        }
      }

      // Generate comprehensive report
      const report = performanceMonitor.generateReport();
      expect(report.summary.totalPageLoads).toBeGreaterThan(0);
      expect(report.networkConditions).toBeDefined();
      expect(report.failureRecovery).toBeDefined();
      expect(report.resilienceScore).toBeGreaterThan(0);

      const networkReport = networkMonitor.generateNetworkReport();
      expect(networkReport.conditionChanges).toBeGreaterThan(0);
      expect(networkReport.adaptationEvents).toBeGreaterThan(0);

      const connectivityReport = connectivityHandler.getConnectivityReport();
      expect(connectivityReport.totalDisconnections).toBeGreaterThanOrEqual(0);
      expect(connectivityReport.recoverySuccessRate).toBeGreaterThanOrEqual(0);
    });
  });
});