/**
 * Unit Tests for Error Handling and Edge Cases
 * Tests comprehensive error handling scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Error Handler implementation for testing
interface ErrorInfo {
  type: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  suggestion?: string;
  severity?: 'error' | 'warning' | 'info';
  stack?: string;
}

interface ErrorStats {
  total: number;
  byType: Record<string, number>;
  recent: ErrorInfo[];
  criticalCount: number;
}

class ErrorHandler {
  private errors: ErrorInfo[] = [];
  private maxErrors = 100;
  private errorCallbacks: Array<(error: ErrorInfo) => void> = [];

  handleError(error: ErrorInfo): void {
    // Add timestamp
    const errorWithTimestamp = {
      ...error,
      timestamp: new Date().toISOString(),
      severity: error.severity || 'error'
    };

    this.errors.push(errorWithTimestamp);

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Notify callbacks
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorWithTimestamp);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });

    // Log based on severity
    switch (error.severity) {
      case 'error':
        console.error(`[${error.type}] ${error.message}`, error);
        break;
      case 'warning':
        console.warn(`[${error.type}] ${error.message}`, error);
        break;
      case 'info':
        console.info(`[${error.type}] ${error.message}`, error);
        break;
      default:
        console.error(`[${error.type}] ${error.message}`, error);
    }
  }

  handleFrontmatterError(error: any, filePath: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: 'frontmatter_parse_error',
      message: `Failed to parse frontmatter in ${filePath}: ${error.message}`,
      file: filePath,
      suggestion: 'Check YAML syntax - ensure proper indentation and colons',
      severity: 'error'
    };

    this.handleError(errorInfo);
    return errorInfo;
  }

  handleRouteConflict(route: string, existingFile: string, newFile: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: 'route_conflict',
      message: `Route conflict detected: "${route}" is defined in both ${existingFile} and ${newFile}`,
      suggestion: 'Use unique routes for each page or remove duplicate definitions',
      severity: 'error'
    };

    this.handleError(errorInfo);
    return errorInfo;
  }

  handleTransformError(error: any, framework: string, filePath?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: 'transform_error',
      message: `Failed to transform MTM to ${framework}: ${error.message}`,
      file: filePath,
      suggestion: 'Check MTM syntax and framework compatibility',
      severity: 'error',
      stack: error.stack
    };

    this.handleError(errorInfo);
    return errorInfo;
  }

  handleNavigationError(error: any, path: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: 'navigation_error',
      message: `Navigation failed for ${path}: ${error.message}`,
      suggestion: 'Check if route exists and is properly configured',
      severity: 'error'
    };

    this.handleError(errorInfo);
    return errorInfo;
  }

  handleComponentLoadError(error: any, componentPath: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: 'component_load_error',
      message: `Failed to load component ${componentPath}: ${error.message}`,
      suggestion: 'Check component file exists and has valid syntax',
      severity: 'error'
    };

    this.handleError(errorInfo);
    return errorInfo;
  }

  handleRenderError(error: any, componentName: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: 'render_error',
      message: `Failed to render component ${componentName}: ${error.message}`,
      suggestion: 'Check component props and template syntax',
      severity: 'error',
      stack: error.stack
    };

    this.handleError(errorInfo);
    return errorInfo;
  }

  handleValidationError(field: string, value: any, rule: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: 'validation_error',
      message: `Validation failed for ${field}: ${rule}`,
      suggestion: `Ensure ${field} meets the required format: ${rule}`,
      severity: 'warning'
    };

    this.handleError(errorInfo);
    return errorInfo;
  }

  handleBuildError(error: any, stage: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      type: 'build_error',
      message: `Build failed at ${stage}: ${error.message}`,
      suggestion: 'Check build configuration and dependencies',
      severity: 'error',
      stack: error.stack
    };

    this.handleError(errorInfo);
    return errorInfo;
  }

  getErrorStats(): ErrorStats {
    const byType: Record<string, number> = {};
    let criticalCount = 0;

    this.errors.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      if (error.severity === 'error') {
        criticalCount++;
      }
    });

    return {
      total: this.errors.length,
      byType,
      recent: this.errors.slice(-10),
      criticalCount
    };
  }

  getErrorsByType(type: string): ErrorInfo[] {
    return this.errors.filter(error => error.type === type);
  }

  getRecentErrors(count: number = 10): ErrorInfo[] {
    return this.errors.slice(-count);
  }

  clearErrors(): void {
    this.errors = [];
  }

  onError(callback: (error: ErrorInfo) => void): void {
    this.errorCallbacks.push(callback);
  }

  offError(callback: (error: ErrorInfo) => void): void {
    const index = this.errorCallbacks.indexOf(callback);
    if (index > -1) {
      this.errorCallbacks.splice(index, 1);
    }
  }

  formatError(error: ErrorInfo): string {
    let formatted = `[${error.type.toUpperCase()}] ${error.message}`;
    
    if (error.file) {
      formatted += `\n  File: ${error.file}`;
    }
    
    if (error.line !== undefined) {
      formatted += `:${error.line}`;
      if (error.column !== undefined) {
        formatted += `:${error.column}`;
      }
    }
    
    if (error.suggestion) {
      formatted += `\n  💡 Suggestion: ${error.suggestion}`;
    }
    
    return formatted;
  }

  createErrorBoundary(fallbackComponent: any) {
    return {
      handleError: (error: any, errorInfo: any) => {
        this.handleRenderError(error, errorInfo.componentStack || 'Unknown');
        return fallbackComponent;
      },
      reset: () => {
        // Reset error boundary state
      }
    };
  }

  createRecoveryStrategy(errorType: string, recoveryFn: () => any) {
    return {
      canRecover: (error: ErrorInfo) => error.type === errorType,
      recover: recoveryFn
    };
  }
}

describe('Error Handling', () => {
  let errorHandler: ErrorHandler;
  let consoleSpy: any;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Error Handling', () => {
    it('should handle generic errors', () => {
      const error: ErrorInfo = {
        type: 'generic_error',
        message: 'Something went wrong',
        severity: 'error'
      };

      errorHandler.handleError(error);

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);
      expect(stats.byType.generic_error).toBe(1);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle warnings', () => {
      const warning: ErrorInfo = {
        type: 'validation_warning',
        message: 'Deprecated syntax used',
        severity: 'warning'
      };

      errorHandler.handleError(warning);

      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });

    it('should handle info messages', () => {
      const info: ErrorInfo = {
        type: 'build_info',
        message: 'Build completed successfully',
        severity: 'info'
      };

      errorHandler.handleError(info);

      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe('Frontmatter Error Handling', () => {
    it('should handle frontmatter parsing errors', () => {
      const parseError = new Error('Invalid YAML syntax');
      const filePath = 'test.mtm';

      const errorInfo = errorHandler.handleFrontmatterError(parseError, filePath);

      expect(errorInfo.type).toBe('frontmatter_parse_error');
      expect(errorInfo.message).toContain(filePath);
      expect(errorInfo.message).toContain('Invalid YAML syntax');
      expect(errorInfo.suggestion).toContain('YAML syntax');
      expect(errorInfo.file).toBe(filePath);
    });

    it('should provide helpful suggestions for frontmatter errors', () => {
      const parseError = new Error('Unexpected token');
      const errorInfo = errorHandler.handleFrontmatterError(parseError, 'test.mtm');

      expect(errorInfo.suggestion).toContain('indentation');
      expect(errorInfo.suggestion).toContain('colons');
    });
  });

  describe('Route Conflict Handling', () => {
    it('should handle route conflicts', () => {
      const route = '/test';
      const existingFile = 'pages/test.mtm';
      const newFile = 'pages/test-duplicate.mtm';

      const errorInfo = errorHandler.handleRouteConflict(route, existingFile, newFile);

      expect(errorInfo.type).toBe('route_conflict');
      expect(errorInfo.message).toContain(route);
      expect(errorInfo.message).toContain(existingFile);
      expect(errorInfo.message).toContain(newFile);
      expect(errorInfo.suggestion).toContain('unique routes');
    });
  });

  describe('Transform Error Handling', () => {
    it('should handle transformation errors', () => {
      const transformError = new Error('Unsupported syntax');
      transformError.stack = 'Error stack trace';
      const framework = 'react';
      const filePath = 'component.mtm';

      const errorInfo = errorHandler.handleTransformError(transformError, framework, filePath);

      expect(errorInfo.type).toBe('transform_error');
      expect(errorInfo.message).toContain(framework);
      expect(errorInfo.message).toContain('Unsupported syntax');
      expect(errorInfo.file).toBe(filePath);
      expect(errorInfo.stack).toBe('Error stack trace');
      expect(errorInfo.suggestion).toContain('MTM syntax');
    });

    it('should handle framework-specific errors', () => {
      const reactError = new Error('JSX syntax error');
      const vueError = new Error('Template compilation error');

      const reactErrorInfo = errorHandler.handleTransformError(reactError, 'react');
      const vueErrorInfo = errorHandler.handleTransformError(vueError, 'vue');

      expect(reactErrorInfo.message).toContain('react');
      expect(vueErrorInfo.message).toContain('vue');
    });
  });

  describe('Navigation Error Handling', () => {
    it('should handle navigation errors', () => {
      const navError = new Error('Route not found');
      const path = '/non-existent';

      const errorInfo = errorHandler.handleNavigationError(navError, path);

      expect(errorInfo.type).toBe('navigation_error');
      expect(errorInfo.message).toContain(path);
      expect(errorInfo.message).toContain('Route not found');
      expect(errorInfo.suggestion).toContain('route exists');
    });
  });

  describe('Component Error Handling', () => {
    it('should handle component load errors', () => {
      const loadError = new Error('Module not found');
      const componentPath = './components/MyComponent';

      const errorInfo = errorHandler.handleComponentLoadError(loadError, componentPath);

      expect(errorInfo.type).toBe('component_load_error');
      expect(errorInfo.message).toContain(componentPath);
      expect(errorInfo.suggestion).toContain('component file exists');
    });

    it('should handle render errors', () => {
      const renderError = new Error('Cannot read property of undefined');
      renderError.stack = 'Render error stack';
      const componentName = 'MyComponent';

      const errorInfo = errorHandler.handleRenderError(renderError, componentName);

      expect(errorInfo.type).toBe('render_error');
      expect(errorInfo.message).toContain(componentName);
      expect(errorInfo.stack).toBe('Render error stack');
      expect(errorInfo.suggestion).toContain('props');
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle validation errors', () => {
      const field = 'route';
      const value = 'invalid-route';
      const rule = 'must start with /';

      const errorInfo = errorHandler.handleValidationError(field, value, rule);

      expect(errorInfo.type).toBe('validation_error');
      expect(errorInfo.message).toContain(field);
      expect(errorInfo.message).toContain(rule);
      expect(errorInfo.severity).toBe('warning');
      expect(errorInfo.suggestion).toContain(field);
    });
  });

  describe('Build Error Handling', () => {
    it('should handle build errors', () => {
      const buildError = new Error('Compilation failed');
      buildError.stack = 'Build error stack';
      const stage = 'compilation';

      const errorInfo = errorHandler.handleBuildError(buildError, stage);

      expect(errorInfo.type).toBe('build_error');
      expect(errorInfo.message).toContain(stage);
      expect(errorInfo.stack).toBe('Build error stack');
      expect(errorInfo.suggestion).toContain('build configuration');
    });
  });

  describe('Error Statistics and Retrieval', () => {
    it('should track error statistics', () => {
      errorHandler.handleError({ type: 'error1', message: 'Error 1', severity: 'error' });
      errorHandler.handleError({ type: 'error1', message: 'Error 1 again', severity: 'error' });
      errorHandler.handleError({ type: 'error2', message: 'Error 2', severity: 'warning' });

      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.error1).toBe(2);
      expect(stats.byType.error2).toBe(1);
      expect(stats.criticalCount).toBe(2); // Only errors, not warnings
    });

    it('should retrieve errors by type', () => {
      errorHandler.handleError({ type: 'type1', message: 'Message 1' });
      errorHandler.handleError({ type: 'type2', message: 'Message 2' });
      errorHandler.handleError({ type: 'type1', message: 'Message 3' });

      const type1Errors = errorHandler.getErrorsByType('type1');
      const type2Errors = errorHandler.getErrorsByType('type2');

      expect(type1Errors).toHaveLength(2);
      expect(type2Errors).toHaveLength(1);
      expect(type1Errors[0].message).toBe('Message 1');
      expect(type1Errors[1].message).toBe('Message 3');
    });

    it('should retrieve recent errors', () => {
      for (let i = 0; i < 15; i++) {
        errorHandler.handleError({ type: 'test', message: `Error ${i}` });
      }

      const recent = errorHandler.getRecentErrors(5);

      expect(recent).toHaveLength(5);
      expect(recent[4].message).toBe('Error 14'); // Most recent
      expect(recent[0].message).toBe('Error 10'); // 5th most recent
    });

    it('should limit stored errors', () => {
      // Create handler with small limit for testing
      const limitedHandler = new (class extends ErrorHandler {
        constructor() {
          super();
          (this as any).maxErrors = 5;
        }
      })();

      // Add more errors than the limit
      for (let i = 0; i < 10; i++) {
        limitedHandler.handleError({ type: 'test', message: `Error ${i}` });
      }

      const stats = limitedHandler.getErrorStats();
      expect(stats.total).toBe(5); // Should be limited to 5
    });
  });

  describe('Error Callbacks and Events', () => {
    it('should notify error callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      errorHandler.onError(callback1);
      errorHandler.onError(callback2);

      const error = { type: 'test', message: 'Test error' };
      errorHandler.handleError(error);

      expect(callback1).toHaveBeenCalledWith(expect.objectContaining(error));
      expect(callback2).toHaveBeenCalledWith(expect.objectContaining(error));
    });

    it('should remove error callbacks', () => {
      const callback = vi.fn();

      errorHandler.onError(callback);
      errorHandler.offError(callback);

      errorHandler.handleError({ type: 'test', message: 'Test error' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const faultyCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      errorHandler.onError(faultyCallback);

      // Should not throw when callback fails
      expect(() => {
        errorHandler.handleError({ type: 'test', message: 'Test error' });
      }).not.toThrow();

      expect(faultyCallback).toHaveBeenCalled();
    });
  });

  describe('Error Formatting', () => {
    it('should format errors with all information', () => {
      const error: ErrorInfo = {
        type: 'test_error',
        message: 'Test error message',
        file: 'test.mtm',
        line: 10,
        column: 5,
        suggestion: 'Fix the syntax'
      };

      const formatted = errorHandler.formatError(error);

      expect(formatted).toContain('[TEST_ERROR]');
      expect(formatted).toContain('Test error message');
      expect(formatted).toContain('File: test.mtm:10:5');
      expect(formatted).toContain('💡 Suggestion: Fix the syntax');
    });

    it('should format errors with minimal information', () => {
      const error: ErrorInfo = {
        type: 'simple_error',
        message: 'Simple error'
      };

      const formatted = errorHandler.formatError(error);

      expect(formatted).toContain('[SIMPLE_ERROR]');
      expect(formatted).toContain('Simple error');
      expect(formatted).not.toContain('File:');
      expect(formatted).not.toContain('💡 Suggestion:');
    });
  });

  describe('Error Boundary', () => {
    it('should create error boundary', () => {
      const fallbackComponent = { type: 'div', props: { children: 'Error occurred' } };
      const boundary = errorHandler.createErrorBoundary(fallbackComponent);

      expect(boundary.handleError).toBeDefined();
      expect(boundary.reset).toBeDefined();

      const result = boundary.handleError(new Error('Component error'), { componentStack: 'TestComponent' });
      expect(result).toBe(fallbackComponent);

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);
      expect(stats.byType.render_error).toBe(1);
    });
  });

  describe('Recovery Strategies', () => {
    it('should create recovery strategy', () => {
      const recoveryFn = vi.fn(() => 'recovered');
      const strategy = errorHandler.createRecoveryStrategy('test_error', recoveryFn);

      expect(strategy.canRecover({ type: 'test_error', message: 'test' })).toBe(true);
      expect(strategy.canRecover({ type: 'other_error', message: 'test' })).toBe(false);

      const result = strategy.recover();
      expect(result).toBe('recovered');
      expect(recoveryFn).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined errors gracefully', () => {
      expect(() => {
        errorHandler.handleError(null as any);
      }).not.toThrow();

      expect(() => {
        errorHandler.handleError(undefined as any);
      }).not.toThrow();
    });

    it('should handle errors with circular references', () => {
      const circularError: any = { type: 'circular', message: 'test' };
      circularError.self = circularError;

      expect(() => {
        errorHandler.handleError(circularError);
      }).not.toThrow();
    });

    it('should handle very long error messages', () => {
      const longMessage = 'a'.repeat(10000);
      const error: ErrorInfo = {
        type: 'long_error',
        message: longMessage
      };

      expect(() => {
        errorHandler.handleError(error);
      }).not.toThrow();

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);
    });

    it('should handle unicode characters in error messages', () => {
      const error: ErrorInfo = {
        type: 'unicode_error',
        message: '错误信息 🚨 Erreur français'
      };

      expect(() => {
        errorHandler.handleError(error);
      }).not.toThrow();

      const formatted = errorHandler.formatError(error);
      expect(formatted).toContain('错误信息 🚨 Erreur français');
    });
  });

  describe('Memory Management', () => {
    it('should clear all errors', () => {
      for (let i = 0; i < 10; i++) {
        errorHandler.handleError({ type: 'test', message: `Error ${i}` });
      }

      expect(errorHandler.getErrorStats().total).toBe(10);

      errorHandler.clearErrors();

      expect(errorHandler.getErrorStats().total).toBe(0);
    });

    it('should handle high volume of errors efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        errorHandler.handleError({ type: 'perf_test', message: `Error ${i}` });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should handle 1000 errors in less than 1 second
      expect(errorHandler.getErrorStats().total).toBeLessThanOrEqual(100); // Should be limited by maxErrors
    });
  });
});