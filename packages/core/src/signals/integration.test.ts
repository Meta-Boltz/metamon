import { describe, it, expect, vi } from 'vitest';
import { signalManager } from './signal-manager.js';

describe('Signals Integration', () => {
  it('should demonstrate cross-framework state sharing scenario', () => {
    // Simulate a real-world scenario where different framework components
    // share state through the global signal manager
    
    // Create global user state signal
    const userSignal = signalManager.createSignal(
      { id: null, name: '', isLoggedIn: false },
      'user-state'
    );
    
    // Create shopping cart signal
    const cartSignal = signalManager.createSignal([], 'shopping-cart');
    
    // Simulate React component subscribing to user state
    const reactCallback = vi.fn();
    const reactUnsub = userSignal.subscribe(reactCallback);
    
    // Simulate Vue component subscribing to cart state
    const vueCallback = vi.fn();
    const vueUnsub = cartSignal.subscribe(vueCallback);
    
    // Simulate Solid component creating computed signal for cart total
    const cartTotal = signalManager.createComputed(
      () => cartSignal.value.reduce((sum: number, item: any) => sum + item.price, 0),
      [cartSignal],
      'cart-total'
    );
    
    const solidCallback = vi.fn();
    const solidUnsub = cartTotal.subscribe(solidCallback);
    
    // Simulate user login from React component
    userSignal.update({
      id: 123,
      name: 'John Doe',
      isLoggedIn: true
    });
    
    // Simulate adding items to cart from Vue component
    cartSignal.update([
      { id: 1, name: 'Product 1', price: 10.99 },
      { id: 2, name: 'Product 2', price: 25.50 }
    ]);
    
    // Verify all components received updates
    expect(reactCallback).toHaveBeenCalledWith({
      id: 123,
      name: 'John Doe',
      isLoggedIn: true
    });
    
    expect(vueCallback).toHaveBeenCalledWith([
      { id: 1, name: 'Product 1', price: 10.99 },
      { id: 2, name: 'Product 2', price: 25.50 }
    ]);
    
    expect(solidCallback).toHaveBeenCalledWith(36.49);
    expect(cartTotal.value).toBe(36.49);
    
    // Test batched updates for performance
    signalManager.batch(() => {
      userSignal.update({
        id: 123,
        name: 'John Doe',
        isLoggedIn: true
      });
      
      cartSignal.update([
        { id: 1, name: 'Product 1', price: 10.99 },
        { id: 2, name: 'Product 2', price: 25.50 },
        { id: 3, name: 'Product 3', price: 15.00 }
      ]);
    });
    
    expect(cartTotal.value).toBe(51.49);
    
    // Cleanup
    reactUnsub();
    vueUnsub();
    solidUnsub();
    signalManager.destroySignal('user-state');
    signalManager.destroySignal('shopping-cart');
    signalManager.destroySignal('cart-total');
  });
  
  it('should handle component lifecycle cleanup properly', () => {
    // Simulate component mounting and unmounting
    const globalState = signalManager.createSignal(0, 'component-state');
    
    // Simulate multiple components subscribing
    const component1Callback = vi.fn();
    const component2Callback = vi.fn();
    const component3Callback = vi.fn();
    
    const unsub1 = globalState.subscribe(component1Callback);
    const unsub2 = globalState.subscribe(component2Callback);
    const unsub3 = globalState.subscribe(component3Callback);
    
    expect(globalState.subscriberCount).toBe(3);
    
    // Update state
    globalState.update(42);
    
    expect(component1Callback).toHaveBeenCalledWith(42);
    expect(component2Callback).toHaveBeenCalledWith(42);
    expect(component3Callback).toHaveBeenCalledWith(42);
    
    // Simulate component 1 unmounting
    unsub1();
    expect(globalState.subscriberCount).toBe(2);
    
    // Update again
    globalState.update(84);
    
    expect(component1Callback).toHaveBeenCalledTimes(1); // Should not be called again
    expect(component2Callback).toHaveBeenCalledWith(84);
    expect(component3Callback).toHaveBeenCalledWith(84);
    
    // Cleanup remaining
    unsub2();
    unsub3();
    signalManager.destroySignal('component-state');
  });
  
  it('should demonstrate signal-based pub/sub pattern', () => {
    // Create event signals for different types of events
    const userEvents = signalManager.createSignal(null, 'user-events');
    const navigationEvents = signalManager.createSignal(null, 'navigation-events');
    
    // Simulate different components listening to events
    const headerCallback = vi.fn();
    const sidebarCallback = vi.fn();
    const mainCallback = vi.fn();
    
    userEvents.subscribe(headerCallback);
    userEvents.subscribe(sidebarCallback);
    navigationEvents.subscribe(mainCallback);
    
    // Emit user login event
    userEvents.update({ type: 'login', user: { id: 1, name: 'Alice' } });
    
    expect(headerCallback).toHaveBeenCalledWith({ 
      type: 'login', 
      user: { id: 1, name: 'Alice' } 
    });
    expect(sidebarCallback).toHaveBeenCalledWith({ 
      type: 'login', 
      user: { id: 1, name: 'Alice' } 
    });
    expect(mainCallback).not.toHaveBeenCalled();
    
    // Emit navigation event
    navigationEvents.update({ type: 'route-change', path: '/dashboard' });
    
    expect(mainCallback).toHaveBeenCalledWith({ 
      type: 'route-change', 
      path: '/dashboard' 
    });
    
    // Cleanup
    signalManager.cleanup();
  });
});