/**
 * Hot Reload Progress Indicator Component
 * 
 * This component provides visual feedback during hot reload operations,
 * showing progress for individual files and overall reload status.
 */

export interface ProgressIndicatorOptions {
  /** Position of the progress indicator */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Show file names in progress indicator */
  showFileNames: boolean;
  /** Show progress percentage */
  showProgress: boolean;
  /** Auto-hide after completion */
  autoHide: boolean;
  /** Auto-hide delay in milliseconds */
  autoHideDelay: number;
  /** Maximum number of files to show simultaneously */
  maxVisibleFiles: number;
  /** Enable debug logging */
  debugLogging: boolean;
}

export interface FileReloadProgress {
  filePath: string;
  fileName: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  progress: number; // 0-100
  startTime: number;
  duration?: number;
  error?: string;
}

export interface OverallProgress {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  overallProgress: number; // 0-100
  isActive: boolean;
}

/**
 * Hot Reload Progress Indicator implementation
 */
export class HotReloadProgressIndicator {
  private options: ProgressIndicatorOptions;
  private container: HTMLElement | null = null;
  private fileProgresses: Map<string, FileReloadProgress> = new Map();
  private overallProgress: OverallProgress = {
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    overallProgress: 0,
    isActive: false
  };
  private autoHideTimeout: NodeJS.Timeout | null = null;

  constructor(options: Partial<ProgressIndicatorOptions> = {}) {
    this.options = {
      position: 'top-right',
      showFileNames: true,
      showProgress: true,
      autoHide: true,
      autoHideDelay: 3000,
      maxVisibleFiles: 5,
      debugLogging: false,
      ...options
    };
  }

  /**
   * Start tracking progress for a file reload
   */
  startFileReload(filePath: string): void {
    const fileName = this.getFileName(filePath);
    const progress: FileReloadProgress = {
      filePath,
      fileName,
      status: 'loading',
      progress: 0,
      startTime: Date.now()
    };

    this.fileProgresses.set(filePath, progress);
    this.updateOverallProgress();
    this.updateDisplay();

    if (this.options.debugLogging) {
      console.log(`[ProgressIndicator] Started tracking reload for ${fileName}`);
    }
  }

  /**
   * Update progress for a specific file
   */
  updateFileProgress(filePath: string, progress: number, status?: 'loading' | 'success' | 'error'): void {
    const fileProgress = this.fileProgresses.get(filePath);
    if (!fileProgress) {
      if (this.options.debugLogging) {
        console.warn(`[ProgressIndicator] Attempted to update progress for unknown file: ${filePath}`);
      }
      return;
    }

    fileProgress.progress = Math.max(0, Math.min(100, progress));
    if (status) {
      fileProgress.status = status;
    }

    if (status === 'success' || status === 'error') {
      fileProgress.duration = Date.now() - fileProgress.startTime;
    }

    this.updateOverallProgress();
    this.updateDisplay();

    if (this.options.debugLogging) {
      console.log(`[ProgressIndicator] Updated ${fileProgress.fileName}: ${progress}% (${status || fileProgress.status})`);
    }
  }

  /**
   * Complete file reload with success or error
   */
  completeFileReload(filePath: string, success: boolean, error?: string): void {
    const fileProgress = this.fileProgresses.get(filePath);
    if (!fileProgress) {
      if (this.options.debugLogging) {
        console.warn(`[ProgressIndicator] Attempted to complete unknown file: ${filePath}`);
      }
      return;
    }

    fileProgress.status = success ? 'success' : 'error';
    fileProgress.progress = 100;
    fileProgress.duration = Date.now() - fileProgress.startTime;
    if (error) {
      fileProgress.error = error;
    }

    this.updateOverallProgress();
    this.updateDisplay();

    if (this.options.debugLogging) {
      console.log(`[ProgressIndicator] Completed ${fileProgress.fileName}: ${success ? 'success' : 'error'} in ${fileProgress.duration}ms`);
    }

    // Schedule cleanup for completed files
    setTimeout(() => {
      this.removeFileProgress(filePath);
    }, this.options.autoHideDelay);
  }

  /**
   * Remove file from progress tracking
   */
  removeFileProgress(filePath: string): void {
    if (this.fileProgresses.delete(filePath)) {
      this.updateOverallProgress();
      this.updateDisplay();

      if (this.options.debugLogging) {
        console.log(`[ProgressIndicator] Removed progress tracking for ${this.getFileName(filePath)}`);
      }
    }
  }

  /**
   * Clear all progress tracking
   */
  clearAll(): void {
    this.fileProgresses.clear();
    this.updateOverallProgress();
    this.hideIndicator();

    if (this.options.debugLogging) {
      console.log('[ProgressIndicator] Cleared all progress tracking');
    }
  }

  /**
   * Show the progress indicator
   */
  showIndicator(): void {
    if (!this.container) {
      this.createIndicator();
    }

    if (this.container) {
      this.container.style.display = 'block';
      this.injectStyles();
    }

    // Clear any pending auto-hide
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }
  }

  /**
   * Hide the progress indicator
   */
  hideIndicator(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }

    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }
  }

  /**
   * Update overall progress calculation
   */
  private updateOverallProgress(): void {
    const files = Array.from(this.fileProgresses.values());
    
    this.overallProgress.totalFiles = files.length;
    this.overallProgress.completedFiles = files.filter(f => f.status === 'success').length;
    this.overallProgress.failedFiles = files.filter(f => f.status === 'error').length;
    this.overallProgress.isActive = files.some(f => f.status === 'loading');

    if (files.length === 0) {
      this.overallProgress.overallProgress = 0;
    } else {
      const totalProgress = files.reduce((sum, file) => sum + file.progress, 0);
      this.overallProgress.overallProgress = Math.round(totalProgress / files.length);
    }
  }

  /**
   * Update the visual display
   */
  private updateDisplay(): void {
    if (this.fileProgresses.size === 0) {
      if (this.options.autoHide) {
        this.scheduleAutoHide();
      }
      return;
    }

    this.showIndicator();
    this.renderContent();
  }

  /**
   * Create the progress indicator DOM element
   */
  private createIndicator(): void {
    this.container = document.createElement('div');
    this.container.id = 'mtm-progress-indicator';
    this.container.className = `mtm-progress-indicator mtm-progress-${this.options.position}`;
    
    document.body.appendChild(this.container);
  }

  /**
   * Render the progress indicator content
   */
  private renderContent(): void {
    if (!this.container) return;

    const files = Array.from(this.fileProgresses.values())
      .sort((a, b) => b.startTime - a.startTime) // Most recent first
      .slice(0, this.options.maxVisibleFiles);

    const hasMoreFiles = this.fileProgresses.size > this.options.maxVisibleFiles;

    this.container.innerHTML = `
      <div class="mtm-progress-header">
        <div class="mtm-progress-title">
          <span class="mtm-progress-icon">${this.getOverallIcon()}</span>
          <span class="mtm-progress-text">Hot Reload</span>
        </div>
        ${this.options.showProgress ? `
          <div class="mtm-progress-overall">
            ${this.overallProgress.overallProgress}%
          </div>
        ` : ''}
      </div>
      
      ${this.options.showProgress ? `
        <div class="mtm-progress-bar-container">
          <div class="mtm-progress-bar">
            <div class="mtm-progress-bar-fill" style="width: ${this.overallProgress.overallProgress}%"></div>
          </div>
        </div>
      ` : ''}
      
      ${this.options.showFileNames && files.length > 0 ? `
        <div class="mtm-progress-files">
          ${files.map(file => this.renderFileProgress(file)).join('')}
          ${hasMoreFiles ? `
            <div class="mtm-progress-file-more">
              +${this.fileProgresses.size - this.options.maxVisibleFiles} more files
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      <div class="mtm-progress-summary">
        ${this.overallProgress.totalFiles} file${this.overallProgress.totalFiles !== 1 ? 's' : ''}
        ${this.overallProgress.completedFiles > 0 ? ` • ${this.overallProgress.completedFiles} completed` : ''}
        ${this.overallProgress.failedFiles > 0 ? ` • ${this.overallProgress.failedFiles} failed` : ''}
      </div>
    `;
  }

  /**
   * Render progress for a single file
   */
  private renderFileProgress(file: FileReloadProgress): string {
    const statusIcon = this.getFileStatusIcon(file.status);
    const statusClass = `mtm-progress-file-${file.status}`;
    
    return `
      <div class="mtm-progress-file ${statusClass}">
        <div class="mtm-progress-file-header">
          <span class="mtm-progress-file-icon">${statusIcon}</span>
          <span class="mtm-progress-file-name" title="${file.filePath}">${file.fileName}</span>
          ${this.options.showProgress ? `
            <span class="mtm-progress-file-percent">${file.progress}%</span>
          ` : ''}
        </div>
        ${this.options.showProgress && file.status === 'loading' ? `
          <div class="mtm-progress-file-bar">
            <div class="mtm-progress-file-bar-fill" style="width: ${file.progress}%"></div>
          </div>
        ` : ''}
        ${file.error ? `
          <div class="mtm-progress-file-error" title="${file.error}">
            ${file.error.length > 50 ? file.error.substring(0, 50) + '...' : file.error}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get overall status icon
   */
  private getOverallIcon(): string {
    if (this.overallProgress.failedFiles > 0) {
      return '❌';
    } else if (this.overallProgress.isActive) {
      return '⏳';
    } else if (this.overallProgress.completedFiles > 0) {
      return '✅';
    } else {
      return '🔄';
    }
  }

  /**
   * Get status icon for a file
   */
  private getFileStatusIcon(status: string): string {
    switch (status) {
      case 'loading':
        return '⏳';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'pending':
        return '⏸️';
      default:
        return '🔄';
    }
  }

  /**
   * Extract file name from path
   */
  private getFileName(filePath: string): string {
    // Handle both forward and backward slashes
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || filePath;
  }

  /**
   * Schedule auto-hide
   */
  private scheduleAutoHide(): void {
    if (!this.options.autoHide) return;

    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }

    this.autoHideTimeout = setTimeout(() => {
      this.hideIndicator();
    }, this.options.autoHideDelay);
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    if (document.getElementById('mtm-progress-styles')) return;

    const style = document.createElement('style');
    style.id = 'mtm-progress-styles';
    style.textContent = `
      .mtm-progress-indicator {
        position: fixed;
        z-index: 999997;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 12px;
        min-width: 280px;
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        border: 1px solid #e1e5e9;
      }

      .mtm-progress-top-right {
        top: 20px;
        right: 20px;
      }

      .mtm-progress-top-left {
        top: 20px;
        left: 20px;
      }

      .mtm-progress-bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .mtm-progress-bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .mtm-progress-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .mtm-progress-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;
        color: #374151;
      }

      .mtm-progress-icon {
        font-size: 14px;
      }

      .mtm-progress-overall {
        font-weight: 600;
        color: #1f2937;
        font-size: 14px;
      }

      .mtm-progress-bar-container {
        margin-bottom: 8px;
      }

      .mtm-progress-bar {
        width: 100%;
        height: 4px;
        background: #e5e7eb;
        border-radius: 2px;
        overflow: hidden;
      }

      .mtm-progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #1d4ed8);
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .mtm-progress-files {
        margin-bottom: 8px;
      }

      .mtm-progress-file {
        margin-bottom: 6px;
        padding: 6px 8px;
        border-radius: 4px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
      }

      .mtm-progress-file:last-child {
        margin-bottom: 0;
      }

      .mtm-progress-file-loading {
        border-color: #3b82f6;
        background: #eff6ff;
      }

      .mtm-progress-file-success {
        border-color: #10b981;
        background: #ecfdf5;
      }

      .mtm-progress-file-error {
        border-color: #ef4444;
        background: #fef2f2;
      }

      .mtm-progress-file-header {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .mtm-progress-file-icon {
        font-size: 12px;
        flex-shrink: 0;
      }

      .mtm-progress-file-name {
        flex: 1;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 11px;
        color: #374151;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .mtm-progress-file-percent {
        font-size: 11px;
        color: #6b7280;
        font-weight: 500;
        flex-shrink: 0;
      }

      .mtm-progress-file-bar {
        margin-top: 4px;
        height: 2px;
        background: #e5e7eb;
        border-radius: 1px;
        overflow: hidden;
      }

      .mtm-progress-file-bar-fill {
        height: 100%;
        background: #3b82f6;
        border-radius: 1px;
        transition: width 0.3s ease;
      }

      .mtm-progress-file-error {
        margin-top: 4px;
        font-size: 10px;
        color: #dc2626;
        font-family: 'Monaco', 'Menlo', monospace;
      }

      .mtm-progress-file-more {
        padding: 4px 8px;
        font-size: 11px;
        color: #6b7280;
        text-align: center;
        font-style: italic;
      }

      .mtm-progress-summary {
        font-size: 11px;
        color: #6b7280;
        text-align: center;
        padding-top: 4px;
        border-top: 1px solid #e5e7eb;
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .mtm-progress-indicator {
          left: 10px !important;
          right: 10px !important;
          top: 10px !important;
          max-width: none;
          min-width: 0;
        }

        .mtm-progress-top-left,
        .mtm-progress-top-right {
          left: 10px;
          right: 10px;
          top: 10px;
        }

        .mtm-progress-bottom-left,
        .mtm-progress-bottom-right {
          left: 10px;
          right: 10px;
          bottom: 10px;
        }
      }

      /* Animation for loading state */
      @keyframes mtm-progress-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .mtm-progress-file-loading .mtm-progress-file-icon {
        animation: mtm-progress-pulse 1.5s ease-in-out infinite;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<ProgressIndicatorOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    // Update container position if it exists
    if (this.container) {
      this.container.className = `mtm-progress-indicator mtm-progress-${this.options.position}`;
    }
  }

  /**
   * Get current options
   */
  getOptions(): ProgressIndicatorOptions {
    return { ...this.options };
  }

  /**
   * Get current progress state
   */
  getProgressState(): {
    files: FileReloadProgress[];
    overall: OverallProgress;
  } {
    return {
      files: Array.from(this.fileProgresses.values()),
      overall: { ...this.overallProgress }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.fileProgresses.clear();
    
    // Remove injected styles
    const styles = document.getElementById('mtm-progress-styles');
    if (styles) {
      styles.remove();
    }
  }
}