/**
 * Tests for the Chunk Error Classification System
 */

import {
  ChunkError,
  ChunkNetworkError,
  ChunkParseError,
  ChunkExecutionError,
  ChunkPropertyError,
  ChunkTimeoutError,
  ChunkInvalidModuleError,
  ChunkAbortError,
  classifyChunkError,
  isRetryableError,
  calculateBackoff
} from './chunk-error.js';

describe('Chunk Error Classification System', () => {
  describe('Base ChunkError', () => {
    test('should create a basic chunk error with default values', () => {
      const error = new ChunkError('Test error');

      expect(error.name).toBe('ChunkError');
      expect(error.message).toBe('Test error');
      expect(error.chunkId).toBe('unknown');
      expect(error.filePath).toBe('unknown');
      expect(error.phase).toBe('unknown');
      expect(error.originalError).toBeNull();
    });

    test('should create a chunk error with custom values', () => {
      const originalError = new Error('Original error');
      const error = new ChunkError('Test error', {
        chunkId: 'test-chunk',
        filePath: '/path/to/chunk.js',
        phase: 'load',
        originalError,
        context: { test: true }
      });

      expect(error.chunkId).toBe('test-chunk');
      expect(error.filePath).toBe('/path/to/chunk.js');
      expect(error.phase).toBe('load');
      expect(error.originalError).toBe(originalError);
      expect(error.context).toEqual({ test: true });
    });

    test('should generate a diagnostic report', () => {
      const originalError = new Error('Original error');
      const error = new ChunkError('Test error', {
        chunkId: 'test-chunk',
        filePath: '/path/to/chunk.js',
        phase: 'load',
        originalError,
        context: { test: true }
      });

      const report = error.getDiagnosticReport();

      expect(report.error.name).toBe('ChunkError');
      expect(report.error.message).toBe('Test error');
      expect(report.error.chunkId).toBe('test-chunk');
      expect(report.error.filePath).toBe('/path/to/chunk.js');
      expect(report.error.phase).toBe('load');
      expect(report.originalError.name).toBe('Error');
      expect(report.originalError.message).toBe('Original error');
      expect(report.context).toEqual({ test: true });
    });

    test('should have a string representation', () => {
      const error = new ChunkError('Test error', {
        chunkId: 'test-chunk',
        phase: 'load'
      });

      expect(error.toString()).toBe('ChunkError: Test error (chunk: test-chunk, phase: load)');
    });

    test('should have a user-friendly message', () => {
      const error = new ChunkError('Test error');
      expect(error.getUserMessage()).toBe('Failed to load component: Test error');
    });
  });

  describe('Specialized Chunk Errors', () => {
    test('should create a ChunkNetworkError', () => {
      const error = new ChunkNetworkError('Network failure', {
        chunkId: 'test-chunk',
        statusCode: 404,
        url: 'https://example.com/chunk.js'
      });

      expect(error.name).toBe('ChunkNetworkError');
      expect(error.phase).toBe('network');
      expect(error.statusCode).toBe(404);
      expect(error.url).toBe('https://example.com/chunk.js');
      expect(error.getUserMessage()).toBe('Component not found (404). The requested component "test-chunk" could not be located.');
    });

    test('should create a ChunkParseError', () => {
      const error = new ChunkParseError('Parse failure', {
        chunkId: 'test-chunk',
        syntaxError: 'Unexpected token',
        position: '10:15'
      });

      expect(error.name).toBe('ChunkParseError');
      expect(error.phase).toBe('parse');
      expect(error.syntaxError).toBe('Unexpected token');
      expect(error.position).toBe('10:15');
      expect(error.getUserMessage()).toBe('Failed to process component code. This is likely a bug in the framework.');
    });

    test('should create a ChunkExecutionError', () => {
      const error = new ChunkExecutionError('Execution failure', {
        chunkId: 'test-chunk',
        functionName: 'render',
        lineNumber: 42
      });

      expect(error.name).toBe('ChunkExecutionError');
      expect(error.phase).toBe('execute');
      expect(error.functionName).toBe('render');
      expect(error.lineNumber).toBe(42);
      expect(error.getUserMessage()).toBe('Error in component code. Please check the browser console for details.');
    });

    test('should create a ChunkPropertyError', () => {
      const error = new ChunkPropertyError('Property descriptor conflict', {
        chunkId: 'test-chunk',
        propertyName: 'data',
        propertyType: 'getter-only'
      });

      expect(error.name).toBe('ChunkPropertyError');
      expect(error.phase).toBe('property');
      expect(error.propertyName).toBe('data');
      expect(error.propertyType).toBe('getter-only');
      expect(error.getUserMessage()).toBe('Component loading failed due to a property conflict. This is likely a bug in the framework.');
    });

    test('should create a ChunkTimeoutError', () => {
      const error = new ChunkTimeoutError('Loading timed out', {
        chunkId: 'test-chunk',
        timeoutMs: 5000
      });

      expect(error.name).toBe('ChunkTimeoutError');
      expect(error.phase).toBe('timeout');
      expect(error.timeoutMs).toBe(5000);
      expect(error.getUserMessage()).toBe('Component loading timed out after 5000ms. Please check your network connection.');
    });

    test('should create a ChunkInvalidModuleError', () => {
      const error = new ChunkInvalidModuleError('Invalid module structure', {
        chunkId: 'test-chunk',
        expectedExports: ['default'],
        actualExports: []
      });

      expect(error.name).toBe('ChunkInvalidModuleError');
      expect(error.phase).toBe('validation');
      expect(error.expectedExports).toEqual(['default']);
      expect(error.actualExports).toEqual([]);
      expect(error.getUserMessage()).toBe('Component has an invalid structure. This is likely a bug in the framework.');
    });

    test('should create a ChunkAbortError', () => {
      const error = new ChunkAbortError('Loading aborted', {
        chunkId: 'test-chunk',
        reason: 'navigation'
      });

      expect(error.name).toBe('ChunkAbortError');
      expect(error.phase).toBe('abort');
      expect(error.reason).toBe('navigation');
      expect(error.getUserMessage()).toBe('Component loading was cancelled.');
    });
  });

  describe('Error Classification', () => {
    test('should classify a network error', () => {
      const originalError = new TypeError('Failed to fetch');
      const classifiedError = classifyChunkError(originalError, {
        chunkId: 'test-chunk',
        url: 'https://example.com/chunk.js'
      });

      expect(classifiedError).toBeInstanceOf(ChunkNetworkError);
      expect(classifiedError.chunkId).toBe('test-chunk');
      expect(classifiedError.url).toBe('https://example.com/chunk.js');
    });

    test('should classify a parse error', () => {
      const originalError = new SyntaxError('Unexpected token {');
      const classifiedError = classifyChunkError(originalError, {
        chunkId: 'test-chunk'
      });

      expect(classifiedError).toBeInstanceOf(ChunkParseError);
      expect(classifiedError.chunkId).toBe('test-chunk');
    });

    test('should classify a property descriptor error', () => {
      const originalError = new TypeError('Cannot set property data of #<Object> which has only a getter');
      const classifiedError = classifyChunkError(originalError, {
        chunkId: 'test-chunk'
      });

      expect(classifiedError).toBeInstanceOf(ChunkPropertyError);
      expect(classifiedError.chunkId).toBe('test-chunk');
      expect(classifiedError.propertyName).toBe('data');
    });

    test('should classify a timeout error', () => {
      const originalError = new Error('Chunk load timed out');
      const classifiedError = classifyChunkError(originalError, {
        chunkId: 'test-chunk',
        timeout: 10000
      });

      expect(classifiedError).toBeInstanceOf(ChunkTimeoutError);
      expect(classifiedError.chunkId).toBe('test-chunk');
      expect(classifiedError.timeoutMs).toBe(10000);
    });

    test('should classify an invalid module error', () => {
      const originalError = new Error('Invalid module: missing default export');
      const classifiedError = classifyChunkError(originalError, {
        chunkId: 'test-chunk',
        expectedExports: ['default'],
        actualExports: []
      });

      expect(classifiedError).toBeInstanceOf(ChunkInvalidModuleError);
      expect(classifiedError.chunkId).toBe('test-chunk');
    });

    test('should classify an abort error', () => {
      const originalError = new Error('aborted');
      originalError.name = 'AbortError';
      const classifiedError = classifyChunkError(originalError, {
        chunkId: 'test-chunk',
        abortReason: 'navigation'
      });

      expect(classifiedError).toBeInstanceOf(ChunkAbortError);
      expect(classifiedError.chunkId).toBe('test-chunk');
      expect(classifiedError.reason).toBe('navigation');
    });

    test('should use default classification for unknown errors', () => {
      const originalError = new Error('Unknown error');
      const classifiedError = classifyChunkError(originalError, {
        chunkId: 'test-chunk'
      });

      expect(classifiedError).toBeInstanceOf(ChunkError);
      expect(classifiedError.chunkId).toBe('test-chunk');
    });
  });

  describe('Retry Utilities', () => {
    test('should identify retryable errors', () => {
      const networkError = new ChunkNetworkError('Network error', { statusCode: 503 });
      const timeoutError = new ChunkTimeoutError('Timeout error');
      const parseError = new ChunkParseError('Parse error');
      const propertyError = new ChunkPropertyError('Property error');

      expect(isRetryableError(networkError)).toBe(true);
      expect(isRetryableError(timeoutError)).toBe(true);
      expect(isRetryableError(parseError)).toBe(false);
      expect(isRetryableError(propertyError)).toBe(false);

      // 404 errors should not be retried
      const notFoundError = new ChunkNetworkError('Not found', { statusCode: 404 });
      expect(isRetryableError(notFoundError)).toBe(false);
    });

    test('should calculate backoff with exponential strategy', () => {
      const options = {
        baseDelay: 1000,
        maxDelay: 30000,
        factor: 2,
        jitter: 0
      };

      expect(calculateBackoff(1, options)).toBe(1000);
      expect(calculateBackoff(2, options)).toBe(2000);
      expect(calculateBackoff(3, options)).toBe(4000);
      expect(calculateBackoff(4, options)).toBe(8000);
      expect(calculateBackoff(5, options)).toBe(16000);

      // Should respect max delay
      expect(calculateBackoff(10, options)).toBe(30000);
    });

    test('should add jitter to backoff', () => {
      const options = {
        baseDelay: 1000,
        factor: 1,
        jitter: 0.5
      };

      // With 50% jitter, the value should be between 500 and 1500
      const delay = calculateBackoff(1, options);
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1500);
    });
  });
});