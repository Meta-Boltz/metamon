/**
 * End-to-End Network Scenarios Tests
 * Comprehensive tests for various network conditions and failure scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NetworkAdaptationCoordinator,
  NetworkConditionMonitor,
  BandwidthAwarePreloader,
  IntermittentConnectivityHandler
} from '../network-adaptation/index.js';
import { FrameworkLoaderService } from '../framework-loader/index.js';
import { ServiceWorkerManager } from '../service-worker/index.js';
import { PerformanceMonitoringSuite } from '../performance-monitoring/index.js';
import { ProgressiveEnhancementCoordinator } from '../progressive-enhancement/index.js';
import { FrameworkType, LoadPriority, NetworkConditions } from '../types/framework-loader.js';

// Mock network environments
const createNetworkMock = (conditions: Partial<NetworkConditions> & { online?: boolean }) => ({
  navigator: {
    onLine: conditions.online ?? true,
    connection: {
      effectiveType: conditions.effectiveType || '4g',
      downlink: conditions.downlink || 10,
      rtt: conditions.rtt || 100,
      saveData: conditions.saveData || false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  },
  fetch: vi.fn(() => Promise.resolve(new Response('Success', { status: 200 })))
});

// Mock service worker environment
const mockServiceWorker = {
  register: vi.fn(),
  ready: Promise.resolve({
    active: { state: 'activated' },
    update: vi.fn()
  }),
  controller: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

describe('End-to-End Network Scenarios', () => {
  let networkCoordinator: NetworkAdaptationCoordinator;
  let networkMonitor: NetworkConditionMonitor;
  let bandwidthPreloader: BandwidthAwarePreloader;
  let connectivityHandler: IntermittentConnectivityHandler;
  let performanceMonitor: PerformanceMonitoringSuite;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Initialize components with proper configurations
    networkCoordinator = new NetworkAdaptationCoordinator();
    networkMonitor = new NetworkConditionMonitor();
    bandwidthPreloader = new BandwidthAwarePreloader();
    connectivityHandler = new IntermittentConnectivityHandler();
    
    performanceMonitor = new PerformanceMonitoringSuite({
      enabled: true,
      collectNetworkMetrics: true,
      performanceBudget: {
        maxFrameworkLoadTime: 100,
        maxCLS: 0.1,
        maxLCP: 2500,
        maxFID: 100,
        maxCacheSize: 50 * 1024 * 1024,
        maxNetworkRequests: 10
      }
    });

    // Setup global mocks
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      performance: {
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn()
      }
    } as any;

    global.document = {
      createElement: vi.fn(() => ({
        style: {},
        classList: { add: vi.fn(), remove: vi.fn() }
      }))
    } as any;
  });

  afterEach(() => {
    networkCoordinator.destroy();
    networkMonitor.destroy();
    bandwidthPreloader.destroy();
    connectivityHandler.destroy();
    performanceMonitor.dispose();
    vi.restoreAllMocks();
  });

  describe('High-Speed Network (4G/WiFi) Scenarios', () => {
    beforeEach(() => {
      const fastNetwork = createNetworkMock({
        effectiveType: '4g',
        downlink: 15,
        rtt: 50,
        saveData: false,
        online: true
      });
      
      // Use Object.defineProperty to mock navigator
      Object.defineProperty(global, 'navigator', {
        value: fastNetwork.navigator,
        writable: true,
        configurable: true
      });
      global.fetch = fastNetwork.fetch;
    });

    it('should optimize for aggressive loading on fast networks', async () => {
      performanceMonitor.start();
      
      const recommendation = networkCoordinator.getLoadingRecommendation(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { viewport: true, interaction: false }
      );

      expect(recommendation.strategy).toBe('aggressive');
      expect(recommendation.shouldPreload).toBe(true);
      expect(recommendation.timeoutMs).toBeLessThan(5000);
      expect(recommendation.maxRetries).toBeGreaterThan(2);

      // Test concurrent loading
      const sessionIds = [
        performanceMonitor.trackFrameworkLoad(FrameworkType.REACT, LoadPriority.HIGH),
        performanceMonitor.trackFrameworkLoad(FrameworkType.VUE, LoadPriority.NORMAL),
        performanceMonitor.trackFrameworkLoad(FrameworkType.SVELTE, LoadPriority.LOW)
      ];

      // Simulate fast loading
      sessionIds.forEach((id, index) => {
        vi.advanceTimersByTime(60 + index * 10); // Staggered completion
        performanceMonitor.completeFrameworkLoad(id);
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeLessThan(100);
      expect(frameworkStats.successfulLoads).toBe(3);
    });

    it('should enable intelligent preloading on fast networks', async () => {
      const preloadRequests = [
        {
          framework: FrameworkType.REACT,
          priority: LoadPriority.LOW,
          estimatedSize: 45000,
          reason: 'viewport' as const,
          confidence: 0.8
        },
        {
          framework: FrameworkType.VUE,
          priority: LoadPriority.LOW,
          estimatedSize: 38000,
          reason: 'interaction' as const,
          confidence: 0.6
        }
      ];

      // Check if preloading is allowed on fast network
      const isAllowed = bandwidthPreloader.isPreloadingAllowed();
      expect(isAllowed).toBe(true);

      const optimalCount = bandwidthPreloader.getOptimalPreloadCount();
      expect(optimalCount).toBeGreaterThan(1);

      // Execute preloads
      performanceMonitor.start();
      for (const preload of preloadRequests) {
        const sessionId = performanceMonitor.trackFrameworkLoad(
          preload.framework,
          preload.priority,
          { preloadReason: preload.reason }
        );

        vi.advanceTimersByTime(80);
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      const preloadStats = performanceMonitor.getPreloadStats();
      expect(preloadStats.totalPreloads).toBe(2);
      expect(preloadStats.successfulPreloads).toBe(2);
    });

    it('should handle rapid framework requests efficiently', async () => {
      performanceMonitor.start();

      // Simulate rapid requests (e.g., SPA navigation)
      const rapidRequests = Array.from({ length: 5 }, (_, i) => ({
        framework: [FrameworkType.REACT, FrameworkType.VUE][i % 2],
        timestamp: Date.now() + i * 100
      }));

      const sessionIds: string[] = [];
      for (const request of rapidRequests) {
        const sessionId = performanceMonitor.trackFrameworkLoad(
          request.framework,
          LoadPriority.HIGH
        );
        sessionIds.push(sessionId);

        // Fast loading due to excellent network
        vi.advanceTimersByTime(50);
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.totalLoads).toBe(5);
      expect(frameworkStats.averageLoadTime).toBeLessThan(60);
    });
  });

  describe('Slow Network (2G) Scenarios', () => {
    beforeEach(() => {
      const slowNetwork = createNetworkMock({
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 1000,
        saveData: true,
        online: true
      });
      
      Object.defineProperty(global, 'navigator', {
        value: slowNetwork.navigator,
        writable: true,
        configurable: true
      });
      
      // Mock slower fetch for 2G
      global.fetch = vi.fn(() => new Promise(resolve => 
        setTimeout(() => resolve(new Response('Success', { status: 200 })), 2000)
      ));
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

      // Test prioritized loading
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.CRITICAL,
        { compressionUsed: true }
      );

      // Simulate slow loading
      vi.advanceTimersByTime(1800);
      performanceMonitor.completeFrameworkLoad(sessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeGreaterThan(1500);
    });

    it('should disable preloading on slow networks', () => {
      const isAllowed = bandwidthPreloader.isPreloadingAllowed();
      expect(isAllowed).toBe(false);

      const optimalCount = bandwidthPreloader.getOptimalPreloadCount();
      expect(optimalCount).toBe(0);
    });

    it('should implement progressive loading on slow networks', async () => {
      performanceMonitor.start();

      // Load only critical frameworks first
      const criticalSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.CRITICAL,
        { progressiveLoading: true }
      );

      vi.advanceTimersByTime(2000);
      performanceMonitor.completeFrameworkLoad(criticalSessionId);

      // Defer non-critical frameworks
      const deferredSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.SVELTE,
        LoadPriority.LOW,
        { deferred: true }
      );

      vi.advanceTimersByTime(2500);
      performanceMonitor.completeFrameworkLoad(deferredSessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.totalLoads).toBe(2);
    });
  });

  describe('Offline Scenarios', () => {
    beforeEach(() => {
      const offlineNetwork = createNetworkMock({
        online: false
      });
      
      Object.defineProperty(global, 'navigator', {
        value: offlineNetwork.navigator,
        writable: true,
        configurable: true
      });
      
      global.fetch = vi.fn(() => Promise.reject(new Error('Network request failed')));
    });

    it('should handle complete offline scenarios', async () => {
      performanceMonitor.start();

      // Attempt to load framework while offline
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { offlineAttempt: true }
      );

      // Should fail gracefully
      try {
        await global.fetch('/framework/react-core.js');
      } catch (error) {
        expect(error).toBeDefined();
        performanceMonitor.failFrameworkLoad(sessionId, 'offline');
      }

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.failedLoads).toBeGreaterThan(0);
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
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true
      });
      
      global.fetch = vi.fn(() => Promise.resolve(new Response('Success', { status: 200 })));

      // Process queued requests
      connectivityHandler.processOfflineQueue();

      // Queue should be processed
      setTimeout(() => {
        const updatedQueue = connectivityHandler.getOfflineQueue();
        expect(updatedQueue).toHaveLength(0);
      }, 100);
    });
  });

  describe('Intermittent Connectivity Scenarios', () => {
    beforeEach(() => {
      const intermittentNetwork = createNetworkMock({
        effectiveType: '3g',
        downlink: 2,
        rtt: 300,
        online: true
      });
      
      Object.defineProperty(global, 'navigator', {
        value: intermittentNetwork.navigator,
        writable: true,
        configurable: true
      });
      
      // Mock intermittent fetch (randomly fails)
      global.fetch = vi.fn(() => {
        if (Math.random() < 0.3) {
          return Promise.reject(new Error('Connection timeout'));
        }
        return Promise.resolve(new Response('Success', { status: 200 }));
      });
    });

    it('should handle intermittent connectivity with retries', async () => {
      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.HIGH,
        { intermittentConnection: true }
      );

      // Simulate multiple retry attempts
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          await global.fetch('/framework/vue-core.js');
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
      expect(frameworkStats.totalLoads).toBeGreaterThan(0);
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
        { viewport: true }
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
      Object.defineProperty(global, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true
      });
      
      // Should queue the request
      connectivityHandler.queueRequest({
        framework: FrameworkType.SOLID,
        priority: LoadPriority.HIGH,
        url: '/solid'
      });

      // Connection returns
      Object.defineProperty(global, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true
      });
      
      global.fetch = vi.fn(() => Promise.resolve(new Response('Success', { status: 200 })));

      // Process queued request
      await connectivityHandler.processOfflineQueue();

      performanceMonitor.completeFrameworkLoad(sessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.successfulLoads).toBeGreaterThan(0);
    });
  });

  describe('Progressive Enhancement Scenarios', () => {
    it('should provide comprehensive fallback for all failure types', async () => {
      const progressiveEnhancement = new ProgressiveEnhancementCoordinator();
      
      const failureScenarios = [
        'service-worker-unavailable',
        'framework-loading-timeout',
        'network-offline',
        'bundle-corruption'
      ];

      for (const scenario of failureScenarios) {
        const component = {
          id: `test-component-${scenario}`,
          framework: FrameworkType.REACT,
          isInteractive: true
        };

        const strategy = progressiveEnhancement.getGracefulDegradationStrategy(scenario as any);
        expect(strategy).toBeDefined();
        expect(strategy.fallbackMethod).toBeDefined();
        expect(strategy.userExperience).toBeDefined();
        expect(strategy.functionalityLevel).toBeDefined();
      }

      progressiveEnhancement.cleanup();
    });

    it('should maintain core functionality across all failure scenarios', async () => {
      const progressiveEnhancement = new ProgressiveEnhancementCoordinator();
      
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
        }
      ];

      for (const component of testComponents) {
        const error = new Error('Framework loading failed');
        const recovery = await progressiveEnhancement.handleFrameworkLoadFailure(component, error);

        expect(recovery).toBeDefined();
        expect(recovery.maintainsFunctionality).toBe(true);
        expect(recovery.fallbackStrategy).toBeDefined();
      }

      const fallbackMetrics = progressiveEnhancement.getMetrics();
      expect(fallbackMetrics.fallbackActivations).toBe(testComponents.length);

      progressiveEnhancement.cleanup();
    });
  });

  describe('End-to-End Resilience Testing', () => {
    it('should handle cascading failure scenarios', async () => {
      performanceMonitor.start();
      const progressiveEnhancement = new ProgressiveEnhancementCoordinator();

      // Simulate cascading failures
      const failures = [
        'service-worker-failure',
        'primary-cdn-failure',
        'network-instability'
      ];

      let recoveryAttempts = 0;
      const maxRecoveryAttempts = failures.length;

      for (const failure of failures) {
        recoveryAttempts++;
        
        try {
          // Attempt different recovery strategies
          if (failure === 'service-worker-failure') {
            // Try direct loading
            await global.fetch('/framework/react-core.js');
          } else if (failure.includes('cdn-failure')) {
            // Try fallback CDN
            await global.fetch('/fallback-cdn/react-core.js');
          } else if (failure === 'network-instability') {
            // Process offline queue
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
            
            const finalRecovery = await progressiveEnhancement.handleFrameworkLoadFailure(
              component,
              error as Error
            );
            
            expect(finalRecovery.maintainsFunctionality).toBe(true);
            break;
          }
        }
      }

      const resilienceMetrics = performanceMonitor.getResilienceMetrics();
      expect(resilienceMetrics).toBeDefined();

      progressiveEnhancement.cleanup();
    });

    it('should maintain performance budgets under adverse conditions', async () => {
      performanceMonitor.start();

      // Simulate adverse network conditions
      Object.defineProperty(global, 'navigator', {
        value: {
          onLine: true,
          connection: {
            effectiveType: '2g',
            downlink: 0.5,
            rtt: 1000,
            saveData: true
          }
        },
        writable: true,
        configurable: true
      });

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.CRITICAL,
        { adverseConditions: true }
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
        { network: 'fast', frameworks: [FrameworkType.REACT, FrameworkType.VUE] },
        { network: 'slow', frameworks: [FrameworkType.SVELTE] }
      ];

      for (const scenario of scenarios) {
        // Set up network conditions
        const networkConditions = scenario.network === 'fast' ? 
          { effectiveType: '4g' as const, downlink: 15, rtt: 50 } :
          { effectiveType: '2g' as const, downlink: 0.5, rtt: 1000 };

        Object.defineProperty(global, 'navigator', {
          value: { onLine: true, connection: networkConditions },
          writable: true,
          configurable: true
        });

        for (const framework of scenario.frameworks) {
          const sessionId = performanceMonitor.trackFrameworkLoad(
            framework,
            LoadPriority.NORMAL,
            { scenario: scenario.network }
          );

          const loadTime = scenario.network === 'fast' ? 60 : 2000;
          vi.advanceTimersByTime(loadTime);
          performanceMonitor.completeFrameworkLoad(sessionId);
        }
      }

      // Generate comprehensive report
      const report = performanceMonitor.generateReport();
      expect(report.summary.totalPageLoads).toBeGreaterThan(0);
      expect(report.networkConditions).toBeDefined();

      const networkReport = networkMonitor.generateNetworkReport();
      expect(networkReport).toBeDefined();

      const connectivityReport = connectivityHandler.getConnectivityReport();
      expect(connectivityReport.totalDisconnections).toBeGreaterThanOrEqual(0);
    });
  });
});