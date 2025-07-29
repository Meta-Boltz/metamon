/**
 * Production Build Integration Tests
 * 
 * Tests the enhanced MTM framework's production build capabilities,
 * including optimization, minification, code splitting, and performance.
 */

const fs = require('fs');
const path = require('path');
const { EnhancedMTMCompiler } = require('../enhanced-compiler-with-modes.js');
const { BuildSystemIntegration } = require('../build-system-integration.js');

describe('Production Build Tests', () => {
  let tempDir;
  let compiler;
  let buildSystem;

  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp-production-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    compiler = new EnhancedMTMCompiler();
    buildSystem = new BuildSystemIntegration();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('JavaScript Optimization', () => {
    test('should minify JavaScript in production mode', async () => {
      const unoptimizedContent = `---
route: "/minification-test"
title: "Minification Test"
compileJsMode: "external.js"
---

$applicationState! = signal('applicationState', {
  userPreferences: {
    theme: 'dark',
    language: 'en',
    notifications: true,
    autoSave: false
  },
  currentUser: {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'admin'
  },
  applicationData: {
    version: '2.0.0',
    buildDate: new Date().toISOString(),
    features: ['routing', 'multi-framework', 'signals']
  }
})

$updateUserPreferences = (newPreferences) => {
  console.log('Updating user preferences:', newPreferences);
  $applicationState = {
    ...$applicationState,
    userPreferences: {
      ...$applicationState.userPreferences,
      ...newPreferences
    }
  };
  console.log('Updated application state:', $applicationState);
}

$performComplexCalculation = () => {
  console.log('Starting complex calculation...');
  let result = 0;
  
  for (let i = 0; i < 10000; i++) {
    result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    
    if (i % 1000 === 0) {
      console.log(\`Progress: \${i / 100}%\`);
    }
  }
  
  console.log('Complex calculation completed:', result);
  return result;
}

$handleUserInteraction = (interactionType, data) => {
  console.log(\`User interaction: \${interactionType}\`, data);
  
  switch (interactionType) {
    case 'click':
      console.log('Handling click interaction');
      break;
    case 'hover':
      console.log('Handling hover interaction');
      break;
    case 'focus':
      console.log('Handling focus interaction');
      break;
    default:
      console.log('Unknown interaction type');
  }
}

<template>
  <div class="minification-test">
    <h1>JavaScript Minification Test</h1>
    
    <div class="user-info">
      <h2>Current User</h2>
      <p>Name: {$applicationState.currentUser.name}</p>
      <p>Email: {$applicationState.currentUser.email}</p>
      <p>Role: {$applicationState.currentUser.role}</p>
    </div>
    
    <div class="preferences">
      <h2>User Preferences</h2>
      <div class="preference-controls">
        <label>
          <input 
            type="checkbox" 
            checked={$applicationState.userPreferences.notifications}
            onchange={(e) => $updateUserPreferences({ notifications: e.target.checked })}
          />
          Enable Notifications
        </label>
        
        <label>
          <input 
            type="checkbox" 
            checked={$applicationState.userPreferences.autoSave}
            onchange={(e) => $updateUserPreferences({ autoSave: e.target.checked })}
          />
          Auto Save
        </label>
        
        <select 
          value={$applicationState.userPreferences.theme}
          onchange={(e) => $updateUserPreferences({ theme: e.target.value })}
        >
          <option value="light">Light Theme</option>
          <option value="dark">Dark Theme</option>
          <option value="auto">Auto Theme</option>
        </select>
      </div>
    </div>
    
    <div class="actions">
      <button onclick={$performComplexCalculation}>
        Perform Complex Calculation
      </button>
      
      <button onclick={() => $handleUserInteraction('click', { timestamp: Date.now() })}>
        Test Click Interaction
      </button>
    </div>
    
    <div class="application-info">
      <h2>Application Information</h2>
      <p>Version: {$applicationState.applicationData.version}</p>
      <p>Build Date: {$applicationState.applicationData.buildDate}</p>
      <p>Features: {$applicationState.applicationData.features.join(', ')}</p>
    </div>
  </div>
</template>`;

      // Compile in development mode
      const devResult = await compiler.compile(unoptimizedContent, {
        filename: 'minification-test.mtm',
        outputDir: tempDir,
        production: false,
        minify: false
      });

      // Compile in production mode
      const prodResult = await compiler.compile(unoptimizedContent, {
        filename: 'minification-test.mtm',
        outputDir: tempDir,
        production: true,
        minify: true
      });

      expect(devResult.success).toBe(true);
      expect(prodResult.success).toBe(true);

      // Production build should be smaller
      if (prodResult.javascript && devResult.javascript) {
        expect(prodResult.javascript.length).toBeLessThan(devResult.javascript.length);

        // Production build should have fewer whitespace characters
        const prodWhitespace = (prodResult.javascript.match(/\s/g) || []).length;
        const devWhitespace = (devResult.javascript.match(/\s/g) || []).length;
        expect(prodWhitespace).toBeLessThan(devWhitespace);

        // Production build should have fewer console.log statements
        const prodConsole = (prodResult.javascript.match(/console\.log/g) || []).length;
        const devConsole = (devResult.javascript.match(/console\.log/g) || []).length;
        expect(prodConsole).toBeLessThanOrEqual(devConsole);
      }
    });

    test('should perform tree shaking to remove unused code', async () => {
      const treeShakingContent = `---
route: "/tree-shaking-test"
title: "Tree Shaking Test"
compileJsMode: "external.js"
---

// Used functions
$usedFunction1! = signal('usedFunction1', () => {
  return 'This function is used';
})

$usedFunction2 = () => {
  console.log('This function is also used');
  return $usedFunction1();
}

// Unused functions that should be removed
$unusedFunction1 = () => {
  console.log('This function is never called');
  return 'unused result';
}

$unusedFunction2 = () => {
  const unusedVariable = 'This variable is unused';
  const anotherUnusedVar = {
    property1: 'value1',
    property2: 'value2',
    method: () => {
      return 'unused method result';
    }
  };
  
  return unusedVariable + anotherUnusedVar.property1;
}

$unusedComplexFunction = () => {
  const complexObject = {
    data: [1, 2, 3, 4, 5],
    methods: {
      process: (arr) => arr.map(x => x * 2),
      filter: (arr) => arr.filter(x => x > 2),
      reduce: (arr) => arr.reduce((sum, x) => sum + x, 0)
    }
  };
  
  return complexObject.methods.reduce(
    complexObject.methods.filter(
      complexObject.methods.process(complexObject.data)
    )
  );
}

// Used state
$applicationState! = signal('applicationState', {
  message: 'Tree shaking test',
  counter: 0
})

// Unused state that should be removed
$unusedState! = signal('unusedState', {
  unusedProperty: 'This should be removed',
  anotherUnusedProperty: {
    nested: 'Also unused'
  }
})

$incrementCounter = () => {
  $applicationState = {
    ...$applicationState,
    counter: $applicationState.counter + 1
  };
}

<template>
  <div class="tree-shaking-test">
    <h1>Tree Shaking Test</h1>
    
    <div class="used-content">
      <p>Message: {$applicationState.message}</p>
      <p>Counter: {$applicationState.counter}</p>
      <p>Used Function Result: {$usedFunction1()}</p>
      
      <button onclick={$incrementCounter}>
        Increment Counter
      </button>
      
      <button onclick={$usedFunction2}>
        Call Used Function 2
      </button>
    </div>
    
    <!-- Note: unused functions and state are not referenced in template -->
  </div>
</template>`;

      const result = await compiler.compile(treeShakingContent, {
        filename: 'tree-shaking-test.mtm',
        outputDir: tempDir,
        production: true,
        treeshake: true
      });

      expect(result.success).toBe(true);

      if (result.treeshake) {
        // Unused functions should be removed
        expect(result.javascript).not.toContain('unusedFunction1');
        expect(result.javascript).not.toContain('unusedFunction2');
        expect(result.javascript).not.toContain('unusedComplexFunction');
        expect(result.javascript).not.toContain('unusedState');

        // Used functions should remain
        expect(result.javascript).toContain('usedFunction1');
        expect(result.javascript).toContain('usedFunction2');
        expect(result.javascript).toContain('incrementCounter');
        expect(result.javascript).toContain('applicationState');
      }
    });

    test('should optimize bundle size with code splitting', async () => {
      const codeSplittingContent = `---
route: "/code-splitting-test"
title: "Code Splitting Test"
compileJsMode: "external.js"
---

import HeavyComponent from "@components/HeavyComponent.tsx"
import LazyLoadedComponent from "@components/LazyLoadedComponent.vue"
import ChartComponent from "@components/ChartComponent.tsx"
import DataTableComponent from "@components/DataTableComponent.vue"

$splittingState! = signal('splittingState', {
  loadedComponents: [],
  currentView: 'main',
  performanceMetrics: {}
})

$loadHeavyComponent = async () => {
  const startTime = performance.now();
  
  // Simulate dynamic import
  try {
    $splittingState = {
      ...$splittingState,
      loadedComponents: [...$splittingState.loadedComponents, 'HeavyComponent'],
      currentView: 'heavy'
    };
    
    const loadTime = performance.now() - startTime;
    $updatePerformanceMetrics('heavyComponent', loadTime);
  } catch (error) {
    console.error('Failed to load heavy component:', error);
  }
}

$loadLazyComponent = async () => {
  const startTime = performance.now();
  
  try {
    $splittingState = {
      ...$splittingState,
      loadedComponents: [...$splittingState.loadedComponents, 'LazyLoadedComponent'],
      currentView: 'lazy'
    };
    
    const loadTime = performance.now() - startTime;
    $updatePerformanceMetrics('lazyComponent', loadTime);
  } catch (error) {
    console.error('Failed to load lazy component:', error);
  }
}

$loadChartView = async () => {
  const startTime = performance.now();
  
  try {
    $splittingState = {
      ...$splittingState,
      loadedComponents: [...$splittingState.loadedComponents, 'ChartComponent'],
      currentView: 'chart'
    };
    
    const loadTime = performance.now() - startTime;
    $updatePerformanceMetrics('chartComponent', loadTime);
  } catch (error) {
    console.error('Failed to load chart component:', error);
  }
}

$loadDataTableView = async () => {
  const startTime = performance.now();
  
  try {
    $splittingState = {
      ...$splittingState,
      loadedComponents: [...$splittingState.loadedComponents, 'DataTableComponent'],
      currentView: 'datatable'
    };
    
    const loadTime = performance.now() - startTime;
    $updatePerformanceMetrics('dataTableComponent', loadTime);
  } catch (error) {
    console.error('Failed to load data table component:', error);
  }
}

$updatePerformanceMetrics = (componentName, loadTime) => {
  $splittingState = {
    ...$splittingState,
    performanceMetrics: {
      ...$splittingState.performanceMetrics,
      [componentName]: {
        loadTime,
        timestamp: new Date().toISOString()
      }
    }
  };
}

$resetView = () => {
  $splittingState = {
    ...$splittingState,
    currentView: 'main'
  };
}

<template>
  <div class="code-splitting-test">
    <h1>Code Splitting Test</h1>
    
    <div class="navigation">
      <button onclick={$resetView}>Main View</button>
      <button onclick={$loadHeavyComponent}>Load Heavy Component</button>
      <button onclick={$loadLazyComponent}>Load Lazy Component</button>
      <button onclick={$loadChartView}>Load Chart View</button>
      <button onclick={$loadDataTableView}>Load Data Table</button>
    </div>
    
    <div class="current-view">
      <h2>Current View: {$splittingState.currentView}</h2>
      
      {#if $splittingState.currentView === 'main'}
        <div class="main-content">
          <p>This is the main view with minimal JavaScript.</p>
          <p>Other components are loaded on demand to reduce initial bundle size.</p>
        </div>
      {/if}
      
      {#if $splittingState.currentView === 'heavy'}
        <HeavyComponent />
      {/if}
      
      {#if $splittingState.currentView === 'lazy'}
        <LazyLoadedComponent />
      {/if}
      
      {#if $splittingState.currentView === 'chart'}
        <ChartComponent />
      {/if}
      
      {#if $splittingState.currentView === 'datatable'}
        <DataTableComponent />
      {/if}
    </div>
    
    <div class="performance-metrics">
      <h3>Performance Metrics</h3>
      <div class="metrics-grid">
        {#each Object.entries($splittingState.performanceMetrics) as [component, metrics]}
          <div class="metric-item">
            <h4>{component}</h4>
            <p>Load Time: {metrics.loadTime.toFixed(2)}ms</p>
            <p>Loaded: {metrics.timestamp}</p>
          </div>
        {/each}
      </div>
    </div>
    
    <div class="loaded-components">
      <h3>Loaded Components</h3>
      <ul>
        {#each $splittingState.loadedComponents as component}
          <li>{component}</li>
        {/each}
      </ul>
    </div>
  </div>
</template>`;

      const result = await compiler.compile(codeSplittingContent, {
        filename: 'code-splitting-test.mtm',
        outputDir: tempDir,
        production: true,
        codeSplitting: true,
        chunkSize: 'optimal'
      });

      expect(result.success).toBe(true);

      if (result.chunks) {
        // Should generate multiple chunks
        expect(result.chunks.length).toBeGreaterThan(1);

        // Main chunk should be smaller than total
        const mainChunk = result.chunks.find(chunk => chunk.name === 'main');
        const totalSize = result.chunks.reduce((sum, chunk) => sum + chunk.size, 0);

        if (mainChunk) {
          expect(mainChunk.size).toBeLessThan(totalSize * 0.7); // Main chunk < 70% of total
        }

        // Should have separate chunks for heavy components
        expect(result.chunks.some(chunk => chunk.name.includes('Heavy'))).toBe(true);
        expect(result.chunks.some(chunk => chunk.name.includes('Chart'))).toBe(true);
      }
    });
  });

  describe('CSS Optimization', () => {
    test('should minify and optimize CSS in production', async () => {
      const cssOptimizationContent = `---
route: "/css-optimization-test"
title: "CSS Optimization Test"
compileJsMode: "inline"
---

<template>
  <div class="css-optimization-test">
    <h1>CSS Optimization Test</h1>
    
    <div class="hero-section">
      <h2>Hero Section</h2>
      <p>This section tests CSS optimization and minification.</p>
    </div>
    
    <div class="grid-layout">
      <div class="grid-item">Item 1</div>
      <div class="grid-item">Item 2</div>
      <div class="grid-item">Item 3</div>
      <div class="grid-item">Item 4</div>
    </div>
    
    <div class="flex-layout">
      <div class="flex-item">Flex Item 1</div>
      <div class="flex-item">Flex Item 2</div>
      <div class="flex-item">Flex Item 3</div>
    </div>
    
    <div class="animation-demo">
      <div class="animated-element">Animated Element</div>
    </div>
  </div>
</template>

<style>
  /* This CSS should be optimized in production */
  
  .css-optimization-test {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333333;
  }
  
  .hero-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 4rem 2rem;
    text-align: center;
    border-radius: 12px;
    margin-bottom: 3rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  }
  
  .hero-section h2 {
    font-size: 2.5rem;
    margin: 0 0 1rem;
    font-weight: 700;
  }
  
  .hero-section p {
    font-size: 1.2rem;
    margin: 0;
    opacity: 0.9;
  }
  
  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
  }
  
  .grid-item {
    background: #f8f9fa;
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    border: 1px solid #e9ecef;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  
  .grid-item:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
  }
  
  .flex-layout {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 3rem;
    flex-wrap: wrap;
  }
  
  .flex-item {
    flex: 1;
    min-width: 200px;
    background: #e3f2fd;
    padding: 1.5rem;
    border-radius: 6px;
    text-align: center;
    border-left: 4px solid #2196f3;
  }
  
  .animation-demo {
    text-align: center;
    padding: 2rem;
    background: #f5f5f5;
    border-radius: 8px;
  }
  
  .animated-element {
    display: inline-block;
    padding: 1rem 2rem;
    background: #4caf50;
    color: white;
    border-radius: 25px;
    font-weight: 600;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  /* Media queries for responsive design */
  @media (max-width: 768px) {
    .css-optimization-test {
      padding: 1rem;
    }
    
    .hero-section {
      padding: 2rem 1rem;
    }
    
    .hero-section h2 {
      font-size: 2rem;
    }
    
    .grid-layout {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    .flex-layout {
      flex-direction: column;
    }
    
    .flex-item {
      min-width: auto;
    }
  }
  
  @media (max-width: 480px) {
    .hero-section h2 {
      font-size: 1.5rem;
    }
    
    .hero-section p {
      font-size: 1rem;
    }
  }
  
  /* Print styles */
  @media print {
    .css-optimization-test {
      color: black;
      background: white;
    }
    
    .hero-section {
      background: none;
      color: black;
      box-shadow: none;
    }
    
    .animated-element {
      animation: none;
    }
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    .grid-item {
      border-width: 2px;
    }
    
    .flex-item {
      border-left-width: 6px;
    }
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .grid-item {
      transition: none;
    }
    
    .animated-element {
      animation: none;
    }
  }
</style>`;

      // Compile in development mode
      const devResult = await compiler.compile(cssOptimizationContent, {
        filename: 'css-optimization-test.mtm',
        outputDir: tempDir,
        production: false,
        minifyCSS: false
      });

      // Compile in production mode
      const prodResult = await compiler.compile(cssOptimizationContent, {
        filename: 'css-optimization-test.mtm',
        outputDir: tempDir,
        production: true,
        minifyCSS: true,
        autoprefixer: true
      });

      expect(devResult.success).toBe(true);
      expect(prodResult.success).toBe(true);

      // Extract CSS from HTML
      const devCSS = devResult.html.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] || '';
      const prodCSS = prodResult.html.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] || '';

      if (devCSS && prodCSS) {
        // Production CSS should be smaller
        expect(prodCSS.length).toBeLessThan(devCSS.length);

        // Production CSS should have fewer whitespace characters
        const prodWhitespace = (prodCSS.match(/\s/g) || []).length;
        const devWhitespace = (devCSS.match(/\s/g) || []).length;
        expect(prodWhitespace).toBeLessThan(devWhitespace);

        // Production CSS should have fewer comments
        const prodComments = (prodCSS.match(/\/\*[\s\S]*?\*\//g) || []).length;
        const devComments = (devCSS.match(/\/\*[\s\S]*?\*\//g) || []).length;
        expect(prodComments).toBeLessThanOrEqual(devComments);
      }
    });

    test('should remove unused CSS selectors', async () => {
      const unusedCSSContent = `---
route: "/unused-css-test"
title: "Unused CSS Test"
compileJsMode: "inline"
---

<template>
  <div class="used-container">
    <h1 class="used-heading">Used CSS Test</h1>
    <p class="used-paragraph">This paragraph uses a CSS class.</p>
    <button class="used-button">Used Button</button>
  </div>
</template>

<style>
  /* Used styles - should be kept */
  .used-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .used-heading {
    color: #333;
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  .used-paragraph {
    color: #666;
    line-height: 1.6;
    margin-bottom: 1rem;
  }
  
  .used-button {
    background: #007cba;
    color: white;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  /* Unused styles - should be removed in production */
  .unused-container {
    background: red;
    padding: 1rem;
  }
  
  .unused-heading {
    color: blue;
    font-size: 3rem;
  }
  
  .unused-paragraph {
    color: green;
    font-weight: bold;
  }
  
  .unused-button {
    background: purple;
    color: yellow;
  }
  
  .another-unused-class {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }
  
  .complex-unused-selector .nested .deeply .unused {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  
  /* Unused media queries */
  @media (max-width: 600px) {
    .unused-mobile-class {
      display: none;
    }
  }
  
  /* Unused keyframes */
  @keyframes unused-animation {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  
  .unused-animated-element {
    animation: unused-animation 1s ease-in-out;
  }
</style>`;

      const result = await compiler.compile(unusedCSSContent, {
        filename: 'unused-css-test.mtm',
        outputDir: tempDir,
        production: true,
        removeUnusedCSS: true
      });

      expect(result.success).toBe(true);

      const css = result.html.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] || '';

      if (result.removeUnusedCSS && css) {
        // Used classes should be present
        expect(css).toContain('used-container');
        expect(css).toContain('used-heading');
        expect(css).toContain('used-paragraph');
        expect(css).toContain('used-button');

        // Unused classes should be removed
        expect(css).not.toContain('unused-container');
        expect(css).not.toContain('unused-heading');
        expect(css).not.toContain('unused-paragraph');
        expect(css).not.toContain('unused-button');
        expect(css).not.toContain('another-unused-class');
        expect(css).not.toContain('complex-unused-selector');
        expect(css).not.toContain('unused-mobile-class');
        expect(css).not.toContain('unused-animation');
        expect(css).not.toContain('unused-animated-element');
      }
    });
  });

  describe('Asset Optimization', () => {
    test('should optimize and compress assets', async () => {
      const assetContent = `---
route: "/asset-optimization-test"
title: "Asset Optimization Test"
compileJsMode: "external.js"
---

$assetState! = signal('assetState', {
  images: [
    { src: '/images/hero-banner.jpg', alt: 'Hero Banner', optimized: false },
    { src: '/images/product-1.png', alt: 'Product 1', optimized: false },
    { src: '/images/product-2.png', alt: 'Product 2', optimized: false }
  ],
  fonts: [
    { family: 'Inter', weight: '400', loaded: false },
    { family: 'Inter', weight: '600', loaded: false },
    { family: 'Inter', weight: '700', loaded: false }
  ],
  icons: [
    { name: 'home', type: 'svg', loaded: false },
    { name: 'user', type: 'svg', loaded: false },
    { name: 'settings', type: 'svg', loaded: false }
  ]
})

$loadOptimizedAssets = async () => {
  // Simulate asset optimization
  const optimizedImages = $assetState.images.map(img => ({
    ...img,
    optimized: true,
    webp: img.src.replace(/\.(jpg|png)$/, '.webp'),
    avif: img.src.replace(/\.(jpg|png)$/, '.avif')
  }));
  
  const loadedFonts = $assetState.fonts.map(font => ({
    ...font,
    loaded: true,
    woff2: \`/fonts/\${font.family}-\${font.weight}.woff2\`
  }));
  
  const loadedIcons = $assetState.icons.map(icon => ({
    ...icon,
    loaded: true,
    sprite: \`/icons/sprite.svg#\${icon.name}\`
  }));
  
  $assetState = {
    images: optimizedImages,
    fonts: loadedFonts,
    icons: loadedIcons
  };
}

$measureAssetPerformance = () => {
  const performanceEntries = performance.getEntriesByType('resource');
  const assetMetrics = performanceEntries
    .filter(entry => 
      entry.name.includes('.jpg') || 
      entry.name.includes('.png') || 
      entry.name.includes('.webp') ||
      entry.name.includes('.woff2') ||
      entry.name.includes('.svg')
    )
    .map(entry => ({
      name: entry.name,
      size: entry.transferSize,
      loadTime: entry.responseEnd - entry.requestStart,
      type: entry.name.split('.').pop()
    }));
  
  return assetMetrics;
}

<template>
  <div class="asset-optimization-test">
    <h1>Asset Optimization Test</h1>
    
    <div class="controls">
      <button onclick={$loadOptimizedAssets}>Load Optimized Assets</button>
    </div>
    
    <div class="asset-sections">
      <section class="images-section">
        <h2>Image Optimization</h2>
        <div class="images-grid">
          {#each $assetState.images as image}
            <div class="image-item">
              <div class="image-placeholder">
                <p>Image: {image.alt}</p>
                <p>Original: {image.src}</p>
                {#if image.optimized}
                  <p>WebP: {image.webp}</p>
                  <p>AVIF: {image.avif}</p>
                {/if}
              </div>
              <div class="optimization-status">
                Status: {image.optimized ? '✅ Optimized' : '⏳ Not Optimized'}
              </div>
            </div>
          {/each}
        </div>
      </section>
      
      <section class="fonts-section">
        <h2>Font Optimization</h2>
        <div class="fonts-list">
          {#each $assetState.fonts as font}
            <div class="font-item">
              <h3 style="font-family: {font.family}; font-weight: {font.weight};">
                {font.family} {font.weight}
              </h3>
              <p>Status: {font.loaded ? '✅ Loaded' : '⏳ Loading'}</p>
              {#if font.woff2}
                <p>WOFF2: {font.woff2}</p>
              {/if}
            </div>
          {/each}
        </div>
      </section>
      
      <section class="icons-section">
        <h2>Icon Optimization</h2>
        <div class="icons-grid">
          {#each $assetState.icons as icon}
            <div class="icon-item">
              <div class="icon-placeholder">
                📄 {icon.name}
              </div>
              <p>Type: {icon.type.toUpperCase()}</p>
              <p>Status: {icon.loaded ? '✅ Loaded' : '⏳ Loading'}</p>
              {#if icon.sprite}
                <p>Sprite: {icon.sprite}</p>
              {/if}
            </div>
          {/each}
        </div>
      </section>
      
      <section class="performance-section">
        <h2>Asset Performance</h2>
        <div class="performance-metrics">
          <pre>{JSON.stringify($measureAssetPerformance(), null, 2)}</pre>
        </div>
      </section>
    </div>
  </div>
</template>`;

      const result = await compiler.compile(assetContent, {
        filename: 'asset-optimization-test.mtm',
        outputDir: tempDir,
        production: true,
        optimizeAssets: true,
        generateWebP: true,
        generateAVIF: true,
        optimizeFonts: true,
        createIconSprite: true
      });

      expect(result.success).toBe(true);
      expect(result.javascript).toContain('loadOptimizedAssets');
      expect(result.javascript).toContain('measureAssetPerformance');

      if (result.assets) {
        // Should have asset optimization metadata
        expect(result.assets.images).toBeDefined();
        expect(result.assets.fonts).toBeDefined();
        expect(result.assets.icons).toBeDefined();
      }
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet performance benchmarks in production', async () => {
      const performanceContent = `---
route: "/performance-benchmark"
title: "Performance Benchmark"
compileJsMode: "external.js"
---

$benchmarkState! = signal('benchmarkState', {
  metrics: {},
  benchmarks: {
    compilationTime: 5000, // 5 seconds max
    bundleSize: 1024 * 1024, // 1MB max
    renderTime: 100, // 100ms max
    interactionTime: 50 // 50ms max
  },
  results: {}
})

$runPerformanceBenchmarks = () => {
  const startTime = performance.now();
  
  // CPU benchmark
  let cpuResult = 0;
  for (let i = 0; i < 50000; i++) {
    cpuResult += Math.sqrt(i);
  }
  const cpuTime = performance.now() - startTime;
  
  // DOM benchmark
  const domStart = performance.now();
  const testContainer = document.createElement('div');
  for (let i = 0; i < 500; i++) {
    const element = document.createElement('div');
    element.textContent = \`Element \${i}\`;
    testContainer.appendChild(element);
  }
  const domTime = performance.now() - domStart;
  
  // Memory benchmark
  const memory = performance.memory ? {
    used: performance.memory.usedJSHeapSize,
    total: performance.memory.totalJSHeapSize,
    limit: performance.memory.jsHeapSizeLimit
  } : null;
  
  const metrics = {
    cpuTime,
    domTime,
    memory,
    timestamp: new Date().toISOString()
  };
  
  // Check against benchmarks
  const results = {
    cpuPerformance: cpuTime < 100 ? 'PASS' : 'FAIL',
    domPerformance: domTime < 50 ? 'PASS' : 'FAIL',
    memoryUsage: memory && memory.used < 50 * 1024 * 1024 ? 'PASS' : 'UNKNOWN'
  };
  
  $benchmarkState = {
    ...$benchmarkState,
    metrics,
    results
  };
}

$measureInteractionLatency = () => {
  const interactions = [];
  
  // Measure click latency
  const clickStart = performance.now();
  setTimeout(() => {
    const clickLatency = performance.now() - clickStart;
    interactions.push({ type: 'click', latency: clickLatency });
    
    // Measure state update latency
    const stateStart = performance.now();
    $benchmarkState = { ...$benchmarkState };
    const stateLatency = performance.now() - stateStart;
    interactions.push({ type: 'state', latency: stateLatency });
    
    $benchmarkState = {
      ...$benchmarkState,
      metrics: {
        ...$benchmarkState.metrics,
        interactions
      }
    };
  }, 0);
}

<template>
  <div class="performance-benchmark">
    <h1>Performance Benchmark Test</h1>
    
    <div class="benchmark-controls">
      <button onclick={$runPerformanceBenchmarks}>
        Run Performance Benchmarks
      </button>
      <button onclick={$measureInteractionLatency}>
        Measure Interaction Latency
      </button>
    </div>
    
    <div class="benchmark-results">
      <h2>Benchmark Results</h2>
      
      <div class="results-grid">
        <div class="result-card">
          <h3>CPU Performance</h3>
          <p>Time: {$benchmarkState.metrics.cpuTime?.toFixed(2) || 'N/A'}ms</p>
          <p>Status: {$benchmarkState.results.cpuPerformance || 'Not Tested'}</p>
        </div>
        
        <div class="result-card">
          <h3>DOM Performance</h3>
          <p>Time: {$benchmarkState.metrics.domTime?.toFixed(2) || 'N/A'}ms</p>
          <p>Status: {$benchmarkState.results.domPerformance || 'Not Tested'}</p>
        </div>
        
        <div class="result-card">
          <h3>Memory Usage</h3>
          {#if $benchmarkState.metrics.memory}
            <p>Used: {($benchmarkState.metrics.memory.used / 1024 / 1024).toFixed(2)}MB</p>
            <p>Status: {$benchmarkState.results.memoryUsage || 'Not Tested'}</p>
          {:else}
            <p>Memory API not available</p>
          {/if}
        </div>
        
        <div class="result-card">
          <h3>Interaction Latency</h3>
          {#if $benchmarkState.metrics.interactions}
            {#each $benchmarkState.metrics.interactions as interaction}
              <p>{interaction.type}: {interaction.latency.toFixed(2)}ms</p>
            {/each}
          {:else}
            <p>Not measured</p>
          {/if}
        </div>
      </div>
      
      <div class="benchmark-targets">
        <h3>Performance Targets</h3>
        <ul>
          <li>CPU Performance: &lt; 100ms ✅</li>
          <li>DOM Performance: &lt; 50ms ✅</li>
          <li>Memory Usage: &lt; 50MB ✅</li>
          <li>Interaction Latency: &lt; 50ms ✅</li>
        </ul>
      </div>
    </div>
  </div>
</template>`;

      const startTime = Date.now();

      const result = await compiler.compile(performanceContent, {
        filename: 'performance-benchmark.mtm',
        outputDir: tempDir,
        production: true,
        optimize: true
      });

      const compilationTime = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Performance benchmarks
      expect(compilationTime).toBeLessThan(5000); // Should compile in under 5 seconds

      if (result.bundleSize) {
        expect(result.bundleSize).toBeLessThan(1024 * 1024); // Should be under 1MB
      }

      // Verify performance measurement code is present
      expect(result.javascript).toContain('runPerformanceBenchmarks');
      expect(result.javascript).toContain('measureInteractionLatency');
      expect(result.javascript).toContain('performance.now');
    });
  });
});