/**
 * Integration test for Progressive Hydration System
 * Tests the complete hydration pipeline with SSR-rendered components
 */

import { createHydrationSystem } from './src/shared/hydration-system.js';
import { JSDOM } from 'jsdom';

async function testHydrationIntegration() {
  console.log('🧪 Testing Progressive Hydration Integration...\n');

  try {
    // Create a mock DOM environment with SSR-rendered content
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hydration Test</title>
          <script id="ssr-data" type="application/json">
            {"posts": [{"id": 1, "title": "Test Post"}], "user": {"name": "Test User"}}
          </script>
        </head>
        <body>
          <div id="app">
            <!-- SSR-rendered header component -->
            <header 
              data-ssr-component="header-component" 
              data-component-type="header"
              data-hydration-strategy="immediate"
              data-component-title="Test Site"
            >
              <h1>Test Site</h1>
              <nav>
                <a href="/">Home</a>
                <a href="/about">About</a>
              </nav>
              <button data-event="click" data-handler="toggleMenu">Menu</button>
            </header>

            <!-- SSR-rendered main content -->
            <main 
              data-ssr-component="main-content" 
              data-component-type="content"
              data-hydration-strategy="visible"
            >
              <h2>Welcome to Test Site</h2>
              <p>This content was server-side rendered.</p>
              <div class="posts">
                <article data-post-id="1">
                  <h3>Test Post</h3>
                  <p>Post content here...</p>
                  <button data-event="click" data-handler="likePost">Like</button>
                </article>
              </div>
            </main>

            <!-- SSR-rendered sidebar -->
            <aside 
              data-ssr-component="sidebar-component" 
              data-component-type="sidebar"
              data-hydration-strategy="interaction"
            >
              <h3>Sidebar</h3>
              <div class="user-info">
                <p>Welcome, Test User!</p>
                <button data-event="click" data-handler="showProfile">Profile</button>
              </div>
            </aside>

            <!-- SSR-rendered footer -->
            <footer 
              data-ssr-component="footer-component" 
              data-component-type="footer"
              data-hydration-strategy="idle"
            >
              <p>&copy; 2024 Test Site</p>
              <div class="social-links">
                <a href="#" data-event="click" data-handler="trackClick">Twitter</a>
                <a href="#" data-event="click" data-handler="trackClick">GitHub</a>
              </div>
            </footer>
          </div>

          <!-- SSR hydration data -->
          <script>
            window.__SSR_RENDERED__ = true;
            window.__SSR_DATA__ = {"posts": [{"id": 1, "title": "Test Post"}], "user": {"name": "Test User"}};
            window.__SSR_ROUTE__ = "/";
          </script>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    // Set up global environment
    global.window = dom.window;
    global.document = dom.window.document;
    global.IntersectionObserver = createMockIntersectionObserver();
    global.requestIdleCallback = createMockRequestIdleCallback();

    console.log('🌐 Created mock DOM environment with SSR content');

    // Create mock components for hydration
    const mockComponents = {
      'header-component': createMockHeaderComponent(),
      'main-content': createMockMainComponent(),
      'sidebar-component': createMockSidebarComponent(),
      'footer-component': createMockFooterComponent()
    };

    console.log('🧩 Created mock components for hydration');

    // Create hydration system
    const hydrationSystem = createHydrationSystem({
      enableProgressiveHydration: true,
      hydrateOnVisible: true,
      hydrateOnInteraction: true,
      hydrateOnIdle: true,
      logHydrationEvents: true,
      maxHydrationTime: 5000
    });

    console.log('⚙️ Created hydration system');

    // Register components with the hydration system
    Object.entries(mockComponents).forEach(([id, component]) => {
      const element = document.querySelector(`[data-ssr-component="${id}"]`);
      if (element) {
        hydrationSystem.registerComponentForHydration(id, {
          element,
          component,
          loader: () => Promise.resolve({ default: component })
        });
      }
    });

    console.log('📝 Registered components for hydration');

    // Test immediate hydration
    console.log('\n🚀 Testing immediate hydration...');
    await hydrationSystem.hydrateByStrategy('immediate');

    const headerHydrated = hydrationSystem.isComponentHydrated('header-component');
    console.log(`${headerHydrated ? '✅' : '❌'} Header component hydrated: ${headerHydrated}`);

    // Test visible hydration (simulate intersection)
    console.log('\n👁️ Testing visible hydration...');
    const mainElement = document.querySelector('[data-ssr-component="main-content"]');
    if (mainElement && hydrationSystem.intersectionObserver) {
      // Simulate intersection observer callback
      const entries = [{
        target: mainElement,
        isIntersecting: true
      }];
      hydrationSystem.intersectionObserver.callback(entries);

      // Wait for hydration
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const mainHydrated = hydrationSystem.isComponentHydrated('main-content');
    console.log(`${mainHydrated ? '✅' : '❌'} Main content hydrated: ${mainHydrated}`);

    // Test interaction hydration
    console.log('\n🖱️ Testing interaction hydration...');
    const sidebarElement = document.querySelector('[data-ssr-component="sidebar-component"]');
    if (sidebarElement) {
      // Simulate click event
      const clickEvent = new dom.window.Event('click', { bubbles: true });
      sidebarElement.dispatchEvent(clickEvent);

      // Wait for hydration
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const sidebarHydrated = hydrationSystem.isComponentHydrated('sidebar-component');
    console.log(`${sidebarHydrated ? '✅' : '❌'} Sidebar component hydrated: ${sidebarHydrated}`);

    // Test idle hydration
    console.log('\n💤 Testing idle hydration...');
    if (global.requestIdleCallback.mockCallback) {
      global.requestIdleCallback.mockCallback({ timeRemaining: () => 10 });

      // Wait for hydration
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const footerHydrated = hydrationSystem.isComponentHydrated('footer-component');
    console.log(`${footerHydrated ? '✅' : '❌'} Footer component hydrated: ${footerHydrated}`);

    // Test component functionality after hydration
    console.log('\n🔧 Testing component functionality...');

    const headerInstance = hydrationSystem.getComponentInstance('header-component');
    const mainInstance = hydrationSystem.getComponentInstance('main-content');

    let functionalityTests = 0;
    let passedTests = 0;

    // Test header component
    if (headerInstance && typeof headerInstance.toggleMenu === 'function') {
      functionalityTests++;
      try {
        headerInstance.toggleMenu();
        passedTests++;
        console.log('✅ Header toggleMenu function works');
      } catch (error) {
        console.log('❌ Header toggleMenu function failed:', error.message);
      }
    }

    // Test main component
    if (mainInstance && typeof mainInstance.likePost === 'function') {
      functionalityTests++;
      try {
        mainInstance.likePost({ target: { dataset: { postId: '1' } } });
        passedTests++;
        console.log('✅ Main likePost function works');
      } catch (error) {
        console.log('❌ Main likePost function failed:', error.message);
      }
    }

    // Test hydration metrics
    console.log('\n📊 Testing hydration metrics...');
    const metrics = hydrationSystem.getHydrationMetrics();

    console.log(`- Total components: ${metrics.totalComponents}`);
    console.log(`- Hydrated components: ${metrics.hydratedComponents}`);
    console.log(`- Failed components: ${metrics.failedComponents}`);
    console.log(`- Average hydration time: ${metrics.averageHydrationTime.toFixed(2)}ms`);

    // Test error handling
    console.log('\n🚨 Testing error handling...');

    // Register a component that will fail to hydrate
    const failingComponent = () => {
      throw new Error('Intentional hydration failure');
    };

    const errorElement = document.createElement('div');
    errorElement.setAttribute('data-ssr-component', 'failing-component');
    document.body.appendChild(errorElement);

    hydrationSystem.registerComponentForHydration('failing-component', {
      element: errorElement,
      component: failingComponent,
      strategy: 'immediate'
    });

    try {
      await hydrationSystem.hydrateByStrategy('immediate');
    } catch (error) {
      // Expected to fail
    }

    const errorCount = hydrationSystem.hydrationErrors.length;
    console.log(`${errorCount > 0 ? '✅' : '❌'} Error handling works: ${errorCount} errors recorded`);

    // Test force hydration
    console.log('\n🔧 Testing force hydration...');

    const forceElement = document.createElement('div');
    forceElement.setAttribute('data-ssr-component', 'force-component');
    document.body.appendChild(forceElement);

    const forceComponent = createMockComponent('force-component');
    hydrationSystem.registerComponentForHydration('force-component', {
      element: forceElement,
      component: forceComponent,
      strategy: 'manual'
    });

    const forceInstance = await hydrationSystem.forceHydrate('force-component');
    const forceHydrated = hydrationSystem.isComponentHydrated('force-component');

    console.log(`${forceHydrated ? '✅' : '❌'} Force hydration works: ${forceHydrated}`);

    // Final results
    console.log('\n🎉 Hydration Integration Test Results:');

    const results = [
      { name: 'Header (immediate)', passed: headerHydrated },
      { name: 'Main (visible)', passed: mainHydrated },
      { name: 'Sidebar (interaction)', passed: sidebarHydrated },
      { name: 'Footer (idle)', passed: footerHydrated },
      { name: 'Error handling', passed: errorCount > 0 },
      { name: 'Force hydration', passed: forceHydrated },
      { name: 'Component functionality', passed: passedTests === functionalityTests && functionalityTests > 0 }
    ];

    const totalTests = results.length;
    const passedResults = results.filter(r => r.passed).length;

    results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    });

    console.log(`\n📈 Overall Results: ${passedResults}/${totalTests} tests passed (${((passedResults / totalTests) * 100).toFixed(1)}%)`);

    // Performance metrics
    const finalMetrics = hydrationSystem.getHydrationMetrics();
    console.log('\n⚡ Performance Metrics:');
    console.log(`- Total hydration time: ${finalMetrics.totalHydrationTime.toFixed(2)}ms`);
    console.log(`- Average per component: ${finalMetrics.averageHydrationTime.toFixed(2)}ms`);
    console.log(`- Success rate: ${((finalMetrics.hydratedComponents / finalMetrics.totalComponents) * 100).toFixed(1)}%`);

    // Cleanup
    hydrationSystem.cleanup();
    console.log('\n🧹 Cleaned up hydration system');

    if (passedResults === totalTests) {
      console.log('\n✅ All hydration tests passed! Progressive hydration is working correctly.');
      return true;
    } else {
      console.log('\n⚠️ Some hydration tests failed. Check the output above for details.');
      return false;
    }

  } catch (error) {
    console.error('❌ Hydration Integration Test Failed:', error);
    return false;
  }
}

// Helper functions for creating mock components and observers

function createMockIntersectionObserver() {
  return class MockIntersectionObserver {
    constructor(callback) {
      this.callback = callback;
      this.elements = new Set();
    }

    observe(element) {
      this.elements.add(element);
    }

    unobserve(element) {
      this.elements.delete(element);
    }

    disconnect() {
      this.elements.clear();
    }
  };
}

function createMockRequestIdleCallback() {
  const mock = (callback) => {
    mock.mockCallback = callback;
    setTimeout(() => callback({ timeRemaining: () => 10 }), 0);
  };
  return mock;
}

function createMockComponent(name) {
  return class MockComponent {
    constructor(context) {
      this.context = context;
      this.state = {};
      this.eventListeners = new Map();
    }

    hydrate(element, context) {
      this.element = element;
      this.restoreState(context.ssrData);
      this.attachEventListeners(element);
      this.initializeReactivity();
      return Promise.resolve();
    }

    restoreState(ssrData) {
      this.state = { ...ssrData };
    }

    attachEventListeners(element) {
      const buttons = element.querySelectorAll('button[data-handler]');
      buttons.forEach(button => {
        const handler = button.getAttribute('data-handler');
        if (this[handler]) {
          button.addEventListener('click', this[handler].bind(this));
        }
      });
    }

    initializeReactivity() {
      // Mock reactive system initialization
    }

    onHydrated() {
      console.log(`${name} component hydrated successfully`);
    }
  };
}

function createMockHeaderComponent() {
  return class HeaderComponent extends createMockComponent('Header') {
    toggleMenu() {
      this.state.menuOpen = !this.state.menuOpen;
      console.log('Menu toggled:', this.state.menuOpen);
    }
  };
}

function createMockMainComponent() {
  return class MainComponent extends createMockComponent('Main') {
    likePost(event) {
      const postId = event.target.dataset.postId;
      this.state.likedPosts = this.state.likedPosts || [];
      this.state.likedPosts.push(postId);
      console.log('Post liked:', postId);
    }
  };
}

function createMockSidebarComponent() {
  return class SidebarComponent extends createMockComponent('Sidebar') {
    showProfile() {
      console.log('Profile shown for user:', this.state.user?.name);
    }
  };
}

function createMockFooterComponent() {
  return class FooterComponent extends createMockComponent('Footer') {
    trackClick(event) {
      const link = event.target.textContent;
      console.log('Link clicked:', link);
    }
  };
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testHydrationIntegration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testHydrationIntegration };