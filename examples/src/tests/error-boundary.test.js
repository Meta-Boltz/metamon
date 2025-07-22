/**
 * Tests for Error Boundary System
 * Verifies error handling, recovery strategies, and fallback UI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createErrorBoundary } from '../shared/error-boundary.js';
import { signal } from '../shared/signal-system.js';

// Mock router for testing
const createMockRouter = () => ({
  routes: new Map([
    ['/', { metadata: { title: 'Home' } }],
    ['/docs', { metadata: { title: 'Documentation' } }],
    ['/404', { metadata: { title: '404 - Not Found' } }]
  ]),
  push: vi.fn(),
  renderPage: vi.fn()
});

// Mock DOM environment
const mockDOM = () => {
  global.window = {
    addEventListener: vi.fn(),
    sessionStorage: {
      getItem: vi.fn(() => '[]'),
      setItem: vi.fn(),
      removeItem: vi.fn()
    },
    location: {
      href: 'http://localhost:3000/test',
      reload: vi.fn()
    },
    history: {
      pushState: vi.fn(),
      replaceState: vi.fn()
    }
  };

  global.document = {
    referrer: 'https://example.com',
    title: 'Test Page',
    querySelector: vi.fn(() => ({ innerHTML: '' })),
    getElementById: vi.fn()
  };

  global.navigator = {
    userAgent: 'Test Browser'
  };

  global.sessionStorage = global.window.sessionStorage;
};

describe('ErrorBoundary', () => {
  let router;
  let errorBoundary;

  beforeEach(() => {
    mockDOM();
    router = createMockRouter();
    errorBoundary = createErrorBoundary(router);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.sessionStorage;
  });

  describe('Initialization', () => {
    it('should initialize with default recovery strategies', () => {
      expect(errorBoundary.recoveryStrategies.size).toBeGreaterThan(0);
      expect(errorBoundary.recoveryStrategies.has('navigation')).toBe(true);
      expect(errorBoundary.recoveryStrategies.has('component_load')).toBe(true);
      expect(errorBoundary.recoveryStrategies.has('render')).toBe(true);
    });

    it('should set up global error handlers', () => {
      expect(global.window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(global.window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('should initialize error state signals', () => {
      expect(errorBoundary.hasError.value).toBe(false);
      expect(errorBoundary.currentError.value).toBe(null);
      expect(errorBoundary.isRecovering.value).toBe(false);
    });
  });

  describe('Error Logging', () => {
    it('should log errors to internal log', () => {
      const error = {
        id: 'test-error',
        type: 'test',
        message: 'Test error',
        timestamp: Date.now()
      };

      errorBoundary.logError(error);

      expect(errorBoundary.errorLog).toContain(error);
      expect(errorBoundary.errorHistory.value).toContain(error);
    });

    it('should store errors in session storage', () => {
      const error = {
        id: 'test-error',
        type: 'test',
        message: 'Test error',
        timestamp: Date.now()
      };

      errorBoundary.logError(error);

      expect(global.sessionStorage.setItem).toHaveBeenCalledWith(
        'mtm-error-log',
        expect.stringContaining('test-error')
      );
    });

    it('should limit log size', () => {
      // Add more errors than the max log size
      for (let i = 0; i < 150; i++) {
        errorBoundary.logError({
          id: `error-${i}`,
          type: 'test',
          message: `Test error ${i}`,
          timestamp: Date.now()
        });
      }

      expect(errorBoundary.errorLog.length).toBeLessThanOrEqual(100);
    });

    it('should handle session storage errors gracefully', () => {
      global.sessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      const consoleSpy = vi.spyOn(console, 'warn');

      errorBoundary.logError({
        id: 'test-error',
        type: 'test',
        message: 'Test error',
        timestamp: Date.now()
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log error to session storage:'),
        expect.any(Error)
      );
    });
  });

  describe('Global Error Handling', () => {
    it('should handle JavaScript errors', () => {
      const logSpy = vi.spyOn(errorBoundary, 'logError');
      const emitSpy = vi.spyOn(signal, 'emit');

      errorBoundary.handleGlobalError({
        type: 'javascript',
        message: 'Test JS error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        stack: 'Error stack trace'
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'global',
          subtype: 'javascript',
          message: 'Test JS error'
        })
      );

      expect(emitSpy).toHaveBeenCalledWith('global-error', expect.any(Object));
    });

    it('should handle promise rejections', () => {
      const logSpy = vi.spyOn(errorBoundary, 'logError');

      errorBoundary.handleGlobalError({
        type: 'promise',
        message: 'Unhandled promise rejection',
        error: new Error('Promise error')
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'global',
          subtype: 'promise',
          message: 'Unhandled promise rejection'
        })
      );
    });

    it('should identify critical errors', () => {
      const criticalError = { message: 'Cannot read property of undefined' };
      const nonCriticalError = { message: 'Minor warning' };

      expect(errorBoundary.isCriticalError(criticalError)).toBe(true);
      expect(errorBoundary.isCriticalError(nonCriticalError)).toBe(false);
    });
  });

  describe('Navigation Error Handling', () => {
    it('should handle navigation errors', async () => {
      const error = new Error('Navigation failed');
      const context = { path: '/test', params: {}, query: {} };

      const logSpy = vi.spyOn(errorBoundary, 'logError');
      const emitSpy = vi.spyOn(signal, 'emit');

      const result = await errorBoundary.handleNavigationError(error, context);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'navigation',
          message: 'Navigation failed',
          path: '/test'
        })
      );

      expect(emitSpy).toHaveBeenCalledWith('navigation-error', expect.any(Object));
    });

    it('should attempt navigation error recovery', async () => {
      const error = new Error('Navigation failed');
      const context = { path: '/nonexistent' };

      router.push.mockResolvedValue(true);

      const result = await errorBoundary.handleNavigationError(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe('redirected_home');
      expect(router.push).toHaveBeenCalledWith('/');
    });

    it('should fallback to 404 if home redirect fails', async () => {
      const error = new Error('Navigation failed');
      const context = { path: '/nonexistent' };

      router.push.mockRejectedValueOnce(new Error('Home failed'))
        .mockResolvedValueOnce(true);

      const result = await errorBoundary.handleNavigationError(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe('redirected_404');
      expect(router.push).toHaveBeenCalledWith('/404');
    });
  });

  describe('Component Load Error Handling', () => {
    it('should handle component loading errors', async () => {
      const error = new Error('Component load failed');
      const context = { route: '/test', loader: () => { }, retryCount: 0 };

      const logSpy = vi.spyOn(errorBoundary, 'logError');
      const emitSpy = vi.spyOn(signal, 'emit');

      const result = await errorBoundary.handleComponentLoadError(error, context);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'component_load',
          message: 'Component load failed',
          route: '/test'
        })
      );

      expect(emitSpy).toHaveBeenCalledWith('component-load-error', expect.any(Object));
    });

    it('should retry component loading', async () => {
      const error = new Error('Component load failed');
      const mockLoader = vi.fn().mockResolvedValue({ default: () => 'Component' });
      const context = { route: '/test', loader: mockLoader, retryCount: 0 };

      const result = await errorBoundary.handleComponentLoadError(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe('component_reloaded');
      expect(result.component).toBeDefined();
    });

    it('should use fallback component if available', async () => {
      const error = new Error('Component load failed');
      const fallbackComponent = () => 'Fallback';
      const context = { route: '/test', loader: vi.fn(), retryCount: 3 };

      errorBoundary.addFallbackComponent('/test', fallbackComponent);

      const result = await errorBoundary.handleComponentLoadError(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe('fallback_component');
      expect(result.component).toBe(fallbackComponent);
    });
  });

  describe('Render Error Handling', () => {
    it('should handle rendering errors', async () => {
      const error = new Error('Render failed');
      const context = { route: '/test', component: () => { }, params: {}, query: {} };

      const logSpy = vi.spyOn(errorBoundary, 'logError');
      const emitSpy = vi.spyOn(signal, 'emit');

      const result = await errorBoundary.handleRenderError(error, context);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'render',
          message: 'Render failed',
          route: '/test'
        })
      );

      expect(emitSpy).toHaveBeenCalledWith('render-error', expect.any(Object));
    });

    it('should create safe component for render recovery', async () => {
      const error = new Error('Render failed');
      const context = { route: '/test', component: () => { }, params: {}, query: {} };

      const result = await errorBoundary.handleRenderError(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe('safe_render');
      expect(result.component).toBeDefined();
    });
  });

  describe('Recovery Strategies', () => {
    it('should allow adding custom recovery strategies', () => {
      const customStrategy = vi.fn().mockResolvedValue({ success: true, action: 'custom' });

      errorBoundary.addRecoveryStrategy('custom', customStrategy);

      expect(errorBoundary.recoveryStrategies.has('custom')).toBe(true);
    });

    it('should execute recovery strategies', async () => {
      const mockStrategy = vi.fn().mockResolvedValue({ success: true, action: 'recovered' });
      errorBoundary.addRecoveryStrategy('test', mockStrategy);

      const error = new Error('Test error');
      const context = { test: 'data' };

      const result = await errorBoundary.attemptRecovery('test', error, context);

      expect(mockStrategy).toHaveBeenCalledWith(error, context);
      expect(result.success).toBe(true);
      expect(result.action).toBe('recovered');
    });

    it('should handle recovery strategy failures', async () => {
      const failingStrategy = vi.fn().mockRejectedValue(new Error('Strategy failed'));
      errorBoundary.addRecoveryStrategy('failing', failingStrategy);

      const result = await errorBoundary.attemptRecovery('failing', new Error('Test'), {});

      expect(result.success).toBe(false);
      expect(result.action).toBe('strategy_failed');
    });

    it('should set recovery state during recovery', async () => {
      const slowStrategy = vi.fn().mockImplementation(async () => {
        expect(errorBoundary.isRecovering.value).toBe(true);
        return { success: true, action: 'slow' };
      });

      errorBoundary.addRecoveryStrategy('slow', slowStrategy);

      await errorBoundary.attemptRecovery('slow', new Error('Test'), {});

      expect(errorBoundary.isRecovering.value).toBe(false);
    });
  });

  describe('Error UI', () => {
    it('should show error UI', () => {
      const mockContainer = { innerHTML: '' };
      global.document.querySelector.mockReturnValue(mockContainer);

      const error = {
        id: 'test-error',
        type: 'test',
        message: 'Test error',
        timestamp: Date.now()
      };

      errorBoundary.showErrorUI(error);

      expect(errorBoundary.hasError.value).toBe(true);
      expect(errorBoundary.currentError.value).toBe(error);
      expect(mockContainer.innerHTML).toContain('Something went wrong');
      expect(global.document.title).toBe('Error - Ultra-Modern MTM');
    });

    it('should create error UI with development details', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = {
        id: 'test-error',
        type: 'test',
        message: 'Test error',
        stack: 'Error stack trace',
        timestamp: Date.now()
      };

      const errorUI = errorBoundary.createErrorUI(error);

      expect(errorUI).toContain('Error Details (Development)');
      expect(errorUI).toContain('Test error');
      expect(errorUI).toContain('Error stack trace');

      process.env.NODE_ENV = originalEnv;
    });

    it('should create safe component', () => {
      const safeComponent = errorBoundary.createSafeComponent('/test', new Error('Test error'));
      const result = safeComponent();

      expect(result).toContain('Component Error');
      expect(result).toContain('/test');
      expect(result).toContain('Test error');
    });

    it('should clear error state', () => {
      errorBoundary.hasError.value = true;
      errorBoundary.currentError.value = { id: 'test' };

      errorBoundary.clearError();

      expect(errorBoundary.hasError.value).toBe(false);
      expect(errorBoundary.currentError.value).toBe(null);
    });
  });

  describe('Error Statistics', () => {
    it('should provide error statistics', () => {
      errorBoundary.logError({ type: 'navigation', message: 'Nav error 1' });
      errorBoundary.logError({ type: 'navigation', message: 'Nav error 2' });
      errorBoundary.logError({ type: 'render', message: 'Cannot read property of undefined' });

      const stats = errorBoundary.getErrorStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.navigation).toBe(2);
      expect(stats.byType.render).toBe(1);
      expect(stats.criticalCount).toBe(1);
      expect(stats.recent).toHaveLength(3);
    });

    it('should clear error log', () => {
      errorBoundary.logError({ type: 'test', message: 'Test error' });

      expect(errorBoundary.errorLog.length).toBe(1);

      errorBoundary.clearErrorLog();

      expect(errorBoundary.errorLog.length).toBe(0);
      expect(errorBoundary.errorHistory.value).toHaveLength(0);
      expect(global.sessionStorage.removeItem).toHaveBeenCalledWith('mtm-error-log');
    });

    it('should retrieve stored errors', () => {
      const storedErrors = [
        { id: 'stored-1', type: 'test', message: 'Stored error 1' },
        { id: 'stored-2', type: 'test', message: 'Stored error 2' }
      ];

      global.sessionStorage.getItem.mockReturnValue(JSON.stringify(storedErrors));

      const errors = errorBoundary.getStoredErrors();

      expect(errors).toEqual(storedErrors);
      expect(global.sessionStorage.getItem).toHaveBeenCalledWith('mtm-error-log');
    });

    it('should handle stored errors retrieval errors', () => {
      global.sessionStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const consoleSpy = vi.spyOn(console, 'warn');
      const errors = errorBoundary.getStoredErrors();

      expect(errors).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve stored errors:'),
        expect.any(Error)
      );
    });
  });

  describe('Fallback Components', () => {
    it('should add fallback components', () => {
      const fallbackComponent = () => 'Fallback';

      errorBoundary.addFallbackComponent('/test', fallbackComponent);

      expect(errorBoundary.fallbackComponents.has('/test')).toBe(true);
      expect(errorBoundary.fallbackComponents.get('/test')).toBe(fallbackComponent);
    });

    it('should use fallback components in recovery', async () => {
      const fallbackComponent = () => 'Fallback';
      errorBoundary.addFallbackComponent('/test', fallbackComponent);

      const error = new Error('Component failed');
      const context = { route: '/test', retryCount: 5 };

      const result = await errorBoundary.handleComponentLoadError(error, context);

      expect(result.success).toBe(true);
      expect(result.action).toBe('fallback_component');
      expect(result.component).toBe(fallbackComponent);
    });
  });

  describe('Error ID Generation', () => {
    it('should generate unique error IDs', () => {
      const id1 = errorBoundary.generateErrorId();
      const id2 = errorBoundary.generateErrorId();

      expect(id1).toMatch(/^error_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^error_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });
});

describe('Error Boundary Integration', () => {
  let router;
  let errorBoundary;

  beforeEach(() => {
    mockDOM();
    router = createMockRouter();
    errorBoundary = createErrorBoundary(router);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.sessionStorage;
  });

  it('should integrate with router for error handling', async () => {
    const error = new Error('Navigation failed');
    const context = { path: '/test' };

    router.push.mockResolvedValue(true);

    const result = await errorBoundary.handleNavigationError(error, context);

    expect(result.success).toBe(true);
    expect(router.push).toHaveBeenCalled();
  });

  it('should provide error statistics to router', () => {
    errorBoundary.logError({ type: 'navigation', message: 'Test error' });

    const stats = errorBoundary.getErrorStats();

    expect(stats.total).toBe(1);
    expect(stats.byType.navigation).toBe(1);
  });

  it('should handle missing session storage gracefully', () => {
    delete global.window.sessionStorage;
    delete global.sessionStorage;

    const errors = errorBoundary.getStoredErrors();
    expect(errors).toEqual([]);

    // Should not throw when logging
    expect(() => {
      errorBoundary.logError({ type: 'test', message: 'Test' });
    }).not.toThrow();
  });
});