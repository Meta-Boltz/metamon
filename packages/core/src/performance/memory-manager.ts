/**
 * Memory Management System
 * Optimizes memory usage and prevents memory leaks in MTM applications
 */

import { runtimePerformanceTracker } from './runtime-performance-tracker.js';

/**
 * Memory usage information
 */
export interface MemoryInfo {
  used: number;
  total: number;
  limit: number;
  percentage: number;
  timestamp: number;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeak {
  type: 'listener' | 'timer' | 'reference' | 'cache' | 'dom';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  size: number;
  location?: string;
  recommendation: string;
}

/**
 * Garbage collection statistics
 */
export interface GCStats {
  collections: number;
  totalTime: number;
  averageTime: number;
  memoryFreed: number;
  lastCollection: number;
}

/**
 * Memory management configuration
 */
export interface MemoryConfig {
  enabled: boolean;
  maxMemoryUsage: number;
  gcThreshold: number;
  leakDetectionInterval: number;
  enableAutoCleanup: boolean;
  enableMemoryProfiling: boolean;
  warningThreshold: number;
  criticalThreshold: number;
}

/**
 * Memory Manager
 */
export class MemoryManager {
  private memoryHistory: MemoryInfo[] = [];
  private detectedLeaks: MemoryLeak[] = [];
  private gcStats: GCStats = {
    collections: 0,
    totalTime: 0,
    averageTime: 0,
    memoryFreed: 0,
    lastCollection: 0
  };
  
  private monitoringTimer?: NodeJS.Timeout;
  private leakDetectionTimer?: NodeJS.Timeout;
  private weakRefs = new Set<WeakRef<any>>();
  private trackedObjects = new Map<string, { ref: WeakRef<any>; size: number; timestamp: number }>();
  private eventListeners = new Map<string, { element: Element; event: string; handler: Function }>();
  private timers = new Set<number>();

  constructor(
    private config: MemoryConfig = {
      enabled: true,
      maxMemoryUsage: 500 * 1024 * 1024, // 500MB
      gcThreshold: 0.8, // 80% of max memory
      leakDetectionInterval: 30000, // 30 seconds
      enableAutoCleanup: true,
      enableMemoryProfiling: true,
      warningThreshold: 0.7, // 70% of max memory
      criticalThreshold: 0.9 // 90% of max memory
    }
  ) {
    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    // Memory usage monitoring
    this.monitoringTimer = setInterval(() => {
      this.updateMemoryInfo();
    }, 5000); // Every 5 seconds

    // Memory leak detection
    this.leakDetectionTimer = setInterval(() => {
      this.detectMemoryLeaks();
    }, this.config.leakDetectionInterval);

    console.log('🧠 Memory monitoring started');
  }

  /**
   * Update memory information
   */
  private updateMemoryInfo(): void {
    const memoryInfo = this.getCurrentMemoryInfo();
    this.memoryHistory.push(memoryInfo);

    // Limit history size
    if (this.memoryHistory.length > 1000) {
      this.memoryHistory = this.memoryHistory.slice(-1000);
    }

    // Check thresholds
    this.checkMemoryThresholds(memoryInfo);

    // Track in performance monitor
    runtimePerformanceTracker.trackCustomMetric('memory-usage', memoryInfo.used);
  }

  /**
   * Get current memory information
   */
  private getCurrentMemoryInfo(): MemoryInfo {
    let used = 0;
    let total = 0;

    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      used = memory.usedJSHeapSize || 0;
      total = memory.totalJSHeapSize || 0;
    } else if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      used = memory.heapUsed;
      total = memory.heapTotal;
    }

    const percentage = total > 0 ? (used / total) * 100 : 0;

    return {
      used,
      total,
      limit: this.config.maxMemoryUsage,
      percentage,
      timestamp: Date.now()
    };
  }

  /**
   * Check memory thresholds and trigger warnings
   */
  private checkMemoryThresholds(memoryInfo: MemoryInfo): void {
    const usageRatio = memoryInfo.used / this.config.maxMemoryUsage;

    if (usageRatio >= this.config.criticalThreshold) {
      console.error(`🚨 CRITICAL: Memory usage at ${(usageRatio * 100).toFixed(1)}% (${(memoryInfo.used / 1024 / 1024).toFixed(1)}MB)`);
      
      if (this.config.enableAutoCleanup) {
        this.performEmergencyCleanup();
      }
    } else if (usageRatio >= this.config.warningThreshold) {
      console.warn(`⚠️  WARNING: Memory usage at ${(usageRatio * 100).toFixed(1)}% (${(memoryInfo.used / 1024 / 1024).toFixed(1)}MB)`);
      
      if (this.config.enableAutoCleanup) {
        this.performCleanup();
      }
    }

    // Trigger garbage collection if needed
    if (usageRatio >= this.config.gcThreshold) {
      this.requestGarbageCollection();
    }
  }

  /**
   * Track an object for memory management
   */
  trackObject(id: string, object: any, estimatedSize: number = 1000): void {
    if (!this.config.enabled) return;

    const weakRef = new WeakRef(object);
    this.trackedObjects.set(id, {
      ref: weakRef,
      size: estimatedSize,
      timestamp: Date.now()
    });

    this.weakRefs.add(weakRef);
  }

  /**
   * Untrack an object
   */
  untrackObject(id: string): void {
    const tracked = this.trackedObjects.get(id);
    if (tracked) {
      this.weakRefs.delete(tracked.ref);
      this.trackedObjects.delete(id);
    }
  }

  /**
   * Track event listener for cleanup
   */
  trackEventListener(id: string, element: Element, event: string, handler: Function): void {
    if (!this.config.enabled) return;

    this.eventListeners.set(id, { element, event, handler });
  }

  /**
   * Untrack and remove event listener
   */
  untrackEventListener(id: string): void {
    const listener = this.eventListeners.get(id);
    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler as EventListener);
      this.eventListeners.delete(id);
    }
  }

  /**
   * Track timer for cleanup
   */
  trackTimer(timerId: number): void {
    if (!this.config.enabled) return;
    this.timers.add(timerId);
  }

  /**
   * Untrack and clear timer
   */
  untrackTimer(timerId: number): void {
    if (this.timers.has(timerId)) {
      clearTimeout(timerId);
      clearInterval(timerId);
      this.timers.delete(timerId);
    }
  }

  /**
   * Perform regular cleanup
   */
  performCleanup(): void {
    console.log('🧹 Performing memory cleanup...');
    
    let freedMemory = 0;
    let cleanedItems = 0;

    // Clean up dead weak references
    const deadRefs: WeakRef<any>[] = [];
    for (const ref of this.weakRefs) {
      if (ref.deref() === undefined) {
        deadRefs.push(ref);
      }
    }

    deadRefs.forEach(ref => {
      this.weakRefs.delete(ref);
      cleanedItems++;
    });

    // Clean up tracked objects that are no longer referenced
    const deadObjects: string[] = [];
    for (const [id, tracked] of this.trackedObjects) {
      if (tracked.ref.deref() === undefined) {
        freedMemory += tracked.size;
        deadObjects.push(id);
      }
    }

    deadObjects.forEach(id => {
      this.trackedObjects.delete(id);
      cleanedItems++;
    });

    // Clean up old memory history
    const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes
    const originalLength = this.memoryHistory.length;
    this.memoryHistory = this.memoryHistory.filter(info => info.timestamp > cutoff);
    cleanedItems += originalLength - this.memoryHistory.length;

    if (cleanedItems > 0) {
      console.log(`✅ Cleanup completed: ${cleanedItems} items cleaned, ~${(freedMemory / 1024).toFixed(1)}KB freed`);
    }
  }

  /**
   * Perform emergency cleanup when memory is critically high
   */
  performEmergencyCleanup(): void {
    console.log('🚨 Performing emergency memory cleanup...');

    // Perform regular cleanup first
    this.performCleanup();

    // Clear all tracked timers
    for (const timerId of this.timers) {
      clearTimeout(timerId);
      clearInterval(timerId);
    }
    this.timers.clear();

    // Remove all tracked event listeners
    for (const [id, listener] of this.eventListeners) {
      try {
        listener.element.removeEventListener(listener.event, listener.handler as EventListener);
      } catch (error) {
        // Ignore errors for already removed listeners
      }
    }
    this.eventListeners.clear();

    // Clear memory history except recent entries
    this.memoryHistory = this.memoryHistory.slice(-100);

    // Clear detected leaks history
    this.detectedLeaks = this.detectedLeaks.slice(-50);

    // Force garbage collection
    this.requestGarbageCollection();

    console.log('🚨 Emergency cleanup completed');
  }

  /**
   * Request garbage collection
   */
  requestGarbageCollection(): void {
    const startTime = performance.now();

    // Try to trigger garbage collection
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    } else if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }

    const gcTime = performance.now() - startTime;
    
    // Update GC stats
    this.gcStats.collections++;
    this.gcStats.totalTime += gcTime;
    this.gcStats.averageTime = this.gcStats.totalTime / this.gcStats.collections;
    this.gcStats.lastCollection = Date.now();

    console.log(`🗑️  Garbage collection requested (${gcTime.toFixed(2)}ms)`);
  }

  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeaks(): void {
    const leaks: MemoryLeak[] = [];

    // Check for memory growth trend
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10);
      const trend = this.calculateMemoryTrend(recent);
      
      if (trend > 1024 * 1024) { // Growing by more than 1MB
        leaks.push({
          type: 'reference',
          description: `Memory usage growing by ${(trend / 1024 / 1024).toFixed(1)}MB over recent measurements`,
          severity: trend > 10 * 1024 * 1024 ? 'critical' : 'high',
          size: trend,
          recommendation: 'Check for objects not being properly released or circular references'
        });
      }
    }

    // Check for excessive event listeners
    if (this.eventListeners.size > 100) {
      leaks.push({
        type: 'listener',
        description: `${this.eventListeners.size} tracked event listeners`,
        severity: this.eventListeners.size > 500 ? 'high' : 'medium',
        size: this.eventListeners.size * 100, // Estimate
        recommendation: 'Review event listener cleanup and consider using event delegation'
      });
    }

    // Check for excessive timers
    if (this.timers.size > 50) {
      leaks.push({
        type: 'timer',
        description: `${this.timers.size} active timers`,
        severity: this.timers.size > 200 ? 'high' : 'medium',
        size: this.timers.size * 50, // Estimate
        recommendation: 'Ensure timers are properly cleared when components unmount'
      });
    }

    // Check for DOM node leaks (if in browser)
    if (typeof document !== 'undefined') {
      const nodeCount = document.querySelectorAll('*').length;
      if (nodeCount > 10000) {
        leaks.push({
          type: 'dom',
          description: `${nodeCount} DOM nodes detected`,
          severity: nodeCount > 50000 ? 'high' : 'medium',
          size: nodeCount * 200, // Rough estimate
          recommendation: 'Check for DOM nodes not being properly removed'
        });
      }
    }

    // Add new leaks to detected leaks
    leaks.forEach(leak => {
      this.detectedLeaks.push(leak);
      
      if (leak.severity === 'critical' || leak.severity === 'high') {
        console.warn(`🔍 Memory leak detected: ${leak.description}`);
        console.warn(`   Recommendation: ${leak.recommendation}`);
      }
    });

    // Limit detected leaks history
    if (this.detectedLeaks.length > 100) {
      this.detectedLeaks = this.detectedLeaks.slice(-100);
    }
  }

  /**
   * Calculate memory usage trend
   */
  private calculateMemoryTrend(memoryHistory: MemoryInfo[]): number {
    if (memoryHistory.length < 2) return 0;

    const first = memoryHistory[0];
    const last = memoryHistory[memoryHistory.length - 1];
    
    return last.used - first.used;
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): {
    current: MemoryInfo;
    peak: number;
    average: number;
    trend: number;
    leaks: MemoryLeak[];
    gcStats: GCStats;
    trackedObjects: number;
    eventListeners: number;
    timers: number;
  } {
    const current = this.getCurrentMemoryInfo();
    const peak = this.memoryHistory.length > 0 
      ? Math.max(...this.memoryHistory.map(info => info.used))
      : current.used;
    
    const average = this.memoryHistory.length > 0
      ? this.memoryHistory.reduce((sum, info) => sum + info.used, 0) / this.memoryHistory.length
      : current.used;

    const trend = this.memoryHistory.length >= 10
      ? this.calculateMemoryTrend(this.memoryHistory.slice(-10))
      : 0;

    return {
      current,
      peak,
      average,
      trend,
      leaks: [...this.detectedLeaks],
      gcStats: { ...this.gcStats },
      trackedObjects: this.trackedObjects.size,
      eventListeners: this.eventListeners.size,
      timers: this.timers.size
    };
  }

  /**
   * Get memory recommendations
   */
  getRecommendations(): string[] {
    const stats = this.getMemoryStats();
    const recommendations: string[] = [];

    const usageRatio = stats.current.used / this.config.maxMemoryUsage;
    
    if (usageRatio > 0.8) {
      recommendations.push('Memory usage is high. Consider implementing more aggressive cleanup strategies.');
    }

    if (stats.trend > 5 * 1024 * 1024) {
      recommendations.push('Memory usage is trending upward. Check for memory leaks.');
    }

    if (stats.eventListeners > 100) {
      recommendations.push('Large number of event listeners. Consider using event delegation or better cleanup.');
    }

    if (stats.timers > 50) {
      recommendations.push('Many active timers detected. Ensure proper cleanup in component lifecycle.');
    }

    const criticalLeaks = stats.leaks.filter(leak => leak.severity === 'critical' || leak.severity === 'high');
    if (criticalLeaks.length > 0) {
      recommendations.push(`${criticalLeaks.length} critical memory leaks detected. Review and fix immediately.`);
    }

    if (stats.gcStats.averageTime > 100) {
      recommendations.push('Garbage collection is taking too long. Consider reducing object creation or improving cleanup.');
    }

    return recommendations;
  }

  /**
   * Create memory snapshot for debugging
   */
  createSnapshot(): {
    timestamp: number;
    memoryInfo: MemoryInfo;
    trackedObjects: Array<{ id: string; size: number; alive: boolean }>;
    eventListeners: Array<{ id: string; event: string; element: string }>;
    timers: number[];
    leaks: MemoryLeak[];
  } {
    const trackedObjects = Array.from(this.trackedObjects.entries()).map(([id, tracked]) => ({
      id,
      size: tracked.size,
      alive: tracked.ref.deref() !== undefined
    }));

    const eventListeners = Array.from(this.eventListeners.entries()).map(([id, listener]) => ({
      id,
      event: listener.event,
      element: listener.element.tagName || 'unknown'
    }));

    return {
      timestamp: Date.now(),
      memoryInfo: this.getCurrentMemoryInfo(),
      trackedObjects,
      eventListeners,
      timers: Array.from(this.timers),
      leaks: [...this.detectedLeaks]
    };
  }

  /**
   * Print memory report to console
   */
  printMemoryReport(): void {
    const stats = this.getMemoryStats();
    
    console.log('\n🧠 Memory Report');
    console.log('='.repeat(50));
    console.log(`Current Usage: ${(stats.current.used / 1024 / 1024).toFixed(1)}MB (${stats.current.percentage.toFixed(1)}%)`);
    console.log(`Peak Usage: ${(stats.peak / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Average Usage: ${(stats.average / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Trend: ${stats.trend > 0 ? '+' : ''}${(stats.trend / 1024 / 1024).toFixed(1)}MB`);
    
    console.log(`\n📊 Tracked Resources:`);
    console.log(`Objects: ${stats.trackedObjects}`);
    console.log(`Event Listeners: ${stats.eventListeners}`);
    console.log(`Timers: ${stats.timers}`);
    
    console.log(`\n🗑️  Garbage Collection:`);
    console.log(`Collections: ${stats.gcStats.collections}`);
    console.log(`Average Time: ${stats.gcStats.averageTime.toFixed(2)}ms`);
    
    if (stats.leaks.length > 0) {
      console.log(`\n🔍 Memory Leaks Detected: ${stats.leaks.length}`);
      stats.leaks.slice(0, 5).forEach(leak => {
        console.log(`  • ${leak.type}: ${leak.description} (${leak.severity})`);
      });
    }

    const recommendations = this.getRecommendations();
    if (recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    console.log('');
  }

  /**
   * Dispose memory manager and cleanup resources
   */
  dispose(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    if (this.leakDetectionTimer) {
      clearInterval(this.leakDetectionTimer);
      this.leakDetectionTimer = undefined;
    }

    // Perform final cleanup
    this.performCleanup();

    // Clear all data structures
    this.memoryHistory = [];
    this.detectedLeaks = [];
    this.weakRefs.clear();
    this.trackedObjects.clear();
    this.eventListeners.clear();
    this.timers.clear();

    console.log('🧠 Memory manager disposed');
  }
}

/**
 * Singleton memory manager instance
 */
export const memoryManager = new MemoryManager();