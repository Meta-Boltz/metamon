import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CompilationError } from './compilation-error.js';
import { ErrorHandler, errorHandler } from './error-handler.js';
import { DebugTools, DebugSession } from './debug-tools.js';
import { MTMSourceMapGenerator } from './source-map-generator.js';
import { MTMFile } from '../types/mtm-file.js';

describe('Error Handling Integration', () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorHandler.clearListeners();
    DebugTools.disableDebug();
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should handle complete compilation workflow with debugging', () => {
    // Start debug session
    const session = DebugTools.startSession('component.mtm');
    
    // Simulate parsing phase
    session.startPhase('parsing');
    vi.advanceTimersByTime(50);
    session.endPhase({ linesProcessed: 25 });

    // Simulate validation phase with error
    session.startPhase('validation');
    const validationError = CompilationError.frontmatter(
      'Invalid target framework',
      'component.mtm',
      ['Use one of: reactjs, vue, solid, svelte']
    );
    session.endPhaseWithError(validationError);

    // Handle the error through error handler
    errorHandler.handleCompilationError(validationError);

    // End debug session
    const summary = DebugTools.endSession('component.mtm');

    // Verify debug session captured everything
    expect(summary).toBeDefined();
    expect(summary!.steps).toHaveLength(2);
    expect(summary!.steps[0].success).toBe(true);
    expect(summary!.steps[1].success).toBe(false);
    expect(summary!.errors).toHaveLength(1);
    expect(summary!.errors[0]).toBe(validationError);

    // Verify error was formatted and logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('🚨 FRONTMATTER ERROR in component.mtm')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid target framework')
    );
  });

  it('should integrate error handling with source maps', () => {
    const originalContent = `---
target: reactjs
---
export default function Component() {
  return <div>Hello World</div>;
}`;

    const generatedCode = `export default function Component() {
  return React.createElement("div", null, "Hello World");
}`;

    // Create source map
    const sourceMapGen = MTMSourceMapGenerator.createForMTMCompilation(
      'component.mtm',
      originalContent,
      generatedCode
    );

    const { sourceMap } = sourceMapGen.getGeneratedCodeWithSourceMap();

    // Verify source map was generated
    expect(sourceMap).toBeDefined();
    expect(sourceMap).toContain('"sources"');
    expect(sourceMap).toContain('component.mtm');

    // Simulate runtime error
    const runtimeError = CompilationError.runtime(
      'Component render failed',
      'component.mtm',
      new Error('Cannot read property of undefined'),
      'During component render'
    );

    // Handle error
    errorHandler.handleCompilationError(runtimeError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('component.mtm')
    );
  });

  it('should provide comprehensive debugging for MTM file issues', () => {
    const problematicMTMFile: MTMFile = {
      frontmatter: {
        target: 'reactjs',
        channels: [
          { event: 'click', emit: 'handleClick' },
          { event: 'hover', emit: '' } // Invalid channel
        ]
      },
      content: 'export default { data: "Not React" }', // Wrong framework syntax, no JSX
      filePath: 'problematic.mtm'
    };

    // Validate structure
    const validation = DebugTools.validateMTMStructure(problematicMTMFile);
    
    expect(validation.isValid).toBe(false);
    expect(validation.warnings).toContain('Incomplete channel configuration at index 1');

    // Generate debug report
    const debugReport = DebugTools.generateDebugReport(
      'problematic.mtm',
      problematicMTMFile
    );

    expect(debugReport).toContain('# Debug Report: problematic.mtm');
    expect(debugReport).toContain('Status: ISSUES FOUND');
    expect(debugReport).toContain('Incomplete channel configuration');
  });

  it('should handle error listener chain with debugging', () => {
    const errors: CompilationError[] = [];
    
    // Add error listener
    const unsubscribe = errorHandler.addErrorListener((error) => {
      errors.push(error);
    });

    // Enable debugging
    DebugTools.enableDebug();

    // Start debug session and simulate compilation
    const session = DebugTools.startSession('test.mtm');
    
    session.startPhase('compilation');
    const compilationError = CompilationError.framework(
      'TypeScript compilation failed',
      'test.mtm',
      'reactjs',
      new Error('Type error')
    );
    session.endPhaseWithError(compilationError, { 
      errorCount: 1,
      framework: 'reactjs' 
    });

    // Handle error
    errorHandler.handleCompilationError(compilationError);

    // End session (should log debug info)
    DebugTools.endSession('test.mtm');

    // Verify error was captured by listener
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(compilationError);

    // Verify debug output was logged
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('🔍 DEBUG SUMMARY: test.mtm')
    );

    // Cleanup
    unsubscribe();
  });

  it('should enhance generic errors with context', () => {
    const genericError = new Error('Something went wrong');
    
    const enhanced = errorHandler.createFromError(
      genericError,
      'syntax',
      'component.mtm',
      'During JSX parsing'
    );

    expect(enhanced).toBeInstanceOf(CompilationError);
    expect(enhanced.type).toBe('syntax');
    expect(enhanced.message).toBe('Something went wrong');
    expect(enhanced.file).toBe('component.mtm');
    expect(enhanced.context).toBe('During JSX parsing');
    expect(enhanced.originalError).toBe(genericError);

    // Verify suggestions are provided
    const suggestions = errorHandler.provideSuggestions(enhanced);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toContain('Use a linter or formatter for your target framework');
  });
});