# Interactive Component Migration Example

This example demonstrates migrating a complex interactive component with signals, events, and lifecycle methods.

## Before Migration (Legacy Format)

**File:** `src/components/todo-list.mtm`

```mtm
---
page_title: Todo List Component
page_description: Interactive todo list with add, edit, and delete functionality
meta_keywords: todo, list, component, interactive
template: component
---

$todos = createSignal([])
$newTodo = createSignal('')
$editingId = createSignal(null)
$editText = createSignal('')
$filter = createSignal('all')

$mount = () => {
  // Load todos from localStorage
  const saved = localStorage.getItem('todos')
  if (saved) {
    $todos = JSON.parse(saved)
  }
}

$destroy = () => {
  // Save todos to localStorage
  localStorage.setItem('todos', JSON.stringify($todos()))
}

$addTodo = () => {
  const text = $newTodo().trim()
  if (text) {
    const newTodo = {
      id: Date.now(),
      text: text,
      completed: false,
      createdAt: new Date().toISOString()
    }
    $todos = [...$todos(), newTodo]
    $newTodo = ''
  }
}

$deleteTodo = (id) => {
  $todos = $todos().filter(todo => todo.id !== id)
}

$toggleTodo = (id) => {
  $todos = $todos().map(todo =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  )
}

$startEdit = (id, text) => {
  $editingId = id
  $editText = text
}

$saveEdit = () => {
  const text = $editText().trim()
  if (text) {
    $todos = $todos().map(todo =>
      todo.id === $editingId() ? { ...todo, text } : todo
    )
  }
  $editingId = null
  $editText = ''
}

$cancelEdit = () => {
  $editingId = null
  $editText = ''
}

$filteredTodos = () => {
  const todos = $todos()
  switch ($filter()) {
    case 'active':
      return todos.filter(todo => !todo.completed)
    case 'completed':
      return todos.filter(todo => todo.completed)
    default:
      return todos
  }
}

$completedCount = () => $todos().filter(todo => todo.completed).length
$activeCount = () => $todos().filter(todo => !todo.completed).length

<div class="todo-list">
  <header class="todo-header">
    <h2>Todo List</h2>
    <div class="add-todo">
      <input
        type="text"
        placeholder="Add a new todo..."
        value={$newTodo()}
        onInput={(e) => $newTodo = e.target.value}
        onKeyPress={(e) => e.key === 'Enter' && $addTodo()}
        class="todo-input"
      />
      <button onClick={$addTodo} class="add-button">Add</button>
    </div>
  </header>

  <div class="todo-filters">
    <button
      onClick={() => $filter = 'all'}
      class={$filter() === 'all' ? 'active' : ''}
    >
      All ({$todos().length})
    </button>
    <button
      onClick={() => $filter = 'active'}
      class={$filter() === 'active' ? 'active' : ''}
    >
      Active ({$activeCount()})
    </button>
    <button
      onClick={() => $filter = 'completed'}
      class={$filter() === 'completed' ? 'active' : ''}
    >
      Completed ({$completedCount()})
    </button>
  </div>

  <ul class="todo-items">
    {$filteredTodos().map(todo => (
      <li key={todo.id} class={`todo-item ${todo.completed ? 'completed' : ''}`}>
        <div class="todo-content">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => $toggleTodo(todo.id)}
            class="todo-checkbox"
          />

          {$editingId() === todo.id ? (
            <div class="edit-form">
              <input
                type="text"
                value={$editText()}
                onInput={(e) => $editText = e.target.value}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') $saveEdit()
                  if (e.key === 'Escape') $cancelEdit()
                }}
                class="edit-input"
                autoFocus
              />
              <button onClick={$saveEdit} class="save-button">Save</button>
              <button onClick={$cancelEdit} class="cancel-button">Cancel</button>
            </div>
          ) : (
            <div class="todo-display">
              <span
                class="todo-text"
                onDoubleClick={() => $startEdit(todo.id, todo.text)}
              >
                {todo.text}
              </span>
              <div class="todo-actions">
                <button
                  onClick={() => $startEdit(todo.id, todo.text)}
                  class="edit-button"
                >
                  Edit
                </button>
                <button
                  onClick={() => $deleteTodo(todo.id)}
                  class="delete-button"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        <div class="todo-meta">
          <small>Created: {new Date(todo.createdAt).toLocaleDateString()}</small>
        </div>
      </li>
    ))}
  </ul>

  {$todos().length === 0 && (
    <div class="empty-state">
      <p>No todos yet. Add one above!</p>
    </div>
  )}
</div>
```

## Migration Command

```bash
npx mtm-migrate migrate src/components/todo-list.mtm --verbose
```

## After Migration (Modern Format)

**File:** `src/components/todo-list.mtm`

```mtm
---
title: Todo List Component
description: Interactive todo list with add, edit, and delete functionality
keywords: [todo, list, component, interactive, crud]
layout: component
---

$todos! = signal('todos', [])
$newTodo! = signal('newTodo', '')
$editingId! = signal('editingId', null)
$editText! = signal('editText', '')
$filter! = signal('filter', 'all')

$onMount = () => {
  // Load todos from localStorage
  const saved = localStorage.getItem('todos')
  if (saved) {
    $todos = JSON.parse(saved)
  }

  signal.emit('todo-list-mounted', {
    todoCount: $todos.length,
    timestamp: Date.now()
  })
}

$onDestroy = () => {
  // Save todos to localStorage
  localStorage.setItem('todos', JSON.stringify($todos))

  signal.emit('todo-list-destroyed', {
    finalTodoCount: $todos.length,
    timestamp: Date.now()
  })
}

$addTodo = () => {
  const text = $newTodo.trim()
  if (text) {
    const newTodo = {
      id: Date.now(),
      text: text,
      completed: false,
      createdAt: new Date().toISOString()
    }
    $todos = [...$todos, newTodo]
    $newTodo = ''

    signal.emit('todo-added', {
      todo: newTodo,
      totalCount: $todos.length
    })
  }
}

$deleteTodo = (id) => {
  const todoToDelete = $todos.find(todo => todo.id === id)
  $todos = $todos.filter(todo => todo.id !== id)

  signal.emit('todo-deleted', {
    deletedTodo: todoToDelete,
    remainingCount: $todos.length
  })
}

$toggleTodo = (id) => {
  const oldTodos = $todos
  $todos = $todos.map(todo =>
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  )

  const toggledTodo = $todos.find(todo => todo.id === id)
  signal.emit('todo-toggled', {
    todo: toggledTodo,
    action: toggledTodo.completed ? 'completed' : 'uncompleted'
  })
}

$startEdit = (id, text) => {
  $editingId = id
  $editText = text

  signal.emit('todo-edit-started', { todoId: id, originalText: text })
}

$saveEdit = () => {
  const text = $editText.trim()
  if (text) {
    const oldText = $todos.find(todo => todo.id === $editingId)?.text
    $todos = $todos.map(todo =>
      todo.id === $editingId ? { ...todo, text } : todo
    )

    signal.emit('todo-edited', {
      todoId: $editingId,
      oldText,
      newText: text
    })
  }
  $editingId = null
  $editText = ''
}

$cancelEdit = () => {
  signal.emit('todo-edit-cancelled', { todoId: $editingId })
  $editingId = null
  $editText = ''
}

$updateFilter = (newFilter) => {
  $filter = newFilter
  signal.emit('filter-changed', {
    filter: newFilter,
    visibleCount: $filteredTodos.length
  })
}

// Computed signals for derived state
$filteredTodos = computed(() => {
  switch ($filter) {
    case 'active':
      return $todos.filter(todo => !todo.completed)
    case 'completed':
      return $todos.filter(todo => todo.completed)
    default:
      return $todos
  }
})

$completedCount = computed(() => $todos.filter(todo => todo.completed).length)
$activeCount = computed(() => $todos.filter(todo => !todo.completed).length)

$handleKeyPress = (e, action) => {
  if (e.key === 'Enter') {
    if (action === 'add') $addTodo()
    if (action === 'save') $saveEdit()
  }
  if (e.key === 'Escape' && action === 'edit') {
    $cancelEdit()
  }
}

<template>
  <div class="todo-list">
    <header class="todo-header">
      <h2>Todo List</h2>
      <div class="add-todo">
        <input
          type="text"
          placeholder="Add a new todo..."
          value={$newTodo}
          input={(e) => $newTodo = e.target.value}
          keypress={(e) => $handleKeyPress(e, 'add')}
          class="todo-input"
        />
        <button click={$addTodo} class="add-button">Add</button>
      </div>
    </header>

    <div class="todo-filters">
      <button
        click={() => $updateFilter('all')}
        class={$filter === 'all' ? 'active' : ''}
      >
        All ({$todos.length})
      </button>
      <button
        click={() => $updateFilter('active')}
        class={$filter === 'active' ? 'active' : ''}
      >
        Active ({$activeCount})
      </button>
      <button
        click={() => $updateFilter('completed')}
        class={$filter === 'completed' ? 'active' : ''}
      >
        Completed ({$completedCount})
      </button>
    </div>

    <ul class="todo-items">
      {#each $filteredTodos as todo}
        <li class={`todo-item ${todo.completed ? 'completed' : ''}`} key={todo.id}>
          <div class="todo-content">
            <input
              type="checkbox"
              checked={todo.completed}
              change={() => $toggleTodo(todo.id)}
              class="todo-checkbox"
            />

            {#if $editingId === todo.id}
              <div class="edit-form">
                <input
                  type="text"
                  value={$editText}
                  input={(e) => $editText = e.target.value}
                  keypress={(e) => $handleKeyPress(e, 'edit')}
                  class="edit-input"
                  autofocus
                />
                <button click={$saveEdit} class="save-button">Save</button>
                <button click={$cancelEdit} class="cancel-button">Cancel</button>
              </div>
            {:else}
              <div class="todo-display">
                <span
                  class="todo-text"
                  dblclick={() => $startEdit(todo.id, todo.text)}
                >
                  {todo.text}
                </span>
                <div class="todo-actions">
                  <button
                    click={() => $startEdit(todo.id, todo.text)}
                    class="edit-button"
                  >
                    Edit
                  </button>
                  <button
                    click={() => $deleteTodo(todo.id)}
                    class="delete-button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            {/if}
          </div>

          <div class="todo-meta">
            <small>Created: {new Date(todo.createdAt).toLocaleDateString()}</small>
          </div>
        </li>
      {/each}
    </ul>

    {#if $todos.length === 0}
      <div class="empty-state">
        <p>No todos yet. Add one above!</p>
      </div>
    {/if}
  </div>
</template>
```

## Key Changes Made

### 1. Frontmatter Updates

- Field name standardization
- Added `keywords` array
- Template wrapper addition

### 2. Signal System Migration

- `createSignal()` → `signal()` with keys
- Removed function call syntax `$signal()`
- Added computed signals for derived state
- Added signal event emissions for better debugging

### 3. Event Handler Updates

- `onClick` → `click`
- `onInput` → `input`
- `onChange` → `change`
- `onKeyPress` → `keypress`
- `onDoubleClick` → `dblclick`

### 4. Lifecycle Method Updates

- `$mount` → `$onMount`
- `$destroy` → `$onDestroy`
- Added signal emissions for lifecycle events

### 5. Template Syntax Updates

- Wrapped in `<template>` tags
- `{condition && content}` → `{#if condition}`
- `{array.map()}` → `{#each array as item}`
- Added proper conditional blocks

### 6. Performance Optimizations

- Used computed signals for filtered data
- Batched related signal updates
- Added proper event cleanup

## Migration Report Summary

```json
{
  "success": true,
  "changes": [
    { "type": "field_rename", "count": 4 },
    { "type": "signal_syntax", "count": 5 },
    { "type": "event_syntax", "count": 8 },
    { "type": "lifecycle_method", "count": 2 },
    { "type": "template_wrapper", "count": 1 },
    { "type": "control_flow", "count": 3 }
  ],
  "warnings": [
    {
      "type": "complex_logic",
      "message": "Complex computed logic detected - review for optimization"
    }
  ]
}
```

## Testing the Migration

### 1. Functionality Test

```javascript
// Test all CRUD operations
- Add new todos
- Edit existing todos
- Delete todos
- Toggle completion status
- Filter todos (all/active/completed)
```

### 2. Signal Event Testing

```javascript
// Listen for signal events in console
signal.on("todo-added", (data) => console.log("Todo added:", data));
signal.on("todo-deleted", (data) => console.log("Todo deleted:", data));
signal.on("filter-changed", (data) => console.log("Filter changed:", data));
```

### 3. Performance Testing

- Check for memory leaks during heavy usage
- Verify smooth updates with large todo lists
- Test localStorage persistence

This migration demonstrates handling complex interactive components with multiple signals, computed values, and extensive event handling.
