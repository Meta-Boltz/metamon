/**
 * Integration Tests for SSR Rendering and Hydration Process
 * Tests server-side rendering and progressive hydration scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock DOM environment for SSR testing
const mockDocument = {
  createElement: vi.fn(() => ({
    innerHTML: '',
    outerHTML: '',
    className: '',
    id: '',
    style: {},
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => [])
  })),
  getElementById: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  body: {
    innerHTML: '',
    appendChild: vi.fn(),
    removeChild: vi.fn()
  },
  head: {
    innerHTML: '',
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
};

const mockWindow = {
  document: mockDocument,
  location: {
    pathname: '/',
    search: '',
    hash: '',
    href: 'http://localhost:3000/'
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Mock server environment
const mockServerResponse = {
  writeHead: vi.fn(),
  write: vi.fn(),
  end: vi.fn(),
  setHeader: vi.fn()
};

// SSR Context interface
interface SSRContext {
  url: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  locale?: string;
  userAgent?: string;
  isBot?: boolean;
}

// SSR Result interface
interface SSRResult {
  html: string;
  css: string;
  metadata: {
    title: string;
    description: string;
    keywords: string[];
    status: number;
  };
  preloadData: any;
  hydrationData: any;
}

// Mock SSR Renderer
class MockSSRRenderer {
  private routes = new Map();
  private components = new Map();
  private cssExtractor: any;
  private dataFetcher: any;

  constructor() {
    this.cssExtractor = new MockCSSExtractor();
    this.dataFetcher = new MockDataFetcher();
  }

  registerRoute(path: string, component: any, metadata: any = {}) {
    this.routes.set(path, { component, metadata });
    this.components.set(component.name, component);
  }

  async renderPage(route: string, context: SSRContext): Promise<SSRResult> {
    try {
      const routeInfo = this.routes.get(route);
      if (!routeInfo) {
        throw new Error(`Route not found: ${route}`);
      }

      const { component, metadata } = routeInfo;

      // Fetch data for SSR
      const preloadData = await this.dataFetcher.fetchData(route, context);

      // Render component to HTML
      const componentHTML = await this.renderComponent(component, {
        ...context,
        data: preloadData
      });

      // Extract critical CSS
      const criticalCSS = await this.cssExtractor.extractCritical(componentHTML);

      // Generate full HTML
      const html = this.generateHTML(componentHTML, {
        title: metadata.title || 'MTM App',
        description: metadata.description || '',
        keywords: metadata.keywords || [],
        css: criticalCSS,
        preloadData,
        route
      });

      return {
        html,
        css: criticalCSS,
        metadata: {
          title: metadata.title || 'MTM App',
          description: metadata.description || '',
          keywords: metadata.keywords || [],
          status: metadata.status || 200
        },
        preloadData,
        hydrationData: {
          route,
          initialProps: preloadData,
          timestamp: Date.now()
        }
      };

    } catch (error: any) {
      throw new Error(`SSR rendering failed: ${error.message}`);
    }
  }

  private async renderComponent(component: any, context: any): Promise<string> {
    if (typeof component.renderToString === 'function') {
      return await component.renderToString(context);
    }

    if (typeof component.render === 'function') {
      return component.render(context);
    }

    // Fallback for simple components
    return `<div class="${component.name.toLowerCase()}">${component.name} Component</div>`;
  }

  private generateHTML(componentHTML: string, options: any): string {
    const { title, description, keywords, css, preloadData, route } = options;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords.join(', ')}">
  <style id="critical-css">${css}</style>
  <script id="hydration-data" type="application/json">
    ${JSON.stringify({ route, preloadData, timestamp: Date.now() })}
  </script>
</head>
<body>
  <div id="app">${componentHTML}</div>
  <script src="/client.js" defer></script>
</body>
</html>`;
  }

  async renderToStream(route: string, context: SSRContext, response: any) {
    try {
      const result = await this.renderPage(route, context);
      
      response.writeHead(result.metadata.status, {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600'
      });

      // Stream HTML in chunks for better performance
      const chunks = this.chunkHTML(result.html);
      
      for (const chunk of chunks) {
        response.write(chunk);
        // Simulate streaming delay
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      response.end();

    } catch (error: any) {
      response.writeHead(500, { 'Content-Type': 'text/html' });
      response.end(`<html><body><h1>Server Error</h1><p>${error.message}</p></body></html>`);
    }
  }

  private chunkHTML(html: string): string[] {
    const chunkSize = 1024;
    const chunks = [];
    
    for (let i = 0; i < html.length; i += chunkSize) {
      chunks.push(html.slice(i, i + chunkSize));
    }
    
    return chunks;
  }
}

// Mock CSS Extractor
class MockCSSExtractor {
  private criticalCSS = new Map();

  constructor() {
    // Pre-populate with some critical CSS
    this.criticalCSS.set('Home', 'body { margin: 0; } .home { padding: 20px; }');
    this.criticalCSS.set('About', '.about { background: #f5f5f5; padding: 20px; }');
    this.criticalCSS.set('Profile', '.profile { display: flex; gap: 20px; }');
  }

  async extractCritical(html: string): Promise<string> {
    const componentMatches = html.match(/class="(\w+)"/g) || [];
    const components = componentMatches.map(match => 
      match.replace('class="', '').replace('"', '')
    );

    let criticalCSS = '';
    
    for (const component of components) {
      const componentCSS = this.criticalCSS.get(component);
      if (componentCSS) {
        criticalCSS += componentCSS + '\n';
      }
    }

    // Add base critical CSS
    criticalCSS = `
      * { box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      #app { min-height: 100vh; }
      ${criticalCSS}
    `;

    return criticalCSS.trim();
  }

  addCriticalCSS(component: string, css: string) {
    this.criticalCSS.set(component, css);
  }
}

// Mock Data Fetcher
class MockDataFetcher {
  private dataCache = new Map();

  async fetchData(route: string, context: SSRContext): Promise<any> {
    // Simulate data fetching delay
    await new Promise(resolve => setTimeout(resolve, 50));

    const cacheKey = `${route}-${context.locale || 'en'}`;
    
    if (this.dataCache.has(cacheKey)) {
      return this.dataCache.get(cacheKey);
    }

    let data = {};

    switch (route) {
      case '/':
        data = {
          title: 'Welcome Home',
          posts: [
            { id: 1, title: 'First Post', excerpt: 'This is the first post' },
            { id: 2, title: 'Second Post', excerpt: 'This is the second post' }
          ]
        };
        break;
      case '/about':
        data = {
          title: 'About Us',
          content: 'We are a modern web development company',
          team: [
            { name: 'John Doe', role: 'Developer' },
            { name: 'Jane Smith', role: 'Designer' }
          ]
        };
        break;
      default:
        if (route.startsWith('/users/')) {
          const userId = route.split('/')[2];
          data = {
            user: {
              id: userId,
              name: `User ${userId}`,
              email: `user${userId}@example.com`,
              profile: {
                bio: `This is user ${userId}'s profile`,
                posts: 5,
                followers: 10
              }
            }
          };
        }
    }

    this.dataCache.set(cacheKey, data);
    return data;
  }

  clearCache() {
    this.dataCache.clear();
  }
}

// Mock Hydration Manager
class MockHydrationManager {
  private hydratedComponents = new Set();
  private hydrationQueue: any[] = [];
  private isHydrating = false;

  async hydrate(containerId: string, component: any, props: any = {}) {
    if (this.hydratedComponents.has(containerId)) {
      return { success: true, reason: 'already_hydrated' };
    }

    try {
      this.isHydrating = true;

      // Simulate hydration process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mock component hydration
      const container = mockDocument.getElementById(containerId);
      if (!container) {
        throw new Error(`Container not found: ${containerId}`);
      }

      // Simulate React/Vue/Svelte hydration
      const hydratedComponent = await this.hydrateComponent(component, props);
      
      this.hydratedComponents.add(containerId);
      this.isHydrating = false;

      return {
        success: true,
        component: hydratedComponent,
        containerId,
        hydrationTime: Date.now()
      };

    } catch (error: any) {
      this.isHydrating = false;
      throw new Error(`Hydration failed: ${error.message}`);
    }
  }

  private async hydrateComponent(component: any, props: any) {
    // Simulate framework-specific hydration
    if (component.hydrate) {
      return await component.hydrate(props);
    }

    // Fallback hydration
    return {
      ...component,
      props,
      isHydrated: true,
      mount: vi.fn(),
      unmount: vi.fn(),
      update: vi.fn()
    };
  }

  async hydrateProgressively(components: any[]) {
    const results = [];

    for (const { containerId, component, props } of components) {
      try {
        const result = await this.hydrate(containerId, component, props);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          containerId
        });
      }
    }

    return results;
  }

  isComponentHydrated(containerId: string): boolean {
    return this.hydratedComponents.has(containerId);
  }

  getHydratedComponents(): string[] {
    return Array.from(this.hydratedComponents);
  }

  isCurrentlyHydrating(): boolean {
    return this.isHydrating;
  }

  reset() {
    this.hydratedComponents.clear();
    this.hydrationQueue = [];
    this.isHydrating = false;
  }
}

// Mock components for testing
const createMockSSRComponent = (name: string, hasData: boolean = false) => ({
  name,
  renderToString: async (context: any) => {
    const data = hasData ? context.data : {};
    const dataStr = Object.keys(data).length > 0 ? JSON.stringify(data) : '';
    
    return `<div class="${name.toLowerCase()}" data-component="${name}" data-ssr="true">
      <h1>${name} Component</h1>
      ${dataStr ? `<script type="application/json" data-props>${dataStr}</script>` : ''}
    </div>`;
  },
  hydrate: async (props: any) => ({
    name,
    props,
    isHydrated: true,
    mount: vi.fn(),
    unmount: vi.fn()
  })
});

describe('SSR Rendering and Hydration Integration', () => {
  let ssrRenderer: MockSSRRenderer;
  let hydrationManager: MockHydrationManager;
  let cssExtractor: MockCSSExtractor;
  let dataFetcher: MockDataFetcher;

  beforeEach(() => {
    ssrRenderer = new MockSSRRenderer();
    hydrationManager = new MockHydrationManager();
    cssExtractor = new MockCSSExtractor();
    dataFetcher = new MockDataFetcher();

    // Register test routes
    ssrRenderer.registerRoute('/', createMockSSRComponent('Home', true), {
      title: 'Home Page',
      description: 'Welcome to our home page',
      keywords: ['home', 'welcome']
    });

    ssrRenderer.registerRoute('/about', createMockSSRComponent('About', true), {
      title: 'About Us',
      description: 'Learn more about our company',
      keywords: ['about', 'company']
    });

    ssrRenderer.registerRoute('/users/123', createMockSSRComponent('Profile', true), {
      title: 'User Profile',
      description: 'User profile page',
      keywords: ['user', 'profile']
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    hydrationManager.reset();
    dataFetcher.clearCache();
  });

  describe('Server-Side Rendering', () => {
    it('should render pages with full HTML content', async () => {
      const context: SSRContext = {
        url: '/',
        headers: { 'user-agent': 'Mozilla/5.0' },
        cookies: {},
        locale: 'en'
      };

      const result = await ssrRenderer.renderPage('/', context);

      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<title>Home Page</title>');
      expect(result.html).toContain('<div class="home"');
      expect(result.html).toContain('data-ssr="true"');
      expect(result.html).toContain('Home Component');
    });

    it('should include critical CSS in rendered HTML', async () => {
      const context: SSRContext = {
        url: '/about',
        headers: {},
        cookies: {}
      };

      const result = await ssrRenderer.renderPage('/about', context);

      expect(result.css).toContain('.about { background: #f5f5f5');
      expect(result.html).toContain('<style id="critical-css">');
      expect(result.html).toContain('font-family: -apple-system');
    });

    it('should include preloaded data in HTML', async () => {
      const context: SSRContext = {
        url: '/',
        headers: {},
        cookies: {}
      };

      const result = await ssrRenderer.renderPage('/', context);

      expect(result.preloadData).toBeDefined();
      expect(result.preloadData.title).toBe('Welcome Home');
      expect(result.preloadData.posts).toHaveLength(2);
      expect(result.html).toContain('<script id="hydration-data"');
      expect(result.html).toContain('"route":"/"');
    });

    it('should handle dynamic routes with parameters', async () => {
      const context: SSRContext = {
        url: '/users/123',
        headers: {},
        cookies: {}
      };

      const result = await ssrRenderer.renderPage('/users/123', context);

      expect(result.success).toBe(true);
      expect(result.preloadData.user.id).toBe('123');
      expect(result.preloadData.user.name).toBe('User 123');
      expect(result.html).toContain('Profile Component');
    });

    it('should generate proper SEO metadata', async () => {
      const context: SSRContext = {
        url: '/about',
        headers: {},
        cookies: {}
      };

      const result = await ssrRenderer.renderPage('/about', context);

      expect(result.metadata.title).toBe('About Us');
      expect(result.metadata.description).toBe('Learn more about our company');
      expect(result.metadata.keywords).toEqual(['about', 'company']);
      expect(result.html).toContain('<meta name="description" content="Learn more about our company">');
      expect(result.html).toContain('<meta name="keywords" content="about, company">');
    });

    it('should handle SSR errors gracefully', async () => {
      const context: SSRContext = {
        url: '/non-existent',
        headers: {},
        cookies: {}
      };

      await expect(ssrRenderer.renderPage('/non-existent', context))
        .rejects.toThrow('Route not found: /non-existent');
    });
  });

  describe('Streaming SSR', () => {
    it('should stream HTML response in chunks', async () => {
      const context: SSRContext = {
        url: '/',
        headers: {},
        cookies: {}
      };

      const mockResponse = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      };

      await ssrRenderer.renderToStream('/', context, mockResponse);

      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600'
      });

      expect(mockResponse.write).toHaveBeenCalled();
      expect(mockResponse.end).toHaveBeenCalled();
    });

    it('should handle streaming errors', async () => {
      const context: SSRContext = {
        url: '/non-existent',
        headers: {},
        cookies: {}
      };

      const mockResponse = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      };

      await ssrRenderer.renderToStream('/non-existent', context, mockResponse);

      expect(mockResponse.writeHead).toHaveBeenCalledWith(500, {
        'Content-Type': 'text/html'
      });

      expect(mockResponse.end).toHaveBeenCalledWith(
        expect.stringContaining('Server Error')
      );
    });
  });

  describe('Progressive Hydration', () => {
    it('should hydrate components progressively', async () => {
      const homeComponent = createMockSSRComponent('Home');
      
      const result = await hydrationManager.hydrate('app', homeComponent, {
        title: 'Welcome Home'
      });

      expect(result.success).toBe(true);
      expect(result.component.isHydrated).toBe(true);
      expect(result.component.props.title).toBe('Welcome Home');
      expect(hydrationManager.isComponentHydrated('app')).toBe(true);
    });

    it('should handle hydration of multiple components', async () => {
      const components = [
        { containerId: 'header', component: createMockSSRComponent('Header'), props: {} },
        { containerId: 'main', component: createMockSSRComponent('Main'), props: { data: 'test' } },
        { containerId: 'footer', component: createMockSSRComponent('Footer'), props: {} }
      ];

      const results = await hydrationManager.hydrateProgressively(components);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(hydrationManager.getHydratedComponents()).toHaveLength(3);
    });

    it('should prevent duplicate hydration', async () => {
      const component = createMockSSRComponent('Home');
      
      const result1 = await hydrationManager.hydrate('app', component);
      const result2 = await hydrationManager.hydrate('app', component);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.reason).toBe('already_hydrated');
    });

    it('should handle hydration errors gracefully', async () => {
      const faultyComponent = {
        name: 'Faulty',
        hydrate: () => Promise.reject(new Error('Hydration failed'))
      };

      await expect(hydrationManager.hydrate('app', faultyComponent))
        .rejects.toThrow('Hydration failed');

      expect(hydrationManager.isComponentHydrated('app')).toBe(false);
    });

    it('should track hydration state correctly', async () => {
      const component = createMockSSRComponent('Home');
      
      expect(hydrationManager.isCurrentlyHydrating()).toBe(false);
      
      const hydrationPromise = hydrationManager.hydrate('app', component);
      expect(hydrationManager.isCurrentlyHydrating()).toBe(true);
      
      await hydrationPromise;
      expect(hydrationManager.isCurrentlyHydrating()).toBe(false);
    });
  });

  describe('SSR to Client Hydration Flow', () => {
    it('should complete full SSR to hydration flow', async () => {
      // Step 1: Server-side rendering
      const ssrContext: SSRContext = {
        url: '/',
        headers: { 'user-agent': 'Mozilla/5.0' },
        cookies: {},
        locale: 'en'
      };

      const ssrResult = await ssrRenderer.renderPage('/', ssrContext);
      
      expect(ssrResult.html).toContain('data-ssr="true"');
      expect(ssrResult.hydrationData).toBeDefined();

      // Step 2: Client-side hydration
      const component = createMockSSRComponent('Home', true);
      const hydrationResult = await hydrationManager.hydrate('app', component, ssrResult.preloadData);

      expect(hydrationResult.success).toBe(true);
      expect(hydrationResult.component.props).toEqual(ssrResult.preloadData);
    });

    it('should handle hydration mismatches gracefully', async () => {
      // SSR with one set of data
      const ssrResult = await ssrRenderer.renderPage('/', {
        url: '/',
        headers: {},
        cookies: {}
      });

      // Hydration with different data (simulating mismatch)
      const component = createMockSSRComponent('Home', true);
      const differentData = { title: 'Different Title', posts: [] };

      const hydrationResult = await hydrationManager.hydrate('app', component, differentData);

      // Should still succeed but with client data
      expect(hydrationResult.success).toBe(true);
      expect(hydrationResult.component.props).toEqual(differentData);
    });

    it('should preserve application state during hydration', async () => {
      const ssrResult = await ssrRenderer.renderPage('/', {
        url: '/',
        headers: {},
        cookies: {}
      });

      // Simulate user interaction before hydration
      const userState = { scrollPosition: 100, formData: { name: 'John' } };

      const component = createMockSSRComponent('Home', true);
      const hydrationResult = await hydrationManager.hydrate('app', component, {
        ...ssrResult.preloadData,
        userState
      });

      expect(hydrationResult.success).toBe(true);
      expect(hydrationResult.component.props.userState).toEqual(userState);
    });
  });

  describe('Performance Optimization', () => {
    it('should optimize critical CSS extraction', async () => {
      const context: SSRContext = {
        url: '/about',
        headers: {},
        cookies: {}
      };

      const startTime = performance.now();
      const result = await ssrRenderer.renderPage('/about', context);
      const endTime = performance.now();

      expect(result.css).toBeTruthy();
      expect(result.css.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(200); // Should be fast
    });

    it('should cache data fetching results', async () => {
      const context: SSRContext = {
        url: '/',
        headers: {},
        cookies: {},
        locale: 'en'
      };

      // First render
      const startTime1 = performance.now();
      await ssrRenderer.renderPage('/', context);
      const endTime1 = performance.now();

      // Second render (should use cache)
      const startTime2 = performance.now();
      await ssrRenderer.renderPage('/', context);
      const endTime2 = performance.now();

      // Second render should be faster due to caching
      expect(endTime2 - startTime2).toBeLessThan(endTime1 - startTime1);
    });

    it('should handle concurrent SSR requests efficiently', async () => {
      const contexts = Array.from({ length: 10 }, (_, i) => ({
        url: '/',
        headers: { 'request-id': i.toString() },
        cookies: {}
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        contexts.map(context => ssrRenderer.renderPage('/', context))
      );
      const endTime = performance.now();

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.html).toContain('Home Component');
      });

      expect(endTime - startTime).toBeLessThan(1000); // Should handle concurrency well
    });

    it('should optimize hydration for large component trees', async () => {
      const components = Array.from({ length: 50 }, (_, i) => ({
        containerId: `component-${i}`,
        component: createMockSSRComponent(`Component${i}`),
        props: { index: i }
      }));

      const startTime = performance.now();
      const results = await hydrationManager.hydrateProgressively(components);
      const endTime = performance.now();

      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(endTime - startTime).toBeLessThan(2000); // Should handle large trees efficiently
    });
  });

  describe('SEO and Accessibility', () => {
    it('should generate proper structured data', async () => {
      const context: SSRContext = {
        url: '/about',
        headers: {},
        cookies: {}
      };

      const result = await ssrRenderer.renderPage('/about', context);

      expect(result.html).toContain('<meta name="description"');
      expect(result.html).toContain('<meta name="keywords"');
      expect(result.html).toContain('lang="en"');
    });

    it('should handle bot detection and optimization', async () => {
      const botContext: SSRContext = {
        url: '/',
        headers: { 'user-agent': 'Googlebot/2.1' },
        cookies: {},
        isBot: true
      };

      const result = await ssrRenderer.renderPage('/', botContext);

      // Should render full content for bots
      expect(result.html).toContain('Home Component');
      expect(result.html).toContain('<script id="hydration-data"');
    });

    it('should ensure accessibility in SSR output', async () => {
      const context: SSRContext = {
        url: '/',
        headers: {},
        cookies: {}
      };

      const result = await ssrRenderer.renderPage('/', context);

      expect(result.html).toContain('lang="en"');
      expect(result.html).toContain('<meta name="viewport"');
      expect(result.html).toContain('<title>');
    });
  });
});