// MTM Router Configuration - Auto-generated
window.MTM_ROUTES = {
  "/custom-test": {
    "title": "Custom Mode Test",
    "description": "Testing custom JavaScript file compilation",
    "htmlFile": "custom-test.html",
    "jsFile": "custom-app-bundle.js",
    "compilationMode": "custom-app-bundle.js"
  },
  "/default-test": {
    "title": "Default Mode Test",
    "description": "Testing default compilation mode (no compileJsMode specified)",
    "htmlFile": "default-test.html",
    "jsFile": "js/component.js",
    "compilationMode": "external.js"
  },
  "/external-test": {
    "title": "External Mode Test",
    "description": "Testing external JavaScript compilation",
    "htmlFile": "external-test.html",
    "jsFile": "js/component.js",
    "compilationMode": "external.js"
  },
  "/inline-test": {
    "title": "Inline Mode Test",
    "description": "Testing inline JavaScript compilation",
    "htmlFile": "inline-test.html",
    "jsFile": null,
    "compilationMode": "inline"
  }
};

// Enhanced route resolution
if (typeof MTMRouter !== 'undefined') {
  // Register all routes
  Object.keys(window.MTM_ROUTES).forEach(route => {
    MTMRouter._routes.set(route, window.MTM_ROUTES[route]);
  });

  // Enhanced navigation with page loading
  MTMRouter.navigateToPage = async function(path) {
    const routeInfo = window.MTM_ROUTES[path];
    if (!routeInfo) {
      console.warn('Route not found:', path);
      return;
    }

    // Update URL
    window.history.pushState({ path }, routeInfo.title, path);
    
    // Update document title
    document.title = routeInfo.title;

    // Load page content if needed
    if (routeInfo.compilationMode === 'external' && routeInfo.jsFile) {
      // For external JS, we might need to load the page dynamically
      console.log('Loading external page:', path);
    }

    // Emit route change event
    this.emit('route-changed', { path, route: routeInfo });
  };
}

console.log('🔮 MTM Router configuration loaded with', Object.keys(window.MTM_ROUTES).length, 'routes');