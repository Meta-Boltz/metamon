/**
 * ChunkErrorBoundary Component
 * 
 * A React error boundary component specifically designed to handle chunk loading errors
 * and provide helpful fallback UI with retry functionality.
 */

import React from 'react';
import { ChunkError } from '../utils/chunk-error.js';

/**
 * Default fallback component that displays when a chunk fails to load
 */
export const DefaultChunkErrorFallback = ({
  error,
  retry,
  resetError,
  showDetails = false
}) => {
  const [expanded, setExpanded] = React.useState(false);

  // Get a user-friendly message
  const userMessage = error instanceof ChunkError
    ? error.getUserMessage()
    : 'Failed to load component';

  // Format the error details for display
  const errorDetails = React.useMemo(() => {
    if (!error) return null;

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
  }, [error]);

  return (
    <div className="chunk-error-fallback" role="alert" aria-live="assertive">
      <div className="chunk-error-container">
        <div className="chunk-error-icon">⚠️</div>
        <div className="chunk-error-content">
          <h3 className="chunk-error-title">Component Failed to Load</h3>
          <p className="chunk-error-message">{userMessage}</p>

          {retry && (
            <button
              className="chunk-error-retry-button"
              onClick={retry}
              aria-label="Retry loading the component"
            >
              Try Again
            </button>
          )}

          {showDetails && (
            <div className="chunk-error-details">
              <button
                className="chunk-error-toggle"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                aria-controls="error-details-panel"
              >
                {expanded ? 'Hide Details' : 'Show Details'}
              </button>

              {expanded && (
                <pre
                  id="error-details-panel"
                  className="chunk-error-code"
                >
                  {errorDetails}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
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
      `}</style>
    </div>
  );
};

/**
 * ChunkErrorBoundary component that catches errors from chunk loading
 * and displays a fallback UI
 */
export class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
    this.retryCount = 0;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log the error
    console.error('Chunk loading error caught by boundary:', error);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  retry = () => {
    this.retryCount += 1;
    this.resetError();

    // Call onRetry callback if provided
    if (this.props.onRetry) {
      this.props.onRetry(this.retryCount);
    }
  }

  render() {
    const { children, fallback, showDetails = false, maxRetries = 3 } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      // Use custom fallback if provided, otherwise use default
      const FallbackComponent = fallback || DefaultChunkErrorFallback;

      // Only show retry button if we haven't exceeded max retries
      const canRetry = this.retryCount < maxRetries;

      return (
        <FallbackComponent
          error={error}
          retry={canRetry ? this.retry : undefined}
          resetError={this.resetError}
          showDetails={showDetails}
          retryCount={this.retryCount}
        />
      );
    }

    return children;
  }
}

/**
 * Higher-order component that wraps a component with ChunkErrorBoundary
 */
export const withChunkErrorBoundary = (Component, options = {}) => {
  const WrappedComponent = (props) => (
    <ChunkErrorBoundary {...options}>
      <Component {...props} />
    </ChunkErrorBoundary>
  );

  WrappedComponent.displayName = `withChunkErrorBoundary(${Component.displayName || Component.name || 'Component'
    })`;

  return WrappedComponent;
};

/**
 * Create a lazy-loaded component with error boundary
 */
export const lazyWithErrorBoundary = (importFn, options = {}) => {
  const LazyComponent = React.lazy(importFn);

  const WrappedComponent = (props) => (
    <ChunkErrorBoundary {...options}>
      <React.Suspense fallback={options.suspenseFallback || <div>Loading...</div>}>
        <LazyComponent {...props} />
      </React.Suspense>
    </ChunkErrorBoundary>
  );

  WrappedComponent.displayName = `LazyWithErrorBoundary(${options.displayName || 'Component'
    })`;

  return WrappedComponent;
};