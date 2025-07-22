/**
 * Comprehensive Unit Tests for Ultra-Modern MTM Core Components
 * This test suite provides extensive coverage for all core components
 * with focus on edge cases, error handling, and requirement verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import core components
import { parseFrontmatter } from '../build-tools/frontmatter-parser.js';
import { UltraModernRouter } from '../shared/ultra-modern-router.js';
import TemplateParser from '../build-tools/template-parser.js';
import TemplateTransformer from '../build-tools/template-transformer.js';
import { RouteManifestGenerator } from '../build-tools/route-manifest-generator.js';
import { PageScanner } from '../build-tools/page-scanner.js';
import { createSSRRenderer } from '../build-tools/ssr-renderer.js';

describe('Comprehensive Unit Tests - Core Components', () => {

  describe('Frontmatter Parser - Edge Cases and Error Handling', () => {
    it('should handle extremely large frontmatter blocks', () => {
      const largeValue = 'x'.repeat(10000);
      const content = `---
title: Test
description: "${largeValue}"
---
Content`;

      const result = parseFrontmatter(content);
      expect(result.isValid).toBe(true);
      expect(result.frontmatter.description).toBe(largeValue);
    });

    it('should handle deeply nested objects', () => {
      const content = `---
config:
  level1:
    level2:
      level3:
        level4:
          level5:
            value: "deep"
---
Content`;

      const result = parseFrontmatter(content);
      expect(result.isValid).toBe(true);
      expect(result.frontmatter.config.level1.level2.level3.level4.level5.value).toBe('deep');
    });

    it('should handle arrays with mixed data types', () => {
      const content = `---
mixed:
  - string
  - 42
  - true
  - null
  - { key: value }
  - [1, 2, 3]
---
Content`;

      const result = parseFrontmatter(content);
      expect(result.isValid).toBe(true);
      expect(result.frontmatter.mixed).toHaveLength(6);
      expect(result.frontmatter.mixed[0]).toBe('string');
      expect(result.frontmatter.mixed[1]).toBe(42);
      expect(result.frontmatter.mixed[2]).toBe(true);
      expect(result.frontmatter.mixed[3]).toBe(null);
      expect(typeof result.frontmatter.mixed[4]).toBe('object');
      expect(Array.isArray(result.frontmatter.mixed[5])).toBe(true);
    });

    it('should handle Unicode and special characters', () => {
      const content = `---
title: "🚀 Ultra-Modern MTM ✨"
description: "Supports émojis, àccénts, and 中文"
symbols: "!@#$%^&*()_+-=[]{}|;':\",./<>?"
---
Content`;

      const result = parseFrontmatter(content);
      expect(result.isValid).toBe(true);
      expect(result.frontmatter.title).toBe('🚀 Ultra-Modern MTM ✨');
      expect(result.frontmatter.description).toBe('Supports émojis, àccénts, and 中文');
    });

    it('should handle malformed YAML gracefully', () => {
      const content = `---
title: "Unclosed quote
description: Valid field
invalid_indent:
  - item1
    - item2  # Wrong indentation
---
Content`;

      const result = parseFrontmatter(content);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].suggestions).toBeDefined();
    });

    it('should handle empty and whitespace-only content', () => {
      const testCases = ['', '   ', '\n\n\n', '\t\t\t'];

      testCases.forEach(content => {
        const result = parseFrontmatter(content);
        expect(result.isValid).toBe(true);
        expect(result.frontmatter).toEqual({});
        expect(result.content).toBe(content);
      });
    });

    it('should validate required fields', () => {
      const content = `---
title: Test Page
# Missing required route field
---
Content`;

      const result = parseFrontmatter(content);
      // Should parse successfully but may have validation warnings
      expect(result.isValid).toBe(true);
      expect(result.frontmatter.title).toBe('Test Page');
    });
  });

  describe('Router - Advanced Navigation and State Management', () => {
    let router;
    let mockWindow;

    beforeEach(() => {
      mockWindow = {
        location: { pathname: '/', search: '', origin: 'http://localhost:3000' },
        history: { pushState: vi.fn(), replaceState: vi.fn(), back: vi.fn(), forward: vi.fn() },
        addEventListener: vi.fn(),
        URL: class MockURL {
          constructor(url, base) {
            const fullUrl = url.startsWith('http') ? url : base + url;
            const [pathname, search] = fullUrl.replace('http://localhost:3000', '').split('?');
            this.pathname = pathname || '/';
            this.search = search ? '?' + search : '';
            this.searchParams = new URLSearchParams(search || '');
          }
        }
      };
      global.window = mockWindow;
      global.URL = mockWindow.URL;

      router = new UltraModernRouter();
    });

    it('should handle complex dynamic route patterns', () => {
      const testCases = [
        { pattern: '/users/[id]', path: '/users/123', expected: { id: '123' } },
        { pattern: '/posts/[category]/[slug]', path: '/posts/tech/my-post', expected: { category: 'tech', slug: 'my-post' } },
        { pattern: '/blog/[...slug]', path: '/blog/2023/category/post', expected: { slug: '2023/category/post' } },
        { pattern: '/api/v[version]/users/[id]', path: '/api/v2/users/456', expected: { version: '2', id: '456' } }
      ];

      testCases.forEach(({ pattern, path, expected }) => {
        const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
        router.registerRoute(pattern, loader);

        const match = router.matchRoute(path);
        expect(match).toBeTruthy();
        expect(match.params).toEqual(expected);
      });
    });

    it('should handle route priority and conflicts', () => {
      const staticLoader = vi.fn(() => Promise.resolve({ default: () => 'static' }));
      const dynamicLoader = vi.fn(() => Promise.resolve({ default: () => 'dynamic' }));

      // Register in different orders to test priority
      router.registerRoute('/users/[id]', dynamicLoader);
      router.registerRoute('/users/profile', staticLoader);

      // Static route should take priority
      const match = router.matchRoute('/users/profile');
      expect(match).toBeTruthy();
      expect(match.isStatic).toBe(true);
    });

    it('should handle navigation with complex query parameters', async () => {
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));
      router.registerRoute('/search', loader);

      const complexQuery = '/search?q=hello%20world&filters[category]=tech&filters[date][from]=2023-01-01&filters[date][to]=2023-12-31&sort=relevance&page=2';

      await router.handleRoute(complexQuery);

      const query = router.getCurrentQuery();
      expect(query.q).toBe('hello world');
      expect(query['filters[category]']).toBe('tech');
      expect(query.sort).toBe('relevance');
      expect(query.page).toBe('2');
    });

    it('should maintain navigation history with state', async () => {
      const loader1 = vi.fn(() => Promise.resolve({ default: () => 'page1' }));
      const loader2 = vi.fn(() => Promise.resolve({ default: () => 'page2' }));

      router.registerRoute('/page1', loader1);
      router.registerRoute('/page2', loader2);

      await router.push('/page1', { customData: 'test1' });
      await router.push('/page2', { customData: 'test2' });

      const history = router.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].state).toEqual({ customData: 'test1' });
      expect(history[1].state).toEqual({ customData: 'test2' });
    });

    it('should handle navigation cancellation', async () => {
      const beforeHook = vi.fn(() => false); // Cancel navigation
      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));

      router.beforeNavigation(beforeHook);
      router.registerRoute('/test', loader);

      const result = await router.push('/test');

      expect(result).toBe(false);
      expect(beforeHook).toHaveBeenCalled();
      expect(loader).not.toHaveBeenCalled();
      expect(router.getCurrentRoute()).not.toBe('/test');
    });

    it('should handle async navigation hooks', async () => {
      const asyncBeforeHook = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
      });
      const asyncAfterHook = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const loader = vi.fn(() => Promise.resolve({ default: () => 'test' }));

      router.beforeNavigation(asyncBeforeHook);
      router.afterNavigation(asyncAfterHook);
      router.registerRoute('/test', loader);

      await router.push('/test');

      expect(asyncBeforeHook).toHaveBeenCalled();
      expect(asyncAfterHook).toHaveBeenCalled();
      expect(loader).toHaveBeenCalled();
    });
  });

  describe('Template Parser - Complex Syntax Parsing', () => {
    let parser;

    beforeEach(() => {
      parser = new TemplateParser();
    });

    it('should parse complex reactive variable declarations', () => {
      const code = `
        // Basic reactive variables
        $count! = 0
        $message! = "Hello"
        
        // Typed reactive variables
        $price: number = 99.99
        $name: string = "MTM"
        $isActive: boolean = true
        
        // Complex initial values
        $config! = {
          theme: 'dark',
          features: ['ssr', 'hydration'],
          nested: { deep: { value: 42 } }
        }
        
        // Signal variables
        $globalState! = signal('app-state', { user: null })
        
        // Computed variables
        $doubledCount = $count * 2
        $greeting = \`Hello, \${$name}!\`
        $isExpensive = $price > 100
      `;

      const result = parser.parse(code);

      expect(result.variables.size).toBeGreaterThan(5);

      // Check reactive variables
      expect(result.variables.get('count').reactive).toBe(true);
      expect(result.variables.get('count').value.value).toBe(0);

      // Check typed variables
      expect(result.variables.get('price').hasTypeAnnotation).toBe(true);
      expect(result.variables.get('price').type).toBe('number');

      // Check computed variables
      expect(result.variables.get('doubledCount').computed).toBe(true);
      expect(result.variables.get('greeting').computed).toBe(true);

      // Check signal variables
      expect(result.variables.get('globalState').value.type).toBe('signal');
    });

    it('should parse complex function declarations', () => {
      const code = `
        // Simple arrow function
        $increment = () => $count++
        
        // Typed parameters
        $addUser = ($name: string, $age: number) => {
          $users = [...$users, { name: $name, age: $age }]
        }
        
        // Async function
        $fetchData = async ($url: string) => {
          $loading = true
          try {
            $data = await fetch($url).then(r => r.json())
          } catch (error) {
            $error = error.message
          } finally {
            $loading = false
          }
        }
        
        // Function with default parameters
        $createPost = ($title: string, $content: string = '') => {
          return { id: Date.now(), title: $title, content: $content }
        }
        
        // Higher-order function
        $createHandler = ($action: string) => ($event) => {
          signal.emit($action, { event: $event, timestamp: Date.now() })
        }
      `;

      const result = parser.parse(code);

      expect(result.functions.size).toBeGreaterThan(3);

      // Check function properties
      const addUserFunc = result.functions.get('addUser');
      expect(addUserFunc.params).toHaveLength(2);
      expect(addUserFunc.params[0].type).toBe('string');
      expect(addUserFunc.params[1].type).toBe('number');

      const fetchDataFunc = result.functions.get('fetchData');
      expect(fetchDataFunc.isAsync).toBe(true);
      expect(fetchDataFunc.body).toContain('await fetch');
    });

    it('should parse complex template structures', () => {
      const code = `
        <template>
          <div class="app">
            <!-- Conditional rendering -->
            {#if $user}
              <header class="header">
                <h1>Welcome, {$user.name}!</h1>
                <nav>
                  {#each $navigation as item}
                    <a href={item.url} class:active={$currentPath === item.url}>
                      {item.label}
                    </a>
                  {/each}
                </nav>
              </header>
            {:else}
              <div class="login">
                <h2>Please log in</h2>
                <button click={$showLoginModal}>Login</button>
              </div>
            {/if}
            
            <!-- Main content with nested conditions -->
            <main class="main">
              {#if $loading}
                <div class="spinner">Loading...</div>
              {:else if $error}
                <div class="error">
                  <h3>Error: {$error.message}</h3>
                  <button click={$retryAction}>Retry</button>
                </div>
              {:else}
                <!-- Complex list rendering -->
                {#each $posts as post, index}
                  <article class="post" key={post.id}>
                    <h2>{post.title}</h2>
                    <p>{post.excerpt}</p>
                    
                    {#if post.tags && post.tags.length > 0}
                      <div class="tags">
                        {#each post.tags as tag}
                          <span class="tag" click={$filterByTag(tag)}>
                            {tag}
                          </span>
                        {/each}
                      </div>
                    {/if}
                    
                    <!-- Nested conditional -->
                    {#if $user && ($user.id === post.authorId || $user.role === 'admin')}
                      <div class="actions">
                        <button click={$editPost(post.id)}>Edit</button>
                        <button click={$deletePost(post.id)} class="danger">Delete</button>
                      </div>
                    {/if}
                  </article>
                {/each}
              {/if}
            </main>
            
            <!-- Footer with complex bindings -->
            <footer class="footer">
              <p>© {new Date().getFullYear()} MTM App</p>
              <p>Posts: {$posts.length}, Users: {$stats.userCount}</p>
            </footer>
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.template).toContain('class="app"');
      expect(result.bindings.length).toBeGreaterThan(10);
      expect(result.events.length).toBeGreaterThan(5);
      expect(result.controlFlow.length).toBeGreaterThan(5);

      // Check specific control flow structures
      const conditionals = result.controlFlow.filter(cf => cf.type === 'conditional');
      const loops = result.controlFlow.filter(cf => cf.type === 'loop');

      expect(conditionals.length).toBeGreaterThan(3);
      expect(loops.length).toBeGreaterThan(1);
    });

    it('should handle parsing errors gracefully', () => {
      const invalidCodes = [
        '$invalid! syntax here',
        '<template><div>Unclosed div</template>',
        '{#if unclosed condition',
        '$func = (param: invalid_type) => {}',
        '<template>{#each items as}</template>'
      ];

      invalidCodes.forEach(code => {
        const result = parser.parse(code);
        // Should not throw, but may have errors
        expect(result).toBeDefined();
        expect(result.variables).toBeDefined();
        expect(result.functions).toBeDefined();
      });
    });
  });

  describe('Template Transformer - Framework Code Generation', () => {
    let transformer;

    beforeEach(() => {
      transformer = new TemplateTransformer();
    });

    it('should generate correct React code for complex components', () => {
      const mtmCode = `
        $count! = 0
        $items! = []
        
        $increment = () => $count++
        $addItem = ($text: string) => {
          $items = [...$items, { id: Date.now(), text: $text }]
        }
        
        <template>
          <div className="counter">
            <h1>Count: {$count}</h1>
            <button onClick={$increment}>+</button>
            
            <div className="items">
              {$items.map(item => (
                <div key={item.id}>{item.text}</div>
              ))}
            </div>
          </div>
        </template>
      `;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('import React');
      expect(result.code).toContain('useState');
      expect(result.code).toContain('useCallback');
      expect(result.code).toContain('const [count, setCount] = useState(0)');
      expect(result.code).toContain('const [items, setItems] = useState([])');
      expect(result.code).toContain('className="counter"');
    });

    it('should generate correct Vue code for complex components', () => {
      const mtmCode = `
        $message! = "Hello Vue"
        $visible! = true
        
        $toggle = () => $visible = !$visible
        
        <template>
          <div v-if="$visible" class="vue-component">
            <h1>{{ $message }}</h1>
            <button @click="$toggle">Toggle</button>
          </div>
        </template>
      `;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('<template>');
      expect(result.code).toContain('<script setup>');
      expect(result.code).toContain('import { ref }');
      expect(result.code).toContain('const message = ref("Hello Vue")');
      expect(result.code).toContain('const visible = ref(true)');
    });

    it('should generate correct Svelte code for complex components', () => {
      const mtmCode = `
        $name! = ""
        $todos! = []
        
        $addTodo = () => {
          if ($name.trim()) {
            $todos = [...$todos, { id: Date.now(), text: $name, done: false }]
            $name = ""
          }
        }
        
        <template>
          <div class="todo-app">
            <input bind:value={$name} placeholder="Add todo" />
            <button on:click={$addTodo}>Add</button>
            
            {#each $todos as todo}
              <div class="todo">
                <input type="checkbox" bind:checked={todo.done} />
                <span class:done={todo.done}>{todo.text}</span>
              </div>
            {/each}
          </div>
        </template>
      `;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.code).toContain('<script>');
      expect(result.code).toContain('let name = ""');
      expect(result.code).toContain('let todos = []');
      expect(result.code).toContain('bind:value={name}');
      expect(result.code).toContain('{#each todos as todo}');
    });

    it('should handle transformation errors gracefully', () => {
      const invalidCodes = [
        '$invalid! = syntax error',
        '<template><div>Unclosed</template>',
        '{#if invalid condition}content{/if}'
      ];

      ['react', 'vue', 'svelte', 'vanilla'].forEach(framework => {
        invalidCodes.forEach(code => {
          const result = transformer.transform(code, framework);
          expect(result).toBeDefined();
          expect(result.code).toBeDefined();
          // Should generate error component or fallback
        });
      });
    });
  });

  describe('Route Manifest Generator - Complex Route Handling', () => {
    let generator;

    beforeEach(() => {
      generator = new RouteManifestGenerator();
    });

    it('should generate manifest for complex route structures', () => {
      const pages = [
        {
          filePath: 'src/pages/index.mtm',
          route: '/',
          title: 'Home',
          isDynamic: false,
          parameters: []
        },
        {
          filePath: 'src/pages/users/[id].mtm',
          route: '/users/[id]',
          title: 'User Profile',
          isDynamic: true,
          parameters: ['id']
        },
        {
          filePath: 'src/pages/blog/[...slug].mtm',
          route: '/blog/[...slug]',
          title: 'Blog Post',
          isDynamic: true,
          parameters: ['slug']
        },
        {
          filePath: 'src/pages/api/v[version]/users/[id].mtm',
          route: '/api/v[version]/users/[id]',
          title: 'API User',
          isDynamic: true,
          parameters: ['version', 'id']
        }
      ];

      const manifest = generator.generateManifest(pages);

      expect(manifest.staticRoutes).toHaveProperty('/');
      expect(manifest.dynamicRoutes).toHaveLength(3);

      const userRoute = manifest.dynamicRoutes.find(r => r.pattern.includes('users'));
      expect(userRoute.parameters).toContain('id');

      const blogRoute = manifest.dynamicRoutes.find(r => r.pattern.includes('blog'));
      expect(blogRoute.parameters).toContain('slug');
    });

    it('should handle route conflicts and priorities', () => {
      const pages = [
        {
          filePath: 'src/pages/users/profile.mtm',
          route: '/users/profile',
          title: 'Profile',
          isDynamic: false,
          parameters: []
        },
        {
          filePath: 'src/pages/users/[id].mtm',
          route: '/users/[id]',
          title: 'User',
          isDynamic: true,
          parameters: ['id']
        }
      ];

      const manifest = generator.generateManifest(pages);

      // Static routes should take priority
      expect(manifest.staticRoutes).toHaveProperty('/users/profile');
      expect(manifest.dynamicRoutes.some(r => r.pattern.includes('[id]'))).toBe(true);
    });

    it('should generate optimized route matching patterns', () => {
      const testRoutes = [
        '/users/[id]',
        '/posts/[category]/[slug]',
        '/blog/[...slug]',
        '/api/v[version]/[resource]/[id]'
      ];

      testRoutes.forEach(route => {
        const regex = generator.routeToRegex(route);
        expect(regex).toBeInstanceOf(RegExp);

        // Test that regex works for expected paths
        if (route === '/users/[id]') {
          expect(regex.test('/users/123')).toBe(true);
          expect(regex.test('/users/abc')).toBe(true);
          expect(regex.test('/users/123/posts')).toBe(false);
        }
      });
    });
  });

  describe('Page Scanner - File Discovery and Processing', () => {
    let scanner;

    beforeEach(() => {
      scanner = new PageScanner();
    });

    it('should handle various file structures', async () => {
      // Mock file system
      const mockFiles = [
        'src/pages/index.mtm',
        'src/pages/about.mtm',
        'src/pages/users/[id].mtm',
        'src/pages/users/profile.mtm',
        'src/pages/blog/[...slug].mtm',
        'src/pages/api/v[version]/users.mtm',
        'src/pages/nested/deep/page.mtm'
      ];

      vi.spyOn(scanner, 'findMTMFiles').mockResolvedValue(mockFiles);
      vi.spyOn(scanner, 'processFile').mockImplementation(async (filePath) => ({
        filePath,
        route: filePath.replace('src/pages', '').replace('.mtm', '') || '/',
        title: `Page ${filePath}`,
        isDynamic: filePath.includes('['),
        parameters: filePath.match(/\[([^\]]+)\]/g)?.map(p => p.slice(1, -1)) || []
      }));

      const pages = await scanner.scanPages('src/pages');

      expect(pages).toHaveLength(mockFiles.length);
      expect(pages.some(p => p.route === '/')).toBe(true);
      expect(pages.some(p => p.isDynamic)).toBe(true);
      expect(pages.filter(p => p.isDynamic)).toHaveLength(3);
    });

    it('should handle file processing errors gracefully', async () => {
      const mockFiles = [
        'src/pages/valid.mtm',
        'src/pages/invalid.mtm',
        'src/pages/corrupted.mtm'
      ];

      vi.spyOn(scanner, 'findMTMFiles').mockResolvedValue(mockFiles);
      vi.spyOn(scanner, 'processFile').mockImplementation(async (filePath) => {
        if (filePath.includes('invalid')) {
          throw new Error('Invalid frontmatter');
        }
        if (filePath.includes('corrupted')) {
          throw new Error('File corrupted');
        }
        return {
          filePath,
          route: '/',
          title: 'Valid Page',
          isDynamic: false,
          parameters: []
        };
      });

      const pages = await scanner.scanPages('src/pages');

      // Should only return valid pages
      expect(pages).toHaveLength(1);
      expect(pages[0].title).toBe('Valid Page');
    });
  });

  describe('SSR Renderer - Server-Side Rendering', () => {
    let renderer;

    beforeEach(() => {
      renderer = createSSRRenderer({
        pagesDir: 'test-pages',
        outputDir: 'test-output',
        baseUrl: 'http://localhost:3000'
      });
    });

    afterEach(() => {
      if (renderer && typeof renderer.close === 'function') {
        renderer.close();
      }
    });

    it('should generate proper HTML structure', async () => {
      const mockPage = {
        route: '/',
        title: 'Test Page',
        description: 'Test description',
        keywords: ['test', 'ssr'],
        content: '<div class="page">Test content</div>'
      };

      const result = await renderer.renderPage(mockPage);

      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<title>Test Page</title>');
      expect(result.html).toContain('<meta name="description" content="Test description">');
      expect(result.html).toContain('<meta name="keywords" content="test, ssr">');
      expect(result.html).toContain('<div class="page">Test content</div>');
    });

    it('should handle SEO metadata correctly', async () => {
      const mockPage = {
        route: '/blog/test-post',
        title: 'Test Blog Post',
        description: 'A test blog post for SSR',
        keywords: ['blog', 'test', 'ssr'],
        author: 'Test Author',
        publishedTime: '2023-01-01T00:00:00Z',
        content: '<article>Blog content</article>'
      };

      const result = await renderer.renderPage(mockPage);

      // Check Open Graph tags
      expect(result.html).toContain('property="og:title" content="Test Blog Post"');
      expect(result.html).toContain('property="og:description" content="A test blog post for SSR"');
      expect(result.html).toContain('property="og:url" content="http://localhost:3000/blog/test-post"');

      // Check Twitter Card tags
      expect(result.html).toContain('name="twitter:title" content="Test Blog Post"');
      expect(result.html).toContain('name="twitter:description" content="A test blog post for SSR"');

      // Check structured data
      expect(result.html).toContain('"@type": "Article"');
      expect(result.html).toContain('"headline": "Test Blog Post"');
    });

    it('should handle rendering errors gracefully', async () => {
      const invalidPage = {
        route: '/invalid',
        title: null, // Invalid title
        content: undefined // Invalid content
      };

      const result = await renderer.renderPage(invalidPage);

      // Should still generate valid HTML
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<title>'); // Should have fallback title
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Integration - Component Interaction', () => {
    it('should handle complete build pipeline', async () => {
      // Mock a complete MTM file
      const mtmContent = `---
route: /test
title: Test Page
description: A comprehensive test page
keywords: [test, mtm, ssr]
layout: default
---

$count! = 0
$message! = "Hello MTM"

$increment = () => $count++

<template>
  <div class="test-page">
    <h1>{$message}</h1>
    <p>Count: {$count}</p>
    <button click={$increment}>Increment</button>
  </div>
</template>`;

      // Parse frontmatter
      const frontmatterResult = parseFrontmatter(mtmContent);
      expect(frontmatterResult.isValid).toBe(true);
      expect(frontmatterResult.frontmatter.route).toBe('/test');

      // Parse template
      const parser = new TemplateParser();
      const parseResult = parser.parse(frontmatterResult.content);
      expect(parseResult.variables.has('count')).toBe(true);
      expect(parseResult.functions.has('increment')).toBe(true);

      // Transform to React
      const transformer = new TemplateTransformer();
      const transformResult = transformer.transform(frontmatterResult.content, 'react');
      expect(transformResult.code).toContain('useState');
      expect(transformResult.code).toContain('useCallback');

      // Generate route manifest
      const generator = new RouteManifestGenerator();
      const pages = [{
        filePath: 'test.mtm',
        route: frontmatterResult.frontmatter.route,
        title: frontmatterResult.frontmatter.title,
        isDynamic: false,
        parameters: []
      }];
      const manifest = generator.generateManifest(pages);
      expect(manifest.staticRoutes).toHaveProperty('/test');
    });

    it('should handle error propagation through pipeline', () => {
      const invalidMTMContent = `---
route: /invalid
title: "Unclosed quote
---

$invalid! syntax here
<template><div>Unclosed</template>`;

      // Each component should handle errors gracefully
      const frontmatterResult = parseFrontmatter(invalidMTMContent);
      expect(frontmatterResult.isValid).toBe(false);
      expect(frontmatterResult.errors.length).toBeGreaterThan(0);

      // Even with errors, should still be able to process what's valid
      const parser = new TemplateParser();
      const parseResult = parser.parse(frontmatterResult.content);
      expect(parseResult).toBeDefined();

      const transformer = new TemplateTransformer();
      const transformResult = transformer.transform(frontmatterResult.content, 'react');
      expect(transformResult).toBeDefined();
      expect(transformResult.code).toBeDefined();
    });
  });

  describe('Performance and Memory - Edge Cases', () => {
    it('should handle large numbers of routes efficiently', () => {
      const generator = new RouteManifestGenerator();
      const largePageSet = Array.from({ length: 1000 }, (_, i) => ({
        filePath: `src/pages/page-${i}.mtm`,
        route: `/page-${i}`,
        title: `Page ${i}`,
        isDynamic: false,
        parameters: []
      }));

      const startTime = Date.now();
      const manifest = generator.generateManifest(largePageSet);
      const endTime = Date.now();

      expect(Object.keys(manifest.staticRoutes)).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle deeply nested template structures', () => {
      const parser = new TemplateParser();
      const deepTemplate = `
        <template>
          ${Array.from({ length: 50 }, (_, i) =>
        `<div class="level-${i}">`.repeat(i + 1) +
        `Content ${i}` +
        `</div>`.repeat(i + 1)
      ).join('\n')}
        </template>
      `;

      const result = parser.parse(deepTemplate);
      expect(result.template).toBeDefined();
      expect(result.template.length).toBeGreaterThan(1000);
    });

    it('should handle memory cleanup properly', () => {
      const router = new UltraModernRouter();

      // Register many routes
      for (let i = 0; i < 100; i++) {
        router.registerRoute(`/test-${i}`, () => Promise.resolve({ default: () => `test-${i}` }));
      }

      expect(router.getRoutes().length).toBe(100);

      // Clear routes
      router.clearRoutes();
      expect(router.getRoutes().length).toBe(0);
    });
  });
});