/**
 * Performance Monitoring Tests
 * Comprehensive tests for all performance monitoring components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PerformanceMonitor,
  FrameworkLoadingTracker,
  CachePerformanceMonitor,
  WebVitalsMonitor,
  ServiceWorkerDebugger,
  PerformanceMonitoringSuite,
  createDefaultConfig,
  createPerformanceMonitoringSuite
} from '../performance-monitoring/index.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

// Mock Performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(() => [])
};

// Mock PerformanceObserver
class MockPerformanceObserver {
  private callback: (list: any) => void;
  
  constructor(callback: (list: any) => void) {
    this.callback = callback;
  }
  
  observe() {}
  disconnect() {}
  
  // Helper method to simulate entries
  simulateEntries(entries: any[]) {
    this.callback({
      getEntries: () => entries
    });
  }
}

// Mock Navigator
const mockNavigator = {
  serviceWorker: {
    ready: Promise.resolve({
      active: { state: 'activated' }
    }),
    controller: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  },
  onLine: true,
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  },
  userAgent: 'test-agent',
  hardwareConcurrency: 4
};

describe('Performance Monitoring System', () => {
  beforeEach(() => {
    // Setup global mocks
    global.performance = mockPerformance as any;
    global.PerformanceObserver = MockPerformanceObserver as any;
    global.navigator = mockNavigator as any;
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;
    
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;
    const config = createDefaultConfig();

    beforeEach(() => {
      monitor = new PerformanceMonitor(config);
    });

    afterEach(() => {
      monitor.dispose();
    });

    it('should initialize with correct configuration', () => {
      expect(monitor).toBeDefined();
    });

    it('should record framework loading performance', () => {
      const performance = {
        framework: FrameworkType.REACT,
        loadStartTime: 1000,
        loadEndTime: 1100,
        loadDuration: 100,
        cacheHit: true,
        bundleSize: 50000,
        priority: LoadPriority.HIGH
      };

      monitor.recordFrameworkLoad(performance);
      
      const timeline = monitor.getTimeline();
      expect(timeline).toHaveLength(1);
      expect(timeline[0].type).toBe('framework-load');
      expect(timeline[0].data).toEqual(performance);
    });

    it('should generate performance reports', () => {
      const report = monitor.generateReport();
      
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('recommendations');
    });

    it('should track active alerts', () => {
      // Simulate a performance budget violation
      const performance = {
        framework: FrameworkType.REACT,
        loadStartTime: 1000,
        loadEndTime: 1500, // 500ms - exceeds budget
        loadDuration: 500,
        cacheHit: false,
        bundleSize: 100000,
        priority: LoadPriority.CRITICAL
      };

      monitor.recordFrameworkLoad(performance);
      
      const alerts = monitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('budget-exceeded');
    });
  });

  describe('FrameworkLoadingTracker', () => {
    let tracker: FrameworkLoadingTracker;

    beforeEach(() => {
      tracker = new FrameworkLoadingTracker();
    });

    it('should track framework loading sessions', () => {
      const sessionId = tracker.startLoading(FrameworkType.REACT, LoadPriority.HIGH);
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toContain('react');
      
      const activeSessions = tracker.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].framework).toBe(FrameworkType.REACT);
    });

    it('should complete loading sessions and generate metrics', () => {
      const sessionId = tracker.startLoading(FrameworkType.VUE, LoadPriority.NORMAL);
      
      // Simulate some time passing
      vi.advanceTimersByTime(50);
      
      const performance = tracker.completeLoading(sessionId);
      
      expect(performance).toBeDefined();
      expect(performance!.framework).toBe(FrameworkType.VUE);
      expect(performance!.loadDuration).toBeGreaterThan(0);
      
      const activeSessions = tracker.getActiveSessions();
      expect(activeSessions).toHaveLength(0);
    });

    it('should generate framework statistics', () => {
      // Create multiple loading sessions
      const sessionIds = [
        tracker.startLoading(FrameworkType.REACT, LoadPriority.HIGH),
        tracker.startLoading(FrameworkType.REACT, LoadPriority.NORMAL),
        tracker.startLoading(FrameworkType.VUE, LoadPriority.LOW)
      ];

      // Complete sessions
      sessionIds.forEach(id => {
        vi.advanceTimersByTime(Math.random() * 100);
        tracker.completeLoading(id);
      });

      const reactStats = tracker.getFrameworkStats(FrameworkType.REACT);
      expect(reactStats.totalLoads).toBe(2);
      expect(reactStats.successfulLoads).toBe(2);
      expect(reactStats.framework).toBe(FrameworkType.REACT);

      const overallStats = tracker.getOverallStats();
      expect(overallStats.totalLoads).toBe(3);
      expect(overallStats.successfulLoads).toBe(3);
    });
  });

  describe('CachePerformanceMonitor', () => {
    let monitor: CachePerformanceMonitor;

    beforeEach(() => {
      monitor = new CachePerformanceMonitor();
    });

    it('should track cache operations', () => {
      const operationId = monitor.startOperation('get', 'test-key', {
        framework: FrameworkType.REACT
      });
      
      expect(operationId).toBeDefined();
      expect(operationId).toContain('cache_op_');
    });

    it('should complete cache operations and generate metrics', () => {
      const operationId = monitor.startOperation('put', 'framework-react', {
        framework: FrameworkType.REACT,
        expectedSize: 50000
      });
      
      vi.advanceTimersByTime(25);
      
      const metrics = monitor.completeOperation(operationId, {
        success: true,
        cacheSize: 1000000,
        dataSize: 50000,
        hit: false
      });
      
      expect(metrics).toBeDefined();
      expect(metrics!.operation).toBe('put');
      expect(metrics!.success).toBe(true);
      expect(metrics!.duration).toBeGreaterThan(0);
    });

    it('should generate cache statistics', () => {
      // Simulate multiple cache operations
      const operations = [
        { op: 'get', key: 'react-core', hit: true },
        { op: 'get', key: 'vue-core', hit: false },
        { op: 'put', key: 'vue-core', hit: false },
        { op: 'get', key: 'vue-core', hit: true }
      ];

      operations.forEach(({ op, key, hit }) => {
        const id = monitor.startOperation(op as any, key);
        vi.advanceTimersByTime(10);
        monitor.completeOperation(id, {
          success: true,
          hit: op === 'get' ? hit : undefined
        });
      });

      const stats = monitor.getCacheStats();
      expect(stats.totalOperations).toBe(4);
      expect(stats.successfulOperations).toBe(4);
      expect(stats.hitRate).toBeCloseTo(0.67, 1); // 2 hits out of 3 get operations
    });

    it('should provide cache efficiency recommendations', () => {
      // Simulate poor cache performance
      for (let i = 0; i < 10; i++) {
        const id = monitor.startOperation('get', `key-${i}`);
        vi.advanceTimersByTime(100); // Slow operations
        monitor.completeOperation(id, {
          success: true,
          hit: false // All misses
        });
      }

      const efficiency = monitor.getEfficiencyReport();
      expect(efficiency.hitRate).toBe(0);
      expect(efficiency.averageResponseTime).toBeGreaterThan(50);
      expect(efficiency.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('WebVitalsMonitor', () => {
    let monitor: WebVitalsMonitor;

    beforeEach(() => {
      monitor = new WebVitalsMonitor();
    });

    afterEach(() => {
      monitor.stopMonitoring();
    });

    it('should start and stop monitoring', () => {
      monitor.startMonitoring();
      expect(monitor['isMonitoring']).toBe(true);
      
      monitor.stopMonitoring();
      expect(monitor['isMonitoring']).toBe(false);
    });

    it('should provide optimization suggestions for poor vitals', () => {
      // Simulate poor web vitals
      monitor['recordVital']('lcp', 5000); // Poor LCP
      monitor['recordVital']('cls', 0.3);  // Poor CLS
      monitor['recordVital']('fid', 400);  // Poor FID

      const suggestions = monitor.getOptimizationSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
      
      const lcpSuggestion = suggestions.find(s => s.metric === 'lcp');
      expect(lcpSuggestion).toBeDefined();
      expect(lcpSuggestion!.priority).toBe('high');
      expect(lcpSuggestion!.suggestions.length).toBeGreaterThan(0);
    });

    it('should track web vitals trends', () => {
      // Simulate improving performance over time
      const values = [3000, 2800, 2600, 2400, 2200];
      values.forEach((value, index) => {
        monitor['recordVital']('lcp', value);
        vi.advanceTimersByTime(1000);
      });

      const trends = monitor.getVitalsTrends();
      const lcpTrend = trends.get('lcp');
      
      expect(lcpTrend).toBeDefined();
      expect(lcpTrend!.values.length).toBe(5);
      expect(lcpTrend!.trend).toBe('improving');
    });
  });

  describe('ServiceWorkerDebugger', () => {
    let swDebugger: ServiceWorkerDebugger;

    beforeEach(() => {
      swDebugger = new ServiceWorkerDebugger();
    });

    afterEach(() => {
      swDebugger.stopDebugging();
    });

    it('should start and stop debugging', () => {
      swDebugger.startDebugging();
      expect(swDebugger['isDebugging']).toBe(true);
      
      swDebugger.stopDebugging();
      expect(swDebugger['isDebugging']).toBe(false);
    });

    it('should track service worker state', () => {
      const state = swDebugger.getServiceWorkerState();
      
      expect(state).toHaveProperty('registration');
      expect(state).toHaveProperty('controller');
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('scope');
    });

    it('should record debug events', () => {
      swDebugger['recordDebugEvent']({
        type: 'cache',
        data: { operation: 'get', key: 'test' },
        success: true
      });

      const events = swDebugger.getDebugEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('cache');
      expect(events[0].success).toBe(true);
    });
  });

  describe('PerformanceMonitoringSuite', () => {
    let suite: PerformanceMonitoringSuite;
    const config = createDefaultConfig();

    beforeEach(() => {
      suite = new PerformanceMonitoringSuite(config);
    });

    afterEach(() => {
      suite.dispose();
    });

    it('should create with default configuration', () => {
      const defaultSuite = createPerformanceMonitoringSuite();
      expect(defaultSuite).toBeDefined();
      defaultSuite.dispose();
    });

    it('should integrate all monitoring components', () => {
      suite.start();
      
      // Test framework loading integration
      const sessionId = suite.trackFrameworkLoad(FrameworkType.REACT, LoadPriority.HIGH);
      expect(sessionId).toBeDefined();
      
      suite.completeFrameworkLoad(sessionId);
      
      // Test cache operation integration
      const cacheOpId = suite.trackCacheOperation('get', 'test-key');
      expect(cacheOpId).toBeDefined();
      
      suite.completeCacheOperation(cacheOpId, {
        success: true,
        hit: true
      });
      
      // Verify integrated metrics
      const metrics = suite.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.frameworkLoading.length).toBeGreaterThan(0);
    });

    it('should generate comprehensive reports', () => {
      // Add some test data
      const sessionId = suite.trackFrameworkLoad(FrameworkType.VUE);
      suite.completeFrameworkLoad(sessionId);
      
      const report = suite.generateReport();
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('recommendations');
    });

    it('should provide visualization data', () => {
      // Add test data
      const sessionId = suite.trackFrameworkLoad(FrameworkType.SVELTE);
      suite.completeFrameworkLoad(sessionId);
      
      const vizData = suite.getVisualizationData();
      expect(vizData).toHaveProperty('timeline');
      expect(vizData).toHaveProperty('charts');
      expect(vizData.charts).toHaveProperty('loadTimes');
      expect(vizData.charts).toHaveProperty('webVitals');
      expect(vizData.charts).toHaveProperty('cachePerformance');
    });

    it('should handle alerts across components', () => {
      const alerts: any[] = [];
      suite.onAlert((alert) => alerts.push(alert));
      
      // Simulate a performance issue that should trigger an alert
      const sessionId = suite.trackFrameworkLoad(FrameworkType.REACT);
      
      // Simulate slow loading
      vi.advanceTimersByTime(200); // Exceeds budget
      suite.completeFrameworkLoad(sessionId);
      
      // Check if alert was triggered
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should export comprehensive data', () => {
      // Add some test data
      const sessionId = suite.trackFrameworkLoad(FrameworkType.SOLID);
      suite.completeFrameworkLoad(sessionId);
      
      const exportData = suite.exportAllData();
      
      expect(exportData).toHaveProperty('metrics');
      expect(exportData).toHaveProperty('frameworkStats');
      expect(exportData).toHaveProperty('cacheStats');
      expect(exportData).toHaveProperty('webVitals');
      expect(exportData).toHaveProperty('serviceWorkerDebug');
      expect(exportData).toHaveProperty('visualization');
    });

    it('should clear all data', () => {
      // Add test data
      const sessionId = suite.trackFrameworkLoad(FrameworkType.REACT);
      suite.completeFrameworkLoad(sessionId);
      
      // Verify data exists
      let timeline = suite.getTimeline();
      expect(timeline.length).toBeGreaterThan(0);
      
      // Clear data
      suite.clearData();
      
      // Verify data is cleared
      timeline = suite.getTimeline();
      expect(timeline.length).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should create default configuration', () => {
      const config = createDefaultConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.collectWebVitals).toBe(true);
      expect(config.collectFrameworkMetrics).toBe(true);
      expect(config.collectServiceWorkerMetrics).toBe(true);
      expect(config.performanceBudget).toBeDefined();
      expect(config.alertThresholds).toBeDefined();
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        enabled: false,
        sampleRate: 0.5,
        performanceBudget: {
          maxFrameworkLoadTime: 200
        }
      };
      
      const suite = createPerformanceMonitoringSuite(customConfig);
      expect(suite).toBeDefined();
      suite.dispose();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing Performance API gracefully', () => {
      // Remove performance API
      delete (global as any).performance;
      
      expect(() => {
        const monitor = new PerformanceMonitor(createDefaultConfig());
        monitor.dispose();
      }).not.toThrow();
    });

    it('should handle missing PerformanceObserver gracefully', () => {
      // Remove PerformanceObserver
      delete (global as any).PerformanceObserver;
      
      expect(() => {
        const monitor = new WebVitalsMonitor();
        monitor.startMonitoring();
        monitor.stopMonitoring();
      }).not.toThrow();
    });

    it('should handle service worker unavailability', () => {
      // Remove service worker support
      delete (global as any).navigator.serviceWorker;
      
      expect(() => {
        const swDebugger = new ServiceWorkerDebugger();
        swDebugger.startDebugging();
        swDebugger.stopDebugging();
      }).not.toThrow();
    });
  });
});

describe('Performance Monitoring Integration', () => {
  it('should work with real-world scenarios', async () => {
    const suite = createPerformanceMonitoringSuite({
      enableDebugMode: true,
      sampleRate: 1.0
    });

    suite.start();

    // Simulate a complete framework loading cycle
    const reactSession = suite.trackFrameworkLoad(FrameworkType.REACT, LoadPriority.CRITICAL, {
      cacheAttempted: true,
      expectedBundleSize: 45000
    });

    // Simulate cache operations
    const cacheGet = suite.trackCacheOperation('get', 'react-core', {
      framework: FrameworkType.REACT
    });

    // Complete cache operation (cache miss)
    suite.completeCacheOperation(cacheGet, {
      success: true,
      hit: false,
      cacheSize: 1000000
    });

    // Simulate network fetch and cache put
    const cachePut = suite.trackCacheOperation('put', 'react-core', {
      framework: FrameworkType.REACT,
      expectedSize: 45000
    });

    suite.completeCacheOperation(cachePut, {
      success: true,
      cacheSize: 1045000,
      dataSize: 45000
    });

    // Complete framework loading
    suite.completeFrameworkLoad(reactSession);

    // Generate comprehensive report
    const report = suite.generateReport();
    expect(report.summary.totalPageLoads).toBeGreaterThan(0);

    // Get optimization suggestions
    const suggestions = suite.getOptimizationSuggestions();
    expect(Array.isArray(suggestions)).toBe(true);

    // Get visualization data
    const vizData = suite.getVisualizationData();
    expect(vizData.timeline.length).toBeGreaterThan(0);

    suite.dispose();
  });
});