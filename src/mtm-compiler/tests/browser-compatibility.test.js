/**
 * Browser Compatibility Integration Tests
 * 
 * Tests the enhanced MTM framework across different browser environments
 * and ensures compatibility with various browser features and limitations.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { EnhancedMTMCompiler } = require('../enhanced-compiler-with-modes.js');

describe('Browser Compatibility Tests', () => {
  let tempDir;
  let compiler;

  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp-browser-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    compiler = new EnhancedMTMCompiler();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Modern Browser Features', () => {
    test('should support ES6+ features in modern browsers', async () => {
      const modernContent = `---
route: "/modern-browser"
title: "Modern Browser Features"
compileJsMode: "external.js"
---

$modernState! = signal('modernState', {
  asyncData: null,
  mapData: new Map(),
  setData: new Set(),
  promiseChain: null
})

$testAsyncAwait = async () => {
  try {
    const data = await new Promise(resolve => {
      setTimeout(() => resolve({ message: 'Async data loaded' }), 100);
    });
    $modernState = { ...$modernState, asyncData: data };
  } catch (error) {
    console.error('Async error:', error);
  }
}

$testMapAndSet = () => {
  const map = new Map();
  map.set('key1', 'value1');
  map.set('key2', 'value2');
  
  const set = new Set();
  set.add('item1');
  set.add('item2');
  set.add('item1'); // Duplicate should be ignored
  
  $modernState = {
    ...$modernState,
    mapData: map,
    setData: set
  };
}

$testPromiseChain = () => {
  Promise.resolve('Start')
    .then(value => value + ' -> Step 1')
    .then(value => value + ' -> Step 2')
    .then(value => {
      $modernState = { ...$modernState, promiseChain: value };
    })
    .catch(error => {
      console.error('Promise chain error:', error);
    });
}

$testArrowFunctions = () => {
  const numbers = [1, 2, 3, 4, 5];
  const doubled = numbers.map(n => n * 2);
  const filtered = doubled.filter(n => n > 4);
  const sum = filtered.reduce((acc, n) => acc + n, 0);
  
  return { doubled, filtered, sum };
}

$testDestructuring = () => {
  const obj = { a: 1, b: 2, c: 3 };
  const { a, b, ...rest } = obj;
  
  const arr = [1, 2, 3, 4, 5];
  const [first, second, ...remaining] = arr;
  
  return { a, b, rest, first, second, remaining };
}

$testTemplateStrings = () => {
  const name = 'MTM Framework';
  const version = '2.0';
  const message = \`Welcome to \${name} version \${version}!\`;
  
  return message;
}

<template>
  <div class="modern-browser-test">
    <h1>Modern Browser Features Test</h1>
    
    <div class="test-controls">
      <button onclick={$testAsyncAwait}>Test Async/Await</button>
      <button onclick={$testMapAndSet}>Test Map/Set</button>
      <button onclick={$testPromiseChain}>Test Promise Chain</button>
    </div>
    
    <div class="test-results">
      <h3>Test Results</h3>
      
      <div class="result-section">
        <h4>Async Data</h4>
        <pre>{JSON.stringify($modernState.asyncData, null, 2)}</pre>
      </div>
      
      <div class="result-section">
        <h4>Map Data</h4>
        <p>Map size: {$modernState.mapData.size}</p>
        <p>Has key1: {$modernState.mapData.has('key1') ? 'Yes' : 'No'}</p>
      </div>
      
      <div class="result-section">
        <h4>Set Data</h4>
        <p>Set size: {$modernState.setData.size}</p>
        <p>Has item1: {$modernState.setData.has('item1') ? 'Yes' : 'No'}</p>
      </div>
      
      <div class="result-section">
        <h4>Promise Chain</h4>
        <p>{$modernState.promiseChain || 'Not executed yet'}</p>
      </div>
      
      <div class="result-section">
        <h4>Arrow Functions</h4>
        <pre>{JSON.stringify($testArrowFunctions(), null, 2)}</pre>
      </div>
      
      <div class="result-section">
        <h4>Destructuring</h4>
        <pre>{JSON.stringify($testDestructuring(), null, 2)}</pre>
      </div>
      
      <div class="result-section">
        <h4>Template Strings</h4>
        <p>{$testTemplateStrings()}</p>
      </div>
    </div>
  </div>
</template>`;

      const result = await compiler.compile(modernContent, {
        filename: 'modern-browser.mtm',
        outputDir: tempDir,
        browserTarget: 'es2020'
      });

      expect(result.success).toBe(true);
      expect(result.javascript).toContain('async');
      expect(result.javascript).toContain('await');
      expect(result.javascript).toContain('Map');
      expect(result.javascript).toContain('Set');
      expect(result.javascript).toContain('=>');
      expect(result.javascript).toContain('Promise');
    });

    test('should transpile for older browsers when needed', async () => {
      const transpileContent = `---
route: "/transpile-test"
title: "Transpilation Test"
compileJsMode: "external.js"
---

$transpileState! = signal('transpileState', {
  result: null
})

$testModernFeatures = async () => {
  // Use modern features that need transpilation
  const data = await fetch('/api/data').then(response => response.json());
  
  const processedData = data.items
    .filter(item => item.active)
    .map(item => ({ ...item, processed: true }))
    .reduce((acc, item) => ({ ...acc, [item.id]: item }), {});
  
  $transpileState = { result: processedData };
}

$testClassSyntax = () => {
  class TestClass {
    constructor(name) {
      this.name = name;
    }
    
    getName() {
      return this.name;
    }
    
    static create(name) {
      return new TestClass(name);
    }
  }
  
  const instance = TestClass.create('MTM Framework');
  return instance.getName();
}

<template>
  <div class="transpile-test">
    <h1>Transpilation Test</h1>
    <button onclick={$testModernFeatures}>Test Modern Features</button>
    <p>Class test: {$testClassSyntax()}</p>
    <pre>{JSON.stringify($transpileState.result, null, 2)}</pre>
  </div>
</template>`;

      const result = await compiler.compile(transpileContent, {
        filename: 'transpile-test.mtm',
        outputDir: tempDir,
        browserTarget: 'es5' // Target older browsers
      });

      expect(result.success).toBe(true);

      // When targeting ES5, modern features should be transpiled
      if (result.browserTarget === 'es5') {
        // Should not contain arrow functions in ES5 mode
        expect(result.javascript).not.toContain('=>');
        // Should contain function declarations instead
        expect(result.javascript).toContain('function');
      }
    });
  });

  describe('Cross-Browser DOM Compatibility', () => {
    test('should handle DOM manipulation across browsers', async () => {
      const domContent = `---
route: "/dom-compat"
title: "DOM Compatibility"
compileJsMode: "inline"
---

$domState! = signal('domState', {
  elementCount: 0,
  eventsFired: 0,
  supportedFeatures: {}
})

$testDOMFeatures = () => {
  // Test basic DOM manipulation
  const testDiv = document.createElement('div');
  testDiv.className = 'test-element';
  testDiv.textContent = 'Test Element';
  
  // Test event handling
  testDiv.addEventListener('click', () => {
    $domState = {
      ...$domState,
      eventsFired: $domState.eventsFired + 1
    };
  });
  
  // Test feature detection
  const features = {
    querySelector: typeof document.querySelector === 'function',
    addEventListener: typeof testDiv.addEventListener === 'function',
    classList: typeof testDiv.classList === 'object',
    dataset: typeof testDiv.dataset === 'object',
    customElements: typeof window.customElements === 'object'
  };
  
  $domState = {
    ...$domState,
    elementCount: $domState.elementCount + 1,
    supportedFeatures: features
  };
}

$testEventDelegation = () => {
  // Test event delegation pattern
  document.addEventListener('click', (event) => {
    if (event.target.matches('.delegated-button')) {
      $domState = {
        ...$domState,
        eventsFired: $domState.eventsFired + 1
      };
    }
  });
}

$testCSSFeatures = () => {
  const testElement = document.createElement('div');
  const style = testElement.style;
  
  const cssFeatures = {
    flexbox: 'flex' in style,
    grid: 'grid' in style,
    customProperties: CSS && CSS.supports && CSS.supports('--test', 'value'),
    transforms: 'transform' in style,
    transitions: 'transition' in style
  };
  
  return cssFeatures;
}

<template>
  <div class="dom-compat-test">
    <h1>DOM Compatibility Test</h1>
    
    <div class="test-controls">
      <button onclick={$testDOMFeatures}>Test DOM Features</button>
      <button onclick={$testEventDelegation}>Setup Event Delegation</button>
      <button class="delegated-button">Delegated Button</button>
    </div>
    
    <div class="test-results">
      <h3>DOM Test Results</h3>
      
      <div class="result-item">
        <h4>Element Count</h4>
        <p>{$domState.elementCount}</p>
      </div>
      
      <div class="result-item">
        <h4>Events Fired</h4>
        <p>{$domState.eventsFired}</p>
      </div>
      
      <div class="result-item">
        <h4>Supported Features</h4>
        <ul>
          {#each Object.entries($domState.supportedFeatures) as [feature, supported]}
            <li>{feature}: {supported ? '✅' : '❌'}</li>
          {/each}
        </ul>
      </div>
      
      <div class="result-item">
        <h4>CSS Features</h4>
        <pre>{JSON.stringify($testCSSFeatures(), null, 2)}</pre>
      </div>
    </div>
  </div>
</template>`;

      const result = await compiler.compile(domContent, {
        filename: 'dom-compat.mtm',
        outputDir: tempDir
      });

      expect(result.success).toBe(true);
      expect(result.javascript).toContain('testDOMFeatures');
      expect(result.javascript).toContain('addEventListener');
      expect(result.javascript).toContain('querySelector');
      expect(result.html).toContain('dom-compat-test');
    });

    test('should handle touch and mobile events', async () => {
      const mobileContent = `---
route: "/mobile-compat"
title: "Mobile Compatibility"
compileJsMode: "inline"
---

$mobileState! = signal('mobileState', {
  touchSupported: false,
  touchEvents: 0,
  gestureData: null,
  orientation: 'unknown'
})

$detectTouchSupport = () => {
  const touchSupported = 'ontouchstart' in window || 
                        navigator.maxTouchPoints > 0 || 
                        navigator.msMaxTouchPoints > 0;
  
  $mobileState = { ...$mobileState, touchSupported };
}

$handleTouchStart = (event) => {
  $mobileState = {
    ...$mobileState,
    touchEvents: $mobileState.touchEvents + 1,
    gestureData: {
      touches: event.touches ? event.touches.length : 0,
      timestamp: Date.now()
    }
  };
}

$handleOrientationChange = () => {
  const orientation = window.orientation !== undefined ? 
    (Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait') :
    (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  
  $mobileState = { ...$mobileState, orientation };
}

$testViewportFeatures = () => {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    userAgent: navigator.userAgent,
    platform: navigator.platform
  };
  
  return viewport;
}

// Initialize mobile detection
$detectTouchSupport();
$handleOrientationChange();

// Listen for orientation changes
window.addEventListener('orientationchange', $handleOrientationChange);
window.addEventListener('resize', $handleOrientationChange);

<template>
  <div class="mobile-compat-test">
    <h1>Mobile Compatibility Test</h1>
    
    <div 
      class="touch-area"
      ontouchstart={$handleTouchStart}
      onmousedown={$handleTouchStart}
    >
      <p>Touch/Click this area to test events</p>
    </div>
    
    <div class="mobile-results">
      <h3>Mobile Test Results</h3>
      
      <div class="result-item">
        <h4>Touch Support</h4>
        <p>{$mobileState.touchSupported ? '✅ Supported' : '❌ Not Supported'}</p>
      </div>
      
      <div class="result-item">
        <h4>Touch Events</h4>
        <p>{$mobileState.touchEvents}</p>
      </div>
      
      <div class="result-item">
        <h4>Orientation</h4>
        <p>{$mobileState.orientation}</p>
      </div>
      
      <div class="result-item">
        <h4>Gesture Data</h4>
        <pre>{JSON.stringify($mobileState.gestureData, null, 2)}</pre>
      </div>
      
      <div class="result-item">
        <h4>Viewport Info</h4>
        <pre>{JSON.stringify($testViewportFeatures(), null, 2)}</pre>
      </div>
    </div>
  </div>
</template>

<style>
  .mobile-compat-test {
    padding: 1rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .touch-area {
    background: #e3f2fd;
    border: 2px dashed #2196f3;
    padding: 2rem;
    text-align: center;
    margin: 1rem 0;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  .touch-area:active {
    background: #bbdefb;
  }

  .mobile-results {
    margin-top: 2rem;
  }

  .result-item {
    margin-bottom: 1rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 4px;
  }

  .result-item h4 {
    margin: 0 0 0.5rem;
    color: #333;
  }

  .result-item pre {
    background: white;
    padding: 0.5rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .mobile-compat-test {
      padding: 0.5rem;
    }
    
    .touch-area {
      padding: 1.5rem;
    }
  }

  @media (orientation: landscape) {
    .mobile-compat-test {
      display: flex;
      flex-direction: column;
    }
  }
</style>`;

      const result = await compiler.compile(mobileContent, {
        filename: 'mobile-compat.mtm',
        outputDir: tempDir
      });

      expect(result.success).toBe(true);
      expect(result.javascript).toContain('touchSupported');
      expect(result.javascript).toContain('ontouchstart');
      expect(result.javascript).toContain('orientationchange');
      expect(result.html).toContain('touch-area');
      expect(result.html).toContain('@media');
    });
  });

  describe('Performance Across Browsers', () => {
    test('should optimize for different browser performance characteristics', async () => {
      const perfContent = `---
route: "/performance"
title: "Performance Test"
compileJsMode: "external.js"
---

$perfState! = signal('perfState', {
  measurements: {},
  browserInfo: {},
  optimizations: {}
})

$measurePerformance = () => {
  const start = performance.now();
  
  // CPU-intensive task
  let result = 0;
  for (let i = 0; i < 100000; i++) {
    result += Math.sqrt(i);
  }
  
  const cpuTime = performance.now() - start;
  
  // Memory usage (if available)
  const memory = performance.memory ? {
    used: performance.memory.usedJSHeapSize,
    total: performance.memory.totalJSHeapSize,
    limit: performance.memory.jsHeapSizeLimit
  } : null;
  
  // DOM manipulation performance
  const domStart = performance.now();
  const testDiv = document.createElement('div');
  for (let i = 0; i < 1000; i++) {
    const child = document.createElement('span');
    child.textContent = \`Item \${i}\`;
    testDiv.appendChild(child);
  }
  const domTime = performance.now() - domStart;
  
  $perfState = {
    ...$perfState,
    measurements: {
      cpuTime,
      domTime,
      memory,
      result
    }
  };
}

$detectBrowserCapabilities = () => {
  const capabilities = {
    webGL: !!window.WebGLRenderingContext,
    webGL2: !!window.WebGL2RenderingContext,
    webWorkers: typeof Worker !== 'undefined',
    serviceWorkers: 'serviceWorker' in navigator,
    indexedDB: 'indexedDB' in window,
    localStorage: 'localStorage' in window,
    sessionStorage: 'sessionStorage' in window,
    fetch: 'fetch' in window,
    promises: 'Promise' in window,
    asyncAwait: (async () => {}).constructor === (async function(){}).constructor
  };
  
  $perfState = {
    ...$perfState,
    browserInfo: {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      capabilities
    }
  };
}

$testOptimizations = () => {
  // Test various optimization techniques
  const optimizations = {};
  
  // Test requestAnimationFrame
  const rafStart = performance.now();
  requestAnimationFrame(() => {
    optimizations.rafLatency = performance.now() - rafStart;
  });
  
  // Test setTimeout precision
  const timeoutStart = performance.now();
  setTimeout(() => {
    optimizations.timeoutPrecision = performance.now() - timeoutStart;
  }, 0);
  
  // Test event loop performance
  const eventLoopStart = performance.now();
  Promise.resolve().then(() => {
    optimizations.eventLoopLatency = performance.now() - eventLoopStart;
  });
  
  $perfState = {
    ...$perfState,
    optimizations
  };
}

// Initialize browser detection
$detectBrowserCapabilities();

<template>
  <div class="performance-test">
    <h1>Browser Performance Test</h1>
    
    <div class="test-controls">
      <button onclick={$measurePerformance}>Measure Performance</button>
      <button onclick={$testOptimizations}>Test Optimizations</button>
    </div>
    
    <div class="performance-results">
      <h3>Performance Results</h3>
      
      <div class="result-section">
        <h4>Performance Measurements</h4>
        <div class="measurements">
          {#if $perfState.measurements.cpuTime}
            <p>CPU Time: {$perfState.measurements.cpuTime.toFixed(2)}ms</p>
          {/if}
          {#if $perfState.measurements.domTime}
            <p>DOM Time: {$perfState.measurements.domTime.toFixed(2)}ms</p>
          {/if}
          {#if $perfState.measurements.memory}
            <div class="memory-info">
              <h5>Memory Usage</h5>
              <p>Used: {($perfState.measurements.memory.used / 1024 / 1024).toFixed(2)} MB</p>
              <p>Total: {($perfState.measurements.memory.total / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          {/if}
        </div>
      </div>
      
      <div class="result-section">
        <h4>Browser Capabilities</h4>
        <div class="capabilities-grid">
          {#each Object.entries($perfState.browserInfo.capabilities || {}) as [feature, supported]}
            <div class="capability-item">
              <span class="feature-name">{feature}</span>
              <span class="support-status">{supported ? '✅' : '❌'}</span>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="result-section">
        <h4>Browser Information</h4>
        <div class="browser-info">
          <p><strong>Platform:</strong> {$perfState.browserInfo.platform}</p>
          <p><strong>Vendor:</strong> {$perfState.browserInfo.vendor}</p>
          <p><strong>Online:</strong> {$perfState.browserInfo.onLine ? 'Yes' : 'No'}</p>
          <p><strong>Cookies:</strong> {$perfState.browserInfo.cookieEnabled ? 'Enabled' : 'Disabled'}</p>
        </div>
      </div>
      
      <div class="result-section">
        <h4>Optimization Tests</h4>
        <div class="optimizations">
          {#each Object.entries($perfState.optimizations) as [test, result]}
            <p><strong>{test}:</strong> {typeof result === 'number' ? result.toFixed(2) + 'ms' : result}</p>
          {/each}
        </div>
      </div>
    </div>
  </div>
</template>`;

      const result = await compiler.compile(perfContent, {
        filename: 'performance.mtm',
        outputDir: tempDir,
        optimize: true
      });

      expect(result.success).toBe(true);
      expect(result.javascript).toContain('measurePerformance');
      expect(result.javascript).toContain('performance.now');
      expect(result.javascript).toContain('detectBrowserCapabilities');
      expect(result.javascript).toContain('requestAnimationFrame');
    });
  });

  describe('Accessibility Across Browsers', () => {
    test('should maintain accessibility features across browsers', async () => {
      const a11yContent = `---
route: "/a11y-compat"
title: "Accessibility Compatibility"
compileJsMode: "inline"
---

$a11yState! = signal('a11yState', {
  screenReaderActive: false,
  focusedElement: null,
  announcements: [],
  keyboardNavigation: false
})

$detectScreenReader = () => {
  // Detect screen reader presence (heuristic)
  const screenReaderActive = 
    navigator.userAgent.includes('NVDA') ||
    navigator.userAgent.includes('JAWS') ||
    navigator.userAgent.includes('VoiceOver') ||
    window.speechSynthesis !== undefined;
  
  $a11yState = { ...$a11yState, screenReaderActive };
}

$handleFocus = (elementId) => {
  $a11yState = { ...$a11yState, focusedElement: elementId };
}

$announceToScreenReader = (message) => {
  const announcement = {
    id: Date.now(),
    message,
    timestamp: new Date().toISOString()
  };
  
  $a11yState = {
    ...$a11yState,
    announcements: [...$a11yState.announcements, announcement]
  };
  
  // Clean up old announcements
  setTimeout(() => {
    $a11yState = {
      ...$a11yState,
      announcements: $a11yState.announcements.filter(a => a.id !== announcement.id)
    };
  }, 5000);
}

$handleKeyboardNavigation = (event) => {
  if (event.key === 'Tab') {
    $a11yState = { ...$a11yState, keyboardNavigation: true };
  }
  
  if (event.key === 'Enter' || event.key === ' ') {
    if (event.target.tagName === 'BUTTON') {
      $announceToScreenReader(\`Button \${event.target.textContent} activated\`);
    }
  }
}

$testColorContrast = () => {
  // Test color contrast ratios
  const testElement = document.createElement('div');
  testElement.style.backgroundColor = '#ffffff';
  testElement.style.color = '#000000';
  
  // This would normally use a color contrast library
  // For testing purposes, we'll simulate the check
  return {
    background: '#ffffff',
    foreground: '#000000',
    ratio: 21, // White on black has perfect contrast
    wcagAA: true,
    wcagAAA: true
  };
}

// Initialize accessibility detection
$detectScreenReader();

// Set up keyboard event listeners
document.addEventListener('keydown', $handleKeyboardNavigation);

<template>
  <div class="a11y-compat-test">
    <h1>Accessibility Compatibility Test</h1>
    
    <div class="skip-links">
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
    </div>
    
    <nav id="navigation" aria-label="Test navigation">
      <ul>
        <li><a href="#section1" onfocus={() => $handleFocus('nav-section1')}>Section 1</a></li>
        <li><a href="#section2" onfocus={() => $handleFocus('nav-section2')}>Section 2</a></li>
        <li><a href="#section3" onfocus={() => $handleFocus('nav-section3')}>Section 3</a></li>
      </ul>
    </nav>
    
    <main id="main-content">
      <section id="section1" aria-labelledby="section1-heading">
        <h2 id="section1-heading">Interactive Elements</h2>
        
        <div class="form-group">
          <label for="test-input">Test Input (required)</label>
          <input 
            type="text" 
            id="test-input" 
            name="test-input" 
            required 
            aria-describedby="input-help"
            onfocus={() => $handleFocus('test-input')}
          />
          <div id="input-help" class="help-text">
            This input tests keyboard navigation and screen reader compatibility
          </div>
        </div>
        
        <div class="button-group">
          <button 
            type="button"
            onclick={() => $announceToScreenReader('Primary action executed')}
            onfocus={() => $handleFocus('primary-button')}
          >
            Primary Action
          </button>
          
          <button 
            type="button"
            onclick={() => $announceToScreenReader('Secondary action executed')}
            onfocus={() => $handleFocus('secondary-button')}
            aria-describedby="secondary-help"
          >
            Secondary Action
          </button>
          <div id="secondary-help" class="help-text">
            This button has additional help text
          </div>
        </div>
      </section>
      
      <section id="section2" aria-labelledby="section2-heading">
        <h2 id="section2-heading">Accessibility Status</h2>
        
        <div class="status-grid">
          <div class="status-item">
            <h3>Screen Reader</h3>
            <p>{$a11yState.screenReaderActive ? '✅ Detected' : '❌ Not Detected'}</p>
          </div>
          
          <div class="status-item">
            <h3>Focused Element</h3>
            <p>{$a11yState.focusedElement || 'None'}</p>
          </div>
          
          <div class="status-item">
            <h3>Keyboard Navigation</h3>
            <p>{$a11yState.keyboardNavigation ? '✅ Active' : '❌ Not Used'}</p>
          </div>
          
          <div class="status-item">
            <h3>Color Contrast</h3>
            <div class="contrast-test">
              {#each Object.entries($testColorContrast()) as [key, value]}
                <p><strong>{key}:</strong> {value}</p>
              {/each}
            </div>
          </div>
        </div>
      </section>
      
      <section id="section3" aria-labelledby="section3-heading">
        <h2 id="section3-heading">Live Announcements</h2>
        
        <div class="announcement-controls">
          <button onclick={() => $announceToScreenReader('Test announcement for screen readers')}>
            Make Test Announcement
          </button>
        </div>
        
        <div class="announcements-list">
          <h3>Recent Announcements</h3>
          {#if $a11yState.announcements.length === 0}
            <p>No announcements yet</p>
          {:else}
            <ul>
              {#each $a11yState.announcements as announcement}
                <li key={announcement.id}>
                  <strong>{announcement.timestamp}:</strong> {announcement.message}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>
    </main>
    
    <!-- Screen reader announcements -->
    <div aria-live="polite" aria-atomic="true" class="sr-only">
      {#each $a11yState.announcements as announcement}
        {announcement.message}
      {/each}
    </div>
    
    <div aria-live="assertive" aria-atomic="true" class="sr-only">
      <!-- For urgent announcements -->
    </div>
  </div>
</template>

<style>
  .a11y-compat-test {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .skip-links {
    position: absolute;
    top: -40px;
    left: 6px;
    z-index: 1000;
  }

  .skip-link {
    position: absolute;
    left: -10000px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  .skip-link:focus {
    position: static;
    width: auto;
    height: auto;
    background: #000;
    color: #fff;
    padding: 8px 16px;
    text-decoration: none;
    border-radius: 4px;
  }

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

  nav ul {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 1rem;
  }

  nav a {
    padding: 0.5rem 1rem;
    background: #f0f0f0;
    text-decoration: none;
    border-radius: 4px;
    color: #333;
  }

  nav a:hover,
  nav a:focus {
    background: #e0e0e0;
    outline: 2px solid #007cba;
    outline-offset: 2px;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
    color: #333;
  }

  input {
    width: 100%;
    max-width: 300px;
    padding: 0.75rem;
    border: 2px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus {
    outline: none;
    border-color: #007cba;
    box-shadow: 0 0 0 2px rgba(0, 124, 186, 0.2);
  }

  .help-text {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #666;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 2rem;
  }

  button {
    padding: 0.75rem 1.5rem;
    border: 2px solid #007cba;
    background: #007cba;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
  }

  button:hover {
    background: #005a87;
    border-color: #005a87;
  }

  button:focus {
    outline: 2px solid #007cba;
    outline-offset: 2px;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }

  .status-item {
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #007cba;
  }

  .status-item h3 {
    margin: 0 0 0.5rem;
    color: #333;
  }

  .contrast-test p {
    margin: 0.25rem 0;
    font-size: 0.875rem;
  }

  .announcement-controls {
    margin-bottom: 1rem;
  }

  .announcements-list ul {
    list-style: none;
    padding: 0;
  }

  .announcements-list li {
    padding: 0.5rem;
    background: #f0f8ff;
    margin-bottom: 0.5rem;
    border-radius: 4px;
    border-left: 3px solid #007cba;
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  @media (prefers-high-contrast: high) {
    button {
      border-width: 3px;
    }
    
    input:focus {
      border-width: 3px;
    }
  }
</style>`;

      const result = await compiler.compile(a11yContent, {
        filename: 'a11y-compat.mtm',
        outputDir: tempDir
      });

      expect(result.success).toBe(true);
      expect(result.html).toContain('aria-label');
      expect(result.html).toContain('aria-labelledby');
      expect(result.html).toContain('aria-describedby');
      expect(result.html).toContain('aria-live');
      expect(result.html).toContain('skip-link');
      expect(result.html).toContain('sr-only');
      expect(result.javascript).toContain('detectScreenReader');
      expect(result.javascript).toContain('handleKeyboardNavigation');
    });
  });
});