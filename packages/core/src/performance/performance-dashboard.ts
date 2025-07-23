/**
 * Performance Dashboard
 * Provides real-time performance monitoring and visualization
 */

import { performanceMonitor } from './performance-monitor.js';
import { buildPerformanceTracker } from './build-performance-tracker.js';
import { runtimePerformanceTracker } from './runtime-performance-tracker.js';
import { bundleAnalyzer } from './bundle-analyzer.js';

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  updateInterval: number;
  maxDataPoints: number;
  enableRealTimeUpdates: boolean;
  showDetailedMetrics: boolean;
  enableAlerts: boolean;
  alertThresholds: {
    buildTime: number;
    bundleSize: number;
    navigationTime: number;
    memoryUsage: number;
  };
}

/**
 * Dashboard data structure
 */
export interface DashboardData {
  timestamp: number;
  build: {
    totalTime: number;
    phases: Array<{ name: string; duration: number; percentage: number }>;
    filesProcessed: number;
    cacheHitRate: number;
    memoryUsage: number;
    warnings: number;
  };
  runtime: {
    averageRouteLoadTime: number;
    averageNavigationTime: number;
    cacheHitRate: number;
    totalRoutes: number;
    totalNavigations: number;
  };
  bundles: {
    totalSize: number;
    averageSize: number;
    compressionRatio: number;
    optimizationScore: number;
    bundleCount: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: number;
    metric: string;
    value: number;
    threshold: number;
  }>;
  recommendations: string[];
}

/**
 * Performance Dashboard
 */
export class PerformanceDashboard {
  private config: DashboardConfig;
  private dataHistory: DashboardData[] = [];
  private updateTimer?: NodeJS.Timeout;
  private alertCallbacks: Array<(alert: DashboardData['alerts'][0]) => void> = [];

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      updateInterval: 5000, // 5 seconds
      maxDataPoints: 100,
      enableRealTimeUpdates: true,
      showDetailedMetrics: true,
      enableAlerts: true,
      alertThresholds: {
        buildTime: 15000, // 15 seconds
        bundleSize: 500000, // 500KB
        navigationTime: 1000, // 1 second
        memoryUsage: 500 * 1024 * 1024 // 500MB
      },
      ...config
    };

    if (this.config.enableRealTimeUpdates) {
      this.startRealTimeUpdates();
    }
  }

  /**
   * Start real-time dashboard updates
   */
  private startRealTimeUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.updateDashboard();
    }, this.config.updateInterval);

    console.log(`📊 Performance dashboard started (updates every ${this.config.updateInterval}ms)`);
  }

  /**
   * Update dashboard data
   */
  private updateDashboard(): void {
    const data = this.collectCurrentData();
    
    // Add to history
    this.dataHistory.push(data);
    
    // Limit history size
    if (this.dataHistory.length > this.config.maxDataPoints) {
      this.dataHistory = this.dataHistory.slice(-this.config.maxDataPoints);
    }

    // Check for alerts
    if (this.config.enableAlerts) {
      this.checkAlerts(data);
    }
  }

  /**
   * Collect current performance data
   */
  private collectCurrentData(): DashboardData {
    const buildMetrics = performanceMonitor.getBuildPerformanceMetrics();
    const routeStats = runtimePerformanceTracker.getRouteLoadingStats();
    const navStats = runtimePerformanceTracker.getNavigationStats();
    const bundleAnalyses = bundleAnalyzer.getAllAnalyses();
    const performanceMetrics = performanceMonitor.getMetrics();

    // Calculate bundle statistics
    const totalBundleSize = bundleAnalyses.reduce((sum, analysis) => sum + analysis.originalSize, 0);
    const averageBundleSize = bundleAnalyses.length > 0 ? totalBundleSize / bundleAnalyses.length : 0;
    const averageCompressionRatio = bundleAnalyses.length > 0 
      ? bundleAnalyses.reduce((sum, analysis) => sum + analysis.compressionRatio, 0) / bundleAnalyses.length 
      : 0;
    const averageOptimizationScore = bundleAnalyses.length > 0
      ? bundleAnalyses.reduce((sum, analysis) => sum + analysis.performanceScore, 0) / bundleAnalyses.length
      : 0;

    return {
      timestamp: Date.now(),
      build: {
        totalTime: buildMetrics.totalTime,
        phases: buildMetrics.phases,
        filesProcessed: buildMetrics.filesProcessed,
        cacheHitRate: buildMetrics.cacheHitRate,
        memoryUsage: buildMetrics.memoryUsage.heapUsed,
        warnings: buildMetrics.warnings.length
      },
      runtime: {
        averageRouteLoadTime: routeStats.averageLoadTime,
        averageNavigationTime: navStats.averageNavigationTime,
        cacheHitRate: routeStats.cacheHitRate,
        totalRoutes: routeStats.totalRoutes,
        totalNavigations: navStats.totalNavigations
      },
      bundles: {
        totalSize: totalBundleSize,
        averageSize: averageBundleSize,
        compressionRatio: averageCompressionRatio,
        optimizationScore: averageOptimizationScore,
        bundleCount: bundleAnalyses.length
      },
      alerts: [], // Will be populated by checkAlerts
      recommendations: [
        ...buildMetrics.recommendations,
        ...this.generateRuntimeRecommendations(routeStats, navStats),
        ...this.generateBundleRecommendations(bundleAnalyses)
      ]
    };
  }

  /**
   * Generate runtime performance recommendations
   */
  private generateRuntimeRecommendations(routeStats: any, navStats: any): string[] {
    const recommendations: string[] = [];

    if (routeStats.averageLoadTime > 1000) {
      recommendations.push('Route loading is slow. Consider implementing preloading or optimizing bundle sizes.');
    }

    if (routeStats.cacheHitRate < 0.5) {
      recommendations.push('Low route cache hit rate. Review caching strategy and implementation.');
    }

    if (navStats.averageNavigationTime > 500) {
      recommendations.push('Navigation is slow. Optimize route transitions and component loading.');
    }

    return recommendations;
  }

  /**
   * Generate bundle optimization recommendations
   */
  private generateBundleRecommendations(analyses: any[]): string[] {
    const recommendations: string[] = [];

    const largeBundles = analyses.filter(a => a.originalSize > 500000);
    if (largeBundles.length > 0) {
      recommendations.push(`${largeBundles.length} bundles are larger than 500KB. Consider code splitting.`);
    }

    const lowOptimizationBundles = analyses.filter(a => a.performanceScore < 70);
    if (lowOptimizationBundles.length > 0) {
      recommendations.push(`${lowOptimizationBundles.length} bundles have low optimization scores. Review optimization opportunities.`);
    }

    const poorCompressionBundles = analyses.filter(a => a.compressionRatio > 0.8);
    if (poorCompressionBundles.length > 0) {
      recommendations.push(`${poorCompressionBundles.length} bundles have poor compression. Enable minification and gzip.`);
    }

    return recommendations;
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(data: DashboardData): void {
    const alerts: DashboardData['alerts'] = [];

    // Build time alerts
    if (data.build.totalTime > this.config.alertThresholds.buildTime) {
      alerts.push({
        type: 'warning',
        message: `Build time exceeded threshold: ${data.build.totalTime.toFixed(0)}ms`,
        timestamp: Date.now(),
        metric: 'buildTime',
        value: data.build.totalTime,
        threshold: this.config.alertThresholds.buildTime
      });
    }

    // Memory usage alerts
    if (data.build.memoryUsage > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'warning',
        message: `Memory usage exceeded threshold: ${(data.build.memoryUsage / 1024 / 1024).toFixed(0)}MB`,
        timestamp: Date.now(),
        metric: 'memoryUsage',
        value: data.build.memoryUsage,
        threshold: this.config.alertThresholds.memoryUsage
      });
    }

    // Bundle size alerts
    if (data.bundles.averageSize > this.config.alertThresholds.bundleSize) {
      alerts.push({
        type: 'warning',
        message: `Average bundle size exceeded threshold: ${(data.bundles.averageSize / 1024).toFixed(0)}KB`,
        timestamp: Date.now(),
        metric: 'bundleSize',
        value: data.bundles.averageSize,
        threshold: this.config.alertThresholds.bundleSize
      });
    }

    // Navigation time alerts
    if (data.runtime.averageNavigationTime > this.config.alertThresholds.navigationTime) {
      alerts.push({
        type: 'warning',
        message: `Navigation time exceeded threshold: ${data.runtime.averageNavigationTime.toFixed(0)}ms`,
        timestamp: Date.now(),
        metric: 'navigationTime',
        value: data.runtime.averageNavigationTime,
        threshold: this.config.alertThresholds.navigationTime
      });
    }

    // Add alerts to data
    data.alerts = alerts;

    // Trigger alert callbacks
    alerts.forEach(alert => {
      this.alertCallbacks.forEach(callback => callback(alert));
      console.warn(`🚨 Performance Alert: ${alert.message}`);
    });
  }

  /**
   * Get current dashboard data
   */
  getCurrentData(): DashboardData | null {
    return this.dataHistory.length > 0 ? this.dataHistory[this.dataHistory.length - 1] : null;
  }

  /**
   * Get dashboard data history
   */
  getDataHistory(): DashboardData[] {
    return [...this.dataHistory];
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(metric: string, timeRange: number = 10): {
    trend: 'improving' | 'degrading' | 'stable';
    change: number;
    data: Array<{ timestamp: number; value: number }>;
  } {
    const recentData = this.dataHistory.slice(-timeRange);
    
    if (recentData.length < 2) {
      return { trend: 'stable', change: 0, data: [] };
    }

    const data = recentData.map(d => ({
      timestamp: d.timestamp,
      value: this.getMetricValue(d, metric)
    }));

    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;
    const change = ((lastValue - firstValue) / firstValue) * 100;

    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (Math.abs(change) > 5) {
      // For metrics where lower is better (build time, bundle size, etc.)
      const lowerIsBetter = ['buildTime', 'bundleSize', 'navigationTime', 'memoryUsage'].includes(metric);
      trend = (change < 0) === lowerIsBetter ? 'improving' : 'degrading';
    }

    return { trend, change, data };
  }

  /**
   * Get metric value from dashboard data
   */
  private getMetricValue(data: DashboardData, metric: string): number {
    switch (metric) {
      case 'buildTime': return data.build.totalTime;
      case 'bundleSize': return data.bundles.averageSize;
      case 'navigationTime': return data.runtime.averageNavigationTime;
      case 'memoryUsage': return data.build.memoryUsage;
      case 'cacheHitRate': return data.runtime.cacheHitRate;
      case 'optimizationScore': return data.bundles.optimizationScore;
      default: return 0;
    }
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: DashboardData['alerts'][0]) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove alert callback
   */
  offAlert(callback: (alert: DashboardData['alerts'][0]) => void): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: {
      overallScore: number;
      buildScore: number;
      runtimeScore: number;
      bundleScore: number;
    };
    trends: Record<string, any>;
    recommendations: string[];
    alerts: DashboardData['alerts'];
  } {
    const currentData = this.getCurrentData();
    if (!currentData) {
      return {
        summary: { overallScore: 0, buildScore: 0, runtimeScore: 0, bundleScore: 0 },
        trends: {},
        recommendations: [],
        alerts: []
      };
    }

    // Calculate scores (0-100)
    const buildScore = this.calculateBuildScore(currentData);
    const runtimeScore = this.calculateRuntimeScore(currentData);
    const bundleScore = this.calculateBundleScore(currentData);
    const overallScore = (buildScore + runtimeScore + bundleScore) / 3;

    // Get trends for key metrics
    const trends = {
      buildTime: this.getPerformanceTrends('buildTime'),
      bundleSize: this.getPerformanceTrends('bundleSize'),
      navigationTime: this.getPerformanceTrends('navigationTime'),
      memoryUsage: this.getPerformanceTrends('memoryUsage')
    };

    return {
      summary: { overallScore, buildScore, runtimeScore, bundleScore },
      trends,
      recommendations: currentData.recommendations,
      alerts: currentData.alerts
    };
  }

  /**
   * Calculate build performance score
   */
  private calculateBuildScore(data: DashboardData): number {
    let score = 100;

    // Penalize slow build times
    if (data.build.totalTime > 30000) score -= 40;
    else if (data.build.totalTime > 15000) score -= 20;
    else if (data.build.totalTime > 5000) score -= 10;

    // Penalize low cache hit rate
    if (data.build.cacheHitRate < 0.3) score -= 20;
    else if (data.build.cacheHitRate < 0.5) score -= 10;

    // Penalize high memory usage
    const memoryMB = data.build.memoryUsage / 1024 / 1024;
    if (memoryMB > 1000) score -= 30;
    else if (memoryMB > 500) score -= 15;

    // Penalize warnings
    score -= Math.min(data.build.warnings * 5, 20);

    return Math.max(0, score);
  }

  /**
   * Calculate runtime performance score
   */
  private calculateRuntimeScore(data: DashboardData): number {
    let score = 100;

    // Penalize slow route loading
    if (data.runtime.averageRouteLoadTime > 3000) score -= 40;
    else if (data.runtime.averageRouteLoadTime > 1000) score -= 20;
    else if (data.runtime.averageRouteLoadTime > 500) score -= 10;

    // Penalize slow navigation
    if (data.runtime.averageNavigationTime > 1500) score -= 30;
    else if (data.runtime.averageNavigationTime > 500) score -= 15;

    // Penalize low cache hit rate
    if (data.runtime.cacheHitRate < 0.3) score -= 20;
    else if (data.runtime.cacheHitRate < 0.5) score -= 10;

    return Math.max(0, score);
  }

  /**
   * Calculate bundle performance score
   */
  private calculateBundleScore(data: DashboardData): number {
    let score = 100;

    // Penalize large bundle sizes
    const avgSizeKB = data.bundles.averageSize / 1024;
    if (avgSizeKB > 1000) score -= 40;
    else if (avgSizeKB > 500) score -= 25;
    else if (avgSizeKB > 250) score -= 10;

    // Penalize poor compression
    if (data.bundles.compressionRatio > 0.8) score -= 20;
    else if (data.bundles.compressionRatio > 0.6) score -= 10;

    // Use optimization score
    score = (score + data.bundles.optimizationScore) / 2;

    return Math.max(0, score);
  }

  /**
   * Print dashboard summary to console
   */
  printSummary(): void {
    const currentData = this.getCurrentData();
    if (!currentData) {
      console.log('📊 No performance data available');
      return;
    }

    const report = this.generateReport();

    console.log('\n📊 Performance Dashboard Summary');
    console.log('='.repeat(50));
    console.log(`Overall Score: ${report.summary.overallScore.toFixed(1)}/100`);
    console.log(`Build Score: ${report.summary.buildScore.toFixed(1)}/100`);
    console.log(`Runtime Score: ${report.summary.runtimeScore.toFixed(1)}/100`);
    console.log(`Bundle Score: ${report.summary.bundleScore.toFixed(1)}/100`);

    console.log('\n📈 Performance Metrics:');
    console.log(`Build Time: ${currentData.build.totalTime.toFixed(0)}ms`);
    console.log(`Route Load Time: ${currentData.runtime.averageRouteLoadTime.toFixed(0)}ms`);
    console.log(`Navigation Time: ${currentData.runtime.averageNavigationTime.toFixed(0)}ms`);
    console.log(`Average Bundle Size: ${(currentData.bundles.averageSize / 1024).toFixed(1)}KB`);
    console.log(`Cache Hit Rate: ${(currentData.runtime.cacheHitRate * 100).toFixed(1)}%`);

    if (report.alerts.length > 0) {
      console.log(`\n🚨 Active Alerts: ${report.alerts.length}`);
      report.alerts.slice(0, 3).forEach(alert => {
        console.log(`  • ${alert.message}`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Top Recommendations:');
      report.recommendations.slice(0, 3).forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    console.log('');
  }

  /**
   * Stop dashboard updates and cleanup
   */
  dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }

    this.dataHistory = [];
    this.alertCallbacks = [];

    console.log('📊 Performance dashboard disposed');
  }
}

/**
 * Singleton performance dashboard instance
 */
export const performanceDashboard = new PerformanceDashboard();