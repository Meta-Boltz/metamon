/**
 * Unit tests for RouteRegistry
 */

const { RouteRegistry } = require('../route-registry');

describe('RouteRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new RouteRegistry();
  });

  describe('constructor', () => {
    test('should initialize empty registry', () => {
      expect(registry.routes.size).toBe(0);
      expect(registry.dynamicRoutes.length).toBe(0);
    });
  });

  describe('register', () => {
    test('should register a simple static route', () => {
      const config = { file: 'pages/home.mtm' };
      registry.register('/home', config);

      expect(registry.routes.has('/home')).toBe(true);
      const route = registry.routes.get('/home');
      expect(route.path).toBe('/home');
      expect(route.file).toBe('pages/home.mtm');
      expect(route.dynamic).toBe(false);
      expect(route.params).toEqual([]);
    });

    test('should normalize routes without leading slash', () => {
      const config = { file: 'pages/about.mtm' };
      registry.register('about', config);

      expect(registry.routes.has('/about')).toBe(true);
    });

    test('should register dynamic route with single parameter', () => {
      const config = { file: 'pages/user.mtm' };
      registry.register('/user/[id]', config);

      const route = registry.routes.get('/user/[id]');
      expect(route.dynamic).toBe(true);
      expect(route.params).toEqual(['id']);
      expect(registry.dynamicRoutes.length).toBe(1);
    });

    test('should register dynamic route with multiple parameters', () => {
      const config = { file: 'pages/post.mtm' };
      registry.register('/blog/[category]/[slug]', config);

      const route = registry.routes.get('/blog/[category]/[slug]');
      expect(route.params).toEqual(['category', 'slug']);
    });

    test('should throw error for duplicate static routes', () => {
      const config1 = { file: 'pages/home1.mtm' };
      const config2 = { file: 'pages/home2.mtm' };

      registry.register('/home', config1);

      expect(() => {
        registry.register('/home', config2);
      }).toThrow('Route conflict: "/home" is already registered');
    });

    test('should throw error for conflicting dynamic routes', () => {
      const config1 = { file: 'pages/user1.mtm' };
      const config2 = { file: 'pages/user2.mtm' };

      registry.register('/user/[id]', config1);

      expect(() => {
        registry.register('/user/[userId]', config2);
      }).toThrow('Dynamic route conflict');
    });

    test('should throw error for invalid route', () => {
      expect(() => {
        registry.register('', { file: 'test.mtm' });
      }).toThrow('Route must be a non-empty string');

      expect(() => {
        registry.register(null, { file: 'test.mtm' });
      }).toThrow('Route must be a non-empty string');
    });

    test('should throw error for invalid config', () => {
      expect(() => {
        registry.register('/test', null);
      }).toThrow('Route config must include a file property');

      expect(() => {
        registry.register('/test', {});
      }).toThrow('Route config must include a file property');
    });

    test('should generate component name from file path', () => {
      const config = { file: 'pages/user-profile.mtm' };
      registry.register('/profile', config);

      const route = registry.routes.get('/profile');
      expect(route.component).toBe('User-profilePage');
    });

    test('should use provided component name', () => {
      const config = {
        file: 'pages/home.mtm',
        component: 'CustomHomePage'
      };
      registry.register('/home', config);

      const route = registry.routes.get('/home');
      expect(route.component).toBe('CustomHomePage');
    });
  });

  describe('resolve', () => {
    beforeEach(() => {
      // Set up test routes
      registry.register('/home', { file: 'pages/home.mtm' });
      registry.register('/about', { file: 'pages/about.mtm' });
      registry.register('/user/[id]', { file: 'pages/user.mtm' });
      registry.register('/blog/[category]/[slug]', { file: 'pages/post.mtm' });
    });

    test('should resolve static routes', () => {
      const match = registry.resolve('/home');

      expect(match).not.toBeNull();
      expect(match.route.path).toBe('/home');
      expect(match.params).toEqual({});
      expect(match.query).toEqual({});
    });

    test('should resolve dynamic routes with single parameter', () => {
      const match = registry.resolve('/user/123');

      expect(match).not.toBeNull();
      expect(match.route.path).toBe('/user/[id]');
      expect(match.params).toEqual({ id: '123' });
    });

    test('should resolve dynamic routes with multiple parameters', () => {
      const match = registry.resolve('/blog/tech/my-post');

      expect(match).not.toBeNull();
      expect(match.route.path).toBe('/blog/[category]/[slug]');
      expect(match.params).toEqual({
        category: 'tech',
        slug: 'my-post'
      });
    });

    test('should extract query parameters', () => {
      const match = registry.resolve('/home?page=1&sort=name');

      expect(match).not.toBeNull();
      expect(match.query).toEqual({
        page: '1',
        sort: 'name'
      });
    });

    test('should handle query parameters with dynamic routes', () => {
      const match = registry.resolve('/user/123?tab=profile&edit=true');

      expect(match).not.toBeNull();
      expect(match.params).toEqual({ id: '123' });
      expect(match.query).toEqual({
        tab: 'profile',
        edit: 'true'
      });
    });

    test('should return null for non-matching routes', () => {
      const match = registry.resolve('/nonexistent');
      expect(match).toBeNull();
    });

    test('should return null for invalid input', () => {
      expect(registry.resolve('')).toBeNull();
      expect(registry.resolve(null)).toBeNull();
      expect(registry.resolve(undefined)).toBeNull();
    });

    test('should prioritize exact matches over dynamic matches', () => {
      registry.register('/user/profile', { file: 'pages/profile.mtm' });

      const match = registry.resolve('/user/profile');
      expect(match.route.path).toBe('/user/profile');
      expect(match.params).toEqual({});
    });
  });

  describe('getAll', () => {
    test('should return all registered routes', () => {
      registry.register('/home', { file: 'pages/home.mtm' });
      registry.register('/about', { file: 'pages/about.mtm' });

      const allRoutes = registry.getAll();
      expect(allRoutes.size).toBe(2);
      expect(allRoutes.has('/home')).toBe(true);
      expect(allRoutes.has('/about')).toBe(true);
    });

    test('should return copy of routes map', () => {
      registry.register('/home', { file: 'pages/home.mtm' });

      const allRoutes = registry.getAll();
      allRoutes.clear();

      expect(registry.routes.size).toBe(1);
    });
  });

  describe('validateRoutes', () => {
    test('should return empty array for valid routes', () => {
      registry.register('/home', { file: 'pages/home.mtm' });
      registry.register('/user/[id]', { file: 'pages/user.mtm' });

      const results = registry.validateRoutes();
      expect(results).toEqual([]);
    });

    test('should detect conflicting dynamic routes', () => {
      // These would conflict if both were registered
      registry.register('/user/[id]', { file: 'pages/user1.mtm' });
      // Manually add conflicting route to test validation
      const conflictingRoute = {
        path: '/user/[userId]',
        file: 'pages/user2.mtm',
        dynamic: true,
        params: ['userId'],
        pattern: registry.createRoutePattern('/user/[userId]')
      };
      registry.dynamicRoutes.push(conflictingRoute);
      registry.routes.set('/user/[userId]', conflictingRoute);

      const results = registry.validateRoutes();
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('conflict');
      expect(results[0].severity).toBe('error');
    });

    test('should detect invalid route patterns', () => {
      // Manually add invalid route to test validation
      const invalidRoute = {
        path: '/user/[',
        file: 'pages/invalid.mtm',
        dynamic: true,
        params: [],
        pattern: null
      };
      registry.routes.set('/user/[', invalidRoute);

      const results = registry.validateRoutes();
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('invalid-pattern');
    });
  });

  describe('extractParameters', () => {
    test('should extract single parameter', () => {
      const params = registry.extractParameters('/user/[id]');
      expect(params).toEqual(['id']);
    });

    test('should extract multiple parameters', () => {
      const params = registry.extractParameters('/blog/[category]/[slug]');
      expect(params).toEqual(['category', 'slug']);
    });

    test('should return empty array for static routes', () => {
      const params = registry.extractParameters('/home');
      expect(params).toEqual([]);
    });

    test('should handle empty parameter brackets', () => {
      const params = registry.extractParameters('/user/[]');
      expect(params).toEqual(['']);
    });
  });

  describe('createRoutePattern', () => {
    test('should create pattern for single parameter', () => {
      const pattern = registry.createRoutePattern('/user/[id]');
      expect(pattern.test('/user/123')).toBe(true);
      expect(pattern.test('/user/abc')).toBe(true);
      expect(pattern.test('/user/')).toBe(false);
      expect(pattern.test('/user/123/extra')).toBe(false);
    });

    test('should create pattern for multiple parameters', () => {
      const pattern = registry.createRoutePattern('/blog/[category]/[slug]');
      expect(pattern.test('/blog/tech/my-post')).toBe(true);
      expect(pattern.test('/blog/news/breaking-news')).toBe(true);
      expect(pattern.test('/blog/tech')).toBe(false);
    });

    test('should escape special regex characters', () => {
      const pattern = registry.createRoutePattern('/api/v1.0/[id]');
      expect(pattern.test('/api/v1.0/123')).toBe(true);
      expect(pattern.test('/api/v1x0/123')).toBe(false);
    });
  });

  describe('matchDynamicRoute', () => {
    test('should match and extract parameters', () => {
      const route = {
        path: '/user/[id]',
        params: ['id'],
        pattern: registry.createRoutePattern('/user/[id]')
      };

      const match = registry.matchDynamicRoute(route, '/user/123');
      expect(match).toEqual({ params: { id: '123' } });
    });

    test('should return null for non-matching paths', () => {
      const route = {
        path: '/user/[id]',
        params: ['id'],
        pattern: registry.createRoutePattern('/user/[id]')
      };

      const match = registry.matchDynamicRoute(route, '/admin/123');
      expect(match).toBeNull();
    });
  });

  describe('routesConflict', () => {
    test('should detect conflict between same parameter patterns', () => {
      const route1 = { path: '/user/[id]' };
      const route2 = { path: '/user/[userId]' };

      expect(registry.routesConflict(route1, route2)).toBe(true);
    });

    test('should not detect conflict for different segment counts', () => {
      const route1 = { path: '/user/[id]' };
      const route2 = { path: '/user/[id]/profile' };

      expect(registry.routesConflict(route1, route2)).toBe(false);
    });

    test('should not detect conflict for different literal segments', () => {
      const route1 = { path: '/user/[id]' };
      const route2 = { path: '/admin/[id]' };

      expect(registry.routesConflict(route1, route2)).toBe(false);
    });
  });

  describe('isValidRoutePattern', () => {
    test('should validate correct patterns', () => {
      expect(registry.isValidRoutePattern('/user/[id]')).toBe(true);
      expect(registry.isValidRoutePattern('/blog/[category]/[slug]')).toBe(true);
      expect(registry.isValidRoutePattern('/home')).toBe(true);
    });

    test('should reject invalid patterns', () => {
      expect(registry.isValidRoutePattern('/user/[')).toBe(false);
      expect(registry.isValidRoutePattern('/user/]')).toBe(false);
      expect(registry.isValidRoutePattern('/user/[]')).toBe(false);
      expect(registry.isValidRoutePattern('/user/[[id]]')).toBe(false);
    });
  });

  describe('generateComponentName', () => {
    test('should generate component name from file path', () => {
      expect(registry.generateComponentName('pages/home.mtm')).toBe('HomePage');
      expect(registry.generateComponentName('user-profile.mtm')).toBe('User-profilePage');
      expect(registry.generateComponentName('about.mtm')).toBe('AboutPage');
    });
  });
});