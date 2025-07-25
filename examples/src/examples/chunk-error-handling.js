/**
 * Example usage of chunk error handling components
 * 
 * This file demonstrates how to use the chunk error handling components
 * with different frameworks.
 */

// React Example
import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChunkErrorBoundary,
  withChunkErrorBoundary,
  lazyWithErrorBoundary
} from '../../../packages/core/src/components/ChunkErrorBoundary.jsx';

// Vue Example
import { createApp, defineAsyncComponent } from 'vue';
import ChunkErrorBoundaryVue from '../../../packages/core/src/components/ChunkErrorBoundary.vue';

// Vanilla JS Example
import {
  createChunkErrorFallback,
  createChunkErrorHandler,
  createLazyLoader
} from '../../../packages/core/src/components/ChunkErrorFallback.js';

// Framework detection utility
import { detectFramework } from '../../../packages/core/src/components/index.js';

// Enhanced Code Splitter
import {
  createCodeSplitter,
  ChunkError,
  ChunkNetworkError
} from '../shared/code-splitter-enhanced.js';

/**
 * React Example
 */
function ReactExample() {
  // Example 1: Using ChunkErrorBoundary directly
  const Example1 = () => {
    const LazyComponent = React.lazy(() => import('./non-existent-module.js'));

    return (
      <div className="example">
        <h3>Example 1: ChunkErrorBoundary with React.lazy</h3>
        <ChunkErrorBoundary showDetails={true}>
          <Suspense fallback={<div>Loading...</div>}>
            <LazyComponent />
          </Suspense>
        </ChunkErrorBoundary>
      </div>
    );
  };

  // Example 2: Using lazyWithErrorBoundary helper
  const LazyComponent = lazyWithErrorBoundary(
    () => import('./non-existent-module.js'),
    {
      showDetails: true,
      suspenseFallback: <div>Loading component...</div>,
      onError: (error) => console.error('Chunk loading failed:', error)
    }
  );

  const Example2 = () => {
    return (
      <div className="example">
        <h3>Example 2: lazyWithErrorBoundary helper</h3>
        <LazyComponent />
      </div>
    );
  };

  // Example 3: Using withChunkErrorBoundary HOC
  const ErrorComponent = () => {
    // Simulate an error
    throw new ChunkError('Component failed to initialize', {
      chunkId: 'example-chunk',
      phase: 'execute'
    });
  };

  const WrappedErrorComponent = withChunkErrorBoundary(ErrorComponent, {
    showDetails: true,
    maxRetries: 2
  });

  const Example3 = () => {
    return (
      <div className="example">
        <h3>Example 3: withChunkErrorBoundary HOC</h3>
        <WrappedErrorComponent />
      </div>
    );
  };

  // Example 4: Custom fallback component
  const CustomFallback = ({ error, retry }) => (
    <div className="custom-error">
      <h4>😢 Something went wrong</h4>
      <p>{error?.message || 'Failed to load component'}</p>
      {retry && (
        <button onClick={retry}>
          🔄 Reload Component
        </button>
      )}
    </div>
  );

  const Example4 = () => {
    return (
      <div className="example">
        <h3>Example 4: Custom fallback component</h3>
        <ChunkErrorBoundary fallback={CustomFallback}>
          <ErrorComponent />
        </ChunkErrorBoundary>
      </div>
    );
  };

  // Render all examples
  return (
    <div className="react-examples">
      <h2>React Error Handling Examples</h2>
      <Example1 />
      <Example2 />
      <Example3 />
      <Example4 />
    </div>
  );
}

/**
 * Vue Example
 */
function mountVueExample() {
  const app = createApp({
    template: `
      <div class="vue-examples">
        <h2>Vue Error Handling Examples</h2>
        
        <!-- Example 1: Using ChunkErrorBoundary component -->
        <div class="example">
          <h3>Example 1: ChunkErrorBoundary component</h3>
          <chunk-error-boundary :show-details="true">
            <async-component />
          </chunk-error-boundary>
        </div>
        
        <!-- Example 2: Using defineAsyncComponent helper -->
        <div class="example">
          <h3>Example 2: defineAsyncComponent with error handling</h3>
          <safe-async-component />
        </div>
        
        <!-- Example 3: Custom error component -->
        <div class="example">
          <h3>Example 3: Custom error component</h3>
          <chunk-error-boundary>
            <error-component />
          </chunk-error-boundary>
        </div>
      </div>
    `,
    components: {
      ChunkErrorBoundary: ChunkErrorBoundaryVue,

      // Example 1: Component that will fail to load
      AsyncComponent: defineAsyncComponent({
        loader: () => import('./non-existent-module.js'),
        loadingComponent: {
          template: '<div>Loading...</div>'
        },
        error: {
          template: '<div>Failed to load component</div>'
        }
      }),

      // Example 2: Using the enhanced defineAsyncComponent from ChunkErrorBoundary.vue
      SafeAsyncComponent: defineAsyncComponent(
        () => import('./non-existent-module.js'),
        {
          showDetails: true,
          maxRetries: 2,
          loadingComponent: {
            template: '<div>Loading component...</div>'
          },
          onError: (err) => console.error('Chunk loading failed:', err)
        }
      ),

      // Example 3: Component that throws an error
      ErrorComponent: {
        template: '<div>This should not be visible</div>',
        mounted() {
          throw new ChunkError('Component failed to initialize', {
            chunkId: 'example-chunk',
            phase: 'execute'
          });
        }
      }
    }
  });

  // Create container and mount
  const container = document.createElement('div');
  document.body.appendChild(container);
  app.mount(container);

  return app;
}

/**
 * Vanilla JS Example
 */
function vanillaJsExample() {
  const container = document.createElement('div');
  container.className = 'vanilla-examples';

  // Add title
  const title = document.createElement('h2');
  title.textContent = 'Vanilla JS Error Handling Examples';
  container.appendChild(title);

  // Example 1: Using createChunkErrorFallback
  const example1 = document.createElement('div');
  example1.className = 'example';

  const example1Title = document.createElement('h3');
  example1Title.textContent = 'Example 1: Simple error fallback';
  example1.appendChild(example1Title);

  const error = new ChunkNetworkError('Failed to load chunk', {
    chunkId: 'example-chunk',
    statusCode: 404,
    url: '/path/to/chunk.js'
  });

  const fallback = createChunkErrorFallback({
    error,
    showDetails: true,
    retry: () => {
      alert('Retry clicked');
    }
  });

  example1.appendChild(fallback);
  container.appendChild(example1);

  // Example 2: Using createChunkErrorHandler
  const example2 = document.createElement('div');
  example2.className = 'example';

  const example2Title = document.createElement('h3');
  example2Title.textContent = 'Example 2: Error handler with retry';
  example2.appendChild(example2Title);

  const contentContainer = document.createElement('div');
  example2.appendChild(contentContainer);

  let failCount = 0;

  const handler = createChunkErrorHandler(
    () => {
      return new Promise((resolve, reject) => {
        if (failCount < 2) {
          failCount++;
          reject(new Error(`Loading failed (attempt ${failCount})`));
        } else {
          resolve({
            render: () => {
              const successEl = document.createElement('div');
              successEl.textContent = 'Successfully loaded after retries!';
              return successEl;
            }
          });
        }
      });
    },
    {
      container: contentContainer,
      showDetails: true,
      maxRetries: 3,
      onError: (err) => console.error('Loading error:', err),
      onRetry: (count) => console.log(`Retry attempt ${count}`)
    }
  );

  // Start loading
  handler.load();

  // Add manual retry button
  const retryButton = document.createElement('button');
  retryButton.textContent = 'Manual Retry';
  retryButton.addEventListener('click', () => {
    handler.retry().then(module => {
      if (module.render) {
        contentContainer.appendChild(module.render());
      }
    });
  });

  example2.appendChild(retryButton);
  container.appendChild(example2);

  // Example 3: Using createLazyLoader
  const example3 = document.createElement('div');
  example3.className = 'example';

  const example3Title = document.createElement('h3');
  example3Title.textContent = 'Example 3: Lazy loader';
  example3.appendChild(example3Title);

  const lazyContainer = document.createElement('div');
  example3.appendChild(lazyContainer);

  const lazyLoader = createLazyLoader(
    () => import('./non-existent-module.js'),
    {
      container: lazyContainer,
      showDetails: true,
      maxRetries: 2,
      onError: (err) => console.error('Lazy loading error:', err),
      onLoad: (module) => {
        const successEl = document.createElement('div');
        successEl.textContent = 'Module loaded successfully!';
        lazyContainer.appendChild(successEl);
      }
    }
  );

  // Add load button
  const loadButton = document.createElement('button');
  loadButton.textContent = 'Load Module';
  loadButton.addEventListener('click', () => {
    lazyLoader.load().catch(() => {
      console.log('Loading failed, use retry button');
    });
  });

  // Add retry button
  const lazyRetryButton = document.createElement('button');
  lazyRetryButton.textContent = 'Retry Loading';
  lazyRetryButton.addEventListener('click', () => {
    lazyLoader.retry().catch(() => {
      console.log('Retry failed');
    });
  });

  example3.appendChild(loadButton);
  example3.appendChild(lazyRetryButton);
  container.appendChild(example3);

  // Add to document
  document.body.appendChild(container);

  return container;
}

/**
 * Initialize examples based on detected framework
 */
function initExamples() {
  // Add some basic styling
  const style = document.createElement('style');
  style.textContent = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .example {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 20px;
    }
    
    h2 {
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
    }
    
    button {
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      margin-right: 8px;
      cursor: pointer;
    }
    
    button:hover {
      background-color: #45a049;
    }
    
    .custom-error {
      border: 1px solid #ffcccc;
      border-radius: 4px;
      background-color: #fff8f8;
      padding: 16px;
      color: #d32f2f;
    }
  `;
  document.head.appendChild(style);

  // Create header
  const header = document.createElement('header');
  header.innerHTML = `
    <h1>Chunk Loading Error Handling Examples</h1>
    <p>This page demonstrates different approaches to handling chunk loading errors.</p>
  `;
  document.body.appendChild(header);

  // Initialize based on framework
  const framework = detectFramework();

  if (framework === 'react') {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(<ReactExample />);
  } else if (framework === 'vue') {
    mountVueExample();
  } else {
    vanillaJsExample();
  }

  // Add footer with framework info
  const footer = document.createElement('footer');
  footer.innerHTML = `
    <p><small>Detected framework: ${framework}</small></p>
  `;
  document.body.appendChild(footer);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExamples);
} else {
  initExamples();
}