/**
 * Network Adaptation Example
 * Demonstrates how to use network condition adaptation and reliability features
 */

import { 
  NetworkAdaptationCoordinator,
  NetworkConditionMonitor,
  BandwidthAwarePreloader,
  IntermittentConnectivityHandler
} from '../network-adaptation/index.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

/**
 * Example 1: Basic Network Adaptation Setup
 */
export function basicNetworkAdaptationExample() {
  console.log('=== Basic Network Adaptation Example ===');

  // Create coordinator with default configuration
  const coordinator = new NetworkAdaptationCoordinator();

  // Get loading recommendation for a framework
  const recommendation = coordinator.getLoadingRecommendation(
    FrameworkType.REACT,
    LoadPriority.HIGH,
    { viewport: true, interaction: false }
  );

  console.log('Loading Recommendation:', {
    framework: FrameworkType.REACT,
    shouldPreload: recommendation.shouldPreload,
    cacheFirst: recommendation.cacheFirst,
    timeoutMs: recommendation.timeoutMs,
    maxRetries: recommendation.maxRetries,
    reason: recommendation.reason
  });

  // Request preloading for likely-needed frameworks
  coordinator.requestPreload(
    FrameworkType.VUE,
    LoadPriority.LOW,
    'viewport',
    0.8, // High confidence
    150000 // Estimated 150KB
  );

  // Get current metrics
  const metrics = coordinator.getMetrics();
  console.log('Network Metrics:', {
    networkQuality: metrics.networkQuality?.score,
    isOnline: metrics.connectivityState.isOnline,
    isStable: metrics.connectivityState.isStable,
    preloadQueue: metrics.preloadingStats.queued,
    cacheHitRate: metrics.cacheStats.hitRate
  });

  // Cleanup
  setTimeout(() => {
    coordinator.destroy();
  }, 5000);
}

/**
 * Example 2: Advanced Configuration
 */
export function advancedNetworkAdaptationExample() {
  console.log('=== Advanced Network Adaptation Example ===');

  // Create coordinator with custom configuration
  const coordinator = new NetworkAdaptationCoordinator({
    monitoring: {
      enabled: true,
      assessmentInterval: 15000, // Check every 15 seconds
      historyRetention: 1800000   // Keep 30 minutes of history
    },
    preloading: {
      enabled: true,
      maxConcurrentPreloads: 3,
      bandwidthThreshold: 2,      // Require 2 Mbps for preloading
      qualityThreshold: 0.6,      // Require 60% quality score
      priorityWeights: {
        [LoadPriority.CRITICAL]: 5,
        [LoadPriority.HIGH]: 4,
        [LoadPriority.NORMAL]: 2,
        [LoadPriority.LOW]: 1
      }
    },
    connectivity: {
      cacheFirst: false,
      maxCacheAge: 3600000,       // 1 hour cache
      maxCacheSize: 100 * 1024 * 1024, // 100 MB cache
      backgroundSync: true
    },
    adaptation: {
      aggressiveness: 'aggressive',
      priorityBoosting: true,
      dynamicTimeouts: true
    }
  });

  // Add metrics listener for monitoring
  coordinator.addMetricsListener((metrics) => {
    console.log('Network Adaptation Update:', {
      timestamp: new Date().toISOString(),
      networkScore: metrics.networkQuality?.score,
      stability: metrics.networkQuality?.stability,
      preloadingActive: metrics.preloadingStats.active,
      cacheSize: Math.round(metrics.cacheStats.size / 1024) + ' KB'
    });
  });

  // Simulate different loading scenarios
  const scenarios = [
    { framework: FrameworkType.REACT, priority: LoadPriority.CRITICAL, context: { viewport: true } },
    { framework: FrameworkType.VUE, priority: LoadPriority.HIGH, context: { interaction: true } },
    { framework: FrameworkType.SVELTE, priority: LoadPriority.NORMAL, context: { navigation: true } },
    { framework: FrameworkType.SOLID, priority: LoadPriority.LOW, context: {} }
  ];

  scenarios.forEach((scenario, index) => {
    setTimeout(() => {
      const rec = coordinator.getLoadingRecommendation(
        scenario.framework,
        scenario.priority,
        scenario.context
      );

      console.log(`Scenario ${index + 1} - ${scenario.framework}:`, {
        priority: scenario.priority,
        recommendation: rec.reason,
        shouldPreload: rec.shouldPreload,
        timeout: rec.timeoutMs + 'ms'
      });

      // Request preload if recommended
      if (rec.shouldPreload) {
        coordinator.requestPreload(
          scenario.framework,
          scenario.priority,
          'pattern',
          0.6,
          100000
        );
      }
    }, index * 1000);
  });

  // Cleanup after demo
  setTimeout(() => {
    coordinator.destroy();
  }, 10000);
}

/**
 * Example 3: Individual Component Usage
 */
export function individualComponentExample() {
  console.log('=== Individual Component Example ===');

  // 1. Network Condition Monitor
  const monitor = new NetworkConditionMonitor();
  
  monitor.addListener((event) => {
    console.log('Network Event:', {
      type: event.type,
      effectiveType: event.conditions.effectiveType,
      downlink: event.conditions.downlink + ' Mbps',
      rtt: event.conditions.rtt + 'ms',
      qualityScore: event.metrics.score
    });
  });

  // 2. Bandwidth-Aware Preloader
  const preloader = new BandwidthAwarePreloader(monitor, {
    enabled: true,
    maxConcurrentPreloads: 2,
    bandwidthThreshold: 1,
    qualityThreshold: 0.5
  });

  preloader.addListener((request, success) => {
    console.log('Preload Event:', {
      framework: request.framework,
      success,
      reason: request.reason,
      confidence: request.confidence
    });
  });

  // Request some preloads
  preloader.requestPreload({
    framework: FrameworkType.REACT,
    priority: LoadPriority.LOW,
    estimatedSize: 120000,
    reason: 'viewport',
    confidence: 0.9
  });

  preloader.requestPreload({
    framework: FrameworkType.VUE,
    priority: LoadPriority.NORMAL,
    estimatedSize: 180000,
    reason: 'interaction',
    confidence: 0.7
  });

  // 3. Intermittent Connectivity Handler
  const connectivityHandler = new IntermittentConnectivityHandler(monitor, {
    cacheFirst: false,
    maxCacheAge: 86400000, // 24 hours
    maxCacheSize: 50 * 1024 * 1024, // 50 MB
    backgroundSync: true
  });

  connectivityHandler.addListener((state) => {
    console.log('Connectivity State:', {
      isOnline: state.isOnline,
      isStable: state.isStable,
      qualityScore: state.qualityScore,
      offlineDuration: state.offlineDuration + 'ms'
    });
  });

  // Simulate framework loading
  connectivityHandler.loadFramework(FrameworkType.SVELTE, LoadPriority.HIGH, 8000)
    .then((core) => {
      console.log('Framework Loaded:', {
        name: core.name,
        version: core.version,
        size: core.size + ' bytes'
      });
    })
    .catch((error) => {
      console.log('Framework Load Failed:', error.message);
    });

  // Show statistics periodically
  const statsInterval = setInterval(() => {
    const preloadStats = preloader.getBandwidthStats();
    const cacheStats = connectivityHandler.getCacheStats();
    
    console.log('Statistics Update:', {
      bandwidthUtilization: Math.round(preloadStats.utilization * 100) + '%',
      preloadEfficiency: Math.round(preloadStats.efficiency * 100) + '%',
      cacheSize: Math.round(cacheStats.size / 1024) + ' KB',
      cacheHitRate: Math.round(cacheStats.hitRate * 100) + '%'
    });
  }, 3000);

  // Cleanup after demo
  setTimeout(() => {
    clearInterval(statsInterval);
    preloader.destroy();
    connectivityHandler.destroy();
    monitor.destroy();
  }, 15000);
}

/**
 * Example 4: Handling Poor Network Conditions
 */
export function poorNetworkExample() {
  console.log('=== Poor Network Conditions Example ===');

  const coordinator = new NetworkAdaptationCoordinator({
    adaptation: {
      aggressiveness: 'conservative',
      priorityBoosting: true,
      dynamicTimeouts: true
    }
  });

  // Simulate poor network conditions
  const monitor = new NetworkConditionMonitor();
  monitor.updateNetworkConditions({
    effectiveType: '2g',
    downlink: 0.5,
    rtt: 2000,
    saveData: true
  });

  // Get recommendations for poor network
  const frameworks = [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE];
  
  frameworks.forEach((framework) => {
    const rec = coordinator.getLoadingRecommendation(framework, LoadPriority.NORMAL);
    
    console.log(`Poor Network - ${framework}:`, {
      cacheFirst: rec.cacheFirst,
      shouldPreload: rec.shouldPreload,
      timeoutMs: rec.timeoutMs,
      maxRetries: rec.maxRetries,
      reason: rec.reason
    });
  });

  // Cleanup
  setTimeout(() => {
    coordinator.destroy();
    monitor.destroy();
  }, 3000);
}

/**
 * Example 5: Offline Handling
 */
export function offlineHandlingExample() {
  console.log('=== Offline Handling Example ===');

  const coordinator = new NetworkAdaptationCoordinator();

  // Simulate going offline
  const monitor = new NetworkConditionMonitor();
  
  // Add listener for offline events
  coordinator.addMetricsListener((metrics) => {
    if (!metrics.connectivityState.isOnline) {
      console.log('Offline Mode Activated:', {
        cacheSize: metrics.cacheStats.size,
        cachedFrameworks: metrics.cacheStats.count,
        lastOnline: new Date(metrics.connectivityState.lastOnlineTime).toISOString()
      });
    }
  });

  // Pre-cache some frameworks
  const mockFrameworks = [
    {
      name: FrameworkType.REACT,
      version: '18.0.0',
      bundle: new ArrayBuffer(150000),
      dependencies: [],
      size: 150000,
      checksum: 'react-checksum',
      timestamp: Date.now()
    },
    {
      name: FrameworkType.VUE,
      version: '3.0.0',
      bundle: new ArrayBuffer(120000),
      dependencies: [],
      size: 120000,
      checksum: 'vue-checksum',
      timestamp: Date.now()
    }
  ];

  // This would normally be done through actual loading
  console.log('Pre-caching frameworks for offline use...');

  // Simulate offline condition
  setTimeout(() => {
    console.log('Simulating offline condition...');
    
    // Get recommendations while offline
    const offlineRec = coordinator.getLoadingRecommendation(FrameworkType.REACT);
    console.log('Offline Recommendation:', {
      cacheFirst: offlineRec.cacheFirst,
      shouldPreload: offlineRec.shouldPreload,
      reason: offlineRec.reason
    });
  }, 2000);

  // Cleanup
  setTimeout(() => {
    coordinator.destroy();
    monitor.destroy();
  }, 5000);
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running Network Adaptation Examples...\n');
  
  basicNetworkAdaptationExample();
  
  setTimeout(() => {
    advancedNetworkAdaptationExample();
  }, 6000);
  
  setTimeout(() => {
    individualComponentExample();
  }, 17000);
  
  setTimeout(() => {
    poorNetworkExample();
  }, 33000);
  
  setTimeout(() => {
    offlineHandlingExample();
  }, 37000);
}