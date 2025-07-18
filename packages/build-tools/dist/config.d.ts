import { MetamonViteOptions } from './types/build-options.js';
type MetamonOptions = MetamonViteOptions;
/**
 * Default configuration for Metamon Vite plugin
 */
export declare const defaultConfig: Required<Omit<MetamonOptions, 'adapters' | 'hotReload'>> & Pick<MetamonOptions, 'adapters' | 'hotReload'>;
/**
 * Development-specific configuration
 */
export declare const devConfig: Partial<MetamonOptions>;
/**
 * Production-specific configuration
 */
export declare const prodConfig: Partial<MetamonOptions>;
/**
 * Merge configurations with defaults
 */
export declare function mergeConfig(userConfig?: MetamonOptions, envConfig?: Partial<MetamonOptions>): MetamonOptions;
/**
 * Get configuration for specific environment
 */
export declare function getConfig(userConfig?: MetamonOptions, isDev?: boolean): MetamonOptions;
export {};
