/**
 * Enhanced compilation error class with detailed error information
 */
export class CompilationError extends Error {
    constructor(type, message, file, options = {}) {
        super(message);
        this.name = 'CompilationError';
        this.type = type;
        this.file = file;
        this.line = options.line;
        this.column = options.column;
        this.suggestions = options.suggestions;
        this.originalError = options.originalError;
        this.context = options.context;
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CompilationError);
        }
    }
    /**
     * Create a syntax error
     */
    static syntax(message, file, line, column, context) {
        return new CompilationError('syntax', message, file, {
            line,
            column,
            context,
            suggestions: [
                'Check for missing brackets, semicolons, or quotes',
                'Verify proper indentation and syntax for the target framework',
                'Ensure all imports and exports are properly formatted'
            ]
        });
    }
    /**
     * Create a frontmatter error
     */
    static frontmatter(message, file, suggestions) {
        return new CompilationError('frontmatter', message, file, {
            suggestions: suggestions || [
                'Check YAML syntax in frontmatter section',
                'Ensure target framework is one of: reactjs, vue, solid, svelte',
                'Verify channel configuration format'
            ]
        });
    }
    /**
     * Create a framework-specific error
     */
    static framework(message, file, framework, originalError) {
        return new CompilationError('framework', message, file, {
            originalError,
            suggestions: [
                `Check ${framework}-specific syntax and imports`,
                `Ensure component follows ${framework} conventions`,
                'Verify all dependencies are properly installed'
            ]
        });
    }
    /**
     * Create a runtime error
     */
    static runtime(message, file, originalError, context) {
        return new CompilationError('runtime', message, file, {
            originalError,
            context,
            suggestions: [
                'Check pub/sub event configuration',
                'Verify signal dependencies and lifecycle',
                'Ensure proper component cleanup'
            ]
        });
    }
    /**
     * Convert to plain object for serialization
     */
    toJSON() {
        return {
            type: this.type,
            message: this.message,
            file: this.file,
            line: this.line,
            column: this.column,
            suggestions: this.suggestions,
            stack: this.stack,
            originalStack: this.originalError?.stack
        };
    }
}
