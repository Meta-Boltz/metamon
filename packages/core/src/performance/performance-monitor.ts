/**
 * Performance Monitoring and Metrics System
 * Tracks build-time performance, route loading, navigation performance, and bundle sizes
 */

import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Build-time performance metrics
 */
export interface BuildTimeMetrics {
  totalBuildTime: number;
  compilationTime: number;
  routeGenerationTime: number;
  bundleGenerationTime: number;
  optimizationTime: number;
  filesProcessed: number;
  cacheHitRate: number;
  memoryUsage: MemoryUsage;
}

/**
 * Route loading performance metrics
 */
export interface RouteLoadingMetrics {
  routePath: string;
  loadTime: number;
  bundleSize: number;
  cacheHit: boolean;
  preloaded: boolean;
  timestamp: number;
}

/**
 * Navigation performance metrics
 */
export interface NavigationMetrics {
  fromRoute: string;
  toRoute: string;
  navigationTime: number;
  renderTime: number;
  hydrationTime?: number;
  timestamp: number;
}

/**
 * Bundle size metrics
 */
export interface BundleSizeMetrics {
  route: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  chunkCount: number;
  dependencies: string[];
  timestamp: number;
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Performance warning
 */
export interface PerformanceWarning {
  type: 'build' | 'route' | 'navigation' | 'bundle';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  recommendation: string;
  timestamp: number;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  timestamp: number;
  buildMetrics: BuildTimeMetrics;
  routeMetrics: RouteLoadingMetrics[];
  navigationMetrics: NavigationMetrics[];
  bundleMetrics: BundleSizeMetrics[];
  warnings: PerformanceWarning[];
  recommendations: string[];
  summary: PerformanceSummary;
}

/**
 * Performance summary
 */
export interface PerformanceSummary {
  overallScore: number;
  buildScore: number;
  routeScore: number;
  navigationScore: number;
  bundleScore: number;
  criticalIssues: number;
  improvementAreas: string[];
}

/**
 * Performance thresholds configuration
 */
export interface PerformanceThresholds {
  buildTime: { warning: number; critical: number };
  routeLoadTime: { warning: number; critical: number };
  navigationTime: { warning: number; critical: number };
  bundleSize: { warning: number; critical: number };
  memoryUsage: { warning: number; critical: number };
}

/**
 * Performance monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  trackBuildTime: boolean;
  trackRouteLoading: boolean;
  trackNavigation: boolean;
  trackBundleSize: boolean;
  reportInterval: number;
  outputDirectory: string;
  thresholds: PerformanceThresholds;
}

/**
 * Performance monitoring system
 */
export class PerformanceMonitor {
  private buildMetrics: BuildTimeMetrics = {
    totalBuildTime: 0,
    compilationTime: 0,
    routeGenerationTime: 0,
    bundleGenerationTime: 0,
    optimizationTime: 0,
    filesProcessed: 0,
    cacheHitRate: 0,
    memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 }
  };

  private routeMetrics: RouteLoadingMetrics[] = [];
  private navigationMetrics: NavigationMetrics[] = [];
  private bundleMetrics: BundleSizeMetrics[] = [];
  private warnings: PerformanceWarning[] = [];
  private activeTimers = new Map<string, number>();
  private reportTimer?: NodeJS.Timeout;
  private buildStartTime: number = 0;
  private buildPhaseMetrics = new Map<string, { startTime: number; endTime?: number; duration?: number }>();
  private fileProcessingMetrics = new Map<string, { startTime: number; size: number; fromCache: boolean }>();

  constructor(
    private config: MonitoringConfig = {
      enabled: true,
      trackBuildTime: true,
      trackRouteLoading: true,
      trackNavigation: true,
      trackBundleSize: true,
      reportInterval: 60000, // 1 minute
      outputDirectory: './performance-reports',
      thresholds: {
        buildTime: { warning: 5000, critical: 15000 },
        routeLoadTime: { warning: 1000, critical: 3000 },
        navigationTime: { warning: 500, critical: 1500 },
        bundleSize: { warning: 250000, critical: 500000 }, // 250KB warning, 500KB critical
        memoryUsage: { warning: 100 * 1024 * 1024, critical: 500 * 1024 * 1024 } // 100MB warning, 500MB critical
      }
    }
  ) {
    if (this.config.enabled) {
      this.startPeriodicReporting();
    }
  }

  /**
   * Start build-time performance tracking
   */
  startBuildTracking(): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;

    this.buildStartTime = performance.now();
    this.activeTimers.set('build', this.buildStartTime);
    this.buildMetrics.memoryUsage = this.measureMemoryUsage();
    this.buildPhaseMetrics.clear();
    this.fileProcessingMetrics.clear();
    
    console.log('📊 Performance monitoring started for build process');
  }

  /**
   * Track compilation phase
   */
  startCompilationTracking(): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;
    this.activeTimers.set('compilation', performance.now());
  }

  /**
   * End compilation tracking
   */
  endCompilationTracking(): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;
    
    const startTime = this.activeTimers.get('compilation');
    if (startTime) {
      this.buildMetrics.compilationTime = performance.now() - startTime;
      this.activeTimers.delete('compilation');
    }
  }

  /**
   * Track route generation phase
   */
  startRouteGenerationTracking(): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;
    this.activeTimers.set('routeGeneration', performance.now());
  }

  /**
   * End route generation tracking
   */
  endRouteGenerationTracking(): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;
    
    const startTime = this.activeTimers.get('routeGeneration');
    if (startTime) {
      this.buildMetrics.routeGenerationTime = performance.now() - startTime;
      this.activeTimers.delete('routeGeneration');
    }
  }

  /**
   * Track bundle generation phase
   */
  startBundleGenerationTracking(): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;
    this.activeTimers.set('bundleGeneration', performance.now());
  }

  /**
   * End bundle generation tracking
   */
  endBundleGenerationTracking(): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;
    
    const startTime = this.activeTimers.get('bundleGeneration');
    if (startTime) {
      this.buildMetrics.bundleGenerationTime = performance.now() - startTime;
      this.activeTimers.delete('bundleGeneration');
    }
  }

  /**
   * Track optimization phase
   */
  startOptimizationTracking(): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;
    this.activeTimers.set('optimization', performance.now());
  }

  /**
   * End optimization tracking
   */
  endOptimizationTracking(): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;
    
    const startTime = this.activeTimers.get('optimization');
    if (startTime) {
      this.buildMetrics.optimizationTime = performance.now() - startTime;
      this.activeTimers.delete('optimization');
    }
  }

  /**
   * End build tracking and calculate total time
   */
  endBuildTracking(filesProcessed: number, cacheHitRate: number): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;

    const startTime = this.activeTimers.get('build');
    if (startTime) {
      this.buildMetrics.totalBuildTime = performance.now() - startTime;
      this.buildMetrics.filesProcessed = filesProcessed;
      this.buildMetrics.cacheHitRate = cacheHitRate;
      this.activeTimers.delete('build');

      // Check for build time warnings
      this.checkBuildTimeWarnings();
      
      // Generate build performance report
      this.generateBuildPerformanceReport();
      
      console.log(`📊 Build completed in ${this.buildMetrics.totalBuildTime.toFixed(2)}ms`);
      console.log(`📁 Processed ${filesProcessed} files (${(cacheHitRate * 100).toFixed(1)}% cache hit rate)`);
    }
  }

  /**
   * Track route loading performance
   */
  trackRouteLoading(
    routePath: string,
    loadTime: number,
    bundleSize: number,
    cacheHit: boolean = false,
    preloaded: boolean = false
  ): void {
    if (!this.config.enabled || !this.config.trackRouteLoading) return;

    const metric: RouteLoadingMetrics = {
      routePath,
      loadTime,
      bundleSize,
      cacheHit,
      preloaded,
      timestamp: Date.now()
    };

    this.routeMetrics.push(metric);

    // Check for route loading warnings
    this.checkRouteLoadingWarnings(metric);

    // Keep only recent metrics (last 1000 entries)
    if (this.routeMetrics.length > 1000) {
      this.routeMetrics = this.routeMetrics.slice(-1000);
    }
  }

  /**
   * Track navigation performance
   */
  trackNavigation(
    fromRoute: string,
    toRoute: string,
    navigationTime: number,
    renderTime: number,
    hydrationTime?: number
  ): void {
    if (!this.config.enabled || !this.config.trackNavigation) return;

    const metric: NavigationMetrics = {
      fromRoute,
      toRoute,
      navigationTime,
      renderTime,
      hydrationTime,
      timestamp: Date.now()
    };

    this.navigationMetrics.push(metric);

    // Check for navigation warnings
    this.checkNavigationWarnings(metric);

    // Keep only recent metrics (last 1000 entries)
    if (this.navigationMetrics.length > 1000) {
      this.navigationMetrics = this.navigationMetrics.slice(-1000);
    }
  }

  /**
   * Track bundle size metrics
   */
  trackBundleSize(
    route: string,
    originalSize: number,
    compressedSize: number,
    chunkCount: number,
    dependencies: string[]
  ): void {
    if (!this.config.enabled || !this.config.trackBundleSize) return;

    const metric: BundleSizeMetrics = {
      route,
      originalSize,
      compressedSize,
      compressionRatio: compressedSize / originalSize,
      chunkCount,
      dependencies,
      timestamp: Date.now()
    };

    this.bundleMetrics.push(metric);

    // Check for bundle size warnings
    this.checkBundleSizeWarnings(metric);

    // Keep only recent metrics (last 500 entries)
    if (this.bundleMetrics.length > 500) {
      this.bundleMetrics = this.bundleMetrics.slice(-500);
    }
  }

  /**
   * Check for build time performance warnings
   */
  private checkBuildTimeWarnings(): void {
    const { totalBuildTime, memoryUsage } = this.buildMetrics;
    const { buildTime, memoryUsage: memThresholds } = this.config.thresholds;

    // Check build time
    if (totalBuildTime > buildTime.critical) {
      this.addWarning({
        type: 'build',
        severity: 'critical',
        message: 'Build time is critically slow',
        metric: 'totalBuildTime',
        value: totalBuildTime,
        threshold: buildTime.critical,
        recommendation: 'Consider enabling incremental builds, optimizing file processing, or increasing build parallelization',
        timestamp: Date.now()
      });
    } else if (totalBuildTime > buildTime.warning) {
      this.addWarning({
        type: 'build',
        severity: 'medium',
        message: 'Build time is slower than expected',
        metric: 'totalBuildTime',
        value: totalBuildTime,
        threshold: buildTime.warning,
        recommendation: 'Review build configuration and consider enabling caching or parallel processing',
        timestamp: Date.now()
      });
    }

    // Check memory usage
    if (memoryUsage.heapUsed > memThresholds.critical) {
      this.addWarning({
        type: 'build',
        severity: 'critical',
        message: 'Memory usage is critically high during build',
        metric: 'memoryUsage',
        value: memoryUsage.heapUsed,
        threshold: memThresholds.critical,
        recommendation: 'Reduce batch sizes, enable garbage collection, or process files in smaller chunks',
        timestamp: Date.now()
      });
    } else if (memoryUsage.heapUsed > memThresholds.warning) {
      this.addWarning({
        type: 'build',
        severity: 'medium',
        message: 'Memory usage is higher than expected during build',
        metric: 'memoryUsage',
        value: memoryUsage.heapUsed,
        threshold: memThresholds.warning,
        recommendation: 'Monitor memory usage and consider optimizing data structures or enabling streaming processing',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check for route loading performance warnings
   */
  private checkRouteLoadingWarnings(metric: RouteLoadingMetrics): void {
    const { routeLoadTime, bundleSize } = this.config.thresholds;

    // Check load time
    if (metric.loadTime > routeLoadTime.critical) {
      this.addWarning({
        type: 'route',
        severity: 'critical',
        message: `Route ${metric.routePath} has critically slow load time`,
        metric: 'loadTime',
        value: metric.loadTime,
        threshold: routeLoadTime.critical,
        recommendation: 'Implement code splitting, enable preloading, or optimize bundle size',
        timestamp: Date.now()
      });
    } else if (metric.loadTime > routeLoadTime.warning) {
      this.addWarning({
        type: 'route',
        severity: 'medium',
        message: `Route ${metric.routePath} has slow load time`,
        metric: 'loadTime',
        value: metric.loadTime,
        threshold: routeLoadTime.warning,
        recommendation: 'Consider preloading this route or optimizing its dependencies',
        timestamp: Date.now()
      });
    }

    // Check bundle size
    if (metric.bundleSize > bundleSize.critical) {
      this.addWarning({
        type: 'bundle',
        severity: 'critical',
        message: `Route ${metric.routePath} has critically large bundle size`,
        metric: 'bundleSize',
        value: metric.bundleSize,
        threshold: bundleSize.critical,
        recommendation: 'Implement aggressive code splitting, tree shaking, or lazy loading',
        timestamp: Date.now()
      });
    } else if (metric.bundleSize > bundleSize.warning) {
      this.addWarning({
        type: 'bundle',
        severity: 'medium',
        message: `Route ${metric.routePath} has large bundle size`,
        metric: 'bundleSize',
        value: metric.bundleSize,
        threshold: bundleSize.warning,
        recommendation: 'Review dependencies and consider code splitting or tree shaking',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check for navigation performance warnings
   */
  private checkNavigationWarnings(metric: NavigationMetrics): void {
    const { navigationTime } = this.config.thresholds;

    if (metric.navigationTime > navigationTime.critical) {
      this.addWarning({
        type: 'navigation',
        severity: 'critical',
        message: `Navigation from ${metric.fromRoute} to ${metric.toRoute} is critically slow`,
        metric: 'navigationTime',
        value: metric.navigationTime,
        threshold: navigationTime.critical,
        recommendation: 'Optimize route transitions, implement preloading, or reduce render complexity',
        timestamp: Date.now()
      });
    } else if (metric.navigationTime > navigationTime.warning) {
      this.addWarning({
        type: 'navigation',
        severity: 'medium',
        message: `Navigation from ${metric.fromRoute} to ${metric.toRoute} is slow`,
        metric: 'navigationTime',
        value: metric.navigationTime,
        threshold: navigationTime.warning,
        recommendation: 'Consider optimizing the target route or implementing progressive loading',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check for bundle size warnings
   */
  private checkBundleSizeWarnings(metric: BundleSizeMetrics): void {
    const { bundleSize } = this.config.thresholds;

    if (metric.originalSize > bundleSize.critical) {
      this.addWarning({
        type: 'bundle',
        severity: 'critical',
        message: `Bundle for route ${metric.route} is critically large`,
        metric: 'bundleSize',
        value: metric.originalSize,
        threshold: bundleSize.critical,
        recommendation: 'Implement aggressive optimization: tree shaking, code splitting, and dependency analysis',
        timestamp: Date.now()
      });
    } else if (metric.originalSize > bundleSize.warning) {
      this.addWarning({
        type: 'bundle',
        severity: 'medium',
        message: `Bundle for route ${metric.route} is large`,
        metric: 'bundleSize',
        value: metric.originalSize,
        threshold: bundleSize.warning,
        recommendation: 'Review dependencies and consider optimization techniques',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Add a performance warning
   */
  private addWarning(warning: PerformanceWarning): void {
    this.warnings.push(warning);

    // Keep only recent warnings (last 100)
    if (this.warnings.length > 100) {
      this.warnings = this.warnings.slice(-100);
    }

    // Log critical warnings immediately
    if (warning.severity === 'critical') {
      console.warn(`🚨 CRITICAL PERFORMANCE WARNING: ${warning.message}`);
      console.warn(`   Metric: ${warning.metric} = ${warning.value} (threshold: ${warning.threshold})`);
      console.warn(`   Recommendation: ${warning.recommendation}`);
    }
  }

  /**
   * Measure current memory usage
   */
  private measureMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const summary = this.calculatePerformanceSummary();
    const recommendations = this.generateRecommendations();

    return {
      timestamp: Date.now(),
      buildMetrics: { ...this.buildMetrics },
      routeMetrics: [...this.routeMetrics],
      navigationMetrics: [...this.navigationMetrics],
      bundleMetrics: [...this.bundleMetrics],
      warnings: [...this.warnings],
      recommendations,
      summary
    };
  }

  /**
   * Calculate performance summary scores
   */
  private calculatePerformanceSummary(): PerformanceSummary {
    const buildScore = this.calculateBuildScore();
    const routeScore = this.calculateRouteScore();
    const navigationScore = this.calculateNavigationScore();
    const bundleScore = this.calculateBundleScore();
    
    const overallScore = (buildScore + routeScore + navigationScore + bundleScore) / 4;
    
    const criticalIssues = this.warnings.filter(w => w.severity === 'critical').length;
    const improvementAreas = this.identifyImprovementAreas();

    return {
      overallScore,
      buildScore,
      routeScore,
      navigationScore,
      bundleScore,
      criticalIssues,
      improvementAreas
    };
  }

  /**
   * Calculate build performance score (0-100)
   */
  private calculateBuildScore(): number {
    const { totalBuildTime } = this.buildMetrics;
    const { buildTime } = this.config.thresholds;
    
    if (totalBuildTime === 0) return 100;
    
    if (totalBuildTime <= buildTime.warning) return 100;
    if (totalBuildTime <= buildTime.critical) return 70;
    return Math.max(0, 50 - (totalBuildTime - buildTime.critical) / 1000);
  }

  /**
   * Calculate route loading performance score (0-100)
   */
  private calculateRouteScore(): number {
    if (this.routeMetrics.length === 0) return 100;
    
    const avgLoadTime = this.routeMetrics.reduce((sum, m) => sum + m.loadTime, 0) / this.routeMetrics.length;
    const { routeLoadTime } = this.config.thresholds;
    
    if (avgLoadTime <= routeLoadTime.warning) return 100;
    if (avgLoadTime <= routeLoadTime.critical) return 70;
    return Math.max(0, 50 - (avgLoadTime - routeLoadTime.critical) / 100);
  }

  /**
   * Calculate navigation performance score (0-100)
   */
  private calculateNavigationScore(): number {
    if (this.navigationMetrics.length === 0) return 100;
    
    const avgNavTime = this.navigationMetrics.reduce((sum, m) => sum + m.navigationTime, 0) / this.navigationMetrics.length;
    const { navigationTime } = this.config.thresholds;
    
    if (avgNavTime <= navigationTime.warning) return 100;
    if (avgNavTime <= navigationTime.critical) return 70;
    return Math.max(0, 50 - (avgNavTime - navigationTime.critical) / 50);
  }

  /**
   * Calculate bundle size performance score (0-100)
   */
  private calculateBundleScore(): number {
    if (this.bundleMetrics.length === 0) return 100;
    
    const avgBundleSize = this.bundleMetrics.reduce((sum, m) => sum + m.originalSize, 0) / this.bundleMetrics.length;
    const { bundleSize } = this.config.thresholds;
    
    if (avgBundleSize <= bundleSize.warning) return 100;
    if (avgBundleSize <= bundleSize.critical) return 70;
    return Math.max(0, 50 - (avgBundleSize - bundleSize.critical) / 10000);
  }

  /**
   * Identify areas for improvement
   */
  private identifyImprovementAreas(): string[] {
    const areas: string[] = [];
    
    if (this.calculateBuildScore() < 80) areas.push('Build Performance');
    if (this.calculateRouteScore() < 80) areas.push('Route Loading');
    if (this.calculateNavigationScore() < 80) areas.push('Navigation Speed');
    if (this.calculateBundleScore() < 80) areas.push('Bundle Optimization');
    
    return areas;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Build recommendations
    if (this.buildMetrics.totalBuildTime > this.config.thresholds.buildTime.warning) {
      recommendations.push('Enable incremental builds and caching to improve build performance');
    }
    
    if (this.buildMetrics.cacheHitRate < 0.5) {
      recommendations.push('Improve cache hit rate by optimizing file change detection');
    }
    
    // Route recommendations
    const slowRoutes = this.routeMetrics.filter(m => m.loadTime > this.config.thresholds.routeLoadTime.warning);
    if (slowRoutes.length > 0) {
      recommendations.push(`Optimize ${slowRoutes.length} slow-loading routes with code splitting or preloading`);
    }
    
    // Bundle recommendations
    const largeBundles = this.bundleMetrics.filter(m => m.originalSize > this.config.thresholds.bundleSize.warning);
    if (largeBundles.length > 0) {
      recommendations.push(`Reduce bundle sizes for ${largeBundles.length} routes using tree shaking and dependency optimization`);
    }
    
    // Navigation recommendations
    const slowNavigations = this.navigationMetrics.filter(m => m.navigationTime > this.config.thresholds.navigationTime.warning);
    if (slowNavigations.length > 0) {
      recommendations.push(`Optimize ${slowNavigations.length} slow navigation transitions`);
    }
    
    return recommendations;
  }

  /**
   * Save performance report to file
   */
  saveReport(filename?: string): string {
    const report = this.generateReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFilename = filename || `performance-report-${timestamp}.json`;
    const reportPath = join(this.config.outputDirectory, reportFilename);
    
    // Ensure output directory exists
    if (!existsSync(this.config.outputDirectory)) {
      mkdirSync(this.config.outputDirectory, { recursive: true });
    }
    
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Performance report saved to: ${reportPath}`);
    
    return reportPath;
  }

  /**
   * Start periodic reporting
   */
  private startPeriodicReporting(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }
    
    this.reportTimer = setInterval(() => {
      this.saveReport();
    }, this.config.reportInterval);
  }

  /**
   * Print performance summary to console
   */
  printSummary(): void {
    const summary = this.calculatePerformanceSummary();
    
    console.log('\n📊 Performance Summary');
    console.log('='.repeat(50));
    console.log(`Overall Score: ${summary.overallScore.toFixed(1)}/100`);
    console.log(`Build Score: ${summary.buildScore.toFixed(1)}/100`);
    console.log(`Route Score: ${summary.routeScore.toFixed(1)}/100`);
    console.log(`Navigation Score: ${summary.navigationScore.toFixed(1)}/100`);
    console.log(`Bundle Score: ${summary.bundleScore.toFixed(1)}/100`);
    console.log(`Critical Issues: ${summary.criticalIssues}`);
    
    if (summary.improvementAreas.length > 0) {
      console.log(`\n🎯 Areas for Improvement:`);
      summary.improvementAreas.forEach(area => console.log(`  • ${area}`));
    }
    
    const recommendations = this.generateRecommendations();
    if (recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): {
    build: BuildTimeMetrics;
    routes: RouteLoadingMetrics[];
    navigation: NavigationMetrics[];
    bundles: BundleSizeMetrics[];
    warnings: PerformanceWarning[];
  } {
    return {
      build: { ...this.buildMetrics },
      routes: [...this.routeMetrics],
      navigation: [...this.navigationMetrics],
      bundles: [...this.bundleMetrics],
      warnings: [...this.warnings]
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.buildMetrics = {
      totalBuildTime: 0,
      compilationTime: 0,
      routeGenerationTime: 0,
      bundleGenerationTime: 0,
      optimizationTime: 0,
      filesProcessed: 0,
      cacheHitRate: 0,
      memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 }
    };
    
    this.routeMetrics = [];
    this.navigationMetrics = [];
    this.bundleMetrics = [];
    this.warnings = [];
    this.activeTimers.clear();
  }

  /**
   * Track file processing performance
   */
  trackFileProcessing(filePath: string, size: number, fromCache: boolean = false): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;

    const startTime = performance.now();
    this.fileProcessingMetrics.set(filePath, { startTime, size, fromCache });
  }

  /**
   * End file processing tracking
   */
  endFileProcessing(filePath: string): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;

    const metrics = this.fileProcessingMetrics.get(filePath);
    if (metrics) {
      const processingTime = performance.now() - metrics.startTime;
      
      // Log slow file processing
      if (processingTime > 1000 && !metrics.fromCache) {
        console.warn(`⚠️  Slow file processing: ${filePath} (${processingTime.toFixed(2)}ms)`);
        
        this.addWarning({
          type: 'build',
          severity: 'medium',
          message: `Slow file processing detected: ${filePath}`,
          metric: 'fileProcessingTime',
          value: processingTime,
          threshold: 1000,
          recommendation: 'Consider optimizing file processing or enabling caching',
          timestamp: Date.now()
        });
      }
      
      this.fileProcessingMetrics.delete(filePath);
    }
  }

  /**
   * Track build phase performance
   */
  trackBuildPhase(phaseName: string): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;

    // End previous phase if exists
    const previousPhase = Array.from(this.buildPhaseMetrics.entries())
      .find(([_, metrics]) => !metrics.endTime);
    
    if (previousPhase) {
      this.endBuildPhase(previousPhase[0]);
    }

    const startTime = performance.now();
    this.buildPhaseMetrics.set(phaseName, { startTime });
    
    console.log(`📊 Starting build phase: ${phaseName}`);
  }

  /**
   * End build phase tracking
   */
  endBuildPhase(phaseName: string): void {
    if (!this.config.enabled || !this.config.trackBuildTime) return;

    const phaseMetrics = this.buildPhaseMetrics.get(phaseName);
    if (phaseMetrics && !phaseMetrics.endTime) {
      phaseMetrics.endTime = performance.now();
      phaseMetrics.duration = phaseMetrics.endTime - phaseMetrics.startTime;
      
      console.log(`✅ Completed build phase: ${phaseName} (${phaseMetrics.duration.toFixed(2)}ms)`);
      
      // Check for slow phases
      if (phaseMetrics.duration > 5000) {
        this.addWarning({
          type: 'build',
          severity: 'medium',
          message: `Slow build phase: ${phaseName}`,
          metric: 'buildPhaseTime',
          value: phaseMetrics.duration,
          threshold: 5000,
          recommendation: `Optimize ${phaseName} phase or consider parallel processing`,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Generate detailed build performance report
   */
  private generateBuildPerformanceReport(): void {
    if (!this.config.enabled) return;

    const report = {
      timestamp: Date.now(),
      totalBuildTime: this.buildMetrics.totalBuildTime,
      filesProcessed: this.buildMetrics.filesProcessed,
      cacheHitRate: this.buildMetrics.cacheHitRate,
      memoryUsage: this.buildMetrics.memoryUsage,
      phases: Array.from(this.buildPhaseMetrics.entries()).map(([name, metrics]) => ({
        name,
        duration: metrics.duration || 0,
        percentage: metrics.duration ? (metrics.duration / this.buildMetrics.totalBuildTime) * 100 : 0
      })),
      warnings: this.warnings.filter(w => w.type === 'build'),
      recommendations: this.generateBuildRecommendations()
    };

    // Save detailed report
    if (this.config.generateReports) {
      this.saveBuildReport(report);
    }

    // Print summary
    this.printBuildSummary(report);
  }

  /**
   * Generate build-specific recommendations
   */
  private generateBuildRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Cache recommendations
    if (this.buildMetrics.cacheHitRate < 0.5) {
      recommendations.push('Improve cache hit rate by optimizing file change detection and caching strategy');
    }
    
    // Memory recommendations
    const memoryUsageMB = this.buildMetrics.memoryUsage.heapUsed / (1024 * 1024);
    if (memoryUsageMB > 500) {
      recommendations.push('High memory usage detected. Consider processing files in smaller batches');
    }
    
    // Phase-specific recommendations
    const slowPhases = Array.from(this.buildPhaseMetrics.entries())
      .filter(([_, metrics]) => metrics.duration && metrics.duration > 5000);
    
    if (slowPhases.length > 0) {
      recommendations.push(`Optimize slow build phases: ${slowPhases.map(([name]) => name).join(', ')}`);
    }
    
    // File processing recommendations
    const totalFiles = this.buildMetrics.filesProcessed;
    const avgTimePerFile = totalFiles > 0 ? this.buildMetrics.totalBuildTime / totalFiles : 0;
    
    if (avgTimePerFile > 100) {
      recommendations.push('Consider parallel file processing to improve build speed');
    }
    
    return recommendations;
  }

  /**
   * Save build performance report to file
   */
  private saveBuildReport(report: any): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `build-performance-${timestamp}.json`;
      const reportPath = join(this.config.outputDirectory, filename);
      
      if (!existsSync(this.config.outputDirectory)) {
        mkdirSync(this.config.outputDirectory, { recursive: true });
      }
      
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Build performance report saved: ${reportPath}`);
    } catch (error) {
      console.warn('⚠️  Failed to save build performance report:', error);
    }
  }

  /**
   * Print build performance summary
   */
  private printBuildSummary(report: any): void {
    console.log('\n📊 Build Performance Summary');
    console.log('='.repeat(50));
    console.log(`Total Build Time: ${report.totalBuildTime.toFixed(2)}ms`);
    console.log(`Files Processed: ${report.filesProcessed}`);
    console.log(`Cache Hit Rate: ${(report.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`Memory Usage: ${(report.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    
    if (report.phases.length > 0) {
      console.log('\n📋 Build Phases:');
      report.phases
        .sort((a: any, b: any) => b.duration - a.duration)
        .forEach((phase: any) => {
          console.log(`  ${phase.name}: ${phase.duration.toFixed(2)}ms (${phase.percentage.toFixed(1)}%)`);
        });
    }
    
    if (report.warnings.length > 0) {
      console.log(`\n⚠️  Performance Warnings: ${report.warnings.length}`);
      report.warnings.slice(0, 3).forEach((warning: any) => {
        console.log(`  • ${warning.message}`);
      });
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec: string) => {
        console.log(`  • ${rec}`);
      });
    }
    
    console.log('');
  }

  /**
   * Get build performance metrics
   */
  getBuildPerformanceMetrics(): {
    totalTime: number;
    phases: Array<{ name: string; duration: number; percentage: number }>;
    filesProcessed: number;
    cacheHitRate: number;
    memoryUsage: MemoryUsage;
    warnings: PerformanceWarning[];
    recommendations: string[];
  } {
    const phases = Array.from(this.buildPhaseMetrics.entries()).map(([name, metrics]) => ({
      name,
      duration: metrics.duration || 0,
      percentage: metrics.duration ? (metrics.duration / this.buildMetrics.totalBuildTime) * 100 : 0
    }));

    return {
      totalTime: this.buildMetrics.totalBuildTime,
      phases,
      filesProcessed: this.buildMetrics.filesProcessed,
      cacheHitRate: this.buildMetrics.cacheHitRate,
      memoryUsage: this.buildMetrics.memoryUsage,
      warnings: this.warnings.filter(w => w.type === 'build'),
      recommendations: this.generateBuildRecommendations()
    };
  }

  /**
   * Track bundle optimization effectiveness
   */
  trackBundleOptimization(
    route: string,
    originalSize: number,
    optimizedSize: number,
    optimizations: string[]
  ): void {
    if (!this.config.enabled || !this.config.trackBundleSize) return;

    const reduction = ((originalSize - optimizedSize) / originalSize) * 100;
    
    console.log(`⚡ Bundle optimization for ${route}:`);
    console.log(`  Size: ${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB`);
    console.log(`  Reduction: ${reduction.toFixed(1)}%`);
    console.log(`  Optimizations: ${optimizations.join(', ')}`);
    
    // Track optimization effectiveness
    if (reduction < 10) {
      this.addWarning({
        type: 'bundle',
        severity: 'low',
        message: `Low optimization effectiveness for ${route}`,
        metric: 'optimizationReduction',
        value: reduction,
        threshold: 10,
        recommendation: 'Review optimization settings and consider additional techniques',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = undefined;
    }
    
    this.activeTimers.clear();
    this.buildPhaseMetrics.clear();
    this.fileProcessingMetrics.clear();
  }
}

/**
 * Singleton performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();