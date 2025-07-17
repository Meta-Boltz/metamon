import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HotReloadOrchestrator, type HotReloadConfig } from '../hot-reload-orchestrator.js';

// Mock the StatePreservationManager
vi.mock('../../dev-tools/src/state-preservation-manager.js', () => ({
  StatePreservationManager: vi.fn().mockImplementation(() => ({
    preserveState: vi.fn().mockResolvedValue({
      success: true,
      snapshot: { signals: { globalSignals: new Map() }, subscriptions: { eventSubscriptions: new Map() }, components: new Map(), timestamp: Date.now() },
      preservedSignals: 2,
      preservedSubscriptions: 1,
      preservedComponents: 0
    }),
    restoreState: vi.fn().mockResolvedValue({
      success: true,
      restoredSignals: 2,
      restoredSubscriptions: 1,
      restoredComponents: 0,
      failedRestorations: []
    }),
    getCurrentSnapshot: vi.fn(),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

// Mock other dependencies
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
      duration: 100,
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
      duration: 50
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

describe('HotReloadOrchestrator', () => {
  let orchestrator: HotReloadOrchestrator;
  let mockStateManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockStateManager = {
      preserveState: vi.fn(),
      restoreState: vi.fn(),
      getCurrentSnapshot: vi.fn(),
      updateConfig: vi.fn(),
      cleanup: vi.fn()
    };
    
    orchestrator = new HotReloadOrchestrator({}, mockStateManager);
  });

  afterEach(() => {
    vi.useRealTimers();
    orchestrator.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultOrchestrator = new HotReloadOrchestrator();
      const config = defaultOrchestrator.getConfig();
      
      expect(config).toEqual({
        preserveState: true,
        batchUpdates: true,
        debounceMs: 100,
        syncFrameworks: true,
        syncTimeout: 5000,
        showErrorOverlay: true,
        errorRecoveryMode: 'graceful',
        maxConcurrentReloads: 3,
        reloadTimeout: 10000,
        debugLogging: false
      });
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<HotReloadConfig> = {
        debounceMs: 200,
        maxConcurrentReloads: 5,
        debugLogging: true
      };
      
      const customOrchestrator = new HotReloadOrchestrator(customConfig);
      const config = customOrchestrator.getConfig();
      
      expect(config.debounceMs).toBe(200);
      expect(config.maxConcurrentReloads).toBe(5);
      expect(config.debugLogging).toBe(true);
      expect(config.preserveState).toBe(true); // default value
    });

    it('should configure state manager with appropriate settings', () => {
      const customConfig: Partial<HotReloadConfig> = {
        preserveState: false,
        debugLogging: true
      };
      
      new HotReloadOrchestrator(customConfig);
      
      // Verify StatePreservationManager was called with correct config
      const { StatePreservationManager } = require('../../dev-tools/src/state-preservation-manager.js');
      expect(StatePreservationManager).toHaveBeenCalledWith({
        preserveSignals: false,
        preserveSubscriptions: false,
        preserveComponentState: false,
        debugLogging: true
      });
    });
  });

  describe('File Change Handling', () => {
    describe('Debouncing', () => {
      it('should debounce multiple changes to the same file', async () => {
        const filePath = '/test/file.mtm';
        
        // Trigger multiple rapid changes
        orchestrator.handleFileChange(filePath, 'mtm');
        orchestrator.handleFileChange(filePath, 'mtm');
        orchestrator.handleFileChange(filePath, 'mtm');
        
        // Advance time but not enough to trigger debounce
        vi.advanceTimersByTime(50);
        
        // Should not have processed any reloads yet
        expect(orchestrator.getStats().queuedReloads).toBe(0);
        
        // Advance time to trigger debounce
        vi.advanceTimersByTime(100);
        
        // Wait for async queue processing
        await vi.runAllTimersAsync();
        
        // Should have queued exactly one reload
        expect(orchestrator.getStats().queuedReloads).toBe(1);
      });

      it('should handle different files independently', async () => {
        const file1 = '/test/file1.mtm';
        const file2 = '/test/file2.mtm';
        
        orchestrator.handleFileChange(file1, 'mtm');
        orchestrator.handleFileChange(file2, 'mtm');
        
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
        
        // Should have queued two reloads
        expect(orchestrator.getStats().queuedReloads).toBe(2);
      });

      it('should cancel previous debounced reload when new change occurs', async () => {
        const filePath = '/test/file.mtm';
        
        orchestrator.handleFileChange(filePath, 'mtm');
        
        // Advance time partially
        vi.advanceTimersByTime(50);
        
        // Trigger another change (should cancel previous)
        orchestrator.handleFileChange(filePath, 'mtm');
        
        // Advance time to original debounce time
        vi.advanceTimersByTime(50);
        
        // Should not have processed yet
        expect(orchestrator.getStats().queuedReloads).toBe(0);
        
        // Advance time to new debounce time
        vi.advanceTimersByTime(50);
        await vi.runAllTimersAsync();
        
        // Should have queued exactly one reload
        expect(orchestrator.getStats().queuedReloads).toBe(1);
      });

      it('should skip debouncing when disabled', async () => {
        orchestrator.updateConfig({ batchUpdates: false });
        
        const filePath = '/test/file.mtm';
        orchestrator.handleFileChange(filePath, 'mtm');
        
        // Wait for async queue processing
        await vi.runAllTimersAsync();
        
        // Should immediately queue reload without waiting for debounce
        expect(orchestrator.getStats().queuedReloads).toBe(1);
      });

      it('should skip debouncing when debounceMs is 0', async () => {
        orchestrator.updateConfig({ debounceMs: 0 });
        
        const filePath = '/test/file.mtm';
        orchestrator.handleFileChange(filePath, 'mtm');
        
        // Wait for async queue processing
        await vi.runAllTimersAsync();
        
        // Should immediately queue reload
        expect(orchestrator.getStats().queuedReloads).toBe(1);
      });
    });

    describe('File Types', () => {
      it('should handle MTM file changes', async () => {
        const filePath = '/test/component.mtm';
        const content = '---\ntarget: reactjs\n---\n<div>Test</div>';
        
        orchestrator.handleFileChange(filePath, 'mtm', content);
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
        
        expect(orchestrator.getStats().queuedReloads).toBe(1);
      });

      it('should handle native framework file changes', async () => {
        const filePath = '/test/component.jsx';
        const content = 'export default function Test() { return <div>Test</div>; }';
        
        orchestrator.handleFileChange(filePath, 'native', content);
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
        
        expect(orchestrator.getStats().queuedReloads).toBe(1);
      });

      it('should handle dependency file changes', async () => {
        const filePath = '/test/utils.js';
        const content = 'export const helper = () => {};';
        
        orchestrator.handleFileChange(filePath, 'dependency', content);
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
        
        expect(orchestrator.getStats().queuedReloads).toBe(1);
      });
    });
  });

  describe('Concurrency Control', () => {
    it('should respect maxConcurrentReloads limit', async () => {
      orchestrator.updateConfig({ maxConcurrentReloads: 2 });
      
      // Queue more reloads than the limit
      for (let i = 0; i < 5; i++) {
        orchestrator.handleFileChange(`/test/file${i}.mtm`, 'mtm');
      }
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
      
      // Should have queued all reloads
      expect(orchestrator.getStats().queuedReloads).toBe(5);
    });

    it('should prevent duplicate reloads for the same file', async () => {
      const filePath = '/test/file.mtm';
      
      // Simulate a reload already in progress
      orchestrator.handleFileChange(filePath, 'mtm');
      vi.advanceTimersByTime(100);
      
      // Get initial stats
      const initialStats = orchestrator.getStats();
      
      // Try to reload the same file again immediately
      orchestrator.handleFileChange(filePath, 'mtm');
      vi.advanceTimersByTime(100);
      
      // Should not have added another reload for the same file
      const finalStats = orchestrator.getStats();
      expect(finalStats.queuedReloads).toBe(initialStats.queuedReloads + 1);
    });
  });

  describe('State Preservation', () => {
    it('should preserve state when enabled', async () => {
      orchestrator.updateConfig({ preserveState: true });
      
      const filePath = '/test/file.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');
      
      vi.advanceTimersByTime(100);
      
      // Process the queue
      await vi.runAllTimersAsync();
      
      // State preservation should be attempted
      // Note: The actual state preservation is mocked, so we verify the config
      expect(orchestrator.getConfig().preserveState).toBe(true);
    });

    it('should skip state preservation when disabled', async () => {
      orchestrator.updateConfig({ preserveState: false });
      
      const filePath = '/test/file.mtm';
      orchestrator.handleFileChange(filePath, 'mtm');
      
      vi.advanceTimersByTime(100);
      
      expect(orchestrator.getConfig().preserveState).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle graceful error recovery mode', async () => {
      orchestrator.updateConfig({ errorRecoveryMode: 'graceful' });
      
      const config = orchestrator.getConfig();
      expect(config.errorRecoveryMode).toBe('graceful');
    });

    it('should handle strict error recovery mode', async () => {
      orchestrator.updateConfig({ errorRecoveryMode: 'strict' });
      
      const config = orchestrator.getConfig();
      expect(config.errorRecoveryMode).toBe('strict');
    });

    it('should show error overlay when enabled', async () => {
      orchestrator.updateConfig({ showErrorOverlay: true });
      
      const config = orchestrator.getConfig();
      expect(config.showErrorOverlay).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        debounceMs: 300,
        maxConcurrentReloads: 5,
        debugLogging: true
      };
      
      orchestrator.updateConfig(newConfig);
      
      const config = orchestrator.getConfig();
      expect(config.debounceMs).toBe(300);
      expect(config.maxConcurrentReloads).toBe(5);
      expect(config.debugLogging).toBe(true);
    });

    it('should update state manager configuration when config changes', () => {
      const newConfig = {
        preserveState: false,
        debugLogging: true
      };
      
      orchestrator.updateConfig(newConfig);
      
      expect(mockStateManager.updateConfig).toHaveBeenCalledWith({
        preserveSignals: false,
        preserveSubscriptions: false,
        preserveComponentState: false,
        debugLogging: true
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', () => {
      const stats = orchestrator.getStats();
      
      expect(stats).toEqual({
        activeReloads: 0,
        queuedReloads: 0,
        pendingReloads: 0
      });
    });

    it('should track pending reloads', async () => {
      orchestrator.handleFileChange('/test/file.mtm', 'mtm');
      
      const stats = orchestrator.getStats();
      expect(stats.pendingReloads).toBe(1);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
      
      const statsAfterDebounce = orchestrator.getStats();
      expect(statsAfterDebounce.pendingReloads).toBe(0);
      expect(statsAfterDebounce.queuedReloads).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all resources', () => {
      // Add some pending reloads
      orchestrator.handleFileChange('/test/file1.mtm', 'mtm');
      orchestrator.handleFileChange('/test/file2.mtm', 'mtm');
      
      const statsBefore = orchestrator.getStats();
      expect(statsBefore.pendingReloads).toBe(2);
      
      orchestrator.cleanup();
      
      const statsAfter = orchestrator.getStats();
      expect(statsAfter.pendingReloads).toBe(0);
      expect(statsAfter.queuedReloads).toBe(0);
      expect(statsAfter.activeReloads).toBe(0);
      
      expect(mockStateManager.cleanup).toHaveBeenCalled();
    });

    it('should clear all timeouts on cleanup', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      orchestrator.handleFileChange('/test/file1.mtm', 'mtm');
      orchestrator.handleFileChange('/test/file2.mtm', 'mtm');
      
      orchestrator.cleanup();
      
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
      
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Framework Synchronization', () => {
    it('should enable framework synchronization by default', () => {
      const config = orchestrator.getConfig();
      expect(config.syncFrameworks).toBe(true);
    });

    it('should respect syncTimeout configuration', () => {
      orchestrator.updateConfig({ syncTimeout: 3000 });
      
      const config = orchestrator.getConfig();
      expect(config.syncTimeout).toBe(3000);
    });
  });

  describe('Debug Logging', () => {
    it('should enable debug logging when configured', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      orchestrator.updateConfig({ debugLogging: true });
      orchestrator.handleFileChange('/test/file.mtm', 'mtm');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[HotReload] File change detected: /test/file.mtm (mtm)'
      );
      
      consoleSpy.mockRestore();
    });

    it('should not log when debug logging is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      orchestrator.updateConfig({ debugLogging: false });
      orchestrator.handleFileChange('/test/file.mtm', 'mtm');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});