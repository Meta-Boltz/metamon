import { CompilationError as ICompilationError } from '../types/compiler.js';
/**
 * Enhanced compilation error class with detailed error information
 */
export declare class CompilationError extends Error implements ICompilationError {
    readonly type: 'syntax' | 'frontmatter' | 'framework' | 'runtime';
    readonly file: string;
    readonly line?: number;
    readonly column?: number;
    readonly suggestions?: string[];
    readonly originalError?: Error;
    readonly context?: string;
    constructor(type: 'syntax' | 'frontmatter' | 'framework' | 'runtime', message: string, file: string, options?: {
        line?: number;
        column?: number;
        suggestions?: string[];
        originalError?: Error;
        context?: string;
    });
    /**
     * Create a syntax error
     */
    static syntax(message: string, file: string, line?: number, column?: number, context?: string): CompilationError;
    /**
     * Create a frontmatter error
     */
    static frontmatter(message: string, file: string, suggestions?: string[]): CompilationError;
    /**
     * Create a framework-specific error
     */
    static framework(message: string, file: string, framework: string, originalError?: Error): CompilationError;
    /**
     * Create a runtime error
     */
    static runtime(message: string, file: string, originalError?: Error, context?: string): CompilationError;
    /**
     * Convert to plain object for serialization
     */
    toJSON(): ICompilationError & {
        stack?: string;
        originalStack?: string;
    };
}
