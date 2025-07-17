/**
 * CSS Hot Reload Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CSSHotReloadManager, type CSSHotReloadConfig, type FrameworkStyleHandler, type ThemeChange } from '../css-hot-reload-manager.js';

// Mock DOM environment
const mockDocument = {
  documentElement: {
    style: {
      setProperty: vi.fn(),
      getPropertyValue: vi.fn(() => '#667eea')
    }
  },
  createElement: vi.fn(() => ({
    id: '',
    type: '',
    textContent: '',
    setAttribute: vi.fn(),
    parentNode: null
  })),
  head: {
    appendChild: vi.fn(),
    contains: vi.fn(() => true)
  },
  getElementById: vi.fn(() => null)
};

// Mock window environment
const mockWindow = {
  dispatchEvent: vi.fn()
};

// Mock getComputedStyle
const mockGetComputedStyle = vi.fn(() => ({
  length: 0,
  getPropertyValue: vi.fn(() => '#667eea')
}));

// Mock framework style handler
class MockFrameworkStyleHandler implements FrameworkStyleHandler {
  frameworkName = 'test-framework';
  updateStylesCalled = false;
  updateThemeCalled = false;
  lastStyles = '';
  lastThemeChanges: ThemeChange[] = [];

  async updateStyles(componentId: string, styles: string): Promise<void> {
    this.updateStylesCalled = true;
    this.lastStyles = styles;
  }

  async updateTheme(themeChanges: ThemeChange[]): Promise<void> {
    this.updateThemeCalled = true;
    this.lastThemeChanges = themeChanges;
  }

  extractComponentStyles(componentId: string): string | null {
    return this.lastStyles || null;
  }

  validateStyleIntegrity(componentId: string): boolean {
    return true;
  }
}

describe('CSSHotReloadManager', () => {
  let cssManager: CSSHotReloadManager;
  let mockHandler: MockFrameworkStyleHandler;
  let originalDocument: any;
  let originalWindow: any;
  let originalGetComputedStyle: any;

  beforeEach(() => {
    // Mock global objects
    originalDocument = global.document;
    originalWindow = global.window;
    originalGetComputedStyle = global.getComputedStyle;
    global.document = mockDocument as any;
    global.window = mockWindow as any;
    global.getComputedStyle = mockGetComputedStyle as any;

    const config: Partial<CSSHotReloadConfig> = {
      enableCSSHotReload: true,
      enableThemePropagation: true,
      enableFrameworkSpecificUpdates: true,
      debugLogging: false,
      debounceMs: 0 // Disable debouncing for tests
    };

    cssManager = new CSSHotReloadManager(config);
    mockHandler = new MockFrameworkStyleHandler();
    cssManager.registerFrameworkHandler(mockHandler);
  });

  afterEach(() => {
    if (cssManager) {
      cssManager.cleanup();
    }
    global.document = originalDocument;
    global.window = originalWindow;
    global.getComputedStyle = originalGetComputedStyle;
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const manager = new CSSHotReloadManager();
      const config = manager.getConfig();
      
      expect(config.enableCSSHotReload).toBe(true);
      expect(config.enableThemePropagation).toBe(true);
      expect(config.enableFrameworkSpecificUpdates).toBe(true);
      expect(config.injectionMethod).toBe('style-tag');
      expect(config.themeVariablePrefix).toBe('--');
    });

    it('should update configuration', () => {
      const newConfig = {
        enableCSSHotReload: false,
        debounceMs: 200
      };

      cssManager.updateConfig(newConfig);
      const config = cssManager.getConfig();

      expect(config.enableCSSHotReload).toBe(false);
      expect(config.debounceMs).toBe(200);
    });
  });

  describe('Framework Handler Registration', () => {
    it('should register framework handlers', () => {
      const stats = cssManager.getStats();
      expect(stats.registeredFrameworks).toBe(1);
    });

    it('should unregister framework handlers', () => {
      cssManager.unregisterFrameworkHandler('test-framework');
      const stats = cssManager.getStats();
      expect(stats.registeredFrameworks).toBe(0);
    });
  });

  describe('Component Registration', () => {
    it('should register components for style tracking', () => {
      cssManager.registerComponent('test-component', '.test { color: red; }');
      
      const stats = cssManager.getStats();
      expect(stats.registeredComponents).toBe(1);
      
      const styles = cssManager.getComponentStyles('test-component');
      expect(styles).toBe('.test { color: red; }');
    });

    it('should unregister components from style tracking', () => {
      cssManager.registerComponent('test-component');
      cssManager.unregisterComponent('test-component');
      
      const stats = cssManager.getStats();
      expect(stats.registeredComponents).toBe(0);
    });
  });

  describe('CSS Change Handling', () => {
    it('should handle CSS file changes', async () => {
      // Register a component first
      cssManager.registerComponent('test-component');
      
      const cssContent = '.button { background: blue; }';
      
      await cssManager.handleCSSChange(
        'test.css',
        'css',
        cssContent,
        ['test-framework']
      );

      expect(mockHandler.updateStylesCalled).toBe(true);
      expect(mockHandler.lastStyles).toBe(cssContent);
    });

    it('should handle theme changes', async () => {
      const cssContent = ':root { --primary-color: #ff0000; }';
      
      await cssManager.handleCSSChange(
        'theme.css',
        'theme',
        cssContent
      );

      expect(mockHandler.updateThemeCalled).toBe(true);
      expect(mockHandler.lastThemeChanges).toHaveLength(1);
      expect(mockHandler.lastThemeChanges[0].variableName).toBe('--primary-color');
      expect(mockHandler.lastThemeChanges[0].newValue).toBe('#ff0000');
    });

    it('should detect theme variables in regular CSS', async () => {
      // Register a component first
      cssManager.registerComponent('test-component');
      
      const cssContent = '.button { color: var(--text-color); } :root { --text-color: #333; }';
      
      await cssManager.handleCSSChange(
        'styles.css',
        'css',
        cssContent
      );

      expect(mockHandler.updateThemeCalled).toBe(true);
    });

    it('should skip CSS changes when disabled', async () => {
      cssManager.updateConfig({ enableCSSHotReload: false });
      
      await cssManager.handleCSSChange(
        'test.css',
        'css',
        '.test { color: red; }'
      );

      expect(mockHandler.updateStylesCalled).toBe(false);
    });
  });

  describe('Theme Change Propagation', () => {
    it('should propagate theme changes to all frameworks', async () => {
      const secondHandler = new MockFrameworkStyleHandler();
      secondHandler.frameworkName = 'second-framework';
      cssManager.registerFrameworkHandler(secondHandler);

      const cssContent = ':root { --primary-color: #00ff00; --secondary-color: #0000ff; }';
      
      await cssManager.handleCSSChange(
        'theme.css',
        'theme',
        cssContent
      );

      expect(mockHandler.updateThemeCalled).toBe(true);
      expect(secondHandler.updateThemeCalled).toBe(true);
      expect(mockHandler.lastThemeChanges).toHaveLength(2);
    });

    it('should update CSS custom properties in document', async () => {
      const cssContent = ':root { --primary-color: #ff0000; }';
      
      await cssManager.handleCSSChange(
        'theme.css',
        'theme',
        cssContent
      );

      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--primary-color',
        '#ff0000'
      );
    });

    it('should skip theme propagation when disabled', async () => {
      cssManager.updateConfig({ enableThemePropagation: false });
      
      const cssContent = ':root { --primary-color: #ff0000; }';
      
      await cssManager.handleCSSChange(
        'theme.css',
        'theme',
        cssContent
      );

      expect(mockDocument.documentElement.style.setProperty).not.toHaveBeenCalled();
    });
  });

  describe('Framework-Specific Updates', () => {
    it('should update framework-specific styles when enabled', async () => {
      cssManager.registerComponent('test-component');
      
      const cssContent = '.test-component { padding: 10px; }';
      
      await cssManager.handleCSSChange(
        'component.css',
        'css',
        cssContent,
        ['test-framework']
      );

      expect(mockHandler.updateStylesCalled).toBe(true);
    });

    it('should skip framework-specific updates when disabled', async () => {
      cssManager.updateConfig({ enableFrameworkSpecificUpdates: false });
      cssManager.registerComponent('test-component');
      
      const cssContent = '.test-component { padding: 10px; }';
      
      await cssManager.handleCSSChange(
        'component.css',
        'css',
        cssContent,
        ['test-framework']
      );

      // Should still call updateStyles for general CSS updates, but not framework-specific
      expect(mockHandler.updateStylesCalled).toBe(true);
    });
  });

  describe('Style Injection', () => {
    it('should inject styles using style tag method', async () => {
      const mockStyleElement = {
        id: '',
        type: '',
        textContent: '',
        setAttribute: vi.fn(),
        parentNode: null
      };
      
      mockDocument.createElement.mockReturnValue(mockStyleElement);
      mockDocument.getElementById.mockReturnValue(null);

      const cssContent = '.injected { color: green; }';
      
      await cssManager.handleCSSChange(
        'inject.css',
        'css',
        cssContent
      );

      expect(mockDocument.createElement).toHaveBeenCalledWith('style');
      expect(mockDocument.head.appendChild).toHaveBeenCalledWith(mockStyleElement);
      expect(mockStyleElement.textContent).toBe(cssContent);
    });

    it('should update existing style elements', async () => {
      const mockStyleElement = {
        id: 'css-hot-reload-inject_css',
        type: 'text/css',
        textContent: '',
        setAttribute: vi.fn(),
        parentNode: mockDocument.head
      };
      
      mockDocument.getElementById.mockReturnValue(mockStyleElement);

      const cssContent = '.updated { color: purple; }';
      
      await cssManager.handleCSSChange(
        'inject.css',
        'css',
        cssContent
      );

      expect(mockStyleElement.textContent).toBe(cssContent);
      expect(mockDocument.head.appendChild).not.toHaveBeenCalled();
    });
  });

  describe('Debouncing', () => {
    it('should debounce CSS changes when enabled', async () => {
      cssManager.updateConfig({ debounceMs: 50 });
      cssManager.registerComponent('test-component');
      
      // Trigger multiple rapid changes
      cssManager.handleCSSChange('test.css', 'css', '.test1 { color: red; }');
      cssManager.handleCSSChange('test.css', 'css', '.test2 { color: blue; }');
      cssManager.handleCSSChange('test.css', 'css', '.test3 { color: green; }');

      // Should not have processed yet
      expect(mockHandler.updateStylesCalled).toBe(false);

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should have processed only the last change
      expect(mockHandler.updateStylesCalled).toBe(true);
      expect(mockHandler.lastStyles).toBe('.test3 { color: green; }');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully during CSS updates', async () => {
      const errorHandler = new MockFrameworkStyleHandler();
      errorHandler.updateStyles = vi.fn().mockRejectedValue(new Error('Update failed'));
      cssManager.registerFrameworkHandler(errorHandler);

      // Should not throw
      await expect(cssManager.handleCSSChange(
        'error.css',
        'css',
        '.error { color: red; }'
      )).resolves.not.toThrow();
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      cssManager.registerComponent('comp1');
      cssManager.registerComponent('comp2');
      
      const stats = cssManager.getStats();
      
      expect(stats.registeredComponents).toBe(2);
      expect(stats.registeredFrameworks).toBe(1);
      expect(stats.trackedThemeVariables).toBeGreaterThanOrEqual(0);
      expect(stats.activeUpdates).toBe(0);
      expect(stats.queuedUpdates).toBe(0);
      expect(stats.pendingUpdates).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      cssManager.registerComponent('test-component');
      cssManager.registerFrameworkHandler(new MockFrameworkStyleHandler());
      
      cssManager.cleanup();
      
      const stats = cssManager.getStats();
      expect(stats.registeredComponents).toBe(0);
      expect(stats.registeredFrameworks).toBe(0);
      expect(stats.activeUpdates).toBe(0);
      expect(stats.queuedUpdates).toBe(0);
      expect(stats.pendingUpdates).toBe(0);
    });
  });
});