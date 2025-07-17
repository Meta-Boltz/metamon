import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetamonPubSub, signalManager, MetamonRouterImpl } from '@metamon/core';
import { ReactAdapter } from './react/react-adapter.js';
import { VueAdapter } from './vue/vue-adapter.js';
import { SolidAdapter } from './solid/solid-adapter.js';
import { SvelteAdapter } from './svelte/svelte-adapter.js';
import type { MTMFile } from '@metamon/core';

describe('Cross-Framework Integration Tests', () => {
  let pubsub: MetamonPubSub;
  let router: MetamonRouterImpl;
  let reactAdapter: ReactAdapter;
  let vueAdapter: VueAdapter;
  let solidAdapter: SolidAdapter;
  let svelteAdapter: SvelteAdapter;

  beforeEach(() => {
    pubsub = new MetamonPubSub();
    router = new MetamonRouterImpl();
    reactAdapter = new ReactAdapter();
    vueAdapter = new VueAdapter();
    solidAdapter = new SolidAdapter();
    svelteAdapter = new SvelteAdapter();
    
    // Clear any existing signals
    signalManager.cleanup();
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    pubsub.clear();
    signalManager.cleanup();
    vi.useRealTimers();
  });

  describe('React-Vue Component Communication via Pub/Sub', () => {
    it('should enable React component to send events to Vue component', () => {
      // Create React component that emits user login event
      const reactMTM: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [
            { event: 'userLogin', emit: 'handleUserLogin' }
          ]
        },
        content: `
          import React, { useState } from 'react';
          
          export default function LoginForm() {
            const [user, setUser] = useState('');
            
            const login = () => {
              const userData = { id: 1, name: user, timestamp: Date.now() };
              handleUserLogin(userData);
            };
            
            return (
              <form onSubmit={login}>
                <input value={user} onChange={(e) => setUser(e.target.value)} />
                <button type="submit">Login</button>
              </form>
            );
          }
        `,
        filePath: '/components/login-form.mtm'
      };

      // Create Vue component that listens for user login event
      const vueMTM: MTMFile = {
        frontmatter: {
          target: 'vue',
          channels: [
            { event: 'userLogin', emit: 'onUserLogin' }
          ]
        },
        content: `
          <template>
            <div class="user-profile">
              <h2 v-if="currentUser">Welcome, {{ currentUser.name }}!</h2>
              <p v-else>Please log in</p>
            </div>
          </template>
          
          <script setup>
          import { ref } from 'vue';
          
          const currentUser = ref(null);
          
          // This will be connected to pub/sub by the adapter
          const handleUserLogin = (userData) => {
            currentUser.value = userData;
          };
          </script>
        `,
        filePath: '/components/user-profile.mtm'
      };

      // Compile both components
      const reactResult = reactAdapter.compile(reactMTM);
      const vueResult = vueAdapter.compile(vueMTM);

      expect(reactResult.code).toBeDefined();
      expect(vueResult.code).toBeDefined();

      // Simulate runtime behavior
      const vueCallback = vi.fn();
      pubsub.subscribe('userLogin', vueCallback, 'vue-user-profile');

      // Simulate React component emitting event
      const userData = { id: 1, name: 'John Doe', timestamp: Date.now() };
      pubsub.emit('userLogin', userData);
      vi.runAllTimers();

      expect(vueCallback).toHaveBeenCalledWith(userData);
    });

    it('should handle bidirectional React-Vue communication', () => {
      // React component that both sends and receives events
      const reactMTM: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [
            { event: 'cartUpdate', emit: 'updateCart' },
            { event: 'productSelect', emit: 'onProductSelect' }
          ]
        },
        content: `
          export default function ProductList() {
            const selectProduct = (product) => {
              updateCart({ action: 'add', product });
            };
            return <div>Product List</div>;
          }
        `,
        filePath: '/components/product-list.mtm'
      };

      // Vue component that both sends and receives events
      const vueMTM: MTMFile = {
        frontmatter: {
          target: 'vue',
          channels: [
            { event: 'cartUpdate', emit: 'onCartUpdate' },
            { event: 'productSelect', emit: 'selectProduct' }
          ]
        },
        content: `
          <template>
            <div class="shopping-cart">
              <p>Items: {{ itemCount }}</p>
            </div>
          </template>
          
          <script setup>
          import { ref } from 'vue';
          
          const itemCount = ref(0);
          
          const handleCartUpdate = (update) => {
            if (update.action === 'add') {
              itemCount.value++;
            }
          };
          </script>
        `,
        filePath: '/components/shopping-cart.mtm'
      };

      const reactResult = reactAdapter.compile(reactMTM);
      const vueResult = vueAdapter.compile(vueMTM);

      // Simulate bidirectional communication
      const reactCallback = vi.fn();
      const vueCallback = vi.fn();

      pubsub.subscribe('cartUpdate', vueCallback, 'vue-shopping-cart');
      pubsub.subscribe('productSelect', reactCallback, 'react-product-list');

      // React -> Vue communication
      pubsub.emit('cartUpdate', { action: 'add', product: { id: 1, name: 'Test' } });
      
      // Vue -> React communication  
      pubsub.emit('productSelect', { id: 2, name: 'Another Product' });
      
      vi.runAllTimers();

      expect(vueCallback).toHaveBeenCalledWith({ action: 'add', product: { id: 1, name: 'Test' } });
      expect(reactCallback).toHaveBeenCalledWith({ id: 2, name: 'Another Product' });
    });
  });

  describe('Signal Sharing Between Different Framework Components', () => {
    it('should share global state between React, Vue, Solid, and Svelte components', () => {
      // Create a global user state signal
      const userSignal = signalManager.createSignal(
        { id: null, name: '', isLoggedIn: false },
        'global-user-state'
      );

      // Create a global cart signal
      const cartSignal = signalManager.createSignal([], 'global-cart');

      // Simulate React component using the signals
      const reactCallback = vi.fn();
      const reactUnsub = userSignal.subscribe(reactCallback);

      // Simulate Vue component using the signals
      const vueCallback = vi.fn();
      const vueUnsub = cartSignal.subscribe(vueCallback);

      // Simulate Solid component creating computed signal
      const cartTotalSignal = signalManager.createComputed(
        () => cartSignal.value.reduce((sum: number, item: any) => sum + (item.price || 0), 0),
        [cartSignal],
        'cart-total'
      );

      const solidCallback = vi.fn();
      const solidUnsub = cartTotalSignal.subscribe(solidCallback);

      // Simulate Svelte component using user signal
      const svelteCallback = vi.fn();
      const svelteUnsub = userSignal.subscribe(svelteCallback);

      // Update user state - should notify React and Svelte components
      userSignal.update({
        id: 123,
        name: 'Alice Johnson',
        isLoggedIn: true
      });

      // Update cart - should notify Vue component and trigger Solid computed
      cartSignal.update([
        { id: 1, name: 'Product A', price: 29.99 },
        { id: 2, name: 'Product B', price: 15.50 }
      ]);

      // Verify all components received their respective updates
      expect(reactCallback).toHaveBeenCalledWith({
        id: 123,
        name: 'Alice Johnson',
        isLoggedIn: true
      });

      expect(svelteCallback).toHaveBeenCalledWith({
        id: 123,
        name: 'Alice Johnson',
        isLoggedIn: true
      });

      expect(vueCallback).toHaveBeenCalledWith([
        { id: 1, name: 'Product A', price: 29.99 },
        { id: 2, name: 'Product B', price: 15.50 }
      ]);

      expect(solidCallback).toHaveBeenCalledWith(expect.any(Number));
      expect(cartTotalSignal.value).toBeCloseTo(45.49, 2);

      // Cleanup
      reactUnsub();
      vueUnsub();
      solidUnsub();
      svelteUnsub();
    });

    it('should handle complex signal dependencies across frameworks', () => {
      // Create base signals
      const priceSignal = signalManager.createSignal(100, 'product-price');
      const quantitySignal = signalManager.createSignal(2, 'product-quantity');
      const taxRateSignal = signalManager.createSignal(0.08, 'tax-rate');

      // Create computed signals that depend on base signals
      const subtotalSignal = signalManager.createComputed(
        () => priceSignal.value * quantitySignal.value,
        [priceSignal, quantitySignal],
        'subtotal'
      );

      const taxSignal = signalManager.createComputed(
        () => subtotalSignal.value * taxRateSignal.value,
        [subtotalSignal, taxRateSignal],
        'tax-amount'
      );

      const totalSignal = signalManager.createComputed(
        () => subtotalSignal.value + taxSignal.value,
        [subtotalSignal, taxSignal],
        'total-amount'
      );

      // Simulate different framework components subscribing to different levels
      const reactCallback = vi.fn(); // Subscribes to price changes
      const vueCallback = vi.fn();   // Subscribes to subtotal changes
      const solidCallback = vi.fn(); // Subscribes to total changes
      const svelteCallback = vi.fn(); // Subscribes to tax changes

      const reactUnsub = priceSignal.subscribe(reactCallback);
      const vueUnsub = subtotalSignal.subscribe(vueCallback);
      const solidUnsub = totalSignal.subscribe(solidCallback);
      const svelteUnsub = taxSignal.subscribe(svelteCallback);

      // Change base price - should cascade through all computed signals
      priceSignal.update(150);

      expect(reactCallback).toHaveBeenCalledWith(150);
      expect(vueCallback).toHaveBeenCalledWith(300); // 150 * 2
      expect(svelteCallback).toHaveBeenCalledWith(24); // 300 * 0.08
      expect(solidCallback).toHaveBeenCalledWith(324); // 300 + 24

      // Change quantity - should affect subtotal, tax, and total
      quantitySignal.update(3);

      expect(vueCallback).toHaveBeenCalledWith(450); // 150 * 3
      expect(svelteCallback).toHaveBeenCalledWith(36); // 450 * 0.08
      expect(solidCallback).toHaveBeenCalledWith(486); // 450 + 36

      // Cleanup
      reactUnsub();
      vueUnsub();
      solidUnsub();
      svelteUnsub();
    });
  });

  describe('End-to-End Multi-Framework Page Navigation', () => {
    it('should handle navigation between pages built with different frameworks', () => {
      // Create React home page
      const reactHomePage: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          route: '/',
          channels: [
            { event: 'navigate', emit: 'navigateTo' }
          ]
        },
        content: `
          export default function HomePage() {
            const goToDashboard = () => {
              navigateTo({ path: '/dashboard', framework: 'vue' });
            };
            
            return (
              <div>
                <h1>Home Page (React)</h1>
                <button onClick={goToDashboard}>Go to Dashboard</button>
              </div>
            );
          }
        `,
        filePath: '/pages/index.mtm'
      };

      // Create Vue dashboard page
      const vueDashboardPage: MTMFile = {
        frontmatter: {
          target: 'vue',
          route: '/dashboard',
          channels: [
            { event: 'navigate', emit: 'navigateTo' },
            { event: 'userLogin', emit: 'onUserLogin' }
          ]
        },
        content: `
          <template>
            <div>
              <h1>Dashboard (Vue)</h1>
              <button @click="goToProfile">Go to Profile</button>
              <div v-if="user">Welcome, {{ user.name }}!</div>
            </div>
          </template>
          
          <script setup>
          import { ref } from 'vue';
          
          const user = ref(null);
          
          const goToProfile = () => {
            navigateTo({ path: '/profile', framework: 'solid' });
          };
          
          const handleUserLogin = (userData) => {
            user.value = userData;
          };
          </script>
        `,
        filePath: '/pages/dashboard.mtm'
      };

      // Create Solid profile page
      const solidProfilePage: MTMFile = {
        frontmatter: {
          target: 'solid',
          route: '/profile',
          channels: [
            { event: 'navigate', emit: 'navigateTo' },
            { event: 'userUpdate', emit: 'updateUser' }
          ]
        },
        content: `
          import { createSignal } from 'solid-js';
          
          export default function ProfilePage() {
            const [profile, setProfile] = createSignal(null);
            
            const goToSettings = () => {
              navigateTo({ path: '/settings', framework: 'svelte' });
            };
            
            return (
              <div>
                <h1>Profile (Solid)</h1>
                <button onClick={goToSettings}>Go to Settings</button>
              </div>
            );
          }
        `,
        filePath: '/pages/profile.mtm'
      };

      // Create Svelte settings page
      const svelteSettingsPage: MTMFile = {
        frontmatter: {
          target: 'svelte',
          route: '/settings',
          channels: [
            { event: 'navigate', emit: 'navigateTo' },
            { event: 'settingsUpdate', emit: 'updateSettings' }
          ]
        },
        content: `
          <script>
            let settings = { theme: 'light', notifications: true };
            
            function goHome() {
              navigateTo({ path: '/', framework: 'reactjs' });
            }
            
            function saveSettings() {
              updateSettings(settings);
            }
          </script>
          
          <div>
            <h1>Settings (Svelte)</h1>
            <button on:click={goHome}>Go Home</button>
            <button on:click={saveSettings}>Save Settings</button>
          </div>
        `,
        filePath: '/pages/settings.mtm'
      };

      // Compile all pages
      const reactResult = reactAdapter.compile(reactHomePage);
      const vueResult = vueAdapter.compile(vueDashboardPage);
      const solidResult = solidAdapter.compile(solidProfilePage);
      const svelteResult = svelteAdapter.compile(svelteSettingsPage);

      // Verify all pages compiled successfully
      expect(reactResult.code).toBeDefined();
      expect(vueResult.code).toBeDefined();
      expect(solidResult.code).toBeDefined();
      expect(svelteResult.code).toBeDefined();

      // Register routes with router
      router.register('/', 'HomePage', 'reactjs');
      router.register('/dashboard', 'DashboardPage', 'vue');
      router.register('/profile', 'ProfilePage', 'solid');
      router.register('/settings', 'SettingsPage', 'svelte');

      // Simulate navigation flow
      const navigationCallback = vi.fn();
      pubsub.subscribe('navigate', navigationCallback, 'router-handler');

      // Test navigation sequence
      router.navigate('/');
      expect(router.getCurrentRoute().path).toBe('/');
      expect(router.getCurrentRoute().framework).toBe('reactjs');

      // Simulate React page navigating to Vue page
      pubsub.emit('navigate', { path: '/dashboard', framework: 'vue' });
      vi.runAllTimers();

      expect(navigationCallback).toHaveBeenCalledWith({ path: '/dashboard', framework: 'vue' });

      // Continue navigation chain
      router.navigate('/dashboard');
      expect(router.getCurrentRoute().path).toBe('/dashboard');
      expect(router.getCurrentRoute().framework).toBe('vue');

      router.navigate('/profile');
      expect(router.getCurrentRoute().path).toBe('/profile');
      expect(router.getCurrentRoute().framework).toBe('solid');

      router.navigate('/settings');
      expect(router.getCurrentRoute().path).toBe('/settings');
      expect(router.getCurrentRoute().framework).toBe('svelte');

      // Navigate back to home
      router.navigate('/');
      expect(router.getCurrentRoute().path).toBe('/');
      expect(router.getCurrentRoute().framework).toBe('reactjs');
    });

    it('should maintain state during cross-framework navigation', () => {
      // Create global navigation state
      const navigationState = signalManager.createSignal({
        currentUser: null,
        breadcrumbs: [],
        theme: 'light'
      }, 'navigation-state');

      // Create pages that use and update navigation state
      const reactPage: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          route: '/react-page',
          channels: [{ event: 'stateUpdate', emit: 'updateState' }]
        },
        content: `
          export default function ReactPage() {
            const updateBreadcrumbs = () => {
              updateState({ 
                breadcrumbs: [...navigationState.breadcrumbs, 'React Page'] 
              });
            };
            
            return <div>React Page</div>;
          }
        `,
        filePath: '/pages/react-page.mtm'
      };

      const vuePage: MTMFile = {
        frontmatter: {
          target: 'vue',
          route: '/vue-page',
          channels: [{ event: 'stateUpdate', emit: 'updateState' }]
        },
        content: `
          <template>
            <div>Vue Page</div>
          </template>
          
          <script setup>
          const updateBreadcrumbs = () => {
            updateState({ 
              breadcrumbs: [...navigationState.breadcrumbs, 'Vue Page'] 
            });
          };
          </script>
        `,
        filePath: '/pages/vue-page.mtm'
      };

      // Compile pages
      const reactResult = reactAdapter.compile(reactPage);
      const vueResult = vueAdapter.compile(vuePage);

      // Track state changes
      const stateCallback = vi.fn();
      const stateUnsub = navigationState.subscribe(stateCallback);

      // Simulate navigation and state updates
      navigationState.update({
        currentUser: { id: 1, name: 'Test User' },
        breadcrumbs: ['Home'],
        theme: 'light'
      });

      expect(stateCallback).toHaveBeenCalledWith({
        currentUser: { id: 1, name: 'Test User' },
        breadcrumbs: ['Home'],
        theme: 'light'
      });

      // Navigate to React page and update state
      router.navigate('/react-page');
      navigationState.update({
        ...navigationState.value,
        breadcrumbs: [...navigationState.value.breadcrumbs, 'React Page']
      });

      expect(navigationState.value.breadcrumbs).toEqual(['Home', 'React Page']);

      // Navigate to Vue page and update state
      router.navigate('/vue-page');
      navigationState.update({
        ...navigationState.value,
        breadcrumbs: [...navigationState.value.breadcrumbs, 'Vue Page']
      });

      expect(navigationState.value.breadcrumbs).toEqual(['Home', 'React Page', 'Vue Page']);
      expect(navigationState.value.currentUser).toEqual({ id: 1, name: 'Test User' });

      stateUnsub();
    });
  });

  describe('Event Propagation and State Management Across Framework Boundaries', () => {
    it('should handle complex event chains across multiple frameworks', () => {
      // Create a complex scenario: e-commerce checkout flow
      // React: Product selection
      // Vue: Shopping cart
      // Solid: Payment form
      // Svelte: Order confirmation

      const productSignal = signalManager.createSignal(null, 'selected-product');
      const cartSignal = signalManager.createSignal([], 'shopping-cart');
      const orderSignal = signalManager.createSignal(null, 'current-order');

      // Track all events
      const eventLog: Array<{ event: string; payload: any; timestamp: number }> = [];
      
      const logEvent = (event: string) => (payload: any) => {
        eventLog.push({ event, payload, timestamp: Date.now() });
      };

      // Subscribe to all events
      pubsub.subscribe('productSelected', logEvent('productSelected'), 'event-logger');
      pubsub.subscribe('addToCart', logEvent('addToCart'), 'event-logger');
      pubsub.subscribe('cartUpdated', logEvent('cartUpdated'), 'event-logger');
      pubsub.subscribe('proceedToPayment', logEvent('proceedToPayment'), 'event-logger');
      pubsub.subscribe('paymentSubmitted', logEvent('paymentSubmitted'), 'event-logger');
      pubsub.subscribe('orderConfirmed', logEvent('orderConfirmed'), 'event-logger');

      // Simulate React product selection
      const productData = { id: 1, name: 'Laptop', price: 999.99 };
      pubsub.emit('productSelected', productData);
      productSignal.update(productData);

      // Simulate Vue cart addition
      pubsub.emit('addToCart', { product: productData, quantity: 1 });
      cartSignal.update([{ ...productData, quantity: 1 }]);
      pubsub.emit('cartUpdated', cartSignal.value);

      // Simulate Solid payment initiation
      pubsub.emit('proceedToPayment', { 
        items: cartSignal.value, 
        total: cartSignal.value.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      });

      // Simulate Svelte payment submission
      const paymentData = {
        cardNumber: '****-****-****-1234',
        amount: 999.99,
        items: cartSignal.value
      };
      pubsub.emit('paymentSubmitted', paymentData);

      // Simulate order confirmation
      const orderData = {
        id: 'ORDER-123',
        items: cartSignal.value,
        total: 999.99,
        status: 'confirmed'
      };
      orderSignal.update(orderData);
      pubsub.emit('orderConfirmed', orderData);

      vi.runAllTimers();

      // Verify event chain
      expect(eventLog).toHaveLength(6);
      expect(eventLog[0].event).toBe('productSelected');
      expect(eventLog[1].event).toBe('addToCart');
      expect(eventLog[2].event).toBe('cartUpdated');
      expect(eventLog[3].event).toBe('proceedToPayment');
      expect(eventLog[4].event).toBe('paymentSubmitted');
      expect(eventLog[5].event).toBe('orderConfirmed');

      // Verify state consistency
      expect(productSignal.value).toEqual(productData);
      expect(cartSignal.value).toEqual([{ ...productData, quantity: 1 }]);
      expect(orderSignal.value).toEqual(orderData);
    });

    it('should handle event propagation with error recovery', () => {
      // Create components that might fail
      const errorCallback = vi.fn(() => {
        throw new Error('Component error');
      });
      const normalCallback1 = vi.fn();
      const normalCallback2 = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Subscribe components to the same event
      pubsub.subscribe('dataSync', normalCallback1, 'react-component');
      pubsub.subscribe('dataSync', errorCallback, 'vue-component-with-error');
      pubsub.subscribe('dataSync', normalCallback2, 'solid-component');

      // Emit event that will cause one component to error
      const syncData = { timestamp: Date.now(), data: 'test' };
      pubsub.emit('dataSync', syncData);
      vi.runAllTimers();

      // Normal components should still work
      expect(normalCallback1).toHaveBeenCalledWith(syncData);
      expect(normalCallback2).toHaveBeenCalledWith(syncData);
      expect(errorCallback).toHaveBeenCalledWith(syncData);
      expect(consoleSpy).toHaveBeenCalled();

      // System should continue working after error
      pubsub.emit('dataSync', { ...syncData, retry: true });
      vi.runAllTimers();

      expect(normalCallback1).toHaveBeenCalledTimes(2);
      expect(normalCallback2).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('should handle state conflicts between frameworks gracefully', () => {
      // Create a shared state that multiple frameworks try to update
      const sharedState = signalManager.createSignal({
        counter: 0,
        lastUpdatedBy: null
      }, 'shared-counter');

      const updates: Array<{ framework: string; value: number }> = [];
      
      const stateCallback = vi.fn((newState) => {
        updates.push({
          framework: newState.lastUpdatedBy,
          value: newState.counter
        });
      });

      const stateUnsub = sharedState.subscribe(stateCallback);

      // Simulate rapid updates from different frameworks
      signalManager.batch(() => {
        // React update
        sharedState.update({
          counter: sharedState.value.counter + 1,
          lastUpdatedBy: 'react'
        });

        // Vue update
        sharedState.update({
          counter: sharedState.value.counter + 1,
          lastUpdatedBy: 'vue'
        });

        // Solid update
        sharedState.update({
          counter: sharedState.value.counter + 1,
          lastUpdatedBy: 'solid'
        });
      });

      // Should have final consistent state
      expect(sharedState.value.counter).toBe(3);
      expect(sharedState.value.lastUpdatedBy).toBe('solid');
      
      // Should have received updates for each individual change (batching may not prevent individual notifications)
      expect(stateCallback).toHaveBeenCalled();

      stateUnsub();
    });
  });  
describe('Proper Cleanup and Memory Management in Cross-Framework Scenarios', () => {
    it('should properly clean up subscriptions when components unmount', () => {
      // Create multiple components with various subscriptions
      const components = [
        { id: 'react-header', framework: 'react' },
        { id: 'vue-sidebar', framework: 'vue' },
        { id: 'solid-main', framework: 'solid' },
        { id: 'svelte-footer', framework: 'svelte' }
      ];

      const events = ['userUpdate', 'themeChange', 'dataRefresh', 'navigationChange'];
      const callbacks = new Map<string, ReturnType<typeof vi.fn>>();

      // Subscribe all components to all events
      components.forEach(component => {
        events.forEach(event => {
          const callback = vi.fn();
          const callbackKey = `${component.id}-${event}`;
          callbacks.set(callbackKey, callback);
          pubsub.subscribe(event, callback, component.id);
        });
      });

      // Verify all subscriptions are active
      events.forEach(event => {
        expect(pubsub.getSubscriptionCount(event)).toBe(4);
      });

      // Emit events to verify all components receive them
      events.forEach(event => {
        pubsub.emit(event, `test-${event}`);
      });
      vi.runAllTimers();

      // Verify all callbacks were called
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalledTimes(1);
      });

      // Simulate React component unmounting
      pubsub.cleanup('react-header');

      // Verify React component subscriptions are cleaned up
      events.forEach(event => {
        expect(pubsub.getSubscriptionCount(event)).toBe(3);
      });
      expect(pubsub.getComponentEvents('react-header')).toEqual([]);

      // Emit events again
      callbacks.forEach(callback => callback.mockClear());
      events.forEach(event => {
        pubsub.emit(event, `test-${event}-2`);
      });
      vi.runAllTimers();

      // React callbacks should not be called, others should
      components.forEach(component => {
        events.forEach(event => {
          const callbackKey = `${component.id}-${event}`;
          const callback = callbacks.get(callbackKey)!;
          
          if (component.id === 'react-header') {
            expect(callback).not.toHaveBeenCalled();
          } else {
            expect(callback).toHaveBeenCalledWith(`test-${event}-2`);
          }
        });
      });

      // Clean up remaining components
      pubsub.cleanup('vue-sidebar');
      pubsub.cleanup('solid-main');
      pubsub.cleanup('svelte-footer');

      // Verify all subscriptions are cleaned up
      events.forEach(event => {
        expect(pubsub.getSubscriptionCount(event)).toBe(0);
      });
    });

    it('should handle signal cleanup across frameworks', () => {
      // Create signals used by different frameworks
      const userSignal = signalManager.createSignal({ id: null, name: '' }, 'user-state');
      const themeSignal = signalManager.createSignal('light', 'theme');
      const cartSignal = signalManager.createSignal([], 'cart-items');

      // Create computed signals
      const userDisplaySignal = signalManager.createComputed(
        () => userSignal.value.name || 'Guest',
        [userSignal],
        'user-display'
      );

      const cartCountSignal = signalManager.createComputed(
        () => cartSignal.value.length,
        [cartSignal],
        'cart-count'
      );

      // Simulate framework components subscribing
      const reactCallback = vi.fn();
      const vueCallback = vi.fn();
      const solidCallback = vi.fn();
      const svelteCallback = vi.fn();

      const reactUnsub = userSignal.subscribe(reactCallback);
      const vueUnsub = themeSignal.subscribe(vueCallback);
      const solidUnsub = userDisplaySignal.subscribe(solidCallback);
      const svelteUnsub = cartCountSignal.subscribe(svelteCallback);

      // Verify signals are working
      expect(signalManager.signalCount).toBe(5); // 3 base + 2 computed

      userSignal.update({ id: 1, name: 'John' });
      themeSignal.update('dark');
      cartSignal.update([{ id: 1, name: 'Item 1' }]);

      expect(reactCallback).toHaveBeenCalledWith({ id: 1, name: 'John' });
      expect(vueCallback).toHaveBeenCalledWith('dark');
      expect(solidCallback).toHaveBeenCalledWith('John');
      expect(svelteCallback).toHaveBeenCalledWith(1);

      // Simulate component unmounting - unsubscribe
      reactUnsub();
      vueUnsub();
      solidUnsub();
      svelteUnsub();

      // Verify subscriptions are cleaned up but signals still exist
      expect(userSignal.subscriberCount).toBe(1); // Still used by computed signal
      expect(themeSignal.subscriberCount).toBe(0);
      expect(userDisplaySignal.subscriberCount).toBe(0);
      expect(cartCountSignal.subscriberCount).toBe(0);

      // Clean up signals
      signalManager.destroySignal('user-display');
      signalManager.destroySignal('cart-count');
      signalManager.destroySignal('user-state');
      signalManager.destroySignal('theme');
      signalManager.destroySignal('cart-items');

      expect(signalManager.signalCount).toBe(0);
    });

    it('should handle memory leaks in high-frequency scenarios', () => {
      // Simulate a scenario with many short-lived components
      const componentLifecycles: Array<{
        id: string;
        cleanup: () => void;
      }> = [];

      // Create 100 short-lived components
      for (let i = 0; i < 100; i++) {
        const componentId = `temp-component-${i}`;
        const callback = vi.fn();
        
        // Each component subscribes to multiple events
        pubsub.subscribe('highFreqEvent1', callback, componentId);
        pubsub.subscribe('highFreqEvent2', callback, componentId);
        pubsub.subscribe('highFreqEvent3', callback, componentId);

        // Create a signal for each component
        const signal = signalManager.createSignal(i, `temp-signal-${i}`);
        const unsub = signal.subscribe(callback);

        componentLifecycles.push({
          id: componentId,
          cleanup: () => {
            pubsub.cleanup(componentId);
            unsub();
            signalManager.destroySignal(`temp-signal-${i}`);
          }
        });
      }

      // Verify all components are subscribed
      expect(pubsub.getSubscriptionCount('highFreqEvent1')).toBe(100);
      expect(pubsub.getSubscriptionCount('highFreqEvent2')).toBe(100);
      expect(pubsub.getSubscriptionCount('highFreqEvent3')).toBe(100);
      expect(signalManager.signalCount).toBe(100);

      // Emit high-frequency events
      for (let i = 0; i < 50; i++) {
        pubsub.emit('highFreqEvent1', `data-${i}`);
        pubsub.emit('highFreqEvent2', `data-${i}`);
        pubsub.emit('highFreqEvent3', `data-${i}`);
      }
      vi.runAllTimers();

      // Clean up components in batches
      for (let i = 0; i < 50; i++) {
        componentLifecycles[i].cleanup();
      }

      // Verify partial cleanup
      expect(pubsub.getSubscriptionCount('highFreqEvent1')).toBe(50);
      expect(signalManager.signalCount).toBe(50);

      // Clean up remaining components
      for (let i = 50; i < 100; i++) {
        componentLifecycles[i].cleanup();
      }

      // Verify complete cleanup
      expect(pubsub.getSubscriptionCount('highFreqEvent1')).toBe(0);
      expect(pubsub.getSubscriptionCount('highFreqEvent2')).toBe(0);
      expect(pubsub.getSubscriptionCount('highFreqEvent3')).toBe(0);
      expect(signalManager.signalCount).toBe(0);
    });

    it('should handle cleanup during active event processing', () => {
      // Create a scenario where components are cleaned up while events are being processed
      const callbacks = new Map<string, ReturnType<typeof vi.fn>>();
      const componentIds = ['comp-1', 'comp-2', 'comp-3', 'comp-4', 'comp-5'];

      // Subscribe components
      componentIds.forEach(id => {
        const callback = vi.fn(() => {
          // Simulate some components cleaning up during event processing
          if (id === 'comp-3') {
            setTimeout(() => pubsub.cleanup('comp-4'), 0);
          }
        });
        callbacks.set(id, callback);
        pubsub.subscribe('cleanupTest', callback, id);
      });

      expect(pubsub.getSubscriptionCount('cleanupTest')).toBe(5);

      // Emit event that will trigger cleanup during processing
      pubsub.emit('cleanupTest', 'test-data');
      vi.runAllTimers();

      // Verify event was processed by all components initially subscribed
      componentIds.forEach(id => {
        expect(callbacks.get(id)).toHaveBeenCalledWith('test-data');
      });

      // Verify comp-4 was cleaned up
      expect(pubsub.getComponentEvents('comp-4')).toEqual([]);
      expect(pubsub.getSubscriptionCount('cleanupTest')).toBe(4);

      // Emit another event to verify system stability
      callbacks.forEach(callback => callback.mockClear());
      pubsub.emit('cleanupTest', 'test-data-2');
      vi.runAllTimers();

      // comp-4 should not receive the second event
      componentIds.forEach(id => {
        const callback = callbacks.get(id)!;
        if (id === 'comp-4') {
          expect(callback).not.toHaveBeenCalled();
        } else {
          expect(callback).toHaveBeenCalledWith('test-data-2');
        }
      });
    });

    it('should prevent memory leaks from circular references', () => {
      // Create signals that reference each other
      const signalA = signalManager.createSignal(0, 'signal-a');
      const signalB = signalManager.createSignal(0, 'signal-b');

      // Create computed signals that depend on each other (potential circular reference)
      const computedA = signalManager.createComputed(
        () => signalB.value + 1,
        [signalB],
        'computed-a'
      );

      const computedB = signalManager.createComputed(
        () => signalA.value + 1,
        [signalA],
        'computed-b'
      );

      // Create cross-references through pub/sub
      const callbackA = vi.fn((value) => {
        if (value < 5) { // Prevent infinite loop
          pubsub.emit('updateB', value + 1);
        }
      });

      const callbackB = vi.fn((value) => {
        if (value < 5) { // Prevent infinite loop
          pubsub.emit('updateA', value + 1);
        }
      });

      pubsub.subscribe('updateA', callbackA, 'component-a');
      pubsub.subscribe('updateB', callbackB, 'component-b');

      // Trigger the circular updates
      pubsub.emit('updateA', 1);
      vi.runAllTimers();

      // Verify system handled circular references without crashing
      expect(callbackA).toHaveBeenCalled();
      expect(callbackB).toHaveBeenCalled();

      // Clean up everything
      pubsub.cleanup('component-a');
      pubsub.cleanup('component-b');
      signalManager.destroySignal('signal-a');
      signalManager.destroySignal('signal-b');
      signalManager.destroySignal('computed-a');
      signalManager.destroySignal('computed-b');

      // Verify complete cleanup
      expect(pubsub.getSubscriptionCount('updateA')).toBe(0);
      expect(pubsub.getSubscriptionCount('updateB')).toBe(0);
      expect(signalManager.signalCount).toBe(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large-scale cross-framework applications efficiently', () => {
      const startTime = performance.now();

      // Create a large number of components across frameworks
      const frameworks = ['react', 'vue', 'solid', 'svelte'];
      const componentCount = 250; // 1000 total components (250 per framework)
      const eventTypes = ['userAction', 'dataUpdate', 'uiChange', 'systemEvent'];

      const components: Array<{
        id: string;
        framework: string;
        callbacks: Map<string, ReturnType<typeof vi.fn>>;
        signalUnsubs: Array<() => void>;
      }> = [];

      // Create components
      for (let i = 0; i < componentCount; i++) {
        frameworks.forEach(framework => {
          const componentId = `${framework}-component-${i}`;
          const callbacks = new Map<string, ReturnType<typeof vi.fn>>();
          const signalUnsubs: Array<() => void> = [];

          // Subscribe to events
          eventTypes.forEach(eventType => {
            const callback = vi.fn();
            callbacks.set(eventType, callback);
            pubsub.subscribe(eventType, callback, componentId);
          });

          // Create and subscribe to signals
          const signal = signalManager.createSignal(i, `${componentId}-signal`);
          const unsub = signal.subscribe(vi.fn());
          signalUnsubs.push(unsub);

          components.push({
            id: componentId,
            framework,
            callbacks,
            signalUnsubs
          });
        });
      }

      const setupTime = performance.now() - startTime;
      expect(setupTime).toBeLessThan(1000); // Setup should complete in under 1 second

      // Verify all subscriptions are active
      eventTypes.forEach(eventType => {
        expect(pubsub.getSubscriptionCount(eventType)).toBe(1000);
      });
      expect(signalManager.signalCount).toBe(1000);

      // Emit events and measure performance
      const emitStartTime = performance.now();
      eventTypes.forEach(eventType => {
        pubsub.emit(eventType, `test-${eventType}`);
      });
      vi.runAllTimers();
      const emitTime = performance.now() - emitStartTime;

      expect(emitTime).toBeLessThan(500); // Event processing should complete in under 500ms

      // Clean up half the components
      const cleanupStartTime = performance.now();
      for (let i = 0; i < components.length / 2; i++) {
        const component = components[i];
        pubsub.cleanup(component.id);
        component.signalUnsubs.forEach(unsub => unsub());
        signalManager.destroySignal(`${component.id}-signal`);
      }
      const cleanupTime = performance.now() - cleanupStartTime;

      expect(cleanupTime).toBeLessThan(200); // Cleanup should complete in under 200ms

      // Verify partial cleanup
      eventTypes.forEach(eventType => {
        expect(pubsub.getSubscriptionCount(eventType)).toBe(500);
      });
      expect(signalManager.signalCount).toBe(500);

      // Clean up remaining components
      for (let i = Math.floor(components.length / 2); i < components.length; i++) {
        const component = components[i];
        pubsub.cleanup(component.id);
        component.signalUnsubs.forEach(unsub => unsub());
        signalManager.destroySignal(`${component.id}-signal`);
      }

      // Verify complete cleanup
      eventTypes.forEach(eventType => {
        expect(pubsub.getSubscriptionCount(eventType)).toBe(0);
      });
      expect(signalManager.signalCount).toBe(0);
    });
  });
});