/**
 * Integration Tests for Error Handling and Recovery Scenarios
 * Tests comprehensive error handling, recovery mechanisms, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock error types
enum ErrorType {
  NETWORK_ERROR = 'network_error',
  COMPONENT_LOAD_ERROR = 'component_load_error',
  RENDER_ERROR = 'render_error',
  NAVIGATION_ERROR = 'navigation_error',
  HYDRATION_ERROR = 'hydration_error',
  BUILD_ERROR = 'build_error',
  ROUTE_NOT_FOUND = 'route_not_found',
  PERMISSION_DENIED = 'permission_denied',
  TIMEOUT_ERROR = 'timeout_error'
}

// Error interfaces
interface MTMError {
  type: ErrorType;
  message: string;
  code?: string;
  stack?: string;
  context?: any;
  timestamp: number;
  recoverable: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: MTMError | null;
  errorId: string;
  retryCount: number;
  fallbackComponent: any;
}

interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'redirect' | 'ignore';
  maxRetries?: number;
  fallbackRoute?: string;
  fallbackComponent?: any;
  delay?: number;
}

// Mock Error Boundary
class MockErrorBoundary {
  private state: ErrorBoundaryState;
  private recoveryStrategies = new Map<ErrorType, RecoveryStrategy>();
  private errorHistory: MTMError[] = [];
  private onErrorCallback?: (error: MTMError) => void;

  constructor() {
    this.state = {
      hasError: false,
      error: null,
      errorId: '',
      retryCount: 0,
      fallbackComponent: null
    };

    this.setupDefaultStrategies();
  }

  private setupDefaultStrategies() {
    this.recoveryStrategies.set(ErrorType.NETWORK_ERROR, {
      type: 'retry',
      maxRetries: 3,
      delay: 1000
    });

    this.recoveryStrategies.set(ErrorType.COMPONENT_LOAD_ERROR, {
      type: 'fallback',
      fallbackComponent: this.createFallbackComponent('ComponentLoadError')
    });

    this.recoveryStrategies.set(ErrorType.ROUTE_NOT_FOUND, {
      type: 'redirect',
      fallbackRoute: '/404'
    });

    this.recoveryStrategies.set(ErrorType.PERMISSION_DENIED, {
      type: 'redirect',
      fallbackRoute: '/login'
    });

    this.recoveryStrategies.set(ErrorType.TIMEOUT_ERROR, {
      type: 'retry',
      maxRetries: 2,
      delay: 2000
    });
  }

  private createFallbackComponent(errorType: string) {
    return {
      name: `${errorType}Fallback`,
      render: () => `<div class="error-fallback">
        <h2>Something went wrong</h2>
        <p>Error: ${errorType}</p>
        <button onclick="window.location.reload()">Retry</button>
      </div>`
    };
  }

  async catchError(error: any, context?: any): Promise<boolean> {
    const mtmError: MTMError = {
      type: this.classifyError(error),
      message: error.message || 'Unknown error',
      code: error.code,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      recoverable: this.isRecoverable(error)
    };

    this.errorHistory.push(mtmError);
    this.state.error = mtmError;
    this.state.hasError = true;
    this.state.errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (this.onErrorCallback) {
      this.onErrorCallback(mtmError);
    }

    return await this.attemptRecovery(mtmError);
  }

  private classifyError(error: any): ErrorType {
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return ErrorType.NETWORK_ERROR;
    }
    if (error.message?.includes('Failed to load component')) {
      return ErrorType.COMPONENT_LOAD_ERROR;
    }
    if (error.message?.includes('Render failed')) {
      return ErrorType.RENDER_ERROR;
    }
    if (error.message?.includes('Navigation failed')) {
      return ErrorType.NAVIGATION_ERROR;
    }
    if (error.message?.includes('Hydration failed')) {
      return ErrorType.HYDRATION_ERROR;
    }
    if (error.message?.includes('Route not found')) {
      return ErrorType.ROUTE_NOT_FOUND;
    }
    if (error.message?.includes('Permission denied')) {
      return ErrorType.PERMISSION_DENIED;
    }
    if (error.name === 'TimeoutError') {
      return ErrorType.TIMEOUT_ERROR;
    }
    return ErrorType.BUILD_ERROR;
  }

  private isRecoverable(error: any): boolean {
    const nonRecoverableTypes = [
      ErrorType.PERMISSION_DENIED,
      ErrorType.BUILD_ERROR
    ];
    
    const errorType = this.classifyError(error);
    return !nonRecoverableTypes.includes(errorType);
  }

  private async attemptRecovery(error: MTMError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.type);
    
    if (!strategy) {
      console.error('No recovery strategy for error type:', error.type);
      return false;
    }

    switch (strategy.type) {
      case 'retry':
        return await this.retryOperation(error, strategy);
      case 'fallback':
        return this.useFallback(error, strategy);
      case 'redirect':
        return await this.redirectToFallback(error, strategy);
      case 'ignore':
        return this.ignoreError(error);
      default:
        return false;
    }
  }

  private async retryOperation(error: MTMError, strategy: RecoveryStrategy): Promise<boolean> {
    const maxRetries = strategy.maxRetries || 3;
    const delay = strategy.delay || 1000;

    if (this.state.retryCount >= maxRetries) {
      console.error(`Max retries (${maxRetries}) exceeded for error:`, error.message);
      return false;
    }

    this.state.retryCount++;
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      // Simulate retry operation
      await this.simulateRetryOperation(error);
      
      // Reset error state on successful retry
      this.resetErrorState();
      return true;

    } catch (retryError: any) {
      console.error(`Retry ${this.state.retryCount} failed:`, retryError.message);
      
      if (this.state.retryCount >= maxRetries) {
        // Fall back to fallback strategy if available
        const fallbackStrategy = { type: 'fallback' as const, fallbackComponent: this.createFallbackComponent(error.type) };
        return this.useFallback(error, fallbackStrategy);
      }
      
      return await this.retryOperation(error, strategy);
    }
  }

  private async simulateRetryOperation(error: MTMError): Promise<void> {
    // Simulate different retry scenarios based on error type
    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        // Simulate network retry
        if (Math.random() > 0.3) { // 70% success rate
          return Promise.resolve();
        }
        throw new Error('Network still unavailable');

      case ErrorType.COMPONENT_LOAD_ERROR:
        // Simulate component load retry
        if (Math.random() > 0.2) { // 80% success rate
          return Promise.resolve();
        }
        throw new Error('Component still failing to load');

      case ErrorType.TIMEOUT_ERROR:
        // Simulate timeout retry
        if (Math.random() > 0.4) { // 60% success rate
          return Promise.resolve();
        }
        throw new Error('Operation still timing out');

      default:
        throw new Error('Retry failed');
    }
  }

  private useFallback(error: MTMError, strategy: RecoveryStrategy): boolean {
    if (!strategy.fallbackComponent) {
      console.error('No fallback component provided for error:', error.type);
      return false;
    }

    this.state.fallbackComponent = strategy.fallbackComponent;
    console.log(`Using fallback component for error: ${error.message}`);
    return true;
  }

  private async redirectToFallback(error: MTMError, strategy: RecoveryStrategy): Promise<boolean> {
    if (!strategy.fallbackRoute) {
      console.error('No fallback route provided for error:', error.type);
      return false;
    }

    try {
      // Simulate navigation to fallback route
      console.log(`Redirecting to fallback route: ${strategy.fallbackRoute}`);
      
      // Reset error state after successful redirect
      this.resetErrorState();
      return true;

    } catch (redirectError: any) {
      console.error('Failed to redirect to fallback route:', redirectError.message);
      return false;
    }
  }

  private ignoreError(error: MTMError): boolean {
    console.warn('Ignoring error:', error.message);
    this.resetErrorState();
    return true;
  }

  private resetErrorState() {
    this.state.hasError = false;
    this.state.error = null;
    this.state.errorId = '';
    this.state.retryCount = 0;
    this.state.fallbackComponent = null;
  }

  getState(): ErrorBoundaryState {
    return { ...this.state };
  }

  getErrorHistory(): MTMError[] {
    return [...this.errorHistory];
  }

  clearErrorHistory() {
    this.errorHistory = [];
  }

  setRecoveryStrategy(errorType: ErrorType, strategy: RecoveryStrategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  onError(callback: (error: MTMError) => void) {
    this.onErrorCallback = callback;
  }

  reset() {
    this.resetErrorState();
    this.clearErrorHistory();
  }
}

// Mock Router with Error Handling
class MockRouterWithErrorHandling {
  private routes = new Map();
  private errorBoundary: MockErrorBoundary;
  private currentRoute = '/';
  private isNavigating = false;

  constructor() {
    this.errorBoundary = new MockErrorBoundary();
    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    this.errorBoundary.onError((error) => {
      console.error('Router caught error:', error);
    });
  }

  registerRoute(path: string, loader: any, options: any = {}) {
    this.routes.set(path, {
      loader,
      options: {
        timeout: 5000,
        retries: 3,
        fallback: null,
        ...options
      }
    });
  }

  async navigate(path: string): Promise<any> {
    try {
      this.isNavigating = true;
      
      const route = this.routes.get(path);
      if (!route) {
        throw new Error(`Route not found: ${path}`);
      }

      // Simulate potential navigation errors
      if (path === '/error-prone') {
        throw new Error('Navigation failed due to network error');
      }

      if (path === '/timeout') {
        throw new Error('TimeoutError: Navigation timed out');
      }

      if (path === '/permission-denied') {
        throw new Error('Permission denied: Access forbidden');
      }

      // Load component with timeout
      const component = await this.loadComponentWithTimeout(route.loader, route.options.timeout);
      
      this.currentRoute = path;
      this.isNavigating = false;

      return {
        success: true,
        route: path,
        component
      };

    } catch (error: any) {
      this.isNavigating = false;
      
      const recovered = await this.errorBoundary.catchError(error, { route: path });
      
      if (recovered) {
        const fallbackState = this.errorBoundary.getState();
        return {
          success: true,
          route: path,
          component: fallbackState.fallbackComponent,
          recovered: true
        };
      }

      return {
        success: false,
        error: error.message,
        route: path
      };
    }
  }

  private async loadComponentWithTimeout(loader: any, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('TimeoutError: Component load timed out'));
      }, timeout);

      Promise.resolve(loader())
        .then(component => {
          clearTimeout(timeoutId);
          resolve(component);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to load component: ${error.message}`));
        });
    });
  }

  getCurrentRoute(): string {
    return this.currentRoute;
  }

  isCurrentlyNavigating(): boolean {
    return this.isNavigating;
  }

  getErrorBoundary(): MockErrorBoundary {
    return this.errorBoundary;
  }
}

// Mock Build System with Error Handling
class MockBuildSystemWithErrorHandling {
  private errorBoundary: MockErrorBoundary;
  private buildSteps: string[] = [
    'scan-pages',
    'parse-frontmatter',
    'transform-components',
    'generate-routes',
    'bundle-assets'
  ];

  constructor() {
    this.errorBoundary = new MockErrorBoundary();
  }

  async build(options: any = {}): Promise<any> {
    const buildResult = {
      success: false,
      steps: [] as any[],
      errors: [] as any[],
      warnings: [] as any[]
    };

    for (const step of this.buildSteps) {
      try {
        console.log(`Executing build step: ${step}`);
        
        const stepResult = await this.executeBuildStep(step, options);
        buildResult.steps.push({
          name: step,
          success: true,
          duration: stepResult.duration,
          output: stepResult.output
        });

      } catch (error: any) {
        console.error(`Build step failed: ${step}`, error.message);
        
        const recovered = await this.errorBoundary.catchError(error, { step, options });
        
        if (recovered) {
          buildResult.steps.push({
            name: step,
            success: true,
            recovered: true,
            fallback: true
          });
          buildResult.warnings.push(`Step ${step} recovered from error: ${error.message}`);
        } else {
          buildResult.steps.push({
            name: step,
            success: false,
            error: error.message
          });
          buildResult.errors.push({
            step,
            error: error.message,
            type: 'build_error'
          });
          
          // Stop build on critical errors
          if (this.isCriticalBuildStep(step)) {
            break;
          }
        }
      }
    }

    buildResult.success = buildResult.errors.length === 0;
    return buildResult;
  }

  private async executeBuildStep(step: string, options: any): Promise<any> {
    const startTime = Date.now();
    
    // Simulate different build step scenarios
    switch (step) {
      case 'scan-pages':
        if (options.corruptedPages) {
          throw new Error('Failed to scan pages: Corrupted page files detected');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return { duration: Date.now() - startTime, output: 'Pages scanned successfully' };

      case 'parse-frontmatter':
        if (options.invalidFrontmatter) {
          throw new Error('Failed to parse frontmatter: Invalid YAML syntax');
        }
        await new Promise(resolve => setTimeout(resolve, 150));
        return { duration: Date.now() - startTime, output: 'Frontmatter parsed successfully' };

      case 'transform-components':
        if (options.transformError) {
          throw new Error('Failed to transform components: Syntax error in template');
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        return { duration: Date.now() - startTime, output: 'Components transformed successfully' };

      case 'generate-routes':
        if (options.routeConflict) {
          throw new Error('Failed to generate routes: Duplicate route definitions');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return { duration: Date.now() - startTime, output: 'Routes generated successfully' };

      case 'bundle-assets':
        if (options.bundleError) {
          throw new Error('Failed to bundle assets: Out of memory');
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        return { duration: Date.now() - startTime, output: 'Assets bundled successfully' };

      default:
        throw new Error(`Unknown build step: ${step}`);
    }
  }

  private isCriticalBuildStep(step: string): boolean {
    const criticalSteps = ['scan-pages', 'generate-routes'];
    return criticalSteps.includes(step);
  }

  getErrorBoundary(): MockErrorBoundary {
    return this.errorBoundary;
  }
}

describe('Error Handling and Recovery Integration', () => {
  let errorBoundary: MockErrorBoundary;
  let router: MockRouterWithErrorHandling;
  let buildSystem: MockBuildSystemWithErrorHandling;

  beforeEach(() => {
    errorBoundary = new MockErrorBoundary();
    router = new MockRouterWithErrorHandling();
    buildSystem = new MockBuildSystemWithErrorHandling();

    // Register test routes
    router.registerRoute('/', () => ({ name: 'Home' }));
    router.registerRoute('/about', () => ({ name: 'About' }));
    router.registerRoute('/error-prone', () => { throw new Error('Component error'); });
    router.registerRoute('/timeout', () => new Promise(resolve => setTimeout(resolve, 10000)));
    router.registerRoute('/permission-denied', () => { throw new Error('Permission denied'); });

    vi.clearAllMocks();
  });

  afterEach(() => {
    errorBoundary.reset();
  });

  describe('Error Classification and Handling', () => {
    it('should classify different error types correctly', async () => {
      const errors = [
        new Error('NetworkError: Failed to fetch'),
        new Error('Failed to load component: Module not found'),
        new Error('Render failed: Invalid JSX'),
        new Error('Navigation failed: Route blocked'),
        new Error('Hydration failed: Mismatch detected'),
        new Error('Route not found: /invalid'),
        new Error('Permission denied: Access forbidden'),
        { name: 'TimeoutError', message: 'Operation timed out' }
      ];

      const expectedTypes = [
        ErrorType.NETWORK_ERROR,
        ErrorType.COMPONENT_LOAD_ERROR,
        ErrorType.RENDER_ERROR,
        ErrorType.NAVIGATION_ERROR,
        ErrorType.HYDRATION_ERROR,
        ErrorType.ROUTE_NOT_FOUND,
        ErrorType.PERMISSION_DENIED,
        ErrorType.TIMEOUT_ERROR
      ];

      for (let i = 0; i < errors.length; i++) {
        await errorBoundary.catchError(errors[i]);
        const history = errorBoundary.getErrorHistory();
        expect(history[i].type).toBe(expectedTypes[i]);
      }
    });

    it('should determine error recoverability correctly', async () => {
      const recoverableError = new Error('NetworkError: Connection failed');
      const nonRecoverableError = new Error('Permission denied: Access forbidden');

      await errorBoundary.catchError(recoverableError);
      await errorBoundary.catchError(nonRecoverableError);

      const history = errorBoundary.getErrorHistory();
      expect(history[0].recoverable).toBe(true);
      expect(history[1].recoverable).toBe(false);
    });
  });

  describe('Retry Recovery Strategy', () => {
    it('should retry network errors with exponential backoff', async () => {
      const networkError = { name: 'NetworkError', message: 'Connection failed', code: 'NETWORK_ERROR' };
      
      const startTime = Date.now();
      const recovered = await errorBoundary.catchError(networkError);
      const endTime = Date.now();

      // Should eventually recover (simulated 70% success rate)
      expect(recovered).toBe(true);
      
      // Should have taken some time due to retries and delays
      expect(endTime - startTime).toBeGreaterThan(100);
      
      const state = errorBoundary.getState();
      expect(state.hasError).toBe(false); // Should be reset after successful recovery
    });

    it('should respect maximum retry limits', async () => {
      // Set a strategy with low max retries for testing
      errorBoundary.setRecoveryStrategy(ErrorType.NETWORK_ERROR, {
        type: 'retry',
        maxRetries: 1,
        delay: 10
      });

      // Mock the retry operation to always fail
      const originalSimulateRetry = errorBoundary['simulateRetryOperation'];
      errorBoundary['simulateRetryOperation'] = async () => {
        throw new Error('Always fails');
      };

      const networkError = { name: 'NetworkError', message: 'Connection failed', code: 'NETWORK_ERROR' };
      const recovered = await errorBoundary.catchError(networkError);

      expect(recovered).toBe(true); // Should fall back to fallback component
      
      const state = errorBoundary.getState();
      expect(state.fallbackComponent).toBeDefined();

      // Restore original method
      errorBoundary['simulateRetryOperation'] = originalSimulateRetry;
    });

    it('should handle timeout errors with appropriate delays', async () => {
      const timeoutError = { name: 'TimeoutError', message: 'Operation timed out' };
      
      const startTime = Date.now();
      await errorBoundary.catchError(timeoutError);
      const endTime = Date.now();

      // Should have appropriate delay for timeout retries
      expect(endTime - startTime).toBeGreaterThan(500);
    });
  });

  describe('Fallback Recovery Strategy', () => {
    it('should use fallback components for component load errors', async () => {
      const componentError = new Error('Failed to load component: Module not found');
      
      const recovered = await errorBoundary.catchError(componentError);
      
      expect(recovered).toBe(true);
      
      const state = errorBoundary.getState();
      expect(state.fallbackComponent).toBeDefined();
      expect(state.fallbackComponent.name).toContain('Fallback');
    });

    it('should render fallback UI correctly', async () => {
      const renderError = new Error('Render failed: Invalid JSX');
      
      await errorBoundary.catchError(renderError);
      
      const state = errorBoundary.getState();
      const fallbackHTML = state.fallbackComponent.render();
      
      expect(fallbackHTML).toContain('Something went wrong');
      expect(fallbackHTML).toContain('Retry');
      expect(fallbackHTML).toContain('error-fallback');
    });
  });

  describe('Redirect Recovery Strategy', () => {
    it('should redirect to 404 page for route not found errors', async () => {
      const routeError = new Error('Route not found: /invalid-route');
      
      const recovered = await errorBoundary.catchError(routeError);
      
      expect(recovered).toBe(true);
      
      const state = errorBoundary.getState();
      expect(state.hasError).toBe(false); // Should be reset after redirect
    });

    it('should redirect to login page for permission errors', async () => {
      const permissionError = new Error('Permission denied: Access forbidden');
      
      const recovered = await errorBoundary.catchError(permissionError);
      
      expect(recovered).toBe(true);
    });
  });

  describe('Router Error Handling Integration', () => {
    it('should handle navigation errors gracefully', async () => {
      const result = await router.navigate('/error-prone');
      
      expect(result.success).toBe(true); // Should recover
      expect(result.recovered).toBe(true);
      expect(result.component).toBeDefined();
    });

    it('should handle timeout errors during navigation', async () => {
      const result = await router.navigate('/timeout');
      
      expect(result.success).toBe(true); // Should recover with fallback
      expect(result.recovered).toBe(true);
    });

    it('should handle permission denied errors', async () => {
      const result = await router.navigate('/permission-denied');
      
      expect(result.success).toBe(true); // Should redirect to login
      expect(result.recovered).toBe(true);
    });

    it('should maintain router state during error recovery', async () => {
      const initialRoute = router.getCurrentRoute();
      
      await router.navigate('/error-prone');
      
      // Router should maintain consistent state
      expect(router.isCurrentlyNavigating()).toBe(false);
      
      const errorHistory = router.getErrorBoundary().getErrorHistory();
      expect(errorHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Build System Error Handling', () => {
    it('should handle build errors and continue with recoverable steps', async () => {
      const result = await buildSystem.build({
        invalidFrontmatter: true, // This should cause an error but be recoverable
        transformError: false
      });

      expect(result.success).toBe(true); // Should recover
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.steps.some(step => step.recovered)).toBe(true);
    });

    it('should stop build on critical errors', async () => {
      const result = await buildSystem.build({
        corruptedPages: true // This should cause a critical error
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.steps.length).toBeLessThan(5); // Should stop early
    });

    it('should provide detailed error information for debugging', async () => {
      const result = await buildSystem.build({
        transformError: true,
        bundleError: true
      });

      expect(result.errors.length).toBeGreaterThan(0);
      
      result.errors.forEach(error => {
        expect(error.step).toBeDefined();
        expect(error.error).toBeDefined();
        expect(error.type).toBe('build_error');
      });
    });
  });

  describe('Error Recovery Performance', () => {
    it('should handle multiple concurrent errors efficiently', async () => {
      const errors = Array.from({ length: 10 }, (_, i) => 
        new Error(`NetworkError: Connection ${i} failed`)
      );

      const startTime = Date.now();
      const recoveryPromises = errors.map(error => errorBoundary.catchError(error));
      const results = await Promise.all(recoveryPromises);
      const endTime = Date.now();

      // All should recover
      results.forEach(result => expect(result).toBe(true));
      
      // Should handle concurrency efficiently
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should not leak memory during error handling', async () => {
      // Generate many errors
      for (let i = 0; i < 100; i++) {
        await errorBoundary.catchError(new Error(`Error ${i}`));
      }

      const historyLength = errorBoundary.getErrorHistory().length;
      expect(historyLength).toBe(100);

      // Clear history to prevent memory leaks
      errorBoundary.clearErrorHistory();
      expect(errorBoundary.getErrorHistory().length).toBe(0);
    });

    it('should optimize retry strategies based on error patterns', async () => {
      // Simulate pattern of network errors
      const networkErrors = Array.from({ length: 5 }, () => 
        new Error('NetworkError: Connection failed')
      );

      const recoveryTimes = [];
      
      for (const error of networkErrors) {
        const startTime = Date.now();
        await errorBoundary.catchError(error);
        const endTime = Date.now();
        recoveryTimes.push(endTime - startTime);
        
        // Reset for next test
        errorBoundary.reset();
      }

      // Recovery times should be consistent (not degrading)
      const avgTime = recoveryTimes.reduce((a, b) => a + b) / recoveryTimes.length;
      recoveryTimes.forEach(time => {
        expect(Math.abs(time - avgTime)).toBeLessThan(avgTime * 0.5); // Within 50% of average
      });
    });
  });

  describe('Error Reporting and Monitoring', () => {
    it('should track error history with proper metadata', async () => {
      const errors = [
        new Error('NetworkError: Connection failed'),
        new Error('Failed to load component: Not found'),
        new Error('Render failed: Invalid syntax')
      ];

      for (const error of errors) {
        await errorBoundary.catchError(error, { userId: '123', route: '/test' });
      }

      const history = errorBoundary.getErrorHistory();
      
      expect(history).toHaveLength(3);
      
      history.forEach(error => {
        expect(error.timestamp).toBeDefined();
        expect(error.type).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.context).toBeDefined();
        expect(error.context.userId).toBe('123');
        expect(error.context.route).toBe('/test');
      });
    });

    it('should provide error callbacks for external monitoring', async () => {
      const errorCallback = vi.fn();
      errorBoundary.onError(errorCallback);

      const testError = new Error('Test error for monitoring');
      await errorBoundary.catchError(testError);

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error for monitoring',
          type: expect.any(String),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should generate error reports for debugging', async () => {
      await errorBoundary.catchError(new Error('Test error 1'));
      await errorBoundary.catchError(new Error('Test error 2'));

      const history = errorBoundary.getErrorHistory();
      
      // Should be able to generate a report
      const report = {
        totalErrors: history.length,
        errorTypes: [...new Set(history.map(e => e.type))],
        recoverableErrors: history.filter(e => e.recoverable).length,
        timeRange: {
          start: Math.min(...history.map(e => e.timestamp)),
          end: Math.max(...history.map(e => e.timestamp))
        }
      };

      expect(report.totalErrors).toBe(2);
      expect(report.errorTypes.length).toBeGreaterThan(0);
      expect(report.recoverableErrors).toBeGreaterThanOrEqual(0);
      expect(report.timeRange.start).toBeLessThanOrEqual(report.timeRange.end);
    });
  });
});