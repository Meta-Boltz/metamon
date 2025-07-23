/**
 * Component Loading Optimizer
 * Optimizes component loading and rendering performance
 */

import { runtimePerformanceTracker } from './runtime-performance-tracker.js';
import { routeComponentCache } from './route-cache.js';

/**
 * Component loading strategy
 */
export type LoadingStrategy = 'eager' | 'lazy' | 'idle' | 'viewport' | 'interaction';

/**
 * Component metadata
 */
export interface ComponentMetadata {
  name: string;
  size: number;
  dependencies: string[];
  loadTime: number;
  renderTime: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  strategy: LoadingStrategy;
  viewport?: {
    threshold: number;
    rootMargin: string;
  };
}

/**
 * Loading performance metrics
 */
export interface LoadingMetrics {
  componentName: string;
  loadTime: number;
  renderTime: number;
  cacheHit: boolean;
  strategy: LoadingStrategy;
  timestamp: number;
}

/**
 * Optimization configuration
 */
export interface OptimizerConfig {
  enableLazyLoading: boolean;
  enableViewportLoading: boolean;
  enableIdleLoading: boolean;
  enableInteractionLoading: boolean;
  viewportThreshold: number;
  idleTimeout: number;
  maxConcurrentLoads: number;
  priorityThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
}

/**
 * Component Loading Optimizer
 */
export class ComponentOptimizer {
  private loadingQueue: Array<{
    component: ComponentMetadata;
    resolver: (component: any) => void;
    rejector: (error: Error) => void;
  }> = [];
  
  private activeLoads = new Set<string>();
  private intersectionObserver?: IntersectionObserver;
  private idleCallback?: number;
  private loadingMetrics: LoadingMetrics[] = [];
  private componentRegistry = new Map<string, ComponentMetadata>();

  constructor(
    private config: OptimizerConfig = {
      enableLazyLoading: true,
      enableViewportLoading: true,
      enableIdleLoading: true,
      enableInteractionLoading: true,
      viewportThreshold: 0.1,
      idleTimeout: 100,
      maxConcurrentLoads: 3,
      priorityThresholds: {
        critical: 0,
        high: 100,
        medium: 500
      }
    }
  ) {
    this.initializeObservers();
  }

  /**
   * Initialize observers for viewport and idle loading
   */
  private initializeObservers(): void {
    if (typeof window === 'undefined') return;

    // Intersection Observer for viewport loading
    if (this.config.enableViewportLoading && 'IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const componentName = entry.target.getAttribute('data-component');
              if (componentName) {
                this.loadComponent(componentName, 'viewport');
              }
            }
          });
        },
        {
          threshold: this.config.viewportThreshold,
          rootMargin: '50px'
        }
      );
    }

    // Idle loading setup
    if (this.config.enableIdleLoading) {
      this.scheduleIdleLoading();
    }
  }

  /**
   * Register a component with metadata
   */
  registerComponent(metadata: ComponentMetadata): void {
    this.componentRegistry.set(metadata.name, metadata);
    
    console.log(`📝 Registered component: ${metadata.name} (${metadata.strategy}, ${metadata.priority} priority)`);
  }

  /**
   * Load component with optimized strategy
   */
  async loadComponent(
    componentName: string, 
    triggerStrategy?: LoadingStrategy
  ): Promise<any> {
    const metadata = this.componentRegistry.get(componentName);
    if (!metadata) {
      throw new Error(`Component ${componentName} not registered`);
    }

    // Check cache first
    const cached = routeComponentCache.get(componentName);
    if (cached) {
      this.recordLoadingMetrics({
        componentName,
        loadTime: 0,
        renderTime: 0,
        cacheHit: true,
        strategy: triggerStrategy || metadata.strategy,
        timestamp: Date.now()
      });
      
      return cached;
    }

    // Determine loading strategy
    const strategy = triggerStrategy || metadata.strategy;
    
    // Apply strategy-specific logic
    switch (strategy) {
      case 'eager':
        return this.loadEager(metadata);
      case 'lazy':
        return this.loadLazy(metadata);
      case 'idle':
        return this.loadIdle(metadata);
      case 'viewport':
        return this.loadViewport(metadata);
      case 'interaction':
        return this.loadInteraction(metadata);
      default:
        return this.loadEager(metadata);
    }
  }

  /**
   * Load component eagerly
   */
  private async loadEager(metadata: ComponentMetadata): Promise<any> {
    return this.performLoad(metadata, 'eager');
  }

  /**
   * Load component lazily
   */
  private async loadLazy(metadata: ComponentMetadata): Promise<any> {
    // Add to queue if too many concurrent loads
    if (this.activeLoads.size >= this.config.maxConcurrentLoads) {
      return new Promise((resolve, reject) => {
        this.loadingQueue.push({
          component: metadata,
          resolver: resolve,
          rejector: reject
        });
      });
    }

    return this.performLoad(metadata, 'lazy');
  }

  /**
   * Load component during idle time
   */
  private async loadIdle(metadata: ComponentMetadata): Promise<any> {
    return new Promise((resolve, reject) => {
      const loadWhenIdle = () => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            this.performLoad(metadata, 'idle').then(resolve).catch(reject);
          }, { timeout: this.config.idleTimeout });
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => {
            this.performLoad(metadata, 'idle').then(resolve).catch(reject);
          }, this.config.idleTimeout);
        }
      };

      loadWhenIdle();
    });
  }

  /**
   * Load component when in viewport
   */
  private async loadViewport(metadata: ComponentMetadata): Promise<any> {
    // This would typically be triggered by intersection observer
    // For now, just perform the load
    return this.performLoad(metadata, 'viewport');
  }

  /**
   * Load component on interaction
   */
  private async loadInteraction(metadata: ComponentMetadata): Promise<any> {
    return new Promise((resolve, reject) => {
      // Set up interaction listeners
      const loadOnInteraction = () => {
        this.performLoad(metadata, 'interaction').then(resolve).catch(reject);
        
        // Remove listeners after first interaction
        document.removeEventListener('click', loadOnInteraction);
        document.removeEventListener('keydown', loadOnInteraction);
        document.removeEventListener('touchstart', loadOnInteraction);
      };

      document.addEventListener('click', loadOnInteraction);
      document.addEventListener('keydown', loadOnInteraction);
      document.addEventListener('touchstart', loadOnInteraction);
    });
  }

  /**
   * Perform the actual component loading
   */
  private async performLoad(metadata: ComponentMetadata, strategy: LoadingStrategy): Promise<any> {
    const startTime = performance.now();
    this.activeLoads.add(metadata.name);

    try {
      // Start performance tracking
      runtimePerformanceTracker.startRouteLoading(metadata.name, false);

      // Simulate component loading (replace with actual implementation)
      const component = await this.simulateComponentLoad(metadata);

      const loadTime = performance.now() - startTime;
      
      // Cache the loaded component
      routeComponentCache.cacheComponent(metadata.name, component, {
        loadTime,
        bundleSize: metadata.size,
        dependencies: metadata.dependencies,
        framework: 'mtm'
      });

      // Record metrics
      this.recordLoadingMetrics({
        componentName: metadata.name,
        loadTime,
        renderTime: 0, // Would be measured during actual rendering
        cacheHit: false,
        strategy,
        timestamp: Date.now()
      });

      // End performance tracking
      runtimePerformanceTracker.endRouteLoading(metadata.name, metadata.size, false, metadata.dependencies);

      console.log(`✅ Loaded component ${metadata.name} (${strategy}, ${loadTime.toFixed(2)}ms)`);
      
      return component;
    } catch (error) {
      console.error(`❌ Failed to load component ${metadata.name}:`, error);
      throw error;
    } finally {
      this.activeLoads.delete(metadata.name);
      this.processLoadingQueue();
    }
  }

  /**
   * Simulate component loading (replace with actual implementation)
   */
  private async simulateComponentLoad(metadata: ComponentMetadata): Promise<any> {
    // Simulate network delay based on component size
    const delay = Math.max(50, metadata.size / 10000); // Rough estimate
    await new Promise(resolve => setTimeout(resolve, delay));

    // Return mock component
    return {
      name: metadata.name,
      render: () => `<div>Component: ${metadata.name}</div>`,
      metadata
    };
  }

  /**
   * Process loading queue
   */
  private processLoadingQueue(): void {
    while (
      this.loadingQueue.length > 0 && 
      this.activeLoads.size < this.config.maxConcurrentLoads
    ) {
      const { component, resolver, rejector } = this.loadingQueue.shift()!;
      
      this.performLoad(component, 'lazy')
        .then(resolver)
        .catch(rejector);
    }
  }

  /**
   * Schedule idle loading for low-priority components
   */
  private scheduleIdleLoading(): void {
    if (typeof window === 'undefined') return;

    const loadIdleComponents = () => {
      const idleComponents = Array.from(this.componentRegistry.values())
        .filter(comp => comp.strategy === 'idle' && !routeComponentCache.has(comp.name))
        .sort((a, b) => {
          // Sort by priority
          const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorities[b.priority] - priorities[a.priority];
        });

      // Load one idle component at a time
      if (idleComponents.length > 0 && this.activeLoads.size < this.config.maxConcurrentLoads) {
        const component = idleComponents[0];
        this.loadComponent(component.name, 'idle').catch(console.warn);
      }

      // Schedule next idle loading
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadIdleComponents, { timeout: 5000 });
      } else {
        setTimeout(loadIdleComponents, 1000);
      }
    };

    // Start idle loading
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadIdleComponents);
    } else {
      setTimeout(loadIdleComponents, 1000);
    }
  }

  /**
   * Observe element for viewport loading
   */
  observeElement(element: Element, componentName: string): void {
    if (this.intersectionObserver) {
      element.setAttribute('data-component', componentName);
      this.intersectionObserver.observe(element);
    }
  }

  /**
   * Unobserve element
   */
  unobserveElement(element: Element): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element);
    }
  }

  /**
   * Record loading metrics
   */
  private recordLoadingMetrics(metrics: LoadingMetrics): void {
    this.loadingMetrics.push(metrics);

    // Limit metrics history
    if (this.loadingMetrics.length > 1000) {
      this.loadingMetrics = this.loadingMetrics.slice(-1000);
    }

    // Track in runtime performance tracker
    runtimePerformanceTracker.trackCustomMetric(
      `component-load-${metrics.strategy}`,
      metrics.loadTime
    );
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    totalLoads: number;
    averageLoadTime: number;
    cacheHitRate: number;
    strategyBreakdown: Record<LoadingStrategy, number>;
    activeLoads: number;
    queueLength: number;
  } {
    const totalLoads = this.loadingMetrics.length;
    const averageLoadTime = totalLoads > 0
      ? this.loadingMetrics.reduce((sum, m) => sum + m.loadTime, 0) / totalLoads
      : 0;
    
    const cacheHits = this.loadingMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalLoads > 0 ? cacheHits / totalLoads : 0;

    const strategyBreakdown: Record<LoadingStrategy, number> = {
      eager: 0,
      lazy: 0,
      idle: 0,
      viewport: 0,
      interaction: 0
    };

    this.loadingMetrics.forEach(m => {
      strategyBreakdown[m.strategy]++;
    });

    return {
      totalLoads,
      averageLoadTime,
      cacheHitRate,
      strategyBreakdown,
      activeLoads: this.activeLoads.size,
      queueLength: this.loadingQueue.length
    };
  }

  /**
   * Optimize component loading strategies based on performance data
   */
  optimizeStrategies(): void {
    const stats = this.getStats();
    const recommendations: string[] = [];

    // Analyze strategy performance
    const strategyPerformance = new Map<LoadingStrategy, { avgTime: number; count: number }>();
    
    for (const strategy of Object.keys(stats.strategyBreakdown) as LoadingStrategy[]) {
      const strategyMetrics = this.loadingMetrics.filter(m => m.strategy === strategy);
      if (strategyMetrics.length > 0) {
        const avgTime = strategyMetrics.reduce((sum, m) => sum + m.loadTime, 0) / strategyMetrics.length;
        strategyPerformance.set(strategy, { avgTime, count: strategyMetrics.length });
      }
    }

    // Generate recommendations
    if (stats.cacheHitRate < 0.5) {
      recommendations.push('Consider increasing cache TTL or implementing better preloading');
    }

    if (stats.averageLoadTime > 1000) {
      recommendations.push('Component loading is slow. Consider code splitting or lazy loading');
    }

    const eagerPerf = strategyPerformance.get('eager');
    const lazyPerf = strategyPerformance.get('lazy');
    
    if (eagerPerf && lazyPerf && eagerPerf.avgTime > lazyPerf.avgTime * 1.5) {
      recommendations.push('Consider switching some eager-loaded components to lazy loading');
    }

    // Apply automatic optimizations
    this.applyAutomaticOptimizations(strategyPerformance);

    if (recommendations.length > 0) {
      console.log('💡 Component loading recommendations:');
      recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
  }

  /**
   * Apply automatic optimizations based on performance data
   */
  private applyAutomaticOptimizations(
    strategyPerformance: Map<LoadingStrategy, { avgTime: number; count: number }>
  ): void {
    let optimizationsApplied = 0;

    for (const [name, metadata] of this.componentRegistry) {
      const currentStrategy = metadata.strategy;
      const performance = strategyPerformance.get(currentStrategy);
      
      if (performance && performance.avgTime > 2000) {
        // Switch slow components to lazy loading
        if (currentStrategy === 'eager' && metadata.priority !== 'critical') {
          metadata.strategy = 'lazy';
          optimizationsApplied++;
          console.log(`🔄 Optimized ${name}: eager → lazy (slow loading: ${performance.avgTime.toFixed(0)}ms)`);
        }
      }
    }

    if (optimizationsApplied > 0) {
      console.log(`⚡ Applied ${optimizationsApplied} automatic optimizations`);
    }
  }

  /**
   * Preload critical components
   */
  async preloadCriticalComponents(): Promise<void> {
    const criticalComponents = Array.from(this.componentRegistry.values())
      .filter(comp => comp.priority === 'critical' && !routeComponentCache.has(comp.name));

    const preloadPromises = criticalComponents.map(comp => 
      this.loadComponent(comp.name, 'eager').catch(error => {
        console.warn(`Failed to preload critical component ${comp.name}:`, error);
      })
    );

    await Promise.all(preloadPromises);
    
    if (criticalComponents.length > 0) {
      console.log(`🚀 Preloaded ${criticalComponents.length} critical components`);
    }
  }

  /**
   * Get component recommendations
   */
  getRecommendations(): string[] {
    const stats = this.getStats();
    const recommendations: string[] = [];

    if (stats.cacheHitRate < 0.3) {
      recommendations.push('Very low cache hit rate. Review caching strategy and component lifecycle.');
    }

    if (stats.averageLoadTime > 2000) {
      recommendations.push('High average load time. Consider code splitting and lazy loading.');
    }

    if (stats.queueLength > 10) {
      recommendations.push('Large loading queue. Consider increasing maxConcurrentLoads or optimizing components.');
    }

    const eagerCount = stats.strategyBreakdown.eager;
    const totalCount = Object.values(stats.strategyBreakdown).reduce((sum, count) => sum + count, 0);
    
    if (eagerCount / totalCount > 0.7) {
      recommendations.push('Too many eager-loaded components. Consider lazy loading for non-critical components.');
    }

    return recommendations;
  }

  /**
   * Dispose optimizer and cleanup resources
   */
  dispose(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }

    if (this.idleCallback) {
      cancelIdleCallback(this.idleCallback);
      this.idleCallback = undefined;
    }

    this.loadingQueue = [];
    this.activeLoads.clear();
    this.loadingMetrics = [];
    this.componentRegistry.clear();
  }
}

/**
 * Singleton component optimizer instance
 */
export const componentOptimizer = new ComponentOptimizer();