/**
 * Tests for the Chunk Retry Mechanism
 */

import {
  withRetry,
  createRetryController,
  createRetryQueue
} from './chunk-retry.js';

// Mock the calculateBackoff function to make tests faster
jest.mock('./chunk-error.js', () => ({
  isRetryableError: jest.fn(error => error.retryable !== false),
  calculateBackoff: jest.fn(() => 10) // Always return 10ms for tests
}));

describe('Chunk Retry Mechanism', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('withRetry', () => {
    test('should execute function successfully without retries', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const retryFn = withRetry(fn);

      const result = await retryFn('arg1', 'arg2');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    test('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();
      const retryFn = withRetry(fn, { maxRetries: 3, onRetry });

      const resultPromise = retryFn('arg');

      // Fast-forward through the retries
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    test('should throw after max retries', async () => {
      const error = new Error('Persistent failure');
      const fn = jest.fn().mockRejectedValue(error);

      const retryFn = withRetry(fn, { maxRetries: 2 });

      await expect(async () => {
        const resultPromise = retryFn();
        await jest.runAllTimersAsync();
        return await resultPromise;
      }).rejects.toThrow('Persistent failure');

      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('should not retry non-retryable errors', async () => {
      const error = new Error('Non-retryable');
      error.retryable = false;

      const fn = jest.fn().mockRejectedValue(error);
      const retryFn = withRetry(fn, { maxRetries: 3 });

      await expect(retryFn()).rejects.toThrow('Non-retryable');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    test('should use custom retryable error checker', async () => {
      const error1 = new Error('Retry me');
      error1.code = 'RETRY';

      const error2 = new Error('Do not retry');
      error2.code = 'NO_RETRY';

      const fn = jest.fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2);

      const retryableErrors = jest.fn(error => error.code === 'RETRY');

      const retryFn = withRetry(fn, {
        maxRetries: 3,
        retryableErrors
      });

      await expect(async () => {
        const resultPromise = retryFn();
        await jest.runAllTimersAsync();
        return await resultPromise;
      }).rejects.toThrow('Do not retry');

      expect(fn).toHaveBeenCalledTimes(2); // Initial + 1 retry
      expect(retryableErrors).toHaveBeenCalledTimes(2);
    });

    test('should retry all errors when retryAllErrors is true', async () => {
      const error = new Error('Non-retryable');
      error.retryable = false;

      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const retryFn = withRetry(fn, {
        maxRetries: 3,
        retryAllErrors: true
      });

      const resultPromise = retryFn();
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('createRetryController', () => {
    test('should execute function successfully', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const controller = createRetryController();

      const result = await controller.execute(fn, 'arg');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg');
    });

    test('should track retry state', async () => {
      const error = new Error('Failure');
      const fn = jest.fn().mockRejectedValue(error);

      const controller = createRetryController({ maxRetries: 2 });

      await expect(async () => {
        const resultPromise = controller.execute(fn);
        await jest.runAllTimersAsync();
        return await resultPromise;
      }).rejects.toThrow('Failure');

      const state = controller.getState();
      expect(state.retryCount).toBe(2);
      expect(state.lastError).toBe(error);
      expect(state.isRetrying).toBe(true);
      expect(state.canRetry).toBe(false); // Exceeded max retries
    });

    test('should allow manual retry', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValue('success');

      const controller = createRetryController();

      // First execution fails
      await expect(controller.execute(fn)).rejects.toThrow('Fail 1');

      // Manual retry succeeds
      const result = await controller.retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('should reset retry state', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Failure'));

      const controller = createRetryController();

      await expect(controller.execute(fn)).rejects.toThrow('Failure');

      expect(controller.getState().isRetrying).toBe(true);

      controller.reset();

      expect(controller.getState().isRetrying).toBe(false);
      expect(controller.getState().retryCount).toBe(0);
      expect(controller.getState().lastError).toBe(null);
    });
  });

  describe('createRetryQueue', () => {
    test('should process queue items with concurrency', async () => {
      const fn1 = jest.fn().mockResolvedValue('result1');
      const fn2 = jest.fn().mockResolvedValue('result2');
      const fn3 = jest.fn().mockResolvedValue('result3');

      const queue = createRetryQueue({ concurrency: 2 });

      const promise1 = queue.add(fn1);
      const promise2 = queue.add(fn2);
      const promise3 = queue.add(fn3);

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(1);
    });

    test('should retry failed queue items', async () => {
      const error = new Error('Temporary failure');

      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const onRetry = jest.fn();

      const queue = createRetryQueue({
        maxRetries: 1,
        onRetry
      });

      const resultPromise = queue.add(fn, [], { onRetry });

      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test('should prioritize queue items', async () => {
      const results = [];

      const fn1 = jest.fn().mockImplementation(() => {
        results.push('low');
        return 'low';
      });

      const fn2 = jest.fn().mockImplementation(() => {
        results.push('high');
        return 'high';
      });

      const fn3 = jest.fn().mockImplementation(() => {
        results.push('medium');
        return 'medium';
      });

      const queue = createRetryQueue({ concurrency: 1 });

      // Add in reverse priority order
      queue.add(fn1, [], { priority: 0 });
      queue.add(fn3, [], { priority: 5 });
      queue.add(fn2, [], { priority: 10 });

      await queue.waitForIdle();

      // Should execute in priority order: high, medium, low
      expect(results).toEqual(['high', 'medium', 'low']);
    });

    test('should clear the queue', async () => {
      const fn1 = jest.fn().mockResolvedValue('result1');
      const fn2 = jest.fn().mockImplementation(() => {
        // This will never resolve during the test
        return new Promise(() => { });
      });

      const queue = createRetryQueue({ concurrency: 1 });

      // Start the first function (will be active)
      const promise1 = queue.add(fn2);

      // Add more to the queue
      const promise2 = queue.add(fn1);
      const promise3 = queue.add(fn1);

      // Clear the queue
      const cleared = queue.clear();

      expect(cleared).toBe(2); // Should have cleared 2 items

      await expect(promise2).rejects.toThrow('Queue cleared');
      await expect(promise3).rejects.toThrow('Queue cleared');

      // The active item should still be running
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(queue.getState().activeCount).toBe(1);
    });

    test('should enforce max queue size', async () => {
      const queue = createRetryQueue({ maxSize: 2 });

      const fn = jest.fn().mockResolvedValue('result');

      // Fill the queue
      queue.add(() => new Promise(() => { })); // Will never complete
      queue.add(() => new Promise(() => { })); // Will never complete

      // Try to add one more
      await expect(queue.add(fn)).rejects.toThrow('Retry queue is full');

      expect(fn).not.toHaveBeenCalled();
    });
  });
});