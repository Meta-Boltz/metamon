/**
 * Comprehensive Error Handling System for MTM Framework
 * Provides detailed error classes with suggestions and recovery mechanisms
 */

/**
 * Base error class for MTM framework errors
 */
class MTMError extends Error {
  constructor(message, type, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get formatted error message with context
   * @returns {string} Formatted error message
   */
  getFormattedMessage() {
    let message = `[${this.type}] ${this.message}`;

    if (this.context.file) {
      message += `\n  File: ${this.context.file}`;
    }

    if (this.context.line) {
      message += `\n  Line: ${this.context.line}`;
    }

    if (this.context.column) {
      message += `\n  Column: ${this.context.column}`;
    }

    return message;
  }

  /**
   * Get error details as object
   * @returns {Object} Error details
   */
  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Compilation-time errors that occur during MTM file processing
 */
class CompilationError extends MTMError {
  constructor(message, subtype, context = {}, suggestions = []) {
    super(message, `compilation-${subtype}`, context);
    this.subtype = subtype;
    this.suggestions = suggestions;
    this.severity = context.severity || 'error';
  }

  /**
   * Get formatted error message with suggestions
   * @returns {string} Formatted error message with suggestions
   */
  getFormattedMessage() {
    let message = super.getFormattedMessage();

    if (this.suggestions.length > 0) {
      message += '\n\nSuggestions:';
      this.suggestions.forEach((suggestion, index) => {
        message += `\n  ${index + 1}. ${suggestion}`;
      });
    }

    return message;
  }

  /**
   * Create route conflict error
   * @param {string} route - The conflicting route
   * @param {string} existingFile - File that already registered the route
   * @param {string} newFile - File trying to register the route
   * @returns {CompilationError} Route conflict error
   */
  static routeConflict(route, existingFile, newFile) {
    const message = `Route "${route}" is already registered by "${existingFile}"`;
    const context = {
      route,
      existingFile,
      newFile,
      severity: 'error'
    };
    const suggestions = [
      `Change the route in "${newFile}" to a different path`,
      `Remove the duplicate route definition`,
      `Use a dynamic route parameter if appropriate (e.g., "/user/[id]")`,
      `Check if both files should actually use the same route`
    ];

    return new CompilationError(message, 'route-conflict', context, suggestions);
  }

  /**
   * Create dynamic route conflict error
   * @param {string} route1 - First conflicting route
   * @param {string} route2 - Second conflicting route
   * @param {string} file1 - First file
   * @param {string} file2 - Second file
   * @returns {CompilationError} Dynamic route conflict error
   */
  static dynamicRouteConflict(route1, route2, file1, file2) {
    const message = `Dynamic routes "${route1}" and "${route2}" conflict - they have the same structure`;
    const context = {
      route1,
      route2,
      file1,
      file2,
      severity: 'error'
    };
    const suggestions = [
      `Use different route structures (e.g., "/user/[id]" vs "/admin/[id]")`,
      `Combine the functionality into a single route`,
      `Add distinguishing path segments (e.g., "/user/profile/[id]" vs "/user/settings/[id]")`,
      `Consider using query parameters instead of route parameters`
    ];

    return new CompilationError(message, 'dynamic-route-conflict', context, suggestions);
  }

  /**
   * Create import resolution error
   * @param {string} importPath - The import path that couldn't be resolved
   * @param {string} file - File containing the import
   * @param {number} line - Line number of the import
   * @param {string[]} searchPaths - Paths that were searched
   * @returns {CompilationError} Import resolution error
   */
  static importResolution(importPath, file, line, searchPaths = []) {
    const message = `Cannot resolve import "${importPath}"`;
    const context = {
      importPath,
      file,
      line,
      searchPaths,
      severity: 'error'
    };

    const suggestions = [
      `Check if the file exists at the specified path`,
      `Verify the file extension is correct (.tsx, .jsx, .vue, .svelte)`,
      `Use @components/ prefix for components in src/components/`,
      `Check for typos in the import path`
    ];

    // Add specific suggestions based on import path
    if (importPath.startsWith('@components/')) {
      suggestions.push(`Ensure the component exists in src/components/`);
    } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
      suggestions.push(`Check the relative path from ${file}`);
    } else {
      suggestions.push(`Consider using a relative path (./ComponentName) or @components/ prefix`);
    }

    // Add suggestions based on searched paths
    if (searchPaths.length > 0) {
      suggestions.push(`Searched in: ${searchPaths.join(', ')}`);
    }

    return new CompilationError(message, 'import-resolution', context, suggestions);
  }

  /**
   * Create syntax error
   * @param {string} message - Error message
   * @param {string} file - File with syntax error
   * @param {number} line - Line number
   * @param {number} column - Column number
   * @param {string} source - Source code snippet
   * @returns {CompilationError} Syntax error
   */
  static syntax(message, file, line, column, source = '') {
    const context = {
      file,
      line,
      column,
      source,
      severity: 'error'
    };

    const suggestions = [
      'Check for missing or extra brackets, parentheses, or quotes',
      'Verify proper MTM syntax is being used',
      'Check the documentation for correct syntax examples',
      'Use a code editor with MTM syntax highlighting'
    ];

    return new CompilationError(message, 'syntax', context, suggestions);
  }

  /**
   * Create frontmatter validation error
   * @param {string} field - Invalid field name
   * @param {string} value - Invalid value
   * @param {string} file - File with invalid frontmatter
   * @param {string[]} validValues - Valid values for the field
   * @returns {CompilationError} Frontmatter validation error
   */
  static frontmatterValidation(field, value, file, validValues = []) {
    const message = `Invalid frontmatter field "${field}": "${value}"`;
    const context = {
      field,
      value,
      file,
      validValues,
      severity: 'error'
    };

    const suggestions = [
      `Check the documentation for valid ${field} values`
    ];

    if (validValues.length > 0) {
      suggestions.push(`Valid values: ${validValues.join(', ')}`);
    }

    // Field-specific suggestions
    if (field === 'route') {
      suggestions.push('Routes must start with "/" (e.g., "/home", "/user/[id]")');
    } else if (field === 'compileJsMode') {
      suggestions.push('Use "inline", "external.js", or a custom .js filename');
    }

    return new CompilationError(message, 'frontmatter-validation', context, suggestions);
  }

  /**
   * Create component framework mismatch error
   * @param {string} componentName - Component name
   * @param {string} expectedFramework - Expected framework
   * @param {string} actualFramework - Actual framework detected
   * @param {string} file - File with the mismatch
   * @returns {CompilationError} Framework mismatch error
   */
  static frameworkMismatch(componentName, expectedFramework, actualFramework, file) {
    const message = `Component "${componentName}" framework mismatch: expected ${expectedFramework}, got ${actualFramework}`;
    const context = {
      componentName,
      expectedFramework,
      actualFramework,
      file,
      severity: 'warning'
    };

    const suggestions = [
      `Verify the component file extension matches the framework (.tsx for React, .vue for Vue, etc.)`,
      `Check if the component is actually written in ${expectedFramework}`,
      `Update the import path to use the correct file extension`,
      `Consider using a different component that matches the expected framework`
    ];

    return new CompilationError(message, 'framework-mismatch', context, suggestions);
  }
}

/**
 * Runtime errors that occur during application execution
 */
class RuntimeError extends MTMError {
  constructor(message, subtype, context = {}, recoveryActions = []) {
    super(message, `runtime-${subtype}`, context);
    this.subtype = subtype;
    this.recoveryActions = recoveryActions;
    this.severity = context.severity || 'error';
  }

  /**
   * Get formatted error message with recovery actions
   * @returns {string} Formatted error message with recovery actions
   */
  getFormattedMessage() {
    let message = super.getFormattedMessage();

    if (this.recoveryActions.length > 0) {
      message += '\n\nRecovery Actions:';
      this.recoveryActions.forEach((action, index) => {
        message += `\n  ${index + 1}. ${action}`;
      });
    }

    return message;
  }

  /**
   * Create navigation error
   * @param {string} path - Path that couldn't be navigated to
   * @param {string} reason - Reason for navigation failure
   * @param {Object} context - Additional context
   * @returns {RuntimeError} Navigation error
   */
  static navigation(path, reason, context = {}) {
    const message = `Navigation to "${path}" failed: ${reason}`;
    const errorContext = {
      path,
      reason,
      ...context,
      severity: 'error'
    };

    const recoveryActions = [
      'Check if the route is properly registered',
      'Verify the path format is correct',
      'Ensure the target page exists',
      'Try navigating to a known working route'
    ];

    return new RuntimeError(message, 'navigation', errorContext, recoveryActions);
  }

  /**
   * Create component mounting error
   * @param {string} componentName - Component that failed to mount
   * @param {string} reason - Reason for mounting failure
   * @param {Object} context - Additional context
   * @returns {RuntimeError} Component mounting error
   */
  static componentMount(componentName, reason, context = {}) {
    const message = `Failed to mount component "${componentName}": ${reason}`;
    const errorContext = {
      componentName,
      reason,
      ...context,
      severity: 'error'
    };

    const recoveryActions = [
      'Check if the component is properly imported',
      'Verify the component props are valid',
      'Ensure the framework runtime is loaded',
      'Check browser console for additional errors',
      'Try refreshing the page'
    ];

    return new RuntimeError(message, 'component-mount', errorContext, recoveryActions);
  }

  /**
   * Create state management error
   * @param {string} operation - Operation that failed
   * @param {string} reason - Reason for failure
   * @param {Object} context - Additional context
   * @returns {RuntimeError} State management error
   */
  static stateManagement(operation, reason, context = {}) {
    const message = `State management operation "${operation}" failed: ${reason}`;
    const errorContext = {
      operation,
      reason,
      ...context,
      severity: 'error'
    };

    const recoveryActions = [
      'Check if the state variable is properly initialized',
      'Verify the state update syntax is correct',
      'Ensure reactive dependencies are properly set up',
      'Try resetting the state to its initial value'
    ];

    return new RuntimeError(message, 'state-management', errorContext, recoveryActions);
  }

  /**
   * Create framework runtime error
   * @param {string} framework - Framework that caused the error
   * @param {string} reason - Reason for the error
   * @param {Object} context - Additional context
   * @returns {RuntimeError} Framework runtime error
   */
  static frameworkRuntime(framework, reason, context = {}) {
    const message = `${framework} runtime error: ${reason}`;
    const errorContext = {
      framework,
      reason,
      ...context,
      severity: 'error'
    };

    const recoveryActions = [
      `Ensure ${framework} is properly loaded`,
      `Check ${framework} version compatibility`,
      'Verify component syntax is correct',
      'Check browser console for framework-specific errors',
      'Try reloading the page'
    ];

    return new RuntimeError(message, 'framework-runtime', errorContext, recoveryActions);
  }
}

/**
 * Error handler utility class
 */
class ErrorHandler {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.handlers = new Map();
  }

  /**
   * Register error handler for specific error types
   * @param {string} errorType - Type of error to handle
   * @param {Function} handler - Handler function
   */
  registerHandler(errorType, handler) {
    if (!this.handlers.has(errorType)) {
      this.handlers.set(errorType, []);
    }
    this.handlers.get(errorType).push(handler);
  }

  /**
   * Handle an error
   * @param {MTMError} error - Error to handle
   */
  handleError(error) {
    // Add to appropriate collection
    if (error.severity === 'warning') {
      this.warnings.push(error);
    } else {
      this.errors.push(error);
    }

    // Call registered handlers
    const handlers = this.handlers.get(error.type) || [];
    handlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });

    // Default console logging
    if (error.severity === 'error') {
      console.error(error.getFormattedMessage());
    } else {
      console.warn(error.getFormattedMessage());
    }
  }

  /**
   * Get all errors
   * @returns {MTMError[]} All errors
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Get all warnings
   * @returns {MTMError[]} All warnings
   */
  getWarnings() {
    return [...this.warnings];
  }

  /**
   * Check if there are any errors
   * @returns {boolean} True if there are errors
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Check if there are any warnings
   * @returns {boolean} True if there are warnings
   */
  hasWarnings() {
    return this.warnings.length > 0;
  }

  /**
   * Clear all errors and warnings
   */
  clear() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Get error summary
   * @returns {Object} Error summary
   */
  getSummary() {
    return {
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors.map(e => e.toJSON()),
      warnings: this.warnings.map(w => w.toJSON())
    };
  }
}

/**
 * Component error boundary for fallback rendering
 */
class ComponentErrorBoundary {
  constructor(componentName, fallbackRenderer) {
    this.componentName = componentName;
    this.fallbackRenderer = fallbackRenderer || this.defaultFallbackRenderer;
    this.errorCount = 0;
    this.lastError = null;
  }

  /**
   * Try to render component with error handling
   * @param {Function} renderFunction - Function to render the component
   * @param {Object} props - Component props
   * @returns {string|HTMLElement} Rendered component or fallback
   */
  tryRender(renderFunction, props = {}) {
    try {
      return renderFunction(props);
    } catch (error) {
      this.errorCount++;
      this.lastError = error;

      const runtimeError = RuntimeError.componentMount(
        this.componentName,
        error.message,
        {
          props,
          errorCount: this.errorCount,
          originalError: error
        }
      );

      // Log the error
      console.error(runtimeError.getFormattedMessage());

      // Return fallback rendering
      return this.fallbackRenderer(runtimeError, props);
    }
  }

  /**
   * Default fallback renderer
   * @param {RuntimeError} error - The error that occurred
   * @param {Object} props - Component props
   * @returns {string} Fallback HTML
   */
  defaultFallbackRenderer(error, props) {
    return `
      <div class="mtm-component-error" style="
        border: 2px solid #ff6b6b;
        border-radius: 4px;
        padding: 12px;
        margin: 8px 0;
        background-color: #ffe0e0;
        color: #d63031;
        font-family: monospace;
        font-size: 14px;
      ">
        <div style="font-weight: bold; margin-bottom: 8px;">
          ⚠️ Component Error: ${this.componentName}
        </div>
        <div style="margin-bottom: 8px;">
          ${error.message}
        </div>
        <details style="margin-top: 8px;">
          <summary style="cursor: pointer; font-weight: bold;">
            Error Details
          </summary>
          <pre style="margin: 8px 0; padding: 8px; background: #f8f8f8; border-radius: 2px; overflow-x: auto;">
${JSON.stringify(error.toJSON(), null, 2)}
          </pre>
        </details>
        ${this.errorCount > 1 ? `<div style="margin-top: 8px; font-size: 12px;">Error count: ${this.errorCount}</div>` : ''}
      </div>
    `;
  }

  /**
   * Reset error state
   */
  reset() {
    this.errorCount = 0;
    this.lastError = null;
  }
}

module.exports = {
  MTMError,
  CompilationError,
  RuntimeError,
  ErrorHandler,
  ComponentErrorBoundary
};