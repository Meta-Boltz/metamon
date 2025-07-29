/**
 * Performance Monitoring System
 * Complete performance monitoring and optimization suite for Ultra-Modern MTM
 */

// Core performance monitoring
export {
  PerformanceMonitor,
  performanceMonitor,
  type BuildTimeMetrics,
  type RouteLoadingMetrics,
  type NavigationMetrics,
  type BundleSizeMetrics,
  type PerformanceWarning,
  type PerformanceReport,
  type PerformanceSummary,
  type PerformanceThresholds,
  type MonitoringConfig
} from './performance-monitor.js';

// Build-time performance tracking
export {
  BuildPerformanceTracker,
  buildPerformanceTracker,
  type BuildPhase,
  type BuildPerformanceStats,
  type FileProcessingMetrics
} from './build-performance-tracker.js';

// Runtime performance tracking
export {
  RuntimePerformanceTracker,
  runtimePerformanceTracker,
  type RouteLoadingPerformance,
  type NavigationPerformance,
  type ClientPerformanceMetrics,
  type PreloadingPerformance
} from './runtime-performance-tracker.js';

// Bundle analysis
export {
  BundleAnalyzer,
  bundleAnalyzer,
  type BundleAnalysis,
  type DependencyInfo,
  type ChunkInfo,
  type DuplicatedModule,
  type UnusedExport,
  type OptimizationOpportunity,
  type BundleComparison,
  type BundleSizeThresholds,
  type BundleAnalyzerConfig
} from './bundle-analyzer.js';

// Vite plugin integration
export {
  createVitePerformancePlugin,
  vitePerformancePlugin,
  vitePerformancePluginDev,
  vitePerformancePluginProd,
  type VitePerformancePluginOptions
} from './vite-performance-plugin.js';

// Performance dashboard
export {
  PerformanceDashboard,
  performanceDashboard,
  type DashboardConfig,
  type DashboardData
} from './performance-dashboard.js';

// CLI tools
export {
  PerformanceCLI
} from './performance-cli.js';

// Route caching
export {
  RouteCache,
  RouteComponentCache,
  RouteDataCache,
  routeComponentCache,
  routeDataCache,
  type CacheEntry,
  type CacheStats,
  type CacheConfig
} from './route-cache.js';

// Intelligent preloading
export {
  IntelligentPreloader,
  intelligentPreloader,
  type UserBehavior,
  type RoutePrediction,
  type PreloadingStrategy,
  type PreloadingConfig
} from './intelligent-preloader.js';

// Component optimization
export {
  ComponentOptimizer,
  componentOptimizer,
  type ComponentMetadata,
  type LoadingMetrics,
  type OptimizerConfig,
  type LoadingStrategy
} from './component-optimizer.js';

// Memory management
export {
  MemoryManager,
  memoryManager,
  type MemoryInfo,
  type MemoryLeak,
  type GCStats,
  type MemoryConfig
} from './memory-manager.js';

// Utility functions
export const createPerformanceMonitor = (config?: Partial<MonitoringConfig>) => {
  return new PerformanceMonitor(config);
};

export const createBuildPerformanceTracker = () => {
  return new BuildPerformanceTracker();
};

export const createRuntimePerformanceTracker = () => {
  return new RuntimePerformanceTracker();
};

export const createBundleAnalyzer = (config?: Partial<BundleAnalyzerConfig>) => {
  return new BundleAnalyzer(config);
};

export const createPerformanceDashboard = (config?: Partial<DashboardConfig>) => {
  return new PerformanceDashboard(config);
};

export const createRouteCache = <T = any>(config?: Partial<CacheConfig>) => {
  return new RouteCache<T>(config);
};

export const createIntelligentPreloader = (config?: Partial<PreloadingConfig>) => {
  return new IntelligentPreloader(config);
};

export const createComponentOptimizer = (config?: Partial<OptimizerConfig>) => {
  return new ComponentOptimizer(config);
};

export const createMemoryManager = (config?: Partial<MemoryConfig>) => {
  return new MemoryManager(config);
};

// Performance monitoring presets
export const performancePresets = {
  development: {
    monitor: {
      enabled: true,
      trackBuildTime: true,
      trackRouteLoading: true,
      trackNavigation: true,
      trackBundleSize: true,
      reportInterval: 30000, // 30 seconds
      thresholds: {
        buildTime: { warning: 3000, critical: 10000 },
        routeLoadTime: { warning: 500, critical: 1500 },
        navigationTime: { warning: 300, critical: 1000 },
        bundleSize: { warning: 100000, critical: 250000 },
        memoryUsage: { warning: 100 * 1024 * 1024, critical: 300 * 1024 * 1024 }
      }
    },
    dashboard: {
      updateInterval: 5000,
      enableRealTimeUpdates: true,
      enableAlerts: true,
      alertThresholds: {
        buildTime: 10000,
        bundleSize: 250000,
        navigationTime: 1000,
        memoryUsage: 300 * 1024 * 1024
      }
    }
  },
  
  production: {
    monitor: {
      enabled: true,
      trackBuildTime: true,
      trackRouteLoading: false, // Disable in production
      trackNavigation: false,   // Disable in production
      trackBundleSize: true,
      reportInterval: 300000, // 5 minutes
      thresholds: {
        buildTime: { warning: 10000, critical: 30000 },
        routeLoadTime: { warning: 1000, critical: 3000 },
        navigationTime: { warning: 500, critical: 1500 },
        bundleSize: { warning: 500000, critical: 1000000 },
        memoryUsage: { warning: 500 * 1024 * 1024, critical: 1000 * 1024 * 1024 }
      }
    },
    dashboard: {
      updateInterval: 60000, // 1 minute
      enableRealTimeUpdates: false,
      enableAlerts: true,
      alertThresholds: {
        buildTime: 30000,
        bundleSize: 1000000,
        navigationTime: 1500,
        memoryUsage: 1000 * 1024 * 1024
      }
    }
  },
  
  ci: {
    monitor: {
      enabled: true,
      trackBuildTime: true,
      trackRouteLoading: false,
      trackNavigation: false,
      trackBundleSize: true,
      reportInterval: 0, // No periodic reports
      thresholds: {
        buildTime: { warning: 15000, critical: 60000 },
        routeLoadTime: { warning: 2000, critical: 5000 },
        navigationTime: { warning: 1000, critical: 3000 },
        bundleSize: { warning: 1000000, critical: 2000000 },
        memoryUsage: { warning: 1000 * 1024 * 1024, critical: 2000 * 1024 * 1024 }
      }
    },
    dashboard: {
      updateInterval: 0,
      enableRealTimeUpdates: false,
      enableAlerts: false,
      alertThresholds: {
        buildTime: 60000,
        bundleSize: 2000000,
        navigationTime: 3000,
        memoryUsage: 2000 * 1024 * 1024
      }
    }
  }
};

// Quick setup functions
export const setupDevelopmentPerformanceMonitoring = () => {
  const monitor = createPerformanceMonitor(performancePresets.development.monitor);
  const dashboard = createPerformanceDashboard(performancePresets.development.dashboard);
  
  console.log('🔧 Development performance monitoring configured');
  return { monitor, dashboard };
};

export const setupProductionPerformanceMonitoring = () => {
  const monitor = createPerformanceMonitor(performancePresets.production.monitor);
  const dashboard = createPerformanceDashboard(performancePresets.production.dashboard);
  
  console.log('🚀 Production performance monitoring configured');
  return { monitor, dashboard };
};

export const setupCIPerformanceMonitoring = () => {
  const monitor = createPerformanceMonitor(performancePresets.ci.monitor);
  
  console.log('🤖 CI performance monitoring configured');
  return { monitor };
};

// Performance analysis utilities
export const analyzePerformanceReport = (reportPath: string) => {
  // This would analyze a performance report file and provide insights
  console.log(`📊 Analyzing performance report: ${reportPath}`);
  // Implementation would go here
};

export const comparePerformanceReports = (beforePath: string, afterPath: string) => {
  // This would compare two performance reports
  console.log(`📊 Comparing performance reports: ${beforePath} vs ${afterPath}`);
  // Implementation would go here
};

export const generatePerformanceRecommendations = (data: any) => {
  // This would generate performance recommendations based on data
  const recommendations: string[] = [];
  
  // Add logic to analyze data and generate recommendations
  
  return recommendations;
};

// Runtime performance optimization utilities
export const optimizeRuntimePerformance = () => {
  console.log('⚡ Optimizing runtime performance...');
  
  // Initialize all optimization systems
  intelligentPreloader.setEnabled(true);
  componentOptimizer.preloadCriticalComponents();
  memoryManager.performCleanup();
  
  // Optimize component loading strategies
  componentOptimizer.optimizeStrategies();
  
  console.log('✅ Runtime performance optimization completed');
};

export const enablePerformanceOptimizations = (options: {
  enableCaching?: boolean;
  enablePreloading?: boolean;
  enableComponentOptimization?: boolean;
  enableMemoryManagement?: boolean;
} = {}) => {
  const {
    enableCaching = true,
    enablePreloading = true,
    enableComponentOptimization = true,
    enableMemoryManagement = true
  } = options;

  console.log('🚀 Enabling performance optimizations...');

  if (enableCaching) {
    console.log('  📦 Route caching enabled');
  }

  if (enablePreloading) {
    intelligentPreloader.setEnabled(true);
    console.log('  🔮 Intelligent preloading enabled');
  }

  if (enableComponentOptimization) {
    componentOptimizer.preloadCriticalComponents();
    console.log('  ⚡ Component optimization enabled');
  }

  if (enableMemoryManagement) {
    // Memory management is enabled by default
    console.log('  🧠 Memory management enabled');
  }

  console.log('✅ Performance optimizations enabled');
};

export const getPerformanceInsights = () => {
  const cacheStats = routeComponentCache.getStats();
  const preloaderStats = intelligentPreloader.getStats();
  const componentStats = componentOptimizer.getStats();
  const memoryStats = memoryManager.getMemoryStats();

  return {
    cache: {
      hitRate: cacheStats.hitRate,
      totalEntries: cacheStats.totalEntries,
      memoryUsage: cacheStats.memoryUsage
    },
    preloader: {
      totalPredictions: preloaderStats.totalPredictions,
      activePreloads: preloaderStats.activePreloads,
      averageProbability: preloaderStats.averageProbability
    },
    components: {
      totalLoads: componentStats.totalLoads,
      averageLoadTime: componentStats.averageLoadTime,
      cacheHitRate: componentStats.cacheHitRate
    },
    memory: {
      currentUsage: memoryStats.current.used,
      peak: memoryStats.peak,
      trend: memoryStats.trend,
      leaksDetected: memoryStats.leaks.length
    },
    recommendations: [
      ...routeComponentCache.getStats().hitRate < 0.5 ? ['Improve route caching strategy'] : [],
      ...componentStats.averageLoadTime > 1000 ? ['Optimize component loading'] : [],
      ...memoryStats.leaks.length > 0 ? ['Address detected memory leaks'] : [],
      ...preloaderStats.averageProbability < 0.3 ? ['Improve preloading predictions'] : []
    ]
  };
};