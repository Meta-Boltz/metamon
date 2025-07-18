/**
 * Progressive Enhancement Coordinator
 * 
 * Orchestrates all progressive enhancement and fallback mechanisms
 * to ensure graceful degradation across various failure scenarios.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { ServiceWorkerManager } from '../service-worker/service-worker-manager.js';
import { FallbackFrameworkLoader } from '../service-worker/fallback-loader.js';
import { ProgressiveEnhancementFallback } from '../ssr-optimization/progressive-enhancement-fallback.js';
import { ErrorRecoveryManager } from '../error-recovery-manager.js';
import { FrameworkLoaderService } from '../framework-loader/framework-loader-service.js';
import {
  FrameworkType,
  LoadPriority,
  ComponentDefinition,
  HydrationTarget,
  FallbackStrategy
} from '../types/ssr-optimization.js';

export interface ProgressiveEnhancementConfig {
  // Service worker configuration
  serviceWorker: {
    enabled: boolean;
    fallbackTimeout: number;
    maxRetryAttempts: number;
  };
  
  // Direct loading fallback
  directLoading: {
    enabled: boolean;
    cdnFallback: boolean;
    localFallback: boolean;
    timeout: number;
  };
  
  // Offline functionality
  offline: {
    enabled: boolean;
    cacheStrategy: 'aggressive' | 'conservative' | 'minimal';
    maxCacheAge: number;
    enableBackgroundSync: boolean;
  };
  
  // Error recovery
  errorRecovery: {
    enabled: boolean;
    maxRetryAttempts: number;
    retryDelay: number;
    fallbackStrategy: FallbackStrategy;
  };
  
  // Monitoring and debugging
  monitoring: {
    enabled: boolean;
    reportFailures: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
}

export interface FailureScenario {
  type: 'service_worker' | 'framework_load' | 'hydration' | 'network' | 'cache_corruption';
  framework?: FrameworkType;
  component?: string;
  error: Error;
  timestamp: number;
  recoveryAttempts: number;
}

export interface ProgressiveEnhancementMetrics {
  serviceWorkerFailures: number;
  frameworkLoadFailures: Map<FrameworkType, number>;
  hydrationFailures: number;
  networkFailures: number;
  cacheCorruptions: number;
  successfulRecoveries: number;
  fallbackActivations: number;
  offlineActivations: number;
  averageRecoveryTime: number;
}

/**
 * Coordinates all progressive enhancement and fallback mechanisms
 */
export class ProgressiveEnhancementCoordinator {
  private config: ProgressiveEnhancementConfig;
  private serviceWorkerManager?: ServiceWorkerManager;
  private fallbackLoader: FallbackFrameworkLoader;
  private progressiveEnhancement: ProgressiveEnhancementFallback;
  private errorRecovery: ErrorRecoveryManager;
  private frameworkLoader?: FrameworkLoaderService;
  
  private metrics: ProgressiveEnhancementMetrics;
  private activeFailures: Map<string, FailureScenario> = new Map();
  private recoveryQueue: Array<{ scenario: FailureScenario; priority: number }> = [];
  private isOfflineMode: boolean = false;
  
  constructor(config: Partial<ProgressiveEnhancementConfig> = {}) {
    this.config = {
      serviceWorker: {
        enabled: true,
        fallbackTimeout: 5000,
        maxRetryAttempts: 3,
        ...config.serviceWorker
      },
      directLoading: {
        enabled: true,
        cdnFallback: true,
        localFallback: true,
        timeout: 10000,
        ...config.directLoading
      },
      offline: {
        enabled: true,
        cacheStrategy: 'conservative',
        maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
        enableBackgroundSync: true,
        ...config.offline
      },
      errorRecovery: {
        enabled: true,
        maxRetryAttempts: 3,
        retryDelay: 1000,
        fallbackStrategy: FallbackStrategy.GRACEFUL_DEGRADATION,
        ...config.errorRecovery
      },
      monitoring: {
        enabled: true,
        reportFailures: true,
        logLevel: 'info',
        ...config.monitoring
      }
    };

    this.metrics = {
      serviceWorkerFailures: 0,
      frameworkLoadFailures: new Map(),
      hydrationFailures: 0,
      networkFailures: 0,
      cacheCorruptions: 0,
      successfulRecoveries: 0,
      fallbackActivations: 0,
      offlineActivations: 0,
      averageRecoveryTime: 0
    };

    this.initializeComponents();
    this.setupGlobalErrorHandlers();
    this.setupNetworkMonitoring();
  }

  /**
   * Initialize all progressive enhancement components
   */
  private initializeComponents(): void {
    // Initialize fallback loader
    this.fallbackLoader = new FallbackFrameworkLoader({
      enableGracefulDegradation: true,
      fallbackStrategy: this.config.errorRecovery.fallbackStrategy === FallbackStrategy.CACHED_VERSION ? 'cached' : 'direct',
      maxRetryAttempts: this.config.errorRecovery.maxRetryAttempts,
      retryDelay: this.config.errorRecovery.retryDelay,
      enableLogging: this.config.monitoring.enabled,
      logLevel: this.config.monitoring.logLevel
    });

    // Initialize progressive enhancement fallback
    this.progressiveEnhancement = new ProgressiveEnhancementFallback({
      strategy: this.config.errorRecovery.fallbackStrategy,
      enableOfflineMode: this.config.offline.enabled,
      maxRetryAttempts: this.config.errorRecovery.maxRetryAttempts,
      retryDelay: this.config.errorRecovery.retryDelay
    });

    // Initialize error recovery manager
    this.errorRecovery = new ErrorRecoveryManager({
      enableStateRollback: true,
      maxRetryAttempts: this.config.errorRecovery.maxRetryAttempts,
      retryDelay: this.config.errorRecovery.retryDelay,
      fallbackToLastGoodState: true
    });

    // Register recovery callbacks
    this.setupRecoveryCallbacks();
  }

  /**
   * Initialize service worker with fallback handling
   */
  async initializeServiceWorker(serviceWorkerManager: ServiceWorkerManager): Promise<void> {
    if (!this.config.serviceWorker.enabled) {
      this.log('info', 'Service worker disabled, using direct loading fallback');
      return;
    }

    this.serviceWorkerManager = serviceWorkerManager;

    try {
      const status = await serviceWorkerManager.initialize();
      
      if (!status.isSupported) {
        this.handleServiceWorkerFailure('Service workers not supported');
        return;
      }

      if (!status.isActive) {
        this.handleServiceWorkerFailure('Service worker failed to activate');
        return;
      }

      this.log('info', 'Service worker initialized successfully');
      
      // Set up service worker error monitoring
      this.setupServiceWorkerMonitoring();
      
    } catch (error) {
      this.handleServiceWorkerFailure(`Service worker initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize framework loader with progressive enhancement
   */
  initializeFrameworkLoader(frameworkLoader: FrameworkLoaderService): void {
    this.frameworkLoader = frameworkLoader;
    
    // Set up framework loading error handlers
    this.setupFrameworkLoadingMonitoring();
  }

  /**
   * Handle service worker failures
   */
  private handleServiceWorkerFailure(reason: string): void {
    this.metrics.serviceWorkerFailures++;
    this.log('warn', `Service worker failure: ${reason}`);

    const scenario: FailureScenario = {
      type: 'service_worker',
      error: new Error(reason),
      timestamp: Date.now(),
      recoveryAttempts: 0
    };

    this.activeFailures.set('service_worker', scenario);
    
    // Activate fallback mechanisms
    this.activateServiceWorkerFallback();
    
    // Notify progressive enhancement system
    this.progressiveEnhancement.handleServiceWorkerFailure();
  }

  /**
   * Activate service worker fallback mechanisms
   */
  private activateServiceWorkerFallback(): void {
    this.metrics.fallbackActivations++;
    
    if (typeof window !== 'undefined') {
      // Set global flag for direct loading
      window.__METAMON_SW_FALLBACK = true;
      
      // Dispatch event for other systems
      const event = new CustomEvent('metamon:sw-fallback-activated', {
        detail: { 
          timestamp: Date.now(),
          fallbackStrategy: this.config.errorRecovery.fallbackStrategy
        }
      });
      window.dispatchEvent(event);
    }

    this.log('info', 'Service worker fallback activated - switching to direct loading');
  }

  /**
   * Handle framework loading failures
   */
  async handleFrameworkLoadFailure(framework: FrameworkType, error: Error): Promise<boolean> {
    const currentFailures = this.metrics.frameworkLoadFailures.get(framework) || 0;
    this.metrics.frameworkLoadFailures.set(framework, currentFailures + 1);

    this.log('warn', `Framework loading failed for ${framework}: ${error.message}`);

    const scenario: FailureScenario = {
      type: 'framework_load',
      framework,
      error,
      timestamp: Date.now(),
      recoveryAttempts: 0
    };

    const scenarioKey = `framework_${framework}`;
    this.activeFailures.set(scenarioKey, scenario);

    // Try recovery mechanisms in order of preference
    const recoveryStartTime = Date.now();
    
    try {
      // 1. Try service worker fallback if available
      if (this.serviceWorkerManager?.isReady() && scenario.recoveryAttempts < this.config.serviceWorker.maxRetryAttempts) {
        scenario.recoveryAttempts++;
        if (await this.tryServiceWorkerRecovery(framework)) {
          this.recordSuccessfulRecovery(recoveryStartTime);
          this.activeFailures.delete(scenarioKey);
          return true;
        }
      }

      // 2. Try direct loading fallback
      if (this.config.directLoading.enabled) {
        scenario.recoveryAttempts++;
        if (await this.tryDirectLoadingRecovery(framework)) {
          this.recordSuccessfulRecovery(recoveryStartTime);
          this.activeFailures.delete(scenarioKey);
          return true;
        }
      }

      // 3. Try cached version fallback
      scenario.recoveryAttempts++;
      if (await this.tryCachedVersionRecovery(framework)) {
        this.recordSuccessfulRecovery(recoveryStartTime);
        this.activeFailures.delete(scenarioKey);
        return true;
      }

      // 4. Apply graceful degradation
      await this.applyGracefulDegradation(framework);
      this.activeFailures.delete(scenarioKey);
      return false;

    } catch (recoveryError) {
      this.log('error', `All recovery attempts failed for ${framework}:`, recoveryError);
      await this.applyGracefulDegradation(framework);
      this.activeFailures.delete(scenarioKey);
      return false;
    }
  }

  /**
   * Try service worker recovery
   */
  private async tryServiceWorkerRecovery(framework: FrameworkType): Promise<boolean> {
    if (!this.serviceWorkerManager?.isReady()) {
      return false;
    }

    try {
      // Invalidate cache and retry
      await this.serviceWorkerManager.invalidateFrameworkCache(framework);
      
      // Wait a bit for cache invalidation
      await this.delay(500);
      
      // Try to get fresh framework
      const cached = await this.serviceWorkerManager.getCachedFramework(framework);
      return cached !== null;
      
    } catch (error) {
      this.log('debug', `Service worker recovery failed for ${framework}:`, error);
      return false;
    }
  }

  /**
   * Try direct loading recovery
   */
  private async tryDirectLoadingRecovery(framework: FrameworkType): Promise<boolean> {
    try {
      const result = await this.fallbackLoader.loadFramework({
        name: framework,
        priority: 'high',
        timeout: this.config.directLoading.timeout
      });
      
      return result.success;
      
    } catch (error) {
      this.log('debug', `Direct loading recovery failed for ${framework}:`, error);
      return false;
    }
  }

  /**
   * Try cached version recovery
   */
  private async tryCachedVersionRecovery(framework: FrameworkType): Promise<boolean> {
    try {
      // Try to load from expired cache
      const result = await this.fallbackLoader.loadFramework({
        name: framework,
        priority: 'high'
      });
      
      return result.success && result.fromCache;
      
    } catch (error) {
      this.log('debug', `Cached version recovery failed for ${framework}:`, error);
      return false;
    }
  }

  /**
   * Apply graceful degradation
   */
  private async applyGracefulDegradation(framework: FrameworkType): Promise<void> {
    this.log('info', `Applying graceful degradation for ${framework}`);
    
    if (typeof document !== 'undefined') {
      // Find all components using this framework
      const components = document.querySelectorAll(`[data-framework="${framework}"]`);
      
      components.forEach(component => {
        // Add fallback class
        component.classList.add('framework-fallback');
        
        // Show fallback content if available
        const fallback = component.querySelector('[data-fallback]');
        if (fallback) {
          fallback.style.display = 'block';
        } else {
          // Create minimal fallback
          const fallbackDiv = document.createElement('div');
          fallbackDiv.className = 'minimal-fallback';
          fallbackDiv.innerHTML = `
            <div class="fallback-message">
              Component temporarily unavailable
              <button onclick="window.location.reload()" class="retry-button">
                Retry
              </button>
            </div>
          `;
          component.appendChild(fallbackDiv);
        }
      });
    }
  }

  /**
   * Handle hydration failures
   */
  async handleHydrationFailure(target: HydrationTarget, error: Error): Promise<void> {
    this.metrics.hydrationFailures++;
    
    const scenario: FailureScenario = {
      type: 'hydration',
      framework: target.framework,
      component: target.componentId,
      error,
      timestamp: Date.now(),
      recoveryAttempts: 0
    };

    const scenarioKey = `hydration_${target.componentId}`;
    this.activeFailures.set(scenarioKey, scenario);

    // Delegate to progressive enhancement fallback
    await this.progressiveEnhancement.handleHydrationFailure(target, error);
    
    this.activeFailures.delete(scenarioKey);
  }

  /**
   * Handle network failures
   */
  handleNetworkFailure(error: Error): void {
    this.metrics.networkFailures++;
    
    if (!navigator.onLine) {
      this.activateOfflineMode();
    }
    
    this.log('warn', 'Network failure detected:', error.message);
  }

  /**
   * Activate offline mode
   */
  private activateOfflineMode(): void {
    if (this.isOfflineMode) {
      return;
    }

    this.isOfflineMode = true;
    this.metrics.offlineActivations++;
    
    this.log('info', 'Offline mode activated');
    
    // Enable offline functionality in progressive enhancement
    this.progressiveEnhancement.enableOfflineMode();
    
    if (typeof document !== 'undefined') {
      document.body.classList.add('metamon-offline');
      
      // Show offline indicator
      this.showOfflineIndicator();
    }
  }

  /**
   * Deactivate offline mode
   */
  private deactivateOfflineMode(): void {
    if (!this.isOfflineMode) {
      return;
    }

    this.isOfflineMode = false;
    
    this.log('info', 'Offline mode deactivated - connection restored');
    
    if (typeof document !== 'undefined') {
      document.body.classList.remove('metamon-offline');
      
      // Hide offline indicator
      this.hideOfflineIndicator();
      
      // Attempt to recover failed operations
      this.attemptOfflineRecovery();
    }
  }

  /**
   * Show offline indicator
   */
  private showOfflineIndicator(): void {
    if (typeof document === 'undefined') return;
    
    let indicator = document.getElementById('metamon-offline-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'metamon-offline-indicator';
      indicator.className = 'metamon-offline-indicator';
      indicator.innerHTML = `
        <div class="offline-content">
          <span class="offline-icon">📡</span>
          <span class="offline-text">Offline Mode - Limited functionality</span>
        </div>
      `;
      document.body.appendChild(indicator);
    }
    
    indicator.style.display = 'block';
  }

  /**
   * Hide offline indicator
   */
  private hideOfflineIndicator(): void {
    if (typeof document === 'undefined') return;
    
    const indicator = document.getElementById('metamon-offline-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Attempt recovery when coming back online
   */
  private async attemptOfflineRecovery(): Promise<void> {
    this.log('info', 'Attempting offline recovery...');
    
    // Retry failed framework loads
    const frameworkFailures = Array.from(this.activeFailures.entries())
      .filter(([_, scenario]) => scenario.type === 'framework_load');
    
    for (const [key, scenario] of frameworkFailures) {
      if (scenario.framework) {
        const recovered = await this.handleFrameworkLoadFailure(scenario.framework, scenario.error);
        if (recovered) {
          this.log('info', `Recovered framework ${scenario.framework} after offline period`);
        }
      }
    }
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return;

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (this.isFrameworkRelatedError(event.reason)) {
        this.log('warn', 'Unhandled framework error:', event.reason);
        event.preventDefault();
      }
    });

    // Handle general errors
    window.addEventListener('error', (event) => {
      if (this.isFrameworkRelatedError(event.error)) {
        this.log('warn', 'Framework error caught:', event.error);
      }
    });
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.deactivateOfflineMode();
    });

    window.addEventListener('offline', () => {
      this.activateOfflineMode();
    });

    // Check initial state
    if (!navigator.onLine) {
      this.activateOfflineMode();
    }
  }

  /**
   * Setup service worker monitoring
   */
  private setupServiceWorkerMonitoring(): void {
    if (!this.serviceWorkerManager || typeof window === 'undefined') return;

    // Monitor service worker errors
    window.addEventListener('metamon:sw-error', (event: any) => {
      this.handleServiceWorkerFailure(`Service worker error: ${event.detail.error}`);
    });

    // Monitor service worker updates
    window.addEventListener('sw-update-available', () => {
      this.log('info', 'Service worker update available');
    });
  }

  /**
   * Setup framework loading monitoring
   */
  private setupFrameworkLoadingMonitoring(): void {
    if (!this.frameworkLoader || typeof window === 'undefined') return;

    // Monitor framework loading errors
    window.addEventListener('metamon:framework-load-error', (event: any) => {
      this.handleFrameworkLoadFailure(event.detail.framework, event.detail.error);
    });
  }

  /**
   * Setup recovery callbacks
   */
  private setupRecoveryCallbacks(): void {
    this.errorRecovery.registerRecoveryCallback('restoreState', async () => {
      // Implement state restoration logic
      this.log('debug', 'Attempting state restoration');
    });

    this.errorRecovery.registerRecoveryCallback('syncFrameworks', async () => {
      // Implement framework synchronization logic
      this.log('debug', 'Attempting framework synchronization');
    });

    this.errorRecovery.registerRecoveryCallback('retryOperation', async () => {
      // Implement operation retry logic
      this.log('debug', 'Retrying failed operation');
    });
  }

  /**
   * Check if error is framework-related
   */
  private isFrameworkRelatedError(error: any): boolean {
    if (!error || !error.message) return false;
    
    const frameworkKeywords = ['framework', 'hydration', 'metamon', 'service-worker'];
    return frameworkKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Record successful recovery
   */
  private recordSuccessfulRecovery(startTime: number): void {
    this.metrics.successfulRecoveries++;
    
    const recoveryTime = Date.now() - startTime;
    this.metrics.averageRecoveryTime = 
      (this.metrics.averageRecoveryTime + recoveryTime) / 2;
    
    this.log('info', `Successful recovery completed in ${recoveryTime}ms`);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log messages based on configuration
   */
  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: any[]): void {
    if (!this.config.monitoring.enabled) return;

    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const configLevel = levels[this.config.monitoring.logLevel];
    const messageLevel = levels[level];

    if (messageLevel <= configLevel) {
      const prefix = '[Metamon Progressive Enhancement]';
      if (args.length > 0) {
        console[level](`${prefix} ${message}`, ...args);
      } else {
        console[level](`${prefix} ${message}`);
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ProgressiveEnhancementMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active failures
   */
  getActiveFailures(): FailureScenario[] {
    return Array.from(this.activeFailures.values());
  }

  /**
   * Check if offline mode is active
   */
  isOffline(): boolean {
    return this.isOfflineMode;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProgressiveEnhancementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.errorRecovery.cleanup();
    this.activeFailures.clear();
    this.recoveryQueue.length = 0;
    
    if (typeof document !== 'undefined') {
      const indicator = document.getElementById('metamon-offline-indicator');
      if (indicator) {
        indicator.remove();
      }
    }
  }
}

/**
 * Default progressive enhancement configuration
 */
export const defaultProgressiveEnhancementConfig: ProgressiveEnhancementConfig = {
  serviceWorker: {
    enabled: true,
    fallbackTimeout: 5000,
    maxRetryAttempts: 3
  },
  directLoading: {
    enabled: true,
    cdnFallback: true,
    localFallback: true,
    timeout: 10000
  },
  offline: {
    enabled: true,
    cacheStrategy: 'conservative',
    maxCacheAge: 24 * 60 * 60 * 1000,
    enableBackgroundSync: true
  },
  errorRecovery: {
    enabled: true,
    maxRetryAttempts: 3,
    retryDelay: 1000,
    fallbackStrategy: FallbackStrategy.GRACEFUL_DEGRADATION
  },
  monitoring: {
    enabled: true,
    reportFailures: true,
    logLevel: 'info'
  }
};

/**
 * Create progressive enhancement coordinator with default configuration
 */
export function createProgressiveEnhancementCoordinator(
  config?: Partial<ProgressiveEnhancementConfig>
): ProgressiveEnhancementCoordinator {
  const finalConfig = { ...defaultProgressiveEnhancementConfig, ...config };
  return new ProgressiveEnhancementCoordinator(finalConfig);
}