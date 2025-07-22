/**
 * Core Router Tests for Task 5.1
 * Testing route registration, matching, history API integration, and navigation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UltraModernRouter } from '../shared/ultra-modern-router.js';

// Mock DOM and window objects
const mockWindow = {
  location: {
    pathname: '/',
    search: '',
    origin: 'http://localhost:3000'
  },
  history: {
    pushState: vi.fn(),
    replaceState: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  },
  addEventListener: vi.fn(),
  URL: class MockURL {
    constructor(url, base) {
      const fullUrl = url.startsWith('http') ? url : base + url;
      const urlParts = fullUrl.split('?');
      this.pathname = urlParts[0].replace('http://localhost:3000', '');
      this.search = urlParts[1] ? '?' + urlParts[1] : '';
      this.searchParams = new URLSearchParams(urlParts[1] || '');
      this.hash = '';
      this.origin = 'http://localhost:3000';
    }
  }
};

const mockDocument = {
  querySelector: vi.fn(() => ({ innerHTML: '' })),
  addEventListener: vi.fn(),
  title: '',
  querySelectorAll: vi.fn(() => [])
};

// Mock signal system
vi.mock('../shared/signal-system.js', () => ({
  signal: {
    signal: vi.fn((name, value) => ({ value })),
    emit: vi.fn()
  }
}));

describe('UltraModernRouter - Task 5.1 Core Router Implementation', () => {
  let router;
  let originalWindow;
  let originalDocument;

  beforeEach(() => {
    // Setup mocks
    originalWindow = global.window;
    originalDocument = global.document;
    global.window = mockWindow;
    global.document = mockDocument;
    global.URL = mockWindow.URL;

    // Reset mocks
    vi.clearAllMocks();

    // Create fresh router instance
    router = new UltraModernRouter();

    // Clear default routes for clean testing
    router.routes.clear();
    router.dynamicRoutes = [];
    router.history = [];
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
  });

  describe('Route Registration and Matching System', () => {
    it('should register static routes correctly', () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      const metadata = { title: 'Test Page' };

      router.registerRoute('/test', loader, metadata);

      expect(router.hasRoute('/test')).toBe(true);
      expect(router.getRoutes()).toContain('/test');

      const route = router.routes.get('/test');
      expect(route.path).toBe('/test');
      expect(route.metadata.title).toBe('Test Page');
    });

    it('should register dynamic routes with parameters', () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'user' }));

      router.registerRoute('/users/[id]', loader);

      expect(router.getDynamicRoutes()).toContain('/users/[id]');
      expect(router.hasRoute('/users/123')).toBe(true);

      const dynamicRoute = router.dynamicRoutes[0];
      expect(dynamicRoute.path).toBe('/users/[id]');
      expect(dynamicRoute.paramNames).toEqual(['id']);
    });

    it('should register catch-all routes', () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'blog' }));

      router.registerRoute('/blog/[...slug]', loader);

      expect(router.getDynamicRoutes()).toContain('/blog/[...slug]');
      expect(router.hasRoute('/blog/2023/my-post')).toBe(true);

      const dynamicRoute = router.dynamicRoutes[0];
      expect(dynamicRoute.paramNames).toEqual(['slug']);
    });

    it('should match static routes correctly', () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      router.registerRoute('/test', loader);

      const match = router.matchRoute('/test');

      expect(match).toBeTruthy();
      expect(match.isStatic).toBe(true);
      expect(match.params).toEqual({});
      expect(match.route.path).toBe('/test');
    });

    it('should match dynamic routes and extract parameters', () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'user' }));
      router.registerRoute('/users/[id]', loader);

      const match = router.matchRoute('/users/123');

      expect(match).toBeTruthy();
      expect(match.isStatic).toBe(false);
      expect(match.params).toEqual({ id: '123' });
    });

    it('should match catch-all routes and extract slug parameters', () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'blog' }));
      router.registerRoute('/blog/[...slug]', loader);

      const match = router.matchRoute('/blog/2023/my-post/comments');

      expect(match).toBeTruthy();
      expect(match.params).toEqual({ slug: '2023/my-post/comments' });
    });

    it('should return null for non-matching routes', () => {
      const match = router.matchRoute('/non-existent');
      expect(match).toBeNull();
    });
  });

  describe('URL Parsing and Query String Support', () => {
    it('should parse URL with query parameters', () => {
      const parsed = router.parseUrl('/test?param1=value1&param2=value2');

      expect(parsed.pathname).toBe('/test');
      expect(parsed.search).toBe('?param1=value1&param2=value2');
      expect(parsed.searchParams).toEqual({
        param1: 'value1',
        param2: 'value2'
      });
    });

    it('should parse URL without query parameters', () => {
      const parsed = router.parseUrl('/test');

      expect(parsed.pathname).toBe('/test');
      expect(parsed.search).toBe('');
      expect(parsed.searchParams).toEqual({});
    });

    it('should handle complex query parameters', () => {
      const parsed = router.parseUrl('/search?q=hello%20world&category=tech&sort=date');

      expect(parsed.searchParams).toEqual({
        q: 'hello world',
        category: 'tech',
        sort: 'date'
      });
    });
  });

  describe('Programmatic Navigation (History API Integration)', () => {
    it('should support push navigation', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      router.registerRoute('/test', loader);

      await router.push('/test');

      expect(mockWindow.history.pushState).toHaveBeenCalledWith({}, '', '/test');
    });

    it('should support replace navigation', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      router.registerRoute('/test', loader);

      await router.replace('/test');

      expect(mockWindow.history.replaceState).toHaveBeenCalledWith({}, '', '/test');
    });

    it('should support back navigation', () => {
      router.back();
      expect(mockWindow.history.back).toHaveBeenCalled();
    });

    it('should support forward navigation', () => {
      router.forward();
      expect(mockWindow.history.forward).toHaveBeenCalled();
    });
  });

  describe('Route Parameters and State Management', () => {
    it('should update current route state on navigation', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      router.registerRoute('/test', loader);

      await router.handleRoute('/test');

      expect(router.getCurrentRoute()).toBe('/test');
    });

    it('should update current params state for dynamic routes', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'user' }));
      router.registerRoute('/users/[id]', loader);

      await router.handleRoute('/users/123');

      expect(router.getCurrentParams()).toEqual({ id: '123' });
    });

    it('should update current query state', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      router.registerRoute('/test', loader);

      await router.handleRoute('/test?param=value');

      expect(router.getCurrentQuery()).toEqual({ param: 'value' });
    });

    it('should maintain navigation history', async () => {
      const loader1 = vi.fn(() => Promise.resolve({ default: () => 'page1' }));
      const loader2 = vi.fn(() => Promise.resolve({ default: () => 'page2' }));

      router.registerRoute('/page1', loader1);
      router.registerRoute('/page2', loader2);

      await router.handleRoute('/page1');
      await router.handleRoute('/page2');

      const history = router.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].path).toBe('/page1');
      expect(history[1].path).toBe('/page2');
    });
  });

  describe('Navigation Hooks', () => {
    it('should run before navigation hooks', async () => {
      const beforeHook = vi.fn(() => true);
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));

      router.beforeNavigation(beforeHook);
      router.registerRoute('/test', loader);

      await router.handleRoute('/test');

      expect(beforeHook).toHaveBeenCalledWith('/test', {});
    });

    it('should cancel navigation if before hook returns false', async () => {
      const beforeHook = vi.fn(() => false);
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));

      router.beforeNavigation(beforeHook);
      router.registerRoute('/test', loader);

      const result = await router.handleRoute('/test');

      expect(result).toBe(false);
      expect(loader).not.toHaveBeenCalled();
    });

    it('should run after navigation hooks', async () => {
      const afterHook = vi.fn();
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));

      router.afterNavigation(afterHook);
      router.registerRoute('/test', loader);

      await router.handleRoute('/test');

      expect(afterHook).toHaveBeenCalledWith('/test', {}, {});
    });

    it('should remove navigation hooks', () => {
      const hook = vi.fn();

      router.beforeNavigation(hook);
      router.removeHook(hook);

      expect(router.beforeNavigationHooks).not.toContain(hook);
    });
  });

  describe('Route Path Conversion', () => {
    it('should convert simple dynamic routes to regex', () => {
      const regex = router.pathToRegex('/users/[id]');

      expect(regex.test('/users/123')).toBe(true);
      expect(regex.test('/users/abc')).toBe(true);
      expect(regex.test('/users/123/posts')).toBe(false);
      expect(regex.test('/other/123')).toBe(false);
    });

    it('should convert catch-all routes to regex', () => {
      const regex = router.pathToRegex('/blog/[...slug]');

      expect(regex.test('/blog/2023')).toBe(true);
      expect(regex.test('/blog/2023/my-post')).toBe(true);
      expect(regex.test('/blog/2023/my-post/comments')).toBe(true);
      expect(regex.test('/other/path')).toBe(false);
    });

    it('should extract parameter names correctly', () => {
      expect(router.extractParamNames('/users/[id]')).toEqual(['id']);
      expect(router.extractParamNames('/users/[id]/posts/[postId]')).toEqual(['id', 'postId']);
      expect(router.extractParamNames('/blog/[...slug]')).toEqual(['slug']);
      expect(router.extractParamNames('/static/path')).toEqual([]);
    });
  });

  describe('Requirements Verification for Task 5.1', () => {
    it('should meet requirement 3.1: client-side navigation without full page reload', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      router.registerRoute('/test', loader);

      await router.push('/test');

      // Should use history API instead of full page reload
      expect(mockWindow.history.pushState).toHaveBeenCalled();
      expect(loader).toHaveBeenCalled();
    });

    it('should meet requirement 3.2: smooth content updates with loading states', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      router.registerRoute('/test', loader);

      const navigationPromise = router.handleRoute('/test');

      // Should show loading state
      expect(router.isNavigating.value).toBe(true);

      await navigationPromise;

      // Should clear loading state
      expect(router.isNavigating.value).toBe(false);
    });

    it('should meet requirement 3.3: browser back/forward button support', () => {
      const popstateHandler = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'popstate')?.[1];

      expect(popstateHandler).toBeDefined();

      // Simulate popstate event
      mockWindow.location.pathname = '/test';
      const handleRouteSpy = vi.spyOn(router, 'handleRoute');

      popstateHandler({ state: {} });

      expect(handleRouteSpy).toHaveBeenCalledWith('/test', { replace: true });
    });

    it('should meet requirement 3.4: bookmark and refresh support', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      router.registerRoute('/test', loader);

      // Simulate page refresh with specific URL
      mockWindow.location.pathname = '/test';
      mockWindow.location.search = '?param=value';

      // Router should handle initial route on init
      await router.handleRoute('/test?param=value', { replace: true });

      expect(router.getCurrentRoute()).toBe('/test');
      expect(router.getCurrentQuery()).toEqual({ param: 'value' });
    });
  });
});