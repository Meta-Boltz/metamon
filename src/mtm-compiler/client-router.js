/**
 * ClientRouter - Client-side routing system for MTM framework
 * Handles navigation, history management, and route change events
 */
class ClientRouter {
  constructor(routeRegistry) {
    this.routeRegistry = routeRegistry;
    this.currentRoute = null;
    this.routeChangeCallbacks = [];
    this.isInitialized = false;

    // Bind methods to preserve context
    this.handlePopState = this.handlePopState.bind(this);
    this.handleLinkClick = this.handleLinkClick.bind(this);
  }

  /**
   * Initialize the router - set up event listeners and handle initial route
   */
  initialize() {
    if (this.isInitialized) return;

    // Set up popstate listener for browser back/forward buttons
    window.addEventListener('popstate', this.handlePopState);

    // Set up click interception for anchor tags
    document.addEventListener('click', this.handleLinkClick);

    // Handle initial route
    this.handleInitialRoute();

    this.isInitialized = true;
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    if (!this.isInitialized) return;

    window.removeEventListener('popstate', this.handlePopState);
    document.removeEventListener('click', this.handleLinkClick);

    this.isInitialized = false;
  }

  /**
   * Navigate to a new route
   * @param {string} path - The path to navigate to
   * @param {Object} options - Navigation options
   */
  navigate(path, options = {}) {
    const { replace = false, state = null, preserveScroll = false } = options;

    // Resolve the route
    const routeMatch = this.routeRegistry.resolve(path);

    if (!routeMatch) {
      throw new Error(`Route not found: ${path}`);
    }

    // Update browser history
    if (replace) {
      window.history.replaceState(state, '', path);
    } else {
      window.history.pushState(state, '', path);
    }

    // Update current route and trigger callbacks
    this.updateCurrentRoute(routeMatch, { preserveScroll });
  }

  /**
   * Navigate back in history
   */
  back() {
    window.history.back();
  }

  /**
   * Navigate forward in history
   */
  forward() {
    window.history.forward();
  }

  /**
   * Replace current route without adding to history
   * @param {string} path - The path to replace with
   * @param {Object} options - Navigation options
   */
  replace(path, options = {}) {
    this.navigate(path, { ...options, replace: true });
  }

  /**
   * Get the current route match
   * @returns {Object|null} Current route match or null
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Register a callback for route changes
   * @param {Function} callback - Callback function to call on route change
   */
  onRouteChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Route change callback must be a function');
    }

    this.routeChangeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.routeChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.routeChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Handle browser popstate events (back/forward buttons)
   * @param {PopStateEvent} event - The popstate event
   */
  handlePopState(event) {
    const path = window.location.pathname + window.location.search;
    const routeMatch = this.routeRegistry.resolve(path);

    if (routeMatch) {
      this.updateCurrentRoute(routeMatch, { fromPopState: true });
    } else {
      // Handle case where route doesn't exist - could redirect to 404
      console.warn(`Route not found during popstate: ${path}`);
    }
  }

  /**
   * Handle click events on anchor tags for link interception
   * @param {MouseEvent} event - The click event
   */
  handleLinkClick(event) {
    // Only handle left clicks
    if (event.button !== 0) return;

    // Don't handle if modifier keys are pressed (allow opening in new tab)
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    // Find the anchor tag (might be nested)
    const anchor = event.target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Skip external links
    if (this.isExternalLink(href)) return;

    // Skip links with data-external attribute
    if (anchor.hasAttribute('data-external')) return;

    // Skip links with target="_blank"
    if (anchor.getAttribute('target') === '_blank') return;

    // Skip links with download attribute
    if (anchor.hasAttribute('download')) return;

    // Check if this is an internal route
    const routeMatch = this.routeRegistry.resolve(href);
    if (!routeMatch) return;

    // Prevent default navigation and handle with router
    event.preventDefault();

    try {
      this.navigate(href);
    } catch (error) {
      console.error('Navigation error:', error);
      // Fall back to normal navigation
      window.location.href = href;
    }
  }

  /**
   * Check if a link is external
   * @param {string} href - The href to check
   * @returns {boolean} True if external link
   */
  isExternalLink(href) {
    // Absolute URLs with protocol
    if (/^https?:\/\//.test(href)) return true;

    // Protocol-relative URLs
    if (/^\/\//.test(href)) return true;

    // mailto, tel, etc.
    if (/^[a-z]+:/.test(href)) return true;

    return false;
  }

  /**
   * Handle the initial route when the router is initialized
   */
  handleInitialRoute() {
    const path = window.location.pathname + window.location.search;
    const routeMatch = this.routeRegistry.resolve(path);

    if (routeMatch) {
      this.updateCurrentRoute(routeMatch, { initial: true });
    } else {
      console.warn(`Initial route not found: ${path}`);
    }
  }

  /**
   * Update the current route and trigger callbacks
   * @param {Object} routeMatch - The new route match
   * @param {Object} options - Update options
   */
  updateCurrentRoute(routeMatch, options = {}) {
    const previousRoute = this.currentRoute;
    this.currentRoute = routeMatch;

    // Trigger route change callbacks
    this.routeChangeCallbacks.forEach(callback => {
      try {
        callback(routeMatch, previousRoute, options);
      } catch (error) {
        console.error('Route change callback error:', error);
      }
    });
  }

  /**
   * Get the current path
   * @returns {string} Current path
   */
  getCurrentPath() {
    return window.location.pathname + window.location.search;
  }

  /**
   * Check if a path matches the current route
   * @param {string} path - Path to check
   * @returns {boolean} True if path matches current route
   */
  isCurrentRoute(path) {
    return this.getCurrentPath() === path;
  }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClientRouter;
} else if (typeof window !== 'undefined') {
  window.ClientRouter = ClientRouter;
}