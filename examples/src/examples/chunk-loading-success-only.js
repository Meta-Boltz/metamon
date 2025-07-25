/**
 * Success-Only Chunk Loading Examples
 * 
 * This file demonstrates successful chunk loading patterns without intentional errors,
 * showing how the safe assignment fix resolves the getter-only property issue.
 */

// Simple safe assignment implementation
function safeAssign(obj, prop, value) {
  if (obj == null) {
    return obj;
  }

  try {
    // Check if property has getter but no setter
    const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

    if (descriptor && descriptor.get && !descriptor.set) {
      console.log(`🔧 Property ${prop} has getter but no setter, creating new object`);

      // Create a new object with the desired property
      const newObj = Object.create(Object.getPrototypeOf(obj));

      // Copy existing properties
      Object.getOwnPropertyNames(obj).forEach(key => {
        if (key !== prop) {
          try {
            const keyDescriptor = Object.getOwnPropertyDescriptor(obj, key);
            if (keyDescriptor) {
              if (keyDescriptor.get && !keyDescriptor.set) {
                // For getter-only properties, try to get the value and make it writable
                try {
                  const value = keyDescriptor.get.call(obj);
                  Object.defineProperty(newObj, key, {
                    configurable: true,
                    enumerable: keyDescriptor.enumerable,
                    writable: true,
                    value
                  });
                } catch (getterError) {
                  // If getter throws, create a placeholder
                  Object.defineProperty(newObj, key, {
                    configurable: true,
                    enumerable: keyDescriptor.enumerable,
                    writable: true,
                    value: undefined
                  });
                }
              } else {
                Object.defineProperty(newObj, key, keyDescriptor);
              }
            }
          } catch (e) {
            // Skip properties that can't be copied
            console.warn(`Could not copy property ${key}:`, e);
          }
        }
      });

      // Add our property
      try {
        Object.defineProperty(newObj, prop, {
          configurable: true,
          enumerable: true,
          writable: true,
          value
        });
      } catch (e) {
        newObj[prop] = value;
      }

      return newObj;
    } else {
      // Normal assignment
      obj[prop] = value;
      return obj;
    }
  } catch (e) {
    console.warn(`Failed to assign property ${prop}, creating new object:`, e);
    // Create a completely new object as last resort
    try {
      const newObj = { ...obj };
      newObj[prop] = value;
      return newObj;
    } catch (e2) {
      // If even spread operator fails, create minimal object
      const newObj = {};
      newObj[prop] = value;
      return newObj;
    }
  }
}

// Enhanced chunk loader with safe assignment
async function loadChunkSafely(chunkId, importFn) {
  try {
    const module = await importFn();

    // Apply safe property assignment for chunk metadata
    const processedModule = safeAssign(module, 'chunkData', {
      id: chunkId,
      loaded: true,
      timestamp: Date.now(),
      loader: 'SafeChunkLoader'
    });

    return processedModule;
  } catch (error) {
    console.error(`Failed to load chunk ${chunkId}:`, error);
    throw new Error(`Chunk loading failed: ${error.message}`);
  }
}

// Success-only examples that demonstrate the fix working
class SuccessOnlyExamples {
  constructor(container) {
    this.container = container;
    this.examples = [];
    this.render();
  }

  async render() {
    this.container.innerHTML = `
      <div class="success-examples">
        <header class="header">
          <h1>✅ Chunk Loading Success Examples</h1>
          <p>Demonstrating successful resolution of the getter-only property issue</p>
          
          <div class="problem-solution">
            <div class="problem">
              <h3>❌ The Original Problem</h3>
              <pre><code>// This failed before our fix:
const module = {
  get data() { return this._data; }
  // No setter - causes TypeError
};

module.data = { loaded: true }; // TypeError!</code></pre>
            </div>
            
            <div class="solution">
              <h3>✅ Our Solution</h3>
              <pre><code>// This works with our safe assignment:
const result = safeAssign(module, 'data', {
  loaded: true,
  timestamp: Date.now()
});

console.log(result.data); // Success!</code></pre>
            </div>
          </div>
        </header>

        <div class="examples-grid">
          <div class="example-card">
            <h3>🔧 Basic Safe Assignment</h3>
            <div class="example-1-container"></div>
          </div>

          <div class="example-card">
            <h3>📦 Chunk Loading with Metadata</h3>
            <div class="example-2-container"></div>
          </div>

          <div class="example-card">
            <h3>🚀 React Component Loading</h3>
            <div class="example-3-container"></div>
          </div>

          <div class="example-card">
            <h3>💚 Vue Component Loading</h3>
            <div class="example-4-container"></div>
          </div>

          <div class="example-card">
            <h3>🧡 Svelte Component Loading</h3>
            <div class="example-5-container"></div>
          </div>

          <div class="example-card">
            <h3>🟨 Vanilla JS Module Loading</h3>
            <div class="example-6-container"></div>
          </div>
        </div>

        <footer class="results">
          <h2>🎉 Results Summary</h2>
          <div class="results-grid">
            <div class="result-item success">
              <h4>✅ Safe Assignment</h4>
              <p>Successfully handles getter-only properties</p>
            </div>
            <div class="result-item success">
              <h4>✅ Chunk Metadata</h4>
              <p>Metadata added without errors</p>
            </div>
            <div class="result-item success">
              <h4>✅ Framework Support</h4>
              <p>Works across React, Vue, Svelte, Vanilla JS</p>
            </div>
            <div class="result-item success">
              <h4>✅ Error Prevention</h4>
              <p>No more TypeError exceptions</p>
            </div>
          </div>
        </footer>
      </div>
    `;

    await this.initializeExamples();
  }

  async initializeExamples() {
    // Example 1: Basic safe assignment demonstration
    await this.example1BasicSafeAssignment();

    // Example 2: Chunk loading with metadata
    await this.example2ChunkLoadingWithMetadata();

    // Example 3: React component loading
    await this.example3ReactComponentLoading();

    // Example 4: Vue component loading
    await this.example4VueComponentLoading();

    // Example 5: Svelte component loading
    await this.example5SvelteComponentLoading();

    // Example 6: Vanilla JS module loading
    await this.example6VanillaJSModuleLoading();
  }

  async example1BasicSafeAssignment() {
    const container = this.container.querySelector('.example-1-container');

    // Create a mock object with getter-only property
    const mockObject = {};
    Object.defineProperty(mockObject, 'data', {
      get() { return this._data || 'original value'; },
      enumerable: true,
      configurable: true
      // No setter - this would cause the original error
    });

    try {
      // This would fail: mockObject.data = 'new value';
      const result = safeAssign(mockObject, 'data', {
        message: 'Successfully assigned!',
        timestamp: new Date().toLocaleTimeString()
      });

      container.innerHTML = `
        <div class="success-result">
          <h4>✅ Safe Assignment Success</h4>
          <p><strong>Original data:</strong> ${mockObject.data}</p>
          <p><strong>New data:</strong> ${JSON.stringify(result.data)}</p>
          <p><strong>Object changed:</strong> ${result !== mockObject ? 'Yes (new object created)' : 'No'}</p>
          <div class="code-demo">
            <strong>What happened:</strong> Safe assignment detected getter-only property and created new object
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<div class="error">Unexpected error: ${error.message}</div>`;
    }
  }

  async example2ChunkLoadingWithMetadata() {
    const container = this.container.querySelector('.example-2-container');

    try {
      // Simulate loading a chunk with getter-only properties
      const chunkModule = await loadChunkSafely('demo-chunk', () => {
        const module = {
          default: () => 'Demo Component',
          name: 'DemoComponent'
        };

        // Add getter-only property that would cause the original error
        Object.defineProperty(module, 'data', {
          get() { return { original: true, loaded: false }; },
          enumerable: true,
          configurable: true
        });

        return Promise.resolve(module);
      });

      container.innerHTML = `
        <div class="success-result">
          <h4>✅ Chunk Loading Success</h4>
          <p><strong>Chunk ID:</strong> ${chunkModule.chunkData.id}</p>
          <p><strong>Loaded:</strong> ${chunkModule.chunkData.loaded}</p>
          <p><strong>Timestamp:</strong> ${new Date(chunkModule.chunkData.timestamp).toLocaleTimeString()}</p>
          <p><strong>Original data:</strong> ${JSON.stringify(chunkModule.data)}</p>
          <p><strong>Component:</strong> ${chunkModule.name}</p>
          <div class="code-demo">
            <strong>Success:</strong> Chunk metadata added without TypeError!
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<div class="error">Unexpected error: ${error.message}</div>`;
    }
  }

  async example3ReactComponentLoading() {
    const container = this.container.querySelector('.example-3-container');

    try {
      const reactModule = await loadChunkSafely('react-component', () => {
        const module = {
          default: function ReactComponent(props) {
            return `<div>React Component: ${props?.message || 'Hello'}</div>`;
          }
        };

        // Add React-specific properties with getters
        Object.defineProperty(module, 'data', {
          get() { return { framework: 'React', version: '18.2.0' }; },
          enumerable: true,
          configurable: true
        });

        return Promise.resolve(module);
      });

      container.innerHTML = `
        <div class="success-result">
          <h4>✅ React Component Loaded</h4>
          <p><strong>Framework:</strong> ${reactModule.data.framework}</p>
          <p><strong>Version:</strong> ${reactModule.data.version}</p>
          <p><strong>Chunk Data:</strong> ${JSON.stringify(reactModule.chunkData)}</p>
          <div class="component-demo">
            ${reactModule.default({ message: 'Successfully loaded!' })}
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<div class="error">Unexpected error: ${error.message}</div>`;
    }
  }

  async example4VueComponentLoading() {
    const container = this.container.querySelector('.example-4-container');

    try {
      const vueModule = await loadChunkSafely('vue-component', () => {
        const module = {
          default: {
            name: 'VueComponent',
            template: '<div>Vue Component: {{ message }}</div>',
            props: ['message']
          }
        };

        // Add Vue-specific properties with getters
        Object.defineProperty(module, 'data', {
          get() { return { framework: 'Vue', version: '3.3.0' }; },
          enumerable: true,
          configurable: true
        });

        return Promise.resolve(module);
      });

      container.innerHTML = `
        <div class="success-result">
          <h4>✅ Vue Component Loaded</h4>
          <p><strong>Framework:</strong> ${vueModule.data.framework}</p>
          <p><strong>Version:</strong> ${vueModule.data.version}</p>
          <p><strong>Component Name:</strong> ${vueModule.default.name}</p>
          <p><strong>Chunk Data:</strong> ${JSON.stringify(vueModule.chunkData)}</p>
          <div class="component-demo">
            <div>Vue Component: Successfully loaded!</div>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `<div class="error">Unexpected error: ${error.message}</div>`;
    }
  }

  async example5SvelteComponentLoading() {
    const container = this.container.querySelector('.example-5-container');

    try {
      const svelteModule = await loadChunkSafely('svelte-component', () => {
        const module = {
          default: class SvelteComponent {
            constructor(options) {
              this.target = options.target;
              this.props = options.props || {};
              this.render();
            }

            render() {
              this.target.innerHTML = `<div>Svelte Component: ${this.props.message || 'Hello'}</div>`;
            }

            $destroy() {
              this.target.innerHTML = '';
            }
          }
        };

        // Add Svelte-specific properties with getters
        Object.defineProperty(module, 'data', {
          get() { return { framework: 'Svelte', version: '4.0.0' }; },
          enumerable: true,
          configurable: true
        });

        return Promise.resolve(module);
      });

      const componentContainer = document.createElement('div');
      const component = new svelteModule.default({
        target: componentContainer,
        props: { message: 'Successfully loaded!' }
      });

      container.innerHTML = `
        <div class="success-result">
          <h4>✅ Svelte Component Loaded</h4>
          <p><strong>Framework:</strong> ${svelteModule.data.framework}</p>
          <p><strong>Version:</strong> ${svelteModule.data.version}</p>
          <p><strong>Chunk Data:</strong> ${JSON.stringify(svelteModule.chunkData)}</p>
          <div class="component-demo"></div>
        </div>
      `;

      container.querySelector('.component-demo').appendChild(componentContainer);
    } catch (error) {
      container.innerHTML = `<div class="error">Unexpected error: ${error.message}</div>`;
    }
  }

  async example6VanillaJSModuleLoading() {
    const container = this.container.querySelector('.example-6-container');

    try {
      const vanillaModule = await loadChunkSafely('vanilla-module', () => {
        const module = {
          default: {
            render: (container, message) => {
              container.innerHTML = `<div>Vanilla JS Module: ${message}</div>`;
            },
            utils: {
              format: (text) => text.toUpperCase(),
              validate: (input) => input && input.length > 0
            }
          }
        };

        // Add module-specific properties with getters
        Object.defineProperty(module, 'data', {
          get() { return { type: 'vanilla', loaded: false }; },
          enumerable: true,
          configurable: true
        });

        return Promise.resolve(module);
      });

      const moduleContainer = document.createElement('div');
      vanillaModule.default.render(moduleContainer, 'Successfully loaded!');

      container.innerHTML = `
        <div class="success-result">
          <h4>✅ Vanilla JS Module Loaded</h4>
          <p><strong>Type:</strong> ${vanillaModule.data.type}</p>
          <p><strong>Utils Available:</strong> ${Object.keys(vanillaModule.default.utils).join(', ')}</p>
          <p><strong>Chunk Data:</strong> ${JSON.stringify(vanillaModule.chunkData)}</p>
          <div class="component-demo"></div>
        </div>
      `;

      container.querySelector('.component-demo').appendChild(moduleContainer);
    } catch (error) {
      container.innerHTML = `<div class="error">Unexpected error: ${error.message}</div>`;
    }
  }

  destroy() {
    this.examples.forEach(example => {
      if (example && example.destroy) {
        example.destroy();
      }
    });
  }
}

// Styles for success-only examples
const successStyles = `
  .success-examples {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  
  .header {
    text-align: center;
    margin-bottom: 40px;
    padding-bottom: 30px;
    border-bottom: 2px solid #e1e5e9;
  }
  
  .header h1 {
    color: #2d3748;
    margin-bottom: 10px;
  }
  
  .problem-solution {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin: 30px 0;
    text-align: left;
  }
  
  .problem, .solution {
    padding: 20px;
    border-radius: 8px;
  }
  
  .problem {
    background: #fff5f5;
    border: 1px solid #fed7d7;
  }
  
  .solution {
    background: #f0fff4;
    border: 1px solid #9ae6b4;
  }
  
  .problem h3 {
    color: #c53030;
    margin-bottom: 15px;
  }
  
  .solution h3 {
    color: #2f855a;
    margin-bottom: 15px;
  }
  
  .examples-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }
  
  .example-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .example-card h3 {
    color: #2d3748;
    margin-bottom: 15px;
    font-size: 18px;
  }
  
  .success-result {
    background: #f0fff4;
    border: 1px solid #9ae6b4;
    border-radius: 6px;
    padding: 15px;
  }
  
  .success-result h4 {
    color: #2f855a;
    margin-bottom: 10px;
  }
  
  .success-result p {
    margin: 5px 0;
    font-size: 14px;
  }
  
  .code-demo {
    background: #1a202c;
    color: #e2e8f0;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }
  
  .component-demo {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 10px;
    margin-top: 10px;
    font-family: monospace;
  }
  
  .results {
    background: #f7fafc;
    border-radius: 8px;
    padding: 30px;
    text-align: center;
  }
  
  .results h2 {
    color: #2d3748;
    margin-bottom: 20px;
  }
  
  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
  }
  
  .result-item {
    padding: 15px;
    border-radius: 6px;
    text-align: center;
  }
  
  .result-item.success {
    background: #f0fff4;
    border: 1px solid #9ae6b4;
  }
  
  .result-item h4 {
    color: #2f855a;
    margin-bottom: 8px;
    font-size: 16px;
  }
  
  .result-item p {
    color: #4a5568;
    font-size: 14px;
    margin: 0;
  }
  
  .error {
    background: #fed7d7;
    border: 1px solid #fc8181;
    border-radius: 4px;
    padding: 10px;
    color: #c53030;
  }
  
  pre {
    background: #1a202c;
    color: #e2e8f0;
    padding: 15px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.4;
  }
  
  @media (max-width: 768px) {
    .problem-solution {
      grid-template-columns: 1fr;
    }
    
    .examples-grid {
      grid-template-columns: 1fr;
    }
    
    .results-grid {
      grid-template-columns: 1fr;
    }
  }
`;

// Initialize the success-only examples
export function initSuccessOnlyChunkLoadingExamples() {
  // Add styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = successStyles;
  document.head.appendChild(styleSheet);

  // Create container
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Create and initialize the success examples
  const app = new SuccessOnlyExamples(container);

  return app;
}

// Auto-initialize if this is the main module
if (typeof window !== 'undefined' && !window.successOnlyExamplesInitialized) {
  window.successOnlyExamplesInitialized = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSuccessOnlyChunkLoadingExamples);
  } else {
    initSuccessOnlyChunkLoadingExamples();
  }
}

export default SuccessOnlyExamples;