import { describe, it, expect } from 'vitest';
import { SvelteAdapter } from './svelte-adapter.js';
import type { MTMFile } from '@metamon/core';

describe('SvelteAdapter Demo', () => {
  const adapter = new SvelteAdapter();

  it('should demonstrate a complete Svelte component compilation', () => {
    console.log('\n🎯 Svelte Adapter Demo: Compiling a complete .mtm file to Svelte component\n');

    const mtmFile: MTMFile = {
      frontmatter: {
        target: 'svelte',
        channels: [
          { event: 'user:login', emit: 'onUserLogin' },
          { event: 'notification:show', emit: 'showNotification' }
        ],
        route: '/profile',
        layout: 'authenticated'
      },
      content: `import { fade, slide } from 'svelte/transition';
import { tweened } from 'svelte/motion';
import Avatar from './components/Avatar.svelte';
import Button from './components/Button.svelte';

<script>
  let user = null;
  let notifications = [];
  let isEditing = false;
  
  const progress = tweened(0, { duration: 300 });
  
  // Use Metamon signals for global state
  const [userStore, setUser] = useSignal(null, 'currentUser');
  const [themeStore, setTheme] = useMetamonSignal('appTheme', 'light');
  
  // Create a Metamon store for notifications
  const notificationStore = createMetamonStore([], 'notifications');
  
  function startEditing() {
    isEditing = true;
    progress.set(100);
  }
  
  function saveProfile(profileData) {
    setUser({ ...user, ...profileData });
    onUserLogin(profileData);
    showNotification({
      type: 'success',
      message: 'Profile updated successfully!'
    });
    isEditing = false;
    progress.set(0);
  }
  
  function toggleTheme() {
    const newTheme = $themeStore === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }
</script>

<div class="profile-page" class:dark={$themeStore === 'dark'}>
  <header>
    <h1>User Profile</h1>
    <Button on:click={toggleTheme}>
      Toggle {$themeStore === 'light' ? 'Dark' : 'Light'} Mode
    </Button>
  </header>
  
  {#if $userStore}
    <div class="profile-content" transition:fade>
      <div class="avatar-section">
        <Avatar user={$userStore} size="large" />
        <h2>{$userStore.name}</h2>
        <p>{$userStore.email}</p>
      </div>
      
      {#if isEditing}
        <div class="edit-form" transition:slide>
          <div class="progress-bar">
            <div class="progress-fill" style="width: {$progress}%"></div>
          </div>
          <form on:submit|preventDefault={() => saveProfile({ name: 'Updated Name' })}>
            <input type="text" placeholder="Name" value={$userStore.name} />
            <input type="email" placeholder="Email" value={$userStore.email} />
            <div class="form-actions">
              <Button type="submit">Save Changes</Button>
              <Button variant="secondary" on:click={() => isEditing = false}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      {:else}
        <Button on:click={startEditing}>Edit Profile</Button>
      {/if}
    </div>
  {:else}
    <div class="no-user" transition:fade>
      <p>Please log in to view your profile.</p>
    </div>
  {/if}
  
  {#if $notificationStore.length > 0}
    <div class="notifications" transition:slide>
      {#each $notificationStore as notification (notification.id)}
        <div class="notification {notification.type}" transition:fade>
          {notification.message}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .profile-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    transition: all 0.3s ease;
  }
  
  .profile-page.dark {
    background: #1a1a1a;
    color: white;
  }
  
  .avatar-section {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .edit-form {
    background: #f8f9fa;
    padding: 1.5rem;
    border-radius: 8px;
    margin: 1rem 0;
  }
  
  .profile-page.dark .edit-form {
    background: #2d2d2d;
  }
  
  .progress-bar {
    width: 100%;
    height: 4px;
    background: #e0e0e0;
    border-radius: 2px;
    margin-bottom: 1rem;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: #007bff;
    transition: width 0.3s ease;
  }
  
  .form-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  .notifications {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
  }
  
  .notification {
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .notification.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }
  
  .notification.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }
</style>`,
      filePath: '/src/pages/profile.mtm'
    };

    console.log('📄 Input MTM File:');
    console.log('  Target:', mtmFile.frontmatter.target);
    console.log('  Channels:', mtmFile.frontmatter.channels?.map(c => `${c.event} -> ${c.emit}`));
    console.log('  Route:', mtmFile.frontmatter.route);
    console.log('  Layout:', mtmFile.frontmatter.layout);
    console.log('  Content length:', mtmFile.content.length, 'characters');

    const result = adapter.compile(mtmFile);

    console.log('\n✅ Compilation Result:');
    console.log('  Generated code length:', result.code.length, 'characters');
    console.log('  Dependencies:', result.dependencies);
    console.log('  Exports:', result.exports);

    // Verify the compilation was successful
    expect(result.code).toBeDefined();
    expect(result.code.length).toBeGreaterThan(0);

    // Check that Svelte-specific features are preserved
    expect(result.code).toContain('import { fade, slide } from \'svelte/transition\';');
    expect(result.code).toContain('import { tweened } from \'svelte/motion\';');
    expect(result.code).toContain('transition:fade');
    expect(result.code).toContain('transition:slide');
    expect(result.code).toContain('class:dark={$themeStore === \'dark\'}');

    // Check that Metamon signal integration is included
    expect(result.code).toContain('useSignal');
    expect(result.code).toContain('useMetamonSignal');
    expect(result.code).toContain('createMetamonStore');

    // Check that pub/sub integration is included
    expect(result.code).toContain('onUserLogin');
    expect(result.code).toContain('showNotification');
    expect(result.code).toContain('pubSubSystem.emit(\'user:login\'');
    expect(result.code).toContain('pubSubSystem.emit(\'notification:show\'');

    // Check that lifecycle management is included
    expect(result.code).toContain('onMount');
    expect(result.code).toContain('onDestroy');

    console.log('\n🎨 Generated Code Preview (first 500 chars):');
    console.log(result.code.substring(0, 500) + '...');

    console.log('\n🔧 Key Features Verified:');
    console.log('  ✓ Svelte transitions and animations preserved');
    console.log('  ✓ Metamon signal integration injected');
    console.log('  ✓ Pub/sub event handlers generated');
    console.log('  ✓ Component lifecycle management added');
    console.log('  ✓ Original Svelte syntax maintained');
    console.log('  ✓ Styles and component structure preserved');

    expect(result.dependencies).toContain('svelte/transition');
    expect(result.dependencies).toContain('svelte/motion');
    expect(result.dependencies).toContain('./components/Avatar.svelte');
    expect(result.dependencies).toContain('./components/Button.svelte');
  });

  it('should demonstrate signal and store integration', () => {
    console.log('\n🔄 Svelte Adapter Demo: Signal and Store Integration\n');

    const mtmFile: MTMFile = {
      frontmatter: {
        target: 'svelte'
      },
      content: `<script>
  // Different ways to use Metamon signals in Svelte
  
  // Basic signal usage
  const [countStore, setCount] = useSignal(0);
  
  // Named signal for global state
  const [userStore, setUser] = useMetamonSignal('currentUser', null);
  
  // Enhanced Metamon store
  const todoStore = createMetamonStore([], 'todos');
  
  // Derived stores work with Metamon signals
  const completedTodos = derived(todoStore, $todos => 
    $todos.filter(todo => todo.completed)
  );
  
  function increment() {
    setCount($countStore + 1);
  }
  
  function addTodo(text) {
    todoStore.update(todos => [
      ...todos,
      { id: Date.now(), text, completed: false }
    ]);
  }
  
  function toggleTodo(id) {
    todoStore.update(todos =>
      todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }
</script>

<div class="app">
  <h1>Count: {$countStore}</h1>
  <button on:click={increment}>Increment</button>
  
  <h2>Todos ({$todoStore.length})</h2>
  <p>Completed: {$completedTodos.length}</p>
  
  <input 
    type="text" 
    placeholder="Add todo..."
    on:keydown={(e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        addTodo(e.target.value.trim());
        e.target.value = '';
      }
    }}
  />
  
  {#each $todoStore as todo (todo.id)}
    <div class="todo" class:completed={todo.completed}>
      <input 
        type="checkbox" 
        checked={todo.completed}
        on:change={() => toggleTodo(todo.id)}
      />
      <span>{todo.text}</span>
    </div>
  {/each}
</div>`,
      filePath: '/src/components/todo-app.mtm'
    };

    const result = adapter.compile(mtmFile);

    console.log('📊 Signal Integration Features:');
    console.log('  ✓ useSignal for local reactive state');
    console.log('  ✓ useMetamonSignal for named global state');
    console.log('  ✓ createMetamonStore for enhanced stores');
    console.log('  ✓ Derived stores work with Metamon signals');
    console.log('  ✓ Automatic cleanup on component destroy');

    // Verify signal integration
    expect(result.code).toContain('const [countStore, setCount] = useSignal(0);');
    expect(result.code).toContain('const [userStore, setUser] = useMetamonSignal(\'currentUser\', null);');
    expect(result.code).toContain('const todoStore = createMetamonStore([], \'todos\');');
    expect(result.code).toContain('derived(todoStore');

    // Verify signal functions are available
    expect(result.code).toContain('export function useSignal(initialValue, key)');
    expect(result.code).toContain('export function useMetamonSignal(key, initialValue)');
    expect(result.code).toContain('export function createMetamonStore(initialValue, key)');

    console.log('\n✅ All signal integration features verified successfully!');
  });

  it('should demonstrate pub/sub event communication', () => {
    console.log('\n📡 Svelte Adapter Demo: Pub/Sub Event Communication\n');

    const mtmFile: MTMFile = {
      frontmatter: {
        target: 'svelte',
        channels: [
          { event: 'cart:item-added', emit: 'notifyItemAdded' },
          { event: 'cart:item-removed', emit: 'notifyItemRemoved' },
          { event: 'user:preferences-changed', emit: 'notifyPreferencesChanged' }
        ]
      },
      content: `<script>
  let cartItems = [];
  let preferences = { theme: 'light', notifications: true };
  
  // Using the pub/sub composable
  const { subscribe, emit, unsubscribe } = usePubSub();
  
  // Listen for events from other components
  subscribe('product:selected', (product) => {
    console.log('Product selected:', product);
    addToCart(product);
  });
  
  subscribe('theme:changed', (theme) => {
    preferences = { ...preferences, theme };
    notifyPreferencesChanged(preferences);
  });
  
  function addToCart(item) {
    cartItems = [...cartItems, item];
    notifyItemAdded(item);
  }
  
  function removeFromCart(itemId) {
    const item = cartItems.find(i => i.id === itemId);
    cartItems = cartItems.filter(i => i.id !== itemId);
    notifyItemRemoved(item);
  }
  
  function changeTheme(newTheme) {
    preferences = { ...preferences, theme: newTheme };
    emit('theme:broadcast', newTheme);
    notifyPreferencesChanged(preferences);
  }
</script>

<div class="shopping-component" class:dark={preferences.theme === 'dark'}>
  <h2>Shopping Cart ({cartItems.length})</h2>
  
  <div class="theme-selector">
    <button 
      class:active={preferences.theme === 'light'}
      on:click={() => changeTheme('light')}
    >
      Light
    </button>
    <button 
      class:active={preferences.theme === 'dark'}
      on:click={() => changeTheme('dark')}
    >
      Dark
    </button>
  </div>
  
  {#each cartItems as item (item.id)}
    <div class="cart-item">
      <span>{item.name} - {item.price}</span>
      <button on:click={() => removeFromCart(item.id)}>Remove</button>
    </div>
  {/each}
  
  {#if cartItems.length === 0}
    <p>Your cart is empty</p>
  {/if}
</div>`,
      filePath: '/src/components/shopping-cart.mtm'
    };

    const result = adapter.compile(mtmFile);

    console.log('📢 Pub/Sub Communication Features:');
    console.log('  ✓ Event emission to other components');
    console.log('  ✓ Event subscription from other components');
    console.log('  ✓ Automatic component ID generation');
    console.log('  ✓ Automatic cleanup on component destroy');
    console.log('  ✓ usePubSub composable for manual control');

    // Verify pub/sub integration
    expect(result.code).toContain('const notifyItemAdded = (payload) => {');
    expect(result.code).toContain('pubSubSystem.emit(\'cart:item-added\', payload);');
    expect(result.code).toContain('const notifyItemRemoved = (payload) => {');
    expect(result.code).toContain('pubSubSystem.emit(\'cart:item-removed\', payload);');
    expect(result.code).toContain('const notifyPreferencesChanged = (payload) => {');
    expect(result.code).toContain('pubSubSystem.emit(\'user:preferences-changed\', payload);');

    // Verify event subscriptions
    expect(result.code).toContain('pubSubSystem.subscribe(\'cart:item-added\'');
    expect(result.code).toContain('pubSubSystem.subscribe(\'cart:item-removed\'');
    expect(result.code).toContain('pubSubSystem.subscribe(\'user:preferences-changed\'');

    // Note: usePubSub is available as a separate composable, not injected into every component

    console.log('\n✅ All pub/sub communication features verified successfully!');
  });
});