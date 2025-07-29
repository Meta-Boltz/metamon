/**
 * Navigation Integration - Connects client-side router to example pages
 * Provides complete navigation system with history management and URL updating
 */

const { RouteRegistry } = require('./route-registry.js');
const ClientRouter = require('./client-router.js');
const fs = require('fs');
const path = require('path');

class NavigationIntegration {
  constructor() {
    this.routeRegistry = new RouteRegistry();
    this.router = null;
    this.examplePages = [];
  }

  /**
   * Initialize the navigation system with example pages
   * @param {string} examplesDir - Directory containing example pages
   */
  async initialize(examplesDir = 'examples/enhanced-mtm/pages') {
    console.log('🔗 Initializing navigation integration...');

    // Discover and register all example pages
    await this.discoverExamplePages(examplesDir);

    // Register routes with the registry
    this.registerRoutes();

    // Validate routes
    this.validateRoutes();

    console.log(`✅ Navigation integration initialized with ${this.examplePages.length} pages`);
  }

  /**
   * Discover all MTM example pages and extract their route configuration
   * @param {string} examplesDir - Directory to scan
   */
  async discoverExamplePages(examplesDir) {
    const absolutePath = path.resolve(examplesDir);
    console.log(`📁 Scanning directory: ${absolutePath}`);

    if (!fs.existsSync(examplesDir)) {
      console.warn(`⚠️  Examples directory not found: ${examplesDir}`);
      return;
    }

    const files = fs.readdirSync(examplesDir);
    console.log(`📂 Found ${files.length} files: ${files.join(', ')}`);

    const mtmFiles = files.filter(file => file.endsWith('.mtm'));
    console.log(`📝 Found ${mtmFiles.length} MTM files: ${mtmFiles.join(', ')}`);

    for (const file of mtmFiles) {
      const filePath = path.join(examplesDir, file);
      console.log(`🔍 Processing file: ${filePath}`);

      const content = fs.readFileSync(filePath, 'utf8');

      // Extract frontmatter
      const frontmatter = this.extractFrontmatter(content);
      console.log(`📋 Extracted frontmatter for ${file}:`, frontmatter);

      if (frontmatter && frontmatter.route) {
        this.examplePages.push({
          file: filePath,
          route: frontmatter.route,
          title: frontmatter.title || 'Untitled',
          description: frontmatter.description || '',
          framework: frontmatter.framework || 'mtm',
          compileJsMode: frontmatter.compileJsMode || 'inline',
          metadata: frontmatter
        });

        console.log(`📄 Discovered page: ${frontmatter.route} (${file})`);
      } else {
        console.log(`⚠️  No route found in ${file}`);
      }
    }
  }

  /**
   * Extract frontmatter from MTM file content
   * @param {string} content - File content
   * @returns {Object|null} Parsed frontmatter or null
   */
  extractFrontmatter(content) {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      console.log('❌ No frontmatter found');
      return null;
    }

    const frontmatterText = frontmatterMatch[1];
    const frontmatter = {};

    // Improved YAML-like parsing
    const lines = frontmatterText.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      // Match key: value patterns with optional quotes
      const match = trimmedLine.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        // Remove quotes if present
        let cleanValue = value.trim();
        if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
          (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
          cleanValue = cleanValue.slice(1, -1);
        }
        frontmatter[key] = cleanValue;
        console.log(`  ${key}: ${cleanValue}`);
      }
    }

    return frontmatter;
  }

  /**
   * Register all discovered routes with the route registry
   */
  registerRoutes() {
    console.log('📝 Registering routes...');

    for (const page of this.examplePages) {
      try {
        this.routeRegistry.register(page.route, {
          file: page.file,
          component: this.generateComponentName(page.file),
          metadata: page.metadata
        });

        console.log(`✅ Registered route: ${page.route}`);
      } catch (error) {
        console.error(`❌ Failed to register route ${page.route}:`, error.message);
        // Re-throw the error to fail the initialization
        throw error;
      }
    }
  }

  /**
   * Validate all registered routes
   */
  validateRoutes() {
    const validationResults = this.routeRegistry.validateRoutes();

    if (validationResults.length === 0) {
      console.log('✅ All routes validated successfully');
      return;
    }

    console.log('⚠️  Route validation issues found:');
    for (const result of validationResults) {
      console.log(`  ${result.severity.toUpperCase()}: ${result.message}`);
    }
  }

  /**
   * Generate a component name from file path
   * @param {string} filePath - File path
   * @returns {string} Component name
   */
  generateComponentName(filePath) {
    const fileName = path.basename(filePath, '.mtm');
    return fileName.charAt(0).toUpperCase() + fileName.slice(1) + 'Page';
  }

  /**
   * Generate client-side router configuration
   * @returns {string} Router configuration JavaScript
   */
  generateRouterConfig() {
    const routes = {};

    for (const page of this.examplePages) {
      routes[page.route] = {
        title: page.title,
        description: page.description,
        framework: page.framework,
        compileJsMode: page.compileJsMode,
        file: page.file
      };
    }

    return `
// MTM Navigation Configuration - Auto-generated
window.MTM_ROUTES = ${JSON.stringify(routes, null, 2)};

// Enhanced client-side router with full navigation support
class MTMEnhancedRouter {
  constructor() {
    this.routes = new Map(Object.entries(window.MTM_ROUTES));
    this.currentRoute = null;
    this.routeChangeCallbacks = [];
    this.isInitialized = false;
    
    // Bind methods
    this.handlePopState = this.handlePopState.bind(this);
    this.handleLinkClick = this.handleLinkClick.bind(this);
  }

  /**
   * Initialize the router
   */
  initialize() {
    if (this.isInitialized) return;

    console.log('🔗 Initializing MTM Enhanced Router with', this.routes.size, 'routes');

    // Set up event listeners
    window.addEventListener('popstate', this.handlePopState);
    document.addEventListener('click', this.handleLinkClick);

    // Handle initial route
    this.handleInitialRoute();

    this.isInitialized = true;
    console.log('✅ MTM Enhanced Router initialized');
  }

  /**
   * Navigate to a route
   * @param {string} path - Path to navigate to
   * @param {Object} options - Navigation options
   */
  navigate(path, options = {}) {
    const { replace = false, state = null } = options;

    if (!this.routes.has(path)) {
      console.warn('Route not found:', path);
      return;
    }

    const routeInfo = this.routes.get(path);

    // Update browser history
    if (replace) {
      window.history.replaceState(state, routeInfo.title, path);
    } else {
      window.history.pushState(state, routeInfo.title, path);
    }

    // Update document title
    document.title = routeInfo.title;

    // Update current route
    const previousRoute = this.currentRoute;
    this.currentRoute = path;

    // Trigger route change callbacks
    this.triggerRouteChange(path, previousRoute, routeInfo);

    console.log('🔗 Navigated to:', path);
  }

  /**
   * Navigate back in history
   */
  back() {
    window.history.back();
  }

  /**
   * Navigate forward in history
   */
  forward() {
    window.history.forward();
  }

  /**
   * Replace current route
   * @param {string} path - Path to replace with
   * @param {Object} options - Navigation options
   */
  replace(path, options = {}) {
    this.navigate(path, { ...options, replace: true });
  }

  /**
   * Get current route
   * @returns {string|null} Current route path
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Register route change callback
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onRouteChange(callback) {
    this.routeChangeCallbacks.push(callback);
    
    return () => {
      const index = this.routeChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.routeChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Handle browser popstate events
   * @param {PopStateEvent} event - Popstate event
   */
  handlePopState(event) {
    const path = window.location.pathname;
    
    if (this.routes.has(path)) {
      const routeInfo = this.routes.get(path);
      document.title = routeInfo.title;
      
      const previousRoute = this.currentRoute;
      this.currentRoute = path;
      
      this.triggerRouteChange(path, previousRoute, routeInfo, { fromPopState: true });
      console.log('🔙 Browser navigation to:', path);
    } else {
      console.warn('Route not found during popstate:', path);
    }
  }

  /**
   * Handle link clicks for client-side navigation
   * @param {MouseEvent} event - Click event
   */
  handleLinkClick(event) {
    // Only handle left clicks
    if (event.button !== 0) return;

    // Don't handle if modifier keys are pressed
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    // Find the anchor tag
    const anchor = event.target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Skip external links
    if (this.isExternalLink(href)) return;

    // Skip links with data-external attribute
    if (anchor.hasAttribute('data-external')) return;

    // Skip links with target="_blank"
    if (anchor.getAttribute('target') === '_blank') return;

    // Skip links with download attribute
    if (anchor.hasAttribute('download')) return;

    // Check if this is a registered route
    if (!this.routes.has(href)) return;

    // Prevent default navigation and handle with router
    event.preventDefault();
    this.navigate(href);
  }

  /**
   * Check if a link is external
   * @param {string} href - Link href
   * @returns {boolean} True if external
   */
  isExternalLink(href) {
    return /^https?:\\/\\//.test(href) || /^\\/\\//.test(href) || /^[a-z]+:/.test(href);
  }

  /**
   * Handle initial route on page load
   */
  handleInitialRoute() {
    const path = window.location.pathname;
    
    if (this.routes.has(path)) {
      const routeInfo = this.routes.get(path);
      document.title = routeInfo.title;
      this.currentRoute = path;
      
      this.triggerRouteChange(path, null, routeInfo, { initial: true });
      console.log('🏠 Initial route:', path);
    } else {
      console.warn('Initial route not found:', path);
    }
  }

  /**
   * Trigger route change callbacks
   * @param {string} path - New path
   * @param {string|null} previousPath - Previous path
   * @param {Object} routeInfo - Route information
   * @param {Object} options - Additional options
   */
  triggerRouteChange(path, previousPath, routeInfo, options = {}) {
    const routeChangeEvent = {
      path,
      previousPath,
      routeInfo,
      options
    };

    // Call registered callbacks
    this.routeChangeCallbacks.forEach(callback => {
      try {
        callback(routeChangeEvent);
      } catch (error) {
        console.error('Route change callback error:', error);
      }
    });

    // Dispatch custom event
    const event = new CustomEvent('mtm:route-change', {
      detail: routeChangeEvent
    });
    document.dispatchEvent(event);
  }

  /**
   * Get all available routes
   * @returns {Map} All routes
   */
  getAllRoutes() {
    return new Map(this.routes);
  }

  /**
   * Check if a route exists
   * @param {string} path - Path to check
   * @returns {boolean} True if route exists
   */
  hasRoute(path) {
    return this.routes.has(path);
  }
}

// Initialize router when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.mtmRouter = new MTMEnhancedRouter();
  window.mtmRouter.initialize();
});

console.log('🔮 MTM Enhanced Router configuration loaded');
`;
  }

  /**
   * Generate navigation integration tests
   * @returns {string} Test JavaScript code
   */
  generateNavigationTests() {
    return `
// MTM Navigation Integration Tests
class MTMNavigationTests {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  /**
   * Run all navigation tests
   */
  async runAllTests() {
    console.log('🧪 Running MTM Navigation Integration Tests...');
    
    this.tests = [
      this.testRouterInitialization,
      this.testRouteRegistration,
      this.testClientSideNavigation,
      this.testBrowserHistoryIntegration,
      this.testURLUpdating,
      this.testBookmarking,
      this.testExternalLinkHandling
    ];

    for (const test of this.tests) {
      try {
        await test.call(this);
      } catch (error) {
        console.error('Test failed:', error);
      }
    }

    this.reportResults();
  }

  /**
   * Test router initialization
   */
  async testRouterInitialization() {
    const testName = 'Router Initialization';
    console.log('🔍 Testing:', testName);

    try {
      // Check if router exists
      if (!window.mtmRouter) {
        throw new Error('MTM Router not found');
      }

      // Check if routes are loaded
      const routes = window.mtmRouter.getAllRoutes();
      if (routes.size === 0) {
        throw new Error('No routes registered');
      }

      this.results.push({ test: testName, status: 'PASS', message: \`Router initialized with \${routes.size} routes\` });
    } catch (error) {
      this.results.push({ test: testName, status: 'FAIL', message: error.message });
    }
  }

  /**
   * Test route registration
   */
  async testRouteRegistration() {
    const testName = 'Route Registration';
    console.log('🔍 Testing:', testName);

    try {
      const expectedRoutes = ['/', '/about', '/react-example', '/vue-example', '/solid-example', '/svelte-example'];
      const routes = window.mtmRouter.getAllRoutes();

      for (const expectedRoute of expectedRoutes) {
        if (!routes.has(expectedRoute)) {
          throw new Error(\`Route not registered: \${expectedRoute}\`);
        }
      }

      this.results.push({ test: testName, status: 'PASS', message: 'All expected routes registered' });
    } catch (error) {
      this.results.push({ test: testName, status: 'FAIL', message: error.message });
    }
  }

  /**
   * Test client-side navigation
   */
  async testClientSideNavigation() {
    const testName = 'Client-Side Navigation';
    console.log('🔍 Testing:', testName);

    try {
      const initialPath = window.location.pathname;
      
      // Test navigation
      window.mtmRouter.navigate('/about');
      
      if (window.location.pathname !== '/about') {
        throw new Error('Navigation did not update URL');
      }

      // Navigate back
      window.mtmRouter.navigate(initialPath);

      this.results.push({ test: testName, status: 'PASS', message: 'Client-side navigation working' });
    } catch (error) {
      this.results.push({ test: testName, status: 'FAIL', message: error.message });
    }
  }

  /**
   * Test browser history integration
   */
  async testBrowserHistoryIntegration() {
    const testName = 'Browser History Integration';
    console.log('🔍 Testing:', testName);

    try {
      const initialLength = window.history.length;
      
      // Navigate to create history entry
      window.mtmRouter.navigate('/about');
      
      // Check if history was updated (this is approximate)
      if (window.location.pathname !== '/about') {
        throw new Error('History not updated properly');
      }

      this.results.push({ test: testName, status: 'PASS', message: 'Browser history integration working' });
    } catch (error) {
      this.results.push({ test: testName, status: 'FAIL', message: error.message });
    }
  }

  /**
   * Test URL updating
   */
  async testURLUpdating() {
    const testName = 'URL Updating';
    console.log('🔍 Testing:', testName);

    try {
      const testPath = '/react-example';
      window.mtmRouter.navigate(testPath);
      
      if (window.location.pathname !== testPath) {
        throw new Error('URL not updated correctly');
      }

      this.results.push({ test: testName, status: 'PASS', message: 'URL updating working correctly' });
    } catch (error) {
      this.results.push({ test: testName, status: 'FAIL', message: error.message });
    }
  }

  /**
   * Test bookmarking functionality
   */
  async testBookmarking() {
    const testName = 'Bookmarking Functionality';
    console.log('🔍 Testing:', testName);

    try {
      // Navigate to a route
      window.mtmRouter.navigate('/vue-example');
      
      // Check if URL is bookmarkable (has correct path)
      const currentURL = window.location.href;
      if (!currentURL.includes('/vue-example')) {
        throw new Error('URL not bookmarkable');
      }

      this.results.push({ test: testName, status: 'PASS', message: 'Bookmarking functionality working' });
    } catch (error) {
      this.results.push({ test: testName, status: 'FAIL', message: error.message });
    }
  }

  /**
   * Test external link handling
   */
  async testExternalLinkHandling() {
    const testName = 'External Link Handling';
    console.log('🔍 Testing:', testName);

    try {
      // Create a test external link
      const externalLink = document.createElement('a');
      externalLink.href = 'https://example.com';
      externalLink.textContent = 'External Link';
      document.body.appendChild(externalLink);

      // Simulate click (should not be intercepted)
      const clickEvent = new MouseEvent('click', { bubbles: true });
      externalLink.dispatchEvent(clickEvent);

      // Clean up
      document.body.removeChild(externalLink);

      this.results.push({ test: testName, status: 'PASS', message: 'External links handled correctly' });
    } catch (error) {
      this.results.push({ test: testName, status: 'FAIL', message: error.message });
    }
  }

  /**
   * Report test results
   */
  reportResults() {
    console.log('\\n📊 MTM Navigation Integration Test Results:');
    console.log('=' .repeat(50));

    let passed = 0;
    let failed = 0;

    for (const result of this.results) {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(\`\${status} \${result.test}: \${result.message}\`);
      
      if (result.status === 'PASS') {
        passed++;
      } else {
        failed++;
      }
    }

    console.log('=' .repeat(50));
    console.log(\`Total: \${this.results.length} | Passed: \${passed} | Failed: \${failed}\`);
    
    if (failed === 0) {
      console.log('🎉 All navigation integration tests passed!');
    } else {
      console.log(\`⚠️  \${failed} test(s) failed. Please check the implementation.\`);
    }
  }
}

// Auto-run tests when router is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const tests = new MTMNavigationTests();
    tests.runAllTests();
  }, 1000); // Wait for router to initialize
});
`;
  }

  /**
   * Write router configuration to file
   * @param {string} outputPath - Output file path
   */
  writeRouterConfig(outputPath) {
    const config = this.generateRouterConfig();
    fs.writeFileSync(outputPath, config, 'utf8');
    console.log(`📝 Router configuration written to: ${outputPath}`);
  }

  /**
   * Write navigation tests to file
   * @param {string} outputPath - Output file path
   */
  writeNavigationTests(outputPath) {
    const tests = this.generateNavigationTests();
    fs.writeFileSync(outputPath, tests, 'utf8');
    console.log(`🧪 Navigation tests written to: ${outputPath}`);
  }
}

module.exports = { NavigationIntegration };