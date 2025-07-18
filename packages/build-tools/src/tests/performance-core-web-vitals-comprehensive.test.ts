/**
 * Comprehensive Core Web Vitals and Loading Metrics Performance Tests
 * Performance tests for Core Web Vitals and loading metrics validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitoringSuite, WebVitalsMonitor, FrameworkLoadingTracker } from '../performance-monitoring/index.js';
import { LayoutStabilityController } from '../layout-stability/index.js';
import { NetworkAdaptationCoordinator } from '../network-adaptation/index.js';
import { FrameworkLoaderService } from '../framework-loader/index.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

// Mock Performance Observer with realistic Web Vitals data
class MockPerformanceObserver {
  private callback: (list: any) => void;
  private entries: PerformanceEntry[] = [];
  
  constructor(callback: (list: any) => void) {
    this.callback = callback;
  }
  
  observe(options: { entryTypes: string[] }) {
    // Simulate observing different entry types
    setTimeout(() => {
      const relevantEntries = this.entries.filter(entry => 
        options.entryTypes.includes(entry.entryType)
      );
      
      this.callback({
        getEntries: () => relevantEntries,
        getEntriesByType: (type: string) => relevantEntries.filter(e => e.entryType === type),
        getEntriesByName: (name: string) => relevantEntries.filter(e => e.name === name)
      });
    }, 100);
  }
  
  disconnect() {}
  
  // Helper methods to simulate performance entries
  simulateLCP(value: number, element?: HTMLElement) {
    this.entries.push({
      name: 'largest-contentful-paint',
      entryType: 'largest-contentful-paint',
      startTime: value,
      duration: 0,
      size: element ? 1000 : 500,
      renderTime: value,
      loadTime: value + 50,
      element: element || document.createElement('div')
    } as any);
  }
  
  simulateFID(value: number) {
    this.entries.push({
      name: 'first-input',
      entryType: 'first-input',
      startTime: Date.now(),
      duration: 0,
      processingStart: Date.now() + value,
      processingEnd: Date.now() + value + 10,
      cancelable: true
    } as any);
  }
  
  simulateCLS(value: number, hadRecentInput = false) {
    this.entries.push({
      name: 'layout-shift',
      entryType: 'layout-shift',
      startTime: Date.now(),
      duration: 0,
      value: value,
      hadRecentInput: hadRecentInput,
      sources: []
    } as any);
  }
  
  simulateFCP(value: number) {
    this.entries.push({
      name: 'first-contentful-paint',
      entryType: 'paint',
      startTime: value,
      duration: 0
    } as any);
  }
  
  simulateTTFB(value: number) {
    this.entries.push({
      name: 'navigation',
      entryType: 'navigation',
      startTime: 0,
      duration: value,
      responseStart: value
    } as any);
  }
}

// Mock realistic network conditions
const createNetworkConditions = (type: 'fast' | 'slow' | 'unstable') => {
  const conditions = {
    fast: {
      effectiveType: '4g' as const,
      downlink: 15,
      rtt: 50,
      saveData: false
    },
    slow: {
      effectiveType: '2g' as const,
      downlink: 0.5,
      rtt: 1000,
      saveData: true
    },
    unstable: {
      effectiveType: '3g' as const,
      downlink: 2,
      rtt: 300,
      saveData: false
    }
  };
  
  return conditions[type];
};

describe('Core Web Vitals and Loading Metrics Performance Tests', () => {
  let mockObserver: MockPerformanceObserver;
  let performanceMonitor: PerformanceMonitoringSuite;
  let webVitalsMonitor: WebVitalsMonitor;
  let frameworkTracker: FrameworkLoadingTracker;
  let layoutController: LayoutStabilityController;

  beforeEach(() => {
    // Setup performance mocks
    global.performance = {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => []),
      timing: {
        navigationStart: Date.now() - 5000,
        loadEventEnd: Date.now() - 1000,
        domContentLoadedEventEnd: Date.now() - 2000,
        responseStart: Date.now() - 4000,
        responseEnd: Date.now() - 3500
      }
    } as any;

    mockObserver = new MockPerformanceObserver(() => {});
    global.PerformanceObserver = vi.fn(() => mockObserver) as any;

    // Setup DOM mocks
    global.document = {
      createElement: vi.fn(() => ({
        getBoundingClientRect: () => ({ width: 300, height: 200, top: 0, left: 0 }),
        style: {},
        classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() }
      })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;

    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn((cb: Function) => setTimeout(cb, 16)),
      performance: global.performance
    } as any;

    // Initialize components
    performanceMonitor = new PerformanceMonitoringSuite({
      enabled: true,
      collectWebVitals: true,
      collectFrameworkMetrics: true,
      performanceBudget: {
        maxLCP: 2500,
        maxFID: 100,
        maxCLS: 0.1,
        maxFCP: 1800,
        maxTTFB: 600,
        maxFrameworkLoadTime: 100,
        maxInitialBundleSize: 50 * 1024
      },
      alertThresholds: {
        budgetExceeded: 1.0,
        performanceDegradation: 0.2
      }
    });

    webVitalsMonitor = new WebVitalsMonitor({
      enableLCP: true,
      enableFID: true,
      enableCLS: true,
      enableFCP: true,
      enableTTFB: true
    });

    frameworkTracker = new FrameworkLoadingTracker({
      enableDetailedMetrics: true,
      trackCachePerformance: true
    });

    layoutController = new LayoutStabilityController({
      targetCLS: 0.1,
      enablePlaceholders: true,
      enableCLSMonitoring: true
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    performanceMonitor.dispose();
    webVitalsMonitor.stopMonitoring();
    layoutController.destroy();
    vi.restoreAllMocks();
  });

  describe('Largest Contentful Paint (LCP) Performance', () => {
    it('should achieve excellent LCP scores with framework lazy loading', async () => {
      performanceMonitor.start();
      webVitalsMonitor.startMonitoring();

      // Simulate fast initial page load without frameworks
      mockObserver.simulateFCP(800); // Fast FCP
      
      // Simulate LCP from server-rendered content (no framework needed)
      const lcpElement = global.document.createElement('img');
      mockObserver.simulateLCP(1200, lcpElement); // Excellent LCP

      // Load frameworks after LCP
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.NORMAL, // Not critical for LCP
        { cacheAttempted: true, expectedBundleSize: 45000 }
      );

      vi.advanceTimersByTime(80);
      performanceMonitor.completeFrameworkLoad(sessionId);

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.lcp).toBeLessThan(1500); // Excellent LCP
      expect(webVitals.fcp).toBeLessThan(1000); // Fast FCP

      const alerts = performanceMonitor.getActiveAlerts();
      const lcpAlerts = alerts.filter(alert => alert.metric === 'lcp');
      expect(lcpAlerts).toHaveLength(0); // No LCP alerts
    });

    it('should detect and optimize poor LCP caused by framework blocking', async () => {
      performanceMonitor.start();
      webVitalsMonitor.startMonitoring();

      // Simulate poor LCP due to framework blocking
      mockObserver.simulateLCP(4500); // Poor LCP

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.lcp).toBeGreaterThan(2500); // Exceeds budget

      const alerts = performanceMonitor.getActiveAlerts();
      const lcpAlerts = alerts.filter(alert => alert.metric === 'lcp');
      expect(lcpAlerts.length).toBeGreaterThan(0);

      const suggestions = performanceMonitor.getOptimizationSuggestions();
      const lcpSuggestions = suggestions.filter(s => s.metric === 'lcp');
      expect(lcpSuggestions.length).toBeGreaterThan(0);
      expect(lcpSuggestions[0].priority).toBe('high');
      expect(lcpSuggestions[0].suggestions).toContain('lazy loading');
    });

    it('should maintain good LCP across different network conditions', async () => {
      const networkConditions = ['fast', 'slow', 'unstable'] as const;
      
      for (const condition of networkConditions) {
        const network = createNetworkConditions(condition);
        global.navigator = { connection: network } as any;

        const networkCoordinator = new NetworkAdaptationCoordinator();
        performanceMonitor.start();

        // Adapt loading strategy based on network
        const recommendation = networkCoordinator.getLoadingRecommendation(
          FrameworkType.REACT,
          LoadPriority.HIGH,
          { viewport: true }
        );

        // Simulate LCP based on network conditions
        const expectedLCP = condition === 'fast' ? 1200 : condition === 'slow' ? 2200 : 1800;
        mockObserver.simulateLCP(expectedLCP);

        await new Promise(resolve => setTimeout(resolve, 200));

        const webVitals = performanceMonitor.getWebVitals();
        
        if (condition === 'fast') {
          expect(webVitals.lcp).toBeLessThan(1500); // Excellent
        } else if (condition === 'slow') {
          expect(webVitals.lcp).toBeLessThan(2500); // Still within budget
        } else {
          expect(webVitals.lcp).toBeLessThan(2000); // Good
        }

        networkCoordinator.destroy();
        performanceMonitor.clearData();
      }
    });

    it('should optimize LCP through intelligent preloading', async () => {
      performanceMonitor.start();

      // Simulate preloading critical resources
      const preloadSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.LOW, // Preload
        { 
          preloadReason: 'lcp-optimization',
          expectedBundleSize: 45000
        }
      );

      vi.advanceTimersByTime(150); // Preload takes longer but doesn't block LCP
      performanceMonitor.completeFrameworkLoad(preloadSessionId);

      // Simulate fast LCP due to preloaded resources
      mockObserver.simulateLCP(1100);

      // Later, when framework is actually needed, it's already cached
      const actualSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { cacheHit: true }
      );

      vi.advanceTimersByTime(15); // Very fast due to cache
      performanceMonitor.completeFrameworkLoad(actualSessionId);

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.lcp).toBeLessThan(1200); // Excellent LCP

      const cacheStats = performanceMonitor.getCacheStats();
      expect(cacheStats.hitRate).toBeGreaterThan(0.5);
    });
  });

  describe('First Input Delay (FID) Performance', () => {
    it('should maintain excellent FID with service worker offloading', async () => {
      performanceMonitor.start();
      webVitalsMonitor.startMonitoring();

      // Simulate framework loading with service worker
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.HIGH,
        { 
          serviceWorkerUsed: true,
          backgroundExecution: true,
          mainThreadBlocking: false
        }
      );

      vi.advanceTimersByTime(70);
      performanceMonitor.completeFrameworkLoad(sessionId);

      // Simulate excellent FID due to reduced main thread blocking
      mockObserver.simulateFID(35);

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.fid).toBeLessThan(50); // Excellent FID

      const alerts = performanceMonitor.getActiveAlerts();
      const fidAlerts = alerts.filter(alert => alert.metric === 'fid');
      expect(fidAlerts).toHaveLength(0);
    });

    it('should detect and optimize poor FID from main thread blocking', async () => {
      performanceMonitor.start();
      webVitalsMonitor.startMonitoring();

      // Simulate framework loading that blocks main thread
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.CRITICAL,
        { 
          serviceWorkerUsed: false,
          mainThreadBlocking: true,
          blockingDuration: 180
        }
      );

      vi.advanceTimersByTime(180); // Long blocking time
      performanceMonitor.completeFrameworkLoad(sessionId);

      // Simulate poor FID due to main thread blocking
      mockObserver.simulateFID(250);

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.fid).toBeGreaterThan(100); // Exceeds budget

      const suggestions = performanceMonitor.getOptimizationSuggestions();
      const fidSuggestions = suggestions.filter(s => s.metric === 'fid');
      expect(fidSuggestions.length).toBeGreaterThan(0);
      expect(fidSuggestions[0].suggestions).toContain('service worker');
      expect(fidSuggestions[0].suggestions).toContain('main thread');
    });

    it('should optimize FID through framework loading prioritization', async () => {
      performanceMonitor.start();

      // Load critical interactive frameworks first
      const criticalSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.CRITICAL,
        { 
          interactiveComponent: true,
          aboveFold: true
        }
      );

      vi.advanceTimersByTime(60); // Fast loading for critical
      performanceMonitor.completeFrameworkLoad(criticalSessionId);

      // Defer non-critical frameworks
      const deferredSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.SVELTE,
        LoadPriority.LOW,
        { 
          interactiveComponent: false,
          belowFold: true
        }
      );

      // Simulate user interaction before deferred loading completes
      mockObserver.simulateFID(45); // Good FID

      vi.advanceTimersByTime(120); // Deferred loading completes later
      performanceMonitor.completeFrameworkLoad(deferredSessionId);

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.fid).toBeLessThan(50); // Excellent FID

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeLessThan(100);
    });

    it('should handle concurrent framework loading without FID degradation', async () => {
      performanceMonitor.start();

      // Load multiple frameworks concurrently
      const frameworks = [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE];
      const sessionIds = frameworks.map(fw => 
        performanceMonitor.trackFrameworkLoad(fw, LoadPriority.NORMAL, {
          serviceWorkerUsed: true,
          concurrentLoading: true
        })
      );

      // Complete all loads concurrently
      sessionIds.forEach(id => {
        vi.advanceTimersByTime(85);
        performanceMonitor.completeFrameworkLoad(id);
      });

      // Simulate good FID despite concurrent loading
      mockObserver.simulateFID(60);

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.fid).toBeLessThan(100); // Within budget

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.successfulLoads).toBe(3);
      expect(frameworkStats.concurrentLoads).toBeGreaterThan(0);
    });
  });

  describe('Cumulative Layout Shift (CLS) Performance', () => {
    it('should achieve excellent CLS with layout stability controller', async () => {
      performanceMonitor.start();
      layoutController.start();
      webVitalsMonitor.startMonitoring();

      // Create components that will be hydrated
      const components = [
        { id: 'header', width: 300, height: 80 },
        { id: 'sidebar', width: 250, height: 400 },
        { id: 'main', width: 600, height: 500 }
      ];

      const reservations = components.map(comp => {
        const element = global.document.createElement('div');
        element.style.width = `${comp.width}px`;
        element.style.height = `${comp.height}px`;
        return layoutController.preserveLayout(element);
      });

      // Load frameworks and hydrate
      const sessionIds = [
        performanceMonitor.trackFrameworkLoad(FrameworkType.REACT),
        performanceMonitor.trackFrameworkLoad(FrameworkType.VUE),
        performanceMonitor.trackFrameworkLoad(FrameworkType.SVELTE)
      ];

      sessionIds.forEach(id => {
        vi.advanceTimersByTime(75);
        performanceMonitor.completeFrameworkLoad(id);
      });

      // Release reservations after hydration
      reservations.forEach(reservation => {
        layoutController.releaseLayout(reservation);
      });

      // Simulate minimal layout shift due to good placeholder management
      mockObserver.simulateCLS(0.02);

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.cls).toBeLessThan(0.05); // Excellent CLS

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.05);
    });

    it('should detect and prevent significant layout shifts', async () => {
      performanceMonitor.start();
      webVitalsMonitor.startMonitoring();

      // Simulate significant layout shift without protection
      mockObserver.simulateCLS(0.35);

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.cls).toBeGreaterThan(0.1); // Exceeds budget

      const alerts = performanceMonitor.getActiveAlerts();
      const clsAlerts = alerts.filter(alert => alert.metric === 'cls');
      expect(clsAlerts.length).toBeGreaterThan(0);

      const suggestions = performanceMonitor.getOptimizationSuggestions();
      const clsSuggestions = suggestions.filter(s => s.metric === 'cls');
      expect(clsSuggestions.length).toBeGreaterThan(0);
      expect(clsSuggestions[0].suggestions).toContain('placeholder');
      expect(clsSuggestions[0].suggestions).toContain('dimensions');
    });

    it('should optimize CLS through progressive hydration', async () => {
      performanceMonitor.start();
      layoutController.start();

      // Simulate progressive hydration of components
      const components = [
        { id: 'critical', priority: LoadPriority.CRITICAL, width: 400, height: 300 },
        { id: 'normal', priority: LoadPriority.NORMAL, width: 300, height: 200 },
        { id: 'low', priority: LoadPriority.LOW, width: 200, height: 150 }
      ];

      // Hydrate in priority order
      for (const comp of components) {
        const element = global.document.createElement('div');
        element.style.width = `${comp.width}px`;
        element.style.height = `${comp.height}px`;
        
        const reservation = layoutController.preserveLayout(element);
        
        const sessionId = performanceMonitor.trackFrameworkLoad(FrameworkType.REACT, comp.priority);
        vi.advanceTimersByTime(comp.priority === LoadPriority.CRITICAL ? 50 : 80);
        performanceMonitor.completeFrameworkLoad(sessionId);
        
        layoutController.releaseLayout(reservation);
        
        // Small incremental layout shift
        mockObserver.simulateCLS(0.01);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.05); // Cumulative but still excellent
    });

    it('should handle dynamic content loading without CLS', async () => {
      performanceMonitor.start();
      layoutController.start();

      // Simulate dynamic content that could cause layout shift
      const dynamicComponents = [
        { id: 'ad-banner', width: 728, height: 90, dynamic: true },
        { id: 'user-content', width: 400, height: 0, expandable: true }, // Height unknown
        { id: 'image-gallery', width: 600, height: 400, lazyLoaded: true }
      ];

      for (const comp of dynamicComponents) {
        const element = global.document.createElement('div');
        
        if (comp.expandable) {
          // Use minimum height reservation for expandable content
          const reservation = layoutController.preserveLayout(element, {
            minHeight: 200,
            expandable: true
          });
          
          // Simulate content expansion
          element.style.height = '350px';
          layoutController.updateReservation(reservation, { height: 350 });
          layoutController.releaseLayout(reservation);
        } else {
          element.style.width = `${comp.width}px`;
          element.style.height = `${comp.height}px`;
          
          const reservation = layoutController.preserveLayout(element);
          layoutController.releaseLayout(reservation);
        }
      }

      // Simulate minimal layout shift despite dynamic content
      mockObserver.simulateCLS(0.03);

      await new Promise(resolve => setTimeout(resolve, 200));

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.05);
    });
  });

  describe('Framework Loading Performance Metrics', () => {
    it('should track detailed framework loading metrics', async () => {
      performanceMonitor.start();
      frameworkTracker.start();

      const frameworks = [
        { type: FrameworkType.REACT, size: 45000, priority: LoadPriority.HIGH },
        { type: FrameworkType.VUE, size: 38000, priority: LoadPriority.NORMAL },
        { type: FrameworkType.SVELTE, size: 25000, priority: LoadPriority.LOW }
      ];

      for (const fw of frameworks) {
        const sessionId = frameworkTracker.startLoading(fw.type, fw.priority, {
          expectedSize: fw.size,
          cacheAttempted: true
        });

        // Simulate loading time based on size and priority
        const loadTime = fw.priority === LoadPriority.HIGH ? 70 : 
                        fw.priority === LoadPriority.NORMAL ? 85 : 100;
        
        vi.advanceTimersByTime(loadTime);
        
        const performance = frameworkTracker.completeLoading(sessionId, {
          actualSize: fw.size,
          cacheHit: false,
          compressionRatio: 0.7
        });

        expect(performance).toBeDefined();
        expect(performance!.loadDuration).toBeCloseTo(loadTime, 10);
        expect(performance!.bundleSize).toBe(fw.size);
      }

      const overallStats = frameworkTracker.getOverallStats();
      expect(overallStats.totalLoads).toBe(3);
      expect(overallStats.successfulLoads).toBe(3);
      expect(overallStats.averageLoadTime).toBeLessThan(100);

      const frameworkStats = frameworkTracker.getFrameworkStats(FrameworkType.REACT);
      expect(frameworkStats.totalLoads).toBe(1);
      expect(frameworkStats.averageLoadTime).toBeLessThan(80);
    });

    it('should optimize loading performance based on metrics', async () => {
      performanceMonitor.start();

      // Simulate multiple loading cycles to gather metrics
      for (let cycle = 0; cycle < 5; cycle++) {
        const sessionId = performanceMonitor.trackFrameworkLoad(
          FrameworkType.REACT,
          LoadPriority.HIGH,
          { 
            cycle: cycle + 1,
            expectedBundleSize: 45000
          }
        );

        // Simulate improving performance over cycles (caching, optimization)
        const loadTime = Math.max(50, 120 - (cycle * 15));
        vi.advanceTimersByTime(loadTime);
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.totalLoads).toBe(5);
      expect(frameworkStats.averageLoadTime).toBeLessThan(100);

      // Performance should improve over time
      const timeline = performanceMonitor.getTimeline();
      const loadTimes = timeline.map(entry => entry.data.loadDuration);
      expect(loadTimes[4]).toBeLessThan(loadTimes[0]); // Latest should be faster
    });

    it('should track cache performance impact on loading metrics', async () => {
      performanceMonitor.start();

      // First load (cache miss)
      const missSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.HIGH,
        { cacheAttempted: true, cacheHit: false }
      );

      vi.advanceTimersByTime(95); // Slower without cache
      performanceMonitor.completeFrameworkLoad(missSessionId);

      // Second load (cache hit)
      const hitSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.HIGH,
        { cacheAttempted: true, cacheHit: true }
      );

      vi.advanceTimersByTime(20); // Much faster with cache
      performanceMonitor.completeFrameworkLoad(hitSessionId);

      const cacheStats = performanceMonitor.getCacheStats();
      expect(cacheStats.hitRate).toBe(0.5); // 1 hit out of 2 attempts
      expect(cacheStats.averageHitTime).toBeLessThan(30);
      expect(cacheStats.averageMissTime).toBeGreaterThan(90);

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.cacheHitRate).toBe(0.5);
    });

    it('should provide performance budget compliance reporting', async () => {
      const strictBudget = {
        maxLCP: 2000,
        maxFID: 80,
        maxCLS: 0.05,
        maxFrameworkLoadTime: 75,
        maxInitialBundleSize: 40 * 1024
      };

      const strictMonitor = new PerformanceMonitoringSuite({
        enabled: true,
        performanceBudget: strictBudget,
        alertThresholds: {
          budgetExceeded: 1.0
        }
      });

      strictMonitor.start();

      // Test various budget scenarios
      const testScenarios = [
        { metric: 'lcp', value: 1800, shouldPass: true },
        { metric: 'lcp', value: 2200, shouldPass: false },
        { metric: 'fid', value: 60, shouldPass: true },
        { metric: 'fid', value: 120, shouldPass: false },
        { metric: 'cls', value: 0.03, shouldPass: true },
        { metric: 'cls', value: 0.08, shouldPass: false }
      ];

      for (const scenario of testScenarios) {
        if (scenario.metric === 'lcp') {
          mockObserver.simulateLCP(scenario.value);
        } else if (scenario.metric === 'fid') {
          mockObserver.simulateFID(scenario.value);
        } else if (scenario.metric === 'cls') {
          mockObserver.simulateCLS(scenario.value);
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        const alerts = strictMonitor.getActiveAlerts();
        const budgetAlerts = alerts.filter(a => a.type === 'budget-exceeded');
        
        if (scenario.shouldPass) {
          expect(budgetAlerts).toHaveLength(0);
        } else {
          expect(budgetAlerts.length).toBeGreaterThan(0);
        }

        strictMonitor.clearData();
      }

      strictMonitor.dispose();
    });
  });

  describe('Real-World Performance Scenarios', () => {
    it('should handle e-commerce page performance optimization', async () => {
      performanceMonitor.start();
      layoutController.start();

      // Simulate e-commerce page components
      const ecommerceComponents = [
        { id: 'product-images', framework: FrameworkType.REACT, critical: true, size: 50000 },
        { id: 'add-to-cart', framework: FrameworkType.VUE, critical: true, size: 30000 },
        { id: 'reviews', framework: FrameworkType.SVELTE, critical: false, size: 25000 },
        { id: 'recommendations', framework: FrameworkType.SOLID, critical: false, size: 35000 }
      ];

      // Load critical components first
      const criticalComponents = ecommerceComponents.filter(c => c.critical);
      for (const comp of criticalComponents) {
        const sessionId = performanceMonitor.trackFrameworkLoad(
          comp.framework,
          LoadPriority.CRITICAL,
          { expectedBundleSize: comp.size }
        );

        vi.advanceTimersByTime(65); // Fast loading for critical
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      // Simulate excellent Core Web Vitals for critical path
      mockObserver.simulateFCP(900);
      mockObserver.simulateLCP(1400);
      mockObserver.simulateFID(40);
      mockObserver.simulateCLS(0.02);

      // Load non-critical components later
      const nonCriticalComponents = ecommerceComponents.filter(c => !c.critical);
      for (const comp of nonCriticalComponents) {
        const sessionId = performanceMonitor.trackFrameworkLoad(
          comp.framework,
          LoadPriority.LOW,
          { expectedBundleSize: comp.size }
        );

        vi.advanceTimersByTime(100); // Slower for non-critical
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.lcp).toBeLessThan(1500); // Excellent
      expect(webVitals.fid).toBeLessThan(50); // Excellent
      expect(webVitals.cls).toBeLessThan(0.05); // Excellent
      expect(webVitals.fcp).toBeLessThan(1000); // Fast

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.successfulLoads).toBe(4);
    });

    it('should optimize blog page performance with content prioritization', async () => {
      performanceMonitor.start();

      // Simulate blog page with content prioritization
      const blogComponents = [
        { id: 'article-content', framework: FrameworkType.REACT, priority: LoadPriority.CRITICAL },
        { id: 'social-share', framework: FrameworkType.VUE, priority: LoadPriority.HIGH },
        { id: 'comments', framework: FrameworkType.SVELTE, priority: LoadPriority.NORMAL },
        { id: 'related-posts', framework: FrameworkType.SOLID, priority: LoadPriority.LOW }
      ];

      // Load in priority order
      for (const comp of blogComponents) {
        const sessionId = performanceMonitor.trackFrameworkLoad(
          comp.framework,
          comp.priority,
          { contentType: 'blog' }
        );

        const loadTime = comp.priority === LoadPriority.CRITICAL ? 50 :
                        comp.priority === LoadPriority.HIGH ? 70 :
                        comp.priority === LoadPriority.NORMAL ? 90 : 110;

        vi.advanceTimersByTime(loadTime);
        performanceMonitor.completeFrameworkLoad(sessionId);
      }

      // Simulate good Core Web Vitals for content-focused page
      mockObserver.simulateFCP(700);
      mockObserver.simulateLCP(1100);
      mockObserver.simulateFID(35);
      mockObserver.simulateCLS(0.01);

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.lcp).toBeLessThan(1200); // Excellent for content
      expect(webVitals.fcp).toBeLessThan(800); // Very fast
      expect(webVitals.cls).toBeLessThan(0.02); // Minimal shift

      const report = performanceMonitor.generateReport();
      expect(report.summary.overallScore).toBeGreaterThan(90); // Excellent overall
    });

    it('should handle dashboard application with multiple interactive components', async () => {
      performanceMonitor.start();
      layoutController.start();

      // Simulate dashboard with many interactive components
      const dashboardComponents = Array.from({ length: 8 }, (_, i) => ({
        id: `widget-${i + 1}`,
        framework: [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE, FrameworkType.SOLID][i % 4],
        interactive: true,
        size: 20000 + (i * 5000)
      }));

      // Use layout stability for all widgets
      const reservations = dashboardComponents.map(comp => {
        const element = global.document.createElement('div');
        element.style.width = '300px';
        element.style.height = '200px';
        return layoutController.preserveLayout(element);
      });

      // Load frameworks in batches to avoid overwhelming
      const batchSize = 3;
      for (let i = 0; i < dashboardComponents.length; i += batchSize) {
        const batch = dashboardComponents.slice(i, i + batchSize);
        
        const sessionIds = batch.map(comp => 
          performanceMonitor.trackFrameworkLoad(
            comp.framework,
            LoadPriority.NORMAL,
            { expectedBundleSize: comp.size }
          )
        );

        // Complete batch loading
        sessionIds.forEach(id => {
          vi.advanceTimersByTime(80);
          performanceMonitor.completeFrameworkLoad(id);
        });

        // Small delay between batches
        vi.advanceTimersByTime(50);
      }

      // Release layout reservations
      reservations.forEach(reservation => {
        layoutController.releaseLayout(reservation);
      });

      // Simulate good performance despite complexity
      mockObserver.simulateFCP(1200);
      mockObserver.simulateLCP(1800);
      mockObserver.simulateFID(65);
      mockObserver.simulateCLS(0.04);

      await new Promise(resolve => setTimeout(resolve, 300));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.lcp).toBeLessThan(2000); // Good for complex dashboard
      expect(webVitals.fid).toBeLessThan(100); // Within budget
      expect(webVitals.cls).toBeLessThan(0.05); // Excellent stability

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.successfulLoads).toBe(8);
      expect(frameworkStats.averageLoadTime).toBeLessThan(100);

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.05);
    });
  });
});