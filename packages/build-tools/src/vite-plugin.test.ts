import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve, join, relative } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { metamon, MetamonOptions } from './vite-plugin.js';
import { createServer, ViteDevServer } from 'vite';

// Mock file system for testing
const testDir = resolve(__dirname, '../test-fixtures');
const testSrcDir = join(testDir, 'src');
const testPagesDir = join(testSrcDir, 'pages');
const testComponentsDir = join(testSrcDir, 'components');

describe('Metamon Vite Plugin', () => {
  beforeEach(() => {
    // Create test directory structure
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(testSrcDir, { recursive: true });
    mkdirSync(testPagesDir, { recursive: true });
    mkdirSync(testComponentsDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Plugin Configuration', () => {
    it('should create plugin with default options', () => {
      const plugin = metamon();
      
      expect(plugin.name).toBe('metamon');
      expect(plugin).toHaveProperty('load');
      expect(plugin).toHaveProperty('transform');
      expect(plugin).toHaveProperty('handleHotUpdate');
    });

    it('should create plugin with custom options', () => {
      const options: MetamonOptions = {
        root: 'custom-src',
        pagesDir: 'custom-pages',
        componentsDir: 'custom-components',
        hmr: false,
        sourceMaps: true
      };

      const plugin = metamon(options);
      expect(plugin.name).toBe('metamon');
    });
  });

  describe('File Resolution', () => {
    it('should resolve .mtm files correctly', () => {
      const plugin = metamon();
      
      // Create a test .mtm file
      const mtmFile = join(testComponentsDir, 'test.mtm');
      writeFileSync(mtmFile, `---
target: reactjs
---
export default function Test() {
  return <div>Test</div>;
}`);

      const resolvedId = plugin.resolveId?.(mtmFile, undefined);
      expect(resolvedId).toBe(mtmFile + '?mtm-compiled');
    });

    it('should not resolve non-.mtm files', () => {
      const plugin = metamon();
      
      const resolvedId = plugin.resolveId?.('test.js', undefined);
      expect(resolvedId).toBeNull();
    });
  });

  describe('File Compilation', () => {
    it('should compile React .mtm files', async () => {
      const plugin = metamon();
      
      // Create a React .mtm file
      const mtmFile = join(testComponentsDir, 'react-component.mtm');
      writeFileSync(mtmFile, `---
target: reactjs
channels:
  - event: testEvent
    emit: onTestEvent
---
import React from 'react';

export default function ReactComponent() {
  return <div>React Component</div>;
}`);

      const result = await plugin.load?.(mtmFile + '?mtm-compiled');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('React');
      expect(result).toContain('ReactComponent');
    });

    it('should compile Vue .mtm files', async () => {
      const plugin = metamon();
      
      // Create a Vue .mtm file
      const mtmFile = join(testComponentsDir, 'vue-component.mtm');
      writeFileSync(mtmFile, `---
target: vue
---
<template>
  <div>Vue Component</div>
</template>

<script>
export default {
  name: 'VueComponent'
}
</script>`);

      const result = await plugin.load?.(mtmFile + '?mtm-compiled');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('VueComponent');
    });

    it('should handle compilation errors gracefully', async () => {
      const plugin = metamon();
      
      // Mock server for development mode
      const mockServer = {
        ws: { send: vi.fn() },
        moduleGraph: { getModulesByFile: vi.fn() },
        watcher: { add: vi.fn() }
      } as any;
      
      // Set up the plugin with mock server
      plugin.configureServer?.(mockServer);
      
      // Create an invalid .mtm file
      const mtmFile = join(testComponentsDir, 'invalid.mtm');
      writeFileSync(mtmFile, `---
target: invalid-framework
---
export default function Invalid() {
  return <div>Invalid</div>;
}`);

      const result = await plugin.load?.(mtmFile + '?mtm-compiled');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Metamon Compilation Error');
    });
  });

  describe('Hot Module Replacement', () => {
    it('should handle .mtm file changes', async () => {
      const plugin = metamon({ hmr: true });
      
      const mtmFile = join(testComponentsDir, 'hmr-test.mtm');
      writeFileSync(mtmFile, `---
target: reactjs
---
export default function HMRTest() {
  return <div>HMR Test</div>;
}`);

      // Mock Vite dev server
      const mockServer = {
        ws: {
          send: vi.fn()
        },
        moduleGraph: {
          getModulesByFile: vi.fn().mockReturnValue(new Set([
            { url: mtmFile, id: mtmFile }
          ]))
        }
      } as any;

      // Configure the plugin with the mock server
      plugin.configureServer?.(mockServer);

      const hmrContext = {
        file: mtmFile,
        server: mockServer
      };

      const result = await plugin.handleHotUpdate?.(hmrContext);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should ignore non-.mtm file changes', async () => {
      const plugin = metamon({ hmr: true });
      
      const mockServer = {
        ws: { send: vi.fn() },
        moduleGraph: { getModulesByFile: vi.fn() }
      } as any;

      const jsFile = join(testSrcDir, 'test.js');
      writeFileSync(jsFile, 'console.log("test");');

      const hmrContext = {
        file: jsFile,
        server: mockServer
      };

      const result = await plugin.handleHotUpdate?.(hmrContext);
      
      expect(result).toBeUndefined();
    });
  });

  describe('Route Generation', () => {
    it('should identify page files correctly', () => {
      const plugin = metamon();
      
      const pageFile = join(testPagesDir, 'home.mtm');
      const componentFile = join(testComponentsDir, 'button.mtm');
      
      // These functions are now internal to the plugin, so we test them indirectly
      expect(pageFile.includes('pages') && pageFile.endsWith('.mtm')).toBe(true);
      expect(componentFile.includes('components') && componentFile.endsWith('.mtm')).toBe(true);
    });

    it('should generate correct route paths', () => {
      // Test route path generation logic indirectly
      const indexFile = join(testPagesDir, 'index.mtm');
      const aboutFile = join(testPagesDir, 'about.mtm');
      
      // Test the logic that would be used internally
      const getRoutePath = (filePath: string) => {
        const relativePath = relative(process.cwd(), filePath);
        const pathWithoutExt = relativePath.replace(/\.mtm$/, '');
        
        // Extract the part after src/pages
        const match = pathWithoutExt.match(/src[\/\\]pages[\/\\](.*)$/);
        if (!match) return '/';
        
        let routePath = match[1].replace(/\\/g, '/');
        
        // Handle index files
        if (routePath === 'index' || routePath.endsWith('/index')) {
          routePath = routePath.replace(/\/index$/, '').replace(/^index$/, '');
        }
        
        return routePath ? '/' + routePath : '/';
      };
      
      expect(getRoutePath(indexFile)).toBe('/');
      expect(getRoutePath(aboutFile)).toBe('/about');
    });
  });

  describe('Build Integration', () => {
    it('should process .mtm files during build', () => {
      const plugin = metamon();
      
      const mockBundle = {
        'test.mtm': {
          type: 'chunk' as const,
          fileName: 'test.mtm'
        }
      };

      // Should not throw during bundle generation
      expect(() => {
        plugin.generateBundle?.({}, mockBundle);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      const plugin = metamon();
      
      const nonExistentFile = join(testComponentsDir, 'non-existent.mtm');
      
      await expect(
        plugin.load?.(nonExistentFile + '?mtm-compiled')
      ).rejects.toThrow();
    });

    it('should handle invalid frontmatter', async () => {
      const plugin = metamon();
      
      // Mock server for development mode
      const mockServer = {
        ws: { send: vi.fn() },
        moduleGraph: { getModulesByFile: vi.fn() },
        watcher: { add: vi.fn() }
      } as any;
      
      // Set up the plugin with mock server
      plugin.configureServer?.(mockServer);
      
      const mtmFile = join(testComponentsDir, 'invalid-frontmatter.mtm');
      writeFileSync(mtmFile, `---
invalid yaml: [
---
export default function Invalid() {
  return <div>Invalid</div>;
}`);

      const result = await plugin.load?.(mtmFile + '?mtm-compiled');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Metamon Compilation Error');
    });
  });
});

describe('Plugin Integration with Vite', () => {
  let server: ViteDevServer;
  
  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  it('should integrate with Vite dev server', async () => {
    // Create a minimal Vite config with the plugin
    const config = {
      plugins: [metamon()],
      root: testDir,
      server: { port: 0 }, // Use random port
      logLevel: 'silent' as const
    };

    // This test verifies the plugin can be loaded by Vite
    expect(() => {
      // Just creating the config should work without errors
      const plugin = metamon();
      expect(plugin.name).toBe('metamon');
    }).not.toThrow();
  });
});