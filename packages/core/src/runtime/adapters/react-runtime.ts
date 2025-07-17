/**
 * React Runtime Adapter for Metamon
 */

import { useState, useEffect, useCallback } from 'react';
import { MetamonRuntime, Signal, PubSubAPI } from '../metamon-runtime.js';

/**
 * React hook for using Metamon signals
 */
export function useSignal<T>(key: string | null, initialValue: T): Signal<T> {
  const signal = MetamonRuntime.createSignal(key, initialValue);
  const [value, setValue] = useState(signal.value);

  useEffect(() => {
    // Subscribe to signal changes
    const unsubscribe = signal.subscribe((newValue) => {
      setValue(newValue);
    });

    return unsubscribe;
  }, [signal]);

  // Return signal interface with React-optimized update
  return {
    get value() {
      return value;
    },
    update: useCallback((newValue: T | ((prev: T) => T)) => {
      signal.update(newValue);
    }, [signal]),
    subscribe: useCallback((callback: (value: T) => void) => {
      return signal.subscribe(callback);
    }, [signal])
  };
}

/**
 * React hook for using Metamon pub/sub
 */
export function usePubSub(): PubSubAPI {
  const pubsub = MetamonRuntime.getPubSub();
  
  return {
    emit: useCallback((event: string, data: any) => {
      pubsub.emit(event, data);
    }, [pubsub]),
    
    subscribe: useCallback((event: string, callback: (data: any) => void) => {
      return pubsub.subscribe(event, callback);
    }, [pubsub])
  };
}

/**
 * Template function for React (converts to JSX)
 */
export function template(templateString: string): any {
  // This would be processed by the compiler
  // For runtime, we'll return a placeholder
  return templateString;
}