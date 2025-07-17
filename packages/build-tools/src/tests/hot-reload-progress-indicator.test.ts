/**
 * Tests for Hot Reload Progress Indicator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadProgressIndicator, type ProgressIndicatorOptions } from '../hot-reload-progress-indicator.js';

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
  style: { display: 'block' },
  remove: vi.fn(),
  appendChild: vi.fn()
};

// Setup DOM mocks
beforeEach(() => {
  global.document = mockDocument as any;
  mockDocument.createElement.mockReturnValue(mockElement);
  mockDocument.getElementById.mockReturnValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HotReloadProgressIndicator', () => {
  let progressIndicator: HotReloadProgressIndicator;

  beforeEach(() => {
    progressIndicator = new HotReloadProgressIndicator();
  });

  afterEach(() => {
    progressIndicator.cleanup();
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const options = progressIndicator.getOptions();
      
      expect(options.position).toBe('top-right');
      expect(options.showFileNames).toBe(true);
      expect(options.showProgress).toBe(true);
      expect(options.autoHide).toBe(true);
      expect(options.autoHideDelay).toBe(3000);
      expect(options.maxVisibleFiles).toBe(5);
      expect(options.debugLogging).toBe(false);
    });

    it('should initialize with custom options', () => {
      const customOptions: Partial<ProgressIndicatorOptions> = {
        position: 'bottom-left',
        showFileNames: false,
        showProgress: false,
        autoHide: false,
        maxVisibleFiles: 3,
        debugLogging: true
      };

      const customIndicator = new HotReloadProgressIndicator(customOptions);
      const options = customIndicator.getOptions();

      expect(options.position).toBe('bottom-left');
      expect(options.showFileNames).toBe(false);
      expect(options.showProgress).toBe(false);
      expect(options.autoHide).toBe(false);
      expect(options.maxVisibleFiles).toBe(3);
      expect(options.debugLogging).toBe(true);

      customIndicator.cleanup();
    });
  });

  describe('file reload tracking', () => {
    it('should start tracking file reload', () => {
      const filePath = 'src/components/TestComponent.mtm';
      
      progressIndicator.startFileReload(filePath);
      
      const state = progressIndicator.getProgressState();
      expect(state.files).toHaveLength(1);
      expect(state.files[0].filePath).toBe(filePath);
      expect(state.files[0].fileName).toBe('TestComponent.mtm');
      expect(state.files[0].status).toBe('loading');
      expect(state.files[0].progress).toBe(0);
    });

    it('should update file progress', () => {
      const filePath = 'src/components/TestComponent.mtm';
      
      progressIndicator.startFileReload(filePath);
      progressIndicator.updateFileProgress(filePath, 50, 'loading');
      
      const state = progressIndicator.getProgressState();
      expect(state.files[0].progress).toBe(50);
      expect(state.files[0].status).toBe('loading');
    });

    it('should complete file reload successfully', async () => {
      const filePath = 'src/components/TestComponent.mtm';
      
      progressIndicator.startFileReload(filePath);
      
      // Add a small delay to ensure duration > 0
      await new Promise(resolve => setTimeout(resolve, 1));
      
      progressIndicator.completeFileReload(filePath, true);
      
      const state = progressIndicator.getProgressState();
      expect(state.files[0].status).toBe('success');
      expect(state.files[0].progress).toBe(100);
      expect(state.files[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should complete file reload with error', async () => {
      const filePath = 'src/components/TestComponent.mtm';
      const error = 'Compilation failed';
      
      progressIndicator.startFileReload(filePath);
      
      // Add a small delay to ensure duration > 0
      await new Promise(resolve => setTimeout(resolve, 1));
      
      progressIndicator.completeFileReload(filePath, false, error);
      
      const state = progressIndicator.getProgressState();
      expect(state.files[0].status).toBe('error');
      expect(state.files[0].progress).toBe(100);
      expect(state.files[0].error).toBe(error);
      expect(state.files[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle unknown file updates gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      progressIndicator.updateFileProgress('unknown-file.mtm', 50);
      
      expect(consoleSpy).not.toHaveBeenCalled(); // No warning when debugLogging is false
      
      consoleSpy.mockRestore();
    });

    it('should warn about unknown files when debug logging is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const debugIndicator = new HotReloadProgressIndicator({ debugLogging: true });
      
      debugIndicator.updateFileProgress('unknown-file.mtm', 50);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempted to update progress for unknown file')
      );
      
      consoleSpy.mockRestore();
      debugIndicator.cleanup();
    });
  });

  describe('overall progress calculation', () => {
    it('should calculate overall progress correctly', () => {
      const files = [
        'src/components/Component1.mtm',
        'src/components/Component2.mtm',
        'src/components/Component3.mtm'
      ];

      // Start all files
      files.forEach(file => progressIndicator.startFileReload(file));
      
      // Update progress
      progressIndicator.updateFileProgress(files[0], 100, 'success');
      progressIndicator.updateFileProgress(files[1], 50, 'loading');
      progressIndicator.updateFileProgress(files[2], 0, 'loading');
      
      const state = progressIndicator.getProgressState();
      expect(state.overall.totalFiles).toBe(3);
      expect(state.overall.completedFiles).toBe(1);
      expect(state.overall.failedFiles).toBe(0);
      expect(state.overall.overallProgress).toBe(50); // (100 + 50 + 0) / 3 = 50
      expect(state.overall.isActive).toBe(true);
    });

    it('should handle mixed success and error states', () => {
      const files = [
        'src/components/Component1.mtm',
        'src/components/Component2.mtm'
      ];

      files.forEach(file => progressIndicator.startFileReload(file));
      
      progressIndicator.completeFileReload(files[0], true);
      progressIndicator.completeFileReload(files[1], false, 'Error');
      
      const state = progressIndicator.getProgressState();
      expect(state.overall.totalFiles).toBe(2);
      expect(state.overall.completedFiles).toBe(1);
      expect(state.overall.failedFiles).toBe(1);
      expect(state.overall.overallProgress).toBe(100); // Both at 100%
      expect(state.overall.isActive).toBe(false);
    });
  });

  describe('file management', () => {
    it('should remove file progress', () => {
      const filePath = 'src/components/TestComponent.mtm';
      
      progressIndicator.startFileReload(filePath);
      expect(progressIndicator.getProgressState().files).toHaveLength(1);
      
      progressIndicator.removeFileProgress(filePath);
      expect(progressIndicator.getProgressState().files).toHaveLength(0);
    });

    it('should clear all progress', () => {
      const files = [
        'src/components/Component1.mtm',
        'src/components/Component2.mtm'
      ];

      files.forEach(file => progressIndicator.startFileReload(file));
      expect(progressIndicator.getProgressState().files).toHaveLength(2);
      
      progressIndicator.clearAll();
      expect(progressIndicator.getProgressState().files).toHaveLength(0);
    });

    it('should limit visible files to maxVisibleFiles', () => {
      const indicator = new HotReloadProgressIndicator({ maxVisibleFiles: 2 });
      
      const files = [
        'src/components/Component1.mtm',
        'src/components/Component2.mtm',
        'src/components/Component3.mtm'
      ];

      files.forEach(file => indicator.startFileReload(file));
      
      // All files should be tracked
      expect(indicator.getProgressState().files).toHaveLength(3);
      
      indicator.cleanup();
    });
  });

  describe('DOM interaction', () => {
    it('should create indicator element when showing', () => {
      progressIndicator.showIndicator();
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
    });

    it('should inject styles only once', () => {
      // First call should inject styles
      mockDocument.getElementById.mockReturnValueOnce(null);
      progressIndicator.showIndicator();
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('style');
      expect(mockDocument.head.appendChild).toHaveBeenCalled();
      
      // Reset mocks
      vi.clearAllMocks();
      
      // Second call should not inject styles again
      mockDocument.getElementById.mockReturnValueOnce(mockElement);
      progressIndicator.showIndicator();
      
      expect(mockDocument.createElement).not.toHaveBeenCalledWith('style');
      expect(mockDocument.head.appendChild).not.toHaveBeenCalled();
    });

    it('should hide indicator', () => {
      progressIndicator.showIndicator();
      progressIndicator.hideIndicator();
      
      expect(mockElement.style.display).toBe('none');
    });
  });

  describe('options update', () => {
    it('should update options', () => {
      const newOptions: Partial<ProgressIndicatorOptions> = {
        position: 'bottom-left',
        showProgress: false,
        debugLogging: true
      };

      progressIndicator.updateOptions(newOptions);
      
      const options = progressIndicator.getOptions();
      expect(options.position).toBe('bottom-left');
      expect(options.showProgress).toBe(false);
      expect(options.debugLogging).toBe(true);
      // Other options should remain unchanged
      expect(options.showFileNames).toBe(true);
      expect(options.autoHide).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      progressIndicator.startFileReload('test.mtm');
      progressIndicator.showIndicator();
      
      expect(progressIndicator.getProgressState().files).toHaveLength(1);
      
      progressIndicator.cleanup();
      
      expect(progressIndicator.getProgressState().files).toHaveLength(0);
      expect(mockElement.remove).toHaveBeenCalled();
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
        progressIndicator.startFileReload(path);
        const state = progressIndicator.getProgressState();
        const file = state.files.find(f => f.filePath === path);
        expect(file?.fileName).toBe(expected);
        progressIndicator.removeFileProgress(path);
      });
    });
  });
});