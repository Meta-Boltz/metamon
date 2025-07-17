import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple router implementation for testing
class SimpleRouter {
  private routes: Map<string, { component: string; framework: string }> = new Map();
  private currentPath = '/';

  register(path: string, component: string, framework: string): void {
    this.routes.set(path, { component, framework });
  }

  navigate(path: string): void {
    this.currentPath = path;
  }

  getCurrentRoute() {
    const route = this.routes.get(this.currentPath);
    if (route) {
      return {
        path: this.currentPath,
        component: route.component,
        framework: route.framework,
        params: {},
        query: {}
      };
    }
    return {
      path: this.currentPath,
      component: 'NotFound',
      framework: 'react',
      params: {},
      query: {}
    };
  }
}

describe('Simple Router Test', () => {
  let router: SimpleRouter;

  beforeEach(() => {
    router = new SimpleRouter();
  });

  it('should register and navigate to routes', () => {
    router.register('/home', 'HomePage', 'react');
    router.navigate('/home');
    
    const route = router.getCurrentRoute();
    expect(route.component).toBe('HomePage');
    expect(route.framework).toBe('react');
  });

  it('should handle not found routes', () => {
    router.navigate('/nonexistent');
    
    const route = router.getCurrentRoute();
    expect(route.component).toBe('NotFound');
    expect(route.framework).toBe('react');
  });
});