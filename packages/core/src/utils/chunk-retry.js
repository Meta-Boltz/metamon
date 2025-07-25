/**
 * Chunk Retry Mechanism
 * 
 * This module provides utilities for retrying chunk loading operations with
 * configurable backoff strategies to prevent overwhelming the network.
 */

import { isRetryableError, calculateBackoff } from './chunk-error.js';

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 3,
  strategy: 'exponential',
  baseDelay: 1000,
  maxDelay: 30000,
  factor: 2,
  jitter: 0.1,
  onRetry: null,
  retryableErrors: null, // Use default isRetryableError if null
  retryAllErrors: false
};

/**
 * Creates a retry wrapper for any async function
 * 
 * @param {Function} fn - The async function to retry
 * @param {Object} options - Retry options
 * @returns {Function} A wrapped function that will retry on failure
 */
export function withRetry(fn, options = {}) {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

  return async function (...args) {
    let retryCount = 0;
    let lastError = null;

    while (retryCount <= retryOptions.maxRetries) {
      try {
        // If this isn't the first attempt, add a delay before retrying
        if (retryCount > 0) {
          const delay = calculateBackoff(retryCount, {
            baseDelay: retryOptions.baseDelay,
            maxDelay: retryOptions.maxDelay,
            factor: retryOptions.factor,
            jitter: retryOptions.jitter
          });

          // Log retry attempt
          console.log(`Retry attempt ${retryCount}/${retryOptions.maxRetries} after ${delay}ms delay`);

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));

          // Call onRetry callback if provided
          if (retryOptions.onRetry) {
            retryOptions.onRetry(retryCount, lastError, delay);
          }
        }

        // Attempt to execute the function
        return await fn(...args);

      } catch (error) {
        lastError = error;
        retryCount++;

        // Check if we've exceeded max retries
        if (retryCount > retryOptions.maxRetries) {
          console.error(`Max retries (${retryOptions.maxRetries}) exceeded:`, error);
          throw error;
        }

        // Check if the error is retryable
        const shouldRetry = retryOptions.retryAllErrors ||
          (retryOptions.retryableErrors ?
            retryOptions.retryableErrors(error) :
            isRetryableError(error));

        if (!shouldRetry) {
          console.error('Non-retryable error encountered:', error);
          throw error;
        }

        // Continue to next iteration which will retry after delay
      }
    }

    // This should never be reached due to the throw in the catch block
    throw new Error('Unexpected end of retry loop');
  };
}

/**
 * Creates a retry controller for manual retry management
 * 
 * @param {Object} options - Retry options
 * @returns {Object} A retry controller object
 */
export function createRetryController(options = {}) {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let retryCount = 0;
  let lastError = null;
  let isRetrying = false;

  return {
    /**
     * Execute a function with retry logic
     */
    execute: async function (fn, ...args) {
      retryCount = 0;
      lastError = null;
      isRetrying = false;

      return withRetry(fn, {
        ...retryOptions,
        onRetry: (count, error, delay) => {
          retryCount = count;
          lastError = error;
          isRetrying = true;

          if (retryOptions.onRetry) {
            retryOptions.onRetry(count, error, delay);
          }
        }
      })(...args);
    },

    /**
     * Manually retry the last failed operation
     */
    retry: async function (fn, ...args) {
      if (!isRetrying) {
        throw new Error('No failed operation to retry');
      }

      retryCount++;

      if (retryCount > retryOptions.maxRetries) {
        throw new Error(`Max retries (${retryOptions.maxRetries}) exceeded`);
      }

      const delay = calculateBackoff(retryCount, {
        baseDelay: retryOptions.baseDelay,
        maxDelay: retryOptions.maxDelay,
        factor: retryOptions.factor,
        jitter: retryOptions.jitter
      });

      // Log retry attempt
      console.log(`Manual retry attempt ${retryCount}/${retryOptions.maxRetries} after ${delay}ms delay`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Call onRetry callback if provided
      if (retryOptions.onRetry) {
        retryOptions.onRetry(retryCount, lastError, delay);
      }

      try {
        const result = await fn(...args);
        isRetrying = false;
        return result;
      } catch (error) {
        lastError = error;

        // Check if the error is retryable
        const shouldRetry = retryOptions.retryAllErrors ||
          (retryOptions.retryableErrors ?
            retryOptions.retryableErrors(error) :
            isRetryableError(error));

        if (!shouldRetry) {
          isRetrying = false;
          throw error;
        }

        throw error;
      }
    },

    /**
     * Reset the retry state
     */
    reset: function () {
      retryCount = 0;
      lastError = null;
      isRetrying = false;
    },

    /**
     * Get the current retry state
     */
    getState: function () {
      return {
        retryCount,
        lastError,
        isRetrying,
        maxRetries: retryOptions.maxRetries,
        canRetry: isRetrying && retryCount < retryOptions.maxRetries
      };
    }
  };
}

/**
 * Creates a retry queue for managing multiple retry operations
 * 
 * @param {Object} options - Queue options
 * @returns {Object} A retry queue object
 */
export function createRetryQueue(options = {}) {
  const {
    concurrency = 2,
    maxSize = 100,
    ...retryOptions
  } = options;

  const queue = [];
  let activeCount = 0;

  const processNext = async () => {
    if (activeCount >= concurrency || queue.length === 0) {
      return;
    }

    activeCount++;
    const item = queue.shift();

    try {
      const result = await withRetry(item.fn, {
        ...retryOptions,
        onRetry: (count, error, delay) => {
          if (item.onRetry) {
            item.onRetry(count, error, delay);
          }

          if (retryOptions.onRetry) {
            retryOptions.onRetry(count, error, delay, item);
          }
        }
      })(...item.args);

      if (item.resolve) {
        item.resolve(result);
      }
    } catch (error) {
      if (item.reject) {
        item.reject(error);
      }
    } finally {
      activeCount--;
      processNext();
    }
  };

  return {
    /**
     * Add an operation to the retry queue
     */
    add: function (fn, args = [], callbacks = {}) {
      return new Promise((resolve, reject) => {
        if (queue.length >= maxSize) {
          reject(new Error('Retry queue is full'));
          return;
        }

        queue.push({
          fn,
          args,
          resolve,
          reject,
          onRetry: callbacks.onRetry,
          priority: callbacks.priority || 0,
          added: Date.now()
        });

        // Sort queue by priority (higher first) and then by added time
        queue.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return a.added - b.added;
        });

        processNext();
      });
    },

    /**
     * Get the current queue state
     */
    getState: function () {
      return {
        queueLength: queue.length,
        activeCount,
        concurrency,
        maxSize,
        isIdle: activeCount === 0 && queue.length === 0
      };
    },

    /**
     * Clear the queue
     */
    clear: function () {
      const itemCount = queue.length;
      queue.forEach(item => {
        if (item.reject) {
          item.reject(new Error('Queue cleared'));
        }
      });
      queue.length = 0;
      return itemCount;
    },

    /**
     * Wait for all queued operations to complete
     */
    waitForIdle: function () {
      if (activeCount === 0 && queue.length === 0) {
        return Promise.resolve();
      }

      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (activeCount === 0 && queue.length === 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
  };
}