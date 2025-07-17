/**
 * Vue Runtime Adapter for Metamon
 */
import { Signal, PubSubAPI } from '../metamon-runtime.js';
/**
 * Vue composable for using Metamon signals
 */
export declare function useSignal<T>(key: string | null, initialValue: T): Signal<T>;
/**
 * Vue composable for using Metamon pub/sub
 */
export declare function usePubSub(): PubSubAPI;
/**
 * Template function for Vue (converts to Vue template)
 */
export declare function template(templateString: string): any;
