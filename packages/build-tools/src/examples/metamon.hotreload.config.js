/**
 * Example hot reload configuration for Metamon
 * 
 * This file demonstrates how to configure hot reload settings for your Metamon project.
 * Place this file in your project root as 'metamon.hotreload.config.js'
 */

export default {
  // File watching configuration
  watchPatterns: [
    '**/*.mtm',
    '**/*.jsx',
    '**/*.tsx', 
    '**/*.vue',
    '**/*.svelte',
    '**/*.css',
    '**/*.scss'
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/coverage/**'
  ],
  
  // Reload behavior
  preserveState: true,
  batchUpdates: true,
  debounceMs: 150, // Slightly higher debounce for slower systems
  
  // Cross-framework settings
  syncFrameworks: true,
  syncTimeout: 8000, // Longer timeout for complex applications
  
  // Error handling
  showErrorOverlay: true,
  errorRecoveryMode: 'graceful', // or 'strict'
  
  // Performance settings
  maxConcurrentReloads: 3, // Lower for resource-constrained environments
  reloadTimeout: 15000,
  
  // Developer tools settings
  enableDevTools: true,
  enablePerformanceMonitoring: true,
  enableStatePreservationLogging: false, // Enable for debugging state issues
  enableDebugLogging: false, // Enable for detailed debugging
  logLevel: 'info' // 'error', 'warn', 'info', or 'debug'
};

// Alternative configuration for production-like environments
export const productionConfig = {
  enableDevTools: false,
  enablePerformanceMonitoring: false,
  enableDebugLogging: false,
  logLevel: 'error',
  showErrorOverlay: false
};

// Alternative configuration for debugging
export const debugConfig = {
  enableDevTools: true,
  enablePerformanceMonitoring: true,
  enableStatePreservationLogging: true,
  enableDebugLogging: true,
  logLevel: 'debug',
  debounceMs: 50, // Faster response for debugging
  showErrorOverlay: true
};