import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetamonSignalManager, signalManager } from './signal-manager.js';
import { MetamonSignal } from './signal.js';

describe('MetamonSignalManager', () => {
  let manager: MetamonSignalManager;

  beforeEach(() => {
    manager = new MetamonSignalManager();
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('signal creation', () => {
    it('should create a signal without key', () => {
      const signal = manager.createSignal(10);
      expect(signal.value).toBe(10);
      expect(manager.signalCount).toBe(0); // Not tracked without key
    });

    it('should create a signal with key', () => {
      const signal = manager.createSignal(20, 'test-signal');
      expect(signal.value).toBe(20);
      expect(manager.signalCount).toBe(1);
      expect(manager.getSignalKeys()).toContain('test-signal');
    });

    it('should return existing signal for duplicate key', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const signal1 = manager.createSignal(30, 'duplicate');
      const signal2 = manager.createSignal(40, 'duplicate');
      
      expect(signal1).toBe(signal2);
      expect(signal1.value).toBe(30); // Should keep original value
      expect(consoleSpy).toHaveBeenCalledWith('Signal with key "duplicate" already exists. Returning existing signal.');
      
      consoleSpy.mockRestore();
    });
  });

  describe('signal retrieval', () => {
    it('should retrieve existing signal by key', () => {
      const original = manager.createSignal(50, 'retrieve-test');
      const retrieved = manager.getSignal('retrieve-test');
      
      expect(retrieved).toBe(original);
      expect(retrieved?.value).toBe(50);
    });

    it('should return undefined for non-existent key', () => {
      const signal = manager.getSignal('non-existent');
      expect(signal).toBeUndefined();
    });
  });

  describe('signal destruction', () => {
    it('should destroy signal and clean up resources', () => {
      const signal = manager.createSignal(60, 'destroy-test');
      const callback = vi.fn();
      signal.subscribe(callback);
      
      expect(manager.signalCount).toBe(1);
      expect(signal.subscriberCount).toBe(1);
      
      manager.destroySignal('destroy-test');
      
      expect(manager.signalCount).toBe(0);
      expect(manager.getSignal('destroy-test')).toBeUndefined();
      expect(signal.subscriberCount).toBe(0);
    });

    it('should handle destroying non-existent signal gracefully', () => {
      expect(() => manager.destroySignal('non-existent')).not.toThrow();
    });
  });

  describe('batching', () => {
    it('should batch multiple signal updates', () => {
      const signal1 = manager.createSignal(0, 'batch1');
      const signal2 = manager.createSignal(0, 'batch2');
      
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      signal1.subscribe(callback1);
      signal2.subscribe(callback2);
      
      manager.batch(() => {
        signal1.update(10);
        signal2.update(20);
      });
      
      expect(callback1).toHaveBeenCalledWith(10);
      expect(callback2).toHaveBeenCalledWith(20);
    });

    it('should handle nested batching', () => {
      const signal = manager.createSignal(0, 'nested-batch');
      const callback = vi.fn();
      signal.subscribe(callback);
      
      manager.batch(() => {
        signal.update(1);
        manager.batch(() => {
          signal.update(2);
        });
        signal.update(3);
      });
      
      expect(callback).toHaveBeenCalledTimes(3);
      expect(signal.value).toBe(3);
    });

    it('should handle errors in batch gracefully', () => {
      const signal = manager.createSignal(0, 'error-batch');
      const callback = vi.fn();
      signal.subscribe(callback);
      
      expect(() => {
        manager.batch(() => {
          signal.update(5);
          throw new Error('Batch error');
        });
      }).toThrow('Batch error');
      
      expect(callback).toHaveBeenCalledWith(5);
    });
  });

  describe('computed signals', () => {
    it('should create computed signal that updates when dependencies change', () => {
      const source1 = manager.createSignal(2, 'source1');
      const source2 = manager.createSignal(3, 'source2');
      
      const computed = manager.createComputed(
        () => source1.value + source2.value,
        [source1, source2],
        'computed-sum'
      );
      
      expect(computed.value).toBe(5);
      
      source1.update(4);
      expect(computed.value).toBe(7);
      
      source2.update(6);
      expect(computed.value).toBe(10);
    });

    it('should handle computed signal errors gracefully', () => {
      const source = manager.createSignal(1, 'error-source');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const computed = manager.createComputed(
        () => {
          if (source.value > 5) throw new Error('Computed error');
          return source.value * 2;
        },
        [source],
        'error-computed'
      );
      
      expect(computed.value).toBe(2);
      
      source.update(10); // This should trigger error
      
      expect(consoleSpy).toHaveBeenCalledWith('Error in computed signal:', expect.any(Error));
      expect(computed.value).toBe(2); // Should keep previous value
      
      consoleSpy.mockRestore();
    });

    it('should clean up computed signal dependencies', () => {
      const source = manager.createSignal(1, 'cleanup-source');
      const computed = manager.createComputed(
        () => source.value * 2,
        [source],
        'cleanup-computed'
      );
      
      expect(source.subscriberCount).toBe(1);
      
      manager.destroySignal('cleanup-computed');
      
      expect(source.subscriberCount).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up all signals and resources', () => {
      const signal1 = manager.createSignal(1, 'cleanup1');
      const signal2 = manager.createSignal(2, 'cleanup2');
      
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      signal1.subscribe(callback1);
      signal2.subscribe(callback2);
      
      expect(manager.signalCount).toBe(2);
      expect(signal1.subscriberCount).toBe(1);
      expect(signal2.subscriberCount).toBe(1);
      
      manager.cleanup();
      
      expect(manager.signalCount).toBe(0);
      expect(signal1.subscriberCount).toBe(0);
      expect(signal2.subscriberCount).toBe(0);
    });
  });

  describe('global singleton', () => {
    it('should provide global singleton instance', () => {
      expect(signalManager).toBeInstanceOf(MetamonSignalManager);
    });

    it('should maintain state across imports', () => {
      signalManager.createSignal(100, 'global-test');
      expect(signalManager.getSignal('global-test')?.value).toBe(100);
    });
  });

  describe('performance considerations', () => {
    it('should handle many subscribers efficiently', () => {
      const signal = manager.createSignal(0, 'performance-test');
      const callbacks: Array<() => void> = [];
      
      // Add many subscribers
      for (let i = 0; i < 1000; i++) {
        const callback = vi.fn();
        callbacks.push(callback);
        signal.subscribe(callback);
      }
      
      expect(signal.subscriberCount).toBe(1000);
      
      const start = performance.now();
      signal.update(42);
      const end = performance.now();
      
      // Should complete reasonably quickly (less than 100ms)
      expect(end - start).toBeLessThan(100);
      
      // All callbacks should have been called
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalledWith(42);
      });
    });

    it('should handle rapid updates efficiently', () => {
      const signal = manager.createSignal(-1, 'rapid-updates'); // Start with -1 to avoid duplicate 0
      const callback = vi.fn();
      signal.subscribe(callback);
      
      const start = performance.now();
      
      // Perform many rapid updates
      for (let i = 0; i < 1000; i++) {
        signal.update(i);
      }
      
      const end = performance.now();
      
      // Should complete reasonably quickly
      expect(end - start).toBeLessThan(100);
      expect(signal.value).toBe(999);
      expect(callback).toHaveBeenCalledTimes(1000);
    });
  });
});