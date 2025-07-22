/**
 * Tests for Progressive Hydration System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HydrationSystem, createHydrationSystem, getHydrationSystem } from '../shared/hydration-system.js';

// Mock DOM environment
const mockIntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  callback
}));

const mockWindow = {
  __SSR_RENDERED__: true,
  __SSR_DATA__: { test: 'data' },
  __SSR_ROUTE__: '/test',
  IntersectionObserver: mockIntersectionObserver,
  requestIdleCallback: vi.fn(),
  performance: { now: vi.fn(() => Date.now()) },
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout
};

const mockDocument = {
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

const mockElement = {
  getAttribute: vi.fn(),
  setAttribute: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  innerHTML: '<div>Test Content</div>',
  attributes: [
    { name: 'data-component-test', value: 'test-value' },
    { name: 'class', value: 'test-class' }
  ]
};

// Mock signal system
vi.mock('../shared/signal-system.js', () => ({
  signal: {
    emit: vi.fn(),
    on: vi.fn()
  }
}));

describe('HydrationSystem', () => {
  let hydrationSystem;
  let originalWindow;
  let originalDocument;

  beforeEach(() => {
    // Mock global objects
    originalWindow = global.window;
    originalDocument = global.document;

    global.window = mockWindow;
    global.document = mockDocument;

    // Reset mocks
    vi.clearAllMocks();

    // Mock performance.now
    global.performance = { now: vi.fn(() => Date.now()) };

    hydrationSystem = new HydrationSystem({
      logHydrationEvents: true,
      maxHydrationTime: 1000
    });
  });

  afterEach(() => {
    if (hydrationSystem) {
      hydrationSystem.cleanup();
    }

    // Restore globals
    global.window = originalWindow;
    global.document = originalDocument;
  });

  describe('Constructor and Initialization', () => {
    it('should create HydrationSystem with default options', () => {
      const system = new HydrationSystem();

      expect(system.options.enableProgressiveHydration).toBe(true);
      expect(system.options.hydrateOnVisible).toBe(true);
      expect(system.options.hydrateOnInteraction).toBe(true);
      expect(system.options.hydrateOnIdle).toBe(true);
    });

    it('should create HydrationSystem with custom options', () => {
      const customOptions = {
        enableProgressiveHydration: false,
        hydrateOnVisible: false,
        idleTimeout: 5000
      };

      const system = new HydrationSystem(customOptions);

      expect(system.options.enableProgressiveHydration).toBe(false);
      expect(system.options.hydrateOnVisible).toBe(false);
      expect(system.options.idleTimeout).toBe(5000);
    });

    it('should initialize hydration state', () => {
      expect(hydrationSystem.hydrationQueue).toBeInstanceOf(Map);
      expect(hydrationSystem.hydratedComponents).toBeInstanceOf(Set);
      expect(hydrationSystem.hydrationErrors).toBeInstanceOf(Array);
      expect(hydrationSystem.hydrationMetrics).toBeDefined();
    });

    it('should detect SSR environment', () => {
      expect(hydrationSystem.isSSR).toBe(true);
      expect(hydrationSystem.ssrData).toEqual({ test: 'data' });
      expect(hydrationSystem.ssrRoute).toBe('/test');
    });
  });

  describe('Component Registration', () => {
    it('should register component for hydration', () => {
      const config = {
        element: mockElement,
        type: 'test-component',
        strategy: 'immediate',
        data: { test: 'value' }
      };

      hydrationSystem.registerComponentForHydration('test-component', config);

      expect(hydrationSystem.hydrationQueue.has('test-component')).toBe(true);
      expect(hydrationSystem.hydrationStrategies.get('test-component')).toBe('immediate');
    });

    it('should register component with default values', () => {
      hydrationSystem.registerComponentForHydration('simple-component', {
        element: mockElement
      });

      const config = hydrationSystem.hydrationQueue.get('simple-component');
      expect(config.type).toBe('component');
      expect(config.strategy).toBe('immediate');
      expect(config.priority).toBe(0);
      expect(config.hydrated).toBe(false);
    });

    it('should prepare SSR hydration by scanning DOM', () => {
      const mockSSRElements = [
        {
          getAttribute: vi.fn((attr) => {
            if (attr === 'data-ssr-component') return 'component-1';
            if (attr === 'data-component-type') return 'header';
            if (attr === 'data-hydration-strategy') return 'immediate';
            return null;
          })
        },
        {
          getAttribute: vi.fn((attr) => {
            if (attr === 'data-ssr-component') return 'component-2';
            if (attr === 'data-component-type') return 'footer';
            if (attr === 'data-hydration-strategy') return 'idle';
            return null;
          })
        }
      ];

      mockDocument.querySelectorAll.mockReturnValue(mockSSRElements);

      hydrationSystem.prepareSSRHydration();

      expect(hydrationSystem.hydrationQueue.has('component-1')).toBe(true);
      expect(hydrationSystem.hydrationQueue.has('component-2')).toBe(true);
      expect(hydrationSystem.hydrationQueue.get('component-1').strategy).toBe('immediate');
      expect(hydrationSystem.hydrationQueue.get('component-2').strategy).toBe('idle');
    });
  });

  describe('Component Hydration', () => {
    let mockComponent;
    let mockConfig;

    beforeEach(() => {
      mockComponent = vi.fn().mockImplementation(() => ({
        hydrate: vi.fn(),
        restoreState: vi.fn(),
        attachEventListeners: vi.fn(),
        initializeReactivity: vi.fn(),
        onHydrated: vi.fn()
      }));

      mockConfig = {
        id: 'test-component',
        element: mockElement,
        type: 'test',
        strategy: 'immediate',
        component: mockComponent,
        data: { test: 'data' },
        hydrated: false
      };

      hydrationSystem.hydrationQueue.set('test-component', mockConfig);
    });

    it('should hydrate component successfully', async () => {
      await hydrationSystem.hydrateComponent(mockConfig);

      expect(mockConfig.hydrated).toBe(true);
      expect(mockConfig.hydrationTime).toBeGreaterThan(0);
      expect(hydrationSystem.hydratedComponents.has('test-component')).toBe(true);
    });

    it('should skip already hydrated components', async () => {
      mockConfig.hydrated = true;
      hydrationSystem.hydratedComponents.add('test-component');

      await hydrationSystem.hydrateComponent(mockConfig);

      expect(mockComponent).not.toHaveBeenCalled();
    });

    it('should handle component hydration errors', async () => {
      mockComponent.mockImplementation(() => {
        throw new Error('Hydration failed');
      });

      await expect(hydrationSystem.hydrateComponent(mockConfig)).rejects.toThrow('Hydration failed');
      expect(hydrationSystem.hydrationErrors).toHaveLength(1);
      expect(hydrationSystem.hydrationErrors[0].componentId).toBe('test-component');
    });

    it('should load component if loader provided', async () => {
      const mockLoader = vi.fn().mockResolvedValue({ default: mockComponent });
      mockConfig.component = null;
      mockConfig.loader = mockLoader;

      await hydrationSystem.hydrateComponent(mockConfig);

      expect(mockLoader).toHaveBeenCalled();
      expect(mockComponent).toHaveBeenCalled();
    });

    it('should perform default hydration', async () => {
      const mockInstance = {
        restoreState: vi.fn(),
        attachEventListeners: vi.fn(),
        initializeReactivity: vi.fn(),
        onHydrated: vi.fn()
      };

      mockComponent.mockReturnValue(mockInstance);

      await hydrationSystem.hydrateComponent(mockConfig);

      expect(mockInstance.restoreState).toHaveBeenCalledWith(hydrationSystem.ssrData);
      expect(mockInstance.attachEventListeners).toHaveBeenCalledWith(mockElement);
      expect(mockInstance.initializeReactivity).toHaveBeenCalled();
      expect(mockInstance.onHydrated).toHaveBeenCalled();
    });
  });

  describe('Hydration Strategies', () => {
    beforeEach(() => {
      // Mock intersection observer
      const mockObserver = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
      };
      mockWindow.IntersectionObserver.mockImplementation((callback) => {
        mockObserver.callback = callback;
        return mockObserver;
      });

      hydrationSystem.intersectionObserver = mockObserver;
    });

    it('should hydrate immediate components first', async () => {
      const immediateConfig = {
        id: 'immediate-component',
        strategy: 'immediate',
        component: vi.fn(() => ({})),
        element: mockElement,
        hydrated: false
      };

      hydrationSystem.hydrationQueue.set('immediate-component', immediateConfig);

      await hydrationSystem.hydrateByStrategy('immediate');

      expect(immediateConfig.hydrated).toBe(true);
    });

    it('should setup intersection observer for visible components', () => {
      const visibleConfig = {
        id: 'visible-component',
        strategy: 'visible',
        element: mockElement,
        hydrated: false
      };

      hydrationSystem.hydrationQueue.set('visible-component', visibleConfig);
      hydrationSystem.scheduleVisibleHydration();

      expect(hydrationSystem.intersectionObserver.observe).toHaveBeenCalledWith(mockElement);
    });

    it('should setup interaction listeners for interactive components', () => {
      const interactionConfig = {
        id: 'interaction-component',
        strategy: 'interaction',
        element: mockElement,
        hydrated: false
      };

      hydrationSystem.hydrationQueue.set('interaction-component', interactionConfig);
      hydrationSystem.setupComponentInteractionListeners(interactionConfig);

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        expect.objectContaining({ once: true, passive: true })
      );
    });

    it('should schedule idle hydration', () => {
      const idleConfig = {
        id: 'idle-component',
        strategy: 'idle',
        element: mockElement,
        hydrated: false
      };

      hydrationSystem.hydrationQueue.set('idle-component', idleConfig);

      // Mock requestIdleCallback
      mockWindow.requestIdleCallback.mockImplementation((callback) => {
        callback({ timeRemaining: () => 10 });
      });

      hydrationSystem.setupIdleHydration();

      expect(mockWindow.requestIdleCallback).toHaveBeenCalled();
    });
  });

  describe('Hydration Mismatch Detection', () => {
    it('should detect hydration mismatches', async () => {
      const config = {
        id: 'mismatch-component',
        element: { innerHTML: '<div>Current</div>' },
        ssrRendered: true,
        data: { expectedHTML: '<div>Expected</div>' }
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      await hydrationSystem.detectHydrationMismatches(config);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hydration mismatch detected')
      );

      consoleSpy.mockRestore();
    });

    it('should recover from hydration mismatch using expected HTML', async () => {
      const mockEl = {
        innerHTML: '<div>Current</div>',
        setAttribute: vi.fn()
      };

      const config = {
        id: 'recovery-component',
        element: mockEl,
        ssrRendered: true,
        data: { expectedHTML: '<div>Expected</div>' }
      };

      await hydrationSystem.recoverFromHydrationMismatch(
        config,
        '<div>Current</div>',
        '<div>Expected</div>'
      );

      expect(mockEl.innerHTML).toBe('<div>Expected</div>');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should update hydration metrics', () => {
      const config = {
        id: 'metrics-component',
        hydrationTime: 100
      };

      hydrationSystem.updateHydrationMetrics(config);

      expect(hydrationSystem.hydrationMetrics.hydratedComponents).toBe(1);
      expect(hydrationSystem.hydrationMetrics.totalHydrationTime).toBe(100);
      expect(hydrationSystem.hydrationMetrics.averageHydrationTime).toBe(100);
    });

    it('should record hydration errors', () => {
      const error = new Error('Test error');

      hydrationSystem.recordHydrationError('error-component', error);

      expect(hydrationSystem.hydrationErrors).toHaveLength(1);
      expect(hydrationSystem.hydrationErrors[0].componentId).toBe('error-component');
      expect(hydrationSystem.hydrationErrors[0].error).toBe('Test error');
      expect(hydrationSystem.hydrationMetrics.failedComponents).toBe(1);
    });

    it('should get hydration metrics', () => {
      hydrationSystem.hydrationQueue.set('test1', { id: 'test1' });
      hydrationSystem.hydrationQueue.set('test2', { id: 'test2' });
      hydrationSystem.hydrationMetrics.hydratedComponents = 1;
      hydrationSystem.hydrationErrors.push({ error: 'test' });

      const metrics = hydrationSystem.getHydrationMetrics();

      expect(metrics.totalComponents).toBe(2);
      expect(metrics.hydratedComponents).toBe(1);
      expect(metrics.hydrationErrors).toBe(1);
    });
  });

  describe('Component Management', () => {
    it('should check if component is hydrated', () => {
      hydrationSystem.hydratedComponents.add('hydrated-component');

      expect(hydrationSystem.isComponentHydrated('hydrated-component')).toBe(true);
      expect(hydrationSystem.isComponentHydrated('not-hydrated-component')).toBe(false);
    });

    it('should get component instance', () => {
      const mockInstance = { test: 'instance' };
      const config = {
        id: 'instance-component',
        instance: mockInstance
      };

      hydrationSystem.hydrationQueue.set('instance-component', config);

      expect(hydrationSystem.getComponentInstance('instance-component')).toBe(mockInstance);
      expect(hydrationSystem.getComponentInstance('non-existent')).toBeNull();
    });

    it('should force hydrate component', async () => {
      const mockComponent = vi.fn(() => ({ test: 'instance' }));
      const config = {
        id: 'force-component',
        component: mockComponent,
        element: mockElement,
        hydrated: false
      };

      hydrationSystem.hydrationQueue.set('force-component', config);

      const instance = await hydrationSystem.forceHydrate('force-component');

      expect(config.hydrated).toBe(true);
      expect(instance).toBeDefined();
    });

    it('should throw error when force hydrating non-existent component', async () => {
      await expect(hydrationSystem.forceHydrate('non-existent')).rejects.toThrow(
        'Component non-existent not found in hydration queue'
      );
    });
  });

  describe('Data Extraction', () => {
    it('should extract component data from element', () => {
      const mockEl = {
        attributes: [
          { name: 'data-component-test-value', value: 'test' },
          { name: 'data-component-another-prop', value: 'value' },
          { name: 'regular-attribute', value: 'ignored' }
        ],
        querySelector: vi.fn(() => ({
          textContent: '{"json": "data"}'
        }))
      };

      const data = hydrationSystem.extractComponentData(mockEl);

      expect(data.testValue).toBe('test');
      expect(data.anotherProp).toBe('value');
      expect(data.json).toBe('data');
    });

    it('should handle JSON parsing errors gracefully', () => {
      const mockEl = {
        attributes: [],
        querySelector: vi.fn(() => ({
          textContent: 'invalid json'
        }))
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      const data = hydrationSystem.extractComponentData(mockEl);

      expect(data).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse component JSON data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Factory Functions', () => {
    it('should create hydration system instance', () => {
      const system = createHydrationSystem({ idleTimeout: 3000 });

      expect(system).toBeInstanceOf(HydrationSystem);
      expect(system.options.idleTimeout).toBe(3000);
    });

    it('should return existing instance on subsequent calls', () => {
      const system1 = createHydrationSystem();
      const system2 = createHydrationSystem();

      expect(system1).toBe(system2);
    });

    it('should get hydration system instance', () => {
      const system = createHydrationSystem();
      const retrieved = getHydrationSystem();

      expect(retrieved).toBe(system);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', () => {
      const mockObserver = {
        disconnect: vi.fn()
      };

      hydrationSystem.intersectionObserver = mockObserver;
      hydrationSystem.idleTimer = setTimeout(() => { }, 1000);

      hydrationSystem.cleanup();

      expect(mockObserver.disconnect).toHaveBeenCalled();
      expect(hydrationSystem.intersectionObserver).toBeNull();
      expect(hydrationSystem.idleTimer).toBeNull();
    });
  });
});