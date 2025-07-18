/**
 * Vite Plugin for processing .mtm files
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { MTMFileParser as MTMParser, MTMCompiler } from '@metamon/core';
import { HotReloadOrchestrator } from './hot-reload-orchestrator.js';
/**
 * Vite plugin for processing .mtm files
 */
export function mtmPlugin(options = {}) {
    const { include = ['**/*.mtm'], exclude = ['node_modules/**'], sourceMaps = true, hmr = true, hotReload = {} } = options;
    const compiler = new MTMCompiler();
    const compilationCache = new Map();
    // Initialize hot reload orchestrator if HMR is enabled
    const hotReloadOrchestrator = hmr ? new HotReloadOrchestrator({
        preserveState: true,
        batchUpdates: true,
        debounceMs: 100,
        syncFrameworks: true,
        showErrorOverlay: true,
        errorRecoveryMode: 'graceful',
        debugLogging: false,
        ...hotReload
    }) : null;
    /**
     * Compile .mtm file to framework-specific code
     */
    function compileMTMFile(filePath) {
        try {
            // Check cache
            const stats = require('fs').statSync(filePath);
            const timestamp = stats.mtime.getTime();
            const cached = compilationCache.get(filePath);
            if (cached && cached.timestamp >= timestamp) {
                return cached.code;
            }
            // Read and parse .mtm file
            const content = readFileSync(filePath, 'utf-8');
            const mtmFile = MTMParser.parse(content, filePath);
            // Compile to target framework
            const result = compiler.compile(mtmFile);
            // Cache result
            compilationCache.set(filePath, {
                code: result.code,
                timestamp
            });
            // Add file extension based on target framework
            const extension = getFileExtension(mtmFile.frontmatter.target);
            // Log compilation
            console.log(`📝 Compiled ${basename(filePath)} → ${mtmFile.frontmatter.target}${extension}`);
            return result.code;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown compilation error';
            // Handle error through hot reload orchestrator if available
            if (hotReloadOrchestrator) {
                // Use setTimeout to avoid blocking the compilation process
                setTimeout(() => {
                    hotReloadOrchestrator.handleReloadError(filePath, errorMessage, error instanceof Error ? error : undefined);
                }, 0);
            }
            // Return error component for development
            return generateErrorComponent(filePath, errorMessage, getTargetFromPath(filePath), error instanceof Error ? error : undefined);
        }
    }
    /**
     * Get file extension for target framework
     */
    function getFileExtension(target) {
        switch (target) {
            case 'reactjs':
            case 'solid':
                return '.jsx';
            case 'vue':
                return '.vue';
            case 'svelte':
                return '.svelte';
            default:
                return '.js';
        }
    }
    /**
     * Try to determine target framework from file path or content
     */
    function getTargetFromPath(filePath) {
        try {
            const content = readFileSync(filePath, 'utf-8');
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (frontmatterMatch) {
                const yaml = require('yaml');
                const frontmatter = yaml.parse(frontmatterMatch[1]);
                return frontmatter.target || 'reactjs';
            }
        }
        catch (error) {
            // Ignore errors, fallback to react
        }
        return 'reactjs';
    }
    /**
     * Generate error component for development with enhanced error handling
     */
    function generateErrorComponent(filePath, errorMessage, target, originalError) {
        const fileName = basename(filePath);
        // Use error categorizer to enhance the error information
        const errorCategorizer = new (require('./error-categorizer.js').ErrorCategorizer)();
        const categorizedError = errorCategorizer.categorizeError(originalError || errorMessage, filePath);
        const enhancedMessage = categorizedError.message;
        const suggestion = categorizedError.suggestion || 'Check your .mtm file syntax and frontmatter configuration.';
        switch (target) {
            case 'reactjs':
            case 'solid':
                return `
import React from 'react';

export default function MTMError() {
  return React.createElement('div', {
    style: { 
      color: '#dc3545', 
      padding: '20px', 
      border: '2px solid #dc3545',
      borderRadius: '8px',
      margin: '10px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#fff5f5',
      maxWidth: '600px'
    }
  }, [
    React.createElement('div', { 
      key: 'header',
      style: { display: 'flex', alignItems: 'center', marginBottom: '16px' }
    }, [
      React.createElement('span', { key: 'icon', style: { fontSize: '24px', marginRight: '8px' } }, '🚨'),
      React.createElement('h3', { key: 'title', style: { margin: 0, color: '#dc3545' } }, 'MTM Compilation Error')
    ]),
    React.createElement('div', { key: 'file', style: { marginBottom: '12px' } }, [
      React.createElement('strong', { key: 'label' }, 'File: '),
      React.createElement('code', { key: 'name', style: { fontFamily: 'Monaco, Menlo, monospace' } }, '${fileName}')
    ]),
    React.createElement('div', { key: 'error', style: { marginBottom: '16px' } }, [
      React.createElement('strong', { key: 'label' }, 'Error: '),
      React.createElement('pre', { 
        key: 'message', 
        style: { 
          whiteSpace: 'pre-wrap', 
          fontFamily: 'Monaco, Menlo, monospace',
          fontSize: '13px',
          margin: '8px 0',
          padding: '8px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '4px'
        } 
      }, '${enhancedMessage.replace(/'/g, "\\'")}')
    ]),
    React.createElement('div', { 
      key: 'suggestion',
      style: { 
        backgroundColor: '#e7f3ff',
        border: '1px solid #b3d9ff',
        borderRadius: '4px',
        padding: '12px'
      }
    }, [
      React.createElement('strong', { key: 'label', style: { color: '#0066cc' } }, '💡 Suggestion: '),
      React.createElement('span', { key: 'text', style: { color: '#004499' } }, '${suggestion.replace(/'/g, "\\'")}')
    ])
  ]);
}`;
            case 'vue':
                return `
<template>
  <div class="mtm-error">
    <div class="mtm-error-header">
      <span class="mtm-error-icon">🚨</span>
      <h3>MTM Compilation Error</h3>
    </div>
    <div class="mtm-error-content">
      <p><strong>File:</strong> <code>${fileName}</code></p>
      <div class="mtm-error-message">
        <strong>Error:</strong>
        <pre>${enhancedMessage}</pre>
      </div>
      <div class="mtm-error-suggestion">
        <strong>💡 Suggestion:</strong> ${suggestion}
      </div>
    </div>
  </div>
</template>

<style scoped>
.mtm-error {
  color: #dc3545;
  padding: 20px;
  border: 2px solid #dc3545;
  border-radius: 8px;
  margin: 10px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #fff5f5;
  max-width: 600px;
}

.mtm-error-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.mtm-error-icon {
  font-size: 24px;
  margin-right: 8px;
}

.mtm-error h3 {
  margin: 0;
  color: #dc3545;
}

.mtm-error-content > div {
  margin-bottom: 12px;
}

.mtm-error code {
  font-family: Monaco, Menlo, monospace;
}

.mtm-error-message pre {
  white-space: pre-wrap;
  font-family: Monaco, Menlo, monospace;
  font-size: 13px;
  margin: 8px 0;
  padding: 8px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
}

.mtm-error-suggestion {
  background-color: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 4px;
  padding: 12px;
  color: #004499;
}

.mtm-error-suggestion strong {
  color: #0066cc;
}
</style>`;
            case 'svelte':
                return `
<div class="mtm-error">
  <div class="mtm-error-header">
    <span class="mtm-error-icon">🚨</span>
    <h3>MTM Compilation Error</h3>
  </div>
  <div class="mtm-error-content">
    <p><strong>File:</strong> <code>${fileName}</code></p>
    <div class="mtm-error-message">
      <strong>Error:</strong>
      <pre>${enhancedMessage}</pre>
    </div>
    <div class="mtm-error-suggestion">
      <strong>💡 Suggestion:</strong> ${suggestion}
    </div>
  </div>
</div>

<style>
.mtm-error {
  color: #dc3545;
  padding: 20px;
  border: 2px solid #dc3545;
  border-radius: 8px;
  margin: 10px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #fff5f5;
  max-width: 600px;
}

.mtm-error-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.mtm-error-icon {
  font-size: 24px;
  margin-right: 8px;
}

.mtm-error h3 {
  margin: 0;
  color: #dc3545;
}

.mtm-error-content > div {
  margin-bottom: 12px;
}

.mtm-error code {
  font-family: Monaco, Menlo, monospace;
}

.mtm-error-message pre {
  white-space: pre-wrap;
  font-family: Monaco, Menlo, monospace;
  font-size: 13px;
  margin: 8px 0;
  padding: 8px;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
}

.mtm-error-suggestion {
  background-color: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 4px;
  padding: 12px;
  color: #004499;
}

.mtm-error-suggestion strong {
  color: #0066cc;
}
</style>`;
            default:
                return `console.error('MTM Compilation Error in ${fileName}: ${enhancedMessage}');`;
        }
    }
    return {
        name: 'vite-plugin-mtm',
        /**
         * Plugin configuration hook
         */
        configResolved(config) {
            // Store config for potential use in hot reload orchestrator
            if (hotReloadOrchestrator && config.command === 'serve') {
                // Development mode - enable enhanced logging if in debug mode
                if (config.logLevel === 'info' || config.logLevel === 'warn') {
                    hotReloadOrchestrator.updateConfig({ debugLogging: true });
                }
            }
        },
        /**
         * Plugin cleanup
         */
        buildEnd() {
            // Cleanup hot reload orchestrator resources
            if (hotReloadOrchestrator) {
                hotReloadOrchestrator.cleanup();
            }
        },
        /**
         * Resolve .mtm files to their compiled equivalents
         */
        resolveId(id, importer) {
            if (id.endsWith('.mtm')) {
                const resolvedPath = resolve(dirname(importer || ''), id);
                if (existsSync(resolvedPath)) {
                    return resolvedPath + '?mtm-compiled';
                }
            }
            return null;
        },
        /**
         * Load and compile .mtm files
         */
        load(id) {
            if (id.includes('?mtm-compiled')) {
                const filePath = id.replace('?mtm-compiled', '');
                return compileMTMFile(filePath);
            }
            return null;
        },
        /**
         * Transform .mtm files during build
         */
        transform(code, id) {
            if (id.endsWith('.mtm')) {
                return compileMTMFile(id);
            }
            return null;
        },
        /**
         * Transform index.html to inject error overlay client code
         */
        transformIndexHtml(html, ctx) {
            if (ctx.server && hmr && hotReloadOrchestrator) {
                // Read the client-side error overlay code
                const clientPath = resolve(__dirname, 'client/error-overlay-client.js');
                let clientCode = '';
                try {
                    // Try to read the compiled client code, fallback to inline implementation
                    if (existsSync(clientPath)) {
                        clientCode = readFileSync(clientPath, 'utf-8');
                    }
                    else {
                        // Inline client implementation as fallback
                        clientCode = `
// MTM Error Overlay Client (inline)
class ClientErrorOverlay {
  constructor() {
    this.overlay = null;
    this.hideTimeout = null;
  }

  showError(error) {
    this.hideError();
    this.createOverlay(error);
    this.attachEventListeners();
  }

  hideError() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  showSuccess(message, filePath) {
    const notification = this.createNotification('success', message, filePath);
    document.body.appendChild(notification);
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  showLoading(message, filePath) {
    const notification = this.createNotification('loading', message, filePath);
    document.body.appendChild(notification);
    return notification;
  }

  hideLoading(element) {
    if (element && element.parentNode) {
      element.remove();
    }
  }

  createOverlay(error) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'mtm-error-overlay';
    
    const fileName = error.filePath.split('/').pop() || error.filePath;
    const errorTypeDisplay = this.getErrorTypeDisplay(error.type);
    
    this.overlay.innerHTML = \`
      <div class="mtm-error-backdrop">
        <div class="mtm-error-container">
          <div class="mtm-error-header">
            <div class="mtm-error-icon">\${this.getErrorIcon(error.type)}</div>
            <div class="mtm-error-title">
              <h2>\${errorTypeDisplay}</h2>
              <p class="mtm-error-file">\${fileName}</p>
            </div>
            <button class="mtm-error-close">×</button>
          </div>
          <div class="mtm-error-content">
            <div class="mtm-error-message">
              <h3>Error Message</h3>
              <pre>\${this.escapeHtml(error.message)}</pre>
            </div>
            \${error.suggestion ? \`
              <div class="mtm-error-suggestion">
                <h3>💡 Suggestion</h3>
                <p>\${this.escapeHtml(error.suggestion)}</p>
              </div>
            \` : ''}
          </div>
          <div class="mtm-error-footer">
            <div class="mtm-error-recovery">
              <p>\${error.recoverable ? '✅ This error is recoverable. Fix the issue and save the file to continue.' : '⚠️ This is a critical error. You may need to restart the development server.'}</p>
            </div>
          </div>
        </div>
      </div>
    \`;

    this.injectStyles();
    document.body.appendChild(this.overlay);
  }

  createNotification(type, message, filePath) {
    const notification = document.createElement('div');
    notification.className = \`mtm-notification mtm-notification-\${type}\`;
    
    const fileName = filePath ? filePath.split('/').pop() : '';
    const icon = type === 'success' ? '✅' : type === 'loading' ? '⏳' : '❌';
    
    notification.innerHTML = \`
      <div class="mtm-notification-content">
        <div class="mtm-notification-icon">\${icon}</div>
        <div class="mtm-notification-text">
          <div class="mtm-notification-message">\${this.escapeHtml(message)}</div>
          \${fileName ? \`<div class="mtm-notification-file">\${fileName}</div>\` : ''}
        </div>
        \${type === 'loading' ? '<div class="mtm-notification-spinner"></div>' : ''}
      </div>
    \`;

    return notification;
  }

  getErrorTypeDisplay(type) {
    switch (type) {
      case 'compilation_error': return 'Compilation Error';
      case 'syntax_error': return 'Syntax Error';
      case 'import_error': return 'Import Error';
      default: return 'Hot Reload Error';
    }
  }

  getErrorIcon(type) {
    switch (type) {
      case 'compilation_error':
      case 'syntax_error': return '🚨';
      case 'import_error': return '📦';
      default: return '❌';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  attachEventListeners() {
    if (!this.overlay) return;
    
    const closeButton = this.overlay.querySelector('.mtm-error-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hideError());
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.hideError();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    const backdrop = this.overlay.querySelector('.mtm-error-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.hideError();
        }
      });
    }
  }

  injectStyles() {
    if (document.getElementById('mtm-error-styles')) return;

    const style = document.createElement('style');
    style.id = 'mtm-error-styles';
    style.textContent = \`
      #mtm-error-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .mtm-error-backdrop {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.8); display: flex; align-items: center;
        justify-content: center; padding: 20px;
      }
      .mtm-error-container {
        background: white; border-radius: 12px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        max-width: 800px; max-height: 90vh; width: 100%; overflow: hidden;
        display: flex; flex-direction: column;
      }
      .mtm-error-header {
        display: flex; align-items: center; padding: 20px;
        background: #f8f9fa; border-bottom: 1px solid #e9ecef;
      }
      .mtm-error-icon { font-size: 24px; margin-right: 12px; }
      .mtm-error-title { flex: 1; }
      .mtm-error-title h2 { margin: 0; font-size: 18px; color: #dc3545; }
      .mtm-error-file { margin: 4px 0 0 0; font-size: 14px; color: #6c757d; font-family: Monaco, monospace; }
      .mtm-error-close {
        background: none; border: none; font-size: 24px; cursor: pointer;
        color: #6c757d; padding: 0; width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center; border-radius: 4px;
      }
      .mtm-error-close:hover { background: #e9ecef; color: #495057; }
      .mtm-error-content { padding: 20px; overflow-y: auto; flex: 1; }
      .mtm-error-content h3 {
        margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #495057;
        text-transform: uppercase; letter-spacing: 0.5px;
      }
      .mtm-error-content > div { margin-bottom: 20px; }
      .mtm-error-message pre {
        background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px;
        padding: 12px; margin: 0; font-family: Monaco, monospace; font-size: 13px;
        line-height: 1.4; color: #dc3545; white-space: pre-wrap; word-break: break-word;
      }
      .mtm-error-suggestion {
        background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 6px; padding: 12px;
      }
      .mtm-error-suggestion h3 { color: #0066cc; }
      .mtm-error-suggestion p { margin: 0; color: #004499; }
      .mtm-error-footer { padding: 20px; background: #f8f9fa; border-top: 1px solid #e9ecef; }
      .mtm-error-recovery p { margin: 0; font-size: 14px; }
      .mtm-notification {
        position: fixed; top: 20px; right: 20px; background: white; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); padding: 12px 16px; z-index: 999998;
        max-width: 400px; border-left: 4px solid;
      }
      .mtm-notification-success { border-left-color: #28a745; }
      .mtm-notification-loading { border-left-color: #007bff; }
      .mtm-notification-content { display: flex; align-items: center; gap: 8px; }
      .mtm-notification-icon { font-size: 16px; }
      .mtm-notification-text { flex: 1; }
      .mtm-notification-message { font-size: 14px; font-weight: 500; color: #212529; }
      .mtm-notification-file { font-size: 12px; color: #6c757d; font-family: Monaco, monospace; margin-top: 2px; }
      .mtm-notification-spinner {
        width: 16px; height: 16px; border: 2px solid #e9ecef; border-top: 2px solid #007bff;
        border-radius: 50%; animation: mtm-spin 1s linear infinite;
      }
      @keyframes mtm-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    \`;
    document.head.appendChild(style);
  }
}

// Initialize the error overlay
window.mtmErrorOverlay = new ClientErrorOverlay();
`;
                    }
                }
                catch (error) {
                    console.warn('[MTM Plugin] Could not read client error overlay code:', error);
                }
                const clientScript = `
<script type="module">
${clientCode}

// MTM Hot Reload Event Handlers
if (import.meta.hot) {
  // Listen for custom MTM hot reload events
  import.meta.hot.on('mtm:hot-reload', (data) => {
    console.log('[MTM] Hot reload:', data);
    
    if (window.mtmErrorOverlay) {
      const loadingElement = window.mtmErrorOverlay.showLoading(
        'Reloading component...',
        data.file
      );
      
      setTimeout(() => {
        if (loadingElement) {
          window.mtmErrorOverlay.hideLoading(loadingElement);
        }
      }, 2000);
    }
  });

  // Listen for Vite error events
  import.meta.hot.on('vite:error', (payload) => {
    if (window.mtmErrorOverlay && payload.err) {
      const error = {
        type: 'compilation_error',
        filePath: payload.err.id || 'unknown',
        message: payload.err.message || 'Unknown error',
        stack: payload.err.stack,
        recoverable: true,
        line: payload.err.loc?.line,
        column: payload.err.loc?.column
      };
      
      window.mtmErrorOverlay.showError(error);
    }
  });

  // Listen for MTM frontmatter-specific reload events
  import.meta.hot.on('mtm:frontmatter-reload', (data) => {
    console.log('[MTM] Frontmatter hot reload:', data);
    
    if (window.mtmErrorOverlay) {
      window.mtmErrorOverlay.showSuccess(
        'Frontmatter updated - component reloaded',
        data.file
      );
    }
  });

  // Listen for successful updates
  import.meta.hot.on('vite:afterUpdate', () => {
    if (window.mtmErrorOverlay) {
      window.mtmErrorOverlay.hideError();
      window.mtmErrorOverlay.showSuccess('Hot reload completed');
    }
  });
}
</script>`;
                return html.replace('</head>', `${clientScript}\n</head>`);
            }
            return html;
        },
        /**
         * Handle hot module replacement for .mtm files
         */
        async handleHotUpdate(ctx) {
            if (!hmr)
                return;
            const { file, server } = ctx;
            if (file.endsWith('.mtm')) {
                // Use hot reload orchestrator if available
                if (hotReloadOrchestrator) {
                    try {
                        // Read file content for the orchestrator
                        const content = existsSync(file) ? readFileSync(file, 'utf-8') : undefined;
                        // Handle file change through orchestrator (with debouncing and state preservation)
                        await hotReloadOrchestrator.handleFileChange(file, 'mtm', content);
                        // Clear cache for the updated file
                        compilationCache.delete(file);
                        // Find all modules that depend on this .mtm file
                        const modules = Array.from(server.moduleGraph.getModulesByFile(file) || []);
                        if (modules.length > 0) {
                            // Send enhanced HMR update with state preservation info
                            server.ws.send({
                                type: 'update',
                                updates: modules.map(mod => ({
                                    type: 'js-update',
                                    path: mod.url || mod.id || file,
                                    acceptedPath: mod.url || mod.id || file,
                                    timestamp: Date.now()
                                }))
                            });
                            // Send custom message for MTM hot reload with frontmatter change info
                            server.ws.send({
                                type: 'custom',
                                event: 'mtm:hot-reload',
                                data: {
                                    file,
                                    timestamp: Date.now(),
                                    preserveState: hotReloadOrchestrator.getConfig().preserveState,
                                    modules: modules.length,
                                    changeType: 'mtm',
                                    frontmatterSupported: true
                                }
                            });
                            // Send additional message for frontmatter-specific changes
                            server.ws.send({
                                type: 'custom',
                                event: 'mtm:frontmatter-reload',
                                data: {
                                    file,
                                    timestamp: Date.now(),
                                    message: 'MTM frontmatter and configuration hot reload active'
                                }
                            });
                        }
                        return modules;
                    }
                    catch (error) {
                        // Handle orchestrator errors gracefully
                        const errorMessage = error instanceof Error ? error.message : 'Hot reload error';
                        server.ws.send({
                            type: 'error',
                            err: {
                                message: `Hot reload failed for ${basename(file)}: ${errorMessage}`,
                                stack: error instanceof Error ? error.stack : undefined,
                                id: file,
                                frame: '',
                                plugin: 'vite-plugin-mtm',
                                loc: undefined
                            }
                        });
                        // Fallback to basic HMR
                        compilationCache.delete(file);
                        const modules = Array.from(server.moduleGraph.getModulesByFile(file) || []);
                        return modules;
                    }
                }
                else {
                    // Fallback to original HMR behavior when orchestrator is not available
                    compilationCache.delete(file);
                    const modules = Array.from(server.moduleGraph.getModulesByFile(file) || []);
                    if (modules.length > 0) {
                        server.ws.send({
                            type: 'update',
                            updates: modules.map(mod => ({
                                type: 'js-update',
                                path: mod.url || mod.id || file,
                                acceptedPath: mod.url || mod.id || file,
                                timestamp: Date.now()
                            }))
                        });
                    }
                    return modules;
                }
            }
            // Handle native framework files that might be imported by .mtm files
            if (file.match(/\.(jsx?|tsx?|vue|svelte)$/)) {
                if (hotReloadOrchestrator) {
                    try {
                        const content = existsSync(file) ? readFileSync(file, 'utf-8') : undefined;
                        await hotReloadOrchestrator.handleFileChange(file, 'native', content);
                    }
                    catch (error) {
                        // Log error but don't block native framework HMR
                        console.warn(`[MTM Plugin] Failed to handle native file change for ${file}:`, error);
                    }
                }
            }
        }
    };
}
