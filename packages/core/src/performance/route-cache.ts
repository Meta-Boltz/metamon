/**
 * Intelligent Route Caching System
 * Implements efficient caching strategies for route components and data
 */

import { runtimePerformanceTracker } from './runtime-performance-tracker.js';

/**
 * Cache entry interface
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  ttl?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  averageAccessTime: number;
  memoryUsage: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  defaultTTL: number;
  cleanupInterval: number;
  enableCompression: boolean;
  enableMetrics: boolean;
  evictionStrategy: 'lru' | 'lfu' | 'ttl' | 'priority';
}

/**
 * Intelligent Route Cache
 */
export class RouteCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalAccessTime: 0,
    accessCount: 0
  };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private config: CacheConfig = {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      enableCompression: true,
      enableMetrics: true,
      evictionStrategy: 'lru'
    }
  ) {
    if (this.config.cleanupInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const startTime = performance.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.recordAccessTime(startTime);
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      this.recordAccessTime(startTime);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);

    this.stats.hits++;
    this.recordAccessTime(startTime);

    // Track cache hit in performance monitor
    if (this.config.enableMetrics) {
      runtimePerformanceTracker.trackCustomMetric('cache-hit', performance.now() - startTime);
    }

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const startTime = performance.now();
    const size = this.calculateSize(value);
    const ttl = options.ttl || this.config.defaultTTL;

    // Check if we need to evict entries
    this.ensureCapacity(size);

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      ttl,
      priority: options.priority || 'medium',
      metadata: options.metadata
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);

    // Track cache set operation
    if (this.config.enableMetrics) {
      runtimePerformanceTracker.trackCustomMetric('cache-set', performance.now() - startTime);
    }
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.removeFromAccessOrder(key);
    return true;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalEntries = this.cache.size;
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.stats.misses / totalRequests : 0;
    const averageAccessTime = this.stats.accessCount > 0 
      ? this.stats.totalAccessTime / this.stats.accessCount 
      : 0;

    return {
      totalEntries,
      totalSize,
      hitRate,
      missRate,
      evictionCount: this.stats.evictions,
      averageAccessTime,
      memoryUsage: totalSize
    };
  }

  /**
   * Get cache entries sorted by priority and access patterns
   */
  getEntries(): CacheEntry<T>[] {
    return Array.from(this.cache.values()).sort((a, b) => {
      // Sort by priority first, then by access patterns
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by access count and recency
      const accessScore = (entry: CacheEntry<T>) => {
        const recencyScore = (Date.now() - entry.lastAccessed) / 1000; // seconds ago
        const frequencyScore = entry.accessCount;
        return frequencyScore / Math.log(recencyScore + 1);
      };
      
      return accessScore(b) - accessScore(a);
    });
  }

  /**
   * Preload cache entries based on prediction
   */
  async preload(predictions: Array<{ key: string; probability: number; data: () => Promise<T> }>): Promise<void> {
    const sortedPredictions = predictions
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10); // Limit to top 10 predictions

    for (const prediction of sortedPredictions) {
      if (!this.has(prediction.key) && prediction.probability > 0.3) {
        try {
          const startTime = performance.now();
          const data = await prediction.data();
          const loadTime = performance.now() - startTime;
          
          this.set(prediction.key, data, {
            priority: prediction.probability > 0.7 ? 'high' : 'medium',
            metadata: { preloaded: true, probability: prediction.probability, loadTime }
          });

          runtimePerformanceTracker.trackCustomMetric('cache-preload', loadTime);
        } catch (error) {
          console.warn(`Failed to preload cache entry ${prediction.key}:`, error);
        }
      }
    }
  }

  /**
   * Optimize cache by removing low-value entries
   */
  optimize(): void {
    const entries = this.getEntries();
    const now = Date.now();
    let removedCount = 0;
    let freedSize = 0;

    for (const entry of entries.reverse()) { // Start with lowest priority
      const age = now - entry.timestamp;
      const timeSinceAccess = now - entry.lastAccessed;
      
      // Remove entries that are old and rarely accessed
      const shouldRemove = (
        (entry.priority === 'low' && timeSinceAccess > 10 * 60 * 1000) || // 10 minutes
        (entry.accessCount === 1 && age > 5 * 60 * 1000) || // 5 minutes, accessed once
        (timeSinceAccess > 30 * 60 * 1000) // 30 minutes since last access
      );

      if (shouldRemove) {
        freedSize += entry.size;
        this.delete(entry.key);
        removedCount++;
      }

      // Stop if we've freed enough space or removed enough entries
      if (removedCount >= 100 || freedSize >= this.config.maxSize * 0.2) {
        break;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cache optimized: removed ${removedCount} entries, freed ${(freedSize / 1024).toFixed(1)}KB`);
    }
  }

  /**
   * Calculate size of value for caching
   */
  private calculateSize(value: T): number {
    if (typeof value === 'string') {
      return value.length * 2; // Approximate UTF-16 size
    }
    
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1000; // Default size for non-serializable objects
      }
    }
    
    return 100; // Default size for primitives
  }

  /**
   * Ensure cache has capacity for new entry
   */
  private ensureCapacity(newEntrySize: number): void {
    const stats = this.getStats();
    
    // Check if we need to evict entries
    while (
      (stats.totalSize + newEntrySize > this.config.maxSize) ||
      (stats.totalEntries >= this.config.maxEntries)
    ) {
      const evicted = this.evictEntry();
      if (!evicted) break; // No more entries to evict
      
      // Update stats
      const newStats = this.getStats();
      stats.totalSize = newStats.totalSize;
      stats.totalEntries = newStats.totalEntries;
    }
  }

  /**
   * Evict an entry based on the configured strategy
   */
  private evictEntry(): boolean {
    if (this.cache.size === 0) return false;

    let keyToEvict: string | null = null;

    switch (this.config.evictionStrategy) {
      case 'lru':
        keyToEvict = this.evictLRU();
        break;
      case 'lfu':
        keyToEvict = this.evictLFU();
        break;
      case 'ttl':
        keyToEvict = this.evictByTTL();
        break;
      case 'priority':
        keyToEvict = this.evictByPriority();
        break;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
      return true;
    }

    return false;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): string | null {
    return this.accessOrder.length > 0 ? this.accessOrder[0] : null;
  }

  /**
   * Evict least frequently used entry
   */
  private evictLFU(): string | null {
    let minAccessCount = Infinity;
    let keyToEvict: string | null = null;

    for (const [key, entry] of this.cache) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  /**
   * Evict entry with shortest TTL
   */
  private evictByTTL(): string | null {
    let shortestTTL = Infinity;
    let keyToEvict: string | null = null;
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.ttl) {
        const remainingTTL = entry.ttl - (now - entry.timestamp);
        if (remainingTTL < shortestTTL) {
          shortestTTL = remainingTTL;
          keyToEvict = key;
        }
      }
    }

    return keyToEvict;
  }

  /**
   * Evict entry with lowest priority
   */
  private evictByPriority(): string | null {
    const priorityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    let lowestPriority = Infinity;
    let keyToEvict: string | null = null;

    for (const [key, entry] of this.cache) {
      const priority = priorityOrder[entry.priority];
      if (priority < lowestPriority) {
        lowestPriority = priority;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Record access time for statistics
   */
  private recordAccessTime(startTime: number): void {
    const accessTime = performance.now() - startTime;
    this.stats.totalAccessTime += accessTime;
    this.stats.accessCount++;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalAccessTime: 0,
      accessCount: 0
    };
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`🧹 Cache cleanup: removed ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Dispose cache and cleanup resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.clear();
  }
}

/**
 * Route-specific cache implementation
 */
export class RouteComponentCache extends RouteCache<any> {
  constructor() {
    super({
      maxSize: 20 * 1024 * 1024, // 20MB for components
      maxEntries: 500,
      defaultTTL: 10 * 60 * 1000, // 10 minutes
      cleanupInterval: 2 * 60 * 1000, // 2 minutes
      enableCompression: true,
      enableMetrics: true,
      evictionStrategy: 'priority'
    });
  }

  /**
   * Cache route component with metadata
   */
  cacheComponent(
    route: string, 
    component: any, 
    metadata: { 
      loadTime: number; 
      bundleSize: number; 
      dependencies: string[];
      framework: string;
    }
  ): void {
    const priority = this.calculateComponentPriority(metadata);
    
    this.set(route, component, {
      priority,
      ttl: priority === 'critical' ? 30 * 60 * 1000 : undefined, // 30 minutes for critical
      metadata: {
        ...metadata,
        cached: Date.now(),
        type: 'component'
      }
    });

    console.log(`📦 Cached component for route ${route} (priority: ${priority})`);
  }

  /**
   * Calculate component cache priority based on metadata
   */
  private calculateComponentPriority(metadata: any): 'low' | 'medium' | 'high' | 'critical' {
    const { loadTime, bundleSize } = metadata;
    
    // Critical: slow loading or large bundles (need caching most)
    if (loadTime > 2000 || bundleSize > 500000) return 'critical';
    
    // High: moderately slow or large
    if (loadTime > 1000 || bundleSize > 250000) return 'high';
    
    // Medium: average performance
    if (loadTime > 500 || bundleSize > 100000) return 'medium';
    
    // Low: fast loading and small
    return 'low';
  }
}

/**
 * Data cache for route data and API responses
 */
export class RouteDataCache extends RouteCache<any> {
  constructor() {
    super({
      maxSize: 10 * 1024 * 1024, // 10MB for data
      maxEntries: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      enableCompression: true,
      enableMetrics: true,
      evictionStrategy: 'lru'
    });
  }

  /**
   * Cache route data with automatic invalidation
   */
  cacheRouteData(
    route: string, 
    data: any, 
    options: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
    } = {}
  ): void {
    this.set(route, data, {
      ttl: options.ttl,
      priority: 'medium',
      metadata: {
        tags: options.tags || [],
        dependencies: options.dependencies || [],
        cached: Date.now(),
        type: 'data'
      }
    });
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.metadata?.tags) {
        const hasMatchingTag = tags.some(tag => entry.metadata.tags.includes(tag));
        if (hasMatchingTag) {
          keysToDelete.push(key);
        }
      }
    }

    keysToDelete.forEach(key => this.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🗑️  Invalidated ${keysToDelete.length} cache entries by tags: ${tags.join(', ')}`);
    }
  }
}

/**
 * Singleton cache instances
 */
export const routeComponentCache = new RouteComponentCache();
export const routeDataCache = new RouteDataCache();