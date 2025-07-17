/**
 * Tests for hot reload configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HotReloadConfig,
  defaultHotReloadConfig,
  devHotReloadConfig,
  prodHotReloadConfig,
  mergeHotReloadConfig,
  getHotReloadConfig,
  validateHotReloadConfig
} from '../hot-reload-config.js';

describe('HotReloadConfig', () => {
  describe('defaultHotReloadConfig', () => {
    it('should have sensible defaults', () => {
      expect(defaultHotReloadConfig.preserveState).toBe(true);
      expect(defaultHotReloadConfig.batchUpdates).toBe(true);
      expect(defaultHotReloadConfig.debounceMs).toBe(100);
      expect(defaultHotReloadConfig.syncFrameworks).toBe(true);
      expect(defaultHotReloadConfig.showErrorOverlay).toBe(true);
      expect(defaultHotReloadConfig.errorRecoveryMode).toBe('graceful');
      expect(defaultHotReloadConfig.enableDevTools).toBe(true);
      expect(defaultHotReloadConfig.logLevel).toBe('info');
    });

    it('should include appropriate watch patterns', () => {
      expect(defaultHotReloadConfig.watchPatterns).toContain('**/*.mtm');
      expect(defaultHotReloadConfig.watchPatterns).toContain('**/*.jsx');
      expect(defaultHotReloadConfig.watchPatterns).toContain('**/*.tsx');
      expect(defaultHotReloadConfig.watchPatterns).toContain('**/*.vue');
      expect(defaultHotReloadConfig.watchPatterns).toContain('**/*.svelte');
    });

    it('should include appropriate ignore patterns', () => {
      expect(defaultHotReloadConfig.ignorePatterns).toContain('**/node_modules/**');
      expect(defaultHotReloadConfig.ignorePatterns).toContain('**/dist/**');
      expect(defaultHotReloadConfig.ignorePatterns).toContain('**/.git/**');
    });
  });

  describe('devHotReloadConfig', () => {
    it('should enable development features', () => {
      expect(devHotReloadConfig.enableDevTools).toBe(true);
      expect(devHotReloadConfig.enablePerformanceMonitoring).toBe(true);
      expect(devHotReloadConfig.enableDebugLogging).toBe(true);
      expect(devHotReloadConfig.logLevel).toBe('debug');
      expect(devHotReloadConfig.showErrorOverlay).toBe(true);
    });
  });

  describe('prodHotReloadConfig', () => {
    it('should disable development features', () => {
      expect(prodHotReloadConfig.enableDevTools).toBe(false);
      expect(prodHotReloadConfig.enablePerformanceMonitoring).toBe(false);
      expect(prodHotReloadConfig.enableDebugLogging).toBe(false);
      expect(prodHotReloadConfig.logLevel).toBe('error');
      expect(prodHotReloadConfig.showErrorOverlay).toBe(false);
    });
  });

  describe('mergeHotReloadConfig', () => {
    it('should merge configurations correctly', () => {
      const userConfig: Partial<HotReloadConfig> = {
        debounceMs: 200,
        enableDebugLogging: true,
        watchPatterns: ['**/*.custom']
      };

      const envConfig: Partial<HotReloadConfig> = {
        logLevel: 'debug',
        enableDevTools: false
      };

      const merged = mergeHotReloadConfig(userConfig, envConfig);

      expect(merged.debounceMs).toBe(200);
      expect(merged.enableDebugLogging).toBe(true);
      expect(merged.logLevel).toBe('debug');
      expect(merged.enableDevTools).toBe(false);
      expect(merged.watchPatterns).toContain('**/*.mtm');
      expect(merged.watchPatterns).toContain('**/*.custom');
    });

    it('should preserve default values when not overridden', () => {
      const userConfig: Partial<HotReloadConfig> = {
        debounceMs: 200
      };

      const merged = mergeHotReloadConfig(userConfig);

      expect(merged.debounceMs).toBe(200);
      expect(merged.preserveState).toBe(defaultHotReloadConfig.preserveState);
      expect(merged.syncFrameworks).toBe(defaultHotReloadConfig.syncFrameworks);
    });
  });

  describe('getHotReloadConfig', () => {
    it('should return dev config in development', () => {
      const config = getHotReloadConfig({}, true);
      
      expect(config.enableDevTools).toBe(true);
      expect(config.enableDebugLogging).toBe(true);
      expect(config.logLevel).toBe('debug');
    });

    it('should return prod config in production', () => {
      const config = getHotReloadConfig({}, false);
      
      expect(config.enableDevTools).toBe(false);
      expect(config.enableDebugLogging).toBe(false);
      expect(config.logLevel).toBe('error');
    });

    it('should merge user config with environment config', () => {
      const userConfig: Partial<HotReloadConfig> = {
        debounceMs: 300,
        preserveState: false
      };

      const config = getHotReloadConfig(userConfig, true);
      
      expect(config.debounceMs).toBe(300);
      expect(config.preserveState).toBe(false);
      expect(config.enableDevTools).toBe(true); // from dev config
    });
  });

  describe('validateHotReloadConfig', () => {
    it('should return no errors for valid config', () => {
      const validConfig: Partial<HotReloadConfig> = {
        debounceMs: 100,
        syncTimeout: 5000,
        maxConcurrentReloads: 5,
        reloadTimeout: 10000,
        errorRecoveryMode: 'graceful',
        logLevel: 'info'
      };

      const errors = validateHotReloadConfig(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should validate debounceMs range', () => {
      const invalidConfig: Partial<HotReloadConfig> = {
        debounceMs: -1
      };

      const errors = validateHotReloadConfig(invalidConfig);
      expect(errors).toContain('debounceMs must be between 0 and 5000');
    });

    it('should validate syncTimeout range', () => {
      const invalidConfig: Partial<HotReloadConfig> = {
        syncTimeout: 500
      };

      const errors = validateHotReloadConfig(invalidConfig);
      expect(errors).toContain('syncTimeout must be between 1000 and 30000');
    });

    it('should validate maxConcurrentReloads range', () => {
      const invalidConfig: Partial<HotReloadConfig> = {
        maxConcurrentReloads: 0
      };

      const errors = validateHotReloadConfig(invalidConfig);
      expect(errors).toContain('maxConcurrentReloads must be between 1 and 20');
    });

    it('should validate reloadTimeout range', () => {
      const invalidConfig: Partial<HotReloadConfig> = {
        reloadTimeout: 500
      };

      const errors = validateHotReloadConfig(invalidConfig);
      expect(errors).toContain('reloadTimeout must be between 1000 and 60000');
    });

    it('should validate errorRecoveryMode values', () => {
      const invalidConfig: Partial<HotReloadConfig> = {
        errorRecoveryMode: 'invalid' as any
      };

      const errors = validateHotReloadConfig(invalidConfig);
      expect(errors).toContain('errorRecoveryMode must be either "graceful" or "strict"');
    });

    it('should validate logLevel values', () => {
      const invalidConfig: Partial<HotReloadConfig> = {
        logLevel: 'invalid' as any
      };

      const errors = validateHotReloadConfig(invalidConfig);
      expect(errors).toContain('logLevel must be one of: error, warn, info, debug');
    });

    it('should return multiple errors for multiple invalid values', () => {
      const invalidConfig: Partial<HotReloadConfig> = {
        debounceMs: -1,
        syncTimeout: 500,
        errorRecoveryMode: 'invalid' as any
      };

      const errors = validateHotReloadConfig(invalidConfig);
      expect(errors).toHaveLength(3);
    });
  });
});