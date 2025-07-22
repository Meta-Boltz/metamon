<script>
  import { onMount, onDestroy } from 'svelte';
  import signal from '../shared/ultra-modern-signal.js';

  // Ultra-modern MTM: $userCount! = signal('userCount', 0)
  const userCountSignal = signal.signal('userCount', 0);
  let userCount = userCountSignal.value;

  // Ultra-modern MTM: $users! = []
  let users = [];

  // Ultra-modern MTM: $newUserName! = ''
  let newUserName = '';

  // Ultra-modern MTM: $userIdCounter! = 1
  let userIdCounter = 1;

  // Subscribe to user count changes
  let unsubscribeUserCount;
  onMount(() => {
    unsubscribeUserCount = userCountSignal.subscribe((newCount) => {
      userCount = newCount;
    });
  });

  onDestroy(() => {
    if (unsubscribeUserCount) {
      unsubscribeUserCount();
    }
  });

  // Subscribe to user actions from other frameworks
  const unsubscribeUserAction = signal.on('user-action', (data) => {
    if (data.framework !== 'Svelte') {
      console.log(`Received action from ${data.framework}:`, data.action);
    }
  });

  // Subscribe to counter updates to sync user count
  const unsubscribeCounter = signal.on('counter-updated', (data) => {
    // Sync local user list with global counter when possible
    const diff = userCount - users.length;
    if (diff > 0) {
      // Add placeholder users
      const newUsers = [...users];
      for (let i = 0; i < diff; i++) {
        newUsers.push({
          id: userIdCounter++,
          name: `User ${userIdCounter - 1}`,
          framework: data.framework || 'System',
          timestamp: Date.now()
        });
      }
      users = newUsers;
    }
  });

  // Ultra-modern MTM: $addUser = () => { ... }
  const addUser = () => {
    if (!newUserName.trim()) return;
    
    const user = {
      id: userIdCounter++,
      name: newUserName.trim(),
      framework: 'Svelte',
      timestamp: Date.now()
    };
    
    users = [...users, user];
    userCountSignal.value = userCountSignal.value + 1;
    
    signal.emit('user-added', user);
    signal.emit('user-action', {
      action: 'add_user',
      framework: 'Svelte',
      data: { userName: user.name }
    });
    
    newUserName = '';
  };

  // Ultra-modern MTM: $removeUser = ($userId: number) => { ... }
  const removeUser = (userId) => {
    const removedUser = users.find(u => u.id === userId);
    users = users.filter(u => u.id !== userId);
    
    if (removedUser) {
      userCountSignal.value = Math.max(0, userCountSignal.value - 1);
      
      signal.emit('user-removed', removedUser);
      signal.emit('user-action', {
        action: 'remove_user',
        framework: 'Svelte',
        data: { userName: removedUser.name }
      });
    }
  };

  // Ultra-modern MTM: $clearAllUsers = () => { ... }
  const clearAllUsers = () => {
    users = [];
    userCountSignal.value = 0;
    
    signal.emit('user-action', {
      action: 'clear_all_users',
      framework: 'Svelte'
    });
  };

  // Ultra-modern MTM: $formatTime = ($timestamp: number) => { ... }
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  onDestroy(() => {
    unsubscribeUserAction();
    unsubscribeCounter();
  });
</script>

<div class="component-demo">
  <h3>🚀 Ultra-Modern MTM User List (Svelte)</h3>
  
  <div class="user-input">
    <input 
      bind:value={newUserName}
      on:keyup={(e) => e.key === 'Enter' && addUser()}
      class="input" 
      placeholder="Enter user name..."
    />
    <button on:click={addUser} class="button" disabled={!newUserName.trim()}>
      Add User
    </button>
  </div>

  <div class="user-stats">
    <div class="counter">
      <span>Total Users:</span>
      <span class="counter-value">{userCount}</span>
      <span style="font-size: 12px; color: #666;">
        (Global Signal)
      </span>
    </div>
    <div class="user-stats">
      <span>Local Users:</span>
      <span class="counter-value">{users.length}</span>
      <span style="font-size: 12px; color: #666;">
        (Svelte Store)
      </span>
    </div>
  </div>

  <div class="user-list">
    {#if users.length === 0}
      <div style="text-align: center; color: #666; padding: 20px;">
        No users added yet. Add the first one!
      </div>
    {:else}
      {#each users as user (user.id)}
        <div class="user-item">
          <div class="user-info">
            <strong>{user.name}</strong>
            <div style="font-size: 11px; color: #666;">
              Added via {user.framework} at {formatTime(user.timestamp)}
            </div>
          </div>
          <button 
            on:click={() => removeUser(user.id)}
            class="button secondary"
            style="padding: 4px 8px; font-size: 12px;"
          >
            Remove
          </button>
        </div>
      {/each}
    {/if}
  </div>

  {#if users.length > 0}
    <button on:click={clearAllUsers} class="button" style="margin-top: 10px; width: 100%;">
      Clear All Users
    </button>
  {/if}

  <div style="margin-top: 15px; font-size: 12px; color: #666; padding: 10px; background: #f0f8ff; border-radius: 6px;">
    <strong>🎯 Ultra-Modern MTM Features:</strong><br/>
    ✅ No frontmatter - framework detected from filename<br/>
    ✅ Unified signal system - single system for everything<br/>
    ✅ Clean template syntax - Svelte-like binding<br/>
    ✅ Reactive variables with $ prefix and ! suffix
  </div>
</div>

<style>
  .user-input {
    display: flex;
    gap: 8px;
    margin-bottom: 15px;
  }

  .user-input input {
    flex: 1;
  }

  .user-stats {
    display: flex;
    justify-content: space-between;
    margin-bottom: 15px;
    padding: 10px;
    background: #f9fafb;
    border-radius: 6px;
  }

  .user-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .user-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .user-item:last-child {
    border-bottom: none;
  }

  .user-info {
    flex: 1;
  }
</style>