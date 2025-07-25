/**
 * Universal Safe Chunk Loader
 * 
 * A framework-agnostic utility for safely loading JavaScript chunks
 * with proper error handling and performance monitoring.
 */

class SafeChunkLoader {
  constructor() {
    this.loadedChunks = new Map();
    this.performanceMetrics = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Safe property assignment that handles getter-only properties
   */
  safeAssign(obj, prop, value) {
    if (obj == null) {
      return obj;
    }

    try {
      // Check if property has getter but no setter
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

      if (descriptor && descriptor.get && !descriptor.set) {
        console.log(`🔧 Property ${prop} has getter but no setter, creating new object`);

        // Create a new object with the desired property
        const newObj = Object.create(Object.getPrototypeOf(obj));

        // Copy existing properties
        Object.getOwnPropertyNames(obj).forEach(key => {
          if (key !== prop) {
            try {
              const keyDescriptor = Object.getOwnPropertyDescriptor(obj, key);
              if (keyDescriptor) {
                if (keyDescriptor.get && !keyDescriptor.set) {
                  // For getter-only properties, try to get the value and make it writable
                  try {
                    const value = keyDescriptor.get.call(obj);
                    Object.defineProperty(newObj, key, {
                      configurable: true,
                      enumerable: keyDescriptor.enumerable,
                      writable: true,
                      value
                    });
                  } catch (getterError) {
                    // If getter throws, create a placeholder
                    Object.defineProperty(newObj, key, {
                      configurable: true,
                      enumerable: keyDescriptor.enumerable,
                      writable: true,
                      value: undefined
                    });
                  }
                } else {
                  Object.defineProperty(newObj, key, keyDescriptor);
                }
              }
            } catch (e) {
              // Skip properties that can't be copied
              console.warn(`Could not copy property ${key}:`, e);
            }
          }
        });

        // Add our property
        try {
          Object.defineProperty(newObj, prop, {
            configurable: true,
            enumerable: true,
            writable: true,
            value
          });
        } catch (e) {
          newObj[prop] = value;
        }

        return newObj;
      } else {
        // Normal assignment
        obj[prop] = value;
        return obj;
      }
    } catch (e) {
      console.warn(`Failed to assign property ${prop}, creating new object:`, e);
      // Create a completely new object as last resort
      try {
        const newObj = { ...obj };
        newObj[prop] = value;
        return newObj;
      } catch (e2) {
        // If even spread operator fails, create minimal object
        const newObj = {};
        newObj[prop] = value;
        return newObj;
      }
    }
  }

  /**
   * Load a chunk safely with performance monitoring
   */
  async loadChunk(chunkId, importFn, framework = 'unknown') {
    const startTime = performance.now();
    const timingId = `${framework}-${chunkId}-${Date.now()}`;

    try {
      // Check if already loaded
      if (this.loadedChunks.has(chunkId)) {
        console.log(`✅ Chunk ${chunkId} already loaded from cache`);
        return this.loadedChunks.get(chunkId);
      }

      console.log(`🚀 Loading chunk: ${chunkId} (${framework})`);

      // Load the module
      const module = await importFn();

      // Apply safe property assignment for chunk metadata
      const processedModule = this.safeAssign(module, 'chunkMetadata', {
        id: chunkId,
        framework,
        loaded: true,
        timestamp: Date.now(),
        loader: 'SafeChunkLoader'
      });

      // Cache the loaded chunk
      this.loadedChunks.set(chunkId, processedModule);

      // Record performance metrics
      const loadTime = performance.now() - startTime;
      this.recordPerformance(chunkId, framework, {
        loadTime,
        success: true,
        timestamp: Date.now(),
        timingId
      });

      console.log(`✅ Successfully loaded chunk: ${chunkId} in ${loadTime.toFixed(2)}ms`);
      return processedModule;

    } catch (error) {
      const loadTime = performance.now() - startTime;
      console.error(`❌ Failed to load chunk ${chunkId}:`, error);

      // Record failed attempt
      this.recordPerformance(chunkId, framework, {
        loadTime,
        success: false,
        error: error.message,
        timestamp: Date.now(),
        timingId
      });

      // Attempt retry if not exceeded max attempts
      const retryCount = this.retryAttempts.get(chunkId) || 0;
      if (retryCount < this.maxRetries) {
        console.log(`🔄 Retrying chunk ${chunkId} (attempt ${retryCount + 1}/${this.maxRetries})`);
        this.retryAttempts.set(chunkId, retryCount + 1);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));

        return this.loadChunk(chunkId, importFn, framework);
      }

      // Max retries exceeded, throw error
      throw new Error(`Chunk loading failed after ${this.maxRetries} attempts: ${error.message}`);
    }
  }

  /**
   * Record performance metrics
   */
  recordPerformance(chunkId, framework, metrics) {
    const key = `${framework}-${chunkId}`;
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }
    this.performanceMetrics.get(key).push(metrics);
  }

  /**
   * Get performance metrics for a chunk
   */
  getPerformanceMetrics(chunkId, framework) {
    const key = `${framework}-${chunkId}`;
    return this.performanceMetrics.get(key) || [];
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics() {
    const allMetrics = {};
    for (const [key, metrics] of this.performanceMetrics) {
      allMetrics[key] = metrics;
    }
    return allMetrics;
  }

  /**
   * Get framework comparison data
   */
  getFrameworkComparison() {
    const comparison = {};

    for (const [key, metrics] of this.performanceMetrics) {
      const [framework, chunkId] = key.split('-');

      if (!comparison[framework]) {
        comparison[framework] = {
          totalChunks: 0,
          successfulLoads: 0,
          failedLoads: 0,
          averageLoadTime: 0,
          totalLoadTime: 0
        };
      }

      const frameworkData = comparison[framework];
      frameworkData.totalChunks += metrics.length;

      metrics.forEach(metric => {
        if (metric.success) {
          frameworkData.successfulLoads++;
        } else {
          frameworkData.failedLoads++;
        }
        frameworkData.totalLoadTime += metric.loadTime;
      });

      frameworkData.averageLoadTime = frameworkData.totalLoadTime / frameworkData.totalChunks;
    }

    return comparison;
  }

  /**
   * Clear cache and metrics
   */
  clearCache() {
    this.loadedChunks.clear();
    this.performanceMetrics.clear();
    this.retryAttempts.clear();
    console.log('🧹 Cache and metrics cleared');
  }

  /**
   * Preload chunks for better performance
   */
  async preloadChunks(chunks) {
    const preloadPromises = chunks.map(({ chunkId, importFn, framework }) =>
      this.loadChunk(chunkId, importFn, framework).catch(error => {
        console.warn(`Preload failed for ${chunkId}:`, error);
        return null;
      })
    );

    const results = await Promise.allSettled(preloadPromises);
    const successful = results.filter(result => result.status === 'fulfilled' && result.value !== null);

    console.log(`📦 Preloaded ${successful.length}/${chunks.length} chunks`);
    return successful.map(result => result.value);
  }
}

// Create global instance
const globalChunkLoader = new SafeChunkLoader();

// Export both class and instance
export { SafeChunkLoader, globalChunkLoader };
export default globalChunkLoader;