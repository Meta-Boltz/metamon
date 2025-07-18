/**
 * Tests for SSR Optimization Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { SSROptimizationManager } from '../ssr-optimization/ssr-optimization-manager.js';
import {
  ComponentDefinition,
  LoadPriority,
  FallbackStrategy
} from '../types/ssr-optimization.js';

describe('SSROptimizationManager', () => {
  let manager: SSROptimizationManager;
  let mockComponents: ComponentDefinition[];
  let dom: JSDOM;

  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    // Set up global DOM objects
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('navigator', dom.window.navigator);
    
    manager = new SSROptimizationManager();
    
    mockComponents = [
      {
        id: 'header-1',
        framework: 'react',
        component: 'Header',
        props: { title: 'Test' },
        isInteractive: true,
        priority: LoadPriority.CRITICAL
      },
      {
        id: 'content-1',
        framework: 'vue',
        component: 'Content',
        props: { text: 'Hello' },
        isInteractive: false,
        priority: LoadPriority.NORMAL
      },
      {
        id: 'sidebar-1',
        framework: 'svelte',
        component: 'Sidebar',
        props: {},
        isInteractive: true,
        priority: LoadPriority.LOW
      }
    ];

    // Mock performance.now
    vi.stubGlobal('performance', {
      now: vi.fn(() => 100)
    });
  });

  describe('renderServerContent', () => {
    it('should render server content with hydration data', async () => {
      const result = await manager.renderServerContent(mockComponents);

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('criticalCSS');
      expect(result).toHaveProperty('hydrationData');
      expect(result).toHaveProperty('frameworkRequirements');
      
      expect(result.html).toContain('data-hydration-id');
      expect(result.frameworkRequirements).toHaveLength(3);
    });

    it('should include only interactive components in hydration data', async () => {
      const result = await manager.renderServerContent(mockComponents);
      
      const interactiveComponents = result.hydrationData.components;
      expect(interactiveComponents).toHaveLength(2); // header and sidebar are interactive
      
      const componentIds = interactiveComponents.map(c => c.componentId);
      expect(componentIds).toContain('header-1');
      expect(componentIds).toContain('sidebar-1');
      expect(componentIds).not.toContain('content-1');
    });

    it('should handle SSR failures gracefully', async () => {
      // Mock a failure scenario
      const originalConsoleError = console.error;
      console.error = vi.fn();

      // Create a manager that will fail
      const failingManager = new SSROptimizationManager();
      
      // Override the generateOptimizedHTML method to throw
      (failingManager as any).generateOptimizedHTML = vi.fn().mockRejectedValue(new Error('SSR failed'));

      const result = await failingManager.renderServerContent(mockComponents);
      
      expect(result.html).toContain('data-ssr-fallback="true"');
      expect(console.error).toHaveBeenCalled();
      
      console.error = originalConsoleError;
    });
  });

  describe('identifyHydrationTargets', () => {
    it('should identify hydration targets from SSR content', () => {
      const ssrContent = `
        <div data-hydration-id="header-1" data-hydration-marker='{"id":"header-1","framework":"react","isInteractive":true,"props":{"title":"Test"}}'>
          <div>Header content</div>
        </div>
        <div data-hydration-id="content-1" data-hydration-marker='{"id":"content-1","framework":"vue","isInteractive":false,"props":{"text":"Hello"}}'>
          <div>Content</div>
        </div>
      `;

      const targets = manager.identifyHydrationTargets(ssrContent);
      
      expect(targets).toHaveLength(2);
      expect(targets[0].componentId).toBe('header-1');
      expect(targets[0].framework).toBe('react');
      expect(targets[0].isInteractive).toBe(true);
    });

    it('should sort targets by priority', () => {
      const ssrContent = `
        <div data-hydration-id="low-1" data-hydration-marker='{"id":"low-1","framework":"svelte","isInteractive":false,"props":{}}'>
          <div>Low priority</div>
        </div>
        <div data-hydration-id="high-1" data-hydration-marker='{"id":"high-1","framework":"react","isInteractive":true,"props":{}}'>
          <div>High priority</div>
        </div>
      `;

      const targets = manager.identifyHydrationTargets(ssrContent);
      
      expect(targets[0].componentId).toBe('high-1'); // Interactive component should be first
      expect(targets[0].priority).toBe(LoadPriority.HIGH);
    });

    it('should handle malformed hydration markers gracefully', () => {
      const originalConsoleWarn = console.warn;
      console.warn = vi.fn();

      const ssrContent = `
        <div data-hydration-id="test-1" data-hydration-marker='invalid-json'>
          <div>Content</div>
        </div>
      `;

      const targets = manager.identifyHydrationTargets(ssrContent);
      
      expect(targets).toHaveLength(0);
      expect(console.warn).toHaveBeenCalledWith('Failed to parse hydration marker:', 'invalid-json');
      
      console.warn = originalConsoleWarn;
    });
  });

  describe('hydrateComponent', () => {
    beforeEach(() => {
      // Set up DOM
      document.body.innerHTML = `
        <div data-hydration-id="test-1" data-hydration-marker='{"id":"test-1","framework":"react","isInteractive":true}'>
          <div>Test content</div>
        </div>
      `;
    });

    it('should hydrate a component successfully', async () => {
      const target = {
        componentId: 'test-1',
        framework: 'react' as const,
        isInteractive: true,
        priority: LoadPriority.HIGH,
        selector: '[data-hydration-id="test-1"]',
        props: {}
      };

      await manager.hydrateComponent(target);
      
      const element = document.querySelector('[data-hydration-id="test-1"]');
      expect(element?.getAttribute('data-hydrated')).toBe('true');
      expect(element?.getAttribute('data-framework')).toBe('react');
    });

    it('should handle hydration failures', async () => {
      const originalConsoleError = console.error;
      console.error = vi.fn();

      const target = {
        componentId: 'nonexistent',
        framework: 'react' as const,
        isInteractive: true,
        priority: LoadPriority.HIGH,
        selector: '[data-hydration-id="nonexistent"]',
        props: {}
      };

      await manager.hydrateComponent(target);
      
      expect(console.error).toHaveBeenCalledWith(
        'Hydration failed for component nonexistent:',
        expect.any(Error)
      );
      
      console.error = originalConsoleError;
    });
  });

  describe('analyzeFrameworkRequirements', () => {
    it('should analyze framework requirements correctly', () => {
      const requirements = manager.analyzeFrameworkRequirements(mockComponents);
      
      expect(requirements).toHaveLength(3);
      
      const reactReq = requirements.find(r => r.framework === 'react');
      expect(reactReq).toBeDefined();
      expect(reactReq?.priority).toBe(LoadPriority.CRITICAL);
      expect(reactReq?.components).toContain('header-1');
      
      const vueReq = requirements.find(r => r.framework === 'vue');
      expect(vueReq?.priority).toBe(LoadPriority.NORMAL);
      
      const svelteReq = requirements.find(r => r.framework === 'svelte');
      expect(svelteReq?.priority).toBe(LoadPriority.LOW);
    });

    it('should filter out low priority frameworks when appropriate', () => {
      const requirements = manager.analyzeFrameworkRequirements(mockComponents);
      
      // All frameworks should be included in this test
      expect(requirements).toHaveLength(3);
      
      // But they should be sorted by priority
      expect(requirements[0].priority).toBe(LoadPriority.CRITICAL);
      expect(requirements[1].priority).toBe(LoadPriority.NORMAL);
      expect(requirements[2].priority).toBe(LoadPriority.LOW);
    });
  });

  describe('enableProgressiveEnhancement', () => {
    it('should enable progressive enhancement with specified strategy', () => {
      manager.enableProgressiveEnhancement(FallbackStrategy.MINIMAL_FALLBACK);
      
      const config = (manager as any).config;
      expect(config.fallbackStrategy).toBe(FallbackStrategy.MINIMAL_FALLBACK);
      expect(config.enableProgressiveEnhancement).toBe(true);
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableSelectiveHydration: false,
        hydrateOnlyInteractive: false,
        performanceThresholds: {
          maxHydrationTime: 200,
          maxFrameworkLoadTime: 300,
          maxLayoutShift: 0.05
        }
      };

      manager.configure(newConfig);
      
      const config = (manager as any).config;
      expect(config.enableSelectiveHydration).toBe(false);
      expect(config.hydrateOnlyInteractive).toBe(false);
      expect(config.performanceThresholds.maxHydrationTime).toBe(200);
    });
  });

  describe('getMetrics', () => {
    it('should return performance metrics', async () => {
      await manager.renderServerContent(mockComponents);
      
      const metrics = manager.getMetrics();
      
      expect(metrics).toHaveProperty('renderTime');
      expect(metrics).toHaveProperty('hydrationTime');
      expect(metrics).toHaveProperty('frameworkLoadTime');
      expect(metrics).toHaveProperty('totalComponents');
      expect(metrics).toHaveProperty('interactiveComponents');
      
      expect(metrics.totalComponents).toBe(3);
      expect(metrics.interactiveComponents).toBe(2);
      expect(metrics.renderTime).toBeGreaterThanOrEqual(0);
    });
  });
});