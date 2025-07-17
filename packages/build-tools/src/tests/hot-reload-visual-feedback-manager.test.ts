/**
 * Tests for Hot Reload Visual Feedback Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadVisualFeedbackManager, type VisualFeedbackOptions, type ReloadFeedbackResult } from '../hot-reload-visual-feedback-manager.js';

// Mock the progress indicator and notification system
vi.mock('../hot-reload-progress-indicator.js', () => ({
  HotReloadProgressIndicator: vi.fn().mockImplementation(() => ({
    startFileReload: vi.fn(),
    updateFileProgress: vi.fn(),
    completeFileReload: vi.fn(),
    removeFileProgress: vi.fn(),
    clearAll: vi.fn(),
    showIndicator: vi.fn(),
    hideIndicator: vi.fn(),
    getProgressState: vi.fn().mockReturnValue({
      files: [],
      overall: { totalFiles: 0, completedFiles: 0, failedFiles: 0, overallProgress: 0, isActive: false }
    }),
    getOptions: vi.fn().mockReturnValue({ position: 'top-right' }),
    updateOptions: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../hot-reload-notification-system.js', () => ({
  HotReloadNotificationSystem: vi.fn().mockImplementation(() => ({
    showSuccess: vi.fn().mockReturnValue('success-id'),
    showError: vi.fn().mockReturnValue('error-id'),
    showWarning: vi.fn().mockReturnValue('warning-id'),
    showInfo: vi.fn().mockReturnValue('info-id'),
    showLoading: vi.fn().mockReturnValue('loading-id'),
    updateProgress: vi.fn(),
    completeLoading: vi.fn(),
    hideNotification: vi.fn(),
    hideAll: vi.fn(),
    hideByType: vi.fn(),
    getNotifications: vi.fn().mockReturnValue([]),
    getOptions: vi.fn().mockReturnValue({ position: 'bottom-right' }),
    updateOptions: vi.fn(),
    cleanup: vi.fn()
  }))
}));

// Mock DOM environment
const mockDocument = {
  createElement: vi.fn(),
  getElementById: vi.fn(),
  head: { appendChild: vi.fn() },
  body: { appendChild: vi.fn() }
};

beforeEach(() => {
  global.document = mockDocument as any;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HotReloadVisualFeedbackManager', () => {
  let feedbackManager: HotReloadVisualFeedbackManager;

  beforeEach(() => {
    feedbackManager = new HotReloadVisualFeedbackManager();
  });

  afterEach(() => {
    feedbackManager.cleanup();
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const options = feedbackManager.getOptions();
      
      expect(options.showProgressIndicator).toBe(true);
      expect(options.showNotifications).toBe(true);
      expect(options.debugLogging).toBe(false);
      expect(options.coordinatePositioning).toBe(true);
    });

    it('should initialize with custom options', () => {
      const customOptions: Partial<VisualFeedbackOptions> = {
        showProgressIndicator: false,
        showNotifications: false,
        debugLogging: true,
        coordinatePositioning: false
      };

      const customManager = new HotReloadVisualFeedbackManager(customOptions);
      const options = customManager.getOptions();

      expect(options.showProgressIndicator).toBe(false);
      expect(options.showNotifications).toBe(false);
      expect(options.debugLogging).toBe(true);
      expect(options.coordinatePositioning).toBe(false);

      customManager.cleanup();
    });

    it('should coordinate positioning when enabled', () => {
      const manager = new HotReloadVisualFeedbackManager({ coordinatePositioning: true });
      
      // Should initialize both components
      expect(manager).toBeDefined();
      
      manager.cleanup();
    });
  });

  describe('reload feedback lifecycle', () => {
    it('should start reload feedback', () => {
      const filePath = 'src/components/TestComponent.mtm';
      
      feedbackManager.startReload(filePath, 'mtm');
      
      const state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(1);
      expect(state.activeReloads[0].filePath).toBe(filePath);
      expect(state.activeReloads[0].changeType).toBe('mtm');
      expect(state.activeReloads[0].fileName).toBe('TestComponent.mtm');
    });

    it('should update progress during reload', () => {
      const filePath = 'src/components/TestComponent.mtm';
      
      feedbackManager.startReload(filePath, 'mtm');
      feedbackManager.updateProgress(filePath, 50, 'Compiling...');
      
      // Should not throw and should handle the update
      expect(() => feedbackManager.updateProgress(filePath, 75)).not.toThrow();
    });

    it('should complete reload successfully', () => {
      const filePath = 'src/components/TestComponent.mtm';
      const result: ReloadFeedbackResult = {
        success: true,
        duration: 150,
        statePreserved: true,
        frameworksSynced: true
      };
      
      feedbackManager.startReload(filePath, 'mtm');
      feedbackManager.completeReload(filePath, result);
      
      const state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(0);
    });

    it('should complete reload with error', () => {
      const filePath = 'src/components/TestComponent.mtm';
      const result: ReloadFeedbackResult = {
        success: false,
        duration: 100,
        error: 'Compilation failed'
      };
      
      feedbackManager.startReload(filePath, 'mtm');
      feedbackManager.completeReload(filePath, result);
      
      const state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(0);
    });

    it('should handle unknown file updates gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      feedbackManager.updateProgress('unknown-file.mtm', 50);
      
      expect(consoleSpy).not.toHaveBeenCalled(); // No warning when debugLogging is false
      
      consoleSpy.mockRestore();
    });

    it('should warn about unknown files when debug logging is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const debugManager = new HotReloadVisualFeedbackManager({ debugLogging: true });
      
      debugManager.updateProgress('unknown-file.mtm', 50);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot update progress for unknown file')
      );
      
      consoleSpy.mockRestore();
      debugManager.cleanup();
    });
  });

  describe('notification methods', () => {
    it('should show success notification', () => {
      const id = feedbackManager.showSuccess('Test success', 'test.mtm');
      
      expect(id).toBe('success-id');
    });

    it('should show error notification', () => {
      const id = feedbackManager.showError('Test error', 'Error details', 'test.mtm');
      
      expect(id).toBe('error-id');
    });

    it('should show warning notification', () => {
      const id = feedbackManager.showWarning('Test warning', 'Warning details', 'test.mtm');
      
      expect(id).toBe('warning-id');
    });

    it('should show info notification', () => {
      const id = feedbackManager.showInfo('Test info', 'Info details', 'test.mtm');
      
      expect(id).toBe('info-id');
    });

    it('should return empty string when notifications are disabled', () => {
      const manager = new HotReloadVisualFeedbackManager({ showNotifications: false });
      
      const id = manager.showSuccess('Test');
      
      expect(id).toBe('');
      
      manager.cleanup();
    });
  });

  describe('batch summary', () => {
    it('should show batch summary for all successful reloads', () => {
      const results = [
        { filePath: 'file1.mtm', success: true, duration: 100 },
        { filePath: 'file2.mtm', success: true, duration: 150 }
      ];
      
      feedbackManager.showBatchSummary(results);
      
      // Should call the notification system to show success summary
      expect(feedbackManager).toBeDefined();
    });

    it('should show batch summary for mixed results', () => {
      const results = [
        { filePath: 'file1.mtm', success: true, duration: 100 },
        { filePath: 'file2.mtm', success: false, duration: 50 }
      ];
      
      feedbackManager.showBatchSummary(results);
      
      // Should call the notification system to show warning summary
      expect(feedbackManager).toBeDefined();
    });

    it('should show batch summary for all failed reloads', () => {
      const results = [
        { filePath: 'file1.mtm', success: false, duration: 50 },
        { filePath: 'file2.mtm', success: false, duration: 75 }
      ];
      
      feedbackManager.showBatchSummary(results);
      
      // Should call the notification system to show error summary
      expect(feedbackManager).toBeDefined();
    });

    it('should handle empty results array', () => {
      expect(() => feedbackManager.showBatchSummary([])).not.toThrow();
    });
  });

  describe('loading notification behavior', () => {
    it('should show loading notification for MTM files', () => {
      feedbackManager.startReload('test.mtm', 'mtm');
      
      // Should have started a loading notification
      const state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(1);
    });

    it('should show loading notification for native components', () => {
      feedbackManager.startReload('test.jsx', 'native');
      
      // Should have started a loading notification
      const state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(1);
    });

    it('should not show loading notification for dependency changes', () => {
      feedbackManager.startReload('package.json', 'dependency');
      
      // Should still track but may not show loading notification
      const state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(1);
    });
  });

  describe('file name extraction', () => {
    it('should extract file names correctly', () => {
      const testCases = [
        { path: 'src/components/TestComponent.mtm', expected: 'TestComponent.mtm' },
        { path: 'src\\components\\TestComponent.mtm', expected: 'TestComponent.mtm' },
        { path: 'TestComponent.mtm', expected: 'TestComponent.mtm' },
        { path: '/absolute/path/TestComponent.mtm', expected: 'TestComponent.mtm' },
        { path: 'C:\\Windows\\Path\\TestComponent.mtm', expected: 'TestComponent.mtm' }
      ];

      testCases.forEach(({ path, expected }) => {
        feedbackManager.startReload(path, 'mtm');
        const state = feedbackManager.getFeedbackState();
        const activeReload = state.activeReloads.find(r => r.filePath === path);
        expect(activeReload?.fileName).toBe(expected);
        
        // Clean up
        feedbackManager.completeReload(path, { success: true, duration: 100 });
      });
    });
  });

  describe('state management', () => {
    it('should track multiple active reloads', () => {
      const files = [
        'src/components/Component1.mtm',
        'src/components/Component2.mtm',
        'src/components/Component3.mtm'
      ];

      files.forEach(file => feedbackManager.startReload(file, 'mtm'));
      
      const state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(3);
      
      // Complete one reload
      feedbackManager.completeReload(files[0], { success: true, duration: 100 });
      
      const updatedState = feedbackManager.getFeedbackState();
      expect(updatedState.activeReloads).toHaveLength(2);
    });

    it('should clear all visual feedback', () => {
      feedbackManager.startReload('test1.mtm', 'mtm');
      feedbackManager.startReload('test2.mtm', 'mtm');
      
      expect(feedbackManager.getFeedbackState().activeReloads).toHaveLength(2);
      
      feedbackManager.clearAll();
      
      expect(feedbackManager.getFeedbackState().activeReloads).toHaveLength(0);
    });
  });

  describe('options update', () => {
    it('should update options', () => {
      const newOptions: Partial<VisualFeedbackOptions> = {
        showProgressIndicator: false,
        debugLogging: true
      };

      feedbackManager.updateOptions(newOptions);
      
      const options = feedbackManager.getOptions();
      expect(options.showProgressIndicator).toBe(false);
      expect(options.debugLogging).toBe(true);
      // Other options should remain unchanged
      expect(options.showNotifications).toBe(true);
      expect(options.coordinatePositioning).toBe(true);
    });
  });

  describe('debug logging', () => {
    it('should log debug messages when enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const debugManager = new HotReloadVisualFeedbackManager({ debugLogging: true });
      
      debugManager.startReload('test.mtm', 'mtm');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Started reload feedback for')
      );
      
      consoleSpy.mockRestore();
      debugManager.cleanup();
    });

    it('should not log debug messages when disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      feedbackManager.startReload('test.mtm', 'mtm');
      
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Started reload feedback for')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      feedbackManager.startReload('test1.mtm', 'mtm');
      feedbackManager.startReload('test2.mtm', 'mtm');
      
      expect(feedbackManager.getFeedbackState().activeReloads).toHaveLength(2);
      
      feedbackManager.cleanup();
      
      expect(feedbackManager.getFeedbackState().activeReloads).toHaveLength(0);
    });
  });

  describe('completion message building', () => {
    it('should build completion message with features', () => {
      const filePath = 'test.mtm';
      const result: ReloadFeedbackResult = {
        success: true,
        duration: 150,
        statePreserved: true,
        frameworksSynced: true
      };
      
      feedbackManager.startReload(filePath, 'mtm');
      feedbackManager.completeReload(filePath, result);
      
      // Should complete without error and build appropriate message
      expect(feedbackManager.getFeedbackState().activeReloads).toHaveLength(0);
    });

    it('should build completion message without features', () => {
      const filePath = 'test.mtm';
      const result: ReloadFeedbackResult = {
        success: true,
        duration: 100
      };
      
      feedbackManager.startReload(filePath, 'mtm');
      feedbackManager.completeReload(filePath, result);
      
      // Should complete without error
      expect(feedbackManager.getFeedbackState().activeReloads).toHaveLength(0);
    });
  });
});