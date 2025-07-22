/**
 * Ultra-Modern MTM Router with Code Splitting
 * Enhanced client-side routing with lazy loading, code splitting, and intelligent preloading
 */

import { signal } from './signal-system.js';
import { createNotFoundHandler } from './404-handler.js';
import { createErrorBoundary } from './error-boundary.js';
import { createCodeSplitter } from './code-splitter.js';

class UltraModernRouter {
  constructor() {
    this.routes = new Map();
    this.dynamicRoutes = [];
    this.currentRoute = signal.signal('currentRoute', '/');
    this.currentParams = signal.signal('currentParams', {});
    this.currentQuery = signal.signal('currentQuery', {});
    this.isNavigating = signal.signal('isNavigating', false);
    this.history = [];
    this.routeHandlers = new Map();
    this.beforeNavigationHooks = [];
    this.afterNavigationHooks = [];

    // Initialize 404 handler
    this.notFoundHandler = null;

    // Initialize error boundary
    this.errorBoundary = null;

    // Initialize code splitter for lazy loading
    this.codeSplitter = createCodeSplitter({
      preloadThreshold: 0.6,
      preloadDelay: 150,
      maxConcurrentLoads: 2,
      enablePreloading: true,
      enablePrefetching: true
    });

    // Initialize router
    this.init();
  }

  init() {
    // Register default routes with lazy loading
    this.registerRoute('/', () => import('../pages/index.mtm'), {
      title: 'Home',
      preload: true,
      priority: 'high'
    });
    this.registerRoute('/docs', () => import('../pages/documentation.mtm'), {
      title: 'Documentation',
      preload: true,
      priority: 'high'
    });
    this.registerRoute('/performance', () => import('../pages/performance.mtm'), {
      title: 'Performance',
      priority: 'normal'
    });
    this.registerRoute('/404', () => import('../pages/404.mtm'), {
      title: 'Page Not Found',
      status: 404,
      lazy: false // Don't lazy load error pages
    });

    // Initialize 404 handler after routes are registered
    this.notFoundHandler = createNotFoundHandler(this);

    // Initialize error boundary system
    this.errorBoundary = createErrorBoundary(this);

    // Handle browser navigation
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', (event) => {
        this.handlePopState(event);
      });

      // Handle initial route on page load
      const initialPath = window.location.pathname + window.location.search;
      this.handleRoute(initialPath, { replace: true });

      // Intercept link clicks for client-side navigation
      document.addEventListener('click', (event) => {
        this.handleLinkClick(event);
      });

      // Setup intelligent preloading
      this.setupIntelligentPreloading();
    }
  }

  /**
   * Register a route with the router
   * @param {string} path - Route path (can include parameters like /users/[id])
   * @param {Function} loader - Function that returns a promise resolving to the component
   * @param {Object} metadata - Route metadata (title, description, etc.)
   */
  registerRoute(path, loader, metadata = {}) {
    const routeEntry = {
      path,
      loader,
      component: null,
      metadata: {
        title: '',
        description: '',
        status: 200,
        preload: false,
        lazy: true,
        priority: 'normal',
        ...metadata
      }
    };

    // Create lazy route with code splitter if enabled
    if (routeEntry.metadata.lazy && this.codeSplitter) {
      const lazyRoute = this.codeSplitter.createLazyRoute(loader, {
        preload: routeEntry.metadata.preload,
        priority: routeEntry.metadata.priority,
        chunk: path.replace(/[^a-zA-Z0-9]/g, '_')
      });

      routeEntry.loader = lazyRoute.loader;
      routeEntry.preloadFn = lazyRoute.preload;
      routeEntry.prefetchFn = lazyRoute.prefetch;
      routeEntry.isLazy = true;
    }

    if (this.isDynamicRoute(path)) {
      // Dynamic route with parameters
      const pattern = this.pathToRegex(path);
      const paramNames = this.extractParamNames(path);

      this.dynamicRoutes.push({
        ...routeEntry,
        pattern,
        paramNames,
        isDynamic: true
      });
    } else {
      // Static route
      this.routes.set(path, routeEntry);
    }

    console.log(`📝 Registered route: ${path}${this.isDynamicRoute(path) ? ' (dynamic)' : ''}${routeEntry.isLazy ? ' (lazy)' : ''}`);

    // Update 404 handler search index if it exists
    if (this.notFoundHandler) {
      this.notFoundHandler.updateSearchIndex([...this.routes.values(), ...this.dynamicRoutes]);
    }

    // Preload critical routes
    if (routeEntry.metadata.preload && routeEntry.preloadFn) {
      setTimeout(() => {
        routeEntry.preloadFn();
      }, 100);
    }
  }

  /**
   * Check if a route path contains dynamic parameters
   */
  isDynamicRoute(path) {
    return path.includes('[') && path.includes(']');
  }

  /**
   * Convert a route path to a regex pattern
   */
  pathToRegex(path) {
    // First convert our route parameters to regex groups
    let pattern = path
      .replace(/\[\.\.\.(\w+)\]/g, '(?<$1>.*)')  // [...slug] -> catch-all
      .replace(/\[(\w+)\]/g, '(?<$1>[^/]+)');    // [id] -> single parameter

    // Only escape forward slashes to avoid breaking our regex patterns
    pattern = pattern.replace(/\//g, '\\/');

    return new RegExp(`^${pattern}$`);
  }

  /**
   * Extract parameter names from a route path
   */
  extractParamNames(path) {
    const params = [];

    // Match both [param] and [...param] patterns
    const paramRegex = /\[(?:\.\.\.)?(\w+)\]/g;
    let match;

    while ((match = paramRegex.exec(path)) !== null) {
      params.push(match[1]);
    }

    return params;
  }

  /**
   * Parse URL to extract pathname, search params, and hash
   */
  parseUrl(url) {
    const urlObj = new URL(url, window.location.origin);

    return {
      pathname: urlObj.pathname,
      search: urlObj.search,
      searchParams: Object.fromEntries(urlObj.searchParams.entries()),
      hash: urlObj.hash
    };
  }

  /**
   * Match a path against registered routes
   */
  matchRoute(pathname) {
    // Try static routes first
    if (this.routes.has(pathname)) {
      return {
        route: this.routes.get(pathname),
        params: {},
        isStatic: true
      };
    }

    // Try dynamic routes
    for (const route of this.dynamicRoutes) {
      const match = pathname.match(route.pattern);
      if (match) {
        const params = match.groups || {};
        return {
          route,
          params,
          isStatic: false
        };
      }
    }

    return null;
  }

  /**
   * Setup intelligent preloading based on user behavior
   */
  setupIntelligentPreloading() {
    // Preload routes based on link visibility
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const link = entry.target;
          const href = link.getAttribute('href');

          if (href && href.startsWith('/')) {
            this.preloadRoute(href);
          }
        }
      });
    }, {
      threshold: 0.5,
      rootMargin: '50px'
    });

    // Observe all internal links
    const observeLinks = () => {
      const links = document.querySelectorAll('a[href^="/"]');
      links.forEach(link => {
        if (!link.dataset.observed) {
          link.dataset.observed = 'true';
          observer.observe(link);
        }
      });
    };

    // Initial observation
    observeLinks();

    // Re-observe when DOM changes
    const mutationObserver = new MutationObserver(() => {
      observeLinks();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Preload likely next routes based on current route
    this.afterNavigation((path) => {
      this.preloadLikelyNextRoutes(path);
    });
  }

  /**
   * Preload a route if it exists
   */
  preloadRoute(path) {
    const match = this.matchRoute(path);
    if (match && match.route.preloadFn) {
      match.route.preloadFn();
    }
  }

  /**
   * Preload likely next routes based on current route
   */
  preloadLikelyNextRoutes(currentPath) {
    const likelyRoutes = [];

    // Define route relationships for intelligent preloading
    const routeRelationships = {
      '/': ['/docs', '/performance'],
      '/docs': ['/performance', '/'],
      '/performance': ['/docs', '/']
    };

    if (routeRelationships[currentPath]) {
      likelyRoutes.push(...routeRelationships[currentPath]);
    }

    // Preload likely routes with a delay
    setTimeout(() => {
      likelyRoutes.forEach(route => {
        this.preloadRoute(route);
      });
    }, 1000);
  }

  /**
   * Handle route navigation with enhanced 404 detection and error handling
   */
  async handleRoute(url, options = {}) {
    const { replace = false } = options;
    const { pathname, searchParams } = this.parseUrl(url);

    console.log('🛣️ Navigating to:', pathname, searchParams);

    try {
      // Run before navigation hooks
      for (const hook of this.beforeNavigationHooks) {
        const result = await hook(pathname, searchParams);
        if (result === false) {
          console.log('🚫 Navigation cancelled by hook');
          return false;
        }
      }

      this.isNavigating.value = true;
      signal.emit('route-change-start', { path: pathname, params: searchParams });

      const match = this.matchRoute(pathname);

      if (!match) {
        // Use enhanced 404 handler
        if (this.notFoundHandler && pathname !== '/404') {
          return await this.notFoundHandler.handle404(pathname, {
            referrer: typeof window !== 'undefined' ? document.referrer : '',
            userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
            replace
          });
        } else {
          // Fallback to basic 404 handling
          const notFoundMatch = this.matchRoute('/404');
          if (notFoundMatch) {
            return this.handleRoute('/404', { replace: true });
          } else {
            throw new Error(`No route found for ${pathname} and no 404 page configured`);
          }
        }
      }

      const { route, params } = match;

      // Load component with error handling and code splitting
      if (!route.component) {
        console.log(`📦 Loading ${route.isLazy ? 'lazy ' : ''}component for:`, pathname);
        try {
          const startTime = performance.now();
          const module = await route.loader();
          const loadTime = performance.now() - startTime;

          route.component = module.default || module;

          console.log(`✅ Component loaded in ${loadTime.toFixed(2)}ms`);
        } catch (loadError) {
          // Handle component loading error
          if (this.errorBoundary) {
            const recovery = await this.errorBoundary.handleComponentLoadError(loadError, {
              route: pathname,
              loader: route.loader,
              retryCount: 0
            });

            if (recovery.success && recovery.component) {
              route.component = recovery.component;
            } else {
              throw loadError;
            }
          } else {
            throw loadError;
          }
        }
      }

      // Update router state
      this.currentRoute.value = pathname;
      this.currentParams.value = params;
      this.currentQuery.value = searchParams;

      // Add to history
      this.history.push({
        path: pathname,
        params,
        query: searchParams,
        timestamp: Date.now()
      });

      // Update page content with error handling
      await this.renderPage(route, pathname, params, searchParams);

      // Run after navigation hooks
      for (const hook of this.afterNavigationHooks) {
        await hook(pathname, params, searchParams);
      }

      signal.emit('route-change-complete', {
        path: pathname,
        params,
        query: searchParams
      });

      return true;

    } catch (error) {
      console.error('❌ Route error:', error);

      // Handle navigation error with error boundary
      if (this.errorBoundary) {
        const recovery = await this.errorBoundary.handleNavigationError(error, {
          path: pathname,
          params: searchParams,
          retryCount: 0
        });

        if (recovery.success) {
          return recovery;
        }
      }

      // Fallback error handling
      if (pathname !== '/404' && this.notFoundHandler) {
        return await this.notFoundHandler.handle404(pathname, {
          error: error.message,
          replace: true
        });
      } else if (pathname !== '/404') {
        return this.handleRoute('/404', { replace: true });
      } else {
        // Even 404 failed, show basic error
        this.showFallbackError(error);
        return false;
      }
    } finally {
      this.isNavigating.value = false;
    }
  }

  /**
   * Render page content with error handling
   */
  async renderPage(route, pathname, params = {}, searchParams = {}) {
    if (typeof window === 'undefined') return;

    const appContainer = document.querySelector('#app') || document.body;

    if (route && route.component) {
      try {
        // Update page metadata first
        this.updatePageMeta(route.metadata);

        // For SSR pages, we need to render the HTML
        if (typeof route.component.renderPage === 'function') {
          const pageResult = route.component.renderPage({
            params,
            query: searchParams,
            path: pathname
          });
          if (appContainer) {
            appContainer.innerHTML = pageResult.html;
          }

          // Update document title and meta from page result
          if (pageResult.data) {
            this.updatePageMeta(pageResult.data);
          }
        } else {
          // For regular components
          const element = route.component({
            params,
            query: searchParams,
            path: pathname
          });
          if (appContainer) {
            appContainer.innerHTML = '';
            if (element instanceof HTMLElement) {
              appContainer.appendChild(element);
            } else if (typeof element === 'string') {
              appContainer.innerHTML = element;
            }
          }
        }

        // Re-attach event listeners after DOM update
        this.attachEventListeners();

      } catch (error) {
        console.error('❌ Page render error:', error);

        // Handle render error with error boundary
        if (this.errorBoundary) {
          const recovery = await this.errorBoundary.handleRenderError(error, {
            route: pathname,
            component: route.component,
            params,
            query: searchParams
          });

          if (recovery.success && recovery.component) {
            // Try to render with recovered component
            try {
              const element = recovery.component({
                params,
                query: searchParams,
                path: pathname
              });
              if (appContainer) {
                appContainer.innerHTML = '';
                if (element instanceof HTMLElement) {
                  appContainer.appendChild(element);
                } else if (typeof element === 'string') {
                  appContainer.innerHTML = element;
                }
              }
              return;
            } catch (recoveryError) {
              console.error('Recovery render also failed:', recoveryError);
            }
          }
        }

        // Fallback error UI
        if (appContainer) {
          appContainer.innerHTML = `<div class="error">
            <h2>Failed to load page</h2>
            <p>${error.message}</p>
            <button onclick="window.location.reload()">Reload Page</button>
          </div>`;
        }
      }
    }
  }

  /**
   * Update page metadata (title, description, etc.)
   */
  updatePageMeta(metadata) {
    if (typeof window === 'undefined') return;

    // Update document title
    if (metadata.title) {
      document.title = metadata.title;
    }

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && metadata.description) {
      metaDescription.setAttribute('content', metadata.description);
    }

    // Update meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords && metadata.keywords) {
      const keywords = Array.isArray(metadata.keywords)
        ? metadata.keywords.join(', ')
        : metadata.keywords;
      metaKeywords.setAttribute('content', keywords);
    }
  }

  /**
   * Re-attach event listeners after DOM updates
   */
  attachEventListeners() {
    // Re-attach any event listeners that were lost during DOM update
    const buttons = document.querySelectorAll('button[data-action]');
    buttons.forEach(button => {
      const action = button.getAttribute('data-action');
      if (action && typeof window[action] === 'function') {
        button.addEventListener('click', window[action]);
      }
    });
  }

  /**
   * Handle link clicks for client-side navigation
   */
  handleLinkClick(event) {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) {
      return; // External link or anchor
    }

    // Prevent default navigation
    event.preventDefault();

    // Navigate using our router
    this.push(href);
  }

  /**
   * Handle browser back/forward navigation
   */
  handlePopState(event) {
    const path = window.location.pathname + window.location.search;
    this.handleRoute(path, { replace: true });
  }

  /**
   * Show fallback error when even 404 fails
   */
  showFallbackError(error) {
    if (typeof window === 'undefined') return;

    const appContainer = document.querySelector('#app') || document.body;
    if (appContainer) {
      appContainer.innerHTML = `
        <div class="fallback-error">
          <h1>Application Error</h1>
          <p>Something went wrong and we couldn't load the page.</p>
          <details>
            <summary>Error Details</summary>
            <pre>${error.message}</pre>
          </details>
          <button onclick="window.location.href='/'">Go Home</button>
          <button onclick="window.location.reload()">Reload</button>
        </div>
      `;
    }
  }

  // Public API methods for programmatic navigation

  /**
   * Navigate to a new route (adds to history)
   */
  push(path) {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    return this.handleRoute(path);
  }

  /**
   * Replace current route (doesn't add to history)
   */
  replace(path) {
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', path);
    }
    return this.handleRoute(path, { replace: true });
  }

  /**
   * Go back in history
   */
  back() {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }

  /**
   * Go forward in history
   */
  forward() {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  }

  // Utility methods

  /**
   * Get current route path
   */
  getCurrentRoute() {
    return this.currentRoute.value;
  }

  /**
   * Get current route parameters
   */
  getCurrentParams() {
    return this.currentParams.value;
  }

  /**
   * Get current query parameters
   */
  getCurrentQuery() {
    return this.currentQuery.value;
  }

  /**
   * Get navigation history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Check if a route exists
   */
  hasRoute(path) {
    return this.routes.has(path) || this.matchRoute(path) !== null;
  }

  /**
   * Get all registered static routes
   */
  getRoutes() {
    return Array.from(this.routes.keys());
  }

  /**
   * Get all registered dynamic routes
   */
  getDynamicRoutes() {
    return this.dynamicRoutes.map(route => route.path);
  }

  /**
   * Add a hook that runs before navigation
   */
  beforeNavigation(hook) {
    this.beforeNavigationHooks.push(hook);
  }

  /**
   * Add a hook that runs after navigation
   */
  afterNavigation(hook) {
    this.afterNavigationHooks.push(hook);
  }

  /**
   * Remove a navigation hook
   */
  removeHook(hook) {
    const beforeIndex = this.beforeNavigationHooks.indexOf(hook);
    if (beforeIndex > -1) {
      this.beforeNavigationHooks.splice(beforeIndex, 1);
    }

    const afterIndex = this.afterNavigationHooks.indexOf(hook);
    if (afterIndex > -1) {
      this.afterNavigationHooks.splice(afterIndex, 1);
    }
  }

  /**
   * Get 404 analytics data
   */
  get404Analytics() {
    return this.notFoundHandler ? this.notFoundHandler.get404Analytics() : [];
  }

  /**
   * Clear 404 analytics data
   */
  clear404Analytics() {
    if (this.notFoundHandler) {
      this.notFoundHandler.clear404Analytics();
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return this.errorBoundary ? this.errorBoundary.getErrorStats() : { total: 0, byType: {}, recent: [], criticalCount: 0 };
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    if (this.errorBoundary) {
      this.errorBoundary.clearErrorLog();
    }
  }

  /**
   * Get code splitting statistics
   */
  getCodeSplittingStats() {
    return this.codeSplitter ? this.codeSplitter.getLoadStats() : {};
  }

  /**
   * Clear code splitting cache
   */
  clearCodeSplittingCache() {
    if (this.codeSplitter) {
      this.codeSplitter.clearCache();
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.codeSplitter) {
      this.codeSplitter.destroy();
    }

    if (this.notFoundHandler) {
      this.notFoundHandler.destroy();
    }

    if (this.errorBoundary) {
      this.errorBoundary.destroy();
    }

    console.log('🔒 Ultra-modern router destroyed');
  }
}

// Create global router instance
const router = new UltraModernRouter();

// Export both the instance and the class
export { router, UltraModernRouter };
export default router;

// Global access for development
if (typeof window !== 'undefined') {
  window.router = router;
}