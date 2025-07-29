/**
 * Performance Monitoring System
 * 
 * This module provides performance monitoring for Ultra-Modern MTM applications.
 * It tracks build-time and runtime performance metrics and provides insights for optimization.
 */

interface PerformanceMetrics {
  // Build metrics
  buildTime?: number;
  bundleSize?: number;
  chunkCount?: number;
  
  // Runtime metrics
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  timeToInteractive?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  
  // Custom metrics
  [key: string]: any;
}

interface PerformanceMonitorOptions {
  // Configuration options
  enableWebVitals?: boolean;
  enableBuildMetrics?: boolean;
  enableCustomMetrics?: boolean;
  sampleRate?: number;
  reportingEndpoint?: string;
  reportingInterval?: number;
  
  // Callbacks
  onReport?: (metrics: PerformanceMetrics) => void;
  onThresholdExceeded?: (metric: string, value: number, threshold: number) => void;
}

interface PerformanceThresholds {
  // Build thresholds
  buildTime?: number; // milliseconds
  bundleSize?: number; // bytes
  
  // Runtime thresholds (based on Core Web Vitals)
  firstContentfulPaint?: number; // milliseconds
  largestContentfulPaint?: number; // milliseconds
  timeToInteractive?: number; // milliseconds
  firstInputDelay?: number; // milliseconds
  cumulativeLayoutShift?: number; // unitless
  
  // Custom thresholds
  [key: string]: number | undefined;
}

class PerformanceMonitor {
  private options: PerformanceMonitorOptions;
  private metrics: PerformanceMetrics = {};
  private marks: Record<string, number> = {};
  private measures: Record<string, number> = {};
  private thresholds: PerformanceThresholds;
  private reportingTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  
  constructor(options: PerformanceMonitorOptions = {}) {
    this.options = {
      enableWebVitals: true,
      enableBuildMetrics: true,
      enableCustomMetrics: true,
      sampleRate: 1.0, // 100% by default
      reportingInterval: 60000, // 1 minute
      ...options
    };
    
    // Default thresholds based on Core Web Vitals
    this.thresholds = {
      buildTime: 60000, // 60 seconds
      bundleSize: 250000, // 250KB
      firstContentfulPaint: 1800, // 1.8 seconds
      largestContentfulPaint: 2500, // 2.5 seconds
      timeToInteractive: 3800, // 3.8 seconds
      firstInputDelay: 100, // 100 milliseconds
      cumulativeLayoutShift: 0.1 // 0.1 unitless
    };
  }
  
  /**
   * Initialize the performance monitoring system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      // Initialize Web Vitals if enabled
      if (this.options.enableWebVitals) {
        await this.initializeWebVitals();
      }
      
      // Start periodic reporting if configured
      if (this.options.reportingInterval && this.options.reportingInterval > 0) {
        this.startPeriodicReporting();
      }
    }
    
    this.isInitialized = true;
  }
  
  /**
   * Record build-time metrics
   */
  recordBuildMetrics(buildStats: { time: number; size: number; chunks: number }): void {
    if (!this.options.enableBuildMetrics) {
      return;
    }
    
    this.metrics.buildTime = buildStats.time;
    this.metrics.bundleSize = buildStats.size;
    this.metrics.chunkCount = buildStats.chunks;
    
    // Check thresholds
    this.checkThreshold('buildTime', buildStats.time);
    this.checkThreshold('bundleSize', buildStats.size);
    
    // Report build metrics immediately
    this.reportMetrics();
  }
  
  /**
   * Start a performance mark
   */
  mark(name: string): void {
    if (!this.options.enableCustomMetrics) {
      return;
    }
    
    if (typeof performance !== 'undefined') {
      performance.mark(`mtm:${name}:start`);
    }
    
    this.marks[name] = Date.now();
  }
  
  /**
   * End a performance mark and measure the duration
   */
  measure(name: string): number {
    if (!this.options.enableCustomMetrics || !this.marks[name]) {
      return 0;
    }
    
    const endTime = Date.now();
    const startTime = this.marks[name];
    const duration = endTime - startTime;
    
    if (typeof performance !== 'undefined') {
      try {
        performance.mark(`mtm:${name}:end`);
        performance.measure(`mtm:${name}`, `mtm:${name}:start`, `mtm:${name}:end`);
      } catch (e) {
        // Some browsers might throw if marks don't exist
      }
    }
    
    this.measures[name] = duration;
    this.metrics[`custom_${name}`] = duration;
    
    // Check threshold if defined
    this.checkThreshold(`custom_${name}`, duration);
    
    return duration;
  }
  
  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number): void {
    if (!this.options.enableCustomMetrics) {
      return;
    }
    
    this.metrics[`custom_${name}`] = value;
    
    // Check threshold if defined
    this.checkThreshold(`custom_${name}`, value);
  }
  
  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: PerformanceThresholds): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds
    };
  }
  
  /**
   * Generate a performance report
   */
  generateReport(): { metrics: PerformanceMetrics; timestamp: string; assessment: string } {
    const metrics = this.getMetrics();
    
    // Calculate overall performance score
    const score = this.calculatePerformanceScore(metrics);
    
    // Determine assessment based on score
    let assessment = 'unknown';
    if (score >= 90) {
      assessment = 'excellent';
    } else if (score >= 75) {
      assessment = 'good';
    } else if (score >= 50) {
      assessment = 'needs improvement';
    } else {
      assessment = 'poor';
    }
    
    return {
      metrics,
      timestamp: new Date().toISOString(),
      assessment
    };
  }
  
  /**
   * Report metrics to the configured endpoint or callback
   */
  reportMetrics(): void {
    // Skip reporting based on sample rate
    if (Math.random() > this.options.sampleRate) {
      return;
    }
    
    const report = this.generateReport();
    
    // Call onReport callback if provided
    if (this.options.onReport) {
      this.options.onReport(report.metrics);
    }
    
    // Send to reporting endpoint if configured
    if (this.options.reportingEndpoint) {
      this.sendMetricsToEndpoint(report);
    }
  }
  
  /**
   * Stop performance monitoring and reporting
   */
  stop(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }
  }
  
  // Private methods
  
  /**
   * Initialize Web Vitals monitoring
   */
  private async initializeWebVitals(): Promise<void> {
    try {
      // Dynamic import to avoid requiring web-vitals as a dependency
      const { getCLS, getFID, getLCP, getTTFB, getFCP } = await import('web-vitals');
      
      getCLS(({ value }) => {
        this.metrics.cumulativeLayoutShift = value;
        this.checkThreshold('cumulativeLayoutShift', value);
      });
      
      getFID(({ value }) => {
        this.metrics.firstInputDelay = value;
        this.checkThreshold('firstInputDelay', value);
      });
      
      getLCP(({ value }) => {
        this.metrics.largestContentfulPaint = value;
        this.checkThreshold('largestContentfulPaint', value);
      });
      
      getTTFB(({ value }) => {
        this.metrics.timeToFirstByte = value;
      });
      
      getFCP(({ value }) => {
        this.metrics.firstContentfulPaint = value;
        this.checkThreshold('firstContentfulPaint', value);
      });
    } catch (error) {
      console.warn('Failed to initialize Web Vitals:', error);
    }
  }
  
  /**
   * Start periodic reporting of metrics
   */
  private startPeriodicReporting(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
    }
    
    this.reportingTimer = setInterval(() => {
      this.reportMetrics();
    }, this.options.reportingInterval);
  }
  
  /**
   * Send metrics to the configured reporting endpoint
   */
  private sendMetricsToEndpoint(report: any): void {
    if (!this.options.reportingEndpoint) {
      return;
    }
    
    // Use sendBeacon if available for better reliability during page unload
    if (navigator && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(report)], { type: 'application/json' });
        navigator.sendBeacon(this.options.reportingEndpoint, blob);
        return;
      } catch (e) {
        // Fall back to fetch if sendBeacon fails
      }
    }
    
    // Fall back to fetch
    fetch(this.options.reportingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(report),
      // Use keepalive to ensure the request completes even if the page is unloaded
      keepalive: true
    }).catch(error => {
      console.warn('Failed to send performance metrics:', error);
    });
  }
  
  /**
   * Check if a metric exceeds its threshold
   */
  private checkThreshold(metric: string, value: number): void {
    const threshold = this.thresholds[metric];
    
    if (threshold !== undefined && value > threshold) {
      // Call threshold exceeded callback if provided
      if (this.options.onThresholdExceeded) {
        this.options.onThresholdExceeded(metric, value, threshold);
      }
    }
  }
  
  /**
   * Calculate an overall performance score based on metrics
   */
  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    // This is a simplified scoring algorithm
    // In a real implementation, this would be more sophisticated
    
    let score = 100;
    let metricCount = 0;
    
    // Check Core Web Vitals
    if (metrics.largestContentfulPaint !== undefined) {
      metricCount++;
      if (metrics.largestContentfulPaint > 2500) {
        score -= 25;
      } else if (metrics.largestContentfulPaint > 1800) {
        score -= 10;
      }
    }
    
    if (metrics.firstInputDelay !== undefined) {
      metricCount++;
      if (metrics.firstInputDelay > 300) {
        score -= 25;
      } else if (metrics.firstInputDelay > 100) {
        score -= 10;
      }
    }
    
    if (metrics.cumulativeLayoutShift !== undefined) {
      metricCount++;
      if (metrics.cumulativeLayoutShift > 0.25) {
        score -= 25;
      } else if (metrics.cumulativeLayoutShift > 0.1) {
        score -= 10;
      }
    }
    
    // Check build metrics
    if (metrics.buildTime !== undefined) {
      metricCount++;
      if (metrics.buildTime > 120000) { // 2 minutes
        score -= 15;
      } else if (metrics.buildTime > 60000) { // 1 minute
        score -= 5;
      }
    }
    
    if (metrics.bundleSize !== undefined) {
      metricCount++;
      if (metrics.bundleSize > 500000) { // 500KB
        score -= 15;
      } else if (metrics.bundleSize > 250000) { // 250KB
        score -= 5;
      }
    }
    
    // Ensure we have at least some metrics
    if (metricCount === 0) {
      return 0;
    }
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }
}

// Export the performance monitor
export { PerformanceMonitor, PerformanceMetrics, PerformanceMonitorOptions, PerformanceThresholds };

// Create a default instance for easy import
const defaultMonitor = new PerformanceMonitor();

export default defaultMonitor;