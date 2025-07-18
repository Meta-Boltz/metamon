/**
 * Selective Hydration Service
 * 
 * Handles selective hydration of components based on interactivity requirements,
 * viewport visibility, and user interactions.
 */

import {
  HydrationTarget,
  LoadPriority,
  FrameworkType,
  ComponentDefinition
} from '../types/ssr-optimization.js';

export interface HydrationStrategy {
  name: string;
  shouldHydrate(target: HydrationTarget): boolean;
  priority: LoadPriority;
}

export interface HydrationScheduler {
  schedule(target: HydrationTarget): void;
  cancel(componentId: string): void;
  flush(): Promise<void>;
}

export class SelectiveHydrationService {
  private strategies: HydrationStrategy[] = [];
  private scheduler: HydrationScheduler;
  private intersectionObserver?: IntersectionObserver;
  private hydrationQueue: Map<string, HydrationTarget> = new Map();
  private hydratedComponents: Set<string> = new Set();

  constructor() {
    this.scheduler = new DefaultHydrationScheduler();
    this.setupDefaultStrategies();
    this.setupIntersectionObserver();
  }

  /**
   * Registers a hydration strategy
   */
  registerStrategy(strategy: HydrationStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => this.comparePriority(a.priority, b.priority));
  }

  /**
   * Processes hydration targets and schedules hydration based on strategies
   */
  processHydrationTargets(targets: HydrationTarget[]): void {
    for (const target of targets) {
      if (this.shouldScheduleHydration(target)) {
        this.scheduleHydration(target);
      }
    }
  }

  /**
   * Schedules hydration for a specific target
   */
  scheduleHydration(target: HydrationTarget): void {
    if (this.hydratedComponents.has(target.componentId)) {
      return; // Already hydrated
    }

    this.hydrationQueue.set(target.componentId, target);
    this.scheduler.schedule(target);

    // Set up viewport observation for lazy hydration
    if (target.priority === LoadPriority.LOW || target.priority === LoadPriority.NORMAL) {
      this.observeForViewport(target);
    }
  }

  /**
   * Forces immediate hydration of a component
   */
  async hydrateImmediately(componentId: string): Promise<void> {
    const target = this.hydrationQueue.get(componentId);
    if (!target) {
      throw new Error(`Hydration target not found: ${componentId}`);
    }

    await this.performHydration(target);
  }

  /**
   * Cancels scheduled hydration for a component
   */
  cancelHydration(componentId: string): void {
    this.hydrationQueue.delete(componentId);
    this.scheduler.cancel(componentId);
  }

  /**
   * Gets the current hydration queue status
   */
  getQueueStatus(): { pending: number; hydrated: number } {
    return {
      pending: this.hydrationQueue.size,
      hydrated: this.hydratedComponents.size
    };
  }

  /**
   * Flushes all pending hydrations
   */
  async flushHydrations(): Promise<void> {
    await this.scheduler.flush();
  }

  // Private methods

  private setupDefaultStrategies(): void {
    // Strategy 1: Immediate hydration for critical interactive components
    this.registerStrategy({
      name: 'immediate-interactive',
      shouldHydrate: (target) => target.isInteractive && target.priority === LoadPriority.CRITICAL,
      priority: LoadPriority.CRITICAL
    });

    // Strategy 2: Viewport-based hydration for high priority components
    this.registerStrategy({
      name: 'viewport-high-priority',
      shouldHydrate: (target) => target.priority === LoadPriority.HIGH,
      priority: LoadPriority.HIGH
    });

    // Strategy 3: Interaction-based hydration for normal priority
    this.registerStrategy({
      name: 'interaction-based',
      shouldHydrate: (target) => target.isInteractive && target.priority === LoadPriority.NORMAL,
      priority: LoadPriority.NORMAL
    });

    // Strategy 4: Lazy hydration for low priority components
    this.registerStrategy({
      name: 'lazy-hydration',
      shouldHydrate: (target) => target.priority === LoadPriority.LOW,
      priority: LoadPriority.LOW
    });
  }

  private setupIntersectionObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const componentId = entry.target.getAttribute('data-hydration-id');
            if (componentId && this.hydrationQueue.has(componentId)) {
              this.hydrateImmediately(componentId).catch(console.error);
            }
          }
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );
  }

  private shouldScheduleHydration(target: HydrationTarget): boolean {
    // Check if any strategy matches
    return this.strategies.some(strategy => strategy.shouldHydrate(target));
  }

  private observeForViewport(target: HydrationTarget): void {
    if (!this.intersectionObserver) {
      return;
    }

    const element = document.querySelector(target.selector);
    if (element) {
      this.intersectionObserver.observe(element);
    }
  }

  private async performHydration(target: HydrationTarget): Promise<void> {
    try {
      const element = document.querySelector(target.selector);
      if (!element) {
        throw new Error(`Element not found for hydration: ${target.selector}`);
      }

      // Mark as hydrating
      element.setAttribute('data-hydrating', 'true');

      // Load framework if needed
      await this.ensureFrameworkLoaded(target.framework);

      // Perform actual hydration
      await this.hydrateElement(element, target);

      // Mark as hydrated
      element.setAttribute('data-hydrated', 'true');
      element.removeAttribute('data-hydrating');
      
      this.hydratedComponents.add(target.componentId);
      this.hydrationQueue.delete(target.componentId);

      // Stop observing
      if (this.intersectionObserver) {
        this.intersectionObserver.unobserve(element);
      }

    } catch (error) {
      console.error(`Hydration failed for ${target.componentId}:`, error);
      this.handleHydrationError(target, error);
    }
  }

  private async ensureFrameworkLoaded(framework: FrameworkType): Promise<void> {
    // This would integrate with the framework loader service
    // For now, simulate framework loading
    if (!window[`__${framework}_loaded`]) {
      await new Promise(resolve => setTimeout(resolve, 50));
      window[`__${framework}_loaded`] = true;
    }
  }

  private async hydrateElement(element: Element, target: HydrationTarget): Promise<void> {
    // Framework-specific hydration logic would go here
    switch (target.framework) {
      case 'react':
        await this.hydrateReactComponent(element, target);
        break;
      case 'vue':
        await this.hydrateVueComponent(element, target);
        break;
      case 'svelte':
        await this.hydrateSvelteComponent(element, target);
        break;
      case 'solid':
        await this.hydrateSolidComponent(element, target);
        break;
      default:
        throw new Error(`Unsupported framework: ${target.framework}`);
    }
  }

  private async hydrateReactComponent(element: Element, target: HydrationTarget): Promise<void> {
    // React hydration logic
    console.log(`Hydrating React component: ${target.componentId}`);
    
    // Simulate React hydration
    if (target.isInteractive) {
      element.addEventListener('click', () => {
        console.log(`React component ${target.componentId} clicked`);
      });
    }
  }

  private async hydrateVueComponent(element: Element, target: HydrationTarget): Promise<void> {
    // Vue hydration logic
    console.log(`Hydrating Vue component: ${target.componentId}`);
    
    // Simulate Vue hydration
    if (target.isInteractive) {
      element.addEventListener('click', () => {
        console.log(`Vue component ${target.componentId} clicked`);
      });
    }
  }

  private async hydrateSvelteComponent(element: Element, target: HydrationTarget): Promise<void> {
    // Svelte hydration logic
    console.log(`Hydrating Svelte component: ${target.componentId}`);
    
    // Simulate Svelte hydration
    if (target.isInteractive) {
      element.addEventListener('click', () => {
        console.log(`Svelte component ${target.componentId} clicked`);
      });
    }
  }

  private async hydrateSolidComponent(element: Element, target: HydrationTarget): Promise<void> {
    // Solid hydration logic
    console.log(`Hydrating Solid component: ${target.componentId}`);
    
    // Simulate Solid hydration
    if (target.isInteractive) {
      element.addEventListener('click', () => {
        console.log(`Solid component ${target.componentId} clicked`);
      });
    }
  }

  private handleHydrationError(target: HydrationTarget, error: any): void {
    const element = document.querySelector(target.selector);
    if (element) {
      element.setAttribute('data-hydration-error', 'true');
      element.removeAttribute('data-hydrating');
      
      // Apply fallback content
      const fallbackContent = element.querySelector('[data-fallback]');
      if (fallbackContent) {
        fallbackContent.style.display = 'block';
      }
    }

    // Remove from queue
    this.hydrationQueue.delete(target.componentId);
  }

  private comparePriority(a: LoadPriority, b: LoadPriority): number {
    const priorityOrder = {
      [LoadPriority.CRITICAL]: 0,
      [LoadPriority.HIGH]: 1,
      [LoadPriority.NORMAL]: 2,
      [LoadPriority.LOW]: 3
    };
    return priorityOrder[a] - priorityOrder[b];
  }
}

/**
 * Default hydration scheduler implementation
 */
class DefaultHydrationScheduler implements HydrationScheduler {
  private queue: Map<string, HydrationTarget> = new Map();
  private processing = false;

  schedule(target: HydrationTarget): void {
    this.queue.set(target.componentId, target);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  cancel(componentId: string): void {
    this.queue.delete(componentId);
  }

  async flush(): Promise<void> {
    while (this.queue.size > 0) {
      await this.processQueue();
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.size === 0) {
      return;
    }

    this.processing = true;

    try {
      // Process high priority items first
      const targets = Array.from(this.queue.values())
        .sort((a, b) => this.comparePriority(a.priority, b.priority));

      for (const target of targets.slice(0, 3)) { // Process up to 3 at a time
        this.queue.delete(target.componentId);
        // The actual hydration would be handled by the SelectiveHydrationService
      }
    } finally {
      this.processing = false;
    }
  }

  private comparePriority(a: LoadPriority, b: LoadPriority): number {
    const priorityOrder = {
      [LoadPriority.CRITICAL]: 0,
      [LoadPriority.HIGH]: 1,
      [LoadPriority.NORMAL]: 2,
      [LoadPriority.LOW]: 3
    };
    return priorityOrder[a] - priorityOrder[b];
  }
}