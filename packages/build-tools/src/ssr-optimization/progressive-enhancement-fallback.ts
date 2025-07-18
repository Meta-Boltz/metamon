/**
 * Progressive Enhancement Fallback System
 * 
 * Provides fallback mechanisms for SSR failures, framework loading issues,
 * and service worker unavailability to ensure graceful degradation.
 */

import {
  FallbackStrategy,
  ComponentDefinition,
  HydrationTarget,
  FrameworkType
} from '../types/ssr-optimization.js';

export interface FallbackConfig {
  strategy: FallbackStrategy;
  enableOfflineMode: boolean;
  enableStaticFallbacks: boolean;
  maxRetryAttempts: number;
  retryDelay: number;
  fallbackTimeout: number;
}

export interface FallbackMetrics {
  ssrFailures: number;
  frameworkLoadFailures: Map<FrameworkType, number>;
  hydrationFailures: number;
  serviceWorkerFailures: number;
  fallbackActivations: number;
  recoverySuccesses: number;
}

export class ProgressiveEnhancementFallback {
  private config: FallbackConfig;
  private metrics: FallbackMetrics;
  private fallbackCache: Map<string, string> = new Map();
  private retryQueue: Map<string, { target: HydrationTarget; attempts: number }> = new Map();

  constructor(config?: Partial<FallbackConfig>) {
    this.config = {
      strategy: FallbackStrategy.GRACEFUL_DEGRADATION,
      enableOfflineMode: true,
      enableStaticFallbacks: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      fallbackTimeout: 5000,
      ...config
    };

    this.metrics = {
      ssrFailures: 0,
      frameworkLoadFailures: new Map(),
      hydrationFailures: 0,
      serviceWorkerFailures: 0,
      fallbackActivations: 0,
      recoverySuccesses: 0
    };

    this.setupGlobalErrorHandlers();
    this.setupServiceWorkerFallbacks();
  }

  /**
   * Handles SSR rendering failures
   */
  async handleSSRFailure(components: ComponentDefinition[]): Promise<string> {
    this.metrics.ssrFailures++;
    this.metrics.fallbackActivations++;

    console.warn('SSR failure detected, applying fallback strategy');

    switch (this.config.strategy) {
      case FallbackStrategy.DIRECT_LOAD:
        return this.generateDirectLoadFallback(components);
      
      case FallbackStrategy.CACHED_VERSION:
        return await this.getCachedFallback(components) || this.generateMinimalFallback(components);
      
      case FallbackStrategy.MINIMAL_FALLBACK:
        return this.generateMinimalFallback(components);
      
      case FallbackStrategy.GRACEFUL_DEGRADATION:
      default:
        return this.generateGracefulDegradationFallback(components);
    }
  }

  /**
   * Handles framework loading failures
   */
  async handleFrameworkLoadFailure(framework: FrameworkType, target: HydrationTarget): Promise<void> {
    const currentFailures = this.metrics.frameworkLoadFailures.get(framework) || 0;
    this.metrics.frameworkLoadFailures.set(framework, currentFailures + 1);

    console.warn(`Framework loading failed for ${framework}, attempting fallback`);

    // Try retry logic first
    if (await this.attemptRetry(target)) {
      return;
    }

    // Apply fallback strategy
    await this.applyFrameworkFallback(framework, target);
  }

  /**
   * Handles hydration failures
   */
  async handleHydrationFailure(target: HydrationTarget, error: Error): Promise<void> {
    this.metrics.hydrationFailures++;
    
    console.warn(`Hydration failed for component ${target.componentId}:`, error);

    const element = document.querySelector(target.selector);
    if (!element) {
      return;
    }

    // Mark as failed
    element.setAttribute('data-hydration-failed', 'true');
    element.setAttribute('data-fallback-reason', error.message);

    // Apply component-level fallback
    await this.applyComponentFallback(element, target);
  }

  /**
   * Handles service worker failures
   */
  handleServiceWorkerFailure(): void {
    this.metrics.serviceWorkerFailures++;
    
    console.warn('Service worker failure detected, enabling direct loading fallback');

    // Only set up in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    // Set global flag for direct loading
    window.__METAMON_SW_FALLBACK = true;

    // Notify other systems
    const event = new window.CustomEvent('metamon:sw-fallback', {
      detail: { strategy: this.config.strategy }
    });
    window.dispatchEvent(event);
  }

  /**
   * Enables offline functionality with cached resources
   */
  enableOfflineMode(): void {
    if (!this.config.enableOfflineMode) {
      return;
    }

    // Only set up in browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    // Set up offline detection
    window.addEventListener('online', () => {
      console.log('Connection restored, attempting recovery');
      this.attemptRecovery();
    });

    window.addEventListener('offline', () => {
      console.log('Offline mode activated');
      this.activateOfflineMode();
    });

    // Check initial state
    if (!navigator.onLine) {
      this.activateOfflineMode();
    }
  }

  /**
   * Gets current fallback metrics
   */
  getMetrics(): FallbackMetrics {
    return { ...this.metrics };
  }

  /**
   * Resets metrics
   */
  resetMetrics(): void {
    this.metrics = {
      ssrFailures: 0,
      frameworkLoadFailures: new Map(),
      hydrationFailures: 0,
      serviceWorkerFailures: 0,
      fallbackActivations: 0,
      recoverySuccesses: 0
    };
  }

  // Private methods

  private setupGlobalErrorHandlers(): void {
    // Only set up in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message?.includes('hydration') || 
          event.reason?.message?.includes('framework')) {
        console.warn('Unhandled framework/hydration error:', event.reason);
        event.preventDefault(); // Prevent console error
      }
    });

    // Handle general errors
    window.addEventListener('error', (event) => {
      if (event.error?.message?.includes('framework') ||
          event.error?.message?.includes('hydration')) {
        console.warn('Framework/hydration error caught:', event.error);
      }
    });
  }

  private setupServiceWorkerFallbacks(): void {
    // Only set up in browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('error', () => {
        this.handleServiceWorkerFailure();
      });

      // Monitor service worker state
      navigator.serviceWorker.ready.catch(() => {
        this.handleServiceWorkerFailure();
      });
    }
  }

  private generateDirectLoadFallback(components: ComponentDefinition[]): string {
    const scripts = components
      .map(c => c.framework)
      .filter((framework, index, arr) => arr.indexOf(framework) === index)
      .map(framework => `<script src="/frameworks/${framework}.js"></script>`)
      .join('\n');

    return `
      <div data-fallback="direct-load">
        <div class="loading-message">Loading application...</div>
        ${scripts}
        <script>
          // Direct loading fallback initialization
          window.__METAMON_DIRECT_LOAD = true;
        </script>
      </div>
    `;
  }

  private async getCachedFallback(components: ComponentDefinition[]): Promise<string | null> {
    const cacheKey = this.generateCacheKey(components);
    return this.fallbackCache.get(cacheKey) || null;
  }

  private generateMinimalFallback(components: ComponentDefinition[]): string {
    return `
      <div data-fallback="minimal">
        <div class="minimal-content">
          <h2>Content Unavailable</h2>
          <p>Please refresh the page or try again later.</p>
          <button onclick="window.location.reload()">Refresh Page</button>
        </div>
      </div>
    `;
  }

  private generateGracefulDegradationFallback(components: ComponentDefinition[]): string {
    const staticContent = components.map(component => `
      <div class="component-fallback" data-component="${component.id}">
        <div class="static-content">
          <!-- Static content for ${component.component} -->
          <div class="component-placeholder">
            ${component.component} (Static Version)
          </div>
        </div>
        ${component.isInteractive ? `
          <div class="interactive-fallback" style="display: none;">
            <button onclick="this.parentElement.querySelector('.static-content').style.display='none'; this.style.display='none';">
              Enable Interactive Mode
            </button>
          </div>
        ` : ''}
      </div>
    `).join('\n');

    return `
      <div data-fallback="graceful-degradation">
        ${staticContent}
        <script>
          // Progressive enhancement script
          (function() {
            const fallbacks = document.querySelectorAll('.interactive-fallback');
            fallbacks.forEach(fallback => {
              fallback.style.display = 'block';
            });
          })();
        </script>
      </div>
    `;
  }

  private async attemptRetry(target: HydrationTarget): Promise<boolean> {
    const retryInfo = this.retryQueue.get(target.componentId) || { target, attempts: 0 };
    
    if (retryInfo.attempts >= this.config.maxRetryAttempts) {
      this.retryQueue.delete(target.componentId);
      return false;
    }

    retryInfo.attempts++;
    this.retryQueue.set(target.componentId, retryInfo);

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * retryInfo.attempts));

    try {
      // Attempt to reload framework and retry hydration
      await this.retryFrameworkLoad(target.framework);
      this.metrics.recoverySuccesses++;
      this.retryQueue.delete(target.componentId);
      return true;
    } catch (error) {
      console.warn(`Retry ${retryInfo.attempts} failed for ${target.componentId}:`, error);
      return false;
    }
  }

  private async retryFrameworkLoad(framework: FrameworkType): Promise<void> {
    // Only work in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('Framework loading not available in non-browser environment');
    }

    // Clear any cached failed attempts
    delete window[`__${framework}_failed`];
    
    // Attempt to reload framework
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `/frameworks/${framework}.js`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${framework}`));
      
      // Set timeout
      setTimeout(() => reject(new Error('Framework load timeout')), this.config.fallbackTimeout);
      
      document.head.appendChild(script);
    });
  }

  private async applyFrameworkFallback(framework: FrameworkType, target: HydrationTarget): Promise<void> {
    const element = document.querySelector(target.selector);
    if (!element) {
      return;
    }

    switch (this.config.strategy) {
      case FallbackStrategy.DIRECT_LOAD:
        await this.applyDirectLoadFallback(element, framework);
        break;
      
      case FallbackStrategy.MINIMAL_FALLBACK:
        this.applyMinimalComponentFallback(element);
        break;
      
      case FallbackStrategy.GRACEFUL_DEGRADATION:
      default:
        this.applyGracefulComponentFallback(element, target);
        break;
    }
  }

  private async applyDirectLoadFallback(element: Element, framework: FrameworkType): Promise<void> {
    // Inject framework script directly
    const script = document.createElement('script');
    script.src = `/frameworks/${framework}.js`;
    script.async = true;
    
    element.appendChild(script);
    element.setAttribute('data-fallback', 'direct-load');
  }

  private applyMinimalComponentFallback(element: Element): void {
    element.innerHTML = `
      <div class="component-error">
        <p>Component temporarily unavailable</p>
      </div>
    `;
    element.setAttribute('data-fallback', 'minimal');
  }

  private applyGracefulComponentFallback(element: Element, target: HydrationTarget): void {
    const fallbackContent = element.querySelector('[data-fallback-content]');
    if (fallbackContent) {
      fallbackContent.style.display = 'block';
    } else {
      // Create fallback content
      const fallback = document.createElement('div');
      fallback.className = 'graceful-fallback';
      fallback.innerHTML = `
        <div class="fallback-message">
          Interactive features temporarily unavailable
        </div>
        ${target.isInteractive ? `
          <button onclick="window.location.reload()">
            Retry Loading
          </button>
        ` : ''}
      `;
      element.appendChild(fallback);
    }
    
    element.setAttribute('data-fallback', 'graceful');
  }

  private async applyComponentFallback(element: Element, target: HydrationTarget): Promise<void> {
    // Show fallback content if available
    const fallbackContent = element.querySelector('[data-fallback]');
    if (fallbackContent) {
      fallbackContent.style.display = 'block';
      return;
    }

    // Apply strategy-specific fallback
    switch (this.config.strategy) {
      case FallbackStrategy.MINIMAL_FALLBACK:
        element.style.display = 'none';
        break;
      
      case FallbackStrategy.GRACEFUL_DEGRADATION:
        this.applyGracefulComponentFallback(element, target);
        break;
      
      default:
        // Keep existing content
        break;
    }
  }

  private activateOfflineMode(): void {
    // Only work in browser environment
    if (typeof document === 'undefined') {
      return;
    }

    document.body.classList.add('offline-mode');
    
    // Show offline indicator
    const indicator = document.createElement('div');
    indicator.className = 'offline-indicator';
    indicator.innerHTML = 'Offline Mode - Limited functionality available';
    document.body.appendChild(indicator);
  }

  private async attemptRecovery(): Promise<void> {
    // Only work in browser environment
    if (typeof document === 'undefined') {
      return;
    }

    // Try to recover failed components
    const failedElements = document.querySelectorAll('[data-hydration-failed="true"]');
    
    for (const element of failedElements) {
      const componentId = element.getAttribute('data-hydration-id');
      if (componentId && this.retryQueue.has(componentId)) {
        const retryInfo = this.retryQueue.get(componentId)!;
        retryInfo.attempts = 0; // Reset attempts for recovery
        await this.attemptRetry(retryInfo.target);
      }
    }

    // Remove offline indicator
    const indicator = document.querySelector('.offline-indicator');
    if (indicator) {
      indicator.remove();
    }
    
    document.body.classList.remove('offline-mode');
  }

  private generateCacheKey(components: ComponentDefinition[]): string {
    const key = components
      .map(c => `${c.framework}:${c.component}`)
      .sort()
      .join('|');
    
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '');
  }
}