/**
 * Tests for Layout Stability Controller
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LayoutStabilityController } from '../layout-stability/layout-stability-controller.js';
import { ComponentDefinition, LayoutStabilityConfig } from '../layout-stability/types.js';

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
  getAttribute: vi.fn(() => 'react'),
  tagName: 'DIV',
  parentNode: {
    insertBefore: vi.fn(),
    removeChild: vi.fn(),
    replaceChild: vi.fn()
  },
  style: {},
  hasAttribute: vi.fn(() => false),
  appendChild: vi.fn(),
  className: '',
  id: ''
} as any;

const mockDocument = {
  createElement: vi.fn(() => ({
    ...mockElement,
    style: {},
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    innerHTML: '',
    textContent: ''
  })),
  getElementById: vi.fn(() => null),
  head: {
    appendChild: vi.fn()
  }
};

const mockPerformanceObserver = vi.fn();
mockPerformanceObserver.prototype.observe = vi.fn();
mockPerformanceObserver.prototype.disconnect = vi.fn();
mockPerformanceObserver.supportedEntryTypes = ['layout-shift'];

// Setup global mocks
global.document = mockDocument as any;
global.PerformanceObserver = mockPerformanceObserver as any;
let performanceNowValue = 1000;
global.performance = { 
  now: vi.fn(() => {
    performanceNowValue += 100; // Increment by 100ms each call
    return performanceNowValue;
  })
} as any;
global.window = {
  dispatchEvent: vi.fn()
} as any;

describe('LayoutStabilityController', () => {
  let controller: LayoutStabilityController;
  let config: Partial<LayoutStabilityConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    performanceNowValue = 1000; // Reset performance counter
    
    config = {
      clsThreshold: 0.1,
      enablePlaceholders: true,
      enableLogging: false,
      reservationTimeout: 5000,
      placeholderConfig: {
        showLoadingIndicator: true,
        loadingIndicatorType: 'skeleton',
        maintainAspectRatio: true,
        animation: {
          type: 'pulse',
          duration: 1500,
          easing: 'ease-in-out'
        }
      },
      transitionConfig: {
        duration: 300,
        easing: 'ease-out',
        fadeOut: true,
        fadeIn: true,
        crossFade: false,
        maintainPosition: true
      }
    };

    controller = new LayoutStabilityController(config);
  });

  afterEach(() => {
    controller.destroy();
  });

  describe('Layout Reservation', () => {
    it('should create layout reservation with placeholder', () => {
      const reservation = controller.preserveLayout(mockElement, 'test-component');

      expect(reservation).toBeDefined();
      expect(reservation.id).toBeDefined();
      expect(reservation.element).toBe(mockElement);
      expect(reservation.componentId).toBe('test-component');
      expect(reservation.placeholder).toBeDefined();
      expect(mockElement.parentNode.insertBefore).toHaveBeenCalled();
    });

    it('should release layout reservation', () => {
      const reservation = controller.preserveLayout(mockElement, 'test-component');
      
      controller.releaseLayout(reservation);

      expect(reservation.placeholder.parentNode.removeChild).toHaveBeenCalledWith(reservation.placeholder);
    });

    it('should track reservation metrics', () => {
      const reservation1 = controller.preserveLayout(mockElement, 'component-1');
      const reservation2 = controller.preserveLayout(mockElement, 'component-2');

      const metrics = controller.getMetrics();
      expect(metrics.totalReservations).toBe(2);
      expect(metrics.activeReservations).toBe(2);

      controller.releaseLayout(reservation1);
      
      const updatedMetrics = controller.getMetrics();
      expect(updatedMetrics.activeReservations).toBe(1);
    });
  });

  describe('Placeholder Management', () => {
    it('should create placeholder for component', () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false,
        estimatedSize: { width: 200, height: 100 }
      };

      const placeholder = controller.createPlaceholder(component);

      expect(placeholder).toBeDefined();
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
    });

    it('should replace placeholder with actual element', async () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      const placeholder = controller.createPlaceholder(component);
      const actualElement = mockDocument.createElement('div');

      await controller.replacePlaceholder('test-component', actualElement);

      const metrics = controller.getMetrics();
      expect(metrics.transitionsCount).toBe(1);
    });
  });

  describe('Seamless Transitions', () => {
    it('should create seamless transition between elements', async () => {
      const fromElement = mockDocument.createElement('div');
      const toElement = mockDocument.createElement('div');

      await controller.createSeamlessTransition(fromElement, toElement);

      expect(toElement.style.width).toBe('200px');
      expect(toElement.style.height).toBe('100px');
      expect(fromElement.parentNode.insertBefore).toHaveBeenCalledWith(toElement, fromElement);
    });

    it('should track transition metrics', async () => {
      const fromElement = mockDocument.createElement('div');
      const toElement = mockDocument.createElement('div');

      await controller.createSeamlessTransition(fromElement, toElement);

      const metrics = controller.getMetrics();
      expect(metrics.transitionsCount).toBe(1);
      expect(metrics.averageTransitionDuration).toBeGreaterThan(0);
    });
  });

  describe('CLS Monitoring', () => {
    it('should measure layout shift', () => {
      const clsMetrics = controller.measureLayoutShift();

      expect(clsMetrics).toBeDefined();
      expect(clsMetrics.score).toBeDefined();
      expect(clsMetrics.shifts).toBeDefined();
      expect(clsMetrics.timeline).toBeDefined();
    });

    it('should optimize for CLS threshold', () => {
      controller.optimizeForCLS(0.05);

      // Should create new CLS monitor with updated threshold
      expect(mockPerformanceObserver).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should emit events for layout operations', () => {
      const eventListener = vi.fn();
      controller.addEventListener('reservation-created', eventListener);

      controller.preserveLayout(mockElement, 'test-component');

      expect(eventListener).toHaveBeenCalled();
      expect(eventListener.mock.calls[0][0].type).toBe('reservation-created');
    });

    it('should remove event listeners', () => {
      const eventListener = vi.fn();
      controller.addEventListener('reservation-created', eventListener);
      controller.removeEventListener('reservation-created', eventListener);

      controller.preserveLayout(mockElement, 'test-component');

      expect(eventListener).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultController = new LayoutStabilityController();
      const metrics = defaultController.getMetrics();

      expect(metrics).toBeDefined();
      defaultController.destroy();
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        clsThreshold: 0.05,
        enablePlaceholders: false
      };

      const customController = new LayoutStabilityController(customConfig);
      
      // Should use custom threshold
      const clsMetrics = customController.measureLayoutShift();
      expect(clsMetrics).toBeDefined();
      
      customController.destroy();
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up expired reservations', (done) => {
      const shortTimeoutConfig = {
        ...config,
        reservationTimeout: 50
      };

      const shortController = new LayoutStabilityController(shortTimeoutConfig);
      const reservation = shortController.preserveLayout(mockElement, 'test-component');

      // Wait for reservation to expire and cleanup to run
      setTimeout(() => {
        const metrics = shortController.getMetrics();
        expect(metrics.expiredReservations).toBeGreaterThan(0);
        shortController.destroy();
        done();
      }, 1200); // Wait longer than cleanup interval (1000ms)
    });

    it('should destroy controller and clean up resources', () => {
      const reservation = controller.preserveLayout(mockElement, 'test-component');
      
      controller.destroy();

      // Should have cleaned up reservations
      expect(reservation.placeholder.parentNode.removeChild).toHaveBeenCalled();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive metrics', () => {
      // Create some activity
      const reservation = controller.preserveLayout(mockElement, 'component-1');
      controller.createPlaceholder({
        id: 'component-2',
        framework: 'vue',
        tagName: 'div',
        isInteractive: true
      });

      const metrics = controller.getMetrics();

      expect(metrics.totalReservations).toBe(1);
      expect(metrics.activeReservations).toBe(1);
      expect(metrics.clsScore).toBeDefined();
      expect(metrics.layoutShiftsCount).toBeDefined();
      expect(metrics.transitionsCount).toBeDefined();
    });

    it('should update average durations correctly', async () => {
      const component: ComponentDefinition = {
        id: 'test-component',
        framework: 'react',
        tagName: 'div',
        isInteractive: false
      };

      controller.createPlaceholder(component);
      const actualElement = mockDocument.createElement('div');

      await controller.replacePlaceholder('test-component', actualElement);

      const metrics = controller.getMetrics();
      expect(metrics.averageTransitionDuration).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing placeholder gracefully', async () => {
      const actualElement = mockDocument.createElement('div');

      // Should not throw when replacing non-existent placeholder
      await expect(
        controller.replacePlaceholder('non-existent', actualElement)
      ).resolves.toBeUndefined();
    });

    it('should handle transition errors gracefully', async () => {
      const fromElement = { ...mockElement, parentNode: null };
      const toElement = mockDocument.createElement('div');

      // Should not throw when parent is null
      await expect(
        controller.createSeamlessTransition(fromElement, toElement)
      ).resolves.toBeUndefined();
    });
  });
});