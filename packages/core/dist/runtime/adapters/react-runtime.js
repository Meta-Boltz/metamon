/**
 * React Runtime Adapter for Metamon
 */
import { useState, useEffect, useCallback } from 'react';
import { MetamonRuntime } from '../metamon-runtime.js';
/**
 * React hook for using Metamon signals
 */
export function useSignal(key, initialValue) {
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
        update: useCallback((newValue) => {
            signal.update(newValue);
        }, [signal]),
        subscribe: useCallback((callback) => {
            return signal.subscribe(callback);
        }, [signal])
    };
}
/**
 * React hook for using Metamon pub/sub
 */
export function usePubSub() {
    const pubsub = MetamonRuntime.getPubSub();
    return {
        emit: useCallback((event, data) => {
            pubsub.emit(event, data);
        }, [pubsub]),
        subscribe: useCallback((event, callback) => {
            return pubsub.subscribe(event, callback);
        }, [pubsub])
    };
}
/**
 * Template function for React (converts to JSX)
 */
export function template(templateString) {
    // This would be processed by the compiler
    // For runtime, we'll return a placeholder
    return templateString;
}
