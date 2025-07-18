/**
 * Progressive Enhancement Example
 * 
 * Demonstrates how to use the comprehensive progressive enhancement system
 * with service worker fallbacks, offline functionality, and error recovery.
 */

import {
  createProgressiveEnhancementSystem,
  ProgressiveEnhancementCoordinator,
  OfflineFunctionalityManager,
  ComprehensiveErrorRecovery
} from '../progressive-enhancement/index.js';
import { FrameworkType, FallbackStrategy } from '../types/ssr-optimization.js';

/**
 * Basic Progressive Enhancement Setup
 */
export async function basicProgressiveEnhancementExample() {
  console.log('🛡️ Basic Progressive Enhancement Example');
  
  // Create the complete system with default configuration
  const system = createProgressiveEnhancementSystem();
  
  try {
    // Initialize the system
    await system.initialize();
    console.log('✅ Progressive enhancement system initialized');
    
    // Get initial metrics
    const metrics = system.getMetrics();
    console.log('📊 Initial metrics:', {
      coordinator: metrics.coordinator,
      offline: metrics.offline,
      errorRecovery: metrics.errorRecovery
    });
    
    // Simulate a framework loading failure
    const framework: FrameworkType = 'reactjs';
    const error = new Error('Framework loading failed');
    
    const recovered = await system.coordinator.handleFrameworkLoadFailure(framework, error);
    console.log(`🔄 Framework recovery ${recovered ? 'succeeded' : 'failed'}`);
    
    // Check updated metrics
    const updatedMetrics = system.getMetrics();
    console.log('📊 Updated metrics:', {
      frameworkFailures: updatedMetrics.coordinator.frameworkLoadFailures,
      recoveries: updatedMetrics.coordinator.successfulRecoveries
    });
    
  } catch (error) {
    console.error('❌ Basic example failed:', error);
  } finally {
    system.cleanup();
  }
}

/**
 * Advanced Configuration Example
 */
export async function advancedConfigurationExample() {
  console.log('⚙️ Advanced Configuration Example');
  
  // Create system with custom configuration
  const system = createProgressiveEnhancementSystem({
    coordinator: {
      serviceWorker: {
        enabled: true,
        fallbackTimeout: 3000,
        maxRetryAttempts: 2
      },
      directLoading: {
        enabled: true,
        cdnFallback: true,
        localFallback: true,
        timeout: 8000
      },
      offline: {
        enabled: true,
        cacheStrategy: 'aggressive',
        maxCacheAge: 12 * 60 * 60 * 1000, // 12 hours
        enableBackgroundSync: true
      },
      errorRecovery: {
        enabled: true,
        maxRetryAttempts: 2,
        retryDelay: 500,
        fallbackStrategy: FallbackStrategy.CACHED_VERSION
      },
      monitoring: {
        enabled: true,
        reportFailures: true,
        logLevel: 'debug'
      }
    },
    offline: {
      cache: {
        strategy: 'cache-first',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 100 * 1024 * 1024, // 100MB
        enableCompression: true
      },
      frameworks: {
        preloadCritical: true,
        cacheAllVersions: false,
        enableDeltaUpdates: true,
        compressionLevel: 9
      }
    }
  });
  
  try {
    await system.initialize();
    console.log('✅ Advanced system initialized with custom config');
    
    // Test offline functionality
    await demonstrateOfflineFunctionality(system.offlineManager);
    
    // Test error recovery
    await demonstrateErrorRecovery(system.errorRecovery);
    
  } catch (error) {
    console.error('❌ Advanced example failed:', error);
  } finally {
    system.cleanup();
  }
}

/**
 * Offline Functionality Demonstration
 */
async function demonstrateOfflineFunctionality(offlineManager: OfflineFunctionalityManager) {
  console.log('📱 Demonstrating Offline Functionality');
  
  try {
    // Cache some frameworks
    const frameworks: FrameworkType[] = ['reactjs', 'vue', 'solid'];
    
    for (const framework of frameworks) {
      // Simulate framework content
      const content = new TextEncoder().encode(`// ${framework} framework code`);
      const arrayBuffer = content.buffer;
      
      await offlineManager.cacheFramework(framework, 'latest', arrayBuffer, {
        isCore: true,
        dependencies: []
      });
      
      console.log(`📦 Cached ${framework} framework`);
    }
    
    // Get cache statistics
    const cacheStats = offlineManager.getCacheStats();
    console.log('📊 Cache statistics:', {
      totalSize: Math.floor(cacheStats.totalSize / 1024) + 'KB',
      entryCount: cacheStats.entryCount,
      hitRate: (cacheStats.hitRate * 100).toFixed(1) + '%',
      frameworks: cacheStats.frameworks.map(f => `${f.name}@${f.version}`)
    });
    
    // Test offline loading
    for (const framework of frameworks) {
      const content = await offlineManager.loadFrameworkOffline(framework);
      if (content) {
        console.log(`✅ Successfully loaded ${framework} offline`);
      } else {
        console.log(`❌ Failed to load ${framework} offline`);
      }
    }
    
    // Get offline metrics
    const metrics = offlineManager.getMetrics();
    console.log('📊 Offline metrics:', {
      cacheHitRate: (metrics.cacheHitRate / (metrics.cacheHitRate + metrics.cacheMissRate) * 100).toFixed(1) + '%',
      frameworksServedOffline: Array.from(metrics.frameworksServedOffline.entries()),
      averageLoadTime: metrics.averageOfflineLoadTime.toFixed(0) + 'ms'
    });
    
  } catch (error) {
    console.error('❌ Offline functionality demo failed:', error);
  }
}

/**
 * Error Recovery Demonstration
 */
async function demonstrateErrorRecovery(errorRecovery: ComprehensiveErrorRecovery) {
  console.log('🔧 Demonstrating Error Recovery');
  
  try {
    // Test different types of errors
    const errors = [
      new Error('Service worker registration failed'),
      new Error('Failed to load framework chunk'),
      new Error('Hydration failed for component'),
      new Error('Network request timeout'),
      new Error('Cache storage quota exceeded')
    ];
    
    for (const error of errors) {
      console.log(`🔍 Testing recovery for: ${error.message}`);
      
      // Check if error is recoverable
      const recoverable = errorRecovery.isRecoverable(error);
      console.log(`  Recoverable: ${recoverable}`);
      
      // Get suggested strategies
      const strategies = errorRecovery.getSuggestedStrategies(error);
      console.log(`  Suggested strategies: ${strategies.join(', ')}`);
      
      // Attempt recovery
      const result = await errorRecovery.recoverFromError(error, {
        framework: 'reactjs',
        component: 'test-component'
      });
      
      console.log(`  Recovery result:`, {
        success: result.success,
        strategy: result.strategy,
        duration: result.duration + 'ms',
        fallbackApplied: result.fallbackApplied
      });
    }
    
    // Get recovery metrics
    const metrics = errorRecovery.getMetrics();
    console.log('📊 Recovery metrics:', {
      totalErrors: metrics.totalErrors,
      recoveredErrors: metrics.recoveredErrors,
      successRate: (metrics.recoverySuccessRate * 100).toFixed(1) + '%',
      averageRecoveryTime: metrics.averageRecoveryTime.toFixed(0) + 'ms',
      strategiesUsed: Array.from(metrics.strategiesUsed.entries())
    });
    
  } catch (error) {
    console.error('❌ Error recovery demo failed:', error);
  }
}

/**
 * Real-world Scenario Simulation
 */
export async function realWorldScenarioExample() {
  console.log('🌍 Real-world Scenario Example');
  
  const system = createProgressiveEnhancementSystem({
    coordinator: {
      monitoring: { logLevel: 'info' }
    }
  });
  
  try {
    await system.initialize();
    
    // Scenario 1: Service worker fails to register
    console.log('📋 Scenario 1: Service worker registration failure');
    await simulateServiceWorkerFailure(system.coordinator);
    
    // Scenario 2: Network goes offline during framework loading
    console.log('📋 Scenario 2: Network offline during framework loading');
    await simulateOfflineFrameworkLoading(system);
    
    // Scenario 3: Cache corruption and recovery
    console.log('📋 Scenario 3: Cache corruption and recovery');
    await simulateCacheCorruption(system);
    
    // Scenario 4: Multiple simultaneous failures
    console.log('📋 Scenario 4: Multiple simultaneous failures');
    await simulateMultipleFailures(system);
    
    // Final metrics
    const finalMetrics = system.getMetrics();
    console.log('📊 Final system metrics:', {
      totalFailures: finalMetrics.coordinator.serviceWorkerFailures + 
                    finalMetrics.coordinator.networkFailures +
                    finalMetrics.coordinator.hydrationFailures,
      totalRecoveries: finalMetrics.coordinator.successfulRecoveries,
      offlineActivations: finalMetrics.coordinator.offlineActivations,
      cacheUtilization: finalMetrics.offline.cacheHitRate
    });
    
  } catch (error) {
    console.error('❌ Real-world scenario failed:', error);
  } finally {
    system.cleanup();
  }
}

/**
 * Simulate service worker failure
 */
async function simulateServiceWorkerFailure(coordinator: ProgressiveEnhancementCoordinator) {
  // Simulate service worker registration failure
  coordinator['handleServiceWorkerFailure']('Registration failed');
  
  // Check that fallback mode is activated
  if (typeof window !== 'undefined' && window.__METAMON_SW_FALLBACK) {
    console.log('✅ Service worker fallback activated successfully');
  }
}

/**
 * Simulate offline framework loading
 */
async function simulateOfflineFrameworkLoading(system: any) {
  // First cache a framework
  const framework: FrameworkType = 'vue';
  const content = new TextEncoder().encode('// Vue framework code');
  
  await system.offlineManager.cacheFramework(framework, 'latest', content.buffer);
  
  // Simulate going offline
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: false
  });
  
  // Try to load framework offline
  const offlineContent = await system.offlineManager.loadFrameworkOffline(framework);
  
  if (offlineContent) {
    console.log('✅ Framework loaded successfully in offline mode');
  } else {
    console.log('❌ Failed to load framework in offline mode');
  }
  
  // Restore online status
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true
  });
}

/**
 * Simulate cache corruption
 */
async function simulateCacheCorruption(system: any) {
  // Cache some data first
  const framework: FrameworkType = 'solid';
  const content = new TextEncoder().encode('// Solid framework code');
  
  await system.offlineManager.cacheFramework(framework, 'latest', content.buffer);
  
  // Simulate cache corruption by clearing it
  await system.offlineManager.clearCache();
  
  // Try to recover
  const error = new Error('Cache storage quota exceeded');
  const result = await system.errorRecovery.recoverFromError(error);
  
  if (result.success) {
    console.log('✅ Cache corruption recovered successfully');
  } else {
    console.log('❌ Failed to recover from cache corruption');
  }
}

/**
 * Simulate multiple simultaneous failures
 */
async function simulateMultipleFailures(system: any) {
  const failures = [
    system.coordinator.handleFrameworkLoadFailure('reactjs', new Error('Load failed')),
    system.coordinator.handleFrameworkLoadFailure('vue', new Error('Network error')),
    system.coordinator.handleNetworkFailure(new Error('Connection timeout'))
  ];
  
  const results = await Promise.allSettled(failures);
  const successful = results.filter(r => r.status === 'fulfilled').length;
  
  console.log(`✅ Handled ${successful}/${results.length} simultaneous failures`);
}

/**
 * Performance Impact Analysis
 */
export async function performanceImpactExample() {
  console.log('⚡ Performance Impact Analysis');
  
  const system = createProgressiveEnhancementSystem();
  
  try {
    const startTime = Date.now();
    await system.initialize();
    const initTime = Date.now() - startTime;
    
    console.log(`⏱️ System initialization: ${initTime}ms`);
    
    // Measure framework loading performance
    const frameworks: FrameworkType[] = ['reactjs', 'vue', 'solid', 'svelte'];
    const loadTimes: Record<string, number> = {};
    
    for (const framework of frameworks) {
      const loadStart = Date.now();
      
      // Simulate framework loading with potential failure and recovery
      try {
        const error = new Error(`Simulated load failure for ${framework}`);
        await system.coordinator.handleFrameworkLoadFailure(framework, error);
      } catch (e) {
        // Expected for simulation
      }
      
      loadTimes[framework] = Date.now() - loadStart;
    }
    
    console.log('⏱️ Framework loading times (with recovery):', loadTimes);
    
    // Measure memory usage (approximate)
    const metrics = system.getMetrics();
    console.log('💾 Memory impact (approximate):', {
      cachedFrameworks: metrics.offline.frameworksServedOffline.size,
      activeFailures: system.coordinator.getActiveFailures().length,
      averageRecoveryTime: metrics.errorRecovery.averageRecoveryTime
    });
    
  } catch (error) {
    console.error('❌ Performance analysis failed:', error);
  } finally {
    system.cleanup();
  }
}

/**
 * Run all examples
 */
export async function runAllProgressiveEnhancementExamples() {
  console.log('🚀 Running All Progressive Enhancement Examples\n');
  
  try {
    await basicProgressiveEnhancementExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await advancedConfigurationExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await realWorldScenarioExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await performanceImpactExample();
    
    console.log('\n✅ All progressive enhancement examples completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Progressive enhancement examples failed:', error);
  }
}

// Export individual functions for selective testing
export {
  demonstrateOfflineFunctionality,
  demonstrateErrorRecovery,
  simulateServiceWorkerFailure,
  simulateOfflineFrameworkLoading,
  simulateCacheCorruption,
  simulateMultipleFailures
};

// Auto-run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllProgressiveEnhancementExamples().catch(console.error);
}