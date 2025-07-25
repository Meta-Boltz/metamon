/**
 * Vanilla JavaScript Chunk Loading Examples
 * 
 * This file demonstrates proper chunk loading patterns in vanilla JavaScript
 * with error handling best practices.
 */

// Simulated chunk loading utilities (would come from @mtm/core)
const safeAssign = (obj, prop, value) => {
  const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

  if (descriptor && descriptor.get && !descriptor.set) {
    try {
      Object.defineProperty(obj, prop, {
        ...descriptor,
        set(newValue) {
          Object.defineProperty(this, '_' + prop, {
            value: newValue,
            writable: true
          });
        }
      });
      obj[prop] = value;
      return obj;
    } catch (e) {
      // Create new object if property redefinition fails
      const newObj = Object.create(Object.getPrototypeOf(obj));
      Object.getOwnPropertyNames(obj).forEach(key => {
        if (key !== prop) {
          Object.defineProperty(newObj, key, Object.getOwnPropertyDescriptor(obj, key));
        }
      });
      newObj[prop] = value;
      return newObj;
    }
  } else {
    obj[prop] = value;
    return obj;
  }
};

// Enhanced chunk loader with error handling
const loadChunkSafely = async (chunkId, importFn) => {
  try {
    const module = await importFn();

    // Apply safe property assignment for chunk metadata
    const processedModule = safeAssign(module, 'chunkData', {
      id: chunkId,
      loaded: true,
      timestamp: Date.now()
    });

    return processedModule;
  } catch (error) {
    console.error(`Failed to load chunk ${chunkId}:`, error);
    throw new Error(`Chunk loading failed: ${error.message}`);
  }
};

// Error boundary utility for vanilla JS
class ErrorBoundary {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      showDetails: false,
      maxRetries: 3,
      onError: null,
      onRetry: null,
      ...options
    };
    this.hasError = false;
    this.error = null;
    this.retryCount = 0;
    this.childRenderer = null;
  }

  render(childRenderer) {
    this.childRenderer = childRenderer;

    if (this.hasError) {
      this.renderError();
    } else {
      this.renderChild();
    }
  }

  renderError() {
    this.container.innerHTML = '';

    const errorDiv = document.createElement('div');
    errorDiv.className = 'chunk-error';

    const title = document.createElement('h3');
    title.textContent = '🚫 Failed to load component';
    errorDiv.appendChild(title);

    const message = document.createElement('p');
    message.textContent = this.error?.message || 'Unknown error occurred';
    errorDiv.appendChild(message);

    const retryBtn = document.createElement('button');
    retryBtn.textContent = `🔄 Retry (${this.retryCount} attempts)`;
    retryBtn.addEventListener('click', () => this.retry());
    errorDiv.appendChild(retryBtn);

    if (this.options.showDetails && this.error?.stack) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Error Details';
      details.appendChild(summary);

      const pre = document.createElement('pre');
      pre.textContent = this.error.stack;
      details.appendChild(pre);

      errorDiv.appendChild(details);
    }

    this.container.appendChild(errorDiv);
  }

  renderChild() {
    try {
      if (this.childRenderer) {
        this.childRenderer(this.container);
      }
    } catch (error) {
      this.catchError(error);
    }
  }

  catchError(error) {
    console.error('Vanilla JS component error:', error);
    this.hasError = true;
    this.error = error;

    if (this.options.onError) {
      this.options.onError(error);
    }

    this.renderError();
  }

  retry() {
    if (this.retryCount >= this.options.maxRetries) {
      console.warn('Maximum retry attempts reached');
      return;
    }

    this.hasError = false;
    this.error = null;
    this.retryCount++;

    if (this.options.onRetry) {
      this.options.onRetry(this.retryCount);
    }

    this.render(this.childRenderer);
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

// Lazy loader utility
class LazyLoader {
  constructor(options = {}) {
    this.options = {
      maxRetries: 3,
      baseDelay: 1000,
      backoffFactor: 2,
      onLoad: null,
      onError: null,
      onRetry: null,
      ...options
    };
    this.loaded = false;
    this.loading = false;
    this.error = null;
    this.module = null;
    this.retryCount = 0;
  }

  async load(chunkId, importFn) {
    if (this.loaded) {
      return this.module;
    }

    if (this.loading) {
      return new Promise((resolve, reject) => {
        const checkLoaded = () => {
          if (this.loaded) {
            resolve(this.module);
          } else if (this.error) {
            reject(this.error);
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }

    this.loading = true;
    this.error = null;

    try {
      this.module = await loadChunkSafely(chunkId, importFn);
      this.loaded = true;

      if (this.options.onLoad) {
        this.options.onLoad(this.module);
      }

      return this.module;
    } catch (error) {
      this.error = error;

      if (this.options.onError) {
        this.options.onError(error);
      }

      throw error;
    } finally {
      this.loading = false;
    }
  }

  async retry(chunkId, importFn) {
    if (this.retryCount >= this.options.maxRetries) {
      throw new Error('Maximum retry attempts reached');
    }

    this.retryCount++;
    this.loaded = false;
    this.error = null;

    if (this.options.onRetry) {
      this.options.onRetry(this.retryCount);
    }

    // Add delay with exponential backoff
    const delay = this.options.baseDelay * Math.pow(this.options.backoffFactor, this.retryCount - 1);
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.load(chunkId, importFn);
  }
}

// Example components
const createBasicComponent = () => {
  return {
    render: (container) => {
      container.innerHTML = `
        <div class="lazy-component">
          <h4>✅ Successfully loaded vanilla JS component!</h4>
          <p>This component was loaded dynamically with safe property assignment.</p>
        </div>
      `;
    },
    destroy: (container) => {
      container.innerHTML = '';
    }
  };
};

const createRetryComponent = () => {
  // Simulate intermittent failures
  if (Math.random() < 0.7) {
    throw new Error('Simulated network error');
  }

  return {
    render: (container) => {
      container.innerHTML = `
        <div class="success-component">
          <h4>🎉 Component loaded after retry!</h4>
          <p>This demonstrates error recovery in chunk loading.</p>
        </div>
      `;
    },
    destroy: (container) => {
      container.innerHTML = '';
    }
  };
};

const createGetterComponent = (module) => {
  return {
    render: (container) => {
      container.innerHTML = `
        <div class="getter-component">
          <h4>🔧 Component with getter-only properties</h4>
          <p>Original data: ${module.data || 'undefined'}</p>
          <p>Chunk data: ${JSON.stringify(module.chunkData)}</p>
          <p>This component had getter-only properties that were safely handled.</p>
        </div>
      `;
    },
    destroy: (container) => {
      container.innerHTML = '';
    }
  };
};

// Manual chunk loader component
class ManualChunkLoader {
  constructor(container) {
    this.container = container;
    this.component = null;
    this.loading = false;
    this.error = null;
    this.render();
  }

  async loadComponent() {
    this.loading = true;
    this.error = null;
    this.render();

    try {
      const module = await loadChunkSafely('manual-vanilla-component', () =>
        Promise.resolve({
          default: {
            render: (container, props = {}) => {
              container.innerHTML = `
                <div class="manual-component">
                  <h4>📦 Manually loaded vanilla JS component</h4>
                  <p>${props.message || 'No message provided'}</p>
                  <p>Chunk data: ${JSON.stringify(props.chunkData)}</p>
                </div>
              `;
            },
            destroy: (container) => {
              container.innerHTML = '';
            }
          }
        })
      );

      this.component = module.default;
      this.component.render(this.container, {
        message: "This vanilla JS component was loaded manually with error handling!",
        chunkData: module.chunkData
      });
    } catch (err) {
      this.error = err;
    } finally {
      this.loading = false;
      if (this.error) {
        this.render();
      }
    }
  }

  render() {
    if (this.component) return; // Component is already rendered

    this.container.innerHTML = '';

    if (this.loading) {
      this.container.innerHTML = '<div>Loading component...</div>';
    } else if (this.error) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error';

      const message = document.createElement('p');
      message.textContent = `Error: ${this.error.message}`;
      errorDiv.appendChild(message);

      const retryBtn = document.createElement('button');
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => this.loadComponent());
      errorDiv.appendChild(retryBtn);

      this.container.appendChild(errorDiv);
    } else {
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Load Component Manually';
      loadBtn.addEventListener('click', () => this.loadComponent());
      this.container.appendChild(loadBtn);
    }
  }

  destroy() {
    if (this.component && this.component.destroy) {
      this.component.destroy(this.container);
    }
  }
}

// Preloading example
class PreloadingExample {
  constructor(container) {
    this.container = container;
    this.preloaded = false;
    this.showComponent = false;
    this.preloadedComponent = null;
    this.loader = new LazyLoader({
      onLoad: (module) => {
        this.preloadedComponent = module.default;
        this.preloaded = true;
        this.render();
      },
      onError: (error) => {
        console.error('Preloading failed:', error);
      }
    });

    this.render();
    this.preloadComponent();
  }

  async preloadComponent() {
    try {
      await this.loader.load('preloaded-vanilla-component', () =>
        Promise.resolve({
          default: {
            render: (container) => {
              container.innerHTML = `
                <div class="preloaded-component">
                  <h4>⚡ Preloaded vanilla JS component</h4>
                  <p>This component was preloaded for instant rendering!</p>
                </div>
              `;
            },
            destroy: (container) => {
              container.innerHTML = '';
            }
          }
        })
      );
    } catch (error) {
      console.error('Preloading failed:', error);
    }
  }

  showPreloadedComponent() {
    this.showComponent = true;
    this.render();
  }

  render() {
    this.container.innerHTML = '';

    const statusP = document.createElement('p');
    statusP.textContent = `Preload status: ${this.preloaded ? '✅ Ready' : '⏳ Loading...'}`;
    this.container.appendChild(statusP);

    const showBtn = document.createElement('button');
    showBtn.textContent = 'Show Preloaded Component';
    showBtn.disabled = !this.preloaded;
    showBtn.addEventListener('click', () => this.showPreloadedComponent());
    this.container.appendChild(showBtn);

    if (this.showComponent && this.preloadedComponent) {
      const componentContainer = document.createElement('div');
      this.container.appendChild(componentContainer);
      this.preloadedComponent.render(componentContainer);
    }
  }

  destroy() {
    if (this.preloadedComponent && this.preloadedComponent.destroy) {
      this.preloadedComponent.destroy(this.container);
    }
  }
}

// Main application
class VanillaChunkLoadingExamples {
  constructor(container) {
    this.container = container;
    this.examples = [];
    this.render();
  }

  async render() {
    this.container.innerHTML = `
      <div class="vanilla-examples">
        <header>
          <h1>Vanilla JavaScript Chunk Loading Examples</h1>
          <p>Demonstrating safe chunk loading patterns with error handling.</p>
        </header>

        <section class="example">
          <h2>Example 1: Basic Lazy Loading</h2>
          <div class="example-1-container"></div>
        </section>

        <section class="example">
          <h2>Example 2: Error Recovery</h2>
          <div class="example-2-container"></div>
        </section>

        <section class="example">
          <h2>Example 3: Getter-Only Properties</h2>
          <div class="example-3-container"></div>
        </section>

        <section class="example">
          <h2>Example 4: Manual Chunk Loading</h2>
          <div class="example-4-container"></div>
        </section>

        <section class="example">
          <h2>Example 5: Preloading Strategy</h2>
          <div class="example-5-container"></div>
        </section>

        <footer>
          <h2>Best Practices Demonstrated</h2>
          <ul>
            <li>✅ Safe property assignment for complex objects</li>
            <li>✅ Comprehensive error boundaries</li>
            <li>✅ Retry mechanisms for failed loads</li>
            <li>✅ Preloading for performance</li>
            <li>✅ Manual chunk loading control</li>
            <li>✅ Detailed error reporting</li>
          </ul>
        </footer>
      </div>
    `;

    await this.initializeExamples();
  }

  async initializeExamples() {
    // Example 1: Basic lazy loading
    const example1Container = this.container.querySelector('.example-1-container');
    const errorBoundary1 = new ErrorBoundary(example1Container, { showDetails: true });

    errorBoundary1.render(async (container) => {
      const module = await loadChunkSafely('basic-vanilla-component', () =>
        Promise.resolve({ default: createBasicComponent() })
      );
      module.default.render(container);
    });

    this.examples.push(errorBoundary1);

    // Example 2: Error recovery with retry
    const example2Container = this.container.querySelector('.example-2-container');
    const errorBoundary2 = new ErrorBoundary(example2Container, {
      showDetails: true,
      onError: (error) => console.error('Example 2 error:', error),
      onRetry: (count) => console.log(`Example 2 retry attempt ${count}`)
    });

    errorBoundary2.render(async (container) => {
      const component = createRetryComponent();
      component.render(container);
    });

    this.examples.push(errorBoundary2);

    // Example 3: Getter-only properties
    const example3Container = this.container.querySelector('.example-3-container');
    const errorBoundary3 = new ErrorBoundary(example3Container, { showDetails: true });

    errorBoundary3.render(async (container) => {
      // Create a module with getter-only properties
      const module = {};
      Object.defineProperty(module, 'data', {
        get() { return this._data || 'initial'; },
        enumerable: true,
        configurable: true
      });

      const processedModule = await loadChunkSafely('getter-vanilla-component', () =>
        Promise.resolve({ ...module, default: createGetterComponent(module) })
      );

      processedModule.default.render(container);
    });

    this.examples.push(errorBoundary3);

    // Example 4: Manual chunk loading
    const example4Container = this.container.querySelector('.example-4-container');
    const example4 = new ManualChunkLoader(example4Container);
    this.examples.push(example4);

    // Example 5: Preloading strategy
    const example5Container = this.container.querySelector('.example-5-container');
    const example5 = new PreloadingExample(example5Container);
    this.examples.push(example5);
  }

  destroy() {
    this.examples.forEach(example => {
      if (example.destroy) {
        example.destroy();
      }
    });
  }
}

// Styles
const styles = `
  .vanilla-examples {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  
  .example {
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;
    background: #f8f9fa;
  }
  
  .chunk-error {
    border: 1px solid #ff6b6b;
    border-radius: 4px;
    padding: 16px;
    background: #fff5f5;
    color: #c92a2a;
  }
  
  .lazy-component, .success-component, .getter-component, 
  .manual-component, .preloaded-component {
    border: 1px solid #51cf66;
    border-radius: 4px;
    padding: 16px;
    background: #f3fff3;
    color: #2b8a3e;
  }
  
  button {
    background: #339af0;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    margin: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background: #228be6;
  }
  
  button:disabled {
    background: #ced4da;
    cursor: not-allowed;
  }
  
  .error {
    color: #c92a2a;
    padding: 12px;
    border: 1px solid #ff6b6b;
    border-radius: 4px;
    background: #fff5f5;
  }
  
  details {
    margin-top: 12px;
  }
  
  pre {
    background: #f1f3f4;
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
  }
`;

// Initialize the vanilla JS example
export function initVanillaChunkLoadingExamples() {
  // Add styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Create container
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Create and initialize vanilla JS app
  const app = new VanillaChunkLoadingExamples(container);

  return app;
}

// Auto-initialize if this is the main module
if (typeof window !== 'undefined' && !window.vanillaChunkExamplesInitialized) {
  window.vanillaChunkExamplesInitialized = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVanillaChunkLoadingExamples);
  } else {
    initVanillaChunkLoadingExamples();
  }
}

export default VanillaChunkLoadingExamples;