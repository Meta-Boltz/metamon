import { MTMFile } from './mtm-file.js';

/**
 * Result of framework compilation
 */
export interface CompilationResult {
  code: string;
  dependencies: string[];
  exports: string[];
  sourceMap?: string;
}

/**
 * Channel configuration for pub/sub events
 */
export interface Channel {
  event: string;
  emit: string;
}

/**
 * Interface for framework-specific compilers
 */
export interface FrameworkCompiler {
  compile(mtmFile: MTMFile): CompilationResult;
  generateImports(dependencies: string[]): string;
  wrapWithRuntime(component: string, channels: Channel[]): string;
}

/**
 * Compilation error details
 */
export interface CompilationError {
  type: 'syntax' | 'frontmatter' | 'framework' | 'runtime';
  message: string;
  file: string;
  line?: number;
  column?: number;
  suggestions?: string[];
}