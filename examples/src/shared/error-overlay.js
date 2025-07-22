/**
 * MTM Error Overlay System
 * Comprehensive error display and debugging for development
 */

export class MTMErrorOverlay {
  constructor(options = {}) {
    this.options = {
      position: 'fixed',
      zIndex: 999999,
      theme: 'dark',
      showStackTrace: true,
      showSourceMap: true,
      enableVerboseLogging: false,
      ...options
    };

    this.overlay = null;
    this.errors = [];
    this.isVisible = false;
    this.verboseLogging = this.options.enableVerboseLogging;

    // Initialize overlay
    this.init();
  }

  init() {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'mtm-error-overlay';
    this.overlay.style.cssText = this.getOverlayStyles();

    // Initially hidden
    this.overlay.style.display = 'none';

    // Add to document
    document.body.appendChild(this.overlay);

    // Listen for MTM-specific errors
    this.setupErrorListeners();

    this.log('MTM Error Overlay initialized');
  }

  setupErrorListeners() {
    // Listen for Vite HMR errors
    if (import.meta.hot) {
      import.meta.hot.on('vite:error', (error) => {
        this.log('Vite error received:', error);
        this.showError({
          type: 'vite_error',
          message: error.message || 'Vite compilation error',
          stack: error.stack,
          file: error.id,
          timestamp: Date.now()
        });
      });

      // Listen for MTM-specific errors
      import.meta.hot.on('mtm:compilation-error', (data) => {
        this.log('MTM compilation error received:', data);
        this.showError({
          type: 'mtm_compilation_error',
          message: data.message,
          file: data.file,
          line: data.line,
          column: data.column,
          suggestions: data.suggestions || [],
          timestamp: Date.now()
        });
      });

      import.meta.hot.on('mtm:hot-reload', (data) => {
        if (data.hasErrors && data.errors.length > 0) {
          this.log('MTM hot reload errors:', data.errors);
          data.errors.forEach(error => {
            this.showError({
              type: 'mtm_hot_reload_error',
              message: error.message,
              file: data.file,
              suggestions: [error.suggestion].filter(Boolean),
              timestamp: Date.now()
            });
          });
        } else if (this.isVisible) {
          // Clear errors on successful hot reload
          this.clearErrors();
        }
      });
    }

    // Listen for global JavaScript errors
    window.addEventListener('error', (event) => {
      this.log('Global error caught:', event);

      // Check if this is an MTM-related error
      if (this.isMTMError(event)) {
        this.showError({
          type: 'runtime_error',
          message: event.message,
          file: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack,
          timestamp: Date.now()
        });
      }
    });

    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log('Unhandled rejection caught:', event);

      if (this.isMTMError(event)) {
        this.showError({
          type: 'promise_rejection',
          message: event.reason?.message || 'Unhandled promise rejection',
          stack: event.reason?.stack,
          timestamp: Date.now()
        });
      }
    });
  }

  isMTMError(event) {
    const message = event.message || event.reason?.message || '';
    const filename = event.filename || '';
    const stack = event.error?.stack || event.reason?.stack || '';

    return (
      message.includes('MTM') ||
      filename.includes('.mtm') ||
      stack.includes('mtm-plugin') ||
      stack.includes('MTM')
    );
  }

  showError(error) {
    this.log('Showing error:', error);

    // Add to errors array
    this.errors.push(error);

    // Update overlay content
    this.updateOverlay();

    // Show overlay
    this.show();
  }

  updateOverlay() {
    if (!this.overlay) return;

    const html = this.generateErrorHTML();
    this.overlay.innerHTML = html;

    // Add event listeners
    this.attachEventListeners();
  }

  generateErrorHTML() {
    const latestError = this.errors[this.errors.length - 1];

    return `
      <div class="mtm-error-container">
        <div class="mtm-error-header">
          <div class="mtm-error-title">
            <span class="mtm-error-icon">🚨</span>
            <h2>MTM Compilation Error</h2>
            <div class="mtm-error-count">${this.errors.length} error${this.errors.length > 1 ? 's' : ''}</div>
          </div>
          <div class="mtm-error-actions">
            <button class="mtm-error-btn mtm-error-btn-clear" onclick="window.mtmErrorOverlay.clearErrors()">
              Clear All
            </button>
            <button class="mtm-error-btn mtm-error-btn-close" onclick="window.mtmErrorOverlay.hide()">
              ✕
            </button>
          </div>
        </div>

        <div class="mtm-error-content">
          ${this.generateErrorDetails(latestError)}
          
          ${this.errors.length > 1 ? this.generateErrorList() : ''}
          
          ${this.generateDebuggingInfo(latestError)}
        </div>

        <div class="mtm-error-footer">
          <div class="mtm-error-timestamp">
            ${new Date(latestError.timestamp).toLocaleTimeString()}
          </div>
          <div class="mtm-error-help">
            Press <kbd>Esc</kbd> to close • <kbd>Ctrl+Shift+D</kbd> for verbose logging
          </div>
        </div>
      </div>
    `;
  }

  generateErrorDetails(error) {
    return `
      <div class="mtm-error-details">
        <div class="mtm-error-type">${this.formatErrorType(error.type)}</div>
        
        <div class="mtm-error-message">
          <h3>Error Message</h3>
          <pre class="mtm-error-pre">${this.escapeHTML(error.message)}</pre>
        </div>

        ${error.file ? `
          <div class="mtm-error-file">
            <h3>File</h3>
            <div class="mtm-error-file-path">
              <code>${error.file}</code>
              ${error.line ? `<span class="mtm-error-location">:${error.line}${error.column ? `:${error.column}` : ''}</span>` : ''}
            </div>
          </div>
        ` : ''}

        ${error.suggestions && error.suggestions.length > 0 ? `
          <div class="mtm-error-suggestions">
            <h3>💡 Suggestions</h3>
            <ul class="mtm-error-suggestion-list">
              ${error.suggestions.map(suggestion => `
                <li class="mtm-error-suggestion">${this.escapeHTML(suggestion)}</li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${this.options.showStackTrace && error.stack ? `
          <div class="mtm-error-stack">
            <h3>Stack Trace</h3>
            <details class="mtm-error-stack-details">
              <summary>Show stack trace</summary>
              <pre class="mtm-error-pre mtm-error-stack-trace">${this.formatStackTrace(error.stack)}</pre>
            </details>
          </div>
        ` : ''}
      </div>
    `;
  }

  generateErrorList() {
    return `
      <div class="mtm-error-list">
        <h3>All Errors (${this.errors.length})</h3>
        <div class="mtm-error-list-container">
          ${this.errors.map((error, index) => `
            <div class="mtm-error-list-item ${index === this.errors.length - 1 ? 'active' : ''}" 
                 onclick="window.mtmErrorOverlay.showErrorAtIndex(${index})">
              <div class="mtm-error-list-type">${this.formatErrorType(error.type)}</div>
              <div class="mtm-error-list-message">${this.truncateText(error.message, 60)}</div>
              <div class="mtm-error-list-time">${new Date(error.timestamp).toLocaleTimeString()}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  generateDebuggingInfo(error) {
    const debugInfo = {
      userAgent: navigator.userAgent,
      timestamp: new Date(error.timestamp).toISOString(),
      url: window.location.href,
      hmrEnabled: !!import.meta.hot,
      viteVersion: this.getViteVersion(),
      mtmPluginVersion: this.getMTMPluginVersion()
    };

    return `
      <div class="mtm-error-debug">
        <details class="mtm-error-debug-details">
          <summary>🔧 Debug Information</summary>
          <div class="mtm-error-debug-content">
            <pre class="mtm-error-pre">${JSON.stringify(debugInfo, null, 2)}</pre>
            
            <div class="mtm-error-debug-actions">
              <button class="mtm-error-btn mtm-error-btn-copy" onclick="window.mtmErrorOverlay.copyDebugInfo()">
                Copy Debug Info
              </button>
              <button class="mtm-error-btn mtm-error-btn-verbose" onclick="window.mtmErrorOverlay.toggleVerboseLogging()">
                ${this.verboseLogging ? 'Disable' : 'Enable'} Verbose Logging
              </button>
            </div>
          </div>
        </details>
      </div>
    `;
  }

  formatErrorType(type) {
    const typeMap = {
      'mtm_compilation_error': 'MTM Compilation Error',
      'mtm_hot_reload_error': 'MTM Hot Reload Error',
      'vite_error': 'Vite Build Error',
      'runtime_error': 'Runtime Error',
      'promise_rejection': 'Promise Rejection'
    };

    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  formatStackTrace(stack) {
    return stack
      .split('\n')
      .map(line => {
        // Highlight MTM-related lines
        if (line.includes('.mtm') || line.includes('mtm-plugin')) {
          return `<span class="mtm-error-stack-highlight">${this.escapeHTML(line)}</span>`;
        }
        return this.escapeHTML(line);
      })
      .join('\n');
  }

  escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  getViteVersion() {
    try {
      return import.meta.env?.VITE_VERSION || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  getMTMPluginVersion() {
    try {
      return window.__MTM_PLUGIN_VERSION__ || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  attachEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isVisible) {
        this.hide();
      }

      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        this.toggleVerboseLogging();
      }
    });
  }

  showErrorAtIndex(index) {
    if (index >= 0 && index < this.errors.length) {
      // Move error to end to make it "current"
      const error = this.errors.splice(index, 1)[0];
      this.errors.push(error);
      this.updateOverlay();
    }
  }

  show() {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.isVisible = true;
      this.log('Error overlay shown');
    }
  }

  hide() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.isVisible = false;
      this.log('Error overlay hidden');
    }
  }

  clearErrors() {
    this.errors = [];
    this.hide();
    this.log('All errors cleared');
  }

  toggleVerboseLogging() {
    this.verboseLogging = !this.verboseLogging;
    this.log(`Verbose logging ${this.verboseLogging ? 'enabled' : 'disabled'}`);

    // Update overlay to reflect change
    if (this.isVisible) {
      this.updateOverlay();
    }
  }

  copyDebugInfo() {
    const debugInfo = {
      errors: this.errors,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      hmrEnabled: !!import.meta.hot,
      viteVersion: this.getViteVersion(),
      mtmPluginVersion: this.getMTMPluginVersion()
    };

    const text = JSON.stringify(debugInfo, null, 2);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.log('Debug info copied to clipboard');
        this.showToast('Debug info copied to clipboard!');
      });
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.log('Debug info copied to clipboard (fallback)');
      this.showToast('Debug info copied to clipboard!');
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'mtm-error-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 1000000;
      animation: mtmToastSlideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'mtmToastSlideOut 0.3s ease-in';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  log(message, ...args) {
    if (this.verboseLogging) {
      console.log(`[MTM Error Overlay] ${message}`, ...args);
    }
  }

  getOverlayStyles() {
    return `
      position: ${this.options.position};
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: ${this.options.zIndex};
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      backdrop-filter: blur(4px);
    `;
  }

  destroy() {
    if (this.overlay) {
      document.body.removeChild(this.overlay);
      this.overlay = null;
    }
    this.errors = [];
    this.isVisible = false;
    this.log('Error overlay destroyed');
  }
}

// CSS Styles for the error overlay
const overlayStyles = `
<style id="mtm-error-overlay-styles">
  .mtm-error-container {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 12px;
    max-width: 90vw;
    max-height: 90vh;
    width: 800px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .mtm-error-header {
    background: #dc3545;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #333;
  }

  .mtm-error-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mtm-error-icon {
    font-size: 24px;
  }

  .mtm-error-title h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .mtm-error-count {
    background: rgba(255, 255, 255, 0.2);
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }

  .mtm-error-actions {
    display: flex;
    gap: 8px;
  }

  .mtm-error-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .mtm-error-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .mtm-error-btn-close {
    padding: 6px 8px;
    font-size: 14px;
    font-weight: bold;
  }

  .mtm-error-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .mtm-error-details {
    margin-bottom: 24px;
  }

  .mtm-error-type {
    background: #ffc107;
    color: #000;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    display: inline-block;
    margin-bottom: 16px;
  }

  .mtm-error-message h3,
  .mtm-error-file h3,
  .mtm-error-suggestions h3,
  .mtm-error-stack h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #ffc107;
  }

  .mtm-error-pre {
    background: #2d2d2d;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 12px;
    margin: 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
    line-height: 1.4;
    overflow-x: auto;
    white-space: pre-wrap;
  }

  .mtm-error-file-path {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #2d2d2d;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 8px 12px;
  }

  .mtm-error-file-path code {
    color: #61dafb;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .mtm-error-location {
    color: #ffc107;
    font-weight: 600;
  }

  .mtm-error-suggestion-list {
    margin: 0;
    padding-left: 20px;
  }

  .mtm-error-suggestion {
    margin-bottom: 8px;
    color: #28a745;
  }

  .mtm-error-stack-details {
    margin-top: 8px;
  }

  .mtm-error-stack-details summary {
    cursor: pointer;
    padding: 8px;
    background: #2d2d2d;
    border: 1px solid #444;
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .mtm-error-stack-trace {
    max-height: 200px;
    overflow-y: auto;
  }

  .mtm-error-stack-highlight {
    background: #ffc107;
    color: #000;
    padding: 0 2px;
    border-radius: 2px;
  }

  .mtm-error-list {
    margin-bottom: 24px;
    border-top: 1px solid #333;
    padding-top: 20px;
  }

  .mtm-error-list h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #ffc107;
  }

  .mtm-error-list-container {
    max-height: 150px;
    overflow-y: auto;
    border: 1px solid #444;
    border-radius: 6px;
  }

  .mtm-error-list-item {
    padding: 8px 12px;
    border-bottom: 1px solid #333;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.2s;
  }

  .mtm-error-list-item:hover {
    background: #2d2d2d;
  }

  .mtm-error-list-item.active {
    background: #dc3545;
  }

  .mtm-error-list-item:last-child {
    border-bottom: none;
  }

  .mtm-error-list-type {
    font-size: 11px;
    background: #ffc107;
    color: #000;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 600;
  }

  .mtm-error-list-message {
    flex: 1;
    margin: 0 12px;
    font-size: 13px;
  }

  .mtm-error-list-time {
    font-size: 11px;
    color: #999;
  }

  .mtm-error-debug-details {
    margin-top: 8px;
  }

  .mtm-error-debug-details summary {
    cursor: pointer;
    padding: 8px;
    background: #2d2d2d;
    border: 1px solid #444;
    border-radius: 6px;
    margin-bottom: 8px;
  }

  .mtm-error-debug-content {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 12px;
  }

  .mtm-error-debug-actions {
    margin-top: 12px;
    display: flex;
    gap: 8px;
  }

  .mtm-error-btn-copy,
  .mtm-error-btn-verbose {
    background: #28a745;
    border: 1px solid #28a745;
  }

  .mtm-error-btn-copy:hover,
  .mtm-error-btn-verbose:hover {
    background: #218838;
    border-color: #218838;
  }

  .mtm-error-footer {
    background: #2d2d2d;
    border-top: 1px solid #333;
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #999;
  }

  .mtm-error-help kbd {
    background: #444;
    border: 1px solid #666;
    border-radius: 3px;
    padding: 2px 4px;
    font-size: 11px;
    color: #fff;
  }

  @keyframes mtmToastSlideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes mtmToastSlideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  /* Scrollbar styling */
  .mtm-error-content::-webkit-scrollbar,
  .mtm-error-list-container::-webkit-scrollbar,
  .mtm-error-stack-trace::-webkit-scrollbar {
    width: 8px;
  }

  .mtm-error-content::-webkit-scrollbar-track,
  .mtm-error-list-container::-webkit-scrollbar-track,
  .mtm-error-stack-trace::-webkit-scrollbar-track {
    background: #1a1a1a;
  }

  .mtm-error-content::-webkit-scrollbar-thumb,
  .mtm-error-list-container::-webkit-scrollbar-thumb,
  .mtm-error-stack-trace::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 4px;
  }

  .mtm-error-content::-webkit-scrollbar-thumb:hover,
  .mtm-error-list-container::-webkit-scrollbar-thumb:hover,
  .mtm-error-stack-trace::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>
`;

// Initialize error overlay when module loads
let errorOverlay = null;

export function initializeErrorOverlay(options = {}) {
  if (typeof window !== 'undefined' && !errorOverlay) {
    // Add styles to document
    if (!document.getElementById('mtm-error-overlay-styles')) {
      document.head.insertAdjacentHTML('beforeend', overlayStyles);
    }

    // Create error overlay instance
    errorOverlay = new MTMErrorOverlay(options);

    // Make it globally accessible for debugging
    window.mtmErrorOverlay = errorOverlay;

    console.log('🔧 MTM Error Overlay initialized');
  }

  return errorOverlay;
}

export function getErrorOverlay() {
  return errorOverlay;
}

// Auto-initialize in development
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  initializeErrorOverlay({
    enableVerboseLogging: true
  });
}