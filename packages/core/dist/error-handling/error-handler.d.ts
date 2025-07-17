import { CompilationError } from './compilation-error.js';
import { CompilationError as ICompilationError } from '../types/compiler.js';
/**
 * Centralized error handler with formatted error messages and suggestions
 */
export declare class ErrorHandler {
    private static instance;
    private errorListeners;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): ErrorHandler;
    /**
     * Handle compilation error with formatting and suggestions
     */
    handleCompilationError(error: CompilationError): void;
    /**
     * Format error message with context and suggestions
     */
    formatErrorMessage(error: CompilationError): string;
    /**
     * Provide context-aware suggestions for errors
     */
    provideSuggestions(error: CompilationError): string[];
    /**
     * Add error listener for custom error handling
     */
    addErrorListener(listener: (error: CompilationError) => void): () => void;
    /**
     * Create error from generic Error object
     */
    createFromError(error: Error, type: 'syntax' | 'frontmatter' | 'framework' | 'runtime', file: string, context?: string): CompilationError;
    /**
     * Validate and enhance error information
     */
    enhanceError(error: ICompilationError): CompilationError;
    /**
     * Clear all error listeners
     */
    clearListeners(): void;
}
export declare const errorHandler: ErrorHandler;
