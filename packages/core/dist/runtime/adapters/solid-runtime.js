/**
 * Solid Runtime Adapter for Metamon
 */
import { createSignal, onCleanup } from 'solid-js';
import { MetamonRuntime } from '../metamon-runtime.js';
/**
 * Solid function for using Metamon signals with native Solid reactivity
 */
export function useSignal(key, initialValue) {
    const metamonSignal = MetamonRuntime.createSignal(key, initialValue);
    const [value, setValue] = createSignal(metamonSignal.value);
    // Sync Metamon signal changes to Solid signal
    const unsubscribe = metamonSignal.subscribe((newValue) => {
        setValue(() => newValue);
    });
    // Cleanup on component disposal
    onCleanup(() => {
        unsubscribe();
    });
    // Return signal interface with Solid-style accessor
    return {
        get value() {
            return value();
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
 * Solid function for using Metamon pub/sub
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
 * Template function for Solid (converts to JSX)
 */
export function template(templateString) {
    // This would be processed by the compiler
    // For runtime, we'll return a placeholder
    return templateString;
}
