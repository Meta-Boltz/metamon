/**
 * Comprehensive Chunk Loading Examples
 * 
 * This file demonstrates chunk loading patterns across all supported frameworks
 * with comprehensive error handling and best practices.
 */

import { initReactChunkLoadingExamples } from './chunk-loading-react.jsx';
import { initVueChunkLoadingExamples } from './chunk-loading-vue.js';
import { initSvelteChunkLoadingExamples } from './chunk-loading-svelte.js';
import { initVanillaChunkLoadingExamples } from './chunk-loading-vanilla.js';

// Framework detection utility
function detectFramework() {
  // Check for React
  if (typeof window !== 'undefined' && window.React) {
    return 'react';
  }

  // Check for Vue
  if (typeof window !== 'undefined' && (window.Vue || window.createApp)) {
    return 'vue';
  }

  // Check for Svelte (less reliable detection)
  if (typeof window !== 'undefined' && window.__SVELTE__) {
    return 'svelte';
  }

  // Default to vanilla JS
  return 'vanilla';
}

// Framework selector component
class FrameworkSelector {
  constructor(container) {
    this.container = container;
    this.currentFramework = detectFramework();
    this.currentApp = null;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="framework-selector">
        <header class="selector-header">
          <h1>🚀 Metamon Chunk Loading Examples</h1>
          <p>Comprehensive demonstration of safe chunk loading across all supported frameworks.</p>
          
          <div class="framework-tabs">
            <button class="tab-btn ${this.currentFramework === 'react' ? 'active' : ''}" data-framework="react">
              ⚛️ React
            </button>
            <button class="tab-btn ${this.currentFramework === 'vue' ? 'active' : ''}" data-framework="vue">
              💚 Vue
            </button>
            <button class="tab-btn ${this.currentFramework === 'svelte' ? 'active' : ''}" data-framework="svelte">
              🧡 Svelte
            </button>
            <button class="tab-btn ${this.currentFramework === 'vanilla' ? 'active' : ''}" data-framework="vanilla">
              🟨 Vanilla JS
            </button>
          </div>
          
          <div class="current-framework">
            <p><strong>Current Framework:</strong> ${this.getFrameworkName(this.currentFramework)}</p>
            <p><small>Auto-detected: ${detectFramework()}</small></p>
          </div>
        </header>
        
        <div class="framework-content">
          <div class="loading-indicator">
            <p>Loading ${this.getFrameworkName(this.currentFramework)} examples...</p>
          </div>
        </div>
        
        <footer class="selector-footer">
          <div class="features-overview">
            <h2>🎯 Features Demonstrated</h2>
            <div class="features-grid">
              <div class="feature-card">
                <h3>🔒 Safe Property Assignment</h3>
                <p>Handles getter-only properties that cause the original TypeError</p>
              </div>
              <div class="feature-card">
                <h3>🛡️ Error Boundaries</h3>
                <p>Comprehensive error handling with detailed reporting</p>
              </div>
              <div class="feature-card">
                <h3>🔄 Retry Mechanisms</h3>
                <p>Automatic and manual retry strategies for failed loads</p>
              </div>
              <div class="feature-card">
                <h3>⚡ Preloading</h3>
                <p>Performance optimization through strategic preloading</p>
              </div>
              <div class="feature-card">
                <h3>🎛️ Manual Control</h3>
                <p>Fine-grained control over chunk loading process</p>
              </div>
              <div class="feature-card">
                <h3>📊 Diagnostics</h3>
                <p>Detailed error reporting and debugging information</p>
              </div>
            </div>
          </div>
          
          <div class="technical-info">
            <h2>🔧 Technical Implementation</h2>
            <div class="tech-details">
              <div class="tech-section">
                <h3>The Original Problem</h3>
                <pre><code>// This fails with: TypeError: Cannot set property data of #<Object> which has only a getter
const module = {
  get data() { return this._data; }
  // No setter defined
};

module.data = { loaded: true }; // ❌ Throws TypeError</code></pre>
              </div>
              
              <div class="tech-section">
                <h3>The Solution</h3>
                <pre><code>// Safe property assignment with multiple strategies
function safeAssign(obj, prop, value) {
  const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
  
  if (descriptor && descriptor.get && !descriptor.set) {
    // Strategy 1: Try to add a setter
    // Strategy 2: Create a new object
    // Strategy 3: Use proxy wrapping
  } else {
    obj[prop] = value; // Standard assignment
  }
  
  return obj;
}</code></pre>
              </div>
            </div>
          </div>
        </footer>
      </div>
    `;

    // Add event listeners for framework tabs
    const tabBtns = this.container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const framework = e.target.dataset.framework;
        this.switchFramework(framework);
      });
    });

    // Initialize the current framework
    this.initializeFramework();
  }

  getFrameworkName(framework) {
    const names = {
      react: 'React',
      vue: 'Vue.js',
      svelte: 'Svelte',
      vanilla: 'Vanilla JavaScript'
    };
    return names[framework] || 'Unknown';
  }

  switchFramework(framework) {
    if (framework === this.currentFramework) return;

    // Cleanup current app
    if (this.currentApp && this.currentApp.destroy) {
      this.currentApp.destroy();
    }
    if (this.currentApp && this.currentApp.$destroy) {
      this.currentApp.$destroy();
    }

    // Update UI
    this.currentFramework = framework;
    this.updateTabs();
    this.updateCurrentFrameworkDisplay();

    // Initialize new framework
    this.initializeFramework();
  }

  updateTabs() {
    const tabBtns = this.container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.framework === this.currentFramework);
    });
  }

  updateCurrentFrameworkDisplay() {
    const currentFrameworkEl = this.container.querySelector('.current-framework p');
    if (currentFrameworkEl) {
      currentFrameworkEl.innerHTML = `<strong>Current Framework:</strong> ${this.getFrameworkName(this.currentFramework)}`;
    }
  }

  async initializeFramework() {
    const contentContainer = this.container.querySelector('.framework-content');

    // Show loading
    contentContainer.innerHTML = `
      <div class="loading-indicator">
        <p>Loading ${this.getFrameworkName(this.currentFramework)} examples...</p>
      </div>
    `;

    try {
      // Clear the content container for the new framework
      contentContainer.innerHTML = '';

      // Initialize the appropriate framework
      switch (this.currentFramework) {
        case 'react':
          this.currentApp = await this.initReact(contentContainer);
          break;
        case 'vue':
          this.currentApp = await this.initVue(contentContainer);
          break;
        case 'svelte':
          this.currentApp = await this.initSvelte(contentContainer);
          break;
        case 'vanilla':
        default:
          this.currentApp = await this.initVanilla(contentContainer);
          break;
      }
    } catch (error) {
      console.error(`Failed to initialize ${this.currentFramework}:`, error);
      contentContainer.innerHTML = `
        <div class="error-message">
          <h3>❌ Failed to load ${this.getFrameworkName(this.currentFramework)} examples</h3>
          <p>Error: ${error.message}</p>
          <button onclick="location.reload()">🔄 Reload Page</button>
        </div>
      `;
    }
  }

  async initReact(container) {
    // Import React dynamically if not available
    if (typeof window.React === 'undefined') {
      console.warn('React not available, falling back to vanilla JS');
      return this.initVanilla(container);
    }

    return initReactChunkLoadingExamples();
  }

  async initVue(container) {
    // Import Vue dynamically if not available
    if (typeof window.Vue === 'undefined' && typeof window.createApp === 'undefined') {
      console.warn('Vue not available, falling back to vanilla JS');
      return this.initVanilla(container);
    }

    return initVueChunkLoadingExamples();
  }

  async initSvelte(container) {
    return initSvelteChunkLoadingExamples();
  }

  async initVanilla(container) {
    return initVanillaChunkLoadingExamples();
  }

  destroy() {
    if (this.currentApp && this.currentApp.destroy) {
      this.currentApp.destroy();
    }
    if (this.currentApp && this.currentApp.$destroy) {
      this.currentApp.$destroy();
    }
  }
}

// Styles for the comprehensive example
const comprehensiveStyles = `
  .framework-selector {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  
  .selector-header {
    text-align: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e1e5e9;
  }
  
  .selector-header h1 {
    color: #2d3748;
    margin-bottom: 10px;
  }
  
  .framework-tabs {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin: 20px 0;
    flex-wrap: wrap;
  }
  
  .tab-btn {
    background: #f7fafc;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 20px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    transition: all 0.2s ease;
    min-width: 120px;
  }
  
  .tab-btn:hover {
    background: #edf2f7;
    border-color: #cbd5e0;
  }
  
  .tab-btn.active {
    background: #4299e1;
    color: white;
    border-color: #3182ce;
  }
  
  .current-framework {
    background: #f0fff4;
    border: 1px solid #9ae6b4;
    border-radius: 6px;
    padding: 12px;
    margin: 15px 0;
    text-align: left;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .framework-content {
    min-height: 400px;
    margin: 30px 0;
  }
  
  .loading-indicator {
    text-align: center;
    padding: 60px 20px;
    color: #718096;
    font-size: 18px;
  }
  
  .error-message {
    text-align: center;
    padding: 40px 20px;
    background: #fed7d7;
    border: 1px solid #fc8181;
    border-radius: 8px;
    color: #c53030;
  }
  
  .error-message button {
    background: #e53e3e;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 20px;
    margin-top: 15px;
    cursor: pointer;
  }
  
  .selector-footer {
    margin-top: 50px;
    padding-top: 30px;
    border-top: 2px solid #e1e5e9;
  }
  
  .features-overview h2 {
    text-align: center;
    color: #2d3748;
    margin-bottom: 25px;
  }
  
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }
  
  .feature-card {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
  }
  
  .feature-card h3 {
    color: #2d3748;
    margin-bottom: 10px;
    font-size: 18px;
  }
  
  .feature-card p {
    color: #4a5568;
    font-size: 14px;
    line-height: 1.5;
  }
  
  .technical-info {
    background: #1a202c;
    color: #e2e8f0;
    border-radius: 8px;
    padding: 30px;
    margin-top: 30px;
  }
  
  .technical-info h2 {
    color: #f7fafc;
    text-align: center;
    margin-bottom: 25px;
  }
  
  .tech-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 30px;
  }
  
  .tech-section h3 {
    color: #63b3ed;
    margin-bottom: 15px;
    font-size: 18px;
  }
  
  .tech-section pre {
    background: #2d3748;
    border: 1px solid #4a5568;
    border-radius: 6px;
    padding: 15px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.4;
  }
  
  .tech-section code {
    color: #e2e8f0;
  }
  
  @media (max-width: 768px) {
    .framework-tabs {
      flex-direction: column;
      align-items: center;
    }
    
    .tab-btn {
      width: 200px;
    }
    
    .tech-details {
      grid-template-columns: 1fr;
    }
    
    .features-grid {
      grid-template-columns: 1fr;
    }
  }
`;

// Initialize the comprehensive example
export function initComprehensiveChunkLoadingExamples() {
  // Add styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = comprehensiveStyles;
  document.head.appendChild(styleSheet);

  // Create container
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Create and initialize the framework selector
  const app = new FrameworkSelector(container);

  return app;
}

// Auto-initialize if this is the main module
if (typeof window !== 'undefined' && !window.comprehensiveChunkExamplesInitialized) {
  window.comprehensiveChunkExamplesInitialized = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComprehensiveChunkLoadingExamples);
  } else {
    initComprehensiveChunkLoadingExamples();
  }
}

export default FrameworkSelector;