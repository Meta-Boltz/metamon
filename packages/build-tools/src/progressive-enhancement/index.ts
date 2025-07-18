/**
 * Progressive Enhancement Module
 * 
 * Comprehensive progressive enhancement and fallback system for Metamon framework.
 * Provides service worker fallbacks, offline functionality, and error recovery.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

// Main coordinator
export {
  ProgressiveEnhancementCoordinator,
  type ProgressiveEnhancementConfig,
  type FailureScenario,
  type ProgressiveEnhancementMetrics,
  defaultProgressiveEnhancementConfig,
  createProgressiveEnhancementCoordinator
} from './progressive-enhancement-coordinator.js';

// Offline functionality
export {
  OfflineFunctionalityManager,
  type OfflineConfig,
  type CachedFramework,
  type OfflineMetrics,
  type SyncQueueItem,
  defaultOfflineConfig,
  createOfflineFunctionalityManager
} from './offline-functionality-manager.js';

// Comprehensive error recovery
export {
  ComprehensiveErrorRecovery,
  type RecoveryStrategy,
  type RecoveryContext,
  type RecoveryResult,
  type ErrorPattern,
  type RecoveryMetrics,
  createComprehensiveErrorRecovery
} from './comprehensive-error-recovery.js';

// Re-export existing components for convenience
export {
  ProgressiveEnhancementFallback,
  type FallbackConfig,
  type FallbackMetrics
} from '../ssr-optimization/progressive-enhancement-fallback.js';

export {
  FallbackFrameworkLoader,
  type FallbackLoaderConfig,
  type FrameworkLoadRequest,
  type FrameworkLoadResult,
  defaultFallbackLoaderConfig
} from '../service-worker/fallback-loader.js';

export {
  ServiceWorkerManager,
  type ServiceWorkerConfig,
  type FrameworkCacheEntry,
  type ServiceWorkerStatus,
  defaultServiceWorkerConfig,
  createServiceWorkerManager
} from '../service-worker/service-worker-manager.js';

export {
  ErrorRecoveryManager,
  type RecoveryAttempt,
  type RecoveryState
} from '../error-recovery-manager.js';

/**
 * Create a complete progressive enhancement system
 */
export function createProgressiveEnhancementSystem(config?: {
  coordinator?: Partial<ProgressiveEnhancementConfig>;
  offline?: Partial<OfflineConfig>;
  serviceWorker?: Partial<ServiceWorkerConfig>;
  fallbackLoader?: Partial<FallbackLoaderConfig>;
}) {
  // Create all components
  const coordinator = createProgressiveEnhancementCoordinator(config?.coordinator);
  const offlineManager = createOfflineFunctionalityManager(config?.offline);
  const errorRecovery = createComprehensiveErrorRecovery();
  const serviceWorkerManager = createServiceWorkerManager(config?.serviceWorker);
  const fallbackLoader = new FallbackFrameworkLoader(config?.fallbackLoader);

  // Initialize coordinator with components
  coordinator.initializeServiceWorker(serviceWorkerManager);

  return {
    coordinator,
    offlineManager,
    errorRecovery,
    serviceWorkerManager,
    fallbackLoader,
    
    // Convenience methods
    async initialize() {
      await coordinator.initializeServiceWorker(serviceWorkerManager);
    },
    
    getMetrics() {
      return {
        coordinator: coordinator.getMetrics(),
        offline: offlineManager.getMetrics(),
        errorRecovery: errorRecovery.getMetrics()
      };
    },
    
    cleanup() {
      coordinator.cleanup();
      offlineManager.cleanup();
      errorRecovery.cleanup();
    }
  };
}

/**
 * Default configuration for the complete system
 */
export const defaultProgressiveEnhancementSystemConfig = {
  // coordinator: defaultProgressiveEnhancementConfig,
  // offline: defaultOfflineConfig,
  // serviceWorker: defaultServiceWorkerConfig,
  // fallbackLoader: defaultFallbackLoaderConfig
};