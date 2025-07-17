/**
 * Svelte Runtime Adapter for Metamon
 */
import { writable } from 'svelte/store';
import { onMount, onDestroy } from 'svelte';
import { MetamonRuntime } from '../metamon-runtime.js';
/**
 * Svelte function for using Metamon signals with Svelte stores
 */
export function useSignal(key, initialValue) {
    const metamonSignal = MetamonRuntime.createSignal(key, initialValue);
    const store = writable(metamonSignal.value);
    let unsubscribe = null;
    onMount(() => {
        // Sync Metamon signal changes to Svelte store
        unsubscribe = metamonSignal.subscribe((newValue) => {
            store.set(newValue);
        });
    });
    onDestroy(() => {
        if (unsubscribe) {
            unsubscribe();
        }
    });
    // Return signal interface with Svelte store integration
    return {
        get value() {
            let currentValue;
            store.subscribe(value => currentValue = value)();
            return currentValue;
        },
        update: (newValue) => {
            metamonSignal.update(newValue);
        },
        subscribe: (callback) => {
            return metamonSignal.subscribe(callback);
        }
    };
}
/**
 * Svelte function for using Metamon pub/sub
 */
export function usePubSub() {
    const pubsub = MetamonRuntime.getPubSub();
    return {
        emit: (event, data) => {
            pubsub.emit(event, data);
        },
        subscribe: (event, callback) => {
            return pubsub.subscribe(event, callback);
        }
    };
}
/**
 * Template function for Svelte (converts to Svelte template)
 */
export function template(templateString) {
    // This would be processed by the compiler
    // For runtime, we'll return a placeholder
    return templateString;
}
