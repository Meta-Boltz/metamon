/**
 * Performance Monitoring and Debugging Tools
 * Main entry point for all performance monitoring functionality
 */

export { PerformanceMonitor } from './performance-monitor.js';
export { FrameworkLoadingTracker } from './framework-loading-tracker.js';
export { CachePerformanceMonitor } from './cache-performance-monitor.js';
export { WebVitalsMonitor } from './web-vitals-monitor.js';
export { ServiceWorkerDebugger } from './service-worker-debugger.js';

// Re-export types
export * from '../types/performance-monitoring.js';

import { PerformanceMonitor } from './performance-monitor.js';
import { FrameworkLoadingTracker } from './framework-loading-tracker.js';
import { CachePerformanceMonitor } from './cache-performance-monitor.js';
import { WebVitalsMonitor } from './web-vitals-monitor.js';
import { ServiceWorkerDebugger } from './service-worker-debugger.js';
import {
  PerformanceMonitoringConfig,
  PerformanceMetrics,
  PerformanceReport,
  PerformanceAlert,
  VisualizationData,
  ChartData
} from '../types/performance-monitoring.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

/**
 * Comprehensive Performance Monitoring Suite
 * Integrates all performance monitoring tools into a single interface
 */
export class PerformanceMonitoringSuite {
  private performanceMonitor: PerformanceMonitor;
  private frameworkTracker: FrameworkLoadingTracker;
  private cacheMonitor: CachePerformanceMonitor;
  private webVitalsMonitor: WebVitalsMonitor;
  private serviceWorkerDebugger: ServiceWorkerDebugger;
  private config: PerformanceMonitoringConfig;
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];

  constructor(config: PerformanceMonitoringConfig) {
    this.config = config;
    
    // Initialize all monitoring components
    this.performanceMonitor = new PerformanceMonitor(config);
    this.frameworkTracker = new FrameworkLoadingTracker();
    this.cacheMonitor = new CachePerformanceMonitor();
    this.webVitalsMonitor = new WebVitalsMonitor();
    this.serviceWorkerDebugger = new ServiceWorkerDebugger();

    // Set up cross-component integration
    this.setupIntegration();
  }

  /**
   * Start all performance monitoring
   */
  start(): void {
    if (this.config.collectWebVitals) {
      this.webVitalsMonitor.startMonitoring();
    }

    if (this.config.enableDebugMode) {
      this.serviceWorkerDebugger.startDebugging();
    }

    console.log('Performance monitoring suite started');
  }

  /**
   * Stop all performance monitoring
   */
  stop(): void {
    this.webVitalsMonitor.stopMonitoring();
    this.serviceWorkerDebugger.stopDebugging();
    
    console.log('Performance monitoring suite stopped');
  }

  /**
   * Track framework loading performance
   */
  trackFrameworkLoad(
    framework: FrameworkType,
    priority: LoadPriority = LoadPriority.NORMAL,
    options: {
      cacheAttempted?: boolean;
      expectedBundleSize?: number;
    } = {}
  ): string {
    return this.frameworkTracker.startLoading(framework, priority, options);
  }

  /**
   * Complete framework loading tracking
   */
  completeFrameworkLoad(sessionId: string): void {
    const performance = this.frameworkTracker.completeLoading(sessionId);
    if (performance) {
      this.performanceMonitor.recordFrameworkLoad(performance);
    }
  }

  /**
   * Track cache operation performance
   */
  trackCacheOperation(
    operation: 'get' | 'put' | 'delete' | 'match' | 'keys',
    key: string,
    options: {
      framework?: FrameworkType;
      expectedSize?: number;
    } = {}
  ): string {
    return this.cacheMonitor.startOperation(operation, key, options);
  }

  /**
   * Complete cache operation tracking
   */
  completeCacheOperation(
    operationId: string,
    result: {
      success: boolean;
      cacheSize?: number;
      dataSize?: number;
      hit?: boolean;
    }
  ): void {
    const metrics = this.cacheMonitor.completeOperation(operationId, result);
    if (metrics) {
      this.performanceMonitor.recordServiceWorkerPerformance({
        registrationTime: 0,
        activationTime: 0,
        cacheOperations: [metrics],
        backgroundTasks: [],
        messageLatency: [],
        errorCount: 0,
        uptime: Date.now()
      });
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getCurrentMetrics();
  }

  /**
   * Get performance report
   */
  generateReport(timeRange?: { start: number; end: number }): PerformanceReport {
    return this.performanceMonitor.generateReport(timeRange);
  }

  /**
   * Get framework loading statistics
   */
  getFrameworkStats(framework?: FrameworkType) {
    if (framework) {
      return this.frameworkTracker.getFrameworkStats(framework);
    }
    return this.frameworkTracker.getOverallStats();
  }

  /**
   * Get cache performance statistics
   */
  getCacheStats() {
    return this.cacheMonitor.getCacheStats();
  }

  /**
   * Get Web Vitals data
   */
  getWebVitals() {
    return this.webVitalsMonitor.getCurrentVitals();
  }

  /**
   * Get Web Vitals optimization suggestions
   */
  getOptimizationSuggestions() {
    return this.webVitalsMonitor.getOptimizationSuggestions();
  }

  /**
   * Get service worker debug information
   */
  async getServiceWorkerDebugInfo() {
    return await this.serviceWorkerDebugger.getDebugInfo();
  }

  /**
   * Get active performance alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.performanceMonitor.getActiveAlerts();
  }

  /**
   * Get performance timeline
   */
  getTimeline(limit?: number) {
    return this.performanceMonitor.getTimeline(limit);
  }

  /**
   * Get visualization data for charts and graphs
   */
  getVisualizationData(): VisualizationData {
    const timeline = this.getTimeline(100);
    const frameworkStats = this.getFrameworkStats();
    const cacheStats = this.getCacheStats();
    const webVitals = this.webVitalsMonitor.getAllVitalsHistory();

    // Create load times chart data
    const loadTimesData: ChartData = {
      labels: [],
      datasets: []
    };

    if (frameworkStats.frameworkStats) {
      frameworkStats.frameworkStats.forEach((stats, framework) => {
        const recentTrend = stats.loadTimesTrend.slice(-20);
        loadTimesData.labels = recentTrend.map((_, i) => `${i + 1}`);
        loadTimesData.datasets.push({
          label: framework,
          data: recentTrend.map(t => t.loadTime),
          color: this.getFrameworkColor(framework)
        });
      });
    }

    // Create Web Vitals chart data
    const webVitalsData: ChartData = {
      labels: ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'],
      datasets: [{
        label: 'Current Values',
        data: [
          this.webVitalsMonitor.getCurrentVitals().lcp,
          this.webVitalsMonitor.getCurrentVitals().fid,
          this.webVitalsMonitor.getCurrentVitals().cls * 1000, // Scale CLS for visibility
          this.webVitalsMonitor.getCurrentVitals().fcp,
          this.webVitalsMonitor.getCurrentVitals().ttfb
        ],
        color: '#3b82f6'
      }]
    };

    // Create cache performance chart data
    const cacheData: ChartData = {
      labels: ['Hit Rate', 'Avg Response Time', 'Total Operations'],
      datasets: [{
        label: 'Cache Performance',
        data: [
          cacheStats.hitRate * 100,
          cacheStats.averageOperationTime,
          cacheStats.totalOperations
        ],
        color: '#10b981'
      }]
    };

    // Create network utilization chart data (simplified)
    const networkData: ChartData = {
      labels: ['Requests', 'Cache Hits', 'Cache Misses'],
      datasets: [{
        label: 'Network Utilization',
        data: [
          cacheStats.totalOperations,
          cacheStats.totalOperations * cacheStats.hitRate,
          cacheStats.totalOperations * cacheStats.missRate
        ],
        color: '#f59e0b'
      }]
    };

    return {
      timeline,
      charts: {
        loadTimes: loadTimesData,
        webVitals: webVitalsData,
        cachePerformance: cacheData,
        networkUtilization: networkData
      }
    };
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove alert callback
   */
  offAlert(callback: (alert: PerformanceAlert) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Clear all performance data
   */
  clearData(): void {
    this.frameworkTracker.cleanup(0);
    this.cacheMonitor.reset();
    this.webVitalsMonitor.clearHistory();
    this.serviceWorkerDebugger.clearDebugHistory();
    this.performanceMonitor.cleanup();
  }

  /**
   * Export all performance data
   */
  exportAllData(): {
    metrics: PerformanceMetrics;
    frameworkStats: ReturnType<typeof this.frameworkTracker.getOverallStats>;
    cacheStats: ReturnType<typeof this.cacheMonitor.getCacheStats>;
    webVitals: ReturnType<typeof this.webVitalsMonitor.exportData>;
    serviceWorkerDebug: ReturnType<typeof this.serviceWorkerDebugger.exportDebugData>;
    visualization: VisualizationData;
  } {
    return {
      metrics: this.getMetrics(),
      frameworkStats: this.getFrameworkStats(),
      cacheStats: this.getCacheStats(),
      webVitals: this.webVitalsMonitor.exportData(),
      serviceWorkerDebug: this.serviceWorkerDebugger.exportDebugData(),
      visualization: this.getVisualizationData()
    };
  }

  /**
   * Dispose of all monitoring components
   */
  dispose(): void {
    this.stop();
    this.performanceMonitor.dispose();
    this.alertCallbacks = [];
  }

  // Private methods

  private setupIntegration(): void {
    // Set up Web Vitals alerts
    this.webVitalsMonitor.onAlert((alert) => {
      this.alertCallbacks.forEach(callback => callback(alert));
    });

    // Set up periodic cleanup
    setInterval(() => {
      this.frameworkTracker.cleanup();
      this.cacheMonitor.cleanup();
      this.performanceMonitor.cleanup();
    }, 60 * 60 * 1000); // Every hour
  }

  private getFrameworkColor(framework: FrameworkType): string {
    const colors = {
      [FrameworkType.REACT]: '#61dafb',
      [FrameworkType.VUE]: '#4fc08d',
      [FrameworkType.SVELTE]: '#ff3e00',
      [FrameworkType.SOLID]: '#2c4f7c'
    };
    return colors[framework] || '#6b7280';
  }
}

/**
 * Create a default performance monitoring configuration
 */
export function createDefaultConfig(): PerformanceMonitoringConfig {
  return {
    enabled: true,
    collectWebVitals: true,
    collectFrameworkMetrics: true,
    collectServiceWorkerMetrics: true,
    collectNetworkMetrics: true,
    sampleRate: 1.0,
    maxEntriesPerType: 1000,
    performanceBudget: {
      maxInitialBundleSize: 50 * 1024, // 50KB
      maxFrameworkLoadTime: 100, // 100ms
      maxCLS: 0.1,
      maxLCP: 2500, // 2.5s
      maxFID: 100, // 100ms
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      maxNetworkRequests: 50
    },
    alertThresholds: {
      errorRate: 0.05, // 5%
      performanceDegradation: 0.2, // 20%
      budgetExceeded: true
    },
    enableDebugMode: false,
    logLevel: 'warn',
    persistMetrics: true,
    reportingInterval: 30000, // 30 seconds
    batchSize: 10
  };
}

/**
 * Create a performance monitoring suite with default configuration
 */
export function createPerformanceMonitoringSuite(
  config?: Partial<PerformanceMonitoringConfig>
): PerformanceMonitoringSuite {
  const defaultConfig = createDefaultConfig();
  const finalConfig = { ...defaultConfig, ...config };
  return new PerformanceMonitoringSuite(finalConfig);
}