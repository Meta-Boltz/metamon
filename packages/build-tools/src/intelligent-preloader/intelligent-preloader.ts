/**
 * Intelligent Preloader Implementation
 * 
 * Implements smart preloading strategies based on:
 * - Viewport visibility and intersection
 * - User interaction patterns and predictions
 * - Navigation patterns and route transitions
 * - Network conditions and bandwidth adaptation
 */

import {
  IntelligentPreloader,
  ComponentDefinition,
  UserInteraction,
  PreloadPrediction,
  IntelligentPreloaderConfig,
  PreloadMetrics,
  PreloadSchedule,
  ViewportConfig,
  InteractionPredictionConfig,
  NavigationPredictionConfig,
  NetworkAdaptationConfig
} from '../types/intelligent-preloader.js';
import {
  FrameworkType,
  LoadPriority,
  NetworkConditions
} from '../types/framework-loader.js';

export class IntelligentPreloaderService implements IntelligentPreloader {
  private config: IntelligentPreloaderConfig;
  private isActive = false;
  
  // Viewport observation
  private intersectionObserver?: IntersectionObserver;
  private observedComponents = new Map<string, ComponentDefinition>();
  
  // Interaction tracking
  private interactionHistory: UserInteraction[] = [];
  private interactionListeners = new Map<string, EventListener>();
  
  // Navigation tracking
  private routeHistory: string[] = [];
  private routePatterns = new Map<string, number>();
  
  // Network adaptation
  private currentNetworkConditions?: NetworkConditions;
  private networkConnection?: any; // Navigator.connection
  
  // Preload management
  private scheduledPreloads = new Map<FrameworkType, PreloadSchedule>();
  private preloadTimeouts = new Map<FrameworkType, NodeJS.Timeout>();
  
  // Metrics
  private metrics: PreloadMetrics = {
    totalPredictions: 0,
    accuratePredictions: 0,
    falsePositives: 0,
    preloadHitRate: 0,
    averageConfidence: 0,
    networkSavings: 0,
    predictionsByReason: {}
  };
  
  // Framework loader reference
  private frameworkLoader?: any;

  constructor(
    config: Partial<IntelligentPreloaderConfig> = {},
    frameworkLoader?: any
  ) {
    this.config = this.mergeConfig(config);
    this.frameworkLoader = frameworkLoader;
    
    if (typeof window !== 'undefined') {
      this.networkConnection = (navigator as any).connection;
      this.initializeNetworkMonitoring();
    }
  }

  private mergeConfig(config: Partial<IntelligentPreloaderConfig>): IntelligentPreloaderConfig {
    return {
      viewport: {
        rootMargin: '50px',
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
        preloadDistance: 200,
        ...config.viewport
      },
      interaction: {
        hoverDelay: 100,
        scrollVelocityThreshold: 100,
        clickPatternWindow: 5000,
        confidenceThreshold: 0.7,
        ...config.interaction
      },
      navigation: {
        routePatterns: [],
        preloadDepth: 2,
        cacheSize: 10,
        prefetchDelay: 500,
        ...config.navigation
      },
      network: {
        slowNetworkThreshold: 1.5, // Mbps
        saveDataRespect: true,
        adaptivePreloading: true,
        bandwidthThresholds: {
          disable: 0.5,
          reduce: 1.0,
          normal: 2.0
        },
        ...config.network
      },
      enableLogging: config.enableLogging ?? false,
      enableMetrics: config.enableMetrics ?? true
    };
  }

  // Viewport-based preloading implementation
  observeViewport(components: ComponentDefinition[]): void {
    if (!this.intersectionObserver) {
      this.createIntersectionObserver();
    }

    components.forEach(component => {
      if (component.element) {
        this.observedComponents.set(component.id, component);
        this.intersectionObserver!.observe(component.element);
        
        if (this.config.enableLogging) {
          console.log(`[IntelligentPreloader] Observing component ${component.id} for viewport preloading`);
        }
      }
    });
  }

  unobserveViewport(components: ComponentDefinition[]): void {
    if (!this.intersectionObserver) return;

    components.forEach(component => {
      if (component.element) {
        this.intersectionObserver!.unobserve(component.element);
        this.observedComponents.delete(component.id);
      }
    });
  }

  private createIntersectionObserver(): void {
    const options: IntersectionObserverInit = {
      rootMargin: this.config.viewport.rootMargin,
      threshold: this.config.viewport.threshold
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const component = Array.from(this.observedComponents.values())
          .find(c => c.element === entry.target);
        
        if (!component) return;

        const distanceToViewport = this.calculateDistanceToViewport(entry);
        
        if (distanceToViewport <= this.config.viewport.preloadDistance) {
          const priority = this.calculateViewportPriority(entry.intersectionRatio, distanceToViewport);
          this.schedulePreload(component.framework, priority, 'viewport');
          
          if (this.config.enableLogging) {
            console.log(`[IntelligentPreloader] Viewport preload triggered for ${component.framework}`);
          }
        }
      });
    }, options);
  }

  private calculateDistanceToViewport(entry: IntersectionObserverEntry): number {
    const rect = entry.boundingClientRect;
    const viewportHeight = window.innerHeight;
    
    if (rect.top > viewportHeight) {
      return rect.top - viewportHeight;
    } else if (rect.bottom < 0) {
      return Math.abs(rect.bottom);
    }
    
    return 0; // Already in viewport
  }

  private calculateViewportPriority(intersectionRatio: number, distance: number): LoadPriority {
    if (intersectionRatio > 0) return LoadPriority.CRITICAL;
    if (distance < 100) return LoadPriority.HIGH;
    if (distance < 200) return LoadPriority.NORMAL;
    return LoadPriority.LOW;
  }

  // Interaction-based preloading implementation
  startInteractionTracking(): void {
    if (typeof window === 'undefined') return;

    const events = ['click', 'mouseover', 'scroll', 'focus', 'touchstart'];
    
    events.forEach(eventType => {
      const listener = this.createInteractionListener(eventType);
      this.interactionListeners.set(eventType, listener);
      document.addEventListener(eventType, listener, { passive: true });
    });

    if (this.config.enableLogging) {
      console.log('[IntelligentPreloader] Started interaction tracking');
    }
  }

  stopInteractionTracking(): void {
    this.interactionListeners.forEach((listener, eventType) => {
      document.removeEventListener(eventType, listener);
    });
    this.interactionListeners.clear();
  }

  private createInteractionListener(eventType: string): EventListener {
    return (event: Event) => {
      const interaction: UserInteraction = {
        type: eventType as any,
        target: event.target as HTMLElement,
        timestamp: Date.now(),
        coordinates: this.getEventCoordinates(event),
        duration: eventType === 'scroll' ? this.getScrollDuration() : undefined
      };

      this.recordInteraction(interaction);
      this.analyzeInteractionPatterns();
    };
  }

  private getEventCoordinates(event: Event): { x: number; y: number } | undefined {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY };
    }
    if (event instanceof TouchEvent && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return undefined;
  }

  private getScrollDuration(): number {
    // Simple scroll duration calculation
    const recentScrolls = this.interactionHistory
      .filter(i => i.type === 'scroll' && Date.now() - i.timestamp < 1000);
    
    return recentScrolls.length > 0 ? Date.now() - recentScrolls[0].timestamp : 0;
  }

  private recordInteraction(interaction: UserInteraction): void {
    this.interactionHistory.push(interaction);
    
    // Keep only recent interactions (last 30 seconds)
    const cutoff = Date.now() - 30000;
    this.interactionHistory = this.interactionHistory.filter(i => i.timestamp > cutoff);
  }

  private analyzeInteractionPatterns(): void {
    const predictions = this.predictUserIntent(this.interactionHistory);
    
    predictions.forEach(prediction => {
      if (prediction.confidence >= this.config.interaction.confidenceThreshold) {
        this.schedulePreload(prediction.framework, prediction.priority, prediction.reason);
        
        if (this.config.enableMetrics) {
          this.metrics.totalPredictions++;
          this.metrics.predictionsByReason[prediction.reason] = 
            (this.metrics.predictionsByReason[prediction.reason] || 0) + 1;
        }
      }
    });
  }

  predictUserIntent(interactions: UserInteraction[]): PreloadPrediction[] {
    const predictions: PreloadPrediction[] = [];
    
    // Hover-based prediction
    const hoverPredictions = this.analyzeHoverPatterns(interactions);
    predictions.push(...hoverPredictions);
    
    // Scroll-based prediction
    const scrollPredictions = this.analyzeScrollPatterns(interactions);
    predictions.push(...scrollPredictions);
    
    // Click pattern prediction
    const clickPredictions = this.analyzeClickPatterns(interactions);
    predictions.push(...clickPredictions);
    
    return predictions;
  }

  private analyzeHoverPatterns(interactions: UserInteraction[]): PreloadPrediction[] {
    const predictions: PreloadPrediction[] = [];
    const recentHovers = interactions.filter(i => 
      i.type === 'hover' && Date.now() - i.timestamp < this.config.interaction.hoverDelay * 10
    );

    recentHovers.forEach(hover => {
      const component = this.findComponentByElement(hover.target);
      if (component) {
        predictions.push({
          framework: component.framework,
          confidence: 0.8,
          reason: 'interaction',
          priority: LoadPriority.HIGH
        });
      }
    });

    return predictions;
  }

  private analyzeScrollPatterns(interactions: UserInteraction[]): PreloadPrediction[] {
    const predictions: PreloadPrediction[] = [];
    const recentScrolls = interactions.filter(i => i.type === 'scroll');
    
    if (recentScrolls.length < 2) return predictions;

    // Calculate scroll velocity
    const lastScroll = recentScrolls[recentScrolls.length - 1];
    const prevScroll = recentScrolls[recentScrolls.length - 2];
    const velocity = Math.abs(lastScroll.timestamp - prevScroll.timestamp);

    if (velocity > this.config.interaction.scrollVelocityThreshold) {
      // Fast scrolling - preload components below fold
      const belowFoldComponents = Array.from(this.observedComponents.values())
        .filter(c => this.isComponentBelowFold(c));

      belowFoldComponents.forEach(component => {
        predictions.push({
          framework: component.framework,
          confidence: 0.6,
          reason: 'interaction',
          priority: LoadPriority.NORMAL
        });
      });
    }

    return predictions;
  }

  private analyzeClickPatterns(interactions: UserInteraction[]): PreloadPrediction[] {
    const predictions: PreloadPrediction[] = [];
    const recentClicks = interactions.filter(i => 
      i.type === 'click' && Date.now() - i.timestamp < this.config.interaction.clickPatternWindow
    );

    // Analyze click patterns for navigation prediction
    if (recentClicks.length >= 2) {
      const pattern = this.identifyNavigationPattern(recentClicks);
      if (pattern) {
        predictions.push({
          framework: pattern.framework,
          confidence: pattern.confidence,
          reason: 'pattern',
          priority: LoadPriority.NORMAL
        });
      }
    }

    return predictions;
  }

  private identifyNavigationPattern(clicks: UserInteraction[]): PreloadPrediction | null {
    // Simple pattern recognition - could be enhanced with ML
    const targets = clicks.map(c => c.target.tagName.toLowerCase());
    
    if (targets.includes('a') || targets.includes('button')) {
      // User is likely navigating
      return {
        framework: FrameworkType.REACT, // Default - could be smarter
        confidence: 0.7,
        reason: 'pattern',
        priority: LoadPriority.NORMAL
      };
    }

    return null;
  }

  private findComponentByElement(element: HTMLElement): ComponentDefinition | undefined {
    return Array.from(this.observedComponents.values())
      .find(c => c.element === element || c.element?.contains(element));
  }

  private isComponentBelowFold(component: ComponentDefinition): boolean {
    if (!component.element) return false;
    
    const rect = component.element.getBoundingClientRect();
    return rect.top > window.innerHeight;
  }

  // Navigation-based preloading implementation
  async preloadForNavigation(route: string): Promise<void> {
    this.routeHistory.push(route);
    
    // Keep route history manageable
    if (this.routeHistory.length > this.config.navigation.cacheSize) {
      this.routeHistory.shift();
    }

    // Update route patterns
    this.updateRoutePatterns(route);

    // Predict next routes and preload
    const predictedRoutes = this.predictNextRoutes(route);
    
    for (const predictedRoute of predictedRoutes) {
      await this.preloadForRoutePattern(predictedRoute);
    }
  }

  async preloadForRoutePattern(pattern: string): Promise<void> {
    // This would integrate with routing system to determine required frameworks
    // For now, we'll use a simple heuristic
    
    const frameworks = this.getFrameworksForRoute(pattern);
    
    for (const framework of frameworks) {
      setTimeout(() => {
        this.schedulePreload(framework, LoadPriority.LOW, 'navigation');
      }, this.config.navigation.prefetchDelay);
    }
  }

  private updateRoutePatterns(route: string): void {
    const pattern = this.extractRoutePattern(route);
    this.routePatterns.set(pattern, (this.routePatterns.get(pattern) || 0) + 1);
  }

  private extractRoutePattern(route: string): string {
    // Simple pattern extraction - replace IDs with wildcards
    return route.replace(/\/\d+/g, '/:id').replace(/\/[a-f0-9-]{36}/g, '/:uuid');
  }

  private predictNextRoutes(currentRoute: string): string[] {
    // Analyze route history to predict next routes
    const predictions: string[] = [];
    const currentPattern = this.extractRoutePattern(currentRoute);
    
    // Find common transitions from current pattern
    const transitions = this.findRouteTransitions(currentPattern);
    
    return transitions.slice(0, this.config.navigation.preloadDepth);
  }

  private findRouteTransitions(fromPattern: string): string[] {
    // Simple transition analysis based on route history
    const transitions: string[] = [];
    
    for (let i = 0; i < this.routeHistory.length - 1; i++) {
      const current = this.extractRoutePattern(this.routeHistory[i]);
      const next = this.extractRoutePattern(this.routeHistory[i + 1]);
      
      if (current === fromPattern && !transitions.includes(next)) {
        transitions.push(next);
      }
    }
    
    return transitions;
  }

  private getFrameworksForRoute(route: string): FrameworkType[] {
    // This would integrate with the application's routing configuration
    // For now, return a default set
    return [FrameworkType.REACT]; // Could be enhanced with route analysis
  }

  // Network-aware preloading implementation
  adaptPreloadingStrategy(networkConditions: NetworkConditions): void {
    this.currentNetworkConditions = networkConditions;
    
    const { downlink, effectiveType, saveData } = networkConditions;
    const { bandwidthThresholds, saveDataRespect, adaptivePreloading } = this.config.network;
    
    if (!adaptivePreloading) return;

    // Respect save-data preference
    if (saveDataRespect && saveData) {
      this.cancelAllPreloads();
      if (this.config.enableLogging) {
        console.log('[IntelligentPreloader] Preloading disabled due to save-data preference');
      }
      return;
    }

    // Adapt based on bandwidth
    if (downlink < bandwidthThresholds.disable) {
      this.cancelAllPreloads();
      if (this.config.enableLogging) {
        console.log('[IntelligentPreloader] Preloading disabled due to low bandwidth');
      }
    } else if (downlink < bandwidthThresholds.reduce) {
      this.reducePreloadingActivity();
      if (this.config.enableLogging) {
        console.log('[IntelligentPreloader] Preloading reduced due to limited bandwidth');
      }
    }

    // Adapt based on connection type
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      this.cancelAllPreloads();
    }
  }

  private initializeNetworkMonitoring(): void {
    if (!this.networkConnection) return;

    const updateNetworkConditions = () => {
      const conditions: NetworkConditions = {
        effectiveType: this.networkConnection.effectiveType || '4g',
        downlink: this.networkConnection.downlink || 10,
        rtt: this.networkConnection.rtt || 100,
        saveData: this.networkConnection.saveData || false
      };
      
      this.adaptPreloadingStrategy(conditions);
    };

    this.networkConnection.addEventListener('change', updateNetworkConditions);
    updateNetworkConditions(); // Initial check
  }

  private reducePreloadingActivity(): void {
    // Cancel low priority preloads
    this.scheduledPreloads.forEach((schedule, framework) => {
      if (schedule.priority === LoadPriority.LOW) {
        this.cancelPreload(framework);
      }
    });
  }

  // Preload management implementation
  schedulePreload(framework: FrameworkType, priority: LoadPriority, reason: string): void {
    // Don't schedule if already scheduled with higher or equal priority
    const existing = this.scheduledPreloads.get(framework);
    if (existing && this.getPriorityWeight(existing.priority) >= this.getPriorityWeight(priority)) {
      return;
    }

    // Cancel existing preload if any
    this.cancelPreload(framework);

    const schedule: PreloadSchedule = {
      framework,
      priority,
      scheduledAt: Date.now(),
      reason,
      confidence: this.calculatePreloadConfidence(reason, priority)
    };

    this.scheduledPreloads.set(framework, schedule);

    // Schedule the actual preload
    const delay = this.calculatePreloadDelay(priority, reason);
    const timeout = setTimeout(() => {
      this.executePreload(framework, schedule);
    }, delay);

    this.preloadTimeouts.set(framework, timeout);

    if (this.config.enableLogging) {
      console.log(`[IntelligentPreloader] Scheduled ${framework} preload (${reason}, ${priority})`);
    }
  }

  cancelPreload(framework: FrameworkType): void {
    const timeout = this.preloadTimeouts.get(framework);
    if (timeout) {
      clearTimeout(timeout);
      this.preloadTimeouts.delete(framework);
    }

    const schedule = this.scheduledPreloads.get(framework);
    if (schedule) {
      schedule.cancelled = true;
      this.scheduledPreloads.delete(framework);
    }
  }

  cancelAllPreloads(): void {
    this.preloadTimeouts.forEach(timeout => clearTimeout(timeout));
    this.preloadTimeouts.clear();
    
    this.scheduledPreloads.forEach(schedule => {
      schedule.cancelled = true;
    });
    this.scheduledPreloads.clear();
  }

  private async executePreload(framework: FrameworkType, schedule: PreloadSchedule): Promise<void> {
    if (schedule.cancelled) return;

    try {
      if (this.frameworkLoader) {
        await this.frameworkLoader.loadFramework(framework, schedule.priority);
        
        if (this.config.enableMetrics) {
          this.metrics.accuratePredictions++;
        }
        
        if (this.config.enableLogging) {
          console.log(`[IntelligentPreloader] Successfully preloaded ${framework}`);
        }
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`[IntelligentPreloader] Failed to preload ${framework}:`, error);
      }
    } finally {
      this.scheduledPreloads.delete(framework);
      this.preloadTimeouts.delete(framework);
    }
  }

  private getPriorityWeight(priority: LoadPriority): number {
    const weights = {
      [LoadPriority.CRITICAL]: 4,
      [LoadPriority.HIGH]: 3,
      [LoadPriority.NORMAL]: 2,
      [LoadPriority.LOW]: 1
    };
    return weights[priority];
  }

  private calculatePreloadConfidence(reason: string, priority: LoadPriority): number {
    const baseConfidence = {
      viewport: 0.9,
      interaction: 0.8,
      navigation: 0.6,
      pattern: 0.7
    };

    const priorityMultiplier = {
      [LoadPriority.CRITICAL]: 1.0,
      [LoadPriority.HIGH]: 0.9,
      [LoadPriority.NORMAL]: 0.8,
      [LoadPriority.LOW]: 0.7
    };

    return (baseConfidence[reason as keyof typeof baseConfidence] || 0.5) * 
           priorityMultiplier[priority];
  }

  private calculatePreloadDelay(priority: LoadPriority, reason: string): number {
    const baseDelays = {
      [LoadPriority.CRITICAL]: 0,
      [LoadPriority.HIGH]: 100,
      [LoadPriority.NORMAL]: 500,
      [LoadPriority.LOW]: 1000
    };

    const reasonMultipliers = {
      viewport: 1.0,
      interaction: 0.5,
      navigation: 2.0,
      pattern: 1.5
    };

    return baseDelays[priority] * (reasonMultipliers[reason as keyof typeof reasonMultipliers] || 1.0);
  }

  // Configuration and metrics
  updateConfig(config: Partial<IntelligentPreloaderConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.enableLogging) {
      console.log('[IntelligentPreloader] Configuration updated');
    }
  }

  getMetrics(): PreloadMetrics {
    // Calculate derived metrics
    this.metrics.preloadHitRate = this.metrics.totalPredictions > 0 
      ? this.metrics.accuratePredictions / this.metrics.totalPredictions 
      : 0;

    this.metrics.averageConfidence = this.calculateAverageConfidence();

    return { ...this.metrics };
  }

  private calculateAverageConfidence(): number {
    const schedules = Array.from(this.scheduledPreloads.values());
    if (schedules.length === 0) return 0;
    
    const totalConfidence = schedules.reduce((sum, schedule) => sum + schedule.confidence, 0);
    return totalConfidence / schedules.length;
  }

  getScheduledPreloads(): PreloadSchedule[] {
    return Array.from(this.scheduledPreloads.values());
  }

  // Lifecycle methods
  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.startInteractionTracking();
    
    if (this.config.enableLogging) {
      console.log('[IntelligentPreloader] Started');
    }
  }

  stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.stopInteractionTracking();
    this.cancelAllPreloads();
    
    if (this.config.enableLogging) {
      console.log('[IntelligentPreloader] Stopped');
    }
  }

  destroy(): void {
    this.stop();
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }
    
    this.observedComponents.clear();
    this.interactionHistory = [];
    this.routeHistory = [];
    this.routePatterns.clear();
    
    if (this.config.enableLogging) {
      console.log('[IntelligentPreloader] Destroyed');
    }
  }
}