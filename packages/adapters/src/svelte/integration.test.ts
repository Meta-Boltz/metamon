import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SvelteAdapter } from './svelte-adapter.js';
import type { MTMFile, Channel } from '@metamon/core';

// Mock the core modules
const mockSignalManager = {
  createSignal: vi.fn(),
  getSignal: vi.fn(),
  destroySignal: vi.fn()
};

const mockPubSubSystem = {
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  emit: vi.fn(),
  cleanup: vi.fn()
};

vi.mock('@metamon/core', () => ({
  signalManager: mockSignalManager,
  pubSubSystem: mockPubSubSystem
}));

describe('SvelteAdapter Integration Tests', () => {
  let adapter: SvelteAdapter;

  beforeEach(() => {
    adapter = new SvelteAdapter();
    vi.clearAllMocks();
  });

  describe('End-to-end compilation', () => {
    it('should compile a complete Svelte component with signals and pub/sub', () => {
      const channels: Channel[] = [
        { event: 'userLogin', emit: 'handleUserLogin' },
        { event: 'dataUpdate', emit: 'handleDataUpdate' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte',
          channels,
          route: '/dashboard',
          layout: 'main'
        },
        content: `import { fade, slide } from 'svelte/transition';
import Button from './components/Button.svelte';
import Modal from './components/Modal.svelte';

<script>
  let user = null;
  let showModal = false;
  let notifications = [];
  
  function openModal() {
    showModal = true;
  }
  
  function closeModal() {
    showModal = false;
  }
  
  function addNotification(message) {
    notifications = [...notifications, { id: Date.now(), message }];
  }
</script>

<div class="dashboard">
  <header>
    <h1>Dashboard</h1>
    {#if user}
      <p>Welcome, {user.name}!</p>
    {:else}
      <p>Please log in</p>
    {/if}
  </header>
  
  <main>
    <Button on:click={openModal}>Open Settings</Button>
    
    {#if notifications.length > 0}
      <div class="notifications" transition:slide>
        {#each notifications as notification (notification.id)}
          <div class="notification" transition:fade>
            {notification.message}
          </div>
        {/each}
      </div>
    {/if}
  </main>
  
  {#if showModal}
    <Modal on:close={closeModal}>
      <h2>Settings</h2>
      <p>Configure your preferences here.</p>
    </Modal>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .notifications {
    margin-top: 1rem;
  }
  
  .notification {
    background: #f0f0f0;
    padding: 0.5rem;
    margin: 0.25rem 0;
    border-radius: 4px;
  }
</style>`,
        filePath: '/src/pages/dashboard.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Check that all necessary imports are included
      expect(result.code).toContain('import { onMount, onDestroy } from \'svelte\';');
      expect(result.code).toContain('import { writable, derived } from \'svelte/store\';');
      expect(result.code).toContain('import { signalManager, pubSubSystem } from \'@metamon/core\';');
      expect(result.code).toContain('import { fade, slide } from \'svelte/transition\';');
      expect(result.code).toContain('import Button from \'./components/Button.svelte\';');
      expect(result.code).toContain('import Modal from \'./components/Modal.svelte\';');

      // Check that signal integration functions are included
      expect(result.code).toContain('export function useSignal(initialValue, key)');
      expect(result.code).toContain('export function useMetamonSignal(key, initialValue)');
      expect(result.code).toContain('export function createMetamonStore(initialValue, key)');

      // Check that pub/sub integration is included
      expect(result.code).toContain('const handleUserLogin = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'userLogin\', payload);');
      expect(result.code).toContain('const handleDataUpdate = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'dataUpdate\', payload);');

      // Check that event subscriptions are set up
      expect(result.code).toContain('pubSubSystem.subscribe(\'userLogin\'');
      expect(result.code).toContain('pubSubSystem.subscribe(\'dataUpdate\'');

      // Check that original component code is preserved
      expect(result.code).toContain('let user = null;');
      expect(result.code).toContain('let showModal = false;');
      expect(result.code).toContain('function openModal()');
      expect(result.code).toContain('<div class="dashboard">');
      expect(result.code).toContain('<style>');

      // Check dependencies
      expect(result.dependencies).toContain('svelte/transition');
      expect(result.dependencies).toContain('./components/Button.svelte');
      expect(result.dependencies).toContain('./components/Modal.svelte');

      // Check exports
      expect(result.exports).toEqual(['default']);
    });

    it('should handle complex signal usage patterns', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte'
        },
        content: `import { derived } from 'svelte/store';

<script>
  // Using Metamon signals for global state
  const [userStore, setUser] = useSignal(null, 'currentUser');
  const [settingsStore, setSettings] = useSignal({}, 'appSettings');
  
  // Creating derived stores
  const isLoggedIn = derived(userStore, $user => $user !== null);
  const userName = derived(userStore, $user => $user?.name || 'Guest');
  
  // Using Metamon store directly
  const notificationStore = createMetamonStore([], 'notifications');
  
  function login(userData) {
    setUser(userData);
    notificationStore.update(notifications => [
      ...notifications,
      { type: 'success', message: 'Logged in successfully' }
    ]);
  }
  
  function logout() {
    setUser(null);
    notificationStore.set([]);
  }
</script>

<div>
  <h1>Welcome, {$userName}!</h1>
  
  {#if $isLoggedIn}
    <button on:click={logout}>Logout</button>
  {:else}
    <button on:click={() => login({ name: 'John Doe', id: 1 })}>
      Login
    </button>
  {/if}
  
  {#if $notificationStore.length > 0}
    <div class="notifications">
      {#each $notificationStore as notification}
        <div class="notification {notification.type}">
          {notification.message}
        </div>
      {/each}
    </div>
  {/if}
</div>`,
        filePath: '/src/components/auth.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Check that signal functions are available
      expect(result.code).toContain('useSignal');
      expect(result.code).toContain('createMetamonStore');
      
      // Check that original component logic is preserved
      expect(result.code).toContain('const [userStore, setUser] = useSignal(null, \'currentUser\');');
      expect(result.code).toContain('const notificationStore = createMetamonStore([], \'notifications\');');
      expect(result.code).toContain('function login(userData)');
      expect(result.code).toContain('function logout()');
    });

    it('should handle pub/sub event communication patterns', () => {
      const channels: Channel[] = [
        { event: 'cart:add', emit: 'addToCart' },
        { event: 'cart:remove', emit: 'removeFromCart' },
        { event: 'cart:clear', emit: 'clearCart' },
        { event: 'user:logout', emit: 'handleLogout' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte',
          channels
        },
        content: `<script>
  let cartItems = [];
  let user = null;
  
  // Listen for cart events from other components
  function handleCartAdd(item) {
    cartItems = [...cartItems, item];
  }
  
  function handleCartRemove(itemId) {
    cartItems = cartItems.filter(item => item.id !== itemId);
  }
  
  function handleCartClear() {
    cartItems = [];
  }
  
  function handleUserLogout() {
    user = null;
    cartItems = [];
  }
  
  // Emit events to other components
  function onAddProduct(product) {
    addToCart(product);
  }
  
  function onRemoveProduct(productId) {
    removeFromCart(productId);
  }
  
  function onClearCart() {
    clearCart();
  }
  
  function onLogout() {
    handleLogout();
  }
</script>

<div class="shopping-cart">
  <h2>Shopping Cart ({cartItems.length})</h2>
  
  {#each cartItems as item}
    <div class="cart-item">
      <span>{item.name}</span>
      <button on:click={() => onRemoveProduct(item.id)}>Remove</button>
    </div>
  {/each}
  
  {#if cartItems.length > 0}
    <button on:click={onClearCart}>Clear Cart</button>
  {/if}
  
  {#if user}
    <button on:click={onLogout}>Logout</button>
  {/if}
</div>`,
        filePath: '/src/components/cart.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Check that all event handlers are generated
      expect(result.code).toContain('const addToCart = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'cart:add\', payload);');
      expect(result.code).toContain('const removeFromCart = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'cart:remove\', payload);');
      expect(result.code).toContain('const clearCart = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'cart:clear\', payload);');
      expect(result.code).toContain('const handleLogout = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'user:logout\', payload);');

      // Check that all event subscriptions are set up
      expect(result.code).toContain('pubSubSystem.subscribe(\'cart:add\'');
      expect(result.code).toContain('pubSubSystem.subscribe(\'cart:remove\'');
      expect(result.code).toContain('pubSubSystem.subscribe(\'cart:clear\'');
      expect(result.code).toContain('pubSubSystem.subscribe(\'user:logout\'');

      // Check that lifecycle management is included
      expect(result.code).toContain('onMount(() => {');
      expect(result.code).toContain('onDestroy(() => {');
      expect(result.code).toContain('pubSubSystem.cleanup(componentId);');
    });

    it('should preserve Svelte-specific syntax and features', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte'
        },
        content: `<script>
  import { createEventDispatcher } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { fade, fly } from 'svelte/transition';
  
  const dispatch = createEventDispatcher();
  
  let items = ['apple', 'banana', 'cherry'];
  let selectedItem = '';
  let showDetails = false;
  
  const progress = tweened(0, {
    duration: 400
  });
  
  function selectItem(item) {
    selectedItem = item;
    showDetails = true;
    progress.set(100);
    dispatch('itemSelected', { item });
  }
  
  function closeDetails() {
    showDetails = false;
    progress.set(0);
  }
</script>

<div class="item-selector">
  <h3>Select an item:</h3>
  
  {#each items as item, index}
    <button 
      class="item-button"
      class:selected={selectedItem === item}
      on:click={() => selectItem(item)}
      in:fly={{ y: 20, delay: index * 100 }}
    >
      {item}
    </button>
  {/each}
  
  {#if showDetails}
    <div class="details" transition:fade>
      <h4>Selected: {selectedItem}</h4>
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          style="width: {$progress}%"
        ></div>
      </div>
      <button on:click={closeDetails}>Close</button>
    </div>
  {/if}
</div>

<style>
  .item-selector {
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
  }
  
  .item-button {
    margin: 0.25rem;
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .item-button:hover {
    background: #f0f0f0;
  }
  
  .item-button.selected {
    background: #007bff;
    color: white;
  }
  
  .details {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 4px;
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
    margin: 0.5rem 0;
  }
  
  .progress-fill {
    height: 100%;
    background: #28a745;
    transition: width 0.3s ease;
  }
</style>`,
        filePath: '/src/components/item-selector.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Check that Svelte-specific imports are preserved
      expect(result.code).toContain('import { createEventDispatcher } from \'svelte\';');
      expect(result.code).toContain('import { tweened } from \'svelte/motion\';');
      expect(result.code).toContain('import { fade, fly } from \'svelte/transition\';');

      // Check that Svelte syntax is preserved
      expect(result.code).toContain('const dispatch = createEventDispatcher();');
      expect(result.code).toContain('const progress = tweened(0');
      expect(result.code).toContain('{#each items as item, index}');
      expect(result.code).toContain('class:selected={selectedItem === item}');
      expect(result.code).toContain('in:fly={{ y: 20, delay: index * 100 }}');
      expect(result.code).toContain('{#if showDetails}');
      expect(result.code).toContain('transition:fade');
      expect(result.code).toContain('style="width: {$progress}%"');

      // Check that styles are preserved
      expect(result.code).toContain('<style>');
      expect(result.code).toContain('.item-selector {');
      expect(result.code).toContain('.progress-fill {');

      // Check dependencies
      expect(result.dependencies).toContain('svelte/motion');
      expect(result.dependencies).toContain('svelte/transition');
    });
  });

  describe('Error handling in integration scenarios', () => {
    it('should handle malformed Svelte syntax gracefully', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte'
        },
        content: `<script>
  let unclosedString = "this string is not closed
  let items = [1, 2, 3;
  
  function brokenFunction( {
    return "broken";
  }
</script>

<div>
  {#each items as item
    <p>{item}</p>
  {/each}
</div>`,
        filePath: '/src/broken-component.mtm'
      };

      // The adapter should still compile but the resulting code may have issues
      // This tests that the adapter doesn't crash on malformed input
      expect(() => {
        const result = adapter.compile(mtmFile);
        expect(result.code).toBeDefined();
      }).not.toThrow();
    });

    it('should handle missing imports gracefully', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte'
        },
        content: `<script>
  // Using components that aren't imported
  let showModal = false;
</script>

<div>
  <NonExistentComponent />
  <AnotherMissingComponent prop="value" />
  
  {#if showModal}
    <MissingModal on:close={() => showModal = false} />
  {/if}
</div>`,
        filePath: '/src/missing-imports.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Should compile without throwing, even with missing imports
      expect(result.code).toBeDefined();
      expect(result.code).toContain('let showModal = false;');
      expect(result.code).toContain('<NonExistentComponent />');
      expect(result.dependencies).toEqual([]);
    });
  });
});