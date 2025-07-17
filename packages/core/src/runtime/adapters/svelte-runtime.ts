/**
 * Svelte Runtime Adapter for Metamon
 */

import { writable } from 'svelte/store';
import { onMount, onDestroy } from 'svelte';
import { MetamonRuntime, Signal, PubSubAPI } from '../metamon-runtime.js';

/**
 * Svelte function for using Metamon signals with Svelte stores
 */
export function useSignal<T>(key: string | null, initialValue: T): Signal<T> {
  const metamonSignal = MetamonRuntime.createSignal(key, initialValue);
  const store = writable(metamonSignal.value);
  let unsubscribe: (() => void) | null = null;

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
      let currentValue: T;
      store.subscribe(value => currentValue = value)();
      return currentValue!;
    },
    update: (newValue: T | ((prev: T) => T)) => {
      metamonSignal.update(newValue);
    },
    subscribe: (callback: (value: T) => void) => {
      return metamonSignal.subscribe(callback);
    }
  };
}

/**
 * Svelte function for using Metamon pub/sub
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
 * Template function for Svelte (converts to Svelte template)
 */
export function template(templateString: string): any {
  // This would be processed by the compiler
  // For runtime, we'll return a placeholder
  return templateString;
}