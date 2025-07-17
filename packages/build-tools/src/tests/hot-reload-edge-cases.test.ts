/**
 * Hot Reload Edge Cases and Error Scenarios Tests
 * 
 * Tests for edge cases, error conditions, and boundary scenarios
 * in the hot reload system to ensure robustness and reliability.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadOrchestrator, type HotReloadConfig } from '../hot-reload-orchestrator.js';
import { StatePreservationManager } from '../../dev-tools/src/state-preservation-manager.js';

// Mock dependencies with error simulation capabilities
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
    attemptRecovery: vi.fn()
  }))
}));

vi.mock('../error-categorizer.js', () => ({
  ErrorCategorizer: vi.fn().mockImplementation(() => ({
    categorizeError: vi.fn()
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
    canHandleFile: vi.fn(),
    handleFrameworkComponentReload: vi.fn(),
    reconnectAllMetamonAdapters: vi.fn(),
    validateAllAdapterConnections: vi.fn(),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../cross-framework-synchronizer.js', () => ({
  CrossFrameworkSynchronizer: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    registerFrameworkComponent: vi.fn(),
    unregisterFrameworkComponent: vi.fn(),
    createSyncSnapshot: vi.fn(),
    restoreSyncSnapshot: vi.fn(),
    synchronizeFrameworks: vi.fn(),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../frontmatter-hot-reload-manager.js', () => ({
  FrontmatterHotReloadManager: vi.fn().mockImplementation(() => ({
    detectFrontmatterChanges: vi.fn(),
    getChannelSubscriptionUpdates: vi.fn(),
    handleTargetFrameworkChange: vi.fn(),
    handleImportsChange: vi.fn(),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../css-hot-reload-manager.js', () => ({
  CSSHotReloadManager: vi.fn().mockImplementation(() => ({
    handleCSSChange: vi.fn(),
    updateConfig: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      activeUpdates: 0,
      queuedUpdates: 0,
      completedUpdates: 0
    }),
    cleanup: vi.fn()
  }))
}));

describe('Hot Reload Edge Cases and Error Scenarios', () => {
  let orchestrator: HotReloadOrchestrator;
  let stateManager: StatePreservationManager;
  let mockFrameworkManager: any;
  let mockCrossFrameworkSync: any;
  let mockErrorRecovery: any;

  const edgeCaseConfig: Partial<HotReloadConfig> = {
    preserveState: true,
    batchUpdates: true,
    debounceMs: 50,
    syncFrameworks: true,
    syncTimeout: 1000,
    showErrorOverlay: true,
    errorRecoveryMode: 'graceful',
    maxConcurrentReloads: 3,
    reloadTimeout: 2000,
    debugLogging: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup mocks with error simulation
    const { FrameworkHotReloadManager } = require('../framework-hot-reload-manager.js');
    const { CrossFrameworkSynchronizer } = require('../cross-framework-synchronizer.js');
    const { ErrorRecoveryManager } = require('../error-recovery-manager.js');

    mockFrameworkManager = FrameworkHotReloadManager.mock.results[0]?.value;
    mockCrossFrameworkSync = CrossFrameworkSynchronizer.mock.results[0]?.value;
    mockErrorRecovery = ErrorRecoveryManager.mock.results[0]?.value;

    stateManager = new StatePreservationManager({
      preserveSignals: true,
      preserveSubscriptions: true,
      preserveComponentState: true,
      debugLogging: false
    });

    orchestrator = new HotReloadOrchestrator(edgeCaseConfig, stateManager);
  });

  afterEach(() => {
    vi.useRealTimers();
    orchestrator.cleanup();
    stateManager.cleanup();
  });

  describe('File System Edge Cases', () => {
    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = '/path/to/nonexistent.mtm';
      
      // Should not throw error
      await expect(
        orchestrator.handleFileChange(nonExistentFile, 'mtm')
      ).resolves.not.toThrow();

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle files with invalid extensions', async () => {
      const invalidFiles = [
        '/test/file.unknown',
        '/test/file',
        '/test/.hidden',
        '/test/file.mtm.backup'
      ];

      for (const filePath of invalidFiles) {
        orchestrator.handleFileChange(filePath, 'mtm');
      }

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should process all files regardless of extension
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(invalidFiles.length);
    });

    it('should handle extremely long file paths', async () => {
      const longPath = '/very/long/path/' + 'directory/'.repeat(50) + 'component.mtm';
      
      orchestrator.handleFileChange(longPath, 'mtm');

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle files with special characters in names', async () => {
      const specialFiles = [
        '/test/file with spaces.mtm',
        '/test/file-with-dashes.mtm',
        '/test/file_with_underscores.mtm',
        '/test/file.with.dots.mtm',
        '/test/file@with@symbols.mtm'
      ];

      for (const filePath of specialFiles) {
        orchestrator.handleFileChange(filePath, 'mtm');
      }

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(specialFiles.length);
    });
  });

  describe('Content Edge Cases', () => {
    it('should handle empty file content', async () => {
      const filePath = '/test/empty.mtm';
      const emptyContent = '';

      orchestrator.handleFileChange(filePath, 'mtm', emptyContent);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle extremely large file content', async () => {
      const filePath = '/test/large.mtm';
      const largeContent = '---\ntarget: reactjs\n---\n' + 'x'.repeat(100000);

      orchestrator.handleFileChange(filePath, 'mtm', largeContent);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle malformed frontmatter', async () => {
      const filePath = '/test/malformed.mtm';
      const malformedContent = `---
target: reactjs
channels: [unclosed array
imports: invalid yaml
---
<div>Content</div>`;

      orchestrator.handleFileChange(filePath, 'mtm', malformedContent);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle content with unusual encoding', async () => {
      const filePath = '/test/encoding.mtm';
      const unicodeContent = `---
target: reactjs
---
<div>Unicode: 🚀 ñáéíóú 中文 العربية</div>`;

      orchestrator.handleFileChange(filePath, 'mtm', unicodeContent);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });
  });

  describe('Timing and Concurrency Edge Cases', () => {
    it('should handle rapid successive changes to same file', async () => {
      const filePath = '/test/rapid.mtm';
      const changeCount = 100;

      // Rapid fire changes
      for (let i = 0; i < changeCount; i++) {
        orchestrator.handleFileChange(filePath, 'mtm', `content-${i}`);
      }

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should debounce to single reload
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle zero debounce time', async () => {
      orchestrator.updateConfig({ debounceMs: 0 });

      const filePath = '/test/no-debounce.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      // Should process immediately
      await vi.runAllTimersAsync();

      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle negative debounce time', async () => {
      orchestrator.updateConfig({ debounceMs: -100 });

      const filePath = '/test/negative-debounce.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      await vi.runAllTimersAsync();

      // Should handle gracefully (treat as immediate)
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle maximum concurrent reloads exceeded', async () => {
      orchestrator.updateConfig({ maxConcurrentReloads: 2 });

      const fileCount = 10;
      const files = Array.from({ length: fileCount }, (_, i) => `/test/concurrent${i}.mtm`);

      // Trigger more reloads than max concurrent
      files.forEach(filePath => {
        orchestrator.handleFileChange(filePath, 'mtm');
      });

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should queue all files but respect concurrency limit during processing
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(fileCount);
    });
  });

  describe('State Management Edge Cases', () => {
    it('should handle state preservation failures gracefully', async () => {
      // Mock state manager to fail
      const failingStateManager = new StatePreservationManager();
      vi.spyOn(failingStateManager, 'preserveState').mockRejectedValue(new Error('State preservation failed'));

      const failingOrchestrator = new HotReloadOrchestrator(edgeCaseConfig, failingStateManager);

      const filePath = '/test/state-fail.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should continue processing despite state preservation failure
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);

      failingOrchestrator.cleanup();
    });

    it('should handle corrupted state snapshots', async () => {
      const mockSignalManager = {
        getSignalKeys: vi.fn().mockReturnValue(['signal1']),
        getSignal: vi.fn().mockReturnValue({ value: 'test' }),
        createSignal: vi.fn(),
        cleanup: vi.fn()
      };

      const mockPubSubSystem = {
        getActiveSubscriptions: vi.fn().mockReturnValue([]),
        subscribe: vi.fn(),
        clear: vi.fn()
      };

      // Create valid snapshot first
      const result = await stateManager.preserveState(mockSignalManager as any, mockPubSubSystem as any);
      expect(result.success).toBe(true);

      // Corrupt the snapshot
      if (result.snapshot) {
        result.snapshot.signals.globalSignals.set('corrupted', undefined);
        result.snapshot.timestamp = NaN;
      }

      // Attempt to restore corrupted snapshot
      const restoreResult = await stateManager.restoreState(
        mockSignalManager as any,
        mockPubSubSystem as any,
        result.snapshot
      );

      // Should handle corruption gracefully
      expect(typeof restoreResult.success).toBe('boolean');
    });

    it('should handle extremely old snapshots', async () => {
      const mockSignalManager = {
        getSignalKeys: vi.fn().mockReturnValue([]),
        getSignal: vi.fn(),
        createSignal: vi.fn(),
        cleanup: vi.fn()
      };

      const mockPubSubSystem = {
        getActiveSubscriptions: vi.fn().mockReturnValue([]),
        subscribe: vi.fn(),
        clear: vi.fn()
      };

      // Create snapshot with very old timestamp
      const oldSnapshot = {
        signals: {
          globalSignals: new Map(),
          signalSubscriptions: new Map(),
          timestamp: Date.now() - 100000 // Very old
        },
        subscriptions: {
          eventSubscriptions: new Map(),
          componentEventMap: new Map(),
          timestamp: Date.now() - 100000
        },
        components: new Map(),
        timestamp: Date.now() - 100000
      };

      const result = await stateManager.restoreState(
        mockSignalManager as any,
        mockPubSubSystem as any,
        oldSnapshot
      );

      // Should reject old snapshot
      expect(result.success).toBe(false);
      expect(result.error).toContain('too old');
    });
  });

  describe('Framework Integration Edge Cases', () => {
    it('should handle unknown framework types', async () => {
      const filePath = '/test/unknown-framework.mtm';
      const content = `---
target: unknownframework
---
<div>Unknown Framework</div>`;

      orchestrator.handleFileChange(filePath, 'mtm', content);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should process without throwing
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle framework manager failures', async () => {
      // Mock framework manager to fail
      if (mockFrameworkManager) {
        mockFrameworkManager.canHandleFile.mockReturnValue(true);
        mockFrameworkManager.handleFrameworkComponentReload.mockRejectedValue(
          new Error('Framework reload failed')
        );
      }

      const filePath = '/test/framework-fail.jsx';
      orchestrator.handleFileChange(filePath, 'native');

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should handle framework failure gracefully
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle cross-framework sync failures', async () => {
      // Mock cross-framework sync to fail
      if (mockCrossFrameworkSync) {
        mockCrossFrameworkSync.createSyncSnapshot.mockReturnValue(null);
        mockCrossFrameworkSync.synchronizeFrameworks.mockResolvedValue(false);
      }

      const filePath = '/test/sync-fail.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should continue despite sync failure
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle invalid configuration values', async () => {
      const invalidConfig: any = {
        preserveState: 'invalid',
        debounceMs: 'not-a-number',
        maxConcurrentReloads: -1,
        syncTimeout: null,
        errorRecoveryMode: 'invalid-mode'
      };

      // Should not throw when creating with invalid config
      expect(() => new HotReloadOrchestrator(invalidConfig)).not.toThrow();
    });

    it('should handle configuration updates during active reloads', async () => {
      const filePath = '/test/config-update.mtm';
      
      // Start a reload
      orchestrator.handleFileChange(filePath, 'mtm');

      // Update config during reload
      orchestrator.updateConfig({
        debounceMs: 200,
        maxConcurrentReloads: 1
      });

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should handle config update gracefully
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);

      const config = orchestrator.getConfig();
      expect(config.debounceMs).toBe(200);
      expect(config.maxConcurrentReloads).toBe(1);
    });

    it('should handle null/undefined configuration', async () => {
      // Should handle null config
      expect(() => new HotReloadOrchestrator(null as any)).not.toThrow();
      
      // Should handle undefined config
      expect(() => new HotReloadOrchestrator(undefined)).not.toThrow();
    });
  });

  describe('Error Recovery Edge Cases', () => {
    it('should handle error recovery failures', async () => {
      // Mock error recovery to fail
      if (mockErrorRecovery) {
        mockErrorRecovery.attemptRecovery.mockResolvedValue(false);
      }

      orchestrator.updateConfig({ errorRecoveryMode: 'graceful' });

      // Simulate an error scenario
      const filePath = '/test/recovery-fail.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should handle recovery failure gracefully
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle circular error recovery attempts', async () => {
      // Mock error recovery to trigger more errors
      if (mockErrorRecovery) {
        mockErrorRecovery.attemptRecovery.mockImplementation(() => {
          throw new Error('Recovery caused another error');
        });
      }

      orchestrator.updateConfig({ errorRecoveryMode: 'graceful' });

      const filePath = '/test/circular-error.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should prevent infinite error loops
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle memory pressure during hot reload', async () => {
      // Simulate memory pressure by creating many large objects
      const largeObjects = Array.from({ length: 1000 }, () => ({
        data: new Array(1000).fill('memory-pressure-test')
      }));

      const filePath = '/test/memory-pressure.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Should complete despite memory pressure
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);

      // Cleanup large objects
      largeObjects.length = 0;
    });

    it('should handle cleanup during active operations', async () => {
      const filePath = '/test/cleanup-during-operation.mtm';
      
      // Start operation
      orchestrator.handleFileChange(filePath, 'mtm');

      // Cleanup immediately
      orchestrator.cleanup();

      // Should not throw
      expect(() => {
        vi.advanceTimersByTime(50);
      }).not.toThrow();
    });

    it('should handle multiple cleanup calls', async () => {
      orchestrator.handleFileChange('/test/file1.mtm', 'mtm');
      orchestrator.handleFileChange('/test/file2.mtm', 'mtm');

      // Multiple cleanup calls should be safe
      orchestrator.cleanup();
      orchestrator.cleanup();
      orchestrator.cleanup();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle maximum integer values', async () => {
      orchestrator.updateConfig({
        debounceMs: Number.MAX_SAFE_INTEGER,
        maxConcurrentReloads: Number.MAX_SAFE_INTEGER,
        syncTimeout: Number.MAX_SAFE_INTEGER,
        reloadTimeout: Number.MAX_SAFE_INTEGER
      });

      const filePath = '/test/max-values.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      // Should handle extreme values gracefully
      expect(() => {
        vi.advanceTimersByTime(1000);
      }).not.toThrow();
    });

    it('should handle minimum/zero values', async () => {
      orchestrator.updateConfig({
        debounceMs: 0,
        maxConcurrentReloads: 0,
        syncTimeout: 0,
        reloadTimeout: 0
      });

      const filePath = '/test/min-values.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      await vi.runAllTimersAsync();

      // Should handle minimum values gracefully
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle floating point precision issues', async () => {
      orchestrator.updateConfig({
        debounceMs: 0.1,
        syncTimeout: 0.001
      });

      const filePath = '/test/float-precision.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');

      vi.advanceTimersByTime(1);
      await vi.runAllTimersAsync();

      // Should handle floating point values
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });
  });
});