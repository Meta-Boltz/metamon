/**
 * Svelte Chunk Loading Examples
 * 
 * This file demonstrates proper chunk loading patterns in Svelte applications
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

// Svelte component factory for error boundaries
function createErrorBoundary(options = {}) {
  const { showDetails = false } = options;

  return class ErrorBoundary {
    constructor(target, props) {
      this.target = target;
      this.hasError = false;
      this.error = null;
      this.retryCount = 0;
      this.childComponent = null;

      this.render();
    }

    render() {
      this.target.innerHTML = '';

      if (this.hasError) {
        this.renderError();
      } else {
        this.renderChild();
      }
    }

    renderError() {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'chunk-error';
      errorDiv.innerHTML = `
        <h3>🚫 Failed to load component</h3>
        <p>${this.error?.message || 'Unknown error occurred'}</p>
        <button class="retry-btn">🔄 Retry (${this.retryCount} attempts)</button>
        ${showDetails ? `
          <details>
            <summary>Error Details</summary>
            <pre>${this.error?.stack || 'No stack trace available'}</pre>
          </details>
        ` : ''}
      `;

      const retryBtn = errorDiv.querySelector('.retry-btn');
      retryBtn.addEventListener('click', () => this.retry());

      this.target.appendChild(errorDiv);
    }

    renderChild() {
      try {
        if (this.props.component) {
          this.childComponent = new this.props.component({
            target: this.target,
            props: this.props.componentProps || {}
          });
        }
      } catch (error) {
        this.catchError(error);
      }
    }

    catchError(error) {
      console.error('Svelte component error:', error);
      this.hasError = true;
      this.error = error;
      this.render();
    }

    retry() {
      this.hasError = false;
      this.error = null;
      this.retryCount++;
      this.render();
    }

    destroy() {
      if (this.childComponent) {
        this.childComponent.$destroy();
      }
    }
  };
}

// Example 1: Basic lazy loading component
async function createBasicLazyComponent() {
  const module = await loadChunkSafely('basic-svelte-component', () =>
    Promise.resolve({
      default: class BasicComponent {
        constructor(options) {
          this.target = options.target;
          this.render();
        }

        render() {
          this.target.innerHTML = `
            <div class="lazy-component">
              <h4>✅ Successfully loaded Svelte component!</h4>
              <p>This component was loaded dynamically with safe property assignment.</p>
              <p>Chunk data: ${JSON.stringify(module.chunkData)}</p>
            </div>
          `;
        }

        $destroy() {
          this.target.innerHTML = '';
        }
      }
    })
  );

  return module.default;
}

// Example 2: Component with retry logic
async function createRetryComponent() {
  // Simulate intermittent failures
  if (Math.random() < 0.7) {
    throw new Error('Simulated network error');
  }

  const module = await loadChunkSafely('retry-svelte-component', () =>
    Promise.resolve({
      default: class RetryComponent {
        constructor(options) {
          this.target = options.target;
          this.render();
        }

        render() {
          this.target.innerHTML = `
            <div class="success-component">
              <h4>🎉 Svelte component loaded after retry!</h4>
              <p>This demonstrates error recovery in chunk loading.</p>
            </div>
          `;
        }

        $destroy() {
          this.target.innerHTML = '';
        }
      }
    })
  );

  return module.default;
}

// Example 3: Component with getter-only properties
async function createGetterComponent() {
  const module = {};
  Object.defineProperty(module, 'data', {
    get() { return this._data || 'initial'; },
    enumerable: true,
    configurable: true
  });

  const processedModule = await loadChunkSafely('getter-svelte-component', () => {
    module.default = class GetterComponent {
      constructor(options) {
        this.target = options.target;
        this.originalData = module.data;
        this.chunkData = module.chunkData;
        this.render();
      }

      render() {
        this.target.innerHTML = `
          <div class="getter-component">
            <h4>🔧 Svelte component with getter-only properties</h4>
            <p>Original data: ${this.originalData}</p>
            <p>Chunk data: ${JSON.stringify(this.chunkData)}</p>
            <p>This component had getter-only properties that were safely handled.</p>
          </div>
        `;
      }

      $destroy() {
        this.target.innerHTML = '';
      }
    };

    return Promise.resolve(module);
  });

  return processedModule.default;
}

// Example 4: Manual chunk loading manager
class ManualChunkLoader {
  constructor(target) {
    this.target = target;
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
      const module = await loadChunkSafely('manual-svelte-component', () =>
        Promise.resolve({
          default: class ManualComponent {
            constructor(options) {
              this.target = options.target;
              this.props = options.props || {};
              this.render();
            }

            render() {
              this.target.innerHTML = `
                <div class="manual-component">
                  <h4>📦 Manually loaded Svelte component</h4>
                  <p>${this.props.message || 'No message provided'}</p>
                  <p>Chunk data: ${JSON.stringify(this.props.chunkData)}</p>
                </div>
              `;
            }

            $destroy() {
              this.target.innerHTML = '';
            }
          }
        })
      );

      this.component = new module.default({
        target: this.target,
        props: {
          message: "This Svelte component was loaded manually with error handling!",
          chunkData: module.chunkData
        }
      });
    } catch (err) {
      this.error = err;
    } finally {
      this.loading = false;
      this.render();
    }
  }

  render() {
    if (this.component) return; // Component is already rendered

    this.target.innerHTML = '';

    if (this.loading) {
      this.target.innerHTML = '<div>Loading component...</div>';
    } else if (this.error) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error';
      errorDiv.innerHTML = `
        <p>Error: ${this.error.message}</p>
        <button class="retry-btn">Retry</button>
      `;

      const retryBtn = errorDiv.querySelector('.retry-btn');
      retryBtn.addEventListener('click', () => this.loadComponent());

      this.target.appendChild(errorDiv);
    } else {
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Load Component Manually';
      loadBtn.addEventListener('click', () => this.loadComponent());
      this.target.appendChild(loadBtn);
    }
  }

  $destroy() {
    if (this.component) {
      this.component.$destroy();
    }
  }
}

// Example 5: Preloading strategy
class PreloadingExample {
  constructor(target) {
    this.target = target;
    this.preloaded = false;
    this.showComponent = false;
    this.preloadedComponent = null;
    this.componentInstance = null;

    this.render();
    this.preloadComponent();
  }

  async preloadComponent() {
    try {
      const module = await loadChunkSafely('preloaded-svelte-component', () =>
        Promise.resolve({
          default: class PreloadedComponent {
            constructor(options) {
              this.target = options.target;
              this.render();
            }

            render() {
              this.target.innerHTML = `
                <div class="preloaded-component">
                  <h4>⚡ Preloaded Svelte component</h4>
                  <p>This component was preloaded for instant rendering!</p>
                </div>
              `;
            }

            $destroy() {
              this.target.innerHTML = '';
            }
          }
        })
      );

      this.preloadedComponent = module.default;
      this.preloaded = true;
      this.render();
    } catch (error) {
      console.error('Preloading failed:', error);
    }
  }

  showPreloadedComponent() {
    this.showComponent = true;
    this.render();
  }

  render() {
    if (this.componentInstance) {
      this.componentInstance.$destroy();
      this.componentInstance = null;
    }

    this.target.innerHTML = '';

    const container = document.createElement('div');
    container.innerHTML = `
      <p>Preload status: ${this.preloaded ? '✅ Ready' : '⏳ Loading...'}</p>
      <button class="show-btn" ${!this.preloaded ? 'disabled' : ''}>
        Show Preloaded Component
      </button>
    `;

    const showBtn = container.querySelector('.show-btn');
    showBtn.addEventListener('click', () => this.showPreloadedComponent());

    this.target.appendChild(container);

    if (this.showComponent && this.preloadedComponent) {
      const componentContainer = document.createElement('div');
      this.target.appendChild(componentContainer);

      this.componentInstance = new this.preloadedComponent({
        target: componentContainer
      });
    }
  }

  $destroy() {
    if (this.componentInstance) {
      this.componentInstance.$destroy();
    }
  }
}

// Main application
class SvelteChunkLoadingExamples {
  constructor(target) {
    this.target = target;
    this.examples = [];
    this.render();
  }

  async render() {
    this.target.innerHTML = `
      <div class="svelte-examples">
        <header>
          <h1>Svelte Chunk Loading Examples</h1>
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

    // Initialize examples
    await this.initializeExamples();
  }

  async initializeExamples() {
    const ErrorBoundary = createErrorBoundary({ showDetails: true });

    // Example 1: Basic lazy loading
    try {
      const BasicComponent = await createBasicLazyComponent();
      const example1 = new BasicComponent({
        target: this.target.querySelector('.example-1-container')
      });
      this.examples.push(example1);
    } catch (error) {
      const errorBoundary = new ErrorBoundary(
        this.target.querySelector('.example-1-container'),
        { error }
      );
      this.examples.push(errorBoundary);
    }

    // Example 2: Error recovery with retry
    const retryContainer = this.target.querySelector('.example-2-container');
    const retryErrorBoundary = new ErrorBoundary(retryContainer, {});

    const attemptLoad = async () => {
      try {
        const RetryComponent = await createRetryComponent();
        retryErrorBoundary.props = { component: RetryComponent };
        retryErrorBoundary.hasError = false;
        retryErrorBoundary.render();
      } catch (error) {
        retryErrorBoundary.catchError(error);
      }
    };

    attemptLoad();
    this.examples.push(retryErrorBoundary);

    // Example 3: Getter-only properties
    try {
      const GetterComponent = await createGetterComponent();
      const example3 = new GetterComponent({
        target: this.target.querySelector('.example-3-container')
      });
      this.examples.push(example3);
    } catch (error) {
      const errorBoundary = new ErrorBoundary(
        this.target.querySelector('.example-3-container'),
        { error }
      );
      this.examples.push(errorBoundary);
    }

    // Example 4: Manual chunk loading
    const example4 = new ManualChunkLoader(
      this.target.querySelector('.example-4-container')
    );
    this.examples.push(example4);

    // Example 5: Preloading strategy
    const example5 = new PreloadingExample(
      this.target.querySelector('.example-5-container')
    );
    this.examples.push(example5);
  }

  $destroy() {
    this.examples.forEach(example => {
      if (example.$destroy) {
        example.$destroy();
      }
    });
  }
}

// Styles
const styles = `
  .svelte-examples {
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

// Initialize the Svelte example
export function initSvelteChunkLoadingExamples() {
  // Add styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Create container
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Create and initialize Svelte app
  const app = new SvelteChunkLoadingExamples(container);

  return app;
}

// Auto-initialize if this is the main module
if (typeof window !== 'undefined' && !window.svelteChunkExamplesInitialized) {
  window.svelteChunkExamplesInitialized = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSvelteChunkLoadingExamples);
  } else {
    initSvelteChunkLoadingExamples();
  }
}

export default SvelteChunkLoadingExamples;