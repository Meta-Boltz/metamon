/**
 * Intelligent Preloading System
 * Predicts and preloads routes based on user behavior and patterns
 */

import { runtimePerformanceTracker } from './runtime-performance-tracker.js';
import { routeComponentCache, routeDataCache } from './route-cache.js';

/**
 * User behavior data
 */
export interface UserBehavior {
  route: string;
  timestamp: number;
  timeSpent: number;
  scrollDepth: number;
  interactions: number;
  exitRoute?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  connectionType: 'slow' | 'fast' | 'unknown';
}

/**
 * Route prediction
 */
export interface RoutePrediction {
  route: string;
  probability: number;
  confidence: number;
  reasons: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedLoadTime: number;
  bundleSize: number;
}

/**
 * Preloading strategy
 */
export interface PreloadingStrategy {
  name: string;
  enabled: boolean;
  weight: number;
  predict: (behavior: UserBehavior[], currentRoute: string) => RoutePrediction[];
}

/**
 * Preloading configuration
 */
export interface PreloadingConfig {
  enabled: boolean;
  maxConcurrentPreloads: number;
  maxPreloadSize: number;
  minProbabilityThreshold: number;
  strategies: PreloadingStrategy[];
  adaptToConnection: boolean;
  respectDataSaver: boolean;
}

/**
 * Intelligent Preloader
 */
export class IntelligentPreloader {
  private behaviorHistory: UserBehavior[] = [];
  private routeGraph = new Map<string, Map<string, number>>();
  private preloadQueue: RoutePrediction[] = [];
  private activePreloads = new Set<string>();
  private routeMetadata = new Map<string, { loadTime: number; bundleSize: number; lastUpdated: number }>();

  constructor(
    private config: PreloadingConfig = {
      enabled: true,
      maxConcurrentPreloads: 3,
      maxPreloadSize: 5 * 1024 * 1024, // 5MB
      minProbabilityThreshold: 0.3,
      strategies: [],
      adaptToConnection: true,
      respectDataSaver: true
    }
  ) {
    this.initializeStrategies();
    this.setupBehaviorTracking();
  }

  /**
   * Initialize preloading strategies
   */
  private initializeStrategies(): void {
    this.config.strategies = [
      {
        name: 'sequential',
        enabled: true,
        weight: 0.4,
        predict: this.sequentialStrategy.bind(this)
      },
      {
        name: 'frequency',
        enabled: true,
        weight: 0.3,
        predict: this.frequencyStrategy.bind(this)
      },
      {
        name: 'time-based',
        enabled: true,
        weight: 0.2,
        predict: this.timeBasedStrategy.bind(this)
      },
      {
        name: 'contextual',
        enabled: true,
        weight: 0.1,
        predict: this.contextualStrategy.bind(this)
      }
    ];
  }

  /**
   * Set up behavior tracking
   */
  private setupBehaviorTracking(): void {
    if (typeof window === 'undefined') return;

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.recordPageExit();
      }
    });

    // Track scroll behavior
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.updateScrollDepth();
      }, 100);
    });

    // Track user interactions
    ['click', 'keydown', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        this.recordInteraction();
      });
    });

    // Track connection changes
    if ('connection' in navigator) {
      (navigator as any).connection.addEventListener('change', () => {
        this.adaptToConnection();
      });
    }
  }

  /**
   * Record user behavior for current route
   */
  recordBehavior(route: string, timeSpent: number): void {
    const behavior: UserBehavior = {
      route,
      timestamp: Date.now(),
      timeSpent,
      scrollDepth: this.getCurrentScrollDepth(),
      interactions: this.getInteractionCount(),
      deviceType: this.getDeviceType(),
      connectionType: this.getConnectionType()
    };

    this.behaviorHistory.push(behavior);
    this.updateRouteGraph(behavior);

    // Limit history size
    if (this.behaviorHistory.length > 1000) {
      this.behaviorHistory = this.behaviorHistory.slice(-1000);
    }

    // Trigger prediction update
    this.updatePredictions(route);
  }

  /**
   * Update route transition graph
   */
  private updateRouteGraph(behavior: UserBehavior): void {
    const previousBehavior = this.behaviorHistory[this.behaviorHistory.length - 2];
    
    if (previousBehavior && previousBehavior.route !== behavior.route) {
      const fromRoute = previousBehavior.route;
      const toRoute = behavior.route;

      if (!this.routeGraph.has(fromRoute)) {
        this.routeGraph.set(fromRoute, new Map());
      }

      const transitions = this.routeGraph.get(fromRoute)!;
      const currentCount = transitions.get(toRoute) || 0;
      transitions.set(toRoute, currentCount + 1);

      // Record exit route for previous behavior
      previousBehavior.exitRoute = toRoute;
    }
  }

  /**
   * Update predictions for current route
   */
  private updatePredictions(currentRoute: string): void {
    if (!this.config.enabled) return;

    const allPredictions: RoutePrediction[] = [];

    // Collect predictions from all enabled strategies
    for (const strategy of this.config.strategies) {
      if (strategy.enabled) {
        const predictions = strategy.predict(this.behaviorHistory, currentRoute);
        
        // Apply strategy weight
        predictions.forEach(prediction => {
          prediction.probability *= strategy.weight;
          prediction.reasons.push(`${strategy.name} strategy`);
        });

        allPredictions.push(...predictions);
      }
    }

    // Combine and rank predictions
    const combinedPredictions = this.combinePredictions(allPredictions);
    
    // Filter by probability threshold
    const filteredPredictions = combinedPredictions.filter(
      p => p.probability >= this.config.minProbabilityThreshold
    );

    // Update preload queue
    this.updatePreloadQueue(filteredPredictions);
  }

  /**
   * Sequential navigation strategy
   */
  private sequentialStrategy(behavior: UserBehavior[], currentRoute: string): RoutePrediction[] {
    const transitions = this.routeGraph.get(currentRoute);
    if (!transitions) return [];

    const predictions: RoutePrediction[] = [];
    const totalTransitions = Array.from(transitions.values()).reduce((sum, count) => sum + count, 0);

    for (const [route, count] of transitions) {
      const probability = count / totalTransitions;
      const metadata = this.routeMetadata.get(route);

      predictions.push({
        route,
        probability,
        confidence: Math.min(count / 10, 1), // Higher confidence with more data
        reasons: [`Followed ${count} times from ${currentRoute}`],
        priority: probability > 0.5 ? 'high' : probability > 0.3 ? 'medium' : 'low',
        estimatedLoadTime: metadata?.loadTime || 1000,
        bundleSize: metadata?.bundleSize || 100000
      });
    }

    return predictions;
  }

  /**
   * Frequency-based strategy
   */
  private frequencyStrategy(behavior: UserBehavior[], currentRoute: string): RoutePrediction[] {
    const routeFrequency = new Map<string, number>();
    const recentBehavior = behavior.slice(-50); // Last 50 behaviors

    // Count route frequencies
    for (const b of recentBehavior) {
      if (b.route !== currentRoute) {
        routeFrequency.set(b.route, (routeFrequency.get(b.route) || 0) + 1);
      }
    }

    const predictions: RoutePrediction[] = [];
    const totalVisits = recentBehavior.length;

    for (const [route, count] of routeFrequency) {
      const probability = count / totalVisits;
      const metadata = this.routeMetadata.get(route);

      predictions.push({
        route,
        probability,
        confidence: Math.min(count / 5, 1),
        reasons: [`Visited ${count} times recently`],
        priority: probability > 0.2 ? 'medium' : 'low',
        estimatedLoadTime: metadata?.loadTime || 1000,
        bundleSize: metadata?.bundleSize || 100000
      });
    }

    return predictions;
  }

  /**
   * Time-based strategy
   */
  private timeBasedStrategy(behavior: UserBehavior[], currentRoute: string): RoutePrediction[] {
    const now = Date.now();
    const timePatterns = new Map<string, number[]>();

    // Analyze time patterns for each route
    for (const b of behavior) {
      if (b.route !== currentRoute) {
        const hour = new Date(b.timestamp).getHours();
        if (!timePatterns.has(b.route)) {
          timePatterns.set(b.route, []);
        }
        timePatterns.get(b.route)!.push(hour);
      }
    }

    const currentHour = new Date(now).getHours();
    const predictions: RoutePrediction[] = [];

    for (const [route, hours] of timePatterns) {
      const hourCounts = new Array(24).fill(0);
      hours.forEach(hour => hourCounts[hour]++);

      const currentHourCount = hourCounts[currentHour];
      const totalCount = hours.length;
      const probability = totalCount > 0 ? currentHourCount / totalCount : 0;

      if (probability > 0.1) {
        const metadata = this.routeMetadata.get(route);
        
        predictions.push({
          route,
          probability,
          confidence: Math.min(totalCount / 20, 1),
          reasons: [`Often visited at ${currentHour}:00`],
          priority: probability > 0.3 ? 'medium' : 'low',
          estimatedLoadTime: metadata?.loadTime || 1000,
          bundleSize: metadata?.bundleSize || 100000
        });
      }
    }

    return predictions;
  }

  /**
   * Contextual strategy based on current page content and user behavior
   */
  private contextualStrategy(behavior: UserBehavior[], currentRoute: string): RoutePrediction[] {
    const predictions: RoutePrediction[] = [];
    const currentBehavior = behavior[behavior.length - 1];

    if (!currentBehavior) return predictions;

    // High engagement suggests user might explore more
    if (currentBehavior.scrollDepth > 0.7 && currentBehavior.interactions > 3) {
      // Predict related routes based on URL patterns
      const relatedRoutes = this.findRelatedRoutes(currentRoute);
      
      for (const route of relatedRoutes) {
        const metadata = this.routeMetadata.get(route);
        
        predictions.push({
          route,
          probability: 0.4,
          confidence: 0.6,
          reasons: ['High engagement on related content'],
          priority: 'medium',
          estimatedLoadTime: metadata?.loadTime || 1000,
          bundleSize: metadata?.bundleSize || 100000
        });
      }
    }

    return predictions;
  }

  /**
   * Find related routes based on URL patterns
   */
  private findRelatedRoutes(currentRoute: string): string[] {
    const related: string[] = [];
    const routeParts = currentRoute.split('/').filter(Boolean);

    // Find routes with similar patterns
    for (const [route] of this.routeMetadata) {
      if (route === currentRoute) continue;

      const parts = route.split('/').filter(Boolean);
      
      // Same depth and similar structure
      if (parts.length === routeParts.length) {
        const similarity = this.calculateRouteSimilarity(routeParts, parts);
        if (similarity > 0.5) {
          related.push(route);
        }
      }
    }

    return related.slice(0, 3); // Limit to 3 related routes
  }

  /**
   * Calculate similarity between route patterns
   */
  private calculateRouteSimilarity(route1: string[], route2: string[]): number {
    if (route1.length !== route2.length) return 0;

    let matches = 0;
    for (let i = 0; i < route1.length; i++) {
      if (route1[i] === route2[i] || 
          (route1[i].startsWith('[') && route2[i].startsWith('[')) ||
          (route1[i].includes('id') && route2[i].includes('id'))) {
        matches++;
      }
    }

    return matches / route1.length;
  }

  /**
   * Combine predictions from multiple strategies
   */
  private combinePredictions(predictions: RoutePrediction[]): RoutePrediction[] {
    const combined = new Map<string, RoutePrediction>();

    for (const prediction of predictions) {
      const existing = combined.get(prediction.route);
      
      if (existing) {
        // Combine probabilities using weighted average
        const totalWeight = existing.confidence + prediction.confidence;
        existing.probability = (
          existing.probability * existing.confidence + 
          prediction.probability * prediction.confidence
        ) / totalWeight;
        existing.confidence = Math.min(totalWeight, 1);
        existing.reasons.push(...prediction.reasons);
        
        // Use highest priority
        const priorities = ['low', 'medium', 'high', 'critical'];
        const maxPriority = Math.max(
          priorities.indexOf(existing.priority),
          priorities.indexOf(prediction.priority)
        );
        existing.priority = priorities[maxPriority] as any;
      } else {
        combined.set(prediction.route, { ...prediction });
      }
    }

    return Array.from(combined.values()).sort((a, b) => b.probability - a.probability);
  }

  /**
   * Update preload queue with new predictions
   */
  private updatePreloadQueue(predictions: RoutePrediction[]): void {
    this.preloadQueue = predictions.slice(0, 10); // Keep top 10 predictions
    this.processPreloadQueue();
  }

  /**
   * Process preload queue
   */
  private async processPreloadQueue(): Promise<void> {
    if (!this.config.enabled) return;

    // Check connection and data saver settings
    if (this.config.respectDataSaver && this.isDataSaverEnabled()) {
      return;
    }

    if (this.config.adaptToConnection && this.getConnectionType() === 'slow') {
      // Reduce concurrent preloads on slow connections
      this.config.maxConcurrentPreloads = Math.min(this.config.maxConcurrentPreloads, 1);
    }

    // Process queue
    while (
      this.activePreloads.size < this.config.maxConcurrentPreloads &&
      this.preloadQueue.length > 0
    ) {
      const prediction = this.preloadQueue.shift()!;
      
      if (!this.activePreloads.has(prediction.route)) {
        this.preloadRoute(prediction);
      }
    }
  }

  /**
   * Preload a specific route
   */
  private async preloadRoute(prediction: RoutePrediction): Promise<void> {
    const { route } = prediction;
    this.activePreloads.add(route);

    try {
      const startTime = performance.now();
      
      // Check if already cached
      if (routeComponentCache.has(route)) {
        console.log(`📦 Route ${route} already cached, skipping preload`);
        return;
      }

      // Start preload tracking
      runtimePerformanceTracker.startPreloading(route, prediction.priority);

      // Simulate route preloading (in real implementation, this would load the actual route)
      await this.simulateRouteLoad(route, prediction.estimatedLoadTime);

      const loadTime = performance.now() - startTime;
      
      // Cache the preloaded route
      routeComponentCache.cacheComponent(route, { preloaded: true }, {
        loadTime,
        bundleSize: prediction.bundleSize,
        dependencies: [],
        framework: 'mtm'
      });

      // End preload tracking
      runtimePerformanceTracker.endPreloading(route, true, prediction.bundleSize);

      console.log(`🚀 Preloaded route ${route} (${loadTime.toFixed(2)}ms, probability: ${(prediction.probability * 100).toFixed(1)}%)`);
    } catch (error) {
      console.warn(`❌ Failed to preload route ${route}:`, error);
      runtimePerformanceTracker.endPreloading(route, false);
    } finally {
      this.activePreloads.delete(route);
    }
  }

  /**
   * Simulate route loading (replace with actual implementation)
   */
  private async simulateRouteLoad(route: string, estimatedTime: number): Promise<void> {
    // Simulate network delay
    const actualTime = estimatedTime * (0.8 + Math.random() * 0.4); // ±20% variance
    await new Promise(resolve => setTimeout(resolve, actualTime));
  }

  /**
   * Update route metadata
   */
  updateRouteMetadata(route: string, loadTime: number, bundleSize: number): void {
    this.routeMetadata.set(route, {
      loadTime,
      bundleSize,
      lastUpdated: Date.now()
    });
  }

  /**
   * Get current scroll depth
   */
  private getCurrentScrollDepth(): number {
    if (typeof window === 'undefined') return 0;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    return documentHeight > 0 ? scrollTop / documentHeight : 0;
  }

  /**
   * Get interaction count for current session
   */
  private getInteractionCount(): number {
    // This would be tracked in a real implementation
    return Math.floor(Math.random() * 10);
  }

  /**
   * Get device type
   */
  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop';
    
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * Get connection type
   */
  private getConnectionType(): 'slow' | 'fast' | 'unknown' {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return 'unknown';
    }

    const connection = (navigator as any).connection;
    const effectiveType = connection.effectiveType;
    
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
    if (effectiveType === '3g') return 'slow';
    return 'fast';
  }

  /**
   * Check if data saver is enabled
   */
  private isDataSaverEnabled(): boolean {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return false;
    }

    return (navigator as any).connection.saveData === true;
  }

  /**
   * Record page exit
   */
  private recordPageExit(): void {
    // This would be implemented to track when users leave pages
  }

  /**
   * Update scroll depth tracking
   */
  private updateScrollDepth(): void {
    // This would be implemented to track scroll behavior
  }

  /**
   * Record user interaction
   */
  private recordInteraction(): void {
    // This would be implemented to track user interactions
  }

  /**
   * Adapt preloading to connection changes
   */
  private adaptToConnection(): void {
    const connectionType = this.getConnectionType();
    
    if (connectionType === 'slow') {
      this.config.maxConcurrentPreloads = 1;
      this.config.minProbabilityThreshold = 0.5;
    } else {
      this.config.maxConcurrentPreloads = 3;
      this.config.minProbabilityThreshold = 0.3;
    }

    console.log(`📶 Adapted preloading to ${connectionType} connection`);
  }

  /**
   * Get preloading statistics
   */
  getStats(): {
    totalPredictions: number;
    activePreloads: number;
    queueLength: number;
    cacheHitRate: number;
    averageProbability: number;
    topPredictions: RoutePrediction[];
  } {
    const cacheStats = routeComponentCache.getStats();
    const avgProbability = this.preloadQueue.length > 0
      ? this.preloadQueue.reduce((sum, p) => sum + p.probability, 0) / this.preloadQueue.length
      : 0;

    return {
      totalPredictions: this.preloadQueue.length,
      activePreloads: this.activePreloads.size,
      queueLength: this.preloadQueue.length,
      cacheHitRate: cacheStats.hitRate,
      averageProbability: avgProbability,
      topPredictions: this.preloadQueue.slice(0, 5)
    };
  }

  /**
   * Enable/disable preloading
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    if (!enabled) {
      // Clear active preloads
      this.activePreloads.clear();
      this.preloadQueue = [];
    }

    console.log(`🔄 Preloading ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Dispose preloader and cleanup resources
   */
  dispose(): void {
    this.config.enabled = false;
    this.activePreloads.clear();
    this.preloadQueue = [];
    this.behaviorHistory = [];
    this.routeGraph.clear();
    this.routeMetadata.clear();
  }
}

/**
 * Singleton intelligent preloader instance
 */
export const intelligentPreloader = new IntelligentPreloader();