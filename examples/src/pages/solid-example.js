// Solid example page - Demonstrates Solid component integration
export default function SolidExamplePage() {
  // Define functions in global scope
  setTimeout(() => {
    let signalCount = 0;
    let isDarkTheme = false;

    window.incrementSignal = function () {
      signalCount++;
      document.getElementById('signal-count').textContent = signalCount;
    };

    window.decrementSignal = function () {
      signalCount = Math.max(0, signalCount - 1);
      document.getElementById('signal-count').textContent = signalCount;
    };

    window.resetSignal = function () {
      signalCount = 0;
      document.getElementById('signal-count').textContent = signalCount;
    };

    window.editProfile = function () {
      const name = prompt('Enter new name:', document.getElementById('profile-name').textContent);
      if (name) {
        document.getElementById('profile-name').textContent = name;
      }
    };

    window.toggleTheme = function () {
      isDarkTheme = !isDarkTheme;
      document.body.style.backgroundColor = isDarkTheme ? '#2c3e50' : '';
      document.body.style.color = isDarkTheme ? '#ecf0f1' : '';
    };
  }, 50);

  return `
    <div class="solid-example-page">
      <header class="page-header">
        <div class="breadcrumb">
          <a href="/" class="breadcrumb-link">Home</a>
          <span class="breadcrumb-separator">→</span>
          <span class="breadcrumb-current">Solid Example</span>
        </div>
        
        <h1>Solid Component Integration</h1>
        <p class="page-description">This page demonstrates Solid.js components working within the Enhanced MTM Framework</p>
      </header>
      
      <nav class="framework-nav">
        <a href="/mtm-example" class="framework-link mtm">MTM Example</a>
        <a href="/react-example" class="framework-link react">React Example</a>
        <a href="/vue-example" class="framework-link vue">Vue Example</a>
        <a href="/svelte-example" class="framework-link svelte">Svelte Example</a>
        <a href="/about" class="framework-link about">About</a>
      </nav>
      
      <main class="main-content">
        <section class="component-demo">
          <h2>Solid Components</h2>
          <p>The following components are Solid.js components imported and rendered within the MTM framework:</p>
          
          <div class="component-grid">
            <div class="component-container">
              <h3>User Profile Component</h3>
              <div id="profile-component">
                <div class="solid-profile-demo">
                  <div class="profile-card">
                    <div class="profile-avatar">👤</div>
                    <div class="profile-info">
                      <h4 id="profile-name">John Doe</h4>
                      <p id="profile-email">john.doe@example.com</p>
                      <p id="profile-role">Developer</p>
                    </div>
                    <div class="profile-actions">
                      <button onclick="editProfile()" class="profile-button">Edit Profile</button>
                      <button onclick="toggleTheme()" class="profile-button secondary">Toggle Theme</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="component-container">
              <h3>Signal Demo</h3>
              <div id="signal-component">
                <div class="solid-signal-demo">
                  <div class="signal-display">
                    <h4>Reactive Counter: <span id="signal-count">0</span></h4>
                    <div class="signal-controls">
                      <button onclick="decrementSignal()" class="signal-button">-</button>
                      <button onclick="incrementSignal()" class="signal-button">+</button>
                      <button onclick="resetSignal()" class="signal-button secondary">Reset</button>
                    </div>
                  </div>
                  <div class="signal-info">
                    <p>This demonstrates Solid's reactive signals working within MTM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section class="code-example">
          <h2>Code Example</h2>
          <pre><code>// Import Solid components
import UserProfile from '@components/UserProfile.tsx';
import { createSignal } from 'solid-js';

// Use Solid signals and components
const [count, setCount] = createSignal(0);

&lt;UserProfile userId="123" onUpdate={handleUpdate} /&gt;
&lt;div&gt;Count: {count()}&lt;/div&gt;</code></pre>
        </section>
        
        <section class="features-section">
          <h2>Solid Integration Features</h2>
          <div class="features-grid">
            <div class="feature-card">
              <h4>🔷 Native Signals</h4>
              <p>Use Solid's fine-grained reactivity system</p>
            </div>
            <div class="feature-card">
              <h4>⚡ Performance</h4>
              <p>Solid's compile-time optimizations work seamlessly</p>
            </div>
            <div class="feature-card">
              <h4>📦 TypeScript Support</h4>
              <p>Full TypeScript support with JSX</p>
            </div>
            <div class="feature-card">
              <h4>🎯 No Virtual DOM</h4>
              <p>Direct DOM updates for maximum performance</p>
            </div>
          </div>
        </section>
      </main>
      
      <footer class="page-footer">
        <p>
          <a href="/" class="footer-link">Home</a> | 
          <a href="/about" class="footer-link">About</a> |
          <a href="/react-example" class="footer-link">React</a> |
          <a href="/vue-example" class="footer-link">Vue</a> |
          <a href="/svelte-example" class="footer-link">Svelte</a>
        </p>
      </footer>
    </div>
    

  `;
}