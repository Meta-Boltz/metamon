/**
 * Tests for the React ChunkErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ChunkErrorBoundary,
  DefaultChunkErrorFallback,
  withChunkErrorBoundary,
  lazyWithErrorBoundary
} from './ChunkErrorBoundary.jsx';
import { ChunkError, ChunkNetworkError } from '../utils/chunk-error.js';

// Mock React.lazy since we can't use it in Jest
jest.mock('react', () => {
  const originalReact = jest.requireActual('react');
  return {
    ...originalReact,
    lazy: (importFn) => {
      return function LazyComponent(props) {
        const [Component, setComponent] = originalReact.useState(null);
        const [error, setError] = originalReact.useState(null);

        originalReact.useEffect(() => {
          importFn()
            .then(module => setComponent(() => module.default))
            .catch(err => setError(err));
        }, []);

        if (error) throw error;
        if (!Component) return null;
        return <Component {...props} />;
      };
    },
    Suspense: ({ children, fallback }) => {
      return children;
    }
  };
});

describe('ChunkErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console errors during tests
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('renders children when there is no error', () => {
    render(
      <ChunkErrorBoundary>
        <div data-testid="child">Child Content</div>
      </ChunkErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  test('renders fallback when there is an error', () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ChunkErrorBoundary>
        <ErrorComponent />
      </ChunkErrorBoundary>
    );

    expect(screen.getByText('Component Failed to Load')).toBeInTheDocument();
  });

  test('renders custom fallback when provided', () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    const CustomFallback = ({ error }) => (
      <div data-testid="custom-fallback">Custom Error: {error.message}</div>
    );

    render(
      <ChunkErrorBoundary fallback={CustomFallback}>
        <ErrorComponent />
      </ChunkErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom Error: Test error')).toBeInTheDocument();
  });

  test('allows retry when error occurs', () => {
    let shouldThrow = true;

    const ToggleErrorComponent = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div data-testid="recovered">Recovered</div>;
    };

    render(
      <ChunkErrorBoundary>
        <ToggleErrorComponent />
      </ChunkErrorBoundary>
    );

    // Initially shows error
    expect(screen.getByText('Component Failed to Load')).toBeInTheDocument();

    // Update the component to not throw
    shouldThrow = false;

    // Click retry button
    fireEvent.click(screen.getByText('Try Again'));

    // Should show recovered content
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
  });

  test('shows error details when expanded', () => {
    const ErrorComponent = () => {
      throw new ChunkNetworkError('Failed to load chunk', {
        chunkId: 'test-chunk',
        statusCode: 404
      });
    };

    render(
      <ChunkErrorBoundary showDetails={true}>
        <ErrorComponent />
      </ChunkErrorBoundary>
    );

    // Initially details are hidden
    expect(screen.queryByText(/"chunkId": "test-chunk"/)).not.toBeInTheDocument();

    // Click show details button
    fireEvent.click(screen.getByText('Show Details'));

    // Should show error details
    expect(screen.getByText(/"chunkId": "test-chunk"/)).toBeInTheDocument();
  });

  test('withChunkErrorBoundary HOC wraps component with error boundary', () => {
    const TestComponent = () => {
      throw new Error('Test error');
    };

    const WrappedComponent = withChunkErrorBoundary(TestComponent);

    render(<WrappedComponent />);

    expect(screen.getByText('Component Failed to Load')).toBeInTheDocument();
  });

  test('lazyWithErrorBoundary creates lazy component with error handling', async () => {
    // Mock successful import
    const successImport = () => Promise.resolve({
      default: () => <div data-testid="lazy-loaded">Lazy Loaded</div>
    });

    const LazyComponent = lazyWithErrorBoundary(successImport);

    render(<LazyComponent />);

    // Wait for lazy component to load
    await screen.findByTestId('lazy-loaded');

    expect(screen.getByTestId('lazy-loaded')).toBeInTheDocument();
  });

  test('lazyWithErrorBoundary handles import errors', async () => {
    // Mock failed import
    const failedImport = () => Promise.reject(
      new ChunkNetworkError('Failed to load chunk', { statusCode: 404 })
    );

    const LazyComponent = lazyWithErrorBoundary(failedImport);

    render(<LazyComponent />);

    // Wait for error boundary to catch error
    await screen.findByText('Component Failed to Load');

    expect(screen.getByText('Component Failed to Load')).toBeInTheDocument();
  });
});