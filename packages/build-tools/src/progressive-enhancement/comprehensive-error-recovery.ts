/**
 * Comprehensive Error Recovery System
 * 
 * Provides advanced error recovery mechanisms for various failure scenarios
 * including service worker failures, framework loading issues, and network problems.
 * 
 * Requirements: 7.4, 7.5 - Build error recovery mechanisms for various failure scenarios
 */

import { ErrorRecoveryManager } from '../error-recovery-manager.js';
import { FrameworkType } from '../types/ssr-optimization.js';
import type { ReloadError } from '../types/error-handling.js';

export interface RecoveryStrategy {
  name: string;
  priority: number;
  timeout: number;
  maxRetries: number;
  canHandle: (error: Error) => boolean;
  recover: (error: Error, context: RecoveryContext) => Promise<RecoveryResult>;
}

export interface RecoveryContext {
  framework?: FrameworkType;
  component?: string;
  element?: Element;
  timestamp: number;
  previousAttempts: number;
  userAgent: string;
  networkStatus: 'online' | 'offline' | 'slow';
  availableStrategies: string[];
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  duration: number;
  fallbackApplied: boolean;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface ErrorPattern {
  pattern: RegExp;
  category: 'service_worker' | 'framework_load' | 'hydration' | 'network' | 'cache' | 'compilation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  suggestedStrategies: string[];
}

export interface RecoveryMetrics {
  totalErrors: number;
  recoveredErrors: number;
  failedRecoveries: number;
  strategiesUsed: Map<string, number>;
  averageRecoveryTime: number;
  errorsByCategory: Map<string, number>;
  recoverySuccessRate: number;
}

/**
 * Comprehensive error recovery system with multiple strategies
 */
export class ComprehensiveErrorRecovery {
  private baseRecoveryManager: ErrorRecoveryManager;
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private metrics: RecoveryMetrics;
  private activeRecoveries: Map<string, Promise<RecoveryResult>> = new Map();

  constructor() {
    this.baseRecoveryManager = new ErrorRecoveryManager({
      enableStateRollback: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      fallbackToLastGoodState: true
    });

    this.metrics = {
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      strategiesUsed: new Map(),
      averageRecoveryTime: 0,
      errorsByCategory: new Map(),
      recoverySuccessRate: 0
    };

    this.initializeStrategies();
    this.initializeErrorPatterns();
  }

  /**
   * Initialize recovery strategies
   */
  private initializeStrategies(): void {
    // Service Worker Recovery Strategy
    this.registerStrategy({
      name: 'service_worker_recovery',
      priority: 10,
      timeout: 5000,
      maxRetries: 2,
      canHandle: (error) => this.isServiceWorkerError(error),
      recover: async (error, context) => this.recoverServiceWorker(error, context)
    });

    // Framework Loading Recovery Strategy
    this.registerStrategy({
      name: 'framework_load_recovery',
      priority: 9,
      timeout: 10000,
      maxRetries: 3,
      canHandle: (error) => this.isFrameworkLoadError(error),
      recover: async (error, context) => this.recoverFrameworkLoad(error, context)
    });

    // Hydration Recovery Strategy
    this.registerStrategy({
      name: 'hydration_recovery',
      priority: 8,
      timeout: 3000,
      maxRetries: 2,
      canHandle: (error) => this.isHydrationError(error),
      recover: async (error, context) => this.recoverHydration(error, context)
    });

    // Network Recovery Strategy
    this.registerStrategy({
      name: 'network_recovery',
      priority: 7,
      timeout: 15000,
      maxRetries: 5,
      canHandle: (error) => this.isNetworkError(error),
      recover: async (error, context) => this.recoverNetwork(error, context)
    });

    // Cache Recovery Strategy
    this.registerStrategy({
      name: 'cache_recovery',
      priority: 6,
      timeout: 2000,
      maxRetries: 1,
      canHandle: (error) => this.isCacheError(error),
      recover: async (error, context) => this.recoverCache(error, context)
    });

    // DOM Recovery Strategy
    this.registerStrategy({
      name: 'dom_recovery',
      priority: 5,
      timeout: 1000,
      maxRetries: 2,
      canHandle: (error) => this.isDOMError(error),
      recover: async (error, context) => this.recoverDOM(error, context)
    });

    // Generic Fallback Strategy
    this.registerStrategy({
      name: 'generic_fallback',
      priority: 1,
      timeout: 5000,
      maxRetries: 1,
      canHandle: () => true, // Handles any error as last resort
      recover: async (error, context) => this.genericFallback(error, context)
    });
  }

  /**
   * Initialize error patterns for categorization
   */
  private initializeErrorPatterns(): void {
    this.errorPatterns = [
      // Service Worker Errors
      {
        pattern: /service.?worker|sw\.js|registration.*failed/i,
        category: 'service_worker',
        severity: 'high',
        recoverable: true,
        suggestedStrategies: ['service_worker_recovery', 'generic_fallback']
      },
      
      // Framework Loading Errors
      {
        pattern: /failed.*load.*framework|framework.*not.*found|chunk.*load.*error/i,
        category: 'framework_load',
        severity: 'high',
        recoverable: true,
        suggestedStrategies: ['framework_load_recovery', 'cache_recovery']
      },
      
      // Hydration Errors
      {
        pattern: /hydration.*failed|hydration.*mismatch|cannot.*hydrate/i,
        category: 'hydration',
        severity: 'medium',
        recoverable: true,
        suggestedStrategies: ['hydration_recovery', 'dom_recovery']
      },
      
      // Network Errors
      {
        pattern: /network.*error|fetch.*failed|connection.*refused|timeout/i,
        category: 'network',
        severity: 'medium',
        recoverable: true,
        suggestedStrategies: ['network_recovery', 'cache_recovery']
      },
      
      // Cache Errors
      {
        pattern: /cache.*error|storage.*quota|indexeddb.*error/i,
        category: 'cache',
        severity: 'low',
        recoverable: true,
        suggestedStrategies: ['cache_recovery']
      },
      
      // Compilation Errors
      {
        pattern: /syntax.*error|compilation.*failed|parse.*error/i,
        category: 'compilation',
        severity: 'critical',
        recoverable: false,
        suggestedStrategies: ['generic_fallback']
      }
    ];
  }

  /**
   * Register a recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Attempt to recover from an error
   */
  async recoverFromError(error: Error, context: Partial<RecoveryContext> = {}): Promise<RecoveryResult> {
    this.metrics.totalErrors++;
    
    const fullContext: RecoveryContext = {
      timestamp: Date.now(),
      previousAttempts: 0,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      networkStatus: this.getNetworkStatus(),
      availableStrategies: Array.from(this.strategies.keys()),
      ...context
    };

    const errorKey = this.generateErrorKey(error, fullContext);
    
    // Check if recovery is already in progress for this error
    if (this.activeRecoveries.has(errorKey)) {
      return await this.activeRecoveries.get(errorKey)!;
    }

    // Start recovery process
    const recoveryPromise = this.performRecovery(error, fullContext);
    this.activeRecoveries.set(errorKey, recoveryPromise);

    try {
      const result = await recoveryPromise;
      this.updateMetrics(result);
      return result;
    } finally {
      this.activeRecoveries.delete(errorKey);
    }
  }

  /**
   * Perform the actual recovery process
   */
  private async performRecovery(error: Error, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    // Categorize the error
    const errorCategory = this.categorizeError(error);
    this.metrics.errorsByCategory.set(errorCategory, 
      (this.metrics.errorsByCategory.get(errorCategory) || 0) + 1);

    // Get applicable strategies
    const applicableStrategies = this.getApplicableStrategies(error);
    
    if (applicableStrategies.length === 0) {
      return {
        success: false,
        strategy: 'none',
        duration: Date.now() - startTime,
        fallbackApplied: false,
        error: new Error('No applicable recovery strategies found')
      };
    }

    // Try strategies in priority order
    for (const strategy of applicableStrategies) {
      try {
        this.log('debug', `Attempting recovery with strategy: ${strategy.name}`);
        
        const result = await this.executeStrategyWithTimeout(strategy, error, context);
        
        if (result.success) {
          this.metrics.recoveredErrors++;
          this.updateStrategyMetrics(strategy.name);
          
          return {
            ...result,
            duration: Date.now() - startTime
          };
        }
        
        this.log('warn', `Recovery strategy ${strategy.name} failed:`, result.error);
        
      } catch (strategyError) {
        this.log('error', `Recovery strategy ${strategy.name} threw error:`, strategyError);
      }
    }

    // All strategies failed
    this.metrics.failedRecoveries++;
    
    return {
      success: false,
      strategy: 'all_failed',
      duration: Date.now() - startTime,
      fallbackApplied: false,
      error: new Error('All recovery strategies failed')
    };
  }

  /**
   * Execute strategy with timeout
   */
  private async executeStrategyWithTimeout(
    strategy: RecoveryStrategy,
    error: Error,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Recovery strategy ${strategy.name} timed out`));
      }, strategy.timeout);

      strategy.recover(error, context)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  }

  /**
   * Get applicable strategies for an error
   */
  private getApplicableStrategies(error: Error): RecoveryStrategy[] {
    const strategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.canHandle(error))
      .sort((a, b) => b.priority - a.priority);

    return strategies;
  }

  /**
   * Categorize error based on patterns
   */
  private categorizeError(error: Error): string {
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(error.message)) {
        return pattern.category;
      }
    }
    return 'unknown';
  }

  /**
   * Recovery strategy implementations
   */

  private async recoverServiceWorker(error: Error, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Try to re-register service worker
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/metamon-sw.js', { scope: '/' });
        
        // Wait for activation
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Service worker activation timeout')), 5000);
          
          navigator.serviceWorker.ready.then(() => {
            clearTimeout(timeout);
            resolve(undefined);
          }).catch(reject);
        });

        return {
          success: true,
          strategy: 'service_worker_recovery',
          duration: Date.now() - startTime,
          fallbackApplied: false
        };
      }
      
      throw new Error('Service workers not supported');
      
    } catch (recoveryError) {
      // Fallback to direct loading
      if (typeof window !== 'undefined') {
        window.__METAMON_SW_FALLBACK = true;
      }
      
      return {
        success: true,
        strategy: 'service_worker_recovery',
        duration: Date.now() - startTime,
        fallbackApplied: true,
        metadata: { fallbackMode: 'direct_loading' }
      };
    }
  }

  private async recoverFrameworkLoad(error: Error, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    if (!context.framework) {
      throw new Error('Framework context required for framework load recovery');
    }

    try {
      // Try different loading strategies
      const strategies = [
        () => this.tryDirectFrameworkLoad(context.framework!),
        () => this.tryCDNFrameworkLoad(context.framework!),
        () => this.tryFallbackFrameworkLoad(context.framework!)
      ];

      for (const strategy of strategies) {
        try {
          await strategy();
          return {
            success: true,
            strategy: 'framework_load_recovery',
            duration: Date.now() - startTime,
            fallbackApplied: false
          };
        } catch (strategyError) {
          this.log('debug', 'Framework load strategy failed:', strategyError);
        }
      }

      throw new Error('All framework loading strategies failed');
      
    } catch (recoveryError) {
      // Apply minimal fallback
      if (context.element) {
        this.applyMinimalFrameworkFallback(context.element, context.framework);
      }
      
      return {
        success: true,
        strategy: 'framework_load_recovery',
        duration: Date.now() - startTime,
        fallbackApplied: true,
        metadata: { fallbackMode: 'minimal' }
      };
    }
  }

  private async recoverHydration(error: Error, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      if (!context.element) {
        throw new Error('Element context required for hydration recovery');
      }

      // Try to re-hydrate with fresh framework instance
      if (context.framework) {
        await this.retryHydration(context.element, context.framework);
      }

      return {
        success: true,
        strategy: 'hydration_recovery',
        duration: Date.now() - startTime,
        fallbackApplied: false
      };
      
    } catch (recoveryError) {
      // Fallback to static content
      if (context.element) {
        this.convertToStaticContent(context.element);
      }
      
      return {
        success: true,
        strategy: 'hydration_recovery',
        duration: Date.now() - startTime,
        fallbackApplied: true,
        metadata: { fallbackMode: 'static' }
      };
    }
  }

  private async recoverNetwork(error: Error, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Wait for network recovery with exponential backoff
      const maxWait = 30000; // 30 seconds
      let waitTime = 1000; // Start with 1 second
      
      while (waitTime < maxWait) {
        await this.delay(waitTime);
        
        if (await this.testNetworkConnectivity()) {
          return {
            success: true,
            strategy: 'network_recovery',
            duration: Date.now() - startTime,
            fallbackApplied: false
          };
        }
        
        waitTime *= 2; // Exponential backoff
      }
      
      throw new Error('Network recovery timeout');
      
    } catch (recoveryError) {
      // Enable offline mode
      this.enableOfflineMode();
      
      return {
        success: true,
        strategy: 'network_recovery',
        duration: Date.now() - startTime,
        fallbackApplied: true,
        metadata: { fallbackMode: 'offline' }
      };
    }
  }

  private async recoverCache(error: Error, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Clear corrupted cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (cacheName.includes('metamon')) {
            await caches.delete(cacheName);
          }
        }
      }

      // Clear IndexedDB if needed
      if ('indexedDB' in window) {
        // Implement IndexedDB clearing logic
      }

      return {
        success: true,
        strategy: 'cache_recovery',
        duration: Date.now() - startTime,
        fallbackApplied: false
      };
      
    } catch (recoveryError) {
      return {
        success: false,
        strategy: 'cache_recovery',
        duration: Date.now() - startTime,
        fallbackApplied: false,
        error: recoveryError as Error
      };
    }
  }

  private async recoverDOM(error: Error, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      if (!context.element) {
        throw new Error('Element context required for DOM recovery');
      }

      // Reset element to clean state
      const element = context.element;
      element.innerHTML = '';
      element.className = element.className.replace(/error|failed|broken/g, '');
      
      // Add recovery indicator
      const recoveryDiv = document.createElement('div');
      recoveryDiv.className = 'recovery-placeholder';
      recoveryDiv.innerHTML = 'Content recovered - reloading...';
      element.appendChild(recoveryDiv);

      return {
        success: true,
        strategy: 'dom_recovery',
        duration: Date.now() - startTime,
        fallbackApplied: true
      };
      
    } catch (recoveryError) {
      return {
        success: false,
        strategy: 'dom_recovery',
        duration: Date.now() - startTime,
        fallbackApplied: false,
        error: recoveryError as Error
      };
    }
  }

  private async genericFallback(error: Error, context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Apply most conservative fallback
      if (context.element) {
        this.applyGenericFallback(context.element);
      }

      // Log error for debugging
      this.log('error', 'Generic fallback applied for error:', error);

      return {
        success: true,
        strategy: 'generic_fallback',
        duration: Date.now() - startTime,
        fallbackApplied: true,
        metadata: { originalError: error.message }
      };
      
    } catch (recoveryError) {
      return {
        success: false,
        strategy: 'generic_fallback',
        duration: Date.now() - startTime,
        fallbackApplied: false,
        error: recoveryError as Error
      };
    }
  }

  /**
   * Helper methods for error detection
   */
  private isServiceWorkerError(error: Error): boolean {
    return /service.?worker|sw\.js|registration/i.test(error.message);
  }

  private isFrameworkLoadError(error: Error): boolean {
    return /framework|chunk.*load|module.*not.*found/i.test(error.message);
  }

  private isHydrationError(error: Error): boolean {
    return /hydration|hydrate/i.test(error.message);
  }

  private isNetworkError(error: Error): boolean {
    return /network|fetch|connection|timeout/i.test(error.message);
  }

  private isCacheError(error: Error): boolean {
    return /cache|storage|quota|indexeddb/i.test(error.message);
  }

  private isDOMError(error: Error): boolean {
    return /dom|element|node|document/i.test(error.message);
  }

  /**
   * Helper methods for recovery implementations
   */
  private async tryDirectFrameworkLoad(framework: FrameworkType): Promise<void> {
    const script = document.createElement('script');
    script.src = `/frameworks/${framework}.js`;
    
    return new Promise((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${framework} directly`));
      document.head.appendChild(script);
    });
  }

  private async tryCDNFrameworkLoad(framework: FrameworkType): Promise<void> {
    const cdnUrls = {
      reactjs: 'https://unpkg.com/react@latest/umd/react.production.min.js',
      vue: 'https://unpkg.com/vue@latest/dist/vue.global.prod.js'
    };

    const url = cdnUrls[framework as keyof typeof cdnUrls];
    if (!url) {
      throw new Error(`No CDN URL available for ${framework}`);
    }

    const script = document.createElement('script');
    script.src = url;
    
    return new Promise((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${framework} from CDN`));
      document.head.appendChild(script);
    });
  }

  private async tryFallbackFrameworkLoad(framework: FrameworkType): Promise<void> {
    // Implement minimal framework fallback
    const fallbackCode = this.generateFrameworkFallback(framework);
    const script = document.createElement('script');
    script.textContent = fallbackCode;
    document.head.appendChild(script);
  }

  private generateFrameworkFallback(framework: FrameworkType): string {
    const fallbacks = {
      reactjs: `
        window.React = window.React || {
          createElement: function() { return { type: 'div', props: {}, children: [] }; },
          Component: function() {},
          Fragment: function() {}
        };
      `,
      vue: `
        window.Vue = window.Vue || {
          createApp: function() { 
            return { mount: function() {} }; 
          }
        };
      `
    };

    return fallbacks[framework as keyof typeof fallbacks] || 
           `console.warn('No fallback available for framework: ${framework}');`;
  }

  private async retryHydration(element: Element, framework: FrameworkType): Promise<void> {
    // Implement hydration retry logic
    element.setAttribute('data-hydration-retry', 'true');
    
    // Trigger re-hydration event
    const event = new CustomEvent('metamon:retry-hydration', {
      detail: { framework, element }
    });
    element.dispatchEvent(event);
  }

  private convertToStaticContent(element: Element): void {
    element.classList.add('static-fallback');
    element.setAttribute('data-interactive', 'false');
    
    // Remove event listeners
    const clone = element.cloneNode(true);
    element.parentNode?.replaceChild(clone, element);
  }

  private applyMinimalFrameworkFallback(element: Element, framework: FrameworkType): void {
    element.innerHTML = `
      <div class="framework-fallback">
        <div class="fallback-message">
          ${framework} component temporarily unavailable
        </div>
        <button onclick="window.location.reload()" class="retry-button">
          Retry
        </button>
      </div>
    `;
  }

  private applyGenericFallback(element: Element): void {
    element.innerHTML = `
      <div class="generic-fallback">
        <div class="fallback-message">
          Content temporarily unavailable
        </div>
        <button onclick="window.location.reload()" class="retry-button">
          Refresh Page
        </button>
      </div>
    `;
  }

  private async testNetworkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('/health-check', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private enableOfflineMode(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.add('metamon-offline-mode');
    }
  }

  private getNetworkStatus(): 'online' | 'offline' | 'slow' {
    if (typeof navigator === 'undefined') return 'online';
    
    if (!navigator.onLine) return 'offline';
    
    // Check connection quality if available
    const connection = (navigator as any).connection;
    if (connection && ['slow-2g', '2g'].includes(connection.effectiveType)) {
      return 'slow';
    }
    
    return 'online';
  }

  private generateErrorKey(error: Error, context: RecoveryContext): string {
    const components = [
      error.message,
      context.framework || '',
      context.component || '',
      context.timestamp.toString()
    ];
    
    return btoa(components.join('|')).replace(/[^a-zA-Z0-9]/g, '');
  }

  private updateMetrics(result: RecoveryResult): void {
    if (result.success) {
      this.metrics.recoveredErrors++;
    } else {
      this.metrics.failedRecoveries++;
    }
    
    this.metrics.averageRecoveryTime = 
      (this.metrics.averageRecoveryTime + result.duration) / 2;
    
    this.metrics.recoverySuccessRate = 
      this.metrics.recoveredErrors / this.metrics.totalErrors;
  }

  private updateStrategyMetrics(strategyName: string): void {
    const current = this.metrics.strategiesUsed.get(strategyName) || 0;
    this.metrics.strategiesUsed.set(strategyName, current + 1);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: any[]): void {
    const prefix = '[Metamon Error Recovery]';
    if (args.length > 0) {
      console[level](`${prefix} ${message}`, ...args);
    } else {
      console[level](`${prefix} ${message}`);
    }
  }

  /**
   * Public API methods
   */

  /**
   * Get recovery metrics
   */
  getMetrics(): RecoveryMetrics {
    return { ...this.metrics };
  }

  /**
   * Get registered strategies
   */
  getStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(error: Error): boolean {
    const pattern = this.errorPatterns.find(p => p.pattern.test(error.message));
    return pattern ? pattern.recoverable : true; // Default to recoverable
  }

  /**
   * Get suggested strategies for an error
   */
  getSuggestedStrategies(error: Error): string[] {
    const pattern = this.errorPatterns.find(p => p.pattern.test(error.message));
    return pattern ? pattern.suggestedStrategies : ['generic_fallback'];
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      strategiesUsed: new Map(),
      averageRecoveryTime: 0,
      errorsByCategory: new Map(),
      recoverySuccessRate: 0
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.baseRecoveryManager.cleanup();
    this.activeRecoveries.clear();
  }
}

/**
 * Create comprehensive error recovery system
 */
export function createComprehensiveErrorRecovery(): ComprehensiveErrorRecovery {
  return new ComprehensiveErrorRecovery();
}