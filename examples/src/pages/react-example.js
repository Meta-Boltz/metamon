// React example page - Demonstrates React component integration
export default function ReactExamplePage() {
  // Define functions in global scope
  setTimeout(() => {
    let reactCount = 0;
    let componentMounted = true;

    window.incrementReactCount = function () {
      reactCount++;
      document.getElementById('react-count').textContent = reactCount;
    };

    window.decrementReactCount = function () {
      reactCount = Math.max(0, reactCount - 1);
      document.getElementById('react-count').textContent = reactCount;
    };

    window.resetReactCount = function () {
      reactCount = 0;
      document.getElementById('react-count').textContent = reactCount;
    };

    window.mountComponent = function () {
      componentMounted = true;
      document.getElementById('component-status').textContent = 'Mounted';
      document.getElementById('component-status').style.color = '#27ae60';
    };

    window.updateComponent = function () {
      if (componentMounted) {
        document.getElementById('component-status').textContent = 'Updated';
        document.getElementById('component-status').style.color = '#f39c12';
        setTimeout(() => {
          document.getElementById('component-status').textContent = 'Mounted';
          document.getElementById('component-status').style.color = '#27ae60';
        }, 1000);
      }
    };

    window.unmountComponent = function () {
      componentMounted = false;
      document.getElementById('component-status').textContent = 'Unmounted';
      document.getElementById('component-status').style.color = '#e74c3c';
    };

    window.openReactModal = function () {
      document.getElementById('react-modal').style.display = 'block';
    };

    window.closeReactModal = function () {
      document.getElementById('react-modal').style.display = 'none';
    };

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
      const modal = document.getElementById('react-modal');
      if (e.target === modal) {
        window.closeReactModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeReactModal();
      }
    });
  }, 50);

  return `
    <div class="react-example-page">
      <header class="page-header">
        <div class="breadcrumb">
          <a href="/" class="breadcrumb-link">Home</a>
          <span class="breadcrumb-separator">→</span>
          <span class="breadcrumb-current">React Example</span>
        </div>
        
        <h1>React Component Integration</h1>
        <p class="page-description">This page demonstrates React components working within the Enhanced MTM Framework</p>
      </header>
      
      <nav class="framework-nav">
        <a href="/mtm-example" class="framework-link mtm">MTM Example</a>
        <a href="/vue-example" class="framework-link vue">Vue Example</a>
        <a href="/solid-example" class="framework-link solid">Solid Example</a>
        <a href="/svelte-example" class="framework-link svelte">Svelte Example</a>
        <a href="/about" class="framework-link about">About</a>
      </nav>
      
      <main class="main-content">
        <section class="component-demo">
          <h2>React Components</h2>
          <p>The following components demonstrate React integration within the MTM framework:</p>
          
          <div class="component-grid">
            <div class="component-container">
              <h3>Counter Component</h3>
              <div class="react-demo">
                <div class="demo-counter">
                  <h4>React-style Counter: <span id="react-count">0</span></h4>
                  <div class="counter-controls">
                    <button onclick="decrementReactCount()" class="demo-button">-</button>
                    <button onclick="incrementReactCount()" class="demo-button">+</button>
                    <button onclick="resetReactCount()" class="demo-button secondary">Reset</button>
                  </div>
                </div>
                <div class="demo-info">
                  <p>This demonstrates React-style state management within MTM</p>
                </div>
              </div>
            </div>
            
            <div class="component-container">
              <h3>Component Lifecycle</h3>
              <div class="lifecycle-demo">
                <div class="lifecycle-status">
                  <h4>Component Status: <span id="component-status">Mounted</span></h4>
                  <div class="lifecycle-controls">
                    <button onclick="mountComponent()" class="demo-button">Mount</button>
                    <button onclick="updateComponent()" class="demo-button">Update</button>
                    <button onclick="unmountComponent()" class="demo-button secondary">Unmount</button>
                  </div>
                </div>
                <div class="demo-info">
                  <p>This demonstrates React component lifecycle patterns</p>
                </div>
              </div>
            </div>
            
            <div class="component-container">
              <h3>Modal Demo</h3>
              <div class="modal-demo">
                <button onclick="openReactModal()" class="demo-button">
                  Open Modal
                </button>
                <div id="react-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000;">
                  <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:white; padding:2rem; border-radius:8px; max-width:500px;">
                    <h3>React Modal Example</h3>
                    <p>This modal demonstrates React-style component patterns within the MTM framework!</p>
                    <p>Features demonstrated:</p>
                    <ul>
                      <li>Component state management</li>
                      <li>Event handling</li>
                      <li>Conditional rendering</li>
                      <li>Props passing</li>
                    </ul>
                    <button onclick="closeReactModal()" class="demo-button">Close</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section class="code-example">
          <h2>Code Example</h2>
          <pre><code>// Import React components
import Counter from '@components/Counter.tsx';
import { createRoot } from 'react-dom/client';

// Mount React component
const root = createRoot(container);
root.render(&lt;Counter initialValue={5} /&gt;);</code></pre>
        </section>
        
        <section class="features-section">
          <h2>React Integration Features</h2>
          <div class="features-grid">
            <div class="feature-card">
              <h4>⚛️ Full React Support</h4>
              <p>Use React hooks, context, and all React features seamlessly</p>
            </div>
            <div class="feature-card">
              <h4>🔄 Hot Module Replacement</h4>
              <p>React components update instantly during development</p>
            </div>
            <div class="feature-card">
              <h4>📦 TypeScript Support</h4>
              <p>Full TypeScript support with proper type checking</p>
            </div>
            <div class="feature-card">
              <h4>🎯 Props Integration</h4>
              <p>Pass props from MTM to React components naturally</p>
            </div>
          </div>
        </section>
      </main>
      
      <footer class="page-footer">
        <p>
          <a href="/" class="footer-link">Home</a> | 
          <a href="/about" class="footer-link">About</a> |
          <a href="/vue-example" class="footer-link">Vue</a> |
          <a href="/solid-example" class="footer-link">Solid</a> |
          <a href="/svelte-example" class="footer-link">Svelte</a>
        </p>
      </footer>
    </div>
    

  `;
}