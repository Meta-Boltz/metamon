/**
 * Service Worker Module for Metamon Performance Optimization
 * 
 * Exports all service worker related functionality
 */

// Core service worker management
export * from './service-worker-manager.js';

// Service worker framework manager
export * from './service-worker-framework-manager.js';

// Framework bundle splitting
export * from './framework-bundle-splitter.js';

// Vite plugin integration
export * from './vite-plugin-service-worker.js';

// Fallback loading system
export * from './fallback-loader.js';

// Re-export service worker script (for build-time inclusion)
export { default as serviceWorkerScript } from './metamon-service-worker.js?raw';

/**
 * Convenience function to create a complete service worker setup
 */
import { 
  ServiceWorkerManager, 
  ServiceWorkerConfig, 
  defaultServiceWorkerConfig 
} from './service-worker-manager.js';
import { 
  FallbackFrameworkLoader, 
  FallbackLoaderConfig, 
  defaultFallbackLoaderConfig 
} from './fallback-loader.js';

export interface MetamonServiceWorkerSetup {
  serviceWorkerManager: ServiceWorkerManager;
  fallbackLoader: FallbackFrameworkLoader;
  isServiceWorkerSupported: boolean;
  loadFramework: (name: string, priority?: 'critical' | 'high' | 'normal' | 'low') => Promise<void>;
  getStats: () => Promise<any>;
}

/**
 * Initialize complete service worker setup with fallback
 */
export async function initializeMetamonServiceWorker(
  swConfig?: Partial<ServiceWorkerConfig>,
  fallbackConfig?: Partial<FallbackLoaderConfig>
): Promise<MetamonServiceWorkerSetup> {
  
  // Initialize service worker manager
  const serviceWorkerManager = new ServiceWorkerManager({
    ...defaultServiceWorkerConfig,
    ...swConfig
  });

  // Initialize fallback loader
  const fallbackLoader = new FallbackFrameworkLoader({
    ...defaultFallbackLoaderConfig,
    ...fallbackConfig
  });

  // Try to initialize service worker
  const swStatus = await serviceWorkerManager.initialize();
  const isServiceWorkerSupported = swStatus.isSupported && swStatus.isActive;

  // Create unified framework loader
  const loadFramework = async (
    name: string, 
    priority: 'critical' | 'high' | 'normal' | 'low' = 'normal'
  ): Promise<void> => {
    if (isServiceWorkerSupported) {
      // Use service worker for loading
      try {
        const cachedFramework = await serviceWorkerManager.getCachedFramework(name);
        if (!cachedFramework) {
          // Framework not cached, would be loaded on-demand by service worker
          console.log(`[Metamon] Framework ${name} will be loaded on-demand via service worker`);
        }
      } catch (error) {
        console.warn(`[Metamon] Service worker loading failed for ${name}, falling back:`, error);
        await fallbackLoader.loadFramework({ name, priority });
      }
    } else {
      // Use fallback loader
      await fallbackLoader.loadFramework({ name, priority });
    }
  };

  // Create unified stats function
  const getStats = async () => {
    const stats: any = {
      serviceWorker: {
        supported: swStatus.isSupported,
        active: swStatus.isActive,
        error: swStatus.error?.message
      }
    };

    if (isServiceWorkerSupported) {
      try {
        stats.serviceWorker.cache = await serviceWorkerManager.getCacheStats();
      } catch (error) {
        stats.serviceWorker.cacheError = error.message;
      }
    }

    stats.fallback = fallbackLoader.getStats();

    return stats;
  };

  return {
    serviceWorkerManager,
    fallbackLoader,
    isServiceWorkerSupported,
    loadFramework,
    getStats
  };
}

/**
 * Global setup function for easy integration
 */
export async function setupMetamonPerformanceOptimization(
  config?: {
    serviceWorker?: Partial<ServiceWorkerConfig>;
    fallback?: Partial<FallbackLoaderConfig>;
    autoInitialize?: boolean;
  }
): Promise<MetamonServiceWorkerSetup> {
  
  const setup = await initializeMetamonServiceWorker(
    config?.serviceWorker,
    config?.fallback
  );

  // Auto-initialize critical frameworks if requested
  if (config?.autoInitialize !== false) {
    // These would typically be determined by the application's manifest
    const criticalFrameworks = ['reactjs', 'vue']; // Example
    
    for (const framework of criticalFrameworks) {
      try {
        await setup.loadFramework(framework, 'critical');
      } catch (error) {
        console.warn(`[Metamon] Failed to preload critical framework ${framework}:`, error);
      }
    }
  }

  // Make setup available globally for debugging
  if (typeof window !== 'undefined') {
    (window as any).MetamonPerformance = setup;
  }

  return setup;
}