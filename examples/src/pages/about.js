// About page - Demonstrates basic routing
export default function AboutPage() {
  return `
    <div class="about-page">
      <header class="page-header">
        <div class="breadcrumb">
          <a href="/" class="breadcrumb-link">Home</a>
          <span class="breadcrumb-separator">→</span>
          <span class="breadcrumb-current">About</span>
        </div>
        
        <h1>About - Enhanced MTM Framework</h1>
        <p class="page-description">Learn about the Enhanced MTM Framework's capabilities and architecture</p>
        
        <div class="page-metadata">
          <div class="metadata-item">
            <strong>Route:</strong> /about
          </div>
          <div class="metadata-item">
            <strong>Framework:</strong> Enhanced MTM
          </div>
          <div class="metadata-item">
            <strong>Features:</strong> Multi-framework routing
          </div>
        </div>
      </header>
      
      <nav class="page-navigation">
        <h2>Quick Navigation</h2>
        <div class="nav-grid">
          <a href="/" class="nav-card">
            <div class="nav-icon">🏠</div>
            <div class="nav-title">Home</div>
            <div class="nav-desc">Main demo page</div>
          </a>
          <a href="/mtm-example" class="nav-card">
            <div class="nav-icon">🎯</div>
            <div class="nav-title">MTM</div>
            <div class="nav-desc">Native MTM components</div>
          </a>
          <a href="/react-example" class="nav-card">
            <div class="nav-icon">⚛️</div>
            <div class="nav-title">React</div>
            <div class="nav-desc">React component integration</div>
          </a>
          <a href="/vue-example" class="nav-card">
            <div class="nav-icon">💚</div>
            <div class="nav-title">Vue</div>
            <div class="nav-desc">Vue component examples</div>
          </a>
          <a href="/solid-example" class="nav-card">
            <div class="nav-icon">🔷</div>
            <div class="nav-title">Solid</div>
            <div class="nav-desc">Solid.js integration</div>
          </a>
          <a href="/svelte-example" class="nav-card">
            <div class="nav-icon">🧡</div>
            <div class="nav-title">Svelte</div>
            <div class="nav-desc">Svelte component demos</div>
          </a>
        </div>
      </nav>
      
      <main class="main-content">
        <section class="about-content">
          <div class="content-card">
            <h3>About Enhanced MTM Framework</h3>
            <p>The Enhanced MTM Framework is a modern meta-framework that combines the simplicity of traditional web development with the power of modern JavaScript frameworks.</p>
            
            <h4>Key Features:</h4>
            <div class="features-list">
              <div class="feature-item">
                <strong>🔗 Client-Side Routing:</strong> Navigate using standard HTML anchor tags with automatic interception and history management.
              </div>
              <div class="feature-item">
                <strong>🧩 Multi-Framework Components:</strong> Import and use React, Vue, Solid, and Svelte components seamlessly.
              </div>
              <div class="feature-item">
                <strong>⚡ Flexible Compilation:</strong> Choose between inline and external JavaScript compilation modes.
              </div>
              <div class="feature-item">
                <strong>📝 Frontmatter Configuration:</strong> Configure routes, metadata, and compilation options using YAML.
              </div>
            </div>
          </div>
        </section>
        
        <section class="demo-section">
          <h2>Interactive Demo</h2>
          <p>This page demonstrates several key concepts:</p>
          
          <div class="demo-grid">
            <div class="demo-card">
              <h4>Component Integration</h4>
              <p>Components from different frameworks can work together seamlessly.</p>
              <button onclick="alert('Multi-framework integration!')" class="demo-button">
                Test Integration
              </button>
            </div>
            
            <div class="demo-card">
              <h4>State Management</h4>
              <p>Shared state management across different framework components.</p>
              <button onclick="console.log('State updated!')" class="demo-button">
                Update State
              </button>
            </div>
            
            <div class="demo-card">
              <h4>Navigation</h4>
              <p>All navigation links use standard anchor tags with client-side routing.</p>
              <a href="/" class="demo-button">
                Back to Home
              </a>
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
              <li><a href="/react-example">React Example</a></li>
              <li><a href="/vue-example">Vue Example</a></li>
              <li><a href="/solid-example">Solid Example</a></li>
              <li><a href="/svelte-example">Svelte Example</a></li>
            </ul>
          </div>
          
          <div class="footer-section">
            <h4>Framework Info</h4>
            <p>Enhanced MTM Framework v2.0</p>
            <p>Built with ❤️ for modern web development</p>
          </div>
        </div>
      </footer>
    </div>
  `;
}