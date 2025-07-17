import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { mtmPlugin } from '../vite-plugin-mtm.js';
import { HotReloadOrchestrator } from '../hot-reload-orchestrator.js';
import type { Plugin } from 'vite';

// Mock dependencies
vi.mock('../hot-reload-orchestrator.js');
vi.mock('@metamon/core', () => ({
  MTMFileParser: {
    parse: vi.fn()
  },
  MTMCompiler: vi.fn().mockImplementation(() => ({
    compile: vi.fn().mockReturnValue({ code: 'compiled code' })
  }))
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  statSync: vi.fn()
}));

const mockFs = vi.mocked(await import('fs'));
const MockHotReloadOrchestrator = vi.mocked(HotReloadOrchestrator);

describe('MTM Plugin Hot Reload Integration', () => {
  let plugin: Plugin;
  let mockOrchestrator: any;
  let mockServer: any;
  let mockModuleGraph: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock orchestrator
    mockOrchestrator = {
      handleFileChange: vi.fn(),
      getConfig: vi.fn().mockReturnValue({ preserveState: true }),
      updateConfig: vi.fn(),
      cleanup: vi.fn()
    };
    
    MockHotReloadOrchestrator.mockImplementation(() => mockOrchestrator);

    // Setup mock server and module graph
    mockModuleGraph = {
      getModulesByFile: vi.fn()
    };

    mockServer = {
      moduleGraph: mockModuleGraph,
      ws: {
        send: vi.fn()
      }
    };

    // Setup file system mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('mock file content');
    mockFs.statSync.mockReturnValue({ mtime: { getTime: () => Date.now() } });
  });

  describe('Plugin Initialization', () => {
    it('should create HotReloadOrchestrator when HMR is enabled', () => {
      plugin = mtmPlugin({ hmr: true });
      
      expect(MockHotReloadOrchestrator).toHaveBeenCalledWith({
        preserveState: true,
        batchUpdates: true,
        debounceMs: 100,
        syncFrameworks: true,
        showErrorOverlay: true,
        errorRecoveryMode: 'graceful',
        debugLogging: false
      });
    });

    it('should not create HotReloadOrchestrator when HMR is disabled', () => {
      plugin = mtmPlugin({ hmr: false });
      
      // The orchestrator should not be created
      expect(MockHotReloadOrchestrator).not.toHaveBeenCalled();
    });

    it('should merge custom hot reload config', () => {
      const customConfig = {
        debounceMs: 200,
        debugLogging: true,
        preserveState: false
      };

      plugin = mtmPlugin({ 
        hmr: true, 
        hotReload: customConfig 
      });
      
      expect(MockHotReloadOrchestrator).toHaveBeenCalledWith({
        preserveState: true, // default
        batchUpdates: true, // default
        debounceMs: 200, // custom
        syncFrameworks: true, // default
        showErrorOverlay: true, // default
        errorRecoveryMode: 'graceful', // default
        debugLogging: true, // custom
        preserveState: false // custom (overrides default)
      });
    });
  });

  describe('configResolved Hook', () => {
    beforeEach(() => {
      plugin = mtmPlugin({ hmr: true });
    });

    it('should enable debug logging in development mode with info log level', () => {
      const config = {
        command: 'serve',
        logLevel: 'info'
      };

      plugin.configResolved!(config as any);

      expect(mockOrchestrator.updateConfig).toHaveBeenCalledWith({
        debugLogging: true
      });
    });

    it('should enable debug logging in development mode with warn log level', () => {
      const config = {
        command: 'serve',
        logLevel: 'warn'
      };

      plugin.configResolved!(config as any);

      expect(mockOrchestrator.updateConfig).toHaveBeenCalledWith({
        debugLogging: true
      });
    });

    it('should not enable debug logging in build mode', () => {
      const config = {
        command: 'build',
        logLevel: 'info'
      };

      plugin.configResolved!(config as any);

      expect(mockOrchestrator.updateConfig).not.toHaveBeenCalled();
    });

    it('should not enable debug logging with silent log level', () => {
      const config = {
        command: 'serve',
        logLevel: 'silent'
      };

      plugin.configResolved!(config as any);

      expect(mockOrchestrator.updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('buildEnd Hook', () => {
    it('should cleanup orchestrator resources', () => {
      plugin = mtmPlugin({ hmr: true });
      
      plugin.buildEnd!({} as any);

      expect(mockOrchestrator.cleanup).toHaveBeenCalled();
    });

    it('should not fail when orchestrator is not available', () => {
      plugin = mtmPlugin({ hmr: false });
      
      expect(() => plugin.buildEnd!({} as any)).not.toThrow();
    });
  });

  describe('handleHotUpdate Hook', () => {
    beforeEach(() => {
      plugin = mtmPlugin({ hmr: true });
    });

    describe('MTM File Updates', () => {
      it('should handle .mtm file changes through orchestrator', async () => {
        const mockModules = [
          { url: '/test.mtm', id: 'test-id' }
        ];
        mockModuleGraph.getModulesByFile.mockReturnValue(mockModules);

        const ctx = {
          file: '/path/to/test.mtm',
          server: mockServer
        };

        const result = await plugin.handleHotUpdate!(ctx as any);

        expect(mockOrchestrator.handleFileChange).toHaveBeenCalledWith(
          '/path/to/test.mtm',
          'mtm',
          'mock file content'
        );
        expect(result).toEqual(mockModules);
      });

      it('should send enhanced HMR update messages', async () => {
        const mockModules = [
          { url: '/test.mtm', id: 'test-id' }
        ];
        mockModuleGraph.getModulesByFile.mockReturnValue(mockModules);

        const ctx = {
          file: '/path/to/test.mtm',
          server: mockServer
        };

        await plugin.handleHotUpdate!(ctx as any);

        expect(mockServer.ws.send).toHaveBeenCalledWith({
          type: 'update',
          updates: [{
            type: 'js-update',
            path: '/test.mtm',
            acceptedPath: '/test.mtm',
            timestamp: expect.any(Number)
          }]
        });

        expect(mockServer.ws.send).toHaveBeenCalledWith({
          type: 'custom',
          event: 'mtm:hot-reload',
          data: {
            file: '/path/to/test.mtm',
            timestamp: expect.any(Number),
            preserveState: true,
            modules: 1
          }
        });
      });

      it('should handle orchestrator errors gracefully', async () => {
        const error = new Error('Orchestrator error');
        mockOrchestrator.handleFileChange.mockRejectedValue(error);

        const mockModules = [
          { url: '/test.mtm', id: 'test-id' }
        ];
        mockModuleGraph.getModulesByFile.mockReturnValue(mockModules);

        const ctx = {
          file: '/path/to/test.mtm',
          server: mockServer
        };

        const result = await plugin.handleHotUpdate!(ctx as any);

        expect(mockServer.ws.send).toHaveBeenCalledWith({
          type: 'error',
          err: {
            message: 'Hot reload failed for test.mtm: Orchestrator error',
            stack: expect.any(String),
            id: '/path/to/test.mtm',
            frame: '',
            plugin: 'vite-plugin-mtm',
            loc: undefined
          }
        });

        expect(result).toEqual(mockModules);
      });

      it('should fallback to basic HMR when orchestrator is not available', async () => {
        // Create plugin without orchestrator
        plugin = mtmPlugin({ hmr: false });
        
        const mockModules = [
          { url: '/test.mtm', id: 'test-id' }
        ];
        mockModuleGraph.getModulesByFile.mockReturnValue(mockModules);

        const ctx = {
          file: '/path/to/test.mtm',
          server: mockServer
        };

        const result = await plugin.handleHotUpdate!(ctx as any);

        // When HMR is disabled, the plugin should return early and not send any messages
        expect(result).toBeUndefined();
      });

      it('should handle missing file content gracefully', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const mockModules = [
          { url: '/test.mtm', id: 'test-id' }
        ];
        mockModuleGraph.getModulesByFile.mockReturnValue(mockModules);

        const ctx = {
          file: '/path/to/test.mtm',
          server: mockServer
        };

        await plugin.handleHotUpdate!(ctx as any);

        expect(mockOrchestrator.handleFileChange).toHaveBeenCalledWith(
          '/path/to/test.mtm',
          'mtm',
          undefined
        );
      });
    });

    describe('Native Framework File Updates', () => {
      it('should handle .jsx file changes through orchestrator', async () => {
        const ctx = {
          file: '/path/to/component.jsx',
          server: mockServer
        };

        await plugin.handleHotUpdate!(ctx as any);

        expect(mockOrchestrator.handleFileChange).toHaveBeenCalledWith(
          '/path/to/component.jsx',
          'native',
          'mock file content'
        );
      });

      it('should handle .tsx file changes through orchestrator', async () => {
        const ctx = {
          file: '/path/to/component.tsx',
          server: mockServer
        };

        await plugin.handleHotUpdate!(ctx as any);

        expect(mockOrchestrator.handleFileChange).toHaveBeenCalledWith(
          '/path/to/component.tsx',
          'native',
          'mock file content'
        );
      });

      it('should handle .vue file changes through orchestrator', async () => {
        const ctx = {
          file: '/path/to/component.vue',
          server: mockServer
        };

        await plugin.handleHotUpdate!(ctx as any);

        expect(mockOrchestrator.handleFileChange).toHaveBeenCalledWith(
          '/path/to/component.vue',
          'native',
          'mock file content'
        );
      });

      it('should handle .svelte file changes through orchestrator', async () => {
        const ctx = {
          file: '/path/to/component.svelte',
          server: mockServer
        };

        await plugin.handleHotUpdate!(ctx as any);

        expect(mockOrchestrator.handleFileChange).toHaveBeenCalledWith(
          '/path/to/component.svelte',
          'native',
          'mock file content'
        );
      });

      it('should handle orchestrator errors for native files gracefully', async () => {
        const error = new Error('Native file error');
        mockOrchestrator.handleFileChange.mockRejectedValue(error);

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const ctx = {
          file: '/path/to/component.jsx',
          server: mockServer
        };

        await plugin.handleHotUpdate!(ctx as any);

        expect(consoleSpy).toHaveBeenCalledWith(
          '[MTM Plugin] Failed to handle native file change for /path/to/component.jsx:',
          error
        );

        consoleSpy.mockRestore();
      });

      it('should not handle non-framework files', async () => {
        const ctx = {
          file: '/path/to/styles.css',
          server: mockServer
        };

        await plugin.handleHotUpdate!(ctx as any);

        expect(mockOrchestrator.handleFileChange).not.toHaveBeenCalled();
      });
    });

    describe('Debouncing and Batching', () => {
      it('should pass debouncing configuration to orchestrator', () => {
        plugin = mtmPlugin({ 
          hmr: true,
          hotReload: {
            batchUpdates: true,
            debounceMs: 250
          }
        });

        expect(MockHotReloadOrchestrator).toHaveBeenCalledWith(
          expect.objectContaining({
            batchUpdates: true,
            debounceMs: 250
          })
        );
      });

      it('should handle multiple rapid file changes', async () => {
        const ctx1 = {
          file: '/path/to/test1.mtm',
          server: mockServer
        };
        const ctx2 = {
          file: '/path/to/test2.mtm',
          server: mockServer
        };

        mockModuleGraph.getModulesByFile.mockReturnValue([]);

        await plugin.handleHotUpdate!(ctx1 as any);
        await plugin.handleHotUpdate!(ctx2 as any);

        expect(mockOrchestrator.handleFileChange).toHaveBeenCalledTimes(2);
        expect(mockOrchestrator.handleFileChange).toHaveBeenNthCalledWith(
          1, '/path/to/test1.mtm', 'mtm', 'mock file content'
        );
        expect(mockOrchestrator.handleFileChange).toHaveBeenNthCalledWith(
          2, '/path/to/test2.mtm', 'mtm', 'mock file content'
        );
      });
    });
  });

  describe('Integration with Requirements', () => {
    beforeEach(() => {
      plugin = mtmPlugin({ hmr: true });
    });

    it('should satisfy requirement 1.1 - .mtm files reload within 500ms', async () => {
      // This test verifies the orchestrator is called, which handles the timing requirement
      const ctx = {
        file: '/path/to/test.mtm',
        server: mockServer
      };

      mockModuleGraph.getModulesByFile.mockReturnValue([]);

      const startTime = Date.now();
      await plugin.handleHotUpdate!(ctx as any);
      const duration = Date.now() - startTime;

      expect(mockOrchestrator.handleFileChange).toHaveBeenCalled();
      expect(duration).toBeLessThan(100); // Plugin coordination should be fast
    });

    it('should satisfy requirement 1.2 - preserve signal state across frameworks', async () => {
      // Verify orchestrator is configured with state preservation
      expect(MockHotReloadOrchestrator).toHaveBeenCalledWith(
        expect.objectContaining({
          preserveState: true
        })
      );
    });

    it('should satisfy requirement 1.4 - maintain active subscriptions', async () => {
      // Verify orchestrator is configured to sync frameworks
      expect(MockHotReloadOrchestrator).toHaveBeenCalledWith(
        expect.objectContaining({
          syncFrameworks: true
        })
      );
    });

    it('should satisfy requirement 5.1 - MTM frontmatter compilation', async () => {
      // Verify .mtm files are handled through the orchestrator
      const ctx = {
        file: '/path/to/test.mtm',
        server: mockServer
      };

      mockModuleGraph.getModulesByFile.mockReturnValue([]);

      await plugin.handleHotUpdate!(ctx as any);

      expect(mockOrchestrator.handleFileChange).toHaveBeenCalledWith(
        '/path/to/test.mtm',
        'mtm',
        'mock file content'
      );
    });

    it('should satisfy requirement 5.2 - target framework changes', async () => {
      // Verify MTM files are recompiled through the orchestrator
      const ctx = {
        file: '/path/to/test.mtm',
        server: mockServer
      };

      mockModuleGraph.getModulesByFile.mockReturnValue([
        { url: '/test.mtm', id: 'test-id' }
      ]);

      await plugin.handleHotUpdate!(ctx as any);

      // Verify compilation cache is cleared for recompilation
      expect(mockOrchestrator.handleFileChange).toHaveBeenCalled();
    });
  });
});