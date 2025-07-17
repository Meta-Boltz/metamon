/**
 * Framework CSS Handlers Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReactCSSHandler } from '../adapters/react-css-handler.js';
import { VueCSSHandler } from '../adapters/vue-css-handler.js';
import { SvelteCSSHandler } from '../adapters/svelte-css-handler.js';
import { SolidCSSHandler } from '../adapters/solid-css-handler.js';
import type { ThemeChange } from '../css-hot-reload-manager.js';

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

describe('Framework CSS Handlers', () => {
  let originalDocument: any;
  let originalWindow: any;

  beforeEach(() => {
    // Mock global objects
    originalDocument = global.document;
    originalWindow = global.window;
    global.document = mockDocument as any;
    global.window = mockWindow as any;
    global.CustomEvent = mockWindow.CustomEvent as any;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    vi.clearAllMocks();
  });

  describe('ReactCSSHandler', () => {
    let reactHandler: ReactCSSHandler;

    beforeEach(() => {
      reactHandler = new ReactCSSHandler({ debugLogging: false });
    });

    afterEach(() => {
      reactHandler.cleanup();
    });

    it('should have correct framework name and properties', () => {
      expect(reactHandler.frameworkName).toBe('react');
    });

    it('should update component styles', async () => {
      const componentId = 'test-react-component';
      const styles = '.react-component { background: blue; }';

      await reactHandler.updateStyles(componentId, styles);

      const extractedStyles = reactHandler.extractComponentStyles(componentId);
      expect(extractedStyles).toBe(styles);
    });

    it('should update theme variables', async () => {
      const themeChanges: ThemeChange[] = [
        {
          variableName: '--primary-color',
          oldValue: '#667eea',
          newValue: '#ff0000',
          scope: 'global'
        }
      ];

      await reactHandler.updateTheme(themeChanges);

      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--primary-color',
        '#ff0000'
      );
    });

    it('should validate style integrity', async () => {
      const componentId = 'test-component';
      const styles = '.test { color: red; }';

      await reactHandler.updateStyles(componentId, styles);
      
      const isValid = reactHandler.validateStyleIntegrity(componentId);
      expect(isValid).toBe(true);
    });

    it('should dispatch React style update events', async () => {
      const componentId = 'test-component';
      const styles = '.test { color: red; }';

      await reactHandler.updateStyles(componentId, styles);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'react-style-update',
          detail: expect.objectContaining({
            componentId,
            timestamp: expect.any(Number)
          })
        })
      );
    });

    it('should remove component styles', async () => {
      const componentId = 'test-component';
      await reactHandler.updateStyles(componentId, '.test { color: red; }');

      reactHandler.removeComponentStyles(componentId);

      const extractedStyles = reactHandler.extractComponentStyles(componentId);
      expect(extractedStyles).toBeNull();
    });

    it('should get registered components', async () => {
      await reactHandler.updateStyles('comp1', '.comp1 {}');
      await reactHandler.updateStyles('comp2', '.comp2 {}');

      const components = reactHandler.getRegisteredComponents();
      expect(components).toContain('comp1');
      expect(components).toContain('comp2');
      expect(components).toHaveLength(2);
    });
  });

  describe('VueCSSHandler', () => {
    let vueHandler: VueCSSHandler;

    beforeEach(() => {
      vueHandler = new VueCSSHandler({ debugLogging: false });
    });

    afterEach(() => {
      vueHandler.cleanup();
    });

    it('should have correct framework name', () => {
      expect(vueHandler.frameworkName).toBe('vue');
    });

    it('should update component styles with scoping', async () => {
      const componentId = 'test-vue-component';
      const styles = '.vue-component { background: green; }';

      await vueHandler.updateStyles(componentId, styles);

      const extractedStyles = vueHandler.extractComponentStyles(componentId);
      expect(extractedStyles).toBe(styles);

      const scopedStyles = vueHandler.getScopedStyles(componentId);
      expect(scopedStyles).toContain('[data-v-');
    });

    it('should update theme variables', async () => {
      const themeChanges: ThemeChange[] = [
        {
          variableName: '--vue-primary',
          oldValue: '#4fc08d',
          newValue: '#00ff00',
          scope: 'global'
        }
      ];

      await vueHandler.updateTheme(themeChanges);

      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--vue-primary',
        '#00ff00'
      );
    });

    it('should dispatch Vue style update events', async () => {
      const componentId = 'test-component';
      const styles = '.test { color: green; }';

      await vueHandler.updateStyles(componentId, styles);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vue-style-update',
          detail: expect.objectContaining({
            componentId,
            timestamp: expect.any(Number)
          })
        })
      );
    });

    it('should validate style integrity', async () => {
      const componentId = 'test-component';
      const styles = '.test { color: green; }';

      await vueHandler.updateStyles(componentId, styles);
      
      const isValid = vueHandler.validateStyleIntegrity(componentId);
      expect(isValid).toBe(true);
    });
  });

  describe('SvelteCSSHandler', () => {
    let svelteHandler: SvelteCSSHandler;

    beforeEach(() => {
      svelteHandler = new SvelteCSSHandler({ debugLogging: false });
    });

    afterEach(() => {
      svelteHandler.cleanup();
    });

    it('should have correct framework name', () => {
      expect(svelteHandler.frameworkName).toBe('svelte');
    });

    it('should update component styles with scoping', async () => {
      const componentId = 'test-svelte-component';
      const styles = '.svelte-component { background: orange; }';

      await svelteHandler.updateStyles(componentId, styles);

      const extractedStyles = svelteHandler.extractComponentStyles(componentId);
      expect(extractedStyles).toBe(styles);

      const scopedStyles = svelteHandler.getScopedStyles(componentId);
      expect(scopedStyles).toContain('.svelte-');
    });

    it('should update theme variables', async () => {
      const themeChanges: ThemeChange[] = [
        {
          variableName: '--svelte-primary',
          oldValue: '#ff3e00',
          newValue: '#ff6600',
          scope: 'global'
        }
      ];

      await svelteHandler.updateTheme(themeChanges);

      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--svelte-primary',
        '#ff6600'
      );
    });

    it('should dispatch Svelte style update events', async () => {
      const componentId = 'test-component';
      const styles = '.test { color: orange; }';

      await svelteHandler.updateStyles(componentId, styles);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'svelte-style-update',
          detail: expect.objectContaining({
            componentId,
            timestamp: expect.any(Number)
          })
        })
      );
    });

    it('should add scoped classes to components', () => {
      const componentId = 'test-component';
      const mockElement = {
        classList: { add: vi.fn() },
        querySelectorAll: vi.fn(() => [
          { classList: { add: vi.fn() } },
          { classList: { add: vi.fn() } }
        ])
      };

      svelteHandler.addScopedClassesToComponent(componentId, mockElement as any);

      expect(mockElement.classList.add).toHaveBeenCalledWith(
        expect.stringMatching(/^svelte-[a-z0-9]+$/)
      );
    });
  });

  describe('SolidCSSHandler', () => {
    let solidHandler: SolidCSSHandler;

    beforeEach(() => {
      solidHandler = new SolidCSSHandler({ debugLogging: false });
    });

    afterEach(() => {
      solidHandler.cleanup();
    });

    it('should have correct framework name', () => {
      expect(solidHandler.frameworkName).toBe('solid');
    });

    it('should update component styles with scoping', async () => {
      const componentId = 'test-solid-component';
      const styles = '.solid-component { background: purple; }';

      await solidHandler.updateStyles(componentId, styles);

      const extractedStyles = solidHandler.extractComponentStyles(componentId);
      expect(extractedStyles).toBe(styles);

      const scopedStyles = solidHandler.getScopedStyles(componentId);
      expect(scopedStyles).toContain('.solid-');
    });

    it('should update theme variables', async () => {
      const themeChanges: ThemeChange[] = [
        {
          variableName: '--solid-primary',
          oldValue: '#2c4f7c',
          newValue: '#4c6f9c',
          scope: 'global'
        }
      ];

      await solidHandler.updateTheme(themeChanges);

      expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--solid-primary',
        '#4c6f9c'
      );
    });

    it('should dispatch Solid style update events', async () => {
      const componentId = 'test-component';
      const styles = '.test { color: purple; }';

      await solidHandler.updateStyles(componentId, styles);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'solid-style-update',
          detail: expect.objectContaining({
            componentId,
            timestamp: expect.any(Number)
          })
        })
      );
    });

    it('should add scoped classes to components', () => {
      const componentId = 'test-component';
      const mockElement = {
        classList: { add: vi.fn() },
        querySelectorAll: vi.fn(() => [
          { classList: { add: vi.fn() } },
          { classList: { add: vi.fn() } }
        ])
      };

      solidHandler.addScopedClassesToComponent(componentId, mockElement as any);

      expect(mockElement.classList.add).toHaveBeenCalledWith(
        expect.stringMatching(/^solid-[a-z0-9]+$/)
      );
    });
  });

  describe('Common Framework Handler Behavior', () => {
    const handlers = [
      () => new ReactCSSHandler({ debugLogging: false }),
      () => new VueCSSHandler({ debugLogging: false }),
      () => new SvelteCSSHandler({ debugLogging: false }),
      () => new SolidCSSHandler({ debugLogging: false })
    ];

    handlers.forEach((createHandler, index) => {
      const frameworkNames = ['react', 'vue', 'svelte', 'solid'];
      const frameworkName = frameworkNames[index];

      describe(`${frameworkName} handler`, () => {
        let handler: any;

        beforeEach(() => {
          handler = createHandler();
        });

        afterEach(() => {
          handler.cleanup();
        });

        it('should implement all required methods', () => {
          expect(typeof handler.updateStyles).toBe('function');
          expect(typeof handler.updateTheme).toBe('function');
          expect(typeof handler.extractComponentStyles).toBe('function');
          expect(typeof handler.validateStyleIntegrity).toBe('function');
          expect(handler.frameworkName).toBe(frameworkName);
        });

        it('should handle empty styles gracefully', async () => {
          await expect(handler.updateStyles('test', '')).resolves.not.toThrow();
        });

        it('should handle empty theme changes gracefully', async () => {
          await expect(handler.updateTheme([])).resolves.not.toThrow();
        });

        it('should return null for non-existent component styles', () => {
          const styles = handler.extractComponentStyles('non-existent');
          expect(styles).toBeNull();
        });

        it('should return false for non-existent component validation', () => {
          const isValid = handler.validateStyleIntegrity('non-existent');
          expect(isValid).toBe(false);
        });
      });
    });
  });
});