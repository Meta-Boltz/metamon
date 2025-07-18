/**
 * Vite Plugin for processing .mtm files
 */
import { Plugin } from 'vite';
import { type HotReloadConfig } from './hot-reload-orchestrator.js';
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
    /**
     * Hot reload configuration
     */
    hotReload?: Partial<HotReloadConfig>;
}
/**
 * Vite plugin for processing .mtm files
 */
export declare function mtmPlugin(options?: MTMPluginOptions): Plugin;
