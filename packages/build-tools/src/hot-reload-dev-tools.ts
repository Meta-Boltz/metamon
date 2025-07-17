/**
 * Developer tools for monitoring hot reload performance and state preservation
 */

import { HotReloadConfig } from './hot-reload-config.js';

export interface HotReloadMetrics {
  reloadCount: number;
  totalReloadTime: number;
  averageReloadTime: number;
  fastestReload: number;
  slowestReload: number;
  failedReloads: number;
  statePreservationSuccessRate: number;
  lastReloadTime: number;
  reloadHistory: ReloadEvent[];
}

export interface ReloadEvent {
  timestamp: number;
  filePath: string;
  reloadTime: number;
  success: boolean;
  statePreserved: boolean;
  errorMessage?: string;
  frameworksAffected: string[];
  componentsReloaded: string[];
}

export interface StatePreservationMetrics {
  signalsPreserved: number;
  subscriptionsPreserved: number;
  componentStatePreserved: number;
  preservationFailures: number;
  preservationTime: number;
  restorationTime: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  memoryUsage: {
    used: number;
    total: number;
    external: number;
  };
  reloadMetrics: HotReloadMetrics;
  stateMetrics: StatePreservationMetrics;
}

/**
 * Hot reload developer tools manager
 */
export class HotReloadDevTools {
  private config: HotReloadConfig;
  private metrics: HotReloadMetrics;
  private stateMetrics: StatePreservationMetrics;
  private performanceSnapshots: PerformanceSnapshot[] = [];
  private maxHistorySize = 100;
  private isEnabled = false;

  constructor(config: HotReloadConfig) {
    this.config = config;
    this.isEnabled = config.enableDevTools;
    this.metrics = this.initializeMetrics();
    this.stateMetrics = this.initializeStateMetrics();
    
    if (this.isEnabled) {
      this.setupPerformanceMonitoring();
    }
  }

  private initializeMetrics(): HotReloadMetrics {
    return {
      reloadCount: 0,
      totalReloadTime: 0,
      averageReloadTime: 0,
      fastestReload: Infinity,
      slowestReload: 0,
      failedReloads: 0,
      statePreservationSuccessRate: 100,
      lastReloadTime: 0,
      reloadHistory: []
    };
  }

  private initializeStateMetrics(): StatePreservationMetrics {
    return {
      signalsPreserved: 0,
      subscriptionsPreserved: 0,
      componentStatePreserved: 0,
      preservationFailures: 0,
      preservationTime: 0,
      restorationTime: 0
    };
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring) return;

    // Take performance snapshots every 30 seconds
    setInterval(() => {
      this.takePerformanceSnapshot();
    }, 30000);
  }

  /**
   * Record a hot reload event
   */
  recordReloadEvent(event: Omit<ReloadEvent, 'timestamp'>): void {
    if (!this.isEnabled) return;

    const reloadEvent: ReloadEvent = {
      ...event,
      timestamp: Date.now()
    };

    // Update metrics
    this.metrics.reloadCount++;
    this.metrics.totalReloadTime += event.reloadTime;
    this.metrics.averageReloadTime = this.metrics.totalReloadTime / this.metrics.reloadCount;
    this.metrics.fastestReload = Math.min(this.metrics.fastestReload, event.reloadTime);
    this.metrics.slowestReload = Math.max(this.metrics.slowestReload, event.reloadTime);
    this.metrics.lastReloadTime = event.reloadTime;

    if (!event.success) {
      this.metrics.failedReloads++;
    }

    // Update state preservation success rate
    const successfulReloads = this.metrics.reloadCount - this.metrics.failedReloads;
    this.metrics.statePreservationSuccessRate = (successfulReloads / this.metrics.reloadCount) * 100;

    // Add to history
    this.metrics.reloadHistory.push(reloadEvent);
    if (this.metrics.reloadHistory.length > this.maxHistorySize) {
      this.metrics.reloadHistory.shift();
    }

    // Log if debug logging is enabled
    if (this.config.enableDebugLogging) {
      this.logReloadEvent(reloadEvent);
    }
  }

  /**
   * Record state preservation metrics
   */
  recordStatePreservation(metrics: Partial<StatePreservationMetrics>): void {
    if (!this.isEnabled) return;

    Object.assign(this.stateMetrics, metrics);

    if (this.config.enableStatePreservationLogging) {
      this.logStatePreservation(metrics);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): { reload: HotReloadMetrics; state: StatePreservationMetrics } {
    return {
      reload: { ...this.metrics },
      state: { ...this.stateMetrics }
    };
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): PerformanceSnapshot[] {
    return [...this.performanceSnapshots];
  }

  /**
   * Take a performance snapshot
   */
  private takePerformanceSnapshot(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      
      const snapshot: PerformanceSnapshot = {
        timestamp: Date.now(),
        memoryUsage: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          external: memUsage.external
        },
        reloadMetrics: { ...this.metrics },
        stateMetrics: { ...this.stateMetrics }
      };

      this.performanceSnapshots.push(snapshot);
      if (this.performanceSnapshots.length > this.maxHistorySize) {
        this.performanceSnapshots.shift();
      }
    }
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    const report = [];
    
    report.push('=== Hot Reload Performance Report ===');
    report.push(`Total Reloads: ${this.metrics.reloadCount}`);
    report.push(`Failed Reloads: ${this.metrics.failedReloads}`);
    report.push(`Success Rate: ${(100 - (this.metrics.failedReloads / this.metrics.reloadCount * 100)).toFixed(2)}%`);
    report.push(`Average Reload Time: ${this.metrics.averageReloadTime.toFixed(2)}ms`);
    report.push(`Fastest Reload: ${this.metrics.fastestReload === Infinity ? 'N/A' : this.metrics.fastestReload.toFixed(2)}ms`);
    report.push(`Slowest Reload: ${this.metrics.slowestReload.toFixed(2)}ms`);
    report.push('');
    
    report.push('=== State Preservation Metrics ===');
    report.push(`Signals Preserved: ${this.stateMetrics.signalsPreserved}`);
    report.push(`Subscriptions Preserved: ${this.stateMetrics.subscriptionsPreserved}`);
    report.push(`Component States Preserved: ${this.stateMetrics.componentStatePreserved}`);
    report.push(`Preservation Failures: ${this.stateMetrics.preservationFailures}`);
    report.push(`Average Preservation Time: ${this.stateMetrics.preservationTime.toFixed(2)}ms`);
    report.push(`Average Restoration Time: ${this.stateMetrics.restorationTime.toFixed(2)}ms`);
    report.push('');

    if (this.performanceSnapshots.length > 0) {
      const latest = this.performanceSnapshots[this.performanceSnapshots.length - 1];
      report.push('=== Memory Usage ===');
      report.push(`Heap Used: ${(latest.memoryUsage.used / 1024 / 1024).toFixed(2)} MB`);
      report.push(`Heap Total: ${(latest.memoryUsage.total / 1024 / 1024).toFixed(2)} MB`);
      report.push(`External: ${(latest.memoryUsage.external / 1024 / 1024).toFixed(2)} MB`);
    }

    return report.join('\n');
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.stateMetrics = this.initializeStateMetrics();
    this.performanceSnapshots = [];
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      reload: this.metrics,
      state: this.stateMetrics,
      performance: this.performanceSnapshots
    }, null, 2);
  }

  /**
   * Log reload event
   */
  private logReloadEvent(event: ReloadEvent): void {
    const status = event.success ? '✅' : '❌';
    const stateStatus = event.statePreserved ? '🔄' : '⚠️';
    
    console.log(`[Hot Reload] ${status} ${event.filePath} (${event.reloadTime}ms) ${stateStatus}`);
    
    if (event.frameworksAffected.length > 0) {
      console.log(`  Frameworks: ${event.frameworksAffected.join(', ')}`);
    }
    
    if (event.componentsReloaded.length > 0) {
      console.log(`  Components: ${event.componentsReloaded.join(', ')}`);
    }
    
    if (event.errorMessage) {
      console.error(`  Error: ${event.errorMessage}`);
    }
  }

  /**
   * Log state preservation metrics
   */
  private logStatePreservation(metrics: Partial<StatePreservationMetrics>): void {
    console.log('[State Preservation]', {
      signals: metrics.signalsPreserved,
      subscriptions: metrics.subscriptionsPreserved,
      components: metrics.componentStatePreserved,
      failures: metrics.preservationFailures,
      preservationTime: metrics.preservationTime,
      restorationTime: metrics.restorationTime
    });
  }

  /**
   * Enable or disable dev tools
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled && this.config.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoring();
    }
  }
}

/**
 * Global dev tools instance
 */
let globalDevTools: HotReloadDevTools | null = null;

/**
 * Initialize global dev tools
 */
export function initializeDevTools(config: HotReloadConfig): HotReloadDevTools {
  globalDevTools = new HotReloadDevTools(config);
  return globalDevTools;
}

/**
 * Get global dev tools instance
 */
export function getDevTools(): HotReloadDevTools | null {
  return globalDevTools;
}