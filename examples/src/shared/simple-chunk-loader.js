/**
 * Simple Chunk Loader
 * 
 * A minimal chunk loading implementation that demonstrates the safe assignment fix
 * without the complex error recovery logic that's causing issues.
 */

// Simple safe assignment implementation
function safeAssign(obj, prop, value) {
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

// Simple chunk loader
export class SimpleChunkLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Set();
  }

  async loadChunk(chunkId, importFn) {
    // Check cache first
    if (this.cache.has(chunkId)) {
      console.log(`📋 Using cached chunk: ${chunkId}`);
      return this.cache.get(chunkId);
    }

    // Check if already loading
    if (this.loading.has(chunkId)) {
      console.log(`⏳ Chunk already loading: ${chunkId}`);
      // Wait for the existing load to complete
      while (this.loading.has(chunkId)) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return this.cache.get(chunkId);
    }

    console.log(`🚀 Loading chunk: ${chunkId}`);
    this.loading.add(chunkId);

    try {
      // Load the module
      const module = await importFn();
      console.log(`✅ Chunk loaded: ${chunkId}`, module);

      // Apply safe assignment to add metadata
      let processedModule;
      try {
        processedModule = safeAssign(module, 'chunkData', {
          id: chunkId,
          loaded: true,
          timestamp: Date.now(),
          loader: 'SimpleChunkLoader'
        });

        if (processedModule !== module) {
          console.log(`🔄 Module was replaced due to safe assignment`);
        }
      } catch (assignError) {
        console.warn(`⚠️ Could not add chunk metadata:`, assignError);
        processedModule = module; // Use original module if assignment fails
      }

      // Cache the result
      this.cache.set(chunkId, processedModule);

      return processedModule;

    } catch (error) {
      console.error(`❌ Failed to load chunk ${chunkId}:`, error);
      throw error;
    } finally {
      this.loading.delete(chunkId);
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('🧹 Chunk cache cleared');
  }

  // Get cache stats
  getCacheStats() {
    return {
      cached: this.cache.size,
      loading: this.loading.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Create a global instance
export const simpleChunkLoader = new SimpleChunkLoader();

// Test function to demonstrate the fix
export async function testChunkLoading() {
  console.log('=== Testing Simple Chunk Loader ===');

  // Create a mock module with getter-only property
  const createMockModule = () => {
    const module = {
      default: () => 'Mock Component',
      name: 'MockComponent'
    };

    // Add getter-only property that causes the original error
    Object.defineProperty(module, 'data', {
      get() {
        return this._data || {
          original: true,
          timestamp: Date.now()
        };
      },
      enumerable: true,
      configurable: true
      // No setter - this causes the TypeError
    });

    return module;
  };

  try {
    const result = await simpleChunkLoader.loadChunk('test-chunk', () =>
      Promise.resolve(createMockModule())
    );

    console.log('✅ Chunk loading test passed');
    console.log('Result:', result);
    console.log('Chunk data:', result.chunkData);
    console.log('Original data:', result.data);

    return result;
  } catch (error) {
    console.error('❌ Chunk loading test failed:', error);
    throw error;
  }
}

// Auto-test if this module is loaded directly
if (typeof window !== 'undefined' && !window.simpleChunkLoaderTested) {
  window.simpleChunkLoaderTested = true;
  testChunkLoading().then(() => {
    console.log('🎉 Simple chunk loader test completed successfully');
  }).catch(error => {
    console.error('💥 Simple chunk loader test failed:', error);
  });
}