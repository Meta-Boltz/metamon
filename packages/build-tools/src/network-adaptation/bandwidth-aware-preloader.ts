/**
 * Bandwidth-Aware Preloader
 * Intelligently preloads framework cores based on available bandwidth and network conditions
 */

import { FrameworkType, LoadPriority, NetworkConditions } from '../types/framework-loader.js';
import { NetworkConditionMonitor, NetworkQualityMetrics, ConnectionEvent } from './network-condition-monitor.js';

export interface PreloadRequest {
  framework: FrameworkType;
  priority: LoadPriority;
  estimatedSize: number;
  reason: 'viewport' | 'interaction' | 'navigation' | 'pattern';
  confidence: number; // 0-1
  deadline?: number; // timestamp when this becomes irrelevant
}

export interface BandwidthBudget {
  total: number; // bytes per second
  available: number; // remaining budget
  reserved: number; // reserved for critical operations
  window: number; // time window in ms
}

export interface PreloadingStrategy {
  enabled: boolean;
  maxConcurrentPreloads: number;
  bandwidthThreshold: number; // minimum bandwidth to enable preloading
  qualityThreshold: number; // minimum network quality score
  priorityWeights: Record<LoadPriority, number>;
  reasonWeights: Record<string, number>;
}

export class BandwidthAwarePreloader {
  private monitor: NetworkConditionMonitor;
  private preloadQueue: PreloadRequest[] = [];
  private activePreloads: Map<FrameworkType, Promise<void>> = new Map();
  private bandwidthBudget: BandwidthBudget;
  private strategy: PreloadingStrategy;
  private preloadHistory: Array<{ framework: FrameworkType; success: boolean; timestamp: number; size: number }> = [];
  private listeners: Array<(request: PreloadRequest, success: boolean) => void> = [];

  constructor(monitor: NetworkConditionMonitor, initialStrategy?: Partial<PreloadingStrategy>) {
    this.monitor = monitor;
    this.strategy = {
      enabled: true,
      maxConcurrentPreloads: 2,
      bandwidthThreshold: 1, // 1 Mbps minimum
      qualityThreshold: 0.5,
      priorityWeights: {
        [LoadPriority.CRITICAL]: 4,
        [LoadPriority.HIGH]: 3,
        [LoadPriority.NORMAL]: 2,
        [LoadPriority.LOW]: 1
      },
      reasonWeights: {
        viewport: 3,
        interaction: 4,
        navigation: 2,
        pattern: 1
      },
      ...initialStrategy
    };

    this.bandwidthBudget = this.calculateBandwidthBudget();
    
    // Listen to network condition changes
    this.monitor.addListener(this.handleNetworkChange);
    
    // Start processing queue
    this.processPreloadQueue();
  }

  /**
   * Request preloading of a framework
   */
  requestPreload(request: PreloadRequest): void {
    // Check if already queued or active
    if (this.preloadQueue.some(r => r.framework === request.framework) ||
        this.activePreloads.has(request.framework)) {
      return;
    }

    // Add to queue with priority sorting
    this.preloadQueue.push(request);
    this.sortPreloadQueue();
    
    // Try to process immediately if conditions are good
    this.processPreloadQueue();
  }

  /**
   * Cancel preload request
   */
  cancelPreload(framework: FrameworkType): void {
    // Remove from queue
    this.preloadQueue = this.preloadQueue.filter(r => r.framework !== framework);
    
    // Cancel active preload if exists
    // Note: We can't actually cancel the promise, but we can ignore its result
    if (this.activePreloads.has(framework)) {
      this.activePreloads.delete(framework);
    }
  }

  /**
   * Update preloading strategy
   */
  updateStrategy(strategy: Partial<PreloadingStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
    this.bandwidthBudget = this.calculateBandwidthBudget();
    
    // Re-evaluate queue
    this.sortPreloadQueue();
    this.processPreloadQueue();
  }

  /**
   * Get current preload queue status
   */
  getQueueStatus(): {
    queued: PreloadRequest[];
    active: FrameworkType[];
    completed: number;
    failed: number;
  } {
    const recent = this.preloadHistory.filter(h => Date.now() - h.timestamp < 300000); // Last 5 minutes
    
    return {
      queued: [...this.preloadQueue],
      active: Array.from(this.activePreloads.keys()),
      completed: recent.filter(h => h.success).length,
      failed: recent.filter(h => !h.success).length
    };
  }

  /**
   * Get bandwidth utilization stats
   */
  getBandwidthStats(): {
    budget: BandwidthBudget;
    utilization: number; // 0-1
    efficiency: number; // successful preloads / total attempts
  } {
    const recent = this.preloadHistory.filter(h => Date.now() - h.timestamp < 60000); // Last minute
    const totalAttempts = recent.length;
    const successful = recent.filter(h => h.success).length;
    
    return {
      budget: { ...this.bandwidthBudget },
      utilization: 1 - (this.bandwidthBudget.available / this.bandwidthBudget.total),
      efficiency: totalAttempts > 0 ? successful / totalAttempts : 1
    };
  }

  /**
   * Add listener for preload events
   */
  addListener(listener: (request: PreloadRequest, success: boolean) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove listener
   */
  removeListener(listener: (request: PreloadRequest, success: boolean) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Destroy preloader and cleanup resources
   */
  destroy(): void {
    this.monitor.removeListener(this.handleNetworkChange);
    this.preloadQueue = [];
    this.activePreloads.clear();
    this.listeners = [];
  }

  /**
   * Handle network condition changes
   */
  private handleNetworkChange = (event: ConnectionEvent): void => {
    // Recalculate bandwidth budget
    this.bandwidthBudget = this.calculateBandwidthBudget();
    
    // Adjust strategy based on network conditions
    if (event.type === 'offline') {
      // Pause all preloading when offline
      this.strategy.enabled = false;
    } else if (event.type === 'online') {
      // Resume preloading when back online
      this.strategy.enabled = true;
    } else if (event.type === 'slow') {
      // Reduce preloading on slow networks
      this.strategy.maxConcurrentPreloads = 1;
    } else if (event.type === 'fast') {
      // Increase preloading on fast networks
      this.strategy.maxConcurrentPreloads = Math.min(4, this.strategy.maxConcurrentPreloads + 1);
    }
    
    // Re-evaluate queue
    this.processPreloadQueue();
  };

  /**
   * Calculate available bandwidth budget
   */
  private calculateBandwidthBudget(): BandwidthBudget {
    const conditions = this.monitor.getCurrentConditions();
    const metrics = this.monitor.getQualityMetrics();
    
    if (!conditions || !metrics) {
      return {
        total: 1000000, // 1 MB/s fallback
        available: 1000000,
        reserved: 200000, // 200 KB/s reserved
        window: 60000 // 1 minute window
      };
    }

    // Convert Mbps to bytes per second
    const totalBandwidth = conditions.downlink * 125000; // Mbps to bytes/s
    
    // Reserve bandwidth for critical operations
    const reservedBandwidth = Math.max(totalBandwidth * 0.2, 100000); // At least 100 KB/s
    
    // Available bandwidth for preloading
    const availableBandwidth = Math.max(0, totalBandwidth - reservedBandwidth);
    
    return {
      total: availableBandwidth,
      available: availableBandwidth,
      reserved: reservedBandwidth,
      window: 60000
    };
  }

  /**
   * Sort preload queue by priority and other factors
   */
  private sortPreloadQueue(): void {
    const now = Date.now();
    
    this.preloadQueue.sort((a, b) => {
      // Remove expired requests
      if (a.deadline && a.deadline < now) return 1;
      if (b.deadline && b.deadline < now) return -1;
      
      // Calculate priority scores
      const scoreA = this.calculatePreloadScore(a);
      const scoreB = this.calculatePreloadScore(b);
      
      return scoreB - scoreA; // Higher score first
    });
    
    // Remove expired requests
    this.preloadQueue = this.preloadQueue.filter(r => !r.deadline || r.deadline >= now);
  }

  /**
   * Calculate priority score for a preload request
   */
  private calculatePreloadScore(request: PreloadRequest): number {
    let score = 0;
    
    // Base priority weight
    score += this.strategy.priorityWeights[request.priority] * 10;
    
    // Reason weight
    score += (this.strategy.reasonWeights[request.reason] || 1) * 5;
    
    // Confidence factor
    score += request.confidence * 10;
    
    // Size penalty (prefer smaller frameworks)
    score -= Math.log(request.estimatedSize / 1000) * 2;
    
    // Deadline urgency
    if (request.deadline) {
      const timeLeft = request.deadline - Date.now();
      const urgency = Math.max(0, 1 - timeLeft / 300000); // 5 minute window
      score += urgency * 15;
    }
    
    return score;
  }

  /**
   * Process preload queue
   */
  private async processPreloadQueue(): Promise<void> {
    if (!this.strategy.enabled) return;
    
    const conditions = this.monitor.getCurrentConditions();
    const metrics = this.monitor.getQualityMetrics();
    
    // Check if network conditions are suitable for preloading
    if (!conditions || !metrics) return;
    
    if (conditions.downlink < this.strategy.bandwidthThreshold ||
        metrics.score < this.strategy.qualityThreshold ||
        conditions.saveData) {
      return;
    }
    
    // Process queue while we have capacity
    while (this.preloadQueue.length > 0 && 
           this.activePreloads.size < this.strategy.maxConcurrentPreloads &&
           this.bandwidthBudget.available > 0) {
      
      const request = this.preloadQueue.shift()!;
      
      // Check if we have enough bandwidth budget
      if (request.estimatedSize > this.bandwidthBudget.available) {
        // Put back at front of queue and wait
        this.preloadQueue.unshift(request);
        break;
      }
      
      // Start preload
      this.startPreload(request);
    }
  }

  /**
   * Start preloading a framework
   */
  private async startPreload(request: PreloadRequest): Promise<void> {
    // Reserve bandwidth
    this.bandwidthBudget.available -= request.estimatedSize;
    
    const preloadPromise = this.performPreload(request);
    this.activePreloads.set(request.framework, preloadPromise);
    
    try {
      await preloadPromise;
      
      // Record success
      this.preloadHistory.push({
        framework: request.framework,
        success: true,
        timestamp: Date.now(),
        size: request.estimatedSize
      });
      
      // Notify listeners
      this.notifyListeners(request, true);
      
    } catch (error) {
      // Record failure
      this.preloadHistory.push({
        framework: request.framework,
        success: false,
        timestamp: Date.now(),
        size: request.estimatedSize
      });
      
      // Notify listeners
      this.notifyListeners(request, false);
      
      console.warn(`[BandwidthAwarePreloader] Failed to preload ${request.framework}:`, error);
    } finally {
      // Cleanup
      this.activePreloads.delete(request.framework);
      
      // Restore bandwidth budget (simplified - in reality, bandwidth is time-based)
      setTimeout(() => {
        this.bandwidthBudget.available = Math.min(
          this.bandwidthBudget.total,
          this.bandwidthBudget.available + request.estimatedSize
        );
      }, this.bandwidthBudget.window);
      
      // Continue processing queue
      this.processPreloadQueue();
    }
  }

  /**
   * Perform the actual preload operation
   * This would integrate with the actual framework loader
   */
  private async performPreload(request: PreloadRequest): Promise<void> {
    // Simulate preload operation
    // In real implementation, this would call the framework loader service
    
    const delay = Math.random() * 2000 + 500; // 0.5-2.5 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simulate occasional failures based on network quality
    const metrics = this.monitor.getQualityMetrics();
    const failureRate = metrics ? (1 - metrics.score) * 0.2 : 0.1; // Max 20% failure rate
    
    if (Math.random() < failureRate) {
      throw new Error(`Preload failed for ${request.framework}`);
    }
  }

  /**
   * Notify listeners of preload events
   */
  private notifyListeners(request: PreloadRequest, success: boolean): void {
    for (const listener of this.listeners) {
      try {
        listener(request, success);
      } catch (error) {
        console.warn('[BandwidthAwarePreloader] Listener error:', error);
      }
    }
  }
}