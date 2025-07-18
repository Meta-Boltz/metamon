/**
 * Cache Performance Monitor
 * Monitors and analyzes cache performance for framework loading
 */

import {
  CacheOperationMetrics,
  PerformanceTimelineEntry
} from '../types/performance-monitoring.js';
import { FrameworkType } from '../types/framework-loader.js';

export interface CacheOperation {
  id: string;
  operation: 'get' | 'put' | 'delete' | 'match' | 'keys';
  key: string;
  startTime: number;
  endTime?: number;
  success?: boolean;
  cacheSize?: number;
  dataSize?: number;
  error?: Error;
  framework?: FrameworkType;
}

export interface CacheStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageOperationTime: number;
  operationsByType: Map<string, number>;
  hitRate: number;
  missRate: number;
  totalCacheSize: number;
  averageDataSize: number;
  operationTrend: { timestamp: number; operationType: string; duration: number }[];
}

export interface CacheHealthMetrics {
  hitRate: number;
  averageResponseTime: number;
  errorRate: number;
  cacheUtilization: number;
  fragmentationRatio: number;
  evictionRate: number;
  stalenessRatio: number;
}

export class CachePerformanceMonitor {
  private activeOperations: Map<string, CacheOperation> = new Map();
  private completedOperations: CacheOperation[] = [];
  private maxHistorySize: number = 2000;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private totalCacheSize: number = 0;
  private cacheEntryCount: number = 0;

  /**
   * Start monitoring a cache operation
   */
  startOperation(
    operation: CacheOperation['operation'],
    key: string,
    options: {
      framework?: FrameworkType;
      expectedSize?: number;
    } = {}
  ): string {
    const operationId = this.generateOperationId();
    const startTime = performance.now();

    const cacheOperation: CacheOperation = {
      id: operationId,
      operation,
      key,
      startTime,
      framework: options.framework,
      dataSize: options.expectedSize
    };

    this.activeOperations.set(operationId, cacheOperation);

    // Create performance mark
    performance.mark(`cache-${operation}-start-${operationId}`);

    return operationId;
  }

  /**
   * Complete a cache operation successfully
   */
  completeOperation(
    operationId: string,
    result: {
      success: boolean;
      cacheSize?: number;
      dataSize?: number;
      hit?: boolean;
    }
  ): CacheOperationMetrics | null {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return null;
    }

    const endTime = performance.now();
    operation.endTime = endTime;
    operation.success = result.success;
    operation.cacheSize = result.cacheSize;
    operation.dataSize = result.dataSize || operation.dataSize;

    // Update hit/miss counters
    if (operation.operation === 'get' || operation.operation === 'match') {
      if (result.hit) {
        this.cacheHits++;
      } else {
        this.cacheMisses++;
      }
    }

    // Update cache size tracking
    if (result.cacheSize !== undefined) {
      this.totalCacheSize = result.cacheSize;
    }

    // Create performance measure
    const measureName = `cache-${operation.operation}-${operationId}`;
    const markName = `cache-${operation.operation}-start-${operationId}`;
    
    try {
      performance.measure(measureName, markName);
    } catch (error) {
      console.warn('Failed to create cache performance measure:', error);
    }

    // Move to completed operations
    this.activeOperations.delete(operationId);
    this.completedOperations.push(operation);

    // Limit history size
    if (this.completedOperations.length > this.maxHistorySize) {
      this.completedOperations = this.completedOperations.slice(-Math.floor(this.maxHistorySize * 0.8));
    }

    // Create metrics object
    const metrics: CacheOperationMetrics = {
      operation: operation.operation,
      key: operation.key,
      duration: endTime - operation.startTime,
      success: result.success,
      cacheSize: result.cacheSize,
      timestamp: endTime
    };

    return metrics;
  }

  /**
   * Fail a cache operation
   */
  failOperation(operationId: string, error: Error): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return;
    }

    operation.endTime = performance.now();
    operation.success = false;
    operation.error = error;

    // Move to completed operations
    this.activeOperations.delete(operationId);
    this.completedOperations.push(operation);
  }

  /**
   * Record cache size update
   */
  updateCacheSize(totalSize: number, entryCount: number): void {
    this.totalCacheSize = totalSize;
    this.cacheEntryCount = entryCount;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const successfulOps = this.completedOperations.filter(op => op.success && op.endTime);
    const failedOps = this.completedOperations.filter(op => !op.success);

    const operationTimes = successfulOps.map(op => op.endTime! - op.startTime);
    const averageTime = operationTimes.length > 0 
      ? operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length 
      : 0;

    // Count operations by type
    const operationsByType = new Map<string, number>();
    this.completedOperations.forEach(op => {
      const count = operationsByType.get(op.operation) || 0;
      operationsByType.set(op.operation, count + 1);
    });

    // Calculate hit/miss rates
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.cacheMisses / totalRequests : 0;

    // Calculate average data size
    const dataSizes = successfulOps
      .filter(op => op.dataSize)
      .map(op => op.dataSize!);
    const averageDataSize = dataSizes.length > 0 
      ? dataSizes.reduce((a, b) => a + b, 0) / dataSizes.length 
      : 0;

    // Create trend data (last 100 operations)
    const recentOps = successfulOps.slice(-100);
    const operationTrend = recentOps.map(op => ({
      timestamp: op.startTime,
      operationType: op.operation,
      duration: op.endTime! - op.startTime
    }));

    return {
      totalOperations: this.completedOperations.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      averageOperationTime: averageTime,
      operationsByType,
      hitRate,
      missRate,
      totalCacheSize: this.totalCacheSize,
      averageDataSize,
      operationTrend
    };
  }

  /**
   * Get cache health metrics
   */
  getCacheHealthMetrics(): CacheHealthMetrics {
    const stats = this.getCacheStats();
    const recentOps = this.completedOperations.slice(-100);
    const recentSuccessful = recentOps.filter(op => op.success && op.endTime);

    // Calculate error rate from recent operations
    const errorRate = recentOps.length > 0 
      ? (recentOps.length - recentSuccessful.length) / recentOps.length 
      : 0;

    // Estimate cache utilization (simplified)
    const maxCacheSize = 50 * 1024 * 1024; // 50MB assumed max
    const cacheUtilization = this.totalCacheSize / maxCacheSize;

    // Calculate fragmentation ratio (simplified estimation)
    const averageEntrySize = this.cacheEntryCount > 0 ? this.totalCacheSize / this.cacheEntryCount : 0;
    const fragmentationRatio = averageEntrySize > 0 ? 1 - (averageEntrySize / (averageEntrySize + 1024)) : 0;

    // Estimate eviction rate based on failed put operations
    const putOperations = recentOps.filter(op => op.operation === 'put');
    const failedPuts = putOperations.filter(op => !op.success);
    const evictionRate = putOperations.length > 0 ? failedPuts.length / putOperations.length : 0;

    // Estimate staleness ratio (operations on old entries)
    const now = Date.now();
    const staleThreshold = 60 * 60 * 1000; // 1 hour
    const staleOperations = recentOps.filter(op => now - op.startTime > staleThreshold);
    const stalenessRatio = recentOps.length > 0 ? staleOperations.length / recentOps.length : 0;

    return {
      hitRate: stats.hitRate,
      averageResponseTime: stats.averageOperationTime,
      errorRate,
      cacheUtilization: Math.min(cacheUtilization, 1),
      fragmentationRatio: Math.min(fragmentationRatio, 1),
      evictionRate,
      stalenessRatio
    };
  }

  /**
   * Get cache operations by framework
   */
  getOperationsByFramework(): Map<FrameworkType, CacheOperation[]> {
    const operationsByFramework = new Map<FrameworkType, CacheOperation[]>();

    this.completedOperations.forEach(op => {
      if (op.framework) {
        const existing = operationsByFramework.get(op.framework) || [];
        existing.push(op);
        operationsByFramework.set(op.framework, existing);
      }
    });

    return operationsByFramework;
  }

  /**
   * Get performance timeline entries for cache operations
   */
  getTimelineEntries(): PerformanceTimelineEntry[] {
    return this.completedOperations
      .filter(op => op.endTime)
      .map(op => ({
        timestamp: op.endTime!,
        type: 'cache-operation' as const,
        data: {
          operation: op.operation,
          key: op.key,
          duration: op.endTime! - op.startTime,
          success: op.success,
          cacheSize: op.cacheSize,
          dataSize: op.dataSize,
          framework: op.framework,
          error: op.error?.message
        },
        duration: op.endTime! - op.startTime
      }));
  }

  /**
   * Get slow cache operations (above threshold)
   */
  getSlowOperations(thresholdMs: number = 100): CacheOperation[] {
    return this.completedOperations.filter(op => 
      op.endTime && (op.endTime - op.startTime) > thresholdMs
    );
  }

  /**
   * Get failed cache operations
   */
  getFailedOperations(): CacheOperation[] {
    return this.completedOperations.filter(op => !op.success);
  }

  /**
   * Get cache efficiency report
   */
  getEfficiencyReport(): {
    hitRate: number;
    averageResponseTime: number;
    slowOperationsCount: number;
    failedOperationsCount: number;
    cacheUtilization: number;
    recommendations: string[];
  } {
    const stats = this.getCacheStats();
    const health = this.getCacheHealthMetrics();
    const slowOps = this.getSlowOperations();
    const failedOps = this.getFailedOperations();

    const recommendations: string[] = [];

    if (stats.hitRate < 0.8) {
      recommendations.push('Cache hit rate is low. Consider preloading frequently used frameworks.');
    }

    if (stats.averageOperationTime > 50) {
      recommendations.push('Cache operations are slow. Consider optimizing cache storage or reducing data size.');
    }

    if (health.errorRate > 0.05) {
      recommendations.push('High cache error rate detected. Check cache storage quotas and permissions.');
    }

    if (health.cacheUtilization > 0.9) {
      recommendations.push('Cache is nearly full. Consider implementing cache eviction policies.');
    }

    if (health.fragmentationRatio > 0.3) {
      recommendations.push('High cache fragmentation detected. Consider cache defragmentation.');
    }

    return {
      hitRate: stats.hitRate,
      averageResponseTime: stats.averageOperationTime,
      slowOperationsCount: slowOps.length,
      failedOperationsCount: failedOps.length,
      cacheUtilization: health.cacheUtilization,
      recommendations
    };
  }

  /**
   * Clear old operations to free memory
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    
    // Clear old completed operations
    this.completedOperations = this.completedOperations.filter(
      op => now - op.startTime < maxAge
    );

    // Clear old active operations (likely stale)
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    for (const [operationId, operation] of this.activeOperations.entries()) {
      if (now - operation.startTime > staleThreshold) {
        this.activeOperations.delete(operationId);
      }
    }

    // Clear old performance marks and measures
    try {
      performance.getEntriesByType('mark').forEach(mark => {
        if (mark.name.startsWith('cache-') && now - mark.startTime > maxAge) {
          performance.clearMarks(mark.name);
        }
      });

      performance.getEntriesByType('measure').forEach(measure => {
        if (measure.name.startsWith('cache-') && now - measure.startTime > maxAge) {
          performance.clearMeasures(measure.name);
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Export cache performance data
   */
  exportData(): {
    activeOperations: CacheOperation[];
    completedOperations: CacheOperation[];
    stats: CacheStats;
    health: CacheHealthMetrics;
    efficiency: ReturnType<typeof this.getEfficiencyReport>;
  } {
    return {
      activeOperations: Array.from(this.activeOperations.values()),
      completedOperations: this.completedOperations,
      stats: this.getCacheStats(),
      health: this.getCacheHealthMetrics(),
      efficiency: this.getEfficiencyReport()
    };
  }

  /**
   * Reset all cache performance data
   */
  reset(): void {
    this.activeOperations.clear();
    this.completedOperations = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalCacheSize = 0;
    this.cacheEntryCount = 0;

    // Clear performance marks and measures
    try {
      performance.getEntriesByType('mark').forEach(mark => {
        if (mark.name.startsWith('cache-')) {
          performance.clearMarks(mark.name);
        }
      });

      performance.getEntriesByType('measure').forEach(measure => {
        if (measure.name.startsWith('cache-')) {
          performance.clearMeasures(measure.name);
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  private generateOperationId(): string {
    return `cache_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}