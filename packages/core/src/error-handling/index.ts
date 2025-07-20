// Error classes
export { CompilationError } from './compilation-error.js';

// Error handling
export { ErrorHandler, errorHandler } from './error-handler.js';

// Modern syntax error categorization
export { 
  ModernSyntaxErrorCategorizer,
  ModernSyntaxErrorType,
  type CategorizedError,
  type QuickFix,
  type ParseContext
} from './modern-syntax-error-categorizer.js';

// Type error handling
export {
  TypeErrorHandler,
  TypeErrorType,
  type TypeErrorInfo,
  type TypeQuickFix,
  type TypeHint,
  type TypeErrorRecovery,
  type ConflictResolution
} from './type-error-handler.js';

// Source map generation
export { MTMSourceMapGenerator } from './source-map-generator.js';

// Debug tools
export { 
  DebugTools, 
  DebugSession,
  type DebugInfo 
} from './debug-tools.js';