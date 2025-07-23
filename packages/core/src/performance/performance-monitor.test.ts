/**
 * Performance Monitor Tests
 * Tests for the enhanced performance monitoring system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from './performance-monitor.js';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  const testOutputDir = './test-performance-reports';

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }

    monitor = new PerformanceMonitor({
      enabled: true,
      trackBuildTime: true,
      trackRouteLoading: true,
      trackNavigation: true,
      trackBundleSize: true,
      reportInterval: 0, // Disable periodic reports for tests
      outputDirectory: testOutputDir,
      thresholds: {
        buildTime: { warning: 1000, critical: 3000 },
        routeLoadTime: { warning: 500, critical: 1000 },
        navigationTime: { warning: 300, critical: 800 },
        bundleSize: { warning: 100000, critical: 200000 },
        memoryUsage: { warning: 50 * 1024 * 1024, critical: 100 * 1024 * 1024 }
      }
    });
  });

  afterEach(() => {
    monitor.dispose();
    
    // Clean up test directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Build Time Tracking', () => {
    it('should track build time correctly', async () => {
      monitor.startBuildTracking();
      
      // Simulate some build work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      monitor.endBuildTracking(10, 0.8);
      
      const metrics = monitor.getBuildPerformanceMetrics();
      expect(metrics.totalTime).toBeGreaterThan(90);
      expect(metrics.filesProcessed).toBe(10);
      expect(metrics.cacheHitRate).toBe(0.8);
    });

    it('should track build phases', async () => {
      monitor.startBuildTracking();
      
      monitor.trackBuildPhase('compilation');
      await new Promise(resolve => setTimeout(resolve, 50));
      monitor.endBuildPhase('compilation');
      
      monitor.trackBuildPhase('optimization');
      await new Promise(resolve => setTimeout(resolve, 30));
      monitor.endBuildPhase('optimization');
      
      monitor.endBuildTracking(5, 0.6);
      
      const metrics = monitor.getBuildPerformanceMetrics();
      expect(metrics.phases).toHaveLength(2);
      expect(metrics.phases[0].name).toBe('compilation');
      expect(metrics.phases[1].name).toBe('optimization');
      expect(metrics.phases[0].duration).toBeGreaterThan(40);
      expect(metrics.phases[1].duration).toBeGreaterThan(20);
    });

    it('should track file processing', () => {
      const filePath = '/test/file.mtm';
      const fileSize = 1024;
      
      monitor.trackFileProcessing(filePath, fileSize, false);
      monitor.endFileProcessing(filePath);
      
      // File processing should complete without errors
      expect(true).toBe(true);
    });

    it('should generate warnings for slow build times', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      monitor.startBuildTracking();
      
      // Simulate slow build by manually setting metrics
      const buildMetrics = (monitor as any).buildMetrics;
      buildMetrics.totalBuildTime = 5000; // Above critical threshold
      
      (monitor as any).checkBuildTimeWarnings();
      
      const metrics = monitor.getBuildPerformanceMetrics();
      expect(metrics.warnings.length).toBeGreaterThan(0);
      expect(metrics.warnings[0].severity).toBe('critical');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Route Loading Tracking', () => {
    it('should track route loading performance', () => {
      const route = '/test-route';
      const loadTime = 250;
      const bundleSize = 50000;
      
      monitor.trackRouteLoading(route, loadTime, bundleSize, false, false);
      
      const metrics = monitor.getMetrics();
      expect(metrics.routes).toHaveLength(1);
      expect(metrics.routes[0].routePath).toBe(route);
      expect(metrics.routes[0].loadTime).toBe(loadTime);
      expect(metrics.routes[0].bundleSize).toBe(bundleSize);
    });

    it('should generate warnings for slow route loading', () => {
      const route = '/slow-route';
      const loadTime = 1500; // Above critical threshold
      const bundleSize = 50000;
      
      monitor.trackRouteLoading(route, loadTime, bundleSize, false, false);
      
      const metrics = monitor.getMetrics();
      expect(metrics.warnings.length).toBeGreaterThan(0);
      expect(metrics.warnings[0].type).toBe('route');
      expect(metrics.warnings[0].severity).toBe('critical');
    });
  });

  describe('Navigation Tracking', () => {
    it('should track navigation performance', () => {
      const fromRoute = '/home';
      const toRoute = '/about';
      const navigationTime = 200;
      const renderTime = 100;
      
      monitor.trackNavigation(fromRoute, toRoute, navigationTime, renderTime);
      
      const metrics = monitor.getMetrics();
      expect(metrics.navigation).toHaveLength(1);
      expect(metrics.navigation[0].fromRoute).toBe(fromRoute);
      expect(metrics.navigation[0].toRoute).toBe(toRoute);
      expect(metrics.navigation[0].navigationTime).toBe(navigationTime);
      expect(metrics.navigation[0].renderTime).toBe(renderTime);
    });

    it('should generate warnings for slow navigation', () => {
      const fromRoute = '/home';
      const toRoute = '/slow-page';
      const navigationTime = 1000; // Above critical threshold
      const renderTime = 500;
      
      monitor.trackNavigation(fromRoute, toRoute, navigationTime, renderTime);
      
      const metrics = monitor.getMetrics();
      expect(metrics.warnings.length).toBeGreaterThan(0);
      expect(metrics.warnings[0].type).toBe('navigation');
      expect(metrics.warnings[0].severity).toBe('critical');
    });
  });

  describe('Bundle Size Tracking', () => {
    it('should track bundle size metrics', () => {
      const route = '/test-bundle';
      const originalSize = 150000;
      const compressedSize = 100000;
      const chunkCount = 3;
      const dependencies = ['react', 'lodash'];
      
      monitor.trackBundleSize(route, originalSize, compressedSize, chunkCount, dependencies);
      
      const metrics = monitor.getMetrics();
      expect(metrics.bundles).toHaveLength(1);
      expect(metrics.bundles[0].route).toBe(route);
      expect(metrics.bundles[0].originalSize).toBe(originalSize);
      expect(metrics.bundles[0].compressedSize).toBe(compressedSize);
      expect(metrics.bundles[0].chunkCount).toBe(chunkCount);
    });

    it('should generate warnings for large bundles', () => {
      const route = '/large-bundle';
      const originalSize = 300000; // Above critical threshold
      const compressedSize = 200000;
      const chunkCount = 1;
      const dependencies = ['large-library'];
      
      monitor.trackBundleSize(route, originalSize, compressedSize, chunkCount, dependencies);
      
      const metrics = monitor.getMetrics();
      expect(metrics.warnings.length).toBeGreaterThan(0);
      expect(metrics.warnings[0].type).toBe('bundle');
      expect(metrics.warnings[0].severity).toBe('critical');
    });
  });

  describe('Bundle Optimization Tracking', () => {
    it('should track bundle optimization effectiveness', () => {
      const route = '/optimized-bundle';
      const originalSize = 200000;
      const optimizedSize = 120000;
      const optimizations = ['tree-shaking', 'minification'];
      
      monitor.trackBundleOptimization(route, originalSize, optimizedSize, optimizations);
      
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should warn about low optimization effectiveness', () => {
      const route = '/poorly-optimized-bundle';
      const originalSize = 200000;
      const optimizedSize = 190000; // Only 5% reduction
      const optimizations = ['minification'];
      
      monitor.trackBundleOptimization(route, originalSize, optimizedSize, optimizations);
      
      const metrics = monitor.getMetrics();
      expect(metrics.warnings.length).toBeGreaterThan(0);
      expect(metrics.warnings[0].type).toBe('bundle');
      expect(metrics.warnings[0].metric).toBe('optimizationReduction');
    });
  });

  describe('Performance Reports', () => {
    it('should generate performance report', () => {
      // Add some test data
      monitor.startBuildTracking();
      monitor.trackRouteLoading('/test', 300, 50000, false, false);
      monitor.trackNavigation('/home', '/test', 200, 100);
      monitor.trackBundleSize('/test', 50000, 35000, 1, ['react']);
      monitor.endBuildTracking(5, 0.8);
      
      const report = monitor.generateReport();
      
      expect(report.timestamp).toBeDefined();
      expect(report.buildMetrics).toBeDefined();
      expect(report.routeMetrics).toHaveLength(1);
      expect(report.navigationMetrics).toHaveLength(1);
      expect(report.bundleMetrics).toHaveLength(1);
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should save performance report to file', () => {
      // Add some test data
      monitor.startBuildTracking();
      monitor.endBuildTracking(3, 0.9);
      
      const reportPath = monitor.saveReport('test-report.json');
      
      expect(existsSync(reportPath)).toBe(true);
      expect(reportPath).toContain('test-report.json');
    });
  });

  describe('Performance Summary', () => {
    it('should calculate performance scores correctly', () => {
      // Add test data with good performance
      monitor.startBuildTracking();
      monitor.trackRouteLoading('/fast-route', 200, 30000, true, false);
      monitor.trackNavigation('/home', '/fast-route', 150, 80);
      monitor.trackBundleSize('/fast-route', 30000, 20000, 1, ['react']);
      monitor.endBuildTracking(10, 0.9);
      
      const report = monitor.generateReport();
      
      expect(report.summary.overallScore).toBeGreaterThan(80);
      expect(report.summary.buildScore).toBeGreaterThan(80);
      expect(report.summary.routeScore).toBeGreaterThan(80);
      expect(report.summary.navigationScore).toBeGreaterThan(80);
      expect(report.summary.bundleScore).toBeGreaterThan(80);
    });

    it('should identify improvement areas', () => {
      // Add test data with poor performance
      monitor.startBuildTracking();
      monitor.trackRouteLoading('/slow-route', 2000, 300000, false, false);
      monitor.trackNavigation('/home', '/slow-route', 1200, 800);
      monitor.trackBundleSize('/slow-route', 300000, 250000, 1, ['large-lib']);
      monitor.endBuildTracking(5, 0.3);
      
      const report = monitor.generateReport();
      
      expect(report.summary.improvementAreas.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should limit stored metrics to prevent memory leaks', () => {
      // Add many route metrics
      for (let i = 0; i < 1500; i++) {
        monitor.trackRouteLoading(`/route-${i}`, 100, 10000, false, false);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.routes.length).toBeLessThanOrEqual(1000);
    });

    it('should limit stored navigation metrics', () => {
      // Add many navigation metrics
      for (let i = 0; i < 1500; i++) {
        monitor.trackNavigation(`/from-${i}`, `/to-${i}`, 100, 50);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.navigation.length).toBeLessThanOrEqual(1000);
    });

    it('should limit stored bundle metrics', () => {
      // Add many bundle metrics
      for (let i = 0; i < 600; i++) {
        monitor.trackBundleSize(`/bundle-${i}`, 50000, 35000, 1, ['dep']);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.bundles.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Configuration', () => {
    it('should respect disabled tracking options', () => {
      const disabledMonitor = new PerformanceMonitor({
        enabled: true,
        trackBuildTime: false,
        trackRouteLoading: false,
        trackNavigation: false,
        trackBundleSize: false
      });

      disabledMonitor.startBuildTracking();
      disabledMonitor.trackRouteLoading('/test', 100, 10000);
      disabledMonitor.trackNavigation('/a', '/b', 100, 50);
      disabledMonitor.trackBundleSize('/test', 10000, 8000, 1, []);
      disabledMonitor.endBuildTracking(1, 1);

      const metrics = disabledMonitor.getMetrics();
      expect(metrics.build.totalBuildTime).toBe(0);
      expect(metrics.routes).toHaveLength(0);
      expect(metrics.navigation).toHaveLength(0);
      expect(metrics.bundles).toHaveLength(0);

      disabledMonitor.dispose();
    });

    it('should respect custom thresholds', () => {
      const customMonitor = new PerformanceMonitor({
        enabled: true,
        trackRouteLoading: true,
        thresholds: {
          buildTime: { warning: 100, critical: 200 },
          routeLoadTime: { warning: 50, critical: 100 },
          navigationTime: { warning: 30, critical: 60 },
          bundleSize: { warning: 10000, critical: 20000 },
          memoryUsage: { warning: 10 * 1024 * 1024, critical: 20 * 1024 * 1024 }
        }
      });

      // This should trigger a warning with custom low threshold
      customMonitor.trackRouteLoading('/test', 75, 5000);

      const metrics = customMonitor.getMetrics();
      expect(metrics.warnings.length).toBeGreaterThan(0);

      customMonitor.dispose();
    });
  });
});