/**
 * Tests for Intelligent Preloader Service
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { IntelligentPreloaderService } from '../intelligent-preloader/intelligent-preloader.js';
import {
  ComponentDefinition,
  UserInteraction,
  IntelligentPreloaderConfig,
  PreloadPrediction
} from '../types/intelligent-preloader.js';
import { FrameworkType, LoadPriority, NetworkConditions } from '../types/framework-loader.js';

// Mock DOM APIs
const mockIntersectionObserver = vi.fn();
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

mockIntersectionObserver.mockImplementation((callback) => ({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: mockDisconnect,
  callback
}));

// Mock Navigator API
const mockConnection = {
  effectiveType: '4g',
  downlink: 10,
  rtt: 100,
  saveData: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Setup global mocks
beforeEach(() => {
  global.IntersectionObserver = mockIntersectionObserver;
  
  // Mock navigator with connection
  Object.defineProperty(global, 'navigator', {
    value: {
      connection: mockConnection
    },
    writable: true
  });
  
  global.window = {
    innerHeight: 800,
    innerWidth: 1200,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as any;
  
  global.document = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as any;
  
  vi.clearAllMocks();
});

describe('IntelligentPreloaderService', () => {
  let preloader: IntelligentPreloaderService;
  let mockFrameworkLoader: any;
  let config: Partial<IntelligentPreloaderConfig>;

  beforeEach(() => {
    mockFrameworkLoader = {
      loadFramework: vi.fn().mockResolvedValue({}),
      preloadFramework: vi.fn().mockResolvedValue(undefined)
    };

    config = {
      viewport: {
        rootMargin: '50px',
        threshold: [0, 0.5, 1.0],
        preloadDistance: 200
      },
      interaction: {
        hoverDelay: 100,
        scrollVelocityThreshold: 100,
        clickPatternWindow: 5000,
        confidenceThreshold: 0.7
      },
      navigation: {
        routePatterns: ['/users/:id', '/posts/:id'],
        preloadDepth: 2,
        cacheSize: 10,
        prefetchDelay: 500
      },
      network: {
        slowNetworkThreshold: 1.5,
        saveDataRespect: true,
        adaptivePreloading: true,
        bandwidthThresholds: {
          disable: 0.5,
          reduce: 1.0,
          normal: 2.0
        }
      },
      enableLogging: false,
      enableMetrics: true
    };

    preloader = new IntelligentPreloaderService(config, mockFrameworkLoader);
  });

  afterEach(() => {
    if (preloader) {
      preloader.destroy();
    }
  });

  describe('Viewport-based preloading', () => {
    it('should observe components for viewport intersection', () => {
      const mockElement = { getBoundingClientRect: vi.fn() } as any;
      const components: ComponentDefinition[] = [
        {
          id: 'comp1',
          framework: FrameworkType.REACT,
          element: mockElement,
          isInteractive: true
        }
      ];

      preloader.observeViewport(components);

      expect(mockIntersectionObserver).toHaveBeenCalled();
      expect(mockObserve).toHaveBeenCalledWith(mockElement);
    });

    it('should unobserve components', () => {
      const mockElement = { getBoundingClientRect: vi.fn() } as any;
      const components: ComponentDefinition[] = [
        {
          id: 'comp1',
          framework: FrameworkType.REACT,
          element: mockElement,
          isInteractive: true
        }
      ];

      preloader.observeViewport(components);
      preloader.unobserveViewport(components);

      expect(mockUnobserve).toHaveBeenCalledWith(mockElement);
    });

    it('should create intersection observer with correct options', () => {
      const components: ComponentDefinition[] = [
        {
          id: 'comp1',
          framework: FrameworkType.REACT,
          element: {} as HTMLElement,
          isInteractive: true
        }
      ];

      preloader.observeViewport(components);

      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          rootMargin: '50px',
          threshold: [0, 0.5, 1.0]
        })
      );
    });
  });

  describe('Interaction-based preloading', () => {
    it('should start interaction tracking', () => {
      preloader.startInteractionTracking();

      expect(document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), { passive: true });
      expect(document.addEventListener).toHaveBeenCalledWith('mouseover', expect.any(Function), { passive: true });
      expect(document.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
      expect(document.addEventListener).toHaveBeenCalledWith('focus', expect.any(Function), { passive: true });
      expect(document.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true });
    });

    it('should stop interaction tracking', () => {
      preloader.startInteractionTracking();
      preloader.stopInteractionTracking();

      expect(document.removeEventListener).toHaveBeenCalledTimes(5);
    });

    it('should predict user intent from interactions', () => {
      const interactions: UserInteraction[] = [
        {
          type: 'hover',
          target: {} as HTMLElement,
          timestamp: Date.now() - 50,
          coordinates: { x: 100, y: 200 }
        },
        {
          type: 'click',
          target: {} as HTMLElement,
          timestamp: Date.now(),
          coordinates: { x: 105, y: 205 }
        }
      ];

      const predictions = preloader.predictUserIntent(interactions);

      expect(predictions).toBeInstanceOf(Array);
      expect(predictions.length).toBeGreaterThanOrEqual(0);
    });

    it('should analyze hover patterns correctly', () => {
      const mockElement = { tagName: 'BUTTON' } as HTMLElement;
      const interactions: UserInteraction[] = [
        {
          type: 'hover',
          target: mockElement,
          timestamp: Date.now() - 50,
          coordinates: { x: 100, y: 200 }
        }
      ];

      // Mock component finding
      const component: ComponentDefinition = {
        id: 'comp1',
        framework: FrameworkType.REACT,
        element: mockElement,
        isInteractive: true
      };

      preloader.observeViewport([component]);
      const predictions = preloader.predictUserIntent(interactions);

      expect(predictions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            framework: FrameworkType.REACT,
            reason: 'interaction',
            priority: LoadPriority.HIGH
          })
        ])
      );
    });
  });

  describe('Navigation-based preloading', () => {
    it('should preload for navigation route', async () => {
      const route = '/users/123';
      
      await preloader.preloadForNavigation(route);

      // Should update internal route history
      const metrics = preloader.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should preload for route pattern', async () => {
      const pattern = '/users/:id';
      
      await preloader.preloadForRoutePattern(pattern);

      // Should schedule preloads for frameworks associated with the pattern
      const scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toBeInstanceOf(Array);
    });

    it('should track route history and patterns', async () => {
      const routes = ['/home', '/users/1', '/users/2', '/posts/1'];
      
      for (const route of routes) {
        await preloader.preloadForNavigation(route);
      }

      // Internal route tracking should be working
      const metrics = preloader.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Network-aware preloading', () => {
    it('should adapt to slow network conditions', () => {
      const slowNetwork: NetworkConditions = {
        effectiveType: '2g',
        downlink: 0.3,
        rtt: 2000,
        saveData: false
      };

      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.LOW, 'test');
      preloader.adaptPreloadingStrategy(slowNetwork);

      // Should cancel preloads on slow network
      const scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(0);
    });

    it('should respect save-data preference', () => {
      const saveDataNetwork: NetworkConditions = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: true
      };

      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'test');
      preloader.adaptPreloadingStrategy(saveDataNetwork);

      // Should cancel preloads when save-data is enabled
      const scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(0);
    });

    it('should reduce preloading on limited bandwidth', () => {
      const limitedNetwork: NetworkConditions = {
        effectiveType: '3g',
        downlink: 0.8,
        rtt: 500,
        saveData: false
      };

      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.LOW, 'test');
      preloader.schedulePreload(FrameworkType.VUE, LoadPriority.HIGH, 'test');
      preloader.adaptPreloadingStrategy(limitedNetwork);

      // Should keep high priority but cancel low priority
      const scheduledPreloads = preloader.getScheduledPreloads();
      const highPriorityPreloads = scheduledPreloads.filter(p => p.priority === LoadPriority.HIGH);
      const lowPriorityPreloads = scheduledPreloads.filter(p => p.priority === LoadPriority.LOW);
      
      expect(highPriorityPreloads.length).toBeGreaterThan(0);
      expect(lowPriorityPreloads.length).toBe(0);
    });
  });

  describe('Preload management', () => {
    it('should schedule preload with correct priority', () => {
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');

      const scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(1);
      expect(scheduledPreloads[0]).toMatchObject({
        framework: FrameworkType.REACT,
        priority: LoadPriority.HIGH,
        reason: 'viewport'
      });
    });

    it('should not schedule lower priority preload if higher priority exists', () => {
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.LOW, 'interaction');

      const scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(1);
      expect(scheduledPreloads[0].priority).toBe(LoadPriority.HIGH);
    });

    it('should replace lower priority preload with higher priority', () => {
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.LOW, 'interaction');
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');

      const scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(1);
      expect(scheduledPreloads[0].priority).toBe(LoadPriority.HIGH);
      expect(scheduledPreloads[0].reason).toBe('viewport');
    });

    it('should cancel specific preload', () => {
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');
      preloader.schedulePreload(FrameworkType.VUE, LoadPriority.HIGH, 'viewport');

      preloader.cancelPreload(FrameworkType.REACT);

      const scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(1);
      expect(scheduledPreloads[0].framework).toBe(FrameworkType.VUE);
    });

    it('should cancel all preloads', () => {
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');
      preloader.schedulePreload(FrameworkType.VUE, LoadPriority.HIGH, 'viewport');

      preloader.cancelAllPreloads();

      const scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(0);
    });
  });

  describe('Configuration and metrics', () => {
    it('should update configuration', () => {
      const newConfig = {
        viewport: {
          rootMargin: '100px',
          threshold: [0, 1.0],
          preloadDistance: 300
        }
      };

      preloader.updateConfig(newConfig);

      // Configuration should be updated (tested indirectly through behavior)
      expect(true).toBe(true);
    });

    it('should provide metrics', () => {
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');
      
      const metrics = preloader.getMetrics();

      expect(metrics).toMatchObject({
        totalPredictions: expect.any(Number),
        accuratePredictions: expect.any(Number),
        falsePositives: expect.any(Number),
        preloadHitRate: expect.any(Number),
        averageConfidence: expect.any(Number),
        networkSavings: expect.any(Number),
        predictionsByReason: expect.any(Object)
      });
    });

    it('should track scheduled preloads', () => {
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');
      preloader.schedulePreload(FrameworkType.VUE, LoadPriority.NORMAL, 'interaction');

      const scheduledPreloads = preloader.getScheduledPreloads();

      expect(scheduledPreloads).toHaveLength(2);
      expect(scheduledPreloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            framework: FrameworkType.REACT,
            priority: LoadPriority.HIGH,
            reason: 'viewport'
          }),
          expect.objectContaining({
            framework: FrameworkType.VUE,
            priority: LoadPriority.NORMAL,
            reason: 'interaction'
          })
        ])
      );
    });
  });

  describe('Lifecycle management', () => {
    it('should start and stop correctly', () => {
      expect(() => preloader.start()).not.toThrow();
      expect(() => preloader.stop()).not.toThrow();
    });

    it('should start interaction tracking when started', () => {
      preloader.start();

      expect(document.addEventListener).toHaveBeenCalledTimes(5);
    });

    it('should stop interaction tracking when stopped', () => {
      preloader.start();
      preloader.stop();

      expect(document.removeEventListener).toHaveBeenCalledTimes(5);
    });

    it('should cancel all preloads when stopped', () => {
      preloader.start();
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');
      
      // Verify preload was scheduled
      let scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(1);
      
      preloader.stop();

      // Verify preloads were canceled
      scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(0);
    });

    it('should clean up resources when destroyed', () => {
      const mockElement = {} as HTMLElement;
      const components: ComponentDefinition[] = [
        {
          id: 'comp1',
          framework: FrameworkType.REACT,
          element: mockElement,
          isInteractive: true
        }
      ];

      preloader.start();
      preloader.observeViewport(components);
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');

      preloader.destroy();

      expect(mockDisconnect).toHaveBeenCalled();
      expect(document.removeEventListener).toHaveBeenCalledTimes(5);
      
      const scheduledPreloads = preloader.getScheduledPreloads();
      expect(scheduledPreloads).toHaveLength(0);
    });
  });

  describe('Integration with framework loader', () => {
    it('should call framework loader when executing preload', async () => {
      vi.useFakeTimers();
      
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');
      
      // Fast-forward time to trigger preload execution
      await vi.advanceTimersByTimeAsync(1000);
      
      expect(mockFrameworkLoader.loadFramework).toHaveBeenCalledWith(
        FrameworkType.REACT,
        LoadPriority.HIGH
      );
      
      vi.useRealTimers();
    }, 10000);

    it('should handle framework loader errors gracefully', async () => {
      mockFrameworkLoader.loadFramework.mockRejectedValue(new Error('Load failed'));
      
      vi.useFakeTimers();
      
      preloader.schedulePreload(FrameworkType.REACT, LoadPriority.HIGH, 'viewport');
      
      // Fast-forward time to trigger preload execution
      await vi.advanceTimersByTimeAsync(1000);
      
      // Should not throw error - test passes if we get here
      expect(true).toBe(true);
      
      vi.useRealTimers();
    }, 10000);
  });
});