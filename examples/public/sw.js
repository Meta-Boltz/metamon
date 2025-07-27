// Enhanced MTM Service Worker - Script delivery and caching
const CACHE_NAME = 'mtm-framework-v1';
const MTM_SCRIPT_CACHE = 'mtm-scripts-v1';

// Files to cache immediately
const STATIC_CACHE_FILES = [
  '/',
  '/index.html',
  '/src/styles/global.css'
];

// MTM script patterns
const MTM_SCRIPT_PATTERNS = [
  /\/src\/components\/.*\.mtm$/,
  /\/src\/pages\/.*\.js$/,
  /mtm-component-/,
  /mtm-function-/
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_CACHE_FILES);
      })
      .then(() => {
        console.log('[SW] Service worker installed');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== MTM_SCRIPT_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle MTM script requests
  if (isMTMScript(url.pathname)) {
    event.respondWith(handleMTMScript(event.request));
    return;
  }

  // Handle page requests for SSR
  if (isPageRequest(url.pathname)) {
    event.respondWith(handlePageRequest(event.request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticAssets(event.request));
});

// Check if request is for MTM script
function isMTMScript(pathname) {
  return MTM_SCRIPT_PATTERNS.some(pattern => pattern.test(pathname));
}

// Check if request is for a page
function isPageRequest(pathname) {
  return pathname === '/' ||
    pathname.startsWith('/about') ||
    pathname.startsWith('/mtm-example') ||
    pathname.startsWith('/react-example') ||
    pathname.startsWith('/vue-example') ||
    pathname.startsWith('/solid-example') ||
    pathname.startsWith('/svelte-example');
}

// Handle MTM script requests - cache and serve on-demand
async function handleMTMScript(request) {
  const cache = await caches.open(MTM_SCRIPT_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    console.log('[SW] Serving MTM script from cache:', request.url);
    return cachedResponse;
  }

  try {
    console.log('[SW] Fetching MTM script:', request.url);
    const response = await fetch(request);

    if (response.ok) {
      // Cache the script for future use
      cache.put(request, response.clone());
      console.log('[SW] Cached MTM script:', request.url);
    }

    return response;
  } catch (error) {
    console.error('[SW] Failed to fetch MTM script:', error);

    // Return a fallback script if available
    return new Response(
      `console.warn('MTM script failed to load: ${request.url}');`,
      {
        headers: { 'Content-Type': 'application/javascript' },
        status: 200
      }
    );
  }
}

// Handle page requests with SSR fallback
async function handlePageRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try to fetch fresh content first (for SSR)
    const response = await fetch(request);

    if (response.ok) {
      // Cache the fresh response
      cache.put(request, response.clone());
      return response;
    }
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
  }

  // Fallback to cached version
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('[SW] Serving page from cache:', request.url);
    return cachedResponse;
  }

  // Ultimate fallback - return basic HTML shell
  return new Response(
    generateHTMLShell(request.url),
    {
      headers: { 'Content-Type': 'text/html' },
      status: 200
    }
  );
}

// Handle static assets
async function handleStaticAssets(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Failed to fetch asset:', error);
    return new Response('Asset not found', { status: 404 });
  }
}

// Generate basic HTML shell for fallback
function generateHTMLShell(url) {
  const path = new URL(url).pathname;
  const title = getPageTitle(path);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/src/styles/global.css">
</head>
<body>
  <div id="app">
    <div class="loading">
      <h1>${title}</h1>
      <p>Loading...</p>
    </div>
  </div>
  
  <script type="module">
    // Load page content dynamically
    const routes = {
      '/': () => import('/src/pages/index.js'),
      '/about': () => import('/src/pages/about.js'),
      '/mtm-example': () => import('/src/pages/mtm-example.js'),
      '/react-example': () => import('/src/pages/react-example.js'),
      '/vue-example': () => import('/src/pages/vue-example.js'),
      '/solid-example': () => import('/src/pages/solid-example.js'),
      '/svelte-example': () => import('/src/pages/svelte-example.js')
    };
    
    async function loadPage() {
      const path = window.location.pathname;
      const route = routes[path] || routes['/'];
      
      try {
        const module = await route();
        document.getElementById('app').innerHTML = module.default();
      } catch (error) {
        console.error('Failed to load page:', error);
        document.getElementById('app').innerHTML = '<div class="error"><h1>Page Load Error</h1><p>Please try refreshing the page.</p></div>';
      }
    }
    
    loadPage();
  </script>
</body>
</html>
  `;
}

// Get page title based on path
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

// Message handling for MTM script loading
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'LOAD_MTM_SCRIPT') {
    const { scriptUrl, priority = 'normal' } = event.data;

    // Handle script loading based on priority
    if (priority === 'idle') {
      // Load when browser is idle
      requestIdleCallback(() => {
        loadMTMScript(scriptUrl);
      });
    } else if (priority === 'interaction') {
      // Load on next user interaction
      loadOnNextInteraction(scriptUrl);
    } else {
      // Load immediately
      loadMTMScript(scriptUrl);
    }
  }
});

// Load MTM script function
async function loadMTMScript(scriptUrl) {
  try {
    const cache = await caches.open(MTM_SCRIPT_CACHE);
    const request = new Request(scriptUrl);

    let response = await cache.match(request);

    if (!response) {
      response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }

    const scriptContent = await response.text();

    // Send script content back to main thread
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'MTM_SCRIPT_LOADED',
          scriptUrl,
          scriptContent
        });
      });
    });

  } catch (error) {
    console.error('[SW] Failed to load MTM script:', scriptUrl, error);
  }
}

// Load script on next user interaction
function loadOnNextInteraction(scriptUrl) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'LOAD_ON_INTERACTION',
        scriptUrl
      });
    });
  });
}

console.log('[SW] MTM Service Worker loaded');