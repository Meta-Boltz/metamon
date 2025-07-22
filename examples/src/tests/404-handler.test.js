/**
 * Tests for 404 Handler
 * Verifies 404 detection, rendering, and search functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createNotFoundHandler } from '../shared/404-handler.js';
import { signal } from '../shared/signal-system.js';

// Mock router for testing
const createMockRouter = () => ({
  routes: new Map([
    ['/', { metadata: { title: 'Home', description: 'Homepage', keywords: ['home', 'main'] } }],
    ['/docs', { metadata: { title: 'Documentation', description: 'Learn about MTM', keywords: ['docs', 'help'] } }],
    ['/404', { metadata: { title: '404 - Not Found', description: 'Page not found', keywords: ['404', 'error'] } }]
  ]),
  dynamicRoutes: [
    {
      path: '/users/[id]',
      metadata: { title: 'User Profile', description: 'User profile page', keywords: ['user', 'profile'] }
    }
  ],
  matchRoute: vi.fn(),
  getRoutes: vi.fn(() => ['/', '/docs', '/404']),
  getDynamicRoutes: vi.fn(() => ['/users/[id]']),
  renderPage: vi.fn(),
  currentRoute: { value: '/' },
  currentParams: { value: {} }
});

// Mock DOM environment
const mockDOM = () => {
  const mockSessionStorage = {
    getItem: vi.fn(() => '[]'),
    setItem: vi.fn(),
    removeItem: vi.fn()
  };

  global.window = {
    sessionStorage: mockSessionStorage,
    document: {
      referrer: 'https://example.com'
    },
    navigator: {
      userAgent: 'Test Browser'
    },
    history: {
      replaceState: vi.fn(),
      pushState: vi.fn()
    }
  };

  global.document = {
    referrer: 'https://example.com',
    title: 'Test Page',
    querySelector: vi.fn()
  };

  global.sessionStorage = mockSessionStorage;
};

describe('NotFoundHandler', () => {
  let router;
  let handler;

  beforeEach(() => {
    mockDOM();
    router = createMockRouter();
    handler = createNotFoundHandler(router);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.window;
    delete global.document;
  });

  describe('404 Detection', () => {
    it('should detect 404 when route does not exist', () => {
      router.matchRoute.mockReturnValue(null);

      const result = handler.shouldShow404('/nonexistent');

      expect(result).toBe(true);
      expect(router.matchRoute).toHaveBeenCalledWith('/nonexistent');
    });

    it('should not detect 404 when route exists', () => {
      router.matchRoute.mockReturnValue({ route: { path: '/docs' } });

      const result = handler.shouldShow404('/docs');

      expect(result).toBe(false);
    });

    it('should log 404 events', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      router.matchRoute.mockReturnValue(null);

      handler.shouldShow404('/missing-page');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚫 404 detected for: /missing-page')
      );
    });
  });

  describe('Search Index', () => {
    it('should build search index from routes', () => {
      expect(handler.searchIndex.size).toBeGreaterThan(0);
      expect(handler.searchIndex.has('/')).toBe(true);
      expect(handler.searchIndex.has('/docs')).toBe(true);
    });

    it('should index route metadata correctly', () => {
      const homeData = handler.searchIndex.get('/');

      expect(homeData).toEqual({
        route: '/',
        title: 'Home',
        description: 'Homepage',
        keywords: ['home', 'main'],
        searchTerms: expect.stringContaining('home')
      });
    });

    it('should update search index when routes change', () => {
      const newRoutes = [
        { path: '/new-page', metadata: { title: 'New Page', description: 'A new page', keywords: ['new'] } }
      ];

      handler.updateSearchIndex(newRoutes);

      expect(handler.searchIndex.has('/new-page')).toBe(true);
      expect(handler.searchIndex.has('/')).toBe(false); // Old routes cleared
    });
  });

  describe('Search Functionality', () => {
    it('should search routes by title', async () => {
      const results = await handler.searchSite('home');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Home');
      expect(results[0].relevance).toBeGreaterThan(0);
    });

    it('should search routes by keywords', async () => {
      const results = await handler.searchSite('docs');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Documentation');
    });

    it('should return empty results for short queries', async () => {
      const results = await handler.searchSite('a');

      expect(results).toHaveLength(0);
    });

    it('should return empty results for empty queries', async () => {
      const results = await handler.searchSite('');

      expect(results).toHaveLength(0);
    });

    it('should sort results by relevance', async () => {
      // Add more routes to test sorting
      handler.indexRoute('/test1', { title: 'Test Page', description: 'A test page', keywords: ['test'] });
      handler.indexRoute('/test2', { title: 'Another Test', description: 'Another test page', keywords: ['test', 'another'] });

      const results = await handler.searchSite('test');

      expect(results.length).toBeGreaterThan(1);
      expect(results[0].relevance).toBeGreaterThanOrEqual(results[1].relevance);
    });

    it('should emit search events', async () => {
      const emitSpy = vi.spyOn(signal, 'emit');

      await handler.searchSite('documentation');

      expect(emitSpy).toHaveBeenCalledWith('404-search', {
        query: 'documentation',
        results: expect.any(Number),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Suggestions Generation', () => {
    it('should generate default suggestions', () => {
      const suggestions = handler.suggestions.value;

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].title).toBe('Home');
      expect(suggestions[1].title).toBe('Documentation');
    });

    it('should generate intelligent suggestions based on path', () => {
      const suggestions = handler.generateSuggestions('/documentation');

      // Should include similar routes
      expect(suggestions.some(s => s.title === 'Documentation')).toBe(true);
    });

    it('should limit suggestions to 6 items', () => {
      // Add many routes to test limit
      for (let i = 0; i < 10; i++) {
        handler.indexRoute(`/page${i}`, {
          title: `Page ${i}`,
          description: `Description ${i}`,
          keywords: [`page${i}`]
        });
      }

      const suggestions = handler.generateSuggestions('/random');

      expect(suggestions.length).toBeLessThanOrEqual(6);
    });
  });

  describe('Similarity Calculation', () => {
    it('should calculate high similarity for exact matches', () => {
      const routeData = {
        route: '/docs',
        searchTerms: '/docs documentation help'
      };

      const similarity = handler.calculateSimilarity('/docs', routeData);

      expect(similarity).toBe(1.0);
    });

    it('should calculate partial similarity for keyword matches', () => {
      const routeData = {
        route: '/documentation',
        searchTerms: '/documentation docs help guide'
      };

      const similarity = handler.calculateSimilarity('/docs', routeData);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1.0);
    });

    it('should return low similarity for unrelated paths', () => {
      const routeData = {
        route: '/performance',
        searchTerms: '/performance benchmark speed'
      };

      const similarity = handler.calculateSimilarity('/documentation', routeData);

      expect(similarity).toBeLessThan(0.5);
    });
  });

  describe('Analytics', () => {
    it('should log 404 events to session storage', () => {
      handler.logNotFoundEvent('/missing-page', { referrer: 'https://example.com' });

      expect(global.window.sessionStorage.setItem).toHaveBeenCalledWith(
        'mtm-404-log',
        expect.stringContaining('/missing-page')
      );
    });

    it('should retrieve 404 analytics', () => {
      global.window.sessionStorage.getItem.mockReturnValue(JSON.stringify([
        { pathname: '/test', timestamp: Date.now() }
      ]));

      const analytics = handler.get404Analytics();

      expect(analytics.length).toBeGreaterThanOrEqual(1);
      expect(analytics.some(a => a.pathname === '/test')).toBe(true);
    });

    it('should clear 404 analytics', () => {
      handler.clear404Analytics();

      expect(global.window.sessionStorage.removeItem).toHaveBeenCalledWith('mtm-404-log');
    });

    it('should handle session storage errors gracefully', () => {
      global.window.sessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      const consoleSpy = vi.spyOn(console, 'warn');

      handler.logNotFoundEvent('/test');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log 404 event to session storage:'),
        expect.any(Error)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      // Mock an error in search
      handler.searchIndex.forEach = vi.fn(() => {
        throw new Error('Search error');
      });

      const consoleSpy = vi.spyOn(console, 'error');
      const results = await handler.searchSite('test');

      expect(results).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Search error:'),
        expect.any(Error)
      );
    });

    it('should handle missing session storage', () => {
      delete global.window.sessionStorage;

      const analytics = handler.get404Analytics();

      expect(analytics).toHaveLength(0);
    });
  });

  describe('String Similarity', () => {
    it('should calculate Levenshtein distance correctly', () => {
      const distance = handler.levenshteinDistance('kitten', 'sitting');

      expect(distance).toBe(3);
    });

    it('should calculate fuzzy match scores', () => {
      const score = handler.fuzzyMatch('documentation', 'docs');

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('should return 1.0 for identical strings', () => {
      const score = handler.fuzzyMatch('test', 'test');

      expect(score).toBe(1.0);
    });
  });
});

describe('404 Handler Integration', () => {
  let router;
  let handler;

  beforeEach(() => {
    mockDOM();
    router = createMockRouter();
    handler = createNotFoundHandler(router);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.window;
    delete global.document;
  });

  it('should integrate with router for 404 handling', async () => {
    router.matchRoute.mockReturnValue(null);
    router.routes.set('/404', {
      loader: vi.fn().mockResolvedValue({ default: vi.fn() }),
      component: null,
      metadata: { title: '404 - Not Found' }
    });

    const result = await handler.handle404('/nonexistent');

    expect(router.renderPage).toHaveBeenCalled();
  });

  it('should update router state during 404 handling', async () => {
    router.matchRoute.mockReturnValue(null);
    router.routes.set('/404', {
      loader: vi.fn().mockResolvedValue({ default: vi.fn() }),
      component: vi.fn(),
      metadata: { title: '404 - Not Found' }
    });

    await handler.handle404('/missing');

    expect(router.currentRoute.value).toBe('/404');
    expect(router.currentParams.value).toEqual({ originalPath: '/missing' });
  });

  it('should provide fallback when no 404 page exists', async () => {
    router.matchRoute.mockReturnValue(null);
    router.routes.delete('/404');

    // Mock DOM for fallback rendering
    const mockContainer = { innerHTML: '' };
    global.document.querySelector = vi.fn(() => mockContainer);

    await handler.handle404('/missing');

    expect(mockContainer.innerHTML).toContain('404 - Page Not Found');
    expect(mockContainer.innerHTML).toContain('/missing');
  });
});