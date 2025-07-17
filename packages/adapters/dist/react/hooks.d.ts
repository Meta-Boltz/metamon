/**
 * React hook for using Metamon signals with automatic cleanup
 */
export declare function useSignal<T>(initialValue: T, key?: string): [T, (newValue: T) => void];
/**
 * React hook for using named Metamon signals
 */
export declare function useMetamonSignal<T>(key: string, initialValue: T): [T, (newValue: T) => void];
/**
 * React hook for subscribing to pub/sub events
 */
export declare function usePubSub(eventName: string, handler: (payload: any) => void, dependencies?: any[]): (payload: any) => void;
/**
 * React hook for emitting pub/sub events
 */
export declare function useEmit(eventName: string): (payload: any) => void;
/**
 * React hook for component lifecycle integration with Metamon runtime
 */
export declare function useMetamonLifecycle(componentName?: string): string;
