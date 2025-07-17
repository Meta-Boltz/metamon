import { writable, derived } from 'svelte/store';
import { onMount, onDestroy } from 'svelte';
import { signalManager, pubSubSystem } from '@metamon/core';
/**
 * Svelte composable for using Metamon signals with Svelte stores
 */
export function useSignal(initialValue, key) {
    const store = writable(initialValue);
    let signal = null;
    let unsubscribe = null;
    // Initialize signal and sync with store
    onMount(() => {
        if (key) {
            signal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
        }
        else {
            signal = signalManager.createSignal(initialValue);
        }
        // Sync initial value
        store.set(signal.value);
        // Subscribe to signal changes and update store
        unsubscribe = signal.subscribe((newValue) => {
            store.set(newValue);
        });
    });
    // Cleanup on component destroy
    onDestroy(() => {
        if (unsubscribe) {
            unsubscribe();
        }
        if (!key && signal) {
            // Only destroy unnamed signals
            signal.destroy?.();
        }
    });
    const updateSignal = (newValue) => {
        if (signal) {
            signal.update(newValue);
        }
    };
    return [store, updateSignal];
}
/**
 * Svelte composable for using named Metamon signals
 */
export function useMetamonSignal(key, initialValue) {
    return useSignal(initialValue, key);
}
/**
 * Create a Svelte store that syncs with a Metamon signal
 */
export function createMetamonStore(initialValue, key) {
    let metamonSignal;
    if (key) {
        metamonSignal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
    }
    else {
        metamonSignal = signalManager.createSignal(initialValue);
    }
    // Create Svelte writable store
    const store = writable(metamonSignal.value);
    // Sync Metamon signal changes to Svelte store
    const unsubscribe = metamonSignal.subscribe((newValue) => {
        store.set(newValue);
    });
    // Enhanced store with Metamon integration
    const enhancedStore = {
        subscribe: store.subscribe,
        set: (value) => {
            metamonSignal.update(value);
            store.set(value);
        },
        update: (updater) => {
            const currentValue = metamonSignal.value;
            const newValue = updater(currentValue);
            metamonSignal.update(newValue);
            store.set(newValue);
        },
        destroy: () => {
            unsubscribe();
            if (!key) {
                metamonSignal.destroy?.();
            }
        }
    };
    return enhancedStore;
}
/**
 * Svelte composable for pub/sub event handling
 */
export function usePubSub() {
    let componentId;
    onMount(() => {
        componentId = Math.random().toString(36).substr(2, 9);
    });
    onDestroy(() => {
        if (componentId) {
            pubSubSystem.cleanup(componentId);
        }
    });
    const subscribe = (event, callback) => {
        if (componentId) {
            pubSubSystem.subscribe(event, callback, componentId);
        }
    };
    const emit = (event, payload) => {
        pubSubSystem.emit(event, payload);
    };
    const unsubscribe = (event) => {
        if (componentId) {
            pubSubSystem.unsubscribe(event, componentId);
        }
    };
    return {
        subscribe,
        emit,
        unsubscribe
    };
}
/**
 * Create a derived store from multiple Metamon signals
 */
export function createDerivedSignal(signals, deriveFn, initialValue) {
    const stores = signals.map(key => {
        const signal = signalManager.getSignal(key);
        return signal ? writable(signal.value) : writable(null);
    });
    // Create derived store
    const derivedStore = derived(stores, (values) => {
        return deriveFn(values);
    }, initialValue);
    // Subscribe to signal changes
    const unsubscribes = signals.map((key, index) => {
        const signal = signalManager.getSignal(key);
        if (signal) {
            return signal.subscribe((newValue) => {
                stores[index].set(newValue);
            });
        }
        return () => { };
    });
    // Cleanup
    onDestroy(() => {
        unsubscribes.forEach(unsub => unsub());
    });
    return derivedStore;
}
