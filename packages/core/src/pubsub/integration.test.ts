import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MetamonPubSub } from './metamon-pubsub.js';

describe('MetamonPubSub Integration Tests', () => {
  let pubsub: MetamonPubSub;

  beforeEach(() => {
    pubsub = new MetamonPubSub();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cross-framework communication scenarios', () => {
    it('should enable React component to communicate with Vue component', () => {
      // Simulate React component subscription
      const reactCallback = vi.fn();
      pubsub.subscribe('userLogin', reactCallback, 'react-header-component');

      // Simulate Vue component subscription
      const vueCallback = vi.fn();
      pubsub.subscribe('userLogin', vueCallback, 'vue-sidebar-component');

      // Simulate login event from another component
      const loginData = { userId: '123', username: 'john_doe' };
      pubsub.emit('userLogin', loginData);
      vi.runAllTimers();

      // Both components should receive the event
      expect(reactCallback).toHaveBeenCalledWith(loginData);
      expect(vueCallback).toHaveBeenCalledWith(loginData);
    });

    it('should handle complex multi-framework application scenario', () => {
      // Simulate a complex app with multiple frameworks
      const components = {
        'react-navbar': vi.fn(),
        'vue-sidebar': vi.fn(),
        'solid-main-content': vi.fn(),
        'svelte-footer': vi.fn()
      };

      // Subscribe all components to navigation events
      Object.entries(components).forEach(([componentId, callback]) => {
        pubsub.subscribe('navigation', callback, componentId);
      });

      // Subscribe some components to user events
      pubsub.subscribe('userUpdate', components['react-navbar'], 'react-navbar');
      pubsub.subscribe('userUpdate', components['vue-sidebar'], 'vue-sidebar');

      // Emit navigation event
      const navData = { route: '/dashboard', params: { id: '123' } };
      pubsub.emit('navigation', navData);

      // Emit user update event
      const userData = { name: 'John Doe', avatar: 'avatar.jpg' };
      pubsub.emit('userUpdate', userData);

      vi.runAllTimers();

      // All components should receive navigation event
      Object.values(components).forEach(callback => {
        expect(callback).toHaveBeenCalledWith(navData);
      });

      // Only navbar and sidebar should receive user update
      expect(components['react-navbar']).toHaveBeenCalledWith(userData);
      expect(components['vue-sidebar']).toHaveBeenCalledWith(userData);
      expect(components['solid-main-content']).not.toHaveBeenCalledWith(userData);
      expect(components['svelte-footer']).not.toHaveBeenCalledWith(userData);
    });

    it('should handle component lifecycle properly', () => {
      const callbacks = {
        'component-1': vi.fn(),
        'component-2': vi.fn(),
        'component-3': vi.fn()
      };

      // All components subscribe to the same event
      Object.entries(callbacks).forEach(([componentId, callback]) => {
        pubsub.subscribe('dataUpdate', callback, componentId);
      });

      // Emit event - all should receive it
      pubsub.emit('dataUpdate', 'initial-data');
      vi.runAllTimers();

      Object.values(callbacks).forEach(callback => {
        expect(callback).toHaveBeenCalledWith('initial-data');
      });

      // Component 2 unmounts (cleanup)
      pubsub.cleanup('component-2');

      // Reset mocks
      Object.values(callbacks).forEach(callback => callback.mockClear());

      // Emit another event
      pubsub.emit('dataUpdate', 'updated-data');
      vi.runAllTimers();

      // Only components 1 and 3 should receive it
      expect(callbacks['component-1']).toHaveBeenCalledWith('updated-data');
      expect(callbacks['component-2']).not.toHaveBeenCalled();
      expect(callbacks['component-3']).toHaveBeenCalledWith('updated-data');
    });

    it('should handle high-frequency events efficiently', () => {
      const callback = vi.fn();
      pubsub.subscribe('scroll', callback, 'scroll-component');

      // Simulate rapid scroll events
      for (let i = 0; i < 100; i++) {
        pubsub.emit('scroll', { scrollY: i * 10 });
      }

      // Events should be batched, not processed yet
      expect(callback).not.toHaveBeenCalled();

      // Process batch
      vi.runAllTimers();

      // All events should be delivered
      expect(callback).toHaveBeenCalledTimes(100);
    });

    it('should maintain event isolation between different event types', () => {
      const userCallback = vi.fn();
      const dataCallback = vi.fn();
      const navCallback = vi.fn();

      pubsub.subscribe('userEvent', userCallback, 'user-component');
      pubsub.subscribe('dataEvent', dataCallback, 'data-component');
      pubsub.subscribe('navEvent', navCallback, 'nav-component');

      // Emit different types of events
      pubsub.emit('userEvent', 'user-data');
      pubsub.emit('dataEvent', 'data-payload');
      pubsub.emit('navEvent', 'nav-info');

      vi.runAllTimers();

      // Each callback should only receive its specific event
      expect(userCallback).toHaveBeenCalledWith('user-data');
      expect(userCallback).toHaveBeenCalledTimes(1);

      expect(dataCallback).toHaveBeenCalledWith('data-payload');
      expect(dataCallback).toHaveBeenCalledTimes(1);

      expect(navCallback).toHaveBeenCalledWith('nav-info');
      expect(navCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory management and performance', () => {
    it('should properly clean up memory when components are destroyed', () => {
      const componentIds = Array.from({ length: 10 }, (_, i) => `component-${i}`);
      
      // Subscribe all components
      componentIds.forEach(id => {
        pubsub.subscribe('test-event', vi.fn(), id);
      });

      expect(pubsub.getSubscriptionCount('test-event')).toBe(10);

      // Clean up half the components
      componentIds.slice(0, 5).forEach(id => {
        pubsub.cleanup(id);
      });

      expect(pubsub.getSubscriptionCount('test-event')).toBe(5);

      // Verify the right components are cleaned up
      componentIds.slice(0, 5).forEach(id => {
        expect(pubsub.getComponentEvents(id)).toEqual([]);
      });

      componentIds.slice(5).forEach(id => {
        expect(pubsub.getComponentEvents(id)).toEqual(['test-event']);
      });
    });

    it('should handle large numbers of subscribers efficiently', () => {
      const callbacks: Array<ReturnType<typeof vi.fn>> = [];
      
      // Create 1000 subscribers
      for (let i = 0; i < 1000; i++) {
        const callback = vi.fn();
        callbacks.push(callback);
        pubsub.subscribe('mass-event', callback, `component-${i}`);
      }

      expect(pubsub.getSubscriptionCount('mass-event')).toBe(1000);

      // Emit event
      const startTime = performance.now();
      pubsub.emit('mass-event', 'test-payload');
      vi.runAllTimers();
      const endTime = performance.now();

      // All callbacks should be called
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalledWith('test-payload');
      });

      // Performance should be reasonable (this is a rough check)
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Error resilience', () => {
    it('should continue operating normally after listener errors', () => {
      const errorCallback = vi.fn(() => { throw new Error('Listener error'); });
      const normalCallback1 = vi.fn();
      const normalCallback2 = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      pubsub.subscribe('test-event', normalCallback1, 'component-1');
      pubsub.subscribe('test-event', errorCallback, 'error-component');
      pubsub.subscribe('test-event', normalCallback2, 'component-2');

      // Emit multiple events
      pubsub.emit('test-event', 'payload-1');
      pubsub.emit('test-event', 'payload-2');
      vi.runAllTimers();

      // Normal callbacks should work despite error callback
      expect(normalCallback1).toHaveBeenCalledTimes(2);
      expect(normalCallback2).toHaveBeenCalledTimes(2);
      expect(errorCallback).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('should handle rapid subscribe/unsubscribe cycles', () => {
      const callback = vi.fn();

      // Rapid subscribe/unsubscribe
      for (let i = 0; i < 100; i++) {
        pubsub.subscribe('test-event', callback, 'test-component');
        pubsub.unsubscribe('test-event', 'test-component');
      }

      // Should end up with no subscriptions
      expect(pubsub.getSubscriptionCount('test-event')).toBe(0);
      expect(pubsub.getComponentEvents('test-component')).toEqual([]);

      // Should still work normally
      pubsub.subscribe('test-event', callback, 'test-component');
      pubsub.emit('test-event', 'test-payload');
      vi.runAllTimers();

      expect(callback).toHaveBeenCalledWith('test-payload');
    });
  });
});