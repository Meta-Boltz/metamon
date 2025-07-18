/**
 * SSR Optimization Manager
 * 
 * Manages server-side rendering optimization with selective hydration,
 * framework requirement analysis, and progressive enhancement fallbacks.
 */

import {
  ComponentDefinition,
  SSRResult,
  HydrationTarget,
  FrameworkRequirement,
  SSROptimizationManager as ISSROptimizationManager,
  SSROptimizationConfig,
  FallbackStrategy,
  LoadPriority,
  FrameworkType,
  SSRMetrics,
  HydrationData
} from '../types/ssr-optimization.js';

export class SSROptimizationManager implements ISSROptimizationManager {
  private config: SSROptimizationConfig;
  private metrics: SSRMetrics;
  private hydrationQueue: Map<string, HydrationTarget> = new Map();
  private frameworkCache: Map<FrameworkType, any> = new Map();

  constructor(config?: Partial<SSROptimizationConfig>) {
    this.config = {
      enableSelectiveHydration: true,
      hydrateOnlyInteractive: true,
      enableProgressiveEnhancement: true,
      fallbackStrategy: FallbackStrategy.GRACEFUL_DEGRADATION,
      performanceThresholds: {
        maxHydrationTime: 100,
        maxFrameworkLoadTime: 200,
        maxLayoutShift: 0.1
      },
      ...config
    };

    this.metrics = {
      renderTime: 0,
      hydrationTime: 0,
      frameworkLoadTime: new Map(),
      layoutShiftScore: 0,
      interactiveComponents: 0,
      totalComponents: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Renders server content with optimization for selective hydration
   */
  async renderServerContent(components: ComponentDefinition[]): Promise<SSRResult> {
    const startTime = performance.now();
    
    try {
      // Analyze framework requirements first
      const frameworkRequirements = this.analyzeFrameworkRequirements(components);
      
      // Generate optimized HTML with hydration markers
      const html = await this.generateOptimizedHTML(components);
      
      // Extract critical CSS
      const criticalCSS = await this.extractCriticalCSS(components);
      
      // Prepare hydration data
      const hydrationData = this.prepareHydrationData(components);
      
      this.metrics.renderTime = performance.now() - startTime;
      this.metrics.totalComponents = components.length;
      this.metrics.interactiveComponents = components.filter(c => c.isInteractive).length;

      return {
        html,
        criticalCSS,
        hydrationData,
        frameworkRequirements
      };
    } catch (error) {
      console.error('SSR rendering failed:', error);
      return this.handleSSRFailure(components);
    }
  }

  /**
   * Identifies components that need hydration based on interactivity
   */
  identifyHydrationTargets(ssrContent: string): HydrationTarget[] {
    const targets: HydrationTarget[] = [];
    
    // Parse SSR content for hydration markers
    const hydrationMarkers = this.parseHydrationMarkers(ssrContent);
    
    for (const marker of hydrationMarkers) {
      if (this.shouldHydrateComponent(marker)) {
        targets.push({
          componentId: marker.id,
          framework: marker.framework,
          isInteractive: marker.isInteractive,
          priority: this.calculateHydrationPriority(marker),
          selector: `[data-hydration-id="${marker.id}"]`,
          props: marker.props,
          state: marker.state
        });
      }
    }

    return targets.sort((a, b) => this.comparePriority(a.priority, b.priority));
  }

  /**
   * Hydrates a specific component with framework loading optimization
   */
  async hydrateComponent(target: HydrationTarget): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Check if framework is already loaded
      let framework = this.frameworkCache.get(target.framework);
      
      if (!framework) {
        // Load framework on-demand
        framework = await this.loadFramework(target.framework);
        this.frameworkCache.set(target.framework, framework);
      }

      // Find the target element
      const element = document.querySelector(target.selector);
      if (!element) {
        throw new Error(`Hydration target not found: ${target.selector}`);
      }

      // Perform selective hydration
      await this.performHydration(element, target, framework);
      
      // Update metrics
      const hydrationTime = performance.now() - startTime;
      this.metrics.hydrationTime += hydrationTime;
      
      // Remove from queue
      this.hydrationQueue.delete(target.componentId);
      
    } catch (error) {
      console.error(`Hydration failed for component ${target.componentId}:`, error);
      await this.handleHydrationFailure(target);
    }
  }

  /**
   * Analyzes framework requirements for minimal client-side loading
   */
  analyzeFrameworkRequirements(components: ComponentDefinition[]): FrameworkRequirement[] {
    const frameworkMap = new Map<FrameworkType, FrameworkRequirement>();

    for (const component of components) {
      if (!frameworkMap.has(component.framework)) {
        frameworkMap.set(component.framework, {
          framework: component.framework,
          components: [],
          priority: LoadPriority.LOW,
          estimatedSize: this.getFrameworkSize(component.framework),
          dependencies: this.getFrameworkDependencies(component.framework)
        });
      }

      const requirement = frameworkMap.get(component.framework)!;
      requirement.components.push(component.id);
      
      // Upgrade priority if component has higher priority
      if (this.comparePriority(component.priority, requirement.priority) < 0) {
        requirement.priority = component.priority;
      }
    }

    return Array.from(frameworkMap.values())
      .filter(req => this.shouldLoadFramework(req))
      .sort((a, b) => this.comparePriority(a.priority, b.priority));
  }

  /**
   * Enables progressive enhancement with fallback strategies
   */
  enableProgressiveEnhancement(fallbackStrategy: FallbackStrategy): void {
    this.config.fallbackStrategy = fallbackStrategy;
    this.config.enableProgressiveEnhancement = true;
    
    // Set up fallback mechanisms
    this.setupFallbackMechanisms();
  }

  /**
   * Configures the SSR optimization manager
   */
  configure(config: SSROptimizationConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current performance metrics
   */
  getMetrics(): SSRMetrics {
    return { ...this.metrics };
  }

  // Private helper methods

  private async generateOptimizedHTML(components: ComponentDefinition[]): Promise<string> {
    let html = '';
    
    for (const component of components) {
      const componentHTML = await this.renderComponent(component);
      html += this.wrapWithHydrationMarker(componentHTML, component);
    }
    
    return html;
  }

  private async renderComponent(component: ComponentDefinition): Promise<string> {
    // This would integrate with actual framework SSR renderers
    // For now, return a placeholder that maintains the component structure
    return `<div class="component-${component.framework}" data-component="${component.component}">
      <!-- SSR content for ${component.id} -->
      <div class="component-content">Component rendered server-side</div>
    </div>`;
  }

  private wrapWithHydrationMarker(html: string, component: ComponentDefinition): string {
    const marker = {
      id: component.id,
      framework: component.framework,
      isInteractive: component.isInteractive,
      props: component.props
    };

    return `<div data-hydration-id="${component.id}" data-hydration-marker='${JSON.stringify(marker)}'>
      ${html}
    </div>`;
  }

  private async extractCriticalCSS(components: ComponentDefinition[]): Promise<string> {
    // Extract CSS that's critical for above-the-fold content
    const criticalComponents = components.filter(c => c.priority === LoadPriority.CRITICAL);
    
    // This would integrate with CSS extraction tools
    return criticalComponents.map(c => 
      `.component-${c.framework} { /* Critical styles */ }`
    ).join('\n');
  }

  private prepareHydrationData(components: ComponentDefinition[]): HydrationData {
    const interactiveComponents = components.filter(c => c.isInteractive);
    
    return {
      components: interactiveComponents.map(c => ({
        componentId: c.id,
        framework: c.framework,
        isInteractive: c.isInteractive,
        priority: c.priority,
        selector: `[data-hydration-id="${c.id}"]`,
        props: c.props
      })),
      state: {},
      metadata: {
        timestamp: Date.now(),
        version: '1.0.0',
        checksum: this.generateChecksum(interactiveComponents)
      }
    };
  }

  private parseHydrationMarkers(ssrContent: string): any[] {
    const markers: any[] = [];
    const markerRegex = /data-hydration-marker='([^']+)'/g;
    let match;

    while ((match = markerRegex.exec(ssrContent)) !== null) {
      try {
        const marker = JSON.parse(match[1]);
        markers.push(marker);
      } catch (error) {
        console.warn('Failed to parse hydration marker:', match[1]);
      }
    }

    return markers;
  }

  private shouldHydrateComponent(marker: any): boolean {
    if (!this.config.enableSelectiveHydration) {
      return true;
    }

    // Always include components in hydration targets, but prioritize interactive ones
    // The actual hydration decision will be made by the selective hydration service
    return true;
  }

  private calculateHydrationPriority(marker: any): LoadPriority {
    if (marker.isInteractive) {
      return LoadPriority.HIGH;
    }
    return LoadPriority.NORMAL;
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

  private async loadFramework(framework: FrameworkType): Promise<any> {
    const startTime = performance.now();
    
    try {
      // This would integrate with the framework loader service
      // For now, simulate framework loading
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const loadTime = performance.now() - startTime;
      this.metrics.frameworkLoadTime.set(framework, loadTime);
      
      return { name: framework, loaded: true };
    } catch (error) {
      console.error(`Failed to load framework ${framework}:`, error);
      throw error;
    }
  }

  private async performHydration(element: Element, target: HydrationTarget, framework: any): Promise<void> {
    // This would integrate with actual framework hydration APIs
    // For now, simulate hydration
    element.setAttribute('data-hydrated', 'true');
    element.setAttribute('data-framework', target.framework);
    
    // Add event listeners for interactive components
    if (target.isInteractive) {
      this.attachInteractiveHandlers(element, target);
    }
  }

  private attachInteractiveHandlers(element: Element, target: HydrationTarget): void {
    // Add basic interactivity
    element.addEventListener('click', (event) => {
      console.log(`Interactive component ${target.componentId} clicked`);
    });
  }

  private getFrameworkSize(framework: FrameworkType): number {
    const sizes = {
      react: 45000,
      vue: 35000,
      svelte: 15000,
      solid: 25000
    };
    return sizes[framework] || 30000;
  }

  private getFrameworkDependencies(framework: FrameworkType): string[] {
    const dependencies = {
      react: ['react-dom'],
      vue: ['@vue/runtime-dom'],
      svelte: [],
      solid: ['solid-js/web']
    };
    return dependencies[framework] || [];
  }

  private shouldLoadFramework(requirement: FrameworkRequirement): boolean {
    // Load all frameworks that have components
    return requirement.components.length > 0;
  }

  private async handleSSRFailure(components: ComponentDefinition[]): Promise<SSRResult> {
    console.warn('SSR failed, falling back to client-side rendering');
    
    return {
      html: '<div data-ssr-fallback="true">Loading...</div>',
      criticalCSS: '',
      hydrationData: {
        components: [],
        state: {},
        metadata: {
          timestamp: Date.now(),
          version: '1.0.0',
          checksum: ''
        }
      },
      frameworkRequirements: this.analyzeFrameworkRequirements(components)
    };
  }

  private async handleHydrationFailure(target: HydrationTarget): Promise<void> {
    const element = document.querySelector(target.selector);
    if (element) {
      element.setAttribute('data-hydration-failed', 'true');
      
      // Apply fallback strategy
      switch (this.config.fallbackStrategy) {
        case FallbackStrategy.GRACEFUL_DEGRADATION:
          element.innerHTML = '<div>Content unavailable</div>';
          break;
        case FallbackStrategy.MINIMAL_FALLBACK:
          element.style.display = 'none';
          break;
        default:
          // Keep existing content
          break;
      }
    }
  }

  private setupFallbackMechanisms(): void {
    // Only set up in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    // Set up global error handlers for progressive enhancement
    window.addEventListener('error', (event) => {
      if (event.error?.message?.includes('hydration')) {
        console.warn('Hydration error detected, applying fallback strategy');
      }
    });

    // Set up service worker fallback detection
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('error', () => {
        console.warn('Service worker error, enabling direct loading fallback');
      });
    }
  }

  private generateChecksum(components: ComponentDefinition[]): string {
    const data = JSON.stringify(components.map(c => ({ id: c.id, framework: c.framework })));
    // Simple checksum implementation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}