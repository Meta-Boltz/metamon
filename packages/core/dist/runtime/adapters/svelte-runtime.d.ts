/**
 * Svelte Runtime Adapter for Metamon
 */
import { Signal, PubSubAPI } from '../metamon-runtime.js';
/**
 * Svelte function for using Metamon signals with Svelte stores
 */
export declare function useSignal<T>(key: string | null, initialValue: T): Signal<T>;
/**
 * Svelte function for using Metamon pub/sub
 */
export declare function usePubSub(): PubSubAPI;
/**
 * Template function for Svelte (converts to Svelte template)
 */
export declare function template(templateString: string): any;
