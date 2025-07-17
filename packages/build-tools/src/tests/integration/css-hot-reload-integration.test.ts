/**
 * CSS Hot Reload Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadOrchestrator, type HotReloadConfig } from '../../hot-reload-orchestrator.js';
import { ReactCSSHandler } from '../../adapters/react-css-handler.js';
import { VueCSSHandler } from '../../adapters/vue-css-handler.js';
import { SvelteCSSHandler } from '../../adapters/svelte-css-handler.js';
import { SolidCSSHandler } from '../../adapters/solid-css-handler.js';

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
    parentNode: null,
    classList: {
      add: vi.fn()
    }
  })),
  head: {
    appendChild: vi.fn(),
    contains: vi.fn(() => true)
  },
  getElementById: vi.fn(() => null)
};

// Mock window environment
const mockWindow = {
  dispatchEvent: vi.fn(),
  CustomEvent: vi.fn().mockImplementation((type, options) => ({
    type,
    detail: options?.detail
  }))
};

describe('CSS Hot Reload Integration', () => {
  let orchestrator: HotReloadOrchestrator;
  let reactHandler: ReactCSSHandler;
  let vueHandler: VueCSSHandler;
  let svelteHandler: SvelteCSSHandler;
  let solidHandler: SolidCSSHandler;
  let originalDocument: any;
  let originalWindow: any;

  beforeEach(() => {
    // Mock global objects
    originalDocument = global.document;
    originalWindow = global.window;
    global.document = mockDocument as any;
    global.window = mockWindow as any;
    global.CustomEvent = mockWindow.CustomEvent as any;

    const config: Partial<HotReloadConfig> = {
      preserveState: true,
      batchUpdates: false,
      debounceMs: 0,
      syncFrameworks: true,
      showErrorOverlay: true,
      errorRecoveryMode: 'graceful',
      debugLogging: false,
      cssHotReload: {
        enableCSSHotReload: true,
        enableThemePropagation: true,
        enableFrameworkSpecificUpdates: true,
        debugLogging: false,
        debounceMs: 0
      }
    };

    orchestrator = new HotReloadOrchestrator(config);

    // Create and register framework CSS handlers
    reactHandler = new ReactCSSHandler({ debugLogging: false });
    vueHandler = new VueCSSHandler({ debugLogging: false });
    svelteHandler = new SvelteCSSHandler({ debugLogging: false });
    solidHandler = new SolidCSSHandler({ debugLogging: false });

    orchestrator.registerFrameworkCSSHandler(reactHandler);
    orchestrator.registerFrameworkCSSHandler(vueHandler);
    orchestrator.registerFrameworkCSSHandler(svelteHandler);
    orchestrator.registerFrameworkCSSHandler(solidHandler);
  });

  afterEach(() => {
    orchestrator.cleanup();
    global.document = originalDocument;
    global.window = originalWindow;
    vi.clearAllMocks();
  });

  describe('Multi-Framework CSS Updates', () => {
    it('should update CSS across all frameworks', async () => {
      // Register components for each framework
      orchestrator.registerComponentForCSS('react-component');
      orchestrator.registerComponentForCSS('vue-component');
      orchestrator.registerComponentForCSS('svelte-component');
      orchestrator.registerComponentForCSS('solid-component');

      const cssContent = `
        .component {
          background: #f0f0f0;
          padding: 16px;
          border-radius: 8px;
        }
      `;

      // Trigger CSS change
      await orchestrator.handleCSSChange(
        'components.css',
        'css',
        cssContent,
        ['react', 'vue', 'svelte', 'solid']
      );

      // Verify all frameworks received the update
      expect(reactHandler.extractComponentStyles('react-component')).toBeTruthy();
      expect(vueHandler.extractComponentStyles('vue-component')).toBeTruthy();
      expect(svelteHandler.extractComponentStyles('svelte-component')).toBeTruthy();
      expect(solidHandler.extractComponentStyles('solid-component')).toBeTruthy();
    });

    it('should propagate theme changes to all frameworks', async () => {
      const themeCSS = `
        :root {
          --primary-color: #667eea;
          --secondary-color: #764ba2;
          --success-color: #10b981;
          --error-color: #ef4444;
        }
      `;

      await orchestrator.handleCSSChange(
        'theme.css',
        'theme',
        themeCSS
      );

      // Verify CSS custom properties were set
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--primary-color',
        '#667eea'
      );
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--secondary-color',
        '#764ba2'
      );
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--success-color',
        '#10b981'
      );
      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--error-color',
        '#ef4444'
      );

      // Verify theme update events were dispatched
      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'react-theme-update'
        })
      );
      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vue-theme-update'
        })
      );
      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'svelte-theme-update'
        })
      );
      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'solid-theme-update'
        })
      );
    });

    it('should handle framework-specific CSS updates', async () => {
      orchestrator.registerComponentForCSS('react-button');

      const reactSpecificCSS = `
        .react-button {
          /* React-specific styles */
          transition: all 0.2s ease;
        }
        .react-button:hover {
          transform: translateY(-1px);
        }
      `;

      await orchestrator.handleCSSChange(
        'react-button.css',
        'css',
        reactSpecificCSS,
        ['react'] // Only affect React components
      );

      // Verify only React handler was updated
      expect(reactHandler.extractComponentStyles('react-button')).toBeTruthy();
      expect(vueHandler.extractComponentStyles('react-button')).toBeNull();
      expect(svelteHandler.extractComponentStyles('react-button')).toBeNull();
      expect(solidHandler.extractComponentStyles('react-button')).toBeNull();
    });
  });

  describe('CSS Scoping and Isolation', () => {
    it('should apply framework-specific scoping', async () => {
      orchestrator.registerComponentForCSS('scoped-component');

      const styles = '.scoped-component { color: red; }';

      await orchestrator.handleCSSChange(
        'scoped.css',
        'css',
        styles,
        ['vue', 'svelte', 'solid']
      );

      // Check that Vue, Svelte, and Solid handlers applied scoping
      const vueScoped = vueHandler.getScopedStyles('scoped-component');
      const svelteScoped = svelteHandler.getScopedStyles('scoped-component');
      const solidScoped = solidHandler.getScopedStyles('scoped-component');

      expect(vueScoped).toContain('[data-v-');
      expect(svelteScoped).toContain('.svelte-');
      expect(solidScoped).toContain('.solid-');
    });
  });

  describe('CSS Hot Reload Performance', () => {
    it('should handle multiple concurrent CSS updates', async () => {
      const components = ['comp1', 'comp2', 'comp3', 'comp4', 'comp5'];
      
      // Register multiple components
      components.forEach(comp => {
        orchestrator.registerComponentForCSS(comp);
      });

      // Trigger multiple concurrent updates
      const updatePromises = components.map((comp, index) => 
        orchestrator.handleCSSChange(
          `${comp}.css`,
          'css',
          `.${comp} { background: hsl(${index * 60}, 70%, 50%); }`,
          ['react', 'vue']
        )
      );

      await Promise.all(updatePromises);

      // Verify all updates completed
      components.forEach(comp => {
        expect(reactHandler.extractComponentStyles(comp)).toBeTruthy();
        expect(vueHandler.extractComponentStyles(comp)).toBeTruthy();
      });
    });

    it('should provide accurate CSS statistics', () => {
      orchestrator.registerComponentForCSS('stat-comp1');
      orchestrator.registerComponentForCSS('stat-comp2');

      const stats = orchestrator.getCSSStats();

      expect(stats.registeredComponents).toBe(2);
      expect(stats.registeredFrameworks).toBe(4); // React, Vue, Svelte, Solid
      expect(stats.activeUpdates).toBe(0);
      expect(stats.queuedUpdates).toBe(0);
      expect(stats.pendingUpdates).toBe(0);
    });
  });

  describe('CSS Error Handling', () => {
    it('should handle CSS parsing errors gracefully', async () => {
      const invalidCSS = `
        .invalid-css {
          color: red
          background: blue; /* Missing semicolon above */
        }
      `;

      // Should not throw
      await expect(orchestrator.handleCSSChange(
        'invalid.css',
        'css',
        invalidCSS
      )).resolves.not.toThrow();
    });

    it('should handle framework handler errors gracefully', async () => {
      // Create a handler that throws errors
      const errorHandler = new ReactCSSHandler({ debugLogging: false });
      const originalUpdateStyles = errorHandler.updateStyles;
      errorHandler.updateStyles = vi.fn().mockRejectedValue(new Error('Handler error'));

      orchestrator.registerFrameworkCSSHandler(errorHandler);
      orchestrator.registerComponentForCSS('error-component');

      // Should not throw
      await expect(orchestrator.handleCSSChange(
        'error.css',
        'css',
        '.error-component { color: red; }'
      )).resolves.not.toThrow();

      // Restore original method
      errorHandler.updateStyles = originalUpdateStyles;
    });
  });

  describe('CSS Hot Reload Configuration', () => {
    it('should respect CSS hot reload configuration', async () => {
      // Disable CSS hot reload
      orchestrator.updateConfig({
        cssHotReload: {
          enableCSSHotReload: false
        }
      });

      orchestrator.registerComponentForCSS('disabled-component');

      await orchestrator.handleCSSChange(
        'disabled.css',
        'css',
        '.disabled-component { color: red; }'
      );

      // Should not have updated since CSS hot reload is disabled
      expect(reactHandler.extractComponentStyles('disabled-component')).toBeNull();
    });

    it('should respect theme propagation configuration', async () => {
      // Disable theme propagation
      orchestrator.updateConfig({
        cssHotReload: {
          enableThemePropagation: false
        }
      });

      const themeCSS = ':root { --disabled-theme: #ff0000; }';

      await orchestrator.handleCSSChange(
        'disabled-theme.css',
        'theme',
        themeCSS
      );

      // Should not have set CSS custom properties
      expect(mockDocument.documentElement.style.setProperty).not.toHaveBeenCalledWith(
        '--disabled-theme',
        '#ff0000'
      );
    });
  });

  describe('Component Registration and Cleanup', () => {
    it('should register and unregister components properly', () => {
      orchestrator.registerComponentForCSS('temp-component', '.temp { color: blue; }');
      
      let stats = orchestrator.getCSSStats();
      expect(stats.registeredComponents).toBe(1);

      orchestrator.unregisterComponentFromCSS('temp-component');
      
      stats = orchestrator.getCSSStats();
      expect(stats.registeredComponents).toBe(0);
    });

    it('should register and unregister framework handlers properly', () => {
      const customHandler = new ReactCSSHandler({ debugLogging: false });
      customHandler.frameworkName = 'custom-react';

      orchestrator.registerFrameworkCSSHandler(customHandler);
      
      let stats = orchestrator.getCSSStats();
      expect(stats.registeredFrameworks).toBe(5); // Original 4 + custom

      orchestrator.unregisterFrameworkCSSHandler('custom-react');
      
      stats = orchestrator.getCSSStats();
      expect(stats.registeredFrameworks).toBe(4); // Back to original 4

      customHandler.cleanup();
    });
  });

  describe('Real-world CSS Scenarios', () => {
    it('should handle CSS with media queries', async () => {
      const responsiveCSS = `
        .responsive-component {
          padding: 16px;
        }
        
        @media (max-width: 768px) {
          .responsive-component {
            padding: 8px;
          }
        }
        
        @media (min-width: 1024px) {
          .responsive-component {
            padding: 24px;
          }
        }
      `;

      orchestrator.registerComponentForCSS('responsive-component');

      await orchestrator.handleCSSChange(
        'responsive.css',
        'css',
        responsiveCSS
      );

      expect(reactHandler.extractComponentStyles('responsive-component')).toBeTruthy();
    });

    it('should handle CSS with animations and keyframes', async () => {
      const animatedCSS = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animated-component {
          animation: fadeIn 0.3s ease-in-out;
        }
      `;

      orchestrator.registerComponentForCSS('animated-component');

      await orchestrator.handleCSSChange(
        'animations.css',
        'css',
        animatedCSS
      );

      expect(reactHandler.extractComponentStyles('animated-component')).toBeTruthy();
    });

    it('should handle CSS with custom properties and calc()', async () => {
      const modernCSS = `
        .modern-component {
          --spacing: 16px;
          --multiplier: 2;
          
          padding: var(--spacing);
          margin: calc(var(--spacing) * var(--multiplier));
          width: calc(100% - var(--spacing) * 2);
        }
      `;

      orchestrator.registerComponentForCSS('modern-component');

      await orchestrator.handleCSSChange(
        'modern.css',
        'css',
        modernCSS
      );

      expect(reactHandler.extractComponentStyles('modern-component')).toBeTruthy();
    });
  });
});