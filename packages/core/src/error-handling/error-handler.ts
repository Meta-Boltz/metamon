import { CompilationError } from './compilation-error.js';
import { CompilationError as ICompilationError } from '../types/compiler.js';

/**
 * Centralized error handler with formatted error messages and suggestions
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: Array<(error: CompilationError) => void> = [];

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle compilation error with formatting and suggestions
   */
  handleCompilationError(error: CompilationError): void {
    // Notify listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });

    // Log formatted error
    console.error(this.formatErrorMessage(error));
  }

  /**
   * Format error message with context and suggestions
   */
  formatErrorMessage(error: CompilationError): string {
    const lines: string[] = [];
    
    // Header
    lines.push(`\n🚨 ${error.type.toUpperCase()} ERROR in ${error.file}`);
    
    // Location info
    if (error.line !== undefined) {
      const location = error.column !== undefined 
        ? `${error.line}:${error.column}`
        : `${error.line}`;
      lines.push(`   at line ${location}`);
    }
    
    lines.push('');
    
    // Main error message
    lines.push(`❌ ${error.message}`);
    
    // Context if available
    if (error.context) {
      lines.push('');
      lines.push('📝 Context:');
      lines.push(`   ${error.context}`);
    }
    
    // Original error if available
    if (error.originalError) {
      lines.push('');
      lines.push('🔍 Original Error:');
      lines.push(`   ${error.originalError.message}`);
    }
    
    // Suggestions
    if (error.suggestions && error.suggestions.length > 0) {
      lines.push('');
      lines.push('💡 Suggestions:');
      error.suggestions.forEach(suggestion => {
        lines.push(`   • ${suggestion}`);
      });
    }
    
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * Provide context-aware suggestions for errors
   */
  provideSuggestions(error: CompilationError): string[] {
    const suggestions: string[] = [...(error.suggestions || [])];
    
    // Add type-specific suggestions
    switch (error.type) {
      case 'syntax':
        suggestions.push(
          'Use a linter or formatter for your target framework',
          'Check the framework documentation for syntax requirements'
        );
        break;
        
      case 'frontmatter':
        suggestions.push(
          'Validate YAML syntax using an online YAML validator',
          'Check the Metamon documentation for frontmatter schema'
        );
        break;
        
      case 'framework':
        suggestions.push(
          'Ensure all framework dependencies are installed',
          'Check framework version compatibility'
        );
        break;
        
      case 'runtime':
        suggestions.push(
          'Check browser console for additional runtime errors',
          'Verify component lifecycle and cleanup logic'
        );
        break;
    }
    
    // Add file-specific suggestions
    if (error.file.includes('.mtm')) {
      suggestions.push(
        'Verify .mtm file structure and frontmatter format',
        'Check that target framework matches component code'
      );
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Add error listener for custom error handling
   */
  addErrorListener(listener: (error: CompilationError) => void): () => void {
    this.errorListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  /**
   * Create error from generic Error object
   */
  createFromError(
    error: Error,
    type: 'syntax' | 'frontmatter' | 'framework' | 'runtime',
    file: string,
    context?: string
  ): CompilationError {
    return new CompilationError(type, error.message, file, {
      originalError: error,
      context
    });
  }

  /**
   * Validate and enhance error information
   */
  enhanceError(error: ICompilationError): CompilationError {
    if (error instanceof CompilationError) {
      return error;
    }
    
    return new CompilationError(
      error.type,
      error.message,
      error.file,
      {
        line: error.line,
        column: error.column,
        suggestions: error.suggestions
      }
    );
  }

  /**
   * Clear all error listeners
   */
  clearListeners(): void {
    this.errorListeners = [];
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();