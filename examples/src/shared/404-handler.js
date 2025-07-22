/**
 * 404 Error Handler for Ultra-Modern MTM Router
 * Provides comprehensive 404 detection, rendering, and search functionality
 */

import { signal } from './signal-system.js';

export class NotFoundHandler {
  constructor(router) {
    this.router = router;
    this.searchIndex = new Map();
    this.suggestions = signal.signal('404-suggestions', []);
    this.searchResults = signal.signal('404-search-results', []);
    this.isSearching = signal.signal('404-is-searching', false);

    // Initialize with default suggestions
    this.initializeDefaultSuggestions();
    this.buildSearchIndex();
  }

  /**
   * Initialize default page suggestions
   */
  initializeDefaultSuggestions() {
    const defaultSuggestions = [
      {
        title: 'Home',
        url: '/',
        description: 'Return to the homepage',
        keywords: ['home', 'main', 'index', 'start'],
        priority: 10
      },
      {
        title: 'Documentation',
        url: '/docs',
        description: 'Learn about Ultra-Modern MTM',
        keywords: ['docs', 'documentation', 'guide', 'help', 'tutorial'],
        priority: 8
      },
      {
        title: 'Performance',
        url: '/performance',
        description: 'View performance benchmarks',
        keywords: ['performance', 'benchmark', 'speed', 'metrics'],
        priority: 6
      }
    ];

    this.suggestions.value = defaultSuggestions;
  }

  /**
   * Build search index from available routes
   */
  buildSearchIndex() {
    // Index static routes
    const staticRoutes = this.router.getRoutes();
    staticRoutes.forEach(route => {
      const routeData = this.router.routes.get(route);
      if (routeData && routeData.metadata) {
        this.indexRoute(route, routeData.metadata);
      }
    });

    // Index dynamic routes
    const dynamicRoutes = this.router.getDynamicRoutes();
    dynamicRoutes.forEach(route => {
      const routeData = this.router.dynamicRoutes.find(r => r.path === route);
      if (routeData && routeData.metadata) {
        this.indexRoute(route, routeData.metadata);
      }
    });

    console.log(`🔍 Built search index with ${this.searchIndex.size} entries`);
  }

  /**
   * Index a route for search
   */
  indexRoute(route, metadata) {
    const searchTerms = [
      route,
      metadata.title || '',
      metadata.description || '',
      ...(metadata.keywords || [])
    ].filter(Boolean);

    const searchData = {
      route,
      title: metadata.title || route,
      description: metadata.description || '',
      keywords: metadata.keywords || [],
      searchTerms: searchTerms.join(' ').toLowerCase()
    };

    this.searchIndex.set(route, searchData);
  }

  /**
   * Detect if a route should show 404
   */
  shouldShow404(pathname) {
    // Check if route exists in router
    const match = this.router.matchRoute(pathname);

    if (!match) {
      console.log(`🚫 404 detected for: ${pathname}`);
      this.logNotFoundEvent(pathname);
      return true;
    }

    return false;
  }

  /**
   * Handle 404 error with proper status code and rendering
   */
  async handle404(pathname, options = {}) {
    const { referrer = '', userAgent = '', timestamp = Date.now() } = options;

    console.log(`🔍 Handling 404 for: ${pathname}`);

    // Log 404 event for analytics
    this.logNotFoundEvent(pathname, { referrer, userAgent, timestamp });

    // Generate suggestions based on the requested path
    const suggestions = this.generateSuggestions(pathname);
    this.suggestions.value = suggestions;

    // Try to navigate to 404 page
    const notFoundRoute = this.router.routes.get('/404');
    if (notFoundRoute) {
      // Update browser URL to show the original path but render 404 content
      if (typeof window !== 'undefined' && !options.replace) {
        window.history.replaceState({ is404: true, originalPath: pathname }, '', pathname);
      }

      // Set proper HTTP status code for SSR
      if (typeof window === 'undefined' && options.response) {
        options.response.status(404);
      }

      // Render 404 page with context
      return this.render404Page(pathname, suggestions);
    } else {
      // Fallback if no 404 page is configured
      return this.renderFallback404(pathname);
    }
  }

  /**
   * Render the 404 page with context
   */
  async render404Page(originalPath, suggestions) {
    const notFoundRoute = this.router.routes.get('/404');

    if (!notFoundRoute.component) {
      const module = await notFoundRoute.loader();
      notFoundRoute.component = module.default || module;
    }

    // Prepare context for 404 page
    const context = {
      originalPath,
      suggestions,
      searchHandler: this.searchSite.bind(this),
      timestamp: new Date().toISOString(),
      referrer: typeof window !== 'undefined' ? document.referrer : ''
    };

    // Update router state
    this.router.currentRoute.value = '/404';
    this.router.currentParams.value = { originalPath };

    // Render the 404 page
    return this.router.renderPage(notFoundRoute, '/404', context);
  }

  /**
   * Render fallback 404 when no 404 page exists
   */
  renderFallback404(pathname) {
    if (typeof window === 'undefined') return;

    const appContainer = document.querySelector('#app') || document.body;
    if (appContainer) {
      appContainer.innerHTML = `
        <div class="fallback-404">
          <h1>404 - Page Not Found</h1>
          <p>The page <code>${pathname}</code> could not be found.</p>
          <div class="fallback-actions">
            <button onclick="window.location.href='/'" class="button primary">
              Go Home
            </button>
            <button onclick="window.history.back()" class="button secondary">
              Go Back
            </button>
          </div>
        </div>
      `;
    }

    // Update document title
    document.title = '404 - Page Not Found';
  }

  /**
   * Generate intelligent suggestions based on the requested path
   */
  generateSuggestions(pathname) {
    const suggestions = [...this.suggestions.value];

    // Try to find similar routes
    const similarRoutes = this.findSimilarRoutes(pathname);

    // Add similar routes to suggestions
    similarRoutes.forEach(route => {
      if (!suggestions.find(s => s.url === route.route)) {
        suggestions.push({
          title: route.title,
          url: route.route,
          description: route.description,
          similarity: route.similarity,
          priority: Math.floor(route.similarity * 10)
        });
      }
    });

    // Sort by priority and similarity
    return suggestions
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, 6); // Limit to 6 suggestions
  }

  /**
   * Find routes similar to the requested path
   */
  findSimilarRoutes(pathname) {
    const similarRoutes = [];
    const pathParts = pathname.toLowerCase().split('/').filter(Boolean);

    this.searchIndex.forEach((data, route) => {
      if (route === '/404') return; // Skip 404 page itself

      const similarity = this.calculateSimilarity(pathname, data);

      if (similarity > 0.3) { // Threshold for similarity
        similarRoutes.push({
          ...data,
          similarity
        });
      }
    });

    return similarRoutes
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }

  /**
   * Calculate similarity between requested path and indexed route
   */
  calculateSimilarity(pathname, routeData) {
    const pathLower = pathname.toLowerCase();
    const searchTerms = routeData.searchTerms;

    // Direct path match
    if (searchTerms.includes(pathLower)) {
      return 1.0;
    }

    // Partial path match
    const pathParts = pathLower.split('/').filter(Boolean);
    let partialMatches = 0;

    pathParts.forEach(part => {
      if (searchTerms.includes(part)) {
        partialMatches++;
      }
    });

    if (partialMatches > 0) {
      return partialMatches / pathParts.length * 0.8;
    }

    // Keyword similarity
    const pathWords = pathLower.replace(/[^a-z0-9]/g, ' ').split(' ').filter(Boolean);
    let keywordMatches = 0;

    pathWords.forEach(word => {
      if (searchTerms.includes(word)) {
        keywordMatches++;
      }
    });

    if (keywordMatches > 0) {
      return keywordMatches / pathWords.length * 0.6;
    }

    // Fuzzy string matching (simple implementation)
    return this.fuzzyMatch(pathLower, routeData.route) * 0.4;
  }

  /**
   * Simple fuzzy string matching
   */
  fuzzyMatch(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Search site content
   */
  async searchSite(query) {
    if (!query || query.trim().length < 2) {
      this.searchResults.value = [];
      return [];
    }

    this.isSearching.value = true;
    const queryLower = query.toLowerCase().trim();

    try {
      const results = [];

      // Search through indexed routes
      this.searchIndex.forEach((data, route) => {
        const relevance = this.calculateSearchRelevance(queryLower, data);

        if (relevance > 0.1) {
          results.push({
            ...data,
            relevance,
            type: 'page'
          });
        }
      });

      // Sort by relevance
      const sortedResults = results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 10);

      this.searchResults.value = sortedResults;

      // Emit search event for analytics
      signal.emit('404-search', {
        query,
        results: sortedResults.length,
        timestamp: Date.now()
      });

      return sortedResults;

    } catch (error) {
      console.error('❌ Search error:', error);
      this.searchResults.value = [];
      return [];
    } finally {
      this.isSearching.value = false;
    }
  }

  /**
   * Calculate search relevance for a route
   */
  calculateSearchRelevance(query, routeData) {
    const searchTerms = routeData.searchTerms;

    // Exact match in title
    if (routeData.title.toLowerCase().includes(query)) {
      return 1.0;
    }

    // Exact match in description
    if (routeData.description.toLowerCase().includes(query)) {
      return 0.8;
    }

    // Keyword match
    const queryWords = query.split(' ').filter(Boolean);
    let keywordScore = 0;

    queryWords.forEach(word => {
      if (searchTerms.includes(word)) {
        keywordScore += 0.3;
      }
    });

    // Partial match
    if (searchTerms.includes(query)) {
      keywordScore += 0.5;
    }

    return Math.min(keywordScore, 1.0);
  }

  /**
   * Log 404 event for analytics and debugging
   */
  logNotFoundEvent(pathname, context = {}) {
    const event = {
      type: '404',
      pathname,
      timestamp: Date.now(),
      referrer: typeof window !== 'undefined' ? document.referrer : '',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
      ...context
    };

    // Emit event for external analytics
    signal.emit('404-detected', event);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('🚫 404 Not Found:', event);
    }

    // Store in session for debugging (client-side only)
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const existing = JSON.parse(sessionStorage.getItem('mtm-404-log') || '[]');
        existing.push(event);

        // Keep only last 50 entries
        const recent = existing.slice(-50);
        sessionStorage.setItem('mtm-404-log', JSON.stringify(recent));
      } catch (error) {
        console.warn('Failed to log 404 event to session storage:', error);
      }
    }
  }

  /**
   * Get 404 analytics data
   */
  get404Analytics() {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return [];
    }

    try {
      return JSON.parse(sessionStorage.getItem('mtm-404-log') || '[]');
    } catch (error) {
      console.warn('Failed to retrieve 404 analytics:', error);
      return [];
    }
  }

  /**
   * Clear 404 analytics data
   */
  clear404Analytics() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('mtm-404-log');
    }
  }

  /**
   * Update search index when routes change
   */
  updateSearchIndex(routes) {
    this.searchIndex.clear();

    routes.forEach(route => {
      if (route.metadata) {
        this.indexRoute(route.path, route.metadata);
      }
    });

    console.log(`🔄 Updated search index with ${this.searchIndex.size} entries`);
  }
}

export function createNotFoundHandler(router) {
  return new NotFoundHandler(router);
}