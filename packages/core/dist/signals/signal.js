/**
 * Core Signal implementation for reactive state management
 */
export class MetamonSignal {
    constructor(initialValue) {
        this._subscribers = new Set();
        this._isUpdating = false;
        this._value = initialValue;
    }
    get value() {
        return this._value;
    }
    set value(newValue) {
        this.update(newValue);
    }
    /**
     * Subscribe to signal changes
     * @param callback Function to call when signal value changes
     * @returns Unsubscribe function
     */
    subscribe(callback) {
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
    update(newValue) {
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
    _notifySubscribers() {
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
                }
                catch (error) {
                    console.error('Error in signal subscriber:', error);
                }
            }
        }
        finally {
            this._isUpdating = false;
        }
    }
    /**
     * Get the number of active subscribers
     */
    get subscriberCount() {
        return this._subscribers.size;
    }
    /**
     * Clear all subscribers
     */
    cleanup() {
        this._subscribers.clear();
    }
}
