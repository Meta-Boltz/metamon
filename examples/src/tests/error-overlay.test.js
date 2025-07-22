/**
 * Tests for MTM Error Overlay System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MTMErrorOverlay, initializeErrorOverlay, getErrorOverlay } from '../shared/error-overlay.js';

// Mock DOM environment
const mockDocument = {
  createElement: vi.fn(() => ({
    style: {},
    id: '',
    innerHTML: '',
    appendChild: vi.fn(),
    addEventListener: vi.fn(),
    insertAdjacentHTML: vi.fn()
  })),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  },
  head: {
    insertAdjacentHTML: vi.fn()
  },
  getElementById: vi.fn(),
  addEventListener: vi.fn(),
  querySelectorAll: vi.fn(() => [])
};

const mockWindow = {
  addEventListener: vi.fn(),
  location: { href: 'http://localhost:3000' },
  navigator: { userAgent: 'test-agent' },
  scrollTo: vi.fn(),
  scrollY: 100
};

// Mock import.meta
const mockImportMeta = {
  hot: {
    on: vi.fn(),
    data: {}
  },
  env: {
    DEV: true
  }
};

describe('MTM Error Overlay System', () => {
  let overlay;
  let originalDocument;
  let originalWindow;
  let originalImportMeta;

  beforeEach(() => {
    // Mock global objects
    originalDocument = global.document;
    originalWindow = global.window;
    originalImportMeta = global.import?.meta;

    global.document = mockDocument;
    global.window = mockWindow;
    global.import = { meta: mockImportMeta };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore globals
    global.document = originalDocument;
    global.window = originalWindow;
    if (originalImportMeta) {
      global.import.meta = originalImportMeta;
    }

    // Cleanup overlay
    if (overlay) {
      overlay.destroy();
      overlay = null;
    }
  });

  describe('MTMErrorOverlay Class', () => {
    it('should initialize with default options', () => {
      overlay = new MTMErrorOverlay();

      expect(overlay.options.position).toBe('fixed');
      expect(overlay.options.zIndex).toBe(999999);
      expect(overlay.options.theme).toBe('dark');
      expect(overlay.options.showStackTrace).toBe(true);
      expect(overlay.isVisible).toBe(false);
      expect(overlay.errors).toEqual([]);
    });

    it('should initialize with custom options', () => {
      overlay = new MTMErrorOverlay({
        theme: 'light',
        showStackTrace: false,
        enableVerboseLogging: true
      });

      expect(overlay.options.theme).toBe('light');
      expect(overlay.options.showStackTrace).toBe(false);
      expect(overlay.verboseLogging).toBe(true);
    });

    it('should create overlay DOM element', () => {
      overlay = new MTMErrorOverlay();

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
    });

    it('should set up error listeners', () => {
      overlay = new MTMErrorOverlay();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      expect(mockImportMeta.hot.on).toHaveBeenCalledWith('vite:error', expect.any(Function));
      expect(mockImportMeta.hot.on).toHaveBeenCalledWith('mtm:compilation-error', expect.any(Function));
      expect(mockImportMeta.hot.on).toHaveBeenCalledWith('mtm:hot-reload', expect.any(Function));
    });
  });

  describe('Error Detection', () => {
    beforeEach(() => {
      overlay = new MTMErrorOverlay();
    });

    it('should detect MTM-related errors', () => {
      const mtmError = { message: 'MTM compilation failed' };
      const mtmFileError = { filename: 'test.mtm' };
      const mtmStackError = { error: { stack: 'at mtm-plugin.js:123' } };
      const nonMtmError = { message: 'Regular error' };

      expect(overlay.isMTMError(mtmError)).toBe(true);
      expect(overlay.isMTMError(mtmFileError)).toBe(true);
      expect(overlay.isMTMError(mtmStackError)).toBe(true);
      expect(overlay.isMTMError(nonMtmError)).toBe(false);
    });

    it('should handle promise rejection MTM errors', () => {
      const mtmRejection = { reason: { message: 'MTM promise failed' } };
      const nonMtmRejection = { reason: { message: 'Regular promise failed' } };

      expect(overlay.isMTMError(mtmRejection)).toBe(true);
      expect(overlay.isMTMError(nonMtmRejection)).toBe(false);
    });
  });

  describe('Error Display', () => {
    beforeEach(() => {
      overlay = new MTMErrorOverlay();
    });

    it('should show error and update overlay', () => {
      const error = {
        type: 'mtm_compilation_error',
        message: 'Test error message',
        file: 'test.mtm',
        timestamp: Date.now()
      };

      overlay.showError(error);

      expect(overlay.errors).toHaveLength(1);
      expect(overlay.errors[0]).toEqual(error);
      expect(overlay.isVisible).toBe(true);
    });

    it('should accumulate multiple errors', () => {
      const error1 = {
        type: 'mtm_compilation_error',
        message: 'First error',
        timestamp: Date.now()
      };

      const error2 = {
        type: 'runtime_error',
        message: 'Second error',
        timestamp: Date.now() + 1000
      };

      overlay.showError(error1);
      overlay.showError(error2);

      expect(overlay.errors).toHaveLength(2);
      expect(overlay.errors[0]).toEqual(error1);
      expect(overlay.errors[1]).toEqual(error2);
    });

    it('should format error types correctly', () => {
      expect(overlay.formatErrorType('mtm_compilation_error')).toBe('MTM Compilation Error');
      expect(overlay.formatErrorType('mtm_hot_reload_error')).toBe('MTM Hot Reload Error');
      expect(overlay.formatErrorType('vite_error')).toBe('Vite Build Error');
      expect(overlay.formatErrorType('runtime_error')).toBe('Runtime Error');
      expect(overlay.formatErrorType('promise_rejection')).toBe('Promise Rejection');
      expect(overlay.formatErrorType('custom_error_type')).toBe('Custom Error Type');
    });

    it('should escape HTML in error messages', () => {
      const htmlMessage = '<script>alert("xss")</script>';
      const escaped = overlay.escapeHTML(htmlMessage);

      expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated';
      const truncated = overlay.truncateText(longText, 20);

      expect(truncated).toBe('This is a very long...');
    });
  });

  describe('Error Management', () => {
    beforeEach(() => {
      overlay = new MTMErrorOverlay();
    });

    it('should clear all errors', () => {
      overlay.showError({
        type: 'test_error',
        message: 'Test error',
        timestamp: Date.now()
      });

      expect(overlay.errors).toHaveLength(1);
      expect(overlay.isVisible).toBe(true);

      overlay.clearErrors();

      expect(overlay.errors).toHaveLength(0);
      expect(overlay.isVisible).toBe(false);
    });

    it('should hide overlay', () => {
      overlay.show();
      expect(overlay.isVisible).toBe(true);

      overlay.hide();
      expect(overlay.isVisible).toBe(false);
    });

    it('should show error at specific index', () => {
      const error1 = { type: 'error1', message: 'First', timestamp: 1 };
      const error2 = { type: 'error2', message: 'Second', timestamp: 2 };
      const error3 = { type: 'error3', message: 'Third', timestamp: 3 };

      overlay.errors = [error1, error2, error3];

      overlay.showErrorAtIndex(0);

      // Should move first error to end
      expect(overlay.errors[2]).toEqual(error1);
      expect(overlay.errors[0]).toEqual(error2);
      expect(overlay.errors[1]).toEqual(error3);
    });
  });

  describe('Debug Features', () => {
    beforeEach(() => {
      overlay = new MTMErrorOverlay();
    });

    it('should toggle verbose logging', () => {
      expect(overlay.verboseLogging).toBe(false);

      overlay.toggleVerboseLogging();
      expect(overlay.verboseLogging).toBe(true);

      overlay.toggleVerboseLogging();
      expect(overlay.verboseLogging).toBe(false);
    });

    it('should get Vite version', () => {
      mockImportMeta.env.VITE_VERSION = '4.0.0';
      expect(overlay.getViteVersion()).toBe('4.0.0');

      delete mockImportMeta.env.VITE_VERSION;
      expect(overlay.getViteVersion()).toBe('unknown');
    });

    it('should get MTM plugin version', () => {
      mockWindow.__MTM_PLUGIN_VERSION__ = '1.0.0';
      expect(overlay.getMTMPluginVersion()).toBe('1.0.0');

      delete mockWindow.__MTM_PLUGIN_VERSION__;
      expect(overlay.getMTMPluginVersion()).toBe('unknown');
    });

    it('should copy debug info to clipboard', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue()
      };
      mockWindow.navigator.clipboard = mockClipboard;

      overlay.errors = [{
        type: 'test_error',
        message: 'Test error',
        timestamp: Date.now()
      }];

      await overlay.copyDebugInfo();

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('"errors"')
      );
    });
  });

  describe('Stack Trace Formatting', () => {
    beforeEach(() => {
      overlay = new MTMErrorOverlay();
    });

    it('should highlight MTM-related lines in stack trace', () => {
      const stack = `Error: Test error
    at function1 (test.mtm:10:5)
    at function2 (regular.js:20:10)
    at mtm-plugin.js:30:15`;

      const formatted = overlay.formatStackTrace(stack);

      expect(formatted).toContain('<span class="mtm-error-stack-highlight">');
      expect(formatted).toContain('test.mtm');
      expect(formatted).toContain('mtm-plugin.js');
    });

    it('should escape HTML in stack traces', () => {
      const stack = 'Error: <script>alert("xss")</script>';
      const formatted = overlay.formatStackTrace(stack);

      expect(formatted).toContain('&lt;script&gt;');
      expect(formatted).not.toContain('<script>');
    });
  });

  describe('Toast Notifications', () => {
    beforeEach(() => {
      overlay = new MTMErrorOverlay();
    });

    it('should show toast notification', () => {
      overlay.showToast('Test message');

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      overlay = new MTMErrorOverlay();
    });

    it('should destroy overlay and cleanup resources', () => {
      overlay.destroy();

      expect(mockDocument.body.removeChild).toHaveBeenCalled();
      expect(overlay.overlay).toBe(null);
      expect(overlay.errors).toEqual([]);
      expect(overlay.isVisible).toBe(false);
    });
  });
});

describe('Error Overlay Initialization', () => {
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    originalDocument = global.document;
    originalWindow = global.window;

    global.document = mockDocument;
    global.window = mockWindow;

    vi.clearAllMocks();
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
  });

  it('should initialize error overlay with default options', () => {
    const overlay = initializeErrorOverlay();

    expect(overlay).toBeInstanceOf(MTMErrorOverlay);
    expect(mockDocument.head.insertAdjacentHTML).toHaveBeenCalled();
    expect(mockWindow.mtmErrorOverlay).toBeDefined();
  });

  it('should initialize error overlay with custom options', () => {
    const options = {
      theme: 'light',
      enableVerboseLogging: true
    };

    const overlay = initializeErrorOverlay(options);

    expect(overlay).toBeInstanceOf(MTMErrorOverlay);
    expect(overlay.options.theme).toBe('light');
    expect(overlay.verboseLogging).toBe(true);
  });

  it('should return existing overlay instance', () => {
    const overlay1 = initializeErrorOverlay();
    const overlay2 = initializeErrorOverlay();

    expect(overlay1).toBe(overlay2);
  });

  it('should get error overlay instance', () => {
    const overlay = initializeErrorOverlay();
    const retrieved = getErrorOverlay();

    expect(retrieved).toBe(overlay);
  });

  it('should not initialize in non-browser environment', () => {
    global.window = undefined;

    const overlay = initializeErrorOverlay();

    expect(overlay).toBeUndefined();
  });
});

describe('HMR Integration', () => {
  let overlay;
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    originalDocument = global.document;
    originalWindow = global.window;

    global.document = mockDocument;
    global.window = mockWindow;
    global.import = { meta: mockImportMeta };

    overlay = new MTMErrorOverlay();
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;

    if (overlay) {
      overlay.destroy();
    }
  });

  it('should handle MTM compilation errors from HMR', () => {
    const compilationErrorHandler = mockImportMeta.hot.on.mock.calls
      .find(call => call[0] === 'mtm:compilation-error')[1];

    const errorData = {
      file: 'test.mtm',
      message: 'Compilation failed',
      type: 'frontmatter_error',
      line: 5,
      column: 10,
      suggestion: 'Check your YAML syntax'
    };

    compilationErrorHandler(errorData);

    expect(overlay.errors).toHaveLength(1);
    expect(overlay.errors[0].message).toBe('Compilation failed');
    expect(overlay.errors[0].file).toBe('test.mtm');
    expect(overlay.isVisible).toBe(true);
  });

  it('should handle MTM hot reload errors', () => {
    const hotReloadHandler = mockImportMeta.hot.on.mock.calls
      .find(call => call[0] === 'mtm:hot-reload')[1];

    const reloadData = {
      file: 'test.mtm',
      hasErrors: true,
      errors: [
        {
          message: 'Hot reload failed',
          suggestion: 'Check your component syntax'
        }
      ]
    };

    hotReloadHandler(reloadData);

    expect(overlay.errors).toHaveLength(1);
    expect(overlay.errors[0].message).toBe('Hot reload failed');
    expect(overlay.isVisible).toBe(true);
  });

  it('should clear errors on successful hot reload', () => {
    // Add an error first
    overlay.showError({
      type: 'test_error',
      message: 'Test error',
      timestamp: Date.now()
    });

    expect(overlay.errors).toHaveLength(1);
    expect(overlay.isVisible).toBe(true);

    // Simulate successful hot reload
    const hotReloadHandler = mockImportMeta.hot.on.mock.calls
      .find(call => call[0] === 'mtm:hot-reload')[1];

    hotReloadHandler({
      file: 'test.mtm',
      hasErrors: false,
      errors: []
    });

    expect(overlay.errors).toHaveLength(0);
    expect(overlay.isVisible).toBe(false);
  });

  it('should handle Vite errors', () => {
    const viteErrorHandler = mockImportMeta.hot.on.mock.calls
      .find(call => call[0] === 'vite:error')[1];

    const viteError = {
      message: 'Vite build failed',
      stack: 'Error stack trace',
      id: 'test.mtm'
    };

    viteErrorHandler(viteError);

    expect(overlay.errors).toHaveLength(1);
    expect(overlay.errors[0].message).toBe('Vite build failed');
    expect(overlay.errors[0].type).toBe('vite_error');
    expect(overlay.isVisible).toBe(true);
  });
});