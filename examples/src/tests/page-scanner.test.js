/**
 * Tests for Page Scanner
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PageScanner, createPageScanner } from '../build-tools/page-scanner.js';
import { join } from 'path';

describe('PageScanner', () => {
  let scanner;

  beforeEach(() => {
    scanner = createPageScanner({
      pagesDir: 'src/pages',
      watchMode: false
    });
  });

  describe('constructor', () => {
    it('should create scanner with default options', () => {
      const defaultScanner = new PageScanner();
      expect(defaultScanner.options.pagesDir).toBe('src/pages');
      expect(defaultScanner.options.include).toEqual(['**/*.mtm']);
    });

    it('should merge custom options', () => {
      const customScanner = new PageScanner({
        pagesDir: 'custom/pages',
        watchMode: true
      });
      expect(customScanner.options.pagesDir).toBe('custom/pages');
      expect(customScanner.options.watchMode).toBe(true);
    });
  });

  describe('parseFrontmatter', () => {
    it('should parse valid YAML frontmatter', () => {
      const content = `---
route: /test
title: Test Page
description: A test page
keywords: [test, page]
status: 200
---
This is the content`;

      const result = scanner.parseFrontmatter(content, 'test.mtm');

      expect(result.frontmatter.route).toBe('/test');
      expect(result.frontmatter.title).toBe('Test Page');
      expect(result.frontmatter.keywords).toEqual(['test', 'page']);
      expect(result.frontmatter.status).toBe(200);
      expect(result.content).toBe('This is the content');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle content without frontmatter', () => {
      const content = 'Just plain content';
      const result = scanner.parseFrontmatter(content, 'test.mtm');

      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe('Just plain content');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle malformed frontmatter gracefully', () => {
      const content = `---
route /test
title: Test Page
---
Content`;

      const result = scanner.parseFrontmatter(content, 'test.mtm');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('frontmatter_parse_error');
    });
  });

  describe('parseValue', () => {
    it('should parse strings', () => {
      expect(scanner.parseValue('"hello world"')).toBe('hello world');
      expect(scanner.parseValue("'hello world'")).toBe('hello world');
      expect(scanner.parseValue('hello')).toBe('hello');
    });

    it('should parse numbers', () => {
      expect(scanner.parseValue('42')).toBe(42);
      expect(scanner.parseValue('3.14')).toBe(3.14);
      expect(scanner.parseValue('-10')).toBe(-10);
    });

    it('should parse booleans', () => {
      expect(scanner.parseValue('true')).toBe(true);
      expect(scanner.parseValue('false')).toBe(false);
    });

    it('should parse arrays', () => {
      expect(scanner.parseValue('[1, 2, 3]')).toEqual([1, 2, 3]);
      expect(scanner.parseValue('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
    });

    it('should parse null and undefined', () => {
      expect(scanner.parseValue('null')).toBe(null);
      expect(scanner.parseValue('~')).toBe(null);
      expect(scanner.parseValue('undefined')).toBe(undefined);
    });
  });

  describe('generateRouteFromPath', () => {
    it('should generate route from file path', () => {
      expect(scanner.generateRouteFromPath('src/pages/about.mtm', 'src/pages')).toBe('/about');
      expect(scanner.generateRouteFromPath('src/pages/blog/post.mtm', 'src/pages')).toBe('/blog/post');
    });

    it('should handle index files', () => {
      expect(scanner.generateRouteFromPath('src/pages/index.mtm', 'src/pages')).toBe('/');
      expect(scanner.generateRouteFromPath('src/pages/blog/index.mtm', 'src/pages')).toBe('/blog');
    });

    it('should handle nested directories', () => {
      expect(scanner.generateRouteFromPath('src/pages/users/profile.mtm', 'src/pages')).toBe('/users/profile');
    });
  });

  describe('generateTitleFromRoute', () => {
    it('should generate title from route', () => {
      expect(scanner.generateTitleFromRoute('/')).toBe('Home');
      expect(scanner.generateTitleFromRoute('/about')).toBe('About');
      expect(scanner.generateTitleFromRoute('/blog/post')).toBe('Blog Post');
      expect(scanner.generateTitleFromRoute('/user-profile')).toBe('User Profile');
    });

    it('should handle dynamic routes', () => {
      expect(scanner.generateTitleFromRoute('/users/[id]')).toBe('Users Id');
      expect(scanner.generateTitleFromRoute('/blog/[...slug]')).toBe('Blog Slug');
    });
  });

  describe('validateRoute', () => {
    it('should validate correct routes', () => {
      expect(() => scanner.validateRoute('/', 'test.mtm')).not.toThrow();
      expect(() => scanner.validateRoute('/about', 'test.mtm')).not.toThrow();
      expect(() => scanner.validateRoute('/users/[id]', 'test.mtm')).not.toThrow();
    });

    it('should reject invalid routes', () => {
      expect(() => scanner.validateRoute('', 'test.mtm')).toThrow();
      expect(() => scanner.validateRoute('about', 'test.mtm')).toThrow();
      expect(() => scanner.validateRoute('/about//page', 'test.mtm')).toThrow();
      expect(() => scanner.validateRoute('/about<script>', 'test.mtm')).toThrow();
    });
  });

  describe('isDynamicRoute', () => {
    it('should detect dynamic routes', () => {
      expect(scanner.isDynamicRoute('/users/[id]')).toBe(true);
      expect(scanner.isDynamicRoute('/blog/[...slug]')).toBe(true);
      expect(scanner.isDynamicRoute('/posts/[category]/[id]')).toBe(true);
    });

    it('should detect static routes', () => {
      expect(scanner.isDynamicRoute('/')).toBe(false);
      expect(scanner.isDynamicRoute('/about')).toBe(false);
      expect(scanner.isDynamicRoute('/blog/posts')).toBe(false);
    });
  });

  describe('extractRouteParameters', () => {
    it('should extract parameters from dynamic routes', () => {
      expect(scanner.extractRouteParameters('/users/[id]')).toEqual(['id']);
      expect(scanner.extractRouteParameters('/blog/[...slug]')).toEqual(['slug']);
      expect(scanner.extractRouteParameters('/posts/[category]/[id]')).toEqual(['category', 'id']);
    });

    it('should return empty array for static routes', () => {
      expect(scanner.extractRouteParameters('/')).toEqual([]);
      expect(scanner.extractRouteParameters('/about')).toEqual([]);
    });
  });

  describe('extractLocales', () => {
    it('should extract explicit locales', () => {
      const frontmatter = { locales: ['en', 'fr', 'es'] };
      expect(scanner.extractLocales(frontmatter)).toEqual(['en', 'fr', 'es']);
    });

    it('should default to en if no locales', () => {
      const frontmatter = {};
      expect(scanner.extractLocales(frontmatter)).toEqual(['en']);
    });

    it('should handle single locale string', () => {
      const frontmatter = { locales: 'fr' };
      expect(scanner.extractLocales(frontmatter)).toEqual(['fr']);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      scanner.cache.set('test', 'value');
      scanner.routeRegistry.set('test', 'value');

      scanner.clearCache();

      expect(scanner.cache.size).toBe(0);
      expect(scanner.routeRegistry.size).toBe(0);
    });

    it('should provide cache stats', () => {
      scanner.cache.set('test', 'value');
      const stats = scanner.getCacheStats();

      expect(stats.cacheSize).toBe(1);
      expect(stats.routeRegistrySize).toBe(0);
      expect(stats.watchersCount).toBe(0);
    });
  });

  describe('createPageScanner factory', () => {
    it('should create scanner instance', () => {
      const scanner = createPageScanner({ pagesDir: 'test' });
      expect(scanner).toBeInstanceOf(PageScanner);
      expect(scanner.options.pagesDir).toBe('test');
    });
  });
});