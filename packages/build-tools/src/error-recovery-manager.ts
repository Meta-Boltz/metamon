/**
 * Error Recovery Manager for Hot Reload Operations
 * 
 * This class handles graceful error recovery, state rollback,
 * and retry mechanisms for hot reload failures.
 */

import type { ReloadError, ErrorRecoveryOptions } from './types/error-handling.js';
import type { StateSnapshot } from '../../dev-tools/src/types/state-preservation.js';

export interface RecoveryAttempt {
  timestamp: number;
  error: ReloadError;
  recoveryAction: string;
  success: boolean;
  duration: number;
}

export interface RecoveryState {
  lastGoodSnapshot: StateSnapshot | null;
  lastGoodTimestamp: number;
  failureCount: number;
  recoveryAttempts: RecoveryAttempt[];
  isRecovering: boolean;
}

export class ErrorRecoveryManager {
  private options: ErrorRecoveryOptions;
  private recoveryState: RecoveryState;
  private recoveryCallbacks: Map<string, () => Promise<void>> = new Map();

  constructor(options: Partial<ErrorRecoveryOptions> = {}) {
    this.options = {
      enableStateRollback: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      fallbackToLastGoodState: true,
      ...options
    };

    this.recoveryState = {
      lastGoodSnapshot: null,
      lastGoodTimestamp: 0,
      failureCount: 0,
      recoveryAttempts: [],
      isRecovering: false
    };
  }

  /**
   * Record a successful state snapshot for potential rollback
   */
  recordGoodState(snapshot: StateSnapshot): void {
    this.recoveryState.lastGoodSnapshot = snapshot;
    this.recoveryState.lastGoodTimestamp = Date.now();
    
    // Reset failure count on successful state
    this.recoveryState.failureCount = 0;
    
    // Clear old recovery attempts (keep last 10)
    if (this.recoveryState.recoveryAttempts.length > 10) {
      this.recoveryState.recoveryAttempts = this.recoveryState.recoveryAttempts.slice(-10);
    }
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(error: ReloadError): Promise<boolean> {
    if (this.recoveryState.isRecovering) {
      return false; // Already recovering
    }

    if (!error.recoverable) {
      return false; // Error is not recoverable
    }

    if (this.recoveryState.failureCount >= this.options.maxRetryAttempts) {
      return false; // Max retry attempts exceeded
    }

    this.recoveryState.isRecovering = true;
    this.recoveryState.failureCount++;

    const startTime = Date.now();
    let recoveryAction = 'unknown';
    let success = false;

    try {
      // Determine recovery strategy based on error type
      switch (error.type) {
        case 'compilation_error':
        case 'syntax_error':
          recoveryAction = 'syntax_recovery';
          success = await this.recoverFromSyntaxError(error);
          break;

        case 'state_preservation_error':
          recoveryAction = 'state_rollback';
          success = await this.recoverFromStateError(error);
          break;

        case 'framework_sync_error':
          recoveryAction = 'framework_resync';
          success = await this.recoverFromSyncError(error);
          break;

        case 'timeout_error':
          recoveryAction = 'timeout_retry';
          success = await this.recoverFromTimeoutError(error);
          break;

        case 'import_error':
          recoveryAction = 'import_resolution';
          success = await this.recoverFromImportError(error);
          break;

        default:
          recoveryAction = 'generic_recovery';
          success = await this.genericRecovery(error);
          break;
      }

      // Record recovery attempt
      const attempt: RecoveryAttempt = {
        timestamp: Date.now(),
        error,
        recoveryAction,
        success,
        duration: Date.now() - startTime
      };

      this.recoveryState.recoveryAttempts.push(attempt);

      if (success) {
        this.recoveryState.failureCount = 0; // Reset on successful recovery
      }

      return success;

    } catch (recoveryError) {
      console.error('[ErrorRecovery] Recovery attempt failed:', recoveryError);
      
      const attempt: RecoveryAttempt = {
        timestamp: Date.now(),
        error,
        recoveryAction,
        success: false,
        duration: Date.now() - startTime
      };

      this.recoveryState.recoveryAttempts.push(attempt);
      return false;

    } finally {
      this.recoveryState.isRecovering = false;
    }
  }

  /**
   * Recover from syntax/compilation errors
   */
  private async recoverFromSyntaxError(error: ReloadError): Promise<boolean> {
    // For syntax errors, we typically can't auto-recover
    // But we can ensure the application state remains stable
    
    if (this.options.fallbackToLastGoodState && this.recoveryState.lastGoodSnapshot) {
      // Rollback to last good state
      const callback = this.recoveryCallbacks.get('restoreState');
      if (callback) {
        await callback();
        return true;
      }
    }

    // If no rollback is possible, at least ensure error display doesn't break the app
    return false;
  }

  /**
   * Recover from state preservation errors
   */
  private async recoverFromStateError(error: ReloadError): Promise<boolean> {
    if (!this.options.enableStateRollback) {
      return false;
    }

    // Try to restore from last good snapshot
    if (this.recoveryState.lastGoodSnapshot) {
      const callback = this.recoveryCallbacks.get('restoreState');
      if (callback) {
        try {
          await callback();
          return true;
        } catch (restoreError) {
          console.error('[ErrorRecovery] State restoration failed:', restoreError);
        }
      }
    }

    // Fallback: try to reinitialize state management
    const reinitCallback = this.recoveryCallbacks.get('reinitializeState');
    if (reinitCallback) {
      try {
        await reinitCallback();
        return true;
      } catch (reinitError) {
        console.error('[ErrorRecovery] State reinitialization failed:', reinitError);
      }
    }

    return false;
  }

  /**
   * Recover from framework synchronization errors
   */
  private async recoverFromSyncError(error: ReloadError): Promise<boolean> {
    // Try to re-establish framework connections
    const syncCallback = this.recoveryCallbacks.get('syncFrameworks');
    if (syncCallback) {
      try {
        await this.delay(this.options.retryDelay);
        await syncCallback();
        return true;
      } catch (syncError) {
        console.error('[ErrorRecovery] Framework sync recovery failed:', syncError);
      }
    }

    return false;
  }

  /**
   * Recover from timeout errors
   */
  private async recoverFromTimeoutError(error: ReloadError): Promise<boolean> {
    // For timeout errors, try the operation again with a delay
    const retryCallback = this.recoveryCallbacks.get('retryOperation');
    if (retryCallback) {
      try {
        await this.delay(this.options.retryDelay * 2); // Double delay for timeouts
        await retryCallback();
        return true;
      } catch (retryError) {
        console.error('[ErrorRecovery] Timeout recovery failed:', retryError);
      }
    }

    return false;
  }

  /**
   * Recover from import/dependency errors
   */
  private async recoverFromImportError(error: ReloadError): Promise<boolean> {
    // Try to resolve dependencies again
    const resolveCallback = this.recoveryCallbacks.get('resolveDependencies');
    if (resolveCallback) {
      try {
        await this.delay(this.options.retryDelay);
        await resolveCallback();
        return true;
      } catch (resolveError) {
        console.error('[ErrorRecovery] Import resolution recovery failed:', resolveError);
      }
    }

    return false;
  }

  /**
   * Generic recovery for unknown error types
   */
  private async genericRecovery(error: ReloadError): Promise<boolean> {
    // Try a generic retry with delay
    const genericCallback = this.recoveryCallbacks.get('genericRetry');
    if (genericCallback) {
      try {
        await this.delay(this.options.retryDelay);
        await genericCallback();
        return true;
      } catch (genericError) {
        console.error('[ErrorRecovery] Generic recovery failed:', genericError);
      }
    }

    // Last resort: try to rollback to last good state
    if (this.options.fallbackToLastGoodState && this.recoveryState.lastGoodSnapshot) {
      const callback = this.recoveryCallbacks.get('restoreState');
      if (callback) {
        try {
          await callback();
          return true;
        } catch (restoreError) {
          console.error('[ErrorRecovery] Fallback state restoration failed:', restoreError);
        }
      }
    }

    return false;
  }

  /**
   * Register a recovery callback for a specific action
   */
  registerRecoveryCallback(action: string, callback: () => Promise<void>): void {
    this.recoveryCallbacks.set(action, callback);
  }

  /**
   * Unregister a recovery callback
   */
  unregisterRecoveryCallback(action: string): void {
    this.recoveryCallbacks.delete(action);
  }

  /**
   * Check if recovery is currently in progress
   */
  isRecovering(): boolean {
    return this.recoveryState.isRecovering;
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    failureCount: number;
    lastGoodStateAge: number;
    recentAttempts: RecoveryAttempt[];
    hasLastGoodState: boolean;
  } {
    return {
      failureCount: this.recoveryState.failureCount,
      lastGoodStateAge: this.recoveryState.lastGoodTimestamp > 0
        ? Date.now() - this.recoveryState.lastGoodTimestamp 
        : -1,
      recentAttempts: this.recoveryState.recoveryAttempts.slice(-5),
      hasLastGoodState: this.recoveryState.lastGoodSnapshot !== null
    };
  }

  /**
   * Reset recovery state
   */
  reset(): void {
    this.recoveryState = {
      lastGoodSnapshot: null,
      lastGoodTimestamp: 0,
      failureCount: 0,
      recoveryAttempts: [],
      isRecovering: false
    };
  }

  /**
   * Update recovery options
   */
  updateOptions(options: Partial<ErrorRecoveryOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.recoveryCallbacks.clear();
    this.reset();
  }
}