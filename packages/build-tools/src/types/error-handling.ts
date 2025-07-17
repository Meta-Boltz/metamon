/**
 * Error handling types for hot reload operations
 */

export enum ReloadErrorType {
  COMPILATION_ERROR = 'compilation_error',
  STATE_PRESERVATION_ERROR = 'state_preservation_error',
  FRAMEWORK_SYNC_ERROR = 'framework_sync_error',
  TIMEOUT_ERROR = 'timeout_error',
  SYNTAX_ERROR = 'syntax_error',
  IMPORT_ERROR = 'import_error',
  RUNTIME_ERROR = 'runtime_error'
}

export interface ReloadError {
  type: ReloadErrorType;
  filePath: string;
  message: string;
  stack?: string;
  recoverable: boolean;
  line?: number;
  column?: number;
  code?: string;
  suggestion?: string;
}

export interface ErrorDisplayOptions {
  showOverlay: boolean;
  showNotifications: boolean;
  autoHide: boolean;
  hideDelay: number;
  showStackTrace: boolean;
  showSuggestions: boolean;
}

export interface ErrorRecoveryOptions {
  enableStateRollback: boolean;
  maxRetryAttempts: number;
  retryDelay: number;
  fallbackToLastGoodState: boolean;
}

export interface NotificationOptions {
  duration: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showProgress: boolean;
  allowDismiss: boolean;
}