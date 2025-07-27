// MTM TodoList Component - Compiled from MTMTodoList.mtm
// This simulates what the MTM compiler would generate

(function () {
  'use strict';

  console.log('[MTM] Loading TodoList component script');

  // MTM TodoList reactive logic
  let todos = [
    { id: 1, text: 'Learn MTM Framework', completed: true },
    { id: 2, text: 'Build reactive components', completed: false },
    { id: 3, text: 'Test multi-framework integration', completed: false }
  ];
  let nextId = 4;

  // Component methods
  function addTodo() {
    const input = document.querySelector('[data-mtm-component="/src/components/MTMTodoList.mtm"] .todo-input');
    if (input && input.value.trim()) {
      todos.push({
        id: nextId++,
        text: input.value.trim(),
        completed: false
      });
      input.value = '';
      updateDisplay();
    }
  }

  function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      updateDisplay();
    }
  }

  function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    updateDisplay();
  }

  function clearCompleted() {
    todos = todos.filter(t => !t.completed);
    updateDisplay();
  }

  function updateDisplay() {
    const containers = document.querySelectorAll('[data-mtm-component="/src/components/MTMTodoList.mtm"]');

    containers.forEach(container => {
      const listElement = container.querySelector('.mtm-todo-list');
      const counterElement = container.querySelector('.todo-counter');

      if (listElement) {
        const completedCount = todos.filter(t => t.completed).length;
        const todoItems = todos.map(todo => `
          <li class="mtm-todo-item ${todo.completed ? 'completed' : ''}">
            <span class="todo-text">${todo.text}</span>
            <div class="todo-actions">
              <button onclick="window.mtmTodoToggle(${todo.id})" class="toggle-btn">
                ${todo.completed ? '↶' : '✓'}
              </button>
              <button onclick="window.mtmTodoDelete(${todo.id})" class="delete-btn">×</button>
            </div>
          </li>
        `).join('');

        listElement.innerHTML = todoItems || '<li class="empty-state"><p>No todos yet. Add one above!</p></li>';
      }

      if (counterElement) {
        const completedCount = todos.filter(t => t.completed).length;
        counterElement.textContent = `${completedCount}/${todos.length} completed`;
      }
    });
  }

  // Global functions for onclick handlers
  window.mtmTodoAdd = addTodo;
  window.mtmTodoToggle = toggleTodo;
  window.mtmTodoDelete = deleteTodo;
  window.mtmTodoClearCompleted = clearCompleted;

  // Initialize component
  function init() {
    // Attach event listeners
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-mtm-component="/src/components/MTMTodoList.mtm"] .add-btn')) {
        addTodo();
      }
      if (e.target.matches('[data-mtm-component="/src/components/MTMTodoList.mtm"] .clear-btn')) {
        clearCompleted();
      }
    });

    document.addEventListener('keypress', (e) => {
      if (e.target.matches('[data-mtm-component="/src/components/MTMTodoList.mtm"] .todo-input') && e.key === 'Enter') {
        addTodo();
      }
    });

    updateDisplay();
  }

  // Auto-initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  console.log('[MTM] TodoList component script loaded');
})();