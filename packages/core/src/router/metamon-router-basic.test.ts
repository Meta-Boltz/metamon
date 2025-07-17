import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetamonRouterImpl } from './metamon-router';

// Mock window object
const mockWindow = {
  location: {
    pathname: '/',
    search: '',
    href: 'http://localhost/'
  },
  history: {
    pushState: vi.fn()
  }
};

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

describe('MetamonRouter Basic Tests', () => {
  let router: MetamonRouterImpl;

  beforeEach(() => {
    router = new MetamonRouterImpl();
    vi.clearAllMocks();
    mockWindow.location.pathname = '/';
    mockWindow.location.search = '';
  });

  afterEach(() => {
    router.destroy();
  });

  describe('Route Registration', () => {
    it('should register a simple route', () => {
      router.register('/home', 'HomePage', 'react');
      router.navigate('/home');
      
      const route = router.getCurrentRoute();
      
      expect(route.path).toBe('/home');
      expect(route.component).toBe('HomePage');
      expect(route.framework).toBe('react');
      expect(route.params).toEqual({});
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
  });

  describe('Not Found Handling', () => {
    it('should return not found route for unregistered paths', () => {
      router.navigate('/nonexistent');
      const route = router.getCurrentRoute();
      
      expect(route.path).toBe('/nonexistent');
      expect(route.component).toBe('NotFound');
      expect(route.framework).toBe('react');
    });
  });

  describe('Route Change Events', () => {
    it('should call route change callback on navigation', () => {
      const callback = vi.fn();
      router.register('/home', 'HomePage', 'react');
      router.onRouteChange(callback);
      
      router.navigate('/home');
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/home',
          component: 'HomePage',
          framework: 'react'
        })
      );
    });
  });
});