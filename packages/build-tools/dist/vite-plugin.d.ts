import { Plugin } from 'vite';
import { MetamonViteOptions } from './types/build-options.js';
export type MetamonOptions = MetamonViteOptions;
/**
 * Vite plugin for processing .mtm files
 */
export declare function metamon(options?: MetamonOptions): Plugin;
/**
 * Default export for convenience
 */
export default metamon;
