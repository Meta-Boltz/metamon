import type { Signal, SignalCallback } from '../types/signals.js';

/**
 * Core Signal implementation for reactive state management
 */
export class MetamonSignal<T> implements Signal<T> {
  private _value: T;
  private _subscribers: Set<SignalCallback<T>> = new Set();
  private _isUpdating = false;

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this.update(newValue);
  }

  /**
   * Subscribe to signal changes
   * @param callback Function to call when signal value changes
   * @returns Unsubscribe function
   */
  subscribe(callback: SignalCallback<T>): () => void {
    this._subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this._subscribers.delete(callback);
    };
  }

  /**
   * Update the signal value and notify subscribers
   * @param newValue New value to set
   */
  update(newValue: T): void {
    // Prevent recursive updates
    if (this._isUpdating) {
      return;
    }

    // Only update if value actually changed
    if (this._value === newValue) {
      return;
    }

    this._value = newValue;
    this._notifySubscribers();
  }

  /**
   * Notify all subscribers of value change
   */
  private _notifySubscribers(): void {
    if (this._subscribers.size === 0) {
      return;
    }

    this._isUpdating = true;
    
    try {
      // Create a copy of subscribers to avoid issues if callbacks modify the set
      const subscribers = Array.from(this._subscribers);
      
      for (const callback of subscribers) {
        try {
          callback(this._value);
        } catch (error) {
          console.error('Error in signal subscriber:', error);
        }
      }
    } finally {
      this._isUpdating = false;
    }
  }

  /**
   * Get the number of active subscribers
   */
  get subscriberCount(): number {
    return this._subscribers.size;
  }

  /**
   * Clear all subscribers
   */
  cleanup(): void {
    this._subscribers.clear();
  }
}