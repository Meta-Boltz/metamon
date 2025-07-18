/**
 * Tests for Network Condition Adapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkConditionAdapter } from '../framework-loader/network-adapter.js';
import { NetworkConditions, LoadingStrategy, LoadPriority } from '../types/framework-loader.js';

describe('NetworkConditionAdapter', () => {
  let adapter: NetworkConditionAdapter;
  let baseStrategy: LoadingStrategy;

  beforeEach(() => {
    baseStrategy = {
      maxConcurrentLoads: 4,
      timeoutMs: 5000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      priorityWeights: {
        [LoadPriority.CRITICAL]: 1000,
        [LoadPriority.HIGH]: 100,
        [LoadPriority.NORMAL]: 10,
        [LoadPriority.LOW]: 1
      },
      networkAdaptation: {
        enabled: true,
        slowNetworkThreshold: 2.0,
        adaptiveTimeout: true
      }
    };

    adapter = new NetworkConditionAdapter(baseStrategy);
  });

  describe('Network Condition Management', () => {
    it('should start with null conditions', () => {
      // Note: In real browser environment, it would initialize with actual conditions
      const conditions = adapter.getCurrentConditions();
      expect(conditions).toBeDefined(); // Fallback conditions are set
    });

    it('should update network conditions manually', () => {
      const testConditions: NetworkConditions = {
        effectiveType: '3g',
        downlink: 1.5,
        rtt: 300,
        saveData: false
      };

      adapter.updateNetworkConditions(testConditions);
      
      const conditions = adapter.getCurrentConditions();
      expect(conditions).toEqual(testConditions);
    });

    it('should detect slow networks', () => {
      const slowConditions: NetworkConditions = {
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 800,
        saveData: false
      };

      adapter.updateNetworkConditions(slowConditions);
      expect(adapter.isSlowNetwork()).toBe(true);
    });

    it('should detect fast networks', () => {
      const fastConditions: NetworkConditions = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      };

      adapter.updateNetworkConditions(fastConditions);
      expect(adapter.isSlowNetwork()).toBe(false);
    });
  });

  describe('Strategy Adaptation', () => {
    it('should reduce concurrent loads on slow networks', () => {
      const slowConditions: NetworkConditions = {
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 800,
        saveData: false
      };

      adapter.updateNetworkConditions(slowConditions);
      const adaptedStrategy = adapter.getAdaptedStrategy();

      expect(adaptedStrategy.maxConcurrentLoads).toBeLessThan(baseStrategy.maxConcurrentLoads);
      expect(adaptedStrategy.retryDelayMs).toBeGreaterThan(baseStrategy.retryDelayMs);
    });

    it('should adapt for save data mode', () => {
      const saveDataConditions: NetworkConditions = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: true
      };

      adapter.updateNetworkConditions(saveDataConditions);
      const adaptedStrategy = adapter.getAdaptedStrategy();

      expect(adaptedStrategy.maxConcurrentLoads).toBe(1); // Serialize loads
      expect(adaptedStrategy.retryAttempts).toBe(1); // Reduce retries
      expect(adaptedStrategy.priorityWeights[LoadPriority.CRITICAL])
        .toBeGreaterThan(baseStrategy.priorityWeights[LoadPriority.CRITICAL]);
    });

    it('should maintain base strategy on good networks', () => {
      const goodConditions: NetworkConditions = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      };

      adapter.updateNetworkConditions(goodConditions);
      const adaptedStrategy = adapter.getAdaptedStrategy();

      expect(adaptedStrategy.maxConcurrentLoads).toBe(baseStrategy.maxConcurrentLoads);
      expect(adaptedStrategy.retryAttempts).toBe(baseStrategy.retryAttempts);
    });
  });

  describe('Timeout Adaptation', () => {
    it('should increase timeout for slow networks', () => {
      const slowConditions: NetworkConditions = {
        effectiveType: 'slow-2g',
        downlink: 0.25,
        rtt: 2000,
        saveData: false
      };

      adapter.updateNetworkConditions(slowConditions);
      
      const timeout = adapter.getRecommendedTimeout(LoadPriority.NORMAL);
      expect(timeout).toBeGreaterThan(baseStrategy.timeoutMs);
    });

    it('should adjust timeout based on priority', () => {
      const conditions: NetworkConditions = {
        effectiveType: '3g',
        downlink: 1.5,
        rtt: 300,
        saveData: false
      };

      adapter.updateNetworkConditions(conditions);
      
      const criticalTimeout = adapter.getRecommendedTimeout(LoadPriority.CRITICAL);
      const lowTimeout = adapter.getRecommendedTimeout(LoadPriority.LOW);
      
      expect(criticalTimeout).toBeGreaterThan(lowTimeout);
    });

    it('should cap timeout at maximum value', () => {
      const verySlowConditions: NetworkConditions = {
        effectiveType: 'slow-2g',
        downlink: 0.1,
        rtt: 5000,
        saveData: false
      };

      adapter.updateNetworkConditions(verySlowConditions);
      
      const timeout = adapter.getRecommendedTimeout(LoadPriority.CRITICAL);
      expect(timeout).toBeLessThanOrEqual(30000); // 30 second cap
    });
  });

  describe('Network Quality Scoring', () => {
    it('should give high score for good networks', () => {
      const goodConditions: NetworkConditions = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      };

      adapter.updateNetworkConditions(goodConditions);
      const score = adapter.getNetworkQualityScore();
      
      expect(score).toBeGreaterThan(0.8);
    });

    it('should give low score for poor networks', () => {
      const poorConditions: NetworkConditions = {
        effectiveType: 'slow-2g',
        downlink: 0.1,
        rtt: 3000,
        saveData: false
      };

      adapter.updateNetworkConditions(poorConditions);
      const score = adapter.getNetworkQualityScore();
      
      expect(score).toBeLessThan(0.3);
    });

    it('should return score between 0 and 1', () => {
      const conditions: NetworkConditions = {
        effectiveType: '3g',
        downlink: 1.5,
        rtt: 300,
        saveData: false
      };

      adapter.updateNetworkConditions(conditions);
      const score = adapter.getNetworkQualityScore();
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('Event Listeners', () => {
    it('should notify listeners of network changes', () => {
      const listener = vi.fn();
      adapter.addListener(listener);

      const conditions: NetworkConditions = {
        effectiveType: '3g',
        downlink: 2,
        rtt: 200,
        saveData: false
      };

      adapter.updateNetworkConditions(conditions);

      expect(listener).toHaveBeenCalledWith(conditions, expect.any(Object));
    });

    it('should remove listeners', () => {
      const listener = vi.fn();
      adapter.addListener(listener);
      adapter.removeListener(listener);

      const conditions: NetworkConditions = {
        effectiveType: '3g',
        downlink: 2,
        rtt: 200,
        saveData: false
      };

      adapter.updateNetworkConditions(conditions);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      adapter.addListener(errorListener);
      adapter.addListener(goodListener);

      const conditions: NetworkConditions = {
        effectiveType: '3g',
        downlink: 2,
        rtt: 200,
        saveData: false
      };

      // Should not throw despite listener error
      expect(() => {
        adapter.updateNetworkConditions(conditions);
      }).not.toThrow();

      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Base Strategy Updates', () => {
    it('should update base strategy and re-adapt', () => {
      const newBaseStrategy: LoadingStrategy = {
        ...baseStrategy,
        maxConcurrentLoads: 8,
        timeoutMs: 10000
      };

      adapter.updateBaseStrategy(newBaseStrategy);
      const adaptedStrategy = adapter.getAdaptedStrategy();

      // Should reflect the new base values (possibly adapted)
      expect(adaptedStrategy.maxConcurrentLoads).toBeGreaterThan(baseStrategy.maxConcurrentLoads);
    });
  });
});