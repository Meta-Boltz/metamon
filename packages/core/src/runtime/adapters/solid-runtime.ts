/**
 * Solid Runtime Adapter for Metamon
 */

import { createSignal, createEffect, onCleanup } from 'solid-js';
import { MetamonRuntime, Signal, PubSubAPI } from '../metamon-runtime.js';

/**
 * Solid function for using Metamon signals with native Solid reactivity
 */
export function useSignal<T>(key: string | null, initialValue: T): Signal<T> {
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
    update: (newValue: T | ((prev: T) => T)) => {
      metamonSignal.update(newValue);
    },
    subscribe: (callback: (value: T) => void) => {
      return metamonSignal.subscribe(callback);
    }
  };
}

/**
 * Solid function for using Metamon pub/sub
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
 * Template function for Solid (converts to JSX)
 */
export function template(templateString: string): any {
  // This would be processed by the compiler
  // For runtime, we'll return a placeholder
  return templateString;
}