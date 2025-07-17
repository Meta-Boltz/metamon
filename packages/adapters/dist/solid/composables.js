import { createSignal, createEffect, onCleanup } from 'solid-js';
import { signalManager, pubSubSystem } from '@metamon/core';
/**
 * Solid function for using Metamon signals with native Solid reactivity
 */
export function useSignal(initialValue, key) {
    const [value, setValue] = createSignal(initialValue);
    let signal = null;
    // Initialize signal on component creation
    if (key) {
        signal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
    }
    else {
        signal = signalManager.createSignal(initialValue);
    }
    // Sync initial value
    setValue(() => signal.value);
    // Subscribe to signal changes
    const unsubscribe = signal.subscribe((newValue) => {
        setValue(() => newValue);
    });
    // Cleanup on component disposal
    onCleanup(() => {
        unsubscribe();
        if (!key) {
            // Only destroy unnamed signals
            signal.destroy?.();
        }
    });
    const updateSignal = (newValue) => {
        if (signal) {
            signal.update(newValue);
        }
    };
    return [value, updateSignal];
}
/**
 * Solid function for using named Metamon signals
 */
export function useMetamonSignal(key, initialValue) {
    return useSignal(initialValue, key);
}
/**
 * Create a Solid signal that syncs with a Metamon signal for optimal performance
 */
export function createMetamonSignal(initialValue, key) {
    let metamonSignal;
    if (key) {
        metamonSignal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
    }
    else {
        metamonSignal = signalManager.createSignal(initialValue);
    }
    // Create native Solid signal
    const [value, setValue] = createSignal(metamonSignal.value);
    // Sync Metamon signal changes to Solid signal
    const unsubscribe = metamonSignal.subscribe((newValue) => {
        setValue(() => newValue);
    });
    // Cleanup
    onCleanup(() => {
        unsubscribe();
        if (!key) {
            metamonSignal.destroy?.();
        }
    });
    // Return Solid-style accessor and setter that updates both signals
    const setSignal = (newValue) => {
        const resolvedValue = typeof newValue === 'function' ? newValue(value()) : newValue;
        metamonSignal.update(resolvedValue);
        setValue(() => resolvedValue);
    };
    return [value, setSignal];
}
/**
 * Subscribe to pub/sub events in Solid components
 */
export function usePubSub(eventName, callback) {
    createEffect(() => {
        const componentId = Math.random().toString(36).substr(2, 9);
        pubSubSystem.subscribe(eventName, callback, componentId);
        onCleanup(() => {
            pubSubSystem.cleanup(componentId);
        });
    });
}
/**
 * Create an event emitter function for pub/sub
 */
export function useEmitter(eventName) {
    return (payload) => {
        pubSubSystem.emit(eventName, payload);
    };
}
/**
 * Hook for managing multiple pub/sub subscriptions
 */
export function usePubSubChannels(channels) {
    createEffect(() => {
        const componentId = Math.random().toString(36).substr(2, 9);
        channels.forEach(({ event, callback }) => {
            pubSubSystem.subscribe(event, callback, componentId);
        });
        onCleanup(() => {
            pubSubSystem.cleanup(componentId);
        });
    });
}
