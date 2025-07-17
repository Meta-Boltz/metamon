import { useState, useEffect, useCallback, useRef } from 'react';
import { signalManager, pubSubSystem } from '@metamon/core';
import type { Signal } from '@metamon/core';

/**
 * React hook for using Metamon signals with automatic cleanup
 */
export function useSignal<T>(initialValue: T, key?: string): [T, (newValue: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const signalRef = useRef<Signal<T> | null>(null);
  const componentIdRef = useRef<string>(Math.random().toString(36).substr(2, 9));
  
  useEffect(() => {
    let currentSignal: Signal<T>;
    
    if (key) {
      // Use or create named signal
      currentSignal = signalManager.getSignal<T>(key) || signalManager.createSignal<T>(initialValue, key);
    } else {
      // Create anonymous signal
      currentSignal = signalManager.createSignal<T>(initialValue);
    }
    
    signalRef.current = currentSignal;
    setValue(currentSignal.value);
    
    // Subscribe to signal changes
    const unsubscribe = currentSignal.subscribe((newValue: T) => {
      setValue(newValue);
    });
    
    return () => {
      unsubscribe();
      // Cleanup is handled by the signal manager
    };
  }, [key, initialValue]);
  
  const updateSignal = useCallback((newValue: T) => {
    if (signalRef.current) {
      signalRef.current.update(newValue);
    }
  }, []);
  
  return [value, updateSignal];
}

/**
 * React hook for using named Metamon signals
 */
export function useMetamonSignal<T>(key: string, initialValue: T): [T, (newValue: T) => void] {
  return useSignal<T>(initialValue, key);
}

/**
 * React hook for subscribing to pub/sub events
 */
export function usePubSub(
  eventName: string,
  handler: (payload: any) => void,
  dependencies: any[] = []
): (payload: any) => void {
  const componentIdRef = useRef<string>(Math.random().toString(36).substr(2, 9));
  
  useEffect(() => {
    const componentId = componentIdRef.current;
    
    pubSubSystem.subscribe(eventName, handler, componentId);
    
    return () => {
      pubSubSystem.cleanup(componentId);
    };
  }, [eventName, ...dependencies]);
  
  const emit = useCallback((payload: any) => {
    pubSubSystem.emit(eventName, payload);
  }, [eventName]);
  
  return emit;
}

/**
 * React hook for emitting pub/sub events
 */
export function useEmit(eventName: string): (payload: any) => void {
  return useCallback((payload: any) => {
    pubSubSystem.emit(eventName, payload);
  }, [eventName]);
}

/**
 * React hook for component lifecycle integration with Metamon runtime
 */
export function useMetamonLifecycle(componentName?: string) {
  const componentIdRef = useRef<string>(
    componentName || Math.random().toString(36).substr(2, 9)
  );
  
  useEffect(() => {
    // Component mounted
    console.log(`Metamon component ${componentIdRef.current} mounted`);
    
    return () => {
      // Component unmounting - cleanup all subscriptions
      pubSubSystem.cleanup(componentIdRef.current);
      console.log(`Metamon component ${componentIdRef.current} unmounted`);
    };
  }, []);
  
  return componentIdRef.current;
}