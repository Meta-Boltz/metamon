/**
 * Tests for Progressive Enhancement Fallback System
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { ProgressiveEnhancementFallback } from '../ssr-optimization/progressive-enhancement-fallback.js';
import { 
  ComponentDefinition, 
  HydrationTarget, 
  FallbackStrategy, 
  LoadPriority 
} from '../types/ssr-optimization.js';

describe('ProgressiveEnhancementFallback', () => {
  let fallback: ProgressiveEnhancementFallback;
  let mockComponents: ComponentDefinition[];
  let mockHydrationTarget: HydrationTarget;
  let dom: JSDOM;

  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    // Set up global DOM objects
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('navigator', dom.window.navigator);
    
    fallback = new ProgressiveEnhancementFallback();
    
    mockComponents = [
      {
        id: 'header-1',
        framework: 'react',
        component: 'Header',
        props: { title: 'Test' },
        isInteractive: true,
        priority: LoadPriority.CRITICAL
      },
      {
        id: 'content-1',
        framework: 'vue',
        component: 'Content',
        props: { text: 'Hello' },
        isInteractive: false,
        priority: LoadPriority.NORMAL
      }
    ];

    mockHydrationTarget = {
      componentId: 'test-1',
      framework: 'react',
      isInteractive: true,
      priority: LoadPriority.HIGH,
      selector: '[data-hydration-id="test-1"]',
      props: {}
    };

    // Set up DOM
    document.body.innerHTML = `
      <div data-hydration-id="test-1">Test content</div>
    `;

    // Mock console methods
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock navigator
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Mock service worker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: vi.fn(),
        ready: Promise.resolve()
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete (window as any).__METAMON_SW_FALLBACK;
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const fb = new ProgressiveEnhancementFallback();
      const config = (fb as any).config;
      
      expect(config.strategy).toBe(FallbackStrategy.GRACEFUL_DEGRADATION);
      expect(config.enableOfflineMode).toBe(true);
      expect(config.enableStaticFallbacks).toBe(true);
      expect(config.maxRetryAttempts).toBe(3);
    });

    it('should accept custom config', () => {
      const customConfig = {
        strategy: FallbackStrategy.MINIMAL_FALLBACK,
        maxRetryAttempts: 5,
        retryDelay: 2000
      };
      
      const fb = new ProgressiveEnhancementFallback(customConfig);
      const config = (fb as any).config;
      
      expect(config.strategy).toBe(FallbackStrategy.MINIMAL_FALLBACK);
      expect(config.maxRetryAttempts).toBe(5);
      expect(config.retryDelay).toBe(2000);
    });
  });

  describe('handleSSRFailure', () => {
    it('should handle SSR failure with graceful degradation', async () => {
      const result = await fallback.handleSSRFailure(mockComponents);
      
      expect(result).toContain('data-fallback="graceful-degradation"');
      expect(result).toContain('Header (Static Version)');
      expect(result).toContain('Content (Static Version)');
      
      const metrics = fallback.getMetrics();
      expect(metrics.ssrFailures).toBe(1);
      expect(metrics.fallbackActivations).toBe(1);
    });

    it('should handle SSR failure with direct load strategy', async () => {
      const fb = new ProgressiveEnhancementFallback({
        strategy: FallbackStrategy.DIRECT_LOAD
      });
      
      const result = await fb.handleSSRFailure(mockComponents);
      
      expect(result).toContain('data-fallback="direct-load"');
      expect(result).toContain('<script src="/frameworks/react.js"></script>');
      expect(result).toContain('<script src="/frameworks/vue.js"></script>');
      expect(result).toContain('__METAMON_DIRECT_LOAD = true');
    });

    it('should handle SSR failure with minimal fallback strategy', async () => {
      const fb = new ProgressiveEnhancementFallback({
        strategy: FallbackStrategy.MINIMAL_FALLBACK
      });
      
      const result = await fb.handleSSRFailure(mockComponents);
      
      expect(result).toContain('data-fallback="minimal"');
      expect(result).toContain('Content Unavailable');
      expect(result).toContain('Refresh Page');
    });

    it('should handle SSR failure with cached version strategy', async () => {
      const fb = new ProgressiveEnhancementFallback({
        strategy: FallbackStrategy.CACHED_VERSION
      });
      
      const result = await fb.handleSSRFailure(mockComponents);
      
      // Should fall back to minimal since no cache exists
      expect(result).toContain('data-fallback="minimal"');
    });
  });

  describe('handleFrameworkLoadFailure', () => {
    it('should handle framework load failure and attempt retry', async () => {
      await fallback.handleFrameworkLoadFailure('react', mockHydrationTarget);
      
      const metrics = fallback.getMetrics();
      expect(metrics.frameworkLoadFailures.get('react')).toBe(1);
      expect(console.warn).toHaveBeenCalledWith(
        'Framework loading failed for react, attempting fallback'
      );
    });

    it('should track multiple failures for the same framework', async () => {
      await fallback.handleFrameworkLoadFailure('react', mockHydrationTarget);
      await fallback.handleFrameworkLoadFailure('react', mockHydrationTarget);
      
      const metrics = fallback.getMetrics();
      expect(metrics.frameworkLoadFailures.get('react')).toBe(2);
    });

    it('should apply fallback after max retry attempts', async () => {
      const fb = new ProgressiveEnhancementFallback({
        maxRetryAttempts: 1,
        retryDelay: 10
      });
      
      // Mock failed retry
      (fb as any).retryFrameworkLoad = vi.fn().mockRejectedValue(new Error('Load failed'));
      
      await fb.handleFrameworkLoadFailure('react', mockHydrationTarget);
      
      const element = document.querySelector(mockHydrationTarget.selector);
      expect(element?.getAttribute('data-fallback')).toBeTruthy();
    });
  });

  describe('handleHydrationFailure', () => {
    it('should handle hydration failure and mark element', async () => {
      const error = new Error('Hydration failed');
      
      await fallback.handleHydrationFailure(mockHydrationTarget, error);
      
      const element = document.querySelector(mockHydrationTarget.selector);
      expect(element?.getAttribute('data-hydration-failed')).toBe('true');
      expect(element?.getAttribute('data-fallback-reason')).toBe('Hydration failed');
      
      const metrics = fallback.getMetrics();
      expect(metrics.hydrationFailures).toBe(1);
    });

    it('should apply component fallback based on strategy', async () => {
      const fb = new ProgressiveEnhancementFallback({
        strategy: FallbackStrategy.GRACEFUL_DEGRADATION
      });
      
      const error = new Error('Test error');
      await fb.handleHydrationFailure(mockHydrationTarget, error);
      
      const element = document.querySelector(mockHydrationTarget.selector);
      expect(element?.querySelector('.graceful-fallback')).toBeTruthy();
    });

    it('should handle missing element gracefully', async () => {
      const invalidTarget = {
        ...mockHydrationTarget,
        selector: '[data-invalid="true"]'
      };
      
      const error = new Error('Test error');
      
      // Should not throw
      await expect(fallback.handleHydrationFailure(invalidTarget, error)).resolves.toBeUndefined();
    });
  });

  describe('handleServiceWorkerFailure', () => {
    it('should handle service worker failure', () => {
      fallback.handleServiceWorkerFailure();
      
      expect((window as any).__METAMON_SW_FALLBACK).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        'Service worker failure detected, enabling direct loading fallback'
      );
      
      const metrics = fallback.getMetrics();
      expect(metrics.serviceWorkerFailures).toBe(1);
    });

    it('should dispatch custom event on service worker failure', () => {
      const eventSpy = vi.spyOn(window, 'dispatchEvent');
      
      fallback.handleServiceWorkerFailure();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metamon:sw-fallback',
          detail: { strategy: FallbackStrategy.GRACEFUL_DEGRADATION }
        })
      );
    });
  });

  describe('enableOfflineMode', () => {
    it('should set up offline event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      
      fallback.enableOfflineMode();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should activate offline mode when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      fallback.enableOfflineMode();
      
      expect(document.body.classList.contains('offline-mode')).toBe(true);
      expect(document.querySelector('.offline-indicator')).toBeTruthy();
    });

    it('should not activate offline mode when config disabled', () => {
      const fb = new ProgressiveEnhancementFallback({
        enableOfflineMode: false
      });
      
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      fb.enableOfflineMode();
      
      expect(document.body.classList.contains('offline-mode')).toBe(false);
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed operations', async () => {
      const fb = new ProgressiveEnhancementFallback({
        maxRetryAttempts: 2,
        retryDelay: 10
      });
      
      // Mock successful retry
      (fb as any).retryFrameworkLoad = vi.fn().mockResolvedValue(undefined);
      
      const result = await (fb as any).attemptRetry(mockHydrationTarget);
      
      expect(result).toBe(true);
      expect((fb as any).retryFrameworkLoad).toHaveBeenCalledWith('react');
    });

    it('should stop retrying after max attempts', async () => {
      const fb = new ProgressiveEnhancementFallback({
        maxRetryAttempts: 1,
        retryDelay: 10
      });
      
      // Mock failed retry
      (fb as any).retryFrameworkLoad = vi.fn().mockRejectedValue(new Error('Failed'));
      
      // First attempt
      const result1 = await (fb as any).attemptRetry(mockHydrationTarget);
      expect(result1).toBe(false);
      
      // Second attempt should not retry
      const result2 = await (fb as any).attemptRetry(mockHydrationTarget);
      expect(result2).toBe(false);
    });
  });

  describe('metrics', () => {
    it('should track all types of failures', async () => {
      await fallback.handleSSRFailure(mockComponents);
      await fallback.handleFrameworkLoadFailure('react', mockHydrationTarget);
      await fallback.handleHydrationFailure(mockHydrationTarget, new Error('Test'));
      fallback.handleServiceWorkerFailure();
      
      const metrics = fallback.getMetrics();
      
      expect(metrics.ssrFailures).toBe(1);
      expect(metrics.frameworkLoadFailures.get('react')).toBe(1);
      expect(metrics.hydrationFailures).toBe(1);
      expect(metrics.serviceWorkerFailures).toBe(1);
      expect(metrics.fallbackActivations).toBe(1);
    });

    it('should reset metrics', () => {
      fallback.handleServiceWorkerFailure();
      
      let metrics = fallback.getMetrics();
      expect(metrics.serviceWorkerFailures).toBe(1);
      
      fallback.resetMetrics();
      
      metrics = fallback.getMetrics();
      expect(metrics.serviceWorkerFailures).toBe(0);
      expect(metrics.frameworkLoadFailures.size).toBe(0);
    });
  });

  describe('fallback strategies', () => {
    it('should apply minimal fallback to components', async () => {
      const fb = new ProgressiveEnhancementFallback({
        strategy: FallbackStrategy.MINIMAL_FALLBACK
      });
      
      await (fb as any).applyComponentFallback(
        document.querySelector(mockHydrationTarget.selector),
        mockHydrationTarget
      );
      
      const element = document.querySelector(mockHydrationTarget.selector);
      expect(element?.style.display).toBe('none');
    });

    it('should apply graceful degradation to components', async () => {
      const fb = new ProgressiveEnhancementFallback({
        strategy: FallbackStrategy.GRACEFUL_DEGRADATION
      });
      
      await (fb as any).applyComponentFallback(
        document.querySelector(mockHydrationTarget.selector),
        mockHydrationTarget
      );
      
      const element = document.querySelector(mockHydrationTarget.selector);
      expect(element?.querySelector('.graceful-fallback')).toBeTruthy();
    });

    it('should show existing fallback content when available', async () => {
      const element = document.querySelector(mockHydrationTarget.selector);
      element!.innerHTML = '<div data-fallback style="display: none;">Fallback content</div>';
      
      await (fallback as any).applyComponentFallback(element, mockHydrationTarget);
      
      const fallbackContent = element?.querySelector('[data-fallback]') as HTMLElement;
      expect(fallbackContent?.style.display).toBe('block');
    });
  });
});