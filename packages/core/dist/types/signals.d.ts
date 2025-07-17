/**
 * Reactive signal interface for cross-framework state management
 */
export interface Signal<T> {
    value: T;
    subscribe(callback: (value: T) => void): () => void;
    update(newValue: T): void;
}
/**
 * Interface for managing global signals across frameworks
 */
export interface SignalManager {
    createSignal<T>(initialValue: T, key?: string): Signal<T>;
    getSignal<T>(key: string): Signal<T> | undefined;
    destroySignal(key: string): void;
}
/**
 * Signal subscription callback type
 */
export type SignalCallback<T> = (value: T) => void;
