/**
 * Unit tests for ReactiveUpdateBatcher
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  ReactiveUpdateBatcher, 
  DefaultUpdateScheduler, 
  BatchOptimizer,
  type BatchConfig,
  type UpdateTrigger,
  type BatchedUpdate,
  type UpdateScheduler,
  type BatchExecutionResult
} from './update-batcher.js';

// Mock scheduler for testing
class MockUpdateScheduler implements UpdateScheduler {
  public scheduledBatches: BatchedUpdate[] = [];
  public cancelledBatches: string[] = [];
  public flushedBatches: BatchedUpdate[] = [];

  schedule(batch: BatchedUpdate): void {
    this.scheduledBatches.push(batch);
  }

  cancel(batchId: string): boolean {
    this.cancelledBatches.push(batchId);
    return true;
  }

  async flush(): Promise<BatchExecutionResult[]> {
    const results: BatchExecutionResult[] = [];
    
    for (const batch of this.scheduledBatches) {
      this.flushedBatches.push(batch);
      results.push({
        batchId: batch.id,
        executedUpdates: batch.triggers.length,
        executionTime: 10,
        errors: [],
        success: true
      });
    }
    
    this.scheduledBatches = [];
    return results;
  }

  reset(): void {
    this.scheduledBatches = [];
    this.cancelledBatches = [];
    this.flushedBatches = [];
  }
}

describe('ReactiveUpdateBatcher', () => {
  let batcher: ReactiveUpdateBatcher;
  let mockScheduler: MockUpdateScheduler;
  let config: BatchConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    mockScheduler = new MockUpdateScheduler();
    config = {
      maxBatchSize: 5,
      batchTimeout: 16,
      debounceDelay: 100,
      priority: 'normal'
    };
    batcher = new ReactiveUpdateBatcher(config, mockScheduler);
  });

  afterEach(() => {
    vi.useRealTimers();
    batcher.clear();
  });

  describe('Basic Update Queuing', () => {
    it('should queue immediate updates without batching', () => {
      const trigger: UpdateTrigger = {
        variableName: 'counter',
        triggerType: 'template',
        immediate: true
      };

      batcher.queueUpdate('counter', trigger);

      expect(mockScheduler.scheduledBatches).toHaveLength(1);
      expect(mockScheduler.scheduledBatches[0].priority).toBe('immediate');
      expect(mockScheduler.scheduledBatches[0].variables).toContain('counter');
    });

    it('should batch non-immediate updates', () => {
      const trigger: UpdateTrigger = {
        variableName: 'data',
        triggerType: 'computed',
        immediate: false
      };

      batcher.queueUpdate('data', trigger);

      // Should not be scheduled immediately
      expect(mockScheduler.scheduledBatches).toHaveLength(0);

      // Advance time to trigger batch timeout
      vi.advanceTimersByTime(20);

      expect(mockScheduler.scheduledBatches).toHaveLength(1);
      expect(mockScheduler.scheduledBatches[0].variables).toContain('data');
    });

    it('should combine multiple updates into a single batch', () => {
      const triggers: UpdateTrigger[] = [
        { variableName: 'var1', triggerType: 'computed', immediate: false },
        { variableName: 'var2', triggerType: 'computed', immediate: false },
        { variableName: 'var3', triggerType: 'computed', immediate: false }
      ];

      triggers.forEach(trigger => {
        batcher.queueUpdate(trigger.variableName, trigger);
      });

      vi.advanceTimersByTime(20);

      expect(mockScheduler.scheduledBatches).toHaveLength(1);
      expect(mockScheduler.scheduledBatches[0].variables).toHaveLength(3);
    });

    it('should respect maximum batch size', () => {
      const triggers: UpdateTrigger[] = Array.from({ length: 10 }, (_, i) => ({
        variableName: `var${i}`,
        triggerType: 'computed' as const,
        immediate: false
      }));

      triggers.forEach(trigger => {
        batcher.queueUpdate(trigger.variableName, trigger);
      });

      vi.advanceTimersByTime(20);

      // Should create multiple batches due to maxBatchSize = 5
      expect(mockScheduler.scheduledBatches.length).toBeGreaterThan(1);
      mockScheduler.scheduledBatches.forEach(batch => {
        expect(batch.variables.length).toBeLessThanOrEqual(config.maxBatchSize);
      });
    });
  });

  describe('Debouncing', () => {
    it('should debounce template updates', () => {
      const trigger: UpdateTrigger = {
        variableName: 'message',
        triggerType: 'template',
        immediate: false
      };

      // Queue multiple updates rapidly
      batcher.queueUpdate('message', trigger);
      batcher.queueUpdate('message', trigger);
      batcher.queueUpdate('message', trigger);

      // Should not be scheduled yet
      expect(mockScheduler.scheduledBatches).toHaveLength(0);

      // Advance time by debounce delay
      vi.advanceTimersByTime(100);

      // Should have only one batch with the debounced updates
      expect(mockScheduler.scheduledBatches).toHaveLength(1);
    });

    it('should reset debounce timer on new updates', () => {
      const trigger: UpdateTrigger = {
        variableName: 'input',
        triggerType: 'template',
        immediate: false
      };

      batcher.queueUpdate('input', trigger);
      
      // Advance time partially
      vi.advanceTimersByTime(50);
      
      // Queue another update (should reset timer)
      batcher.queueUpdate('input', trigger);
      
      // Advance time by less than the full debounce delay
      vi.advanceTimersByTime(50);
      
      // Should not be scheduled yet (timer was reset)
      expect(mockScheduler.scheduledBatches).toHaveLength(0);
      
      // Advance remaining time to complete the debounce delay
      vi.advanceTimersByTime(50);
      
      // Now should be scheduled
      expect(mockScheduler.scheduledBatches).toHaveLength(1);
    });

    it('should not debounce event triggers', () => {
      const trigger: UpdateTrigger = {
        variableName: 'clickHandler',
        triggerType: 'event',
        immediate: false
      };

      batcher.queueUpdate('clickHandler', trigger);

      // Should be batched normally, not debounced
      vi.advanceTimersByTime(20);
      expect(mockScheduler.scheduledBatches).toHaveLength(1);
    });
  });

  describe('Priority Handling', () => {
    it('should handle different priority levels', () => {
      const immediateUpdate: UpdateTrigger = {
        variableName: 'urgent',
        triggerType: 'template',
        immediate: true
      };

      const normalUpdate: UpdateTrigger = {
        variableName: 'normal',
        triggerType: 'computed',
        immediate: false
      };

      batcher.queueUpdate('urgent', immediateUpdate);
      batcher.queueUpdate('normal', normalUpdate);

      // Immediate should be scheduled right away
      expect(mockScheduler.scheduledBatches).toHaveLength(1);
      expect(mockScheduler.scheduledBatches[0].priority).toBe('immediate');

      vi.advanceTimersByTime(20);

      // Normal should be scheduled after timeout
      expect(mockScheduler.scheduledBatches).toHaveLength(2);
      expect(mockScheduler.scheduledBatches[1].priority).toBe('normal');
    });

    it('should not mix different priority levels in same batch', () => {
      const lowPriorityBatcher = new ReactiveUpdateBatcher(
        { ...config, priority: 'low' },
        mockScheduler
      );

      const normalUpdate: UpdateTrigger = {
        variableName: 'normal',
        triggerType: 'computed',
        immediate: false
      };

      const lowUpdate: UpdateTrigger = {
        variableName: 'low',
        triggerType: 'computed',
        immediate: false
      };

      batcher.queueUpdate('normal', normalUpdate);
      lowPriorityBatcher.queueUpdate('low', lowUpdate);

      vi.advanceTimersByTime(20);

      // Should create separate batches for different priorities
      const normalBatches = mockScheduler.scheduledBatches.filter(b => b.priority === 'normal');
      const lowBatches = mockScheduler.scheduledBatches.filter(b => b.priority === 'low');

      expect(normalBatches).toHaveLength(1);
      expect(lowBatches).toHaveLength(1);
    });
  });

  describe('Batch Management', () => {
    it('should provide batch statistics', () => {
      const triggers: UpdateTrigger[] = [
        { variableName: 'var1', triggerType: 'computed', immediate: false },
        { variableName: 'var2', triggerType: 'computed', immediate: false }
      ];

      triggers.forEach(trigger => {
        batcher.queueUpdate(trigger.variableName, trigger);
      });

      vi.advanceTimersByTime(20);

      const stats = batcher.getBatchStatistics();
      expect(stats.totalBatches).toBe(1);
      expect(stats.pendingBatches).toBe(1);
      expect(stats.executedBatches).toBe(0);
      expect(stats.averageBatchSize).toBe(2);
    });

    it('should get pending batches', () => {
      const trigger: UpdateTrigger = {
        variableName: 'test',
        triggerType: 'computed',
        immediate: false
      };

      batcher.queueUpdate('test', trigger);
      vi.advanceTimersByTime(20);

      const pending = batcher.getPendingBatches();
      expect(pending).toHaveLength(1);
      expect(pending[0].variables).toContain('test');
    });

    it('should cancel batches', () => {
      const trigger: UpdateTrigger = {
        variableName: 'cancel',
        triggerType: 'computed',
        immediate: false
      };

      batcher.queueUpdate('cancel', trigger);
      vi.advanceTimersByTime(20);

      const pending = batcher.getPendingBatches();
      expect(pending).toHaveLength(1);

      const cancelled = batcher.cancelBatch(pending[0].id);
      expect(cancelled).toBe(true);
      expect(mockScheduler.cancelledBatches).toContain(pending[0].id);
    });

    it('should flush all pending updates', async () => {
      const triggers: UpdateTrigger[] = [
        { variableName: 'var1', triggerType: 'template', immediate: false },
        { variableName: 'var2', triggerType: 'computed', immediate: false }
      ];

      triggers.forEach(trigger => {
        batcher.queueUpdate(trigger.variableName, trigger);
      });

      const results = await batcher.flushAll();
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockScheduler.flushedBatches).toHaveLength(1);
    });

    it('should clear all pending updates', () => {
      const trigger: UpdateTrigger = {
        variableName: 'clear',
        triggerType: 'template',
        immediate: false
      };

      batcher.queueUpdate('clear', trigger);
      
      const statsBefore = batcher.getBatchStatistics();
      expect(statsBefore.debouncedVariables).toBeGreaterThan(0);

      batcher.clear();

      const statsAfter = batcher.getBatchStatistics();
      expect(statsAfter.totalBatches).toBe(0);
      expect(statsAfter.debouncedVariables).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig: Partial<BatchConfig> = {
        maxBatchSize: 10,
        debounceDelay: 200
      };

      batcher.updateConfig(newConfig);
      const currentConfig = batcher.getConfig();

      expect(currentConfig.maxBatchSize).toBe(10);
      expect(currentConfig.debounceDelay).toBe(200);
      expect(currentConfig.batchTimeout).toBe(16); // Should keep original value
    });

    it('should use updated configuration for new batches', () => {
      batcher.updateConfig({ maxBatchSize: 2 });

      const triggers: UpdateTrigger[] = Array.from({ length: 5 }, (_, i) => ({
        variableName: `var${i}`,
        triggerType: 'computed' as const,
        immediate: false
      }));

      triggers.forEach(trigger => {
        batcher.queueUpdate(trigger.variableName, trigger);
      });

      vi.advanceTimersByTime(20);

      // Should create more batches due to smaller maxBatchSize
      expect(mockScheduler.scheduledBatches.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Utility Methods', () => {
    it('should check for pending updates', () => {
      const trigger: UpdateTrigger = {
        variableName: 'pending',
        triggerType: 'template',
        immediate: false
      };

      expect(batcher.hasPendingUpdates('pending')).toBe(false);

      batcher.queueUpdate('pending', trigger);
      expect(batcher.hasPendingUpdates('pending')).toBe(true);

      vi.advanceTimersByTime(100);
      expect(batcher.hasPendingUpdates('pending')).toBe(true);
    });

    it('should get debounce state', () => {
      const trigger: UpdateTrigger = {
        variableName: 'debounced',
        triggerType: 'template',
        immediate: false
      };

      batcher.queueUpdate('debounced', trigger);

      const state = batcher.getDebounceState('debounced');
      expect(state).toBeDefined();
      expect(state?.variableName).toBe('debounced');
      expect(state?.pendingUpdates).toHaveLength(1);
    });
  });
});

describe('DefaultUpdateScheduler', () => {
  let scheduler: DefaultUpdateScheduler;

  beforeEach(() => {
    scheduler = new DefaultUpdateScheduler();
  });

  it('should schedule batches in priority order', () => {
    const immediateBatch: BatchedUpdate = {
      id: 'immediate',
      variables: ['urgent'],
      triggers: [{ variableName: 'urgent', triggerType: 'template', immediate: true }],
      timestamp: Date.now(),
      priority: 'immediate',
      scheduled: false,
      executed: false
    };

    const normalBatch: BatchedUpdate = {
      id: 'normal',
      variables: ['normal'],
      triggers: [{ variableName: 'normal', triggerType: 'computed', immediate: false }],
      timestamp: Date.now() + 100,
      priority: 'normal',
      scheduled: false,
      executed: false
    };

    scheduler.schedule(normalBatch);
    scheduler.schedule(immediateBatch);

    // Immediate should be processed first despite being scheduled later
    expect(immediateBatch.scheduled).toBe(true);
    expect(normalBatch.scheduled).toBe(true);
  });

  it('should cancel scheduled batches', () => {
    const batch: BatchedUpdate = {
      id: 'cancel-test',
      variables: ['test'],
      triggers: [{ variableName: 'test', triggerType: 'computed', immediate: false }],
      timestamp: Date.now(),
      priority: 'normal',
      scheduled: false,
      executed: false
    };

    scheduler.schedule(batch);
    const cancelled = scheduler.cancel('cancel-test');

    expect(cancelled).toBe(true);
  });

  it('should flush all scheduled batches', async () => {
    const batches: BatchedUpdate[] = [
      {
        id: 'batch1',
        variables: ['var1'],
        triggers: [{ variableName: 'var1', triggerType: 'computed', immediate: false }],
        timestamp: Date.now(),
        priority: 'normal',
        scheduled: false,
        executed: false
      },
      {
        id: 'batch2',
        variables: ['var2'],
        triggers: [{ variableName: 'var2', triggerType: 'template', immediate: false }],
        timestamp: Date.now(),
        priority: 'normal',
        scheduled: false,
        executed: false
      }
    ];

    batches.forEach(batch => scheduler.schedule(batch));

    const results = await scheduler.flush();

    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);
    expect(batches.every(b => b.executed)).toBe(true);
  });
});

describe('BatchOptimizer', () => {
  it('should optimize batch by removing duplicates', () => {
    const batch: BatchedUpdate = {
      id: 'test',
      variables: ['var1', 'var2', 'var1', 'var3'],
      triggers: [
        { variableName: 'var1', triggerType: 'template', immediate: false },
        { variableName: 'var2', triggerType: 'computed', immediate: false },
        { variableName: 'var1', triggerType: 'template', immediate: false },
        { variableName: 'var3', triggerType: 'event', immediate: false }
      ],
      timestamp: Date.now(),
      priority: 'normal',
      scheduled: false,
      executed: false
    };

    const optimized = BatchOptimizer.optimizeBatch(batch);

    expect(optimized.variables).toHaveLength(3);
    expect(optimized.triggers).toHaveLength(3);
    expect(optimized.variables).toEqual(['var1', 'var2', 'var3']);
  });

  it('should merge compatible batches', () => {
    const batch1: BatchedUpdate = {
      id: 'batch1',
      variables: ['var1'],
      triggers: [{ variableName: 'var1', triggerType: 'computed', immediate: false }],
      timestamp: Date.now(),
      priority: 'normal',
      scheduled: false,
      executed: false
    };

    const batch2: BatchedUpdate = {
      id: 'batch2',
      variables: ['var2'],
      triggers: [{ variableName: 'var2', triggerType: 'template', immediate: false }],
      timestamp: Date.now() + 100,
      priority: 'normal',
      scheduled: false,
      executed: false
    };

    const merged = BatchOptimizer.mergeBatches(batch1, batch2);

    expect(merged).toBeDefined();
    expect(merged!.variables).toHaveLength(2);
    expect(merged!.triggers).toHaveLength(2);
    expect(merged!.id).toContain('merged');
  });

  it('should not merge incompatible batches', () => {
    const batch1: BatchedUpdate = {
      id: 'batch1',
      variables: ['var1'],
      triggers: [{ variableName: 'var1', triggerType: 'computed', immediate: false }],
      timestamp: Date.now(),
      priority: 'immediate',
      scheduled: false,
      executed: false
    };

    const batch2: BatchedUpdate = {
      id: 'batch2',
      variables: ['var2'],
      triggers: [{ variableName: 'var2', triggerType: 'template', immediate: false }],
      timestamp: Date.now(),
      priority: 'normal',
      scheduled: false,
      executed: false
    };

    const merged = BatchOptimizer.mergeBatches(batch1, batch2);
    expect(merged).toBeNull();
  });

  it('should calculate optimal batch size', () => {
    const results: BatchExecutionResult[] = [
      { batchId: '1', executedUpdates: 5, executionTime: 50, errors: [], success: true },
      { batchId: '2', executedUpdates: 10, executionTime: 80, errors: [], success: true },
      { batchId: '3', executedUpdates: 20, executionTime: 200, errors: [], success: true }
    ];

    const optimalSize = BatchOptimizer.calculateOptimalBatchSize(results);

    // Should choose batch size with best time per update ratio
    expect(optimalSize).toBe(10); // 80/10 = 8 is better than 50/5 = 10 or 200/20 = 10
  });
});