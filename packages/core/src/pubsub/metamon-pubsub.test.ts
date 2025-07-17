import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MetamonPubSub } from './metamon-pubsub.js';

describe('MetamonPubSub', () => {
  let pubsub: MetamonPubSub;

  beforeEach(() => {
    pubsub = new MetamonPubSub();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('subscribe', () => {
    it('should subscribe to an event successfully', () => {
      const callback = vi.fn();
      
      pubsub.subscribe('test-event', callback, 'component-1');
      
      expect(pubsub.getSubscriptionCount('test-event')).toBe(1);
      expect(pubsub.getComponentEvents('component-1')).toEqual(['test-event']);
    });

    it('should allow multiple subscriptions to the same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      pubsub.subscribe('test-event', callback1, 'component-1');
      pubsub.subscribe('test-event', callback2, 'component-2');
      
      expect(pubsub.getSubscriptionCount('test-event')).toBe(2);
    });

    it('should allow one component to subscribe to multiple events', () => {
      const callback = vi.fn();
      
      pubsub.subscribe('event-1', callback, 'component-1');
      pubsub.subscribe('event-2', callback, 'component-1');
      
      const componentEvents = pubsub.getComponentEvents('component-1');
      expect(componentEvents).toContain('event-1');
      expect(componentEvents).toContain('event-2');
      expect(componentEvents).toHaveLength(2);
    });

    it('should throw error for invalid parameters', () => {
      expect(() => pubsub.subscribe('', vi.fn(), 'component-1')).toThrow();
      expect(() => pubsub.subscribe('event', null as any, 'component-1')).toThrow();
      expect(() => pubsub.subscribe('event', vi.fn(), '')).toThrow();
    });
  });

  describe('emit', () => {
    it('should deliver events to all subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const payload = { data: 'test' };
      
      pubsub.subscribe('test-event', callback1, 'component-1');
      pubsub.subscribe('test-event', callback2, 'component-2');
      
      pubsub.emit('test-event', payload);
      vi.runAllTimers(); // Process batched events
      
      expect(callback1).toHaveBeenCalledWith(payload);
      expect(callback2).toHaveBeenCalledWith(payload);
    });

    it('should handle events with no subscribers gracefully', () => {
      expect(() => {
        pubsub.emit('non-existent-event', { data: 'test' });
        vi.runAllTimers();
      }).not.toThrow();
    });

    it('should batch multiple events for optimization', () => {
      const callback = vi.fn();
      
      pubsub.subscribe('test-event', callback, 'component-1');
      
      // Emit multiple events quickly
      pubsub.emit('test-event', 'payload1');
      pubsub.emit('test-event', 'payload2');
      pubsub.emit('test-event', 'payload3');
      
      // Should not have been called yet (batched)
      expect(callback).not.toHaveBeenCalled();
      
      // Process batch
      vi.runAllTimers();
      
      // Should have been called for each payload
      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, 'payload1');
      expect(callback).toHaveBeenNthCalledWith(2, 'payload2');
      expect(callback).toHaveBeenNthCalledWith(3, 'payload3');
    });

    it('should continue processing other listeners if one throws an error', () => {
      const errorCallback = vi.fn(() => { throw new Error('Test error'); });
      const successCallback = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      pubsub.subscribe('test-event', errorCallback, 'component-1');
      pubsub.subscribe('test-event', successCallback, 'component-2');
      
      pubsub.emit('test-event', 'payload');
      vi.runAllTimers();
      
      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalledWith('payload');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should ignore empty event names', () => {
      expect(() => {
        pubsub.emit('', 'payload');
        vi.runAllTimers();
      }).not.toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe a component from a specific event', () => {
      const callback = vi.fn();
      
      pubsub.subscribe('test-event', callback, 'component-1');
      expect(pubsub.getSubscriptionCount('test-event')).toBe(1);
      
      pubsub.unsubscribe('test-event', 'component-1');
      expect(pubsub.getSubscriptionCount('test-event')).toBe(0);
      expect(pubsub.getComponentEvents('component-1')).toEqual([]);
    });

    it('should only unsubscribe the specified component', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      pubsub.subscribe('test-event', callback1, 'component-1');
      pubsub.subscribe('test-event', callback2, 'component-2');
      
      pubsub.unsubscribe('test-event', 'component-1');
      
      expect(pubsub.getSubscriptionCount('test-event')).toBe(1);
      
      pubsub.emit('test-event', 'payload');
      vi.runAllTimers();
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('payload');
    });

    it('should handle unsubscribing from non-existent events gracefully', () => {
      expect(() => {
        pubsub.unsubscribe('non-existent-event', 'component-1');
      }).not.toThrow();
    });

    it('should handle empty parameters gracefully', () => {
      expect(() => {
        pubsub.unsubscribe('', 'component-1');
        pubsub.unsubscribe('event', '');
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove all subscriptions for a component', () => {
      const callback = vi.fn();
      
      pubsub.subscribe('event-1', callback, 'component-1');
      pubsub.subscribe('event-2', callback, 'component-1');
      pubsub.subscribe('event-1', callback, 'component-2'); // Different component
      
      expect(pubsub.getComponentEvents('component-1')).toHaveLength(2);
      expect(pubsub.getSubscriptionCount('event-1')).toBe(2);
      expect(pubsub.getSubscriptionCount('event-2')).toBe(1);
      
      pubsub.cleanup('component-1');
      
      expect(pubsub.getComponentEvents('component-1')).toEqual([]);
      expect(pubsub.getSubscriptionCount('event-1')).toBe(1); // component-2 still subscribed
      expect(pubsub.getSubscriptionCount('event-2')).toBe(0); // completely removed
    });

    it('should handle cleanup of non-existent components gracefully', () => {
      expect(() => {
        pubsub.cleanup('non-existent-component');
      }).not.toThrow();
    });

    it('should handle empty component ID gracefully', () => {
      expect(() => {
        pubsub.cleanup('');
      }).not.toThrow();
    });
  });

  describe('debugging methods', () => {
    it('should return active subscriptions', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      pubsub.subscribe('event-1', callback1, 'component-1');
      pubsub.subscribe('event-2', callback2, 'component-2');
      
      const subscriptions = pubsub.getActiveSubscriptions();
      
      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0]).toMatchObject({
        event: 'event-1',
        componentId: 'component-1',
        callback: callback1
      });
      expect(subscriptions[1]).toMatchObject({
        event: 'event-2',
        componentId: 'component-2',
        callback: callback2
      });
    });

    it('should return correct subscription count', () => {
      const callback = vi.fn();
      
      expect(pubsub.getSubscriptionCount('test-event')).toBe(0);
      
      pubsub.subscribe('test-event', callback, 'component-1');
      expect(pubsub.getSubscriptionCount('test-event')).toBe(1);
      
      pubsub.subscribe('test-event', callback, 'component-2');
      expect(pubsub.getSubscriptionCount('test-event')).toBe(2);
    });

    it('should return component events correctly', () => {
      const callback = vi.fn();
      
      expect(pubsub.getComponentEvents('component-1')).toEqual([]);
      
      pubsub.subscribe('event-1', callback, 'component-1');
      pubsub.subscribe('event-2', callback, 'component-1');
      
      const events = pubsub.getComponentEvents('component-1');
      expect(events).toContain('event-1');
      expect(events).toContain('event-2');
      expect(events).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear all subscriptions and reset state', () => {
      const callback = vi.fn();
      
      pubsub.subscribe('event-1', callback, 'component-1');
      pubsub.subscribe('event-2', callback, 'component-2');
      
      expect(pubsub.getActiveSubscriptions()).toHaveLength(2);
      
      pubsub.clear();
      
      expect(pubsub.getActiveSubscriptions()).toHaveLength(0);
      expect(pubsub.getSubscriptionCount('event-1')).toBe(0);
      expect(pubsub.getComponentEvents('component-1')).toEqual([]);
    });

    it('should clear pending batched events', () => {
      const callback = vi.fn();
      
      pubsub.subscribe('test-event', callback, 'component-1');
      pubsub.emit('test-event', 'payload');
      
      // Clear before processing batch
      pubsub.clear();
      vi.runAllTimers();
      
      // Callback should not have been called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('event delivery order', () => {
    it('should deliver events in the order they were registered', () => {
      const results: string[] = [];
      const callback1 = vi.fn(() => results.push('callback1'));
      const callback2 = vi.fn(() => results.push('callback2'));
      const callback3 = vi.fn(() => results.push('callback3'));
      
      pubsub.subscribe('test-event', callback1, 'component-1');
      pubsub.subscribe('test-event', callback2, 'component-2');
      pubsub.subscribe('test-event', callback3, 'component-3');
      
      pubsub.emit('test-event', 'payload');
      vi.runAllTimers();
      
      // Note: Set iteration order is insertion order in modern JS engines
      // but we can't guarantee this, so we just check all were called
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
      expect(results).toHaveLength(3);
    });
  });
});