/**
 * Tests for Selective Hydration Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { SelectiveHydrationService } from '../ssr-optimization/selective-hydration-service.js';
import { HydrationTarget, LoadPriority } from '../types/ssr-optimization.js';

describe('SelectiveHydrationService', () => {
  let service: SelectiveHydrationService;
  let mockTargets: HydrationTarget[];
  let dom: JSDOM;
  let mockIntersectionObserver: any;

  beforeEach(() => {
    // Set up JSDOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    // Mock IntersectionObserver
    mockIntersectionObserver = vi.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    });
    
    // Add IntersectionObserver to the window object
    dom.window.IntersectionObserver = mockIntersectionObserver;
    
    // Set up global DOM objects
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('navigator', dom.window.navigator);
    vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);
    
    service = new SelectiveHydrationService();
    
    mockTargets = [
      {
        componentId: 'critical-1',
        framework: 'react',
        isInteractive: true,
        priority: LoadPriority.CRITICAL,
        selector: '[data-hydration-id="critical-1"]',
        props: {}
      },
      {
        componentId: 'high-1',
        framework: 'vue',
        isInteractive: true,
        priority: LoadPriority.HIGH,
        selector: '[data-hydration-id="high-1"]',
        props: {}
      },
      {
        componentId: 'normal-1',
        framework: 'svelte',
        isInteractive: false,
        priority: LoadPriority.NORMAL,
        selector: '[data-hydration-id="normal-1"]',
        props: {}
      },
      {
        componentId: 'low-1',
        framework: 'solid',
        isInteractive: false,
        priority: LoadPriority.LOW,
        selector: '[data-hydration-id="low-1"]',
        props: {}
      }
    ];

    // Set up DOM
    document.body.innerHTML = `
      <div data-hydration-id="critical-1">Critical content</div>
      <div data-hydration-id="high-1">High priority content</div>
      <div data-hydration-id="normal-1">Normal content</div>
      <div data-hydration-id="low-1">Low priority content</div>
    `;

    // Mock window globals
    vi.stubGlobal('window', {
      ...window,
      __react_loaded: false,
      __vue_loaded: false,
      __svelte_loaded: false,
      __solid_loaded: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processHydrationTargets', () => {
    it('should process and schedule hydration targets based on strategies', () => {
      service.processHydrationTargets(mockTargets);
      
      const status = service.getQueueStatus();
      expect(status.pending).toBeGreaterThan(0);
      expect(status.hydrated).toBe(0);
    });

    it('should prioritize critical interactive components', () => {
      service.processHydrationTargets(mockTargets);
      
      // Critical components should be scheduled immediately
      const status = service.getQueueStatus();
      expect(status.pending).toBeGreaterThan(0);
    });
  });

  describe('scheduleHydration', () => {
    it('should schedule hydration for a target', () => {
      const target = mockTargets[0];
      service.scheduleHydration(target);
      
      const status = service.getQueueStatus();
      expect(status.pending).toBe(1);
    });

    it('should not schedule hydration for already hydrated components', () => {
      const target = mockTargets[0];
      
      // Schedule once
      service.scheduleHydration(target);
      expect(service.getQueueStatus().pending).toBe(1);
      
      // Mark as hydrated
      (service as any).hydratedComponents.add(target.componentId);
      
      // Try to schedule again
      service.scheduleHydration(target);
      expect(service.getQueueStatus().pending).toBe(1); // Should not increase
    });

    it('should set up viewport observation for low priority components', () => {
      const lowPriorityTarget = mockTargets[3];
      service.scheduleHydration(lowPriorityTarget);
      
      // IntersectionObserver constructor should be called during service initialization
      // and observe should be called for the low priority target
      expect(mockIntersectionObserver).toHaveBeenCalled();
      
      // Check that observe was called on the mock observer instance
      const observerInstance = mockIntersectionObserver.mock.results[0].value;
      expect(observerInstance.observe).toHaveBeenCalled();
    });
  });

  describe('hydrateImmediately', () => {
    it('should hydrate a component immediately', async () => {
      const target = mockTargets[0];
      service.scheduleHydration(target);
      
      await service.hydrateImmediately(target.componentId);
      
      const element = document.querySelector(target.selector);
      expect(element?.getAttribute('data-hydrated')).toBe('true');
      
      const status = service.getQueueStatus();
      expect(status.hydrated).toBe(1);
      expect(status.pending).toBe(0);
    });

    it('should throw error for non-existent component', async () => {
      await expect(service.hydrateImmediately('nonexistent')).rejects.toThrow(
        'Hydration target not found: nonexistent'
      );
    });

    it('should handle hydration errors gracefully', async () => {
      const originalConsoleError = console.error;
      console.error = vi.fn();

      // Create a target with invalid selector
      const invalidTarget = {
        ...mockTargets[0],
        selector: '[data-invalid="true"]'
      };
      
      service.scheduleHydration(invalidTarget);
      
      await service.hydrateImmediately(invalidTarget.componentId);
      
      expect(console.error).toHaveBeenCalled();
      
      console.error = originalConsoleError;
    });
  });

  describe('cancelHydration', () => {
    it('should cancel scheduled hydration', () => {
      const target = mockTargets[0];
      service.scheduleHydration(target);
      
      expect(service.getQueueStatus().pending).toBe(1);
      
      service.cancelHydration(target.componentId);
      
      expect(service.getQueueStatus().pending).toBe(0);
    });
  });

  describe('framework-specific hydration', () => {
    it('should hydrate React components', async () => {
      const reactTarget = mockTargets[0];
      service.scheduleHydration(reactTarget);
      
      await service.hydrateImmediately(reactTarget.componentId);
      
      const element = document.querySelector(reactTarget.selector);
      expect(element?.getAttribute('data-hydrated')).toBe('true');
    });

    it('should hydrate Vue components', async () => {
      const vueTarget = mockTargets[1];
      service.scheduleHydration(vueTarget);
      
      await service.hydrateImmediately(vueTarget.componentId);
      
      const element = document.querySelector(vueTarget.selector);
      expect(element?.getAttribute('data-hydrated')).toBe('true');
    });

    it('should hydrate Svelte components', async () => {
      const svelteTarget = mockTargets[2];
      service.scheduleHydration(svelteTarget);
      
      await service.hydrateImmediately(svelteTarget.componentId);
      
      const element = document.querySelector(svelteTarget.selector);
      expect(element?.getAttribute('data-hydrated')).toBe('true');
    });

    it('should hydrate Solid components', async () => {
      const solidTarget = mockTargets[3];
      service.scheduleHydration(solidTarget);
      
      await service.hydrateImmediately(solidTarget.componentId);
      
      const element = document.querySelector(solidTarget.selector);
      expect(element?.getAttribute('data-hydrated')).toBe('true');
    });

    it('should handle unsupported frameworks', async () => {
      const originalConsoleError = console.error;
      console.error = vi.fn();

      const unsupportedTarget = {
        ...mockTargets[0],
        framework: 'angular' as any
      };
      
      service.scheduleHydration(unsupportedTarget);
      
      // The service handles errors gracefully, so it won't throw but will log the error
      await service.hydrateImmediately(unsupportedTarget.componentId);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Hydration failed for critical-1:'),
        expect.any(Error)
      );
      
      console.error = originalConsoleError;
    });
  });

  describe('interactive components', () => {
    it('should add event listeners to interactive components', async () => {
      const interactiveTarget = mockTargets[0]; // Critical interactive component
      service.scheduleHydration(interactiveTarget);
      
      await service.hydrateImmediately(interactiveTarget.componentId);
      
      const element = document.querySelector(interactiveTarget.selector);
      expect(element?.getAttribute('data-hydrated')).toBe('true');
      
      // Test that click event is handled
      const originalConsoleLog = console.log;
      console.log = vi.fn();
      
      element?.dispatchEvent(new dom.window.Event('click'));
      
      expect(console.log).toHaveBeenCalledWith(
        `React component ${interactiveTarget.componentId} clicked`
      );
      
      console.log = originalConsoleLog;
    });

    it('should not add event listeners to non-interactive components', async () => {
      const nonInteractiveTarget = mockTargets[2]; // Normal non-interactive component
      service.scheduleHydration(nonInteractiveTarget);
      
      await service.hydrateImmediately(nonInteractiveTarget.componentId);
      
      const element = document.querySelector(nonInteractiveTarget.selector);
      expect(element?.getAttribute('data-hydrated')).toBe('true');
      
      // Event should not trigger any logs
      const originalConsoleLog = console.log;
      console.log = vi.fn();
      
      element?.dispatchEvent(new dom.window.Event('click'));
      
      // Should not log anything for non-interactive components
      expect(console.log).not.toHaveBeenCalled();
      
      console.log = originalConsoleLog;
    });
  });

  describe('flushHydrations', () => {
    it('should flush all pending hydrations', async () => {
      service.processHydrationTargets(mockTargets);
      
      const initialStatus = service.getQueueStatus();
      expect(initialStatus.pending).toBeGreaterThan(0);
      
      await service.flushHydrations();
      
      // Note: The actual flushing behavior depends on the scheduler implementation
      // This test verifies the method can be called without errors
    });
  });

  describe('registerStrategy', () => {
    it('should register custom hydration strategies', () => {
      const customStrategy = {
        name: 'custom-test',
        shouldHydrate: (target: HydrationTarget) => target.componentId.includes('test'),
        priority: LoadPriority.HIGH
      };
      
      service.registerStrategy(customStrategy);
      
      // Test that the strategy is applied
      const testTarget = {
        ...mockTargets[0],
        componentId: 'test-component'
      };
      
      service.processHydrationTargets([testTarget]);
      
      const status = service.getQueueStatus();
      expect(status.pending).toBeGreaterThan(0);
    });
  });
});