/**
 * Service Worker Framework Manager for Metamon Performance Optimization
 * 
 * Handles framework delivery, background task execution, intelligent caching,
 * and priority-based request handling within the service worker context.
 */

import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

export interface FrameworkRequest {
  framework: FrameworkType;
  version: string;
  priority: LoadPriority;
  clientId: string;
  timestamp: number;
}

export interface BackgroundTask {
  type: 'state-computation' | 'data-processing' | 'component-preparation' | 'cache-optimization';
  payload: any;
  timeout: number;
  priority: LoadPriority;
  id: string;
}

export interface FrameworkCacheEntry {
  name: string;
  version: string;
  bundle: ArrayBuffer;
  dependencies: string[];
  size: number;
  timestamp: number;
  checksum: string;
  accessCount: number;
  lastAccessed: number;
  priority: LoadPriority;
}

export interface CacheStrategy {
  maxSize: number;
  maxAge: number;
  evictionPolicy: 'lru' | 'lfu' | 'priority-based';
  compressionEnabled: boolean;
  preloadThreshold: number;
}

export interface FrameworkDeliveryMetrics {
  cacheHitRate: number;
  averageLoadTime: number;
  backgroundTasksExecuted: number;
  totalBytesServed: number;
  errorRate: number;
}

/**
 * Service Worker Framework Manager
 * 
 * This class runs within the service worker context and handles:
 * - Framework delivery with intelligent caching
 * - Background task execution for heavy computations
 * - Priority-based request handling
 * - Cache optimization and invalidation
 */
export class ServiceWorkerFrameworkManager {
  private cacheName: string;
  private cacheStrategy: CacheStrategy;
  private requestQueue: Map<LoadPriority, FrameworkRequest[]>;
  private backgroundTasks: Map<string, BackgroundTask>;
  private metrics: FrameworkDeliveryMetrics;
  private messagePort: MessagePort | null = null;

  constructor(
    cacheName: string = 'metamon-frameworks-v2',
    cacheStrategy: Partial<CacheStrategy> = {}
  ) {
    this.cacheName = cacheName;
    this.cacheStrategy = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      evictionPolicy: 'priority-based',
      compressionEnabled: true,
      preloadThreshold: 0.8,
      ...cacheStrategy
    };

    this.requestQueue = new Map([
      ['critical', []],
      ['high', []],
      ['normal', []],
      ['low', []]
    ]);

    this.backgroundTasks = new Map();
    this.metrics = {
      cacheHitRate: 0,
      averageLoadTime: 0,
      backgroundTasksExecuted: 0,
      totalBytesServed: 0,
      errorRate: 0
    };

    this.initializeRequestProcessor();
  }

  /**
   * Initialize the framework manager
   */
  async initialize(): Promise<void> {
    await this.setupCache();
    await this.loadMetrics();
    this.startBackgroundOptimization();
  }

  /**
   * Handle framework request with priority support
   */
  async handleFrameworkRequest(request: FrameworkRequest): Promise<Response> {
    const startTime = performance.now();
    
    try {
      // Add request to priority queue
      this.addToRequestQueue(request);
      
      // Try to serve from cache first
      const cachedFramework = await this.getCachedFramework(
        request.framework, 
        request.version
      );

      if (cachedFramework && !this.isCacheExpired(cachedFramework)) {
        // Update access metrics
        await this.updateAccessMetrics(cachedFramework);
        
        const loadTime = performance.now() - startTime;
        this.updateMetrics('hit', loadTime, cachedFramework.size);
        
        return this.createFrameworkResponse(cachedFramework, 'hit');
      }

      // If not in cache or expired, fetch from network
      const networkResponse = await this.fetchFrameworkFromNetwork(request);
      
      if (networkResponse.ok) {
        const bundle = await networkResponse.arrayBuffer();
        const framework = await this.createFrameworkCacheEntry(
          request, 
          bundle, 
          networkResponse
        );
        
        // Cache the framework with intelligent strategy
        await this.cacheFrameworkWithStrategy(framework);
        
        const loadTime = performance.now() - startTime;
        this.updateMetrics('miss', loadTime, framework.size);
        
        return this.createFrameworkResponse(framework, 'miss');
      }

      throw new Error(`Network request failed: ${networkResponse.status}`);

    } catch (error) {
      this.updateMetrics('error', performance.now() - startTime, 0);
      return this.createErrorResponse(error as Error, request);
    }
  }

  /**
   * Execute background task with priority handling
   */
  async executeInBackground(task: BackgroundTask): Promise<any> {
    this.backgroundTasks.set(task.id, task);
    
    try {
      const result = await this.processBackgroundTask(task);
      this.metrics.backgroundTasksExecuted++;
      this.backgroundTasks.delete(task.id);
      return result;
    } catch (error) {
      this.backgroundTasks.delete(task.id);
      throw error;
    }
  }

  /**
   * Cache framework with intelligent strategy
   */
  async cacheFrameworkWithStrategy(framework: FrameworkCacheEntry): Promise<void> {
    const cache = await caches.open(this.cacheName);
    
    // Check if we need to make space
    await this.ensureCacheSpace(framework.size);
    
    // Compress if enabled
    let bundle = framework.bundle;
    if (this.cacheStrategy.compressionEnabled) {
      bundle = await this.compressBundle(bundle);
    }
    
    // Create cache entry
    const response = new Response(bundle, {
      headers: {
        'Content-Type': 'application/javascript',
        'X-Metamon-Framework': framework.name,
        'X-Metamon-Version': framework.version,
        'X-Metamon-Size': framework.size.toString(),
        'X-Metamon-Timestamp': framework.timestamp.toString(),
        'X-Metamon-Checksum': framework.checksum,
        'X-Metamon-Dependencies': JSON.stringify(framework.dependencies),
        'X-Metamon-Priority': framework.priority,
        'X-Metamon-Access-Count': framework.accessCount.toString(),
        'X-Metamon-Last-Accessed': framework.lastAccessed.toString(),
        'X-Metamon-Compressed': this.cacheStrategy.compressionEnabled.toString()
      }
    });
    
    const cacheKey = this.generateCacheKey(framework.name, framework.version);
    await cache.put(cacheKey, response);
    
    // Update cache index for optimization
    await this.updateCacheIndex(framework);
  }

  /**
   * Get cached framework with access tracking
   */
  async getCachedFramework(
    name: string, 
    version?: string
  ): Promise<FrameworkCacheEntry | null> {
    const cache = await caches.open(this.cacheName);
    
    // Try exact version match first
    if (version && version !== 'latest') {
      const cacheKey = this.generateCacheKey(name, version);
      const response = await cache.match(cacheKey);
      
      if (response) {
        return await this.responseToFrameworkEntry(response);
      }
    }
    
    // Find latest version if no exact match
    const keys = await cache.keys();
    const frameworkKeys = keys.filter(req => 
      req.url.includes(this.generateCacheKey(name, ''))
    );
    
    if (frameworkKeys.length === 0) {
      return null;
    }
    
    // Get all matching frameworks and find the best one
    const frameworks = await Promise.all(
      frameworkKeys.map(async (key) => {
        const response = await cache.match(key);
        return response ? await this.responseToFrameworkEntry(response) : null;
      })
    );
    
    const validFrameworks = frameworks.filter(Boolean) as FrameworkCacheEntry[];
    if (validFrameworks.length === 0) {
      return null;
    }
    
    // Return the most suitable framework based on priority and recency
    return this.selectBestFramework(validFrameworks);
  }

  /**
   * Invalidate cache with pattern support
   */
  async invalidateCache(pattern: string): Promise<void> {
    const cache = await caches.open(this.cacheName);
    const keys = await cache.keys();
    
    const keysToDelete = keys.filter(req => {
      if (pattern === '*') return true;
      return req.url.includes(pattern);
    });
    
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
    
    // Update cache index
    await this.rebuildCacheIndex();
  }

  /**
   * Update framework cache with version management
   */
  async updateFrameworkCache(updates: Array<{
    name: string;
    oldVersion: string;
    newVersion: string;
    bundle: ArrayBuffer;
  }>): Promise<void> {
    const cache = await caches.open(this.cacheName);
    
    for (const update of updates) {
      // Remove old version directly
      const oldCacheKey = this.generateCacheKey(update.name, update.oldVersion);
      await cache.delete(oldCacheKey);
      
      // Add new version
      const framework: FrameworkCacheEntry = {
        name: update.name,
        version: update.newVersion,
        bundle: update.bundle,
        dependencies: [],
        size: update.bundle.byteLength,
        timestamp: Date.now(),
        checksum: await this.generateChecksum(update.bundle),
        accessCount: 0,
        lastAccessed: Date.now(),
        priority: 'normal'
      };
      
      await this.cacheFrameworkWithStrategy(framework);
    }
  }

  /**
   * Get delivery metrics
   */
  getMetrics(): FrameworkDeliveryMetrics {
    return { ...this.metrics };
  }

  /**
   * Set message port for communication
   */
  setMessagePort(port: MessagePort): void {
    this.messagePort = port;
  }

  // Private methods

  private async setupCache(): Promise<void> {
    const cache = await caches.open(this.cacheName);
    // Initialize cache if needed
  }

  private async loadMetrics(): Promise<void> {
    // Load metrics from persistent storage if available
    try {
      const cache = await caches.open(`${this.cacheName}-metrics`);
      const response = await cache.match('metrics');
      if (response) {
        const storedMetrics = await response.json();
        this.metrics = { ...this.metrics, ...storedMetrics };
      }
    } catch (error) {
      // Metrics loading failed, continue with defaults
    }
  }

  private startBackgroundOptimization(): void {
    // Start periodic cache optimization
    setInterval(() => {
      this.optimizeCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private addToRequestQueue(request: FrameworkRequest): void {
    const queue = this.requestQueue.get(request.priority) || [];
    queue.push(request);
    this.requestQueue.set(request.priority, queue);
  }

  private initializeRequestProcessor(): void {
    // Process requests by priority
    setInterval(() => {
      this.processRequestQueue();
    }, 100); // Process every 100ms
  }

  private async processRequestQueue(): Promise<void> {
    const priorities: LoadPriority[] = ['critical', 'high', 'normal', 'low'];
    
    for (const priority of priorities) {
      const queue = this.requestQueue.get(priority) || [];
      if (queue.length > 0) {
        // Process up to 3 requests per priority level per cycle
        const batch = queue.splice(0, 3);
        await Promise.all(
          batch.map(request => this.preloadFramework(request))
        );
      }
    }
  }

  private async preloadFramework(request: FrameworkRequest): Promise<void> {
    try {
      await this.handleFrameworkRequest(request);
    } catch (error) {
      // Preload failed, but don't throw
      console.warn(`[SW] Preload failed for ${request.framework}:`, error);
    }
  }

  private async fetchFrameworkFromNetwork(request: FrameworkRequest): Promise<Response> {
    const url = `/metamon-framework/${request.framework}?version=${request.version}&priority=${request.priority}`;
    return fetch(url, {
      headers: {
        'X-Metamon-Client-Id': request.clientId,
        'X-Metamon-Priority': request.priority
      }
    });
  }

  private async createFrameworkCacheEntry(
    request: FrameworkRequest,
    bundle: ArrayBuffer,
    response: Response
  ): Promise<FrameworkCacheEntry> {
    return {
      name: request.framework,
      version: request.version,
      bundle: bundle,
      dependencies: this.extractDependencies(response),
      size: bundle.byteLength,
      timestamp: Date.now(),
      checksum: await this.generateChecksum(bundle),
      accessCount: 1,
      lastAccessed: Date.now(),
      priority: request.priority
    };
  }

  private extractDependencies(response: Response): string[] {
    const deps = response.headers.get('X-Metamon-Dependencies');
    return deps ? JSON.parse(deps) : [];
  }

  private createFrameworkResponse(
    framework: FrameworkCacheEntry, 
    cacheStatus: 'hit' | 'miss'
  ): Response {
    return new Response(framework.bundle, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=31536000',
        'X-Metamon-Cache': cacheStatus,
        'X-Metamon-Framework': framework.name,
        'X-Metamon-Version': framework.version,
        'X-Metamon-Size': framework.size.toString(),
        'X-Metamon-Priority': framework.priority
      }
    });
  }

  private createErrorResponse(error: Error, request: FrameworkRequest): Response {
    return new Response(
      JSON.stringify({
        error: 'Framework loading failed',
        framework: request.framework,
        version: request.version,
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  private async processBackgroundTask(task: BackgroundTask): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Background task timeout: ${task.type}`));
      }, task.timeout);

      try {
        let result: any;

        switch (task.type) {
          case 'state-computation':
            result = this.computeState(task.payload);
            break;
          case 'data-processing':
            result = this.processData(task.payload);
            break;
          case 'component-preparation':
            result = this.prepareComponent(task.payload);
            break;
          case 'cache-optimization':
            result = this.optimizeCache();
            break;
          default:
            throw new Error(`Unknown task type: ${task.type}`);
        }

        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private computeState(payload: any): any {
    // Heavy state computation logic
    return { computed: true, result: payload };
  }

  private processData(payload: any): any {
    // Data processing logic
    return { processed: true, data: payload };
  }

  private prepareComponent(payload: any): any {
    // Component preparation logic
    return { prepared: true, component: payload };
  }

  private async optimizeCache(): Promise<any> {
    const stats = await this.getCacheStats();
    
    if (stats.totalSize > this.cacheStrategy.maxSize * this.cacheStrategy.preloadThreshold) {
      await this.evictCacheEntries();
    }
    
    return { optimized: true, stats };
  }

  private async ensureCacheSpace(requiredSize: number): Promise<void> {
    const stats = await this.getCacheStats();
    
    if (stats.totalSize + requiredSize > this.cacheStrategy.maxSize) {
      await this.evictCacheEntries(requiredSize);
    }
  }

  private async evictCacheEntries(requiredSize: number = 0): Promise<void> {
    const cache = await caches.open(this.cacheName);
    const keys = await cache.keys();
    
    // Get all frameworks with their metadata
    const frameworks = await Promise.all(
      keys.map(async (key) => {
        const response = await cache.match(key);
        if (response) {
          const framework = await this.responseToFrameworkEntry(response);
          return { key, framework };
        }
        return null;
      })
    );
    
    const validFrameworks = frameworks.filter(Boolean) as Array<{
      key: Request;
      framework: FrameworkCacheEntry;
    }>;
    
    // Sort by eviction policy
    let sortedFrameworks: typeof validFrameworks;
    
    switch (this.cacheStrategy.evictionPolicy) {
      case 'lru':
        sortedFrameworks = validFrameworks.sort(
          (a, b) => a.framework.lastAccessed - b.framework.lastAccessed
        );
        break;
      case 'lfu':
        sortedFrameworks = validFrameworks.sort(
          (a, b) => a.framework.accessCount - b.framework.accessCount
        );
        break;
      case 'priority-based':
      default:
        sortedFrameworks = validFrameworks.sort((a, b) => {
          const priorityOrder = { low: 0, normal: 1, high: 2, critical: 3 };
          const priorityDiff = priorityOrder[a.framework.priority] - priorityOrder[b.framework.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.framework.lastAccessed - b.framework.lastAccessed;
        });
        break;
    }
    
    // Remove entries until we have enough space
    let freedSpace = 0;
    const targetSpace = requiredSize || this.cacheStrategy.maxSize * 0.2; // Free 20% by default
    
    for (const { key, framework } of sortedFrameworks) {
      if (freedSpace >= targetSpace) break;
      
      await cache.delete(key);
      freedSpace += framework.size;
    }
  }

  private async updateAccessMetrics(framework: FrameworkCacheEntry): Promise<void> {
    framework.accessCount++;
    framework.lastAccessed = Date.now();
    
    // Update the cached entry
    await this.cacheFrameworkWithStrategy(framework);
  }

  private async getCacheStats(): Promise<{
    totalSize: number;
    entryCount: number;
    frameworks: FrameworkCacheEntry[];
  }> {
    const cache = await caches.open(this.cacheName);
    const keys = await cache.keys();
    
    let totalSize = 0;
    const frameworks: FrameworkCacheEntry[] = [];
    
    for (const key of keys) {
      const response = await cache.match(key);
      if (response) {
        const framework = await this.responseToFrameworkEntry(response);
        totalSize += framework.size;
        frameworks.push(framework);
      }
    }
    
    return { totalSize, entryCount: frameworks.length, frameworks };
  }

  private async responseToFrameworkEntry(response: Response): Promise<FrameworkCacheEntry> {
    let bundle = await response.arrayBuffer();
    const headers = response.headers;
    
    // Decompress if needed
    if (headers.get('X-Metamon-Compressed') === 'true') {
      bundle = await this.decompressBundle(bundle);
    }
    
    return {
      name: headers.get('X-Metamon-Framework') || '',
      version: headers.get('X-Metamon-Version') || '',
      bundle: bundle,
      dependencies: JSON.parse(headers.get('X-Metamon-Dependencies') || '[]'),
      size: parseInt(headers.get('X-Metamon-Size') || '0'),
      timestamp: parseInt(headers.get('X-Metamon-Timestamp') || '0'),
      checksum: headers.get('X-Metamon-Checksum') || '',
      accessCount: parseInt(headers.get('X-Metamon-Access-Count') || '0'),
      lastAccessed: parseInt(headers.get('X-Metamon-Last-Accessed') || '0'),
      priority: (headers.get('X-Metamon-Priority') as LoadPriority) || 'normal'
    };
  }

  private selectBestFramework(frameworks: FrameworkCacheEntry[]): FrameworkCacheEntry {
    // Sort by priority first, then by timestamp
    return frameworks.sort((a, b) => {
      const priorityOrder = { critical: 3, high: 2, normal: 1, low: 0 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp - a.timestamp;
    })[0];
  }

  private generateCacheKey(name: string, version: string): string {
    return `metamon-framework-${name}@${version}`;
  }

  private isCacheExpired(framework: FrameworkCacheEntry): boolean {
    return Date.now() - framework.timestamp > this.cacheStrategy.maxAge;
  }

  private async generateChecksum(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async compressBundle(bundle: ArrayBuffer): Promise<ArrayBuffer> {
    // Implement compression logic (e.g., using CompressionStream)
    if ('CompressionStream' in globalThis) {
      try {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        // Convert ArrayBuffer to Uint8Array for writing
        const uint8Array = new Uint8Array(bundle);
        writer.write(uint8Array);
        writer.close();
        
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        return result.buffer;
      } catch (error) {
        // Compression failed, return original bundle
        return bundle;
      }
    }
    
    return bundle; // Return uncompressed if compression not available
  }

  private async decompressBundle(bundle: ArrayBuffer): Promise<ArrayBuffer> {
    // Implement decompression logic
    if ('DecompressionStream' in globalThis) {
      try {
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        // Convert ArrayBuffer to Uint8Array for writing
        const uint8Array = new Uint8Array(bundle);
        writer.write(uint8Array);
        writer.close();
        
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        return result.buffer;
      } catch (error) {
        // Decompression failed, return original bundle
        return bundle;
      }
    }
    
    return bundle; // Return as-is if decompression not available
  }

  private updateMetrics(
    type: 'hit' | 'miss' | 'error',
    loadTime: number,
    bytes: number
  ): void {
    // Update cache hit rate
    const totalRequests = this.metrics.cacheHitRate * 100 + 1;
    if (type === 'hit') {
      this.metrics.cacheHitRate = ((this.metrics.cacheHitRate * 100 + 1) / totalRequests) / 100;
    } else {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * 100) / totalRequests / 100;
    }
    
    // Update average load time
    this.metrics.averageLoadTime = (this.metrics.averageLoadTime + loadTime) / 2;
    
    // Update bytes served
    if (type !== 'error') {
      this.metrics.totalBytesServed += bytes;
    }
    
    // Update error rate
    if (type === 'error') {
      this.metrics.errorRate = (this.metrics.errorRate + 1) / 2;
    } else {
      this.metrics.errorRate = this.metrics.errorRate * 0.99; // Decay error rate
    }
  }

  private async updateCacheIndex(framework: FrameworkCacheEntry): Promise<void> {
    // Update cache index for faster lookups
    // This could be implemented with IndexedDB for more complex scenarios
  }

  private async rebuildCacheIndex(): Promise<void> {
    // Rebuild cache index after invalidation
  }
}