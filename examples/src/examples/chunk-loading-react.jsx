/**
 * React Chunk Loading Examples
 * 
 * This file demonstrates proper chunk loading patterns in React applications
 * with error handling best practices.
 */

import React, { Suspense, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

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

// Error boundary for chunk loading
class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Chunk loading error caught by boundary:', error, errorInfo);
  }

  retry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="chunk-error">
          <h3>🚫 Failed to load component</h3>
          <p>{this.state.error?.message || 'Unknown error occurred'}</p>
          <button onClick={this.retry}>
            🔄 Retry ({this.state.retryCount} attempts)
          </button>
          {this.props.showDetails && (
            <details>
              <summary>Error Details</summary>
              <pre>{this.state.error?.stack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Example 1: Basic lazy loading with error handling
const LazyComponent = React.lazy(() =>
  loadChunkSafely('basic-component', () =>
    Promise.resolve({
      default: () => (
        <div className="lazy-component">
          <h4>✅ Successfully loaded lazy component!</h4>
          <p>This component was loaded dynamically with safe property assignment.</p>
        </div>
      )
    })
  )
);

// Example 2: Lazy component that demonstrates error recovery
const FailingComponent = React.lazy(() => {
  // Simulate intermittent failures
  if (Math.random() < 0.7) {
    return Promise.reject(new Error('Simulated network error'));
  }

  return loadChunkSafely('failing-component', () =>
    Promise.resolve({
      default: () => (
        <div className="success-component">
          <h4>🎉 Component loaded after retry!</h4>
          <p>This demonstrates error recovery in chunk loading.</p>
        </div>
      )
    })
  );
});

// Example 3: Component with getter-only properties (demonstrates the original issue)
const ComponentWithGetters = React.lazy(() =>
  loadChunkSafely('getter-component', () => {
    // Create a module with getter-only properties
    const module = {};
    Object.defineProperty(module, 'data', {
      get() { return this._data || 'initial'; },
      enumerable: true,
      configurable: true
    });

    module.default = () => (
      <div className="getter-component">
        <h4>🔧 Component with getter-only properties</h4>
        <p>Original data: {module.data}</p>
        <p>This component had getter-only properties that were safely handled.</p>
      </div>
    );

    return Promise.resolve(module);
  })
);

// Example 4: Dynamic import with manual chunk loading
function ManualChunkLoader() {
  const [component, setComponent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadComponent = async () => {
    setLoading(true);
    setError(null);

    try {
      const module = await loadChunkSafely('manual-component', () =>
        Promise.resolve({
          default: ({ message }) => (
            <div className="manual-component">
              <h4>📦 Manually loaded component</h4>
              <p>{message}</p>
              <p>Chunk data: {JSON.stringify(module.chunkData)}</p>
            </div>
          )
        })
      );

      setComponent(() => module.default);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading component...</div>;
  if (error) return (
    <div className="error">
      <p>Error: {error.message}</p>
      <button onClick={loadComponent}>Retry</button>
    </div>
  );
  if (component) return React.createElement(component, {
    message: "This component was loaded manually with error handling!"
  });

  return (
    <div>
      <button onClick={loadComponent}>Load Component Manually</button>
    </div>
  );
}

// Example 5: Preloading strategy
function PreloadingExample() {
  const [preloaded, setPreloaded] = useState(false);
  const [showComponent, setShowComponent] = useState(false);

  const preloadComponent = async () => {
    try {
      // Preload the component without rendering
      await loadChunkSafely('preloaded-component', () =>
        Promise.resolve({
          default: () => (
            <div className="preloaded-component">
              <h4>⚡ Preloaded component</h4>
              <p>This component was preloaded for instant rendering!</p>
            </div>
          )
        })
      );
      setPreloaded(true);
    } catch (error) {
      console.error('Preloading failed:', error);
    }
  };

  useEffect(() => {
    // Preload on mount
    preloadComponent();
  }, []);

  const PreloadedComponent = React.lazy(() =>
    loadChunkSafely('preloaded-component', () =>
      Promise.resolve({
        default: () => (
          <div className="preloaded-component">
            <h4>⚡ Preloaded component</h4>
            <p>This component was preloaded for instant rendering!</p>
          </div>
        )
      })
    )
  );

  return (
    <div>
      <p>Preload status: {preloaded ? '✅ Ready' : '⏳ Loading...'}</p>
      <button
        onClick={() => setShowComponent(true)}
        disabled={!preloaded}
      >
        Show Preloaded Component
      </button>

      {showComponent && (
        <Suspense fallback={<div>Rendering...</div>}>
          <PreloadedComponent />
        </Suspense>
      )}
    </div>
  );
}

// Main application component
function ReactChunkLoadingExamples() {
  return (
    <div className="react-examples">
      <header>
        <h1>React Chunk Loading Examples</h1>
        <p>Demonstrating safe chunk loading patterns with error handling.</p>
      </header>

      <section className="example">
        <h2>Example 1: Basic Lazy Loading</h2>
        <ChunkErrorBoundary showDetails>
          <Suspense fallback={<div>Loading basic component...</div>}>
            <LazyComponent />
          </Suspense>
        </ChunkErrorBoundary>
      </section>

      <section className="example">
        <h2>Example 2: Error Recovery</h2>
        <ChunkErrorBoundary showDetails>
          <Suspense fallback={<div>Loading component (may fail)...</div>}>
            <FailingComponent />
          </Suspense>
        </ChunkErrorBoundary>
      </section>

      <section className="example">
        <h2>Example 3: Getter-Only Properties</h2>
        <ChunkErrorBoundary showDetails>
          <Suspense fallback={<div>Loading component with getters...</div>}>
            <ComponentWithGetters />
          </Suspense>
        </ChunkErrorBoundary>
      </section>

      <section className="example">
        <h2>Example 4: Manual Chunk Loading</h2>
        <ManualChunkLoader />
      </section>

      <section className="example">
        <h2>Example 5: Preloading Strategy</h2>
        <PreloadingExample />
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
  );
}

// Styles
const styles = `
  .react-examples {
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

// Initialize the example
export function initReactChunkLoadingExamples() {
  // Add styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Create container and render
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<ReactChunkLoadingExamples />);

  return root;
}

// Auto-initialize if this is the main module
if (typeof window !== 'undefined' && !window.reactChunkExamplesInitialized) {
  window.reactChunkExamplesInitialized = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReactChunkLoadingExamples);
  } else {
    initReactChunkLoadingExamples();
  }
}

export default ReactChunkLoadingExamples;