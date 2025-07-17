/**
 * Hot reload configuration interface and utilities
 */

export interface HotReloadConfig {
  // File watching configuration
  watchPatterns: string[];
  ignorePatterns: string[];
  
  // Reload behavior
  preserveState: boolean;
  batchUpdates: boolean;
  debounceMs: number;
  
  // Cross-framework settings
  syncFrameworks: boolean;
  syncTimeout: number;
  
  // Error handling
  showErrorOverlay: boolean;
  errorRecoveryMode: 'graceful' | 'strict';
  
  // Performance settings
  maxConcurrentReloads: number;
  reloadTimeout: number;
  
  // Developer tools settings
  enableDevTools: boolean;
  enablePerformanceMonitoring: boolean;
  enableStatePreservationLogging: boolean;
  enableDebugLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Default hot reload configuration
 */
export const defaultHotReloadConfig: HotReloadConfig = {
  // File watching
  watchPatterns: ['**/*.mtm', '**/*.jsx', '**/*.tsx', '**/*.vue', '**/*.svelte'],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  
  // Reload behavior
  preserveState: true,
  batchUpdates: true,
  debounceMs: 100,
  
  // Cross-framework settings
  syncFrameworks: true,
  syncTimeout: 5000,
  
  // Error handling
  showErrorOverlay: true,
  errorRecoveryMode: 'graceful',
  
  // Performance settings
  maxConcurrentReloads: 5,
  reloadTimeout: 10000,
  
  // Developer tools
  enableDevTools: true,
  enablePerformanceMonitoring: true,
  enableStatePreservationLogging: false,
  enableDebugLogging: false,
  logLevel: 'info'
};

/**
 * Development-specific hot reload configuration
 */
export const devHotReloadConfig: Partial<HotReloadConfig> = {
  enableDevTools: true,
  enablePerformanceMonitoring: true,
  enableDebugLogging: true,
  logLevel: 'debug',
  showErrorOverlay: true
};

/**
 * Production-specific hot reload configuration (minimal)
 */
export const prodHotReloadConfig: Partial<HotReloadConfig> = {
  enableDevTools: false,
  enablePerformanceMonitoring: false,
  enableDebugLogging: false,
  logLevel: 'error',
  showErrorOverlay: false
};

/**
 * Merge hot reload configurations
 */
export function mergeHotReloadConfig(
  userConfig: Partial<HotReloadConfig> = {},
  envConfig: Partial<HotReloadConfig> = {}
): HotReloadConfig {
  return {
    ...defaultHotReloadConfig,
    ...envConfig,
    ...userConfig,
    watchPatterns: [
      ...defaultHotReloadConfig.watchPatterns,
      ...(envConfig.watchPatterns || []),
      ...(userConfig.watchPatterns || [])
    ],
    ignorePatterns: [
      ...defaultHotReloadConfig.ignorePatterns,
      ...(envConfig.ignorePatterns || []),
      ...(userConfig.ignorePatterns || [])
    ]
  };
}

/**
 * Get hot reload configuration for specific environment
 */
export function getHotReloadConfig(
  userConfig: Partial<HotReloadConfig> = {},
  isDev: boolean = process.env.NODE_ENV !== 'production'
): HotReloadConfig {
  const envConfig = isDev ? devHotReloadConfig : prodHotReloadConfig;
  return mergeHotReloadConfig(userConfig, envConfig);
}

/**
 * Load hot reload configuration from file
 */
export async function loadHotReloadConfigFromFile(
  configPath: string = 'metamon.hotreload.config.js'
): Promise<Partial<HotReloadConfig>> {
  try {
    const { default: config } = await import(configPath);
    return config || {};
  } catch (error) {
    // Config file not found or invalid, return empty config
    return {};
  }
}

/**
 * Validate hot reload configuration
 */
export function validateHotReloadConfig(config: Partial<HotReloadConfig>): string[] {
  const errors: string[] = [];
  
  if (config.debounceMs !== undefined && (config.debounceMs < 0 || config.debounceMs > 5000)) {
    errors.push('debounceMs must be between 0 and 5000');
  }
  
  if (config.syncTimeout !== undefined && (config.syncTimeout < 1000 || config.syncTimeout > 30000)) {
    errors.push('syncTimeout must be between 1000 and 30000');
  }
  
  if (config.maxConcurrentReloads !== undefined && (config.maxConcurrentReloads < 1 || config.maxConcurrentReloads > 20)) {
    errors.push('maxConcurrentReloads must be between 1 and 20');
  }
  
  if (config.reloadTimeout !== undefined && (config.reloadTimeout < 1000 || config.reloadTimeout > 60000)) {
    errors.push('reloadTimeout must be between 1000 and 60000');
  }
  
  if (config.errorRecoveryMode !== undefined && !['graceful', 'strict'].includes(config.errorRecoveryMode)) {
    errors.push('errorRecoveryMode must be either "graceful" or "strict"');
  }
  
  if (config.logLevel !== undefined && !['error', 'warn', 'info', 'debug'].includes(config.logLevel)) {
    errors.push('logLevel must be one of: error, warn, info, debug');
  }
  
  return errors;
}