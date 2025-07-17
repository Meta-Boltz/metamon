/**
 * Hot Reload Visual Feedback Manager
 * 
 * This component coordinates visual feedback during hot reload operations,
 * managing both progress indicators and notifications for a cohesive user experience.
 */

import { HotReloadProgressIndicator, type ProgressIndicatorOptions, type FileReloadProgress } from './hot-reload-progress-indicator.js';
import { HotReloadNotificationSystem, type NotificationOptions, type NotificationAction } from './hot-reload-notification-system.js';

export interface VisualFeedbackOptions {
  /** Enable progress indicator */
  showProgressIndicator: boolean;
  /** Enable notifications */
  showNotifications: boolean;
  /** Progress indicator options */
  progressIndicator?: Partial<ProgressIndicatorOptions>;
  /** Notification system options */
  notifications?: Partial<NotificationOptions>;
  /** Enable debug logging */
  debugLogging: boolean;
  /** Coordinate positioning to avoid overlap */
  coordinatePositioning: boolean;
}

export interface ReloadFeedbackContext {
  filePath: string;
  fileName: string;
  changeType: 'mtm' | 'native' | 'dependency';
  startTime: number;
}

export interface ReloadFeedbackResult {
  success: boolean;
  duration: number;
  error?: string;
  statePreserved?: boolean;
  frameworksSynced?: boolean;
}

/**
 * Hot Reload Visual Feedback Manager implementation
 */
export class HotReloadVisualFeedbackManager {
  private options: VisualFeedbackOptions;
  private progressIndicator: HotReloadProgressIndicator;
  private notificationSystem: HotReloadNotificationSystem;
  private activeReloads: Map<string, ReloadFeedbackContext> = new Map();
  private loadingNotifications: Map<string, string> = new Map(); // filePath -> notificationId

  constructor(options: Partial<VisualFeedbackOptions> = {}) {
    this.options = {
      showProgressIndicator: true,
      showNotifications: true,
      debugLogging: false,
      coordinatePositioning: true,
      ...options
    };

    // Initialize progress indicator
    this.progressIndicator = new HotReloadProgressIndicator({
      position: 'top-right',
      showFileNames: true,
      showProgress: true,
      autoHide: true,
      autoHideDelay: 3000,
      maxVisibleFiles: 5,
      debugLogging: this.options.debugLogging,
      ...this.options.progressIndicator
    });

    // Initialize notification system with coordinated positioning
    const notificationPosition = this.options.coordinatePositioning 
      ? this.getCoordinatedNotificationPosition()
      : 'bottom-right';

    this.notificationSystem = new HotReloadNotificationSystem({
      duration: 4000,
      position: notificationPosition,
      showProgress: true,
      allowDismiss: true,
      maxNotifications: 3,
      enableSound: false,
      debugLogging: this.options.debugLogging,
      ...this.options.notifications
    });

    if (this.options.debugLogging) {
      console.log('[VisualFeedbackManager] Initialized with options:', this.options);
    }
  }

  /**
   * Start visual feedback for a file reload
   */
  startReload(filePath: string, changeType: 'mtm' | 'native' | 'dependency' = 'mtm'): void {
    const fileName = this.getFileName(filePath);
    const context: ReloadFeedbackContext = {
      filePath,
      fileName,
      changeType,
      startTime: Date.now()
    };

    this.activeReloads.set(filePath, context);

    // Start progress indicator
    if (this.options.showProgressIndicator) {
      this.progressIndicator.startFileReload(filePath);
    }

    // Show loading notification for significant operations
    if (this.options.showNotifications && this.shouldShowLoadingNotification(changeType)) {
      const notificationId = this.notificationSystem.showLoading(
        `Reloading ${fileName}`,
        this.getReloadMessage(changeType),
        filePath
      );
      this.loadingNotifications.set(filePath, notificationId);
    }

    if (this.options.debugLogging) {
      console.log(`[VisualFeedbackManager] Started reload feedback for ${fileName} (${changeType})`);
    }
  }

  /**
   * Update progress for a file reload
   */
  updateProgress(filePath: string, progress: number, message?: string): void {
    const context = this.activeReloads.get(filePath);
    if (!context) {
      if (this.options.debugLogging) {
        console.warn(`[VisualFeedbackManager] Cannot update progress for unknown file: ${filePath}`);
      }
      return;
    }

    // Update progress indicator
    if (this.options.showProgressIndicator) {
      this.progressIndicator.updateFileProgress(filePath, progress, 'loading');
    }

    // Update loading notification
    const notificationId = this.loadingNotifications.get(filePath);
    if (notificationId && this.options.showNotifications) {
      this.notificationSystem.updateProgress(notificationId, progress, message);
    }

    if (this.options.debugLogging) {
      console.log(`[VisualFeedbackManager] Updated progress for ${context.fileName}: ${progress}%`);
    }
  }

  /**
   * Complete a file reload with result
   */
  completeReload(filePath: string, result: ReloadFeedbackResult): void {
    const context = this.activeReloads.get(filePath);
    if (!context) {
      if (this.options.debugLogging) {
        console.warn(`[VisualFeedbackManager] Cannot complete reload for unknown file: ${filePath}`);
      }
      return;
    }

    const { success, duration, error, statePreserved, frameworksSynced } = result;

    // Complete progress indicator
    if (this.options.showProgressIndicator) {
      this.progressIndicator.completeFileReload(filePath, success, error);
    }

    // Complete loading notification and show result notification
    const notificationId = this.loadingNotifications.get(filePath);
    if (this.options.showNotifications) {
      if (notificationId) {
        // Complete the loading notification
        const finalMessage = this.buildCompletionMessage(result, context);
        this.notificationSystem.completeLoading(notificationId, success, finalMessage);
        this.loadingNotifications.delete(filePath);
      } else if (success) {
        // Show success notification if no loading notification was shown
        this.showSuccessNotification(context, result);
      }

      // Always show error notifications
      if (!success) {
        this.showErrorNotification(context, result);
      }
    }

    // Clean up
    this.activeReloads.delete(filePath);

    if (this.options.debugLogging) {
      console.log(`[VisualFeedbackManager] Completed reload for ${context.fileName}: ${success ? 'success' : 'error'} in ${duration}ms`);
    }
  }

  /**
   * Show a general success message
   */
  showSuccess(message: string, filePath?: string, duration?: number): string {
    if (!this.options.showNotifications) return '';

    return this.notificationSystem.showSuccess(message, undefined, filePath, duration);
  }

  /**
   * Show a general error message
   */
  showError(message: string, details?: string, filePath?: string, actions?: NotificationAction[]): string {
    if (!this.options.showNotifications) return '';

    return this.notificationSystem.showError(message, details, filePath, actions);
  }

  /**
   * Show a warning message
   */
  showWarning(message: string, details?: string, filePath?: string, duration?: number): string {
    if (!this.options.showNotifications) return '';

    return this.notificationSystem.showWarning(message, details, filePath, duration);
  }

  /**
   * Show an info message
   */
  showInfo(message: string, details?: string, filePath?: string, duration?: number): string {
    if (!this.options.showNotifications) return '';

    return this.notificationSystem.showInfo(message, details, filePath, duration);
  }

  /**
   * Show batch reload completion summary
   */
  showBatchSummary(results: Array<{ filePath: string; success: boolean; duration: number }>): void {
    if (!this.options.showNotifications || results.length === 0) return;

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;
    const totalDuration = Math.max(...results.map(r => r.duration));

    if (errorCount === 0) {
      this.notificationSystem.showSuccess(
        `Hot reload completed`,
        `${successCount} file${successCount !== 1 ? 's' : ''} reloaded successfully in ${totalDuration}ms`
      );
    } else if (successCount === 0) {
      this.notificationSystem.showError(
        `Hot reload failed`,
        `${errorCount} file${errorCount !== 1 ? 's' : ''} failed to reload`
      );
    } else {
      this.notificationSystem.showWarning(
        `Hot reload partially completed`,
        `${successCount} succeeded, ${errorCount} failed`
      );
    }

    if (this.options.debugLogging) {
      console.log(`[VisualFeedbackManager] Batch summary: ${successCount} success, ${errorCount} errors`);
    }
  }

  /**
   * Clear all visual feedback
   */
  clearAll(): void {
    if (this.options.showProgressIndicator) {
      this.progressIndicator.clearAll();
    }

    if (this.options.showNotifications) {
      this.notificationSystem.hideAll();
    }

    this.activeReloads.clear();
    this.loadingNotifications.clear();

    if (this.options.debugLogging) {
      console.log('[VisualFeedbackManager] Cleared all visual feedback');
    }
  }

  /**
   * Get current feedback state
   */
  getFeedbackState(): {
    activeReloads: ReloadFeedbackContext[];
    progressState: ReturnType<HotReloadProgressIndicator['getProgressState']>;
    notifications: ReturnType<HotReloadNotificationSystem['getNotifications']>;
  } {
    return {
      activeReloads: Array.from(this.activeReloads.values()),
      progressState: this.progressIndicator.getProgressState(),
      notifications: this.notificationSystem.getNotifications()
    };
  }

  /**
   * Determine if loading notification should be shown
   */
  private shouldShowLoadingNotification(changeType: string): boolean {
    // Show loading notifications for MTM files and significant operations
    return changeType === 'mtm' || changeType === 'native';
  }

  /**
   * Get reload message based on change type
   */
  private getReloadMessage(changeType: string): string {
    switch (changeType) {
      case 'mtm':
        return 'Compiling MTM file and preserving state...';
      case 'native':
        return 'Reloading component and syncing frameworks...';
      case 'dependency':
        return 'Updating dependencies...';
      default:
        return 'Processing changes...';
    }
  }

  /**
   * Build completion message with context
   */
  private buildCompletionMessage(result: ReloadFeedbackResult, context: ReloadFeedbackContext): string {
    const { success, duration, statePreserved, frameworksSynced } = result;
    
    if (!success) {
      return `Failed to reload ${context.fileName}`;
    }

    const features: string[] = [];
    if (statePreserved) features.push('state preserved');
    if (frameworksSynced) features.push('frameworks synced');

    const featuresText = features.length > 0 ? ` (${features.join(', ')})` : '';
    return `Reloaded in ${duration}ms${featuresText}`;
  }

  /**
   * Show success notification
   */
  private showSuccessNotification(context: ReloadFeedbackContext, result: ReloadFeedbackResult): void {
    const message = this.buildCompletionMessage(result, context);
    this.notificationSystem.showSuccess(`${context.fileName} reloaded`, message, context.filePath);
  }

  /**
   * Show error notification with recovery actions
   */
  private showErrorNotification(context: ReloadFeedbackContext, result: ReloadFeedbackResult): void {
    const actions: NotificationAction[] = [
      {
        label: 'Retry',
        action: () => {
          // This would trigger a retry - in practice, this would be connected to the orchestrator
          if (this.options.debugLogging) {
            console.log(`[VisualFeedbackManager] Retry requested for ${context.filePath}`);
          }
        },
        style: 'primary'
      },
      {
        label: 'View Details',
        action: () => {
          // This would show detailed error information
          if (this.options.debugLogging) {
            console.log(`[VisualFeedbackManager] Error details requested for ${context.filePath}`);
          }
        },
        style: 'secondary'
      }
    ];

    this.notificationSystem.showError(
      `Failed to reload ${context.fileName}`,
      result.error || 'Unknown error occurred',
      context.filePath,
      actions
    );
  }

  /**
   * Get coordinated notification position to avoid overlap with progress indicator
   */
  private getCoordinatedNotificationPosition(): NotificationOptions['position'] {
    const progressPosition = this.progressIndicator.getOptions().position;
    
    // Place notifications on opposite side to avoid overlap
    switch (progressPosition) {
      case 'top-right':
        return 'bottom-right';
      case 'top-left':
        return 'bottom-left';
      case 'bottom-right':
        return 'top-right';
      case 'bottom-left':
        return 'top-left';
      default:
        return 'bottom-right';
    }
  }

  /**
   * Extract file name from path
   */
  private getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<VisualFeedbackOptions>): void {
    this.options = { ...this.options, ...newOptions };

    // Update progress indicator options
    if (newOptions.progressIndicator) {
      this.progressIndicator.updateOptions(newOptions.progressIndicator);
    }

    // Update notification system options
    if (newOptions.notifications) {
      this.notificationSystem.updateOptions(newOptions.notifications);
    }

    // Re-coordinate positioning if needed
    if (newOptions.coordinatePositioning !== undefined && newOptions.coordinatePositioning) {
      const coordinatedPosition = this.getCoordinatedNotificationPosition();
      this.notificationSystem.updateOptions({ position: coordinatedPosition });
    }

    if (this.options.debugLogging) {
      console.log('[VisualFeedbackManager] Updated options:', this.options);
    }
  }

  /**
   * Get current options
   */
  getOptions(): VisualFeedbackOptions {
    return { ...this.options };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.progressIndicator.cleanup();
    this.notificationSystem.cleanup();
    this.activeReloads.clear();
    this.loadingNotifications.clear();

    if (this.options.debugLogging) {
      console.log('[VisualFeedbackManager] Cleaned up resources');
    }
  }
}