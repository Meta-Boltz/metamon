/**
 * React Runtime Adapter for Metamon
 */
import { Signal, PubSubAPI } from '../metamon-runtime.js';
/**
 * React hook for using Metamon signals
 */
export declare function useSignal<T>(key: string | null, initialValue: T): Signal<T>;
/**
 * React hook for using Metamon pub/sub
 */
export declare function usePubSub(): PubSubAPI;
/**
 * Template function for React (converts to JSX)
 */
export declare function template(templateString: string): any;
