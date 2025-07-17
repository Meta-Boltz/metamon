import { Ref } from 'vue';
/**
 * Vue composable for using Metamon signals with automatic cleanup
 */
export declare function useSignal<T>(initialValue: T, key?: string): [Ref<T>, (newValue: T) => void];
/**
 * Vue composable for using named Metamon signals
 */
export declare function useMetamonSignal<T>(key: string, initialValue: T): [Ref<T>, (newValue: T) => void];
/**
 * Vue composable for subscribing to pub/sub events
 */
export declare function usePubSub(eventName: string, handler: (payload: any) => void): (payload: any) => void;
/**
 * Vue composable for emitting pub/sub events
 */
export declare function useEmit(eventName: string): (payload: any) => void;
/**
 * Vue composable for component lifecycle integration with Metamon runtime
 */
export declare function useMetamonLifecycle(componentName?: string): string;
/**
 * Vue composable for reactive computed values from signals
 */
export declare function useComputedSignal<T, R>(signalKey: string, initialValue: T, computeFn: (value: T) => R): Ref<R>;
/**
 * Vue composable for two-way binding with signals
 */
export declare function useSignalModel<T>(signalKey: string, initialValue: T): [Ref<T>, (newValue: T) => void];
