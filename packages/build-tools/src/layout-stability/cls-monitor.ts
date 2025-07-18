/**
 * CLS (Cumulative Layout Shift) Monitor
 * Measures and tracks layout shifts to optimize for Core Web Vitals
 */

import { CLSMetrics, LayoutShift, LayoutShiftSource, CLSTimelineEntry } from './types.js';

export class CLSMonitor {
  private observer: PerformanceObserver | null = null;
  private metrics: CLSMetrics;
  private isMonitoring = false;
  private listeners: Array<(metrics: CLSMetrics) => void> = [];
  private threshold: number;

  constructor(threshold = 0.1) {
    this.threshold = threshold;
    this.metrics = {
      score: 0,
      shifts: [],
      worstShift: null,
      timeline: [],
      measurementStartTime: performance.now()
    };
  }

  /**
   * Start monitoring layout shifts
   */
  startMonitoring(): void {
    if (this.isMonitoring || !this.isSupported()) {
      return;
    }

    this.isMonitoring = true;
    this.metrics.measurementStartTime = performance.now();

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            this.handleLayoutShift(entry as any);
          }
        }
      });

      this.observer.observe({ type: 'layout-shift', buffered: true });
    } catch (error) {
      console.warn('Failed to start CLS monitoring:', error);
      this.isMonitoring = false;
    }
  }

  /**
   * Stop monitoring layout shifts
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    this.metrics.measurementEndTime = performance.now();

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Get current CLS metrics
   */
  getMetrics(): CLSMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      score: 0,
      shifts: [],
      worstShift: null,
      timeline: [],
      measurementStartTime: performance.now()
    };
  }

  /**
   * Add listener for metrics updates
   */
  addListener(listener: (metrics: CLSMetrics) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove listener
   */
  removeListener(listener: (metrics: CLSMetrics) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Check if CLS monitoring is supported
   */
  private isSupported(): boolean {
    return typeof PerformanceObserver !== 'undefined' && 
           PerformanceObserver.supportedEntryTypes?.includes('layout-shift');
  }

  /**
   * Handle a layout shift entry
   */
  private handleLayoutShift(entry: any): void {
    const shift: LayoutShift = {
      value: entry.value,
      sources: this.extractSources(entry.sources || []),
      hadRecentInput: entry.hadRecentInput,
      lastInputTime: entry.lastInputTime,
      timestamp: entry.startTime
    };

    this.metrics.shifts.push(shift);
    this.metrics.score += shift.value;

    // Update worst shift
    if (!this.metrics.worstShift || shift.value > this.metrics.worstShift.value) {
      this.metrics.worstShift = shift;
    }

    // Add to timeline
    this.metrics.timeline.push({
      timestamp: shift.timestamp,
      cumulativeScore: this.metrics.score,
      shiftValue: shift.value,
      description: this.generateShiftDescription(shift)
    });

    // Check threshold
    if (this.metrics.score > this.threshold) {
      this.notifyThresholdExceeded();
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Extract layout shift sources
   */
  private extractSources(sources: any[]): LayoutShiftSource[] {
    return sources.map(source => ({
      node: source.node,
      previousRect: source.previousRect,
      currentRect: source.currentRect
    }));
  }

  /**
   * Generate description for a layout shift
   */
  private generateShiftDescription(shift: LayoutShift): string {
    const primarySource = shift.sources[0];
    if (!primarySource) {
      return `Layout shift: ${shift.value.toFixed(4)}`;
    }

    const element = primarySource.node;
    const tagName = element.tagName?.toLowerCase() || 'unknown';
    const className = element.className || '';
    const id = element.id || '';

    let description = `${tagName}`;
    if (id) description += `#${id}`;
    if (className) description += `.${className.split(' ')[0]}`;
    
    return `${description}: ${shift.value.toFixed(4)}`;
  }

  /**
   * Notify listeners of metrics update
   */
  private notifyListeners(): void {
    const metrics = this.getMetrics();
    this.listeners.forEach(listener => {
      try {
        listener(metrics);
      } catch (error) {
        console.warn('Error in CLS metrics listener:', error);
      }
    });
  }

  /**
   * Notify when CLS threshold is exceeded
   */
  private notifyThresholdExceeded(): void {
    console.warn(`CLS threshold exceeded: ${this.metrics.score.toFixed(4)} > ${this.threshold}`);
    
    // Emit custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cls-threshold-exceeded', {
        detail: { metrics: this.getMetrics(), threshold: this.threshold }
      }));
    }
  }

  /**
   * Get CLS score for a specific time range
   */
  getScoreForTimeRange(startTime: number, endTime: number): number {
    return this.metrics.shifts
      .filter(shift => shift.timestamp >= startTime && shift.timestamp <= endTime)
      .reduce((total, shift) => total + shift.value, 0);
  }

  /**
   * Get layout shifts that affected a specific element
   */
  getShiftsForElement(element: Element): LayoutShift[] {
    return this.metrics.shifts.filter(shift =>
      shift.sources.some(source => source.node === element)
    );
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    return JSON.stringify({
      ...this.metrics,
      duration: this.metrics.measurementEndTime 
        ? this.metrics.measurementEndTime - this.metrics.measurementStartTime
        : performance.now() - this.metrics.measurementStartTime
    }, null, 2);
  }
}