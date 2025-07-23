/**
 * Runtime Performance Tracker
 * Tracks route loading, navigation performance, and client-side metrics
 */

import { performanceMonitor } from './performance-monitor.js';

/**
 * Route loading performance data
 */
export interface RouteLoadingPerformance {
  route: string;
  loadStartTime: number;
  loadEndTime?: number;
  loadDuration?: number;
  bundleSize?: number;
  cacheHit: boolean;
  preloaded: boolean;
  dependencies: string[];
  errors: string[];
}

/**
 * Navigation performance data
 */
export interface NavigationPerformance {
  fromRoute: string;
  toRoute: string;
  navigationStartTime: number;
  navigationEndTime?: number;
  navigationDuration?: number;
  renderStartTime?: number;
  renderEndTime?: number;
  renderDuration?: number;
  hydrationStartTime?: number;
  hydrationEndTime?: number;
  hydrationDuration?: number;
  preloadTime?: number;
  cacheHit: boolean;
}

/**
 * Client-side performance metrics
 */
export interface ClientPerformanceMetrics {
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  timeToInteractive?: number;
  totalBlockingTime?: number;
}

/**
 * Preloading performance data
 */
export interface PreloadingPerformance {
  route: string;
  preloadStartTime: number;
  preloadEndTime?: number;
  preloadDuration?: number;
  success: boolean;
  bundleSize?: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Runtime performance tracker
 */
export class RuntimePerformanceTracker {
  private routeLoadings = new Map<string, RouteLoadingPerformance>();
  private navigations: NavigationPerformance[] = [];
  private preloadings: PreloadingPerformance[] = [];
  private currentNavigation?: NavigationPerformance;
  private performanceObserver?: PerformanceObserver;
  private clientMetrics: ClientPerformanceMetrics = {};

  constructor() {
    this.initializePerformanceObserver();
    this.trackWebVitals();
  }

  /**
   * Initialize performance observer for client-side metrics
   */
  private initializePerformanceObserver(): void {
    if (typeof window === 'undefined' || !window.PerformanceObserver) {
      return; // Server-side or unsupported browser
    }

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerformanceEntry(entry);
        }
      });

      // Observe navigation, resource, and measure entries
      this.performanceObserver.observe({ 
        entryTypes: ['navigation', 'resource', 'measure', 'paint'] 
      });
    } catch (error) {
      console.warn('Failed to initialize performance observer:', error);
    }
  }

  /**
   * Handle performance entries from the observer
   */
  private handlePerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation':
        this.handleNavigationEntry(entry as PerformanceNavigationTiming);
        break;
      case 'resource':
        this.handleResourceEntry(entry as PerformanceResourceTiming);
        break;
      case 'paint':
        this.handlePaintEntry(entry as PerformancePaintTiming);
        break;
      case 'measure':
        this.handleMeasureEntry(entry);
        break;
    }
  }

  /**
   * Handle navigation timing entries
   */
  private handleNavigationEntry(entry: PerformanceNavigationTiming): void {
    // Track page load performance
    const loadTime = entry.loadEventEnd - entry.navigationStart;
    const domContentLoadedTime = entry.domContentLoadedEventEnd - entry.navigationStart;
    
    console.log(`📊 Page load: ${loadTime.toFixed(2)}ms (DOM: ${domContentLoadedTime.toFixed(2)}ms)`);
  }

  /**
   * Handle resource timing entries
   */
  private handleResourceEntry(entry: PerformanceResourceTiming): void {
    // Track resource loading (JS bundles, CSS, etc.)
    if (entry.name.includes('.js') || entry.name.includes('.css')) {
      const loadTime = entry.responseEnd - entry.requestStart;
      const size = entry.transferSize || 0;
      
      if (loadTime > 1000) { // Log slow resources
        console.warn(`⚠️  Slow resource: ${entry.name} (${loadTime.toFixed(2)}ms, ${(size / 1024).toFixed(1)}KB)`);
      }
    }
  }

  /**
   * Handle paint timing entries
   */
  private handlePaintEntry(entry: PerformancePaintTiming): void {
    if (entry.name === 'first-contentful-paint') {
      this.clientMetrics.firstContentfulPaint = entry.startTime;
    }
  }

  /**
   * Handle custom measure entries
   */
  private handleMeasureEntry(entry: PerformanceEntry): void {
    // Handle custom performance measures
    console.log(`📏 Custom measure: ${entry.name} = ${entry.duration?.toFixed(2)}ms`);
  }

  /**
   * Track Web Vitals metrics
   */
  private trackWebVitals(): void {
    if (typeof window === 'undefined') return;

    // Track Largest Contentful Paint (LCP)
    this.observeWebVital('largest-contentful-paint', (entry: any) => {
      this.clientMetrics.largestContentfulPaint = entry.startTime;
    });

    // Track First Input Delay (FID)
    this.observeWebVital('first-input', (entry: any) => {
      this.clientMetrics.firstInputDelay = entry.processingStart - entry.startTime;
    });

    // Track Cumulative Layout Shift (CLS)
    this.observeWebVital('layout-shift', (entry: any) => {
      if (!entry.hadRecentInput) {
        this.clientMetrics.cumulativeLayoutShift = 
          (this.clientMetrics.cumulativeLayoutShift || 0) + entry.value;
      }
    });
  }

  /**
   * Observe specific Web Vital metrics
   */
  private observeWebVital(type: string, callback: (entry: any) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          callback(entry);
        }
      });
      observer.observe({ type, buffered: true });
    } catch (error) {
      // Metric not supported in this browser
    }
  }

  /**
   * Start tracking route loading
   */
  startRouteLoading(route: string, preloaded: boolean = false): void {
    const loading: RouteLoadingPerformance = {
      route,
      loadStartTime: performance.now(),
      cacheHit: false,
      preloaded,
      dependencies: [],
      errors: []
    };

    this.routeLoadings.set(route, loading);
    console.log(`🚀 Loading route: ${route}${preloaded ? ' (preloaded)' : ''}`);
  }

  /**
   * End route loading tracking
   */
  endRouteLoading(
    route: string, 
    bundleSize?: number, 
    cacheHit: boolean = false,
    dependencies: string[] = []
  ): void {
    const loading = this.routeLoadings.get(route);
    if (!loading) return;

    loading.loadEndTime = performance.now();
    loading.loadDuration = loading.loadEndTime - loading.loadStartTime;
    loading.bundleSize = bundleSize;
    loading.cacheHit = cacheHit;
    loading.dependencies = dependencies;

    // Track in performance monitor
    performanceMonitor.trackRouteLoading(
      route,
      loading.loadDuration,
      bundleSize || 0,
      cacheHit,
      loading.preloaded
    );

    console.log(`✅ Route loaded: ${route} (${loading.loadDuration.toFixed(2)}ms${cacheHit ? ', cached' : ''})`);
    
    // Clean up completed loading
    this.routeLoadings.delete(route);
  }

  /**
   * Add error to route loading
   */
  addRouteLoadingError(route: string, error: string): void {
    const loading = this.routeLoadings.get(route);
    if (loading) {
      loading.errors.push(error);
    }
    console.error(`❌ Route loading error for ${route}: ${error}`);
  }

  /**
   * Start tracking navigation
   */
  startNavigation(fromRoute: string, toRoute: string): void {
    // End previous navigation if still active
    if (this.currentNavigation) {
      this.endNavigation();
    }

    this.currentNavigation = {
      fromRoute,
      toRoute,
      navigationStartTime: performance.now(),
      cacheHit: false
    };

    console.log(`🧭 Navigating: ${fromRoute} → ${toRoute}`);
  }

  /**
   * Mark navigation render start
   */
  startNavigationRender(): void {
    if (this.currentNavigation) {
      this.currentNavigation.renderStartTime = performance.now();
    }
  }

  /**
   * Mark navigation render end
   */
  endNavigationRender(): void {
    if (this.currentNavigation && this.currentNavigation.renderStartTime) {
      this.currentNavigation.renderEndTime = performance.now();
      this.currentNavigation.renderDuration = 
        this.currentNavigation.renderEndTime - this.currentNavigation.renderStartTime;
    }
  }

  /**
   * Mark hydration start
   */
  startHydration(): void {
    if (this.currentNavigation) {
      this.currentNavigation.hydrationStartTime = performance.now();
    }
  }

  /**
   * Mark hydration end
   */
  endHydration(): void {
    if (this.currentNavigation && this.currentNavigation.hydrationStartTime) {
      this.currentNavigation.hydrationEndTime = performance.now();
      this.currentNavigation.hydrationDuration = 
        this.currentNavigation.hydrationEndTime - this.currentNavigation.hydrationStartTime;
    }
  }

  /**
   * End navigation tracking
   */
  endNavigation(cacheHit: boolean = false): void {
    if (!this.currentNavigation) return;

    this.currentNavigation.navigationEndTime = performance.now();
    this.currentNavigation.navigationDuration = 
      this.currentNavigation.navigationEndTime - this.currentNavigation.navigationStartTime;
    this.currentNavigation.cacheHit = cacheHit;

    // Track in performance monitor
    performanceMonitor.trackNavigation(
      this.currentNavigation.fromRoute,
      this.currentNavigation.toRoute,
      this.currentNavigation.navigationDuration,
      this.currentNavigation.renderDuration || 0,
      this.currentNavigation.hydrationDuration
    );

    this.navigations.push({ ...this.currentNavigation });
    
    console.log(`✅ Navigation completed: ${this.currentNavigation.fromRoute} → ${this.currentNavigation.toRoute} (${this.currentNavigation.navigationDuration.toFixed(2)}ms)`);
    
    // Keep only recent navigations
    if (this.navigations.length > 100) {
      this.navigations = this.navigations.slice(-100);
    }

    this.currentNavigation = undefined;
  }

  /**
   * Start tracking preloading
   */
  startPreloading(route: string, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    const preloading: PreloadingPerformance = {
      route,
      preloadStartTime: performance.now(),
      success: false,
      priority
    };

    this.preloadings.push(preloading);
    console.log(`🔄 Preloading route: ${route} (priority: ${priority})`);
  }

  /**
   * End preloading tracking
   */
  endPreloading(route: string, success: boolean, bundleSize?: number): void {
    const preloading = this.preloadings.find(p => 
      p.route === route && !p.preloadEndTime
    );
    
    if (!preloading) return;

    preloading.preloadEndTime = performance.now();
    preloading.preloadDuration = preloading.preloadEndTime - preloading.preloadStartTime;
    preloading.success = success;
    preloading.bundleSize = bundleSize;

    const status = success ? '✅' : '❌';
    console.log(`${status} Preload ${success ? 'completed' : 'failed'}: ${route} (${preloading.preloadDuration.toFixed(2)}ms)`);
  }

  /**
   * Track custom performance metric
   */
  trackCustomMetric(name: string, value: number, unit: string = 'ms'): void {
    console.log(`📊 Custom metric: ${name} = ${value.toFixed(2)}${unit}`);
    
    // Create custom performance measure
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      try {
        performance.mark(`${name}-start`);
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
      } catch (error) {
        // Ignore errors in performance API
      }
    }
  }

  /**
   * Get route loading statistics
   */
  getRouteLoadingStats(): {
    averageLoadTime: number;
    cacheHitRate: number;
    slowestRoutes: { route: string; loadTime: number }[];
    totalRoutes: number;
  } {
    const completedLoadings = Array.from(this.routeLoadings.values())
      .filter(l => l.loadDuration !== undefined);

    if (completedLoadings.length === 0) {
      return {
        averageLoadTime: 0,
        cacheHitRate: 0,
        slowestRoutes: [],
        totalRoutes: 0
      };
    }

    const totalLoadTime = completedLoadings.reduce((sum, l) => sum + (l.loadDuration || 0), 0);
    const averageLoadTime = totalLoadTime / completedLoadings.length;
    const cacheHits = completedLoadings.filter(l => l.cacheHit).length;
    const cacheHitRate = cacheHits / completedLoadings.length;

    const slowestRoutes = completedLoadings
      .map(l => ({ route: l.route, loadTime: l.loadDuration || 0 }))
      .sort((a, b) => b.loadTime - a.loadTime)
      .slice(0, 5);

    return {
      averageLoadTime,
      cacheHitRate,
      slowestRoutes,
      totalRoutes: completedLoadings.length
    };
  }

  /**
   * Get navigation statistics
   */
  getNavigationStats(): {
    averageNavigationTime: number;
    averageRenderTime: number;
    averageHydrationTime: number;
    slowestNavigations: { from: string; to: string; time: number }[];
    totalNavigations: number;
  } {
    if (this.navigations.length === 0) {
      return {
        averageNavigationTime: 0,
        averageRenderTime: 0,
        averageHydrationTime: 0,
        slowestNavigations: [],
        totalNavigations: 0
      };
    }

    const totalNavTime = this.navigations.reduce((sum, n) => sum + (n.navigationDuration || 0), 0);
    const totalRenderTime = this.navigations.reduce((sum, n) => sum + (n.renderDuration || 0), 0);
    const totalHydrationTime = this.navigations.reduce((sum, n) => sum + (n.hydrationDuration || 0), 0);

    const averageNavigationTime = totalNavTime / this.navigations.length;
    const averageRenderTime = totalRenderTime / this.navigations.length;
    const averageHydrationTime = totalHydrationTime / this.navigations.length;

    const slowestNavigations = this.navigations
      .map(n => ({ from: n.fromRoute, to: n.toRoute, time: n.navigationDuration || 0 }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);

    return {
      averageNavigationTime,
      averageRenderTime,
      averageHydrationTime,
      slowestNavigations,
      totalNavigations: this.navigations.length
    };
  }

  /**
   * Get client performance metrics
   */
  getClientMetrics(): ClientPerformanceMetrics {
    return { ...this.clientMetrics };
  }

  /**
   * Get preloading statistics
   */
  getPreloadingStats(): {
    successRate: number;
    averagePreloadTime: number;
    totalPreloads: number;
    failedPreloads: string[];
  } {
    const completedPreloads = this.preloadings.filter(p => p.preloadEndTime !== undefined);
    
    if (completedPreloads.length === 0) {
      return {
        successRate: 0,
        averagePreloadTime: 0,
        totalPreloads: 0,
        failedPreloads: []
      };
    }

    const successfulPreloads = completedPreloads.filter(p => p.success);
    const successRate = successfulPreloads.length / completedPreloads.length;
    
    const totalPreloadTime = completedPreloads.reduce((sum, p) => sum + (p.preloadDuration || 0), 0);
    const averagePreloadTime = totalPreloadTime / completedPreloads.length;
    
    const failedPreloads = completedPreloads
      .filter(p => !p.success)
      .map(p => p.route);

    return {
      successRate,
      averagePreloadTime,
      totalPreloads: completedPreloads.length,
      failedPreloads
    };
  }

  /**
   * Print performance summary
   */
  printSummary(): void {
    const routeStats = this.getRouteLoadingStats();
    const navStats = this.getNavigationStats();
    const preloadStats = this.getPreloadingStats();
    const clientMetrics = this.getClientMetrics();

    console.log('\n🏃‍♂️ Runtime Performance Summary');
    console.log('='.repeat(50));

    // Route loading stats
    if (routeStats.totalRoutes > 0) {
      console.log(`Route Loading:`);
      console.log(`  Average load time: ${routeStats.averageLoadTime.toFixed(2)}ms`);
      console.log(`  Cache hit rate: ${(routeStats.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`  Total routes loaded: ${routeStats.totalRoutes}`);
      
      if (routeStats.slowestRoutes.length > 0) {
        console.log(`  Slowest routes:`);
        routeStats.slowestRoutes.forEach(r => 
          console.log(`    ${r.route}: ${r.loadTime.toFixed(2)}ms`)
        );
      }
    }

    // Navigation stats
    if (navStats.totalNavigations > 0) {
      console.log(`\nNavigation:`);
      console.log(`  Average navigation time: ${navStats.averageNavigationTime.toFixed(2)}ms`);
      console.log(`  Average render time: ${navStats.averageRenderTime.toFixed(2)}ms`);
      if (navStats.averageHydrationTime > 0) {
        console.log(`  Average hydration time: ${navStats.averageHydrationTime.toFixed(2)}ms`);
      }
      console.log(`  Total navigations: ${navStats.totalNavigations}`);
    }

    // Preloading stats
    if (preloadStats.totalPreloads > 0) {
      console.log(`\nPreloading:`);
      console.log(`  Success rate: ${(preloadStats.successRate * 100).toFixed(1)}%`);
      console.log(`  Average preload time: ${preloadStats.averagePreloadTime.toFixed(2)}ms`);
      console.log(`  Total preloads: ${preloadStats.totalPreloads}`);
    }

    // Client metrics
    if (Object.keys(clientMetrics).length > 0) {
      console.log(`\nWeb Vitals:`);
      if (clientMetrics.firstContentfulPaint) {
        console.log(`  First Contentful Paint: ${clientMetrics.firstContentfulPaint.toFixed(2)}ms`);
      }
      if (clientMetrics.largestContentfulPaint) {
        console.log(`  Largest Contentful Paint: ${clientMetrics.largestContentfulPaint.toFixed(2)}ms`);
      }
      if (clientMetrics.firstInputDelay) {
        console.log(`  First Input Delay: ${clientMetrics.firstInputDelay.toFixed(2)}ms`);
      }
      if (clientMetrics.cumulativeLayoutShift) {
        console.log(`  Cumulative Layout Shift: ${clientMetrics.cumulativeLayoutShift.toFixed(3)}`);
      }
    }

    console.log('');
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.routeLoadings.clear();
    this.navigations = [];
    this.preloadings = [];
    this.currentNavigation = undefined;
    this.clientMetrics = {};
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = undefined;
    }
    this.reset();
  }
}

/**
 * Singleton runtime performance tracker
 */
export const runtimePerformanceTracker = new RuntimePerformanceTracker();