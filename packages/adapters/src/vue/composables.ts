import { ref, onMounted, onUnmounted, computed, Ref } from 'vue';
import { signalManager, pubSubSystem } from '@metamon/core';
import type { Signal } from '@metamon/core';

/**
 * Vue composable for using Metamon signals with automatic cleanup
 */
export function useSignal<T>(initialValue: T, key?: string): [Ref<T>, (newValue: T) => void] {
  const value = ref(initialValue) as Ref<T>;
  let signal: Signal<T> | null = null;
  let unsubscribe: (() => void) | null = null;
  const componentId = Math.random().toString(36).substr(2, 9);
  
  onMounted(() => {
    if (key) {
      // Use or create named signal
      signal = signalManager.getSignal<T>(key) || signalManager.createSignal<T>(initialValue, key);
    } else {
      // Create anonymous signal
      signal = signalManager.createSignal<T>(initialValue);
    }
    
    value.value = signal.value;
    
    // Subscribe to signal changes
    unsubscribe = signal.subscribe((newValue: T) => {
      value.value = newValue;
    });
  });
  
  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    // Cleanup is handled by the signal manager
  });
  
  const updateSignal = (newValue: T) => {
    if (signal) {
      signal.update(newValue);
    }
  };
  
  return [value, updateSignal];
}

/**
 * Vue composable for using named Metamon signals
 */
export function useMetamonSignal<T>(key: string, initialValue: T): [Ref<T>, (newValue: T) => void] {
  return useSignal<T>(initialValue, key);
}

/**
 * Vue composable for subscribing to pub/sub events
 */
export function usePubSub(
  eventName: string,
  handler: (payload: any) => void
): (payload: any) => void {
  const componentId = Math.random().toString(36).substr(2, 9);
  
  onMounted(() => {
    pubSubSystem.subscribe(eventName, handler, componentId);
  });
  
  onUnmounted(() => {
    pubSubSystem.cleanup(componentId);
  });
  
  const emit = (payload: any) => {
    pubSubSystem.emit(eventName, payload);
  };
  
  return emit;
}

/**
 * Vue composable for emitting pub/sub events
 */
export function useEmit(eventName: string): (payload: any) => void {
  return (payload: any) => {
    pubSubSystem.emit(eventName, payload);
  };
}

/**
 * Vue composable for component lifecycle integration with Metamon runtime
 */
export function useMetamonLifecycle(componentName?: string): string {
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
export function useComputedSignal<T, R>(
  signalKey: string,
  initialValue: T,
  computeFn: (value: T) => R
): Ref<R> {
  const [signalValue] = useMetamonSignal(signalKey, initialValue);
  
  return computed(() => computeFn(signalValue.value));
}

/**
 * Vue composable for two-way binding with signals
 */
export function useSignalModel<T>(
  signalKey: string,
  initialValue: T
): [Ref<T>, (newValue: T) => void] {
  const [signalValue, updateSignal] = useMetamonSignal(signalKey, initialValue);
  
  // Create a computed ref that can be used with v-model
  const modelValue = computed({
    get: () => signalValue.value,
    set: (newValue: T) => updateSignal(newValue)
  });
  
  return [modelValue, updateSignal];
}