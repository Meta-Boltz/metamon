/**
 * Vue Runtime Adapter for Metamon
 */

import { ref, onMounted, onUnmounted, computed } from 'vue';
import { MetamonRuntime, Signal, PubSubAPI } from '../metamon-runtime.js';

/**
 * Vue composable for using Metamon signals
 */
export function useSignal<T>(key: string | null, initialValue: T): Signal<T> {
  const signal = MetamonRuntime.createSignal(key, initialValue);
  const value = ref(signal.value);
  let unsubscribe: (() => void) | null = null;

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
    update: (newValue: T | ((prev: T) => T)) => {
      signal.update(newValue);
    },
    subscribe: (callback: (value: T) => void) => {
      return signal.subscribe(callback);
    }
  };
}

/**
 * Vue composable for using Metamon pub/sub
 */
export function usePubSub(): PubSubAPI {
  const pubsub = MetamonRuntime.getPubSub();
  
  return {
    emit: (event: string, data: any) => {
      pubsub.emit(event, data);
    },
    
    subscribe: (event: string, callback: (data: any) => void) => {
      return pubsub.subscribe(event, callback);
    }
  };
}

/**
 * Template function for Vue (converts to Vue template)
 */
export function template(templateString: string): any {
  // This would be processed by the compiler
  // For runtime, we'll return a placeholder
  return templateString;
}