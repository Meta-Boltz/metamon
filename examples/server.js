// Enhanced MTM SSR Server
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(join(__dirname, 'dist')));
app.use('/src', express.static(join(__dirname, 'src')));
app.use('/public', express.static(join(__dirname, 'public')));

// Handle .mtm file requests by serving corresponding .js files
app.get('/src/components/*.mtm', (req, res) => {
  const mtmPath = req.path;
  const jsPath = mtmPath.replace('.mtm', '.js');
  const filePath = join(__dirname, jsPath);

  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('MTM file not found:', filePath);
      res.status(404).send(`// MTM component not found: ${mtmPath}`);
    }
  });
});

// Route handlers for SSR
const routes = {
  '/': () => import('./src/pages/index.js'),
  '/about': () => import('./src/pages/about.js'),
  '/mtm-example': () => import('./src/pages/mtm-example.js'),
  '/react-example': () => import('./src/pages/react-example.js'),
  '/vue-example': () => import('./src/pages/vue-example.js'),
  '/solid-example': () => import('./src/pages/solid-example.js'),
  '/svelte-example': () => import('./src/pages/svelte-example.js')
};

// SSR middleware
async function renderPage(req, res, next) {
  const path = req.path;

  try {
    // Check if we have a route handler
    const routeHandler = routes[path];
    if (!routeHandler) {
      return next();
    }

    // Load the page module
    const pageModule = await routeHandler();
    const pageContent = pageModule.default();

    // Generate full HTML with SSR content
    const html = generateSSRHTML(path, pageContent);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('SSR Error:', error);
    // Fallback to client-side rendering
    next();
  }
}

// Generate SSR HTML
function generateSSRHTML(path, content) {
  const title = getPageTitle(path);
  const description = getPageDescription(path);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="stylesheet" href="/src/styles/global.css">
  
  <!-- Preload critical resources -->
  <link rel="preload" href="/src/pages${path === '/' ? '/index' : path}.js" as="script">
  
  <!-- Service Worker Registration -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/public/sw.js')
          .then((registration) => {
            console.log('[Main] SW registered:', registration);
          })
          .catch((error) => {
            console.log('[Main] SW registration failed:', error);
          });
      });
    }
  </script>
</head>
<body>
  <div id="app">${content}</div>
  
  <!-- MTM Script Loader -->
  <script type="module">
    // MTM Script Loading System
    class MTMScriptLoader {
      constructor() {
        this.loadedScripts = new Set();
        this.pendingScripts = new Map();
        this.interactionListeners = new Set();
        this.setupServiceWorkerCommunication();
      }
      
      setupServiceWorkerCommunication() {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'MTM_SCRIPT_LOADED') {
              this.executeScript(event.data.scriptUrl, event.data.scriptContent);
            } else if (event.data.type === 'LOAD_ON_INTERACTION') {
              this.setupInteractionLoader(event.data.scriptUrl);
            }
          });
        }
      }
      
      // Load script with different priorities
      loadScript(scriptUrl, priority = 'normal') {
        if (this.loadedScripts.has(scriptUrl)) {
          return Promise.resolve();
        }
        
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          // Use service worker for script loading
          navigator.serviceWorker.controller.postMessage({
            type: 'LOAD_MTM_SCRIPT',
            scriptUrl,
            priority
          });
          
          return new Promise((resolve) => {
            this.pendingScripts.set(scriptUrl, resolve);
          });
        } else {
          // Fallback to direct loading
          return this.loadScriptDirect(scriptUrl);
        }
      }
      
      // Direct script loading fallback
      async loadScriptDirect(scriptUrl) {
        try {
          const response = await fetch(scriptUrl);
          const scriptContent = await response.text();
          this.executeScript(scriptUrl, scriptContent);
        } catch (error) {
          console.error('Failed to load script:', scriptUrl, error);
        }
      }
      
      // Execute loaded script
      executeScript(scriptUrl, scriptContent) {
        try {
          // Use eval in a safer way or Function constructor
          const scriptFunction = new Function(scriptContent);
          scriptFunction();
          
          this.loadedScripts.add(scriptUrl);
          
          // Resolve pending promise
          const resolve = this.pendingScripts.get(scriptUrl);
          if (resolve) {
            resolve();
            this.pendingScripts.delete(scriptUrl);
          }
          
          console.log('[MTM] Script loaded:', scriptUrl);
        } catch (error) {
          console.error('[MTM] Script execution error:', error);
          console.error('[MTM] Script content:', scriptContent);
        }
      }
      
      // Setup interaction-based loading
      setupInteractionLoader(scriptUrl) {
        const loadOnInteraction = () => {
          this.loadScript(scriptUrl, 'normal');
          this.removeInteractionListeners();
        };
        
        const events = ['click', 'keydown', 'touchstart', 'mousemove'];
        events.forEach(event => {
          document.addEventListener(event, loadOnInteraction, { once: true, passive: true });
        });
        
        this.interactionListeners.add(loadOnInteraction);
      }
      
      // Remove interaction listeners
      removeInteractionListeners() {
        this.interactionListeners.forEach(listener => {
          const events = ['click', 'keydown', 'touchstart', 'mousemove'];
          events.forEach(event => {
            document.removeEventListener(event, listener);
          });
        });
        this.interactionListeners.clear();
      }
      
      // Load scripts when browser is idle
      loadOnIdle(scriptUrl) {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            this.loadScript(scriptUrl, 'idle');
          });
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => {
            this.loadScript(scriptUrl, 'idle');
          }, 100);
        }
      }
      
      // Load scripts on interaction
      loadOnInteraction(scriptUrl) {
        this.loadScript(scriptUrl, 'interaction');
      }
    }
    
    // Initialize MTM Script Loader
    window.mtmLoader = new MTMScriptLoader();
    
    // Enhanced navigation with script loading
    function navigate(path) {
      const routes = {
        '/': () => import('/src/pages/index.js'),
        '/about': () => import('/src/pages/about.js'),
        '/mtm-example': () => import('/src/pages/mtm-example.js'),
        '/react-example': () => import('/src/pages/react-example.js'),
        '/vue-example': () => import('/src/pages/vue-example.js'),
        '/solid-example': () => import('/src/pages/solid-example.js'),
        '/svelte-example': () => import('/src/pages/svelte-example.js')
      };
      
      const route = routes[path] || routes['/'];
      
      route().then(module => {
        const app = document.getElementById('app');
        app.innerHTML = module.default();
        
        // Load page-specific scripts on idle
        window.mtmLoader.loadOnIdle(\`/src/pages\${path === '/' ? '/index' : path}.js\`);
        
        // Update browser history
        if (window.location.pathname !== path) {
          history.pushState({}, '', path);
        }
      }).catch(error => {
        console.error('Navigation error:', error);
      });
    }
    
    // Handle anchor tag clicks
    document.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' && e.target.href.startsWith(window.location.origin)) {
        e.preventDefault();
        const path = new URL(e.target.href).pathname;
        navigate(path);
      }
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      navigate(window.location.pathname);
    });
    
    // Load MTM component scripts on interaction
    document.addEventListener('DOMContentLoaded', () => {
      // Load MTM component scripts when user interacts
      const mtmComponents = document.querySelectorAll('[data-mtm-component]');
      mtmComponents.forEach(component => {
        const scriptUrl = component.dataset.mtmComponent;
        window.mtmLoader.loadOnInteraction(scriptUrl);
      });
    });
  </script>
</body>
</html>
  `;
}

// Get page title
function getPageTitle(path) {
  const titles = {
    '/': 'Enhanced MTM Framework',
    '/about': 'About - Enhanced MTM Framework',
    '/mtm-example': 'MTM Components - Enhanced MTM Framework',
    '/react-example': 'React Example - Enhanced MTM Framework',
    '/vue-example': 'Vue Example - Enhanced MTM Framework',
    '/solid-example': 'Solid Example - Enhanced MTM Framework',
    '/svelte-example': 'Svelte Example - Enhanced MTM Framework'
  };

  return titles[path] || 'Enhanced MTM Framework';
}

// Get page description
function getPageDescription(path) {
  const descriptions = {
    '/': 'Enhanced MTM Framework with routing and multi-framework support',
    '/about': 'Learn about the Enhanced MTM Framework capabilities and architecture',
    '/mtm-example': 'Native MTM reactive components with built-in state management',
    '/react-example': 'React components working within the Enhanced MTM Framework',
    '/vue-example': 'Vue components working within the Enhanced MTM Framework',
    '/solid-example': 'Solid.js components working within the Enhanced MTM Framework',
    '/svelte-example': 'Svelte components working within the Enhanced MTM Framework'
  };

  return descriptions[path] || 'Enhanced MTM Framework examples';
}

// Apply SSR middleware to all routes
Object.keys(routes).forEach(route => {
  app.get(route, renderPage);
});

// Fallback to serve index.html for client-side routing
app.get('*', async (req, res) => {
  try {
    const indexPath = join(__dirname, 'dist', 'index.html');
    const html = await fs.readFile(indexPath, 'utf-8');
    res.send(html);
  } catch (error) {
    res.status(404).send('Page not found');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Enhanced MTM Server running at http://localhost:${PORT}`);
  console.log('✨ Features enabled:');
  console.log('  - Server-Side Rendering (SSR)');
  console.log('  - Service Worker script delivery');
  console.log('  - Idle/Interaction-based script loading');
  console.log('  - Multi-framework support');
});

export default app;