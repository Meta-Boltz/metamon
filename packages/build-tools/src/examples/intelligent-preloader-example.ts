/**
 * Intelligent Preloader Usage Example
 * 
 * Demonstrates how to use the IntelligentPreloaderService for
 * viewport-based, interaction-based, navigation-based, and
 * network-aware framework preloading.
 */

import { IntelligentPreloaderService } from '../intelligent-preloader/index.js';
import { FrameworkLoaderService } from '../framework-loader/index.js';
import {
  ComponentDefinition,
  IntelligentPreloaderConfig
} from '../types/intelligent-preloader.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

// Example: Basic setup and configuration
export function createIntelligentPreloader() {
  // Create framework loader instance
  const frameworkLoader = new FrameworkLoaderService({
    serviceWorkerEnabled: true,
    fallbackEnabled: true,
    loadingStrategy: {
      maxConcurrentLoads: 3,
      timeoutMs: 5000,
      retryAttempts: 2,
      retryDelayMs: 1000,
      priorityWeights: {
        [LoadPriority.CRITICAL]: 4,
        [LoadPriority.HIGH]: 3,
        [LoadPriority.NORMAL]: 2,
        [LoadPriority.LOW]: 1
      },
      networkAdaptation: {
        enabled: true,
        slowNetworkThreshold: 1.5,
        adaptiveTimeout: true
      }
    },
    cacheConfig: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      maxSize: 50 * 1024 * 1024,   // 50MB
      compressionEnabled: true,
      invalidationStrategy: 'version'
    },
    enableMetrics: true,
    enableLogging: true
  });

  // Configure intelligent preloader
  const preloaderConfig: IntelligentPreloaderConfig = {
    viewport: {
      rootMargin: '100px',
      threshold: [0, 0.25, 0.5, 0.75, 1.0],
      preloadDistance: 300
    },
    interaction: {
      hoverDelay: 150,
      scrollVelocityThreshold: 120,
      clickPatternWindow: 3000,
      confidenceThreshold: 0.75
    },
    navigation: {
      routePatterns: [
        '/dashboard',
        '/users/:id',
        '/posts/:id',
        '/settings/*'
      ],
      preloadDepth: 3,
      cacheSize: 15,
      prefetchDelay: 300
    },
    network: {
      slowNetworkThreshold: 2.0,
      saveDataRespect: true,
      adaptivePreloading: true,
      bandwidthThresholds: {
        disable: 0.5,
        reduce: 1.0,
        normal: 3.0
      }
    },
    enableLogging: true,
    enableMetrics: true
  };

  // Create intelligent preloader
  const preloader = new IntelligentPreloaderService(preloaderConfig, frameworkLoader);

  return { frameworkLoader, preloader };
}

// Example: Viewport-based preloading setup
export function setupViewportPreloading(preloader: IntelligentPreloaderService) {
  // Define components that should be observed for viewport preloading
  const components: ComponentDefinition[] = [
    {
      id: 'hero-section',
      framework: FrameworkType.REACT,
      element: document.getElementById('hero-section') as HTMLElement,
      isInteractive: true,
      route: '/dashboard'
    },
    {
      id: 'user-profile',
      framework: FrameworkType.VUE,
      element: document.getElementById('user-profile') as HTMLElement,
      isInteractive: true,
      route: '/users/profile'
    },
    {
      id: 'data-table',
      framework: FrameworkType.SVELTE,
      element: document.getElementById('data-table') as HTMLElement,
      isInteractive: true,
      route: '/dashboard/data'
    },
    {
      id: 'settings-panel',
      framework: FrameworkType.SOLID,
      element: document.getElementById('settings-panel') as HTMLElement,
      isInteractive: false,
      route: '/settings'
    }
  ];

  // Start observing components for viewport-based preloading
  preloader.observeViewport(components);

  console.log('Viewport preloading setup complete');
  return components;
}

// Example: Navigation-based preloading
export async function setupNavigationPreloading(preloader: IntelligentPreloaderService) {
  // Simulate navigation events
  const routes = [
    '/dashboard',
    '/users/123',
    '/posts/456',
    '/settings/profile',
    '/dashboard/analytics'
  ];

  // Preload for each route transition
  for (const route of routes) {
    await preloader.preloadForNavigation(route);
    console.log(`Navigation preloading setup for route: ${route}`);
  }

  // Preload for specific route patterns
  await preloader.preloadForRoutePattern('/users/:id');
  await preloader.preloadForRoutePattern('/posts/:id');

  console.log('Navigation preloading setup complete');
}

// Example: Network-aware adaptation
export function setupNetworkAdaptation(preloader: IntelligentPreloaderService) {
  // Monitor network conditions and adapt preloading strategy
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    
    const updateNetworkStrategy = () => {
      const networkConditions = {
        effectiveType: connection.effectiveType || '4g',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 100,
        saveData: connection.saveData || false
      };

      preloader.adaptPreloadingStrategy(networkConditions);
      
      console.log('Network conditions updated:', networkConditions);
    };

    // Listen for network changes
    connection.addEventListener('change', updateNetworkStrategy);
    
    // Initial network check
    updateNetworkStrategy();
  }

  console.log('Network adaptation setup complete');
}

// Example: Monitoring and metrics
export function setupMonitoring(preloader: IntelligentPreloaderService) {
  // Set up periodic metrics reporting
  const metricsInterval = setInterval(() => {
    const metrics = preloader.getMetrics();
    const scheduledPreloads = preloader.getScheduledPreloads();

    console.log('Preloader Metrics:', {
      totalPredictions: metrics.totalPredictions,
      accuratePredictions: metrics.accuratePredictions,
      preloadHitRate: (metrics.preloadHitRate * 100).toFixed(2) + '%',
      averageConfidence: (metrics.averageConfidence * 100).toFixed(2) + '%',
      scheduledPreloads: scheduledPreloads.length,
      predictionsByReason: metrics.predictionsByReason
    });

    // Log scheduled preloads
    if (scheduledPreloads.length > 0) {
      console.log('Scheduled Preloads:', scheduledPreloads.map(p => ({
        framework: p.framework,
        priority: p.priority,
        reason: p.reason,
        confidence: (p.confidence * 100).toFixed(2) + '%'
      })));
    }
  }, 10000); // Every 10 seconds

  // Return cleanup function
  return () => clearInterval(metricsInterval);
}

// Example: Complete integration
export async function integrateIntelligentPreloader() {
  console.log('Setting up Intelligent Preloader...');

  // Create preloader instance
  const { frameworkLoader, preloader } = createIntelligentPreloader();

  // Start the preloader
  preloader.start();

  // Setup viewport-based preloading
  const components = setupViewportPreloading(preloader);

  // Setup navigation-based preloading
  await setupNavigationPreloading(preloader);

  // Setup network adaptation
  setupNetworkAdaptation(preloader);

  // Setup monitoring
  const stopMonitoring = setupMonitoring(preloader);

  // Example: Manual preload scheduling
  preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'manual');
  preloader.schedulePreload(FrameworkType.VUE, LoadPriority.NORMAL, 'manual');

  console.log('Intelligent Preloader integration complete');

  // Return cleanup function
  return () => {
    console.log('Cleaning up Intelligent Preloader...');
    
    stopMonitoring();
    preloader.unobserveViewport(components);
    preloader.stop();
    preloader.destroy();
    
    console.log('Intelligent Preloader cleanup complete');
  };
}

// Example: Custom prediction logic
export function createCustomPreloadStrategy(preloader: IntelligentPreloaderService) {
  // Example: Time-based preloading
  const timeBasedPreloading = () => {
    const hour = new Date().getHours();
    
    // Business hours - preload work-related frameworks
    if (hour >= 9 && hour <= 17) {
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.NORMAL, 'time-based');
      preloader.schedulePreload(FrameworkType.VUE, LoadPriority.LOW, 'time-based');
    }
    // Evening - preload entertainment frameworks
    else if (hour >= 18 && hour <= 23) {
      preloader.schedulePreload(FrameworkType.SVELTE, LoadPriority.NORMAL, 'time-based');
      preloader.schedulePreload(FrameworkType.SOLID, LoadPriority.LOW, 'time-based');
    }
  };

  // Example: User behavior-based preloading
  const behaviorBasedPreloading = () => {
    const userPreferences = localStorage.getItem('userFrameworkPreferences');
    if (userPreferences) {
      const preferences = JSON.parse(userPreferences);
      
      Object.entries(preferences).forEach(([framework, usage]) => {
        if (typeof usage === 'number' && usage > 0.5) {
          preloader.schedulePreload(
            framework as FrameworkType,
            LoadPriority.NORMAL,
            'user-behavior'
          );
        }
      });
    }
  };

  // Run custom strategies
  timeBasedPreloading();
  behaviorBasedPreloading();

  // Set up periodic custom strategy execution
  const customStrategyInterval = setInterval(() => {
    timeBasedPreloading();
    behaviorBasedPreloading();
  }, 60000); // Every minute

  return () => clearInterval(customStrategyInterval);
}

// Example usage in a real application
if (typeof window !== 'undefined') {
  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const cleanup = await integrateIntelligentPreloader();
      
      // Setup custom strategies
      const customCleanup = createCustomPreloadStrategy(
        // You would get the preloader instance here
        {} as IntelligentPreloaderService
      );

      // Cleanup on page unload
      window.addEventListener('beforeunload', () => {
        cleanup();
        customCleanup();
      });

    } catch (error) {
      console.error('Failed to initialize Intelligent Preloader:', error);
    }
  });
}