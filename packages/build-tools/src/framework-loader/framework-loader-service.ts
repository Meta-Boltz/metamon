/**
 * Framework Loader Service with Priority-Based Loading
 * 
 * Implements on-demand framework loading with 100ms target performance,
 * priority queue system, caching, and network condition adaptation.
 */

import { 
  FrameworkType, 
  LoadPriority, 
  FrameworkCore, 
  FrameworkRequest,
  FrameworkLoadingMetrics,
  NetworkConditions,
  LoadingStrategy,
  CacheConfig,
  FrameworkLoaderConfig,
  PriorityQueueItem,
  LoadingState
} from '../types/framework-loader.js';
import { FrameworkLoadingPriorityQueue } from './priority-queue.js';
import { NetworkConditionAdapter } from './network-adapter.js';
import { ServiceWorkerManager } from '../service-worker/service-worker-manager.js';
import { FallbackFrameworkLoader } from '../service-worker/fallback-loader.js';

/**
 * Main Framework Loader Service
 */
export class FrameworkLoaderService {
  private config: FrameworkLoaderConfig;
  private priorityQueue: FrameworkLoadingPriorityQueue;
  private networkAdapter: NetworkConditionAdapter;
  private serviceWorkerManager?: ServiceWorkerManager;
  private fallbackLoader?: FallbackFrameworkLoader;
  
  // State management
  private loadingStates: Map<string, LoadingState> = new Map();
  private frameworkCache: Map<string, FrameworkCore> = new Map();
  private activeLoads: Set<string> = new Set();
  
  // Metrics
  private metrics: FrameworkLoadingMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageLoadTime: 0,
    loadTimesByFramework: new Map(),
    failureRate: 0,
    networkRequests: 0
  };

  // Processing state
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  private isShutdown = false;

  constructor(
    config: FrameworkLoaderConfig,
    serviceWorkerManager?: ServiceWorkerManager,
    fallbackLoader?: FallbackFrameworkLoader
  ) {
    this.config = config;
    this.serviceWorkerManager = serviceWorkerManager;
    this.fallbackLoader = fallbackLoader;
    
    // Initialize priority queue
    this.priorityQueue = new FrameworkLoadingPriorityQueue(
      config.loadingStrategy.priorityWeights
    );
    
    // Initialize network adapter
    this.networkAdapter = new NetworkConditionAdapter(config.loadingStrategy);
    
    // Set up network condition monitoring
    this.networkAdapter.addListener((conditions, strategy) => {
      this.onNetworkConditionsChanged(conditions, strategy);
    });
    
    // Start processing queue
    this.startProcessing();
  }

  /**
   * Load framework with specified priority
   * Target: 100ms for cached frameworks, network-dependent for uncached
   */
  async loadFramework(
    framework: FrameworkType, 
    priority: LoadPriority = LoadPriority.NORMAL,
    version?: string,
    timeout?: number
  ): Promise<FrameworkCore> {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(framework, version);
    
    // Update metrics
    this.metrics.totalRequests++;
    
    // Check cache first (target: <10ms)
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      this.updateLoadTime(framework, performance.now() - startTime);
      this.log(`Cache hit for ${framework}@${version || 'latest'} (${Math.round(performance.now() - startTime)}ms)`);
      return cached;
    }
    
    this.metrics.cacheMisses++;
    
    // Create loading request
    const request: FrameworkRequest = {
      framework,
      priority,
      version,
      timeout: timeout || this.networkAdapter.getRecommendedTimeout(priority),
      clientId: this.generateClientId()
    };
    
    // Add to loading states
    this.loadingStates.set(cacheKey, {
      framework,
      status: 'queued',
      startTime,
      priority
    });
    
    // Create promise for the request
    return new Promise<FrameworkCore>((resolve, reject) => {
      const queueItem: PriorityQueueItem = {
        request,
        timestamp: Date.now(),
        resolve: (core: FrameworkCore) => {
          this.updateLoadTime(framework, performance.now() - startTime);
          resolve(core);
        },
        reject: (error: Error) => {
          this.updateLoadingState(cacheKey, 'failed', error);
          reject(error);
        }
      };
      
      // Set timeout
      if (request.timeout) {
        queueItem.timeoutHandle = setTimeout(() => {
          this.priorityQueue.remove(item => item === queueItem);
          this.updateLoadingState(cacheKey, 'failed', new Error('Load timeout'));
          reject(new Error(`Framework loading timeout: ${framework}`));
        }, request.timeout);
      }
      
      // Add to priority queue
      this.priorityQueue.enqueue(queueItem);
      
      // Trigger processing
      this.processQueue();
    });
  }

  /**
   * Preload framework with low priority
   */
  async preloadFramework(framework: FrameworkType, version?: string): Promise<void> {
    try {
      await this.loadFramework(framework, LoadPriority.LOW, version);
      this.log(`Preloaded framework: ${framework}@${version || 'latest'}`);
    } catch (error) {
      this.log(`Preload failed for ${framework}:`, error);
      // Don't throw for preload failures
    }
  }

  /**
   * Get cached frameworks
   */
  getCachedFrameworks(): FrameworkType[] {
    return Array.from(this.frameworkCache.values()).map(core => core.name);
  }

  /**
   * Invalidate framework cache
   */
  async invalidateFrameworkCache(framework?: FrameworkType): Promise<void> {
    if (framework) {
      // Remove specific framework from cache
      const keysToRemove = Array.from(this.frameworkCache.keys())
        .filter(key => key.startsWith(`${framework}@`));
      
      for (const key of keysToRemove) {
        this.frameworkCache.delete(key);
      }
      
      this.log(`Invalidated cache for ${framework}`);
    } else {
      // Clear entire cache
      this.frameworkCache.clear();
      this.log('Invalidated entire framework cache');
    }
    
    // Also invalidate service worker cache if available
    if (this.serviceWorkerManager?.isReady()) {
      await this.serviceWorkerManager.invalidateFrameworkCache(framework);
    }
  }

  /**
   * Get loading metrics
   */
  getLoadingMetrics(): FrameworkLoadingMetrics {
    // Calculate current failure rate
    const totalAttempts = this.metrics.totalRequests;
    const failures = Array.from(this.loadingStates.values())
      .filter(state => state.status === 'failed').length;
    
    this.metrics.failureRate = totalAttempts > 0 ? failures / totalAttempts : 0;
    
    return { ...this.metrics };
  }

  /**
   * Adapt to network conditions
   */
  adaptToNetworkConditions(conditions: NetworkConditions): void {
    this.networkAdapter.updateNetworkConditions(conditions);
  }

  /**
   * Get current network conditions
   */
  getCurrentNetworkConditions(): NetworkConditions | null {
    return this.networkAdapter.getCurrentConditions();
  }

  /**
   * Get loading queue statistics
   */
  getQueueStats(): {
    queueSize: number;
    activeLoads: number;
    loadingStates: Array<{ framework: string; status: string; duration: number }>;
  } {
    const now = performance.now();
    const loadingStates = Array.from(this.loadingStates.entries()).map(([key, state]) => ({
      framework: key,
      status: state.status,
      duration: state.endTime ? state.endTime - state.startTime : now - state.startTime
    }));
    
    return {
      queueSize: this.priorityQueue.size(),
      activeLoads: this.activeLoads.size,
      loadingStates
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    // Mark as shutdown
    this.isShutdown = true;
    
    // Stop processing
    this.stopProcessing();
    
    // Clear pending requests
    const pendingItems = this.priorityQueue.clear();
    for (const item of pendingItems) {
      if (item.timeoutHandle) {
        clearTimeout(item.timeoutHandle);
      }
      item.reject(new Error('Service shutdown'));
    }
    
    // Clear state
    this.loadingStates.clear();
    this.activeLoads.clear();
    
    this.log('Framework loader service shutdown');
  }

  /**
   * Start processing the priority queue
   */
  private startProcessing(): void {
    if (this.processingInterval) return;
    
    // Process queue every 10ms for responsive loading
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 10);
  }

  /**
   * Stop processing the priority queue
   */
  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Process items in the priority queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    const strategy = this.networkAdapter.getAdaptedStrategy();
    
    // Check if we can start new loads
    while (
      this.activeLoads.size < strategy.maxConcurrentLoads &&
      !this.priorityQueue.isEmpty()
    ) {
      const item = this.priorityQueue.dequeue();
      if (!item) break;
      
      // Start loading this framework
      this.startFrameworkLoad(item);
    }
  }

  /**
   * Start loading a specific framework
   */
  private async startFrameworkLoad(item: PriorityQueueItem): Promise<void> {
    const { request } = item;
    const cacheKey = this.getCacheKey(request.framework, request.version);
    
    // Check if service has been shut down
    if (this.isShutdown) {
      item.reject(new Error('Service shutdown'));
      return;
    }
    
    // Mark as active
    this.activeLoads.add(cacheKey);
    this.updateLoadingState(cacheKey, 'loading');
    
    try {
      let frameworkCore: FrameworkCore;
      
      // Try service worker first if available
      if (this.config.serviceWorkerEnabled && this.serviceWorkerManager?.isReady()) {
        try {
          frameworkCore = await this.loadFromServiceWorker(request);
          this.log(`Loaded ${request.framework} via service worker`);
        } catch (swError) {
          this.log(`Service worker load failed for ${request.framework}, falling back:`, swError);
          if (this.config.fallbackEnabled && this.fallbackLoader) {
            frameworkCore = await this.loadFromFallback(request);
          } else {
            frameworkCore = await this.fetchFrameworkFromNetwork(request);
          }
        }
      } else if (this.config.fallbackEnabled && this.fallbackLoader) {
        // Use fallback loader
        frameworkCore = await this.loadFromFallback(request);
      } else {
        // Direct network loading as last resort
        frameworkCore = await this.fetchFrameworkFromNetwork(request);
      }
      
      // Cache the loaded framework
      this.cacheFramework(cacheKey, frameworkCore);
      
      // Update state
      this.updateLoadingState(cacheKey, 'loaded');
      
      // Clear timeout
      if (item.timeoutHandle) {
        clearTimeout(item.timeoutHandle);
      }
      
      // Resolve the promise
      item.resolve(frameworkCore);
      
    } catch (error) {
      this.log(`Failed to load framework ${request.framework}:`, error);
      
      // Clear timeout
      if (item.timeoutHandle) {
        clearTimeout(item.timeoutHandle);
      }
      
      // Reject the promise
      item.reject(error as Error);
      
    } finally {
      // Remove from active loads
      this.activeLoads.delete(cacheKey);
    }
  }

  /**
   * Load framework from service worker
   */
  private async loadFromServiceWorker(request: FrameworkRequest): Promise<FrameworkCore> {
    if (!this.serviceWorkerManager) {
      throw new Error('Service worker manager not available');
    }
    
    // Check service worker cache first
    const cached = await this.serviceWorkerManager.getCachedFramework(
      request.framework, 
      request.version
    );
    
    if (cached) {
      return {
        name: request.framework,
        version: cached.version,
        bundle: cached.bundle,
        dependencies: cached.dependencies,
        size: cached.size,
        checksum: cached.checksum,
        timestamp: cached.timestamp
      };
    }
    
    // Framework not in service worker cache, need to fetch and cache
    this.metrics.networkRequests++;
    
    // This would typically involve fetching from CDN or build artifacts
    // For now, we'll simulate the loading process
    const mockFrameworkCore = await this.fetchFrameworkFromNetwork(request);
    
    // Cache in service worker
    await this.serviceWorkerManager.cacheFramework(cached || {
      name: request.framework,
      version: mockFrameworkCore.version,
      bundle: mockFrameworkCore.bundle,
      dependencies: mockFrameworkCore.dependencies,
      size: mockFrameworkCore.size,
      timestamp: Date.now(),
      checksum: mockFrameworkCore.checksum
    });
    
    return mockFrameworkCore;
  }

  /**
   * Load framework using fallback loader
   */
  private async loadFromFallback(request: FrameworkRequest): Promise<FrameworkCore> {
    if (!this.fallbackLoader) {
      throw new Error('Fallback loader not available');
    }
    
    this.metrics.networkRequests++;
    
    // Use fallback loader
    await this.fallbackLoader.loadFramework({
      name: request.framework,
      priority: request.priority
    });
    
    // Return mock framework core (in real implementation, this would come from the fallback loader)
    return this.fetchFrameworkFromNetwork(request);
  }

  /**
   * Simulate fetching framework from network
   * In real implementation, this would fetch from CDN or build artifacts
   */
  private async fetchFrameworkFromNetwork(request: FrameworkRequest): Promise<FrameworkCore> {
    // Simulate network delay based on network conditions
    const conditions = this.networkAdapter.getCurrentConditions();
    let delay = 50; // Base delay
    
    if (conditions) {
      switch (conditions.effectiveType) {
        case 'slow-2g':
          delay = 2000;
          break;
        case '2g':
          delay = 1000;
          break;
        case '3g':
          delay = 300;
          break;
        case '4g':
          delay = 100;
          break;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Check if service has been shut down during network loading
    if (this.isShutdown) {
      throw new Error('Service shutdown');
    }
    
    // Mock framework bundle
    const mockBundle = new ArrayBuffer(1024 * 100); // 100KB mock bundle
    
    return {
      name: request.framework,
      version: request.version || '1.0.0',
      bundle: mockBundle,
      dependencies: this.getFrameworkDependencies(request.framework),
      size: mockBundle.byteLength,
      checksum: this.generateChecksum(request.framework, request.version || '1.0.0'),
      timestamp: Date.now()
    };
  }

  /**
   * Get framework dependencies
   */
  private getFrameworkDependencies(framework: FrameworkType): string[] {
    const dependencies: Record<FrameworkType, string[]> = {
      [FrameworkType.REACT]: ['react-dom'],
      [FrameworkType.VUE]: ['vue-router'],
      [FrameworkType.SVELTE]: ['svelte-kit'],
      [FrameworkType.SOLID]: ['solid-js']
    };
    
    return dependencies[framework] || [];
  }

  /**
   * Generate checksum for framework
   */
  private generateChecksum(framework: string, version: string): string {
    // Simple checksum generation (in real implementation, use proper hashing)
    return btoa(`${framework}@${version}@${Date.now()}`).slice(0, 16);
  }

  /**
   * Get cache key for framework
   */
  private getCacheKey(framework: FrameworkType, version?: string): string {
    return `${framework}@${version || 'latest'}`;
  }

  /**
   * Get framework from cache
   */
  private getFromCache(cacheKey: string): FrameworkCore | null {
    const cached = this.frameworkCache.get(cacheKey);
    if (!cached) return null;
    
    // Check if cache entry is still valid
    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheConfig.maxAge) {
      this.frameworkCache.delete(cacheKey);
      return null;
    }
    
    return cached;
  }

  /**
   * Cache framework
   */
  private cacheFramework(cacheKey: string, framework: FrameworkCore): void {
    // Check cache size limits
    if (this.frameworkCache.size >= this.config.cacheConfig.maxSize) {
      // Remove oldest entry
      const oldestKey = Array.from(this.frameworkCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.frameworkCache.delete(oldestKey);
    }
    
    this.frameworkCache.set(cacheKey, framework);
  }

  /**
   * Update loading state
   */
  private updateLoadingState(
    cacheKey: string, 
    status: LoadingState['status'], 
    error?: Error
  ): void {
    const state = this.loadingStates.get(cacheKey);
    if (state) {
      state.status = status;
      if (status === 'loaded' || status === 'failed') {
        state.endTime = performance.now();
      }
      if (error) {
        state.error = error;
      }
    }
  }

  /**
   * Update load time metrics
   */
  private updateLoadTime(framework: FrameworkType, loadTime: number): void {
    if (!this.metrics.loadTimesByFramework.has(framework)) {
      this.metrics.loadTimesByFramework.set(framework, []);
    }
    
    const times = this.metrics.loadTimesByFramework.get(framework)!;
    times.push(loadTime);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
    
    // Update average load time
    const allTimes = Array.from(this.metrics.loadTimesByFramework.values()).flat();
    this.metrics.averageLoadTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
  }

  /**
   * Handle network condition changes
   */
  private onNetworkConditionsChanged(conditions: NetworkConditions, strategy: LoadingStrategy): void {
    this.log(`Network conditions changed: ${conditions.effectiveType}, ${conditions.downlink}Mbps, ${conditions.rtt}ms RTT`);
    
    // Update priority queue weights
    this.priorityQueue.updatePriorityWeights(strategy.priorityWeights);
    
    // Adjust active load limits if needed
    if (this.activeLoads.size > strategy.maxConcurrentLoads) {
      this.log(`Reducing concurrent loads from ${this.activeLoads.size} to ${strategy.maxConcurrentLoads}`);
      // Note: Active loads will naturally reduce as they complete
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log messages if logging is enabled
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[FrameworkLoaderService] ${message}`, ...args);
    }
  }
}

/**
 * Default configuration for Framework Loader Service
 */
export const defaultFrameworkLoaderConfig: FrameworkLoaderConfig = {
  serviceWorkerEnabled: true,
  fallbackEnabled: true,
  loadingStrategy: {
    maxConcurrentLoads: 3,
    timeoutMs: 5000,
    retryAttempts: 2,
    retryDelayMs: 1000,
    priorityWeights: {
      [LoadPriority.CRITICAL]: 1000,
      [LoadPriority.HIGH]: 100,
      [LoadPriority.NORMAL]: 10,
      [LoadPriority.LOW]: 1
    },
    networkAdaptation: {
      enabled: true,
      slowNetworkThreshold: 1.5, // Mbps
      adaptiveTimeout: true
    }
  },
  cacheConfig: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 50, // Max 50 cached frameworks
    compressionEnabled: true,
    invalidationStrategy: 'checksum'
  },
  enableMetrics: true,
  enableLogging: process.env.NODE_ENV === 'development'
};

/**
 * Create Framework Loader Service with default configuration
 */
export function createFrameworkLoaderService(
  config?: Partial<FrameworkLoaderConfig>,
  serviceWorkerManager?: ServiceWorkerManager,
  fallbackLoader?: FallbackFrameworkLoader
): FrameworkLoaderService {
  const finalConfig = { ...defaultFrameworkLoaderConfig, ...config };
  return new FrameworkLoaderService(finalConfig, serviceWorkerManager, fallbackLoader);
}