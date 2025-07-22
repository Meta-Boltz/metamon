/**
 * Code Splitter for Ultra-Modern MTM Router
 * Implements code splitting, lazy loading, and intelligent preloading
 */

export class CodeSplitter {
  constructor(options = {}) {
    this.options = {
      preloadThreshold: 0.5, // Preload when 50% visible
      preloadDelay: 100, // Delay before preloading (ms)
      maxConcurrentLoads: 3, // Max concurrent chunk loads
      chunkTimeout: 10000, // Chunk load timeout (ms)
      enablePreloading: true,
      enablePrefetching: true,
      ...options
    };

    this.loadingChunks = new Map();
    this.loadedChunks = new Set();
    this.preloadQueue = [];
    this.loadingQueue = [];
    this.intersectionObserver = null;
    this.preloadLinks = new Map();
    this.chunkCache = new Map();
    this.loadStats = {
      totalLoads: 0,
      successfulLoads: 0,
      failedLoads: 0,
      averageLoadTime: 0,
      cacheHits: 0
    };

    this.init();
  }

  init() {
    if (typeof window !== 'undefined') {
      this.setupIntersectionObserver();
      this.setupPreloadHints();
      this.monitorNetworkConditions();
    }
  }

  /**
   * Create a lazy-loaded route component
   */
  createLazyRoute(importFn, options = {}) {
    const routeOptions = {
      preload: false,
      prefetch: false,
      chunk: null,
      priority: 'normal',
      ...options
    };

    return {
      loader: () => this.loadChunk(importFn, routeOptions),
      preload: () => this.preloadChunk(importFn, routeOptions),
      prefetch: () => this.prefetchChunk(importFn, routeOptions),
      options: routeOptions,
      isLazy: true
    };
  }

  /**
   * Load a chunk with caching and error handling
   */
  async loadChunk(importFn, options = {}) {
    const chunkId = this.getChunkId(importFn);
    const startTime = performance.now();

    try {
      // Check cache first
      if (this.chunkCache.has(chunkId)) {
        this.loadStats.cacheHits++;
        return this.chunkCache.get(chunkId);
      }

      // Check if already loading
      if (this.loadingChunks.has(chunkId)) {
        return await this.loadingChunks.get(chunkId);
      }

      // Start loading
      const loadPromise = this.performChunkLoad(importFn, options, chunkId);
      this.loadingChunks.set(chunkId, loadPromise);

      const result = await loadPromise;

      // Cache the result
      this.chunkCache.set(chunkId, result);
      this.loadedChunks.add(chunkId);
      this.loadingChunks.delete(chunkId);

      // Update stats
      const loadTime = performance.now() - startTime;
      this.updateLoadStats(true, loadTime);

      console.log(`📦 Loaded chunk ${chunkId} in ${loadTime.toFixed(2)}ms`);
      return result;

    } catch (error) {
      this.loadingChunks.delete(chunkId);
      this.updateLoadStats(false, performance.now() - startTime);

      console.error(`❌ Failed to load chunk ${chunkId}:`, error);
      throw new ChunkLoadError(`Failed to load chunk ${chunkId}`, error, chunkId);
    }
  }

  /**
   * Perform the actual chunk loading with timeout and retry
   */
  async performChunkLoad(importFn, options, chunkId) {
    const { chunkTimeout = this.options.chunkTimeout } = options;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount <= maxRetries) {
      try {
        const loadPromise = importFn();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Chunk load timeout')), chunkTimeout);
        });

        const module = await Promise.race([loadPromise, timeoutPromise]);

        // Validate the loaded module
        if (!module || (!module.default && !module.render && !module.renderPage)) {
          throw new Error('Invalid module: missing default export or render function');
        }

        return module;

      } catch (error) {
        retryCount++;
        if (retryCount > maxRetries) {
          throw error;
        }

        // Exponential backoff for retries
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        console.warn(`⚠️ Chunk load failed, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Preload a chunk without executing it
   */
  async preloadChunk(importFn, options = {}) {
    if (!this.options.enablePreloading) return;

    const chunkId = this.getChunkId(importFn);

    // Don't preload if already loaded or loading
    if (this.loadedChunks.has(chunkId) || this.loadingChunks.has(chunkId)) {
      return;
    }

    // Add to preload queue
    this.preloadQueue.push({
      importFn,
      options,
      chunkId,
      priority: options.priority || 'low',
      timestamp: Date.now()
    });

    // Process queue
    this.processPreloadQueue();
  }

  /**
   * Prefetch a chunk using link rel=prefetch
   */
  prefetchChunk(importFn, options = {}) {
    if (!this.options.enablePrefetching || typeof window === 'undefined') return;

    const chunkId = this.getChunkId(importFn);

    // Don't prefetch if already loaded
    if (this.loadedChunks.has(chunkId) || this.preloadLinks.has(chunkId)) {
      return;
    }

    try {
      // Create prefetch link
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'script';

      // Try to extract the chunk URL (this is implementation-specific)
      const chunkUrl = this.getChunkUrl(importFn, chunkId);
      if (chunkUrl) {
        link.href = chunkUrl;
        document.head.appendChild(link);
        this.preloadLinks.set(chunkId, link);

        console.log(`🔗 Prefetching chunk ${chunkId}`);
      }
    } catch (error) {
      console.warn('Failed to prefetch chunk:', error);
    }
  }

  /**
   * Process the preload queue with concurrency control
   */
  async processPreloadQueue() {
    if (this.loadingQueue.length >= this.options.maxConcurrentLoads) {
      return;
    }

    // Sort by priority and timestamp
    this.preloadQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 1;
      const bPriority = priorityOrder[b.priority] || 1;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return a.timestamp - b.timestamp;
    });

    while (this.preloadQueue.length > 0 && this.loadingQueue.length < this.options.maxConcurrentLoads) {
      const item = this.preloadQueue.shift();
      this.loadingQueue.push(item);

      // Start preloading
      this.loadChunk(item.importFn, { ...item.options, isPreload: true })
        .then(() => {
          console.log(`✅ Preloaded chunk ${item.chunkId}`);
        })
        .catch(error => {
          console.warn(`⚠️ Preload failed for chunk ${item.chunkId}:`, error);
        })
        .finally(() => {
          const index = this.loadingQueue.indexOf(item);
          if (index > -1) {
            this.loadingQueue.splice(index, 1);
          }
          // Process next item in queue
          setTimeout(() => this.processPreloadQueue(), 10);
        });
    }
  }

  /**
   * Setup intersection observer for intelligent preloading
   */
  setupIntersectionObserver() {
    if (!window.IntersectionObserver) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio >= this.options.preloadThreshold) {
            const link = entry.target;
            const chunkId = link.dataset.chunkId;
            const importFn = link.dataset.importFn;

            if (chunkId && importFn) {
              // Delay preloading slightly to avoid loading too eagerly
              setTimeout(() => {
                this.preloadChunk(
                  () => import(importFn),
                  { priority: 'normal' }
                );
              }, this.options.preloadDelay);
            }
          }
        });
      },
      {
        threshold: [this.options.preloadThreshold],
        rootMargin: '50px'
      }
    );
  }

  /**
   * Setup preload hints for critical routes
   */
  setupPreloadHints() {
    if (typeof document === 'undefined') return;

    // Observe navigation links for intelligent preloading
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.observeNavigationLinks(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial observation
    this.observeNavigationLinks(document.body);
  }

  /**
   * Observe navigation links for preloading opportunities
   */
  observeNavigationLinks(container) {
    const links = container.querySelectorAll('a[href^="/"], a[data-route]');

    links.forEach(link => {
      if (this.intersectionObserver && !link.dataset.observed) {
        link.dataset.observed = 'true';
        this.intersectionObserver.observe(link);
      }
    });
  }

  /**
   * Monitor network conditions to adjust loading strategy
   */
  monitorNetworkConditions() {
    if (!navigator.connection) return;

    const connection = navigator.connection;

    // Adjust preloading based on connection speed
    const updateStrategy = () => {
      const effectiveType = connection.effectiveType;

      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        this.options.enablePreloading = false;
        this.options.enablePrefetching = false;
        this.options.maxConcurrentLoads = 1;
      } else if (effectiveType === '3g') {
        this.options.enablePreloading = true;
        this.options.enablePrefetching = false;
        this.options.maxConcurrentLoads = 2;
      } else {
        this.options.enablePreloading = true;
        this.options.enablePrefetching = true;
        this.options.maxConcurrentLoads = 3;
      }

      console.log(`📶 Network: ${effectiveType}, preloading: ${this.options.enablePreloading}`);
    };

    connection.addEventListener('change', updateStrategy);
    updateStrategy();
  }

  /**
   * Generate a unique chunk ID from import function
   */
  getChunkId(importFn) {
    // Try to extract chunk name from function string
    const fnString = importFn.toString();
    const match = fnString.match(/import\(['"`]([^'"`]+)['"`]\)/);

    if (match) {
      return match[1].replace(/[^a-zA-Z0-9]/g, '_');
    }

    // Fallback to hash of function string
    return this.simpleHash(fnString);
  }

  /**
   * Try to extract chunk URL (implementation-specific)
   */
  getChunkUrl(importFn, chunkId) {
    // This would need to be implemented based on the bundler
    // For now, return null to skip prefetch link creation
    return null;
  }

  /**
   * Simple hash function for generating chunk IDs
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update loading statistics
   */
  updateLoadStats(success, loadTime) {
    this.loadStats.totalLoads++;

    if (success) {
      this.loadStats.successfulLoads++;
    } else {
      this.loadStats.failedLoads++;
    }

    // Update average load time
    const totalTime = this.loadStats.averageLoadTime * (this.loadStats.totalLoads - 1) + loadTime;
    this.loadStats.averageLoadTime = totalTime / this.loadStats.totalLoads;
  }

  /**
   * Get loading statistics
   */
  getLoadStats() {
    return {
      ...this.loadStats,
      successRate: this.loadStats.totalLoads > 0
        ? (this.loadStats.successfulLoads / this.loadStats.totalLoads) * 100
        : 0,
      cacheHitRate: this.loadStats.totalLoads > 0
        ? (this.loadStats.cacheHits / this.loadStats.totalLoads) * 100
        : 0,
      loadedChunks: this.loadedChunks.size,
      queuedPreloads: this.preloadQueue.length,
      activeLoads: this.loadingQueue.length
    };
  }

  /**
   * Clear all caches and reset state
   */
  clearCache() {
    this.chunkCache.clear();
    this.loadedChunks.clear();
    this.loadingChunks.clear();
    this.preloadQueue.length = 0;
    this.loadingQueue.length = 0;

    // Remove prefetch links
    this.preloadLinks.forEach(link => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });
    this.preloadLinks.clear();

    console.log('🧹 Code splitter cache cleared');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    this.clearCache();
    console.log('🔒 Code splitter destroyed');
  }
}

/**
 * Custom error class for chunk loading failures
 */
export class ChunkLoadError extends Error {
  constructor(message, originalError, chunkId) {
    super(message);
    this.name = 'ChunkLoadError';
    this.originalError = originalError;
    this.chunkId = chunkId;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Create a code splitter instance
 */
export function createCodeSplitter(options = {}) {
  return new CodeSplitter(options);
}

// Export utilities for route creation
export const lazy = (importFn, options = {}) => {
  const splitter = createCodeSplitter();
  return splitter.createLazyRoute(importFn, options);
};

export const preload = (importFn, options = {}) => {
  const splitter = createCodeSplitter();
  return splitter.preloadChunk(importFn, options);
};

export const prefetch = (importFn, options = {}) => {
  const splitter = createCodeSplitter();
  return splitter.prefetchChunk(importFn, options);
};