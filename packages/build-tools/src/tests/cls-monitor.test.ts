/**
 * Tests for CLS Monitor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CLSMonitor } from '../layout-stability/cls-monitor.js';

// Mock PerformanceObserver
const mockPerformanceObserver = vi.fn();
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

mockPerformanceObserver.prototype.observe = mockObserve;
mockPerformanceObserver.prototype.disconnect = mockDisconnect;
mockPerformanceObserver.supportedEntryTypes = ['layout-shift'];

global.PerformanceObserver = mockPerformanceObserver as any;
global.performance = { now: vi.fn(() => 1000) } as any;
global.window = { dispatchEvent: vi.fn() } as any;

describe('CLSMonitor', () => {
  let monitor: CLSMonitor;
  let observerCallback: (list: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Capture the observer callback
    mockPerformanceObserver.mockImplementation((callback) => {
      observerCallback = callback;
      return {
        observe: mockObserve,
        disconnect: mockDisconnect
      };
    });

    monitor = new CLSMonitor(0.1);
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Initialization', () => {
    it('should initialize with default threshold', () => {
      const defaultMonitor = new CLSMonitor();
      const metrics = defaultMonitor.getMetrics();
      
      expect(metrics.score).toBe(0);
      expect(metrics.shifts).toEqual([]);
      expect(metrics.timeline).toEqual([]);
      
      defaultMonitor.stopMonitoring();
    });

    it('should initialize with custom threshold', () => {
      const customMonitor = new CLSMonitor(0.05);
      expect(customMonitor).toBeDefined();
      customMonitor.stopMonitoring();
    });
  });

  describe('Monitoring Control', () => {
    it('should start monitoring layout shifts', () => {
      monitor.startMonitoring();

      expect(mockPerformanceObserver).toHaveBeenCalled();
      expect(mockObserve).toHaveBeenCalledWith({
        type: 'layout-shift',
        buffered: true
      });
    });

    it('should stop monitoring layout shifts', () => {
      monitor.startMonitoring();
      monitor.stopMonitoring();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should not start monitoring if already monitoring', () => {
      monitor.startMonitoring();
      monitor.startMonitoring(); // Second call

      expect(mockPerformanceObserver).toHaveBeenCalledTimes(1);
    });

    it('should handle unsupported browser gracefully', () => {
      // Temporarily remove PerformanceObserver support
      const originalSupported = mockPerformanceObserver.supportedEntryTypes;
      mockPerformanceObserver.supportedEntryTypes = [];

      const unsupportedMonitor = new CLSMonitor();
      unsupportedMonitor.startMonitoring();

      // Should not throw and should handle gracefully
      expect(unsupportedMonitor.getMetrics().score).toBe(0);

      // Restore support
      mockPerformanceObserver.supportedEntryTypes = originalSupported;
      unsupportedMonitor.stopMonitoring();
    });
  });

  describe('Layout Shift Processing', () => {
    beforeEach(() => {
      monitor.startMonitoring();
    });

    it('should process layout shift entries', () => {
      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05,
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: [
          {
            node: { tagName: 'DIV', className: 'test', id: 'test-id' },
            previousRect: { width: 100, height: 50 },
            currentRect: { width: 120, height: 60 }
          }
        ]
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      const metrics = monitor.getMetrics();
      expect(metrics.score).toBe(0.05);
      expect(metrics.shifts).toHaveLength(1);
      expect(metrics.shifts[0].value).toBe(0.05);
      expect(metrics.timeline).toHaveLength(1);
    });

    it('should ignore layout shifts with recent input', () => {
      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05,
        hadRecentInput: true,
        lastInputTime: 500,
        startTime: 1000,
        sources: []
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      const metrics = monitor.getMetrics();
      expect(metrics.score).toBe(0);
      expect(metrics.shifts).toHaveLength(0);
    });

    it('should accumulate multiple layout shifts', () => {
      const mockEntries = [
        {
          entryType: 'layout-shift',
          value: 0.03,
          hadRecentInput: false,
          lastInputTime: 0,
          startTime: 1000,
          sources: []
        },
        {
          entryType: 'layout-shift',
          value: 0.04,
          hadRecentInput: false,
          lastInputTime: 0,
          startTime: 1100,
          sources: []
        }
      ];

      const mockList = {
        getEntries: () => mockEntries
      };

      observerCallback(mockList);

      const metrics = monitor.getMetrics();
      expect(metrics.score).toBe(0.07);
      expect(metrics.shifts).toHaveLength(2);
    });

    it('should track worst layout shift', () => {
      const mockEntries = [
        {
          entryType: 'layout-shift',
          value: 0.03,
          hadRecentInput: false,
          lastInputTime: 0,
          startTime: 1000,
          sources: []
        },
        {
          entryType: 'layout-shift',
          value: 0.08,
          hadRecentInput: false,
          lastInputTime: 0,
          startTime: 1100,
          sources: []
        },
        {
          entryType: 'layout-shift',
          value: 0.02,
          hadRecentInput: false,
          lastInputTime: 0,
          startTime: 1200,
          sources: []
        }
      ];

      const mockList = {
        getEntries: () => mockEntries
      };

      observerCallback(mockList);

      const metrics = monitor.getMetrics();
      expect(metrics.worstShift?.value).toBe(0.08);
    });
  });

  describe('Threshold Monitoring', () => {
    beforeEach(() => {
      monitor.startMonitoring();
    });

    it('should emit warning when threshold exceeded', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.15, // Exceeds 0.1 threshold
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: []
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CLS threshold exceeded')
      );
      expect(global.window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cls-threshold-exceeded'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should not emit warning when threshold not exceeded', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05, // Below 0.1 threshold
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: []
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Event Listeners', () => {
    it('should add and notify listeners', () => {
      const listener = vi.fn();
      monitor.addListener(listener);
      monitor.startMonitoring();

      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05,
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: []
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].score).toBe(0.05);
    });

    it('should remove listeners', () => {
      const listener = vi.fn();
      monitor.addListener(listener);
      monitor.removeListener(listener);
      monitor.startMonitoring();

      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05,
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: []
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      monitor.addListener(errorListener);
      monitor.startMonitoring();

      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05,
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: []
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in CLS metrics listener'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Metrics and Analysis', () => {
    beforeEach(() => {
      monitor.startMonitoring();
    });

    it('should reset metrics', () => {
      // Add some data first
      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05,
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: []
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      expect(monitor.getMetrics().score).toBe(0.05);

      monitor.reset();

      const resetMetrics = monitor.getMetrics();
      expect(resetMetrics.score).toBe(0);
      expect(resetMetrics.shifts).toHaveLength(0);
      expect(resetMetrics.timeline).toHaveLength(0);
    });

    it('should get score for time range', () => {
      const mockEntries = [
        {
          entryType: 'layout-shift',
          value: 0.03,
          hadRecentInput: false,
          lastInputTime: 0,
          startTime: 1000,
          sources: []
        },
        {
          entryType: 'layout-shift',
          value: 0.04,
          hadRecentInput: false,
          lastInputTime: 0,
          startTime: 1500,
          sources: []
        },
        {
          entryType: 'layout-shift',
          value: 0.02,
          hadRecentInput: false,
          lastInputTime: 0,
          startTime: 2000,
          sources: []
        }
      ];

      const mockList = {
        getEntries: () => mockEntries
      };

      observerCallback(mockList);

      const scoreInRange = monitor.getScoreForTimeRange(1200, 1800);
      expect(scoreInRange).toBe(0.04);
    });

    it('should get shifts for specific element', () => {
      const testElement = { tagName: 'DIV', id: 'test' };
      
      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05,
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: [
          {
            node: testElement,
            previousRect: { width: 100, height: 50 },
            currentRect: { width: 120, height: 60 }
          }
        ]
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      const shiftsForElement = monitor.getShiftsForElement(testElement as any);
      expect(shiftsForElement).toHaveLength(1);
      expect(shiftsForElement[0].value).toBe(0.05);
    });

    it('should export metrics as JSON', () => {
      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05,
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: []
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      const exportedMetrics = monitor.exportMetrics();
      const parsedMetrics = JSON.parse(exportedMetrics);

      expect(parsedMetrics.score).toBe(0.05);
      expect(parsedMetrics.shifts).toHaveLength(1);
      expect(parsedMetrics.duration).toBeDefined();
    });
  });

  describe('Description Generation', () => {
    beforeEach(() => {
      monitor.startMonitoring();
    });

    it('should generate descriptive shift descriptions', () => {
      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.05,
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: [
          {
            node: { 
              tagName: 'DIV', 
              className: 'test-class another-class', 
              id: 'test-id' 
            },
            previousRect: { width: 100, height: 50 },
            currentRect: { width: 120, height: 60 }
          }
        ]
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      const metrics = monitor.getMetrics();
      expect(metrics.timeline[0].description).toContain('div#test-id.test-class');
      expect(metrics.timeline[0].description).toContain('0.0500');
    });

    it('should handle elements without id or class', () => {
      const mockEntry = {
        entryType: 'layout-shift',
        value: 0.03,
        hadRecentInput: false,
        lastInputTime: 0,
        startTime: 1000,
        sources: [
          {
            node: { tagName: 'SPAN', className: '', id: '' },
            previousRect: { width: 50, height: 20 },
            currentRect: { width: 60, height: 25 }
          }
        ]
      };

      const mockList = {
        getEntries: () => [mockEntry]
      };

      observerCallback(mockList);

      const metrics = monitor.getMetrics();
      expect(metrics.timeline[0].description).toContain('span');
      expect(metrics.timeline[0].description).toContain('0.0300');
    });
  });
});