/**
 * Solid Runtime Adapter for Metamon
 */
import { Signal, PubSubAPI } from '../metamon-runtime.js';
/**
 * Solid function for using Metamon signals with native Solid reactivity
 */
export declare function useSignal<T>(key: string | null, initialValue: T): Signal<T>;
/**
 * Solid function for using Metamon pub/sub
 */
export declare function usePubSub(): PubSubAPI;
/**
 * Template function for Solid (converts to JSX)
 */
export declare function template(templateString: string): any;
