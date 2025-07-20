/**
 * Integration tests for vite-plugin-mtm modern syntax support
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { mtmPlugin } from '../vite-plugin-mtm.js';
import { HotReloadOrchestrator } from '../hot-reload-orchestrator.js';
import type { Plugin } from 'vite';

// Mock the enhanced parser and compiler
vi.mock('@metamon/core', async () => {
  const actual = await vi.importActual('@metamon/core');
  return {
    ...actual,
    MTMFileParser: {
      parse: vi.fn()
    },
    MTMCompiler: vi.fn().mockImplementation(() => ({
      compile: vi.fn().mockReturnValue({
        code: 'export default function TestComponent() { return "compiled"; }'
      })
    })),
    EnhancedMTMParser: vi.fn().mockImplementation(() => ({
      parse: vi.fn().mockReturnValue({
        frontmatter: { target: 'reactjs' },
        content: '$counter! = 0',
        filePath: '/test/modern.mtm',
        syntaxVersion: 'modern',
        modernFeatures: {
          dollarPrefixVariables: true,
          reactiveVariables: true,
          enhancedTypeInference: false,
          optionalSemicolons: true,
          autoThisBinding: false
        }
      }),
      detectSyntaxVersion: vi.fn().mockReturnValue('modern'),
      detectModernFeatures: vi.fn().mockReturnValue({
        dollarPrefixVariables: true,
        reactiveVariables: true,
        enhancedTypeInference: false,
        optionalSemicolons: true,
        autoThisBinding: false
      })
    }))
  };
});

// Mock hot reload orchestrator
vi.mock('../hot-reload-orchestrator.js', () => ({
  HotReloadOrchestrator: vi.fn().mockImplementation(() => ({
    handleFileChange: vi.fn(),
    handleReloadError: vi.fn(),
    getConfig: vi.fn().mockReturnValue({ preserveState: true }),
    cleanup: vi.fn(),
    updateConfig: vi.fn()
  }))
}));

// Mock error categorizer
vi.mock('../error-categorizer.js', () => ({
  ErrorCategorizer: vi.fn().mockImplementation(() => ({
    categorizeError: vi.fn().mockReturnValue({
      type: 'syntax_error',
      message: 'Modern syntax error',
      suggestion: 'Check your modern MTM syntax'
    })
  }))
}));

// Mock fs functions
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({
    mtime: { getTime: () => Date.now() }
  })
}));

describe('vite-plugin-mtm Modern Syntax Support', () => {
  let plugin: Plugin;
  let mockServer: any;
  let mockEnhancedParser: any;
  let mockCompiler: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mocks
    const { EnhancedMTMParser, MTMCompiler } = await import('@metamon/core');
    mockEnhancedParser = new EnhancedMTMParser();
    mockCompiler = new MTMCompiler();
    
    plugin = mtmPlugin({
      hmr: true,
      hotReload: {
        preserveState: true,
        debugLogging: true
      }
    });

    mockServer = {
      ws: {
        send: vi.fn()
      },
      moduleGraph: {
        getModulesByFile: vi.fn().mockReturnValue(new Set([
          { url: '/test/modern.mtm', id: '/test/modern.mtm' }
        ]))
      }
    };
  });

  describe('Modern Syntax Detection', () => {
    it('should detect modern syntax in .mtm files', async () => {
      const fs = await import('fs');
      (fs.readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$counter! = 0
$increment = () => $counter++
`);

      // Simulate file compilation
      const result = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(mockEnhancedParser.parse).toHaveBeenCalledWith('/test/modern.mtm');
      expect(mockCompiler.compile).toHaveBeenCalled();
    });

    it('should log modern syntax features when detected', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const { readFileSync } = require('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$counter! = 0
$name: string = "test"
`);

      // Simulate file compilation
      plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔥 Modern syntax detected')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Features:')
      );
      
      consoleSpy.mockRestore();
    });

    it('should cache compilation results with syntax version', async () => {
      const { readFileSync } = require('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$counter! = 0
`);

      // First compilation
      plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      // Second compilation (should use cache)
      plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      // Parser should only be called once due to caching
      expect(mockEnhancedParser.parse).toHaveBeenCalledTimes(1);
    });
  });

  describe('Hot Module Replacement with Modern Syntax', () => {
    it('should handle HMR for modern syntax files', async () => {
      const { readFileSync } = require('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$counter! = 0
$increment = () => $counter++
`);

      const ctx = {
        file: '/test/modern.mtm',
        server: mockServer
      };

      await plugin.handleHotUpdate?.(ctx);

      // Should send enhanced HMR update with modern syntax info
      expect(mockServer.ws.send).toHaveBeenCalledWith({
        type: 'custom',
        event: 'mtm:hot-reload',
        data: expect.objectContaining({
          file: '/test/modern.mtm',
          syntaxVersion: 'modern',
          modernFeatures: expect.arrayContaining(['dollarPrefixVariables', 'reactiveVariables'])
        })
      });
    });

    it('should provide enhanced error messages for modern syntax errors', async () => {
      const { readFileSync } = require('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$invalid syntax here
`);

      // Mock parser to throw error
      mockEnhancedParser.parse.mockImplementationOnce(() => {
        throw new Error('Invalid $ prefix syntax');
      });

      const result = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      // Should return error component with enhanced error message
      expect(result).toContain('MTM Compilation Error');
      expect(result).toContain('Modern syntax error');
    });

    it('should handle legacy syntax files without modern features', async () => {
      // Mock legacy syntax detection
      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('legacy');
      mockEnhancedParser.parse.mockReturnValue({
        frontmatter: { target: 'reactjs' },
        content: 'const counter = 0;',
        filePath: '/test/legacy.mtm',
        syntaxVersion: 'legacy'
      });

      const { readFileSync } = require('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
const counter = 0;
`);

      const ctx = {
        file: '/test/legacy.mtm',
        server: mockServer
      };

      await plugin.handleHotUpdate?.(ctx);

      // Should send HMR update without modern syntax features
      expect(mockServer.ws.send).toHaveBeenCalledWith({
        type: 'custom',
        event: 'mtm:hot-reload',
        data: expect.objectContaining({
          file: '/test/legacy.mtm',
          syntaxVersion: 'legacy',
          modernFeatures: []
        })
      });
    });
  });

  describe('Error Handling for Modern Syntax', () => {
    it('should categorize modern syntax errors correctly', async () => {
      const { ErrorCategorizer } = require('../error-categorizer.js');
      const mockCategorizer = new ErrorCategorizer();
      
      mockCategorizer.categorizeError.mockReturnValue({
        type: 'syntax_error',
        message: '🚨 [Modern MTM Syntax] Invalid $ prefix variable declaration',
        suggestion: 'Check your $ prefix variable declarations. Use $variableName = value or $variableName: type = value syntax.',
        recoverable: true
      });

      const { readFileSync } = require('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$invalid! syntax
`);

      mockEnhancedParser.parse.mockImplementationOnce(() => {
        throw new Error('Invalid $ prefix syntax');
      });

      const result = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(mockCategorizer.categorizeError).toHaveBeenCalledWith(
        expect.any(Error),
        '/test/modern.mtm'
      );
      expect(result).toContain('Modern MTM Syntax');
    });

    it('should provide specific suggestions for reactive variable errors', async () => {
      const { ErrorCategorizer } = require('../error-categorizer.js');
      const mockCategorizer = new ErrorCategorizer();
      
      mockCategorizer.categorizeError.mockReturnValue({
        type: 'syntax_error',
        message: '🚨 [Modern MTM Syntax] Invalid reactive variable syntax',
        suggestion: 'Check your reactive variable syntax. Use $variableName! = value to declare reactive variables.',
        recoverable: true
      });

      mockEnhancedParser.parse.mockImplementationOnce(() => {
        throw new Error('Reactive variable error');
      });

      const result = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(result).toContain('reactive variable syntax');
    });

    it('should handle type annotation errors', async () => {
      const { ErrorCategorizer } = require('../error-categorizer.js');
      const mockCategorizer = new ErrorCategorizer();
      
      mockCategorizer.categorizeError.mockReturnValue({
        type: 'syntax_error',
        message: '⚠️ [Modern MTM Syntax] Invalid type annotation',
        suggestion: 'Check your type annotations. Use $variableName: type = value syntax with valid types (string, number, boolean, float).',
        recoverable: true
      });

      mockEnhancedParser.parse.mockImplementationOnce(() => {
        throw new Error('Type annotation error');
      });

      const result = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(result).toContain('type annotation');
    });
  });

  describe('Client-side Integration', () => {
    it('should inject enhanced client code for modern syntax support', () => {
      const mockCtx = {
        server: mockServer
      };

      const html = '<html><head></head><body></body></html>';
      const result = plugin.transformIndexHtml?.(html, mockCtx);
      
      expect(result).toContain('mtm:hot-reload');
      expect(result).toContain('Modern features detected');
      expect(result).toContain('🔥 Modern MTM component reloaded successfully');
    });

    it('should handle modern syntax in client error overlay', () => {
      const mockCtx = {
        server: mockServer
      };

      const html = '<html><head></head><body></body></html>';
      const result = plugin.transformIndexHtml?.(html, mockCtx);
      
      // Should include client code that handles modern syntax messaging
      expect(result).toContain('data.syntaxVersion === \'modern\'');
      expect(result).toContain('🔥 Reloading modern MTM component');
    });
  });

  describe('Configuration and Setup', () => {
    it('should initialize enhanced parser correctly', () => {
      const { EnhancedMTMParser } = require('@metamon/core');
      
      mtmPlugin({ hmr: true });
      
      expect(EnhancedMTMParser).toHaveBeenCalled();
    });

    it('should configure hot reload orchestrator for modern syntax', () => {
      const plugin = mtmPlugin({
        hmr: true,
        hotReload: {
          preserveState: true,
          debugLogging: true
        }
      });

      expect(HotReloadOrchestrator).toHaveBeenCalledWith(
        expect.objectContaining({
          preserveState: true,
          debugLogging: true
        })
      );
    });

    it('should handle plugin cleanup correctly', () => {
      const mockOrchestrator = new HotReloadOrchestrator({});
      
      plugin.buildEnd?.();
      
      expect(mockOrchestrator.cleanup).toHaveBeenCalled();
    });
  });

  describe('Framework-specific Modern Syntax Support', () => {
    it('should generate React error components with modern syntax info', async () => {
      mockEnhancedParser.parse.mockReturnValue({
        frontmatter: { target: 'reactjs' },
        syntaxVersion: 'modern'
      });

      mockEnhancedParser.parse.mockImplementationOnce(() => {
        throw new Error('Modern syntax error');
      });

      const result = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(result).toContain('React.createElement');
      expect(result).toContain('MTM Compilation Error');
    });

    it('should generate Vue error components with modern syntax info', async () => {
      mockEnhancedParser.parse.mockReturnValue({
        frontmatter: { target: 'vue' },
        syntaxVersion: 'modern'
      });

      mockEnhancedParser.parse.mockImplementationOnce(() => {
        throw new Error('Modern syntax error');
      });

      const result = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(result).toContain('<template>');
      expect(result).toContain('MTM Compilation Error');
    });

    it('should generate Svelte error components with modern syntax info', async () => {
      mockEnhancedParser.parse.mockReturnValue({
        frontmatter: { target: 'svelte' },
        syntaxVersion: 'modern'
      });

      mockEnhancedParser.parse.mockImplementationOnce(() => {
        throw new Error('Modern syntax error');
      });

      const result = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(result).toContain('<div class="mtm-error">');
      expect(result).toContain('<style>');
    });
  });
});