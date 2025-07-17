import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { metamon } from '../vite-plugin.js';

// Mock Vite types for testing
interface MockViteDevServer {
  moduleGraph: {
    getModulesByFile: (file: string) => Set<any> | undefined;
  };
  ws: {
    send: (data: any) => void;
  };
}

describe('Vite Plugin Integration Tests', () => {
  const testDir = path.join(__dirname, 'vite-test-fixtures');
  const srcDir = 'src';
  const pagesDir = 'pages';
  const componentsDir = 'components';

  beforeEach(async () => {
    // Create test directory structure
    await fs.mkdir(path.join(testDir, srcDir), { recursive: true });
    await fs.mkdir(path.join(testDir, srcDir, pagesDir), { recursive: true });
    await fs.mkdir(path.join(testDir, srcDir, componentsDir), { recursive: true });
    
    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Plugin Configuration', () => {
    it('should create plugin with default options', () => {
      const plugin = metamon();
      
      expect(plugin.name).toBe('metamon');
      expect(typeof plugin.resolveId).toBe('function');
      expect(typeof plugin.load).toBe('function');
      expect(typeof plugin.transform).toBe('function');
    });

    it('should create plugin with custom options', () => {
      const plugin = metamon({
        root: 'custom-src',
        pagesDir: 'custom-pages',
        componentsDir: 'custom-components',
        hmr: false,
        sourceMaps: true
      });
      
      expect(plugin.name).toBe('metamon');
    });
  });

  describe('Import Resolution', () => {
    it('should resolve .mtm imports correctly', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return React.createElement('button', null, 'Click me');
}`;

      await fs.writeFile(path.join(testDir, srcDir, componentsDir, 'Button.mtm'), buttonComponent);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir
      });

      const buttonPath = path.join(testDir, srcDir, componentsDir, 'Button.mtm');
      const resolved = plugin.resolveId?.('Button.mtm', buttonPath);

      expect(resolved).toContain('Button.mtm?mtm-compiled');
    });

    it('should resolve relative .mtm imports', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return React.createElement('button', null, 'Click me');
}`;

      const homePage = `---
target: reactjs
---
import Button from '../components/Button.mtm';

export default function HomePage() {
  return React.createElement('div', null, React.createElement(Button));
}`;

      await fs.writeFile(path.join(testDir, srcDir, componentsDir, 'Button.mtm'), buttonComponent);
      await fs.writeFile(path.join(testDir, srcDir, pagesDir, 'home.mtm'), homePage);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir
      });

      const homePath = path.join(testDir, srcDir, pagesDir, 'home.mtm');
      const resolved = plugin.resolveId?.('../components/Button.mtm', homePath);

      expect(resolved).toContain('Button.mtm?mtm-compiled');
    });

    it('should resolve alias imports', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return React.createElement('button', null, 'Click me');
}`;

      await fs.writeFile(path.join(testDir, srcDir, componentsDir, 'Button.mtm'), buttonComponent);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir
      });

      const homePath = path.join(testDir, srcDir, pagesDir, 'home.mtm');
      const resolved = plugin.resolveId?.('@components/Button.mtm', homePath);

      expect(resolved).toContain('Button.mtm?mtm-compiled');
    });
  });

  describe('File Loading and Transformation', () => {
    it('should load and compile .mtm files', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return React.createElement('button', null, 'Click me');
}`;

      const buttonPath = path.join(testDir, srcDir, componentsDir, 'Button.mtm');
      await fs.writeFile(buttonPath, buttonComponent);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir
      });

      const compiledId = buttonPath + '?mtm-compiled';
      const result = await plugin.load?.(compiledId);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should transform .mtm files during build', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return React.createElement('button', null, 'Click me');
}`;

      const buttonPath = path.join(testDir, srcDir, componentsDir, 'Button.mtm');
      await fs.writeFile(buttonPath, buttonComponent);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir
      });

      const result = await plugin.transform?.(buttonComponent, buttonPath);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('Development Server Integration', () => {
    it('should configure server with dependency tracking', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return React.createElement('button', null, 'Click me');
}`;

      const homePage = `---
target: reactjs
---
import Button from '../components/Button.mtm';

export default function HomePage() {
  return React.createElement('div', null, React.createElement(Button));
}`;

      await fs.writeFile(path.join(testDir, srcDir, componentsDir, 'Button.mtm'), buttonComponent);
      await fs.writeFile(path.join(testDir, srcDir, pagesDir, 'home.mtm'), homePage);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir,
        hmr: true
      });

      const mockServer: MockViteDevServer = {
        moduleGraph: {
          getModulesByFile: vi.fn().mockReturnValue(new Set([{ url: '/test.js', id: 'test' }]))
        },
        ws: {
          send: vi.fn()
        }
      };

      // Configure server should not throw
      await expect(plugin.configureServer?.(mockServer as any)).resolves.not.toThrow();
    });
  });

  describe('Hot Module Replacement', () => {
    it('should handle HMR for .mtm files', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return React.createElement('button', null, 'Click me');
}`;

      const buttonPath = path.join(testDir, srcDir, componentsDir, 'Button.mtm');
      await fs.writeFile(buttonPath, buttonComponent);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir,
        hmr: true
      });

      const mockServer: MockViteDevServer = {
        moduleGraph: {
          getModulesByFile: vi.fn().mockReturnValue(new Set([{ url: '/Button.mtm', id: 'Button' }]))
        },
        ws: {
          send: vi.fn()
        }
      };

      const mockContext = {
        file: buttonPath,
        server: mockServer
      };

      const result = await plugin.handleHotUpdate?.(mockContext as any);

      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should not handle HMR for non-.mtm files', async () => {
      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir,
        hmr: true
      });

      const mockContext = {
        file: '/test/regular.js',
        server: {} as any
      };

      const result = await plugin.handleHotUpdate?.(mockContext as any);

      expect(result).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle compilation errors gracefully in development', async () => {
      const invalidComponent = `---
target: invalid-framework
---
This is invalid syntax`;

      const componentPath = path.join(testDir, srcDir, componentsDir, 'Invalid.mtm');
      await fs.writeFile(componentPath, invalidComponent);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir
      });

      // Configure a mock server to simulate development mode
      const mockServer: MockViteDevServer = {
        moduleGraph: {
          getModulesByFile: vi.fn()
        },
        ws: {
          send: vi.fn()
        }
      };

      await plugin.configureServer?.(mockServer as any);

      // Should not throw, but return error component
      const result = await plugin.transform?.(invalidComponent, componentPath);
      
      expect(result).toBeTruthy();
      expect(result).toContain('console.error');
      expect(result).toContain('Metamon compilation error');
    });

    it('should throw compilation errors in production', async () => {
      const invalidComponent = `---
target: invalid-framework
---
This is invalid syntax`;

      const componentPath = path.join(testDir, srcDir, componentsDir, 'Invalid.mtm');
      await fs.writeFile(componentPath, invalidComponent);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir
      });

      // Don't configure server to simulate production mode
      await expect(plugin.transform?.(invalidComponent, componentPath)).rejects.toThrow();
    });
  });

  describe('Bundle Generation', () => {
    it('should process .mtm files in bundle generation', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return React.createElement('button', null, 'Click me');
}`;

      await fs.writeFile(path.join(testDir, srcDir, componentsDir, 'Button.mtm'), buttonComponent);

      const plugin = metamon({
        root: srcDir,
        pagesDir,
        componentsDir
      });

      const mockBundle = {
        'Button.mtm': {
          type: 'chunk' as const,
          code: 'compiled code'
        }
      };

      // Should not throw
      expect(() => plugin.generateBundle?.({} as any, mockBundle)).not.toThrow();
    });
  });
});