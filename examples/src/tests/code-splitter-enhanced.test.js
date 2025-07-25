/**
 * Tests for the Enhanced Code Splitter with Retry Mechanism
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CodeSplitter,
  createCodeSplitter,
  ChunkError,
  ChunkNetworkError,
  ChunkTimeoutError,
  ChunkPropertyError
} from '../shared/code-splitter-enhanced.js';

// Mock performance.now
global.performance = {
  now: vi.fn(() => Date.now())
};

// Mock AbortController if not available
if (typeof AbortController === 'undefined') {
  global.AbortController = class AbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort(reason) {
      this.signal.aborted = true;
      this.signal.reason = reason;
    }
  };
}

describe('Enhanced Code Splitter', () => {
  let codeSplitter;

  beforeEach(() => {
    codeSplitter = new CodeSplitter({
      maxRetries: 2,
      retryBaseDelay: 10, // Use small delay for tests
      chunkTimeout: 100
    });

    // Mock console methods
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    codeSplitter.destroy();
    vi.resetAllMocks();
  });

  describe('Retry Mechanism', () => {
    it('should retry failed chunk loads', async () => {
      // Mock import function that fails twice then succeeds
      const mockModule = { default: () => 'success' };
      const mockImport = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockModule);

      const result = await codeSplitter.loadChunk(() => mockImport());

      expect(mockImport).toHaveBeenCalledTimes(3);
      expect(result).toBe(mockModule);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Retrying chunk'));
    });

    it('should not retry non-retryable errors', async () => {
      // Create a non-retryable error (property error)
      const propertyError = new ChunkPropertyError('Cannot set property', {
        propertyName: 'data',
        propertyType: 'getter-only'
      });

      const mockImport = vi.fn().mockRejectedValue(propertyError);

      await expect(codeSplitter.loadChunk(() => mockImport())).rejects.toThrow(ChunkPropertyError);
      expect(mockImport).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should respect maxRetries setting', async () => {
      // Create a retryable error (network error)
      const networkError = new ChunkNetworkError('Failed to fetch', {
        statusCode: 503
      });

      const mockImport = vi.fn().mockRejectedValue(networkError);

      await expect(codeSplitter.loadChunk(() => mockImport())).rejects.toThrow(ChunkNetworkError);
      expect(mockImport).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle timeout errors', async () => {
      // Mock a timeout by never resolving the promise
      const mockImport = vi.fn(() => new Promise(() => { }));

      // Reduce timeout for test
      codeSplitter.options.chunkTimeout = 50;

      await expect(codeSplitter.loadChunk(() => mockImport())).rejects.toThrow(ChunkTimeoutError);
    });

    it('should track retry statistics', async () => {
      // Mock import function that fails once then succeeds
      const mockModule = { default: () => 'success' };
      const mockImport = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockModule);

      await codeSplitter.loadChunk(() => mockImport());

      const stats = codeSplitter.getLoadStats();
      expect(stats.retryAttempts).toBeGreaterThan(0);
    });
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', async () => {
      const networkError = new Error('Failed to fetch');
      const mockImport = vi.fn().mockRejectedValue(networkError);

      try {
        await codeSplitter.loadChunk(() => mockImport());
      } catch (error) {
        expect(error).toBeInstanceOf(ChunkError);
        expect(error.phase).toBe('network');
      }
    });

    it('should classify timeout errors correctly', async () => {
      // Mock a timeout
      const mockImport = vi.fn(() => new Promise(() => { }));
      codeSplitter.options.chunkTimeout = 50;

      try {
        await codeSplitter.loadChunk(() => mockImport());
      } catch (error) {
        expect(error).toBeInstanceOf(ChunkTimeoutError);
        expect(error.phase).toBe('timeout');
      }
    });
  });

  describe('Tolerant Error Handling', () => {
    beforeEach(() => {
      // Set up code splitter with tolerant error handling
      codeSplitter = new CodeSplitter({
        errorHandling: 'tolerant',
        maxRetries: 1
      });
    });

    it('should return a fallback module for property errors in tolerant mode', async () => {
      // Create a property error
      const propertyError = new ChunkPropertyError('Cannot set property', {
        propertyName: 'data',
        propertyType: 'getter-only'
      });

      const mockImport = vi.fn().mockRejectedValue(propertyError);

      const result = await codeSplitter.loadChunk(() => mockImport());

      expect(result).toBeDefined();
      expect(result.default).toBeInstanceOf(Function);
      expect(result.__errorMessage).toBeDefined();
      expect(result.__recovered).toBe(false);
    });
  });

  describe('Preloading with Retry', () => {
    it('should retry failed preloads', async () => {
      // Mock import function that fails once then succeeds
      const mockModule = { default: () => 'success' };
      const mockImport = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockModule);

      // Enable preloading
      codeSplitter.options.enablePreloading = true;

      // Start preloading
      codeSplitter.preloadChunk(() => mockImport());

      // Wait for preload to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockImport).toHaveBeenCalledTimes(2);
      expect(codeSplitter.loadedChunks.size).toBe(1);
    });
  });
});