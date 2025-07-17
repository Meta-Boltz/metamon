import './style.css';
import { signals, pubsub } from './shared/state.js';

// Make state globally accessible for vanilla JS components
window.metamonState = { signals, pubsub };

// Create the main app structure
const appContainer = document.getElementById('app');
appContainer.innerHTML = `
  <div class="app-container">
    <header class="header">
      <h1>🚀 Metamon Framework Demo</h1>
      <p>Multi-framework components working together seamlessly</p>
    </header>

    <div id="shared-state-display"></div>

    <div class="framework-grid">
      <div class="framework-card">
        <div class="react-badge framework-badge">React</div>
        <h3>Counter Component</h3>
        <p>Demonstrates signal-based state management</p>
        <div id="react-counter"></div>
      </div>

      <div class="framework-card">
        <div class="vue-badge framework-badge">Vue</div>
        <h3>Message Board</h3>
        <p>Shows cross-framework event communication</p>
        <div id="vue-message-board"></div>
      </div>

      <div class="framework-card">
        <div class="solid-badge framework-badge">Solid</div>
        <h3>Theme Toggle</h3>
        <p>Native Solid signals integration</p>
        <div id="solid-theme-toggle"></div>
      </div>

      <div class="framework-card">
        <div class="svelte-badge framework-badge">Svelte</div>
        <h3>User Management</h3>
        <p>Svelte stores with shared signals</p>
        <div id="svelte-user-list"></div>
      </div>
    </div>

    <div class="shared-state">
      <h3>📊 Framework Communication Demo</h3>
      <p>
        Each component above is built with a different framework, but they all share state
        and communicate through a unified pub/sub system and signals.
      </p>
      <ul>
        <li>React Counter updates the global user count signal</li>
        <li>Vue Message Board listens for messages from all frameworks</li>
        <li>Solid Theme Toggle changes the global theme signal</li>
        <li>Svelte User List manages users and emits events</li>
      </ul>
    </div>
  </div>
`;

// Mount each framework's components sequentially to avoid cross-contamination
async function mountComponents() {
  try {
    // Mount React components first
    await import('./mount-react.jsx');
    console.log('✅ React components mounted');

    // Mount Vue components
    await import('./mount-vue.js');
    console.log('✅ Vue components mounted');

    // Mount Svelte components (working)
    await import('./mount-svelte.js');
    console.log('✅ Svelte components mounted');

    // Create a working theme toggle using vanilla JS for now
    const solidElement = document.getElementById('solid-theme-toggle');
    if (solidElement) {
      let currentTheme = 'light';

      solidElement.innerHTML = `
        <div class="component-demo">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
            <span>Current Theme:</span>
            <span class="counter-value" id="theme-display" style="color: #3b82f6; text-transform: capitalize;">
              ${currentTheme}
            </span>
          </div>
          <button class="button" id="theme-toggle" style="background: #3b82f6;">
            🌙 Switch to Dark
          </button>
          <div style="margin-top: 15px; padding: 10px; border-radius: 6px; background: #f3f4f6; color: #1f2937; font-size: 12px;">
            <strong>Theme Toggle (Vanilla JS):</strong><br/>
            This demonstrates theme switching functionality while we work on Solid integration.
            Theme changes are reflected across all framework components.
          </div>
        </div>
      `;

      const themeButton = solidElement.querySelector('#theme-toggle');
      const themeDisplay = solidElement.querySelector('#theme-display');

      themeButton.addEventListener('click', () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';

        // Update global state
        const { signals, pubsub } = window.metamonState || {};
        if (signals && signals.theme) {
          signals.theme.update(currentTheme);
        }

        // Update display
        themeDisplay.textContent = currentTheme;
        themeDisplay.style.color = currentTheme === 'dark' ? '#fbbf24' : '#3b82f6';
        themeButton.style.background = currentTheme === 'dark' ? '#fbbf24' : '#3b82f6';
        themeButton.textContent = currentTheme === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light';

        // Apply theme to document
        document.documentElement.setAttribute('data-theme', currentTheme);
        document.body.style.filter = currentTheme === 'dark' ? 'invert(1) hue-rotate(180deg)' : 'none';

        // Emit events
        if (pubsub) {
          pubsub.emit('theme-changed', {
            framework: 'Vanilla JS',
            theme: currentTheme,
            timestamp: Date.now()
          });

          pubsub.emit('user-action', {
            action: 'toggle_theme',
            framework: 'Vanilla JS',
            data: { newTheme: currentTheme }
          });
        }
      });
    }

    console.log('🎉 Framework components mounting completed!');
  } catch (error) {
    console.error('❌ Error mounting components:', error);
  }
}

// Start mounting after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountComponents);
} else {
  mountComponents();
}