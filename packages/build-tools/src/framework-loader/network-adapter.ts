/**
 * Network Condition Adapter for Framework Loading
 */

import { NetworkConditions, LoadingStrategy, LoadPriority } from '../types/framework-loader.js';

/**
 * Adapts loading strategies based on network conditions
 */
export class NetworkConditionAdapter {
  private currentConditions: NetworkConditions | null = null;
  private baseStrategy: LoadingStrategy;
  private adaptedStrategy: LoadingStrategy;
  private listeners: Array<(conditions: NetworkConditions, strategy: LoadingStrategy) => void> = [];

  constructor(baseStrategy: LoadingStrategy) {
    this.baseStrategy = { ...baseStrategy };
    this.adaptedStrategy = { ...baseStrategy };
    this.initializeNetworkMonitoring();
  }

  /**
   * Get current network conditions
   */
  getCurrentConditions(): NetworkConditions | null {
    return this.currentConditions;
  }

  /**
   * Get adapted loading strategy based on current network conditions
   */
  getAdaptedStrategy(): LoadingStrategy {
    return { ...this.adaptedStrategy };
  }

  /**
   * Manually update network conditions (for testing or manual override)
   */
  updateNetworkConditions(conditions: NetworkConditions): void {
    this.currentConditions = conditions;
    this.adaptStrategy();
    this.notifyListeners();
  }

  /**
   * Add listener for network condition changes
   */
  addListener(listener: (conditions: NetworkConditions, strategy: LoadingStrategy) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove listener
   */
  removeListener(listener: (conditions: NetworkConditions, strategy: LoadingStrategy) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Update base strategy and re-adapt
   */
  updateBaseStrategy(strategy: LoadingStrategy): void {
    this.baseStrategy = { ...strategy };
    this.adaptStrategy();
    this.notifyListeners();
  }

  /**
   * Check if current network is considered slow
   */
  isSlowNetwork(): boolean {
    if (!this.currentConditions) return false;
    
    return (
      this.currentConditions.effectiveType === '2g' ||
      this.currentConditions.effectiveType === 'slow-2g' ||
      this.currentConditions.downlink < this.baseStrategy.networkAdaptation.slowNetworkThreshold
    );
  }

  /**
   * Get recommended timeout based on network conditions
   */
  getRecommendedTimeout(basePriority: LoadPriority): number {
    if (!this.currentConditions || !this.baseStrategy.networkAdaptation.adaptiveTimeout) {
      return this.baseStrategy.timeoutMs;
    }

    let multiplier = 1;

    // Adjust based on effective connection type
    switch (this.currentConditions.effectiveType) {
      case 'slow-2g':
        multiplier = 4;
        break;
      case '2g':
        multiplier = 3;
        break;
      case '3g':
        multiplier = 2;
        break;
      case '4g':
        multiplier = 1;
        break;
    }

    // Adjust based on RTT
    if (this.currentConditions.rtt > 1000) {
      multiplier *= 2;
    } else if (this.currentConditions.rtt > 500) {
      multiplier *= 1.5;
    }

    // Adjust based on priority
    const priorityMultipliers = {
      [LoadPriority.CRITICAL]: 1.5, // Give critical loads more time
      [LoadPriority.HIGH]: 1.2,
      [LoadPriority.NORMAL]: 1,
      [LoadPriority.LOW]: 0.8 // Less time for low priority
    };

    multiplier *= priorityMultipliers[basePriority];

    return Math.min(this.baseStrategy.timeoutMs * multiplier, 30000); // Cap at 30 seconds
  }

  /**
   * Initialize network monitoring using Navigator API
   */
  private initializeNetworkMonitoring(): void {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      // Fallback for environments without Network Information API
      this.currentConditions = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: false
      };
      return;
    }

    const connection = (navigator as any).connection;
    
    const updateConditions = () => {
      this.currentConditions = {
        effectiveType: connection.effectiveType || '4g',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 100,
        saveData: connection.saveData || false
      };
      
      this.adaptStrategy();
      this.notifyListeners();
    };

    // Initial update
    updateConditions();

    // Listen for changes
    connection.addEventListener('change', updateConditions);
  }

  /**
   * Adapt loading strategy based on current network conditions
   */
  private adaptStrategy(): void {
    if (!this.currentConditions) {
      this.adaptedStrategy = { ...this.baseStrategy };
      return;
    }

    const adapted = { ...this.baseStrategy };

    // Adapt concurrent loads based on network quality
    if (this.isSlowNetwork()) {
      adapted.maxConcurrentLoads = Math.max(1, Math.floor(adapted.maxConcurrentLoads / 2));
      adapted.retryDelayMs = adapted.retryDelayMs * 2;
      
      // Reduce retry attempts on slow networks to avoid long waits
      adapted.retryAttempts = Math.max(1, adapted.retryAttempts - 1);
    }

    // Adapt based on save data preference
    if (this.currentConditions.saveData) {
      adapted.maxConcurrentLoads = 1; // Serialize loads to save data
      adapted.retryAttempts = 1; // Reduce retries
      
      // Adjust priority weights to favor critical loads more heavily
      adapted.priorityWeights = {
        ...adapted.priorityWeights,
        [LoadPriority.CRITICAL]: adapted.priorityWeights[LoadPriority.CRITICAL] * 2,
        [LoadPriority.LOW]: Math.floor(adapted.priorityWeights[LoadPriority.LOW] / 2)
      };
    }

    // Adapt timeout based on RTT
    if (this.baseStrategy.networkAdaptation.adaptiveTimeout) {
      const rttMultiplier = Math.max(1, this.currentConditions.rtt / 100);
      adapted.timeoutMs = Math.min(adapted.timeoutMs * rttMultiplier, 30000);
    }

    this.adaptedStrategy = adapted;
  }

  /**
   * Notify all listeners of network condition changes
   */
  private notifyListeners(): void {
    if (!this.currentConditions) return;
    
    for (const listener of this.listeners) {
      try {
        listener(this.currentConditions, this.adaptedStrategy);
      } catch (error) {
        console.warn('[NetworkConditionAdapter] Listener error:', error);
      }
    }
  }

  /**
   * Get network quality score (0-1, higher is better)
   */
  getNetworkQualityScore(): number {
    if (!this.currentConditions) return 1;

    let score = 1;

    // Factor in effective type
    switch (this.currentConditions.effectiveType) {
      case 'slow-2g':
        score *= 0.2;
        break;
      case '2g':
        score *= 0.4;
        break;
      case '3g':
        score *= 0.7;
        break;
      case '4g':
        score *= 1;
        break;
    }

    // Factor in downlink speed (normalize to 0-1 range, assuming 10 Mbps is good)
    const downlinkScore = Math.min(this.currentConditions.downlink / 10, 1);
    score *= downlinkScore;

    // Factor in RTT (normalize to 0-1 range, assuming 100ms is good)
    const rttScore = Math.max(0, 1 - (this.currentConditions.rtt - 100) / 1000);
    score *= rttScore;

    return Math.max(0, Math.min(1, score));
  }
}