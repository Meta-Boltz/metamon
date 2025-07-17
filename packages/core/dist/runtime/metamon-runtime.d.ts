/**
 * Metamon Runtime - Core runtime for .mtm components
 * Provides universal APIs that work across all frameworks
 */
export interface Signal<T> {
    value: T;
    update(newValue: T | ((prev: T) => T)): void;
    subscribe(callback: (value: T) => void): () => void;
}
export interface PubSubAPI {
    emit(event: string, data: any): void;
    subscribe(event: string, callback: (data: any) => void): () => void;
}
export interface ComponentTemplate {
    render(): any;
    framework: string;
}
/**
 * Main Metamon Runtime
 */
export declare class MetamonRuntime {
    private static instance;
    private static globalSignals;
    private static globalPubSub;
    static getInstance(): MetamonRuntime;
    static registerSignal(key: string, signal: Signal<any>): void;
    static getSignal<T>(key: string): Signal<T> | undefined;
    static createSignal<T>(key: string | null, initialValue: T): Signal<T>;
    static getPubSub(): PubSubAPI;
    static compileTemplate(template: string, framework: string): ComponentTemplate;
}
/**
 * Universal APIs for .mtm components
 */
export declare function useSignal<T>(key: string | null, initialValue: T): Signal<T>;
export declare function usePubSub(): PubSubAPI;
export declare function template(templateString: string): (framework: string) => ComponentTemplate;
