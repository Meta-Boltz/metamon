/**
 * Progressive Hydration System for Ultra-Modern MTM
 * Hydrates client-side components progressively with minimal JavaScript execution
 */

import { signal } from './signal-system.js';

export class HydrationSystem {
  constructor(options = {}) {
    this.options = {
      enableProgressiveHydration: true,
      hydrateOnVisible: true,
      hydrateOnInteraction: true,
      hydrateOnIdle: true,
      intersectionThreshold: 0.1,
      idleTimeout: 2000,
      maxHydrationTime: 5000,
      enableHydrationMismatchDetection: true,
      logHydrationEvents: false,
      ...options
    };

    // Hydration state
    this.hydrationQueue = new Map();
    this.hydratedComponents = new Set();
    this.hydrationErrors = [];
    this.hydrationMetrics = {
      totalComponents: 0,
      hydratedComponents: 0,
      failedComponents: 0,
      averageHydrationTime: 0,
      totalHydrationTime: 0
    };

    // Observers and timers
    this.intersectionObserver = null;
    this.idleTimer = null;
    this.hydrationStartTime = null;

    // Component registry
    this.componentRegistry = new Map();
    this.hydrationStrategies = new Map();

    // Initialize hydration system
    this.init();
  }

  /**
   * Initialize the hydration system
   */
  init() {
    if (typeof window === 'undefined') return;

    console.log('🔄 Initializing progressive hydration system...');

    // Check if we're in an SSR environment
    this.isSSR = window.__SSR_RENDERED__ === true;
    this.ssrData = window.__SSR_DATA__ || {};
    this.ssrRoute = window.__SSR_ROUTE__ || '/';

    if (this.isSSR) {
      console.log('🏗️ SSR detected, preparing for hydration...');
      this.prepareSSRHydration();
    }

    // Set up intersection observer for viewport-based hydration
    if (this.options.hydrateOnVisible && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.setupIntersectionObserver();
    }

    // Set up idle hydration
    if (this.options.hydrateOnIdle) {
      this.setupIdleHydration();
    }

    // Set up interaction-based hydration
    if (this.options.hydrateOnInteraction) {
      this.setupInteractionHydration();
    }

    // Start hydration process
    this.startHydration();

    console.log('✅ Hydration system initialized');
  }

  /**
   * Prepare SSR hydration by scanning existing DOM
   */
  prepareSSRHydration() {
    // Find all components that need hydration
    const ssrComponents = document.querySelectorAll('[data-ssr-component]');

    ssrComponents.forEach((element, index) => {
      const componentId = element.getAttribute('data-ssr-component') || `ssr-component-${index}`;
      const componentType = element.getAttribute('data-component-type') || 'unknown';
      const hydrationStrategy = element.getAttribute('data-hydration-strategy') || 'immediate';

      this.registerComponentForHydration(componentId, {
        element,
        type: componentType,
        strategy: hydrationStrategy,
        ssrRendered: true,
        data: this.extractComponentData(element)
      });
    });

    console.log(`📦 Found ${ssrComponents.length} SSR components for hydration`);
  }

  /**
   * Register a component for hydration
   */
  registerComponentForHydration(componentId, config) {
    const hydrationConfig = {
      id: componentId,
      element: config.element,
      type: config.type || 'component',
      strategy: config.strategy || 'immediate',
      ssrRendered: config.ssrRendered || false,
      data: config.data || {},
      loader: config.loader || null,
      priority: config.priority || 0,
      dependencies: config.dependencies || [],
      hydrated: false,
      hydrationTime: null,
      error: null,
      ...config
    };

    this.hydrationQueue.set(componentId, hydrationConfig);
    this.hydrationStrategies.set(componentId, hydrationConfig.strategy);

    if (this.options.logHydrationEvents) {
      console.log(`📝 Registered component for hydration: ${componentId} (${hydrationConfig.strategy})`);
    }
  }

  /**
   * Start the hydration process
   */
  startHydration() {
    this.hydrationStartTime = performance.now();

    console.log('🚀 Starting progressive hydration...');

    // Hydrate immediate components first
    this.hydrateByStrategy('immediate');

    // Set up other hydration strategies
    this.scheduleHydrationStrategies();

    // Monitor hydration progress
    this.monitorHydrationProgress();
  }

  /**
   * Hydrate components by strategy
   */
  async hydrateByStrategy(strategy) {
    const components = Array.from(this.hydrationQueue.values())
      .filter(config => config.strategy === strategy && !config.hydrated)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const config of components) {
      try {
        await this.hydrateComponent(config);
      } catch (error) {
        console.error(`❌ Failed to hydrate component ${config.id}:`, error);
        this.recordHydrationError(config.id, error);
      }
    }
  }

  /**
   * Hydrate a single component
   */
  async hydrateComponent(config) {
    if (config.hydrated || this.hydratedComponents.has(config.id)) {
      return;
    }

    const startTime = performance.now();

    try {
      if (this.options.logHydrationEvents) {
        console.log(`🔄 Hydrating component: ${config.id}`);
      }

      // Check for hydration mismatches if SSR rendered
      if (config.ssrRendered && this.options.enableHydrationMismatchDetection) {
        await this.detectHydrationMismatches(config);
      }

      // Load component if needed
      let Component = config.component;
      if (!Component && config.loader) {
        const module = await config.loader();
        Component = module.default || module;
      }

      if (!Component) {
        throw new Error(`No component found for ${config.id}`);
      }

      // Prepare hydration context
      const hydrationContext = {
        isHydration: true,
        ssrData: this.ssrData,
        componentData: config.data,
        element: config.element,
        route: this.ssrRoute
      };

      // Hydrate the component
      const hydratedInstance = await this.performComponentHydration(
        Component,
        config.element,
        hydrationContext
      );

      // Mark as hydrated
      config.hydrated = true;
      config.hydrationTime = performance.now() - startTime;
      config.instance = hydratedInstance;

      this.hydratedComponents.add(config.id);
      this.updateHydrationMetrics(config);

      // Emit hydration event
      signal.emit('component-hydrated', {
        id: config.id,
        type: config.type,
        hydrationTime: config.hydrationTime
      });

      if (this.options.logHydrationEvents) {
        console.log(`✅ Hydrated component: ${config.id} (${config.hydrationTime.toFixed(2)}ms)`);
      }

    } catch (error) {
      config.error = error;
      this.recordHydrationError(config.id, error);
      throw error;
    }
  }

  /**
   * Perform actual component hydration
   */
  async performComponentHydration(Component, element, context) {
    try {
      // For SSR components, we need to attach event listeners and reactive state
      if (context.isHydration && element) {
        // Create component instance
        const instance = new Component(context);

        // If component has a hydrate method, use it
        if (typeof instance.hydrate === 'function') {
          await instance.hydrate(element, context);
        } else if (typeof Component.hydrate === 'function') {
          await Component.hydrate(element, context);
        } else {
          // Default hydration: attach event listeners and initialize state
          await this.defaultHydration(instance, element, context);
        }

        return instance;
      } else {
        // Regular component instantiation
        return new Component(context);
      }

    } catch (error) {
      console.error('Component hydration failed:', error);
      throw error;
    }
  }

  /**
   * Default hydration process
   */
  async defaultHydration(instance, element, context) {
    // Restore reactive state from SSR data
    if (context.ssrData && instance.restoreState) {
      instance.restoreState(context.ssrData);
    }

    // Attach event listeners
    if (instance.attachEventListeners) {
      instance.attachEventListeners(element);
    } else {
      this.attachDefaultEventListeners(element, instance);
    }

    // Initialize reactive updates
    if (instance.initializeReactivity) {
      instance.initializeReactivity();
    }

    // Run any post-hydration setup
    if (instance.onHydrated) {
      await instance.onHydrated();
    }
  }

  /**
   * Attach default event listeners
   */
  attachDefaultEventListeners(element, instance) {
    // Find all elements with event handlers
    const interactiveElements = element.querySelectorAll('[data-event]');

    interactiveElements.forEach(el => {
      const eventType = el.getAttribute('data-event');
      const handlerName = el.getAttribute('data-handler');

      if (eventType && handlerName && instance[handlerName]) {
        el.addEventListener(eventType, instance[handlerName].bind(instance));
      }
    });

    // Handle form submissions
    const forms = element.querySelectorAll('form');
    forms.forEach(form => {
      if (instance.handleSubmit) {
        form.addEventListener('submit', instance.handleSubmit.bind(instance));
      }
    });

    // Handle button clicks
    const buttons = element.querySelectorAll('button[data-action]');
    buttons.forEach(button => {
      const action = button.getAttribute('data-action');
      if (action && instance[action]) {
        button.addEventListener('click', instance[action].bind(instance));
      }
    });
  }

  /**
   * Detect hydration mismatches
   */
  async detectHydrationMismatches(config) {
    if (!config.element || !config.ssrRendered) return;

    try {
      // Compare current DOM with expected structure
      const currentHTML = config.element.innerHTML;
      const expectedHTML = config.data.expectedHTML || currentHTML;

      if (currentHTML !== expectedHTML) {
        console.warn(`⚠️ Hydration mismatch detected for ${config.id}`);

        // Try to recover from mismatch
        if (this.options.enableHydrationMismatchDetection) {
          await this.recoverFromHydrationMismatch(config, currentHTML, expectedHTML);
        }
      }

    } catch (error) {
      console.warn(`Failed to detect hydration mismatches for ${config.id}:`, error);
    }
  }

  /**
   * Recover from hydration mismatch
   */
  async recoverFromHydrationMismatch(config, currentHTML, expectedHTML) {
    console.log(`🔧 Attempting to recover from hydration mismatch: ${config.id}`);

    try {
      // Strategy 1: Re-render the component
      if (config.loader) {
        const module = await config.loader();
        const Component = module.default || module;

        if (Component && typeof Component === 'function') {
          const newElement = Component({
            ...config.data,
            isHydration: false // Force re-render
          });

          if (newElement && typeof newElement === 'string') {
            config.element.innerHTML = newElement;
            console.log(`✅ Recovered from hydration mismatch: ${config.id}`);
            return;
          }
        }
      }

      // Strategy 2: Use expected HTML
      if (expectedHTML && expectedHTML !== currentHTML) {
        config.element.innerHTML = expectedHTML;
        console.log(`✅ Recovered using expected HTML: ${config.id}`);
        return;
      }

      // Strategy 3: Mark as client-only component
      config.element.setAttribute('data-hydration-failed', 'true');
      console.warn(`⚠️ Could not recover from hydration mismatch: ${config.id}`);

    } catch (error) {
      console.error(`❌ Failed to recover from hydration mismatch: ${config.id}`, error);
    }
  }

  /**
   * Schedule hydration strategies
   */
  scheduleHydrationStrategies() {
    // Visible components (intersection observer)
    if (this.options.hydrateOnVisible && this.intersectionObserver) {
      this.scheduleVisibleHydration();
    }

    // Interaction-based hydration
    if (this.options.hydrateOnInteraction) {
      this.scheduleInteractionHydration();
    }

    // Idle hydration
    if (this.options.hydrateOnIdle) {
      this.scheduleIdleHydration();
    }
  }

  /**
   * Schedule visible hydration
   */
  scheduleVisibleHydration() {
    const visibleComponents = Array.from(this.hydrationQueue.values())
      .filter(config => config.strategy === 'visible' && !config.hydrated);

    visibleComponents.forEach(config => {
      if (config.element) {
        this.intersectionObserver.observe(config.element);
      }
    });
  }

  /**
   * Schedule interaction hydration
   */
  scheduleInteractionHydration() {
    const interactionComponents = Array.from(this.hydrationQueue.values())
      .filter(config => config.strategy === 'interaction' && !config.hydrated);

    interactionComponents.forEach(config => {
      if (config.element) {
        this.setupComponentInteractionListeners(config);
      }
    });
  }

  /**
   * Schedule idle hydration
   */
  scheduleIdleHydration() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      this.hydrateByStrategy('idle');
    }, this.options.idleTimeout);
  }

  /**
   * Setup intersection observer
   */
  setupIntersectionObserver() {
    this.intersectionObserver = new window.IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target;
            const componentId = element.getAttribute('data-ssr-component');

            if (componentId && this.hydrationQueue.has(componentId)) {
              const config = this.hydrationQueue.get(componentId);
              if (!config.hydrated) {
                this.hydrateComponent(config).catch(error => {
                  console.error(`Failed to hydrate visible component ${componentId}:`, error);
                });
              }
            }

            this.intersectionObserver.unobserve(element);
          }
        });
      },
      {
        threshold: this.options.intersectionThreshold,
        rootMargin: '50px'
      }
    );
  }

  /**
   * Setup idle hydration
   */
  setupIdleHydration() {
    // Use requestIdleCallback if available
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleCallback = (deadline) => {
        while (deadline.timeRemaining() > 0) {
          const idleComponents = Array.from(this.hydrationQueue.values())
            .filter(config => config.strategy === 'idle' && !config.hydrated)
            .slice(0, 1); // Process one at a time during idle

          if (idleComponents.length === 0) break;

          const config = idleComponents[0];
          this.hydrateComponent(config).catch(error => {
            console.error(`Failed to hydrate idle component ${config.id}:`, error);
          });
        }

        // Schedule next idle callback if there are more components
        const remainingIdle = Array.from(this.hydrationQueue.values())
          .filter(config => config.strategy === 'idle' && !config.hydrated);

        if (remainingIdle.length > 0) {
          window.requestIdleCallback(idleCallback);
        }
      };

      window.requestIdleCallback(idleCallback);
    } else {
      // Fallback to setTimeout
      this.scheduleIdleHydration();
    }
  }

  /**
   * Setup interaction hydration
   */
  setupInteractionHydration() {
    const interactionEvents = ['click', 'touchstart', 'keydown', 'mouseover'];

    const handleInteraction = (event) => {
      const element = event.target.closest('[data-ssr-component]');
      if (!element) return;

      const componentId = element.getAttribute('data-ssr-component');
      if (!componentId || !this.hydrationQueue.has(componentId)) return;

      const config = this.hydrationQueue.get(componentId);
      if (config.strategy === 'interaction' && !config.hydrated) {
        this.hydrateComponent(config).catch(error => {
          console.error(`Failed to hydrate interactive component ${componentId}:`, error);
        });

        // Remove interaction listeners after hydration
        interactionEvents.forEach(eventType => {
          element.removeEventListener(eventType, handleInteraction);
        });
      }
    };

    // Add global interaction listeners
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, handleInteraction, { passive: true });
    });
  }

  /**
   * Setup component-specific interaction listeners
   */
  setupComponentInteractionListeners(config) {
    if (!config.element) return;

    const interactionEvents = ['click', 'touchstart', 'keydown', 'focus'];

    const handleComponentInteraction = () => {
      if (!config.hydrated) {
        this.hydrateComponent(config).catch(error => {
          console.error(`Failed to hydrate component ${config.id}:`, error);
        });
      }
    };

    interactionEvents.forEach(eventType => {
      config.element.addEventListener(eventType, handleComponentInteraction, {
        once: true,
        passive: true
      });
    });
  }

  /**
   * Extract component data from SSR element
   */
  extractComponentData(element) {
    const data = {};

    // Extract data attributes
    const attributes = element.attributes || [];
    Array.from(attributes).forEach(attr => {
      if (attr.name.startsWith('data-component-')) {
        const key = attr.name.replace('data-component-', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        data[key] = attr.value;
      }
    });

    // Extract JSON data if present
    if (element.querySelector) {
      const jsonData = element.querySelector('script[type="application/json"]');
      if (jsonData) {
        try {
          Object.assign(data, JSON.parse(jsonData.textContent));
        } catch (error) {
          console.warn('Failed to parse component JSON data:', error);
        }
      }
    }

    return data;
  }

  /**
   * Monitor hydration progress
   */
  monitorHydrationProgress() {
    const checkProgress = () => {
      const totalComponents = this.hydrationQueue.size;
      const hydratedCount = this.hydratedComponents.size;
      const progress = totalComponents > 0 ? (hydratedCount / totalComponents) * 100 : 100;

      signal.emit('hydration-progress', {
        total: totalComponents,
        hydrated: hydratedCount,
        progress: Math.round(progress),
        metrics: this.getHydrationMetrics()
      });

      // Check if hydration is complete
      if (hydratedCount === totalComponents) {
        this.completeHydration();
      } else if (performance.now() - this.hydrationStartTime > this.options.maxHydrationTime) {
        console.warn('⚠️ Hydration timeout reached, some components may not be hydrated');
        this.completeHydration();
      } else {
        // Continue monitoring
        setTimeout(checkProgress, 100);
      }
    };

    setTimeout(checkProgress, 100);
  }

  /**
   * Complete hydration process
   */
  completeHydration() {
    const totalTime = performance.now() - this.hydrationStartTime;
    const metrics = this.getHydrationMetrics();

    console.log(`🎉 Hydration complete! ${metrics.hydratedComponents}/${metrics.totalComponents} components hydrated in ${totalTime.toFixed(2)}ms`);

    signal.emit('hydration-complete', {
      totalTime,
      metrics,
      errors: this.hydrationErrors
    });

    // Clean up observers and timers
    this.cleanup();
  }

  /**
   * Record hydration error
   */
  recordHydrationError(componentId, error) {
    this.hydrationErrors.push({
      componentId,
      error: error.message,
      timestamp: Date.now(),
      stack: error.stack
    });

    this.hydrationMetrics.failedComponents++;

    signal.emit('hydration-error', {
      componentId,
      error: error.message
    });
  }

  /**
   * Update hydration metrics
   */
  updateHydrationMetrics(config) {
    this.hydrationMetrics.hydratedComponents++;
    this.hydrationMetrics.totalHydrationTime += config.hydrationTime;
    this.hydrationMetrics.averageHydrationTime =
      this.hydrationMetrics.totalHydrationTime / this.hydrationMetrics.hydratedComponents;
  }

  /**
   * Get hydration metrics
   */
  getHydrationMetrics() {
    return {
      ...this.hydrationMetrics,
      totalComponents: this.hydrationQueue.size,
      hydrationErrors: this.hydrationErrors.length
    };
  }

  /**
   * Check if component is hydrated
   */
  isComponentHydrated(componentId) {
    return this.hydratedComponents.has(componentId);
  }

  /**
   * Get hydrated component instance
   */
  getComponentInstance(componentId) {
    const config = this.hydrationQueue.get(componentId);
    return config ? config.instance : null;
  }

  /**
   * Force hydrate a component
   */
  async forceHydrate(componentId) {
    const config = this.hydrationQueue.get(componentId);
    if (!config) {
      throw new Error(`Component ${componentId} not found in hydration queue`);
    }

    if (config.hydrated) {
      console.warn(`Component ${componentId} is already hydrated`);
      return config.instance;
    }

    await this.hydrateComponent(config);
    return config.instance;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    console.log('🧹 Hydration system cleaned up');
  }
}

// Create global hydration system instance
let hydrationSystem = null;

export function createHydrationSystem(options = {}) {
  if (!hydrationSystem) {
    hydrationSystem = new HydrationSystem(options);
  }
  return hydrationSystem;
}

export function getHydrationSystem() {
  return hydrationSystem;
}

// Auto-initialize if in browser and SSR detected
if (typeof window !== 'undefined' && window.__SSR_RENDERED__) {
  createHydrationSystem();
}

export default HydrationSystem;