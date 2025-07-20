/**
 * Reactive update batching system for MTM modern syntax
 * Implements performance optimization through batched and debounced updates
 */

import type { ReactiveVariableNode, UpdateTrigger } from './reactive-analyzer.js';

/**
 * Update batch configuration
 */
export interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number;
  debounceDelay: number;
  priority: 'immediate' | 'normal' | 'low';
}

/**
 * Batched update representation
 */
export interface BatchedUpdate {
  id: string;
  variables: string[];
  triggers: UpdateTrigger[];
  timestamp: number;
  priority: 'immediate' | 'normal' | 'low';
  scheduled: boolean;
  executed: boolean;
}

/**
 * Update queue entry
 */
export interface UpdateQueueEntry {
  variableName: string;
  trigger: UpdateTrigger;
  timestamp: number;
  priority: 'immediate' | 'normal' | 'low';
}

/**
 * Debounce state for variables
 */
interface DebounceState {
  variableName: string;
  timeoutId: NodeJS.Timeout | null;
  pendingUpdates: UpdateQueueEntry[];
  lastUpdateTime: number;
}

/**
 * Batch execution result
 */
export interface BatchExecutionResult {
  batchId: string;
  executedUpdates: number;
  executionTime: number;
  errors: Error[];
  success: boolean;
}

/**
 * Update scheduler interface
 */
export interface UpdateScheduler {
  schedule(batch: BatchedUpdate): void;
  cancel(batchId: string): boolean;
  flush(): Promise<BatchExecutionResult[]>;
}

/**
 * Default batch configuration
 */
const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxBatchSize: 50,
  batchTimeout: 16, // ~60fps
  debounceDelay: 100,
  priority: 'normal'
};

/**
 * Reactive update batcher implementation
 */
export class ReactiveUpdateBatcher {
  private config: BatchConfig;
  private updateQueue: UpdateQueueEntry[];
  private debounceStates: Map<string, DebounceState>;
  private scheduledBatches: Map<string, BatchedUpdate>;
  private batchCounter: number;
  private scheduler: UpdateScheduler;
  private pendingBatch: BatchedUpdate | null;
  private batchTimeout: NodeJS.Timeout | null;

  constructor(config: Partial<BatchConfig> = {}, scheduler?: UpdateScheduler) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
    this.updateQueue = [];
    this.debounceStates = new Map();
    this.scheduledBatches = new Map();
    this.batchCounter = 0;
    this.scheduler = scheduler || new DefaultUpdateScheduler();
    this.pendingBatch = null;
    this.batchTimeout = null;
  }

  /**
   * Queue an update for batching
   */
  queueUpdate(variableName: string, trigger: UpdateTrigger): void {
    const entry: UpdateQueueEntry = {
      variableName,
      trigger,
      timestamp: Date.now(),
      priority: trigger.immediate ? 'immediate' : this.config.priority
    };

    // Handle immediate updates
    if (trigger.immediate) {
      this.processImmediateUpdate(entry);
      return;
    }

    // Add to queue
    this.updateQueue.push(entry);

    // Handle debouncing
    if (this.shouldDebounce(variableName, trigger)) {
      this.debounceUpdate(entry);
    } else {
      this.processBatchedUpdate(entry);
    }
  }

  /**
   * Process immediate update without batching
   */
  private processImmediateUpdate(entry: UpdateQueueEntry): void {
    const batch: BatchedUpdate = {
      id: this.generateBatchId(),
      variables: [entry.variableName],
      triggers: [entry.trigger],
      timestamp: entry.timestamp,
      priority: 'immediate',
      scheduled: false,
      executed: false
    };

    this.scheduledBatches.set(batch.id, batch);
    this.scheduler.schedule(batch);
  }

  /**
   * Check if update should be debounced
   */
  private shouldDebounce(variableName: string, trigger: UpdateTrigger): boolean {
    // Only debounce template updates that are not immediate
    return trigger.triggerType === 'template' && !trigger.immediate;
  }

  /**
   * Debounce an update
   */
  private debounceUpdate(entry: UpdateQueueEntry): void {
    const state = this.debounceStates.get(entry.variableName);

    if (state) {
      // Clear existing timeout
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      
      // Add to pending updates
      state.pendingUpdates.push(entry);
    } else {
      // Create new debounce state
      this.debounceStates.set(entry.variableName, {
        variableName: entry.variableName,
        timeoutId: null,
        pendingUpdates: [entry],
        lastUpdateTime: entry.timestamp
      });
    }

    // Set new timeout
    const debounceState = this.debounceStates.get(entry.variableName)!;
    debounceState.timeoutId = setTimeout(() => {
      this.flushDebouncedUpdates(entry.variableName);
    }, this.config.debounceDelay);
  }

  /**
   * Flush debounced updates for a variable
   */
  private flushDebouncedUpdates(variableName: string): void {
    const state = this.debounceStates.get(variableName);
    if (!state || state.pendingUpdates.length === 0) {
      return;
    }

    // Create batch from pending updates
    const batch = this.createBatchFromUpdates(state.pendingUpdates);
    this.scheduledBatches.set(batch.id, batch);
    this.scheduler.schedule(batch);

    // Clear debounce state
    state.pendingUpdates = [];
    state.timeoutId = null;
    state.lastUpdateTime = Date.now();
  }

  /**
   * Process batched update
   */
  private processBatchedUpdate(entry: UpdateQueueEntry): void {
    // Check if we have a pending batch for this priority
    if (this.pendingBatch && 
        this.pendingBatch.priority === entry.priority &&
        this.pendingBatch.variables.length < this.config.maxBatchSize) {
      // Add to existing pending batch
      this.pendingBatch.variables.push(entry.variableName);
      this.pendingBatch.triggers.push(entry.trigger);
      return;
    }

    // If we have a pending batch but it's full or different priority, schedule it
    if (this.pendingBatch) {
      this.schedulePendingBatch();
    }

    // Create new pending batch
    this.pendingBatch = this.createBatchFromUpdates([entry]);
    this.scheduledBatches.set(this.pendingBatch.id, this.pendingBatch);
    
    // Set timeout to schedule the batch
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = setTimeout(() => {
      this.schedulePendingBatch();
    }, this.config.batchTimeout);
  }

  /**
   * Schedule the pending batch
   */
  private schedulePendingBatch(): void {
    if (this.pendingBatch && !this.pendingBatch.scheduled && !this.pendingBatch.executed) {
      this.scheduler.schedule(this.pendingBatch);
      this.pendingBatch = null;
    }
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Find compatible batch for an update
   */
  private findCompatibleBatch(entry: UpdateQueueEntry): BatchedUpdate | null {
    for (const batch of this.scheduledBatches.values()) {
      if (!batch.scheduled && 
          !batch.executed && 
          batch.priority === entry.priority &&
          batch.variables.length < this.config.maxBatchSize) {
        return batch;
      }
    }
    return null;
  }

  /**
   * Create batch from update entries
   */
  private createBatchFromUpdates(entries: UpdateQueueEntry[]): BatchedUpdate {
    return {
      id: this.generateBatchId(),
      variables: entries.map(e => e.variableName),
      triggers: entries.map(e => e.trigger),
      timestamp: Math.min(...entries.map(e => e.timestamp)),
      priority: entries[0]?.priority || 'normal',
      scheduled: false,
      executed: false
    };
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${++this.batchCounter}_${Date.now()}`;
  }

  /**
   * Get pending batches
   */
  getPendingBatches(): BatchedUpdate[] {
    return Array.from(this.scheduledBatches.values()).filter(b => !b.executed);
  }

  /**
   * Get batch statistics
   */
  getBatchStatistics(): {
    totalBatches: number;
    pendingBatches: number;
    executedBatches: number;
    averageBatchSize: number;
    debouncedVariables: number;
  } {
    const batches = Array.from(this.scheduledBatches.values());
    const executed = batches.filter(b => b.executed);
    const pending = batches.filter(b => !b.executed);
    
    const totalVariables = batches.reduce((sum, b) => sum + b.variables.length, 0);
    const averageBatchSize = batches.length > 0 ? totalVariables / batches.length : 0;

    return {
      totalBatches: batches.length,
      pendingBatches: pending.length,
      executedBatches: executed.length,
      averageBatchSize,
      debouncedVariables: this.debounceStates.size
    };
  }

  /**
   * Flush all pending updates immediately
   */
  async flushAll(): Promise<BatchExecutionResult[]> {
    // Flush debounced updates
    for (const [variableName] of this.debounceStates) {
      this.flushDebouncedUpdates(variableName);
    }

    // Execute all pending batches
    return await this.scheduler.flush();
  }

  /**
   * Clear all pending updates
   */
  clear(): void {
    // Clear debounce timeouts
    for (const state of this.debounceStates.values()) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
    }

    // Clear batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    this.updateQueue = [];
    this.debounceStates.clear();
    this.scheduledBatches.clear();
    this.batchCounter = 0;
    this.pendingBatch = null;
  }

  /**
   * Update batch configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): BatchConfig {
    return { ...this.config };
  }

  /**
   * Cancel a specific batch
   */
  cancelBatch(batchId: string): boolean {
    const batch = this.scheduledBatches.get(batchId);
    if (batch && !batch.executed) {
      this.scheduledBatches.delete(batchId);
      return this.scheduler.cancel(batchId);
    }
    return false;
  }

  /**
   * Get debounce state for a variable
   */
  getDebounceState(variableName: string): DebounceState | undefined {
    return this.debounceStates.get(variableName);
  }

  /**
   * Check if variable has pending updates
   */
  hasPendingUpdates(variableName: string): boolean {
    const debounceState = this.debounceStates.get(variableName);
    if (debounceState && debounceState.pendingUpdates.length > 0) {
      return true;
    }

    return Array.from(this.scheduledBatches.values()).some(batch => 
      !batch.executed && batch.variables.includes(variableName)
    );
  }
}

/**
 * Default update scheduler implementation
 */
export class DefaultUpdateScheduler implements UpdateScheduler {
  private scheduledBatches: Map<string, BatchedUpdate>;
  private executionQueue: BatchedUpdate[];

  constructor() {
    this.scheduledBatches = new Map();
    this.executionQueue = [];
  }

  /**
   * Schedule a batch for execution
   */
  schedule(batch: BatchedUpdate): void {
    batch.scheduled = true;
    this.scheduledBatches.set(batch.id, batch);
    this.executionQueue.push(batch);

    // Sort by priority and timestamp
    this.executionQueue.sort((a, b) => {
      const priorityOrder = { immediate: 0, normal: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    // Execute in next tick for immediate updates
    if (batch.priority === 'immediate') {
      setImmediate(() => this.executeBatch(batch));
    }
  }

  /**
   * Cancel a scheduled batch
   */
  cancel(batchId: string): boolean {
    const batch = this.scheduledBatches.get(batchId);
    if (batch && !batch.executed) {
      this.scheduledBatches.delete(batchId);
      this.executionQueue = this.executionQueue.filter(b => b.id !== batchId);
      return true;
    }
    return false;
  }

  /**
   * Flush all pending batches
   */
  async flush(): Promise<BatchExecutionResult[]> {
    const results: BatchExecutionResult[] = [];
    
    while (this.executionQueue.length > 0) {
      const batch = this.executionQueue.shift()!;
      const result = await this.executeBatch(batch);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single batch
   */
  private async executeBatch(batch: BatchedUpdate): Promise<BatchExecutionResult> {
    const startTime = performance.now();
    const errors: Error[] = [];
    let executedUpdates = 0;

    try {
      batch.executed = true;
      
      // Simulate batch execution (in real implementation, this would trigger DOM updates, etc.)
      for (const trigger of batch.triggers) {
        try {
          await this.executeTrigger(trigger);
          executedUpdates++;
        } catch (error) {
          errors.push(error as Error);
        }
      }
    } catch (error) {
      errors.push(error as Error);
    }

    const executionTime = performance.now() - startTime;

    return {
      batchId: batch.id,
      executedUpdates,
      executionTime,
      errors,
      success: errors.length === 0
    };
  }

  /**
   * Execute a single trigger (placeholder implementation)
   */
  private async executeTrigger(trigger: UpdateTrigger): Promise<void> {
    // In a real implementation, this would:
    // - Update DOM elements for template triggers
    // - Execute event handlers for event triggers
    // - Recompute values for computed triggers
    // - Run side effects for effect triggers
    
    // For now, we'll just simulate the execution
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

/**
 * Utility functions for batch optimization
 */
export class BatchOptimizer {
  /**
   * Optimize batch by removing duplicate updates
   */
  static optimizeBatch(batch: BatchedUpdate): BatchedUpdate {
    const uniqueVariables = [...new Set(batch.variables)];
    const uniqueTriggers = batch.triggers.filter((trigger, index, array) => 
      array.findIndex(t => 
        t.variableName === trigger.variableName && 
        t.triggerType === trigger.triggerType
      ) === index
    );

    return {
      ...batch,
      variables: uniqueVariables,
      triggers: uniqueTriggers
    };
  }

  /**
   * Merge compatible batches
   */
  static mergeBatches(batch1: BatchedUpdate, batch2: BatchedUpdate): BatchedUpdate | null {
    if (batch1.priority !== batch2.priority || 
        batch1.executed || batch2.executed ||
        batch1.scheduled || batch2.scheduled) {
      return null;
    }

    return {
      id: `merged_${batch1.id}_${batch2.id}`,
      variables: [...batch1.variables, ...batch2.variables],
      triggers: [...batch1.triggers, ...batch2.triggers],
      timestamp: Math.min(batch1.timestamp, batch2.timestamp),
      priority: batch1.priority,
      scheduled: false,
      executed: false
    };
  }

  /**
   * Calculate optimal batch size based on performance metrics
   */
  static calculateOptimalBatchSize(
    executionResults: BatchExecutionResult[]
  ): number {
    if (executionResults.length === 0) {
      return DEFAULT_BATCH_CONFIG.maxBatchSize;
    }

    // Find batch size with best performance (lowest execution time per update)
    const performanceMetrics = executionResults.map(result => ({
      batchSize: result.executedUpdates,
      timePerUpdate: result.executedUpdates > 0 ? result.executionTime / result.executedUpdates : 0
    }));

    const optimalMetric = performanceMetrics.reduce((best, current) => 
      current.timePerUpdate < best.timePerUpdate ? current : best
    );

    return Math.max(1, Math.min(100, optimalMetric.batchSize));
  }
}