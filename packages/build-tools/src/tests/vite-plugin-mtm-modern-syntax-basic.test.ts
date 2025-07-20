/**
 * Basic integration tests for vite-plugin-mtm modern syntax support
 */

import { describe, it, expect, vi } from 'vitest';
import { mtmPlugin } from '../vite-plugin-mtm.js';

describe('vite-plugin-mtm Modern Syntax Basic Tests', () => {
  it('should create plugin with modern syntax support', () => {
    const plugin = mtmPlugin({
      hmr: false, // Disable HMR for basic test to avoid DOM dependencies
      hotReload: {
        preserveState: true,
        debugLogging: true
      }
    });

    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('vite-plugin-mtm');
    expect(plugin.load).toBeDefined();
    expect(plugin.handleHotUpdate).toBeDefined();
    expect(plugin.transformIndexHtml).toBeDefined();
  });

  it('should have enhanced error categorizer patterns for modern syntax', async () => {
    const { ErrorCategorizer } = await import('../error-categorizer.js');
    const categorizer = new ErrorCategorizer();
    
    const patterns = categorizer.getPatterns();
    
    // Check for modern syntax error patterns
    const modernSyntaxPatterns = patterns.filter(p => 
      p.category === 'Modern MTM Syntax'
    );
    
    expect(modernSyntaxPatterns.length).toBeGreaterThan(0);
    
    // Check specific patterns exist
    const dollarPrefixPattern = patterns.find(p => 
      p.pattern.test('Invalid $ prefix variable declaration')
    );
    expect(dollarPrefixPattern).toBeDefined();
    
    const reactivePattern = patterns.find(p => 
      p.pattern.test('Reactive variable syntax error')
    );
    expect(reactivePattern).toBeDefined();
  });

  it('should handle modern syntax error categorization', async () => {
    const { ErrorCategorizer } = await import('../error-categorizer.js');
    const categorizer = new ErrorCategorizer();
    
    const error = categorizer.categorizeError(
      'Invalid $ prefix variable declaration',
      '/test/modern.mtm'
    );
    
    expect(error.type).toBe('syntax_error');
    expect(error.suggestion).toContain('$ prefix variable declarations');
  });

  it('should handle reactive variable error categorization', async () => {
    const { ErrorCategorizer } = await import('../error-categorizer.js');
    const categorizer = new ErrorCategorizer();
    
    const error = categorizer.categorizeError(
      'Reactive variable syntax error',
      '/test/modern.mtm'
    );
    
    expect(error.type).toBe('syntax_error');
    expect(error.suggestion).toContain('reactive variable syntax');
  });

  it('should handle type annotation error categorization', async () => {
    const { ErrorCategorizer } = await import('../error-categorizer.js');
    const categorizer = new ErrorCategorizer();
    
    const error = categorizer.categorizeError(
      'Type annotation parsing error',
      '/test/modern.mtm'
    );
    
    expect(error.type).toBe('syntax_error');
    expect(error.suggestion).toContain('type annotations');
  });

  it('should handle semicolon ambiguity error categorization', async () => {
    const { ErrorCategorizer } = await import('../error-categorizer.js');
    const categorizer = new ErrorCategorizer();
    
    const error = categorizer.categorizeError(
      'Semicolon ambiguity detected',
      '/test/modern.mtm'
    );
    
    expect(error.type).toBe('syntax_error');
    expect(error.suggestion).toContain('explicit semicolons');
  });
});