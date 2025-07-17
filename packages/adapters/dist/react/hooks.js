import { useState, useEffect, useCallback, useRef } from 'react';
import { signalManager, pubSubSystem } from '@metamon/core';
/**
 * React hook for using Metamon signals with automatic cleanup
 */
export function useSignal(initialValue, key) {
    const [value, setValue] = useState(initialValue);
    const signalRef = useRef(null);
    const componentIdRef = useRef(Math.random().toString(36).substr(2, 9));
    useEffect(() => {
        let currentSignal;
        if (key) {
            // Use or create named signal
            currentSignal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
        }
        else {
            // Create anonymous signal
            currentSignal = signalManager.createSignal(initialValue);
        }
        signalRef.current = currentSignal;
        setValue(currentSignal.value);
        // Subscribe to signal changes
        const unsubscribe = currentSignal.subscribe((newValue) => {
            setValue(newValue);
        });
        return () => {
            unsubscribe();
            // Cleanup is handled by the signal manager
        };
    }, [key, initialValue]);
    const updateSignal = useCallback((newValue) => {
        if (signalRef.current) {
            signalRef.current.update(newValue);
        }
    }, []);
    return [value, updateSignal];
}
/**
 * React hook for using named Metamon signals
 */
export function useMetamonSignal(key, initialValue) {
    return useSignal(initialValue, key);
}
/**
 * React hook for subscribing to pub/sub events
 */
export function usePubSub(eventName, handler, dependencies = []) {
    const componentIdRef = useRef(Math.random().toString(36).substr(2, 9));
    useEffect(() => {
        const componentId = componentIdRef.current;
        pubSubSystem.subscribe(eventName, handler, componentId);
        return () => {
            pubSubSystem.cleanup(componentId);
        };
    }, [eventName, ...dependencies]);
    const emit = useCallback((payload) => {
        pubSubSystem.emit(eventName, payload);
    }, [eventName]);
    return emit;
}
/**
 * React hook for emitting pub/sub events
 */
export function useEmit(eventName) {
    return useCallback((payload) => {
        pubSubSystem.emit(eventName, payload);
    }, [eventName]);
}
/**
 * React hook for component lifecycle integration with Metamon runtime
 */
export function useMetamonLifecycle(componentName) {
    const componentIdRef = useRef(componentName || Math.random().toString(36).substr(2, 9));
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
