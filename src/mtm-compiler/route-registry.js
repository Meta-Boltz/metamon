/**
 * RouteRegistry - Manages route definitions and resolution for the MTM framework
 * Supports dynamic routes with parameter extraction and conflict detection
 */

const { CompilationError } = require('./error-handling.js');

class RouteRegistry {
  constructor() {
    this.routes = new Map(); // Map<string, RouteConfig>
    this.dynamicRoutes = []; // Array of dynamic route configs for pattern matching
  }

  /**
   * Register a route with the registry
   * @param {string} route - The route path (e.g., "/user/[id]")
   * @param {RouteConfig} config - Route configuration object
   * @throws {Error} If route conflicts exist
   */
  register(route, config) {
    // Validate route format
    if (!route || typeof route !== 'string') {
      throw new Error('Route must be a non-empty string');
    }

    if (!config || !config.file) {
      throw new Error('Route config must include a file property');
    }

    // Normalize route (ensure it starts with /)
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;

    // Check for exact route conflicts
    if (this.routes.has(normalizedRoute)) {
      const existingConfig = this.routes.get(normalizedRoute);
      throw CompilationError.routeConflict(
        normalizedRoute,
        existingConfig.file,
        config.file
      );
    }

    // Parse route parameters
    const params = this.extractParameters(normalizedRoute);
    const isDynamic = params.length > 0;

    // Create route configuration
    const routeConfig = {
      path: normalizedRoute,
      file: config.file,
      component: config.component || this.generateComponentName(config.file),
      metadata: config.metadata || {},
      params: params,
      dynamic: isDynamic,
      pattern: isDynamic ? this.createRoutePattern(normalizedRoute) : null
    };

    // Check for dynamic route conflicts
    if (isDynamic) {
      this.validateDynamicRoute(routeConfig);
      this.dynamicRoutes.push(routeConfig);
    }

    // Register the route
    this.routes.set(normalizedRoute, routeConfig);
  }

  /**
   * Resolve a path to a matching route
   * @param {string} path - The path to resolve
   * @returns {RouteMatch|null} Route match with extracted parameters
   */
  resolve(path) {
    if (!path || typeof path !== 'string') {
      return null;
    }

    // Parse URL to separate path and query string
    const url = new URL(path, 'http://localhost');
    const pathname = url.pathname;
    const query = Object.fromEntries(url.searchParams);

    // Try exact match first
    if (this.routes.has(pathname)) {
      const route = this.routes.get(pathname);
      return {
        route: route,
        params: {},
        query: query
      };
    }

    // Try dynamic route matching
    for (const route of this.dynamicRoutes) {
      const match = this.matchDynamicRoute(route, pathname);
      if (match) {
        return {
          route: route,
          params: match.params,
          query: query
        };
      }
    }

    return null;
  }

  /**
   * Get all registered routes
   * @returns {Map<string, RouteConfig>} All routes
   */
  getAll() {
    return new Map(this.routes);
  }

  /**
   * Validate all routes and return validation results
   * @returns {ValidationResult[]} Array of validation results
   */
  validateRoutes() {
    const results = [];

    // Check for conflicting dynamic routes
    for (let i = 0; i < this.dynamicRoutes.length; i++) {
      for (let j = i + 1; j < this.dynamicRoutes.length; j++) {
        const route1 = this.dynamicRoutes[i];
        const route2 = this.dynamicRoutes[j];

        if (this.routesConflict(route1, route2)) {
          results.push({
            type: 'conflict',
            severity: 'error',
            message: `Dynamic routes "${route1.path}" and "${route2.path}" conflict`,
            routes: [route1.path, route2.path],
            files: [route1.file, route2.file]
          });
        }
      }
    }

    // Validate route patterns
    for (const [path, config] of this.routes) {
      if (config.dynamic && !this.isValidRoutePattern(path)) {
        results.push({
          type: 'invalid-pattern',
          severity: 'error',
          message: `Invalid route pattern: "${path}"`,
          routes: [path],
          files: [config.file]
        });
      }
    }

    return results;
  }

  /**
   * Extract parameter names from a route path
   * @param {string} route - Route path
   * @returns {string[]} Array of parameter names
   */
  extractParameters(route) {
    const params = [];
    const segments = route.split('/');

    for (const segment of segments) {
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const paramName = segment.slice(1, -1);
        params.push(paramName); // Include empty parameter names for validation
      }
    }

    return params;
  }

  /**
   * Create a regex pattern for dynamic route matching
   * @param {string} route - Route path with parameters
   * @returns {RegExp} Regex pattern for matching
   */
  createRoutePattern(route) {
    const segments = route.split('/');
    const patternSegments = segments.map(segment => {
      if (segment.startsWith('[') && segment.endsWith(']')) {
        return '([^/]+)'; // Match any non-slash characters
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
    });

    return new RegExp(`^${patternSegments.join('/')}$`);
  }

  /**
   * Match a dynamic route against a path
   * @param {RouteConfig} route - Dynamic route configuration
   * @param {string} path - Path to match
   * @returns {Object|null} Match result with parameters
   */
  matchDynamicRoute(route, path) {
    const match = route.pattern.exec(path);
    if (!match) {
      return null;
    }

    const params = {};
    for (let i = 0; i < route.params.length; i++) {
      params[route.params[i]] = match[i + 1];
    }

    return { params };
  }

  /**
   * Check if two dynamic routes conflict
   * @param {RouteConfig} route1 - First route
   * @param {RouteConfig} route2 - Second route
   * @returns {boolean} True if routes conflict
   */
  routesConflict(route1, route2) {
    const segments1 = route1.path.split('/');
    const segments2 = route2.path.split('/');

    // Different number of segments means no conflict
    if (segments1.length !== segments2.length) {
      return false;
    }

    // Check each segment
    for (let i = 0; i < segments1.length; i++) {
      const seg1 = segments1[i];
      const seg2 = segments2[i];

      // Both are parameters - potential conflict
      const isParam1 = seg1.startsWith('[') && seg1.endsWith(']');
      const isParam2 = seg2.startsWith('[') && seg2.endsWith(']');

      if (isParam1 && isParam2) {
        continue; // Both parameters, continue checking
      }

      // One is parameter, one is literal - no conflict if different literals
      if (isParam1 || isParam2) {
        continue; // One is parameter, continue checking
      }

      // Both are literals - must match exactly
      if (seg1 !== seg2) {
        return false; // Different literals, no conflict
      }
    }

    return true; // All segments compatible, routes conflict
  }

  /**
   * Validate a dynamic route for conflicts
   * @param {RouteConfig} newRoute - Route to validate
   * @throws {Error} If route conflicts exist
   */
  validateDynamicRoute(newRoute) {
    for (const existingRoute of this.dynamicRoutes) {
      if (this.routesConflict(newRoute, existingRoute)) {
        throw CompilationError.dynamicRouteConflict(
          newRoute.path,
          existingRoute.path,
          newRoute.file,
          existingRoute.file
        );
      }
    }
  }

  /**
   * Check if a route pattern is valid
   * @param {string} route - Route to validate
   * @returns {boolean} True if valid
   */
  isValidRoutePattern(route) {
    // Check for balanced brackets
    let bracketCount = 0;
    for (const char of route) {
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
      if (bracketCount < 0) return false;
    }
    if (bracketCount !== 0) return false;

    // Check for empty parameters
    if (route.includes('[]')) return false;

    // Check for nested brackets
    if (route.includes('[[') || route.includes(']]')) return false;

    return true;
  }

  /**
   * Generate a component name from a file path
   * @param {string} filePath - File path
   * @returns {string} Component name
   */
  generateComponentName(filePath) {
    const fileName = filePath.split('/').pop().replace(/\.[^.]+$/, '');
    return fileName.charAt(0).toUpperCase() + fileName.slice(1) + 'Page';
  }
}

module.exports = { RouteRegistry };