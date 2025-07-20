/**
 * Integration tests for vite-plugin-mtm dual parser system
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { mtmPlugin } from '../vite-plugin-mtm.js';

// Mock the core parsers
vi.mock('@metamon/core', async () => {
  const actual = await vi.importActual('@metamon/core');
  return {
    ...actual,
    MTMFileParser: {
      parse: vi.fn().mockReturnValue({
        frontmatter: { target: 'reactjs' },
        content: 'const counter = 0;',
        filePath: '/test/legacy.mtm',
        syntaxVersion: 'legacy'
      })
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
      detectSyntaxVersion: vi.fn(),
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

// Mock fs functions
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({
    mtime: { getTime: () => Date.now() }
  })
}));

describe('vite-plugin-mtm Dual Parser Integration', () => {
  let plugin: any;
  let mockEnhancedParser: any;
  let mockLegacyParser: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { EnhancedMTMParser, MTMFileParser } = await import('@metamon/core');
    mockEnhancedParser = new EnhancedMTMParser();
    mockLegacyParser = MTMFileParser;
    
    plugin = mtmPlugin({
      hmr: false // Disable HMR for basic test
    });
  });

  describe('Syntax Version Detection', () => {
    it('should detect modern syntax and use enhanced parser', async () => {
      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$counter! = 0
$increment = () => $counter++
`);

      // Mock enhanced parser to detect modern syntax
      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('modern');

      const result = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(mockEnhancedParser.detectSyntaxVersion).toHaveBeenCalled();
      expect(mockEnhancedParser.parse).toHaveBeenCalledWith('/test/modern.mtm');
      expect(result).toContain('compiled');
    });

    it('should detect legacy syntax and use legacy parser', async () => {
      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
const counter = 0;
function increment() { counter++; }
`);

      // Mock enhanced parser to detect legacy syntax
      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('legacy');

      const result = plugin.load?.('/test/legacy.mtm?mtm-compiled');
      
      expect(mockEnhancedParser.detectSyntaxVersion).toHaveBeenCalled();
      expect(mockLegacyParser.parse).toHaveBeenCalled();
      expect(result).toContain('compiled');
    });

    it('should handle mixed projects with both syntax versions', async () => {
      const { readFileSync } = await import('fs');
      
      // First file - modern syntax
      (readFileSync as Mock).mockReturnValueOnce(`---
target: reactjs
---
$counter! = 0
`);
      mockEnhancedParser.detectSyntaxVersion.mockReturnValueOnce('modern');
      
      const modernResult = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      // Second file - legacy syntax
      (readFileSync as Mock).mockReturnValueOnce(`---
target: reactjs
---
const counter = 0;
`);
      mockEnhancedParser.detectSyntaxVersion.mockReturnValueOnce('legacy');
      
      const legacyResult = plugin.load?.('/test/legacy.mtm?mtm-compiled');
      
      expect(modernResult).toContain('compiled');
      expect(legacyResult).toContain('compiled');
      expect(mockEnhancedParser.parse).toHaveBeenCalledWith('/test/modern.mtm');
      expect(mockLegacyParser.parse).toHaveBeenCalled();
    });
  });

  describe('Migration Warning System', () => {
    it('should generate migration warnings for legacy syntax', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
const counter = 0;
function increment() { counter++; }
document.getElementById('btn').addEventListener('click', increment);
`);

      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('legacy');

      plugin.load?.('/test/legacy.mtm?mtm-compiled');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📋 Legacy syntax detected')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migration opportunities:')
      );
      
      consoleSpy.mockRestore();
    });

    it('should not generate migration warnings for modern syntax', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$counter! = 0
$increment = () => $counter++
`);

      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('modern');

      plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔥 Modern syntax detected')
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Migration opportunities')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle legacy files with no migration opportunities', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
// Just a comment
`);

      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('legacy');

      plugin.load?.('/test/simple-legacy.mtm?mtm-compiled');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📋 Legacy syntax detected')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(no migration needed)')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Caching with Syntax Version', () => {
    it('should cache compilation results with syntax version info', async () => {
      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$counter! = 0
`);

      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('modern');

      // First compilation
      const result1 = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      // Second compilation (should use cache)
      const result2 = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      expect(result1).toBe(result2);
      // Parser should only be called once due to caching
      expect(mockEnhancedParser.parse).toHaveBeenCalledTimes(1);
    });

    it('should cache legacy and modern files separately', async () => {
      const { readFileSync } = await import('fs');
      
      // Modern file
      (readFileSync as Mock).mockReturnValueOnce(`---
target: reactjs
---
$counter! = 0
`);
      mockEnhancedParser.detectSyntaxVersion.mockReturnValueOnce('modern');
      
      const modernResult = plugin.load?.('/test/modern.mtm?mtm-compiled');
      
      // Legacy file
      (readFileSync as Mock).mockReturnValueOnce(`---
target: reactjs
---
const counter = 0;
`);
      mockEnhancedParser.detectSyntaxVersion.mockReturnValueOnce('legacy');
      
      const legacyResult = plugin.load?.('/test/legacy.mtm?mtm-compiled');
      
      expect(modernResult).toBeDefined();
      expect(legacyResult).toBeDefined();
      expect(modernResult).toBe(legacyResult); // Both return compiled code
    });
  });

  describe('Error Handling for Both Syntax Versions', () => {
    it('should handle modern syntax errors gracefully', async () => {
      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$invalid! syntax
`);

      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('modern');
      mockEnhancedParser.parse.mockImplementationOnce(() => {
        throw new Error('Invalid modern syntax');
      });

      const result = plugin.load?.('/test/modern-error.mtm?mtm-compiled');
      
      expect(result).toContain('MTM Compilation Error');
      expect(result).toContain('Invalid modern syntax');
    });

    it('should handle legacy syntax errors gracefully', async () => {
      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
invalid legacy syntax
`);

      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('legacy');
      mockLegacyParser.parse.mockImplementationOnce(() => {
        throw new Error('Invalid legacy syntax');
      });

      const result = plugin.load?.('/test/legacy-error.mtm?mtm-compiled');
      
      expect(result).toContain('MTM Compilation Error');
      expect(result).toContain('Invalid legacy syntax');
    });
  });

  describe('Hot Module Replacement with Dual Parser', () => {
    it('should handle HMR for modern syntax files', async () => {
      const mockServer = {
        ws: { send: vi.fn() },
        moduleGraph: {
          getModulesByFile: vi.fn().mockReturnValue(new Set([
            { url: '/test/modern.mtm', id: '/test/modern.mtm' }
          ]))
        }
      };

      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
$counter! = 0
`);

      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('modern');

      const ctx = {
        file: '/test/modern.mtm',
        server: mockServer
      };

      await plugin.handleHotUpdate?.(ctx);

      expect(mockServer.ws.send).toHaveBeenCalledWith({
        type: 'custom',
        event: 'mtm:hot-reload',
        data: expect.objectContaining({
          syntaxVersion: 'modern',
          backwardCompatible: true
        })
      });
    });

    it('should handle HMR for legacy syntax files with migration info', async () => {
      const mockServer = {
        ws: { send: vi.fn() },
        moduleGraph: {
          getModulesByFile: vi.fn().mockReturnValue(new Set([
            { url: '/test/legacy.mtm', id: '/test/legacy.mtm' }
          ]))
        }
      };

      const { readFileSync } = await import('fs');
      (readFileSync as Mock).mockReturnValue(`---
target: reactjs
---
const counter = 0;
function increment() { counter++; }
`);

      mockEnhancedParser.detectSyntaxVersion.mockReturnValue('legacy');

      const ctx = {
        file: '/test/legacy.mtm',
        server: mockServer
      };

      await plugin.handleHotUpdate?.(ctx);

      expect(mockServer.ws.send).toHaveBeenCalledWith({
        type: 'custom',
        event: 'mtm:hot-reload',
        data: expect.objectContaining({
          syntaxVersion: 'legacy',
          migrationWarnings: expect.any(Array),
          backwardCompatible: true
        })
      });
    });
  });
});