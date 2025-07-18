/**
 * Core Performance Monitoring Service
 * Implements comprehensive performance metrics collection and monitoring
 */

import {
  PerformanceMetrics,
  PerformanceMonitoringConfig,
  PerformanceAlert,
  PerformanceTimelineEntry,
  CoreWebVitals,
  FrameworkLoadingPerformance,
  ServiceWorkerPerformance,
  NetworkPerformance,
  BundlePerformance,
  PerformanceBudget,
  PerformanceReport
} from '../types/performance-monitoring.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

export class PerformanceMonitor {
  private config: PerformanceMonitoringConfig;
  private metrics: PerformanceMetrics[] = [];
  private timeline: PerformanceTimelineEntry[] = [];
  private alerts: PerformanceAlert[] = [];
  private sessionId: string;
  private startTime: number;
  private observers: Map<string, PerformanceObserver> = new Map();
  private webVitalsCallbacks: Map<string, (entry: any) => void> = new Map();

  constructor(config: PerformanceMonitoringConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.startTime = performance.now();
    
    if (this.config.enabled) {
      this.initializeMonitoring();
    }
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    if (this.config.collectWebVitals) {
      this.initializeWebVitalsCollection();
    }
    
    if (this.config.collectNetworkMetrics) {
      this.initializeNetworkMonitoring();
    }
    
    // Initialize performance observer for navigation and resource timing
    this.initializePerformanceObservers();
    
    // Set up periodic metrics collection
    this.startPeriodicCollection();
  }

  /**
   * Initialize Web Vitals collection
   */
  private initializeWebVitalsCollection(): void {
    // LCP (Largest Contentful Paint)
    this.observeWebVital('largest-contentful-paint', (entry) => {
      this.recordWebVital('lcp', entry.value);
    });

    // FID (First Input Delay)
    this.observeWebVital('first-input', (entry) => {
      this.recordWebVital('fid', entry.processingStart - entry.startTime);
    });

    // CLS (Cumulative Layout Shift)
    this.observeWebVital('layout-shift', (entry) => {
      if (!entry.hadRecentInput) {
        this.recordWebVital('cls', entry.value);
      }
    });

    // FCP (First Contentful Paint)
    this.observeWebVital('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') {
        this.recordWebVital('fcp', entry.startTime);
      }
    });

    // Navigation timing for TTFB
    this.observeWebVital('navigation', (entry) => {
      this.recordWebVital('ttfb', entry.responseStart - entry.requestStart);
    });
  }

  /**
   * Observe specific web vital metrics
   */
  private observeWebVital(type: string, callback: (entry: any) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(callback);
      });
      
      observer.observe({ type, buffered: true });
      this.observers.set(type, observer);
      this.webVitalsCallbacks.set(type, callback);
    } catch (error) {
      console.warn(`Failed to observe ${type}:`, error);
    }
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring(): void {
    // Only initialize in browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    // Monitor network information API if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          this.recordNetworkChange();
        });
      }
    }

    // Monitor online/offline status
    window.addEventListener('online', () => this.recordNetworkChange());
    window.addEventListener('offline', () => this.recordNetworkChange());
  }

  /**
   * Initialize performance observers
   */
  private initializePerformanceObservers(): void {
    // Resource timing observer
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordResourceTiming(entry as PerformanceResourceTiming);
        });
      });
      
      resourceObserver.observe({ type: 'resource', buffered: true });
      this.observers.set('resource', resourceObserver);
    } catch (error) {
      console.warn('Failed to observe resource timing:', error);
    }

    // Measure observer for custom metrics
    try {
      const measureObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordCustomMeasure(entry as PerformanceMeasure);
        });
      });
      
      measureObserver.observe({ type: 'measure', buffered: true });
      this.observers.set('measure', measureObserver);
    } catch (error) {
      console.warn('Failed to observe measures:', error);
    }
  }

  /**
   * Record framework loading performance
   */
  recordFrameworkLoad(performance: FrameworkLoadingPerformance): void {
    if (!this.config.collectFrameworkMetrics) return;

    this.addTimelineEntry({
      timestamp: performance.loadEndTime,
      type: 'framework-load',
      data: performance,
      duration: performance.loadDuration
    });

    // Check against performance budget
    this.checkFrameworkLoadBudget(performance);
  }

  /**
   * Record service worker performance
   */
  recordServiceWorkerPerformance(performance: ServiceWorkerPerformance): void {
    if (!this.config.collectServiceWorkerMetrics) return;

    this.addTimelineEntry({
      timestamp: Date.now(),
      type: 'cache-operation',
      data: performance
    });

    // Check for service worker issues
    this.checkServiceWorkerHealth(performance);
  }

  /**
   * Record web vital metric
   */
  private recordWebVital(name: string, value: number): void {
    const rating = this.getWebVitalRating(name, value);
    
    this.addTimelineEntry({
      timestamp: Date.now(),
      type: 'web-vital',
      data: { name, value, rating }
    });

    // Check against budget
    this.checkWebVitalBudget(name, value);
  }

  /**
   * Record network condition change
   */
  private recordNetworkChange(): void {
    const networkInfo = this.getNetworkInfo();
    
    this.addTimelineEntry({
      timestamp: Date.now(),
      type: 'user-interaction',
      data: { type: 'network-change', networkInfo }
    });
  }

  /**
   * Record resource timing
   */
  private recordResourceTiming(entry: PerformanceResourceTiming): void {
    // Filter for framework-related resources
    if (this.isFrameworkResource(entry.name)) {
      this.addTimelineEntry({
        timestamp: entry.responseEnd,
        type: 'framework-load',
        data: {
          url: entry.name,
          duration: entry.duration,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize
        },
        duration: entry.duration
      });
    }
  }

  /**
   * Record custom performance measure
   */
  private recordCustomMeasure(entry: PerformanceMeasure): void {
    this.addTimelineEntry({
      timestamp: entry.startTime + entry.duration,
      type: 'framework-load',
      data: {
        name: entry.name,
        duration: entry.duration,
        detail: entry.detail
      },
      duration: entry.duration
    });
  }

  /**
   * Get current performance metrics snapshot
   */
  getCurrentMetrics(): PerformanceMetrics {
    return {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      webVitals: this.getCurrentWebVitals(),
      frameworkLoading: this.getFrameworkLoadingMetrics(),
      serviceWorker: this.getServiceWorkerMetrics(),
      network: this.getNetworkMetrics(),
      bundle: this.getBundleMetrics(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'test-agent',
      connectionType: this.getConnectionType(),
      deviceMemory: typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : undefined,
      hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
      customMetrics: this.getCustomMetrics()
    };
  }

  /**
   * Generate performance report
   */
  generateReport(timeRange?: { start: number; end: number }): PerformanceReport {
    const now = Date.now();
    const range = timeRange || { start: this.startTime, end: now };
    
    const filteredMetrics = this.metrics.filter(
      m => m.timestamp >= range.start && m.timestamp <= range.end
    );

    const filteredAlerts = this.alerts.filter(
      a => a.timestamp >= range.start && a.timestamp <= range.end
    );

    return {
      id: this.generateReportId(),
      timestamp: now,
      timeRange: range,
      summary: this.generateSummary(filteredMetrics),
      metrics: filteredMetrics,
      alerts: filteredAlerts,
      recommendations: this.generateRecommendations(filteredMetrics, filteredAlerts)
    };
  }

  /**
   * Get performance timeline
   */
  getTimeline(limit?: number): PerformanceTimelineEntry[] {
    const entries = [...this.timeline].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? entries.slice(0, limit) : entries;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    const now = Date.now();
    const alertTimeout = 5 * 60 * 1000; // 5 minutes
    
    return this.alerts.filter(alert => 
      now - alert.timestamp < alertTimeout && 
      alert.severity !== 'low'
    );
  }

  /**
   * Clear old metrics and timeline entries
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    this.metrics = this.metrics.filter(m => now - m.timestamp < maxAge);
    this.timeline = this.timeline.filter(t => now - t.timestamp < maxAge);
    this.alerts = this.alerts.filter(a => now - a.timestamp < maxAge);
  }

  /**
   * Dispose of the performance monitor
   */
  dispose(): void {
    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.webVitalsCallbacks.clear();
    
    // Clear data
    this.metrics = [];
    this.timeline = [];
    this.alerts = [];
  }

  // Private helper methods

  private addTimelineEntry(entry: PerformanceTimelineEntry): void {
    this.timeline.push(entry);
    
    // Limit timeline size
    if (this.timeline.length > this.config.maxEntriesPerType * 4) {
      this.timeline = this.timeline.slice(-this.config.maxEntriesPerType * 3);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPeriodicCollection(): void {
    setInterval(() => {
      if (Math.random() < this.config.sampleRate) {
        const metrics = this.getCurrentMetrics();
        this.metrics.push(metrics);
        
        // Limit metrics array size
        if (this.metrics.length > this.config.maxEntriesPerType) {
          this.metrics = this.metrics.slice(-Math.floor(this.config.maxEntriesPerType * 0.8));
        }
      }
    }, this.config.reportingInterval);
  }

  private getCurrentWebVitals(): CoreWebVitals {
    // Extract latest web vitals from timeline
    const webVitalEntries = this.timeline
      .filter(entry => entry.type === 'web-vital')
      .reduce((acc, entry) => {
        acc[entry.data.name] = entry.data.value;
        return acc;
      }, {} as any);

    return {
      lcp: webVitalEntries.lcp || 0,
      fid: webVitalEntries.fid || 0,
      cls: webVitalEntries.cls || 0,
      fcp: webVitalEntries.fcp || 0,
      ttfb: webVitalEntries.ttfb || 0,
      inp: webVitalEntries.inp || 0
    };
  }

  private getFrameworkLoadingMetrics(): FrameworkLoadingPerformance[] {
    return this.timeline
      .filter(entry => entry.type === 'framework-load' && entry.data.framework)
      .map(entry => entry.data as FrameworkLoadingPerformance);
  }

  private getServiceWorkerMetrics(): ServiceWorkerPerformance {
    const swEntries = this.timeline.filter(entry => entry.type === 'cache-operation');
    
    return {
      registrationTime: 0,
      activationTime: 0,
      cacheOperations: [],
      backgroundTasks: [],
      messageLatency: [],
      errorCount: 0,
      uptime: Date.now() - this.startTime
    };
  }

  private getNetworkMetrics(): NetworkPerformance {
    const networkInfo = this.getNetworkInfo();
    
    return {
      requestCount: 0,
      totalBytesTransferred: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      compressionRatio: 0,
      failureRate: 0,
      connectionType: networkInfo.effectiveType,
      effectiveBandwidth: networkInfo.downlink
    };
  }

  private getBundleMetrics(): BundlePerformance {
    return {
      initialBundleSize: 0,
      frameworkBundleSizes: new Map(),
      sharedDependencySize: 0,
      compressionRatio: 0,
      loadTime: 0,
      parseTime: 0,
      cacheEfficiency: 0
    };
  }

  private getCustomMetrics(): Record<string, number> {
    return {};
  }

  private getNetworkInfo(): any {
    if (typeof navigator === 'undefined') {
      return {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: false
      };
    }

    const connection = (navigator as any).connection;
    return connection || {
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
      saveData: false
    };
  }

  private getConnectionType(): string {
    return this.getNetworkInfo().effectiveType || 'unknown';
  }

  private isFrameworkResource(url: string): boolean {
    return /\/(react|vue|svelte|solid)[\/@]/.test(url) || 
           /metamon.*framework/.test(url);
  }

  private getWebVitalRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = {
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      fcp: { good: 1800, poor: 3000 },
      ttfb: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[name as keyof typeof thresholds];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private checkFrameworkLoadBudget(performance: FrameworkLoadingPerformance): void {
    if (performance.loadDuration > this.config.performanceBudget.maxFrameworkLoadTime) {
      this.createAlert({
        type: 'budget-exceeded',
        severity: 'medium',
        message: `Framework ${performance.framework} load time exceeded budget`,
        metric: 'framework-load-time',
        currentValue: performance.loadDuration,
        threshold: this.config.performanceBudget.maxFrameworkLoadTime,
        suggestions: [
          'Consider code splitting the framework bundle',
          'Enable compression for framework resources',
          'Implement more aggressive caching strategies'
        ]
      });
    }
  }

  private checkWebVitalBudget(name: string, value: number): void {
    const budgetMap = {
      lcp: this.config.performanceBudget.maxLCP,
      fid: this.config.performanceBudget.maxFID,
      cls: this.config.performanceBudget.maxCLS
    };

    const budget = budgetMap[name as keyof typeof budgetMap];
    if (budget && value > budget) {
      this.createAlert({
        type: 'budget-exceeded',
        severity: 'high',
        message: `${name.toUpperCase()} exceeded performance budget`,
        metric: name,
        currentValue: value,
        threshold: budget,
        suggestions: this.getWebVitalSuggestions(name)
      });
    }
  }

  private checkServiceWorkerHealth(performance: ServiceWorkerPerformance): void {
    if (performance.errorCount > 5) {
      this.createAlert({
        type: 'error-threshold',
        severity: 'high',
        message: 'High service worker error rate detected',
        metric: 'service-worker-errors',
        currentValue: performance.errorCount,
        threshold: 5,
        suggestions: [
          'Check service worker implementation for bugs',
          'Verify cache storage quotas',
          'Monitor network connectivity issues'
        ]
      });
    }
  }

  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...alertData
    };

    this.alerts.push(alert);
    
    if (this.config.enableDebugMode) {
      console.warn('Performance Alert:', alert);
    }
  }

  private getWebVitalSuggestions(metric: string): string[] {
    const suggestions = {
      lcp: [
        'Optimize largest contentful element loading',
        'Implement resource preloading',
        'Reduce server response times'
      ],
      fid: [
        'Reduce JavaScript execution time',
        'Split long tasks into smaller chunks',
        'Use web workers for heavy computations'
      ],
      cls: [
        'Set explicit dimensions for images and videos',
        'Reserve space for dynamic content',
        'Avoid inserting content above existing content'
      ]
    };

    return suggestions[metric as keyof typeof suggestions] || [];
  }

  private generateSummary(metrics: PerformanceMetrics[]): any {
    // Count framework loading sessions from timeline instead of metrics
    const frameworkLoads = this.timeline.filter(entry => entry.type === 'framework-load').length;
    
    if (metrics.length === 0) {
      return {
        totalPageLoads: frameworkLoads,
        averageLoadTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        webVitalsScore: 0
      };
    }

    const totalLoads = Math.max(metrics.length, frameworkLoads);
    const avgLoadTime = metrics.reduce((sum, m) => 
      sum + (m.frameworkLoading.reduce((s, f) => s + f.loadDuration, 0) / (m.frameworkLoading.length || 1)), 0
    ) / (totalLoads || 1);

    return {
      totalPageLoads: totalLoads,
      averageLoadTime: avgLoadTime,
      errorRate: 0,
      cacheHitRate: 0,
      webVitalsScore: this.calculateWebVitalsScore(metrics)
    };
  }

  private calculateWebVitalsScore(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;

    const latestMetrics = metrics[metrics.length - 1];
    const vitals = latestMetrics.webVitals;

    // Simple scoring based on thresholds
    let score = 0;
    if (vitals.lcp <= 2500) score += 25;
    else if (vitals.lcp <= 4000) score += 15;
    
    if (vitals.fid <= 100) score += 25;
    else if (vitals.fid <= 300) score += 15;
    
    if (vitals.cls <= 0.1) score += 25;
    else if (vitals.cls <= 0.25) score += 15;
    
    if (vitals.fcp <= 1800) score += 25;
    else if (vitals.fcp <= 3000) score += 15;

    return score;
  }

  private generateRecommendations(metrics: PerformanceMetrics[], alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = [];

    // Add recommendations based on alerts
    alerts.forEach(alert => {
      recommendations.push(...alert.suggestions);
    });

    // Add general recommendations based on metrics
    if (metrics.length > 0) {
      const latest = metrics[metrics.length - 1];
      
      if (latest.webVitals.lcp > 2500) {
        recommendations.push('Consider implementing critical resource preloading');
      }
      
      if (latest.webVitals.cls > 0.1) {
        recommendations.push('Review layout stability during framework loading');
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }
}