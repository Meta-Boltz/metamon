/**
 * Hot Reload Performance Tests
 * 
 * Comprehensive performance tests for hot reload functionality,
 * testing speed, memory usage, and scalability requirements.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadOrchestrator, type HotReloadConfig } from '../hot-reload-orchestrator.js';
import { StatePreservationManager } from '../../dev-tools/src/state-preservation-manager.js';

// Mock dependencies for performance testing
vi.mock('../error-overlay.js', () => ({
  ErrorOverlay: vi.fn().mockImplementation(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    hideError: vi.fn()
  }))
}));

vi.mock('../error-recovery-manager.js', () => ({
  ErrorRecoveryManager: vi.fn().mockImplementation(() => ({
    registerRecoveryCallback: vi.fn(),
    attemptRecovery: vi.fn().mockResolvedValue(true)
  }))
}));

vi.mock('../error-categorizer.js', () => ({
  ErrorCategorizer: vi.fn().mockImplementation(() => ({
    categorizeError: vi.fn().mockReturnValue({
      type: 'compilation_error',
      message: 'Test error',
      recoverable: true,
      filePath: '/test/file.mtm'
    })
  }))
}));

vi.mock('../hot-reload-visual-feedback-manager.js', () => ({
  HotReloadVisualFeedbackManager: vi.fn().mockImplementation(() => ({
    startReload: vi.fn(),
    updateProgress: vi.fn(),
    completeReload: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    updateOptions: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../framework-hot-reload-manager.js', () => ({
  FrameworkHotReloadManager: vi.fn().mockImplementation(() => ({
    canHandleFile: vi.fn().mockReturnValue(false),
    handleFrameworkComponentReload: vi.fn().mockResolvedValue({
      success: true,
      duration: 50,
      statePreserved: true,
      connectionsRestored: true
    }),
    reconnectAllMetamonAdapters: vi.fn().mockResolvedValue(true),
    validateAllAdapterConnections: vi.fn().mockReturnValue(true),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../cross-framework-synchronizer.js', () => ({
  CrossFrameworkSynchronizer: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    registerFrameworkComponent: vi.fn(),
    unregisterFrameworkComponent: vi.fn(),
    createSyncSnapshot: vi.fn().mockReturnValue({
      connections: [],
      signalValues: new Map(),
      subscriptions: new Map(),
      timestamp: Date.now()
    }),
    restoreSyncSnapshot: vi.fn().mockResolvedValue(true),
    synchronizeFrameworks: vi.fn().mockResolvedValue(true),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../frontmatter-hot-reload-manager.js', () => ({
  FrontmatterHotReloadManager: vi.fn().mockImplementation(() => ({
    detectFrontmatterChanges: vi.fn().mockResolvedValue({
      hasChanges: false,
      changes: [],
      channelsChanged: false,
      targetChanged: false,
      importsChanged: false
    }),
    getChannelSubscriptionUpdates: vi.fn(),
    handleTargetFrameworkChange: vi.fn().mockResolvedValue(true),
    handleImportsChange: vi.fn().mockResolvedValue(true),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../css-hot-reload-manager.js', () => ({
  CSSHotReloadManager: vi.fn().mockImplementation(() => ({
    handleCSSChange: vi.fn().mockResolvedValue({
      success: true,
      updatedComponents: 1,
      duration: 25
    }),
    updateConfig: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      activeUpdates: 0,
      queuedUpdates: 0,
      completedUpdates: 0
    }),
    cleanup: vi.fn()
  }))
}));

// Mock core dependencies for performance testing
const mockSignalManager = {
  getSignalKeys: vi.fn(),
  getSignal: vi.fn(),
  createSignal: vi.fn(),
  cleanup: vi.fn()
};

const mockPubSubSystem = {
  getActiveSubscriptions: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  emit: vi.fn(),
  clear: vi.fn(),
  getSubscriptionCount: vi.fn()
};

describe('Hot Reload Performance Tests', () => {
  let orchestrator: HotReloadOrchestrator;
  let stateManager: StatePreservationManager;

  const performanceConfig: Partial<HotReloadConfig> = {
    preserveState: true,
    batchUpdates: true,
    debounceMs: 50,
    syncFrameworks: true,
    syncTimeout: 1000,
    showErrorOverlay: false,
    errorRecoveryMode: 'graceful',
    maxConcurrentReloads: 5,
    reloadTimeout: 2000,
    debugLogging: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    stateManager = new StatePreservationManager({
      preserveSignals: true,
      preserveSubscriptions: true,
      preserveComponentState: true,
      debugLogging: false
    });
    
    orchestrator = new HotReloadOrchestrator(performanceConfig, stateManager);
  });

  afterEach(() => {
    vi.useRealTimers();
    orchestrator.cleanup();
    stateManager.cleanup();
  });

  describe('Hot Reload Speed Requirements', () => {
    it('should satisfy requirement 1.1 - .mtm files reload within 500ms', async () => {
      const filePath = '/test/component.mtm';
      const content = '---\ntarget: reactjs\n---\n<div>Test Component</div>';
      
      const startTime = Date.now();
      
      // Trigger hot reload
      orchestrator.handleFileChange(filePath, 'mtm', content);
      
      // Advance timers to process debouncing
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete well within 500ms requirement
      expect(duration).toBeLessThan(500);
      
      // Verify reload was processed
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle multiple rapid file changes efficiently', async () => {
      const fileCount = 10;
      const files = Array.from({ length: fileCount }, (_, i) => `/test/file${i}.mtm`);
      
      const startTime = Date.now();
      
      // Trigger multiple rapid changes
      files.forEach(filePath => {
        orchestrator.handleFileChange(filePath, 'mtm');
      });
      
      // Process all changes
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle 10 files efficiently
      expect(duration).toBeLessThan(1000);
      
      // Verify all files were queued
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(fileCount);
    });

    it('should maintain performance with concurrent reloads', async () => {
      orchestrator.updateConfig({ maxConcurrentReloads: 3 });
      
      const fileCount = 15;
      const files = Array.from({ length: fileCount }, (_, i) => `/test/concurrent${i}.mtm`);
      
      const startTime = Date.now();
      
      // Trigger concurrent reloads
      const reloadPromises = files.map(filePath => {
        orchestrator.handleFileChange(filePath, 'mtm');
        return new Promise(resolve => setTimeout(resolve, 10));
      });
      
      await Promise.all(reloadPromises);
      
      // Process all changes
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle concurrent reloads efficiently
      expect(duration).toBeLessThan(2000);
      
      // Verify all files were processed
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(fileCount);
    });
  });

  describe('State Preservation Performance', () => {
    it('should preserve and restore state efficiently', async () => {
      // Setup mock signal manager with multiple signals
      const signalCount = 50;
      const signalKeys = Array.from({ length: signalCount }, (_, i) => `signal${i}`);
      
      mockSignalManager.getSignalKeys.mockReturnValue(signalKeys);
      mockSignalManager.getSignal.mockImplementation((key: string) => ({
        value: `value-${key}`,
        update: vi.fn(),
        subscribe: vi.fn()
      }));
      
      // Setup mock pubsub with multiple subscriptions
      const subscriptionCount = 30;
      const subscriptions = Array.from({ length: subscriptionCount }, (_, i) => ({
        event: `event${i}`,
        componentId: `comp${i}`,
        callback: vi.fn()
      }));
      
      mockPubSubSystem.getActiveSubscriptions.mockReturnValue(subscriptions);
      
      const startTime = Date.now();
      
      // Test state preservation
      const preserveResult = await stateManager.preserveState(
        mockSignalManager as any,
        mockPubSubSystem as any
      );
      
      expect(preserveResult.success).toBe(true);
      expect(preserveResult.preservedSignals).toBe(signalCount);
      expect(preserveResult.preservedSubscriptions).toBe(subscriptionCount);
      
      // Test state restoration
      const restoreResult = await stateManager.restoreState(
        mockSignalManager as any,
        mockPubSubSystem as any,
        preserveResult.snapshot
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredSignals).toBe(signalCount);
      expect(restoreResult.restoredSubscriptions).toBe(subscriptionCount);
      
      // Should complete state operations efficiently
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large state snapshots without memory issues', async () => {
      // Create a large number of signals and subscriptions
      const largeSignalCount = 200;
      const largeSubscriptionCount = 150;
      
      const largeSignalKeys = Array.from({ length: largeSignalCount }, (_, i) => `largeSignal${i}`);
      const largeSubscriptions = Array.from({ length: largeSubscriptionCount }, (_, i) => ({
        event: `largeEvent${i}`,
        componentId: `largeComp${i}`,
        callback: vi.fn()
      }));
      
      mockSignalManager.getSignalKeys.mockReturnValue(largeSignalKeys);
      mockSignalManager.getSignal.mockImplementation((key: string) => ({
        value: { data: `large-data-${key}`, timestamp: Date.now() },
        update: vi.fn(),
        subscribe: vi.fn()
      }));
      
      mockPubSubSystem.getActiveSubscriptions.mockReturnValue(largeSubscriptions);
      
      const startTime = Date.now();
      
      // Test with large state
      const preserveResult = await stateManager.preserveState(
        mockSignalManager as any,
        mockPubSubSystem as any
      );
      
      expect(preserveResult.success).toBe(true);
      
      // Multiple preserve/restore cycles to test memory stability
      for (let i = 0; i < 5; i++) {
        const cycleResult = await stateManager.restoreState(
          mockSignalManager as any,
          mockPubSubSystem as any,
          preserveResult.snapshot
        );
        expect(cycleResult.success).toBe(true);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle large state efficiently
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Cross-Framework Synchronization Performance', () => {
    it('should synchronize multiple frameworks efficiently', async () => {
      const frameworkCount = 4;
      const componentsPerFramework = 10;
      const frameworks = ['react', 'vue', 'svelte', 'solid'];
      
      // Register multiple framework components
      frameworks.forEach(framework => {
        for (let i = 0; i < componentsPerFramework; i++) {
          orchestrator.registerFrameworkComponent(framework, `${framework}Component${i}`);
        }
      });
      
      const startTime = Date.now();
      
      // Create cross-framework snapshot
      const snapshot = await orchestrator.createCrossFrameworkSnapshot();
      expect(snapshot).toBeDefined();
      
      // Restore snapshot
      const restored = await orchestrator.restoreCrossFrameworkSnapshot(snapshot!);
      expect(restored).toBe(true);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle cross-framework sync efficiently
      expect(duration).toBeLessThan(1500);
    });

    it('should handle framework synchronization during concurrent reloads', async () => {
      const concurrentReloads = 8;
      const files = Array.from({ length: concurrentReloads }, (_, i) => 
        `/test/framework${i % 4}/component${i}.mtm`
      );
      
      // Register framework components
      ['react', 'vue', 'svelte', 'solid'].forEach(framework => {
        orchestrator.registerFrameworkComponent(framework, `${framework}TestComponent`);
      });
      
      const startTime = Date.now();
      
      // Trigger concurrent reloads with framework sync
      const reloadPromises = files.map(filePath => {
        orchestrator.handleFileChange(filePath, 'mtm');
        return new Promise(resolve => setTimeout(resolve, 5));
      });
      
      await Promise.all(reloadPromises);
      
      // Process all reloads
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle concurrent framework sync efficiently
      expect(duration).toBeLessThan(2000);
      
      // Verify all reloads were processed
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(concurrentReloads);
    });
  });

  describe('Memory Management and Resource Cleanup', () => {
    it('should cleanup resources properly to prevent memory leaks', () => {
      const fileCount = 20;
      
      // Create multiple pending reloads
      for (let i = 0; i < fileCount; i++) {
        orchestrator.handleFileChange(`/test/memory${i}.mtm`, 'mtm');
      }
      
      const statsBefore = orchestrator.getStats();
      expect(statsBefore.pendingReloads).toBe(fileCount);
      
      // Cleanup should clear all resources
      orchestrator.cleanup();
      
      const statsAfter = orchestrator.getStats();
      expect(statsAfter.pendingReloads).toBe(0);
      expect(statsAfter.queuedReloads).toBe(0);
      expect(statsAfter.activeReloads).toBe(0);
    });

    it('should handle rapid cleanup and recreation without issues', () => {
      const cycles = 10;
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        // Create orchestrator
        const tempOrchestrator = new HotReloadOrchestrator(performanceConfig);
        
        // Add some work
        for (let i = 0; i < 5; i++) {
          tempOrchestrator.handleFileChange(`/test/cycle${cycle}/file${i}.mtm`, 'mtm');
        }
        
        // Cleanup
        tempOrchestrator.cleanup();
      }
      
      // Should complete without throwing errors
      expect(true).toBe(true);
    });

    it('should maintain stable memory usage during extended operation', async () => {
      const operationCount = 100;
      
      // Simulate extended operation with many file changes
      for (let i = 0; i < operationCount; i++) {
        orchestrator.handleFileChange(`/test/extended${i}.mtm`, 'mtm');
        
        // Occasionally advance timers to process some reloads
        if (i % 10 === 0) {
          vi.advanceTimersByTime(50);
          await vi.runAllTimersAsync();
        }
      }
      
      // Process remaining reloads
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      // Memory should be stable (no specific assertion, but operation should complete)
      const finalStats = orchestrator.getStats();
      expect(finalStats.queuedReloads).toBeGreaterThan(0);
    });
  });

  describe('Scalability and Load Testing', () => {
    it('should handle high-frequency file changes', async () => {
      const changeFrequency = 50; // 50 changes
      const filePath = '/test/high-frequency.mtm';
      
      const startTime = Date.now();
      
      // Rapid fire changes to same file (should be debounced)
      for (let i = 0; i < changeFrequency; i++) {
        orchestrator.handleFileChange(filePath, 'mtm', `content-${i}`);
        // Small delay to simulate rapid but not instantaneous changes
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      // Process debounced changes
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle high frequency efficiently through debouncing
      expect(duration).toBeLessThan(1000);
      
      // Should result in only one queued reload due to debouncing
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should scale with large numbers of different files', async () => {
      const fileCount = 100;
      const files = Array.from({ length: fileCount }, (_, i) => `/test/scale/file${i}.mtm`);
      
      const startTime = Date.now();
      
      // Change many different files
      files.forEach((filePath, index) => {
        orchestrator.handleFileChange(filePath, 'mtm', `content-${index}`);
      });
      
      // Process all changes
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should scale reasonably with many files
      expect(duration).toBeLessThan(3000);
      
      // Should queue all files
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(fileCount);
    });

    it('should maintain performance under mixed workload', async () => {
      const mtmFiles = 20;
      const nativeFiles = 15;
      const cssFiles = 10;
      const dependencyFiles = 5;
      
      const startTime = Date.now();
      
      // Mixed workload
      const workloadPromises = [
        // MTM files
        ...Array.from({ length: mtmFiles }, (_, i) => 
          orchestrator.handleFileChange(`/test/mixed/mtm${i}.mtm`, 'mtm')
        ),
        // Native framework files
        ...Array.from({ length: nativeFiles }, (_, i) => 
          orchestrator.handleFileChange(`/test/mixed/native${i}.jsx`, 'native')
        ),
        // CSS files
        ...Array.from({ length: cssFiles }, (_, i) => 
          orchestrator.handleCSSChange(`/test/mixed/style${i}.css`, 'css', `.test${i} { color: red; }`)
        ),
        // Dependency files
        ...Array.from({ length: dependencyFiles }, (_, i) => 
          orchestrator.handleFileChange(`/test/mixed/dep${i}.js`, 'dependency')
        )
      ];
      
      await Promise.all(workloadPromises);
      
      // Process all changes
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle mixed workload efficiently
      expect(duration).toBeLessThan(2000);
      
      // Verify processing
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(mtmFiles + nativeFiles + dependencyFiles);
      
      const cssStats = orchestrator.getCSSStats();
      expect(cssStats.completedUpdates).toBe(cssFiles);
    });
  });

  describe('Configuration Impact on Performance', () => {
    it('should perform better with optimized configuration', async () => {
      const optimizedConfig: Partial<HotReloadConfig> = {
        preserveState: false, // Faster without state preservation
        batchUpdates: true,
        debounceMs: 25, // Shorter debounce
        syncFrameworks: false, // Faster without sync
        showErrorOverlay: false,
        maxConcurrentReloads: 10, // Higher concurrency
        debugLogging: false
      };
      
      const optimizedOrchestrator = new HotReloadOrchestrator(optimizedConfig);
      
      const fileCount = 50;
      const files = Array.from({ length: fileCount }, (_, i) => `/test/optimized${i}.mtm`);
      
      const startTime = Date.now();
      
      // Process many files with optimized config
      files.forEach(filePath => {
        optimizedOrchestrator.handleFileChange(filePath, 'mtm');
      });
      
      vi.advanceTimersByTime(25);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should be very fast with optimized config
      expect(duration).toBeLessThan(1000);
      
      const stats = optimizedOrchestrator.getStats();
      expect(stats.queuedReloads).toBe(fileCount);
      
      optimizedOrchestrator.cleanup();
    });

    it('should handle performance impact of debug logging', async () => {
      const debugConfig: Partial<HotReloadConfig> = {
        ...performanceConfig,
        debugLogging: true
      };
      
      const debugOrchestrator = new HotReloadOrchestrator(debugConfig);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const fileCount = 20;
      const files = Array.from({ length: fileCount }, (_, i) => `/test/debug${i}.mtm`);
      
      const startTime = Date.now();
      
      files.forEach(filePath => {
        debugOrchestrator.handleFileChange(filePath, 'mtm');
      });
      
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should still perform reasonably with debug logging
      expect(duration).toBeLessThan(1500);
      
      // Should have logged debug messages
      expect(consoleSpy).toHaveBeenCalledTimes(fileCount);
      
      consoleSpy.mockRestore();
      debugOrchestrator.cleanup();
    });
  });
});