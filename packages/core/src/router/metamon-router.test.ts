import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetamonRouterImpl } from './metamon-router';
import type { RouteInfo } from '../types/router';

// Mock window and history API
const mockWindow = {
  location: {
    pathname: '/',
    search: '',
    href: 'http://localhost/'
  },
  history: {
    pushState: vi.fn(),
    replaceState: vi.fn()
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Mock global window
Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

describe('MetamonRouter', () => {
  let router: MetamonRouterImpl;

  beforeEach(() => {
    router = new MetamonRouterImpl();
    vi.clearAllMocks();
    
    // Reset window location
    mockWindow.location.pathname = '/';
    mockWindow.location.search = '';
  });

  afterEach(() => {
    router.destroy();
  });

  describe('Route Registration', () => {
    it('should register a simple route', () => {
      router.register('/home', 'HomePage', 'react');
      
      mockWindow.location.pathname = '/home';
      mockWindow.location.search = '';
      
      // Force route change handling
      router.navigate('/home');
      const route = router.getCurrentRoute();
      
      expect(route.path).toBe('/home');
      expect(route.component).toBe('HomePage');
      expect(route.framework).toBe('react');
      expect(route.params).toEqual({});
    });

    it('should register multiple routes with different frameworks', () => {
      router.register('/home', 'HomePage', 'react');
      router.register('/about', 'AboutPage', 'vue');
      router.register('/contact', 'ContactPage', 'svelte');
      
      router.navigate('/about');
      const route = router.getCurrentRoute();
      
      expect(route.component).toBe('AboutPage');
      expect(route.framework).toBe('vue');
    });

    it('should handle dynamic route registration', () => {
      router.register('/users/:id', 'UserProfile', 'react');
      
      router.navigate('/users/123');
      const route = router.getCurrentRoute();
      
      expect(route.component).toBe('UserProfile');
      expect(route.params).toEqual({ id: '123' });
    });

    it('should handle multiple dynamic parameters', () => {
      router.register('/posts/:category/:slug', 'PostDetail', 'vue');
      
      router.navigate('/posts/tech/my-awesome-post');
      const route = router.getCurrentRoute();
      
      expect(route.component).toBe('PostDetail');
      expect(route.params).toEqual({ 
        category: 'tech', 
        slug: 'my-awesome-post' 
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      router.register('/home', 'HomePage', 'react');
      router.register('/users/:id', 'UserProfile', 'react');
    });

    it('should navigate to a simple route', () => {
      router.navigate('/home');
      
      expect(mockWindow.history.pushState).toHaveBeenCalledWith({}, '', '/home');
    });

    it('should navigate with query parameters', () => {
      router.navigate('/home', { tab: 'settings', filter: 'active' });
      
      expect(mockWindow.history.pushState).toHaveBeenCalledWith(
        {}, 
        '', 
        '/home?tab=settings&filter=active'
      );
    });

    it('should handle navigation with undefined parameters', () => {
      router.navigate('/home', { tab: 'settings', filter: undefined });
      
      expect(mockWindow.history.pushState).toHaveBeenCalledWith(
        {}, 
        '', 
        '/home?tab=settings'
      );
    });

    it('should append query parameters to existing query string', () => {
      router.navigate('/home?existing=param', { new: 'value' });
      
      expect(mockWindow.history.pushState).toHaveBeenCalledWith(
        {}, 
        '', 
        '/home?existing=param&new=value'
      );
    });
  });

  describe('Route Parameter Extraction', () => {
    beforeEach(() => {
      router.register('/users/:id', 'UserProfile', 'react');
      router.register('/posts/:category/:slug', 'PostDetail', 'vue');
      router.register('/api/v:version/users/:userId', 'ApiEndpoint', 'solid');
    });

    it('should extract single route parameter', () => {
      router.navigate('/users/456');
      const route = router.getCurrentRoute();
      
      expect(route.params).toEqual({ id: '456' });
    });

    it('should extract multiple route parameters', () => {
      router.navigate('/posts/javascript/advanced-patterns');
      const route = router.getCurrentRoute();
      
      expect(route.params).toEqual({ 
        category: 'javascript', 
        slug: 'advanced-patterns' 
      });
    });

    it('should handle URL encoded parameters', () => {
      router.navigate('/posts/web%20development/my%20post');
      const route = router.getCurrentRoute();
      
      expect(route.params).toEqual({ 
        category: 'web development', 
        slug: 'my post' 
      });
    });

    it('should extract parameters from complex routes', () => {
      router.navigate('/api/v2/users/789');
      const route = router.getCurrentRoute();
      
      expect(route.params).toEqual({ 
        version: '2', 
        userId: '789' 
      });
    });
  });

  describe('Query String Handling', () => {
    beforeEach(() => {
      router.register('/search', 'SearchPage', 'react');
    });

    it('should parse simple query parameters', () => {
      router.navigate('/search', { q: 'javascript', type: 'posts' });
      const route = router.getCurrentRoute();
      
      expect(route.query).toEqual({ 
        q: 'javascript', 
        type: 'posts' 
      });
    });

    it('should handle empty query string', () => {
      router.navigate('/search');
      const route = router.getCurrentRoute();
      
      expect(route.query).toEqual({});
    });

    it('should handle multiple values for same parameter', () => {
      // Navigate to URL with multiple values for same parameter
      router.navigate('/search?tags=javascript&tags=react&tags=vue');
      const route = router.getCurrentRoute();
      
      expect(route.query).toEqual({ 
        tags: ['javascript', 'react', 'vue'] 
      });
    });

    it('should handle URL encoded query values', () => {
      router.navigate('/search', { q: 'hello world', category: 'web dev' });
      const route = router.getCurrentRoute();
      
      expect(route.query).toEqual({ 
        q: 'hello world', 
        category: 'web dev' 
      });
    });
  });

  describe('Route Change Events', () => {
    let routeChangeCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      routeChangeCallback = vi.fn();
      router.register('/home', 'HomePage', 'react');
      router.register('/about', 'AboutPage', 'vue');
    });

    it('should call route change callback on navigation', () => {
      router.onRouteChange(routeChangeCallback);
      router.navigate('/home');
      
      expect(routeChangeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/home',
          component: 'HomePage',
          framework: 'react'
        })
      );
    });

    it('should call multiple route change callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      router.onRouteChange(callback1);
      router.onRouteChange(callback2);
      router.navigate('/about');
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should remove route change callback', () => {
      router.onRouteChange(routeChangeCallback);
      router.offRouteChange(routeChangeCallback);
      router.navigate('/home');
      
      expect(routeChangeCallback).not.toHaveBeenCalled();
    });

    it('should handle errors in route change callbacks gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      router.onRouteChange(errorCallback);
      router.onRouteChange(normalCallback);
      router.navigate('/home');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in route change callback:', 
        expect.any(Error)
      );
      expect(normalCallback).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('History Management', () => {
    beforeEach(() => {
      router.register('/home', 'HomePage', 'react');
      router.register('/about', 'AboutPage', 'vue');
    });

    it('should handle browser back/forward navigation', () => {
      const routeChangeCallback = vi.fn();
      router.onRouteChange(routeChangeCallback);
      
      // Simulate popstate event
      mockWindow.location.pathname = '/about';
      const popstateEvent = new Event('popstate');
      
      // Get the popstate handler that was registered
      const popstateHandler = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'popstate')?.[1];
      
      if (popstateHandler) {
        popstateHandler(popstateEvent);
      }
      
      expect(routeChangeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/about',
          component: 'AboutPage',
          framework: 'vue'
        })
      );
    });
  });

  describe('Not Found Handling', () => {
    it('should return not found route for unregistered paths', () => {
      router.navigate('/nonexistent');
      const route = router.getCurrentRoute();
      
      expect(route.path).toBe('/nonexistent');
      expect(route.component).toBe('NotFound');
      expect(route.framework).toBe('react');
    });

    it('should preserve query parameters in not found routes', () => {
      router.navigate('/nonexistent', { param: 'value' });
      const route = router.getCurrentRoute();
      
      expect(route.query).toEqual({ param: 'value' });
    });
  });

  describe('Server-Side Rendering Compatibility', () => {
    it('should handle missing window object gracefully', () => {
      // Temporarily set window to undefined
      const originalWindow = global.window;
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
        configurable: true
      });
      
      const ssrRouter = new MetamonRouterImpl();
      
      expect(() => {
        ssrRouter.register('/home', 'HomePage', 'react');
        ssrRouter.navigate('/home');
      }).not.toThrow();
      
      // Restore window
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
        configurable: true
      });
      ssrRouter.destroy();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on destroy', () => {
      router.destroy();
      
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'popstate', 
        expect.any(Function)
      );
    });

    it('should clear route change callbacks on destroy', () => {
      const callback = vi.fn();
      router.onRouteChange(callback);
      router.destroy();
      router.navigate('/home');
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
});