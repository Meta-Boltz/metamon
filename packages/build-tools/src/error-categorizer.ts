/**
 * Error Categorizer for Hot Reload Operations
 * 
 * This class categorizes errors and provides user-friendly error messages
 * with helpful suggestions for common issues.
 */

import type { ReloadError, ReloadErrorType } from './types/error-handling.js';

export interface ErrorPattern {
  pattern: RegExp;
  type: ReloadErrorType;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  suggestion: string;
}

export class ErrorCategorizer {
  private patterns: ErrorPattern[] = [
    // Syntax Errors
    {
      pattern: /Unexpected token|Unexpected end of input|Expected/i,
      type: 'syntax_error',
      category: 'Syntax',
      severity: 'high',
      recoverable: true,
      suggestion: 'Check for missing brackets, semicolons, or quotes in your code.'
    },
    {
      pattern: /Unterminated string|Unterminated comment/i,
      type: 'syntax_error',
      category: 'Syntax',
      severity: 'high',
      recoverable: true,
      suggestion: 'Make sure all strings and comments are properly closed.'
    },

    // Import/Module Errors
    {
      pattern: /Cannot resolve module|Module not found|Failed to resolve import/i,
      type: 'import_error',
      category: 'Dependencies',
      severity: 'high',
      recoverable: true,
      suggestion: 'Check that the imported file exists and the path is correct. Make sure to include file extensions for relative imports.'
    },
    {
      pattern: /Circular dependency detected/i,
      type: 'import_error',
      category: 'Dependencies',
      severity: 'medium',
      recoverable: true,
      suggestion: 'Refactor your code to remove circular dependencies between modules.'
    },

    // MTM-specific Errors
    {
      pattern: /Invalid frontmatter|YAML parse error/i,
      type: 'compilation_error',
      category: 'MTM Configuration',
      severity: 'high',
      recoverable: true,
      suggestion: 'Check your MTM frontmatter syntax. Make sure the YAML is properly formatted with correct indentation.'
    },
    {
      pattern: /Unsupported target framework|Invalid target/i,
      type: 'compilation_error',
      category: 'MTM Configuration',
      severity: 'high',
      recoverable: true,
      suggestion: 'Use a supported target framework: reactjs, vue, svelte, or solid.'
    },
    {
      pattern: /Invalid channel configuration/i,
      type: 'compilation_error',
      category: 'MTM Configuration',
      severity: 'medium',
      recoverable: true,
      suggestion: 'Check your channels configuration in the MTM frontmatter. Ensure channel names are valid strings.'
    },

    // Framework-specific Errors
    {
      pattern: /React.*Hook.*called conditionally|Invalid hook call/i,
      type: 'runtime_error',
      category: 'React',
      severity: 'high',
      recoverable: true,
      suggestion: 'Make sure React hooks are called at the top level of your component, not inside loops or conditions.'
    },
    {
      pattern: /Vue.*template compilation failed/i,
      type: 'compilation_error',
      category: 'Vue',
      severity: 'high',
      recoverable: true,
      suggestion: 'Check your Vue template syntax. Make sure all tags are properly closed and directives are correctly formatted.'
    },
    {
      pattern: /Svelte.*Parse error/i,
      type: 'compilation_error',
      category: 'Svelte',
      severity: 'high',
      recoverable: true,
      suggestion: 'Check your Svelte component syntax. Make sure script, style, and markup sections are properly structured.'
    },

    // State Management Errors
    {
      pattern: /Signal.*not found|Signal.*undefined/i,
      type: 'state_preservation_error',
      category: 'State Management',
      severity: 'medium',
      recoverable: true,
      suggestion: 'Make sure the signal is properly initialized before use. Check signal imports and initialization.'
    },
    {
      pattern: /PubSub.*subscription failed|Event.*not registered/i,
      type: 'framework_sync_error',
      category: 'Cross-Framework Communication',
      severity: 'medium',
      recoverable: true,
      suggestion: 'Verify that event channels are properly configured and components are correctly subscribing to events.'
    },

    // Timeout Errors
    {
      pattern: /Timeout|Request timed out|Operation timed out/i,
      type: 'timeout_error',
      category: 'Performance',
      severity: 'medium',
      recoverable: true,
      suggestion: 'The operation took too long to complete. Try saving the file again or check for performance issues in your code.'
    },

    // Generic Compilation Errors
    {
      pattern: /Compilation failed|Build failed/i,
      type: 'compilation_error',
      category: 'Build',
      severity: 'high',
      recoverable: true,
      suggestion: 'Check the console for detailed compilation errors and fix any syntax or import issues.'
    }
  ];

  /**
   * Categorize an error and enhance it with user-friendly information
   */
  categorizeError(
    error: Error | string, 
    filePath: string, 
    context?: { line?: number; column?: number; code?: string }
  ): ReloadError {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    // Find matching pattern
    const matchedPattern = this.patterns.find(pattern => 
      pattern.pattern.test(errorMessage)
    );

    // Extract line and column information from error message if not provided
    const locationInfo = context || this.extractLocationInfo(errorMessage);

    // Create enhanced error object
    const reloadError: ReloadError = {
      type: matchedPattern?.type || 'compilation_error',
      filePath,
      message: this.enhanceErrorMessage(errorMessage, matchedPattern),
      stack: errorStack,
      recoverable: matchedPattern?.recoverable ?? true,
      line: locationInfo.line,
      column: locationInfo.column,
      code: locationInfo.code,
      suggestion: matchedPattern?.suggestion || this.getGenericSuggestion(errorMessage)
    };

    return reloadError;
  }

  /**
   * Extract line and column information from error message
   */
  private extractLocationInfo(errorMessage: string): { line?: number; column?: number; code?: string } {
    const result: { line?: number; column?: number; code?: string } = {};

    // Try to extract line:column pattern
    const locationMatch = errorMessage.match(/(?:line\s+)?(\d+)(?::(\d+))?/i);
    if (locationMatch) {
      result.line = parseInt(locationMatch[1], 10);
      if (locationMatch[2]) {
        result.column = parseInt(locationMatch[2], 10);
      }
    }

    // Try to extract code context (text between quotes or backticks)
    const codeMatch = errorMessage.match(/['"`]([^'"`]+)['"`]/);
    if (codeMatch) {
      result.code = codeMatch[1];
    }

    return result;
  }

  /**
   * Enhance error message with more context
   */
  private enhanceErrorMessage(originalMessage: string, pattern?: ErrorPattern): string {
    if (!pattern) {
      return originalMessage;
    }

    // Add category context to the message
    const categoryPrefix = `[${pattern.category}] `;
    
    // Clean up common error message patterns
    let enhancedMessage = originalMessage
      .replace(/^Error:\s*/i, '')
      .replace(/\s+at\s+.*$/g, '') // Remove stack trace info from message
      .trim();

    // Add severity indicator
    const severityIndicator = this.getSeverityIndicator(pattern.severity);
    
    return `${severityIndicator} ${categoryPrefix}${enhancedMessage}`;
  }

  /**
   * Get severity indicator emoji
   */
  private getSeverityIndicator(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🔥';
      case 'high':
        return '🚨';
      case 'medium':
        return '⚠️';
      case 'low':
        return 'ℹ️';
      default:
        return '❌';
    }
  }

  /**
   * Get generic suggestion for unmatched errors
   */
  private getGenericSuggestion(errorMessage: string): string {
    // Provide generic suggestions based on common keywords
    if (/import|require|module/i.test(errorMessage)) {
      return 'Check your import statements and file paths. Make sure all imported files exist.';
    }
    
    if (/syntax|parse|unexpected/i.test(errorMessage)) {
      return 'Review your code syntax. Look for missing brackets, semicolons, or quotes.';
    }
    
    if (/type|property|undefined/i.test(errorMessage)) {
      return 'Check for typos in variable names and ensure all properties are properly defined.';
    }
    
    if (/network|fetch|request/i.test(errorMessage)) {
      return 'Check your network connection and API endpoints.';
    }

    return 'Review the error message above and check your recent changes. Try undoing recent modifications if the error persists.';
  }

  /**
   * Add custom error pattern
   */
  addPattern(pattern: ErrorPattern): void {
    this.patterns.unshift(pattern); // Add to beginning for priority
  }

  /**
   * Remove error pattern
   */
  removePattern(patternRegex: RegExp): void {
    this.patterns = this.patterns.filter(p => p.pattern.source !== patternRegex.source);
  }

  /**
   * Get all error patterns
   */
  getPatterns(): ErrorPattern[] {
    return [...this.patterns];
  }

  /**
   * Get error statistics by category
   */
  getErrorStats(errors: ReloadError[]): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const error of errors) {
      const pattern = this.patterns.find(p => p.type === error.type);
      const category = pattern?.category || 'Unknown';
      stats[category] = (stats[category] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Check if error is likely to be recoverable
   */
  isRecoverable(error: ReloadError): boolean {
    const pattern = this.patterns.find(p => p.type === error.type);
    return pattern?.recoverable ?? true;
  }

  /**
   * Get severity level for error
   */
  getSeverity(error: ReloadError): 'low' | 'medium' | 'high' | 'critical' {
    const pattern = this.patterns.find(p => p.type === error.type);
    return pattern?.severity || 'medium';
  }
}