import { MetamonViteOptions } from './types/build-options.js';
import { defaultHotReloadConfig, devHotReloadConfig, prodHotReloadConfig, mergeHotReloadConfig } from './hot-reload-config.js';

type MetamonOptions = MetamonViteOptions;

/**
 * Default configuration for Metamon Vite plugin
 */
export const defaultConfig: Required<Omit<MetamonOptions, 'adapters' | 'hotReload'>> & Pick<MetamonOptions, 'adapters' | 'hotReload'> = {
  root: 'src',
  pagesDir: 'pages',
  componentsDir: 'components',
  hmr: true,
  sourceMaps: true,
  adapters: {},
  hotReload: defaultHotReloadConfig,
  optimization: {
    treeShaking: {
      runtime: true,
      adapters: true,
      components: true,
      preserve: [],
      aggressive: false
    },
    minify: {
      enabled: false,
      removeComments: true,
      removeConsole: false,
      removeDebugger: true,
      mangle: false,
      compress: false
    },
    compression: {
      gzip: false,
      brotli: false,
      level: 6
    },
    splitting: {
      enabled: true,
      chunkSizeThreshold: 50000,
      sharedDepsThreshold: 2
    },
    analysis: {
      detailed: false,
      sourceMaps: false,
      visualization: false,
      thresholds: {
        warning: 100000,
        error: 500000
      }
    },
    target: 'es2020',
    polyfills: false
  }
};

/**
 * Development-specific configuration
 */
export const devConfig: Partial<MetamonOptions> = {
  hmr: true,
  sourceMaps: true,
  hotReload: devHotReloadConfig
};

/**
 * Production-specific configuration
 */
export const prodConfig: Partial<MetamonOptions> = {
  hmr: false,
  sourceMaps: false,
  hotReload: prodHotReloadConfig
};

/**
 * Merge configurations with defaults
 */
export function mergeConfig(
  userConfig: MetamonOptions = {},
  envConfig: Partial<MetamonOptions> = {}
): MetamonOptions {
  return {
    ...defaultConfig,
    ...envConfig,
    ...userConfig,
    adapters: {
      ...defaultConfig.adapters,
      ...envConfig.adapters,
      ...userConfig.adapters
    },
    hotReload: mergeHotReloadConfig(
      userConfig.hotReload,
      envConfig.hotReload
    )
  };
}

/**
 * Get configuration for specific environment
 */
export function getConfig(
  userConfig: MetamonOptions = {},
  isDev: boolean = process.env.NODE_ENV !== 'production'
): MetamonOptions {
  const envConfig = isDev ? devConfig : prodConfig;
  return mergeConfig(userConfig, envConfig);
}