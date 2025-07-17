/**
 * Integration tests for Hot Reload Visual Feedback System
 * 
 * These tests verify that the progress indicator, notification system,
 * and visual feedback manager work together correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadVisualFeedbackManager } from '../hot-reload-visual-feedback-manager.js';
import { HotReloadProgressIndicator } from '../hot-reload-progress-indicator.js';
import { HotReloadNotificationSystem } from '../hot-reload-notification-system.js';

// Mock DOM environment
const mockDocument = {
  createElement: vi.fn(),
  getElementById: vi.fn(),
  head: { appendChild: vi.fn() },
  body: { appendChild: vi.fn() }
};

const mockElement = {
  id: '',
  className: '',
  innerHTML: '',
  style: { display: 'block', animation: '' },
  remove: vi.fn(),
  appendChild: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
  addEventListener: vi.fn(),
  parentNode: { removeChild: vi.fn() }
};

beforeEach(() => {
  global.document = mockDocument as any;
  mockDocument.createElement.mockReturnValue(mockElement);
  mockDocument.getElementById.mockReturnValue(null);
  mockElement.querySelector.mockReturnValue(mockElement);
  mockElement.querySelectorAll.mockReturnValue([mockElement]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Visual Feedback Integration', () => {
  describe('Progress Indicator and Notification System Coordination', () => {
    let progressIndicator: HotReloadProgressIndicator;
    let notificationSystem: HotReloadNotificationSystem;

    beforeEach(() => {
      progressIndicator = new HotReloadProgressIndicator({
        position: 'top-right',
        debugLogging: true
      });
      
      notificationSystem = new HotReloadNotificationSystem({
        position: 'bottom-right', // Different position to avoid overlap
        debugLogging: true
      });
    });

    afterEach(() => {
      progressIndicator.cleanup();
      notificationSystem.cleanup();
    });

    it('should coordinate positioning to avoid overlap', () => {
      const progressOptions = progressIndicator.getOptions();
      const notificationOptions = notificationSystem.getOptions();
      
      // Should be positioned on different sides
      expect(progressOptions.position).toBe('top-right');
      expect(notificationOptions.position).toBe('bottom-right');
    });

    it('should handle concurrent file reloads with both systems', () => {
      const files = [
        'src/components/Component1.mtm',
        'src/components/Component2.mtm',
        'src/components/Component3.mtm'
      ];

      // Start tracking in progress indicator
      files.forEach(file => {
        progressIndicator.startFileReload(file);
      });

      // Show loading notifications
      const loadingIds = files.map(file => 
        notificationSystem.showLoading(`Reloading ${file.split('/').pop()}`, undefined, file)
      );

      // Verify state
      const progressState = progressIndicator.getProgressState();
      const notifications = notificationSystem.getNotifications();

      expect(progressState.files).toHaveLength(3);
      expect(notifications).toHaveLength(3);
      expect(progressState.overall.isActive).toBe(true);

      // Update progress
      files.forEach((file, index) => {
        const progress = (index + 1) * 25;
        progressIndicator.updateFileProgress(file, progress, 'loading');
        notificationSystem.updateProgress(loadingIds[index], progress);
      });

      // Complete some successfully, some with errors
      progressIndicator.completeFileReload(files[0], true);
      notificationSystem.completeLoading(loadingIds[0], true, 'Completed successfully');

      progressIndicator.completeFileReload(files[1], false, 'Compilation error');
      notificationSystem.completeLoading(loadingIds[1], false, 'Failed to compile');

      progressIndicator.completeFileReload(files[2], true);
      notificationSystem.completeLoading(loadingIds[2], true, 'Completed successfully');

      // Verify final state
      const finalProgressState = progressIndicator.getProgressState();
      expect(finalProgressState.overall.completedFiles).toBe(2);
      expect(finalProgressState.overall.failedFiles).toBe(1);
      expect(finalProgressState.overall.isActive).toBe(false);
    });

    it('should handle rapid file changes with debouncing', async () => {
      const filePath = 'src/components/RapidComponent.mtm';
      
      // Simulate rapid changes
      progressIndicator.startFileReload(filePath);
      const loadingId = notificationSystem.showLoading('Reloading component');
      
      // Rapid progress updates
      for (let i = 0; i <= 100; i += 10) {
        progressIndicator.updateFileProgress(filePath, i, 'loading');
        notificationSystem.updateProgress(loadingId, i);
      }
      
      // Complete
      progressIndicator.completeFileReload(filePath, true);
      notificationSystem.completeLoading(loadingId, true, 'Reload completed');
      
      const state = progressIndicator.getProgressState();
      expect(state.files[0].progress).toBe(100);
      expect(state.files[0].status).toBe('success');
    });
  });

  describe('Visual Feedback Manager Integration', () => {
    let feedbackManager: HotReloadVisualFeedbackManager;

    beforeEach(() => {
      feedbackManager = new HotReloadVisualFeedbackManager({
        showProgressIndicator: true,
        showNotifications: true,
        debugLogging: true,
        coordinatePositioning: true
      });
    });

    afterEach(() => {
      feedbackManager.cleanup();
    });

    it('should coordinate complete reload workflow', () => {
      const filePath = 'src/components/WorkflowTest.mtm';
      
      // Start reload
      feedbackManager.startReload(filePath, 'mtm');
      
      let state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(1);
      expect(state.activeReloads[0].filePath).toBe(filePath);
      
      // Update progress through various stages
      feedbackManager.updateProgress(filePath, 25, 'Preserving state...');
      feedbackManager.updateProgress(filePath, 50, 'Compiling...');
      feedbackManager.updateProgress(filePath, 75, 'Restoring state...');
      feedbackManager.updateProgress(filePath, 90, 'Syncing frameworks...');
      
      // Complete successfully
      feedbackManager.completeReload(filePath, {
        success: true,
        duration: 250,
        statePreserved: true,
        frameworksSynced: true
      });
      
      state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(0);
    });

    it('should handle error scenarios gracefully', () => {
      const filePath = 'src/components/ErrorTest.mtm';
      
      // Start reload
      feedbackManager.startReload(filePath, 'mtm');
      
      // Simulate error during compilation
      feedbackManager.completeReload(filePath, {
        success: false,
        duration: 100,
        error: 'Syntax error on line 15'
      });
      
      const state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(0);
    });

    it('should show batch summary for multiple files', () => {
      const results = [
        { filePath: 'file1.mtm', success: true, duration: 150 },
        { filePath: 'file2.mtm', success: true, duration: 200 },
        { filePath: 'file3.mtm', success: false, duration: 75 }
      ];
      
      expect(() => feedbackManager.showBatchSummary(results)).not.toThrow();
    });

    it('should handle disabled components gracefully', () => {
      const disabledManager = new HotReloadVisualFeedbackManager({
        showProgressIndicator: false,
        showNotifications: false
      });
      
      // Should still work but not show visual feedback
      disabledManager.startReload('test.mtm', 'mtm');
      disabledManager.updateProgress('test.mtm', 50);
      disabledManager.completeReload('test.mtm', { success: true, duration: 100 });
      
      const state = disabledManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(0);
      
      disabledManager.cleanup();
    });

    it('should handle concurrent reloads with different file types', () => {
      const files = [
        { path: 'src/components/Component.mtm', type: 'mtm' as const },
        { path: 'src/components/ReactComponent.jsx', type: 'native' as const },
        { path: 'package.json', type: 'dependency' as const }
      ];
      
      // Start all reloads
      files.forEach(({ path, type }) => {
        feedbackManager.startReload(path, type);
      });
      
      let state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(3);
      
      // Complete with different outcomes
      feedbackManager.completeReload(files[0].path, { 
        success: true, 
        duration: 200,
        statePreserved: true,
        frameworksSynced: true
      });
      
      feedbackManager.completeReload(files[1].path, { 
        success: true, 
        duration: 150,
        statePreserved: false,
        frameworksSynced: true
      });
      
      feedbackManager.completeReload(files[2].path, { 
        success: false, 
        duration: 50,
        error: 'Invalid JSON'
      });
      
      state = feedbackManager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(0);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle cleanup properly to prevent memory leaks', () => {
      const manager = new HotReloadVisualFeedbackManager();
      
      // Create multiple reloads
      for (let i = 0; i < 10; i++) {
        manager.startReload(`file${i}.mtm`, 'mtm');
      }
      
      let state = manager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(10);
      
      // Cleanup should clear everything
      manager.cleanup();
      
      state = manager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(0);
    });

    it('should handle rapid start/complete cycles', () => {
      const manager = new HotReloadVisualFeedbackManager();
      
      // Rapid cycles
      for (let i = 0; i < 5; i++) {
        const filePath = `rapid-file-${i}.mtm`;
        manager.startReload(filePath, 'mtm');
        manager.updateProgress(filePath, 50);
        manager.completeReload(filePath, { success: true, duration: 10 });
      }
      
      const state = manager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(0);
      
      manager.cleanup();
    });

    it('should limit resource usage with many concurrent operations', () => {
      const manager = new HotReloadVisualFeedbackManager({
        progressIndicator: { maxVisibleFiles: 3 },
        notifications: { maxNotifications: 3 }
      });
      
      // Start many operations
      for (let i = 0; i < 10; i++) {
        manager.startReload(`file${i}.mtm`, 'mtm');
      }
      
      const state = manager.getFeedbackState();
      expect(state.activeReloads).toHaveLength(10); // All tracked internally
      
      // Complete all
      for (let i = 0; i < 10; i++) {
        manager.completeReload(`file${i}.mtm`, { success: true, duration: 50 });
      }
      
      const finalState = manager.getFeedbackState();
      expect(finalState.activeReloads).toHaveLength(0);
      
      manager.cleanup();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle DOM manipulation errors gracefully', () => {
      // Mock DOM errors
      mockDocument.createElement.mockImplementationOnce(() => {
        throw new Error('DOM error');
      });
      
      expect(() => {
        const manager = new HotReloadVisualFeedbackManager();
        manager.startReload('test.mtm', 'mtm');
        manager.cleanup();
      }).not.toThrow();
    });

    it('should handle invalid file paths gracefully', () => {
      const manager = new HotReloadVisualFeedbackManager();
      
      const invalidPaths = ['', null as any, undefined as any, 123 as any];
      
      invalidPaths.forEach(path => {
        expect(() => {
          manager.startReload(path, 'mtm');
          if (path) {
            manager.completeReload(path, { success: true, duration: 100 });
          }
        }).not.toThrow();
      });
      
      manager.cleanup();
    });

    it('should handle completion without start gracefully', () => {
      const manager = new HotReloadVisualFeedbackManager();
      
      expect(() => {
        manager.completeReload('never-started.mtm', { success: true, duration: 100 });
      }).not.toThrow();
      
      manager.cleanup();
    });
  });
});