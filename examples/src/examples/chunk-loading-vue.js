/**
 * Vue Chunk Loading Examples
 * 
 * This file demonstrates proper chunk loading patterns in Vue applications
 * with error handling best practices.
 */

import { createApp, defineAsyncComponent, ref, onMounted } from 'vue';

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

// Error boundary component for Vue
const ChunkErrorBoundary = {
  name: 'ChunkErrorBoundary',
  props: {
    showDetails: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { slots }) {
    const hasError = ref(false);
    const error = ref(null);
    const retryCount = ref(0);

    const retry = () => {
      hasError.value = false;
      error.value = null;
      retryCount.value++;
    };

    return {
      hasError,
      error,
      retryCount,
      retry,
      slots
    };
  },
  errorCaptured(err, instance, info) {
    console.error('Chunk loading error caught by boundary:', err, info);
    this.hasError = true;
    this.error = err;
    return false; // Prevent error from propagating
  },
  template: `
    <div v-if="hasError" class="chunk-error">
      <h3>🚫 Failed to load component</h3>
      <p>{{ error?.message || 'Unknown error occurred' }}</p>
      <button @click="retry">
        🔄 Retry ({{ retryCount }} attempts)
      </button>
      <details v-if="showDetails">
        <summary>Error Details</summary>
        <pre>{{ error?.stack }}</pre>
      </details>
    </div>
    <slot v-else />
  `
};

// Example 1: Basic async component with error handling
const BasicAsyncComponent = defineAsyncComponent({
  loader: () => loadChunkSafely('basic-vue-component', () =>
    Promise.resolve({
      default: {
        name: 'BasicComponent',
        template: `
          <div class="lazy-component">
            <h4>✅ Successfully loaded Vue async component!</h4>
            <p>This component was loaded dynamically with safe property assignment.</p>
          </div>
        `
      }
    })
  ),
  loadingComponent: {
    template: '<div>Loading basic component...</div>'
  },
  errorComponent: {
    template: '<div class="error">Failed to load basic component</div>'
  }
});

// Example 2: Async component with retry logic
const RetryAsyncComponent = defineAsyncComponent({
  loader: () => {
    // Simulate intermittent failures
    if (Math.random() < 0.7) {
      return Promise.reject(new Error('Simulated network error'));
    }

    return loadChunkSafely('retry-vue-component', () =>
      Promise.resolve({
        default: {
          name: 'RetryComponent',
          template: `
            <div class="success-component">
              <h4>🎉 Vue component loaded after retry!</h4>
              <p>This demonstrates error recovery in chunk loading.</p>
            </div>
          `
        }
      })
    );
  },
  loadingComponent: {
    template: '<div>Loading component (may fail)...</div>'
  },
  errorComponent: {
    template: '<div class="error">Component failed to load</div>'
  }
});

// Example 3: Component with getter-only properties
const GetterAsyncComponent = defineAsyncComponent({
  loader: () => loadChunkSafely('getter-vue-component', () => {
    // Create a module with getter-only properties
    const module = {};
    Object.defineProperty(module, 'data', {
      get() { return this._data || 'initial'; },
      enumerable: true,
      configurable: true
    });

    module.default = {
      name: 'GetterComponent',
      setup() {
        return {
          originalData: module.data,
          chunkData: module.chunkData
        };
      },
      template: `
        <div class="getter-component">
          <h4>🔧 Vue component with getter-only properties</h4>
          <p>Original data: {{ originalData }}</p>
          <p>Chunk data: {{ JSON.stringify(chunkData) }}</p>
          <p>This component had getter-only properties that were safely handled.</p>
        </div>
      `
    };

    return Promise.resolve(module);
  }),
  loadingComponent: {
    template: '<div>Loading component with getters...</div>'
  }
});

// Example 4: Manual chunk loading component
const ManualChunkLoader = {
  name: 'ManualChunkLoader',
  setup() {
    const component = ref(null);
    const loading = ref(false);
    const error = ref(null);

    const loadComponent = async () => {
      loading.value = true;
      error.value = null;

      try {
        const module = await loadChunkSafely('manual-vue-component', () =>
          Promise.resolve({
            default: {
              name: 'ManualComponent',
              props: ['message', 'chunkData'],
              template: `
                <div class="manual-component">
                  <h4>📦 Manually loaded Vue component</h4>
                  <p>{{ message }}</p>
                  <p>Chunk data: {{ JSON.stringify(chunkData) }}</p>
                </div>
              `
            }
          })
        );

        component.value = module.default;
      } catch (err) {
        error.value = err;
      } finally {
        loading.value = false;
      }
    };

    return {
      component,
      loading,
      error,
      loadComponent
    };
  },
  template: `
    <div>
      <div v-if="loading">Loading component...</div>
      <div v-else-if="error" class="error">
        <p>Error: {{ error.message }}</p>
        <button @click="loadComponent">Retry</button>
      </div>
      <component 
        v-else-if="component" 
        :is="component" 
        message="This Vue component was loaded manually with error handling!"
        :chunk-data="component.chunkData"
      />
      <button v-else @click="loadComponent">Load Component Manually</button>
    </div>
  `
};

// Example 5: Preloading strategy component
const PreloadingExample = {
  name: 'PreloadingExample',
  setup() {
    const preloaded = ref(false);
    const showComponent = ref(false);
    const preloadedComponent = ref(null);

    const preloadComponent = async () => {
      try {
        const module = await loadChunkSafely('preloaded-vue-component', () =>
          Promise.resolve({
            default: {
              name: 'PreloadedComponent',
              template: `
                <div class="preloaded-component">
                  <h4>⚡ Preloaded Vue component</h4>
                  <p>This component was preloaded for instant rendering!</p>
                </div>
              `
            }
          })
        );
        preloadedComponent.value = module.default;
        preloaded.value = true;
      } catch (error) {
        console.error('Preloading failed:', error);
      }
    };

    onMounted(() => {
      preloadComponent();
    });

    return {
      preloaded,
      showComponent,
      preloadedComponent
    };
  },
  template: `
    <div>
      <p>Preload status: {{ preloaded ? '✅ Ready' : '⏳ Loading...' }}</p>
      <button 
        @click="showComponent = true"
        :disabled="!preloaded"
      >
        Show Preloaded Component
      </button>
      
      <component 
        v-if="showComponent && preloadedComponent" 
        :is="preloadedComponent" 
      />
    </div>
  `
};

// Main application component
const VueChunkLoadingExamples = {
  name: 'VueChunkLoadingExamples',
  components: {
    ChunkErrorBoundary,
    BasicAsyncComponent,
    RetryAsyncComponent,
    GetterAsyncComponent,
    ManualChunkLoader,
    PreloadingExample
  },
  template: `
    <div class="vue-examples">
      <header>
        <h1>Vue Chunk Loading Examples</h1>
        <p>Demonstrating safe chunk loading patterns with error handling.</p>
      </header>

      <section class="example">
        <h2>Example 1: Basic Async Component</h2>
        <chunk-error-boundary :show-details="true">
          <basic-async-component />
        </chunk-error-boundary>
      </section>

      <section class="example">
        <h2>Example 2: Error Recovery</h2>
        <chunk-error-boundary :show-details="true">
          <retry-async-component />
        </chunk-error-boundary>
      </section>

      <section class="example">
        <h2>Example 3: Getter-Only Properties</h2>
        <chunk-error-boundary :show-details="true">
          <getter-async-component />
        </chunk-error-boundary>
      </section>

      <section class="example">
        <h2>Example 4: Manual Chunk Loading</h2>
        <manual-chunk-loader />
      </section>

      <section class="example">
        <h2>Example 5: Preloading Strategy</h2>
        <preloading-example />
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
  `
};

// Styles
const styles = `
  .vue-examples {
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

// Initialize the Vue example
export function initVueChunkLoadingExamples() {
  // Add styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Create container
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Create and mount Vue app
  const app = createApp(VueChunkLoadingExamples);
  app.mount(container);

  return app;
}

// Auto-initialize if this is the main module
if (typeof window !== 'undefined' && !window.vueChunkExamplesInitialized) {
  window.vueChunkExamplesInitialized = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVueChunkLoadingExamples);
  } else {
    initVueChunkLoadingExamples();
  }
}

export default VueChunkLoadingExamples;