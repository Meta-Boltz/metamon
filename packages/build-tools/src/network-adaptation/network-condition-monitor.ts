/**
 * Network Condition Monitor
 * Monitors network conditions and provides real-time adaptation capabilities
 */

import { NetworkConditions, LoadPriority } from '../types/framework-loader.js';

export interface NetworkQualityMetrics {
  score: number; // 0-1, higher is better
  stability: number; // 0-1, higher is more stable
  latency: number; // milliseconds
  bandwidth: number; // Mbps
  packetLoss: number; // 0-1, lower is better
}

export interface ConnectionEvent {
  type: 'online' | 'offline' | 'slow' | 'fast' | 'unstable';
  timestamp: number;
  conditions: NetworkConditions;
  metrics: NetworkQualityMetrics;
}

export interface AdaptationStrategy {
  maxConcurrentLoads: number;
  timeoutMultiplier: number;
  retryStrategy: 'aggressive' | 'conservative' | 'minimal';
  preloadingEnabled: boolean;
  cacheFirst: boolean;
  priorityBoost: Record<LoadPriority, number>;
}

export class NetworkConditionMonitor {
  private currentConditions: NetworkConditions | null = null;
  private qualityMetrics: NetworkQualityMetrics | null = null;
  private connectionHistory: ConnectionEvent[] = [];
  private listeners: Array<(event: ConnectionEvent) => void> = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isOnline: boolean = true;
  private lastOnlineTime: number = Date.now();
  private connectionStabilityWindow: number[] = [];

  constructor() {
    this.initializeMonitoring();
  }

  /**
   * Get current network conditions
   */
  getCurrentConditions(): NetworkConditions | null {
    return this.currentConditions;
  }

  /**
   * Get current network quality metrics
   */
  getQualityMetrics(): NetworkQualityMetrics | null {
    return this.qualityMetrics;
  }

  /**
   * Get connection stability over time
   */
  getConnectionStability(): number {
    if (this.connectionStabilityWindow.length === 0) return 1;
    
    const variance = this.calculateVariance(this.connectionStabilityWindow);
    return Math.max(0, 1 - variance);
  }

  /**
   * Check if network is currently reliable
   */
  isNetworkReliable(): boolean {
    if (!this.isOnline) return false;
    if (!this.qualityMetrics) return true;
    
    return (
      this.qualityMetrics.score > 0.6 &&
      this.qualityMetrics.stability > 0.7 &&
      this.qualityMetrics.packetLoss < 0.1
    );
  }

  /**
   * Check if connection is intermittent
   */
  isIntermittentConnection(): boolean {
    const recentEvents = this.connectionHistory
      .filter(event => Date.now() - event.timestamp < 300000) // Last 5 minutes
      .filter(event => event.type === 'offline' || event.type === 'unstable');
    
    return recentEvents.length > 2;
  }

  /**
   * Get recommended adaptation strategy
   */
  getAdaptationStrategy(): AdaptationStrategy {
    const baseStrategy: AdaptationStrategy = {
      maxConcurrentLoads: 3,
      timeoutMultiplier: 1,
      retryStrategy: 'conservative',
      preloadingEnabled: true,
      cacheFirst: false,
      priorityBoost: {
        [LoadPriority.CRITICAL]: 1,
        [LoadPriority.HIGH]: 1,
        [LoadPriority.NORMAL]: 1,
        [LoadPriority.LOW]: 1
      }
    };

    if (!this.isOnline) {
      return {
        ...baseStrategy,
        maxConcurrentLoads: 0,
        preloadingEnabled: false,
        cacheFirst: true,
        retryStrategy: 'minimal'
      };
    }

    if (!this.qualityMetrics || !this.currentConditions) {
      return baseStrategy;
    }

    const strategy = { ...baseStrategy };

    // Adapt based on network quality score
    if (this.qualityMetrics.score < 0.3) {
      // Very poor network
      strategy.maxConcurrentLoads = 1;
      strategy.timeoutMultiplier = 3;
      strategy.retryStrategy = 'minimal';
      strategy.preloadingEnabled = false;
      strategy.cacheFirst = true;
      strategy.priorityBoost[LoadPriority.CRITICAL] = 3;
      strategy.priorityBoost[LoadPriority.LOW] = 0.2;
    } else if (this.qualityMetrics.score < 0.6) {
      // Poor network
      strategy.maxConcurrentLoads = 2;
      strategy.timeoutMultiplier = 2;
      strategy.retryStrategy = 'conservative';
      strategy.preloadingEnabled = false;
      strategy.priorityBoost[LoadPriority.CRITICAL] = 2;
      strategy.priorityBoost[LoadPriority.LOW] = 0.5;
    } else if (this.qualityMetrics.score > 0.8) {
      // Excellent network
      strategy.maxConcurrentLoads = 6;
      strategy.timeoutMultiplier = 0.8;
      strategy.retryStrategy = 'aggressive';
      strategy.preloadingEnabled = true;
    }

    // Adapt based on connection stability
    if (this.getConnectionStability() < 0.5) {
      strategy.cacheFirst = true;
      strategy.retryStrategy = 'conservative';
      strategy.preloadingEnabled = false;
    }

    // Adapt based on save data preference
    if (this.currentConditions.saveData) {
      strategy.maxConcurrentLoads = 1;
      strategy.preloadingEnabled = false;
      strategy.priorityBoost[LoadPriority.CRITICAL] = 4;
      strategy.priorityBoost[LoadPriority.HIGH] = 2;
      strategy.priorityBoost[LoadPriority.NORMAL] = 1;
      strategy.priorityBoost[LoadPriority.LOW] = 0.1;
    }

    return strategy;
  }

  /**
   * Add listener for network condition changes
   */
  addListener(listener: (event: ConnectionEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove listener
   */
  removeListener(listener: (event: ConnectionEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get connection history
   */
  getConnectionHistory(maxAge?: number): ConnectionEvent[] {
    const cutoff = maxAge ? Date.now() - maxAge : 0;
    return this.connectionHistory.filter(event => event.timestamp > cutoff);
  }

  /**
   * Manually update network conditions (for testing or manual override)
   */
  updateNetworkConditions(conditions: NetworkConditions): void {
    const hasChanged = !this.currentConditions || 
      JSON.stringify(this.currentConditions) !== JSON.stringify(conditions);

    this.currentConditions = conditions;

    if (hasChanged) {
      this.performPeriodicAssessment();
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

  /**
   * Manually trigger network quality assessment
   */
  async assessNetworkQuality(): Promise<NetworkQualityMetrics> {
    const metrics = await this.measureNetworkQuality();
    this.qualityMetrics = metrics;
    return metrics;
  }

  /**
   * Destroy monitor and cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    
    this.listeners = [];
  }

  /**
   * Initialize network monitoring
   */
  private initializeMonitoring(): void {
    // Monitor online/offline status
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }

    // Initialize network information monitoring
    this.initializeNetworkInformation();

    // Start periodic quality assessment
    this.monitoringInterval = setInterval(() => {
      this.performPeriodicAssessment();
    }, 30000); // Every 30 seconds

    // Initial assessment
    this.performPeriodicAssessment();
  }

  /**
   * Initialize Network Information API monitoring
   */
  private initializeNetworkInformation(): void {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      // Fallback conditions
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
      const newConditions: NetworkConditions = {
        effectiveType: connection.effectiveType || '4g',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 100,
        saveData: connection.saveData || false
      };

      const hasChanged = !this.currentConditions || 
        JSON.stringify(this.currentConditions) !== JSON.stringify(newConditions);

      this.currentConditions = newConditions;

      if (hasChanged) {
        this.performPeriodicAssessment();
      }
    };

    // Initial update
    updateConditions();

    // Listen for changes
    connection.addEventListener('change', updateConditions);
  }

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    const wasOffline = !this.isOnline;
    this.isOnline = true;
    this.lastOnlineTime = Date.now();

    if (wasOffline && this.currentConditions) {
      const event: ConnectionEvent = {
        type: 'online',
        timestamp: Date.now(),
        conditions: this.currentConditions,
        metrics: this.qualityMetrics || this.getDefaultMetrics()
      };

      this.addConnectionEvent(event);
    }
  };

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    this.isOnline = false;

    if (this.currentConditions) {
      const event: ConnectionEvent = {
        type: 'offline',
        timestamp: Date.now(),
        conditions: this.currentConditions,
        metrics: this.qualityMetrics || this.getDefaultMetrics()
      };

      this.addConnectionEvent(event);
    }
  };

  /**
   * Perform periodic network quality assessment
   */
  private async performPeriodicAssessment(): Promise<void> {
    if (!this.isOnline || !this.currentConditions) return;

    try {
      const metrics = await this.measureNetworkQuality();
      const previousMetrics = this.qualityMetrics;
      this.qualityMetrics = metrics;

      // Update stability window
      this.connectionStabilityWindow.push(metrics.score);
      if (this.connectionStabilityWindow.length > 10) {
        this.connectionStabilityWindow.shift();
      }

      // Detect significant quality changes
      if (previousMetrics) {
        const scoreDiff = Math.abs(metrics.score - previousMetrics.score);
        if (scoreDiff > 0.3) {
          const eventType = metrics.score > previousMetrics.score ? 'fast' : 'slow';
          const event: ConnectionEvent = {
            type: eventType,
            timestamp: Date.now(),
            conditions: this.currentConditions,
            metrics
          };

          this.addConnectionEvent(event);
        }

        // Detect instability
        if (metrics.stability < 0.5 && previousMetrics.stability >= 0.5) {
          const event: ConnectionEvent = {
            type: 'unstable',
            timestamp: Date.now(),
            conditions: this.currentConditions,
            metrics
          };

          this.addConnectionEvent(event);
        }
      }
    } catch (error) {
      console.warn('[NetworkConditionMonitor] Quality assessment failed:', error);
    }
  }

  /**
   * Measure network quality using various techniques
   */
  private async measureNetworkQuality(): Promise<NetworkQualityMetrics> {
    if (!this.currentConditions) {
      return this.getDefaultMetrics();
    }

    const startTime = performance.now();
    let bandwidth = this.currentConditions.downlink;
    let latency = this.currentConditions.rtt;

    try {
      // Perform a small network request to measure actual performance
      const testUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ='; // Small data URL
      const response = await fetch(testUrl);
      const endTime = performance.now();
      
      if (response.ok) {
        latency = Math.min(latency, endTime - startTime);
      }
    } catch (error) {
      // Network request failed, use fallback values
    }

    // Calculate quality score based on multiple factors
    let score = 1;

    // Factor in effective connection type
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

    // Factor in bandwidth (normalize to 0-1, assuming 10 Mbps is excellent)
    const bandwidthScore = Math.min(bandwidth / 10, 1);
    score *= bandwidthScore;

    // Factor in latency (normalize to 0-1, assuming 100ms is good)
    const latencyScore = Math.max(0, 1 - (latency - 50) / 500);
    score *= latencyScore;

    // Calculate stability based on recent measurements
    const stability = this.getConnectionStability();

    // Estimate packet loss (simplified heuristic)
    const packetLoss = Math.max(0, (latency - 100) / 1000);

    return {
      score: Math.max(0, Math.min(1, score)),
      stability,
      latency,
      bandwidth,
      packetLoss: Math.min(1, packetLoss)
    };
  }

  /**
   * Add connection event and notify listeners
   */
  private addConnectionEvent(event: ConnectionEvent): void {
    this.connectionHistory.push(event);
    
    // Keep only recent events (last hour)
    const cutoff = Date.now() - 3600000;
    this.connectionHistory = this.connectionHistory.filter(e => e.timestamp > cutoff);

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('[NetworkConditionMonitor] Listener error:', error);
      }
    }
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Get default metrics for fallback scenarios
   */
  private getDefaultMetrics(): NetworkQualityMetrics {
    return {
      score: 0.8,
      stability: 0.9,
      latency: 100,
      bandwidth: 10,
      packetLoss: 0
    };
  }
}