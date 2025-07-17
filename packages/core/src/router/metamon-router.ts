import type { 
  MetamonRouter, 
  RouteInfo, 
  RouteChangeCallback, 
  RouteRegistration 
} from '../types/router.js';

export class MetamonRouterImpl implements MetamonRouter {
  private routes: Map<string, RouteRegistration> = new Map();
  private routePatterns: RouteRegistration[] = [];
  private currentRoute: RouteInfo | null = null;
  private routeChangeCallbacks: Set<RouteChangeCallback> = new Set();

  register(path: string, component: string, framework: string): void {
    const registration: RouteRegistration = {
      path,
      component,
      framework,
      pattern: this.createRoutePattern(path)
    };

    this.routes.set(path, registration);
    this.routePatterns.push(registration);
  }

  navigate(path: string, params?: Record<string, any>): void {
    let url = path;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (path.includes('?') ? '&' : '?') + queryString;
      }
    }

    if (typeof window !== 'undefined' && window.location) {
      try {
        const urlObj = new URL(url, 'http://localhost');
        (window.location as any).pathname = urlObj.pathname;
        (window.location as any).search = urlObj.search;
        if (window.history) {
          window.history.pushState({}, '', url);
        }
      } catch (e) {
        (window.location as any).pathname = url.split('?')[0];
        (window.location as any).search = url.includes('?') ? '?' + url.split('?')[1] : '';
      }
    }
    
    this.handleRouteChange();
  }

  getCurrentRoute(): RouteInfo {
    if (!this.currentRoute) {
      this.handleRouteChange();
    }
    return this.currentRoute || this.createNotFoundRoute();
  }

  onRouteChange(callback: RouteChangeCallback): void {
    this.routeChangeCallbacks.add(callback);
  }

  offRouteChange(callback: RouteChangeCallback): void {
    this.routeChangeCallbacks.delete(callback);
  }

  private handleRouteChange(): void {
    const currentPath = typeof window !== 'undefined' && window.location 
      ? window.location.pathname 
      : '/';
    const currentSearch = typeof window !== 'undefined' && window.location 
      ? window.location.search 
      : '';
    
    const matchedRoute = this.findMatchingRoute(currentPath);
    
    if (matchedRoute) {
      const params = this.extractRouteParams(currentPath, matchedRoute);
      const query = this.parseQueryString(currentSearch);
      
      this.currentRoute = {
        path: currentPath,
        params,
        query,
        component: matchedRoute.component,
        framework: matchedRoute.framework
      };
    } else {
      this.currentRoute = this.createNotFoundRoute();
    }

    this.routeChangeCallbacks.forEach(callback => {
      try {
        callback(this.currentRoute!);
      } catch (error) {
        console.error('Error in route change callback:', error);
      }
    });
  }

  private findMatchingRoute(path: string): RouteRegistration | null {
    for (const [routePath, registration] of this.routes) {
      if (routePath === path) {
        return registration;
      }
    }

    for (const registration of this.routePatterns) {
      if (registration.pattern && registration.pattern.test(path)) {
        return registration;
      }
    }

    return null;
  }

  private createRoutePattern(path: string): RegExp {
    const escapedPath = path.replace(/\//g, '\\/');
    const patternStr = escapedPath.replace(/:([^\/]+)/g, '([^\/]+)');
    return new RegExp('^' + patternStr + '$');
  }

  private extractRouteParams(currentPath: string, route: RouteRegistration): Record<string, any> {
    const params: Record<string, any> = {};
    
    if (!route.pattern) {
      return params;
    }

    const match = currentPath.match(route.pattern);
    if (!match) {
      return params;
    }

    const paramNames = this.extractParamNames(route.path);
    
    paramNames.forEach((name, index) => {
      const value = match[index + 1];
      if (value !== undefined) {
        params[name] = decodeURIComponent(value);
      }
    });

    return params;
  }

  private extractParamNames(path: string): string[] {
    const paramNames: string[] = [];
    const matches = path.matchAll(/:([^\/]+)/g);
    
    for (const match of matches) {
      if (match[1]) {
        paramNames.push(match[1]);
      }
    }
    
    return paramNames;
  }

  private parseQueryString(search: string): Record<string, any> {
    const query: Record<string, any> = {};
    
    if (!search || search.length <= 1) {
      return query;
    }

    const params = new URLSearchParams(search);
    params.forEach((value, key) => {
      if (query[key]) {
        if (Array.isArray(query[key])) {
          query[key].push(value);
        } else {
          query[key] = [query[key], value];
        }
      } else {
        query[key] = value;
      }
    });

    return query;
  }

  private createNotFoundRoute(): RouteInfo {
    const currentPath = typeof window !== 'undefined' && window.location 
      ? window.location.pathname 
      : '/';
    const currentSearch = typeof window !== 'undefined' && window.location 
      ? window.location.search 
      : '';

    return {
      path: currentPath,
      params: {},
      query: this.parseQueryString(currentSearch),
      component: 'NotFound',
      framework: 'react'
    };
  }

  destroy(): void {
    this.routeChangeCallbacks.clear();
  }
}

export const metamonRouter = new MetamonRouterImpl();