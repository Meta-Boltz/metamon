import { createSignal, createEffect, onCleanup, Accessor, Setter } from 'solid-js';
import { signalManager, pubSubSystem } from '@metamon/core';

/**
 * Solid function for using Metamon signals with native Solid reactivity
 */
export function useSignal<T>(initialValue: T, key?: string): [Accessor<T>, (value: T) => void] {
  const [value, setValue] = createSignal<T>(initialValue);
  let signal: any = null;
  
  // Initialize signal on component creation
  if (key) {
    signal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
  } else {
    signal = signalManager.createSignal(initialValue);
  }
  
  // Sync initial value
  setValue(() => signal.value);
  
  // Subscribe to signal changes
  const unsubscribe = signal.subscribe((newValue: T) => {
    setValue(() => newValue);
  });
  
  // Cleanup on component disposal
  onCleanup(() => {
    unsubscribe();
    if (!key) {
      // Only destroy unnamed signals
      signal.destroy?.();
    }
  });
  
  const updateSignal = (newValue: T) => {
    if (signal) {
      signal.update(newValue);
    }
  };
  
  return [value, updateSignal];
}

/**
 * Solid function for using named Metamon signals
 */
export function useMetamonSignal<T>(key: string, initialValue: T): [Accessor<T>, (value: T) => void] {
  return useSignal(initialValue, key);
}

/**
 * Create a Solid signal that syncs with a Metamon signal for optimal performance
 */
export function createMetamonSignal<T>(initialValue: T, key?: string): [Accessor<T>, (newValue: T | ((prev: T) => T)) => void] {
  let metamonSignal: any;
  
  if (key) {
    metamonSignal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
  } else {
    metamonSignal = signalManager.createSignal(initialValue);
  }
  
  // Create native Solid signal
  const [value, setValue] = createSignal<T>(metamonSignal.value);
  
  // Sync Metamon signal changes to Solid signal
  const unsubscribe = metamonSignal.subscribe((newValue: T) => {
    setValue(() => newValue);
  });
  
  // Cleanup
  onCleanup(() => {
    unsubscribe();
    if (!key) {
      metamonSignal.destroy?.();
    }
  });
  
  // Return Solid-style accessor and setter that updates both signals
  const setSignal = (newValue: T | ((prev: T) => T)) => {
    const resolvedValue = typeof newValue === 'function' ? (newValue as any)(value()) : newValue;
    metamonSignal.update(resolvedValue);
    setValue(() => resolvedValue);
  };
  
  return [value, setSignal];
}

/**
 * Subscribe to pub/sub events in Solid components
 */
export function usePubSub(eventName: string, callback: (payload: any) => void): void {
  createEffect(() => {
    const componentId = Math.random().toString(36).substr(2, 9);
    
    pubSubSystem.subscribe(eventName, callback, componentId);
    
    onCleanup(() => {
      pubSubSystem.cleanup(componentId);
    });
  });
}

/**
 * Create an event emitter function for pub/sub
 */
export function useEmitter(eventName: string): (payload: any) => void {
  return (payload: any) => {
    pubSubSystem.emit(eventName, payload);
  };
}

/**
 * Hook for managing multiple pub/sub subscriptions
 */
export function usePubSubChannels(channels: Array<{ event: string; callback: (payload: any) => void }>): void {
  createEffect(() => {
    const componentId = Math.random().toString(36).substr(2, 9);
    
    channels.forEach(({ event, callback }) => {
      pubSubSystem.subscribe(event, callback, componentId);
    });
    
    onCleanup(() => {
      pubSubSystem.cleanup(componentId);
    });
  });
}