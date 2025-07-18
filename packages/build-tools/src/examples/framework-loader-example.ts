/**
 * Example usage of Framework Loader Service
 * 
 * This example demonstrates how to use the FrameworkLoaderService
 * for priority-based framework loading with network adaptation.
 */

import { 
  FrameworkLoaderService,
  createFrameworkLoaderService,
  FrameworkType,
  LoadPriority,
  NetworkConditions
} from '../framework-loader/index.js';

/**
 * Basic usage example
 */
async function basicUsageExample() {
  console.log('=== Basic Framework Loader Usage ===');
  
  // Create framework loader service with default configuration
  const loader = createFrameworkLoaderService();
  
  try {
    // Load React framework with normal priority
    console.log('Loading React framework...');
    const reactFramework = await loader.loadFramework(FrameworkType.REACT);
    console.log(`✓ React loaded: ${reactFramework.name}@${reactFramework.version} (${Math.floor(reactFramework.size / 1024)}KB)`);
    
    // Load Vue framework with high priority
    console.log('Loading Vue framework with high priority...');
    const vueFramework = await loader.loadFramework(FrameworkType.VUE, LoadPriority.HIGH);
    console.log(`✓ Vue loaded: ${vueFramework.name}@${vueFramework.version} (${Math.floor(vueFramework.size / 1024)}KB)`);
    
    // Load same framework again (should be cached)
    console.log('Loading React again (should be cached)...');
    const reactCached = await loader.loadFramework(FrameworkType.REACT);
    console.log(`✓ React cached: ${reactCached.name}@${reactCached.version}`);
    
    // Show metrics
    const metrics = loader.getLoadingMetrics();
    console.log(`📊 Metrics: ${metrics.totalRequests} requests, ${metrics.cacheHits} cache hits, ${Math.round(metrics.averageLoadTime)}ms avg load time`);
    
  } finally {
    await loader.shutdown();
  }
}

/**
 * Priority-based loading example
 */
async function priorityLoadingExample() {
  console.log('\n=== Priority-Based Loading Example ===');
  
  const loader = createFrameworkLoaderService({
    loadingStrategy: {
      maxConcurrentLoads: 2, // Limit concurrent loads to demonstrate priority
      timeoutMs: 10000,
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
        slowNetworkThreshold: 2.0,
        adaptiveTimeout: true
      }
    }
  });
  
  try {
    // Start multiple loads with different priorities
    console.log('Starting multiple framework loads with different priorities...');
    
    const promises = [
      loader.loadFramework(FrameworkType.REACT, LoadPriority.LOW).then(() => 
        console.log('✓ React loaded (LOW priority)')),
      loader.loadFramework(FrameworkType.VUE, LoadPriority.CRITICAL).then(() => 
        console.log('✓ Vue loaded (CRITICAL priority)')),
      loader.loadFramework(FrameworkType.SVELTE, LoadPriority.NORMAL).then(() => 
        console.log('✓ Svelte loaded (NORMAL priority)')),
      loader.loadFramework(FrameworkType.SOLID, LoadPriority.HIGH).then(() => 
        console.log('✓ Solid loaded (HIGH priority)'))
    ];
    
    await Promise.all(promises);
    
    // Show queue statistics
    const queueStats = loader.getQueueStats();
    console.log(`📊 Queue stats: ${queueStats.queueSize} queued, ${queueStats.activeLoads} active`);
    
  } finally {
    await loader.shutdown();
  }
}

/**
 * Network adaptation example
 */
async function networkAdaptationExample() {
  console.log('\n=== Network Adaptation Example ===');
  
  const loader = createFrameworkLoaderService({
    enableLogging: true // Enable logging to see adaptation in action
  });
  
  try {
    // Simulate good network conditions
    console.log('Simulating good network conditions (4G)...');
    const goodConditions: NetworkConditions = {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false
    };
    
    loader.adaptToNetworkConditions(goodConditions);
    
    const startTime = performance.now();
    await loader.loadFramework(FrameworkType.REACT);
    const goodNetworkTime = performance.now() - startTime;
    console.log(`✓ React loaded on good network in ${Math.round(goodNetworkTime)}ms`);
    
    // Clear cache to test slow network
    await loader.invalidateFrameworkCache();
    
    // Simulate slow network conditions
    console.log('Simulating slow network conditions (2G)...');
    const slowConditions: NetworkConditions = {
      effectiveType: '2g',
      downlink: 0.5,
      rtt: 800,
      saveData: true
    };
    
    loader.adaptToNetworkConditions(slowConditions);
    
    const slowStartTime = performance.now();
    await loader.loadFramework(FrameworkType.VUE);
    const slowNetworkTime = performance.now() - slowStartTime;
    console.log(`✓ Vue loaded on slow network in ${Math.round(slowNetworkTime)}ms`);
    
    console.log(`📊 Network adaptation: ${Math.round(slowNetworkTime / goodNetworkTime)}x slower on 2G`);
    
  } finally {
    await loader.shutdown();
  }
}

/**
 * Preloading example
 */
async function preloadingExample() {
  console.log('\n=== Preloading Example ===');
  
  const loader = createFrameworkLoaderService();
  
  try {
    // Preload frameworks that might be needed later
    console.log('Preloading frameworks...');
    await Promise.all([
      loader.preloadFramework(FrameworkType.REACT),
      loader.preloadFramework(FrameworkType.VUE),
      loader.preloadFramework(FrameworkType.SVELTE)
    ]);
    
    console.log('✓ Frameworks preloaded');
    
    // Show cached frameworks
    const cached = loader.getCachedFrameworks();
    console.log(`📦 Cached frameworks: ${cached.join(', ')}`);
    
    // Now load a framework (should be instant from cache)
    console.log('Loading React from cache...');
    const startTime = performance.now();
    await loader.loadFramework(FrameworkType.REACT);
    const loadTime = performance.now() - startTime;
    console.log(`✓ React loaded from cache in ${Math.round(loadTime)}ms`);
    
  } finally {
    await loader.shutdown();
  }
}

/**
 * Error handling example
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  const loader = createFrameworkLoaderService({
    loadingStrategy: {
      maxConcurrentLoads: 3,
      timeoutMs: 100, // Very short timeout to demonstrate timeout handling
      retryAttempts: 1,
      retryDelayMs: 500,
      priorityWeights: {
        [LoadPriority.CRITICAL]: 1000,
        [LoadPriority.HIGH]: 100,
        [LoadPriority.NORMAL]: 10,
        [LoadPriority.LOW]: 1
      },
      networkAdaptation: {
        enabled: true,
        slowNetworkThreshold: 2.0,
        adaptiveTimeout: false // Disable adaptive timeout to force timeout
      }
    }
  });
  
  try {
    // Set very slow network to trigger timeout
    loader.adaptToNetworkConditions({
      effectiveType: 'slow-2g',
      downlink: 0.1,
      rtt: 5000,
      saveData: false
    });
    
    console.log('Attempting to load framework with very short timeout...');
    await loader.loadFramework(FrameworkType.REACT);
    console.log('✓ Framework loaded (unexpected)');
    
  } catch (error) {
    console.log(`✓ Timeout handled gracefully: ${error.message}`);
  } finally {
    await loader.shutdown();
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('🚀 Framework Loader Service Examples\n');
  
  try {
    await basicUsageExample();
    await priorityLoadingExample();
    await networkAdaptationExample();
    await preloadingExample();
    await errorHandlingExample();
    
    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for use in other examples
export {
  basicUsageExample,
  priorityLoadingExample,
  networkAdaptationExample,
  preloadingExample,
  errorHandlingExample,
  runExamples
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}