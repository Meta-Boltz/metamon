import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DebugTools, DebugSession } from './debug-tools.js';
import { CompilationError } from './compilation-error.js';
import { MTMFile } from '../types/mtm-file.js';
import { CompilationResult } from '../types/compiler.js';

describe('DebugSession', () => {
  let session: DebugSession;

  beforeEach(() => {
    vi.useFakeTimers();
    session = new DebugSession('test.mtm');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should track successful phase', () => {
    session.startPhase('parsing');
    
    // Simulate some work
    vi.advanceTimersByTime(100);
    
    session.endPhase({ linesProcessed: 50 });

    const summary = session.getSummary();
    expect(summary.steps).toHaveLength(1);
    expect(summary.steps[0].phase).toBe('parsing');
    expect(summary.steps[0].success).toBe(true);
    expect(summary.steps[0].metadata).toEqual({ linesProcessed: 50 });
    expect(summary.success).toBe(true);
  });

  it('should track failed phase', () => {
    const error = new CompilationError('syntax', 'Parse error', 'test.mtm');
    
    session.startPhase('parsing');
    session.endPhaseWithError(error, { errorLine: 10 });

    const summary = session.getSummary();
    expect(summary.steps).toHaveLength(1);
    expect(summary.steps[0].success).toBe(false);
    expect(summary.steps[0].error).toBe(error);
    expect(summary.success).toBe(false);
    expect(summary.errors).toEqual([error]);
  });

  it('should handle multiple phases', () => {
    session.startPhase('parsing');
    session.endPhase();

    session.startPhase('validation');
    session.endPhase();

    session.startPhase('compilation');
    const error = new CompilationError('framework', 'Compile error', 'test.mtm');
    session.endPhaseWithError(error);

    const summary = session.getSummary();
    expect(summary.steps).toHaveLength(3);
    expect(summary.steps[0].success).toBe(true);
    expect(summary.steps[1].success).toBe(true);
    expect(summary.steps[2].success).toBe(false);
    expect(summary.success).toBe(false);
  });

  it('should handle ending phase without starting', () => {
    session.endPhase();
    session.endPhaseWithError(new CompilationError('syntax', 'Error', 'test.mtm'));

    const summary = session.getSummary();
    expect(summary.steps).toHaveLength(0);
  });
});

describe('DebugTools', () => {
  let consoleSpy: any;

  beforeEach(() => {
    DebugTools.disableDebug();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('debug state management', () => {
    it('should enable and disable debug', () => {
      expect(DebugTools.isDebugEnabled()).toBe(false);
      
      DebugTools.enableDebug();
      expect(DebugTools.isDebugEnabled()).toBe(true);
      
      DebugTools.disableDebug();
      expect(DebugTools.isDebugEnabled()).toBe(false);
    });

    it('should check environment variable', () => {
      const originalEnv = process.env.MTM_DEBUG;
      
      process.env.MTM_DEBUG = 'true';
      expect(DebugTools.isDebugEnabled()).toBe(true);
      
      process.env.MTM_DEBUG = 'false';
      expect(DebugTools.isDebugEnabled()).toBe(false);
      
      process.env.MTM_DEBUG = originalEnv;
    });
  });

  describe('session management', () => {
    it('should start and get session', () => {
      const session = DebugTools.startSession('test.mtm');
      expect(session).toBeInstanceOf(DebugSession);
      
      const retrieved = DebugTools.getSession('test.mtm');
      expect(retrieved).toBe(session);
    });

    it('should end session and get summary', () => {
      const session = DebugTools.startSession('test.mtm');
      session.startPhase('parsing');
      session.endPhase();

      const summary = DebugTools.endSession('test.mtm');
      expect(summary).toBeDefined();
      expect(summary!.file).toBe('test.mtm');
      expect(summary!.steps).toHaveLength(1);

      // Session should be removed
      expect(DebugTools.getSession('test.mtm')).toBeUndefined();
    });

    it('should log summary when debug enabled', () => {
      DebugTools.enableDebug();
      
      const session = DebugTools.startSession('test.mtm');
      session.startPhase('parsing');
      session.endPhase();

      DebugTools.endSession('test.mtm');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 DEBUG SUMMARY: test.mtm')
      );
    });
  });

  describe('MTM structure validation', () => {
    it('should validate complete MTM file', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [{ event: 'test', emit: 'testEmit' }]
        },
        content: 'export default function Component() { return <div>Hello</div>; }',
        filePath: 'test.mtm'
      };

      const result = DebugTools.validateMTMStructure(mtmFile);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing target', () => {
      const mtmFile: MTMFile = {
        frontmatter: {} as any,
        content: 'export default function Component() { return <div>Hello</div>; }',
        filePath: 'test.mtm'
      };

      const result = DebugTools.validateMTMStructure(mtmFile);
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Missing target framework in frontmatter');
      expect(result.suggestions).toContain('Add target: "reactjs" | "vue" | "solid" | "svelte" to frontmatter');
    });

    it('should detect empty content', () => {
      const mtmFile: MTMFile = {
        frontmatter: { target: 'reactjs' },
        content: '',
        filePath: 'test.mtm'
      };

      const result = DebugTools.validateMTMStructure(mtmFile);
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Empty component content');
    });

    it('should detect incomplete channel configuration', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [{ event: 'test', emit: '' }]
        },
        content: 'export default function Component() { return <div>Hello</div>; }',
        filePath: 'test.mtm'
      };

      const result = DebugTools.validateMTMStructure(mtmFile);
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Incomplete channel configuration at index 0');
    });

    it('should detect framework mismatches', () => {
      const mtmFile: MTMFile = {
        frontmatter: { target: 'reactjs' },
        content: 'export default { template: "<div>Hello</div>" }',
        filePath: 'test.mtm'
      };

      const result = DebugTools.validateMTMStructure(mtmFile);
      expect(result.warnings).toContain('Target is React but no React imports found');
    });
  });

  describe('compilation result analysis', () => {
    it('should analyze normal compilation result', () => {
      const result: CompilationResult = {
        code: 'export default function Component() { return React.createElement("div", null, "Hello"); }',
        dependencies: ['react'],
        exports: ['default'],
        sourceMap: '{"version":3,"sources":[]}'
      };

      const mtmFile: MTMFile = {
        frontmatter: { target: 'reactjs' },
        content: 'export default function Component() { return <div>Hello</div>; }',
        filePath: 'test.mtm'
      };

      const analysis = DebugTools.analyzeCompilationResult(result, mtmFile);
      
      expect(analysis.warnings).toHaveLength(0);
      expect(analysis.metrics.codeSize).toBe(result.code.length);
      expect(analysis.metrics.dependencyCount).toBe(1);
      expect(analysis.metrics.exportCount).toBe(1);
      expect(analysis.metrics.hasSourceMap).toBe(true);
    });

    it('should detect large code size', () => {
      const result: CompilationResult = {
        code: 'x'.repeat(60000), // 60KB
        dependencies: [],
        exports: ['default']
      };

      const mtmFile: MTMFile = {
        frontmatter: { target: 'reactjs' },
        content: 'test',
        filePath: 'test.mtm'
      };

      const analysis = DebugTools.analyzeCompilationResult(result, mtmFile);
      expect(analysis.warnings).toContain('Generated code is quite large');
    });

    it('should detect high dependency count', () => {
      const result: CompilationResult = {
        code: 'test',
        dependencies: Array(15).fill('dep'),
        exports: ['default']
      };

      const mtmFile: MTMFile = {
        frontmatter: { target: 'reactjs' },
        content: 'test',
        filePath: 'test.mtm'
      };

      const analysis = DebugTools.analyzeCompilationResult(result, mtmFile);
      expect(analysis.warnings).toContain('High number of dependencies detected');
    });

    it('should detect missing exports', () => {
      const result: CompilationResult = {
        code: 'console.log("test");',
        dependencies: [],
        exports: []
      };

      const mtmFile: MTMFile = {
        frontmatter: { target: 'reactjs' },
        content: 'test',
        filePath: 'test.mtm'
      };

      const analysis = DebugTools.analyzeCompilationResult(result, mtmFile);
      expect(analysis.warnings).toContain('No exports detected in compiled code');
    });
  });

  describe('debug report generation', () => {
    it('should generate complete debug report', () => {
      const mtmFile: MTMFile = {
        frontmatter: { target: 'reactjs' },
        content: 'export default function Component() { return <div>Hello</div>; }',
        filePath: 'test.mtm'
      };

      const result: CompilationResult = {
        code: 'compiled code',
        dependencies: ['react'],
        exports: ['default'],
        sourceMap: 'sourcemap'
      };

      const error = new CompilationError('syntax', 'Test error', 'test.mtm', {
        line: 5,
        suggestions: ['Fix syntax']
      });

      const report = DebugTools.generateDebugReport('test.mtm', mtmFile, result, error);

      expect(report).toContain('# Debug Report: test.mtm');
      expect(report).toContain('## File Structure Validation');
      expect(report).toContain('## Compilation Analysis');
      expect(report).toContain('## Error Details');
      expect(report).toContain('Type: syntax');
      expect(report).toContain('Message: Test error');
      expect(report).toContain('Line: 5');
    });

    it('should generate report without compilation result', () => {
      const mtmFile: MTMFile = {
        frontmatter: { target: 'reactjs' },
        content: '',
        filePath: 'test.mtm'
      };

      const report = DebugTools.generateDebugReport('test.mtm', mtmFile);

      expect(report).toContain('# Debug Report: test.mtm');
      expect(report).toContain('Status: ISSUES FOUND');
      expect(report).not.toContain('## Compilation Analysis');
      expect(report).not.toContain('## Error Details');
    });
  });

  describe('format debug summary', () => {
    it('should format successful summary', () => {
      const summary = {
        file: 'test.mtm',
        totalDuration: 150,
        steps: [
          {
            timestamp: Date.now(),
            file: 'test.mtm',
            phase: 'parsing' as const,
            duration: 50,
            success: true,
            metadata: { lines: 10 }
          }
        ],
        success: true,
        errors: []
      };

      const formatted = DebugTools.formatDebugSummary(summary);

      expect(formatted).toContain('🔍 DEBUG SUMMARY: test.mtm');
      expect(formatted).toContain('⏱️  Total Duration: 150ms');
      expect(formatted).toContain('✅ Status: SUCCESS');
      expect(formatted).toContain('📋 Compilation Steps:');
      expect(formatted).toContain('1. ✅ parsing (50ms)');
      expect(formatted).toContain('lines: 10');
    });

    it('should format failed summary with errors', () => {
      const error = new CompilationError('syntax', 'Parse error', 'test.mtm');
      const summary = {
        file: 'test.mtm',
        totalDuration: 100,
        steps: [
          {
            timestamp: Date.now(),
            file: 'test.mtm',
            phase: 'parsing' as const,
            duration: 100,
            success: false,
            error
          }
        ],
        success: false,
        errors: [error]
      };

      const formatted = DebugTools.formatDebugSummary(summary);

      expect(formatted).toContain('❌ Status: FAILED');
      expect(formatted).toContain('🚨 Errors (1):');
      expect(formatted).toContain('1. [syntax] Parse error');
      expect(formatted).toContain('1. ❌ parsing (100ms)');
    });
  });
});