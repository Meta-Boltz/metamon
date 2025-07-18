/**
 * Intermittent Connectivity Handler
 * Manages framework loading during unstable network conditions with intelligent caching
 */

import { FrameworkType, FrameworkCore, LoadPriority } from '../types/framework-loader.js';
import { NetworkConditionMonitor, ConnectionEvent } from './network-condition-monitor.js';

export interface CachedResource {
  framework: FrameworkType;
  core: FrameworkCore;
  lastUsed: number;
  accessCount: number;
  priority: LoadPriority;
  expiresAt: number;
}

export interface ConnectivityState {
  isOnline: boolean;
  isStable: boolean;
  lastOnlineTime: number;
  offlineDuration: number;
  reconnectionAttempts: number;
  qualityScore: number;
}

export interface OfflineStrategy {
  cacheFirst: boolean;
  maxCacheAge: number;
  maxCacheSize: number;
  priorityEviction: boolean;
  backgroundSync: boolean;
  retryStrategy: 'exponential' | 'linear' | 'immediate';
}

export interface LoadRequest {
  framework: FrameworkType;
  priority: LoadPriority;
  timeout: number;
  fallbackToCache: boolean;
  resolve: (core: FrameworkCore) => void;
  reject: (error: Error) => void;
}

export class IntermittentConnectivityHandler {
  private monitor: NetworkConditionMonitor;
  private cache: Map<FrameworkType, CachedResource> = new Map();
  private pendingRequests: Map<string, LoadRequest> = new Map();
  private connectivityState: ConnectivityState;
  private strategy: OfflineStrategy;
  private reconnectionTimer: NodeJS.Timeout | null = null;
  private backgroundSyncQueue: FrameworkType[] = [];
  private listeners: Array<(state: ConnectivityState) => void> = [];

  constructor(monitor: NetworkConditionMonitor, initialStrategy?: Partial<OfflineStrategy>) {
    this.monitor = monitor;
    this.strategy = {
      cacheFirst: false,
      maxCacheAge: 86400000, // 24 hours
      maxCacheSize: 50 * 1024 * 1024, // 50 MB
      priorityEviction: true,
      backgroundSync: true,
      retryStrategy: 'exponential',
      ...initialStrategy
    };

    this.connectivityState = {
      isOnline: true,
      isStable: true,
      lastOnlineTime: Date.now(),
      offlineDuration: 0,
      reconnectionAttempts: 0,
      qualityScore: 1
    };

    // Listen to network changes
    this.monitor.addListener(this.handleNetworkChange);
    
    // Initialize connectivity state
    this.updateConnectivityState();
    
    // Start background sync if enabled
    if (this.strategy.backgroundSync) {
      this.startBackgroundSync();
    }
  }

  /**
   * Load framework with intermittent connectivity handling
   */
  async loadFramework(
    framework: FrameworkType, 
    priority: LoadPriority = LoadPriority.NORMAL,
    timeout: number = 10000
  ): Promise<FrameworkCore> {
    const requestId = `${framework}-${Date.now()}`;
    
    return new Promise<FrameworkCore>((resolve, reject) => {
      const request: LoadRequest = {
        framework,
        priority,
        timeout,
        fallbackToCache: true,
        resolve,
        reject
      };

      this.pendingRequests.set(requestId, request);
      
      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Load timeout for ${framework}`));
        }
      }, timeout);

      // Process request
      this.processLoadRequest(requestId, request);
    });
  }

  /**
   * Cache framework core
   */
  cacheFramework(core: FrameworkCore, priority: LoadPriority = LoadPriority.NORMAL): void {
    const cached: CachedResource = {
      framework: core.name,
      core,
      lastUsed: Date.now(),
      accessCount: 1,
      priority,
      expiresAt: Date.now() + this.strategy.maxCacheAge
    };

    this.cache.set(core.name, cached);
    this.enforceCacheLimits();
  }

  /**
   * Get cached framework if available
   */
  getCachedFramework(framework: FrameworkType): FrameworkCore | null {
    const cached = this.cache.get(framework);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(framework);
      return null;
    }

    // Update access stats
    cached.lastUsed = Date.now();
    cached.accessCount++;
    
    return cached.core;
  }

  /**
   * Get connectivity state
   */
  getConnectivityState(): ConnectivityState {
    return { ...this.connectivityState };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    count: number;
    hitRate: number;
    frameworks: Array<{ framework: FrameworkType; size: number; lastUsed: number; accessCount: number }>;
  } {
    let totalSize = 0;
    const frameworks: Array<{ framework: FrameworkType; size: number; lastUsed: number; accessCount: number }> = [];
    
    for (const cached of this.cache.values()) {
      totalSize += cached.core.size;
      frameworks.push({
        framework: cached.framework,
        size: cached.core.size,
        lastUsed: cached.lastUsed,
        accessCount: cached.accessCount
      });
    }

    // Calculate hit rate (simplified)
    const totalAccess = frameworks.reduce((sum, f) => sum + f.accessCount, 0);
    const hitRate = totalAccess > 0 ? frameworks.length / totalAccess : 0;

    return {
      size: totalSize,
      count: this.cache.size,
      hitRate,
      frameworks
    };
  }

  /**
   * Update offline strategy
   */
  updateStrategy(strategy: Partial<OfflineStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
    this.enforceCacheLimits();
    
    if (this.strategy.backgroundSync && !this.backgroundSyncQueue.length) {
      this.startBackgroundSync();
    }
  }

  /**
   * Add connectivity state listener
   */
  addListener(listener: (state: ConnectivityState) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove connectivity state listener
   */
  removeListener(listener: (state: ConnectivityState) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Destroy handler and cleanup resources
   */
  destroy(): void {
    this.monitor.removeListener(this.handleNetworkChange);
    
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
    
    // Reject all pending requests
    for (const request of this.pendingRequests.values()) {
      request.reject(new Error('Handler destroyed'));
    }
    
    this.pendingRequests.clear();
    this.cache.clear();
    this.listeners = [];
  }

  /**
   * Handle network condition changes
   */
  private handleNetworkChange = (event: ConnectionEvent): void => {
    this.updateConnectivityState();
    
    if (event.type === 'online') {
      this.handleReconnection();
    } else if (event.type === 'offline') {
      this.handleDisconnection();
    } else if (event.type === 'unstable') {
      this.handleUnstableConnection();
    }
    
    // Notify listeners
    this.notifyListeners();
  };

  /**
   * Update connectivity state based on current conditions
   */
  private updateConnectivityState(): void {
    const conditions = this.monitor.getCurrentConditions();
    const metrics = this.monitor.getQualityMetrics();
    const isReliable = this.monitor.isNetworkReliable();
    const isIntermittent = this.monitor.isIntermittentConnection();
    
    const wasOnline = this.connectivityState.isOnline;
    const isOnline = conditions !== null && !isIntermittent;
    
    if (isOnline && !wasOnline) {
      // Coming back online
      this.connectivityState.lastOnlineTime = Date.now();
      this.connectivityState.offlineDuration = 0;
      this.connectivityState.reconnectionAttempts = 0;
    } else if (!isOnline && wasOnline) {
      // Going offline
      this.connectivityState.offlineDuration = Date.now() - this.connectivityState.lastOnlineTime;
    } else if (!isOnline) {
      // Still offline
      this.connectivityState.offlineDuration = Date.now() - this.connectivityState.lastOnlineTime;
    }
    
    this.connectivityState.isOnline = isOnline;
    this.connectivityState.isStable = isReliable;
    this.connectivityState.qualityScore = metrics?.score || 0;
  }

  /**
   * Process load request with connectivity awareness
   */
  private async processLoadRequest(requestId: string, request: LoadRequest): Promise<void> {
    // Check cache first if offline or cache-first strategy
    if (!this.connectivityState.isOnline || this.strategy.cacheFirst) {
      const cached = this.getCachedFramework(request.framework);
      if (cached) {
        request.resolve(cached);
        this.pendingRequests.delete(requestId);
        return;
      }
    }

    // If offline and no cache, fail immediately
    if (!this.connectivityState.isOnline) {
      request.reject(new Error(`Framework ${request.framework} not available offline`));
      this.pendingRequests.delete(requestId);
      return;
    }

    // If connection is unstable, prefer cache
    if (!this.connectivityState.isStable && request.fallbackToCache) {
      const cached = this.getCachedFramework(request.framework);
      if (cached) {
        request.resolve(cached);
        this.pendingRequests.delete(requestId);
        return;
      }
    }

    // Attempt network load
    try {
      const core = await this.performNetworkLoad(request);
      
      // Cache the result
      this.cacheFramework(core, request.priority);
      
      request.resolve(core);
      this.pendingRequests.delete(requestId);
      
    } catch (error) {
      // Network load failed, try cache as fallback
      if (request.fallbackToCache) {
        const cached = this.getCachedFramework(request.framework);
        if (cached) {
          request.resolve(cached);
          this.pendingRequests.delete(requestId);
          return;
        }
      }
      
      request.reject(error as Error);
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Perform network load (placeholder - would integrate with actual loader)
   */
  private async performNetworkLoad(request: LoadRequest): Promise<FrameworkCore> {
    // Simulate network load with potential failures
    const delay = Math.random() * 2000 + 500;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simulate failure based on network quality
    const failureRate = (1 - this.connectivityState.qualityScore) * 0.3;
    if (Math.random() < failureRate) {
      throw new Error(`Network load failed for ${request.framework}`);
    }
    
    // Return mock framework core
    return {
      name: request.framework,
      version: '1.0.0',
      bundle: new ArrayBuffer(1024 * 100), // 100KB mock
      dependencies: [],
      size: 1024 * 100,
      checksum: 'mock-checksum',
      timestamp: Date.now()
    };
  }

  /**
   * Handle reconnection event
   */
  private handleReconnection(): void {
    this.connectivityState.reconnectionAttempts = 0;
    
    // Process any pending requests that were waiting for connection
    for (const [requestId, request] of this.pendingRequests.entries()) {
      this.processLoadRequest(requestId, request);
    }
    
    // Start background sync if enabled
    if (this.strategy.backgroundSync && this.backgroundSyncQueue.length > 0) {
      this.performBackgroundSync();
    }
  }

  /**
   * Handle disconnection event
   */
  private handleDisconnection(): void {
    // Cancel reconnection timer if running
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
    
    // Start reconnection attempts
    this.scheduleReconnectionAttempt();
  }

  /**
   * Handle unstable connection
   */
  private handleUnstableConnection(): void {
    // Switch to cache-first mode temporarily
    const originalCacheFirst = this.strategy.cacheFirst;
    this.strategy.cacheFirst = true;
    
    // Restore original setting after stability improves
    setTimeout(() => {
      if (this.monitor.isNetworkReliable()) {
        this.strategy.cacheFirst = originalCacheFirst;
      }
    }, 30000); // 30 seconds
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnectionAttempt(): void {
    if (this.reconnectionTimer) return;
    
    let delay: number;
    
    switch (this.strategy.retryStrategy) {
      case 'immediate':
        delay = 1000;
        break;
      case 'linear':
        delay = Math.min(this.connectivityState.reconnectionAttempts * 2000, 30000);
        break;
      case 'exponential':
      default:
        delay = Math.min(Math.pow(2, this.connectivityState.reconnectionAttempts) * 1000, 30000);
        break;
    }
    
    this.reconnectionTimer = setTimeout(() => {
      this.reconnectionTimer = null;
      this.connectivityState.reconnectionAttempts++;
      
      // Check if we're back online
      if (this.monitor.isNetworkReliable()) {
        this.handleReconnection();
      } else {
        // Schedule next attempt
        this.scheduleReconnectionAttempt();
      }
    }, delay);
  }

  /**
   * Start background sync process
   */
  private startBackgroundSync(): void {
    // Add frameworks to sync queue based on usage patterns
    for (const cached of this.cache.values()) {
      if (cached.accessCount > 1 && !this.backgroundSyncQueue.includes(cached.framework)) {
        this.backgroundSyncQueue.push(cached.framework);
      }
    }
  }

  /**
   * Perform background sync when connection is available
   */
  private async performBackgroundSync(): Promise<void> {
    if (!this.connectivityState.isOnline || this.backgroundSyncQueue.length === 0) {
      return;
    }
    
    const framework = this.backgroundSyncQueue.shift()!;
    
    try {
      // Attempt to refresh cached framework
      const request: LoadRequest = {
        framework,
        priority: LoadPriority.LOW,
        timeout: 5000,
        fallbackToCache: false,
        resolve: (core) => this.cacheFramework(core, LoadPriority.LOW),
        reject: () => {} // Ignore failures in background sync
      };
      
      await this.performNetworkLoad(request);
      
    } catch (error) {
      // Background sync failure is not critical
      console.debug(`[IntermittentConnectivityHandler] Background sync failed for ${framework}`);
    }
    
    // Continue with next item
    if (this.backgroundSyncQueue.length > 0) {
      setTimeout(() => this.performBackgroundSync(), 1000);
    }
  }

  /**
   * Enforce cache size and age limits
   */
  private enforceCacheLimits(): void {
    const now = Date.now();
    
    // Remove expired items
    for (const [framework, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(framework);
      }
    }
    
    // Check size limit
    let totalSize = 0;
    const cacheEntries = Array.from(this.cache.entries());
    
    for (const [, cached] of cacheEntries) {
      totalSize += cached.core.size;
    }
    
    if (totalSize > this.strategy.maxCacheSize) {
      // Sort by eviction priority
      cacheEntries.sort(([, a], [, b]) => {
        if (this.strategy.priorityEviction) {
          // Evict lower priority first
          const priorityOrder = {
            [LoadPriority.LOW]: 0,
            [LoadPriority.NORMAL]: 1,
            [LoadPriority.HIGH]: 2,
            [LoadPriority.CRITICAL]: 3
          };
          
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
        }
        
        // Then by least recently used
        return a.lastUsed - b.lastUsed;
      });
      
      // Remove items until under size limit
      while (totalSize > this.strategy.maxCacheSize && cacheEntries.length > 0) {
        const [framework, cached] = cacheEntries.shift()!;
        this.cache.delete(framework);
        totalSize -= cached.core.size;
      }
    }
  }

  /**
   * Notify listeners of connectivity state changes
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.connectivityState);
      } catch (error) {
        console.warn('[IntermittentConnectivityHandler] Listener error:', error);
      }
    }
  }
}