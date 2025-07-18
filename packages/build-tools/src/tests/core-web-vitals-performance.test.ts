/**
 * Core Web Vitals and Performance Tests
 * Comprehensive performance tests for Core Web Vitals and loading metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitoringSuite } from '../performance-monitoring/index.js';
import { FrameworkLoaderService } from '../framework-loader/index.js';
import { LayoutStabilityController } from '../layout-stability/index.js';
import { NetworkAdaptationCoordinator } from '../network-adaptation/index.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

// Mock Performance APIs
const mockPerformanceEntries: PerformanceEntry[] = [];
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
  getEntriesByType: vi.fn((type: string) => {
    return mockPerformanceEntries.filter(entry => entry.entryType === type);
  }),
  getEntriesByName: vi.fn((name: string) => {
    return mockPerformanceEntries.filter(entry => entry.name === name);
  }),
  timing: {
    navigationStart: Date.now() - 5000,
    loadEventEnd: Date.now() - 1000,
    domContentLoadedEventEnd: Date.now() - 2000,
    responseStart: Date.now() - 4000,
    responseEnd: Date.now() - 3500
  }
};

// Mock PerformanceObserver
class MockPerformanceObserver {
  private callback: (list: any) => void;
  private entries: PerformanceEntry[] = [];
  
  constructor(callback: (list: any) => void) {
    this.callback = callback;
  }
  
  observe(options: any) {
    // Simulate observing performance entries
    setTimeout(() => {
      this.callback({
        getEntries: () => this.entries,
        getEntriesByType: (type: string) => this.entries.filter(e => e.entryType === type),
        getEntriesByName: (name: string) => this.entries.filter(e => e.name === name)
      });
    }, 100);
  }
  
  disconnect() {}
  
  // Helper to simulate performance entries
  simulateEntry(entry: Partial<PerformanceEntry>) {
    const fullEntry = {
      name: entry.name || 'test-entry',
      entryType: entry.entryType || 'measure',
      startTime: entry.startTime || Date.now(),
      duration: entry.duration || 100,
      ...entry
    } as PerformanceEntry;
    
    this.entries.push(fullEntry);
    mockPerformanceEntries.push(fullEntry);
  }
}

// Mock Web Vitals specific entries
const createLCPEntry = (value: number) => ({
  name: 'largest-contentful-paint',
  entryType: 'largest-contentful-paint',
  startTime: value,
  duration: 0,
  size: 1000,
  renderTime: value,
  loadTime: value + 50,
  element: document.createElement('div')
});

const createFIDEntry = (value: number) => ({
  name: 'first-input',
  entryType: 'first-input',
  startTime: Date.now(),
  duration: 0,
  processingStart: Date.now() + value,
  processingEnd: Date.now() + value + 10,
  cancelable: true
});

const createCLSEntry = (value: number) => ({
  name: 'layout-shift',
  entryType: 'layout-shift',
  startTime: Date.now(),
  duration: 0,
  value: value,
  hadRecentInput: false,
  sources: []
});

describe('Core Web Vitals Performance Tests', () => {
  let performanceMonitor: PerformanceMonitoringSuite;
  let frameworkLoader: FrameworkLoaderService;
  let layoutController: LayoutStabilityController;
  let networkCoordinator: NetworkAdaptationCoordinator;

  beforeEach(() => {
    // Setup global mocks
    global.performance = mockPerformance as any;
    global.PerformanceObserver = MockPerformanceObserver as any;
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn((cb: Function) => setTimeout(cb, 16)),
      performance: mockPerformance
    } as any;
    global.document = {
      createElement: vi.fn(() => ({
        getBoundingClientRect: () => ({ width: 100, height: 50, top: 0, left: 0 })
      })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;

    // Initialize components
    performanceMonitor = new PerformanceMonitoringSuite({
      enabled: true,
      collectWebVitals: true,
      collectFrameworkMetrics: true,
      performanceBudget: {
        maxInitialBundleSize: 50 * 1024, // 50KB
        maxFrameworkLoadTime: 100, // 100ms
        maxCLS: 0.1,
        maxLCP: 2500, // 2.5s
        maxFID: 100, // 100ms
        maxTTFB: 600 // 600ms
      }
    });

    frameworkLoader = new FrameworkLoaderService({
      enableServiceWorker: true,
      enableIntelligentPreloading: true,
      targetLoadTime: 100
    });

    layoutController = new LayoutStabilityController({
      targetCLS: 0.1,
      enablePlaceholders: true
    });

    networkCoordinator = new NetworkAdaptationCoordinator();

    vi.clearAllMocks();
  });

  afterEach(() => {
    performanceMonitor.dispose();
    frameworkLoader.destroy();
    layoutController.destroy();
    networkCoordinator.destroy();
    vi.restoreAllMocks();
    mockPerformanceEntries.length = 0;
  });

  describe('Largest Contentful Paint (LCP) Optimization', () => {
    it('should measure LCP and stay within budget', async () => {
      performanceMonitor.start();

      // Simulate good LCP
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createLCPEntry(2000)); // 2s - good LCP

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.lcp).toBeLessThanOrEqual(2500); // Within budget

      const alerts = performanceMonitor.getActiveAlerts();
      const lcpAlerts = alerts.filter(alert => alert.metric === 'lcp');
      expect(lcpAlerts).toHaveLength(0); // No alerts for good LCP
    });

    it('should detect poor LCP and provide optimization suggestions', async () => {
      performanceMonitor.start();

      // Simulate poor LCP
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createLCPEntry(4000)); // 4s - poor LCP

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
    });

    it('should optimize LCP through framework lazy loading', async () => {
      performanceMonitor.start();

      // Simulate initial page load without frameworks
      const initialLCP = 1800; // Good initial LCP
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createLCPEntry(initialLCP));

      // Load framework on-demand
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { cacheAttempted: true, expectedBundleSize: 45000 }
      );

      // Simulate fast framework loading
      vi.advanceTimersByTime(80); // 80ms load time
      performanceMonitor.completeFrameworkLoad(sessionId);

      await new Promise(resolve => setTimeout(resolve, 200));

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeLessThan(100); // Within target

      // LCP should remain good
      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.lcp).toBeLessThan(2500);
    });
  });

  describe('First Input Delay (FID) Optimization', () => {
    it('should measure FID and maintain responsiveness', async () => {
      performanceMonitor.start();

      // Simulate good FID
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createFIDEntry(50)); // 50ms - good FID

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.fid).toBeLessThanOrEqual(100); // Within budget

      const alerts = performanceMonitor.getActiveAlerts();
      const fidAlerts = alerts.filter(alert => alert.metric === 'fid');
      expect(fidAlerts).toHaveLength(0);
    });

    it('should detect poor FID and suggest main thread optimization', async () => {
      performanceMonitor.start();

      // Simulate poor FID
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createFIDEntry(200)); // 200ms - poor FID

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.fid).toBeGreaterThan(100); // Exceeds budget

      const suggestions = performanceMonitor.getOptimizationSuggestions();
      const fidSuggestions = suggestions.filter(s => s.metric === 'fid');
      expect(fidSuggestions.length).toBeGreaterThan(0);
      expect(fidSuggestions[0].suggestions).toContain('main thread');
    });

    it('should optimize FID through service worker offloading', async () => {
      performanceMonitor.start();

      // Simulate framework loading with service worker
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.NORMAL,
        { 
          cacheAttempted: true,
          serviceWorkerUsed: true,
          backgroundExecution: true
        }
      );

      // Complete loading quickly due to service worker
      vi.advanceTimersByTime(60);
      performanceMonitor.completeFrameworkLoad(sessionId);

      // Simulate good FID due to reduced main thread blocking
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createFIDEntry(40)); // 40ms - excellent FID

      await new Promise(resolve => setTimeout(resolve, 200));

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.fid).toBeLessThan(50); // Excellent FID
    });
  });

  describe('Cumulative Layout Shift (CLS) Prevention', () => {
    it('should measure CLS and prevent layout shifts', async () => {
      performanceMonitor.start();
      layoutController.start();

      // Create element that might cause layout shift
      const element = document.createElement('div');
      element.style.width = '300px';
      element.style.height = '200px';

      // Preserve layout before framework loading
      const reservation = layoutController.preserveLayout(element);

      // Simulate framework loading and hydration
      const sessionId = performanceMonitor.trackFrameworkLoad(FrameworkType.SVELTE);
      
      vi.advanceTimersByTime(90);
      performanceMonitor.completeFrameworkLoad(sessionId);

      // Release layout after hydration
      layoutController.releaseLayout(reservation);

      // Simulate minimal layout shift
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createCLSEntry(0.05)); // 0.05 - good CLS

      await new Promise(resolve => setTimeout(resolve, 200));

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.1); // Within budget

      const webVitals = performanceMonitor.getWebVitals();
      expect(webVitals.cls).toBeLessThan(0.1);
    });

    it('should detect and prevent significant layout shifts', async () => {
      performanceMonitor.start();
      layoutController.start();

      // Simulate significant layout shift without protection
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createCLSEntry(0.25)); // 0.25 - poor CLS

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
    });

    it('should optimize CLS through placeholder management', async () => {
      performanceMonitor.start();
      layoutController.start();

      // Create multiple elements that will be hydrated
      const elements = [
        { id: 'comp1', width: 300, height: 200 },
        { id: 'comp2', width: 250, height: 150 },
        { id: 'comp3', width: 400, height: 100 }
      ];

      const reservations = elements.map(el => {
        const element = document.createElement('div');
        element.id = el.id;
        element.style.width = `${el.width}px`;
        element.style.height = `${el.height}px`;
        return layoutController.preserveLayout(element);
      });

      // Load frameworks and hydrate components
      const sessionIds = [
        performanceMonitor.trackFrameworkLoad(FrameworkType.REACT),
        performanceMonitor.trackFrameworkLoad(FrameworkType.VUE),
        performanceMonitor.trackFrameworkLoad(FrameworkType.SVELTE)
      ];

      // Complete loading
      sessionIds.forEach(id => {
        vi.advanceTimersByTime(70);
        performanceMonitor.completeFrameworkLoad(id);
      });

      // Release all reservations
      reservations.forEach(reservation => {
        layoutController.releaseLayout(reservation);
      });

      // Simulate minimal layout shift due to good placeholder management
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createCLSEntry(0.03)); // 0.03 - excellent CLS

      await new Promise(resolve => setTimeout(resolve, 200));

      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.05); // Excellent CLS
    });
  });

  describe('Framework Loading Performance', () => {
    it('should meet framework loading time budgets', async () => {
      performanceMonitor.start();

      const frameworks = [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE];
      const sessionIds: string[] = [];

      // Start loading all frameworks
      frameworks.forEach(framework => {
        const sessionId = performanceMonitor.trackFrameworkLoad(
          framework,
          LoadPriority.HIGH,
          { cacheAttempted: true, expectedBundleSize: 40000 }
        );
        sessionIds.push(sessionId);
      });

      // Complete loading within budget
      sessionIds.forEach(sessionId => {
        vi.advanceTimersByTime(85); // 85ms - within 100ms budget
        performanceMonitor.completeFrameworkLoad(sessionId);
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeLessThan(100);
      expect(frameworkStats.successfulLoads).toBe(3);

      const alerts = performanceMonitor.getActiveAlerts();
      const loadTimeAlerts = alerts.filter(alert => alert.type === 'budget-exceeded');
      expect(loadTimeAlerts).toHaveLength(0);
    });

    it('should optimize loading through intelligent preloading', async () => {
      performanceMonitor.start();

      // Simulate preloading based on viewport visibility
      const preloadSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.LOW, // Preload priority
        { 
          cacheAttempted: true,
          preloadReason: 'viewport',
          expectedBundleSize: 45000
        }
      );

      // Complete preload
      vi.advanceTimersByTime(120); // Slower for preload
      performanceMonitor.completeFrameworkLoad(preloadSessionId);

      // Later, load same framework for actual use (should be cached)
      const actualSessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.REACT,
        LoadPriority.HIGH,
        { cacheAttempted: true, cacheHit: true }
      );

      // Should complete very quickly due to cache
      vi.advanceTimersByTime(15);
      performanceMonitor.completeFrameworkLoad(actualSessionId);

      await new Promise(resolve => setTimeout(resolve, 100));

      const cacheStats = performanceMonitor.getCacheStats();
      expect(cacheStats.hitRate).toBeGreaterThan(0.5); // Good cache utilization
    });

    it('should adapt loading strategy based on network conditions', async () => {
      performanceMonitor.start();

      // Simulate poor network conditions
      const poorNetworkConditions = {
        effectiveType: '2g' as const,
        downlink: 0.5,
        rtt: 1000,
        saveData: true
      };

      networkCoordinator.updateConfig({
        adaptation: {
          aggressiveness: 'conservative',
          priorityBoosting: false,
          dynamicTimeouts: true
        }
      });

      // Load framework with network adaptation
      const sessionId = performanceMonitor.trackFrameworkLoad(
        FrameworkType.VUE,
        LoadPriority.NORMAL,
        { 
          networkConditions: poorNetworkConditions,
          adaptedTimeout: 5000, // Longer timeout for poor network
          compressionUsed: true
        }
      );

      // Complete loading (slower due to poor network)
      vi.advanceTimersByTime(300);
      performanceMonitor.completeFrameworkLoad(sessionId);

      await new Promise(resolve => setTimeout(resolve, 100));

      const networkMetrics = performanceMonitor.getMetrics().network;
      expect(networkMetrics.adaptationEvents).toBeGreaterThan(0);
    });
  });

  describe('Bundle Size Optimization', () => {
    it('should maintain bundle size within budget', async () => {
      performanceMonitor.start();

      // Track initial bundle size
      const initialBundleSize = 45 * 1024; // 45KB - within 50KB budget
      performanceMonitor.recordBundleMetrics({
        initialSize: initialBundleSize,
        frameworkSizes: {
          [FrameworkType.REACT]: 20 * 1024,
          [FrameworkType.VUE]: 15 * 1024,
          [FrameworkType.SVELTE]: 10 * 1024
        },
        compressionRatio: 0.7,
        chunkCount: 5
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const bundleMetrics = performanceMonitor.getMetrics().bundle;
      expect(bundleMetrics.initialSize).toBeLessThanOrEqual(50 * 1024);

      const alerts = performanceMonitor.getActiveAlerts();
      const bundleSizeAlerts = alerts.filter(alert => alert.type === 'bundle-size-exceeded');
      expect(bundleSizeAlerts).toHaveLength(0);
    });

    it('should detect bundle size budget violations', async () => {
      performanceMonitor.start();

      // Track oversized bundle
      const oversizedBundle = 75 * 1024; // 75KB - exceeds 50KB budget
      performanceMonitor.recordBundleMetrics({
        initialSize: oversizedBundle,
        frameworkSizes: {
          [FrameworkType.REACT]: 35 * 1024,
          [FrameworkType.VUE]: 25 * 1024,
          [FrameworkType.SVELTE]: 15 * 1024
        },
        compressionRatio: 0.8,
        chunkCount: 3
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const alerts = performanceMonitor.getActiveAlerts();
      const bundleSizeAlerts = alerts.filter(alert => alert.type === 'bundle-size-exceeded');
      expect(bundleSizeAlerts.length).toBeGreaterThan(0);

      const suggestions = performanceMonitor.getOptimizationSuggestions();
      const bundleSuggestions = suggestions.filter(s => s.category === 'bundle-optimization');
      expect(bundleSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should provide comprehensive performance report', async () => {
      performanceMonitor.start();

      // Simulate complete page load cycle
      const sessionIds = [
        performanceMonitor.trackFrameworkLoad(FrameworkType.REACT, LoadPriority.HIGH),
        performanceMonitor.trackFrameworkLoad(FrameworkType.VUE, LoadPriority.NORMAL)
      ];

      sessionIds.forEach(id => {
        vi.advanceTimersByTime(90);
        performanceMonitor.completeFrameworkLoad(id);
      });

      // Simulate Web Vitals
      const observer = new MockPerformanceObserver(() => {});
      observer.simulateEntry(createLCPEntry(2200));
      observer.simulateEntry(createFIDEntry(60));
      observer.simulateEntry(createCLSEntry(0.08));

      await new Promise(resolve => setTimeout(resolve, 300));

      const report = performanceMonitor.generateReport();
      
      expect(report).toBeDefined();
      expect(report.summary.totalPageLoads).toBeGreaterThan(0);
      expect(report.metrics.webVitals).toBeDefined();
      expect(report.metrics.frameworkLoading).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);

      // Verify all Core Web Vitals are within budget
      expect(report.metrics.webVitals.lcp).toBeLessThan(2500);
      expect(report.metrics.webVitals.fid).toBeLessThan(100);
      expect(report.metrics.webVitals.cls).toBeLessThan(0.1);
    });

    it('should track performance trends over time', async () => {
      performanceMonitor.start();

      // Simulate multiple page loads with improving performance
      const loadTimes = [120, 100, 85, 70, 60]; // Improving over time

      for (let i = 0; i < loadTimes.length; i++) {
        const sessionId = performanceMonitor.trackFrameworkLoad(FrameworkType.REACT);
        vi.advanceTimersByTime(loadTimes[i]);
        performanceMonitor.completeFrameworkLoad(sessionId);
        
        // Wait between loads
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const timeline = performanceMonitor.getTimeline();
      expect(timeline.length).toBe(loadTimes.length);

      // Verify performance improvement trend
      const frameworkStats = performanceMonitor.getFrameworkStats();
      expect(frameworkStats.averageLoadTime).toBeLessThan(loadTimes[0]); // Better than initial
    });
  });

  describe('Performance Budget Enforcement', () => {
    it('should enforce all performance budgets', async () => {
      const strictBudget = {
        maxInitialBundleSize: 30 * 1024, // 30KB - strict
        maxFrameworkLoadTime: 80, // 80ms - strict
        maxCLS: 0.05, // 0.05 - strict
        maxLCP: 2000, // 2s - strict
        maxFID: 80, // 80ms - strict
        maxTTFB: 500 // 500ms - strict
      };

      const strictMonitor = new PerformanceMonitoringSuite({
        enabled: true,
        performanceBudget: strictBudget,
        alertThresholds: {
          budgetExceeded: 1.0, // Alert immediately on budget violation
          performanceDegradation: 0.1
        }
      });

      strictMonitor.start();

      // Test bundle size budget
      strictMonitor.recordBundleMetrics({
        initialSize: 35 * 1024, // Exceeds 30KB budget
        frameworkSizes: {},
        compressionRatio: 0.8,
        chunkCount: 2
      });

      // Test framework loading budget
      const sessionId = strictMonitor.trackFrameworkLoad(FrameworkType.REACT);
      vi.advanceTimersByTime(100); // Exceeds 80ms budget
      strictMonitor.completeFrameworkLoad(sessionId);

      await new Promise(resolve => setTimeout(resolve, 200));

      const alerts = strictMonitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      const budgetViolations = alerts.filter(alert => alert.type === 'budget-exceeded');
      expect(budgetViolations.length).toBeGreaterThan(0);

      strictMonitor.dispose();
    });
  });
});