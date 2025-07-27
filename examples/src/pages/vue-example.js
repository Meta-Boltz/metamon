// Vue example page - Demonstrates Vue component integration
export default function VueExamplePage() {
  // Define functions in global scope
  setTimeout(() => {
    window.addTodo = function () {
      const input = document.getElementById('todo-input');
      const list = document.getElementById('todo-list');

      if (input.value.trim()) {
        const li = document.createElement('li');
        li.className = 'todo-item';
        li.textContent = input.value;
        li.onclick = () => li.classList.toggle('completed');
        list.appendChild(li);
        input.value = '';
      }
    };

    const todoInput = document.getElementById('todo-input');
    if (todoInput) {
      todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.addTodo();
      });
    }
  }, 50);

  return `
    <div class="vue-example-page">
      <header class="page-header">
        <div class="breadcrumb">
          <a href="/" class="breadcrumb-link">Home</a>
          <span class="breadcrumb-separator">→</span>
          <span class="breadcrumb-current">Vue Example</span>
        </div>
        
        <h1>Vue Component Integration</h1>
        <p class="page-description">This page demonstrates Vue components working within the Enhanced MTM Framework</p>
      </header>
      
      <nav class="framework-nav">
        <a href="/mtm-example" class="framework-link mtm">MTM Example</a>
        <a href="/react-example" class="framework-link react">React Example</a>
        <a href="/solid-example" class="framework-link solid">Solid Example</a>
        <a href="/svelte-example" class="framework-link svelte">Svelte Example</a>
        <a href="/about" class="framework-link about">About</a>
      </nav>
      
      <main class="main-content">
        <section class="component-demo">
          <h2>Vue Components</h2>
          <p>The following components are Vue components imported and rendered within the MTM framework:</p>
          
          <div class="component-grid">
            <div class="component-container">
              <h3>Button Component</h3>
              <div id="button-component">
                <div class="vue-button-demo">
                  <button class="vue-button primary" onclick="alert('Vue Button Clicked!')">
                    Primary Button
                  </button>
                  <button class="vue-button secondary" onclick="console.log('Vue secondary button')">
                    Secondary Button
                  </button>
                </div>
              </div>
            </div>
            
            <div class="component-container">
              <h3>Todo List Component</h3>
              <div id="todo-component">
                <div class="vue-todo-demo">
                  <div class="todo-input">
                    <input type="text" id="todo-input" placeholder="Add a new todo..." class="todo-field">
                    <button onclick="addTodo()" class="add-button">Add</button>
                  </div>
                  <ul id="todo-list" class="todo-list">
                    <li class="todo-item">Example todo item</li>
                    <li class="todo-item completed">Completed todo item</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section class="code-example">
          <h2>Code Example</h2>
          <pre><code>// Import Vue components
import Button from '@components/Button.vue';
import TodoList from '@components/TodoList.vue';

// Use in MTM template
&lt;Button variant="primary" @click="handleClick"&gt;Click Me&lt;/Button&gt;
&lt;TodoList :items="todoItems" @add="addTodo" /&gt;</code></pre>
        </section>
        
        <section class="features-section">
          <h2>Vue Integration Features</h2>
          <div class="features-grid">
            <div class="feature-card">
              <h4>💚 Full Vue Support</h4>
              <p>Use Composition API, reactivity, and all Vue features</p>
            </div>
            <div class="feature-card">
              <h4>🔄 Hot Module Replacement</h4>
              <p>Vue components update with state preservation</p>
            </div>
            <div class="feature-card">
              <h4>📦 Single File Components</h4>
              <p>Full support for .vue files with scoped styles</p>
            </div>
            <div class="feature-card">
              <h4>🎯 Event Integration</h4>
              <p>Vue events work seamlessly with MTM event system</p>
            </div>
          </div>
        </section>
      </main>
      
      <footer class="page-footer">
        <p>
          <a href="/" class="footer-link">Home</a> | 
          <a href="/about" class="footer-link">About</a> |
          <a href="/react-example" class="footer-link">React</a> |
          <a href="/solid-example" class="footer-link">Solid</a> |
          <a href="/svelte-example" class="footer-link">Svelte</a>
        </p>
      </footer>
    </div>
    

  `;
}