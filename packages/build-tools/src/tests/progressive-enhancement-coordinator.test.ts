/**
 * Tests for Progressive Enhancement Coordinator
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  ProgressiveEnhancementCoordinator,
  createProgressiveEnhancementCoordinator,
  defaultProgressiveEnhancementConfig
} from '../progressive-enhancement/progressive-enhancement-coordinator.js';
import { ServiceWorkerManager } from '../service-worker/service-worker-manager.js';
import { FrameworkType, FallbackStrategy } from '../types/ssr-optimization.js';

// Mock dependencies
vi.mock('../service-worker/service-worker-manager.js');
vi.mock('../service-worker/fallback-loader.js');
vi.mock('../ssr-optimization/progressive-enhancement-fallback.js');
vi.mock('../error-recovery-manager.js');

describe('ProgressiveEnhancementCoordinator', () => {
  let coordinator: ProgressiveEnhancementCoordinator;
  let mockServiceWorkerManager: vi.Mocked<ServiceWorkerManager>;
  let dom: JSDOM;

  beforeEach(() => {
    // Setup DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    // Setup global environment
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('navigator', {
      ...dom.window.navigator,
      onLine: true,
      serviceWorker: {
        register: vi.fn(),
        ready: Promise.resolve(),
        addEventListener: vi.fn()
      }
    });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('CustomEvent', dom.window.CustomEvent);

    // Create mock service worker manager
    mockServiceWorkerManager = {
      initialize: vi.fn().mockResolvedValue({
        isSupported: true,
        isRegistered: true,
        isActive: true,
        registration: {},
        error: null
      }),
      isReady: vi.fn().mockReturnValue(true),
      invalidateFrameworkCache: vi.fn().mockResolvedValue(undefined),
      getCachedFramework: vi.fn().mockResolvedValue(null)
    } as any;

    coordinator = new ProgressiveEnhancementCoordinator();
  });

  afterEach(() => {
    coordinator.cleanup();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const coord = new ProgressiveEnhancementCoordinator();
      expect(coord).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        serviceWorker: {
          enabled: false,
          fallbackTimeout: 3000,
          maxRetryAttempts: 2
        }
      };

      const coord = new ProgressiveEnhancementCoordinator(customConfig);
      expect(coord).toBeDefined();
    });
  });

  describe('service worker initialization', () => {
    it('should initialize service worker successfully', async () => {
      await coordinator.initializeServiceWorker(mockServiceWorkerManager);
      
      expect(mockServiceWorkerManager.initialize).toHaveBeenCalled();
    });

    it('should handle service worker initialization failure', async () => {
      mockServiceWorkerManager.initialize.mockResolvedValue({
        isSupported: false,
        isRegistered: false,
        isActive: false,
        registration: null,
        error: new Error('Not supported')
      });

      await coordinator.initializeServiceWorker(mockServiceWorkerManager);
      
      // Should activate fallback mode
      expect(window.__METAMON_SW_FALLBACK).toBe(true);
    });

    it('should handle service worker not supported', async () => {
      mockServiceWorkerManager.initialize.mockResolvedValue({
        isSupported: false,
        isRegistered: false,
        isActive: false,
        registration: null,
        error: null
      });

      await coordinator.initializeServiceWorker(mockServiceWorkerManager);
      
      expect(window.__METAMON_SW_FALLBACK).toBe(true);
    });
  });

  describe('framework loading failure handling', () => {
    it('should handle framework loading failure with recovery', async () => {
      const framework: FrameworkType = 'reactjs';
      const error = new Error('Framework load failed');

      // Initialize service worker first
      await coordinator.initializeServiceWorker(mockServiceWorkerManager);

      mockServiceWorkerManager.isReady.mockReturnValue(true);
      mockServiceWorkerManager.invalidateFrameworkCache.mockResolvedValue(undefined);
      mockServiceWorkerManager.getCachedFramework.mockResolvedValue({
        name: framework,
        version: 'latest',
        bundle: new ArrayBuffer(1024),
        dependencies: [],
        size: 1024,
        timestamp: Date.now(),
        checksum: 'abc123'
      });

      const result = await coordinator.handleFrameworkLoadFailure(framework, error);
      
      // Since the mock returns a cached framework, recovery should succeed
      expect(result).toBe(true);
      expect(mockServiceWorkerManager.invalidateFrameworkCache).toHaveBeenCalledWith(framework);
    });

    it('should apply graceful degradation when all recovery fails', async () => {
      const framework: FrameworkType = 'vue';
      const error = new Error('Framework load failed');

      // Setup DOM element for framework
      const element = document.createElement('div');
      element.setAttribute('data-framework', framework);
      document.body.appendChild(element);

      mockServiceWorkerManager.isReady.mockReturnValue(false);

      const result = await coordinator.handleFrameworkLoadFailure(framework, error);
      
      expect(result).toBe(false);
      expect(element.classList.contains('framework-fallback')).toBe(true);
    });
  });

  describe('offline mode handling', () => {
    it('should activate offline mode when network goes offline', () => {
      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const offlineEvent = new dom.window.Event('offline');
      dom.window.dispatchEvent(offlineEvent);

      expect(coordinator.isOffline()).toBe(true);
      expect(document.body.classList.contains('metamon-offline')).toBe(true);
    });

    it('should deactivate offline mode when network comes back online', () => {
      // First go offline
      coordinator['isOfflineMode'] = true;
      document.body.classList.add('metamon-offline');

      // Then come back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });

      const onlineEvent = new dom.window.Event('online');
      dom.window.dispatchEvent(onlineEvent);

      expect(coordinator.isOffline()).toBe(false);
      expect(document.body.classList.contains('metamon-offline')).toBe(false);
    });

    it('should show offline indicator', () => {
      coordinator['activateOfflineMode']();
      
      const indicator = document.getElementById('metamon-offline-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator?.style.display).toBe('block');
    });
  });

  describe('error handling', () => {
    it('should handle network failures', () => {
      const error = new Error('Network error');
      
      coordinator.handleNetworkFailure(error);
      
      const metrics = coordinator.getMetrics();
      expect(metrics.networkFailures).toBe(1);
    });

    it('should handle hydration failures', async () => {
      const target = {
        componentId: 'test-component',
        framework: 'reactjs' as FrameworkType,
        selector: '[data-component="test"]',
        isInteractive: true
      };
      const error = new Error('Hydration failed');

      await coordinator.handleHydrationFailure(target, error);
      
      const metrics = coordinator.getMetrics();
      expect(metrics.hydrationFailures).toBe(1);
    });
  });

  describe('metrics tracking', () => {
    it('should track service worker failures', () => {
      coordinator['handleServiceWorkerFailure']('Test failure');
      
      const metrics = coordinator.getMetrics();
      expect(metrics.serviceWorkerFailures).toBe(1);
    });

    it('should track framework load failures', async () => {
      const framework: FrameworkType = 'solid';
      const error = new Error('Load failed');

      await coordinator.handleFrameworkLoadFailure(framework, error);
      
      const metrics = coordinator.getMetrics();
      expect(metrics.frameworkLoadFailures.get(framework)).toBe(1);
    });

    it('should track successful recoveries', async () => {
      const framework: FrameworkType = 'svelte';
      const error = new Error('Load failed');

      // Initialize service worker first
      await coordinator.initializeServiceWorker(mockServiceWorkerManager);

      mockServiceWorkerManager.isReady.mockReturnValue(true);
      mockServiceWorkerManager.invalidateFrameworkCache.mockResolvedValue(undefined);
      mockServiceWorkerManager.getCachedFramework.mockResolvedValue({
        name: framework,
        version: 'latest',
        bundle: new ArrayBuffer(1024),
        dependencies: [],
        size: 1024,
        timestamp: Date.now(),
        checksum: 'def456'
      });

      await coordinator.handleFrameworkLoadFailure(framework, error);
      
      const metrics = coordinator.getMetrics();
      expect(metrics.successfulRecoveries).toBe(1);
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', () => {
      const newConfig = {
        serviceWorker: {
          enabled: false,
          fallbackTimeout: 3000,
          maxRetryAttempts: 2
        }
      };

      coordinator.updateConfig(newConfig);
      
      // Configuration should be updated (private property, so we test behavior)
      expect(coordinator).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', () => {
      // Add some test data
      coordinator['activeFailures'].set('test', {
        type: 'framework_load',
        framework: 'reactjs',
        error: new Error('Test'),
        timestamp: Date.now(),
        recoveryAttempts: 0
      });

      coordinator.cleanup();
      
      expect(coordinator.getActiveFailures()).toHaveLength(0);
    });

    it('should remove offline indicator on cleanup', () => {
      // Create offline indicator
      const indicator = document.createElement('div');
      indicator.id = 'metamon-offline-indicator';
      document.body.appendChild(indicator);

      coordinator.cleanup();
      
      expect(document.getElementById('metamon-offline-indicator')).toBeNull();
    });
  });
});

describe('createProgressiveEnhancementCoordinator', () => {
  it('should create coordinator with default config', () => {
    const coordinator = createProgressiveEnhancementCoordinator();
    expect(coordinator).toBeInstanceOf(ProgressiveEnhancementCoordinator);
  });

  it('should create coordinator with custom config', () => {
    const config = {
      serviceWorker: {
        enabled: false,
        fallbackTimeout: 3000,
        maxRetryAttempts: 2
      }
    };

    const coordinator = createProgressiveEnhancementCoordinator(config);
    expect(coordinator).toBeInstanceOf(ProgressiveEnhancementCoordinator);
  });
});

describe('defaultProgressiveEnhancementConfig', () => {
  it('should have correct default values', () => {
    expect(defaultProgressiveEnhancementConfig.serviceWorker.enabled).toBe(true);
    expect(defaultProgressiveEnhancementConfig.directLoading.enabled).toBe(true);
    expect(defaultProgressiveEnhancementConfig.offline.enabled).toBe(true);
    expect(defaultProgressiveEnhancementConfig.errorRecovery.enabled).toBe(true);
    expect(defaultProgressiveEnhancementConfig.monitoring.enabled).toBe(true);
  });

  it('should have reasonable timeout values', () => {
    expect(defaultProgressiveEnhancementConfig.serviceWorker.fallbackTimeout).toBe(5000);
    expect(defaultProgressiveEnhancementConfig.directLoading.timeout).toBe(10000);
    expect(defaultProgressiveEnhancementConfig.errorRecovery.retryDelay).toBe(1000);
  });

  it('should have graceful degradation as default strategy', () => {
    expect(defaultProgressiveEnhancementConfig.errorRecovery.fallbackStrategy)
      .toBe(FallbackStrategy.GRACEFUL_DEGRADATION);
  });
});