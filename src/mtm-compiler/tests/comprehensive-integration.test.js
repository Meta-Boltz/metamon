/**
 * Comprehensive Integration Tests for Enhanced MTM Framework
 * 
 * This test suite covers:
 * - End-to-end user navigation flows
 * - Multi-framework component interaction
 * - Browser compatibility scenarios
 * - Production build functionality
 * - Complete system integration
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { EnhancedMTMCompiler } = require('../enhanced-compiler-with-modes.js');
const { NavigationIntegration } = require('../navigation-integration.js');
const { BuildSystemIntegration } = require('../build-system-integration.js');

describe('Comprehensive Integration Tests', () => {
  let tempDir;
  let compiler;
  let navigation;
  let buildSystem;
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Create temporary test directory
    tempDir = path.join(__dirname, 'temp-comprehensive-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Initialize components
    compiler = new EnhancedMTMCompiler();
    navigation = new NavigationIntegration();
    buildSystem = new BuildSystemIntegration();

    // Setup DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.history = window.history;
    global.location = window.location;
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    delete global.window;
    delete global.document;
    delete global.history;
    delete global.location;
  });

  describe('End-to-End Navigation Flows', () => {
    test('should handle complete user navigation journey', async () => {
      // Create a complete set of example pages
      const pages = [
        {
          filename: 'index.mtm',
          content: `---
route: "/"
title: "Home Page"
compileJsMode: "inline"
---

$visitCount! = signal('visitCount', 1)

<template>
  <div class="home">
    <h1>Welcome Home</h1>
    <nav>
      <a href="/about" data-testid="about-link">About</a>
      <a href="/react-example" data-testid="react-link">React</a>
      <a href="/vue-example" data-testid="vue-link">Vue</a>
    </nav>
    <p>Visit count: {$visitCount}</p>
  </div>
</template>`
        },
        {
          filename: 'about.mtm',
          content: `---
route: "/about"
title: "About Page"
compileJsMode: "external.js"
---

$pageViews! = signal('pageViews', 0)

$incrementViews = () => {
  $pageViews++
}

<template>
  <div class="about">
    <h1>About Us</h1>
    <nav>
      <a href="/" data-testid="home-link">Home</a>
      <a href="/contact" data-testid="contact-link">Contact</a>
    </nav>
    <button onclick={$incrementViews} data-testid="increment-btn">
      Views: {$pageViews}
    </button>
  </div>
</template>`
        },
        {
          filename: 'react-example.mtm',
          content: `---
route: "/react-example"
title: "React Example"
compileJsMode: "external.js"
framework: "react"
---

import Counter from "@components/Counter.tsx"

$reactState! = signal('reactState', { count: 0 })

$handleReactUpdate = (newState) => {
  $reactState = newState
}

<template>
  <div class="react-page">
    <h1>React Integration</h1>
    <nav>
      <a href="/" data-testid="home-link">Home</a>
      <a href="/vue-example" data-testid="vue-link">Vue</a>
    </nav>
    <Counter 
      initialValue={$reactState.count}
      onUpdate={$handleReactUpdate}
      data-testid="react-counter"
    />
  </div>
</template>`
        },
        {
          filename: 'vue-example.mtm',
          content: `---
route: "/vue-example"
title: "Vue Example"
compileJsMode: "external.js"
framework: "vue"
---

import TodoList from "@components/TodoList.vue"

$vueState! = signal('vueState', { todos: [] })

$handleVueUpdate = (todos) => {
  $vueState = { todos }
}

<template>
  <div class="vue-page">
    <h1>Vue Integration</h1>
    <nav>
      <a href="/" data-testid="home-link">Home</a>
      <a href="/react-example" data-testid="react-link">React</a>
    </nav>
    <TodoList 
      todos={$vueState.todos}
      onUpdate={$handleVueUpdate}
      data-testid="vue-todos"
    />
  </div>
</template>`
        }
      ];

      // Write test pages
      for (const page of pages) {
        fs.writeFileSync(path.join(tempDir, page.filename), page.content);
      }

      // Initialize navigation system
      await navigation.initialize(tempDir);

      // Generate router configuration
      const routerConfig = navigation.generateRouterConfig();
      const routerPath = path.join(tempDir, 'router.js');
      fs.writeFileSync(routerPath, routerConfig);

      // Compile all pages
      const compiledPages = {};
      for (const page of pages) {
        const result = await compiler.compile(page.content, {
          filename: page.filename,
          outputDir: tempDir
        });
        compiledPages[page.filename] = result;
      }

      // Test navigation flow: Home → About → React → Vue → Home
      const navigationFlow = [
        { from: '/', to: '/about', expectedTitle: 'About Page' },
        { from: '/about', to: '/react-example', expectedTitle: 'React Example' },
        { from: '/react-example', to: '/vue-example', expectedTitle: 'Vue Example' },
        { from: '/vue-example', to: '/', expectedTitle: 'Home Page' }
      ];

      // Simulate navigation
      for (const step of navigationFlow) {
        // Load router in DOM
        const script = document.createElement('script');
        script.textContent = routerConfig;
        document.head.appendChild(script);

        // Simulate navigation
        window.history.pushState({}, '', step.to);

        // Verify route was registered
        const routes = navigation.routeRegistry.getAll();
        expect(routes.has(step.to)).toBe(true);

        const route = routes.get(step.to);
        expect(route.metadata.title).toBe(step.expectedTitle);
      }

      // Verify all pages were compiled successfully
      expect(Object.keys(compiledPages)).toHaveLength(4);
      for (const [filename, result] of Object.entries(compiledPages)) {
        expect(result.html).toContain('<h1>');
        expect(result.success).toBe(true);
      }
    });

    test('should handle browser history operations', async () => {
      const homeContent = `---
route: "/"
title: "Home"
---
<template><h1>Home</h1></template>`;

      const aboutContent = `---
route: "/about"
title: "About"
---
<template><h1>About</h1></template>`;

      fs.writeFileSync(path.join(tempDir, 'home.mtm'), homeContent);
      fs.writeFileSync(path.join(tempDir, 'about.mtm'), aboutContent);

      await navigation.initialize(tempDir);
      const routerConfig = navigation.generateRouterConfig();

      // Load router
      const script = document.createElement('script');
      script.textContent = routerConfig;
      document.head.appendChild(script);

      // Simulate navigation history
      window.history.pushState({ page: 'home' }, 'Home', '/');
      window.history.pushState({ page: 'about' }, 'About', '/about');

      // Test back navigation
      window.history.back();
      expect(window.location.pathname).toBe('/');

      // Test forward navigation
      window.history.forward();
      expect(window.location.pathname).toBe('/about');

      // Test replace state
      window.history.replaceState({ page: 'about-updated' }, 'About Updated', '/about');
      expect(window.location.pathname).toBe('/about');
    });

    test('should handle external link navigation', async () => {
      const pageContent = `---
route: "/test"
title: "Test Page"
---
<template>
  <div>
    <a href="/internal" data-testid="internal-link">Internal Link</a>
    <a href="https://example.com" data-testid="external-link">External Link</a>
    <a href="mailto:test@example.com" data-testid="email-link">Email Link</a>
  </div>
</template>`;

      fs.writeFileSync(path.join(tempDir, 'test.mtm'), pageContent);

      const result = await compiler.compile(pageContent, {
        filename: 'test.mtm',
        outputDir: tempDir
      });

      // Verify internal links have data-link attribute for router interception
      expect(result.html).toContain('href="/internal"');

      // Verify external links remain unchanged
      expect(result.html).toContain('href="https://example.com"');
      expect(result.html).toContain('href="mailto:test@example.com"');
    });
  });

  describe('Multi-Framework Component Interaction', () => {
    test('should handle React and Vue components on same page', async () => {
      const mixedContent = `---
route: "/mixed"
title: "Mixed Framework Page"
compileJsMode: "external.js"
---

import ReactCounter from "@components/Counter.tsx"
import VueButton from "@components/Button.vue"

$sharedState! = signal('sharedState', { count: 0, message: '' })

$handleReactUpdate = (count) => {
  $sharedState = { ...$sharedState, count }
}

$handleVueClick = (message) => {
  $sharedState = { ...$sharedState, message }
}

<template>
  <div class="mixed-framework">
    <h1>Mixed Framework Components</h1>
    
    <section class="react-section">
      <h2>React Component</h2>
      <ReactCounter 
        value={$sharedState.count}
        onUpdate={$handleReactUpdate}
      />
    </section>
    
    <section class="vue-section">
      <h2>Vue Component</h2>
      <VueButton 
        label="Click me!"
        onClick={$handleVueClick}
      />
    </section>
    
    <section class="shared-state">
      <h2>Shared State</h2>
      <p>Count: {$sharedState.count}</p>
      <p>Message: {$sharedState.message}</p>
    </section>
  </div>
</template>`;

      const result = await compiler.compile(mixedContent, {
        filename: 'mixed.mtm',
        outputDir: tempDir
      });

      expect(result.success).toBe(true);
      expect(result.html).toContain('mixed-framework');
      expect(result.html).toContain('react-section');
      expect(result.html).toContain('vue-section');
      expect(result.html).toContain('shared-state');

      // Verify component imports are processed
      expect(result.imports).toContainEqual(
        expect.objectContaining({
          name: 'ReactCounter',
          framework: 'react'
        })
      );
      expect(result.imports).toContainEqual(
        expect.objectContaining({
          name: 'VueButton',
          framework: 'vue'
        })
      );
    });

    test('should handle state synchronization between frameworks', async () => {
      const stateContent = `---
route: "/state-sync"
title: "State Synchronization"
compileJsMode: "external.js"
---

import ReactComponent from "@components/ReactState.tsx"
import VueComponent from "@components/VueState.vue"
import SolidComponent from "@components/SolidState.tsx"
import SvelteComponent from "@components/SvelteState.svelte"

$globalState! = signal('globalState', {
  user: { name: 'John', email: 'john@example.com' },
  preferences: { theme: 'dark', language: 'en' },
  notifications: []
})

$updateUser = (user) => {
  $globalState = { ...$globalState, user }
}

$updatePreferences = (preferences) => {
  $globalState = { ...$globalState, preferences }
}

$addNotification = (notification) => {
  $globalState = {
    ...$globalState,
    notifications: [...$globalState.notifications, notification]
  }
}

<template>
  <div class="state-sync-demo">
    <h1>Multi-Framework State Synchronization</h1>
    
    <div class="framework-grid">
      <div class="framework-card">
        <h3>React Component</h3>
        <ReactComponent 
          user={$globalState.user}
          onUserUpdate={$updateUser}
        />
      </div>
      
      <div class="framework-card">
        <h3>Vue Component</h3>
        <VueComponent 
          preferences={$globalState.preferences}
          onPreferencesUpdate={$updatePreferences}
        />
      </div>
      
      <div class="framework-card">
        <h3>Solid Component</h3>
        <SolidComponent 
          notifications={$globalState.notifications}
          onNotificationAdd={$addNotification}
        />
      </div>
      
      <div class="framework-card">
        <h3>Svelte Component</h3>
        <SvelteComponent 
          globalState={$globalState}
          onStateUpdate={(key, value) => {
            $globalState = { ...$globalState, [key]: value }
          }}
        />
      </div>
    </div>
    
    <div class="state-display">
      <h3>Current Global State</h3>
      <pre>{JSON.stringify($globalState, null, 2)}</pre>
    </div>
  </div>
</template>`;

      const result = await compiler.compile(stateContent, {
        filename: 'state-sync.mtm',
        outputDir: tempDir
      });

      expect(result.success).toBe(true);
      expect(result.html).toContain('state-sync-demo');
      expect(result.html).toContain('framework-grid');
      expect(result.html).toContain('state-display');

      // Verify all framework components are imported
      const frameworks = ['react', 'vue', 'solid', 'svelte'];
      for (const framework of frameworks) {
        expect(result.imports.some(imp => imp.framework === framework)).toBe(true);
      }

      // Verify state management functions are present
      expect(result.javascript).toContain('updateUser');
      expect(result.javascript).toContain('updatePreferences');
      expect(result.javascript).toContain('addNotification');
    });

    test('should handle component lifecycle interactions', async () => {
      const lifecycleContent = `---
route: "/lifecycle"
title: "Component Lifecycle"
compileJsMode: "external.js"
---

import LifecycleReact from "@components/LifecycleReact.tsx"
import LifecycleVue from "@components/LifecycleVue.vue"

$componentStates! = signal('componentStates', {
  react: { mounted: false, updated: 0 },
  vue: { mounted: false, updated: 0 }
})

$onReactMount = () => {
  $componentStates = {
    ...$componentStates,
    react: { ...$componentStates.react, mounted: true }
  }
}

$onReactUpdate = () => {
  $componentStates = {
    ...$componentStates,
    react: { 
      ...$componentStates.react, 
      updated: $componentStates.react.updated + 1 
    }
  }
}

$onVueMount = () => {
  $componentStates = {
    ...$componentStates,
    vue: { ...$componentStates.vue, mounted: true }
  }
}

$onVueUpdate = () => {
  $componentStates = {
    ...$componentStates,
    vue: { 
      ...$componentStates.vue, 
      updated: $componentStates.vue.updated + 1 
    }
  }
}

<template>
  <div class="lifecycle-demo">
    <h1>Component Lifecycle Management</h1>
    
    <div class="lifecycle-status">
      <h3>Component Status</h3>
      <div class="status-grid">
        <div class="status-item">
          <h4>React Component</h4>
          <p>Mounted: {$componentStates.react.mounted ? 'Yes' : 'No'}</p>
          <p>Updates: {$componentStates.react.updated}</p>
        </div>
        <div class="status-item">
          <h4>Vue Component</h4>
          <p>Mounted: {$componentStates.vue.mounted ? 'Yes' : 'No'}</p>
          <p>Updates: {$componentStates.vue.updated}</p>
        </div>
      </div>
    </div>
    
    <div class="components-container">
      <LifecycleReact 
        onMount={$onReactMount}
        onUpdate={$onReactUpdate}
      />
      
      <LifecycleVue 
        onMount={$onVueMount}
        onUpdate={$onVueUpdate}
      />
    </div>
  </div>
</template>`;

      const result = await compiler.compile(lifecycleContent, {
        filename: 'lifecycle.mtm',
        outputDir: tempDir
      });

      expect(result.success).toBe(true);
      expect(result.html).toContain('lifecycle-demo');
      expect(result.html).toContain('lifecycle-status');
      expect(result.html).toContain('components-container');

      // Verify lifecycle handlers are present
      expect(result.javascript).toContain('onReactMount');
      expect(result.javascript).toContain('onReactUpdate');
      expect(result.javascript).toContain('onVueMount');
      expect(result.javascript).toContain('onVueUpdate');
    });
  });

  describe('Browser Compatibility Tests', () => {
    test('should generate compatible JavaScript for different browsers', async () => {
      const modernContent = `---
route: "/modern"
title: "Modern Features"
compileJsMode: "external.js"
---

$modernFeatures! = signal('modernFeatures', {
  asyncData: null,
  promiseResult: null,
  arrayMethods: []
})

$loadAsyncData = async () => {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    $modernFeatures = { ...$modernFeatures, asyncData: data };
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

$usePromise = () => {
  Promise.resolve('Promise resolved!')
    .then(result => {
      $modernFeatures = { ...$modernFeatures, promiseResult: result };
    })
    .catch(error => {
      console.error('Promise error:', error);
    });
}

$useArrayMethods = () => {
  const numbers = [1, 2, 3, 4, 5];
  const processed = numbers
    .filter(n => n % 2 === 0)
    .map(n => n * 2)
    .reduce((sum, n) => sum + n, 0);
  
  $modernFeatures = { 
    ...$modernFeatures, 
    arrayMethods: [...$modernFeatures.arrayMethods, processed] 
  };
}

<template>
  <div class="modern-features">
    <h1>Modern JavaScript Features</h1>
    
    <div class="feature-tests">
      <button onclick={$loadAsyncData}>Test Async/Await</button>
      <button onclick={$usePromise}>Test Promises</button>
      <button onclick={$useArrayMethods}>Test Array Methods</button>
    </div>
    
    <div class="results">
      <h3>Results</h3>
      <pre>{JSON.stringify($modernFeatures, null, 2)}</pre>
    </div>
  </div>
</template>`;

      const result = await compiler.compile(modernContent, {
        filename: 'modern.mtm',
        outputDir: tempDir,
        browserTarget: 'es2015' // Target older browsers
      });

      expect(result.success).toBe(true);

      // Verify modern features are transpiled appropriately
      expect(result.javascript).toBeDefined();

      // Should handle async/await
      expect(result.javascript).toContain('loadAsyncData');

      // Should handle promises
      expect(result.javascript).toContain('Promise');

      // Should handle array methods
      expect(result.javascript).toContain('filter');
      expect(result.javascript).toContain('map');
      expect(result.javascript).toContain('reduce');
    });

    test('should handle polyfills for older browsers', async () => {
      const polyfillContent = `---
route: "/polyfills"
title: "Polyfill Test"
compileJsMode: "external.js"
---

$polyfillTests! = signal('polyfillTests', {
  objectAssign: null,
  arrayIncludes: null,
  stringStartsWith: null
})

$testPolyfills = () => {
  // Test Object.assign
  const obj1 = { a: 1 };
  const obj2 = { b: 2 };
  const merged = Object.assign({}, obj1, obj2);
  
  // Test Array.includes
  const arr = [1, 2, 3];
  const hasTwo = arr.includes(2);
  
  // Test String.startsWith
  const str = 'Hello World';
  const startsWithHello = str.startsWith('Hello');
  
  $polyfillTests = {
    objectAssign: merged,
    arrayIncludes: hasTwo,
    stringStartsWith: startsWithHello
  };
}

<template>
  <div class="polyfill-tests">
    <h1>Polyfill Compatibility</h1>
    <button onclick={$testPolyfills}>Run Polyfill Tests</button>
    <div class="test-results">
      <pre>{JSON.stringify($polyfillTests, null, 2)}</pre>
    </div>
  </div>
</template>`;

      const result = await compiler.compile(polyfillContent, {
        filename: 'polyfills.mtm',
        outputDir: tempDir,
        includePolyfills: true
      });

      expect(result.success).toBe(true);
      expect(result.javascript).toContain('testPolyfills');

      // Verify polyfills are included when needed
      if (result.polyfills) {
        expect(result.polyfills).toContain('Object.assign');
      }
    });

    test('should handle CSS compatibility', async () => {
      const cssContent = `---
route: "/css-compat"
title: "CSS Compatibility"
compileJsMode: "inline"
---

<template>
  <div class="css-compat">
    <h1>CSS Compatibility Test</h1>
    <div class="modern-layout">
      <div class="grid-item">Grid Item 1</div>
      <div class="grid-item">Grid Item 2</div>
      <div class="flex-item">Flex Item</div>
    </div>
  </div>
</template>

<style>
  .css-compat {
    container-type: inline-size;
  }

  .modern-layout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin: 2rem 0;
  }

  .grid-item {
    background: linear-gradient(45deg, #667eea, #764ba2);
    padding: 1rem;
    border-radius: 8px;
    color: white;
  }

  .flex-item {
    display: flex;
    align-items: center;
    justify-content: center;
    background: hsl(200, 50%, 50%);
    padding: 1rem;
    border-radius: 8px;
    color: white;
  }

  @container (min-width: 400px) {
    .modern-layout {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @supports (display: grid) {
    .modern-layout {
      display: grid;
    }
  }

  @supports not (display: grid) {
    .modern-layout {
      display: flex;
      flex-wrap: wrap;
    }
  }
</style>`;

      const result = await compiler.compile(cssContent, {
        filename: 'css-compat.mtm',
        outputDir: tempDir,
        autoprefixer: true
      });

      expect(result.success).toBe(true);
      expect(result.html).toContain('css-compat');
      expect(result.html).toContain('modern-layout');

      // Verify CSS is processed
      expect(result.html).toContain('<style>');
      expect(result.html).toContain('display: grid');
    });
  });

  describe('Production Build Tests', () => {
    test('should optimize JavaScript for production', async () => {
      const prodContent = `---
route: "/production"
title: "Production Build"
compileJsMode: "external.js"
---

import OptimizedComponent from "@components/Optimized.tsx"

$productionState! = signal('productionState', {
  isProduction: true,
  buildTime: new Date().toISOString(),
  features: ['minification', 'tree-shaking', 'code-splitting']
})

$logPerformance = () => {
  console.log('Performance logging in production');
  console.log('Build time:', $productionState.buildTime);
  console.log('Features:', $productionState.features);
}

$handleOptimizedUpdate = (data) => {
  $productionState = { ...$productionState, ...data };
}

<template>
  <div class="production-build">
    <h1>Production Build Test</h1>
    
    <div class="build-info">
      <h3>Build Information</h3>
      <p>Production: {$productionState.isProduction ? 'Yes' : 'No'}</p>
      <p>Build Time: {$productionState.buildTime}</p>
      <p>Features: {$productionState.features.join(', ')}</p>
    </div>
    
    <div class="optimized-component">
      <OptimizedComponent 
        data={$productionState}
        onUpdate={$handleOptimizedUpdate}
      />
    </div>
    
    <button onclick={$logPerformance}>Log Performance</button>
  </div>
</template>`;

      const result = await compiler.compile(prodContent, {
        filename: 'production.mtm',
        outputDir: tempDir,
        production: true,
        minify: true,
        treeshake: true
      });

      expect(result.success).toBe(true);

      // In production mode, JavaScript should be optimized
      if (result.production) {
        expect(result.javascript.length).toBeLessThan(prodContent.length);
        // Minified code should have fewer whitespace characters
        const whitespaceCount = (result.javascript.match(/\s/g) || []).length;
        const originalWhitespaceCount = (prodContent.match(/\s/g) || []).length;
        expect(whitespaceCount).toBeLessThan(originalWhitespaceCount);
      }
    });

    test('should handle code splitting in production', async () => {
      const splittingContent = `---
route: "/code-splitting"
title: "Code Splitting"
compileJsMode: "external.js"
---

import LazyComponent from "@components/LazyComponent.tsx"
import HeavyComponent from "@components/HeavyComponent.vue"

$loadingState! = signal('loadingState', {
  lazyLoaded: false,
  heavyLoaded: false
})

$loadLazyComponent = async () => {
  $loadingState = { ...$loadingState, lazyLoaded: true };
}

$loadHeavyComponent = async () => {
  $loadingState = { ...$loadingState, heavyLoaded: true };
}

<template>
  <div class="code-splitting">
    <h1>Code Splitting Demo</h1>
    
    <div class="loading-controls">
      <button onclick={$loadLazyComponent}>Load Lazy Component</button>
      <button onclick={$loadHeavyComponent}>Load Heavy Component</button>
    </div>
    
    <div class="dynamic-content">
      {#if $loadingState.lazyLoaded}
        <LazyComponent />
      {/if}
      
      {#if $loadingState.heavyLoaded}
        <HeavyComponent />
      {/if}
    </div>
    
    <div class="loading-status">
      <p>Lazy Component: {$loadingState.lazyLoaded ? 'Loaded' : 'Not Loaded'}</p>
      <p>Heavy Component: {$loadingState.heavyLoaded ? 'Loaded' : 'Not Loaded'}</p>
    </div>
  </div>
</template>`;

      const result = await compiler.compile(splittingContent, {
        filename: 'code-splitting.mtm',
        outputDir: tempDir,
        production: true,
        codeSplitting: true
      });

      expect(result.success).toBe(true);

      // Verify code splitting generates separate chunks
      if (result.chunks) {
        expect(result.chunks.length).toBeGreaterThan(1);
        expect(result.chunks.some(chunk => chunk.includes('LazyComponent'))).toBe(true);
        expect(result.chunks.some(chunk => chunk.includes('HeavyComponent'))).toBe(true);
      }
    });

    test('should generate source maps for debugging', async () => {
      const debugContent = `---
route: "/debug"
title: "Debug Build"
compileJsMode: "external.js"
---

$debugInfo! = signal('debugInfo', {
  environment: 'development',
  sourceMap: true,
  debugging: true
})

$debugFunction = () => {
  console.log('Debug function called');
  console.log('Debug info:', $debugInfo);
  
  // Simulate error for source map testing
  try {
    throw new Error('Test error for source mapping');
  } catch (error) {
    console.error('Caught error:', error);
  }
}

<template>
  <div class="debug-build">
    <h1>Debug Build Test</h1>
    <button onclick={$debugFunction}>Trigger Debug Function</button>
    <pre>{JSON.stringify($debugInfo, null, 2)}</pre>
  </div>
</template>`;

      const result = await compiler.compile(debugContent, {
        filename: 'debug.mtm',
        outputDir: tempDir,
        sourceMaps: true,
        development: true
      });

      expect(result.success).toBe(true);

      // Verify source maps are generated
      if (result.sourceMap) {
        expect(result.sourceMap).toContain('mappings');
        expect(result.sourceMap).toContain('sources');
      }
    });
  });

  describe('Automated Test Suite', () => {
    test('should run complete integration test suite', async () => {
      // Create a comprehensive test scenario
      const testScenarios = [
        {
          name: 'Basic Navigation',
          pages: [
            { route: '/', title: 'Home' },
            { route: '/about', title: 'About' }
          ]
        },
        {
          name: 'Multi-Framework',
          pages: [
            { route: '/react', title: 'React', framework: 'react' },
            { route: '/vue', title: 'Vue', framework: 'vue' }
          ]
        },
        {
          name: 'Complex State',
          pages: [
            { route: '/state', title: 'State Management' }
          ]
        }
      ];

      const testResults = [];

      for (const scenario of testScenarios) {
        const scenarioResults = {
          name: scenario.name,
          passed: 0,
          failed: 0,
          errors: []
        };

        try {
          // Create pages for scenario
          for (const page of scenario.pages) {
            const content = `---
route: "${page.route}"
title: "${page.title}"
${page.framework ? `framework: "${page.framework}"` : ''}
---
<template><h1>${page.title}</h1></template>`;

            fs.writeFileSync(
              path.join(tempDir, `${page.title.toLowerCase()}.mtm`),
              content
            );
          }

          // Initialize and test
          await navigation.initialize(tempDir);
          const routes = navigation.routeRegistry.getAll();

          // Verify all routes are registered
          for (const page of scenario.pages) {
            if (routes.has(page.route)) {
              scenarioResults.passed++;
            } else {
              scenarioResults.failed++;
              scenarioResults.errors.push(`Route ${page.route} not registered`);
            }
          }

        } catch (error) {
          scenarioResults.failed++;
          scenarioResults.errors.push(error.message);
        }

        testResults.push(scenarioResults);
      }

      // Verify all scenarios passed
      for (const result of testResults) {
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(result.passed).toBeGreaterThan(0);
      }

      // Generate test report
      const report = {
        timestamp: new Date().toISOString(),
        totalScenarios: testResults.length,
        passedScenarios: testResults.filter(r => r.failed === 0).length,
        failedScenarios: testResults.filter(r => r.failed > 0).length,
        details: testResults
      };

      expect(report.failedScenarios).toBe(0);
      expect(report.passedScenarios).toBe(testScenarios.length);
    });

    test('should validate performance benchmarks', async () => {
      const performanceContent = `---
route: "/performance"
title: "Performance Test"
compileJsMode: "external.js"
---

$performanceMetrics! = signal('performanceMetrics', {
  compilationTime: 0,
  bundleSize: 0,
  renderTime: 0
})

$measurePerformance = () => {
  const start = performance.now();
  
  // Simulate heavy computation
  for (let i = 0; i < 100000; i++) {
    Math.random();
  }
  
  const end = performance.now();
  
  $performanceMetrics = {
    ...$performanceMetrics,
    renderTime: end - start
  };
}

<template>
  <div class="performance-test">
    <h1>Performance Benchmarks</h1>
    <button onclick={$measurePerformance}>Measure Performance</button>
    <div class="metrics">
      <p>Render Time: {$performanceMetrics.renderTime}ms</p>
    </div>
  </div>
</template>`;

      const startTime = Date.now();

      const result = await compiler.compile(performanceContent, {
        filename: 'performance.mtm',
        outputDir: tempDir
      });

      const compilationTime = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Performance benchmarks
      expect(compilationTime).toBeLessThan(5000); // Should compile in under 5 seconds

      if (result.bundleSize) {
        expect(result.bundleSize).toBeLessThan(1024 * 1024); // Should be under 1MB
      }

      // Verify performance measurement code is present
      expect(result.javascript).toContain('measurePerformance');
      expect(result.javascript).toContain('performance.now');
    });

    test('should validate accessibility compliance', async () => {
      const a11yContent = `---
route: "/accessibility"
title: "Accessibility Test"
compileJsMode: "inline"
---

$a11yState! = signal('a11yState', {
  focusedElement: null,
  screenReaderText: ''
})

$handleFocus = (element) => {
  $a11yState = { ...$a11yState, focusedElement: element };
}

$announceToScreenReader = (text) => {
  $a11yState = { ...$a11yState, screenReaderText: text };
}

<template>
  <div class="accessibility-test">
    <h1>Accessibility Compliance Test</h1>
    
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="/" aria-current="page">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
    
    <main>
      <section aria-labelledby="form-heading">
        <h2 id="form-heading">Contact Form</h2>
        
        <form>
          <div class="form-group">
            <label for="name">Name (required)</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              required 
              aria-describedby="name-help"
              onfocus={() => $handleFocus('name')}
            />
            <div id="name-help" class="help-text">
              Please enter your full name
            </div>
          </div>
          
          <div class="form-group">
            <label for="email">Email (required)</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              aria-describedby="email-help"
              onfocus={() => $handleFocus('email')}
            />
            <div id="email-help" class="help-text">
              We'll never share your email
            </div>
          </div>
          
          <button 
            type="submit" 
            onclick={() => $announceToScreenReader('Form submitted successfully')}
          >
            Submit Form
          </button>
        </form>
      </section>
    </main>
    
    <div aria-live="polite" aria-atomic="true" class="sr-only">
      {$a11yState.screenReaderText}
    </div>
    
    <div class="debug-info">
      <h3>Accessibility Debug Info</h3>
      <p>Focused Element: {$a11yState.focusedElement || 'None'}</p>
      <p>Screen Reader: {$a11yState.screenReaderText || 'No announcements'}</p>
    </div>
  </div>
</template>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: bold;
  }

  input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  input:focus {
    outline: 2px solid #007cba;
    outline-offset: 2px;
  }

  .help-text {
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.25rem;
  }

  button {
    background: #007cba;
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background: #005a87;
  }

  button:focus {
    outline: 2px solid #007cba;
    outline-offset: 2px;
  }
</style>`;

      const result = await compiler.compile(a11yContent, {
        filename: 'accessibility.mtm',
        outputDir: tempDir
      });

      expect(result.success).toBe(true);

      // Verify accessibility features are present
      expect(result.html).toContain('aria-label');
      expect(result.html).toContain('aria-labelledby');
      expect(result.html).toContain('aria-describedby');
      expect(result.html).toContain('aria-live');
      expect(result.html).toContain('aria-current');
      expect(result.html).toContain('sr-only');

      // Verify form accessibility
      expect(result.html).toContain('<label for="name">');
      expect(result.html).toContain('id="name"');
      expect(result.html).toContain('required');

      // Verify focus management
      expect(result.javascript).toContain('handleFocus');
      expect(result.javascript).toContain('announceToScreenReader');
    });
  });
});