/**
 * Vue Runtime Adapter for Metamon
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { MetamonRuntime } from '../metamon-runtime.js';
/**
 * Vue composable for using Metamon signals
 */
export function useSignal(key, initialValue) {
    const signal = MetamonRuntime.createSignal(key, initialValue);
    const value = ref(signal.value);
    let unsubscribe = null;
    onMounted(() => {
        // Subscribe to signal changes
        unsubscribe = signal.subscribe((newValue) => {
            value.value = newValue;
        });
    });
    onUnmounted(() => {
        if (unsubscribe) {
            unsubscribe();
        }
    });
    // Return signal interface with Vue reactivity
    return {
        get value() {
            return value.value;
        },
        update: (newValue) => {
            signal.update(newValue);
        },
        subscribe: (callback) => {
            return signal.subscribe(callback);
        }
    };
}
/**
 * Vue composable for using Metamon pub/sub
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
 * Template function for Vue (converts to Vue template)
 */
export function template(templateString) {
    // This would be processed by the compiler
    // For runtime, we'll return a placeholder
    return templateString;
}
