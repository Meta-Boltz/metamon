/**
 * Simple Performance Monitoring Tests
 * Basic tests for performance monitoring components without complex mocking
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultConfig,
  createPerformanceMonitoringSuite
} from '../performance-monitoring/index.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

describe('Performance Monitoring - Basic Functionality', () => {
  describe('Configuration', () => {
    it('should create default configuration', () => {
      const config = createDefaultConfig();
      
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.collectWebVitals).toBe(true);
      expect(config.collectFrameworkMetrics).toBe(true);
      expect(config.collectServiceWorkerMetrics).toBe(true);
      expect(config.performanceBudget).toBeDefined();
      expect(config.alertThresholds).toBeDefined();
      expect(config.sampleRate).toBe(1.0);
      expect(config.maxEntriesPerType).toBe(1000);
    });

    it('should have reasonable performance budget defaults', () => {
      const config = createDefaultConfig();
      const budget = config.performanceBudget;
      
      expect(budget.maxInitialBundleSize).toBe(50 * 1024); // 50KB
      expect(budget.maxFrameworkLoadTime).toBe(100); // 100ms
      expect(budget.maxCLS).toBe(0.1);
      expect(budget.maxLCP).toBe(2500); // 2.5s
      expect(budget.maxFID).toBe(100); // 100ms
    });
  });

  describe('Performance Monitoring Suite Creation', () => {
    it('should create suite with default configuration', () => {
      const suite = createPerformanceMonitoringSuite();
      expect(suite).toBeDefined();
      suite.dispose();
    });

    it('should create suite with custom configuration', () => {
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

  describe('Framework Loading Tracking', () => {
    it('should track framework loading sessions', () => {
      const suite = createPerformanceMonitoringSuite();
      
      // Track a framework loading session
      const sessionId = suite.trackFrameworkLoad(FrameworkType.REACT, LoadPriority.HIGH);
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toContain('react');
      
      suite.dispose();
    });

    it('should handle different framework types', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const frameworks = [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE, FrameworkType.SOLID];
      const sessionIds = frameworks.map(framework => 
        suite.trackFrameworkLoad(framework, LoadPriority.NORMAL)
      );
      
      expect(sessionIds).toHaveLength(4);
      sessionIds.forEach((id, index) => {
        expect(id).toContain(frameworks[index]);
      });
      
      suite.dispose();
    });
  });

  describe('Cache Operation Tracking', () => {
    it('should track cache operations', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const operationId = suite.trackCacheOperation('get', 'test-key');
      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
      expect(operationId).toContain('cache_op_');
      
      suite.dispose();
    });

    it('should handle different cache operation types', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const operations = ['get', 'put', 'delete', 'match'] as const;
      const operationIds = operations.map(op => 
        suite.trackCacheOperation(op, `test-key-${op}`)
      );
      
      expect(operationIds).toHaveLength(4);
      operationIds.forEach(id => {
        expect(id).toContain('cache_op_');
      });
      
      suite.dispose();
    });
  });

  describe('Metrics Collection', () => {
    it('should provide current metrics', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const metrics = suite.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('sessionId');
      expect(metrics).toHaveProperty('webVitals');
      expect(metrics).toHaveProperty('frameworkLoading');
      expect(metrics).toHaveProperty('serviceWorker');
      expect(metrics).toHaveProperty('network');
      expect(metrics).toHaveProperty('bundle');
      
      suite.dispose();
    });

    it('should generate performance reports', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const report = suite.generateReport();
      expect(report).toBeDefined();
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('timeRange');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('recommendations');
      
      suite.dispose();
    });
  });

  describe('Statistics and Analytics', () => {
    it('should provide framework statistics', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const stats = suite.getFrameworkStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalLoads');
      expect(stats).toHaveProperty('successfulLoads');
      expect(stats).toHaveProperty('failedLoads');
      expect(stats).toHaveProperty('averageLoadTime');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('frameworkStats');
      
      suite.dispose();
    });

    it('should provide cache statistics', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const stats = suite.getCacheStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalOperations');
      expect(stats).toHaveProperty('successfulOperations');
      expect(stats).toHaveProperty('failedOperations');
      expect(stats).toHaveProperty('averageOperationTime');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('missRate');
      
      suite.dispose();
    });

    it('should provide web vitals data', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const webVitals = suite.getWebVitals();
      expect(webVitals).toBeDefined();
      expect(webVitals).toHaveProperty('lcp');
      expect(webVitals).toHaveProperty('fid');
      expect(webVitals).toHaveProperty('cls');
      expect(webVitals).toHaveProperty('fcp');
      expect(webVitals).toHaveProperty('ttfb');
      
      suite.dispose();
    });
  });

  describe('Visualization and Export', () => {
    it('should provide visualization data', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const vizData = suite.getVisualizationData();
      expect(vizData).toBeDefined();
      expect(vizData).toHaveProperty('timeline');
      expect(vizData).toHaveProperty('charts');
      expect(vizData.charts).toHaveProperty('loadTimes');
      expect(vizData.charts).toHaveProperty('webVitals');
      expect(vizData.charts).toHaveProperty('cachePerformance');
      expect(vizData.charts).toHaveProperty('networkUtilization');
      
      suite.dispose();
    });

    it('should export comprehensive data', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const exportData = suite.exportAllData();
      expect(exportData).toBeDefined();
      expect(exportData).toHaveProperty('metrics');
      expect(exportData).toHaveProperty('frameworkStats');
      expect(exportData).toHaveProperty('cacheStats');
      expect(exportData).toHaveProperty('webVitals');
      expect(exportData).toHaveProperty('serviceWorkerDebug');
      expect(exportData).toHaveProperty('visualization');
      
      suite.dispose();
    });
  });

  describe('Alert System', () => {
    it('should provide active alerts', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const alerts = suite.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
      
      suite.dispose();
    });

    it('should provide optimization suggestions', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const suggestions = suite.getOptimizationSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
      
      suite.dispose();
    });
  });

  describe('Timeline and History', () => {
    it('should provide performance timeline', () => {
      const suite = createPerformanceMonitoringSuite();
      
      const timeline = suite.getTimeline();
      expect(Array.isArray(timeline)).toBe(true);
      
      const limitedTimeline = suite.getTimeline(10);
      expect(Array.isArray(limitedTimeline)).toBe(true);
      expect(limitedTimeline.length).toBeLessThanOrEqual(10);
      
      suite.dispose();
    });
  });

  describe('Data Management', () => {
    it('should clear all data', () => {
      const suite = createPerformanceMonitoringSuite();
      
      // Add some test data
      const sessionId = suite.trackFrameworkLoad(FrameworkType.REACT);
      const cacheOpId = suite.trackCacheOperation('get', 'test-key');
      
      // Clear data
      suite.clearData();
      
      // Verify data is cleared
      const timeline = suite.getTimeline();
      expect(timeline.length).toBe(0);
      
      suite.dispose();
    });

    it('should handle disposal properly', () => {
      const suite = createPerformanceMonitoringSuite();
      
      // Should not throw when disposing
      expect(() => suite.dispose()).not.toThrow();
      
      // Should not throw when disposing again
      expect(() => suite.dispose()).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete framework loading cycle', () => {
      const suite = createPerformanceMonitoringSuite();
      
      // Start framework loading
      const sessionId = suite.trackFrameworkLoad(FrameworkType.REACT, LoadPriority.HIGH, {
        cacheAttempted: true,
        expectedBundleSize: 50000
      });
      
      // Complete framework loading
      suite.completeFrameworkLoad(sessionId);
      
      // Verify metrics were recorded
      const stats = suite.getFrameworkStats();
      expect(stats.totalLoads).toBeGreaterThan(0);
      
      suite.dispose();
    });

    it('should handle complete cache operation cycle', () => {
      const suite = createPerformanceMonitoringSuite();
      
      // Start cache operation
      const operationId = suite.trackCacheOperation('get', 'react-core', {
        framework: FrameworkType.REACT,
        expectedSize: 45000
      });
      
      // Complete cache operation
      suite.completeCacheOperation(operationId, {
        success: true,
        hit: true,
        cacheSize: 1000000,
        dataSize: 45000
      });
      
      // Verify metrics were recorded
      const stats = suite.getCacheStats();
      expect(stats.totalOperations).toBeGreaterThan(0);
      
      suite.dispose();
    });

    it('should handle mixed operations', () => {
      const suite = createPerformanceMonitoringSuite();
      
      // Mix of framework loading and cache operations
      const reactSession = suite.trackFrameworkLoad(FrameworkType.REACT);
      const vueSession = suite.trackFrameworkLoad(FrameworkType.VUE);
      const cacheGet = suite.trackCacheOperation('get', 'test-resource');
      const cachePut = suite.trackCacheOperation('put', 'another-resource');
      
      // Complete operations
      suite.completeFrameworkLoad(reactSession);
      suite.completeFrameworkLoad(vueSession);
      suite.completeCacheOperation(cacheGet, { success: true, hit: false });
      suite.completeCacheOperation(cachePut, { success: true });
      
      // Verify comprehensive metrics
      const report = suite.generateReport();
      expect(report.summary.totalPageLoads).toBeGreaterThan(0);
      
      const frameworkStats = suite.getFrameworkStats();
      expect(frameworkStats.totalLoads).toBe(2);
      
      const cacheStats = suite.getCacheStats();
      expect(cacheStats.totalOperations).toBe(2);
      
      suite.dispose();
    });
  });
});