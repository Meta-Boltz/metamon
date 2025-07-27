// MTM example page - Demonstrates native MTM reactive components
// Note: This simulates MTM syntax until full MTM compiler is available

export default function MTMExamplePage() {
  // Simulate MTM reactive state
  setTimeout(() => {
    // MTM-style reactive state simulation
    let globalCounter = 0;
    let pageTheme = 'light';
    let componentStats = { counters: 3, todos: 1, themes: 1 };

    // Create MTM-style components using plain JavaScript
    function createMTMCounter(container, initialValue = 5) {
      let count = initialValue;

      function render() {
        container.innerHTML = `
          <div class="mtm-counter-component">
            <h4>Native MTM Counter</h4>
            <div class="counter-display">
              <button class="counter-btn" onclick="decrementCount()">-</button>
              <span class="counter-value">${count}</span>
              <button class="counter-btn" onclick="incrementCount()">+</button>
            </div>
            <div class="counter-controls">
              <button class="counter-reset" onclick="resetCount()">Reset</button>
            </div>
            <p class="counter-info">
              This simulates native MTM reactive component behavior
            </p>
          </div>
        `;
      }

      window.incrementCount = () => { count++; render(); };
      window.decrementCount = () => { count = Math.max(0, count - 1); render(); };
      window.resetCount = () => { count = initialValue; render(); };

      render();
    }

    function createMTMTodoList(container) {
      let todos = [
        { id: 1, text: 'Learn MTM Framework', completed: true },
        { id: 2, text: 'Build reactive components', completed: false },
        { id: 3, text: 'Test multi-framework integration', completed: false }
      ];
      let nextId = 4;

      function render() {
        const completedCount = todos.filter(t => t.completed).length;
        const todoItems = todos.map(todo => `
          <li class="mtm-todo-item ${todo.completed ? 'completed' : ''}">
            <span class="todo-text">${todo.text}</span>
            <div class="todo-actions">
              <button onclick="toggleTodo(${todo.id})" class="toggle-btn">
                ${todo.completed ? '↶' : '✓'}
              </button>
              <button onclick="deleteTodo(${todo.id})" class="delete-btn">×</button>
            </div>
          </li>
        `).join('');

        container.innerHTML = `
          <div class="mtm-todo-component">
            <h4>Native MTM Todo List</h4>
            <div class="todo-input-section">
              <input type="text" id="new-todo-input" placeholder="Add a new todo..." class="todo-input">
              <button onclick="addTodo()" class="add-btn">Add</button>
            </div>
            <div class="todo-stats">
              <span class="todo-counter">${completedCount}/${todos.length} completed</span>
              <button onclick="clearCompleted()" class="clear-btn">Clear Completed</button>
            </div>
            <ul class="mtm-todo-list">
              ${todoItems}
              ${todos.length === 0 ? '<li class="empty-state"><p>No todos yet. Add one above!</p></li>' : ''}
            </ul>
            <p class="component-info">
              This simulates native MTM reactive todo list behavior
            </p>
          </div>
        `;

        const input = document.getElementById('new-todo-input');
        if (input) {
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.addTodo();
          });
        }
      }

      window.addTodo = () => {
        const input = document.getElementById('new-todo-input');
        if (input && input.value.trim()) {
          todos.push({ id: nextId++, text: input.value.trim(), completed: false });
          render();
        }
      };

      window.toggleTodo = (id) => {
        const todo = todos.find(t => t.id === id);
        if (todo) { todo.completed = !todo.completed; render(); }
      };

      window.deleteTodo = (id) => {
        todos = todos.filter(t => t.id !== id);
        render();
      };

      window.clearCompleted = () => {
        todos = todos.filter(t => !t.completed);
        render();
      };

      render();
    }

    function createMTMThemeToggle(container) {
      let currentTheme = 'light';
      const themes = {
        light: { name: 'Light', icon: '☀️', colors: { background: '#ffffff', text: '#333333', accent: '#9b59b6' } },
        dark: { name: 'Dark', icon: '🌙', colors: { background: '#2c3e50', text: '#ecf0f1', accent: '#3498db' } },
        auto: { name: 'Auto', icon: '🔄', colors: { background: '#f8f9fa', text: '#333333', accent: '#9b59b6' } }
      };

      function render() {
        const theme = themes[currentTheme];
        container.innerHTML = `
          <div class="mtm-theme-component" style="background: ${theme.colors.background}; color: ${theme.colors.text}; border-color: ${theme.colors.accent};">
            <h4>Native MTM Theme Toggle</h4>
            <div class="theme-display">
              <span class="theme-icon">${theme.icon}</span>
              <span>Current theme: <strong>${theme.name}</strong></span>
            </div>
            <div class="theme-controls">
              <button onclick="toggleTheme()" class="theme-toggle-btn">Toggle Theme</button>
            </div>
            <div class="theme-options">
              <button onclick="setTheme('light')" class="theme-option-btn">☀️ Light</button>
              <button onclick="setTheme('dark')" class="theme-option-btn">🌙 Dark</button>
              <button onclick="setTheme('auto')" class="theme-option-btn">🔄 Auto</button>
            </div>
            <div class="theme-preview">
              <div class="preview-box" style="background: ${theme.colors.background}; color: ${theme.colors.text}; border: 2px solid ${theme.colors.accent};">
                <p>Theme Preview</p>
                <small>Background: ${theme.colors.background}</small><br>
                <small>Text: ${theme.colors.text}</small><br>
                <small>Accent: ${theme.colors.accent}</small>
              </div>
            </div>
            <p class="component-info">
              This simulates native MTM theme toggle behavior
            </p>
          </div>
        `;
      }

      window.toggleTheme = () => {
        const themeKeys = Object.keys(themes);
        const currentIndex = themeKeys.indexOf(currentTheme);
        currentTheme = themeKeys[(currentIndex + 1) % themeKeys.length];
        render();
        pageTheme = currentTheme;
        updateGlobalDisplay();
      };

      window.setTheme = (theme) => {
        if (themes[theme]) {
          currentTheme = theme;
          render();
          pageTheme = currentTheme;
          updateGlobalDisplay();
        }
      };

      render();
    }

    function updateGlobalDisplay() {
      const globalCountElement = document.getElementById('global-count');
      const pageThemeElement = document.getElementById('page-theme');
      const componentCountElement = document.getElementById('component-count');

      if (globalCountElement) globalCountElement.textContent = globalCounter;
      if (pageThemeElement) pageThemeElement.textContent = pageTheme;
      if (componentCountElement) componentCountElement.textContent = componentStats.counters + componentStats.todos + componentStats.themes;
    }

    // Initialize components
    const counterContainer = document.getElementById('mtm-counter-container');
    const todoContainer = document.getElementById('mtm-todo-container');
    const themeContainer = document.getElementById('mtm-theme-container');

    if (counterContainer) createMTMCounter(counterContainer, 5);
    if (todoContainer) createMTMTodoList(todoContainer);
    if (themeContainer) createMTMThemeToggle(themeContainer);

    // Global state functions
    window.incrementGlobalCounter = function () {
      globalCounter++;
      updateGlobalDisplay();
    };

    window.resetGlobalCounter = function () {
      globalCounter = 0;
      updateGlobalDisplay();
    };

    // Initial display update
    updateGlobalDisplay();
  }, 50);

  return `
    <div class="mtm-example-page">
      <header class="page-header">
        <div class="breadcrumb">
          <a href="/" class="breadcrumb-link">Home</a>
          <span class="breadcrumb-separator">→</span>
          <span class="breadcrumb-current">MTM Example</span>
        </div>
        
        <h1>Native MTM Components</h1>
        <p class="page-description">This page demonstrates native MTM reactive components with built-in state management</p>
        
        <div class="page-metadata">
          <div class="metadata-item">
            <strong>Route:</strong> /mtm-example
          </div>
          <div class="metadata-item">
            <strong>Compile Mode:</strong> inline
          </div>
          <div class="metadata-item">
            <strong>Components:</strong> <span id="component-count">5</span>
          </div>
        </div>
      </header>
      
      <nav class="framework-nav">
        <a href="/react-example" class="framework-link react">React Example</a>
        <a href="/vue-example" class="framework-link vue">Vue Example</a>
        <a href="/solid-example" class="framework-link solid">Solid Example</a>
        <a href="/svelte-example" class="framework-link svelte">Svelte Example</a>
        <a href="/about" class="framework-link about">About</a>
      </nav>
      
      <main class="main-content">
        <section class="component-demo">
          <h2>Native MTM Components</h2>
          <p>The following components are built using pure MTM syntax with native reactivity:</p>
          
          <div class="component-grid">
            <div class="component-container">
              <div id="mtm-counter-container">
                <!-- MTM Counter will be rendered here -->
              </div>
            </div>
            
            <div class="component-container">
              <div id="mtm-todo-container">
                <!-- MTM Todo List will be rendered here -->
              </div>
            </div>
            
            <div class="component-container">
              <div id="mtm-theme-container">
                <!-- MTM Theme Toggle will be rendered here -->
              </div>
            </div>
          </div>
        </section>
        
        <section class="global-state-demo">
          <h2>Global State Management</h2>
          <div class="state-demo-card">
            <h3>MTM Global State</h3>
            <div class="state-display">
              <p>Global Counter: <strong id="global-count">0</strong></p>
              <p>Current Theme: <strong id="page-theme">light</strong></p>
              <div class="state-controls">
                <button onclick="incrementGlobalCounter()" class="demo-button">
                  Increment Global
                </button>
                <button onclick="resetGlobalCounter()" class="demo-button secondary">
                  Reset Global
                </button>
              </div>
            </div>
            <p class="state-info">
              This demonstrates MTM's built-in global state management with reactive updates
            </p>
          </div>
        </section>
        
        <section class="code-example">
          <h2>MTM Component Code Example</h2>
          <pre><code>---
title: "MTM Counter Component"
compileJsMode: "inline"
---

// MTM Counter Component - Pure MTM reactive syntax
$count! = signal('count', 0)

$increment = () => {
  $count++
}

$decrement = () => {
  $count = Math.max(0, $count - 1)
}

&lt;template&gt;
  &lt;div class="mtm-counter"&gt;
    &lt;button onclick={$decrement}&gt;-&lt;/button&gt;
    &lt;span&gt;{$count}&lt;/span&gt;
    &lt;button onclick={$increment}&gt;+&lt;/button&gt;
  &lt;/div&gt;
&lt;/template&gt;</code></pre>
        </section>
        
        <section class="features-section">
          <h2>Native MTM Features</h2>
          <div class="features-grid">
            <div class="feature-card">
              <h4>🎯 Pure MTM Syntax</h4>
              <p>No external dependencies, just clean MTM code with frontmatter configuration</p>
            </div>
            <div class="feature-card">
              <h4>⚡ Built-in Reactivity</h4>
              <p>Native reactive state management with signals and computed values</p>
            </div>
            <div class="feature-card">
              <h4>🔄 Global State</h4>
              <p>Simple global state management with automatic reactive updates</p>
            </div>
            <div class="feature-card">
              <h4>📦 Lightweight</h4>
              <p>Minimal overhead with maximum performance and clean syntax</p>
            </div>
            <div class="feature-card">
              <h4>🎨 Scoped Styles</h4>
              <p>Component-scoped CSS with automatic style encapsulation</p>
            </div>
            <div class="feature-card">
              <h4>🔗 Component Import</h4>
              <p>Import other MTM components using standard ES6 import syntax</p>
            </div>
          </div>
        </section>
        
        <section class="mtm-syntax-demo">
          <h2>MTM Syntax Features</h2>
          <div class="syntax-examples">
            <div class="syntax-card">
              <h4>Reactive Signals</h4>
              <code>$count! = signal('count', 0)</code>
              <p>Create reactive state with automatic updates</p>
            </div>
            
            <div class="syntax-card">
              <h4>Computed Values</h4>
              <code>$doubled! = computed(() => $count * 2)</code>
              <p>Derived state that updates automatically</p>
            </div>
            
            <div class="syntax-card">
              <h4>Event Handlers</h4>
              <code>&lt;button onclick={$increment}&gt;+&lt;/button&gt;</code>
              <p>Direct function binding with MTM syntax</p>
            </div>
            
            <div class="syntax-card">
              <h4>Conditional Rendering</h4>
              <code>{#if $count > 0} ... {/if}</code>
              <p>Show/hide content based on state</p>
            </div>
            
            <div class="syntax-card">
              <h4>List Rendering</h4>
              <code>{#each $items as item} ... {/each}</code>
              <p>Render lists with automatic updates</p>
            </div>
            
            <div class="syntax-card">
              <h4>Component Props</h4>
              <code>&lt;MTMCounter initialValue={5} /&gt;</code>
              <p>Pass data between components</p>
            </div>
          </div>
        </section>
      </main>
      
      <footer class="page-footer">
        <div class="footer-content">
          <div class="footer-section">
            <h4>Navigation</h4>
            <ul class="footer-links">
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
              <li><a href="/react-example">React Example</a></li>
              <li><a href="/vue-example">Vue Example</a></li>
              <li><a href="/solid-example">Solid Example</a></li>
              <li><a href="/svelte-example">Svelte Example</a></li>
            </ul>
          </div>
          
          <div class="footer-section">
            <h4>MTM Framework</h4>
            <p>Enhanced MTM Framework v2.0</p>
            <p>Native reactive components with multi-framework support</p>
          </div>
        </div>
      </footer>
    </div>
  `;
}