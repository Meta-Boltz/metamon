/**
 * Error Boundary System for Ultra-Modern MTM Router
 * Provides comprehensive error handling for navigation and rendering errors
 */

import { signal } from './signal-system.js';

export class ErrorBoundary {
  constructor(router) {
    this.router = router;
    this.errorLog = [];
    this.maxLogSize = 100;

    // Error state signals
    this.hasError = signal.signal('error-boundary-has-error', false);
    this.currentError = signal.signal('error-boundary-current-error', null);
    this.errorHistory = signal.signal('error-boundary-history', []);
    this.isRecovering = signal.signal('error-boundary-recovering', false);

    // Error recovery strategies
    this.recoveryStrategies = new Map();
    this.fallbackComponents = new Map();

    // Initialize error handlers
    this.initializeErrorHandlers();
    this.setupDefaultRecoveryStrategies();
  }

  /**
   * Initialize global error handlers
   */
  initializeErrorHandlers() {
    if (typeof window === 'undefined') return;

    // Global error handler for unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleGlobalError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack
      });
    });

    // Global handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleGlobalError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled promise rejection',
        error: event.reason,
        stack: event.reason?.stack
      });
    });

    console.log('🛡️ Error boundary initialized with global error handlers');
  }

  /**
   * Setup default recovery strategies
   */
  setupDefaultRecoveryStrategies() {
    // Navigation error recovery
    this.addRecoveryStrategy('navigation', async (error, context) => {
      console.log('🔄 Attempting navigation error recovery:', error.message);

      // Try to navigate to home page
      if (context.path !== '/') {
        try {
          await this.router.push('/');
          return { success: true, action: 'redirected_home' };
        } catch (homeError) {
          console.error('Failed to redirect to home:', homeError);
        }
      }

      // Try to navigate to 404 page
      if (context.path !== '/404') {
        try {
          await this.router.push('/404');
          return { success: true, action: 'redirected_404' };
        } catch (notFoundError) {
          console.error('Failed to redirect to 404:', notFoundError);
        }
      }

      return { success: false, action: 'fallback_ui' };
    });

    // Component loading error recovery
    this.addRecoveryStrategy('component_load', async (error, context) => {
      console.log('🔄 Attempting component load error recovery:', error.message);

      // Try to reload the component
      if (context.retryCount < 3) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000 * (context.retryCount + 1)));
          const module = await context.loader();
          return {
            success: true,
            action: 'component_reloaded',
            component: module.default || module
          };
        } catch (retryError) {
          console.warn(`Component reload attempt ${context.retryCount + 1} failed:`, retryError);
        }
      }

      // Use fallback component if available
      const fallback = this.fallbackComponents.get(context.route);
      if (fallback) {
        return {
          success: true,
          action: 'fallback_component',
          component: fallback
        };
      }

      return { success: false, action: 'error_page' };
    });

    // Rendering error recovery
    this.addRecoveryStrategy('render', async (error, context) => {
      console.log('🔄 Attempting render error recovery:', error.message);

      // Try to re-render with safe mode
      try {
        const safeComponent = this.createSafeComponent(context.route, error);
        return {
          success: true,
          action: 'safe_render',
          component: safeComponent
        };
      } catch (safeError) {
        console.error('Safe render failed:', safeError);
      }

      return { success: false, action: 'error_page' };
    });
  }

  /**
   * Handle global errors
   */
  handleGlobalError(errorInfo) {
    const error = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      type: 'global',
      subtype: errorInfo.type,
      message: errorInfo.message,
      filename: errorInfo.filename,
      lineno: errorInfo.lineno,
      colno: errorInfo.colno,
      stack: errorInfo.stack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : ''
    };

    this.logError(error);

    // Don't show error UI for global errors unless they're critical
    if (this.isCriticalError(error)) {
      this.showErrorUI(error);
    }

    // Emit error event for external handling
    signal.emit('global-error', error);
  }

  /**
   * Handle navigation errors
   */
  async handleNavigationError(error, context = {}) {
    const errorInfo = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      type: 'navigation',
      message: error.message,
      stack: error.stack,
      path: context.path,
      params: context.params,
      query: context.query,
      referrer: typeof window !== 'undefined' ? document.referrer : ''
    };

    this.logError(errorInfo);
    signal.emit('navigation-error', errorInfo);

    // Attempt recovery
    const recovery = await this.attemptRecovery('navigation', error, {
      ...context,
      retryCount: context.retryCount || 0
    });

    if (recovery.success) {
      console.log(`✅ Navigation error recovered: ${recovery.action}`);
      return recovery;
    } else {
      console.error('❌ Navigation error recovery failed');
      this.showErrorUI(errorInfo);
      return { success: false, error: errorInfo };
    }
  }

  /**
   * Handle component loading errors
   */
  async handleComponentLoadError(error, context = {}) {
    const errorInfo = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      type: 'component_load',
      message: error.message,
      stack: error.stack,
      route: context.route,
      loader: context.loader?.toString(),
      retryCount: context.retryCount || 0
    };

    this.logError(errorInfo);
    signal.emit('component-load-error', errorInfo);

    // Attempt recovery
    const recovery = await this.attemptRecovery('component_load', error, {
      ...context,
      retryCount: (context.retryCount || 0) + 1
    });

    if (recovery.success) {
      console.log(`✅ Component load error recovered: ${recovery.action}`);
      return recovery;
    } else {
      console.error('❌ Component load error recovery failed');
      this.showErrorUI(errorInfo);
      return { success: false, error: errorInfo };
    }
  }

  /**
   * Handle rendering errors
   */
  async handleRenderError(error, context = {}) {
    const errorInfo = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      type: 'render',
      message: error.message,
      stack: error.stack,
      route: context.route,
      component: context.component?.name || 'Unknown',
      params: context.params,
      query: context.query
    };

    this.logError(errorInfo);
    signal.emit('render-error', errorInfo);

    // Attempt recovery
    const recovery = await this.attemptRecovery('render', error, context);

    if (recovery.success) {
      console.log(`✅ Render error recovered: ${recovery.action}`);
      return recovery;
    } else {
      console.error('❌ Render error recovery failed');
      this.showErrorUI(errorInfo);
      return { success: false, error: errorInfo };
    }
  }

  /**
   * Attempt error recovery using registered strategies
   */
  async attemptRecovery(errorType, error, context) {
    const strategy = this.recoveryStrategies.get(errorType);

    if (!strategy) {
      console.warn(`No recovery strategy found for error type: ${errorType}`);
      return { success: false, action: 'no_strategy' };
    }

    try {
      this.isRecovering.value = true;
      const result = await strategy(error, context);
      return result;
    } catch (recoveryError) {
      console.error('Recovery strategy failed:', recoveryError);
      return { success: false, action: 'strategy_failed', error: recoveryError };
    } finally {
      this.isRecovering.value = false;
    }
  }

  /**
   * Show error UI to the user
   */
  showErrorUI(errorInfo) {
    if (typeof window === 'undefined') return;

    this.hasError.value = true;
    this.currentError.value = errorInfo;

    const appContainer = document.querySelector('#app') || document.body;
    if (appContainer) {
      const errorUI = this.createErrorUI(errorInfo);
      appContainer.innerHTML = errorUI;

      // Attach error UI event listeners
      this.attachErrorUIListeners();
    }

    // Update document title
    document.title = 'Error - Ultra-Modern MTM';
  }

  /**
   * Create error UI HTML
   */
  createErrorUI(errorInfo) {
    const isDevelopment = process.env.NODE_ENV === 'development';

    return `
      <div class="error-boundary">
        <div class="error-container">
          <div class="error-header">
            <h1>⚠️ Something went wrong</h1>
            <p>We encountered an unexpected error. Don't worry, we're working to fix it!</p>
          </div>

          <div class="error-actions">
            <button id="error-retry" class="button primary">
              🔄 Try Again
            </button>
            <button id="error-home" class="button secondary">
              🏠 Go Home
            </button>
            <button id="error-reload" class="button secondary">
              ↻ Reload Page
            </button>
          </div>

          ${isDevelopment ? `
            <div class="error-details">
              <details>
                <summary>Error Details (Development)</summary>
                <div class="error-info">
                  <p><strong>Type:</strong> ${errorInfo.type}</p>
                  <p><strong>Message:</strong> ${errorInfo.message}</p>
                  <p><strong>Time:</strong> ${new Date(errorInfo.timestamp).toLocaleString()}</p>
                  ${errorInfo.route ? `<p><strong>Route:</strong> ${errorInfo.route}</p>` : ''}
                  ${errorInfo.path ? `<p><strong>Path:</strong> ${errorInfo.path}</p>` : ''}
                </div>
                ${errorInfo.stack ? `
                  <div class="error-stack">
                    <h4>Stack Trace:</h4>
                    <pre>${errorInfo.stack}</pre>
                  </div>
                ` : ''}
              </details>
            </div>
          ` : ''}

          <div class="error-help">
            <h3>What can you do?</h3>
            <ul>
              <li>Try refreshing the page</li>
              <li>Go back to the homepage</li>
              <li>Check your internet connection</li>
              <li>If the problem persists, please report it</li>
            </ul>
          </div>

          <div class="error-report">
            <button id="error-report" class="button tertiary">
              📝 Report This Error
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create a safe component for error recovery
   */
  createSafeComponent(route, error) {
    return () => {
      return `
        <div class="safe-component">
          <div class="safe-header">
            <h2>⚠️ Component Error</h2>
            <p>This page encountered an error but we've loaded a safe version.</p>
          </div>
          
          <div class="safe-content">
            <p>The page you requested (${route}) had a rendering error.</p>
            <p>Error: ${error.message}</p>
          </div>

          <div class="safe-actions">
            <button onclick="window.location.reload()" class="button primary">
              Reload Page
            </button>
            <button onclick="window.location.href='/'" class="button secondary">
              Go Home
            </button>
          </div>
        </div>
      `;
    };
  }

  /**
   * Attach event listeners to error UI
   */
  attachErrorUIListeners() {
    const retryButton = document.getElementById('error-retry');
    const homeButton = document.getElementById('error-home');
    const reloadButton = document.getElementById('error-reload');
    const reportButton = document.getElementById('error-report');

    if (retryButton) {
      retryButton.addEventListener('click', () => {
        this.retryLastAction();
      });
    }

    if (homeButton) {
      homeButton.addEventListener('click', () => {
        this.goHome();
      });
    }

    if (reloadButton) {
      reloadButton.addEventListener('click', () => {
        window.location.reload();
      });
    }

    if (reportButton) {
      reportButton.addEventListener('click', () => {
        this.reportError();
      });
    }
  }

  /**
   * Retry the last failed action
   */
  async retryLastAction() {
    const currentError = this.currentError.value;
    if (!currentError) return;

    this.clearError();

    try {
      if (currentError.type === 'navigation') {
        await this.router.push(currentError.path || '/');
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Retry failed:', error);
      this.showErrorUI(currentError);
    }
  }

  /**
   * Navigate to home page
   */
  async goHome() {
    this.clearError();

    try {
      await this.router.push('/');
    } catch (error) {
      console.error('Failed to navigate home:', error);
      window.location.href = '/';
    }
  }

  /**
   * Report error to external service
   */
  reportError() {
    const currentError = this.currentError.value;
    if (!currentError) return;

    // In a real application, this would send to an error reporting service
    console.log('📝 Reporting error:', currentError);

    // Emit event for external error reporting
    signal.emit('error-reported', {
      error: currentError,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    alert('Error reported. Thank you for helping us improve!');
  }

  /**
   * Clear current error state
   */
  clearError() {
    this.hasError.value = false;
    this.currentError.value = null;
  }

  /**
   * Log error to internal log and external services
   */
  logError(errorInfo) {
    // Add to internal log
    this.errorLog.push(errorInfo);

    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Update error history signal
    this.errorHistory.value = [...this.errorLog];

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Error logged:', errorInfo);
    }

    // Store in session storage for debugging
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const existing = JSON.parse(sessionStorage.getItem('mtm-error-log') || '[]');
        existing.push(errorInfo);

        // Keep only last 50 entries
        const recent = existing.slice(-50);
        sessionStorage.setItem('mtm-error-log', JSON.stringify(recent));
      } catch (error) {
        console.warn('Failed to log error to session storage:', error);
      }
    }
  }

  /**
   * Check if an error is critical
   */
  isCriticalError(error) {
    const criticalPatterns = [
      /cannot read property/i,
      /undefined is not a function/i,
      /network error/i,
      /failed to fetch/i,
      /script error/i
    ];

    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a custom recovery strategy
   */
  addRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
    console.log(`🛡️ Added recovery strategy for: ${errorType}`);
  }

  /**
   * Add a fallback component for a route
   */
  addFallbackComponent(route, component) {
    this.fallbackComponents.set(route, component);
    console.log(`🛡️ Added fallback component for route: ${route}`);
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      recent: this.errorLog.slice(-10),
      criticalCount: 0
    };

    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      if (this.isCriticalError(error)) {
        stats.criticalCount++;
      }
    });

    return stats;
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
    this.errorHistory.value = [];

    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('mtm-error-log');
    }

    console.log('🧹 Error log cleared');
  }

  /**
   * Get errors from session storage
   */
  getStoredErrors() {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return [];
    }

    try {
      return JSON.parse(sessionStorage.getItem('mtm-error-log') || '[]');
    } catch (error) {
      console.warn('Failed to retrieve stored errors:', error);
      return [];
    }
  }
}

export function createErrorBoundary(router) {
  return new ErrorBoundary(router);
}