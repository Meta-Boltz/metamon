/**
 * Vite Plugin for processing .mtm files
 */
import { Plugin } from 'vite';
export interface MTMPluginOptions {
    /**
     * Include patterns for .mtm files
     */
    include?: string | string[];
    /**
     * Exclude patterns for .mtm files
     */
    exclude?: string | string[];
    /**
     * Enable source maps
     */
    sourceMaps?: boolean;
    /**
     * Enable hot module replacement
     */
    hmr?: boolean;
}
/**
 * Vite plugin for processing .mtm files
 */
export declare function mtmPlugin(options?: MTMPluginOptions): Plugin;
