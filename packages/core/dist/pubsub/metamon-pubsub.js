/**
 * MetamonPubSub - Unified pub/sub event system for cross-framework communication
 *
 * Features:
 * - Component-based subscription tracking for automatic cleanup
 * - Event batching and delivery optimization
 * - Memory-efficient listener management
 */
export class MetamonPubSub {
    constructor() {
        this.listeners = new Map();
        this.componentListeners = new Map();
        this.batchedEvents = [];
        this.batchTimeout = null;
        this.BATCH_DELAY = 0; // Process in next tick for optimal performance
    }
    /**
     * Subscribe to an event with automatic component-based cleanup tracking
     */
    subscribe(event, callback, componentId) {
        if (!event || typeof callback !== 'function' || !componentId) {
            throw new Error('Invalid subscription parameters: event, callback, and componentId are required');
        }
        // Initialize event listeners set if it doesn't exist
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        // Initialize component listeners set if it doesn't exist
        if (!this.componentListeners.has(componentId)) {
            this.componentListeners.set(componentId, new Set());
        }
        const listener = { callback, componentId };
        // Add listener to event
        this.listeners.get(event).add(listener);
        // Track this event for the component
        this.componentListeners.get(componentId).add(event);
    }
    /**
     * Unsubscribe a specific component from an event
     */
    unsubscribe(event, componentId) {
        if (!event || !componentId) {
            return;
        }
        const eventListeners = this.listeners.get(event);
        if (!eventListeners) {
            return;
        }
        // Remove all listeners for this component from this event
        for (const listener of eventListeners) {
            if (listener.componentId === componentId) {
                eventListeners.delete(listener);
            }
        }
        // Clean up empty event listener sets
        if (eventListeners.size === 0) {
            this.listeners.delete(event);
        }
        // Remove event from component tracking
        const componentEvents = this.componentListeners.get(componentId);
        if (componentEvents) {
            componentEvents.delete(event);
            // Clean up empty component listener sets
            if (componentEvents.size === 0) {
                this.componentListeners.delete(componentId);
            }
        }
    }
    /**
     * Emit an event to all subscribers with batching optimization
     */
    emit(event, payload) {
        if (!event) {
            return;
        }
        // Add to batch for optimized delivery
        this.batchedEvents.push({ event, payload });
        // Schedule batch processing if not already scheduled
        if (this.batchTimeout === null) {
            this.batchTimeout = setTimeout(() => {
                this.processBatchedEvents();
            }, this.BATCH_DELAY);
        }
    }
    /**
     * Clean up all subscriptions for a component (called when component unmounts)
     */
    cleanup(componentId) {
        if (!componentId) {
            return;
        }
        const componentEvents = this.componentListeners.get(componentId);
        if (!componentEvents) {
            return;
        }
        // Unsubscribe from all events for this component
        for (const event of componentEvents) {
            this.unsubscribe(event, componentId);
        }
    }
    /**
     * Process batched events for optimized delivery
     */
    processBatchedEvents() {
        const eventsToProcess = [...this.batchedEvents];
        this.batchedEvents = [];
        this.batchTimeout = null;
        // Group events by event name for efficient processing
        const eventGroups = new Map();
        for (const { event, payload } of eventsToProcess) {
            if (!eventGroups.has(event)) {
                eventGroups.set(event, []);
            }
            eventGroups.get(event).push(payload);
        }
        // Deliver events to listeners
        for (const [event, payloads] of eventGroups) {
            const eventListeners = this.listeners.get(event);
            if (!eventListeners || eventListeners.size === 0) {
                continue;
            }
            // Deliver each payload to all listeners
            for (const payload of payloads) {
                // Create array from Set to avoid modification during iteration
                const listenersArray = Array.from(eventListeners);
                for (const listener of listenersArray) {
                    try {
                        listener.callback(payload);
                    }
                    catch (error) {
                        console.error(`Error in event listener for event "${event}":`, error);
                        // Continue processing other listeners even if one fails
                    }
                }
            }
        }
    }
    /**
     * Get all active subscriptions (useful for debugging)
     */
    getActiveSubscriptions() {
        const subscriptions = [];
        for (const [event, listeners] of this.listeners) {
            for (const listener of listeners) {
                subscriptions.push({
                    event,
                    componentId: listener.componentId,
                    callback: listener.callback
                });
            }
        }
        return subscriptions;
    }
    /**
     * Get subscription count for an event (useful for debugging)
     */
    getSubscriptionCount(event) {
        const listeners = this.listeners.get(event);
        return listeners ? listeners.size : 0;
    }
    /**
     * Get all events a component is subscribed to (useful for debugging)
     */
    getComponentEvents(componentId) {
        const events = this.componentListeners.get(componentId);
        return events ? Array.from(events) : [];
    }
    /**
     * Clear all subscriptions (useful for testing)
     */
    clear() {
        this.listeners.clear();
        this.componentListeners.clear();
        this.batchedEvents = [];
        if (this.batchTimeout !== null) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
    }
}
