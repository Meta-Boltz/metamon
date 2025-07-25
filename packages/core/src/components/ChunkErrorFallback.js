/**
 * Vanilla JavaScript Chunk Error Fallback Component
 * 
 * This module provides a framework-agnostic fallback UI component for chunk loading errors.
 */

import { ChunkError } from '../utils/chunk-error.js';

/**
 * CSS styles for the fallback component
 */
const styles = `
.chunk-error-fallback {
  border: 1px solid #f5c2c7;
  border-radius: 4px;
  background-color: #f8d7da;
  padding: 16px;
  margin: 16px 0;
  color: #842029;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.chunk-error-container {
  display: flex;
  align-items: flex-start;
}

.chunk-error-icon {
  font-size: 24px;
  margin-right: 16px;
}

.chunk-error-content {
  flex: 1;
}

.chunk-error-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.chunk-error-message {
  margin: 0 0 16px 0;
  font-size: 14px;
}

.chunk-error-retry-button {
  background-color: #842029;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  margin-right: 8px;
}

.chunk-error-retry-button:hover {
  background-color: #6c1a22;
}

.chunk-error-toggle {
  background: none;
  border: none;
  color: #842029;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
}

.chunk-error-details {
  margin-top: 16px;
}

.chunk-error-code {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  overflow-x: auto;
  margin-top: 8px;
}
`;

/**
 * Ensure the styles are injected into the document
 */
function ensureStyles() {
  if (typeof document === 'undefined') return;

  const styleId = 'chunk-error-fallback-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

/**
 * Get a user-friendly error message
 */
function getUserMessage(error) {
  if (!error) return 'Failed to load component';

  return error instanceof ChunkError
    ? error.getUserMessage()
    : 'Failed to load component';
}

/**
 * Format error details for display
 */
function formatErrorDetails(error) {
  if (!error) return '';

  let details = {
    message: error.message,
    type: error.name || 'Error'
  };

  if (error instanceof ChunkError) {
    details = {
      ...details,
      chunkId: error.chunkId,
      phase: error.phase,
      timestamp: error.timestamp
    };
  }

  return JSON.stringify(details, null, 2);
}

/**
 * Create a chunk error fallback element
 */
export function createChunkErrorFallback(options = {}) {
  const {
    error,
    retry,
    showDetails = false,
    container = null,
    className = ''
  } = options;

  ensureStyles();

  // Create the fallback element
  const fallbackEl = document.createElement('div');
  fallbackEl.className = `chunk-error-fallback ${className}`;
  fallbackEl.setAttribute('role', 'alert');
  fallbackEl.setAttribute('aria-live', 'assertive');

  // Create the inner HTML
  fallbackEl.innerHTML = `
    <div class="chunk-error-container">
      <div class="chunk-error-icon">⚠️</div>
      <div class="chunk-error-content">
        <h3 class="chunk-error-title">Component Failed to Load</h3>
        <p class="chunk-error-message">${getUserMessage(error)}</p>
        
        ${retry ? `
          <button 
            class="chunk-error-retry-button" 
            aria-label="Retry loading the component"
          >
            Try Again
          </button>
        ` : ''}
        
        ${showDetails ? `
          <div class="chunk-error-details">
            <button 
              class="chunk-error-toggle" 
              aria-expanded="false"
              aria-controls="error-details-panel"
            >
              Show Details
            </button>
            
            <pre 
              id="error-details-panel" 
              class="chunk-error-code"
              style="display: none;"
            >${formatErrorDetails(error)}</pre>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Add event listeners
  if (retry) {
    const retryButton = fallbackEl.querySelector('.chunk-error-retry-button');
    retryButton.addEventListener('click', retry);
  }

  if (showDetails) {
    const toggleButton = fallbackEl.querySelector('.chunk-error-toggle');
    const detailsPanel = fallbackEl.querySelector('.chunk-error-code');

    toggleButton.addEventListener('click', () => {
      const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
      toggleButton.setAttribute('aria-expanded', !isExpanded);
      toggleButton.textContent = isExpanded ? 'Show Details' : 'Hide Details';
      detailsPanel.style.display = isExpanded ? 'none' : 'block';
    });
  }

  // Append to container if provided
  if (container) {
    container.appendChild(fallbackEl);
  }

  return fallbackEl;
}

/**
 * Create a chunk error handler that wraps a loader function
 */
export function createChunkErrorHandler(loaderFn, options = {}) {
  const {
    container,
    showDetails = false,
    maxRetries = 3,
    onError = null,
    onRetry = null
  } = options;

  let retryCount = 0;
  let fallbackEl = null;

  // Function to handle errors
  const handleError = (error) => {
    if (onError) {
      onError(error);
    }

    console.error('Chunk loading error:', error);

    // Remove any existing fallback
    if (fallbackEl && fallbackEl.parentNode) {
      fallbackEl.parentNode.removeChild(fallbackEl);
    }

    // Create retry function if we haven't exceeded max retries
    const retryFn = retryCount < maxRetries ? () => {
      retryCount++;

      if (onRetry) {
        onRetry(retryCount);
      }

      // Remove the fallback
      if (fallbackEl && fallbackEl.parentNode) {
        fallbackEl.parentNode.removeChild(fallbackEl);
        fallbackEl = null;
      }

      // Try loading again
      return load();
    } : null;

    // Create and show the fallback
    fallbackEl = createChunkErrorFallback({
      error,
      retry: retryFn,
      showDetails,
      container
    });

    return fallbackEl;
  };

  // Function to load the chunk
  const load = () => {
    try {
      return Promise.resolve(loaderFn())
        .catch(error => {
          return handleError(error);
        });
    } catch (error) {
      return handleError(error);
    }
  };

  return {
    load,
    retry: () => {
      if (retryCount < maxRetries) {
        retryCount++;
        return load();
      }
      return Promise.reject(new Error('Maximum retry count exceeded'));
    },
    reset: () => {
      retryCount = 0;
      if (fallbackEl && fallbackEl.parentNode) {
        fallbackEl.parentNode.removeChild(fallbackEl);
        fallbackEl = null;
      }
    }
  };
}

/**
 * Create a lazy loader with error handling
 */
export function createLazyLoader(importFn, options = {}) {
  const {
    container,
    showDetails = false,
    maxRetries = 3,
    onError = null,
    onRetry = null,
    onLoad = null
  } = options;

  let loadedModule = null;
  let isLoading = false;
  let error = null;

  const errorHandler = createChunkErrorHandler(
    () => importFn().then(module => {
      loadedModule = module;
      isLoading = false;
      error = null;

      if (onLoad) {
        onLoad(module);
      }

      return module;
    }),
    {
      container,
      showDetails,
      maxRetries,
      onError: (err) => {
        isLoading = false;
        error = err;

        if (onError) {
          onError(err);
        }
      },
      onRetry
    }
  );

  return {
    load: () => {
      if (loadedModule) {
        return Promise.resolve(loadedModule);
      }

      if (isLoading) {
        return new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            if (loadedModule) {
              clearInterval(checkInterval);
              resolve(loadedModule);
            } else if (error) {
              clearInterval(checkInterval);
              reject(error);
            }
          }, 50);
        });
      }

      isLoading = true;
      return errorHandler.load();
    },
    retry: errorHandler.retry,
    reset: errorHandler.reset,
    getModule: () => loadedModule,
    isLoaded: () => !!loadedModule,
    isLoading: () => isLoading,
    getError: () => error
  };
}