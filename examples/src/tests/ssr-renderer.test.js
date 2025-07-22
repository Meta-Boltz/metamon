/**
 * Tests for SSR Renderer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SSRRenderer, createSSRRenderer } from '../build-tools/ssr-renderer.js';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../build-tools/page-scanner.js', () => ({
  createPageScanner: vi.fn(() => ({
    scanPages: vi.fn(),
    close: vi.fn()
  }))
}));

vi.mock('../build-tools/route-manifest-generator.js', () => ({
  createRouteManifestGenerator: vi.fn(() => ({
    generateRouteManifest: vi.fn(),
    close: vi.fn()
  }))
}));

vi.mock('../build-tools/template-transformer.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    transform: vi.fn()
  }))
}));

vi.mock('../build-tools/frontmatter-processor.js', () => ({
  createFrontmatterProcessor: vi.fn(() => ({
    process: vi.fn()
  }))
}));

vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(() => ({
    window: {
      document: {
        createElement: vi.fn(() => ({
          outerHTML: '<div>Mock Element</div>'
        }))
      },
      HTMLElement: class MockHTMLElement { }
    }
  }))
}));

describe('SSRRenderer', () => {
  let renderer;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    renderer = new SSRRenderer({
      pagesDir: 'test/pages',
      outputDir: 'test/dist',
      baseUrl: 'http://localhost:3000'
    });
  });

  afterEach(() => {
    if (renderer) {
      renderer.close();
    }
  });

  describe('Constructor', () => {
    it('should create SSRRenderer with default options', () => {
      const defaultRenderer = new SSRRenderer();

      expect(defaultRenderer.options.pagesDir).toBe('src/pages');
      expect(defaultRenderer.options.outputDir).toBe('dist');
      expect(defaultRenderer.options.generateStaticHTML).toBe(true);
      expect(defaultRenderer.options.extractCriticalCSS).toBe(true);
    });

    it('should create SSRRenderer with custom options', () => {
      expect(renderer.options.pagesDir).toBe('test/pages');
      expect(renderer.options.outputDir).toBe('test/dist');
      expect(renderer.options.baseUrl).toBe('http://localhost:3000');
    });

    it('should initialize all required components', () => {
      expect(renderer.pageScanner).toBeDefined();
      expect(renderer.routeGenerator).toBeDefined();
      expect(renderer.transformer).toBeDefined();
      expect(renderer.frontmatterProcessor).toBeDefined();
    });
  });

  describe('renderAllPages', () => {
    beforeEach(() => {
      // Mock file system operations
      fs.mkdir = vi.fn().mockResolvedValue();
      fs.writeFile = vi.fn().mockResolvedValue();
      fs.readFile = vi.fn().mockResolvedValue('---\ntitle: Test Page\n---\n<div>Test Content</div>');

      // Mock page scanner
      renderer.pageScanner.scanPages = vi.fn().mockResolvedValue([
        {
          route: '/',
          filePath: 'test/pages/index.mtm',
          title: 'Home',
          description: 'Home page'
        },
        {
          route: '/about',
          filePath: 'test/pages/about.mtm',
          title: 'About',
          description: 'About page'
        }
      ]);

      // Mock route generator
      renderer.routeGenerator.generateRouteManifest = vi.fn().mockResolvedValue({
        staticRoutes: {
          '/': { path: '/', component: 'index.mtm' },
          '/about': { path: '/about', component: 'about.mtm' }
        },
        dynamicRoutes: [],
        fallbackRoutes: []
      });

      // Mock frontmatter processor
      renderer.frontmatterProcessor.process = vi.fn().mockReturnValue({
        frontmatter: {
          title: 'Test Page',
          description: 'Test Description'
        },
        content: '<div>Test Content</div>',
        errors: []
      });

      // Mock transformer
      renderer.transformer.transform = vi.fn().mockReturnValue({
        code: 'export default function Component() { return "<div>Test Content</div>"; }',
        errors: [],
        warnings: []
      });
    });

    it('should render all pages successfully', async () => {
      const result = await renderer.renderAllPages();

      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].route).toBe('/');
      expect(result.pages[1].route).toBe('/about');
      expect(renderer.pageScanner.scanPages).toHaveBeenCalledWith('test/pages');
      expect(renderer.routeGenerator.generateRouteManifest).toHaveBeenCalled();
    });

    it('should handle page rendering errors gracefully', async () => {
      // Make one page fail
      fs.readFile = vi.fn()
        .mockResolvedValueOnce('---\ntitle: Home\n---\n<div>Home</div>')
        .mockRejectedValueOnce(new Error('File not found'));

      const result = await renderer.renderAllPages();

      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].success).toBe(true);
      expect(result.pages[1].success).toBe(false);
      expect(result.pages[1].error).toBe('File not found');
    });

    it('should create output directory', async () => {
      await renderer.renderAllPages();

      expect(fs.mkdir).toHaveBeenCalledWith('test/dist', { recursive: true });
    });

    it('should generate additional assets', async () => {
      await renderer.renderAllPages();

      // Should generate sitemap, robots.txt, etc.
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('sitemap.xml'),
        expect.stringContaining('<?xml version="1.0"')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('robots.txt'),
        expect.stringContaining('User-agent: *')
      );
    });
  });

  describe('renderPage', () => {
    const mockPageInfo = {
      route: '/test',
      filePath: 'test/pages/test.mtm',
      title: 'Test Page',
      description: 'Test Description'
    };

    beforeEach(() => {
      fs.readFile = vi.fn().mockResolvedValue('---\ntitle: Test\n---\n<div>Content</div>');
      fs.mkdir = vi.fn().mockResolvedValue();
      fs.writeFile = vi.fn().mockResolvedValue();

      renderer.frontmatterProcessor.process = vi.fn().mockReturnValue({
        frontmatter: {
          title: 'Test Page',
          description: 'Test Description'
        },
        content: '<div>Test Content</div>',
        errors: []
      });

      renderer.transformer.transform = vi.fn().mockReturnValue({
        code: 'export default function Component() { return "<div>Test Content</div>"; }',
        errors: [],
        warnings: []
      });
    });

    it('should render a single page successfully', async () => {
      const result = await renderer.renderPage(mockPageInfo);

      expect(result.success).toBe(true);
      expect(result.route).toBe('/test');
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('Test Page');
      expect(result.metadata.title).toBe('Test Page');
    });

    it('should handle frontmatter processing errors', async () => {
      renderer.frontmatterProcessor.process = vi.fn().mockReturnValue({
        frontmatter: {},
        content: '',
        errors: [{ message: 'Invalid frontmatter' }]
      });

      await expect(renderer.renderPage(mockPageInfo)).rejects.toThrow('Frontmatter errors: Invalid frontmatter');
    });

    it('should handle transformation errors', async () => {
      renderer.transformer.transform = vi.fn().mockReturnValue({
        code: '',
        errors: [{ message: 'Transform failed' }],
        warnings: []
      });

      await expect(renderer.renderPage(mockPageInfo)).rejects.toThrow('Transform errors: Transform failed');
    });

    it('should extract critical CSS when enabled', async () => {
      renderer.options.extractCriticalCSS = true;

      const result = await renderer.renderPage(mockPageInfo);

      expect(result.criticalCSS).toBeDefined();
      expect(typeof result.criticalCSS).toBe('string');
    });

    it('should fetch page data when configured', async () => {
      renderer.frontmatterProcessor.process = vi.fn().mockReturnValue({
        frontmatter: {
          title: 'Test Page',
          dataFetch: '/api/test'
        },
        content: '<div>Test Content</div>',
        errors: []
      });

      const result = await renderer.renderPage(mockPageInfo);

      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('object');
    });
  });

  describe('renderComponentToHTML', () => {
    const mockContext = {
      route: '/test',
      params: {},
      metadata: { title: 'Test' },
      isSSR: true
    };

    it('should render component code to HTML', async () => {
      const componentCode = `
        export default function Component() {
          return "<div>Hello World</div>";
        }
      `;

      const result = await renderer.renderComponentToHTML(componentCode, mockContext);

      expect(result.html).toBeDefined();
      expect(typeof result.html).toBe('string');
      expect(result.context).toEqual(mockContext);
    });

    it('should handle component rendering errors', async () => {
      const invalidCode = 'invalid javascript code';

      const result = await renderer.renderComponentToHTML(invalidCode, mockContext);

      expect(result.html).toContain('Server Rendering Error');
      expect(result.error).toBeDefined();
    });

    it('should create SSR signal mock', () => {
      const signalMock = renderer.createSSRSignalMock();

      expect(signalMock.signal).toBeInstanceOf(Function);
      expect(signalMock.use).toBeInstanceOf(Function);
      expect(signalMock.emit).toBeInstanceOf(Function);
      expect(signalMock.on).toBeInstanceOf(Function);

      const signal = signalMock.signal('test', 'initial');
      expect(signal.value).toBe('initial');
    });
  });

  describe('extractCriticalCSS', () => {
    it('should extract CSS selectors from HTML', async () => {
      const html = '<div class="container header" id="main">Content</div>';

      const css = await renderer.extractCriticalCSS(html, '/test');

      expect(css).toContain('.container');
      expect(css).toContain('.header');
      expect(css).toContain('#main');
    });

    it('should generate basic CSS for common selectors', () => {
      const css = renderer.generateBasicCSS('.container');
      expect(css).toContain('max-width: 1200px');

      const btnCSS = renderer.generateBasicCSS('.btn');
      expect(btnCSS).toContain('background: #007bff');
    });

    it('should return null for unknown selectors', () => {
      const css = renderer.generateBasicCSS('.unknown-selector');
      expect(css).toBeNull();
    });
  });

  describe('fetchPageData', () => {
    const mockContext = {
      route: '/test',
      baseUrl: 'http://localhost:3000'
    };

    it('should fetch data from API endpoint', async () => {
      const data = await renderer.fetchPageData('/api/posts', mockContext);

      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle complex data fetch configuration', async () => {
      const config = {
        api: '/api/posts',
        static: 'data.json',
        computed: { totalPosts: true }
      };

      const data = await renderer.fetchPageData(config, mockContext);

      expect(data.api).toBeDefined();
      expect(data.static).toBeDefined();
      expect(data.computed).toBeDefined();
    });

    it('should cache fetched data', async () => {
      const spy = vi.spyOn(renderer, 'fetchFromAPI');

      // First call
      await renderer.fetchPageData('/api/posts', mockContext);
      // Second call should use cache
      await renderer.fetchPageData('/api/posts', mockContext);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch errors gracefully', async () => {
      const data = await renderer.fetchPageData('/api/nonexistent', mockContext);

      expect(data).toEqual({});
    });
  });

  describe('generateHTMLDocument', () => {
    const mockOptions = {
      title: 'Test Page',
      description: 'Test Description',
      keywords: ['test', 'page'],
      content: '<div>Content</div>',
      criticalCSS: '.test { color: red; }',
      metadata: { lang: 'en' },
      preloadData: { test: 'data' },
      route: '/test'
    };

    it('should generate complete HTML document', () => {
      const html = renderer.generateHTMLDocument(mockOptions);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test Page</title>');
      expect(html).toContain('Test Description');
      expect(html).toContain('test, page');
      expect(html).toContain('<div>Content</div>');
      expect(html).toContain('.test { color: red; }');
      expect(html).toContain('"test":"data"');
    });

    it('should include Open Graph meta tags', () => {
      const html = renderer.generateHTMLDocument(mockOptions);

      expect(html).toContain('property="og:title"');
      expect(html).toContain('property="og:description"');
      expect(html).toContain('property="og:url"');
    });

    it('should include Twitter meta tags', () => {
      const html = renderer.generateHTMLDocument(mockOptions);

      expect(html).toContain('property="twitter:title"');
      expect(html).toContain('property="twitter:description"');
      expect(html).toContain('property="twitter:url"');
    });

    it('should include SSR metadata', () => {
      const html = renderer.generateHTMLDocument(mockOptions);

      expect(html).toContain('name="ssr-rendered"');
      expect(html).toContain('name="ssr-build-time"');
      expect(html).toContain('window.__SSR_DATA__');
      expect(html).toContain('window.__SSR_ROUTE__');
    });
  });

  describe('Utility methods', () => {
    it('should extract route parameters', () => {
      const params = renderer.extractRouteParams('/users/[id]/posts/[slug]');

      expect(params.id).toBe('mock-id');
      expect(params.slug).toBe('mock-slug');
    });

    it('should get correct output path', () => {
      expect(renderer.getOutputPath('/')).toBe(path.join('test/dist', 'index.html'));
      expect(renderer.getOutputPath('/about')).toBe(path.join('test/dist', 'about.html'));
      expect(renderer.getOutputPath('/blog/post')).toBe(path.join('test/dist', 'blog/post.html'));
    });

    it('should minify HTML when enabled', async () => {
      renderer.options.minifyHTML = true;
      fs.writeFile = vi.fn();

      const html = `
        <html>
          <body>
            <div>  Content  </div>
          </body>
        </html>
      `;

      await renderer.writeHTMLFile('test.html', html);

      const writtenHTML = fs.writeFile.mock.calls[0][1];
      expect(writtenHTML).not.toContain('\n');
      expect(writtenHTML.length).toBeLessThan(html.length);
    });
  });

  describe('createSSRRenderer factory', () => {
    it('should create SSRRenderer instance', () => {
      const renderer = createSSRRenderer({ pagesDir: 'custom/pages' });

      expect(renderer).toBeInstanceOf(SSRRenderer);
      expect(renderer.options.pagesDir).toBe('custom/pages');
    });
  });

  describe('Resource cleanup', () => {
    it('should close all resources', () => {
      const closeSpy1 = vi.spyOn(renderer.pageScanner, 'close');
      const closeSpy2 = vi.spyOn(renderer.routeGenerator, 'close');

      renderer.close();

      expect(closeSpy1).toHaveBeenCalled();
      expect(closeSpy2).toHaveBeenCalled();
      expect(renderer.dataCache.size).toBe(0);
      expect(renderer.pageStyles.size).toBe(0);
    });
  });
});