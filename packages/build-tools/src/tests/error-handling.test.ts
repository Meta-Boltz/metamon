/**
 * Tests for Error Handling Components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorCategorizer } from '../error-categorizer.js';
import { ErrorRecoveryManager } from '../error-recovery-manager.js';
import type { ReloadError, ErrorPattern } from '../types/error-handling.js';

describe('ErrorCategorizer', () => {
  let categorizer: ErrorCategorizer;

  beforeEach(() => {
    categorizer = new ErrorCategorizer();
  });

  describe('categorizeError', () => {
    it('should categorize syntax errors correctly', () => {
      const error = new Error('Unexpected token }');
      const result = categorizer.categorizeError(error, '/test/file.mtm');

      expect(result.type).toBe('syntax_error');
      expect(result.filePath).toBe('/test/file.mtm');
      expect(result.recoverable).toBe(true);
      expect(result.suggestion).toContain('brackets');
    });

    it('should categorize import errors correctly', () => {
      const error = new Error('Cannot resolve module "./missing-file"');
      const result = categorizer.categorizeError(error, '/test/file.mtm');

      expect(result.type).toBe('import_error');
      expect(result.recoverable).toBe(true);
      expect(result.suggestion).toContain('imported file exists');
    });

    it('should categorize MTM frontmatter errors correctly', () => {
      const error = new Error('Invalid frontmatter: YAML parse error');
      const result = categorizer.categorizeError(error, '/test/file.mtm');

      expect(result.type).toBe('compilation_error');
      expect(result.suggestion).toContain('frontmatter syntax');
    });

    it('should extract line and column information', () => {
      const error = new Error('Syntax error at line 15:23');
      const result = categorizer.categorizeError(error, '/test/file.mtm');

      expect(result.line).toBe(15);
      expect(result.column).toBe(23);
    });

    it('should handle string error messages', () => {
      const result = categorizer.categorizeError('Compilation failed', '/test/file.mtm');

      expect(result.type).toBe('compilation_error');
      expect(result.message).toContain('Compilation failed');
      expect(result.recoverable).toBe(true);
    });

    it('should provide generic suggestions for unknown errors', () => {
      const error = new Error('Some unknown error occurred');
      const result = categorizer.categorizeError(error, '/test/file.mtm');

      expect(result.suggestion).toContain('Review the error message');
    });
  });

  describe('pattern management', () => {
    it('should allow adding custom patterns', () => {
      const customPattern: ErrorPattern = {
        pattern: /custom error/i,
        type: 'compilation_error',
        category: 'Custom',
        severity: 'high',
        recoverable: true,
        suggestion: 'Fix the custom error'
      };

      categorizer.addPattern(customPattern);

      const error = new Error('Custom error occurred');
      const result = categorizer.categorizeError(error, '/test/file.mtm');

      expect(result.suggestion).toBe('Fix the custom error');
    });

    it('should allow removing patterns', () => {
      // First, verify the pattern exists
      const error = new Error('Unexpected token }');
      const beforeResult = categorizer.categorizeError(error, '/test/file.mtm');
      expect(beforeResult.type).toBe('syntax_error');

      // Remove the pattern
      const patternToRemove = /Unexpected token|Unexpected end of input|Expected/i;
      categorizer.removePattern(patternToRemove);

      // Now it should fall back to generic categorization
      const afterResult = categorizer.categorizeError(error, '/test/file.mtm');
      expect(afterResult.type).toBe('compilation_error');
    });
  });

  describe('error statistics', () => {
    it('should generate error statistics by category', () => {
      const errors: ReloadError[] = [
        {
          type: 'syntax_error',
          filePath: '/test/file1.mtm',
          message: 'Syntax error',
          recoverable: true
        },
        {
          type: 'import_error',
          filePath: '/test/file2.mtm',
          message: 'Import error',
          recoverable: true
        },
        {
          type: 'syntax_error',
          filePath: '/test/file3.mtm',
          message: 'Another syntax error',
          recoverable: true
        }
      ];

      const stats = categorizer.getErrorStats(errors);

      expect(stats['Syntax']).toBe(2);
      expect(stats['Dependencies']).toBe(1);
    });
  });
});

describe('ErrorRecoveryManager', () => {
  let recoveryManager: ErrorRecoveryManager;
  let mockStateSnapshot: any;

  beforeEach(() => {
    recoveryManager = new ErrorRecoveryManager({
      enableStateRollback: true,
      maxRetryAttempts: 3,
      retryDelay: 100,
      fallbackToLastGoodState: true
    });

    mockStateSnapshot = {
      signals: new Map(),
      subscriptions: new Map(),
      components: new Map(),
      timestamp: Date.now()
    };
  });

  afterEach(() => {
    recoveryManager.cleanup();
  });

  describe('state management', () => {
    it('should record good state snapshots', () => {
      recoveryManager.recordGoodState(mockStateSnapshot);

      const stats = recoveryManager.getRecoveryStats();
      expect(stats.hasLastGoodState).toBe(true);
      expect(stats.failureCount).toBe(0);
    });

    it('should reset failure count on successful state recording', () => {
      // Simulate some failures first
      const error: ReloadError = {
        type: 'compilation_error',
        filePath: '/test/file.mtm',
        message: 'Test error',
        recoverable: true
      };

      // This will increment failure count
      recoveryManager.attemptRecovery(error);

      // Recording good state should reset failure count
      recoveryManager.recordGoodState(mockStateSnapshot);

      const stats = recoveryManager.getRecoveryStats();
      expect(stats.failureCount).toBe(0);
    });
  });

  describe('recovery attempts', () => {
    it('should not attempt recovery for non-recoverable errors', async () => {
      const error: ReloadError = {
        type: 'compilation_error',
        filePath: '/test/file.mtm',
        message: 'Critical error',
        recoverable: false
      };

      const result = await recoveryManager.attemptRecovery(error);
      expect(result).toBe(false);
    });

    it('should not attempt recovery when already recovering', async () => {
      const error: ReloadError = {
        type: 'compilation_error',
        filePath: '/test/file.mtm',
        message: 'Test error',
        recoverable: true
      };

      // Mock the recovery to take longer
      recoveryManager.registerRecoveryCallback('genericRetry', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Start first recovery (will be slow due to delay)
      const firstRecoveryPromise = recoveryManager.attemptRecovery(error);

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Try second recovery while first is in progress
      const secondRecovery = await recoveryManager.attemptRecovery(error);

      expect(secondRecovery).toBe(false);

      // Wait for first recovery to complete
      await firstRecoveryPromise;
    });

    it('should stop attempting recovery after max attempts', async () => {
      const error: ReloadError = {
        type: 'compilation_error',
        filePath: '/test/file.mtm',
        message: 'Persistent error',
        recoverable: true
      };

      // Attempt recovery multiple times
      for (let i = 0; i < 4; i++) {
        await recoveryManager.attemptRecovery(error);
      }

      const stats = recoveryManager.getRecoveryStats();
      expect(stats.failureCount).toBe(3); // Should cap at maxRetryAttempts

      // Next attempt should be rejected
      const result = await recoveryManager.attemptRecovery(error);
      expect(result).toBe(false);
    });
  });

  describe('recovery callbacks', () => {
    it('should register and execute recovery callbacks', async () => {
      let callbackExecuted = false;

      recoveryManager.registerRecoveryCallback('testCallback', async () => {
        callbackExecuted = true;
      });

      // Manually trigger callback (in real scenario, this would be called during recovery)
      const callback = (recoveryManager as any).recoveryCallbacks.get('testCallback');
      await callback();

      expect(callbackExecuted).toBe(true);
    });

    it('should unregister recovery callbacks', () => {
      recoveryManager.registerRecoveryCallback('testCallback', async () => {});
      recoveryManager.unregisterRecoveryCallback('testCallback');

      const callback = (recoveryManager as any).recoveryCallbacks.get('testCallback');
      expect(callback).toBeUndefined();
    });
  });

  describe('recovery statistics', () => {
    it('should track recovery attempts', async () => {
      const error: ReloadError = {
        type: 'syntax_error',
        filePath: '/test/file.mtm',
        message: 'Syntax error',
        recoverable: true
      };

      await recoveryManager.attemptRecovery(error);

      const stats = recoveryManager.getRecoveryStats();
      expect(stats.recentAttempts).toHaveLength(1);
      expect(stats.recentAttempts[0].error).toEqual(error);
      expect(stats.recentAttempts[0].recoveryAction).toBe('syntax_recovery');
    });

    it('should calculate last good state age', () => {
      // Manually set the timestamp to simulate a past good state
      const pastTimestamp = Date.now() - 5000; // 5 seconds ago
      (recoveryManager as any).recoveryState.lastGoodTimestamp = pastTimestamp;
      (recoveryManager as any).recoveryState.lastGoodSnapshot = mockStateSnapshot;

      const stats = recoveryManager.getRecoveryStats();
      expect(stats.lastGoodStateAge).toBeGreaterThan(4000);
      expect(stats.lastGoodStateAge).toBeLessThan(6000);
    });
  });

  describe('configuration updates', () => {
    it('should update recovery options', () => {
      recoveryManager.updateOptions({
        maxRetryAttempts: 5,
        retryDelay: 2000
      });

      const options = (recoveryManager as any).options;
      expect(options.maxRetryAttempts).toBe(5);
      expect(options.retryDelay).toBe(2000);
      expect(options.enableStateRollback).toBe(true); // Should preserve existing options
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', () => {
      recoveryManager.registerRecoveryCallback('testCallback', async () => {});
      recoveryManager.recordGoodState(mockStateSnapshot);

      recoveryManager.cleanup();

      const stats = recoveryManager.getRecoveryStats();
      expect(stats.hasLastGoodState).toBe(false);
      expect(stats.failureCount).toBe(0);

      const callback = (recoveryManager as any).recoveryCallbacks.get('testCallback');
      expect(callback).toBeUndefined();
    });
  });
});

describe('Error Handling Integration', () => {
  it('should work together for complete error handling flow', async () => {
    const categorizer = new ErrorCategorizer();
    const recoveryManager = new ErrorRecoveryManager();

    // Simulate an error
    const originalError = new Error('Unexpected token } at line 15:23');
    const categorizedError = categorizer.categorizeError(originalError, '/test/file.mtm');

    // Verify categorization
    expect(categorizedError.type).toBe('syntax_error');
    expect(categorizedError.line).toBe(15);
    expect(categorizedError.column).toBe(23);
    expect(categorizedError.recoverable).toBe(true);

    // Attempt recovery
    const recoveryResult = await recoveryManager.attemptRecovery(categorizedError);

    // Verify recovery attempt was made
    const stats = recoveryManager.getRecoveryStats();
    expect(stats.recentAttempts).toHaveLength(1);
    expect(stats.recentAttempts[0].error.type).toBe('syntax_error');
  });
});