/**
 * Network Adaptation Coordinator
 * Orchestrates all network adaptation features for optimal framework loading
 */

import { FrameworkType, LoadPriority, FrameworkCore, NetworkConditions } from '../types/framework-loader.js';
import { NetworkConditionMonitor, NetworkQualityMetrics, ConnectionEvent, AdaptationStrategy } from './network-condition-monitor.js';
import { BandwidthAwarePreloader, PreloadRequest, PreloadingStrategy } from './bandwidth-aware-preloader.js';
import { IntermittentConnectivityHandler, ConnectivityState, OfflineStrategy } from './intermittent-connectivity-handler.js';

export interface NetworkAdaptationConfig {
  monitoring: {
    enabled: boolean;
    assessmentInterval: number;
    historyRetention: number;
  };
  preloading: Partial<PreloadingStrategy>;
  connectivity: Partial<OfflineStrategy>;
  adaptation: {
    aggressiveness: 'conservative' | 'balanced' | 'aggressive';
    priorityBoosting: boolean;
    dynamicTimeouts: boolean;
  };
}

export interface LoadingRecommendation {
  strategy: AdaptationStrategy;
  shouldPreload: boolean;
  cacheFirst: boolean;
  timeoutMs: number;
  maxRetries: number;
  reason: string;
}

export interface NetworkAdaptationMetrics {
  networkQuality: NetworkQualityMetrics | null;
  connectivityState: ConnectivityState;
  preloadingStats: {
    queued: number;
    active: number;
    completed: number;
    failed: number;
  };
  cacheStats: {
    size: number;
    hitRate: number;
    count: number;
  };
  adaptationEvents: ConnectionEvent[];
}

export class NetworkAdaptationCoordinator {
  private monitor: NetworkConditionMonitor;
  private preloader: BandwidthAwarePreloader;
  private connectivityHandler: IntermittentConnectivityHandler;
  private config: NetworkAdaptationConfig;
  private listeners: Array<(metrics: NetworkAdaptationMetrics) => void> = [];
  private metricsUpdateInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<NetworkAdaptationConfig>) {
    this.config = {
      monitoring: {
        enabled: true,
        assessmentInterval: 30000, // 30 seconds
        historyRetention: 3600000, // 1 hour
      },
      preloading: {
        enabled: true,
        maxConcurrentPreloads: 2,
        bandwidthThreshold: 1,
        qualityThreshold: 0.5,
      },
      connectivity: {
        cacheFirst: false,
        maxCacheAge: 86400000, // 24 hours
        maxCacheSize: 50 * 1024 * 1024, // 50 MB
        backgroundSync: true,
      },
      adaptation: {
        aggressiveness: 'balanced',
        priorityBoosting: true,
        dynamicTimeouts: true,
      },
      ...config
    };

    // Initialize components
    this.monitor = new NetworkConditionMonitor();
    this.preloader = new BandwidthAwarePreloader(this.monitor, this.config.preloading);
    this.connectivityHandler = new IntermittentConnectivityHandler(this.monitor, this.config.connectivity);

    // Set up coordination
    this.setupCoordination();

    // Start metrics updates
    if (this.config.monitoring.enabled) {
      this.startMetricsUpdates();
    }
  }

  /**
   * Get loading recommendation for a framework
   */
  getLoadingRecommendation(
    framework: FrameworkType,
    priority: LoadPriority = LoadPriority.NORMAL,
    context?: { viewport?: boolean; interaction?: boolean; navigation?: boolean }
  ): LoadingRecommendation {
    const conditions = this.monitor.getCurrentConditions();
    const metrics = this.monitor.getQualityMetrics();
    const connectivityState = this.connectivityHandler.getConnectivityState();
    const adaptationStrategy = this.monitor.getAdaptationStrategy();

    let recommendation: LoadingRecommendation = {
      strategy: adaptationStrategy,
      shouldPreload: false,
      cacheFirst: false,
      timeoutMs: 10000,
      maxRetries: 3,
      reason: 'default'
    };

    // Offline handling
    if (!connectivityState.isOnline) {
      recommendation.cacheFirst = true;
      recommendation.shouldPreload = false;
      recommendation.maxRetries = 0;
      recommendation.reason = 'offline';
      return recommendation;
    }

    // Poor network conditions
    if (metrics && metrics.score < 0.3) {
      recommendation.cacheFirst = true;
      recommendation.shouldPreload = false;
      recommendation.timeoutMs = 20000;
      recommendation.maxRetries = 1;
      recommendation.reason = 'poor_network';
      return recommendation;
    }

    // Intermittent connectivity
    if (this.monitor.isIntermittentConnection()) {
      recommendation.cacheFirst = true;
      recommendation.shouldPreload = false;
      recommendation.timeoutMs = 15000;
      recommendation.maxRetries = 2;
      recommendation.reason = 'intermittent';
      return recommendation;
    }

    // Good network conditions - enable preloading
    if (metrics && metrics.score > 0.7 && connectivityState.isStable) {
      recommendation.shouldPreload = this.shouldPreload(framework, priority, context);
      recommendation.timeoutMs = 8000;
      recommendation.maxRetries = 3;
      recommendation.reason = 'good_network';
    }

    // Apply dynamic timeout adjustment
    if (this.config.adaptation.dynamicTimeouts && conditions) {
      const rttMultiplier = Math.max(1, conditions.rtt / 100);
      recommendation.timeoutMs *= rttMultiplier;
      recommendation.timeoutMs = Math.min(recommendation.timeoutMs, 30000); // Cap at 30s
    }

    // Apply priority boosting
    if (this.config.adaptation.priorityBoosting) {
      const priorityMultipliers = {
        [LoadPriority.CRITICAL]: 0.5, // Faster timeout for critical
        [LoadPriority.HIGH]: 0.8,
        [LoadPriority.NORMAL]: 1,
        [LoadPriority.LOW]: 1.5 // Longer timeout for low priority
      };
      recommendation.timeoutMs *= priorityMultipliers[priority];
    }

    return recommendation;
  }

  /**
   * Request framework preloading
   */
  requestPreload(
    framework: FrameworkType,
    priority: LoadPriority = LoadPriority.LOW,
    reason: 'viewport' | 'interaction' | 'navigation' | 'pattern' = 'pattern',
    confidence: number = 0.5,
    estimatedSize: number = 100000
  ): void {
    const request: PreloadRequest = {
      framework,
      priority,
      estimatedSize,
      reason,
      confidence
    };

    this.preloader.requestPreload(request);
  }

  /**
   * Load framework with full network adaptation
   */
  async loadFramework(
    framework: FrameworkType,
    priority: LoadPriority = LoadPriority.NORMAL,
    context?: { viewport?: boolean; interaction?: boolean; navigation?: boolean }
  ): Promise<FrameworkCore> {
    const recommendation = this.getLoadingRecommendation(framework, priority, context);
    
    // Use connectivity handler for actual loading
    return this.connectivityHandler.loadFramework(
      framework,
      priority,
      recommendation.timeoutMs
    );
  }

  /**
   * Get current network adaptation metrics
   */
  getMetrics(): NetworkAdaptationMetrics {
    const preloadStatus = this.preloader.getQueueStatus();
    const cacheStats = this.connectivityHandler.getCacheStats();
    const connectionHistory = this.monitor.getConnectionHistory(this.config.monitoring.historyRetention);

    return {
      networkQuality: this.monitor.getQualityMetrics(),
      connectivityState: this.connectivityHandler.getConnectivityState(),
      preloadingStats: {
        queued: preloadStatus.queued.length,
        active: preloadStatus.active.length,
        completed: preloadStatus.completed,
        failed: preloadStatus.failed
      },
      cacheStats: {
        size: cacheStats.size,
        hitRate: cacheStats.hitRate,
        count: cacheStats.count
      },
      adaptationEvents: connectionHistory
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NetworkAdaptationConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update component configurations
    if (config.preloading) {
      this.preloader.updateStrategy(config.preloading);
    }
    
    if (config.connectivity) {
      this.connectivityHandler.updateStrategy(config.connectivity);
    }
    
    // Restart metrics updates if interval changed
    if (config.monitoring?.assessmentInterval && this.metricsUpdateInterval) {
      this.stopMetricsUpdates();
      this.startMetricsUpdates();
    }
  }

  /**
   * Add metrics listener
   */
  addMetricsListener(listener: (metrics: NetworkAdaptationMetrics) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove metrics listener
   */
  removeMetricsListener(listener: (metrics: NetworkAdaptationMetrics) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Force network quality assessment
   */
  async assessNetworkQuality(): Promise<NetworkQualityMetrics> {
    return this.monitor.assessNetworkQuality();
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.connectivityHandler.clearCache();
  }

  /**
   * Destroy coordinator and cleanup resources
   */
  destroy(): void {
    this.stopMetricsUpdates();
    
    this.monitor.destroy();
    this.preloader.destroy();
    this.connectivityHandler.destroy();
    
    this.listeners = [];
  }

  /**
   * Set up coordination between components
   */
  private setupCoordination(): void {
    // Listen to network changes and adapt preloading strategy
    this.monitor.addListener((event: ConnectionEvent) => {
      this.adaptToNetworkChange(event);
    });

    // Listen to preload events for optimization
    this.preloader.addListener((request: PreloadRequest, success: boolean) => {
      if (success) {
        // Cache successful preloads
        // This would integrate with actual framework loading
        console.debug(`[NetworkAdaptationCoordinator] Preload successful: ${request.framework}`);
      }
    });

    // Listen to connectivity changes for strategy adjustment
    this.connectivityHandler.addListener((state: ConnectivityState) => {
      this.adaptToConnectivityChange(state);
    });
  }

  /**
   * Adapt to network condition changes
   */
  private adaptToNetworkChange(event: ConnectionEvent): void {
    const aggressiveness = this.config.adaptation.aggressiveness;
    
    if (event.type === 'slow' || event.type === 'unstable') {
      // Reduce preloading on poor networks
      const conservativeStrategy: Partial<PreloadingStrategy> = {
        maxConcurrentPreloads: aggressiveness === 'conservative' ? 1 : 2,
        bandwidthThreshold: aggressiveness === 'conservative' ? 2 : 1.5,
        qualityThreshold: aggressiveness === 'conservative' ? 0.7 : 0.6
      };
      
      this.preloader.updateStrategy(conservativeStrategy);
      
    } else if (event.type === 'fast') {
      // Increase preloading on good networks
      const aggressiveStrategy: Partial<PreloadingStrategy> = {
        maxConcurrentPreloads: aggressiveness === 'aggressive' ? 4 : 3,
        bandwidthThreshold: aggressiveness === 'aggressive' ? 0.5 : 1,
        qualityThreshold: aggressiveness === 'aggressive' ? 0.3 : 0.4
      };
      
      this.preloader.updateStrategy(aggressiveStrategy);
    }
  }

  /**
   * Adapt to connectivity state changes
   */
  private adaptToConnectivityChange(state: ConnectivityState): void {
    if (!state.isOnline) {
      // Disable preloading when offline
      this.preloader.updateStrategy({ enabled: false });
      
    } else if (state.isStable) {
      // Re-enable preloading when stable
      this.preloader.updateStrategy({ enabled: true });
      
    } else {
      // Reduce preloading on unstable connections
      this.preloader.updateStrategy({
        enabled: true,
        maxConcurrentPreloads: 1,
        qualityThreshold: 0.7
      });
    }
  }

  /**
   * Determine if framework should be preloaded
   */
  private shouldPreload(
    framework: FrameworkType,
    priority: LoadPriority,
    context?: { viewport?: boolean; interaction?: boolean; navigation?: boolean }
  ): boolean {
    // Don't preload critical or high priority items (they should load immediately)
    if (priority === LoadPriority.CRITICAL || priority === LoadPriority.HIGH) {
      return false;
    }

    // Preload if in viewport
    if (context?.viewport) {
      return true;
    }

    // Preload if user interaction suggests it will be needed
    if (context?.interaction) {
      return true;
    }

    // Preload if navigation suggests it will be needed
    if (context?.navigation) {
      return true;
    }

    // Default to no preloading for normal/low priority without context
    return false;
  }

  /**
   * Start metrics updates
   */
  private startMetricsUpdates(): void {
    if (this.metricsUpdateInterval) return;
    
    this.metricsUpdateInterval = setInterval(() => {
      const metrics = this.getMetrics();
      this.notifyMetricsListeners(metrics);
    }, this.config.monitoring.assessmentInterval);
  }

  /**
   * Stop metrics updates
   */
  private stopMetricsUpdates(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }
  }

  /**
   * Notify metrics listeners
   */
  private notifyMetricsListeners(metrics: NetworkAdaptationMetrics): void {
    for (const listener of this.listeners) {
      try {
        listener(metrics);
      } catch (error) {
        console.warn('[NetworkAdaptationCoordinator] Metrics listener error:', error);
      }
    }
  }
}