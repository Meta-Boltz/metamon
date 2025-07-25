/**
 * Code Splitter for Ultra-Modern MTM Router
 * Implements code splitting, lazy loading, and intelligent preloading
 */

import { withRetry, createRetryController, createRetryQueue } from '../../../packages/core/src/utils/chunk-retry.js';

export class CodeSplitter {
  constructor(options = {}) {
    this.options = {
      preloadThreshold: 0.5, // Preload when 50% visible
      preloadDelay: 100, // Delay before preloading (ms)
      maxConcurrentLoads: 3, // Max concurrent chunk loads
      chunkTimeout: 10000, // Chunk load timeout (ms)
      enablePreloading: true,
      enablePrefetching: true,
      safeAssignment: true, // Use safe property assignment
      errorHandling: "strict", // How to handle loading errors: "strict" or "tolerant"
      defaultTransforms: null, // Default transformations to apply to all modules
      retryStrategy: "exponential", // Retry strategy: "exponential", "linear", or "none"
      maxRetries: 3, // Maximum number of retry attempts
      retryBaseDelay: 1000, // Base delay for retry (ms)
      retryMaxDelay: 30000, // Maximum delay for retry (ms)
      retryJitter: 0.1, // Jitter factor for randomizing retry delays (0-1)
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
      cacheHits: 0,
      retryAttempts: 0,
      retrySuccesses: 0
    };

    // Create retry queue for chunk loading
    this.retryQueue = createRetryQueue({
      concurrency: this.options.maxConcurrentLoads,
      maxSize: 100,
      maxRetries: this.options.maxRetries,
      strategy: this.options.retryStrategy,
      baseDelay: this.options.retryBaseDelay,
      maxDelay: this.options.retryMaxDelay,
      jitter: this.options.retryJitter,
      onRetry: (count, error, delay, item) => {
        this.loadStats.retryAttempts++;
        console.log(`⚠️ Retry queue: Retrying chunk ${item?.chunkId || 'unknown'} (attempt ${count}/${this.options.maxRetries})`);
      }
    });

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
    // Try to extract the file path from the import function
    const filePath = this.extractFilePath(importFn);

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

      // Create context for error classification
      const context = {
        chunkId,
        filePath,
        options: { ...options, chunkTimeout: undefined }, // Exclude large objects
        timeout: options.chunkTimeout || this.options.chunkTimeout,
        url: this.getChunkUrl(importFn, chunkId),
        loadTime: performance.now() - startTime,
        browserInfo: typeof navigator !== 'undefined' ? {
          userAgent: navigator.userAgent,
          platform: navigator.platform
        } : 'not-browser'
      };

      // Classify the error
      const classifiedError = classifyChunkError(error, context);

      // Log with detailed information
      console.error(`❌ Failed to load chunk ${chunkId} [${classifiedError.phase}]:`, classifiedError);

      // Create a detailed error report for logging or telemetry
      const errorReport = createErrorReport(classifiedError);

      // Handle based on error handling strategy
      if (this.options.errorHandling === 'tolerant') {
        if (classifiedError instanceof ChunkPropertyError) {
          console.warn('Continuing despite property descriptor error due to tolerant error handling');

          try {
            // Try to import the safe assignment utility directly
            const { safeAssign } = await import('../../../packages/core/src/utils/safe-assign.js');

            // Attempt to recover the module using our safe assignment utility
            const recoveredModule = await importFn().catch(() => null);

            if (recoveredModule) {
              console.log(`🔄 Attempting to recover chunk ${chunkId} using safe assignment`);

              // Return a wrapped module that uses safe assignment for all property access
              return new Proxy(recoveredModule, {
                set(target, prop, value) {
                  const result = safeAssign(target, prop, value);
                  return true; // Proxy set handlers must return true on success
                },
                get(target, prop) {
                  if (prop === '__recovered') return true;
                  if (prop === '__diagnostics') return errorReport;
                  return target[prop];
                }
              });
            }
          } catch (recoveryError) {
            console.warn(`Recovery attempt failed for chunk ${chunkId}:`, recoveryError);
          }

          // Return a minimal valid module to prevent complete failure
          return {
            default: () => {
              console.warn(`Using fallback for chunk ${chunkId} due to loading error`);
              return null;
            },
            __loadError: classifiedError,
            __diagnostics: errorReport,
            __recovered: false,
            __errorMessage: classifiedError.getUserMessage()
          };
        }
      }

      // For strict error handling or non-property descriptor errors
      throw classifiedError;
    }
  }

  /**
   * Extract file path from import function
   */
  extractFilePath(importFn) {
    try {
      const fnString = importFn.toString();
      const match = fnString.match(/import\(['"`]([^'"`]+)['"`]\)/);
      return match ? match[1] : 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * Perform the actual chunk loading with timeout and retry
   */
  async performChunkLoad(importFn, options, chunkId) {
    const {
      chunkTimeout = this.options.chunkTimeout,
      maxRetries = 3,
      retryStrategy = this.options.retryStrategy || 'exponential'
    } = options;

    let retryCount = 0;
    const filePath = this.extractFilePath(importFn);

    // Import the safe assignment utilities
    let safeAssignUtil, safeAssignAllUtil;
    try {
      // Dynamic import to avoid circular dependencies
      console.log('🔧 Importing safe assignment utilities...');
      const utils = await import('../../../packages/core/src/utils/safe-assign.js');
      safeAssignUtil = utils.safeAssign;
      safeAssignAllUtil = utils.safeAssignAll;
      console.log('✅ Safe assignment utilities imported successfully');
      console.log('safeAssign function:', typeof safeAssignUtil);
    } catch (error) {
      console.warn('Safe assignment utility not available, falling back to safe implementation:', error);
      // Fallback implementation that handles getter-only properties
      safeAssignUtil = (obj, prop, value) => {
        if (obj == null) {
          return obj;
        }

        try {
          // Check if property has getter but no setter
          const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

          if (descriptor && descriptor.get && !descriptor.set) {
            console.log(`Property ${prop} has getter but no setter, creating new object`);
            // Create a new object with the desired property
            const newObj = Object.create(Object.getPrototypeOf(obj));

            // Copy existing properties
            Object.getOwnPropertyNames(obj).forEach(key => {
              if (key !== prop) {
                try {
                  const keyDescriptor = Object.getOwnPropertyDescriptor(obj, key);
                  if (keyDescriptor) {
                    Object.defineProperty(newObj, key, keyDescriptor);
                  }
                } catch (e) {
                  // Skip properties that can't be copied
                }
              }
            });

            // Add our property
            newObj[prop] = value;
            return newObj;
          } else {
            // Normal assignment
            obj[prop] = value;
            return obj;
          }
        } catch (e) {
          console.warn(`Failed to assign property ${prop}, creating new object:`, e);
          // Create a completely new object as last resort
          const newObj = { ...obj };
          newObj[prop] = value;
          return newObj;
        }
      };
      safeAssignAllUtil = (obj, props) => {
        let result = obj;
        for (const [key, value] of Object.entries(props)) {
          result = safeAssignUtil(result, key, value);
        }
        return result;
      };
    }

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const { signal } = controller;

    // Configure backoff options based on retry strategy
    const backoffOptions = {
      baseDelay: 1000,
      maxDelay: 30000,
      factor: retryStrategy === 'exponential' ? 2 : 1,
      jitter: 0.1
    };

    while (retryCount <= maxRetries) {
      try {
        // Set up timeout
        const timeoutId = setTimeout(() => {
          controller.abort('timeout');
        }, chunkTimeout);

        // Start loading with abort signal if supported
        let module;
        try {
          // Modern browsers support passing signal to dynamic import
          if (typeof AbortController !== 'undefined' && 'signal' in AbortController.prototype) {
            // This is a theoretical API that might be supported in the future
            // Currently, dynamic imports can't be aborted directly
            module = await importFn();
          } else {
            module = await importFn();
          }
        } catch (importError) {
          // Check if this was an abort
          if (signal.aborted) {
            throw new Error('Chunk load timeout');
          }

          // Check if this is a property descriptor error that we can fix
          if (importError.message && importError.message.includes('Cannot set property') && importError.message.includes('which has only a getter')) {
            console.warn('🔧 Attempting to recover from property descriptor error using safe assignment');

            try {
              // Try to load the module again with a wrapper that prevents property assignment
              const moduleFactory = async () => {
                // Create a safe import wrapper
                const originalImport = importFn;
                return await originalImport();
              };

              module = await moduleFactory();

              // If we got here, the module loaded but might have getter-only properties
              // Apply safe assignment to ensure we can add our metadata
              if (module && typeof module === 'object') {
                console.log('🔧 Applying safe assignment to recovered module...');
                console.log('safeAssignUtil type:', typeof safeAssignUtil);
                console.log('Module before assignment:', module);
                const originalModule = module;
                module = safeAssignUtil(module, 'data', {
                  chunkId,
                  loaded: true,
                  timestamp: Date.now(),
                  recoveredFromError: true
                });
                console.log('✅ Safe assignment completed, module changed:', module !== originalModule);
                console.log('Module after assignment:', module);
              }

              console.log('✅ Successfully recovered from property descriptor error');
            } catch (recoveryError) {
              console.error('❌ Failed to recover from property descriptor error:', recoveryError);
              throw importError; // Throw the original error
            }
          } else {
            throw importError;
          }
        } finally {
          clearTimeout(timeoutId);
        }

        // Process the module with safe property assignment
        if (module) {
          // Always try to add chunk metadata using safe assignment
          try {
            console.log('🔧 Adding chunk metadata using safe assignment...');
            const originalModule = module;
            module = safeAssignUtil(module, 'data', {
              chunkId,
              loaded: true,
              timestamp: Date.now(),
              loadTime: performance.now() - startTime
            });
            console.log('✅ Chunk metadata added successfully, module changed:', module !== originalModule);
          } catch (metadataError) {
            console.warn('⚠️ Could not add chunk metadata:', metadataError);
            // Continue without metadata - this is not critical
          }

          // Apply any necessary transformations to the module using safe assignment
          if (options.moduleTransforms) {
            // Use safeAssignAll for bulk property assignments
            module = safeAssignAllUtil(module, options.moduleTransforms);
          }

          // Apply any default transformations needed for all modules
          if (this.options.defaultTransforms) {
            module = safeAssignAllUtil(module, this.options.defaultTransforms);
          }

          // Handle special MTM module properties that might have getter-only issues
          if (module.__mtm && typeof module.__mtm === 'object') {
            // Ensure MTM metadata can be modified safely
            module = safeAssignUtil(module, '__mtm', {
              ...module.__mtm,
              loadedBy: 'chunk-loader',
              loadTime: new Date().toISOString()
            });
          } else {
            // Create MTM metadata if it doesn't exist
            try {
              module = safeAssignUtil(module, '__mtm', {
                loadedBy: 'chunk-loader',
                loadTime: new Date().toISOString(),
                chunkId,
                framework: 'unknown'
              });
            } catch (mtmError) {
              console.warn('⚠️ Could not add MTM metadata:', mtmError);
            }
          }
        }

        // Validate the loaded module
        if (!module || (!module.default && !module.render && !module.renderPage)) {
          throw new ChunkInvalidModuleError(
            'Invalid module structure',
            {
              chunkId,
              filePath,
              expectedExports: ['default', 'render', 'renderPage'],
              actualExports: module ? Object.keys(module) : []
            }
          );
        }

        return module;

      } catch (error) {
        // Create context for error classification
        const context = {
          chunkId,
          filePath,
          retryCount,
          maxRetries,
          timeout: chunkTimeout
        };

        // Classify the error
        const classifiedError = classifyChunkError(error, context);

        // Check if we should retry
        const shouldRetry = retryCount < maxRetries && isRetryableError(classifiedError);

        if (!shouldRetry) {
          throw classifiedError;
        }

        retryCount++;

        // Calculate backoff delay based on retry strategy
        let delay;
        if (retryStrategy === 'exponential') {
          delay = calculateBackoff(retryCount, backoffOptions);
        } else if (retryStrategy === 'linear') {
          delay = backoffOptions.baseDelay * retryCount;
        } else {
          delay = backoffOptions.baseDelay;
        }

        console.warn(
          `⚠️ Chunk load failed [${classifiedError.phase}], retrying in ${delay}ms ` +
          `(attempt ${retryCount}/${maxRetries}): ${classifiedError.message}`
        );

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached due to the throw in the catch block
    throw new Error(`Failed to load chunk ${chunkId} after ${maxRetries} retries`);
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
 * Import and re-export error classes from the chunk-error module
 */
import {
  ChunkError,
  ChunkNetworkError,
  ChunkParseError,
  ChunkExecutionError,
  ChunkPropertyError,
  ChunkTimeoutError,
  ChunkInvalidModuleError,
  ChunkAbortError,
  classifyChunkError,
  isRetryableError,
  calculateBackoff,
  collectDiagnostics,
  createErrorReport
} from '../../../packages/core/src/utils/chunk-error.js';

// Re-export all error classes
export {
  ChunkError,
  ChunkNetworkError,
  ChunkParseError,
  ChunkExecutionError,
  ChunkPropertyError,
  ChunkTimeoutError,
  ChunkInvalidModuleError,
  ChunkAbortError,
  classifyChunkError,
  isRetryableError,
  calculateBackoff,
  collectDiagnostics,
  createErrorReport
};

// For backward compatibility
export const ChunkLoadError = ChunkError;

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