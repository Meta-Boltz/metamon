import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SolidAdapter } from './solid-adapter.js';
import type { MTMFile } from '@metamon/core';

describe('Solid Adapter Demo', () => {
  let adapter: SolidAdapter;

  beforeEach(() => {
    adapter = new SolidAdapter();
  });

  describe('Real-world component examples', () => {
    it('should compile a todo list component with cross-framework state', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid',
          channels: [
            { event: 'todo:add', emit: 'addTodo' },
            { event: 'todo:remove', emit: 'removeTodo' },
            { event: 'todo:toggle', emit: 'toggleTodo' }
          ]
        },
        content: `import { createSignal, For, Show } from 'solid-js';

export default function TodoList() {
  // Use Metamon signal for cross-framework state sharing
  const [todos, setTodos] = useMetamonSignal('todos', []);
  const [newTodo, setNewTodo] = createSignal('');

  const addNewTodo = () => {
    if (newTodo().trim()) {
      const todo = {
        id: Date.now(),
        text: newTodo().trim(),
        completed: false
      };
      setTodos([...todos(), todo]);
      setNewTodo('');
      addTodo(todo); // Emit event to other frameworks
    }
  };

  const handleToggle = (id) => {
    const updated = todos().map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updated);
    toggleTodo({ id, completed: !todos().find(t => t.id === id).completed });
  };

  const handleRemove = (id) => {
    setTodos(todos().filter(todo => todo.id !== id));
    removeTodo({ id });
  };

  return (
    <div class="todo-app">
      <h1>Todo List (Solid)</h1>
      
      <div class="add-todo">
        <input
          type="text"
          value={newTodo()}
          onInput={(e) => setNewTodo(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addNewTodo()}
          placeholder="Add a new todo..."
        />
        <button onClick={addNewTodo}>Add</button>
      </div>

      <Show when={todos().length > 0} fallback={<p>No todos yet!</p>}>
        <ul class="todo-list">
          <For each={todos()}>
            {(todo) => (
              <li class={todo.completed ? 'completed' : ''}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggle(todo.id)}
                />
                <span>{todo.text}</span>
                <button onClick={() => handleRemove(todo.id)}>Remove</button>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <div class="stats">
        <p>Total: {todos().length}</p>
        <p>Completed: {todos().filter(t => t.completed).length}</p>
        <p>Remaining: {todos().filter(t => !t.completed).length}</p>
      </div>
    </div>
  );
}`,
        filePath: '/components/TodoList.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Verify the component compiles successfully
      expect(result.code).toBeDefined();
      expect(result.exports).toEqual(['default']);

      // Check that Solid-specific features are preserved
      expect(result.code).toContain('For each={todos()}');
      expect(result.code).toContain('Show when={todos().length > 0}');
      expect(result.code).toContain('createSignal');

      // Check that Metamon integration is included
      expect(result.code).toContain('useMetamonSignal');
      expect(result.code).toContain('addTodo');
      expect(result.code).toContain('removeTodo');
      expect(result.code).toContain('toggleTodo');

      // Check that pub/sub events are set up
      expect(result.code).toContain('todo:add');
      expect(result.code).toContain('todo:remove');
      expect(result.code).toContain('todo:toggle');

      // Verify imports are correct
      expect(result.code).toContain('import { createSignal, createEffect, onCleanup } from \'solid-js\';');
      expect(result.code).toContain('import { signalManager, pubSubSystem } from \'@metamon/core\';');
    });

    it('should compile a user profile component with optimized signals', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid',
          channels: [
            { event: 'user:update', emit: 'updateUser' },
            { event: 'avatar:change', emit: 'changeAvatar' }
          ]
        },
        content: `import { createSignal, createMemo, Show } from 'solid-js';

export default function UserProfile() {
  // Use native Solid signal integration for optimal performance
  const [user, setUser] = createMetamonSignal({
    name: '',
    email: '',
    avatar: '',
    bio: ''
  }, 'currentUser');

  const [editing, setEditing] = createSignal(false);
  const [tempUser, setTempUser] = createSignal(null);

  const isProfileComplete = createMemo(() => 
    user().name && user().email && user().bio
  );

  const startEditing = () => {
    setTempUser({ ...user() });
    setEditing(true);
  };

  const saveChanges = () => {
    setUser(tempUser());
    setEditing(false);
    updateUser(tempUser());
  };

  const cancelEditing = () => {
    setTempUser(null);
    setEditing(false);
  };

  const handleAvatarChange = (newAvatar) => {
    if (editing()) {
      setTempUser({ ...tempUser(), avatar: newAvatar });
    } else {
      setUser({ ...user(), avatar: newAvatar });
      changeAvatar({ avatar: newAvatar });
    }
  };

  return (
    <div class="user-profile">
      <div class="profile-header">
        <div class="avatar">
          <Show when={user().avatar} fallback={<div class="avatar-placeholder">No Avatar</div>}>
            <img src={user().avatar} alt="User Avatar" />
          </Show>
          <button onClick={() => handleAvatarChange('new-avatar-url')}>
            Change Avatar
          </button>
        </div>
        
        <div class="profile-info">
          <Show when={!editing()} fallback={
            <div class="edit-form">
              <input
                value={tempUser()?.name || ''}
                onInput={(e) => setTempUser({ ...tempUser(), name: e.target.value })}
                placeholder="Name"
              />
              <input
                value={tempUser()?.email || ''}
                onInput={(e) => setTempUser({ ...tempUser(), email: e.target.value })}
                placeholder="Email"
              />
              <textarea
                value={tempUser()?.bio || ''}
                onInput={(e) => setTempUser({ ...tempUser(), bio: e.target.value })}
                placeholder="Bio"
              />
              <div class="edit-actions">
                <button onClick={saveChanges}>Save</button>
                <button onClick={cancelEditing}>Cancel</button>
              </div>
            </div>
          }>
            <h1>{user().name || 'Anonymous User'}</h1>
            <p class="email">{user().email}</p>
            <p class="bio">{user().bio}</p>
            <button onClick={startEditing}>Edit Profile</button>
          </Show>
        </div>
      </div>

      <div class="profile-status">
        <Show when={isProfileComplete()} fallback={
          <div class="incomplete-warning">
            Please complete your profile
          </div>
        }>
          <div class="complete-badge">Profile Complete ✓</div>
        </Show>
      </div>
    </div>
  );
}`,
        filePath: '/components/UserProfile.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Verify compilation success
      expect(result.code).toBeDefined();
      expect(result.exports).toEqual(['default']);

      // Check Solid-specific features
      expect(result.code).toContain('createMemo');
      expect(result.code).toContain('Show when={user().avatar}');
      expect(result.code).toContain('Show when={!editing()}');
      expect(result.code).toContain('Show when={isProfileComplete()}');

      // Check optimized signal usage
      expect(result.code).toContain('createMetamonSignal');
      expect(result.code).toContain('currentUser');

      // Check event integration
      expect(result.code).toContain('updateUser');
      expect(result.code).toContain('changeAvatar');
      expect(result.code).toContain('user:update');
      expect(result.code).toContain('avatar:change');
    });

    it('should demonstrate cross-framework communication capabilities', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid',
          channels: [
            { event: 'cart:add', emit: 'addToCart' },
            { event: 'cart:remove', emit: 'removeFromCart' },
            { event: 'cart:clear', emit: 'clearCart' },
            { event: 'notification:show', emit: 'showNotification' }
          ]
        },
        content: `import { createSignal, createMemo, For, Show } from 'solid-js';

export default function ShoppingCart() {
  // Shared cart state across all frameworks
  const [cartItems, setCartItems] = useMetamonSignal('shoppingCart', []);
  const [isOpen, setIsOpen] = createSignal(false);

  const totalPrice = createMemo(() => 
    cartItems().reduce((sum, item) => sum + (item.price * item.quantity), 0)
  );

  const totalItems = createMemo(() => 
    cartItems().reduce((sum, item) => sum + item.quantity, 0)
  );

  const addItem = (product) => {
    const existing = cartItems().find(item => item.id === product.id);
    if (existing) {
      const updated = cartItems().map(item =>
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      setCartItems(updated);
    } else {
      setCartItems([...cartItems(), { ...product, quantity: 1 }]);
    }
    
    addToCart(product);
    showNotification({ 
      type: 'success', 
      message: \`Added \${product.name} to cart\` 
    });
  };

  const removeItem = (productId) => {
    const updated = cartItems().filter(item => item.id !== productId);
    setCartItems(updated);
    removeFromCart({ id: productId });
    showNotification({ 
      type: 'info', 
      message: 'Item removed from cart' 
    });
  };

  const clearAllItems = () => {
    setCartItems([]);
    clearCart();
    showNotification({ 
      type: 'info', 
      message: 'Cart cleared' 
    });
  };

  return (
    <div class="shopping-cart">
      <button 
        class="cart-toggle"
        onClick={() => setIsOpen(!isOpen())}
      >
        🛒 Cart ({totalItems()})
      </button>

      <Show when={isOpen()}>
        <div class="cart-dropdown">
          <div class="cart-header">
            <h3>Shopping Cart</h3>
            <button onClick={() => setIsOpen(false)}>×</button>
          </div>

          <Show when={cartItems().length > 0} fallback={
            <div class="empty-cart">
              <p>Your cart is empty</p>
            </div>
          }>
            <div class="cart-items">
              <For each={cartItems()}>
                {(item) => (
                  <div class="cart-item">
                    <img src={item.image} alt={item.name} />
                    <div class="item-details">
                      <h4>{item.name}</h4>
                      <p>\${item.price} × {item.quantity}</p>
                    </div>
                    <button 
                      class="remove-btn"
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </For>
            </div>

            <div class="cart-footer">
              <div class="total">
                <strong>Total: \${totalPrice().toFixed(2)}</strong>
              </div>
              <div class="cart-actions">
                <button onClick={clearAllItems}>Clear Cart</button>
                <button class="checkout-btn">Checkout</button>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}`,
        filePath: '/components/ShoppingCart.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Verify successful compilation
      expect(result.code).toBeDefined();
      expect(result.exports).toEqual(['default']);

      // Check cross-framework state management
      expect(result.code).toContain('useMetamonSignal');
      expect(result.code).toContain('shoppingCart');

      // Check all event channels
      expect(result.code).toContain('addToCart');
      expect(result.code).toContain('removeFromCart');
      expect(result.code).toContain('clearCart');
      expect(result.code).toContain('showNotification');

      // Check Solid reactive features
      expect(result.code).toContain('createMemo');
      expect(result.code).toContain('totalPrice()');
      expect(result.code).toContain('totalItems()');

      // Check Solid control flow
      expect(result.code).toContain('For each={cartItems()}');
      expect(result.code).toContain('Show when={isOpen()}');
      expect(result.code).toContain('Show when={cartItems().length > 0}');
    });
  });
});