import { type Writable } from 'svelte/store';
/**
 * Svelte composable for using Metamon signals with Svelte stores
 */
export declare function useSignal<T>(initialValue: T, key?: string): [Writable<T>, (value: T) => void];
/**
 * Svelte composable for using named Metamon signals
 */
export declare function useMetamonSignal<T>(key: string, initialValue: T): [Writable<T>, (value: T) => void];
/**
 * Create a Svelte store that syncs with a Metamon signal
 */
export declare function createMetamonStore<T>(initialValue: T, key?: string): {
    subscribe: (this: void, run: import("svelte/store").Subscriber<any>, invalidate?: () => void) => import("svelte/store").Unsubscriber;
    set: (value: T) => void;
    update: (updater: (value: T) => T) => void;
    destroy: () => void;
};
/**
 * Svelte composable for pub/sub event handling
 */
export declare function usePubSub(): {
    subscribe: (event: string, callback: (payload: any) => void) => void;
    emit: (event: string, payload?: any) => void;
    unsubscribe: (event: string) => void;
};
/**
 * Create a derived store from multiple Metamon signals
 */
export declare function createDerivedSignal<T, U>(signals: string[], deriveFn: (values: T[]) => U, initialValue: U): Writable<U>;
