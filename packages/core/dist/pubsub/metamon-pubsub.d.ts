import type { PubSubSystem, EventSubscription } from '../types/pubsub.js';
/**
 * MetamonPubSub - Unified pub/sub event system for cross-framework communication
 *
 * Features:
 * - Component-based subscription tracking for automatic cleanup
 * - Event batching and delivery optimization
 * - Memory-efficient listener management
 */
export declare class MetamonPubSub implements PubSubSystem {
    private listeners;
    private componentListeners;
    private batchedEvents;
    private batchTimeout;
    private readonly BATCH_DELAY;
    /**
     * Subscribe to an event with automatic component-based cleanup tracking
     */
    subscribe(event: string, callback: Function, componentId: string): void;
    /**
     * Unsubscribe a specific component from an event
     */
    unsubscribe(event: string, componentId: string): void;
    /**
     * Emit an event to all subscribers with batching optimization
     */
    emit(event: string, payload: any): void;
    /**
     * Clean up all subscriptions for a component (called when component unmounts)
     */
    cleanup(componentId: string): void;
    /**
     * Process batched events for optimized delivery
     */
    private processBatchedEvents;
    /**
     * Get all active subscriptions (useful for debugging)
     */
    getActiveSubscriptions(): EventSubscription[];
    /**
     * Get subscription count for an event (useful for debugging)
     */
    getSubscriptionCount(event: string): number;
    /**
     * Get all events a component is subscribed to (useful for debugging)
     */
    getComponentEvents(componentId: string): string[];
    /**
     * Clear all subscriptions (useful for testing)
     */
    clear(): void;
}
