/**
 * Integration tests for the navigation system
 */

const { NavigationIntegration } = require('../navigation-integration.js');
const { RouteRegistry } = require('../route-registry.js');
const ClientRouter = require('../client-router.js');
const fs = require('fs');
const path = require('path');

describe('Navigation Integration', () => {
  let navigation;
  let tempDir;

  beforeEach(() => {
    navigation = new NavigationIntegration();

    // Create temporary test directory
    tempDir = path.join(__dirname, 'temp-navigation-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Page Discovery', () => {
    test('should discover MTM pages with frontmatter', async () => {
      // Create test MTM files
      const homeContent = `---
route: "/"
title: "Home Page"
description: "Welcome to the home page"
compileJsMode: "inline"
---

<template>
  <h1>Home</h1>
</template>`;

      const aboutContent = `---
route: "/about"
title: "About Page"
description: "Learn about us"
compileJsMode: "external.js"
framework: "mtm"
---

<template>
  <h1>About</h1>
</template>`;

      fs.writeFileSync(path.join(tempDir, 'home.mtm'), homeContent);
      fs.writeFileSync(path.join(tempDir, 'about.mtm'), aboutContent);

      await navigation.initialize(tempDir);

      expect(navigation.examplePages).toHaveLength(2);

      const homePage = navigation.examplePages.find(p => p.route === '/');
      expect(homePage).toBeDefined();
      expect(homePage.title).toBe('Home Page');
      expect(homePage.compileJsMode).toBe('inline');

      const aboutPage = navigation.examplePages.find(p => p.route === '/about');
      expect(aboutPage).toBeDefined();
      expect(aboutPage.title).toBe('About Page');
      expect(aboutPage.framework).toBe('mtm');
    });

    test('should handle files without frontmatter', async () => {
      const invalidContent = `<template>
  <h1>No frontmatter</h1>
</template>`;

      fs.writeFileSync(path.join(tempDir, 'invalid.mtm'), invalidContent);

      await navigation.initialize(tempDir);

      expect(navigation.examplePages).toHaveLength(0);
    });

    test('should handle files without route in frontmatter', async () => {
      const noRouteContent = `---
title: "No Route Page"
description: "This page has no route"
---

<template>
  <h1>No Route</h1>
</template>`;

      fs.writeFileSync(path.join(tempDir, 'no-route.mtm'), noRouteContent);

      await navigation.initialize(tempDir);

      expect(navigation.examplePages).toHaveLength(0);
    });
  });

  describe('Route Registration', () => {
    test('should register discovered routes with route registry', async () => {
      const testContent = `---
route: "/test"
title: "Test Page"
description: "A test page"
---

<template>
  <h1>Test</h1>
</template>`;

      fs.writeFileSync(path.join(tempDir, 'test.mtm'), testContent);

      await navigation.initialize(tempDir);

      const routes = navigation.routeRegistry.getAll();
      expect(routes.has('/test')).toBe(true);

      const route = routes.get('/test');
      expect(route.path).toBe('/test');
      expect(route.component).toBe('TestPage');
      expect(route.metadata.title).toBe('Test Page');
    });

    test('should handle route conflicts', async () => {
      const content1 = `---
route: "/duplicate"
title: "First Page"
---

<template><h1>First</h1></template>`;

      const content2 = `---
route: "/duplicate"
title: "Second Page"
---

<template><h1>Second</h1></template>`;

      fs.writeFileSync(path.join(tempDir, 'first.mtm'), content1);
      fs.writeFileSync(path.join(tempDir, 'second.mtm'), content2);

      // Should throw error due to route conflict
      await expect(navigation.initialize(tempDir)).rejects.toThrow();
    });
  });

  describe('Router Configuration Generation', () => {
    test('should generate valid router configuration', async () => {
      const testContent = `---
route: "/config-test"
title: "Config Test Page"
description: "Testing configuration generation"
framework: "react"
compileJsMode: "external.js"
---

<template>
  <h1>Config Test</h1>
</template>`;

      fs.writeFileSync(path.join(tempDir, 'config-test.mtm'), testContent);

      await navigation.initialize(tempDir);

      const config = navigation.generateRouterConfig();

      expect(config).toContain('window.MTM_ROUTES');
      expect(config).toContain('"/config-test"');
      expect(config).toContain('Config Test Page');
      expect(config).toContain('class MTMEnhancedRouter');
      expect(config).toContain('navigate(path, options = {})');
    });

    test('should include all discovered pages in configuration', async () => {
      const pages = [
        { route: '/', title: 'Home', framework: 'mtm' },
        { route: '/about', title: 'About', framework: 'mtm' },
        { route: '/react', title: 'React', framework: 'react' }
      ];

      for (const page of pages) {
        const content = `---
route: "${page.route}"
title: "${page.title}"
framework: "${page.framework}"
---

<template><h1>${page.title}</h1></template>`;

        fs.writeFileSync(path.join(tempDir, `${page.title.toLowerCase()}.mtm`), content);
      }

      await navigation.initialize(tempDir);

      const config = navigation.generateRouterConfig();

      for (const page of pages) {
        expect(config).toContain(`"${page.route}"`);
        expect(config).toContain(page.title);
      }
    });
  });

  describe('Navigation Tests Generation', () => {
    test('should generate comprehensive navigation tests', async () => {
      const testContent = `---
route: "/test-gen"
title: "Test Generation Page"
---

<template><h1>Test</h1></template>`;

      fs.writeFileSync(path.join(tempDir, 'test-gen.mtm'), testContent);

      await navigation.initialize(tempDir);

      const tests = navigation.generateNavigationTests();

      expect(tests).toContain('class MTMNavigationTests');
      expect(tests).toContain('testRouterInitialization');
      expect(tests).toContain('testClientSideNavigation');
      expect(tests).toContain('testBrowserHistoryIntegration');
      expect(tests).toContain('testURLUpdating');
      expect(tests).toContain('testBookmarking');
    });
  });

  describe('Frontmatter Extraction', () => {
    test('should extract simple frontmatter', () => {
      const content = `---
route: "/simple"
title: "Simple Page"
---

<template><h1>Simple</h1></template>`;

      const frontmatter = navigation.extractFrontmatter(content);

      expect(frontmatter).toEqual({
        route: '/simple',
        title: 'Simple Page'
      });
    });

    test('should handle quoted values', () => {
      const content = `---
route: "/quoted"
title: "Page with 'quotes'"
description: "A page with \"double quotes\""
---

<template><h1>Quoted</h1></template>`;

      const frontmatter = navigation.extractFrontmatter(content);

      expect(frontmatter.route).toBe('/quoted');
      expect(frontmatter.title).toBe("Page with 'quotes'");
      expect(frontmatter.description).toBe('A page with "double quotes"');
    });

    test('should handle complex values', () => {
      const content = `---
route: "/complex"
title: "Complex Page"
keywords: "keyword1, keyword2, keyword3"
compileJsMode: "external.js"
---

<template><h1>Complex</h1></template>`;

      const frontmatter = navigation.extractFrontmatter(content);

      expect(frontmatter.keywords).toBe('keyword1, keyword2, keyword3');
      expect(frontmatter.compileJsMode).toBe('external.js');
    });

    test('should return null for content without frontmatter', () => {
      const content = `<template><h1>No frontmatter</h1></template>`;

      const frontmatter = navigation.extractFrontmatter(content);

      expect(frontmatter).toBeNull();
    });

    test('should ignore comments in frontmatter', () => {
      const content = `---
# This is a comment
route: "/commented"
title: "Commented Page"
# Another comment
description: "Page with comments"
---

<template><h1>Commented</h1></template>`;

      const frontmatter = navigation.extractFrontmatter(content);

      expect(frontmatter).toEqual({
        route: '/commented',
        title: 'Commented Page',
        description: 'Page with comments'
      });
    });
  });

  describe('File Operations', () => {
    test('should write router configuration to file', async () => {
      const testContent = `---
route: "/file-test"
title: "File Test Page"
---

<template><h1>File Test</h1></template>`;

      fs.writeFileSync(path.join(tempDir, 'file-test.mtm'), testContent);

      await navigation.initialize(tempDir);

      const configPath = path.join(tempDir, 'router-config.js');
      navigation.writeRouterConfig(configPath);

      expect(fs.existsSync(configPath)).toBe(true);

      const configContent = fs.readFileSync(configPath, 'utf8');
      expect(configContent).toContain('window.MTM_ROUTES');
      expect(configContent).toContain('"/file-test"');
    });

    test('should write navigation tests to file', async () => {
      const testContent = `---
route: "/test-file"
title: "Test File Page"
---

<template><h1>Test File</h1></template>`;

      fs.writeFileSync(path.join(tempDir, 'test-file.mtm'), testContent);

      await navigation.initialize(tempDir);

      const testsPath = path.join(tempDir, 'navigation-tests.js');
      navigation.writeNavigationTests(testsPath);

      expect(fs.existsSync(testsPath)).toBe(true);

      const testsContent = fs.readFileSync(testsPath, 'utf8');
      expect(testsContent).toContain('class MTMNavigationTests');
      expect(testsContent).toContain('runAllTests');
    });
  });

  describe('Integration with Real Example Pages', () => {
    test('should work with actual example pages if they exist', async () => {
      const examplesPath = 'examples/enhanced-mtm/pages';

      // Only run this test if the examples directory exists
      if (fs.existsSync(examplesPath)) {
        await navigation.initialize(examplesPath);

        // Should find the standard example pages
        const expectedRoutes = ['/', '/about', '/react-example', '/vue-example', '/solid-example', '/svelte-example'];

        for (const expectedRoute of expectedRoutes) {
          const page = navigation.examplePages.find(p => p.route === expectedRoute);
          expect(page).toBeDefined();
          expect(page.title).toBeDefined();
          expect(page.description).toBeDefined();
        }

        // Should register all routes
        const routes = navigation.routeRegistry.getAll();
        for (const expectedRoute of expectedRoutes) {
          expect(routes.has(expectedRoute)).toBe(true);
        }
      } else {
        console.log('Skipping real examples test - examples directory not found');
      }
    });
  });
});

describe('Router Configuration Functionality', () => {
  // These tests would run in a browser environment
  // For now, we'll test the structure and basic functionality

  test('should generate router with required methods', () => {
    const navigation = new NavigationIntegration();
    const config = navigation.generateRouterConfig();

    // Check that all required methods are present
    expect(config).toContain('navigate(path, options = {})');
    expect(config).toContain('back()');
    expect(config).toContain('forward()');
    expect(config).toContain('replace(path, options = {})');
    expect(config).toContain('getCurrentRoute()');
    expect(config).toContain('onRouteChange(callback)');
    expect(config).toContain('handlePopState(event)');
    expect(config).toContain('handleLinkClick(event)');
  });

  test('should generate router with proper initialization', () => {
    const navigation = new NavigationIntegration();
    const config = navigation.generateRouterConfig();

    expect(config).toContain('initialize()');
    expect(config).toContain('addEventListener');
    expect(config).toContain('DOMContentLoaded');
    expect(config).toContain('window.mtmRouter = new MTMEnhancedRouter()');
  });
});

describe('Navigation Tests Generation', () => {
  test('should generate all required test methods', () => {
    const navigation = new NavigationIntegration();
    const tests = navigation.generateNavigationTests();

    const requiredTests = [
      'testRouterInitialization',
      'testRouteRegistration',
      'testClientSideNavigation',
      'testBrowserHistoryIntegration',
      'testURLUpdating',
      'testBookmarking',
      'testExternalLinkHandling'
    ];

    for (const testMethod of requiredTests) {
      expect(tests).toContain(testMethod);
    }
  });

  test('should generate test runner and reporting', () => {
    const navigation = new NavigationIntegration();
    const tests = navigation.generateNavigationTests();

    expect(tests).toContain('runAllTests()');
    expect(tests).toContain('reportResults()');
    expect(tests).toContain('PASS');
    expect(tests).toContain('FAIL');
  });
});