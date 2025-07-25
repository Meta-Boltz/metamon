import './style.css';
import { signal } from './shared/signal-system.js';
import router from './shared/ultra-modern-router.js';

// Make signal system globally accessible
window.signal = signal;
window.router = router;

// Create the main app structure with navigation
const appContainer = document.getElementById('app');
appContainer.innerHTML = `
  <div class="ultra-modern-app">
    <nav class="main-navigation">
      <div class="nav-brand">
        <a href="/">🚀 Ultra-Modern MTM</a>
      </div>
      <div class="nav-links">
        <a href="/" class="nav-link">Home</a>
        <a href="/docs" class="nav-link">Documentation</a>
        <a href="/performance" class="nav-link">Performance</a>
        <a href="/chunk-loading" class="nav-link">Chunk Loading</a>
      </div>
    </nav>
    
    <main id="page-content">
      <div class="loading-indicator">
        <div class="spinner"></div>
        <p>Loading Ultra-Modern MTM...</p>
      </div>
    </main>
    
    <div id="component-mounts" style="display: none;">
      <!-- Framework component mount points -->
      <div id="react-counter"></div>
      <div id="vue-message-board"></div>
      <div id="solid-theme-toggle"></div>
      <div id="svelte-user-list"></div>
    </div>
  </div>
`;

// Initialize Ultra-Modern MTM Application
async function initializeApp() {
  try {
    console.log('🚀 Initializing Ultra-Modern MTM Application...');

    // Initialize router and handle initial route
    console.log('🛣️ Router initialized');

    // Mount framework components for embedded components (if needed)
    await mountFrameworkComponents();

    // Set up navigation event handlers
    setupNavigation();

    // Add loading styles
    addLoadingStyles();

    console.log('✅ Ultra-Modern MTM Application ready!');
  } catch (error) {
    console.error('❌ Error initializing app:', error);
    showError('Failed to initialize application');
  }
}

// Mount framework components for embedded use
async function mountFrameworkComponents() {
  try {
    // These are for embedded components within pages
    await import('./mount-react.jsx');
    await import('./mount-vue.js');
    await import('./mount-svelte.js');
    console.log('✅ Framework components available for embedding');
  } catch (error) {
    console.warn('⚠️ Some framework components failed to load:', error);
  }
}

// Set up navigation event handlers
function setupNavigation() {
  // Handle navigation link clicks
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
      return; // External link or anchor
    }

    // Prevent default navigation for internal links
    event.preventDefault();
    router.push(href);
  });

  // Update active navigation state
  signal.on('currentRoute', (newRoute) => {
    updateActiveNavigation(newRoute);
  });
}

// Update active navigation styling
function updateActiveNavigation(currentRoute) {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentRoute) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Add loading and navigation styles
function addLoadingStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .main-navigation {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem 2rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .nav-brand a {
      color: white;
      text-decoration: none;
      font-size: 1.5rem;
      font-weight: bold;
    }
    
    .nav-links {
      display: flex;
      gap: 2rem;
    }
    
    .nav-link {
      color: rgba(255,255,255,0.9);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: all 0.2s;
    }
    
    .nav-link:hover, .nav-link.active {
      background: rgba(255,255,255,0.2);
      color: white;
    }
    
    .loading-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      color: #666;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    #page-content {
      min-height: calc(100vh - 80px);
    }
  `;
  document.head.appendChild(style);
}

// Show error message
function showError(message) {
  const pageContent = document.getElementById('page-content');
  if (pageContent) {
    pageContent.innerHTML = `
      <div class="error-container" style="text-align: center; padding: 2rem; color: #dc2626;">
        <h2>❌ Error</h2>
        <p>${message}</p>
        <button onclick="location.reload()" class="button">Reload Page</button>
      </div>
    `;
  }
}

// Start the application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}