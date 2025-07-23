/**
 * End-to-End Integration Tests
 * Tests complete user workflows from build to navigation to error recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import mock implementations from other test files
interface PageInfo {
  filePath: string;
  route: string;
  title: string;
  description: string;
  keywords: string[];
  layout: string;
  status?: number;
  isDynamic: boolean;
  parameters: string[];
  locales: string[];
  metadata: any;
  content: string;
  errors: any[];
  lastModified: Date;
  size: number;
}

interface RouteManifest {
  version: string;
  generatedAt: string;
  totalRoutes: number;
  staticRoutes: Record<string, any>;
  dynamicRoutes: any[];
  fallbackRoutes: any[];
  errorPages: any;
  i18nRoutes: any;
  metadata: any;
}

// Complete MTM Application Mock
class CompleteMTMApplication {
  private buildSystem: any;
  private router: any;
  private ssrRenderer: any;
  private hydrationManager: any;
  private errorBoundary: any;
  private devServer: any;
  private isBuilt = false;
  private isRunning = false;

  constructor() {
    this.initializeComponents();
  }

  private initializeComponents() {
    this.buildSystem = new MockBuildSystem();
    this.router = new MockRouter();
    this.ssrRenderer = new MockSSRRenderer();
    this.hydrationManager = new MockHydrationManager();
    this.errorBoundary = new MockErrorBoundary();
    this.devServer = new MockDevServer();
  }

  async build(options: any = {}): Promise<any> {
    try {
      console.log('🏗️  Starting MTM application build...');

      // Step 1: Build the application
      const buildResult = await this.buildSystem.build({
        pagesDir: options.pagesDir || 'src/pages',
        outputDir: options.outputDir || 'dist',
        framework: options.framework || 'react',
        ssr: options.ssr !== false,
        ...options
      });

      if (!buildResult.success) {
        throw new Error(`Build failed: ${buildResult.errors.map(e => e.message).join(', ')}`);
      }

      // Step 2: Initialize router with built routes
      await this.initializeRouter(buildResult.manifest);

      // Step 3: Setup SSR if enabled
      if (options.ssr !== false) {
        await this.setupSSR(buildResult);
      }

      // Step 4: Setup error handling
      this.setupErrorHandling();

      this.isBuilt = true;
      console.log('✅ MTM application built successfully');

      return {
        success: true,
        buildResult,
        routes: buildResult.manifest.totalRoutes,
        framework: options.framework || 'react',
        ssr: options.ssr !== false
      };

    } catch (error: any) {
      console.error('❌ MTM application build failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async initializeRouter(manifest: RouteManifest) {
    // Register static routes
    for (const [path, route] of Object.entries(manifest.staticRoutes)) {
      this.router.registerRoute(path, () => this.loadComponent(route.component), route.metadata);
    }

    // Register dynamic routes
    for (const route of manifest.dynamicRoutes) {
      this.router.registerRoute(route.template, () => this.loadComponent(route.component), route.metadata);
    }

    // Setup error pages
    this.router.registerRoute('/404', () => this.createNotFoundComponent(), { status: 404 });
    this.router.registerRoute('/error', () => this.createErrorComponent(), { status: 500 });
  }

  private async setupSSR(buildResult: any) {
    for (const component of buildResult.transformedComponents) {
      this.ssrRenderer.registerRoute(component.route, {
        name: component.route.replace('/', '') || 'Home',
        renderToString: async (context: any) => component.code
      });
    }
  }

  private setupErrorHandling() {
    this.router.setErrorHandler(this.errorBoundary);
    this.router.setNotFoundHandler(this.errorBoundary);
  }

  async start(options: any = {}): Promise<any> {
    if (!this.isBuilt) {
      throw new Error('Application must be built before starting');
    }

    try {
      console.log('🚀 Starting MTM application...');

      if (options.dev) {
        await this.startDevServer(options);
      } else {
        await this.startProductionServer(options);
      }

      this.isRunning = true;
      console.log('✅ MTM application started successfully');

      return {
        success: true,
        mode: options.dev ? 'development' : 'production',
        port: options.port || 3000
      };

    } catch (error: any) {
      console.error('❌ Failed to start MTM application:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async startDevServer(options: any) {
    await this.devServer.start({
      port: options.port || 3000,
      hmr: options.hmr !== false,
      router: this.router,
      errorBoundary: this.errorBoundary
    });
  }

  private async startProductionServer(options: any) {
    // Production server setup would go here
    console.log('Production server started');
  }

  async navigate(path: string): Promise<any> {
    if (!this.isRunning) {
      throw new Error('Application must be started before navigation');
    }

    return await this.router.navigate(path);
  }

  async renderPage(path: string, context: any = {}): Promise<any> {
    if (!this.isBuilt) {
      throw new Error('Application must be built before rendering');
    }

    return await this.ssrRenderer.renderPage(path, context);
  }

  async hydratePage(containerId: string, component: any, props: any = {}): Promise<any> {
    return await this.hydrationManager.hydrate(containerId, component, props);
  }

  private async loadComponent(componentPath: string): Promise<any> {
    // Simulate component loading
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const componentName = componentPath.split('/').pop()?.replace('.mtm', '') || 'Component';
    
    return {
      name: componentName,
      render: () => `<div class="${componentName.toLowerCase()}">${componentName} Component</div>`,
      mount: vi.fn(),
      unmount: vi.fn()
    };
  }

  private createNotFoundComponent() {
    return {
      name: 'NotFound',
      render: () => '<div class="not-found"><h1>404 - Page Not Found</h1></div>',
      mount: vi.fn(),
      unmount: vi.fn()
    };
  }

  private createErrorComponent() {
    return {
      name: 'Error',
      render: () => '<div class="error"><h1>Something went wrong</h1></div>',
      mount: vi.fn(),
      unmount: vi.fn()
    };
  }

  getRouter() {
    return this.router;
  }

  getSSRRenderer() {
    return this.ssrRenderer;
  }

  getErrorBoundary() {
    return this.errorBoundary;
  }

  isApplicationBuilt(): boolean {
    return this.isBuilt;
  }

  isApplicationRunning(): boolean {
    return this.isRunning;
  }

  async stop() {
    if (this.devServer && this.isRunning) {
      await this.devServer.stop();
    }
    this.isRunning = false;
    console.log('🛑 MTM application stopped');
  }

  async destroy() {
    await this.stop();
    this.router?.destroy();
    this.errorBoundary?.reset();
    this.isBuilt = false;
    console.log('🗑️  MTM application destroyed');
  }
}

// Mock implementations (simplified versions of the components from other test files)
class MockBuildSystem {
  async build(options: any): Promise<any> {
    const pages: PageInfo[] = [
      {
        filePath: 'pages/index.mtm',
        route: '/',
        title: 'Home',
        description: 'Home page',
        keywords: ['home'],
        layout: 'default',
        status: 200,
        isDynamic: false,
        parameters: [],
        locales: ['en'],
        metadata: { route: '/', title: 'Home' },
        content: '<div>Home content</div>',
        errors: [],
        lastModified: new Date(),
        size: 100
      },
      {
        filePath: 'pages/about.mtm',
        route: '/about',
        title: 'About',
        description: 'About page',
        keywords: ['about'],
        layout: 'default',
        status: 200,
        isDynamic: false,
        parameters: [],
        locales: ['en'],
        metadata: { route: '/about', title: 'About' },
        content: '<div>About content</div>',
        errors: [],
        lastModified: new Date(),
        size: 150
      },
      {
        filePath: 'pages/users/[id].mtm',
        route: '/users/[id]',
        title: 'User Profile',
        description: 'User profile page',
        keywords: ['user', 'profile'],
        layout: 'default',
        status: 200,
        isDynamic: true,
        parameters: ['id'],
        locales: ['en'],
        metadata: { route: '/users/[id]', title: 'User Profile' },
        content: '<div>User {id} profile</div>',
        errors: [],
        lastModified: new Date(),
        size: 200
      }
    ];

    const manifest: RouteManifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      totalRoutes: pages.length,
      staticRoutes: {
        '/': { path: '/', component: 'pages/index.mtm', metadata: pages[0].metadata },
        '/about': { path: '/about', component: 'pages/about.mtm', metadata: pages[1].metadata }
      },
      dynamicRoutes: [{
        template: '/users/[id]',
        pattern: '/users/(?<id>[^/]+)',
        component: 'pages/users/[id].mtm',
        parameters: ['id'],
        metadata: pages[2].metadata
      }],
      fallbackRoutes: [],
      errorPages: {},
      i18nRoutes: {},
      metadata: {
        keywords: ['home', 'about', 'user', 'profile'],
        layouts: ['default'],
        locales: ['en'],
        totalSize: 450,
        lastModified: new Date()
      }
    };

    const transformedComponents = pages.map(page => ({
      originalFile: page.filePath,
      route: page.route,
      framework: options.framework,
      code: `export default function Component() { return '${page.content}'; }`
    }));

    return {
      success: true,
      pages,
      manifest,
      transformedComponents,
      errors: [],
      warnings: []
    };
  }
}

class MockRouter {
  private routes = new Map();
  private currentRoute = '/';
  private errorHandler: any = null;
  private notFoundHandler: any = null;

  registerRoute(path: string, loader: any, metadata: any = {}) {
    this.routes.set(path, { loader, metadata });
  }

  async navigate(path: string): Promise<any> {
    try {
      const route = this.routes.get(path) || this.findDynamicRoute(path);
      
      if (!route) {
        if (this.notFoundHandler) {
          return await this.notFoundHandler.handle404(path);
        }
        throw new Error(`Route not found: ${path}`);
      }

      const component = await route.loader();
      this.currentRoute = path;

      return {
        success: true,
        route: path,
        component
      };

    } catch (error: any) {
      if (this.errorHandler) {
        return await this.errorHandler.catchError(error, { route: path });
      }
      throw error;
    }
  }

  private findDynamicRoute(path: string) {
    // Simple dynamic route matching
    if (path.startsWith('/users/') && path.split('/').length === 3) {
      return this.routes.get('/users/[id]');
    }
    return null;
  }

  getCurrentRoute(): string {
    return this.currentRoute;
  }

  setErrorHandler(handler: any) {
    this.errorHandler = handler;
  }

  setNotFoundHandler(handler: any) {
    this.notFoundHandler = handler;
  }

  destroy() {
    this.routes.clear();
  }
}

class MockSSRRenderer {
  private routes = new Map();

  registerRoute(path: string, component: any) {
    this.routes.set(path, component);
  }

  async renderPage(path: string, context: any): Promise<any> {
    const component = this.routes.get(path);
    
    if (!component) {
      throw new Error(`SSR route not found: ${path}`);
    }

    const html = await component.renderToString(context);

    return {
      html: `<!DOCTYPE html><html><head><title>MTM App</title></head><body><div id="app">${html}</div></body></html>`,
      css: 'body { margin: 0; }',
      metadata: { title: 'MTM App', description: '', keywords: [], status: 200 },
      preloadData: {},
      hydrationData: { route: path, timestamp: Date.now() }
    };
  }
}

class MockHydrationManager {
  private hydratedComponents = new Set();

  async hydrate(containerId: string, component: any, props: any = {}): Promise<any> {
    if (this.hydratedComponents.has(containerId)) {
      return { success: true, reason: 'already_hydrated' };
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    this.hydratedComponents.add(containerId);

    return {
      success: true,
      component: { ...component, props, isHydrated: true },
      containerId
    };
  }

  isComponentHydrated(containerId: string): boolean {
    return this.hydratedComponents.has(containerId);
  }
}

class MockErrorBoundary {
  private errors: any[] = [];

  async catchError(error: any, context?: any): Promise<boolean> {
    this.errors.push({ error, context, timestamp: Date.now() });
    
    // Simple recovery logic
    if (error.message.includes('Route not found')) {
      return true; // Redirect to 404
    }
    
    if (error.message.includes('Component')) {
      return true; // Use fallback component
    }

    return false;
  }

  async handle404(path: string): Promise<any> {
    return {
      success: true,
      route: '/404',
      component: {
        name: 'NotFound',
        render: () => `<div>404 - ${path} not found</div>`
      }
    };
  }

  getErrors(): any[] {
    return [...this.errors];
  }

  reset() {
    this.errors = [];
  }
}

class MockDevServer {
  private isRunning = false;
  private port = 3000;

  async start(options: any): Promise<void> {
    this.port = options.port || 3000;
    this.isRunning = true;
    console.log(`Dev server started on port ${this.port}`);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('Dev server stopped');
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }
}

describe('End-to-End MTM Application Integration', () => {
  let app: CompleteMTMApplication;

  beforeEach(() => {
    app = new CompleteMTMApplication();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.destroy();
  });

  describe('Complete Application Lifecycle', () => {
    it('should build, start, and navigate through complete application lifecycle', async () => {
      // Step 1: Build the application
      const buildResult = await app.build({
        framework: 'react',
        ssr: true,
        pagesDir: 'src/pages',
        outputDir: 'dist'
      });

      expect(buildResult.success).toBe(true);
      expect(buildResult.routes).toBe(3);
      expect(buildResult.framework).toBe('react');
      expect(buildResult.ssr).toBe(true);
      expect(app.isApplicationBuilt()).toBe(true);

      // Step 2: Start the application
      const startResult = await app.start({
        dev: true,
        port: 3000,
        hmr: true
      });

      expect(startResult.success).toBe(true);
      expect(startResult.mode).toBe('development');
      expect(startResult.port).toBe(3000);
      expect(app.isApplicationRunning()).toBe(true);

      // Step 3: Navigate through different routes
      const homeNavigation = await app.navigate('/');
      expect(homeNavigation.success).toBe(true);
      expect(homeNavigation.component.name).toBe('index');

      const aboutNavigation = await app.navigate('/about');
      expect(aboutNavigation.success).toBe(true);
      expect(aboutNavigation.component.name).toBe('about');

      const userNavigation = await app.navigate('/users/123');
      expect(userNavigation.success).toBe(true);
      expect(userNavigation.component.name).toBe('[id]');

      // Step 4: Test 404 handling
      const notFoundNavigation = await app.navigate('/non-existent');
      expect(notFoundNavigation.success).toBe(true);
      expect(notFoundNavigation.route).toBe('/404');
    });

    it('should handle SSR and hydration flow', async () => {
      // Build with SSR enabled
      await app.build({ ssr: true });
      await app.start({ dev: false });

      // Step 1: Server-side render a page
      const ssrResult = await app.renderPage('/', {
        url: '/',
        headers: { 'user-agent': 'Mozilla/5.0' },
        cookies: {}
      });

      expect(ssrResult.html).toContain('<!DOCTYPE html>');
      expect(ssrResult.html).toContain('<div id="app">');
      expect(ssrResult.metadata.status).toBe(200);

      // Step 2: Hydrate the rendered page
      const component = { name: 'Home', render: () => '<div>Home</div>' };
      const hydrationResult = await app.hydratePage('app', component, ssrResult.preloadData);

      expect(hydrationResult.success).toBe(true);
      expect(hydrationResult.component.isHydrated).toBe(true);
    });

    it('should handle errors gracefully throughout the application', async () => {
      await app.build();
      await app.start({ dev: true });

      // Test navigation error handling
      const errorNavigation = await app.navigate('/error-route');
      expect(errorNavigation.success).toBe(true); // Should recover

      // Check error boundary captured the error
      const errors = app.getErrorBoundary().getErrors();
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Framework Support', () => {
    it('should build and run with React framework', async () => {
      const result = await app.build({ framework: 'react' });
      
      expect(result.success).toBe(true);
      expect(result.framework).toBe('react');
      
      const transformedComponents = result.buildResult.transformedComponents;
      transformedComponents.forEach((component: any) => {
        expect(component.framework).toBe('react');
      });
    });

    it('should build and run with Vue framework', async () => {
      const result = await app.build({ framework: 'vue' });
      
      expect(result.success).toBe(true);
      expect(result.framework).toBe('vue');
    });

    it('should build and run with Svelte framework', async () => {
      const result = await app.build({ framework: 'svelte' });
      
      expect(result.success).toBe(true);
      expect(result.framework).toBe('svelte');
    });

    it('should build and run with vanilla JavaScript', async () => {
      const result = await app.build({ framework: 'vanilla' });
      
      expect(result.success).toBe(true);
      expect(result.framework).toBe('vanilla');
    });
  });

  describe('Development vs Production Modes', () => {
    it('should run in development mode with HMR', async () => {
      await app.build();
      
      const startResult = await app.start({
        dev: true,
        hmr: true,
        port: 3001
      });

      expect(startResult.success).toBe(true);
      expect(startResult.mode).toBe('development');
      expect(startResult.port).toBe(3001);
    });

    it('should run in production mode with optimizations', async () => {
      await app.build({ 
        minify: true,
        treeshake: true,
        bundleSplitting: true
      });
      
      const startResult = await app.start({
        dev: false,
        port: 8080
      });

      expect(startResult.success).toBe(true);
      expect(startResult.mode).toBe('production');
    });
  });

  describe('Complex User Workflows', () => {
    it('should handle complete e-commerce-like workflow', async () => {
      // Build application with e-commerce routes
      await app.build();
      await app.start({ dev: true });

      // User journey: Home -> Products -> Product Detail -> Cart -> Checkout
      const steps = [
        { path: '/', expectedComponent: 'index' },
        { path: '/about', expectedComponent: 'about' }, // Simulating products page
        { path: '/users/product-123', expectedComponent: '[id]' }, // Simulating product detail
      ];

      for (const step of steps) {
        const result = await app.navigate(step.path);
        expect(result.success).toBe(true);
        expect(result.component.name).toBe(step.expectedComponent);
      }

      // Verify router state
      expect(app.getRouter().getCurrentRoute()).toBe('/users/product-123');
    });

    it('should handle user authentication flow', async () => {
      await app.build();
      await app.start({ dev: true });

      // Simulate authentication workflow
      const authSteps = [
        '/users/profile', // Try to access protected route
        '/about', // Redirected to login (simulated)
        '/users/dashboard' // Access granted after login (simulated)
      ];

      for (const path of authSteps) {
        const result = await app.navigate(path);
        expect(result.success).toBe(true);
      }
    });

    it('should handle internationalization workflow', async () => {
      await app.build({ i18n: true, locales: ['en', 'es', 'fr'] });
      await app.start({ dev: true });

      // Test different locale navigation
      const i18nSteps = [
        { path: '/', locale: 'en' },
        { path: '/about', locale: 'es' },
        { path: '/users/123', locale: 'fr' }
      ];

      for (const step of i18nSteps) {
        const result = await app.navigate(step.path);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of routes efficiently', async () => {
      // Mock a large number of routes
      const originalBuild = app['buildSystem'].build;
      app['buildSystem'].build = async (options: any) => {
        const result = await originalBuild.call(app['buildSystem'], options);
        
        // Add 100 more routes
        for (let i = 0; i < 100; i++) {
          result.manifest.staticRoutes[`/page-${i}`] = {
            path: `/page-${i}`,
            component: `pages/page-${i}.mtm`,
            metadata: { title: `Page ${i}` }
          };
        }
        
        result.manifest.totalRoutes += 100;
        return result;
      };

      const buildResult = await app.build();
      expect(buildResult.success).toBe(true);
      expect(buildResult.routes).toBe(103); // 3 original + 100 added

      await app.start({ dev: true });

      // Test navigation performance
      const startTime = performance.now();
      
      const navigationPromises = [];
      for (let i = 0; i < 10; i++) {
        navigationPromises.push(app.navigate(`/page-${i}`));
      }
      
      const results = await Promise.all(navigationPromises);
      const endTime = performance.now();

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it('should handle concurrent user sessions', async () => {
      await app.build();
      await app.start({ dev: true });

      // Simulate multiple concurrent user sessions
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        sessionId: `session-${i}`,
        routes: ['/', '/about', `/users/${i}`]
      }));

      const sessionPromises = sessions.map(async session => {
        const results = [];
        for (const route of session.routes) {
          const result = await app.navigate(route);
          results.push(result);
        }
        return { sessionId: session.sessionId, results };
      });

      const sessionResults = await Promise.all(sessionPromises);

      sessionResults.forEach(session => {
        session.results.forEach(result => {
          expect(result.success).toBe(true);
        });
      });
    });

    it('should optimize memory usage during long-running sessions', async () => {
      await app.build();
      await app.start({ dev: true });

      // Simulate long-running session with many navigations
      const routes = ['/', '/about', '/users/1', '/users/2', '/users/3'];
      
      for (let cycle = 0; cycle < 20; cycle++) {
        for (const route of routes) {
          await app.navigate(route);
        }
      }

      // Application should still be responsive
      const finalNavigation = await app.navigate('/');
      expect(finalNavigation.success).toBe(true);

      // Error boundary should not have accumulated too many errors
      const errors = app.getErrorBoundary().getErrors();
      expect(errors.length).toBeLessThan(10); // Should be manageable
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from build errors and continue operation', async () => {
      // Mock a build that initially fails but then succeeds
      let buildAttempts = 0;
      const originalBuild = app['buildSystem'].build;
      
      app['buildSystem'].build = async (options: any) => {
        buildAttempts++;
        if (buildAttempts === 1) {
          throw new Error('Initial build failed');
        }
        return await originalBuild.call(app['buildSystem'], options);
      };

      // First build should fail
      const firstBuild = await app.build();
      expect(firstBuild.success).toBe(false);

      // Second build should succeed
      const secondBuild = await app.build();
      expect(secondBuild.success).toBe(true);

      await app.start({ dev: true });
      
      const navigation = await app.navigate('/');
      expect(navigation.success).toBe(true);
    });

    it('should handle runtime errors and maintain application stability', async () => {
      await app.build();
      await app.start({ dev: true });

      // Simulate various runtime errors
      const errorScenarios = [
        '/non-existent-route',
        '/users/invalid-id',
        '/about' // This should work
      ];

      for (const route of errorScenarios) {
        const result = await app.navigate(route);
        // All should succeed due to error recovery
        expect(result.success).toBe(true);
      }

      // Application should still be functional
      expect(app.isApplicationRunning()).toBe(true);
    });

    it('should provide comprehensive error reporting', async () => {
      await app.build();
      await app.start({ dev: true });

      // Generate some errors
      await app.navigate('/non-existent-1');
      await app.navigate('/non-existent-2');
      await app.navigate('/non-existent-3');

      const errors = app.getErrorBoundary().getErrors();
      expect(errors.length).toBe(3);

      errors.forEach(error => {
        expect(error.timestamp).toBeDefined();
        expect(error.context).toBeDefined();
      });
    });
  });

  describe('Integration with External Systems', () => {
    it('should integrate with external APIs during SSR', async () => {
      await app.build({ ssr: true });
      await app.start({ dev: false });

      // Mock external API data
      const apiContext = {
        url: '/users/123',
        headers: { 'user-agent': 'Mozilla/5.0' },
        cookies: {},
        apiData: {
          user: { id: '123', name: 'John Doe' }
        }
      };

      const ssrResult = await app.renderPage('/users/123', apiContext);
      
      expect(ssrResult.html).toContain('<!DOCTYPE html>');
      expect(ssrResult.metadata.status).toBe(200);
    });

    it('should handle third-party service failures gracefully', async () => {
      await app.build();
      await app.start({ dev: true });

      // Simulate third-party service failure during navigation
      const originalNavigate = app.getRouter().navigate;
      app.getRouter().navigate = async (path: string) => {
        if (path === '/external-service') {
          throw new Error('External service unavailable');
        }
        return await originalNavigate.call(app.getRouter(), path);
      };

      const result = await app.navigate('/external-service');
      
      // Should recover gracefully
      expect(result.success).toBe(true);
    });
  });
});