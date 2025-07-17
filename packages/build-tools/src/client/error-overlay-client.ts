/**
 * Client-side Error Overlay for Hot Reload
 * 
 * This script is injected into the browser to handle error display
 * and communication with the Vite dev server.
 */

interface ClientReloadError {
  type: string;
  filePath: string;
  message: string;
  stack?: string;
  recoverable: boolean;
  line?: number;
  column?: number;
  code?: string;
  suggestion?: string;
}

interface ClientErrorOverlay {
  showError(error: ClientReloadError): void;
  hideError(): void;
  showSuccess(message: string, filePath?: string): void;
  showLoading(message: string, filePath?: string): HTMLElement;
  hideLoading(element: HTMLElement): void;
}

class ClientErrorOverlayImpl implements ClientErrorOverlay {
  private overlay: HTMLElement | null = null;
  private hideTimeout: number | null = null;

  showError(error: ClientReloadError): void {
    this.hideError(); // Hide any existing overlay
    this.createOverlay(error);
    this.attachEventListeners();
  }

  hideError(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  showSuccess(message: string, filePath?: string): void {
    const notification = this.createNotification('success', message, filePath);
    document.body.appendChild(notification);

    // Auto-hide success notifications
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  showLoading(message: string, filePath?: string): HTMLElement {
    const notification = this.createNotification('loading', message, filePath);
    document.body.appendChild(notification);
    return notification;
  }

  hideLoading(element: HTMLElement): void {
    if (element && element.parentNode) {
      element.remove();
    }
  }

  private createOverlay(error: ClientReloadError): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'mtm-error-overlay';
    
    const fileName = error.filePath.split('/').pop() || error.filePath;
    const errorTypeDisplay = this.getErrorTypeDisplay(error.type);
    
    this.overlay.innerHTML = `
      <div class="mtm-error-backdrop">
        <div class="mtm-error-container">
          <div class="mtm-error-header">
            <div class="mtm-error-icon">${this.getErrorIcon(error.type)}</div>
            <div class="mtm-error-title">
              <h2>${errorTypeDisplay}</h2>
              <p class="mtm-error-file">${fileName}</p>
            </div>
            <button class="mtm-error-close" aria-label="Close error overlay">×</button>
          </div>
          
          <div class="mtm-error-content">
            <div class="mtm-error-message">
              <h3>Error Message</h3>
              <pre>${this.escapeHtml(error.message)}</pre>
            </div>
            
            ${error.line ? `
              <div class="mtm-error-location">
                <h3>Location</h3>
                <p>Line ${error.line}${error.column ? `, Column ${error.column}` : ''}</p>
              </div>
            ` : ''}
            
            ${error.code ? `
              <div class="mtm-error-code">
                <h3>Code Context</h3>
                <pre><code>${this.escapeHtml(error.code)}</code></pre>
              </div>
            ` : ''}
            
            ${error.suggestion ? `
              <div class="mtm-error-suggestion">
                <h3>💡 Suggestion</h3>
                <p>${this.escapeHtml(error.suggestion)}</p>
              </div>
            ` : ''}
            
            ${error.stack ? `
              <details class="mtm-error-stack">
                <summary>Stack Trace</summary>
                <pre>${this.escapeHtml(error.stack)}</pre>
              </details>
            ` : ''}
          </div>
          
          <div class="mtm-error-footer">
            ${error.recoverable ? `
              <div class="mtm-error-recovery">
                <p>✅ This error is recoverable. Fix the issue and save the file to continue.</p>
              </div>
            ` : `
              <div class="mtm-error-recovery mtm-error-critical">
                <p>⚠️ This is a critical error. You may need to restart the development server.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    // Add styles if not already present
    this.injectStyles();
    
    document.body.appendChild(this.overlay);
  }

  private createNotification(type: 'success' | 'loading' | 'error', message: string, filePath?: string): HTMLElement {
    const notification = document.createElement('div');
    notification.className = `mtm-notification mtm-notification-${type}`;
    
    const fileName = filePath ? filePath.split('/').pop() : '';
    const icon = type === 'success' ? '✅' : type === 'loading' ? '⏳' : '❌';
    
    notification.innerHTML = `
      <div class="mtm-notification-content">
        <div class="mtm-notification-icon">${icon}</div>
        <div class="mtm-notification-text">
          <div class="mtm-notification-message">${this.escapeHtml(message)}</div>
          ${fileName ? `<div class="mtm-notification-file">${fileName}</div>` : ''}
        </div>
        ${type === 'loading' ? '<div class="mtm-notification-spinner"></div>' : ''}
      </div>
    `;

    return notification;
  }

  private getErrorTypeDisplay(type: string): string {
    switch (type) {
      case 'compilation_error':
        return 'Compilation Error';
      case 'syntax_error':
        return 'Syntax Error';
      case 'import_error':
        return 'Import Error';
      case 'runtime_error':
        return 'Runtime Error';
      case 'state_preservation_error':
        return 'State Preservation Error';
      case 'framework_sync_error':
        return 'Framework Sync Error';
      case 'timeout_error':
        return 'Timeout Error';
      default:
        return 'Hot Reload Error';
    }
  }

  private getErrorIcon(type: string): string {
    switch (type) {
      case 'compilation_error':
      case 'syntax_error':
        return '🚨';
      case 'import_error':
        return '📦';
      case 'runtime_error':
        return '⚡';
      case 'state_preservation_error':
        return '💾';
      case 'framework_sync_error':
        return '🔄';
      case 'timeout_error':
        return '⏰';
      default:
        return '❌';
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private attachEventListeners(): void {
    if (!this.overlay) return;

    // Close button
    const closeButton = this.overlay.querySelector('.mtm-error-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hideError());
    }

    // ESC key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hideError();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Click backdrop to close
    const backdrop = this.overlay.querySelector('.mtm-error-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.hideError();
        }
      });
    }
  }

  private injectStyles(): void {
    if (document.getElementById('mtm-error-styles')) return;

    const style = document.createElement('style');
    style.id = 'mtm-error-styles';
    style.textContent = `
      #mtm-error-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .mtm-error-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .mtm-error-container {
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        max-width: 800px;
        max-height: 90vh;
        width: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .mtm-error-header {
        display: flex;
        align-items: center;
        padding: 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #e9ecef;
      }

      .mtm-error-icon {
        font-size: 24px;
        margin-right: 12px;
      }

      .mtm-error-title {
        flex: 1;
      }

      .mtm-error-title h2 {
        margin: 0;
        font-size: 18px;
        color: #dc3545;
      }

      .mtm-error-file {
        margin: 4px 0 0 0;
        font-size: 14px;
        color: #6c757d;
        font-family: 'Monaco', 'Menlo', monospace;
      }

      .mtm-error-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6c757d;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }

      .mtm-error-close:hover {
        background: #e9ecef;
        color: #495057;
      }

      .mtm-error-content {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }

      .mtm-error-content h3 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
        color: #495057;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .mtm-error-content > div {
        margin-bottom: 20px;
      }

      .mtm-error-content > div:last-child {
        margin-bottom: 0;
      }

      .mtm-error-message pre {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 12px;
        margin: 0;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 13px;
        line-height: 1.4;
        color: #dc3545;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .mtm-error-location p {
        margin: 0;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 13px;
        color: #495057;
      }

      .mtm-error-code pre {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 12px;
        margin: 0;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 13px;
        line-height: 1.4;
        overflow-x: auto;
      }

      .mtm-error-suggestion {
        background: #e7f3ff;
        border: 1px solid #b3d9ff;
        border-radius: 6px;
        padding: 12px;
      }

      .mtm-error-suggestion h3 {
        color: #0066cc;
      }

      .mtm-error-suggestion p {
        margin: 0;
        color: #004499;
      }

      .mtm-error-stack {
        margin-top: 8px;
      }

      .mtm-error-stack summary {
        cursor: pointer;
        font-weight: 500;
        color: #6c757d;
        padding: 8px 0;
      }

      .mtm-error-stack pre {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 12px;
        margin: 8px 0 0 0;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 12px;
        line-height: 1.4;
        overflow-x: auto;
        color: #6c757d;
      }

      .mtm-error-footer {
        padding: 20px;
        background: #f8f9fa;
        border-top: 1px solid #e9ecef;
      }

      .mtm-error-recovery p {
        margin: 0;
        font-size: 14px;
      }

      .mtm-error-critical p {
        color: #dc3545;
      }

      /* Notifications */
      .mtm-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 12px 16px;
        z-index: 999998;
        max-width: 400px;
        border-left: 4px solid;
      }

      .mtm-notification-success {
        border-left-color: #28a745;
      }

      .mtm-notification-loading {
        border-left-color: #007bff;
      }

      .mtm-notification-error {
        border-left-color: #dc3545;
      }

      .mtm-notification-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .mtm-notification-icon {
        font-size: 16px;
      }

      .mtm-notification-text {
        flex: 1;
      }

      .mtm-notification-message {
        font-size: 14px;
        font-weight: 500;
        color: #212529;
      }

      .mtm-notification-file {
        font-size: 12px;
        color: #6c757d;
        font-family: 'Monaco', 'Menlo', monospace;
        margin-top: 2px;
      }

      .mtm-notification-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #e9ecef;
        border-top: 2px solid #007bff;
        border-radius: 50%;
        animation: mtm-spin 1s linear infinite;
      }

      @keyframes mtm-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .mtm-error-backdrop {
          padding: 10px;
        }

        .mtm-error-container {
          max-height: 95vh;
        }

        .mtm-error-header,
        .mtm-error-content,
        .mtm-error-footer {
          padding: 16px;
        }

        .mtm-notification {
          top: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

// Initialize the error overlay and make it globally available
if (typeof window !== 'undefined') {
  (window as any).mtmErrorOverlay = new ClientErrorOverlayImpl();
}