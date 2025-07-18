/**
 * Tests for Placeholder Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlaceholderManager } from '../layout-stability/placeholder-manager.js';
import { ComponentDefinition, PlaceholderConfig, TransitionConfig } from '../layout-stability/types.js';

// Mock DOM APIs
const mockElement = {
  getBoundingClientRect: vi.fn(() => ({
    width: 200,
    height: 100,
    top: 50,
    left: 50,
    right: 250,
    bottom: 150
  })),
  parentNode: {
    insertBefore: vi.fn(),
    removeChild: vi.fn(),
    replaceChild: vi.fn()
  },
  style: {},
  appendChild: vi.fn(),
  className: '',
  id: '',
  offsetTop: 50,
  offsetLeft: 50
} as any;

const createMockElement = () => {
  const styleObj: any = {};
  return {
    style: new Proxy(styleObj, {
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
      get(target, prop) {
        return target[prop] || '';
      }
    }),
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    innerHTML: '',
    textContent: '',
    className: '',
    parentNode: mockElement.parentNode,
    getBoundingClientRect: vi.fn(() => ({
      width: 200,
      height: 100,
      top: 50,
      left: 50,
      right: 250,
      bottom: 150
    }))
  };
};

const mockDocument = {
  createElement: vi.fn(() => createMockElement()),
  getElementById: vi.fn(() => null),
  head: {
    appendChild: vi.fn()
  }
};

global.document = mockDocument as any;

describe('PlaceholderManager', () => {
  let manager: PlaceholderManager;
  let placeholderConfig: PlaceholderConfig;
  let transitionConfig: TransitionConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    placeholderConfig = {
      showLoadingIndicator: true,
      loadingIndicatorType: 'skeleton',
      maintainAspectRatio: true,
      backgroundColor: '#f0f0f0',
      borderRadius: '4px',
      animation: {
        type: 'pulse',
        duration: 1500,
        easing: 'ease-in-out'
      }
    };

    transitionConfig = {
      duration: 300,
      easing: 'ease-out',
      fadeOut: true,
      fadeIn: true,
      crossFade: false,
      maintainPosition: true
    };

    manager = new PlaceholderManager(placeholderConfig, transitionConfig);
  });

  describe('Placeholder Creation', () => {
    it('should create placeholder with component definition', () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false,
        estimatedSize: { width: 200, height: 100 }
      };

      const placeholder = manager.createPlaceholder(component);

      expect(placeholder).toBeDefined();
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(placeholder.setAttribute).toHaveBeenCalledWith('data-component-id', 'test-component');
      expect(placeholder.setAttribute).toHaveBeenCalledWith('data-framework', 'react');
    });

    it('should create placeholder with target element dimensions', () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'vue',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = manager.createPlaceholder(component, mockElement);

      expect(placeholder.style.width).toBe('200px');
      expect(placeholder.style.height).toBe('100px');
    });

    it('should create placeholder with estimated dimensions', () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'svelte',
        tagName: 'div',
        isInteractive: false,
        estimatedSize: { width: 300, height: 150 }
      };

      const placeholder = manager.createPlaceholder(component);

      expect(placeholder.style.width).toBe('300px');
      expect(placeholder.style.height).toBe('150px');
    });

    it('should create placeholder with default dimensions', () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'solid',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = manager.createPlaceholder(component);

      expect(placeholder.style.width).toBe('200px');
      expect(placeholder.style.height).toBe('100px');
    });

    it('should apply aspect ratio when enabled', () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false,
        estimatedSize: { width: 400, height: 200 }
      };

      const placeholder = manager.createPlaceholder(component);

      expect(placeholder.style.aspectRatio).toBe('400 / 200');
    });
  });

  describe('Loading Indicators', () => {
    it('should create spinner loading indicator', () => {
      const config = { ...placeholderConfig, loadingIndicatorType: 'spinner' as const };
      const spinnerManager = new PlaceholderManager(config, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = spinnerManager.createPlaceholder(component);

      expect(placeholder.appendChild).toHaveBeenCalled();
    });

    it('should create skeleton loading indicator', () => {
      const config = { ...placeholderConfig, loadingIndicatorType: 'skeleton' as const };
      const skeletonManager = new PlaceholderManager(config, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = skeletonManager.createPlaceholder(component);

      expect(placeholder.appendChild).toHaveBeenCalled();
    });

    it('should create pulse loading indicator', () => {
      const config = { ...placeholderConfig, loadingIndicatorType: 'pulse' as const };
      const pulseManager = new PlaceholderManager(config, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = pulseManager.createPlaceholder(component);

      expect(placeholder.appendChild).toHaveBeenCalled();
    });

    it('should create custom loading indicator', () => {
      const config = {
        ...placeholderConfig,
        loadingIndicatorType: 'custom' as const,
        customLoadingContent: '<div class="custom-loader">Loading...</div>'
      };
      const customManager = new PlaceholderManager(config, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = customManager.createPlaceholder(component);

      expect(placeholder.appendChild).toHaveBeenCalled();
    });

    it('should not create loading indicator when disabled', () => {
      const config = { ...placeholderConfig, showLoadingIndicator: false };
      const noIndicatorManager = new PlaceholderManager(config, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = noIndicatorManager.createPlaceholder(component);

      expect(placeholder.appendChild).not.toHaveBeenCalled();
    });
  });

  describe('Placeholder Management', () => {
    it('should track created placeholders', () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = manager.createPlaceholder(component);

      expect(manager.hasPlaceholder('test-component')).toBe(true);
      expect(manager.getPlaceholder('test-component')).toBe(placeholder);
    });

    it('should get all active placeholders', () => {
      const component1: ComponentDefinition = {
        id: 'component-1',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const component2: ComponentDefinition = {
        id: 'component-2',
        framework: 'vue',
        tagName: 'div',
        isInteractive: false
      };

      manager.createPlaceholder(component1);
      manager.createPlaceholder(component2);

      const activePlaceholders = manager.getActivePlaceholders();
      expect(activePlaceholders.size).toBe(2);
      expect(activePlaceholders.has('component-1')).toBe(true);
      expect(activePlaceholders.has('component-2')).toBe(true);
    });

    it('should remove placeholder', () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = manager.createPlaceholder(component);
      placeholder.parentNode = mockElement.parentNode;

      manager.removePlaceholder('test-component');

      expect(mockElement.parentNode.removeChild).toHaveBeenCalledWith(placeholder);
      expect(manager.hasPlaceholder('test-component')).toBe(false);
    });

    it('should clear all placeholders', () => {
      const component1: ComponentDefinition = {
        id: 'component-1',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const component2: ComponentDefinition = {
        id: 'component-2',
        framework: 'vue',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder1 = manager.createPlaceholder(component1);
      const placeholder2 = manager.createPlaceholder(component2);
      
      placeholder1.parentNode = mockElement.parentNode;
      placeholder2.parentNode = mockElement.parentNode;

      manager.clearAll();

      expect(manager.getActivePlaceholders().size).toBe(0);
    });
  });

  describe('Placeholder Replacement', () => {
    it('should replace placeholder with actual element', async () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = manager.createPlaceholder(component);
      placeholder.parentNode = mockElement.parentNode;
      
      const actualElement = mockDocument.createElement('div');

      await manager.replacePlaceholder('test-component', actualElement);

      expect(mockElement.parentNode.insertBefore).toHaveBeenCalledWith(actualElement, placeholder);
    });

    it('should handle missing placeholder gracefully', async () => {
      const actualElement = mockDocument.createElement('div');

      // Should not throw
      await expect(
        manager.replacePlaceholder('non-existent', actualElement)
      ).resolves.toBeUndefined();
    });

    it('should handle placeholder without parent gracefully', async () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      manager.createPlaceholder(component);
      const actualElement = mockDocument.createElement('div');

      // Should not throw when placeholder has no parent
      await expect(
        manager.replacePlaceholder('test-component', actualElement)
      ).resolves.toBeUndefined();
    });
  });

  describe('Transitions', () => {
    it('should perform cross-fade transition', async () => {
      const crossFadeConfig = { ...transitionConfig, crossFade: true };
      const crossFadeManager = new PlaceholderManager(placeholderConfig, crossFadeConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = crossFadeManager.createPlaceholder(component);
      placeholder.parentNode = mockElement.parentNode;
      
      const actualElement = mockDocument.createElement('div');

      // Mock the transition by checking if the replacement was called
      await crossFadeManager.replacePlaceholder('test-component', actualElement);

      // Verify that the replacement happened (placeholder should be inserted)
      expect(mockElement.parentNode.insertBefore).toHaveBeenCalledWith(actualElement, placeholder);
    });

    it('should perform sequential fade transition', async () => {
      const sequentialConfig = { ...transitionConfig, crossFade: false };
      const sequentialManager = new PlaceholderManager(placeholderConfig, sequentialConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = sequentialManager.createPlaceholder(component);
      placeholder.parentNode = mockElement.parentNode;
      
      const actualElement = mockDocument.createElement('div');

      await sequentialManager.replacePlaceholder('test-component', actualElement);

      expect(placeholder.style.transition).toContain('opacity');
    });

    it('should handle transition errors gracefully', async () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = manager.createPlaceholder(component);
      placeholder.parentNode = mockElement.parentNode;
      
      // Mock error during transition
      const actualElement = mockDocument.createElement('div');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Force an error by making insertBefore throw
      mockElement.parentNode.insertBefore.mockImplementationOnce(() => {
        throw new Error('Insert error');
      });

      await manager.replacePlaceholder('test-component', actualElement);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error replacing placeholder'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Styling and Animation', () => {
    it('should apply custom background color', () => {
      const customConfig = { ...placeholderConfig, backgroundColor: '#ff0000' };
      const customManager = new PlaceholderManager(customConfig, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = customManager.createPlaceholder(component);

      expect(placeholder.style.backgroundColor).toBe('#ff0000');
    });

    it('should apply custom border radius', () => {
      const customConfig = { ...placeholderConfig, borderRadius: '8px' };
      const customManager = new PlaceholderManager(customConfig, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = customManager.createPlaceholder(component);

      expect(placeholder.style.borderRadius).toBe('8px');
    });

    it('should apply animation when enabled', () => {
      const animatedConfig = {
        ...placeholderConfig,
        animation: {
          type: 'fade' as const,
          duration: 2000,
          easing: 'ease-in'
        }
      };
      const animatedManager = new PlaceholderManager(animatedConfig, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = animatedManager.createPlaceholder(component);

      expect(placeholder.style.animation).toContain('metamon-placeholder-fade');
      expect(placeholder.style.animation).toContain('2000ms');
      expect(placeholder.style.animation).toContain('ease-in');
    });

    it('should not apply animation when disabled', () => {
      const noAnimationConfig = {
        ...placeholderConfig,
        animation: {
          type: 'none' as const,
          duration: 1000,
          easing: 'ease'
        }
      };
      const noAnimationManager = new PlaceholderManager(noAnimationConfig, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = noAnimationManager.createPlaceholder(component);

      expect(placeholder.style.animation).toBe('');
    });
  });

  describe('CSS Injection', () => {
    it('should inject animation CSS only once', () => {
      const animatedConfig = {
        ...placeholderConfig,
        animation: {
          type: 'slide' as const,
          duration: 1000,
          easing: 'ease'
        }
      };
      const animatedManager = new PlaceholderManager(animatedConfig, transitionConfig);

      const component1: ComponentDefinition = {
        id: 'component-1',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const component2: ComponentDefinition = {
        id: 'component-2',
        framework: 'vue',
        tagName: 'div',
        isInteractive: false
      };

      // Mock getElementById to return null first time, then return element
      let callCount = 0;
      mockDocument.getElementById.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? null : { id: 'metamon-placeholder-slide-animation' };
      });

      animatedManager.createPlaceholder(component1);
      animatedManager.createPlaceholder(component2);

      // Should only append style once
      expect(mockDocument.head.appendChild).toHaveBeenCalledTimes(1);
    });

    it('should inject spinner CSS when needed', () => {
      // Reset the mock to ensure getElementById returns null for spinner CSS
      mockDocument.getElementById.mockReturnValue(null);
      
      const spinnerConfig = { ...placeholderConfig, loadingIndicatorType: 'spinner' as const };
      const spinnerManager = new PlaceholderManager(spinnerConfig, transitionConfig);

      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      spinnerManager.createPlaceholder(component);

      expect(mockDocument.head.appendChild).toHaveBeenCalled();
    });
  });
});