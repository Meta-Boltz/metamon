import { ref, onMounted, onUnmounted, computed } from 'vue';
import { signalManager, pubSubSystem } from '@metamon/core';
/**
 * Vue composable for using Metamon signals with automatic cleanup
 */
export function useSignal(initialValue, key) {
    const value = ref(initialValue);
    let signal = null;
    let unsubscribe = null;
    const componentId = Math.random().toString(36).substr(2, 9);
    onMounted(() => {
        if (key) {
            // Use or create named signal
            signal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
        }
        else {
            // Create anonymous signal
            signal = signalManager.createSignal(initialValue);
        }
        value.value = signal.value;
        // Subscribe to signal changes
        unsubscribe = signal.subscribe((newValue) => {
            value.value = newValue;
        });
    });
    onUnmounted(() => {
        if (unsubscribe) {
            unsubscribe();
        }
        // Cleanup is handled by the signal manager
    });
    const updateSignal = (newValue) => {
        if (signal) {
            signal.update(newValue);
        }
    };
    return [value, updateSignal];
}
/**
 * Vue composable for using named Metamon signals
 */
export function useMetamonSignal(key, initialValue) {
    return useSignal(initialValue, key);
}
/**
 * Vue composable for subscribing to pub/sub events
 */
export function usePubSub(eventName, handler) {
    const componentId = Math.random().toString(36).substr(2, 9);
    onMounted(() => {
        pubSubSystem.subscribe(eventName, handler, componentId);
    });
    onUnmounted(() => {
        pubSubSystem.cleanup(componentId);
    });
    const emit = (payload) => {
        pubSubSystem.emit(eventName, payload);
    };
    return emit;
}
/**
 * Vue composable for emitting pub/sub events
 */
export function useEmit(eventName) {
    return (payload) => {
        pubSubSystem.emit(eventName, payload);
    };
}
/**
 * Vue composable for component lifecycle integration with Metamon runtime
 */
export function useMetamonLifecycle(componentName) {
    const componentId = componentName || Math.random().toString(36).substr(2, 9);
    onMounted(() => {
        // Component mounted
        console.log(`Metamon component ${componentId} mounted`);
    });
    onUnmounted(() => {
        // Component unmounting - cleanup all subscriptions
        pubSubSystem.cleanup(componentId);
        console.log(`Metamon component ${componentId} unmounted`);
    });
    return componentId;
}
/**
 * Vue composable for reactive computed values from signals
 */
export function useComputedSignal(signalKey, initialValue, computeFn) {
    const [signalValue] = useMetamonSignal(signalKey, initialValue);
    return computed(() => computeFn(signalValue.value));
}
/**
 * Vue composable for two-way binding with signals
 */
export function useSignalModel(signalKey, initialValue) {
    const [signalValue, updateSignal] = useMetamonSignal(signalKey, initialValue);
    // Create a computed ref that can be used with v-model
    const modelValue = computed({
        get: () => signalValue.value,
        set: (newValue) => updateSignal(newValue)
    });
    return [modelValue, updateSignal];
}
