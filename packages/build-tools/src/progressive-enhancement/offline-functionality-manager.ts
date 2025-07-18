/**
 * Offline Functionality Manager
 * 
 * Provides comprehensive offline functionality with cached framework cores,
 * background sync, and offline-first strategies.
 * 
 * Requirements: 7.3 - Add offline functionality with cached framework cores
 */

import { FrameworkType } from '../types/ssr-optimization.js';

export interface OfflineConfig {
  // Cache configuration
  cache: {
    strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
    maxAge: number;
    maxSize: number;
    enableCompression: boolean;
  };
  
  // Background sync
  backgroundSync: {
    enabled: boolean;
    syncInterval: number;
    maxRetries: number;
    retryDelay: number;
  };
  
  // Framework caching
  frameworks: {
    preloadCritical: boolean;
    cacheAllVersions: boolean;
    enableDeltaUpdates: boolean;
    compressionLevel: number;
  };
  
  // Offline UI
  ui: {
    showOfflineIndicator: boolean;
    enableOfflinePages: boolean;
    customOfflineContent: string | null;
  };
}

export interface CachedFramework {
  name: FrameworkType;
  version: string;
  content: ArrayBuffer;
  metadata: {
    size: number;
    timestamp: number;
    checksum: string;
    dependencies: string[];
    isCore: boolean;
  };
  usage: {
    accessCount: number;
    lastAccessed: number;
    priority: number;
  };
}

export interface OfflineMetrics {
  cacheHitRate: number;
  cacheMissRate: number;
  backgroundSyncSuccess: number;
  backgroundSyncFailures: number;
  offlinePageViews: number;
  frameworksServedOffline: Map<FrameworkType, number>;
  averageOfflineLoadTime: number;
  totalOfflineTime: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'framework_update' | 'cache_invalidation' | 'metadata_sync';
  data: any;
  timestamp: number;
  retries: number;
  priority: number;
}

/**
 * Manages offline functionality and cached framework delivery
 */
export class OfflineFunctionalityManager {
  private config: OfflineConfig;
  private cache: Map<string, CachedFramework> = new Map();
  private syncQueue: SyncQueueItem[] = [];
  private metrics: OfflineMetrics;
  private isOffline: boolean = false;
  private syncInterval?: NodeJS.Timeout;
  private compressionSupported: boolean = false;

  constructor(config: Partial<OfflineConfig> = {}) {
    this.config = {
      cache: {
        strategy: 'stale-while-revalidate',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxSize: 50 * 1024 * 1024, // 50MB
        enableCompression: true,
        ...config.cache
      },
      backgroundSync: {
        enabled: true,
        syncInterval: 5 * 60 * 1000, // 5 minutes
        maxRetries: 3,
        retryDelay: 30 * 1000, // 30 seconds
        ...config.backgroundSync
      },
      frameworks: {
        preloadCritical: true,
        cacheAllVersions: false,
        enableDeltaUpdates: true,
        compressionLevel: 6,
        ...config.frameworks
      },
      ui: {
        showOfflineIndicator: true,
        enableOfflinePages: true,
        customOfflineContent: null,
        ...config.ui
      }
    };

    this.metrics = {
      cacheHitRate: 0,
      cacheMissRate: 0,
      backgroundSyncSuccess: 0,
      backgroundSyncFailures: 0,
      offlinePageViews: 0,
      frameworksServedOffline: new Map(),
      averageOfflineLoadTime: 0,
      totalOfflineTime: 0
    };

    this.initialize();
  }

  /**
   * Initialize offline functionality
   */
  private async initialize(): Promise<void> {
    // Check compression support
    this.compressionSupported = await this.checkCompressionSupport();
    
    // Set up network monitoring
    this.setupNetworkMonitoring();
    
    // Initialize cache from persistent storage
    await this.loadCacheFromStorage();
    
    // Preload critical frameworks if configured
    if (this.config.frameworks.preloadCritical) {
      await this.preloadCriticalFrameworks();
    }
    
    // Start background sync if enabled
    if (this.config.backgroundSync.enabled) {
      this.startBackgroundSync();
    }
    
    // Set up offline UI
    this.setupOfflineUI();
  }

  /**
   * Cache a framework for offline use
   */
  async cacheFramework(
    framework: FrameworkType,
    version: string,
    content: ArrayBuffer,
    metadata: Partial<CachedFramework['metadata']> = {}
  ): Promise<void> {
    const cacheKey = `${framework}@${version}`;
    
    // Compress content if enabled and supported
    let finalContent = content;
    if (this.config.cache.enableCompression && this.compressionSupported) {
      finalContent = await this.compressContent(content);
    }
    
    const cachedFramework: CachedFramework = {
      name: framework,
      version,
      content: finalContent,
      metadata: {
        size: finalContent.byteLength,
        timestamp: Date.now(),
        checksum: await this.calculateChecksum(content),
        dependencies: metadata.dependencies || [],
        isCore: metadata.isCore || false,
        ...metadata
      },
      usage: {
        accessCount: 0,
        lastAccessed: Date.now(),
        priority: this.calculatePriority(framework, metadata.isCore || false)
      }
    };

    // Check cache size limits
    await this.ensureCacheSpace(cachedFramework.metadata.size);
    
    // Store in memory cache
    this.cache.set(cacheKey, cachedFramework);
    
    // Persist to storage
    await this.persistCacheEntry(cacheKey, cachedFramework);
    
    this.log('debug', `Cached framework: ${cacheKey} (${Math.floor(cachedFramework.metadata.size / 1024)}KB)`);
  }

  /**
   * Get cached framework
   */
  async getCachedFramework(framework: FrameworkType, version?: string): Promise<CachedFramework | null> {
    const cacheKey = version ? `${framework}@${version}` : this.findLatestVersion(framework);
    if (!cacheKey) return null;

    const cached = this.cache.get(cacheKey);
    if (!cached) {
      this.metrics.cacheMissRate++;
      return null;
    }

    // Check if cache entry is still valid
    if (this.isCacheExpired(cached)) {
      if (this.config.cache.strategy === 'cache-first' && this.isOffline) {
        // Use expired cache in offline mode
        this.log('warn', `Using expired cache for ${cacheKey} in offline mode`);
      } else {
        // Remove expired entry
        this.cache.delete(cacheKey);
        await this.removeCacheEntry(cacheKey);
        this.metrics.cacheMissRate++;
        return null;
      }
    }

    // Update usage statistics
    cached.usage.accessCount++;
    cached.usage.lastAccessed = Date.now();
    
    this.metrics.cacheHitRate++;
    
    // Decompress content if needed
    let content = cached.content;
    if (this.config.cache.enableCompression && this.compressionSupported) {
      content = await this.decompressContent(cached.content);
    }

    return {
      ...cached,
      content
    };
  }

  /**
   * Load framework with offline-first strategy
   */
  async loadFrameworkOffline(framework: FrameworkType, version?: string): Promise<ArrayBuffer | null> {
    const startTime = Date.now();
    
    try {
      switch (this.config.cache.strategy) {
        case 'cache-first':
          return await this.loadCacheFirst(framework, version);
        
        case 'network-first':
          return await this.loadNetworkFirst(framework, version);
        
        case 'stale-while-revalidate':
        default:
          return await this.loadStaleWhileRevalidate(framework, version);
      }
    } finally {
      const loadTime = Date.now() - startTime;
      this.updateOfflineLoadMetrics(framework, loadTime);
    }
  }

  /**
   * Cache-first loading strategy
   */
  private async loadCacheFirst(framework: FrameworkType, version?: string): Promise<ArrayBuffer | null> {
    // Try cache first
    const cached = await this.getCachedFramework(framework, version);
    if (cached) {
      this.log('debug', `Served ${framework} from cache`);
      return cached.content;
    }

    // Fallback to network if online
    if (!this.isOffline) {
      try {
        const content = await this.fetchFromNetwork(framework, version);
        if (content) {
          // Cache for future use
          await this.cacheFramework(framework, version || 'latest', content);
          return content;
        }
      } catch (error) {
        this.log('warn', `Network fetch failed for ${framework}:`, error);
      }
    }

    return null;
  }

  /**
   * Network-first loading strategy
   */
  private async loadNetworkFirst(framework: FrameworkType, version?: string): Promise<ArrayBuffer | null> {
    // Try network first if online
    if (!this.isOffline) {
      try {
        const content = await this.fetchFromNetwork(framework, version);
        if (content) {
          // Update cache
          await this.cacheFramework(framework, version || 'latest', content);
          return content;
        }
      } catch (error) {
        this.log('warn', `Network fetch failed for ${framework}:`, error);
      }
    }

    // Fallback to cache
    const cached = await this.getCachedFramework(framework, version);
    if (cached) {
      this.log('debug', `Served ${framework} from cache (network fallback)`);
      return cached.content;
    }

    return null;
  }

  /**
   * Stale-while-revalidate loading strategy
   */
  private async loadStaleWhileRevalidate(framework: FrameworkType, version?: string): Promise<ArrayBuffer | null> {
    // Get from cache immediately
    const cached = await this.getCachedFramework(framework, version);
    
    // If online, update cache in background
    if (!this.isOffline && cached) {
      this.revalidateInBackground(framework, version);
    }

    if (cached) {
      return cached.content;
    }

    // If no cache and online, fetch from network
    if (!this.isOffline) {
      try {
        const content = await this.fetchFromNetwork(framework, version);
        if (content) {
          await this.cacheFramework(framework, version || 'latest', content);
          return content;
        }
      } catch (error) {
        this.log('warn', `Network fetch failed for ${framework}:`, error);
      }
    }

    return null;
  }

  /**
   * Revalidate cache entry in background
   */
  private async revalidateInBackground(framework: FrameworkType, version?: string): Promise<void> {
    try {
      const content = await this.fetchFromNetwork(framework, version);
      if (content) {
        await this.cacheFramework(framework, version || 'latest', content);
        this.log('debug', `Background revalidation completed for ${framework}`);
      }
    } catch (error) {
      this.log('debug', `Background revalidation failed for ${framework}:`, error);
    }
  }

  /**
   * Fetch framework from network
   */
  private async fetchFromNetwork(framework: FrameworkType, version?: string): Promise<ArrayBuffer | null> {
    const url = this.buildFrameworkUrl(framework, version);
    
    try {
      const response = await fetch(url, {
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      this.log('warn', `Failed to fetch ${framework} from network:`, error);
      return null;
    }
  }

  /**
   * Build framework URL
   */
  private buildFrameworkUrl(framework: FrameworkType, version?: string): string {
    const baseUrl = '/metamon-framework';
    const versionParam = version ? `?version=${version}` : '';
    return `${baseUrl}/${framework}${versionParam}`;
  }

  /**
   * Preload critical frameworks
   */
  private async preloadCriticalFrameworks(): Promise<void> {
    const criticalFrameworks: FrameworkType[] = ['reactjs', 'vue']; // Configure as needed
    
    for (const framework of criticalFrameworks) {
      try {
        const content = await this.fetchFromNetwork(framework);
        if (content) {
          await this.cacheFramework(framework, 'latest', content, { isCore: true });
          this.log('info', `Preloaded critical framework: ${framework}`);
        }
      } catch (error) {
        this.log('warn', `Failed to preload ${framework}:`, error);
      }
    }
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const updateOnlineStatus = () => {
      const wasOffline = this.isOffline;
      this.isOffline = !navigator.onLine;
      
      if (wasOffline && !this.isOffline) {
        this.handleOnlineTransition();
      } else if (!wasOffline && this.isOffline) {
        this.handleOfflineTransition();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Check initial state
    updateOnlineStatus();
  }

  /**
   * Handle transition to online
   */
  private handleOnlineTransition(): void {
    this.log('info', 'Connection restored - resuming network operations');
    
    // Process sync queue
    this.processSyncQueue();
    
    // Update UI
    this.updateOfflineUI(false);
  }

  /**
   * Handle transition to offline
   */
  private handleOfflineTransition(): void {
    this.log('info', 'Connection lost - switching to offline mode');
    
    this.metrics.offlinePageViews++;
    
    // Update UI
    this.updateOfflineUI(true);
  }

  /**
   * Setup offline UI
   */
  private setupOfflineUI(): void {
    if (!this.config.ui.showOfflineIndicator || typeof document === 'undefined') return;

    // Inject offline styles
    this.injectOfflineStyles();
  }

  /**
   * Update offline UI
   */
  private updateOfflineUI(isOffline: boolean): void {
    if (typeof document === 'undefined') return;

    if (isOffline) {
      document.body.classList.add('metamon-offline');
      this.showOfflineIndicator();
    } else {
      document.body.classList.remove('metamon-offline');
      this.hideOfflineIndicator();
    }
  }

  /**
   * Show offline indicator
   */
  private showOfflineIndicator(): void {
    if (typeof document === 'undefined') return;

    let indicator = document.getElementById('metamon-offline-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'metamon-offline-indicator';
      indicator.className = 'metamon-offline-indicator';
      
      const content = this.config.ui.customOfflineContent || `
        <div class="offline-content">
          <span class="offline-icon">📡</span>
          <span class="offline-text">Offline Mode - Using cached content</span>
        </div>
      `;
      
      indicator.innerHTML = content;
      document.body.appendChild(indicator);
    }
    
    indicator.style.display = 'block';
  }

  /**
   * Hide offline indicator
   */
  private hideOfflineIndicator(): void {
    if (typeof document === 'undefined') return;

    const indicator = document.getElementById('metamon-offline-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Inject offline styles
   */
  private injectOfflineStyles(): void {
    if (typeof document === 'undefined') return;

    const styleId = 'metamon-offline-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .metamon-offline-indicator {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #ff6b35;
        color: white;
        padding: 8px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 10000;
        display: none;
      }
      
      .offline-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      
      .offline-icon {
        font-size: 16px;
      }
      
      .metamon-offline .framework-fallback {
        opacity: 0.8;
        border: 1px dashed #ccc;
      }
      
      .metamon-offline .loading-indicator {
        display: none;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Start background sync
   */
  private startBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (!this.isOffline) {
        this.processSyncQueue();
      }
    }, this.config.backgroundSync.syncInterval);
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    this.log('debug', `Processing ${this.syncQueue.length} sync items`);

    // Sort by priority
    this.syncQueue.sort((a, b) => b.priority - a.priority);

    const itemsToProcess = this.syncQueue.splice(0, 5); // Process 5 at a time

    for (const item of itemsToProcess) {
      try {
        await this.processSyncItem(item);
        this.metrics.backgroundSyncSuccess++;
      } catch (error) {
        this.log('warn', `Sync item failed:`, error);
        
        item.retries++;
        if (item.retries < this.config.backgroundSync.maxRetries) {
          // Re-queue with lower priority
          item.priority = Math.max(1, item.priority - 1);
          this.syncQueue.push(item);
        } else {
          this.metrics.backgroundSyncFailures++;
        }
      }
    }
  }

  /**
   * Process individual sync item
   */
  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    switch (item.type) {
      case 'framework_update':
        await this.syncFrameworkUpdate(item.data);
        break;
      
      case 'cache_invalidation':
        await this.syncCacheInvalidation(item.data);
        break;
      
      case 'metadata_sync':
        await this.syncMetadata(item.data);
        break;
    }
  }

  /**
   * Sync framework update
   */
  private async syncFrameworkUpdate(data: any): Promise<void> {
    const { framework, version } = data;
    const content = await this.fetchFromNetwork(framework, version);
    
    if (content) {
      await this.cacheFramework(framework, version, content);
    }
  }

  /**
   * Sync cache invalidation
   */
  private async syncCacheInvalidation(data: any): Promise<void> {
    const { framework, version } = data;
    const cacheKey = version ? `${framework}@${version}` : framework;
    
    this.cache.delete(cacheKey);
    await this.removeCacheEntry(cacheKey);
  }

  /**
   * Sync metadata
   */
  private async syncMetadata(data: any): Promise<void> {
    // Implement metadata synchronization logic
    this.log('debug', 'Syncing metadata:', data);
  }

  /**
   * Utility methods
   */
  private findLatestVersion(framework: FrameworkType): string | null {
    const keys = Array.from(this.cache.keys()).filter(key => key.startsWith(framework));
    if (keys.length === 0) return null;
    
    // Return the most recently cached version
    return keys.sort((a, b) => {
      const aEntry = this.cache.get(a)!;
      const bEntry = this.cache.get(b)!;
      return bEntry.metadata.timestamp - aEntry.metadata.timestamp;
    })[0];
  }

  private isCacheExpired(cached: CachedFramework): boolean {
    return Date.now() - cached.metadata.timestamp > this.config.cache.maxAge;
  }

  private calculatePriority(framework: FrameworkType, isCore: boolean): number {
    let priority = isCore ? 10 : 5;
    
    // Boost priority for commonly used frameworks
    const commonFrameworks = ['reactjs', 'vue'];
    if (commonFrameworks.includes(framework)) {
      priority += 3;
    }
    
    return priority;
  }

  private async ensureCacheSpace(requiredSize: number): Promise<void> {
    const currentSize = this.getCurrentCacheSize();
    
    if (currentSize + requiredSize <= this.config.cache.maxSize) {
      return;
    }

    // Evict least recently used entries
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].usage.lastAccessed - b[1].usage.lastAccessed);

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      this.cache.delete(key);
      await this.removeCacheEntry(key);
      freedSpace += entry.metadata.size;
      
      if (freedSpace >= requiredSize) {
        break;
      }
    }
  }

  private getCurrentCacheSize(): number {
    let totalSize = 0;
    for (const cached of this.cache.values()) {
      totalSize += cached.metadata.size;
    }
    return totalSize;
  }

  private async checkCompressionSupport(): Promise<boolean> {
    return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
  }

  private async compressContent(content: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.compressionSupported) return content;

    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    writer.write(new Uint8Array(content));
    writer.close();

    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  }

  private async decompressContent(content: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.compressionSupported) return content;

    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    writer.write(new Uint8Array(content));
    writer.close();

    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  }

  private async calculateChecksum(content: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', content);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async loadCacheFromStorage(): Promise<void> {
    // Implement persistent storage loading
    // This would typically use IndexedDB or similar
    this.log('debug', 'Loading cache from persistent storage');
  }

  private async persistCacheEntry(key: string, entry: CachedFramework): Promise<void> {
    // Implement persistent storage
    // This would typically use IndexedDB or similar
    this.log('debug', `Persisting cache entry: ${key}`);
  }

  private async removeCacheEntry(key: string): Promise<void> {
    // Implement persistent storage removal
    this.log('debug', `Removing cache entry: ${key}`);
  }

  private updateOfflineLoadMetrics(framework: FrameworkType, loadTime: number): void {
    const current = this.metrics.frameworksServedOffline.get(framework) || 0;
    this.metrics.frameworksServedOffline.set(framework, current + 1);
    
    this.metrics.averageOfflineLoadTime = 
      (this.metrics.averageOfflineLoadTime + loadTime) / 2;
  }

  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: any[]): void {
    const prefix = '[Metamon Offline]';
    if (args.length > 0) {
      console[level](`${prefix} ${message}`, ...args);
    } else {
      console[level](`${prefix} ${message}`);
    }
  }

  /**
   * Public API methods
   */

  /**
   * Get offline metrics
   */
  getMetrics(): OfflineMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalSize: number;
    entryCount: number;
    hitRate: number;
    frameworks: Array<{ name: string; version: string; size: number; lastAccessed: number }>;
  } {
    const frameworks = Array.from(this.cache.values()).map(entry => ({
      name: entry.name,
      version: entry.version,
      size: entry.metadata.size,
      lastAccessed: entry.usage.lastAccessed
    }));

    return {
      totalSize: this.getCurrentCacheSize(),
      entryCount: this.cache.size,
      hitRate: this.metrics.cacheHitRate / (this.metrics.cacheHitRate + this.metrics.cacheMissRate) || 0,
      frameworks
    };
  }

  /**
   * Clear all cached frameworks
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    this.log('info', 'Cache cleared');
  }

  /**
   * Check if framework is cached
   */
  isFrameworkCached(framework: FrameworkType, version?: string): boolean {
    const cacheKey = version ? `${framework}@${version}` : this.findLatestVersion(framework);
    return cacheKey ? this.cache.has(cacheKey) : false;
  }

  /**
   * Get offline status
   */
  isOfflineMode(): boolean {
    return this.isOffline;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OfflineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.cache.clear();
    this.syncQueue.length = 0;
  }
}

/**
 * Default offline configuration
 */
export const defaultOfflineConfig: OfflineConfig = {
  cache: {
    strategy: 'stale-while-revalidate',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    maxSize: 50 * 1024 * 1024,
    enableCompression: true
  },
  backgroundSync: {
    enabled: true,
    syncInterval: 5 * 60 * 1000,
    maxRetries: 3,
    retryDelay: 30 * 1000
  },
  frameworks: {
    preloadCritical: true,
    cacheAllVersions: false,
    enableDeltaUpdates: true,
    compressionLevel: 6
  },
  ui: {
    showOfflineIndicator: true,
    enableOfflinePages: true,
    customOfflineContent: null
  }
};

/**
 * Create offline functionality manager with default configuration
 */
export function createOfflineFunctionalityManager(
  config?: Partial<OfflineConfig>
): OfflineFunctionalityManager {
  const finalConfig = { ...defaultOfflineConfig, ...config };
  return new OfflineFunctionalityManager(finalConfig);
}