import type { Signal, SignalManager } from '../types/signals.js';
import { MetamonSignal } from './signal.js';

/**
 * Global signal manager for cross-framework state management
 */
export class MetamonSignalManager implements SignalManager {
  private _signals: Map<string, Signal<any>> = new Map();
  private _batchedUpdates: Set<() => void> = new Set();
  private _isBatching = false;
  private _batchTimeout: NodeJS.Timeout | null = null;

  /**
   * Create a new signal with optional global key
   * @param initialValue Initial value for the signal
   * @param key Optional global key for the signal
   * @returns New signal instance
   */
  createSignal<T>(initialValue: T, key?: string): Signal<T> {
    const signal = new MetamonSignal(initialValue);
    
    if (key) {
      // If key already exists, return existing signal
      if (this._signals.has(key)) {
        console.warn(`Signal with key "${key}" already exists. Returning existing signal.`);
        return this._signals.get(key) as Signal<T>;
      }
      
      this._signals.set(key, signal);
    }
    
    return signal;
  }

  /**
   * Get an existing signal by key
   * @param key Signal key
   * @returns Signal instance or undefined if not found
   */
  getSignal<T>(key: string): Signal<T> | undefined {
    return this._signals.get(key) as Signal<T> | undefined;
  }

  /**
   * Destroy a signal and clean up its resources
   * @param key Signal key to destroy
   */
  destroySignal(key: string): void {
    const signal = this._signals.get(key);
    if (signal && signal instanceof MetamonSignal) {
      signal.cleanup();
    }
    this._signals.delete(key);
  }

  /**
   * Get all registered signal keys
   */
  getSignalKeys(): string[] {
    return Array.from(this._signals.keys());
  }

  /**
   * Get the number of registered signals
   */
  get signalCount(): number {
    return this._signals.size;
  }

  /**
   * Batch multiple signal updates for performance
   * @param updateFn Function containing signal updates
   */
  batch(updateFn: () => void): void {
    if (this._isBatching) {
      // If already batching, just execute the function
      updateFn();
      return;
    }

    this._isBatching = true;
    
    try {
      updateFn();
      this._flushBatchedUpdates();
    } finally {
      this._isBatching = false;
    }
  }

  /**
   * Schedule a batched update
   * @param updateFn Update function to batch
   */
  private _scheduleBatchedUpdate(updateFn: () => void): void {
    this._batchedUpdates.add(updateFn);
    
    if (this._batchTimeout) {
      return;
    }

    // Use microtask for immediate batching, fallback to setTimeout
    if (typeof queueMicrotask !== 'undefined') {
      this._batchTimeout = setTimeout(() => {
        this._flushBatchedUpdates();
      }, 0);
    } else {
      this._batchTimeout = setTimeout(() => {
        this._flushBatchedUpdates();
      }, 0);
    }
  }

  /**
   * Flush all batched updates
   */
  private _flushBatchedUpdates(): void {
    if (this._batchTimeout) {
      clearTimeout(this._batchTimeout);
      this._batchTimeout = null;
    }

    if (this._batchedUpdates.size === 0) {
      return;
    }

    const updates = Array.from(this._batchedUpdates);
    this._batchedUpdates.clear();

    for (const update of updates) {
      try {
        update();
      } catch (error) {
        console.error('Error in batched signal update:', error);
      }
    }
  }

  /**
   * Clean up all signals and resources
   */
  cleanup(): void {
    // Clear any pending batched updates
    if (this._batchTimeout) {
      clearTimeout(this._batchTimeout);
      this._batchTimeout = null;
    }
    this._batchedUpdates.clear();

    // Clean up all signals
    for (const [key, signal] of this._signals) {
      if (signal instanceof MetamonSignal) {
        signal.cleanup();
      }
    }
    
    this._signals.clear();
  }

  /**
   * Create a computed signal that derives its value from other signals
   * @param computeFn Function that computes the derived value
   * @param dependencies Array of signals this computed signal depends on
   * @param key Optional global key for the computed signal
   */
  createComputed<T>(
    computeFn: () => T,
    dependencies: Signal<any>[],
    key?: string
  ): Signal<T> {
    const computed = this.createSignal(computeFn(), key);
    
    // Subscribe to all dependencies
    const unsubscribers = dependencies.map(dep => 
      dep.subscribe(() => {
        try {
          computed.update(computeFn());
        } catch (error) {
          console.error('Error in computed signal:', error);
        }
      })
    );

    // Store unsubscribers for cleanup
    if (computed instanceof MetamonSignal) {
      const originalCleanup = computed.cleanup.bind(computed);
      computed.cleanup = () => {
        unsubscribers.forEach(unsub => unsub());
        originalCleanup();
      };
    }

    return computed;
  }
}

// Global singleton instance
export const signalManager = new MetamonSignalManager();