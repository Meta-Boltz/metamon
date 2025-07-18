/**
 * SSR with Lazy Loading Integration Tests
 * Comprehensive tests for server-side rendering with lazy loading scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SSROptimizationManager,
  SelectiveHydrationService,
  FrameworkRequirementAnalyzer,
  ProgressiveEnhancementFallback
} from '../ssr-optimization/index.js';
import { FrameworkLoaderService } from '../framework-loader/index.js';
import { LayoutStabilityController } from '../layout-stability/index.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

// Mock DOM environment
const mockDocument = {
  createElement: vi.fn((tag: string) => ({
    tagName: tag.toUpperCase(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    innerHTML: '',
    textContent: '',
    style: {},
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false)
    },
    getBoundingClientRect: vi.fn(() => ({
      top: 0, left: 0, width: 100, height: 50, right: 100, bottom: 50
    }))
  })),
  getElementById: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
};

const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  requestAnimationFrame: vi.fn((cb: Function) => setTimeout(cb, 16)),
  cancelAnimationFrame: vi.fn(),
  IntersectionObserver: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  })),
  PerformanceObserver: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn()
  })),
  performance: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn()
  }
};

describe('SSR with Lazy Loading Integration', () => {
  beforeEach(() => {
    global.document = mockDocument as any;
    global.window = mockWindow as any;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SSROptimizationManager Integration', () => {
    let ssrManager: SSROptimizationManager;
    let frameworkLoader: FrameworkLoaderService;
    let layoutController: LayoutStabilityController;

    beforeEach(() => {
      ssrManager = new SSROptimizationManager({
        enableSelectiveHydration: true,
        enableProgressiveEnhancement: true,
        hydrationStrategy: 'viewport-based'
      });

      frameworkLoader = new FrameworkLoaderService({
        enableServiceWorker: true,
        enableIntelligentPreloading: true
      });

      layoutController = new LayoutStabilityController({
        targetCLS: 0.1,
        enablePlaceholders: true
      });
    });

    afterEach(() => {
      ssrManager.destroy();
      frameworkLoader.destroy();
      layoutController.destroy();
    });

    it('should render server content with framework requirements analysis', async () => {
      const components = [
        {
          id: 'header',
          framework: FrameworkType.REACT,
          isInteractive: false,
          content: '<header><h1>Welcome</h1></header>',
          props: { title: 'Welcome' }
        },
        {
          id: 'sidebar',
          framework: FrameworkType.VUE,
          isInteractive: true,
          content: '<aside><nav>Navigation</nav></aside>',
          props: { items: ['Home', 'About'] }
        },
        {
          id: 'main-content',
          framework: FrameworkType.SVELTE,
          isInteractive: true,
          content: '<main><p>Main content</p></main>',
          props: { data: 'content' }
        }
      ];

      const ssrResult = await ssrManager.renderServerContent(components);

      expect(ssrResult).toBeDefined();
      expect(ssrResult.html).toContain('<header><h1>Welcome</h1></header>');
      expect(ssrResult.html).toContain('<aside><nav>Navigation</nav></aside>');
      expect(ssrResult.html).toContain('<main><p>Main content</p></main>');
      expect(ssrResult.criticalCSS).toBeDefined();
      expect(ssrResult.hydrationData).toBeDefined();
      expect(ssrResult.frameworkRequirements).toHaveLength(3);

      // Verify framework requirements
      const reactReq = ssrResult.frameworkRequirements.find(req => req.framework === FrameworkType.REACT);
      const vueReq = ssrResult.frameworkRequirements.find(req => req.framework === FrameworkType.VUE);
      const svelteReq = ssrResult.frameworkRequirements.find(req => req.framework === FrameworkType.SVELTE);

      expect(reactReq?.priority).toBe(LoadPriority.LOW); // Non-interactive
      expect(vueReq?.priority).toBe(LoadPriority.HIGH); // Interactive
      expect(svelteReq?.priority).toBe(LoadPriority.HIGH); // Interactive
    });

    it('should identify hydration targets correctly', () => {
      const ssrContent = `
        <div id="app">
          <header data-metamon-component="header" data-framework="react" data-interactive="false">
            <h1>Welcome</h1>
          </header>
          <aside data-metamon-component="sidebar" data-framework="vue" data-interactive="true">
            <nav>Navigation</nav>
          </aside>
          <main data-metamon-component="main-content" data-framework="svelte" data-interactive="true">
            <p>Main content</p>
          </main>
        </div>
      `;

      const targets = ssrManager.identifyHydrationTargets(ssrContent);

      expect(targets).toHaveLength(3);
      
      const interactiveTargets = targets.filter(t => t.isInteractive);
      expect(interactiveTargets).toHaveLength(2); // sidebar and main-content

      const nonInteractiveTargets = targets.filter(t => !t.isInteractive);
      expect(nonInteractiveTargets).toHaveLength(1); // header
    });

    it('should perform selective hydration with layout stability', async () => {
      const hydrationTarget = {
        componentId: 'interactive-widget',
        framework: FrameworkType.REACT,
        isInteractive: true,
        priority: LoadPriority.HIGH,
        boundingRect: { top: 100, left: 0, width: 300, height: 200, right: 300, bottom: 300 }
      };

      // Create layout reservation before hydration
      const mockElement = mockDocument.createElement('div');
      mockElement.id = 'interactive-widget';
      const reservation = layoutController.preserveLayout(mockElement);

      // Load framework and hydrate
      const frameworkCore = await frameworkLoader.loadFramework(
        FrameworkType.REACT,
        LoadPriority.HIGH
      );

      expect(frameworkCore).toBeDefined();

      // Perform hydration
      await ssrManager.hydrateComponent(hydrationTarget);

      // Release layout reservation
      layoutController.releaseLayout(reservation);

      // Verify no layout shift occurred
      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.1);
    });

    it('should handle progressive enhancement fallback', async () => {
      // Simulate framework loading failure
      vi.spyOn(frameworkLoader, 'loadFramework').mockRejectedValue(
        new Error('Framework loading failed')
      );

      const fallbackStrategy = {
        enableServerRenderedFallback: true,
        enableMinimalClientSide: true,
        gracefulDegradation: true
      };

      ssrManager.enableProgressiveEnhancement(fallbackStrategy);

      const components = [{
        id: 'failing-component',
        framework: FrameworkType.VUE,
        isInteractive: true,
        content: '<div>Fallback content</div>',
        props: {}
      }];

      const ssrResult = await ssrManager.renderServerContent(components);

      // Should still render server content
      expect(ssrResult.html).toContain('Fallback content');
      expect(ssrResult.frameworkRequirements).toHaveLength(1);

      // Attempt hydration (should fail gracefully)
      const targets = ssrManager.identifyHydrationTargets(ssrResult.html);
      const target = targets[0];

      try {
        await ssrManager.hydrateComponent(target);
      } catch (error) {
        // Should handle error gracefully
        expect(error).toBeDefined();
      }

      // Server-rendered content should remain functional
      expect(ssrResult.html).toContain('Fallback content');
    });

    it('should optimize framework requirements for minimal loading', () => {
      const components = [
        {
          id: 'comp1',
          framework: FrameworkType.REACT,
          isInteractive: false,
          content: '<div>Static React</div>',
          props: {}
        },
        {
          id: 'comp2',
          framework: FrameworkType.REACT,
          isInteractive: true,
          content: '<div>Interactive React</div>',
          props: {}
        },
        {
          id: 'comp3',
          framework: FrameworkType.VUE,
          isInteractive: false,
          content: '<div>Static Vue</div>',
          props: {}
        }
      ];

      const requirements = ssrManager.analyzeFrameworkRequirements(components);

      // Should optimize to load only necessary frameworks
      expect(requirements).toHaveLength(2); // React and Vue
      
      const reactReq = requirements.find(req => req.framework === FrameworkType.REACT);
      const vueReq = requirements.find(req => req.framework === FrameworkType.VUE);

      // React should be high priority (has interactive component)
      expect(reactReq?.priority).toBe(LoadPriority.HIGH);
      // Vue should be low priority (only static components)
      expect(vueReq?.priority).toBe(LoadPriority.LOW);
    });
  });

  describe('SelectiveHydrationService', () => {
    let hydrationService: SelectiveHydrationService;

    beforeEach(() => {
      hydrationService = new SelectiveHydrationService({
        strategy: 'intersection-observer',
        rootMargin: '50px',
        threshold: 0.1
      });
    });

    afterEach(() => {
      hydrationService.destroy();
    });

    it('should schedule hydration based on viewport visibility', () => {
      const components = [
        {
          id: 'above-fold',
          framework: FrameworkType.REACT,
          isInteractive: true,
          boundingRect: { top: 50, left: 0, width: 300, height: 100, right: 300, bottom: 150 }
        },
        {
          id: 'below-fold',
          framework: FrameworkType.VUE,
          isInteractive: true,
          boundingRect: { top: 800, left: 0, width: 300, height: 100, right: 300, bottom: 900 }
        }
      ];

      hydrationService.scheduleHydration(components);

      const queue = hydrationService.getHydrationQueue();
      
      // Above-fold component should be prioritized
      expect(queue[0].id).toBe('above-fold');
      expect(queue[0].priority).toBe(LoadPriority.HIGH);
      
      // Below-fold component should have lower priority
      expect(queue[1].id).toBe('below-fold');
      expect(queue[1].priority).toBe(LoadPriority.NORMAL);
    });

    it('should handle interaction-based hydration', async () => {
      const component = {
        id: 'interactive-button',
        framework: FrameworkType.SVELTE,
        isInteractive: true,
        element: mockDocument.createElement('button')
      };

      hydrationService.enableInteractionBasedHydration(component);

      // Simulate user interaction
      const clickEvent = new Event('click');
      component.element.dispatchEvent?.(clickEvent);

      // Should trigger immediate hydration
      const queue = hydrationService.getHydrationQueue();
      const hydratingComponent = queue.find(c => c.id === 'interactive-button');
      expect(hydratingComponent?.priority).toBe(LoadPriority.CRITICAL);
    });

    it('should batch hydration operations', async () => {
      const components = [
        { id: 'comp1', framework: FrameworkType.REACT, isInteractive: true },
        { id: 'comp2', framework: FrameworkType.REACT, isInteractive: true },
        { id: 'comp3', framework: FrameworkType.VUE, isInteractive: true }
      ];

      hydrationService.scheduleHydration(components);
      
      const batches = hydrationService.getBatchedHydrationPlan();
      
      // Should batch components by framework
      expect(batches).toHaveLength(2); // React batch and Vue batch
      
      const reactBatch = batches.find(b => b.framework === FrameworkType.REACT);
      const vueBatch = batches.find(b => b.framework === FrameworkType.VUE);
      
      expect(reactBatch?.components).toHaveLength(2);
      expect(vueBatch?.components).toHaveLength(1);
    });

    it('should provide hydration metrics', () => {
      const metrics = hydrationService.getHydrationMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalComponents).toBeGreaterThanOrEqual(0);
      expect(metrics.hydratedComponents).toBeGreaterThanOrEqual(0);
      expect(metrics.pendingComponents).toBeGreaterThanOrEqual(0);
      expect(metrics.averageHydrationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('FrameworkRequirementAnalyzer', () => {
    let analyzer: FrameworkRequirementAnalyzer;

    beforeEach(() => {
      analyzer = new FrameworkRequirementAnalyzer({
        enableDependencyOptimization: true,
        enableBundleAnalysis: true
      });
    });

    it('should analyze component framework dependencies', () => {
      const components = [
        {
          id: 'header',
          framework: FrameworkType.REACT,
          dependencies: ['react', 'react-dom'],
          isInteractive: false,
          estimatedSize: 45000
        },
        {
          id: 'sidebar',
          framework: FrameworkType.VUE,
          dependencies: ['vue', '@vue/runtime-dom'],
          isInteractive: true,
          estimatedSize: 38000
        },
        {
          id: 'footer',
          framework: FrameworkType.REACT,
          dependencies: ['react', 'react-dom'],
          isInteractive: false,
          estimatedSize: 12000
        }
      ];

      const analysis = analyzer.analyzeComponents(components);

      expect(analysis).toBeDefined();
      expect(analysis.frameworks).toHaveProperty(FrameworkType.REACT);
      expect(analysis.frameworks).toHaveProperty(FrameworkType.VUE);
      
      // React should have combined size and multiple components
      expect(analysis.frameworks[FrameworkType.REACT].totalSize).toBe(57000);
      expect(analysis.frameworks[FrameworkType.REACT].componentCount).toBe(2);
      
      // Vue should have single component
      expect(analysis.frameworks[FrameworkType.VUE].totalSize).toBe(38000);
      expect(analysis.frameworks[FrameworkType.VUE].componentCount).toBe(1);
    });

    it('should optimize loading priorities', () => {
      const requirements = [
        {
          framework: FrameworkType.REACT,
          components: ['interactive-form', 'static-header'],
          hasInteractiveComponents: true,
          isAboveFold: true,
          estimatedSize: 50000
        },
        {
          framework: FrameworkType.VUE,
          components: ['footer-widget'],
          hasInteractiveComponents: false,
          isAboveFold: false,
          estimatedSize: 25000
        }
      ];

      const optimized = analyzer.optimizeLoadingPriorities(requirements);

      expect(optimized).toHaveLength(2);
      
      // React should be high priority (interactive + above fold)
      const reactReq = optimized.find(req => req.framework === FrameworkType.REACT);
      expect(reactReq?.priority).toBe(LoadPriority.HIGH);
      
      // Vue should be low priority (non-interactive + below fold)
      const vueReq = optimized.find(req => req.framework === FrameworkType.VUE);
      expect(vueReq?.priority).toBe(LoadPriority.LOW);
    });

    it('should identify shared dependencies', () => {
      const frameworks = [
        {
          framework: FrameworkType.REACT,
          dependencies: ['react', 'react-dom', 'scheduler', 'prop-types']
        },
        {
          framework: FrameworkType.VUE,
          dependencies: ['vue', '@vue/runtime-dom', 'scheduler'] // shared scheduler
        }
      ];

      const sharedDeps = analyzer.identifySharedDependencies(frameworks);

      expect(sharedDeps).toBeDefined();
      expect(sharedDeps.dependencies).toContain('scheduler');
      expect(sharedDeps.potentialSavings).toBeGreaterThan(0);
    });

    it('should generate loading recommendations', () => {
      const pageAnalysis = {
        frameworks: [FrameworkType.REACT, FrameworkType.VUE],
        interactiveComponents: 3,
        staticComponents: 5,
        totalEstimatedSize: 120000,
        aboveFoldComponents: 4
      };

      const recommendations = analyzer.generateLoadingRecommendations(pageAnalysis);

      expect(recommendations).toBeDefined();
      expect(recommendations.loadingStrategy).toBeDefined();
      expect(recommendations.priorityOrder).toHaveLength(2);
      expect(recommendations.preloadCandidates).toBeDefined();
      expect(recommendations.bundleOptimizations).toBeDefined();
    });
  });

  describe('ProgressiveEnhancementFallback', () => {
    let fallback: ProgressiveEnhancementFallback;

    beforeEach(() => {
      fallback = new ProgressiveEnhancementFallback({
        enableServerRenderedFallback: true,
        enableBasicInteractivity: true,
        enableGracefulDegradation: true
      });
    });

    it('should provide server-rendered fallback', () => {
      const component = {
        id: 'interactive-form',
        framework: FrameworkType.REACT,
        serverRenderedContent: '<form><input type="text" /><button>Submit</button></form>',
        fallbackBehavior: 'basic-form-submission'
      };

      const fallbackContent = fallback.generateServerRenderedFallback(component);

      expect(fallbackContent).toBeDefined();
      expect(fallbackContent.html).toContain('<form');
      expect(fallbackContent.html).toContain('<button>Submit</button>');
      expect(fallbackContent.enhancementScript).toBeDefined();
    });

    it('should handle framework loading failures', async () => {
      const component = {
        id: 'failing-widget',
        framework: FrameworkType.VUE,
        isInteractive: true
      };

      const error = new Error('Framework loading failed');
      const recovery = await fallback.handleFrameworkLoadingFailure(component, error);

      expect(recovery).toBeDefined();
      expect(recovery.fallbackStrategy).toBeDefined();
      expect(recovery.maintainsFunctionality).toBe(true);
      expect(recovery.degradationLevel).toBeDefined();
    });

    it('should enable basic interactivity without frameworks', () => {
      const components = [
        {
          id: 'toggle-button',
          type: 'button',
          behavior: 'toggle-visibility',
          target: 'content-panel'
        },
        {
          id: 'form-validator',
          type: 'form',
          behavior: 'basic-validation',
          fields: ['email', 'password']
        }
      ];

      const basicInteractivity = fallback.enableBasicInteractivity(components);

      expect(basicInteractivity).toBeDefined();
      expect(basicInteractivity.script).toContain('addEventListener');
      expect(basicInteractivity.script).toContain('toggle-visibility');
      expect(basicInteractivity.script).toContain('basic-validation');
    });

    it('should provide graceful degradation strategies', () => {
      const scenarios = [
        'service-worker-unavailable',
        'framework-loading-timeout',
        'hydration-failure',
        'network-offline'
      ];

      for (const scenario of scenarios) {
        const strategy = fallback.getGracefulDegradationStrategy(scenario as any);
        
        expect(strategy).toBeDefined();
        expect(strategy.fallbackMethod).toBeDefined();
        expect(strategy.userExperience).toBeDefined();
        expect(strategy.functionalityLevel).toBeDefined();
      }
    });
  });

  describe('End-to-End SSR Lazy Loading Scenarios', () => {
    it('should handle complete page rendering with mixed frameworks', async () => {
      const ssrManager = new SSROptimizationManager();
      const frameworkLoader = new FrameworkLoaderService();
      const layoutController = new LayoutStabilityController();

      // Define a complex page with multiple frameworks
      const pageComponents = [
        {
          id: 'header',
          framework: FrameworkType.REACT,
          isInteractive: false,
          content: '<header><nav>Navigation</nav></header>',
          position: 'above-fold'
        },
        {
          id: 'hero-section',
          framework: FrameworkType.VUE,
          isInteractive: true,
          content: '<section><h1>Hero Content</h1><button>CTA</button></section>',
          position: 'above-fold'
        },
        {
          id: 'content-grid',
          framework: FrameworkType.SVELTE,
          isInteractive: true,
          content: '<div class="grid">Content Grid</div>',
          position: 'below-fold'
        },
        {
          id: 'footer',
          framework: FrameworkType.SOLID,
          isInteractive: false,
          content: '<footer>Footer Content</footer>',
          position: 'below-fold'
        }
      ];

      // 1. Server-side rendering
      const ssrResult = await ssrManager.renderServerContent(pageComponents);
      expect(ssrResult.html).toBeDefined();
      expect(ssrResult.frameworkRequirements).toHaveLength(4);

      // 2. Identify hydration targets
      const hydrationTargets = ssrManager.identifyHydrationTargets(ssrResult.html);
      const interactiveTargets = hydrationTargets.filter(t => t.isInteractive);
      expect(interactiveTargets).toHaveLength(2); // hero-section and content-grid

      // 3. Load frameworks based on priority
      const highPriorityTargets = interactiveTargets.filter(t => t.priority === LoadPriority.HIGH);
      for (const target of highPriorityTargets) {
        const framework = await frameworkLoader.loadFramework(target.framework, target.priority);
        expect(framework).toBeDefined();
      }

      // 4. Perform selective hydration with layout stability
      for (const target of interactiveTargets) {
        const element = mockDocument.createElement('div');
        element.id = target.componentId;
        
        const reservation = layoutController.preserveLayout(element);
        await ssrManager.hydrateComponent(target);
        layoutController.releaseLayout(reservation);
      }

      // 5. Verify final state
      const clsMetrics = layoutController.measureLayoutShift();
      expect(clsMetrics.score).toBeLessThan(0.1);

      // Cleanup
      ssrManager.destroy();
      frameworkLoader.destroy();
      layoutController.destroy();
    });

    it('should handle network failures during SSR lazy loading', async () => {
      const ssrManager = new SSROptimizationManager();
      const fallback = new ProgressiveEnhancementFallback();

      // Simulate network failure
      const failingComponents = [{
        id: 'network-dependent-widget',
        framework: FrameworkType.REACT,
        isInteractive: true,
        content: '<div>Loading...</div>'
      }];

      // Enable progressive enhancement
      ssrManager.enableProgressiveEnhancement({
        enableServerRenderedFallback: true,
        enableMinimalClientSide: true,
        gracefulDegradation: true
      });

      // Render with fallback
      const ssrResult = await ssrManager.renderServerContent(failingComponents);
      expect(ssrResult.html).toContain('Loading...');

      // Handle framework loading failure
      const component = failingComponents[0];
      const error = new Error('Network timeout');
      const recovery = await fallback.handleFrameworkLoadingFailure(component, error);

      expect(recovery.maintainsFunctionality).toBe(true);
      expect(recovery.fallbackStrategy).toBeDefined();

      // Cleanup
      ssrManager.destroy();
    });
  });
});