/**
 * Integration tests for hot reload configuration and developer tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HotReloadConfig, getHotReloadConfig } from '../../hot-reload-config.js';
import { HotReloadDevTools, initializeDevTools } from '../../hot-reload-dev-tools.js';
import { HotReloadDebugLogger, initializeDebugLogger } from '../../hot-reload-debug-logger.js';
import { mergeConfig } from '../../config.js';

describe('Hot Reload Configuration Integration', () => {
  let config: HotReloadConfig;
  let devTools: HotReloadDevTools;
  let logger: HotReloadDebugLogger;

  beforeEach(() => {
    config = getHotReloadConfig({
      enableDevTools: true,
      enablePerformanceMonitoring: true,
      enableDebugLogging: true,
      logLevel: 'debug'
    }, true);
    
    devTools = initializeDevTools(config);
    logger = initializeDebugLogger(config);
  });

  describe('configuration integration', () => {
    it('should integrate hot reload config with main config', () => {
      const userConfig = {
        root: 'custom-src',
        hotReload: {
          debounceMs: 200,
          enableDevTools: false
        }
      };

      const merged = mergeConfig(userConfig, { hmr: true });
      
      expect(merged.root).toBe('custom-src');
      expect(merged.hotReload?.debounceMs).toBe(200);
      expect(merged.hotReload?.enableDevTools).toBe(false);
      expect(merged.hotReload?.preserveState).toBe(true); // from defaults
    });

    it('should apply environment-specific configurations', () => {
      const devConfig = getHotReloadConfig({}, true);
      const prodConfig = getHotReloadConfig({}, false);
      
      expect(devConfig.enableDevTools).toBe(true);
      expect(devConfig.enableDebugLogging).toBe(true);
      expect(devConfig.logLevel).toBe('debug');
      
      expect(prodConfig.enableDevTools).toBe(false);
      expect(prodConfig.enableDebugLogging).toBe(false);
      expect(prodConfig.logLevel).toBe('error');
    });
  });

  describe('dev tools and logger integration', () => {
    it('should coordinate between dev tools and logger during reload', () => {
      const sessionId = logger.startSession('integration-test');
      
      // Simulate a reload sequence
      logger.logReloadAttempt('test.mtm', 'modification');
      
      const startTime = Date.now();
      
      // Simulate state preservation
      logger.logStatePreservationAttempt('component1', 'signals');
      logger.logStatePreservationSuccess('component1', 'signals', 25);
      
      devTools.recordStatePreservation({
        signalsPreserved: 3,
        subscriptionsPreserved: 2,
        preservationTime: 25,
        restorationTime: 15
      });
      
      // Simulate successful reload
      const reloadTime = Date.now() - startTime;
      logger.logReloadSuccess('test.mtm', reloadTime, true);
      
      devTools.recordReloadEvent({
        filePath: 'test.mtm',
        reloadTime,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['TestComponent']
      });
      
      // Verify coordination
      const session = logger.getCurrentSession();
      expect(session!.sessionId).toBe(sessionId);
      expect(session!.metrics.reloadAttempts).toBe(1);
      expect(session!.metrics.successfulReloads).toBe(1);
      expect(session!.metrics.statePreservationAttempts).toBe(1);
      expect(session!.metrics.statePreservationSuccesses).toBe(1);
      
      const devToolsMetrics = devTools.getMetrics();
      expect(devToolsMetrics.reload.reloadCount).toBe(1);
      expect(devToolsMetrics.reload.statePreservationSuccessRate).toBe(100);
      expect(devToolsMetrics.state.signalsPreserved).toBe(3);
      expect(devToolsMetrics.state.subscriptionsPreserved).toBe(2);
    });

    it('should handle error scenarios with proper logging and metrics', () => {
      logger.startSession('error-test');
      
      // Simulate failed reload
      const error = new Error('Compilation failed');
      logger.logReloadAttempt('broken.mtm', 'modification');
      logger.logReloadFailure('broken.mtm', error);
      
      devTools.recordReloadEvent({
        filePath: 'broken.mtm',
        reloadTime: 500,
        success: false,
        statePreserved: false,
        errorMessage: error.message,
        frameworksAffected: [],
        componentsReloaded: []
      });
      
      // Simulate error recovery
      logger.logErrorRecovery(error, 'rollback to previous state');
      
      // Verify error handling
      const session = logger.getCurrentSession();
      expect(session!.metrics.reloadAttempts).toBe(1);
      expect(session!.metrics.failedReloads).toBe(1);
      expect(session!.metrics.successfulReloads).toBe(0);
      
      const devToolsMetrics = devTools.getMetrics();
      expect(devToolsMetrics.reload.failedReloads).toBe(1);
      expect(devToolsMetrics.reload.statePreservationSuccessRate).toBe(0);
      
      const errorLogs = logger.getLogs('error');
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs.some(log => log.message.includes('Reload failed'))).toBe(true);
    });

    it('should generate comprehensive reports combining all data', () => {
      logger.startSession('report-test');
      
      // Simulate multiple reloads with mixed success
      for (let i = 0; i < 5; i++) {
        const success = i < 4; // 4 successful, 1 failed
        const reloadTime = 100 + (i * 50);
        
        logger.logReloadAttempt(`test${i}.mtm`, 'modification');
        
        if (success) {
          logger.logReloadSuccess(`test${i}.mtm`, reloadTime, true);
          devTools.recordReloadEvent({
            filePath: `test${i}.mtm`,
            reloadTime,
            success: true,
            statePreserved: true,
            frameworksAffected: ['react'],
            componentsReloaded: [`Component${i}`]
          });
        } else {
          const error = new Error(`Error in test${i}.mtm`);
          logger.logReloadFailure(`test${i}.mtm`, error);
          devTools.recordReloadEvent({
            filePath: `test${i}.mtm`,
            reloadTime,
            success: false,
            statePreserved: false,
            errorMessage: error.message,
            frameworksAffected: [],
            componentsReloaded: []
          });
        }
      }
      
      // Generate reports
      const debugReport = logger.generateDebugReport();
      const performanceReport = devTools.generatePerformanceReport();
      
      // Verify debug report
      expect(debugReport).toContain('Reload Attempts: 5');
      expect(debugReport).toContain('Successful Reloads: 4');
      expect(debugReport).toContain('Failed Reloads: 1');
      
      // Verify performance report
      expect(performanceReport).toContain('Total Reloads: 5');
      expect(performanceReport).toContain('Failed Reloads: 1');
      expect(performanceReport).toContain('Success Rate: 80.00%');
      expect(performanceReport).toContain('Average Reload Time:');
      expect(performanceReport).toContain('Fastest Reload: 100.00ms');
      expect(performanceReport).toContain('Slowest Reload: 300.00ms');
    });
  });

  describe('configuration validation and error handling', () => {
    it('should validate configuration and provide helpful error messages', async () => {
      const invalidConfig = {
        debounceMs: -100,
        syncTimeout: 500,
        maxConcurrentReloads: 0,
        errorRecoveryMode: 'invalid' as any,
        logLevel: 'invalid' as any
      };

      const { validateHotReloadConfig } = await import('../../hot-reload-config.js');
      const errors = validateHotReloadConfig(invalidConfig);
      
      expect(errors).toHaveLength(5);
      expect(errors).toContain('debounceMs must be between 0 and 5000');
      expect(errors).toContain('syncTimeout must be between 1000 and 30000');
      expect(errors).toContain('maxConcurrentReloads must be between 1 and 20');
      expect(errors).toContain('errorRecoveryMode must be either "graceful" or "strict"');
      expect(errors).toContain('logLevel must be one of: error, warn, info, debug');
    });

    it('should handle disabled dev tools gracefully', () => {
      const disabledConfig = getHotReloadConfig({
        enableDevTools: false,
        enableDebugLogging: false,
        logLevel: 'error' // Set to error level so info logs are filtered out
      });
      
      const disabledDevTools = new HotReloadDevTools(disabledConfig);
      const disabledLogger = new HotReloadDebugLogger(disabledConfig);
      
      // These operations should not record anything
      disabledDevTools.recordReloadEvent({
        filePath: 'test.mtm',
        reloadTime: 150,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['TestComponent']
      });
      
      disabledLogger.log('info', 'test', 'This should not be logged');
      
      const metrics = disabledDevTools.getMetrics();
      const logs = disabledLogger.getLogs();
      
      expect(metrics.reload.reloadCount).toBe(0);
      expect(logs).toHaveLength(0);
    });
  });

  describe('performance and memory considerations', () => {
    it('should limit history size to prevent memory leaks', () => {
      // Record more events than the max history size
      for (let i = 0; i < 150; i++) {
        devTools.recordReloadEvent({
          filePath: `test${i}.mtm`,
          reloadTime: 100,
          success: true,
          statePreserved: true,
          frameworksAffected: ['react'],
          componentsReloaded: [`Component${i}`]
        });
        
        logger.log('info', 'test', `Log entry ${i}`);
      }
      
      const metrics = devTools.getMetrics();
      const logs = logger.getLogs();
      
      // Should have recorded all events in metrics
      expect(metrics.reload.reloadCount).toBe(150);
      
      // But history should be limited
      expect(metrics.reload.reloadHistory.length).toBeLessThanOrEqual(100);
      expect(logs.length).toBeLessThanOrEqual(1000);
    });
  });
});