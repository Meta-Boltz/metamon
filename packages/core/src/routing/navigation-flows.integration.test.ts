/**
 * Integration Tests for Navigation Flows and User Interactions
 * Tests complete navigation scenarios and user interaction flows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock DOM environment
const mockWindow = {
  location: {
    pathname: '/',
    search: '',
    hash: '',
    href: 'http://localhost:3000/',
    origin: 'http://localhost:3000'
  },
  history: {
    pushState: vi.fn(),
    replaceState: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    state: null
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  document: {
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(),
    addEventListener: vi.fn(),
    createElement: vi.fn(() => ({
      innerHTML: '',
      className: '',
      style: {},
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn()
    }))
  }
};

// Mock global window
Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

// Mock router implementation for integration testing
class IntegratedRouter {
  private routes = new Map();
  private dynamicRoutes: any[] = [];
  private currentRoute = '/';
  private currentParams = {};
  private currentQuery = {};
  private isNavigating = false;
  private history: any[] = [];
  private beforeNavigationHooks: any[] = [];
  private afterNavigationHooks: any[] = [];
  private errorHandler: any = null;
  private notFoundHandler: any = null;
  private loadingStates = new Map();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    mockWindow.addEventListener('popstate', this.handlePopState.bind(this));
    mockWindow.document.addEventListener('click', this.handleLinkClick.bind(this));
  }

  private handlePopState(event: any) {
    const path = mockWindow.location.pathname + mockWindow.location.search;
    this.navigate(path, { skipHooks: false, fromPopState: true });
  }

  private handleLinkClick(event: any) {
    const target = event.target;
    if (target.tagName === 'A' && target.href) {
      const url = new URL(target.href);
      if (url.origin === mockWindow.location.origin) {
        event.preventDefault();
        this.navigate(url.pathname + url.search);
      }
    }
  }

  registerRoute(path: string, loader: any, metadata: any = {}) {
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
        ...metadata
      }
    };

    if (this.isDynamicRoute(path)) {
      const pattern = this.pathToRegex(path);
      const paramNames = this.extractParamNames(path);

      this.dynamicRoutes.push({
        ...routeEntry,
        pattern,
        paramNames,
        isDynamic: true
      });
    } else {
      this.routes.set(path, routeEntry);
    }
  }

  private isDynamicRoute(path: string): boolean {
    return path.includes('[') && path.includes(']');
  }

  private pathToRegex(path: string): RegExp {
    let pattern = path
      .replace(/\[\.\.\.(\w+)\]/g, '(?<$1>.*)')
      .replace(/\[(\w+)\]/g, '(?<$1>[^/]+)');
    
    pattern = pattern.replace(/\//g, '\\/');
    return new RegExp(`^${pattern}$`);
  }

  private extractParamNames(path: string): string[] {
    const params: string[] = [];
    const paramRegex = /\[(?:\.\.\.)?(\w+)\]/g;
    let match;

    while ((match = paramRegex.exec(path)) !== null) {
      params.push(match[1]);
    }

    return params;
  }

  private matchRoute(pathname: string) {
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

  async navigate(path: string, options: any = {}) {
    const { replace = false, skipHooks = false, fromPopState = false } = options;

    try {
      // Run before navigation hooks
      if (!skipHooks) {
        for (const hook of this.beforeNavigationHooks) {
          const result = await hook(path, { fromPopState });
          if (result === false) {
            return { success: false, reason: 'cancelled_by_hook' };
          }
        }
      }

      this.isNavigating = true;
      this.loadingStates.set(path, true);

      // Parse URL
      const url = new URL(path, mockWindow.location.origin);
      const pathname = url.pathname;
      const searchParams = Object.fromEntries(url.searchParams.entries());

      // Match route
      const match = this.matchRoute(pathname);

      if (!match) {
        if (this.notFoundHandler) {
          return await this.notFoundHandler.handle404(pathname);
        } else {
          throw new Error(`No route found for ${pathname}`);
        }
      }

      const { route, params } = match;

      // Load component if needed
      if (!route.component && route.loader) {
        try {
          const module = await route.loader();
          route.component = module.default || module;
        } catch (error) {
          if (this.errorHandler) {
            return await this.errorHandler.handleComponentLoadError(error, route.path);
          }
          throw error;
        }
      }

      // Update router state
      this.currentRoute = pathname;
      this.currentParams = params;
      this.currentQuery = searchParams;

      // Update browser history
      if (!fromPopState) {
        if (replace) {
          mockWindow.history.replaceState({ path }, '', path);
        } else {
          mockWindow.history.pushState({ path }, '', path);
        }
        mockWindow.location.pathname = pathname;
        mockWindow.location.search = url.search;
        mockWindow.location.href = url.href;
      }

      // Add to internal history
      this.history.push({
        path,
        timestamp: Date.now(),
        params,
        query: searchParams
      });

      // Run after navigation hooks
      if (!skipHooks) {
        for (const hook of this.afterNavigationHooks) {
          await hook(path, { params, query: searchParams });
        }
      }

      this.isNavigating = false;
      this.loadingStates.set(path, false);

      return {
        success: true,
        route: pathname,
        params,
        query: searchParams,
        component: route.component
      };

    } catch (error: any) {
      this.isNavigating = false;
      this.loadingStates.set(path, false);

      if (this.errorHandler) {
        return await this.errorHandler.handleNavigationError(error, path);
      }

      throw error;
    }
  }

  async back() {
    mockWindow.history.back();
    // Simulate popstate event
    await this.handlePopState({ state: mockWindow.history.state });
  }

  async forward() {
    mockWindow.history.forward();
    // Simulate popstate event
    await this.handlePopState({ state: mockWindow.history.state });
  }

  getCurrentRoute() {
    return {
      path: this.currentRoute,
      params: this.currentParams,
      query: this.currentQuery
    };
  }

  isLoading(path?: string) {
    if (path) {
      return this.loadingStates.get(path) || false;
    }
    return this.isNavigating;
  }

  addBeforeNavigationHook(hook: any) {
    this.beforeNavigationHooks.push(hook);
  }

  addAfterNavigationHook(hook: any) {
    this.afterNavigationHooks.push(hook);
  }

  setErrorHandler(handler: any) {
    this.errorHandler = handler;
  }

  setNotFoundHandler(handler: any) {
    this.notFoundHandler = handler;
  }

  getHistory() {
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
  }

  destroy() {
    mockWindow.removeEventListener('popstate', this.handlePopState);
    mockWindow.document.removeEventListener('click', this.handleLinkClick);
    this.routes.clear();
    this.dynamicRoutes = [];
    this.beforeNavigationHooks = [];
    this.afterNavigationHooks = [];
    this.loadingStates.clear();
  }
}

// Mock components for testing
const createMockComponent = (name: string, content: string = '') => {
  return () => ({
    name,
    render: () => `<div class="${name.toLowerCase()}">${content}</div>`,
    mount: vi.fn(),
    unmount: vi.fn()
  });
};

const createAsyncMockComponent = (name: string, delay: number = 100) => {
  return () => new Promise(resolve => {
    setTimeout(() => {
      resolve(createMockComponent(name)());
    }, delay);
  });
};

// Mock error handler
class MockErrorHandler {
  private errors: any[] = [];

  async handleNavigationError(error: any, path: string) {
    this.errors.push({ type: 'navigation', error, path, timestamp: Date.now() });
    return {
      success: false,
      error: error.message,
      path,
      fallback: '/error'
    };
  }

  async handleComponentLoadError(error: any, path: string) {
    this.errors.push({ type: 'component_load', error, path, timestamp: Date.now() });
    return {
      success: false,
      error: error.message,
      path,
      fallback: '/error'
    };
  }

  async handle404(path: string) {
    this.errors.push({ type: '404', path, timestamp: Date.now() });
    return {
      success: true,
      route: '/404',
      params: { originalPath: path },
      component: createMockComponent('NotFound', `Page not found: ${path}`)()
    };
  }

  getErrors() {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
  }
}

describe('Navigation Flows Integration', () => {
  let router: IntegratedRouter;
  let errorHandler: MockErrorHandler;

  beforeEach(() => {
    router = new IntegratedRouter();
    errorHandler = new MockErrorHandler();
    router.setErrorHandler(errorHandler);
    router.setNotFoundHandler(errorHandler);

    // Reset mock window state
    mockWindow.location.pathname = '/';
    mockWindow.location.search = '';
    mockWindow.location.href = 'http://localhost:3000/';
    mockWindow.history.state = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    router.destroy();
    errorHandler.clearErrors();
  });

  describe('Basic Navigation', () => {
    beforeEach(() => {
      // Register test routes
      router.registerRoute('/', () => createMockComponent('Home'), { title: 'Home' });
      router.registerRoute('/about', () => createMockComponent('About'), { title: 'About' });
      router.registerRoute('/contact', () => createMockComponent('Contact'), { title: 'Contact' });
    });

    it('should navigate to static routes successfully', async () => {
      const result = await router.navigate('/about');

      expect(result.success).toBe(true);
      expect(result.route).toBe('/about');
      expect(result.component.name).toBe('About');
      expect(mockWindow.history.pushState).toHaveBeenCalledWith({ path: '/about' }, '', '/about');
    });

    it('should handle programmatic navigation', async () => {
      await router.navigate('/');
      expect(router.getCurrentRoute().path).toBe('/');

      await router.navigate('/about');
      expect(router.getCurrentRoute().path).toBe('/about');

      await router.navigate('/contact');
      expect(router.getCurrentRoute().path).toBe('/contact');
    });

    it('should handle replace navigation', async () => {
      await router.navigate('/about', { replace: true });

      expect(result.success).toBe(true);
      expect(mockWindow.history.replaceState).toHaveBeenCalledWith({ path: '/about' }, '', '/about');
      expect(mockWindow.history.pushState).not.toHaveBeenCalled();
    });

    it('should handle browser back/forward navigation', async () => {
      await router.navigate('/about');
      await router.navigate('/contact');

      await router.back();
      expect(router.getCurrentRoute().path).toBe('/about');

      await router.forward();
      expect(router.getCurrentRoute().path).toBe('/contact');
    });

    it('should maintain navigation history', async () => {
      await router.navigate('/');
      await router.navigate('/about');
      await router.navigate('/contact');

      const history = router.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].path).toBe('/');
      expect(history[1].path).toBe('/about');
      expect(history[2].path).toBe('/contact');
    });
  });

  describe('Dynamic Route Navigation', () => {
    beforeEach(() => {
      router.registerRoute('/users/[id]', () => createMockComponent('UserProfile'), { title: 'User Profile' });
      router.registerRoute('/blog/[...slug]', () => createMockComponent('BlogPost'), { title: 'Blog Post' });
      router.registerRoute('/products/[category]/[id]', () => createMockComponent('Product'), { title: 'Product' });
    });

    it('should navigate to dynamic routes with single parameter', async () => {
      const result = await router.navigate('/users/123');

      expect(result.success).toBe(true);
      expect(result.route).toBe('/users/123');
      expect(result.params).toEqual({ id: '123' });
      expect(result.component.name).toBe('UserProfile');
    });

    it('should navigate to catch-all routes', async () => {
      const result = await router.navigate('/blog/2024/01/my-first-post');

      expect(result.success).toBe(true);
      expect(result.route).toBe('/blog/2024/01/my-first-post');
      expect(result.params).toEqual({ slug: '2024/01/my-first-post' });
      expect(result.component.name).toBe('BlogPost');
    });

    it('should navigate to routes with multiple parameters', async () => {
      const result = await router.navigate('/products/electronics/laptop-123');

      expect(result.success).toBe(true);
      expect(result.route).toBe('/products/electronics/laptop-123');
      expect(result.params).toEqual({ category: 'electronics', id: 'laptop-123' });
      expect(result.component.name).toBe('Product');
    });

    it('should handle query parameters', async () => {
      const result = await router.navigate('/users/123?tab=profile&edit=true');

      expect(result.success).toBe(true);
      expect(result.params).toEqual({ id: '123' });
      expect(result.query).toEqual({ tab: 'profile', edit: 'true' });
    });
  });

  describe('Asynchronous Component Loading', () => {
    beforeEach(() => {
      router.registerRoute('/async', createAsyncMockComponent('AsyncComponent', 100));
      router.registerRoute('/slow', createAsyncMockComponent('SlowComponent', 500));
      router.registerRoute('/failing', () => Promise.reject(new Error('Component load failed')));
    });

    it('should handle async component loading', async () => {
      const result = await router.navigate('/async');

      expect(result.success).toBe(true);
      expect(result.component.name).toBe('AsyncComponent');
    });

    it('should show loading state during navigation', async () => {
      const navigationPromise = router.navigate('/slow');
      
      expect(router.isLoading()).toBe(true);
      expect(router.isLoading('/slow')).toBe(true);

      const result = await navigationPromise;

      expect(result.success).toBe(true);
      expect(router.isLoading()).toBe(false);
      expect(router.isLoading('/slow')).toBe(false);
    });

    it('should handle component loading failures', async () => {
      const result = await router.navigate('/failing');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Component load failed');
      expect(errorHandler.getErrors()).toHaveLength(1);
      expect(errorHandler.getErrors()[0].type).toBe('component_load');
    });
  });

  describe('Navigation Hooks', () => {
    beforeEach(() => {
      router.registerRoute('/', () => createMockComponent('Home'));
      router.registerRoute('/protected', () => createMockComponent('Protected'));
      router.registerRoute('/login', () => createMockComponent('Login'));
    });

    it('should execute before navigation hooks', async () => {
      const beforeHook = vi.fn().mockResolvedValue(true);
      router.addBeforeNavigationHook(beforeHook);

      await router.navigate('/protected');

      expect(beforeHook).toHaveBeenCalledWith('/protected', { fromPopState: false });
    });

    it('should cancel navigation when before hook returns false', async () => {
      const beforeHook = vi.fn().mockResolvedValue(false);
      router.addBeforeNavigationHook(beforeHook);

      const result = await router.navigate('/protected');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('cancelled_by_hook');
      expect(router.getCurrentRoute().path).toBe('/');
    });

    it('should execute after navigation hooks', async () => {
      const afterHook = vi.fn();
      router.addAfterNavigationHook(afterHook);

      await router.navigate('/protected');

      expect(afterHook).toHaveBeenCalledWith('/protected', {
        params: {},
        query: {}
      });
    });

    it('should implement authentication flow with hooks', async () => {
      let isAuthenticated = false;

      // Before navigation hook for authentication
      router.addBeforeNavigationHook(async (path: string) => {
        if (path === '/protected' && !isAuthenticated) {
          await router.navigate('/login', { replace: true });
          return false;
        }
        return true;
      });

      // After navigation hook for login success
      router.addAfterNavigationHook(async (path: string) => {
        if (path === '/login') {
          // Simulate login
          isAuthenticated = true;
          await router.navigate('/protected');
        }
      });

      // Try to access protected route
      const result1 = await router.navigate('/protected');
      expect(result1.success).toBe(false);
      expect(router.getCurrentRoute().path).toBe('/login');

      // Login should redirect to protected route
      expect(router.getCurrentRoute().path).toBe('/protected');
    });
  });

  describe('Error Handling and 404 Pages', () => {
    beforeEach(() => {
      router.registerRoute('/', () => createMockComponent('Home'));
      router.registerRoute('/error', () => createMockComponent('Error'));
    });

    it('should handle 404 errors for non-existent routes', async () => {
      const result = await router.navigate('/non-existent');

      expect(result.success).toBe(true);
      expect(result.route).toBe('/404');
      expect(result.params).toEqual({ originalPath: '/non-existent' });
      expect(result.component.name).toBe('NotFound');
    });

    it('should handle navigation errors gracefully', async () => {
      // Mock a route that throws during navigation
      router.registerRoute('/error-route', () => {
        throw new Error('Navigation error');
      });

      const result = await router.navigate('/error-route');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation error');
      expect(errorHandler.getErrors()).toHaveLength(1);
    });

    it('should recover from errors and continue navigation', async () => {
      // Navigate to error route
      await router.navigate('/non-existent');
      expect(router.getCurrentRoute().path).toBe('/404');

      // Should be able to navigate normally after error
      const result = await router.navigate('/');
      expect(result.success).toBe(true);
      expect(router.getCurrentRoute().path).toBe('/');
    });
  });

  describe('Link Click Handling', () => {
    beforeEach(() => {
      router.registerRoute('/', () => createMockComponent('Home'));
      router.registerRoute('/about', () => createMockComponent('About'));
    });

    it('should handle internal link clicks', async () => {
      const mockLink = {
        tagName: 'A',
        href: 'http://localhost:3000/about'
      };

      const mockEvent = {
        target: mockLink,
        preventDefault: vi.fn()
      };

      // Simulate link click
      await router['handleLinkClick'](mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(router.getCurrentRoute().path).toBe('/about');
    });

    it('should not handle external link clicks', async () => {
      const mockLink = {
        tagName: 'A',
        href: 'https://external.com/page'
      };

      const mockEvent = {
        target: mockLink,
        preventDefault: vi.fn()
      };

      await router['handleLinkClick'](mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(router.getCurrentRoute().path).toBe('/');
    });
  });

  describe('Complex Navigation Scenarios', () => {
    beforeEach(() => {
      router.registerRoute('/', () => createMockComponent('Home'));
      router.registerRoute('/dashboard', createAsyncMockComponent('Dashboard', 200));
      router.registerRoute('/profile/[id]', createAsyncMockComponent('Profile', 150));
      router.registerRoute('/settings', () => createMockComponent('Settings'));
    });

    it('should handle rapid navigation changes', async () => {
      const navigations = [
        router.navigate('/dashboard'),
        router.navigate('/profile/123'),
        router.navigate('/settings')
      ];

      const results = await Promise.all(navigations);

      // All navigations should complete
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Final route should be the last navigation
      expect(router.getCurrentRoute().path).toBe('/settings');
    });

    it('should handle navigation during component loading', async () => {
      // Start slow navigation
      const slowNavigation = router.navigate('/dashboard');
      
      // Immediately navigate elsewhere
      const fastNavigation = router.navigate('/settings');

      const [slowResult, fastResult] = await Promise.all([slowNavigation, fastNavigation]);

      expect(slowResult.success).toBe(true);
      expect(fastResult.success).toBe(true);
      expect(router.getCurrentRoute().path).toBe('/settings');
    });

    it('should maintain consistent state during concurrent navigations', async () => {
      const navigations = [];
      
      for (let i = 0; i < 10; i++) {
        navigations.push(router.navigate(`/profile/${i}`));
      }

      await Promise.all(navigations);

      // Router should be in a consistent state
      expect(router.isLoading()).toBe(false);
      expect(router.getCurrentRoute().path).toMatch(/^\/profile\/\d+$/);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should clean up resources when destroyed', () => {
      const initialRoutes = router['routes'].size;
      const initialDynamicRoutes = router['dynamicRoutes'].length;

      router.destroy();

      expect(router['routes'].size).toBe(0);
      expect(router['dynamicRoutes']).toHaveLength(0);
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    it('should handle large numbers of routes efficiently', async () => {
      // Register many routes
      for (let i = 0; i < 1000; i++) {
        router.registerRoute(`/page-${i}`, () => createMockComponent(`Page${i}`));
      }

      const startTime = performance.now();
      const result = await router.navigate('/page-500');
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should manage loading states efficiently', async () => {
      const routes = [];
      for (let i = 0; i < 50; i++) {
        routes.push(`/async-${i}`);
        router.registerRoute(`/async-${i}`, createAsyncMockComponent(`Async${i}`, 50));
      }

      // Start multiple navigations
      const navigations = routes.map(route => router.navigate(route));

      // All should complete successfully
      const results = await Promise.all(navigations);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Loading states should be cleared
      routes.forEach(route => {
        expect(router.isLoading(route)).toBe(false);
      });
    });
  });
});