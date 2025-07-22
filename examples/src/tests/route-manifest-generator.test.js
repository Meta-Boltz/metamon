/**
 * Tests for Route Manifest Generator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RouteManifestGenerator, createRouteManifestGenerator } from '../build-tools/route-manifest-generator.js';

describe('RouteManifestGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = createRouteManifestGenerator({
      pagesDir: 'src/pages',
      outputFormat: 'json',
      optimizeForProduction: false
    });
  });

  afterEach(() => {
    if (generator) {
      generator.close();
    }
  });

  describe('constructor', () => {
    it('should create generator with default options', () => {
      const defaultGenerator = new RouteManifestGenerator();
      expect(defaultGenerator.options.pagesDir).toBe('src/pages');
      expect(defaultGenerator.options.outputFormat).toBe('json');
      expect(defaultGenerator.options.optimizeForProduction).toBe(false);
    });

    it('should merge custom options', () => {
      const customGenerator = new RouteManifestGenerator({
        pagesDir: 'custom/pages',
        outputFormat: 'ts',
        optimizeForProduction: true
      });
      expect(customGenerator.options.pagesDir).toBe('custom/pages');
      expect(customGenerator.options.outputFormat).toBe('ts');
      expect(customGenerator.options.optimizeForProduction).toBe(true);
    });
  });

  describe('routeToRegex', () => {
    it('should convert static routes to regex', () => {
      const regex = generator.routeToRegex('/about');
      expect(regex.test('/about')).toBe(true);
      expect(regex.test('/about/more')).toBe(false);
    });

    it('should convert dynamic routes to regex', () => {
      const regex = generator.routeToRegex('/users/[id]');
      expect(regex.test('/users/123')).toBe(true);
      expect(regex.test('/users/abc')).toBe(true);
      expect(regex.test('/users/123/profile')).toBe(false);

      const match = '/users/123'.match(regex);
      expect(match.groups.id).toBe('123');
    });

    it('should convert catch-all routes to regex', () => {
      const regex = generator.routeToRegex('/blog/[...slug]');
      expect(regex.test('/blog/category/post')).toBe(true);
      expect(regex.test('/blog/a/b/c/d')).toBe(true);

      const match = '/blog/category/post'.match(regex);
      expect(match.groups.slug).toBe('category/post');
    });

    it('should handle multiple parameters', () => {
      const regex = generator.routeToRegex('/posts/[category]/[id]');
      expect(regex.test('/posts/tech/123')).toBe(true);

      const match = '/posts/tech/123'.match(regex);
      expect(match.groups.category).toBe('tech');
      expect(match.groups.id).toBe('123');
    });
  });

  describe('buildStaticRoutes', () => {
    it('should build static routes registry', () => {
      const pages = [
        {
          route: '/',
          filePath: 'src/pages/index.mtm',
          title: 'Home',
          description: 'Home page',
          keywords: ['home'],
          layout: 'default',
          status: 200,
          metadata: { test: true },
          locales: ['en'],
          lastModified: new Date(),
          size: 1000
        },
        {
          route: '/about',
          filePath: 'src/pages/about.mtm',
          title: 'About',
          description: 'About page',
          keywords: ['about'],
          layout: 'default',
          status: 200,
          metadata: {},
          locales: ['en', 'fr'],
          lastModified: new Date(),
          size: 500
        }
      ];

      const staticRoutes = generator.buildStaticRoutes(pages);

      expect(staticRoutes['/']).toBeDefined();
      expect(staticRoutes['/'].title).toBe('Home');
      expect(staticRoutes['/'].preload).toBe(true); // Home should be preloaded

      expect(staticRoutes['/about']).toBeDefined();
      expect(staticRoutes['/about'].locales).toEqual(['en', 'fr']);
    });
  });

  describe('buildDynamicRoutes', () => {
    it('should build dynamic routes array', () => {
      const pages = [
        {
          route: '/users/[id]',
          filePath: 'src/pages/users/[id].mtm',
          title: 'User Profile',
          description: 'User profile page',
          keywords: ['user', 'profile'],
          layout: 'default',
          status: 200,
          parameters: ['id'],
          metadata: {},
          locales: ['en'],
          lastModified: new Date(),
          size: 2000
        }
      ];

      const dynamicRoutes = generator.buildDynamicRoutes(pages);

      expect(dynamicRoutes).toHaveLength(1);
      expect(dynamicRoutes[0].template).toBe('/users/[id]');
      expect(dynamicRoutes[0].parameters).toEqual(['id']);
      expect(dynamicRoutes[0].regex).toBeInstanceOf(RegExp);
    });
  });

  describe('buildFallbackRoutes', () => {
    it('should build fallback routes for error pages', () => {
      const pages = [
        {
          route: '/404',
          filePath: 'src/pages/404.mtm',
          title: '404 - Not Found',
          description: 'Page not found',
          status: 404,
          metadata: {}
        }
      ];

      const fallbackRoutes = generator.buildFallbackRoutes(pages);

      expect(fallbackRoutes).toHaveLength(1);
      expect(fallbackRoutes[0].status).toBe(404);
      expect(fallbackRoutes[0].pattern).toBe('.*'); // 404 should match everything
    });
  });

  describe('shouldPreload', () => {
    it('should preload home page', () => {
      const page = { route: '/', size: 5000, status: 200 };
      expect(generator.shouldPreload(page)).toBe(true);
    });

    it('should preload docs page', () => {
      const page = { route: '/docs', size: 15000, status: 200 };
      expect(generator.shouldPreload(page)).toBe(true);
    });

    it('should preload small pages', () => {
      const page = { route: '/small', size: 5000, status: 200 };
      expect(generator.shouldPreload(page)).toBe(true);
    });

    it('should not preload error pages', () => {
      const page = { route: '/404', size: 1000, status: 404 };
      expect(generator.shouldPreload(page)).toBe(false);
    });

    it('should not preload large pages', () => {
      const page = { route: '/large', size: 50000, status: 200 };
      expect(generator.shouldPreload(page)).toBe(false);
    });
  });

  describe('isLocaleRoute', () => {
    it('should detect locale routes', () => {
      expect(generator.isLocaleRoute('/fr', 'fr')).toBe(true);
      expect(generator.isLocaleRoute('/fr/about', 'fr')).toBe(true);
      expect(generator.isLocaleRoute('/es/contact', 'es')).toBe(true);
    });

    it('should reject non-locale routes', () => {
      expect(generator.isLocaleRoute('/about', 'fr')).toBe(false);
      expect(generator.isLocaleRoute('/fr/about', 'es')).toBe(false);
      expect(generator.isLocaleRoute('/', 'fr')).toBe(false);
    });
  });

  describe('exportManifest', () => {
    const mockManifest = {
      version: '1.0.0',
      generatedAt: '2024-01-01T00:00:00.000Z',
      totalRoutes: 1,
      staticRoutes: { '/': { path: '/', title: 'Home' } },
      dynamicRoutes: [],
      fallbackRoutes: [],
      errorPages: {},
      i18nRoutes: {},
      metadata: {}
    };

    it('should export as JSON', () => {
      const result = generator.exportManifest(mockManifest, 'json');
      expect(result).toContain('"version": "1.0.0"');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should export as JavaScript', () => {
      const result = generator.exportManifest(mockManifest, 'js');
      expect(result).toContain('export const routeManifest =');
      expect(result).toContain('export default routeManifest;');
    });

    it('should export as TypeScript', () => {
      const result = generator.exportManifest(mockManifest, 'ts');
      expect(result).toContain('import type { RouteManifest }');
      expect(result).toContain('export const routeManifest: RouteManifest =');
    });

    it('should throw for unsupported format', () => {
      expect(() => generator.exportManifest(mockManifest, 'xml')).toThrow();
    });
  });

  describe('generateTypeDefinitions', () => {
    it('should generate TypeScript definitions', () => {
      const mockManifest = {
        staticRoutes: { '/': {}, '/about': {} },
        dynamicRoutes: [{ template: '/users/[id]' }, { template: '/posts/[...slug]' }]
      };

      const types = generator.generateTypeDefinitions(mockManifest);

      expect(types).toContain("export type StaticRoute = '/' | '/about';");
      expect(types).toContain("export type DynamicRoute = '/users/[id]' | '/posts/[...slug]';");
      expect(types).toContain('export interface RouteManifest');
    });

    it('should handle empty routes', () => {
      const mockManifest = {
        staticRoutes: {},
        dynamicRoutes: []
      };

      const types = generator.generateTypeDefinitions(mockManifest);

      expect(types).toContain('export type StaticRoute = never;');
      expect(types).toContain('export type DynamicRoute = never;');
    });
  });

  describe('optimizeManifest', () => {
    it('should remove development metadata', () => {
      const manifest = {
        staticRoutes: {
          '/': {
            path: '/',
            title: 'Home',
            lastModified: new Date(),
            size: 1000,
            preload: false
          }
        },
        dynamicRoutes: [{
          template: '/users/[id]',
          lastModified: new Date(),
          size: 2000,
          preload: true
        }],
        metadata: {
          buildInfo: { nodeVersion: 'v18.0.0' },
          totalSize: 3000,
          lastModified: new Date()
        }
      };

      generator.optimizeManifest(manifest);

      expect(manifest.staticRoutes['/'].lastModified).toBeUndefined();
      expect(manifest.staticRoutes['/'].size).toBeUndefined();
      expect(manifest.staticRoutes['/'].preload).toBeUndefined(); // false values removed

      expect(manifest.dynamicRoutes[0].lastModified).toBeUndefined();
      expect(manifest.dynamicRoutes[0].size).toBeUndefined();
      expect(manifest.dynamicRoutes[0].preload).toBe(true); // true values kept

      expect(manifest.metadata.buildInfo).toBeUndefined();
      expect(manifest.metadata.totalSize).toBeUndefined();
      expect(manifest.metadata.lastModified).toBeUndefined();
    });
  });

  describe('createEmptyManifest', () => {
    it('should create valid empty manifest', () => {
      const manifest = generator.createEmptyManifest();

      expect(manifest.version).toBe('1.0.0');
      expect(manifest.totalRoutes).toBe(0);
      expect(manifest.staticRoutes).toEqual({});
      expect(manifest.dynamicRoutes).toEqual([]);
      expect(manifest.fallbackRoutes).toEqual([]);
      expect(manifest.errorPages).toEqual({});
      expect(manifest.i18nRoutes).toEqual({});
      expect(manifest.metadata.locales).toEqual(['en']);
    });
  });

  describe('createRouteManifestGenerator factory', () => {
    it('should create generator instance', () => {
      const generator = createRouteManifestGenerator({ pagesDir: 'test' });
      expect(generator).toBeInstanceOf(RouteManifestGenerator);
      expect(generator.options.pagesDir).toBe('test');
      generator.close();
    });
  });
});