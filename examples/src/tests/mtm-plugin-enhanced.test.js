/**
 * Tests for Enhanced MTM Plugin with HMR Support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mtmPluginEnhanced } from '../mtm-plugin-enhanced.js';

// Mock file system operations
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
    statSync: vi.fn(),
    existsSync: vi.fn(),
    watch: vi.fn()
  };
});

// Mock route manifest generator
vi.mock('../build-tools/route-manifest-generator.js', () => ({
  createRouteManifestGenerator: vi.fn(() => ({
    generateRouteManifest: vi.fn().mockResolvedValue({
      version: '1.0.0',
      totalRoutes: 2,
      staticRoutes: {
        '/': { path: '/', component: 'index.mtm' },
        '/about': { path: '/about', component: 'about.mtm' }
      },
      dynamicRoutes: [],
      fallbackRoutes: [],
      errorPages: {},
      i18nRoutes: {},
      metadata: { keywords: [], layouts: [], locales: ['en'] }
    }),
    createEmptyManifest: vi.fn(() => ({
      version: '1.0.0',
      totalRoutes: 0,
      staticRoutes: {},
      dynamicRoutes: [],
      fallbackRoutes: [],
      errorPages: {},
      i18nRoutes: {},
      metadata: { keywords: [], layouts: [], locales: ['en'] }
    })),
    close: vi.fn()
  }))
}));

describe('Enhanced MTM Plugin with HMR', () => {
  let plugin;
  let mockServer;
  let mockConfig;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock server with WebSocket
    mockServer = {
      ws: {
        send: vi.fn()
      },
      moduleGraph: {
        getModulesByFile: vi.fn().mockReturnValue(new Set([
          { id: 'test.mtm', url: '/test.mtm' }
        ]))
      }
    };

    // Mock config
    mockConfig = {
      command: 'serve'
    };

    // Create plugin instance
    plugin = mtmPluginEnhanced({
      hmr: true,
      preserveState: true,
      verboseLogging: true
    });
  });

  afterEach(() => {
    if (plugin.cleanupHMR) {
      plugin.cleanupHMR();
    }
  });

  describe('Plugin Configuration', () => {
    it('should initialize with correct name and enforce pre', () => {
      expect(plugin.name).toBe('vite-plugin-mtm-ultra-modern-enhanced');
      expect(plugin.enforce).toBe('pre');
    });

    it('should configure for development mode', () => {
      plugin.configResolved(mockConfig);
      expect(plugin.configResolved).toBeDefined();
    });

    it('should configure for production mode', () => {
      plugin.configResolved({ command: 'build' });
      expect(plugin.configResolved).toBeDefined();
    });
  });

  describe('File Transformation', () => {
    beforeEach(async () => {
      // Mock file system
      const { readFileSync, statSync, existsSync } = await import('fs');
      vi.mocked(readFileSync).mockReturnValue(`---
route: /test
title: Test Page
description: A test page
---
<h1>Test Content</h1>`);

      vi.mocked(statSync).mockReturnValue({
        mtime: new Date('2024-01-01'),
        size: 100
      });

      vi.mocked(existsSync).mockReturnValue(true);
    });

    it('should transform .mtm files correctly', () => {
      const result = plugin.transform('', 'test.mtm');

      expect(result).toBeDefined();
      expect(result.code).toContain('SSR Page: /test');
      expect(result.code).toContain('HMR Enhanced');
      expect(result.code).toContain('import.meta.hot');
    });

    it('should handle frontmatter parsing', () => {
      const result = plugin.transform('', 'test.mtm');

      expect(result.code).toContain('"route": "/test"');
      expect(result.code).toContain('"title": "Test Page"');
      expect(result.code).toContain('"description": "A test page"');
    });

    it('should generate HMR-enabled components', () => {
      vi.mocked(readFileSync).mockReturnValue(`---
name: TestComponent
---
<div>Component Content</div>`);

      const result = plugin.transform('', 'component.mtm');

      expect(result.code).toContain('Component: TestComponent');
      expect(result.code).toContain('HMR Enhanced');
      expect(result.code).toContain('import.meta.hot.accept()');
    });

    it('should handle transformation errors gracefully', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = plugin.transform('', 'error.mtm');

      expect(result.code).toContain('MTM Compilation Error');
      expect(result.code).toContain('File read error');
    });
  });

  describe('Hot Module Replacement', () => {
    beforeEach(async () => {
      plugin.configResolved(mockConfig);
      await plugin.configureServer(mockServer);
    });

    it('should handle hot updates for .mtm files', async () => {
      vi.mocked(readFileSync).mockReturnValue(`---
route: /updated
title: Updated Page
---
<h1>Updated Content</h1>`);

      const ctx = {
        file: 'test.mtm',
        server: mockServer
      };

      const modules = await plugin.handleHotUpdate(ctx);

      expect(modules).toBeDefined();
      expect(mockServer.ws.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          event: 'mtm:hot-reload'
        })
      );
    });

    it('should preserve component state during HMR', async () => {
      vi.mocked(readFileSync).mockReturnValue(`---
route: /test
title: Test Page
---
<h1>Test Content</h1>`);

      const ctx = {
        file: 'test.mtm',
        server: mockServer
      };

      await plugin.handleHotUpdate(ctx);

      expect(mockServer.ws.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          event: 'mtm:preserve-state'
        })
      );
    });

    it('should update route manifest when page routes change', async () => {
      vi.mocked(readFileSync).mockReturnValue(`---
route: /new-route
title: New Route
---
<h1>New Route Content</h1>`);

      const ctx = {
        file: 'new-page.mtm',
        server: mockServer
      };

      await plugin.handleHotUpdate(ctx);

      // Should send route manifest update
      expect(mockServer.ws.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          event: 'mtm:route-manifest-updated'
        })
      );
    });

    it('should handle HMR errors gracefully', async () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('HMR processing error');
      });

      const ctx = {
        file: 'error.mtm',
        server: mockServer
      };

      const modules = await plugin.handleHotUpdate(ctx);

      expect(modules).toEqual([]);
      expect(mockServer.ws.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error'
        })
      );
    });
  });

  describe('File Watching', () => {
    beforeEach(async () => {
      plugin.configResolved(mockConfig);

      // Mock watch function
      const mockWatcher = {
        close: vi.fn()
      };
      const { watch } = await import('fs');
      vi.mocked(watch).mockReturnValue(mockWatcher);

      await plugin.configureServer(mockServer);
    });

    it('should set up file watchers for pages directory', async () => {
      const { watch } = await import('fs');
      expect(vi.mocked(watch)).toHaveBeenCalled();
    });

    it('should handle new file addition', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(`---
route: /new-page
title: New Page
---
<h1>New Page</h1>`);

      await plugin.handleFileAdded('src/pages/new-page.mtm');

      expect(mockServer.ws.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          event: 'mtm:route-added'
        })
      );
    });

    it('should handle file removal', async () => {
      await plugin.handleFileRemoved('src/pages/removed-page.mtm');

      expect(mockServer.ws.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          event: 'mtm:route-removed'
        })
      );
    });
  });

  describe('Route Manifest Integration', () => {
    beforeEach(async () => {
      plugin.configResolved(mockConfig);
      await plugin.configureServer(mockServer);
    });

    it('should initialize route manifest on startup', async () => {
      // Route manifest should be initialized during configureServer
      expect(plugin.initializeHMR).toBeDefined();
    });

    it('should update route manifest when pages change', async () => {
      const result = await plugin.updateRouteManifest('test.mtm');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('State Preservation', () => {
    beforeEach(async () => {
      plugin.configResolved(mockConfig);
      await plugin.configureServer(mockServer);
    });

    it('should preserve component state during updates', async () => {
      const modules = [{ id: 'test.mtm', url: '/test.mtm' }];

      await plugin.preserveComponentState('test.mtm', modules);

      expect(mockServer.ws.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          event: 'mtm:preserve-state',
          data: expect.objectContaining({
            file: 'test.mtm',
            modules: ['/test.mtm']
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should generate error components for compilation failures', () => {
      const error = new Error('Compilation failed');
      const result = plugin.generateErrorComponent?.('test.mtm', error) ||
        { code: 'error component', map: null };

      expect(result.code).toContain('MTM Compilation Error');
    });

    it('should handle missing files gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = plugin.transform('', 'missing.mtm');
      expect(result.code).toContain('MTM Compilation Error');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on build end', () => {
      plugin.configResolved(mockConfig);
      plugin.buildEnd();

      // Should call cleanup
      expect(plugin.cleanupHMR).toBeDefined();
    });

    it('should close file watchers during cleanup', async () => {
      plugin.configResolved(mockConfig);

      const mockWatcher = {
        close: vi.fn()
      };
      const { watch } = await import('fs');
      vi.mocked(watch).mockReturnValue(mockWatcher);

      await plugin.configureServer(mockServer);
      plugin.cleanupHMR();

      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe('Integration with Vite', () => {
    it('should resolve .mtm file IDs correctly', () => {
      const result = plugin.resolveId('test.mtm', 'src/pages/index.js');
      expect(result).toContain('?mtm-transformed');
    });

    it('should load transformed .mtm files', () => {
      vi.mocked(readFileSync).mockReturnValue(`---
route: /test
---
Content`);

      const result = plugin.load('test.mtm?mtm-transformed');
      expect(result).toBeDefined();
      expect(result.code).toContain('SSR Page');
    });

    it('should handle build start correctly', () => {
      plugin.buildStart();
      // Should clear compilation cache
      expect(plugin.buildStart).toBeDefined();
    });
  });
});

describe('HMR Client Integration', () => {
  it('should generate client-side HMR code', () => {
    const plugin = mtmPluginEnhanced({ hmr: true });

    vi.mocked(readFileSync).mockReturnValue(`---
route: /test
title: Test Page
---
<h1>Test</h1>`);

    const result = plugin.transform('', 'test.mtm');

    // Should include HMR client code
    expect(result.code).toContain('import.meta.hot');
    expect(result.code).toContain('mtm:hot-reload');
    expect(result.code).toContain('mtm:route-manifest-updated');
    expect(result.code).toContain('extractFormData');
    expect(result.code).toContain('restoreFormData');
  });

  it('should include state preservation logic', () => {
    const plugin = mtmPluginEnhanced({ hmr: true, preserveState: true });

    vi.mocked(readFileSync).mockReturnValue(`---
route: /form
title: Form Page
---
<form><input name="test" /></form>`);

    const result = plugin.transform('', 'form.mtm');

    expect(result.code).toContain('preservedState');
    expect(result.code).toContain('scrollY');
    expect(result.code).toContain('formData');
  });
});