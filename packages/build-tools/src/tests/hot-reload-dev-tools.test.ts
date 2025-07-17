/**
 * Tests for hot reload developer tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HotReloadDevTools, initializeDevTools, getDevTools } from '../hot-reload-dev-tools.js';
import { defaultHotReloadConfig } from '../hot-reload-config.js';

describe('HotReloadDevTools', () => {
  let devTools: HotReloadDevTools;
  let config: typeof defaultHotReloadConfig;

  beforeEach(() => {
    config = {
      ...defaultHotReloadConfig,
      enableDevTools: true,
      enablePerformanceMonitoring: true,
      enableDebugLogging: true
    };
    devTools = new HotReloadDevTools(config);
  });

  describe('constructor', () => {
    it('should initialize with default metrics', () => {
      const metrics = devTools.getMetrics();
      
      expect(metrics.reload.reloadCount).toBe(0);
      expect(metrics.reload.totalReloadTime).toBe(0);
      expect(metrics.reload.averageReloadTime).toBe(0);
      expect(metrics.reload.fastestReload).toBe(Infinity);
      expect(metrics.reload.slowestReload).toBe(0);
      expect(metrics.reload.failedReloads).toBe(0);
      expect(metrics.reload.statePreservationSuccessRate).toBe(100);
      expect(metrics.reload.reloadHistory).toHaveLength(0);
    });

    it('should initialize with default state metrics', () => {
      const metrics = devTools.getMetrics();
      
      expect(metrics.state.signalsPreserved).toBe(0);
      expect(metrics.state.subscriptionsPreserved).toBe(0);
      expect(metrics.state.componentStatePreserved).toBe(0);
      expect(metrics.state.preservationFailures).toBe(0);
      expect(metrics.state.preservationTime).toBe(0);
      expect(metrics.state.restorationTime).toBe(0);
    });
  });

  describe('recordReloadEvent', () => {
    it('should record successful reload event', () => {
      devTools.recordReloadEvent({
        filePath: 'test.mtm',
        reloadTime: 150,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['TestComponent']
      });

      const metrics = devTools.getMetrics();
      expect(metrics.reload.reloadCount).toBe(1);
      expect(metrics.reload.totalReloadTime).toBe(150);
      expect(metrics.reload.averageReloadTime).toBe(150);
      expect(metrics.reload.fastestReload).toBe(150);
      expect(metrics.reload.slowestReload).toBe(150);
      expect(metrics.reload.lastReloadTime).toBe(150);
      expect(metrics.reload.failedReloads).toBe(0);
      expect(metrics.reload.statePreservationSuccessRate).toBe(100);
      expect(metrics.reload.reloadHistory).toHaveLength(1);
    });

    it('should record failed reload event', () => {
      devTools.recordReloadEvent({
        filePath: 'test.mtm',
        reloadTime: 200,
        success: false,
        statePreserved: false,
        errorMessage: 'Compilation error',
        frameworksAffected: [],
        componentsReloaded: []
      });

      const metrics = devTools.getMetrics();
      expect(metrics.reload.reloadCount).toBe(1);
      expect(metrics.reload.failedReloads).toBe(1);
      expect(metrics.reload.statePreservationSuccessRate).toBe(0);
    });

    it('should calculate correct averages with multiple events', () => {
      devTools.recordReloadEvent({
        filePath: 'test1.mtm',
        reloadTime: 100,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['Component1']
      });

      devTools.recordReloadEvent({
        filePath: 'test2.mtm',
        reloadTime: 200,
        success: true,
        statePreserved: true,
        frameworksAffected: ['vue'],
        componentsReloaded: ['Component2']
      });

      const metrics = devTools.getMetrics();
      expect(metrics.reload.reloadCount).toBe(2);
      expect(metrics.reload.totalReloadTime).toBe(300);
      expect(metrics.reload.averageReloadTime).toBe(150);
      expect(metrics.reload.fastestReload).toBe(100);
      expect(metrics.reload.slowestReload).toBe(200);
    });

    it('should not record events when dev tools are disabled', () => {
      const disabledConfig = { ...config, enableDevTools: false };
      const disabledDevTools = new HotReloadDevTools(disabledConfig);

      disabledDevTools.recordReloadEvent({
        filePath: 'test.mtm',
        reloadTime: 150,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['TestComponent']
      });

      const metrics = disabledDevTools.getMetrics();
      expect(metrics.reload.reloadCount).toBe(0);
    });
  });

  describe('recordStatePreservation', () => {
    it('should record state preservation metrics', () => {
      devTools.recordStatePreservation({
        signalsPreserved: 5,
        subscriptionsPreserved: 3,
        componentStatePreserved: 2,
        preservationTime: 50,
        restorationTime: 30
      });

      const metrics = devTools.getMetrics();
      expect(metrics.state.signalsPreserved).toBe(5);
      expect(metrics.state.subscriptionsPreserved).toBe(3);
      expect(metrics.state.componentStatePreserved).toBe(2);
      expect(metrics.state.preservationTime).toBe(50);
      expect(metrics.state.restorationTime).toBe(30);
    });

    it('should update existing metrics', () => {
      devTools.recordStatePreservation({
        signalsPreserved: 3,
        preservationTime: 25
      });

      devTools.recordStatePreservation({
        signalsPreserved: 5,
        subscriptionsPreserved: 2,
        restorationTime: 40
      });

      const metrics = devTools.getMetrics();
      expect(metrics.state.signalsPreserved).toBe(5);
      expect(metrics.state.subscriptionsPreserved).toBe(2);
      expect(metrics.state.preservationTime).toBe(25);
      expect(metrics.state.restorationTime).toBe(40);
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate comprehensive performance report', () => {
      // Record some test data
      devTools.recordReloadEvent({
        filePath: 'test1.mtm',
        reloadTime: 100,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['Component1']
      });

      devTools.recordReloadEvent({
        filePath: 'test2.mtm',
        reloadTime: 200,
        success: false,
        statePreserved: false,
        errorMessage: 'Error',
        frameworksAffected: [],
        componentsReloaded: []
      });

      devTools.recordStatePreservation({
        signalsPreserved: 5,
        subscriptionsPreserved: 3,
        preservationTime: 50
      });

      const report = devTools.generatePerformanceReport();
      
      expect(report).toContain('Total Reloads: 2');
      expect(report).toContain('Failed Reloads: 1');
      expect(report).toContain('Success Rate: 50.00%');
      expect(report).toContain('Average Reload Time: 150.00ms');
      expect(report).toContain('Fastest Reload: 100.00ms');
      expect(report).toContain('Slowest Reload: 200.00ms');
      expect(report).toContain('Signals Preserved: 5');
      expect(report).toContain('Subscriptions Preserved: 3');
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', () => {
      // Record some data
      devTools.recordReloadEvent({
        filePath: 'test.mtm',
        reloadTime: 150,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['TestComponent']
      });

      devTools.recordStatePreservation({
        signalsPreserved: 5
      });

      // Reset
      devTools.resetMetrics();

      const metrics = devTools.getMetrics();
      expect(metrics.reload.reloadCount).toBe(0);
      expect(metrics.reload.reloadHistory).toHaveLength(0);
      expect(metrics.state.signalsPreserved).toBe(0);
    });
  });

  describe('exportMetrics', () => {
    it('should export metrics as JSON string', () => {
      devTools.recordReloadEvent({
        filePath: 'test.mtm',
        reloadTime: 150,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['TestComponent']
      });

      const exported = devTools.exportMetrics();
      const parsed = JSON.parse(exported);
      
      expect(parsed.reload.reloadCount).toBe(1);
      expect(parsed.state).toBeDefined();
      expect(parsed.performance).toBeDefined();
    });
  });

  describe('setEnabled', () => {
    it('should enable/disable dev tools', () => {
      devTools.setEnabled(false);
      
      devTools.recordReloadEvent({
        filePath: 'test.mtm',
        reloadTime: 150,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['TestComponent']
      });

      const metrics = devTools.getMetrics();
      expect(metrics.reload.reloadCount).toBe(0);

      devTools.setEnabled(true);
      
      devTools.recordReloadEvent({
        filePath: 'test.mtm',
        reloadTime: 150,
        success: true,
        statePreserved: true,
        frameworksAffected: ['react'],
        componentsReloaded: ['TestComponent']
      });

      const updatedMetrics = devTools.getMetrics();
      expect(updatedMetrics.reload.reloadCount).toBe(1);
    });
  });

  describe('global functions', () => {
    it('should initialize and get global dev tools', () => {
      const globalDevTools = initializeDevTools(config);
      expect(globalDevTools).toBeInstanceOf(HotReloadDevTools);
      
      const retrieved = getDevTools();
      expect(retrieved).toBe(globalDevTools);
    });
  });
});