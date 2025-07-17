/**
 * Hot Reload Notification System
 * 
 * This component provides a comprehensive notification system for hot reload operations,
 * including success/error notifications, progress updates, and file-specific feedback.
 */

export interface NotificationOptions {
  /** Duration in milliseconds (0 = no auto-hide) */
  duration: number;
  /** Position of notifications */
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Show progress bar for loading notifications */
  showProgress: boolean;
  /** Allow manual dismissal */
  allowDismiss: boolean;
  /** Maximum number of notifications to show */
  maxNotifications: number;
  /** Enable sound notifications */
  enableSound: boolean;
  /** Enable debug logging */
  debugLogging: boolean;
}

export interface NotificationData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title: string;
  message?: string;
  filePath?: string;
  fileName?: string;
  duration?: number;
  progress?: number;
  timestamp: number;
  dismissible: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

/**
 * Hot Reload Notification System implementation
 */
export class HotReloadNotificationSystem {
  private options: NotificationOptions;
  private container: HTMLElement | null = null;
  private notifications: Map<string, NotificationData> = new Map();
  private notificationElements: Map<string, HTMLElement> = new Map();
  private nextId = 1;

  constructor(options: Partial<NotificationOptions> = {}) {
    this.options = {
      duration: 4000,
      position: 'top-right',
      showProgress: true,
      allowDismiss: true,
      maxNotifications: 5,
      enableSound: false,
      debugLogging: false,
      ...options
    };

    this.createContainer();
  }

  /**
   * Show a success notification
   */
  showSuccess(title: string, message?: string, filePath?: string, duration?: number): string {
    const notification: NotificationData = {
      id: this.generateId(),
      type: 'success',
      title,
      message,
      filePath,
      fileName: filePath ? this.getFileName(filePath) : undefined,
      duration: duration ?? this.options.duration,
      timestamp: Date.now(),
      dismissible: this.options.allowDismiss
    };

    this.addNotification(notification);

    if (this.options.enableSound) {
      this.playNotificationSound('success');
    }

    if (this.options.debugLogging) {
      console.log(`[NotificationSystem] Success: ${title}`, { message, filePath });
    }

    return notification.id;
  }

  /**
   * Show an error notification
   */
  showError(title: string, message?: string, filePath?: string, actions?: NotificationAction[]): string {
    const notification: NotificationData = {
      id: this.generateId(),
      type: 'error',
      title,
      message,
      filePath,
      fileName: filePath ? this.getFileName(filePath) : undefined,
      duration: 0, // Errors don't auto-hide
      timestamp: Date.now(),
      dismissible: this.options.allowDismiss,
      actions
    };

    this.addNotification(notification);

    if (this.options.enableSound) {
      this.playNotificationSound('error');
    }

    if (this.options.debugLogging) {
      console.log(`[NotificationSystem] Error: ${title}`, { message, filePath, actions });
    }

    return notification.id;
  }

  /**
   * Show a warning notification
   */
  showWarning(title: string, message?: string, filePath?: string, duration?: number): string {
    const notification: NotificationData = {
      id: this.generateId(),
      type: 'warning',
      title,
      message,
      filePath,
      fileName: filePath ? this.getFileName(filePath) : undefined,
      duration: duration ?? this.options.duration * 1.5, // Warnings stay longer
      timestamp: Date.now(),
      dismissible: this.options.allowDismiss
    };

    this.addNotification(notification);

    if (this.options.debugLogging) {
      console.log(`[NotificationSystem] Warning: ${title}`, { message, filePath });
    }

    return notification.id;
  }

  /**
   * Show an info notification
   */
  showInfo(title: string, message?: string, filePath?: string, duration?: number): string {
    const notification: NotificationData = {
      id: this.generateId(),
      type: 'info',
      title,
      message,
      filePath,
      fileName: filePath ? this.getFileName(filePath) : undefined,
      duration: duration ?? this.options.duration,
      timestamp: Date.now(),
      dismissible: this.options.allowDismiss
    };

    this.addNotification(notification);

    if (this.options.debugLogging) {
      console.log(`[NotificationSystem] Info: ${title}`, { message, filePath });
    }

    return notification.id;
  }

  /**
   * Show a loading notification with progress
   */
  showLoading(title: string, message?: string, filePath?: string): string {
    const notification: NotificationData = {
      id: this.generateId(),
      type: 'loading',
      title,
      message,
      filePath,
      fileName: filePath ? this.getFileName(filePath) : undefined,
      duration: 0, // Loading notifications don't auto-hide
      progress: 0,
      timestamp: Date.now(),
      dismissible: false // Loading notifications can't be dismissed
    };

    this.addNotification(notification);

    if (this.options.debugLogging) {
      console.log(`[NotificationSystem] Loading: ${title}`, { message, filePath });
    }

    return notification.id;
  }

  /**
   * Update progress for a loading notification
   */
  updateProgress(notificationId: string, progress: number, message?: string): void {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.type !== 'loading') {
      if (this.options.debugLogging) {
        console.warn(`[NotificationSystem] Cannot update progress for notification ${notificationId}`);
      }
      return;
    }

    notification.progress = Math.max(0, Math.min(100, progress));
    if (message) {
      notification.message = message;
    }

    this.updateNotificationElement(notificationId);

    if (this.options.debugLogging) {
      console.log(`[NotificationSystem] Updated progress for ${notificationId}: ${progress}%`);
    }
  }

  /**
   * Complete a loading notification (convert to success or error)
   */
  completeLoading(notificationId: string, success: boolean, finalMessage?: string, actions?: NotificationAction[]): void {
    const notification = this.notifications.get(notificationId);
    if (!notification || notification.type !== 'loading') {
      if (this.options.debugLogging) {
        console.warn(`[NotificationSystem] Cannot complete loading for notification ${notificationId}`);
      }
      return;
    }

    notification.type = success ? 'success' : 'error';
    notification.progress = 100;
    notification.duration = success ? this.options.duration : 0; // Errors don't auto-hide
    notification.dismissible = this.options.allowDismiss;
    
    if (finalMessage) {
      notification.message = finalMessage;
    }
    
    if (actions) {
      notification.actions = actions;
    }

    this.updateNotificationElement(notificationId);

    // Schedule auto-hide for success notifications
    if (success && notification.duration > 0) {
      setTimeout(() => {
        this.hideNotification(notificationId);
      }, notification.duration);
    }

    if (this.options.enableSound) {
      this.playNotificationSound(success ? 'success' : 'error');
    }

    if (this.options.debugLogging) {
      console.log(`[NotificationSystem] Completed loading ${notificationId}: ${success ? 'success' : 'error'}`);
    }
  }

  /**
   * Hide a specific notification
   */
  hideNotification(notificationId: string): void {
    const element = this.notificationElements.get(notificationId);
    if (element) {
      element.style.animation = 'mtm-notification-slide-out 0.3s ease-in-out forwards';
      
      setTimeout(() => {
        element.remove();
        this.notificationElements.delete(notificationId);
        this.notifications.delete(notificationId);
        
        if (this.options.debugLogging) {
          console.log(`[NotificationSystem] Hidden notification ${notificationId}`);
        }
      }, 300);
    }
  }

  /**
   * Hide all notifications
   */
  hideAll(): void {
    const notificationIds = Array.from(this.notifications.keys());
    notificationIds.forEach(id => this.hideNotification(id));
  }

  /**
   * Hide all notifications of a specific type
   */
  hideByType(type: NotificationData['type']): void {
    const notificationsToHide = Array.from(this.notifications.values())
      .filter(n => n.type === type)
      .map(n => n.id);
    
    notificationsToHide.forEach(id => this.hideNotification(id));
  }

  /**
   * Add a notification to the system
   */
  private addNotification(notification: NotificationData): void {
    // Enforce max notifications limit
    if (this.notifications.size >= this.options.maxNotifications) {
      const oldestId = Array.from(this.notifications.keys())[0];
      this.hideNotification(oldestId);
    }

    this.notifications.set(notification.id, notification);
    this.createNotificationElement(notification);

    // Schedule auto-hide if duration is set
    if (notification.duration > 0) {
      setTimeout(() => {
        this.hideNotification(notification.id);
      }, notification.duration);
    }
  }

  /**
   * Create DOM element for a notification
   */
  private createNotificationElement(notification: NotificationData): void {
    if (!this.container) return;

    const element = document.createElement('div');
    element.className = `mtm-notification mtm-notification-${notification.type}`;
    element.innerHTML = this.renderNotification(notification);

    // Add event listeners
    this.attachNotificationEventListeners(element, notification);

    // Add to container with animation
    element.style.animation = 'mtm-notification-slide-in 0.3s ease-out forwards';
    this.container.appendChild(element);
    this.notificationElements.set(notification.id, element);
  }

  /**
   * Update an existing notification element
   */
  private updateNotificationElement(notificationId: string): void {
    const element = this.notificationElements.get(notificationId);
    const notification = this.notifications.get(notificationId);
    
    if (!element || !notification) return;

    element.innerHTML = this.renderNotification(notification);
    this.attachNotificationEventListeners(element, notification);
  }

  /**
   * Render notification HTML
   */
  private renderNotification(notification: NotificationData): string {
    const icon = this.getNotificationIcon(notification.type);
    const hasProgress = notification.type === 'loading' && this.options.showProgress;
    
    return `
      <div class="mtm-notification-content">
        <div class="mtm-notification-header">
          <div class="mtm-notification-icon">${icon}</div>
          <div class="mtm-notification-text">
            <div class="mtm-notification-title">${this.escapeHtml(notification.title)}</div>
            ${notification.message ? `
              <div class="mtm-notification-message">${this.escapeHtml(notification.message)}</div>
            ` : ''}
            ${notification.fileName ? `
              <div class="mtm-notification-file">${this.escapeHtml(notification.fileName)}</div>
            ` : ''}
          </div>
          ${notification.dismissible ? `
            <button class="mtm-notification-close" aria-label="Close notification">×</button>
          ` : ''}
        </div>
        
        ${hasProgress ? `
          <div class="mtm-notification-progress">
            <div class="mtm-notification-progress-bar">
              <div class="mtm-notification-progress-fill" style="width: ${notification.progress || 0}%"></div>
            </div>
            <div class="mtm-notification-progress-text">${notification.progress || 0}%</div>
          </div>
        ` : ''}
        
        ${notification.actions && notification.actions.length > 0 ? `
          <div class="mtm-notification-actions">
            ${notification.actions.map((action, index) => `
              <button class="mtm-notification-action mtm-notification-action-${action.style || 'secondary'}" 
                      data-action-index="${index}">
                ${this.escapeHtml(action.label)}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Attach event listeners to notification element
   */
  private attachNotificationEventListeners(element: HTMLElement, notification: NotificationData): void {
    // Close button
    const closeButton = element.querySelector('.mtm-notification-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.hideNotification(notification.id);
      });
    }

    // Action buttons
    const actionButtons = element.querySelectorAll('.mtm-notification-action');
    actionButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        if (notification.actions && notification.actions[index]) {
          notification.actions[index].action();
        }
      });
    });
  }

  /**
   * Get icon for notification type
   */
  private getNotificationIcon(type: NotificationData['type']): string {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'loading':
        return '⏳';
      default:
        return '📢';
    }
  }

  /**
   * Create the notification container
   */
  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'mtm-notification-container';
    this.container.className = `mtm-notification-container mtm-notification-${this.options.position}`;
    
    document.body.appendChild(this.container);
    this.injectStyles();
  }

  /**
   * Generate unique notification ID
   */
  private generateId(): string {
    return `mtm-notification-${this.nextId++}-${Date.now()}`;
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
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(type: 'success' | 'error'): void {
    // This is a placeholder for sound functionality
    // In a real implementation, you might use Web Audio API or HTML5 audio
    if (this.options.debugLogging) {
      console.log(`[NotificationSystem] Playing ${type} sound`);
    }
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    if (document.getElementById('mtm-notification-styles')) return;

    const style = document.createElement('style');
    style.id = 'mtm-notification-styles';
    style.textContent = `
      .mtm-notification-container {
        position: fixed;
        z-index: 999996;
        pointer-events: none;
        max-width: 400px;
      }

      .mtm-notification-top-right {
        top: 20px;
        right: 20px;
      }

      .mtm-notification-top-left {
        top: 20px;
        left: 20px;
      }

      .mtm-notification-bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .mtm-notification-bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .mtm-notification {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 8px;
        border-left: 4px solid;
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
      }

      .mtm-notification-success {
        border-left-color: #10b981;
      }

      .mtm-notification-error {
        border-left-color: #ef4444;
      }

      .mtm-notification-warning {
        border-left-color: #f59e0b;
      }

      .mtm-notification-info {
        border-left-color: #3b82f6;
      }

      .mtm-notification-loading {
        border-left-color: #6366f1;
      }

      .mtm-notification-content {
        padding: 12px 16px;
      }

      .mtm-notification-header {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .mtm-notification-icon {
        font-size: 16px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .mtm-notification-text {
        flex: 1;
        min-width: 0;
      }

      .mtm-notification-title {
        font-size: 14px;
        font-weight: 500;
        color: #111827;
        margin-bottom: 2px;
      }

      .mtm-notification-message {
        font-size: 13px;
        color: #6b7280;
        line-height: 1.4;
        margin-bottom: 2px;
      }

      .mtm-notification-file {
        font-size: 11px;
        color: #9ca3af;
        font-family: 'Monaco', 'Menlo', monospace;
      }

      .mtm-notification-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #9ca3af;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .mtm-notification-close:hover {
        background: #f3f4f6;
        color: #6b7280;
      }

      .mtm-notification-progress {
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .mtm-notification-progress-bar {
        flex: 1;
        height: 4px;
        background: #e5e7eb;
        border-radius: 2px;
        overflow: hidden;
      }

      .mtm-notification-progress-fill {
        height: 100%;
        background: #6366f1;
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .mtm-notification-progress-text {
        font-size: 11px;
        color: #6b7280;
        font-weight: 500;
        flex-shrink: 0;
      }

      .mtm-notification-actions {
        margin-top: 8px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .mtm-notification-action {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid;
        transition: all 0.2s ease;
      }

      .mtm-notification-action-primary {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
      }

      .mtm-notification-action-primary:hover {
        background: #2563eb;
        border-color: #2563eb;
      }

      .mtm-notification-action-secondary {
        background: white;
        color: #6b7280;
        border-color: #d1d5db;
      }

      .mtm-notification-action-secondary:hover {
        background: #f9fafb;
        color: #374151;
        border-color: #9ca3af;
      }

      .mtm-notification-action-danger {
        background: #ef4444;
        color: white;
        border-color: #ef4444;
      }

      .mtm-notification-action-danger:hover {
        background: #dc2626;
        border-color: #dc2626;
      }

      /* Animations */
      @keyframes mtm-notification-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes mtm-notification-slide-out {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      /* Slide in from left for left-positioned notifications */
      .mtm-notification-top-left .mtm-notification,
      .mtm-notification-bottom-left .mtm-notification {
        animation-name: mtm-notification-slide-in-left !important;
      }

      @keyframes mtm-notification-slide-in-left {
        from {
          transform: translateX(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .mtm-notification-container {
          left: 10px !important;
          right: 10px !important;
          max-width: none;
        }

        .mtm-notification-top-left,
        .mtm-notification-top-right {
          top: 10px;
        }

        .mtm-notification-bottom-left,
        .mtm-notification-bottom-right {
          bottom: 10px;
        }

        .mtm-notification {
          margin-bottom: 6px;
        }
      }

      /* Loading animation */
      @keyframes mtm-notification-loading-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      .mtm-notification-loading .mtm-notification-icon {
        animation: mtm-notification-loading-pulse 1.5s ease-in-out infinite;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<NotificationOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    // Update container position if it exists
    if (this.container) {
      this.container.className = `mtm-notification-container mtm-notification-${this.options.position}`;
    }
  }

  /**
   * Get current options
   */
  getOptions(): NotificationOptions {
    return { ...this.options };
  }

  /**
   * Get current notifications
   */
  getNotifications(): NotificationData[] {
    return Array.from(this.notifications.values());
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.hideAll();
    
    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.notifications.clear();
    this.notificationElements.clear();
    
    // Remove injected styles
    const styles = document.getElementById('mtm-notification-styles');
    if (styles) {
      styles.remove();
    }
  }
}