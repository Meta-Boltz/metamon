<script>
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { signals, pubsub } from '../shared/state.js';

  let users = writable([]);
  let newUserName = '';
  let userIdCounter = 1;
  let userCount = signals.userCount.value;

  let unsubscribeUserCount;
  let unsubscribeUserAction;
  let unsubscribeCounter;

  onMount(() => {
    // Subscribe to user count changes
    unsubscribeUserCount = signals.userCount.subscribe((newCount) => {
      userCount = newCount;
    });

    // Subscribe to user actions from other frameworks
    unsubscribeUserAction = pubsub.subscribe('user-action', (data) => {
      if (data.framework !== 'Svelte') {
        console.log(`Received action from ${data.framework}:`, data.action);
      }
    });

    // Subscribe to counter updates to sync user count
    unsubscribeCounter = pubsub.subscribe('counter-updated', (data) => {
      // Sync local user list with global counter when possible
      users.update(currentUsers => {
        const diff = userCount - currentUsers.length;
        if (diff > 0) {
          // Add placeholder users
          const newUsers = [...currentUsers];
          for (let i = 0; i < diff; i++) {
            newUsers.push({
              id: userIdCounter++,
              name: `User ${userIdCounter - 1}`,
              framework: data.framework || 'System',
              timestamp: Date.now()
            });
          }
          return newUsers;
        }
        return currentUsers;
      });
    });
  });

  onDestroy(() => {
    if (unsubscribeUserCount) unsubscribeUserCount();
    if (unsubscribeUserAction) unsubscribeUserAction();
    if (unsubscribeCounter) unsubscribeCounter();
  });

  function addUser() {
    if (!newUserName.trim()) return;
    
    const user = {
      id: userIdCounter++,
      name: newUserName.trim(),
      framework: 'Svelte',
      timestamp: Date.now()
    };
    
    users.update(currentUsers => [...currentUsers, user]);
    signals.userCount.update(userCount + 1);
    
    pubsub.emit('user-added', user);
    pubsub.emit('user-action', {
      action: 'add_user',
      framework: 'Svelte',
      data: { userName: user.name }
    });
    
    newUserName = '';
  }

  function removeUser(userId) {
    let removedUser;
    users.update(currentUsers => {
      removedUser = currentUsers.find(u => u.id === userId);
      return currentUsers.filter(u => u.id !== userId);
    });
    
    if (removedUser) {
      signals.userCount.update(Math.max(0, userCount - 1));
      
      pubsub.emit('user-removed', removedUser);
      pubsub.emit('user-action', {
        action: 'remove_user',
        framework: 'Svelte',
        data: { userName: removedUser.name }
      });
    }
  }

  function clearAllUsers() {
    users.set([]);
    signals.userCount.update(0);
    
    pubsub.emit('user-action', {
      action: 'clear_all_users',
      framework: 'Svelte'
    });
  }

  // Reactive statement to format time
  $: formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };
</script>

<div class="component-demo">
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
    <div class="counter">
      <span>Local Users:</span>
      <span class="counter-value">{$users.length}</span>
      <span style="font-size: 12px; color: #666;">
        (Svelte Store)
      </span>
    </div>
  </div>

  <div class="user-list">
    {#if $users.length === 0}
      <div style="text-align: center; color: #666; padding: 20px;">
        No users added yet. Add the first one!
      </div>
    {:else}
      {#each $users as user (user.id)}
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

  {#if $users.length > 0}
    <button on:click={clearAllUsers} class="button" style="margin-top: 10px; width: 100%;">
      Clear All Users
    </button>
  {/if}

  <div style="margin-top: 15px; font-size: 12px; color: #666; padding: 10px; background: #f9fafb; border-radius: 6px;">
    <strong>Svelte Integration:</strong><br/>
    This component demonstrates Svelte stores working alongside global signals.
    User additions update the global counter signal shared across all frameworks.
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