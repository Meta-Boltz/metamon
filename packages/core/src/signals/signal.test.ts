import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetamonSignal } from './signal.js';

describe('MetamonSignal', () => {
  let signal: MetamonSignal<number>;

  beforeEach(() => {
    signal = new MetamonSignal(0);
  });

  describe('initialization', () => {
    it('should initialize with the provided value', () => {
      const signal = new MetamonSignal(42);
      expect(signal.value).toBe(42);
    });

    it('should initialize with zero subscribers', () => {
      expect(signal.subscriberCount).toBe(0);
    });
  });

  describe('value updates', () => {
    it('should update value when calling update method', () => {
      signal.update(10);
      expect(signal.value).toBe(10);
    });

    it('should update value when setting value property', () => {
      signal.value = 20;
      expect(signal.value).toBe(20);
    });

    it('should not trigger updates for same value', () => {
      const callback = vi.fn();
      signal.subscribe(callback);
      
      signal.update(5);
      signal.update(5); // Same value
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(5);
    });
  });

  describe('subscriptions', () => {
    it('should notify subscribers when value changes', () => {
      const callback = vi.fn();
      signal.subscribe(callback);
      
      signal.update(15);
      
      expect(callback).toHaveBeenCalledWith(15);
    });

    it('should notify multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      signal.subscribe(callback1);
      signal.subscribe(callback2);
      
      signal.update(25);
      
      expect(callback1).toHaveBeenCalledWith(25);
      expect(callback2).toHaveBeenCalledWith(25);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = signal.subscribe(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      signal.update(30);
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      signal.update(35);
      expect(callback).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should track subscriber count correctly', () => {
      const unsub1 = signal.subscribe(() => {});
      expect(signal.subscriberCount).toBe(1);
      
      const unsub2 = signal.subscribe(() => {});
      expect(signal.subscriberCount).toBe(2);
      
      unsub1();
      expect(signal.subscriberCount).toBe(1);
      
      unsub2();
      expect(signal.subscriberCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle subscriber errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalCallback = vi.fn();
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      signal.subscribe(errorCallback);
      signal.subscribe(normalCallback);
      
      signal.update(40);
      
      expect(consoleSpy).toHaveBeenCalledWith('Error in signal subscriber:', expect.any(Error));
      expect(normalCallback).toHaveBeenCalledWith(40);
      
      consoleSpy.mockRestore();
    });

    it('should prevent recursive updates', () => {
      const callback = vi.fn(() => {
        signal.update(signal.value + 1); // This should be ignored
      });
      
      signal.subscribe(callback);
      signal.update(1);
      
      expect(signal.value).toBe(1); // Should not be incremented recursively
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should clear all subscribers on cleanup', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      signal.subscribe(callback1);
      signal.subscribe(callback2);
      
      expect(signal.subscriberCount).toBe(2);
      
      signal.cleanup();
      
      expect(signal.subscriberCount).toBe(0);
      
      signal.update(50);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('different value types', () => {
    it('should work with string values', () => {
      const stringSignal = new MetamonSignal('initial');
      const callback = vi.fn();
      
      stringSignal.subscribe(callback);
      stringSignal.update('updated');
      
      expect(stringSignal.value).toBe('updated');
      expect(callback).toHaveBeenCalledWith('updated');
    });

    it('should work with object values', () => {
      const objSignal = new MetamonSignal({ count: 0 });
      const callback = vi.fn();
      
      objSignal.subscribe(callback);
      objSignal.update({ count: 1 });
      
      expect(objSignal.value).toEqual({ count: 1 });
      expect(callback).toHaveBeenCalledWith({ count: 1 });
    });

    it('should work with array values', () => {
      const arraySignal = new MetamonSignal([1, 2, 3]);
      const callback = vi.fn();
      
      arraySignal.subscribe(callback);
      arraySignal.update([4, 5, 6]);
      
      expect(arraySignal.value).toEqual([4, 5, 6]);
      expect(callback).toHaveBeenCalledWith([4, 5, 6]);
    });
  });
});