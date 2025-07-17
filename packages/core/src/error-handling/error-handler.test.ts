import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler, errorHandler } from './error-handler.js';
import { CompilationError } from './compilation-error.js';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;
  let consoleSpy: any;

  beforeEach(() => {
    handler = ErrorHandler.getInstance();
    handler.clearListeners();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should be singleton', () => {
    const handler1 = ErrorHandler.getInstance();
    const handler2 = ErrorHandler.getInstance();
    expect(handler1).toBe(handler2);
  });

  it('should export singleton instance', () => {
    expect(errorHandler).toBe(ErrorHandler.getInstance());
  });

  it('should handle compilation error and log formatted message', () => {
    const error = new CompilationError('syntax', 'Missing semicolon', 'test.mtm', {
      line: 10,
      column: 5,
      suggestions: ['Add semicolon']
    });

    handler.handleCompilationError(error);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('🚨 SYNTAX ERROR in test.mtm')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Missing semicolon')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('💡 Suggestions:')
    );
  });

  it('should format error message with all details', () => {
    const originalError = new Error('Original error');
    const error = new CompilationError('framework', 'React error', 'component.mtm', {
      line: 15,
      column: 8,
      suggestions: ['Check imports', 'Verify syntax'],
      originalError,
      context: 'JSX compilation'
    });

    const formatted = handler.formatErrorMessage(error);

    expect(formatted).toContain('🚨 FRAMEWORK ERROR in component.mtm');
    expect(formatted).toContain('at line 15:8');
    expect(formatted).toContain('❌ React error');
    expect(formatted).toContain('📝 Context:');
    expect(formatted).toContain('JSX compilation');
    expect(formatted).toContain('🔍 Original Error:');
    expect(formatted).toContain('Original error');
    expect(formatted).toContain('💡 Suggestions:');
    expect(formatted).toContain('• Check imports');
    expect(formatted).toContain('• Verify syntax');
  });

  it('should provide context-aware suggestions', () => {
    const error = new CompilationError('syntax', 'Invalid syntax', 'test.mtm', {
      suggestions: ['Original suggestion']
    });

    const suggestions = handler.provideSuggestions(error);

    expect(suggestions).toContain('Original suggestion');
    expect(suggestions).toContain('Use a linter or formatter for your target framework');
    expect(suggestions).toContain('Check the framework documentation for syntax requirements');
  });

  it('should provide MTM-specific suggestions', () => {
    const error = new CompilationError('frontmatter', 'Invalid YAML', 'component.mtm');
    const suggestions = handler.provideSuggestions(error);

    expect(suggestions).toContain('Verify .mtm file structure and frontmatter format');
    expect(suggestions).toContain('Check that target framework matches component code');
  });

  it('should add and remove error listeners', () => {
    const listener = vi.fn();
    const unsubscribe = handler.addErrorListener(listener);

    const error = new CompilationError('syntax', 'Test error', 'test.mtm');
    handler.handleCompilationError(error);

    expect(listener).toHaveBeenCalledWith(error);

    // Unsubscribe and test
    unsubscribe();
    listener.mockClear();
    
    handler.handleCompilationError(error);
    expect(listener).not.toHaveBeenCalled();
  });

  it('should handle listener errors gracefully', () => {
    const faultyListener = vi.fn().mockImplementation(() => {
      throw new Error('Listener error');
    });
    const goodListener = vi.fn();

    handler.addErrorListener(faultyListener);
    handler.addErrorListener(goodListener);

    const error = new CompilationError('syntax', 'Test error', 'test.mtm');
    handler.handleCompilationError(error);

    expect(faultyListener).toHaveBeenCalled();
    expect(goodListener).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Error in error listener:', expect.any(Error));
  });

  it('should create error from generic Error', () => {
    const originalError = new Error('Generic error');
    const compilationError = handler.createFromError(
      originalError,
      'runtime',
      'test.mtm',
      'During execution'
    );

    expect(compilationError.type).toBe('runtime');
    expect(compilationError.message).toBe('Generic error');
    expect(compilationError.file).toBe('test.mtm');
    expect(compilationError.originalError).toBe(originalError);
    expect(compilationError.context).toBe('During execution');
  });

  it('should enhance existing error', () => {
    const basicError = {
      type: 'syntax' as const,
      message: 'Basic error',
      file: 'test.mtm',
      line: 5,
      suggestions: ['Fix it']
    };

    const enhanced = handler.enhanceError(basicError);

    expect(enhanced).toBeInstanceOf(CompilationError);
    expect(enhanced.type).toBe('syntax');
    expect(enhanced.message).toBe('Basic error');
    expect(enhanced.line).toBe(5);
    expect(enhanced.suggestions).toEqual(['Fix it']);
  });

  it('should return CompilationError as-is when enhancing', () => {
    const error = new CompilationError('syntax', 'Test', 'test.mtm');
    const enhanced = handler.enhanceError(error);
    
    expect(enhanced).toBe(error);
  });

  it('should clear all listeners', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    handler.addErrorListener(listener1);
    handler.addErrorListener(listener2);

    handler.clearListeners();

    const error = new CompilationError('syntax', 'Test error', 'test.mtm');
    handler.handleCompilationError(error);

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });
});