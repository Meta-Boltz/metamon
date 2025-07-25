/**
 * Chunk Error Classification System
 * 
 * This module provides a comprehensive error classification system for chunk loading failures
 * in the Metamon framework. It defines specific error types for different failure scenarios
 * and provides utilities for error handling and diagnostics.
 */

/**
 * Base class for all chunk-related errors
 */
export class ChunkError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();

    // Common properties for all chunk errors
    this.chunkId = options.chunkId || 'unknown';
    this.filePath = options.filePath || 'unknown';
    this.phase = options.phase || 'unknown';
    this.originalError = options.originalError || null;
    this.context = options.context || {};

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Returns a detailed diagnostic report for debugging
   */
  getDiagnosticReport() {
    return {
      error: {
        name: this.name,
        message: this.message,
        chunkId: this.chunkId,
        filePath: this.filePath,
        phase: this.phase,
        timestamp: this.timestamp
      },
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : null,
      context: this.context
    };
  }

  /**
   * Returns a string representation of the error with detailed information
   */
  toString() {
    return `${this.name}: ${this.message} (chunk: ${this.chunkId}, phase: ${this.phase})`;
  }

  /**
   * Returns a user-friendly error message suitable for display
   */
  getUserMessage() {
    return `Failed to load component: ${this.message}`;
  }
}

/**
 * Error thrown when a network failure occurs during chunk loading
 */
export class ChunkNetworkError extends ChunkError {
  constructor(message, options = {}) {
    super(message, { ...options, phase: 'network' });
    this.statusCode = options.statusCode;
    this.url = options.url;
  }

  getUserMessage() {
    if (this.statusCode === 404) {
      return `Component not found (404). The requested component "${this.chunkId}" could not be located.`;
    } else if (this.statusCode >= 500) {
      return `Server error while loading component. Please try again later.`;
    }
    return `Network error while loading component. Please check your connection.`;
  }
}

/**
 * Error thrown when a chunk fails to parse
 */
export class ChunkParseError extends ChunkError {
  constructor(message, options = {}) {
    super(message, { ...options, phase: 'parse' });
    this.syntaxError = options.syntaxError;
    this.position = options.position;
  }

  getUserMessage() {
    return `Failed to process component code. This is likely a bug in the framework.`;
  }
}

/**
 * Error thrown when a chunk fails during execution
 */
export class ChunkExecutionError extends ChunkError {
  constructor(message, options = {}) {
    super(message, { ...options, phase: 'execute' });
    this.functionName = options.functionName;
    this.lineNumber = options.lineNumber;
  }

  getUserMessage() {
    return `Error in component code. Please check the browser console for details.`;
  }
}

/**
 * Error thrown when a property descriptor conflict occurs
 */
export class ChunkPropertyError extends ChunkError {
  constructor(message, options = {}) {
    super(message, { ...options, phase: 'property' });
    this.propertyName = options.propertyName;
    this.propertyType = options.propertyType || 'unknown';
  }

  getUserMessage() {
    return `Component loading failed due to a property conflict. This is likely a bug in the framework.`;
  }
}

/**
 * Error thrown when a chunk load times out
 */
export class ChunkTimeoutError extends ChunkError {
  constructor(message, options = {}) {
    super(message, { ...options, phase: 'timeout' });
    this.timeoutMs = options.timeoutMs;
  }

  getUserMessage() {
    return `Component loading timed out after ${this.timeoutMs}ms. Please check your network connection.`;
  }
}

/**
 * Error thrown when a chunk has an invalid module structure
 */
export class ChunkInvalidModuleError extends ChunkError {
  constructor(message, options = {}) {
    super(message, { ...options, phase: 'validation' });
    this.expectedExports = options.expectedExports;
    this.actualExports = options.actualExports;
  }

  getUserMessage() {
    return `Component has an invalid structure. This is likely a bug in the framework.`;
  }
}

/**
 * Error thrown when a chunk load is aborted
 */
export class ChunkAbortError extends ChunkError {
  constructor(message, options = {}) {
    super(message, { ...options, phase: 'abort' });
    this.reason = options.reason;
  }

  getUserMessage() {
    return `Component loading was cancelled.`;
  }
}

/**
 * Utility function to classify an error based on its characteristics
 * @param {Error} error - The original error
 * @param {Object} context - Additional context information
 * @returns {ChunkError} A classified chunk error
 */
export function classifyChunkError(error, context = {}) {
  const { chunkId, filePath } = context;
  const message = error.message || 'Unknown chunk loading error';

  // Check for network errors
  if (error.name === 'TypeError' && message.includes('Failed to fetch') ||
    error.name === 'NetworkError' ||
    error instanceof TypeError && message.includes('network') ||
    error.status === 404 || error.status >= 500) {
    return new ChunkNetworkError(
      `Network error loading chunk: ${message}`,
      {
        chunkId,
        filePath,
        originalError: error,
        statusCode: error.status || 0,
        url: context.url,
        context
      }
    );
  }

  // Check for parse errors
  if (error.name === 'SyntaxError' ||
    message.includes('Unexpected token') ||
    message.includes('syntax error')) {
    return new ChunkParseError(
      `Failed to parse chunk: ${message}`,
      {
        chunkId,
        filePath,
        originalError: error,
        syntaxError: error.message,
        position: error.lineNumber ? `${error.lineNumber}:${error.columnNumber}` : 'unknown',
        context
      }
    );
  }

  // Check for property descriptor errors
  if (message.includes('getter') ||
    message.includes('set property') ||
    message.includes('read only property') ||
    message.includes('which has only a getter')) {
    // Extract property name from error message if possible
    const propertyMatch = message.match(/property\s+([^\s]+)\s+of/);
    const propertyName = propertyMatch ? propertyMatch[1] : 'unknown';

    return new ChunkPropertyError(
      `Property descriptor conflict: ${message}`,
      {
        chunkId,
        filePath,
        originalError: error,
        propertyName,
        propertyType: 'getter-only',
        context
      }
    );
  }

  // Check for timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return new ChunkTimeoutError(
      `Chunk loading timed out: ${message}`,
      {
        chunkId,
        filePath,
        originalError: error,
        timeoutMs: context.timeout || 10000,
        context
      }
    );
  }

  // Check for invalid module errors
  if (message.includes('Invalid module') ||
    message.includes('is not a function') ||
    message.includes('is not a constructor')) {
    return new ChunkInvalidModuleError(
      `Invalid module structure: ${message}`,
      {
        chunkId,
        filePath,
        originalError: error,
        expectedExports: context.expectedExports,
        actualExports: context.actualExports,
        context
      }
    );
  }

  // Check for abort errors
  if (error.name === 'AbortError' || message.includes('aborted')) {
    return new ChunkAbortError(
      `Chunk loading aborted: ${message}`,
      {
        chunkId,
        filePath,
        originalError: error,
        reason: context.abortReason || 'unknown',
        context
      }
    );
  }

  // Default to base ChunkError for unclassified errors
  return new ChunkError(
    `Chunk loading failed: ${message}`,
    {
      chunkId,
      filePath,
      phase: 'unknown',
      originalError: error,
      context
    }
  );
}

/**
 * Collects diagnostic information about the current environment
 * @returns {Object} Diagnostic information
 */
export function collectDiagnostics() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: typeof window !== 'undefined' ? 'browser' : 'node'
  };

  // Browser-specific diagnostics
  if (typeof window !== 'undefined') {
    diagnostics.browser = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    // Connection information if available
    if (navigator.connection) {
      diagnostics.connection = {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      };
    }

    // Performance metrics if available
    if (window.performance) {
      const navigationTiming = performance.getEntriesByType('navigation')[0];
      if (navigationTiming) {
        diagnostics.performance = {
          loadTime: navigationTiming.loadEventEnd - navigationTiming.startTime,
          domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.startTime,
          timeToFirstByte: navigationTiming.responseStart - navigationTiming.requestStart,
          redirectTime: navigationTiming.redirectEnd - navigationTiming.redirectStart,
          dnsLookupTime: navigationTiming.domainLookupEnd - navigationTiming.domainLookupStart,
          tcpConnectTime: navigationTiming.connectEnd - navigationTiming.connectStart
        };
      }
    }
  } else {
    // Node.js specific diagnostics
    diagnostics.node = {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage()
    };
  }

  return diagnostics;
}

/**
 * Creates a detailed error report for logging or telemetry
 * @param {ChunkError} error - The chunk error
 * @returns {Object} Detailed error report
 */
export function createErrorReport(error) {
  return {
    ...error.getDiagnosticReport(),
    diagnostics: collectDiagnostics()
  };
}

/**
 * Determines if an error is retryable
 * @param {ChunkError} error - The chunk error
 * @returns {boolean} Whether the error is retryable
 */
export function isRetryableError(error) {
  // Network errors are generally retryable
  if (error instanceof ChunkNetworkError) {
    // Don't retry 404s
    if (error.statusCode === 404) return false;
    return true;
  }

  // Timeout errors are retryable
  if (error instanceof ChunkTimeoutError) {
    return true;
  }

  // Property errors are not retryable without code changes
  if (error instanceof ChunkPropertyError) {
    return false;
  }

  // Parse errors are not retryable without code changes
  if (error instanceof ChunkParseError) {
    return false;
  }

  // Execution errors might be retryable if they're due to race conditions
  if (error instanceof ChunkExecutionError) {
    return false;
  }

  // Invalid module errors are not retryable without code changes
  if (error instanceof ChunkInvalidModuleError) {
    return false;
  }

  // By default, don't retry
  return false;
}

/**
 * Calculates the delay for the next retry attempt using exponential backoff
 * @param {number} attempt - The current attempt number (1-based)
 * @param {Object} options - Backoff options
 * @returns {number} The delay in milliseconds
 */
export function calculateBackoff(attempt, options = {}) {
  const {
    baseDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    jitter = 0.1
  } = options;

  // Calculate exponential backoff
  let delay = Math.min(baseDelay * Math.pow(factor, attempt - 1), maxDelay);

  // Add jitter to prevent thundering herd problem
  if (jitter > 0) {
    const randomFactor = 1 - jitter + (Math.random() * jitter * 2);
    delay = delay * randomFactor;
  }

  return Math.floor(delay);
}