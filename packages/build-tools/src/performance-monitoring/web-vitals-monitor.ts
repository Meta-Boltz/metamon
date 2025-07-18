/**
 * Core Web Vitals Monitor
 * Monitors and tracks Core Web Vitals with optimization alerts
 */

import {
  CoreWebVitals,
  WebVitalEntry,
  PerformanceAlert,
  PerformanceTimelineEntry
} from '../types/performance-monitoring.js';

export interface WebVitalThresholds {
  lcp: { good: number; poor: number };
  fid: { good: number; poor: number };
  cls: { good: number; poor: number };
  fcp: { good: number; poor: number };
  ttfb: { good: number; poor: number };
  inp?: { good: number; poor: number };
}

export interface WebVitalTrend {
  metric: string;
  values: { timestamp: number; value: number; rating: string }[];
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
}

export interface WebVitalOptimizationSuggestion {
  metric: string;
  currentValue: number;
  targetValue: number;
  priority: 'high' | 'medium' | 'low';
  suggestions: string[];
  estimatedImpact: number;
}

export class WebVitalsMonitor {
  private vitalsHistory: Map<string, WebVitalEntry[]> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private thresholds: WebVitalThresholds;
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];
  private maxHistorySize: number = 100;
  private isMonitoring: boolean = false;

  constructor(thresholds?: Partial<WebVitalThresholds>) {
    this.thresholds = {
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      fcp: { good: 1800, poor: 3000 },
      ttfb: { good: 800, poor: 1800 },
      inp: { good: 200, poor: 500 },
      ...thresholds
    };

    this.initializeVitalsHistory();
  }

  /**
   * Start monitoring Core Web Vitals
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Monitor LCP (Largest Contentful Paint)
    this.observeVital('largest-contentful-paint', (entry) => {
      this.recordVital('lcp', entry.startTime, entry);
    });

    // Monitor FID (First Input Delay)
    this.observeVital('first-input', (entry) => {
      const fid = entry.processingStart - entry.startTime;
      this.recordVital('fid', fid, entry);
    });

    // Monitor CLS (Cumulative Layout Shift)
    let clsValue = 0;
    this.observeVital('layout-shift', (entry) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
        this.recordVital('cls', clsValue, entry);
      }
    });

    // Monitor FCP (First Contentful Paint)
    this.observeVital('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') {
        this.recordVital('fcp', entry.startTime, entry);
      }
    });

    // Monitor TTFB (Time to First Byte)
    this.observeVital('navigation', (entry) => {
      const ttfb = entry.responseStart - entry.requestStart;
      this.recordVital('ttfb', ttfb, entry);
    });

    // Monitor INP (Interaction to Next Paint) if supported
    if ('PerformanceEventTiming' in window) {
      this.observeVital('event', (entry) => {
        if (entry.interactionId) {
          const inp = entry.processingEnd - entry.startTime;
          this.recordVital('inp', inp, entry);
        }
      });
    }

    // Set up periodic optimization checks
    this.startOptimizationChecks();
  }

  /**
   * Stop monitoring Core Web Vitals
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Disconnect all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  /**
   * Get current Core Web Vitals values
   */
  getCurrentVitals(): CoreWebVitals {
    const getLatestValue = (metric: string): number => {
      const history = this.vitalsHistory.get(metric) || [];
      return history.length > 0 ? history[history.length - 1].value : 0;
    };

    return {
      lcp: getLatestValue('lcp'),
      fid: getLatestValue('fid'),
      cls: getLatestValue('cls'),
      fcp: getLatestValue('fcp'),
      ttfb: getLatestValue('ttfb'),
      inp: getLatestValue('inp')
    };
  }

  /**
   * Get Web Vitals history for a specific metric
   */
  getVitalHistory(metric: string): WebVitalEntry[] {
    return this.vitalsHistory.get(metric) || [];
  }

  /**
   * Get all Web Vitals history
   */
  getAllVitalsHistory(): Map<string, WebVitalEntry[]> {
    return new Map(this.vitalsHistory);
  }

  /**
   * Get Web Vitals trends
   */
  getVitalsTrends(): Map<string, WebVitalTrend> {
    const trends = new Map<string, WebVitalTrend>();

    this.vitalsHistory.forEach((entries, metric) => {
      if (entries.length < 2) {
        return;
      }

      const values = entries.map(entry => ({
        timestamp: entry.timestamp,
        value: entry.value,
        rating: entry.rating
      }));

      // Calculate trend direction
      const recentValues = entries.slice(-10).map(e => e.value);
      const oldValues = entries.slice(-20, -10).map(e => e.value);

      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      let changeRate = 0;

      if (recentValues.length > 0 && oldValues.length > 0) {
        const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
        const oldAvg = oldValues.reduce((a, b) => a + b, 0) / oldValues.length;
        
        changeRate = (recentAvg - oldAvg) / oldAvg;

        // For CLS, lower is better; for others, lower is also generally better
        if (Math.abs(changeRate) > 0.05) {
          trend = changeRate < 0 ? 'improving' : 'degrading';
        }
      }

      trends.set(metric, {
        metric,
        values,
        trend,
        changeRate
      });
    });

    return trends;
  }

  /**
   * Get optimization suggestions based on current vitals
   */
  getOptimizationSuggestions(): WebVitalOptimizationSuggestion[] {
    const currentVitals = this.getCurrentVitals();
    const suggestions: WebVitalOptimizationSuggestion[] = [];

    // LCP optimization suggestions
    if (currentVitals.lcp > this.thresholds.lcp.good) {
      suggestions.push({
        metric: 'lcp',
        currentValue: currentVitals.lcp,
        targetValue: this.thresholds.lcp.good,
        priority: currentVitals.lcp > this.thresholds.lcp.poor ? 'high' : 'medium',
        suggestions: [
          'Optimize server response times',
          'Implement resource preloading for critical assets',
          'Optimize and compress images',
          'Remove render-blocking JavaScript and CSS',
          'Use a Content Delivery Network (CDN)',
          'Implement lazy loading for non-critical resources'
        ],
        estimatedImpact: Math.min((currentVitals.lcp - this.thresholds.lcp.good) / this.thresholds.lcp.good, 1)
      });
    }

    // FID optimization suggestions
    if (currentVitals.fid > this.thresholds.fid.good) {
      suggestions.push({
        metric: 'fid',
        currentValue: currentVitals.fid,
        targetValue: this.thresholds.fid.good,
        priority: currentVitals.fid > this.thresholds.fid.poor ? 'high' : 'medium',
        suggestions: [
          'Break up long-running JavaScript tasks',
          'Optimize third-party code',
          'Use web workers for heavy computations',
          'Reduce JavaScript execution time',
          'Implement code splitting',
          'Defer non-essential JavaScript'
        ],
        estimatedImpact: Math.min((currentVitals.fid - this.thresholds.fid.good) / this.thresholds.fid.good, 1)
      });
    }

    // CLS optimization suggestions
    if (currentVitals.cls > this.thresholds.cls.good) {
      suggestions.push({
        metric: 'cls',
        currentValue: currentVitals.cls,
        targetValue: this.thresholds.cls.good,
        priority: currentVitals.cls > this.thresholds.cls.poor ? 'high' : 'medium',
        suggestions: [
          'Set explicit dimensions for images and videos',
          'Reserve space for ads and embeds',
          'Avoid inserting content above existing content',
          'Use CSS aspect-ratio for responsive images',
          'Preload web fonts to prevent FOIT/FOUT',
          'Implement skeleton screens for dynamic content'
        ],
        estimatedImpact: Math.min((currentVitals.cls - this.thresholds.cls.good) / this.thresholds.cls.good, 1)
      });
    }

    // FCP optimization suggestions
    if (currentVitals.fcp > this.thresholds.fcp.good) {
      suggestions.push({
        metric: 'fcp',
        currentValue: currentVitals.fcp,
        targetValue: this.thresholds.fcp.good,
        priority: currentVitals.fcp > this.thresholds.fcp.poor ? 'high' : 'medium',
        suggestions: [
          'Eliminate render-blocking resources',
          'Minify CSS and JavaScript',
          'Remove unused CSS',
          'Optimize server response times',
          'Use efficient cache policies',
          'Optimize critical rendering path'
        ],
        estimatedImpact: Math.min((currentVitals.fcp - this.thresholds.fcp.good) / this.thresholds.fcp.good, 1)
      });
    }

    // TTFB optimization suggestions
    if (currentVitals.ttfb > this.thresholds.ttfb.good) {
      suggestions.push({
        metric: 'ttfb',
        currentValue: currentVitals.ttfb,
        targetValue: this.thresholds.ttfb.good,
        priority: currentVitals.ttfb > this.thresholds.ttfb.poor ? 'high' : 'medium',
        suggestions: [
          'Optimize server performance',
          'Use a Content Delivery Network (CDN)',
          'Implement server-side caching',
          'Optimize database queries',
          'Use HTTP/2 or HTTP/3',
          'Minimize redirects'
        ],
        estimatedImpact: Math.min((currentVitals.ttfb - this.thresholds.ttfb.good) / this.thresholds.ttfb.good, 1)
      });
    }

    // INP optimization suggestions
    if (currentVitals.inp && currentVitals.inp > (this.thresholds.inp?.good || 200)) {
      suggestions.push({
        metric: 'inp',
        currentValue: currentVitals.inp,
        targetValue: this.thresholds.inp?.good || 200,
        priority: currentVitals.inp > (this.thresholds.inp?.poor || 500) ? 'high' : 'medium',
        suggestions: [
          'Optimize event handlers',
          'Reduce main thread work',
          'Use requestIdleCallback for non-urgent tasks',
          'Implement virtual scrolling for long lists',
          'Debounce expensive operations',
          'Use CSS containment for layout optimization'
        ],
        estimatedImpact: Math.min((currentVitals.inp - (this.thresholds.inp?.good || 200)) / (this.thresholds.inp?.good || 200), 1)
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get performance timeline entries for Web Vitals
   */
  getTimelineEntries(): PerformanceTimelineEntry[] {
    const entries: PerformanceTimelineEntry[] = [];

    this.vitalsHistory.forEach((vitals, metric) => {
      vitals.forEach(vital => {
        entries.push({
          timestamp: vital.timestamp,
          type: 'web-vital',
          data: {
            metric,
            value: vital.value,
            rating: vital.rating,
            delta: vital.delta,
            id: vital.id
          }
        });
      });
    });

    return entries.sort((a, b) => b.timestamp - a.timestamp);
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
   * Clear all vitals history
   */
  clearHistory(): void {
    this.vitalsHistory.clear();
    this.initializeVitalsHistory();
  }

  /**
   * Export Web Vitals data
   */
  exportData(): {
    currentVitals: CoreWebVitals;
    history: Map<string, WebVitalEntry[]>;
    trends: Map<string, WebVitalTrend>;
    suggestions: WebVitalOptimizationSuggestion[];
  } {
    return {
      currentVitals: this.getCurrentVitals(),
      history: this.getAllVitalsHistory(),
      trends: this.getVitalsTrends(),
      suggestions: this.getOptimizationSuggestions()
    };
  }

  // Private methods

  private initializeVitalsHistory(): void {
    const metrics = ['lcp', 'fid', 'cls', 'fcp', 'ttfb', 'inp'];
    metrics.forEach(metric => {
      this.vitalsHistory.set(metric, []);
    });
  }

  private observeVital(type: string, callback: (entry: any) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(callback);
      });
      
      observer.observe({ type, buffered: true });
      this.observers.set(type, observer);
    } catch (error) {
      console.warn(`Failed to observe ${type}:`, error);
    }
  }

  private recordVital(metric: string, value: number, entry: any): void {
    const rating = this.getRating(metric, value);
    const timestamp = Date.now();
    
    const vitalEntry: WebVitalEntry = {
      name: metric,
      value,
      delta: value, // For simplicity, using value as delta
      id: entry.id || `${metric}_${timestamp}`,
      timestamp,
      rating
    };

    const history = this.vitalsHistory.get(metric) || [];
    history.push(vitalEntry);

    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }

    this.vitalsHistory.set(metric, history);

    // Check for alerts
    this.checkForAlerts(metric, value, rating);
  }

  private getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = this.thresholds[metric as keyof WebVitalThresholds];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private checkForAlerts(metric: string, value: number, rating: 'good' | 'needs-improvement' | 'poor'): void {
    if (rating === 'poor') {
      const threshold = this.thresholds[metric as keyof WebVitalThresholds];
      if (threshold) {
        const alert: PerformanceAlert = {
          id: `webvital_${metric}_${Date.now()}`,
          type: 'budget-exceeded',
          severity: 'high',
          message: `${metric.toUpperCase()} is in poor range`,
          metric,
          currentValue: value,
          threshold: threshold.poor,
          timestamp: Date.now(),
          suggestions: this.getMetricSuggestions(metric)
        };

        this.alertCallbacks.forEach(callback => callback(alert));
      }
    }
  }

  private getMetricSuggestions(metric: string): string[] {
    const suggestions = this.getOptimizationSuggestions();
    const metricSuggestion = suggestions.find(s => s.metric === metric);
    return metricSuggestion ? metricSuggestion.suggestions.slice(0, 3) : [];
  }

  private startOptimizationChecks(): void {
    // Run optimization checks every 30 seconds
    setInterval(() => {
      const suggestions = this.getOptimizationSuggestions();
      const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');

      if (highPrioritySuggestions.length > 0) {
        const alert: PerformanceAlert = {
          id: `optimization_${Date.now()}`,
          type: 'performance-degradation',
          severity: 'medium',
          message: `${highPrioritySuggestions.length} high-priority optimization opportunities found`,
          metric: 'web-vitals-optimization',
          currentValue: highPrioritySuggestions.length,
          threshold: 0,
          timestamp: Date.now(),
          suggestions: highPrioritySuggestions.flatMap(s => s.suggestions.slice(0, 2))
        };

        this.alertCallbacks.forEach(callback => callback(alert));
      }
    }, 30000);
  }
}