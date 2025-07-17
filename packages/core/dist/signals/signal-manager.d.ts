import type { Signal, SignalManager } from '../types/signals.js';
/**
 * Global signal manager for cross-framework state management
 */
export declare class MetamonSignalManager implements SignalManager {
    private _signals;
    private _batchedUpdates;
    private _isBatching;
    private _batchTimeout;
    /**
     * Create a new signal with optional global key
     * @param initialValue Initial value for the signal
     * @param key Optional global key for the signal
     * @returns New signal instance
     */
    createSignal<T>(initialValue: T, key?: string): Signal<T>;
    /**
     * Get an existing signal by key
     * @param key Signal key
     * @returns Signal instance or undefined if not found
     */
    getSignal<T>(key: string): Signal<T> | undefined;
    /**
     * Destroy a signal and clean up its resources
     * @param key Signal key to destroy
     */
    destroySignal(key: string): void;
    /**
     * Get all registered signal keys
     */
    getSignalKeys(): string[];
    /**
     * Get the number of registered signals
     */
    get signalCount(): number;
    /**
     * Batch multiple signal updates for performance
     * @param updateFn Function containing signal updates
     */
    batch(updateFn: () => void): void;
    /**
     * Schedule a batched update
     * @param updateFn Update function to batch
     */
    private _scheduleBatchedUpdate;
    /**
     * Flush all batched updates
     */
    private _flushBatchedUpdates;
    /**
     * Clean up all signals and resources
     */
    cleanup(): void;
    /**
     * Create a computed signal that derives its value from other signals
     * @param computeFn Function that computes the derived value
     * @param dependencies Array of signals this computed signal depends on
     * @param key Optional global key for the computed signal
     */
    createComputed<T>(computeFn: () => T, dependencies: Signal<any>[], key?: string): Signal<T>;
}
export declare const signalManager: MetamonSignalManager;
