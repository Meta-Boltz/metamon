import { describe, it, expect } from 'vitest';
import { CompilationError } from './compilation-error.js';

describe('CompilationError', () => {
  it('should create basic compilation error', () => {
    const error = new CompilationError('syntax', 'Missing semicolon', 'test.mtm');
    
    expect(error.type).toBe('syntax');
    expect(error.message).toBe('Missing semicolon');
    expect(error.file).toBe('test.mtm');
    expect(error.name).toBe('CompilationError');
  });

  it('should create error with all options', () => {
    const originalError = new Error('Original error');
    const error = new CompilationError('framework', 'React compilation failed', 'component.mtm', {
      line: 10,
      column: 5,
      suggestions: ['Check imports', 'Verify syntax'],
      originalError,
      context: 'During JSX compilation'
    });

    expect(error.line).toBe(10);
    expect(error.column).toBe(5);
    expect(error.suggestions).toEqual(['Check imports', 'Verify syntax']);
    expect(error.originalError).toBe(originalError);
    expect(error.context).toBe('During JSX compilation');
  });

  describe('static factory methods', () => {
    it('should create syntax error with suggestions', () => {
      const error = CompilationError.syntax('Invalid syntax', 'test.mtm', 5, 10, 'const x =');
      
      expect(error.type).toBe('syntax');
      expect(error.line).toBe(5);
      expect(error.column).toBe(10);
      expect(error.context).toBe('const x =');
      expect(error.suggestions).toContain('Check for missing brackets, semicolons, or quotes');
    });

    it('should create frontmatter error', () => {
      const error = CompilationError.frontmatter('Invalid YAML', 'test.mtm', ['Check syntax']);
      
      expect(error.type).toBe('frontmatter');
      expect(error.suggestions).toContain('Check syntax');
    });

    it('should create framework error', () => {
      const originalError = new Error('React error');
      const error = CompilationError.framework('React compilation failed', 'test.mtm', 'reactjs', originalError);
      
      expect(error.type).toBe('framework');
      expect(error.originalError).toBe(originalError);
      expect(error.suggestions).toContain('Check reactjs-specific syntax and imports');
    });

    it('should create runtime error', () => {
      const originalError = new Error('Runtime error');
      const error = CompilationError.runtime('Signal error', 'test.mtm', originalError, 'Signal cleanup');
      
      expect(error.type).toBe('runtime');
      expect(error.originalError).toBe(originalError);
      expect(error.context).toBe('Signal cleanup');
    });
  });

  it('should serialize to JSON correctly', () => {
    const originalError = new Error('Original');
    const error = new CompilationError('syntax', 'Test error', 'test.mtm', {
      line: 5,
      column: 10,
      suggestions: ['Fix syntax'],
      originalError
    });

    const json = error.toJSON();
    
    expect(json.type).toBe('syntax');
    expect(json.message).toBe('Test error');
    expect(json.file).toBe('test.mtm');
    expect(json.line).toBe(5);
    expect(json.column).toBe(10);
    expect(json.suggestions).toEqual(['Fix syntax']);
    expect(json.stack).toBeDefined();
    expect(json.originalStack).toBeDefined();
  });

  it('should maintain proper error inheritance', () => {
    const error = new CompilationError('syntax', 'Test error', 'test.mtm');
    
    expect(error instanceof Error).toBe(true);
    expect(error instanceof CompilationError).toBe(true);
    expect(error.stack).toBeDefined();
  });
});