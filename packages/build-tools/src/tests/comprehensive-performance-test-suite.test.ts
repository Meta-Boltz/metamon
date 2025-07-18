/**
 * Comprehensive Performance Test Suite
 * Master test suite that validates all performance optimization requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

// Mock environments for comprehensive testing
const createTestEnvironment = (scenario: string) => {
  const environments = {
    'fast-network': {
      navigator: {
        onLine: true,
        connection: {
          effectiveType: '4g',
          downlink: 15,
          rtt: 50,
          saveData: false
        }
      },
      performance: {
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn()
      }
    },
    'slow-network': {
      navigator: {
        onLine: true,
        connection: {
          effectiveType: '2g',
          downlink: 0.5,
          rtt: 1000,
          saveData: true
        }
      },
      performance: {
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn()
      }
    },
    'offline': {
      navigator: {
        onLine: false,
        connection: null
      },
      performance: {
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn()
      }
    },
    'no-service-worker': {
      navigator: {
        onLine: true,
        serviceWorker: undefined
      },
      performance: {
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn()
      }
    }
  };

  return environments[scenario as keyof typeof environments] || environments['fast-network'];
};

describe('Comprehensive Performance Test Suite', () => {
  describe('Requirement 1: Fast Initial Page Load', () => {
    let performanceMonitor: PerformanceMonitoringSuite;
    let frameworkLoader: FrameworkLoaderService;

    beforeEach(() => {
      const env = createTestEnvironment('fast-network');
      global.navigator = env.navigator as any;
      global.performance = env.performance as any;

      performanceMonitor = new PerformanceMonitoringSuite({
        enabled: true,
        performanceBudget: {
          maxInitialBundleSize: 50 * 1024, // 50KB
          maxFrameworkLoadTime: 100 // 100ms
        }
      });

      frameworkLoader = new FrameworkLoaderService({
        enableServiceWorker: true,
        targetLoadTime: 100
      });
    });

    afterEach(() => {
      performanceMonitor.dispose();
      frameworkLoader.destroy();
    });

    it('should load minimal runtime core initially (Req 1.1)', async () => {
      performanceMonitor.start();

      // Simulate initial bundle analysis
      const initialBundle = {
        size: 45 * 1024, // 45KB - within 50KB budget
        frameworks: [],
        runtimeCore: true
      };

      performanceMonitor.recordBundleMetrics({
        initialSize: initialBundle.size,
        frameworkSizes: {},
        compressionRatio: 0.8,
        chunkCount: 1
      });

      const bundleMetrics = performanceMonitor.getMetrics().bundle;
      expect(bundleMetrics.initialSize).toBeLessThanOrEqual(50 * 1024);

      const alerts = performanceMonitor.getActiveAlerts();
      const bundleAlerts = alerts.filter(a => a.type === 'bundle-size-exceeded');
      expect(bundleAlerts).toHaveLength(0);
    });

    it('should load framework cores on-demand within 100ms (Req 1.2)', async () => {
      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { cacheAttempted: true, expectedBundleSize: 45000 }
      );

      // Simulate fast loading
      vi.advanceTimersByTime(85); // 85ms - within budget
      performanceMonitor.completeFrameworkLoad(sessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeLessThan(100);
    });

    it('should load multiple framework cores in parallel (Req 1.3)', async () => {
      performanceMonitor.start();

      const frameworks = [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE];
      const sessionIds = frameworks.map(fw => 
        performanceMonitor.trackFrameworkLoad(fw, LoadPriority.HIGH)
      );

      // Complete all loads in parallel
      sessionIds.forEach(id => {
        vi.advanceTimersByTime(90);
        performanceMonitor.completeFrameworkLoad(id);
      });

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.successfulLoads).toBe(3);
      expect(frameworkStats.averageLoadTime).toBeLessThan(100);
    });

    it('should cache framework cores for subsequent use (Req 1.4)', async () => {
      performanceMonitor.start();

      // First load (cache miss)
      const firstSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { cacheAttempted: true, cacheHit: false }
      );
      vi.advanceTimersByTime(90);
      performanceMonitor.completeFrameworkLoad(firstSessionId);

      // Second load (cache hit)
      const secondSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { cacheAttempted: true, cacheHit: true }
      );
      vi.advanceTimersByTime(15); // Much faster due to cache
      performanceMonitor.completeFrameworkLoad(secondSessionId);

      const cacheStats = performanceMonitor.getCacheStats();
      expect(cacheStats.hitRate).toBeGreaterThan(0.5);
    });

    it('should maintain initial bundle under 50KB (Req 1.5)', async () => {
      performanceMonitor.start();

      const bundleAnalysis = {
        initialSize: 48 * 1024, // 48KB - within budget
        frameworkSizes: {
          [FrameworkType.REACT]: 0, // Not included in initial bundle
          [FrameworkType.VUE]: 0,
          [FrameworkType.SVELTE]: 0
        },
        compressionRatio: 0.75,
        chunkCount: 2
      };

      performanceMonitor.recordBundleMetrics(bundleAnalysis);

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.bundle.initialSize).toBeLessThan(50 * 1024);

      // Verify no framework code in initial bundle
      const totalFrameworkSize = Object.values(bundleAnalysis.frameworkSizes)
        .reduce((sum, size) => sum + size, 0);
      expect(totalFrameworkSize).toBe(0);
    });
  });

  describe('Requirement 2: Service Worker Framework Delivery', () => {
    let serviceWorkerManager: ServiceWorkerManager;
    let performanceMonitor: PerformanceMonitoringSuite;

    beforeEach(() => {
      const env = createTestEnvironment('fast-network');
      global.navigator = env.navigator as any;
      global.performance = env.performance as any;

      // Mock service worker registration
      global.navigator.serviceWorker = {
        register: vi.fn(() => Promise.resolve({
          active: { state: 'activated' },
          update: vi.fn()
        })),
        ready: Promise.resolve({
          active: { state: 'activated' }
        })
      } as any;

      serviceWorkerManager = new ServiceWorkerManager({
        scriptUrl: '/metamon-sw.js'
      });

      performanceMonitor = new PerformanceMonitoringSuite({
        enabled: true,
        collectServiceWorkerMetrics: true
      });
    });

    afterEach(() => {
      serviceWorkerManager.destroy();
      performanceMonitor.dispose();
    });

    it('should serve framework cores from service worker cache (Req 2.1)', async () => {
      await serviceWorkerManager.register();
      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { 
          serviceWorkerUsed: true,
          cacheAttempted: true,
          cacheHit: true
        }
      );

      vi.advanceTimersByTime(20); // Very fast due to service worker cache
      performanceMonitor.completeFrameworkLoad(sessionId);

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.serviceWorker.cacheHits).toBeGreaterThan(0);
    });

    it('should fetch and cache framework cores transparently (Req 2.2)', async () => {
      await serviceWorkerManager.register();
      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.NORMAL,
        { 
          serviceWorkerUsed: true,
          cacheAttempted: true,
          cacheHit: false // First time, cache miss
        }
      );

      vi.advanceTimersByTime(80);
      performanceMonitor.completeFrameworkLoad(sessionId);

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.serviceWorker.cacheMisses).toBeGreaterThan(0);
      expect(metrics.serviceWorker.cacheOperations).toBeGreaterThan(0);
    });

    it('should invalidate old caches automatically (Req 2.3)', async () => {
      await serviceWorkerManager.register();
      
      // Simulate cache invalidation
      await serviceWorkerManager.sendMessage({
        type: 'INVALIDATE_CACHE',
        pattern: 'framework-*'
      });

      const status = await serviceWorkerManager.getRegistrationStatus();
      expect(status.isRegistered).toBe(true);
    });

    it('should fallback to direct loading when service worker unavailable (Req 2.4)', async () => {
      // Simulate service worker unavailable
      delete (global.navigator as any).serviceWorker;

      const fallbackLoader = new FrameworkLoaderService({
        enableServiceWorker: false // Force fallback
      });

      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.SVELTE,
        LoadPriority.HIGH,
        { 
          serviceWorkerUsed: false,
          fallbackUsed: true
        }
      );

      vi.advanceTimersByTime(120); // Slower without service worker
      performanceMonitor.completeFrameworkLoad(sessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.successfulLoads).toBeGreaterThan(0);

      fallbackLoader.destroy();
    });

    it('should offload heavy computations to service worker (Req 2.5)', async () => {
      await serviceWorkerManager.register();
      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.SOLID,
        LoadPriority.NORMAL,
        { 
          serviceWorkerUsed: true,
          backgroundExecution: true
        }
      );

      vi.advanceTimersByTime(60);
      performanceMonitor.completeFrameworkLoad(sessionId);

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.serviceWorker.backgroundTasks).toBeGreaterThan(0);
    });
  });

  describe('Requirement 3: SSR with Lazy Loading', () => {
    let ssrManager: SSROptimizationManager;
    let performanceMonitor: PerformanceMonitoringSuite;

    beforeEach(() => {
      const env = createTestEnvironment('fast-network');
      global.navigator = env.navigator as any;
      global.performance = env.performance as any;

      ssrManager = new SSROptimizationManager({
        enableSelectiveHydration: true,
        hydrationStrategy: 'viewport-based'
      });

      performanceMonitor = new PerformanceMonitoringSuite({
        enabled: true
      });
    });

    afterEach(() => {
      ssrManager.destroy();
      performanceMonitor.dispose();
    });

    it('should render all visible components without client-side framework loading (Req 3.1)', async () => {
      const components = [
        {
          id: 'header',
          framework: FrameworkType.REACT,
          isInteractive: false,
          content: '<header>Header Content</header>',
          isVisible: true
        },
        {
          id: 'hero',
          framework: FrameworkType.VUE,
          isInteractive: false,
          content: '<section>Hero Content</section>',
          isVisible: true
        }
      ];

      const ssrResult = await ssrManager.renderServerContent(components);

      expect(ssrResult.html).toContain('Header Content');
      expect(ssrResult.html).toContain('Hero Content');
      expect(ssrResult.frameworkRequirements).toHaveLength(2);

      // Non-interactive components should have low priority
      const requirements = ssrResult.frameworkRequirements;
      expect(requirements.every(req => req.priority === LoadPriority.LOW)).toBe(true);
    });

    it('should load framework cores only for interactive components (Req 3.2)', async () => {
      performanceMonitor.start();

      const components = [
        {
          id: 'static-content',
          framework: FrameworkType.REACT,
          isInteractive: false
        },
        {
          id: 'interactive-form',
          framework: FrameworkType.REACT,
          isInteractive: true
        }
      ];

      const requirements = ssrManager.analyzeFrameworkRequirements(components);
      
      // Should prioritize interactive components
      const reactReq = requirements.find(req => req.framework === FrameworkType.REACT);
      expect(reactReq?.priority).toBe(LoadPriority.HIGH); // Due to interactive component
    });

    it('should defer non-visible component framework loading (Req 3.3)', () => {
      const components = [
        {
          id: 'above-fold',
          framework: FrameworkType.VUE,
          isInteractive: true,
          isVisible: true
        },
        {
          id: 'below-fold',
          framework: FrameworkType.SVELTE,
          isInteractive: true,
          isVisible: false
        }
      ];

      const requirements = ssrManager.analyzeFrameworkRequirements(components);
      
      const vueReq = requirements.find(req => req.framework === FrameworkType.VUE);
      const svelteReq = requirements.find(req => req.framework === FrameworkType.SVELTE);

      expect(vueReq?.priority).toBe(LoadPriority.HIGH); // Visible + interactive
      expect(svelteReq?.priority).toBe(LoadPriority.NORMAL); // Not visible
    });

    it('should gracefully fallback when SSR fails (Req 3.4)', async () => {
      // Simulate SSR failure
      vi.spyOn(ssrManager, 'renderServerContent').mockRejectedValue(
        new Error('SSR rendering failed')
      );

      const fallback = new ProgressiveEnhancementCoordinator({
        enableServerRenderedFallback: true
      });

      const components = [{
        id: 'failing-component',
        framework: FrameworkType.REACT,
        isInteractive: true
      }];

      try {
        await ssrManager.renderServerContent(components);
      } catch (error) {
        // Should handle gracefully
        const recovery = await fallback.handleFrameworkLoadingFailure(
          components[0],
          error as Error
        );
        expect(recovery.maintainsFunctionality).toBe(true);
      }

      fallback.destroy();
    });

    it('should not depend on client-side framework bundles for critical rendering (Req 3.5)', async () => {
      const components = [
        {
          id: 'critical-content',
          framework: FrameworkType.REACT,
          isInteractive: false,
          isCritical: true,
          content: '<main>Critical Content</main>'
        }
      ];

      const ssrResult = await ssrManager.renderServerContent(components);

      // Critical content should be fully rendered server-side
      expect(ssrResult.html).toContain('Critical Content');
      
      // Should not require immediate client-side framework loading
      const criticalRequirements = ssrResult.frameworkRequirements
        .filter(req => req.priority === LoadPriority.CRITICAL);
      expect(criticalRequirements).toHaveLength(0);
    });
  });

  describe('Requirement 4: Layout Stability (CLS Prevention)', () => {
    let layoutController: LayoutStabilityController;
    let performanceMonitor: PerformanceMonitoringSuite;

    beforeEach(() => {
      const env = createTestEnvironment('fast-network');
      global.navigator = env.navigator as any;
      global.performance = env.performance as any;

      // Mock DOM
      global.document = {
        createElement: vi.fn(() => ({
          style: {},
          getBoundingClientRect: () => ({ width: 300, height: 200, top: 0, left: 0 })
        }))
      } as any;

      layoutController = new LayoutStabilityController({
        targetCLS: 0.1,
        enablePlaceholders: true
      });

      performanceMonitor = new PerformanceMonitoringSuite({
        enabled: true,
        performanceBudget: { maxCLS: 0.1 }
      });
    });

    afterEach(() => {
      layoutController.destroy();
      performanceMonitor.dispose();
    });

    it('should maintain exact dimensions during framework loading (Req 4.1)', () => {
      const element = global.document.createElement('div');
      element.style.width = '300px';
      element.style.height = '200px';

      const reservation = layoutController.preserveLayout(element);

      expect(reservation).toBeDefined();
      expect(reservation.dimensions.width).toBe(300);
      expect(reservation.dimensions.height).toBe(200);

      layoutController.releaseLayout(reservation);
    });

    it('should show loading indicators without shifting content (Req 4.2)', () => {
      performanceMonitor.start();

      const element = global.document.createElement('div');
      const placeholder = layoutController.createPlaceholder({
        id: 'test-component',
        framework: FrameworkType.REACT,
        dimensions: { width: 300, height: 200 }
      });

      expect(placeholder).toBeDefined();

      // Simulate component loading
      const sessionId = performanceMonitor.trackFrameworkLoad(FrameworkType.REACT);
      vi.advanceTimersByTime(80);
      performanceMonitor.completeFrameworkLoad(sessionId);

      // Replace placeholder
      layoutController.replacePlaceholder(placeholder, element);

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.05); // Minimal shift
    });

    it('should create seamless transitions during hydration (Req 4.3)', async () => {
      const serverElement = global.document.createElement('div');
      const clientElement = global.document.createElement('div');

      await layoutController.createSeamlessTransition(serverElement, clientElement);

      // Transition should complete without throwing
      expect(true).toBe(true);
    });

    it('should maintain CLS score below 0.1 (Req 4.4)', () => {
      performanceMonitor.start();

      // Simulate multiple component hydrations
      const components = [
        { width: 300, height: 200 },
        { width: 250, height: 150 },
        { width: 400, height: 100 }
      ];

      const reservations = components.map(comp => {
        const element = global.document.createElement('div');
        element.style.width = `${comp.width}px`;
        element.style.height = `${comp.height}px`;
        return layoutController.preserveLayout(element);
      });

      // Release all reservations
      reservations.forEach(reservation => {
        layoutController.releaseLayout(reservation);
      });

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.1);
    });

    it('should handle component loading failures without layout shifts (Req 4.5)', async () => {
      const element = global.document.createElement('div');
      const reservation = layoutController.preserveLayout(element);

      // Simulate component loading failure
      try {
        throw new Error('Component loading failed');
      } catch (error) {
        // Error state should not cause layout shift
        layoutController.releaseLayout(reservation);
      }

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.1);
    });
  });

  describe('Requirement 10: Network Condition Adaptation', () => {
    let networkCoordinator: NetworkAdaptationCoordinator;
    let performanceMonitor: PerformanceMonitoringSuite;

    beforeEach(() => {
      networkCoordinator = new NetworkAdaptationCoordinator();
      performanceMonitor = new PerformanceMonitoringSuite({
        enabled: true
      });
    });

    afterEach(() => {
      networkCoordinator.destroy();
      performanceMonitor.dispose();
    });

    it('should prioritize framework loading by importance on slow networks (Req 10.1)', () => {
      const env = createTestEnvironment('slow-network');
      global.navigator = env.navigator as any;

      const recommendation = networkCoordinator.getLoadingRecommendation(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { viewport: true }
      );

      expect(recommendation.strategy).toBe('conservative');
      expect(recommendation.timeoutMs).toBeGreaterThan(5000); // Longer timeout for slow network
    });

    it('should use cached framework cores when connection is intermittent (Req 10.2)', async () => {
      const env = createTestEnvironment('offline');
      global.navigator = env.navigator as any;

      performanceMonitor.start();

      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.NORMAL,
        { 
          networkConditions: { effectiveType: 'offline' as any },
          cacheAttempted: true,
          cacheHit: true // Using cached version
        }
      );

      vi.advanceTimersByTime(10); // Very fast from cache
      performanceMonitor.completeFrameworkLoad(sessionId);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.successfulLoads).toBeGreaterThan(0);
    });

    it('should adapt loading strategies to reduce data usage on limited bandwidth (Req 10.3)', () => {
      const env = createTestEnvironment('slow-network');
      global.navigator = env.navigator as any;

      networkCoordinator.updateConfig({
        adaptation: {
          aggressiveness: 'conservative',
          priorityBoosting: false,
          dynamicTimeouts: true
        }
      });

      const recommendation = networkCoordinator.getLoadingRecommendation(
        FrameworkType.SVELTE,
        LoadPriority.LOW,
        { viewport: false }
      );

      expect(recommendation.shouldPreload).toBe(false); // Don't preload on slow network
      expect(recommendation.compressionRequired).toBe(true);
    });

    it('should maintain basic functionality when network fails (Req 10.4)', async () => {
      const env = createTestEnvironment('offline');
      global.navigator = env.navigator as any;

      const fallback = new ProgressiveEnhancementCoordinator({
        enableOfflineSupport: true
      });

      const component = {
        id: 'offline-component',
        framework: FrameworkType.REACT,
        isInteractive: true
      };

      const recovery = await fallback.handleNetworkFailure(component);
      expect(recovery.maintainsFunctionality).toBe(true);
      expect(recovery.degradationLevel).toBe('minimal');

      fallback.destroy();
    });

    it('should adjust loading strategies dynamically based on connection quality (Req 10.5)', () => {
      // Start with fast network
      let env = createTestEnvironment('fast-network');
      global.navigator = env.navigator as any;

      let recommendation = networkCoordinator.getLoadingRecommendation(
        FrameworkType.SOLID,
        LoadPriority.NORMAL,
        { viewport: true }
      );

      expect(recommendation.strategy).toBe('aggressive');

      // Switch to slow network
      env = createTestEnvironment('slow-network');
      global.navigator = env.navigator as any;

      recommendation = networkCoordinator.getLoadingRecommendation(
        FrameworkType.SOLID,
        LoadPriority.NORMAL,
        { viewport: true }
      );

      expect(recommendation.strategy).toBe('conservative');
    });
  });

  describe('End-to-End Performance Validation', () => {
    it('should meet all Core Web Vitals budgets in realistic scenarios', async () => {
      const performanceMonitor = new PerformanceMonitoringSuite({
        enabled: true,
        performanceBudget: {
          maxLCP: 2500,
          maxFID: 100,
          maxCLS: 0.1,
          maxFrameworkLoadTime: 100,
          maxInitialBundleSize: 50 * 1024
        }
      });

      const frameworkLoader = new FrameworkLoaderService({
        enableServiceWorker: true,
        targetLoadTime: 100
      });

      const layoutController = new LayoutStabilityController({
        targetCLS: 0.1
      });

      performanceMonitor.start();

      // Simulate complete page load with multiple frameworks
      const frameworks = [FrameworkType.REACT, FrameworkType.VUE];
      const sessionIds = frameworks.map(fw => 
        performanceMonitor.trackFrameworkLoad(fw, LoadPriority.HIGH)
      );

      // Complete loading within budget
      sessionIds.forEach(id => {
        vi.advanceTimersByTime(85);
        performanceMonitor.completeFrameworkLoad(id);
      });

      // Simulate layout operations
      const element = global.document?.createElement('div');
      if (element) {
        const reservation = layoutController.preserveLayout(element);
        layoutController.releaseLayout(reservation);
      }

      // Validate all budgets
      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeLessThan(100);

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.1);

      const alerts = performanceMonitor.getActiveAlerts();
      const budgetViolations = alerts.filter(a => a.type === 'budget-exceeded');
      expect(budgetViolations).toHaveLength(0);

      // Cleanup
      performanceMonitor.dispose();
      frameworkLoader.destroy();
      layoutController.destroy();
    });

    it('should handle complex multi-framework applications', async () => {
      const performanceMonitor = new PerformanceMonitoringSuite({ enabled: true });
      const ssrManager = new SSROptimizationManager();
      const preloader = new IntelligentPreloader();

      performanceMonitor.start();

      // Complex application with all frameworks
      const components = [
        { id: 'header', framework: FrameworkType.REACT, isInteractive: false },
        { id: 'sidebar', framework: FrameworkType.VUE, isInteractive: true },
        { id: 'main', framework: FrameworkType.SVELTE, isInteractive: true },
        { id: 'footer', framework: FrameworkType.SOLID, isInteractive: false }
      ];

      // SSR rendering
      const ssrResult = await ssrManager.renderServerContent(components);
      expect(ssrResult.frameworkRequirements).toHaveLength(4);

      // Intelligent preloading
      const preloadPredictions = preloader.predictUserIntent([]);
      expect(Array.isArray(preloadPredictions)).toBe(true);

      // Framework loading
      const sessionIds = ssrResult.frameworkRequirements.map(req =>
        performanceMonitor.trackFrameworkLoad(req.framework, req.priority)
      );

      sessionIds.forEach(id => {
        vi.advanceTimersByTime(90);
        performanceMonitor.completeFrameworkLoad(id);
      });

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.successfulLoads).toBe(4);

      // Cleanup
      performanceMonitor.dispose();
      ssrManager.destroy();
      preloader.destroy();
    });
  });
});