import { Accessor } from 'solid-js';
/**
 * Solid function for using Metamon signals with native Solid reactivity
 */
export declare function useSignal<T>(initialValue: T, key?: string): [Accessor<T>, (value: T) => void];
/**
 * Solid function for using named Metamon signals
 */
export declare function useMetamonSignal<T>(key: string, initialValue: T): [Accessor<T>, (value: T) => void];
/**
 * Create a Solid signal that syncs with a Metamon signal for optimal performance
 */
export declare function createMetamonSignal<T>(initialValue: T, key?: string): [Accessor<T>, (newValue: T | ((prev: T) => T)) => void];
/**
 * Subscribe to pub/sub events in Solid components
 */
export declare function usePubSub(eventName: string, callback: (payload: any) => void): void;
/**
 * Create an event emitter function for pub/sub
 */
export declare function useEmitter(eventName: string): (payload: any) => void;
/**
 * Hook for managing multiple pub/sub subscriptions
 */
export declare function usePubSubChannels(channels: Array<{
    event: string;
    callback: (payload: any) => void;
}>): void;
