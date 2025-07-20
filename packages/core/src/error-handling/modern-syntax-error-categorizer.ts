/**
 * Enhanced error categorizer for modern MTM syntax errors
 */

import type { SourceLocation } from '../types/unified-ast.js';
import { CompilationError } from './compilation-error.js';

/**
 * Modern syntax error types specific to $ prefix and reactive syntax
 */
export enum ModernSyntaxErrorType {
  INVALID_DOLLAR_PREFIX = 'invalid_dollar_prefix',
  REACTIVE_SYNTAX_ERROR = 'reactive_syntax_error',
  TYPE_ANNOTATION_ERROR = 'type_annotation_error',
  AUTO_SEMICOLON_AMBIGUITY = 'auto_semicolon_ambiguity',
  THIS_BINDING_ERROR = 'this_binding_error',
  TEMPLATE_BINDING_ERROR = 'template_binding_error',
  FUNCTION_SYNTAX_ERROR = 'function_syntax_error'
}

/**
 * Categorized error with specific modern syntax information
 */
export interface CategorizedError {
  type: ModernSyntaxErrorType;
  message: string;
  location: SourceLocation;
  context: string;
  suggestions: string[];
  quickFixes: QuickFix[];
  severity: 'error' | 'warning' | 'info';
}

/**
 * Quick fix suggestion for errors
 */
export interface QuickFix {
  description: string;
  replacement: string;
  range: {
    start: SourceLocation;
    end: SourceLocation;
  };
}

/**
 * Parse context for error categorization
 */
export interface ParseContext {
  source: string;
  filePath: string;
  syntaxVersion: 'legacy' | 'modern';
}

/**
 * Modern syntax error categorizer
 */
export class ModernSyntaxErrorCategorizer {
  /**
   * Categorize a generic error into a modern syntax specific error
   */
  categorizeError(error: Error, context: ParseContext): CategorizedError {
    const errorMessage = error.message.toLowerCase();
    const location = this.extractLocationFromError(error, context.source);

    // Check for dollar prefix errors
    if (this.isDollarPrefixError(errorMessage, context.source, location)) {
      return this.categorizeDollarPrefixError(error, context, location);
    }

    // Check for reactive syntax errors
    if (this.isReactiveSyntaxError(errorMessage, context.source, location)) {
      return this.categorizeReactiveSyntaxError(error, context, location);
    }

    // Check for type annotation errors
    if (this.isTypeAnnotationError(errorMessage, context.source, location)) {
      return this.categorizeTypeAnnotationError(error, context, location);
    }

    // Check for ASI ambiguity errors
    if (this.isASIAmbiguityError(errorMessage, context.source, location)) {
      return this.categorizeASIAmbiguityError(error, context, location);
    }

    // Check for this binding errors
    if (this.isThisBindingError(errorMessage, context.source, location)) {
      return this.categorizeThisBindingError(error, context, location);
    }

    // Check for template binding errors
    if (this.isTemplateBindingError(errorMessage, context.source, location)) {
      return this.categorizeTemplateBindingError(error, context, location);
    }

    // Check for function syntax errors
    if (this.isFunctionSyntaxError(errorMessage, context.source, location)) {
      return this.categorizeFunctionSyntaxError(error, context, location);
    }

    // Default categorization for unrecognized errors
    return this.categorizeGenericError(error, context, location);
  }

  /**
   * Extract location information from error message or context
   */
  private extractLocationFromError(error: Error, source: string): SourceLocation {
    // Try to extract line/column from error message
    const locationMatch = error.message.match(/(?:line|at)\s+(\d+)(?:[:,]\s*(?:column\s+)?(\d+))?/i);
    
    if (locationMatch) {
      const line = parseInt(locationMatch[1], 10);
      const column = locationMatch[2] ? parseInt(locationMatch[2], 10) : 1;
      const index = this.getIndexFromLineColumn(source, line, column);
      return { line, column, index };
    }

    // Default to start of file if no location found
    return { line: 1, column: 1, index: 0 };
  }

  /**
   * Convert line/column to character index
   */
  private getIndexFromLineColumn(source: string, line: number, column: number): number {
    const lines = source.split('\n');
    let index = 0;
    
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      index += lines[i].length + 1; // +1 for newline character
    }
    
    return index + column - 1;
  }

  /**
   * Check if error is related to dollar prefix syntax
   */
  private isDollarPrefixError(errorMessage: string, source: string, location: SourceLocation): boolean {
    return (
      errorMessage.includes('unexpected token') && errorMessage.includes('$') ||
      errorMessage.includes('invalid variable name') ||
      errorMessage.includes('missing $ prefix') ||
      errorMessage.includes('unexpected character') && this.hasNearbyDollarPrefix(source, location) ||
      // Check if source has variable declaration without $ prefix
      /^\w+\s*=/.test(source.trim()) && !source.trim().startsWith('$')
    );
  }

  /**
   * Check if there's a dollar prefix near the error location
   */
  private hasNearbyDollarPrefix(source: string, location: SourceLocation): boolean {
    const contextStart = Math.max(0, location.index - 20);
    const contextEnd = Math.min(source.length, location.index + 20);
    const context = source.slice(contextStart, contextEnd);
    return /\$\w+/.test(context);
  }

  /**
   * Categorize dollar prefix related errors
   */
  private categorizeDollarPrefixError(error: Error, context: ParseContext, location: SourceLocation): CategorizedError {
    const contextCode = this.getContextCode(context.source, location);
    
    return {
      type: ModernSyntaxErrorType.INVALID_DOLLAR_PREFIX,
      message: `Invalid dollar prefix syntax: ${error.message}`,
      location,
      context: contextCode,
      suggestions: [
        'Dollar prefix ($) should be used only for variable and function declarations in modern syntax',
        'Ensure the variable name after $ is a valid identifier (letters, numbers, underscore)',
        'Check that the declaration follows the pattern: $variableName = value',
        'For reactive variables, use: $variableName! = value'
      ],
      quickFixes: this.generateDollarPrefixQuickFixes(contextCode, location),
      severity: 'error'
    };
  }

  /**
   * Check if error is related to reactive syntax
   */
  private isReactiveSyntaxError(errorMessage: string, source: string, location: SourceLocation): boolean {
    return (
      errorMessage.includes('unexpected token') && errorMessage.includes('!') ||
      errorMessage.includes('reactive') ||
      this.hasNearbyReactiveSyntax(source, location)
    );
  }

  /**
   * Check if there's reactive syntax near the error location
   */
  private hasNearbyReactiveSyntax(source: string, location: SourceLocation): boolean {
    const contextStart = Math.max(0, location.index - 20);
    const contextEnd = Math.min(source.length, location.index + 20);
    const context = source.slice(contextStart, contextEnd);
    return /\$\w+!\s*=/.test(context);
  }

  /**
   * Categorize reactive syntax related errors
   */
  private categorizeReactiveSyntaxError(error: Error, context: ParseContext, location: SourceLocation): CategorizedError {
    const contextCode = this.getContextCode(context.source, location);
    
    return {
      type: ModernSyntaxErrorType.REACTIVE_SYNTAX_ERROR,
      message: `Reactive variable syntax error: ${error.message}`,
      location,
      context: contextCode,
      suggestions: [
        'Reactive variables should use the pattern: $variableName! = value',
        'The exclamation mark (!) must come immediately after the variable name',
        'Reactive variables automatically trigger UI updates when changed',
        'Ensure the reactive variable is used in templates or other reactive contexts'
      ],
      quickFixes: this.generateReactiveSyntaxQuickFixes(contextCode, location),
      severity: 'error'
    };
  }

  /**
   * Check if error is related to type annotations
   */
  private isTypeAnnotationError(errorMessage: string, source: string, location: SourceLocation): boolean {
    return (
      errorMessage.includes('type') && (errorMessage.includes('annotation') || errorMessage.includes('expected')) ||
      errorMessage.includes('unexpected token') && errorMessage.includes(':') ||
      errorMessage.includes('type annotation error') ||
      this.hasNearbyTypeAnnotation(source, location) ||
      // Check if source has type annotation pattern without colon
      /\$\w+\s+\w+\s*=/.test(source.trim()) && !/\$\w+\s*:\s*\w+\s*=/.test(source.trim())
    );
  }

  /**
   * Check if there's type annotation syntax near the error location
   */
  private hasNearbyTypeAnnotation(source: string, location: SourceLocation): boolean {
    const contextStart = Math.max(0, location.index - 30);
    const contextEnd = Math.min(source.length, location.index + 30);
    const context = source.slice(contextStart, contextEnd);
    return /\$\w+\s*:\s*\w+/.test(context);
  }

  /**
   * Categorize type annotation related errors
   */
  private categorizeTypeAnnotationError(error: Error, context: ParseContext, location: SourceLocation): CategorizedError {
    const contextCode = this.getContextCode(context.source, location);
    
    return {
      type: ModernSyntaxErrorType.TYPE_ANNOTATION_ERROR,
      message: `Type annotation error: ${error.message}`,
      location,
      context: contextCode,
      suggestions: [
        'Type annotations should follow the pattern: $variableName: type = value',
        'Supported types: string, number, boolean, float, object, array',
        'For reactive variables with types: $variableName!: type = value',
        'Type annotations are optional - the system can infer types automatically'
      ],
      quickFixes: this.generateTypeAnnotationQuickFixes(contextCode, location),
      severity: 'error'
    };
  }

  /**
   * Check if error is related to ASI ambiguity
   */
  private isASIAmbiguityError(errorMessage: string, source: string, location: SourceLocation): boolean {
    return (
      errorMessage.includes('semicolon') ||
      errorMessage.includes('statement') && errorMessage.includes('termination') ||
      errorMessage.includes('ambiguous') ||
      errorMessage.includes('unexpected token') && this.isLikelyASIIssue(source, location)
    );
  }

  /**
   * Check if the error is likely related to ASI issues
   */
  private isLikelyASIIssue(source: string, location: SourceLocation): boolean {
    const lines = source.split('\n');
    const currentLineIndex = location.line - 1;
    
    if (currentLineIndex < 0 || currentLineIndex >= lines.length) return false;
    
    const currentLine = lines[currentLineIndex].trim();
    const nextLine = currentLineIndex + 1 < lines.length ? lines[currentLineIndex + 1].trim() : '';
    
    // Check for common ASI ambiguity patterns
    return Boolean(
      (currentLine && !currentLine.endsWith(';') && !currentLine.endsWith('{') && !currentLine.endsWith('}')) &&
      (nextLine && (nextLine.startsWith('(') || nextLine.startsWith('[') || nextLine.startsWith('.') || nextLine.startsWith('`')))
    );
  }

  /**
   * Categorize ASI ambiguity related errors
   */
  private categorizeASIAmbiguityError(error: Error, context: ParseContext, location: SourceLocation): CategorizedError {
    const contextCode = this.getContextCode(context.source, location, 3);
    
    return {
      type: ModernSyntaxErrorType.AUTO_SEMICOLON_AMBIGUITY,
      message: `Automatic semicolon insertion ambiguity: ${error.message}`,
      location,
      context: contextCode,
      suggestions: [
        'Add explicit semicolon (;) at the end of the statement to clarify intent',
        'Move continuation to the same line if it should be part of the same statement',
        'Use parentheses to group expressions that span multiple lines',
        'Consider using explicit statement termination for better readability'
      ],
      quickFixes: this.generateASIQuickFixes(contextCode, location),
      severity: 'warning'
    };
  }

  /**
   * Check if error is related to this binding
   */
  private isThisBindingError(errorMessage: string, source: string, location: SourceLocation): boolean {
    return (
      errorMessage.includes('this') && (errorMessage.includes('undefined') || errorMessage.includes('binding')) ||
      errorMessage.includes('arrow function') && errorMessage.includes('context') ||
      this.hasNearbyThisUsage(source, location)
    );
  }

  /**
   * Check if there's this usage near the error location
   */
  private hasNearbyThisUsage(source: string, location: SourceLocation): boolean {
    const contextStart = Math.max(0, location.index - 50);
    const contextEnd = Math.min(source.length, location.index + 50);
    const context = source.slice(contextStart, contextEnd);
    return /this\.\w+/.test(context) || /\$\w+\s*=\s*\([^)]*\)\s*=>/.test(context);
  }

  /**
   * Categorize this binding related errors
   */
  private categorizeThisBindingError(error: Error, context: ParseContext, location: SourceLocation): CategorizedError {
    const contextCode = this.getContextCode(context.source, location);
    
    return {
      type: ModernSyntaxErrorType.THIS_BINDING_ERROR,
      message: `This binding error: ${error.message}`,
      location,
      context: contextCode,
      suggestions: [
        'Arrow functions in modern syntax automatically bind this context',
        'Use $methodName = () => {...} for automatic this binding in classes',
        'Regular function expressions maintain their own this context',
        'Ensure this is used within a class or component context'
      ],
      quickFixes: this.generateThisBindingQuickFixes(contextCode, location),
      severity: 'error'
    };
  }

  /**
   * Check if error is related to template binding
   */
  private isTemplateBindingError(errorMessage: string, source: string, location: SourceLocation): boolean {
    return (
      errorMessage.includes('template') ||
      errorMessage.includes('binding') ||
      errorMessage.includes('{{') || errorMessage.includes('}}') ||
      this.hasNearbyTemplateBinding(source, location)
    );
  }

  /**
   * Check if there's template binding syntax near the error location
   */
  private hasNearbyTemplateBinding(source: string, location: SourceLocation): boolean {
    const contextStart = Math.max(0, location.index - 30);
    const contextEnd = Math.min(source.length, location.index + 30);
    const context = source.slice(contextStart, contextEnd);
    return /\{\{\$\w+\}\}/.test(context) || /\w+\s*=\s*["\']?\$\w+\([^)]*\)["\']?/.test(context);
  }

  /**
   * Categorize template binding related errors
   */
  private categorizeTemplateBindingError(error: Error, context: ParseContext, location: SourceLocation): CategorizedError {
    const contextCode = this.getContextCode(context.source, location);
    
    return {
      type: ModernSyntaxErrorType.TEMPLATE_BINDING_ERROR,
      message: `Template binding error: ${error.message}`,
      location,
      context: contextCode,
      suggestions: [
        'Template variables should use double braces: {{$variableName}}',
        'Event handlers should use quotes: click="$functionName()"',
        'Ensure template variables are declared with $ prefix',
        'Check that reactive variables are properly bound to templates'
      ],
      quickFixes: this.generateTemplateBindingQuickFixes(contextCode, location),
      severity: 'error'
    };
  }

  /**
   * Check if error is related to function syntax
   */
  private isFunctionSyntaxError(errorMessage: string, source: string, location: SourceLocation): boolean {
    return (
      errorMessage.includes('function') ||
      errorMessage.includes('arrow') ||
      errorMessage.includes('=>') ||
      errorMessage.includes('async') ||
      this.hasNearbyFunctionSyntax(source, location)
    );
  }

  /**
   * Check if there's function syntax near the error location
   */
  private hasNearbyFunctionSyntax(source: string, location: SourceLocation): boolean {
    const contextStart = Math.max(0, location.index - 40);
    const contextEnd = Math.min(source.length, location.index + 40);
    const context = source.slice(contextStart, contextEnd);
    return /\$\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/.test(context);
  }

  /**
   * Categorize function syntax related errors
   */
  private categorizeFunctionSyntaxError(error: Error, context: ParseContext, location: SourceLocation): CategorizedError {
    const contextCode = this.getContextCode(context.source, location);
    
    return {
      type: ModernSyntaxErrorType.FUNCTION_SYNTAX_ERROR,
      message: `Function syntax error: ${error.message}`,
      location,
      context: contextCode,
      suggestions: [
        'Functions should use the pattern: $functionName = (params) => {...}',
        'For async functions: $functionName = async (params) => {...}',
        'Parameter types can be inferred or explicitly annotated',
        'Arrow functions automatically bind this context in classes'
      ],
      quickFixes: this.generateFunctionSyntaxQuickFixes(contextCode, location),
      severity: 'error'
    };
  }

  /**
   * Categorize generic/unrecognized errors
   */
  private categorizeGenericError(error: Error, context: ParseContext, location: SourceLocation): CategorizedError {
    const contextCode = this.getContextCode(context.source, location);
    
    return {
      type: ModernSyntaxErrorType.INVALID_DOLLAR_PREFIX, // Default to most common error type
      message: `Syntax error: ${error.message}`,
      location,
      context: contextCode,
      suggestions: [
        'Check for proper modern syntax usage with $ prefix for variables and functions',
        'Ensure reactive variables use the ! suffix: $variable! = value',
        'Verify type annotations follow the pattern: $variable: type = value',
        'Check that template bindings use proper syntax: {{$variable}}'
      ],
      quickFixes: [],
      severity: 'error'
    };
  }

  /**
   * Get context code around the error location
   */
  private getContextCode(source: string, location: SourceLocation, linesBefore: number = 2, linesAfter: number = 2): string {
    const lines = source.split('\n');
    const startLine = Math.max(0, location.line - 1 - linesBefore);
    const endLine = Math.min(lines.length, location.line + linesAfter);
    
    const contextLines = lines.slice(startLine, endLine);
    const errorLineIndex = location.line - 1 - startLine;
    
    return contextLines.map((line, index) => {
      const lineNumber = startLine + index + 1;
      const marker = index === errorLineIndex ? '→ ' : '  ';
      return `${marker}${lineNumber.toString().padStart(3)}: ${line}`;
    }).join('\n');
  }

  /**
   * Generate quick fixes for dollar prefix errors
   */
  private generateDollarPrefixQuickFixes(contextCode: string, location: SourceLocation): QuickFix[] {
    const fixes: QuickFix[] = [];
    
    // Extract the problematic line
    const lines = contextCode.split('\n');
    const errorLine = lines.find(line => line.startsWith('→'));
    
    if (errorLine) {
      const content = errorLine.substring(errorLine.indexOf(':') + 1).trim();
      
      // Fix missing $ prefix
      if (/^\w+\s*=/.test(content) && !content.startsWith('$')) {
        const variableName = content.match(/^(\w+)/)?.[1];
        if (variableName) {
          fixes.push({
            description: `Add $ prefix to variable '${variableName}'`,
            replacement: '$' + content,
            range: {
              start: location,
              end: { ...location, column: location.column + variableName.length }
            }
          });
        }
      }
      
      // Fix invalid characters after $
      if (/\$[^a-zA-Z_]/.test(content)) {
        fixes.push({
          description: 'Fix invalid character after $ prefix',
          replacement: content.replace(/\$([^a-zA-Z_])/, '$var$1'),
          range: {
            start: location,
            end: { ...location, column: location.column + content.length }
          }
        });
      }
    }
    
    return fixes;
  }

  /**
   * Generate quick fixes for reactive syntax errors
   */
  private generateReactiveSyntaxQuickFixes(contextCode: string, location: SourceLocation): QuickFix[] {
    const fixes: QuickFix[] = [];
    
    const lines = contextCode.split('\n');
    const errorLine = lines.find(line => line.startsWith('→'));
    
    if (errorLine) {
      const content = errorLine.substring(errorLine.indexOf(':') + 1).trim();
      
      // Fix missing ! for reactive variables
      if (/\$\w+\s*=/.test(content) && !/\$\w+!\s*=/.test(content)) {
        const match = content.match(/(\$\w+)(\s*=)/);
        if (match) {
          fixes.push({
            description: 'Add ! suffix to make variable reactive',
            replacement: content.replace(match[0], `${match[1]}!${match[2]}`),
            range: {
              start: location,
              end: { ...location, column: location.column + content.length }
            }
          });
        }
      }
      
      // Fix misplaced ! in reactive variables
      if (/\$\w+\s+!\s*=/.test(content)) {
        fixes.push({
          description: 'Move ! immediately after variable name',
          replacement: content.replace(/(\$\w+)\s+!\s*=/, '$1! ='),
          range: {
            start: location,
            end: { ...location, column: location.column + content.length }
          }
        });
      }
    }
    
    return fixes;
  }

  /**
   * Generate quick fixes for type annotation errors
   */
  private generateTypeAnnotationQuickFixes(contextCode: string, location: SourceLocation): QuickFix[] {
    const fixes: QuickFix[] = [];
    
    const lines = contextCode.split('\n');
    const errorLine = lines.find(line => line.startsWith('→'));
    
    if (errorLine) {
      const content = errorLine.substring(errorLine.indexOf(':') + 1).trim();
      
      // Fix missing colon in type annotation
      if (/\$\w+\s+\w+\s*=/.test(content) && !/\$\w+\s*:\s*\w+\s*=/.test(content)) {
        fixes.push({
          description: 'Add colon for type annotation',
          replacement: content.replace(/(\$\w+)\s+(\w+)(\s*=)/, '$1: $2$3'),
          range: {
            start: location,
            end: { ...location, column: location.column + content.length }
          }
        });
      }
      
      // Suggest removing type annotation if it's causing issues
      if (/\$\w+\s*:\s*\w+\s*=/.test(content)) {
        const withoutType = content.replace(/(\$\w+)\s*:\s*\w+(\s*=)/, '$1$2');
        fixes.push({
          description: 'Remove type annotation (use type inference)',
          replacement: withoutType,
          range: {
            start: location,
            end: { ...location, column: location.column + content.length }
          }
        });
      }
    }
    
    return fixes;
  }

  /**
   * Generate quick fixes for ASI ambiguity errors
   */
  private generateASIQuickFixes(contextCode: string, location: SourceLocation): QuickFix[] {
    const fixes: QuickFix[] = [];
    
    const lines = contextCode.split('\n');
    const errorLineIndex = lines.findIndex(line => line.startsWith('→'));
    
    if (errorLineIndex >= 0) {
      const errorLine = lines[errorLineIndex];
      const content = errorLine.substring(errorLine.indexOf(':') + 1).trim();
      
      // Add semicolon at end of statement
      if (!content.endsWith(';') && !content.endsWith('{') && !content.endsWith('}')) {
        fixes.push({
          description: 'Add semicolon at end of statement',
          replacement: content + ';',
          range: {
            start: location,
            end: { ...location, column: location.column + content.length }
          }
        });
      }
      
      // Combine with next line if it looks like continuation
      if (errorLineIndex + 1 < lines.length) {
        const nextLine = lines[errorLineIndex + 1];
        const nextContent = nextLine.substring(nextLine.indexOf(':') + 1).trim();
        
        if (nextContent.startsWith('(') || nextContent.startsWith('[') || nextContent.startsWith('.')) {
          fixes.push({
            description: 'Combine with next line',
            replacement: content + ' ' + nextContent,
            range: {
              start: location,
              end: { 
                line: location.line + 1, 
                column: nextContent.length + 1, 
                index: location.index + content.length + nextContent.length + 1 
              }
            }
          });
        }
      }
    }
    
    return fixes;
  }

  /**
   * Generate quick fixes for this binding errors
   */
  private generateThisBindingQuickFixes(contextCode: string, location: SourceLocation): QuickFix[] {
    const fixes: QuickFix[] = [];
    
    const lines = contextCode.split('\n');
    const errorLine = lines.find(line => line.startsWith('→'));
    
    if (errorLine) {
      const content = errorLine.substring(errorLine.indexOf(':') + 1).trim();
      
      // Convert regular function to arrow function for auto-binding
      if (/\$\w+\s*=\s*function\s*\([^)]*\)/.test(content)) {
        const arrowVersion = content.replace(
          /(\$\w+\s*=\s*)function\s*(\([^)]*\))\s*\{/,
          '$1$2 => {'
        );
        fixes.push({
          description: 'Convert to arrow function for automatic this binding',
          replacement: arrowVersion,
          range: {
            start: location,
            end: { ...location, column: location.column + content.length }
          }
        });
      }
      
      // Add explicit bind() call
      if (/this\.\w+/.test(content) && !/\$\w+\s*=\s*\([^)]*\)\s*=>/.test(content)) {
        fixes.push({
          description: 'Use arrow function syntax for automatic this binding',
          replacement: content.replace(/(\$\w+\s*=\s*)([^=]+)/, '$1($2) => '),
          range: {
            start: location,
            end: { ...location, column: location.column + content.length }
          }
        });
      }
    }
    
    return fixes;
  }

  /**
   * Generate quick fixes for template binding errors
   */
  private generateTemplateBindingQuickFixes(contextCode: string, location: SourceLocation): QuickFix[] {
    const fixes: QuickFix[] = [];
    
    const lines = contextCode.split('\n');
    const errorLine = lines.find(line => line.startsWith('→'));
    
    if (errorLine) {
      const content = errorLine.substring(errorLine.indexOf(':') + 1).trim();
      
      // Fix missing braces in template binding
      if (/\$\w+/.test(content) && !/\{\{\$\w+\}\}/.test(content)) {
        const fixed = content.replace(/\$(\w+)/g, '{{$$$1}}');
        fixes.push({
          description: 'Add double braces around template variable',
          replacement: fixed,
          range: {
            start: location,
            end: { ...location, column: location.column + content.length }
          }
        });
      }
      
      // Fix missing quotes in event handlers
      if (/\w+\s*=\s*\$\w+\([^)]*\)/.test(content) && !/\w+\s*=\s*["\']/.test(content)) {
        const fixed = content.replace(/(\w+\s*=\s*)(\$\w+\([^)]*\))/, '$1"$2"');
        fixes.push({
          description: 'Add quotes around event handler',
          replacement: fixed,
          range: {
            start: location,
            end: { ...location, column: location.column + content.length }
          }
        });
      }
    }
    
    return fixes;
  }

  /**
   * Generate quick fixes for function syntax errors
   */
  private generateFunctionSyntaxQuickFixes(contextCode: string, location: SourceLocation): QuickFix[] {
    const fixes: QuickFix[] = [];
    
    const lines = contextCode.split('\n');
    const errorLine = lines.find(line => line.startsWith('→'));
    
    if (errorLine) {
      const content = errorLine.substring(errorLine.indexOf(':') + 1).trim();
      
      // Convert function declaration to arrow function
      if (/function\s+\w+\s*\([^)]*\)/.test(content)) {
        const match = content.match(/function\s+(\w+)\s*(\([^)]*\))/);
        if (match) {
          fixes.push({
            description: 'Convert to modern arrow function syntax',
            replacement: content.replace(match[0], '$' + match[1] + ' = ' + match[2] + ' =>'),
            range: {
              start: location,
              end: { ...location, column: location.column + content.length }
            }
          });
        }
      }
      
      // Add missing $ prefix to function
      if (/^\w+\s*=\s*\([^)]*\)\s*=>/.test(content)) {
        const functionName = content.match(/^(\w+)/)?.[1];
        if (functionName) {
          fixes.push({
            description: `Add $ prefix to function '${functionName}'`,
            replacement: '$' + content,
            range: {
              start: location,
              end: { ...location, column: location.column + content.length }
            }
          });
        }
      }
    }
    
    return fixes;
  }

  /**
   * Generate helpful error message with suggestions
   */
  generateSuggestion(error: CategorizedError): string {
    const lines: string[] = [];
    
    lines.push(`🚨 ${error.type.toUpperCase().replace(/_/g, ' ')} ERROR`);
    lines.push(`   ${error.message}`);
    lines.push('');
    
    if (error.context) {
      lines.push('📝 Context:');
      lines.push(error.context);
      lines.push('');
    }
    
    if (error.suggestions.length > 0) {
      lines.push('💡 Suggestions:');
      error.suggestions.forEach(suggestion => {
        lines.push(`   • ${suggestion}`);
      });
      lines.push('');
    }
    
    if (error.quickFixes.length > 0) {
      lines.push('🔧 Quick Fixes:');
      error.quickFixes.forEach((fix, index) => {
        lines.push(`   ${index + 1}. ${fix.description}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Provide quick fix suggestions for errors
   */
  provideQuickFix(error: CategorizedError): QuickFix[] {
    return error.quickFixes;
  }
}