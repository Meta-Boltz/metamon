import type { Signal, SignalCallback } from '../types/signals.js';
/**
 * Core Signal implementation for reactive state management
 */
export declare class MetamonSignal<T> implements Signal<T> {
    private _value;
    private _subscribers;
    private _isUpdating;
    constructor(initialValue: T);
    get value(): T;
    set value(newValue: T);
    /**
     * Subscribe to signal changes
     * @param callback Function to call when signal value changes
     * @returns Unsubscribe function
     */
    subscribe(callback: SignalCallback<T>): () => void;
    /**
     * Update the signal value and notify subscribers
     * @param newValue New value to set
     */
    update(newValue: T): void;
    /**
     * Notify all subscribers of value change
     */
    private _notifySubscribers;
    /**
     * Get the number of active subscribers
     */
    get subscriberCount(): number;
    /**
     * Clear all subscribers
     */
    cleanup(): void;
}
