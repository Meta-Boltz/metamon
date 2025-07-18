/**
 * Performance Monitoring Example
 * Demonstrates how to use the comprehensive performance monitoring system
 */

import {
  createPerformanceMonitoringSuite,
  createDefaultConfig,
  PerformanceMonitoringSuite
} from '../performance-monitoring/index.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

/**
 * Example: Basic Performance Monitoring Setup
 */
export function basicPerformanceMonitoringExample(): void {
  console.log('=== Basic Performance Monitoring Example ===');

  // Create monitoring suite with default configuration
  const suite = createPerformanceMonitoringSuite();

  // Start monitoring
  suite.start();

  // Set up alert handling
  suite.onAlert((alert) => {
    console.warn(`Performance Alert [${alert.severity}]:`, alert.message);
    console.log('Suggestions:', alert.suggestions);
  });

  // Simulate framework loading
  const reactSession = suite.trackFrameworkLoad(FrameworkType.REACT, LoadPriority.CRITICAL);
  
  // Simulate some loading time
  setTimeout(() => {
    suite.completeFrameworkLoad(reactSession);
    
    // Get current metrics
    const metrics = suite.getMetrics();
    console.log('Current Web Vitals:', metrics.webVitals);
    console.log('Framework Loading Count:', metrics.frameworkLoading.length);
    
    // Generate report
    const report = suite.generateReport();
    console.log('Performance Report:', {
      totalLoads: report.summary.totalPageLoads,
      averageLoadTime: report.summary.averageLoadTime,
      webVitalsScore: report.summary.webVitalsScore
    });
    
    suite.dispose();
  }, 100);
}

/**
 * Example: Advanced Performance Monitoring with Custom Configuration
 */
export function advancedPerformanceMonitoringExample(): void {
  console.log('=== Advanced Performance Monitoring Example ===');

  // Create custom configuration
  const customConfig = createDefaultConfig();
  customConfig.performanceBudget.maxFrameworkLoadTime = 50; // Strict 50ms budget
  customConfig.performanceBudget.maxLCP = 2000; // Strict 2s LCP budget
  customConfig.enableDebugMode = true;
  customConfig.sampleRate = 1.0; // Collect all data

  const suite = new PerformanceMonitoringSuite(customConfig);
  suite.start();

  // Set up comprehensive alert handling
  suite.onAlert((alert) => {
    console.log(`🚨 ${alert.type.toUpperCase()} Alert:`, {
      severity: alert.severity,
      metric: alert.metric,
      current: alert.currentValue,
      threshold: alert.threshold,
      message: alert.message
    });

    // Log suggestions for high-severity alerts
    if (alert.severity === 'high' || alert.severity === 'critical') {
      console.log('🔧 Optimization Suggestions:');
      alert.suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion}`);
      });
    }
  });

  // Simulate multiple framework loading scenarios
  simulateFrameworkLoadingScenarios(suite);

  // Simulate cache operations
  simulateCacheOperations(suite);

  // Generate comprehensive analysis after some time
  setTimeout(() => {
    generateComprehensiveAnalysis(suite);
    suite.dispose();
  }, 2000);
}

/**
 * Example: Real-time Performance Dashboard
 */
export function performanceDashboardExample(): void {
  console.log('=== Performance Dashboard Example ===');

  const suite = createPerformanceMonitoringSuite({
    enableDebugMode: true,
    reportingInterval: 5000 // Report every 5 seconds
  });

  suite.start();

  // Simulate real-time dashboard updates
  const dashboardInterval = setInterval(() => {
    const vizData = suite.getVisualizationData();
    const alerts = suite.getActiveAlerts();
    const webVitals = suite.getWebVitals();

    console.log('\n📊 Performance Dashboard Update:');
    console.log('Web Vitals:', {
      LCP: `${webVitals.lcp.toFixed(0)}ms`,
      FID: `${webVitals.fid.toFixed(0)}ms`,
      CLS: webVitals.cls.toFixed(3),
      FCP: `${webVitals.fcp.toFixed(0)}ms`,
      TTFB: `${webVitals.ttfb.toFixed(0)}ms`
    });

    console.log('Active Alerts:', alerts.length);
    console.log('Timeline Entries:', vizData.timeline.length);

    // Show framework loading performance
    const frameworkStats = suite.getFrameworkStats();
    console.log('Framework Performance:', {
      totalLoads: frameworkStats.totalLoads,
      averageLoadTime: `${frameworkStats.averageLoadTime.toFixed(1)}ms`,
      cacheHitRate: `${(frameworkStats.cacheHitRate * 100).toFixed(1)}%`
    });

    // Show cache performance
    const cacheStats = suite.getCacheStats();
    console.log('Cache Performance:', {
      hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
      avgResponseTime: `${cacheStats.averageOperationTime.toFixed(1)}ms`,
      totalOperations: cacheStats.totalOperations
    });
  }, 5000);

  // Simulate ongoing activity
  simulateOngoingActivity(suite);

  // Stop dashboard after 30 seconds
  setTimeout(() => {
    clearInterval(dashboardInterval);
    suite.dispose();
    console.log('\n📊 Dashboard stopped');
  }, 30000);
}

/**
 * Example: Performance Optimization Workflow
 */
export function performanceOptimizationExample(): void {
  console.log('=== Performance Optimization Workflow Example ===');

  const suite = createPerformanceMonitoringSuite();
  suite.start();

  // Step 1: Baseline measurement
  console.log('\n1️⃣ Establishing baseline performance...');
  
  // Simulate initial poor performance
  simulatePoorPerformance(suite);

  setTimeout(() => {
    // Step 2: Identify issues
    console.log('\n2️⃣ Analyzing performance issues...');
    const suggestions = suite.getOptimizationSuggestions();
    
    console.log(`Found ${suggestions.length} optimization opportunities:`);
    suggestions.forEach((suggestion, index) => {
      console.log(`\n${index + 1}. ${suggestion.metric.toUpperCase()} Optimization (${suggestion.priority} priority)`);
      console.log(`   Current: ${suggestion.currentValue.toFixed(1)}`);
      console.log(`   Target: ${suggestion.targetValue.toFixed(1)}`);
      console.log(`   Impact: ${(suggestion.estimatedImpact * 100).toFixed(1)}%`);
      console.log('   Actions:');
      suggestion.suggestions.slice(0, 3).forEach(action => {
        console.log(`   • ${action}`);
      });
    });

    // Step 3: Simulate improvements
    console.log('\n3️⃣ Implementing optimizations...');
    simulateOptimizedPerformance(suite);

    setTimeout(() => {
      // Step 4: Measure improvements
      console.log('\n4️⃣ Measuring improvements...');
      const finalReport = suite.generateReport();
      
      console.log('Optimization Results:', {
        webVitalsScore: finalReport.summary.webVitalsScore,
        averageLoadTime: `${finalReport.summary.averageLoadTime.toFixed(1)}ms`,
        cacheHitRate: `${(finalReport.summary.cacheHitRate * 100).toFixed(1)}%`
      });

      const remainingSuggestions = suite.getOptimizationSuggestions();
      console.log(`Remaining optimization opportunities: ${remainingSuggestions.length}`);

      suite.dispose();
    }, 1000);
  }, 1000);
}

/**
 * Example: Service Worker Debugging
 */
export async function serviceWorkerDebuggingExample(): Promise<void> {
  console.log('=== Service Worker Debugging Example ===');

  const suite = createPerformanceMonitoringSuite({
    enableDebugMode: true,
    collectServiceWorkerMetrics: true
  });

  suite.start();

  try {
    // Get service worker debug information
    const debugInfo = await suite.getServiceWorkerDebugInfo();
    
    console.log('Service Worker State:', debugInfo.serviceWorkerState);
    console.log('Cache Status:', {
      totalSize: `${(debugInfo.cacheStatus.totalSize / 1024 / 1024).toFixed(2)}MB`,
      entryCount: debugInfo.cacheStatus.entryCount,
      hitRate: `${(debugInfo.cacheStatus.hitRate * 100).toFixed(1)}%`
    });

    console.log('Network Conditions:', debugInfo.networkConditions);
    
    if (debugInfo.errors.length > 0) {
      console.log('\n🚨 Recent Errors:');
      debugInfo.errors.slice(0, 5).forEach(error => {
        console.log(`  • ${error.type}: ${error.message}`);
      });
    }

    if (debugInfo.warnings.length > 0) {
      console.log('\n⚠️ Recent Warnings:');
      debugInfo.warnings.slice(0, 5).forEach(warning => {
        console.log(`  • ${warning.type}: ${warning.message}`);
      });
    }

  } catch (error) {
    console.log('Service Worker debugging not available:', error.message);
  }

  suite.dispose();
}

// Helper functions for simulation

function simulateFrameworkLoadingScenarios(suite: PerformanceMonitoringSuite): void {
  const frameworks = [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE, FrameworkType.SOLID];
  const priorities = [LoadPriority.CRITICAL, LoadPriority.HIGH, LoadPriority.NORMAL, LoadPriority.LOW];

  frameworks.forEach((framework, index) => {
    setTimeout(() => {
      const priority = priorities[index % priorities.length];
      const session = suite.trackFrameworkLoad(framework, priority, {
        cacheAttempted: true,
        expectedBundleSize: 30000 + Math.random() * 50000
      });

      // Simulate variable loading times
      const loadTime = 50 + Math.random() * 200;
      setTimeout(() => {
        suite.completeFrameworkLoad(session);
      }, loadTime);
    }, index * 100);
  });
}

function simulateCacheOperations(suite: PerformanceMonitoringSuite): void {
  const operations = [
    { op: 'get', key: 'react-core', hit: false },
    { op: 'put', key: 'react-core' },
    { op: 'get', key: 'react-core', hit: true },
    { op: 'get', key: 'vue-core', hit: false },
    { op: 'put', key: 'vue-core' },
    { op: 'get', key: 'vue-core', hit: true }
  ];

  operations.forEach((operation, index) => {
    setTimeout(() => {
      const opId = suite.trackCacheOperation(operation.op as any, operation.key);
      
      setTimeout(() => {
        suite.completeCacheOperation(opId, {
          success: true,
          hit: operation.hit,
          cacheSize: 1000000 + index * 50000,
          dataSize: 45000
        });
      }, 10 + Math.random() * 50);
    }, index * 50);
  });
}

function simulatePoorPerformance(suite: PerformanceMonitoringSuite): void {
  // Simulate slow framework loading
  const session = suite.trackFrameworkLoad(FrameworkType.REACT, LoadPriority.CRITICAL);
  
  setTimeout(() => {
    suite.completeFrameworkLoad(session);
  }, 300); // Slow loading

  // Simulate cache misses
  const cacheOp = suite.trackCacheOperation('get', 'slow-resource');
  setTimeout(() => {
    suite.completeCacheOperation(cacheOp, {
      success: true,
      hit: false // Cache miss
    });
  }, 150);
}

function simulateOptimizedPerformance(suite: PerformanceMonitoringSuite): void {
  // Simulate fast framework loading
  const session = suite.trackFrameworkLoad(FrameworkType.REACT, LoadPriority.CRITICAL);
  
  setTimeout(() => {
    suite.completeFrameworkLoad(session);
  }, 30); // Fast loading

  // Simulate cache hits
  const cacheOp = suite.trackCacheOperation('get', 'optimized-resource');
  setTimeout(() => {
    suite.completeCacheOperation(cacheOp, {
      success: true,
      hit: true // Cache hit
    });
  }, 5);
}

function simulateOngoingActivity(suite: PerformanceMonitoringSuite): void {
  const activityInterval = setInterval(() => {
    // Random framework loading
    const frameworks = [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE];
    const framework = frameworks[Math.floor(Math.random() * frameworks.length)];
    const session = suite.trackFrameworkLoad(framework);
    
    setTimeout(() => {
      suite.completeFrameworkLoad(session);
    }, 20 + Math.random() * 100);

    // Random cache operations
    const cacheOp = suite.trackCacheOperation('get', `resource-${Math.floor(Math.random() * 10)}`);
    setTimeout(() => {
      suite.completeCacheOperation(cacheOp, {
        success: true,
        hit: Math.random() > 0.3 // 70% hit rate
      });
    }, 5 + Math.random() * 20);
  }, 2000);

  // Stop activity after 25 seconds
  setTimeout(() => {
    clearInterval(activityInterval);
  }, 25000);
}

function generateComprehensiveAnalysis(suite: PerformanceMonitoringSuite): void {
  console.log('\n📈 Comprehensive Performance Analysis:');
  
  // Export all data
  const exportData = suite.exportAllData();
  
  console.log('\n🎯 Key Metrics:');
  console.log('- Web Vitals Score:', exportData.metrics.webVitals);
  console.log('- Framework Loads:', exportData.frameworkStats.totalLoads);
  console.log('- Cache Hit Rate:', `${(exportData.cacheStats.hitRate * 100).toFixed(1)}%`);
  console.log('- Active Alerts:', suite.getActiveAlerts().length);

  console.log('\n📊 Performance Trends:');
  const trends = exportData.webVitals.trends;
  trends.forEach((trend, metric) => {
    console.log(`- ${metric.toUpperCase()}: ${trend.trend} (${(trend.changeRate * 100).toFixed(1)}% change)`);
  });

  console.log('\n🔧 Top Recommendations:');
  const suggestions = exportData.webVitals.suggestions.slice(0, 5);
  suggestions.forEach((suggestion, index) => {
    console.log(`${index + 1}. ${suggestion.metric.toUpperCase()}: ${suggestion.suggestions[0]}`);
  });

  console.log('\n📋 Performance Report Generated');
  const report = suite.generateReport();
  console.log(`Report ID: ${report.id}`);
  console.log(`Metrics Collected: ${report.metrics.length}`);
  console.log(`Recommendations: ${report.recommendations.length}`);
}

// Export example functions for use
export const performanceMonitoringExamples = {
  basic: basicPerformanceMonitoringExample,
  advanced: advancedPerformanceMonitoringExample,
  dashboard: performanceDashboardExample,
  optimization: performanceOptimizationExample,
  serviceWorkerDebugging: serviceWorkerDebuggingExample
};

// Run examples if this file is executed directly
if (typeof window !== 'undefined') {
  console.log('Performance Monitoring Examples Available:');
  console.log('- performanceMonitoringExamples.basic()');
  console.log('- performanceMonitoringExamples.advanced()');
  console.log('- performanceMonitoringExamples.dashboard()');
  console.log('- performanceMonitoringExamples.optimization()');
  console.log('- performanceMonitoringExamples.serviceWorkerDebugging()');
}