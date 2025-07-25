/**
 * Tests for the Vanilla JS Chunk Error Fallback component
 */

import {
  createChunkErrorFallback,
  createChunkErrorHandler,
  createLazyLoader
} from './ChunkErrorFallback.js';
import { ChunkError, ChunkNetworkError } from '../utils/chunk-error.js';

// Mock DOM elements and methods
const mockElement = {
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  setAttribute: jest.fn(),
  addEventListener: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  style: {},
  parentNode: null,
  innerHTML: '',
  className: ''
};

global.document = {
  createElement: jest.fn(() => ({ ...mockElement })),
  getElementById: jest.fn(() => null),
  head: { ...mockElement },
  body: { ...mockElement }
};

describe('ChunkErrorFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createChunkErrorFallback', () => {
    test('creates a fallback element with error message', () => {
      const error = new ChunkError('Test error', { chunkId: 'test-chunk' });
      const fallbackEl = createChunkErrorFallback({ error });

      expect(fallbackEl.className).toContain('chunk-error-fallback');
      expect(fallbackEl.innerHTML).toContain('Component Failed to Load');
      expect(fallbackEl.innerHTML).toContain('Test error');
    });

    test('includes retry button when retry function is provided', () => {
      const retry = jest.fn();
      const fallbackEl = createChunkErrorFallback({ retry });

      expect(fallbackEl.innerHTML).toContain('Try Again');

      // Simulate click on retry button
      const mockRetryButton = { addEventListener: jest.fn() };
      document.createElement.mockReturnValueOnce(mockRetryButton);
      fallbackEl.querySelector.mockReturnValueOnce(mockRetryButton);

      // Trigger the click handler
      const clickHandler = mockRetryButton.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(retry).toHaveBeenCalled();
    });

    test('includes details section when showDetails is true', () => {
      const error = new ChunkNetworkError('Network error', {
        chunkId: 'test-chunk',
        statusCode: 404
      });

      const fallbackEl = createChunkErrorFallback({
        error,
        showDetails: true
      });

      expect(fallbackEl.innerHTML).toContain('Show Details');
      expect(fallbackEl.innerHTML).toContain('error-details-panel');
    });

    test('appends to container when provided', () => {
      const container = { ...mockElement };
      createChunkErrorFallback({ container });

      expect(container.appendChild).toHaveBeenCalled();
    });
  });

  describe('createChunkErrorHandler', () => {
    test('handles successful loading', async () => {
      const loaderFn = jest.fn().mockResolvedValue('success');
      const handler = createChunkErrorHandler(loaderFn);

      const result = await handler.load();

      expect(result).toBe('success');
      expect(loaderFn).toHaveBeenCalledTimes(1);
    });

    test('handles loading errors', async () => {
      const error = new Error('Load failed');
      const loaderFn = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();

      const handler = createChunkErrorHandler(loaderFn, { onError });

      const result = await handler.load();

      expect(result).toBeInstanceOf(HTMLElement);
      expect(onError).toHaveBeenCalledWith(error);
      expect(document.createElement).toHaveBeenCalled();
    });

    test('allows retrying after failure', async () => {
      const error = new Error('First attempt failed');
      const loaderFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const handler = createChunkErrorHandler(loaderFn, { maxRetries: 3 });

      // First attempt fails
      await handler.load();

      // Retry should succeed
      const result = await handler.retry();

      expect(result).toBe('success');
      expect(loaderFn).toHaveBeenCalledTimes(2);
    });

    test('respects maxRetries limit', async () => {
      const loaderFn = jest.fn().mockRejectedValue(new Error('Always fails'));
      const handler = createChunkErrorHandler(loaderFn, { maxRetries: 1 });

      // First attempt
      await handler.load();

      // First retry
      await handler.retry();

      // Second retry should fail
      await expect(handler.retry()).rejects.toThrow('Maximum retry count exceeded');
    });

    test('reset clears error state', async () => {
      const error = new Error('Load failed');
      const loaderFn = jest.fn().mockRejectedValue(error);

      const handler = createChunkErrorHandler(loaderFn);

      // Create fallback element
      const fallbackEl = { parentNode: { removeChild: jest.fn() } };
      document.createElement.mockReturnValueOnce(fallbackEl);

      await handler.load();

      handler.reset();

      // Should have removed the fallback element
      expect(fallbackEl.parentNode.removeChild).toHaveBeenCalledWith(fallbackEl);
    });
  });

  describe('createLazyLoader', () => {
    test('loads module on demand', async () => {
      const module = { default: () => 'component' };
      const importFn = jest.fn().mockResolvedValue(module);
      const onLoad = jest.fn();

      const lazyLoader = createLazyLoader(importFn, { onLoad });

      expect(lazyLoader.isLoaded()).toBe(false);

      const result = await lazyLoader.load();

      expect(result).toBe(module);
      expect(lazyLoader.isLoaded()).toBe(true);
      expect(lazyLoader.getModule()).toBe(module);
      expect(onLoad).toHaveBeenCalledWith(module);
    });

    test('caches loaded module', async () => {
      const module = { default: () => 'component' };
      const importFn = jest.fn().mockResolvedValue(module);

      const lazyLoader = createLazyLoader(importFn);

      // First load
      await lazyLoader.load();

      // Second load should use cached result
      await lazyLoader.load();

      expect(importFn).toHaveBeenCalledTimes(1);
    });

    test('handles loading errors', async () => {
      const error = new Error('Import failed');
      const importFn = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();

      const lazyLoader = createLazyLoader(importFn, { onError });

      await expect(lazyLoader.load()).rejects.toThrow();

      expect(lazyLoader.isLoaded()).toBe(false);
      expect(lazyLoader.getError()).toBe(error);
      expect(onError).toHaveBeenCalledWith(error);
    });

    test('allows retrying after failure', async () => {
      const error = new Error('First attempt failed');
      const module = { default: () => 'component' };

      const importFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(module);

      const lazyLoader = createLazyLoader(importFn);

      // First attempt fails
      try {
        await lazyLoader.load();
      } catch (e) {
        // Expected error
      }

      // Retry should succeed
      const result = await lazyLoader.retry();

      expect(result).toBe(module);
      expect(lazyLoader.isLoaded()).toBe(true);
    });
  });
});