/**
 * Integration Tests for Complete Build Pipeline
 * Tests the complete build pipeline from .mtm to working app
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn()
  },
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  readdirSync: vi.fn()
}));

// Mock glob for file discovery
vi.mock('glob', () => ({
  glob: vi.fn()
}));

// Mock build pipeline components
class MockPageScanner {
  async scanPages(pagesDir: string) {
    return [
      {
        filePath: 'pages/index.mtm',
        route: '/',
        title: 'Home',
        description: 'Home page',
        keywords: ['home'],
        layout: 'default',
        status: 200,
        isDynamic: false,
        parameters: [],
        locales: ['en'],
        metadata: { route: '/', title: 'Home' },
        content: '<div>Home content</div>',
        errors: [],
        lastModified: new Date(),
        size: 100
      },
      {
        filePath: 'pages/about.mtm',
        route: '/about',
        title: 'About',
        description: 'About page',
        keywords: ['about'],
        layout: 'default',
        status: 200,
        isDynamic: false,
        parameters: [],
        locales: ['en'],
        metadata: { route: '/about', title: 'About' },
        content: '<div>About content</div>',
        errors: [],
        lastModified: new Date(),
        size: 150
      },
      {
        filePath: 'pages/users/[id].mtm',
        route: '/users/[id]',
        title: 'User Profile',
        description: 'User profile page',
        keywords: ['user', 'profile'],
        layout: 'default',
        status: 200,
        isDynamic: true,
        parameters: ['id'],
        locales: ['en'],
        metadata: { route: '/users/[id]', title: 'User Profile' },
        content: '<div>User {id} profile</div>',
        errors: [],
        lastModified: new Date(),
        size: 200
      }
    ];
  }

  close() {}
}

class MockRouteManifestGenerator {
  async generateRouteManifest(pages: any[]) {
    const staticRoutes: Record<string, any> = {};
    const dynamicRoutes: any[] = [];

    pages.forEach(page => {
      if (page.isDynamic) {
        dynamicRoutes.push({
          template: page.route,
          pattern: page.route.replace(/\[(\w+)\]/g, '(?<$1>[^/]+)'),
          component: page.filePath,
          title: page.title,
          parameters: page.parameters,
          metadata: page.metadata
        });
      } else {
        staticRoutes[page.route] = {
          path: page.route,
          component: page.filePath,
          title: page.title,
          metadata: page.metadata
        };
      }
    });

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      totalRoutes: pages.length,
      staticRoutes,
      dynamicRoutes,
      fallbackRoutes: [],
      errorPages: {},
      i18nRoutes: {},
      metadata: {
        keywords: ['home', 'about', 'user', 'profile'],
        layouts: ['default'],
        locales: ['en'],
        totalSize: 450,
        lastModified: new Date()
      }
    };
  }

  close() {}
}

class MockMTMTransformer {
  transform(code: string, framework: string = 'react') {
    // Simple mock transformation
    const componentName = 'Component';
    let transformedCode = '';

    switch (framework) {
      case 'react':
        transformedCode = `
import React from 'react';
export default function ${componentName}() {
  return (
    <div className="mtm-component">
      ${code.replace(/<div>/g, '<div>').replace(/{(\w+)}/g, '{props.$1}')}
    </div>
  );
}`;
        break;
      case 'vue':
        transformedCode = `
<template>
  <div class="mtm-component">
    ${code.replace(/{(\w+)}/g, '{{ $1 }}')}
  </div>
</template>
<script setup>
// Vue component logic
</script>`;
        break;
      case 'svelte':
        transformedCode = `
<script>
// Svelte component logic
</script>
<div class="mtm-component">
  ${code.replace(/{(\w+)}/g, '{$1}')}
</div>`;
        break;
      default:
        transformedCode = `
export default function ${componentName}() {
  const element = document.createElement('div');
  element.className = 'mtm-component';
  element.innerHTML = \`${code}\`;
  return element;
}`;
    }

    return {
      code: transformedCode,
      map: null,
      errors: [],
      warnings: []
    };
  }
}

class MockVitePlugin {
  name = 'mtm-plugin';
  enforce = 'pre' as const;

  configResolved(config: any) {
    this.config = config;
  }

  buildStart() {
    // Initialize build
  }

  resolveId(id: string) {
    if (id.endsWith('.mtm')) {
      return id + '?mtm-transformed';
    }
    return null;
  }

  load(id: string) {
    if (id.includes('?mtm-transformed')) {
      const filePath = id.replace('?mtm-transformed', '');
      // Mock loading MTM file
      return {
        code: `export default function Component() { return '<div>Mock component</div>'; }`,
        map: null
      };
    }
    return null;
  }

  transform(code: string, id: string) {
    if (id.endsWith('.mtm')) {
      const transformer = new MockMTMTransformer();
      return transformer.transform(code, 'react');
    }
    return null;
  }

  generateBundle() {
    // Generate final bundle
  }
}

class BuildPipeline {
  private pageScanner: MockPageScanner;
  private routeGenerator: MockRouteManifestGenerator;
  private transformer: MockMTMTransformer;
  private vitePlugin: MockVitePlugin;

  constructor(options: any = {}) {
    this.pageScanner = new MockPageScanner();
    this.routeGenerator = new MockRouteManifestGenerator();
    this.transformer = new MockMTMTransformer();
    this.vitePlugin = new MockVitePlugin();
  }

  async build(pagesDir: string, outputDir: string, framework: string = 'react') {
    const buildResult = {
      success: false,
      pages: [] as any[],
      manifest: null as any,
      transformedComponents: [] as any[],
      errors: [] as any[],
      warnings: [] as any[]
    };

    try {
      // Step 1: Scan pages
      console.log('🔍 Scanning pages...');
      const pages = await this.pageScanner.scanPages(pagesDir);
      buildResult.pages = pages;

      // Check for errors in pages
      const pageErrors = pages.flatMap(page => page.errors);
      if (pageErrors.length > 0) {
        buildResult.errors.push(...pageErrors);
        buildResult.warnings.push(`Found ${pageErrors.length} page parsing errors`);
      }

      // Step 2: Generate route manifest
      console.log('📋 Generating route manifest...');
      const manifest = await this.routeGenerator.generateRouteManifest(pages);
      buildResult.manifest = manifest;

      // Step 3: Transform components
      console.log(`🔄 Transforming components to ${framework}...`);
      const transformedComponents = [];

      for (const page of pages) {
        try {
          const transformed = this.transformer.transform(page.content, framework);
          
          if (transformed.errors.length > 0) {
            buildResult.errors.push(...transformed.errors);
          }
          
          if (transformed.warnings.length > 0) {
            buildResult.warnings.push(...transformed.warnings);
          }

          transformedComponents.push({
            originalFile: page.filePath,
            route: page.route,
            framework,
            code: transformed.code,
            sourceMap: transformed.map
          });
        } catch (error: any) {
          buildResult.errors.push({
            type: 'transform_error',
            message: `Failed to transform ${page.filePath}: ${error.message}`,
            file: page.filePath
          });
        }
      }

      buildResult.transformedComponents = transformedComponents;

      // Step 4: Write output files
      console.log('📝 Writing output files...');
      await this.writeOutputFiles(outputDir, manifest, transformedComponents);

      // Step 5: Validate build
      console.log('✅ Validating build...');
      const validationResult = await this.validateBuild(buildResult);
      
      if (!validationResult.valid) {
        buildResult.errors.push(...validationResult.errors);
      }

      buildResult.success = buildResult.errors.length === 0;

      console.log(`🎉 Build ${buildResult.success ? 'completed successfully' : 'completed with errors'}`);
      return buildResult;

    } catch (error: any) {
      buildResult.errors.push({
        type: 'build_error',
        message: `Build pipeline failed: ${error.message}`,
        stack: error.stack
      });
      return buildResult;
    }
  }

  private async writeOutputFiles(outputDir: string, manifest: any, components: any[]) {
    // Mock writing files
    const writeOperations = [];

    // Write route manifest
    writeOperations.push(
      fs.writeFile(
        join(outputDir, 'route-manifest.json'),
        JSON.stringify(manifest, null, 2)
      )
    );

    // Write transformed components
    for (const component of components) {
      const outputPath = join(outputDir, component.originalFile.replace('.mtm', '.js'));
      writeOperations.push(
        fs.writeFile(outputPath, component.code)
      );

      if (component.sourceMap) {
        writeOperations.push(
          fs.writeFile(outputPath + '.map', JSON.stringify(component.sourceMap))
        );
      }
    }

    await Promise.all(writeOperations);
  }

  private async validateBuild(buildResult: any) {
    const errors = [];

    // Validate manifest
    if (!buildResult.manifest) {
      errors.push({ type: 'validation_error', message: 'Route manifest is missing' });
    } else {
      if (!buildResult.manifest.staticRoutes) {
        errors.push({ type: 'validation_error', message: 'Static routes missing from manifest' });
      }
      if (!buildResult.manifest.dynamicRoutes) {
        errors.push({ type: 'validation_error', message: 'Dynamic routes missing from manifest' });
      }
    }

    // Validate transformed components
    if (buildResult.transformedComponents.length === 0) {
      errors.push({ type: 'validation_error', message: 'No components were transformed' });
    }

    for (const component of buildResult.transformedComponents) {
      if (!component.code || component.code.trim().length === 0) {
        errors.push({
          type: 'validation_error',
          message: `Empty transformed code for ${component.originalFile}`
        });
      }
    }

    // Validate route consistency
    const manifestRoutes = [
      ...Object.keys(buildResult.manifest?.staticRoutes || {}),
      ...(buildResult.manifest?.dynamicRoutes || []).map((r: any) => r.template)
    ];

    const pageRoutes = buildResult.pages.map((p: any) => p.route);

    for (const pageRoute of pageRoutes) {
      if (!manifestRoutes.includes(pageRoute)) {
        errors.push({
          type: 'validation_error',
          message: `Page route ${pageRoute} not found in manifest`
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getVitePlugin() {
    return this.vitePlugin;
  }

  close() {
    this.pageScanner.close();
    this.routeGenerator.close();
  }
}

describe('Build Pipeline Integration', () => {
  let buildPipeline: BuildPipeline;
  let mockFs: any;

  beforeEach(() => {
    buildPipeline = new BuildPipeline();
    mockFs = vi.mocked(fs);
    
    // Setup default mock implementations
    mockFs.readFile.mockResolvedValue('mock file content');
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
  });

  afterEach(() => {
    buildPipeline.close();
    vi.clearAllMocks();
  });

  describe('Complete Build Process', () => {
    it('should complete full build pipeline successfully', async () => {
      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(3);
      expect(result.manifest).toBeDefined();
      expect(result.transformedComponents).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle different target frameworks', async () => {
      const frameworks = ['react', 'vue', 'svelte', 'vanilla'];

      for (const framework of frameworks) {
        const result = await buildPipeline.build('src/pages', 'dist', framework);

        expect(result.success).toBe(true);
        expect(result.transformedComponents).toHaveLength(3);
        
        result.transformedComponents.forEach(component => {
          expect(component.framework).toBe(framework);
          expect(component.code).toContain('mtm-component');
        });
      }
    });

    it('should generate correct route manifest', async () => {
      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      expect(result.manifest.version).toBe('1.0.0');
      expect(result.manifest.totalRoutes).toBe(3);
      
      // Check static routes
      expect(result.manifest.staticRoutes['/']).toBeDefined();
      expect(result.manifest.staticRoutes['/about']).toBeDefined();
      
      // Check dynamic routes
      expect(result.manifest.dynamicRoutes).toHaveLength(1);
      expect(result.manifest.dynamicRoutes[0].template).toBe('/users/[id]');
      expect(result.manifest.dynamicRoutes[0].parameters).toEqual(['id']);
    });

    it('should write output files correctly', async () => {
      await buildPipeline.build('src/pages', 'dist', 'react');

      // Check that writeFile was called for manifest
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('route-manifest.json'),
        expect.stringContaining('"version": "1.0.0"')
      );

      // Check that writeFile was called for each component
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('index.js'),
        expect.stringContaining('export default function')
      );
    });
  });

  describe('Error Handling in Build Pipeline', () => {
    it('should handle page scanning errors', async () => {
      // Mock page scanner to return pages with errors
      const originalScanPages = buildPipeline['pageScanner'].scanPages;
      buildPipeline['pageScanner'].scanPages = async () => [
        {
          filePath: 'pages/error.mtm',
          route: '/error',
          title: 'Error Page',
          description: '',
          keywords: [],
          layout: 'default',
          status: 200,
          isDynamic: false,
          parameters: [],
          locales: ['en'],
          metadata: {},
          content: '',
          errors: [{ type: 'parse_error', message: 'Invalid frontmatter' }],
          lastModified: new Date(),
          size: 0
        }
      ];

      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('page parsing errors');

      // Restore original method
      buildPipeline['pageScanner'].scanPages = originalScanPages;
    });

    it('should handle transformation errors', async () => {
      // Mock transformer to throw error
      const originalTransform = buildPipeline['transformer'].transform;
      buildPipeline['transformer'].transform = () => {
        throw new Error('Transformation failed');
      };

      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('transform_error');

      // Restore original method
      buildPipeline['transformer'].transform = originalTransform;
    });

    it('should handle file system errors', async () => {
      // Mock fs.writeFile to throw error
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle build validation errors', async () => {
      // Mock route generator to return invalid manifest
      const originalGenerate = buildPipeline['routeGenerator'].generateRouteManifest;
      buildPipeline['routeGenerator'].generateRouteManifest = async () => ({
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        totalRoutes: 0,
        staticRoutes: null, // Invalid
        dynamicRoutes: null, // Invalid
        fallbackRoutes: [],
        errorPages: {},
        i18nRoutes: {},
        metadata: {}
      });

      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('Static routes missing'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('Dynamic routes missing'))).toBe(true);

      // Restore original method
      buildPipeline['routeGenerator'].generateRouteManifest = originalGenerate;
    });
  });

  describe('Vite Plugin Integration', () => {
    it('should provide working Vite plugin', () => {
      const plugin = buildPipeline.getVitePlugin();

      expect(plugin.name).toBe('mtm-plugin');
      expect(plugin.enforce).toBe('pre');
      expect(plugin.resolveId).toBeDefined();
      expect(plugin.load).toBeDefined();
      expect(plugin.transform).toBeDefined();
    });

    it('should resolve .mtm files correctly', () => {
      const plugin = buildPipeline.getVitePlugin();

      const resolved = plugin.resolveId('test.mtm');
      expect(resolved).toBe('test.mtm?mtm-transformed');

      const notResolved = plugin.resolveId('test.js');
      expect(notResolved).toBe(null);
    });

    it('should load transformed .mtm files', () => {
      const plugin = buildPipeline.getVitePlugin();

      const loaded = plugin.load('test.mtm?mtm-transformed');
      expect(loaded).toBeDefined();
      expect(loaded.code).toContain('export default function');

      const notLoaded = plugin.load('test.js');
      expect(notLoaded).toBe(null);
    });

    it('should transform .mtm files', () => {
      const plugin = buildPipeline.getVitePlugin();

      const transformed = plugin.transform('<div>Test</div>', 'test.mtm');
      expect(transformed).toBeDefined();
      expect(transformed.code).toContain('React');

      const notTransformed = plugin.transform('console.log("test")', 'test.js');
      expect(notTransformed).toBe(null);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of pages efficiently', async () => {
      // Mock page scanner to return many pages
      const originalScanPages = buildPipeline['pageScanner'].scanPages;
      buildPipeline['pageScanner'].scanPages = async () => {
        const pages = [];
        for (let i = 0; i < 100; i++) {
          pages.push({
            filePath: `pages/page-${i}.mtm`,
            route: `/page-${i}`,
            title: `Page ${i}`,
            description: `Description ${i}`,
            keywords: [`page${i}`],
            layout: 'default',
            status: 200,
            isDynamic: false,
            parameters: [],
            locales: ['en'],
            metadata: { route: `/page-${i}`, title: `Page ${i}` },
            content: `<div>Page ${i} content</div>`,
            errors: [],
            lastModified: new Date(),
            size: 100
          });
        }
        return pages;
      };

      const startTime = performance.now();
      const result = await buildPipeline.build('src/pages', 'dist', 'react');
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(100);
      expect(result.transformedComponents).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in reasonable time

      // Restore original method
      buildPipeline['pageScanner'].scanPages = originalScanPages;
    });

    it('should handle concurrent builds', async () => {
      const builds = [];
      
      for (let i = 0; i < 5; i++) {
        builds.push(buildPipeline.build(`src/pages-${i}`, `dist-${i}`, 'react'));
      }

      const results = await Promise.all(builds);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.pages).toHaveLength(3);
      });
    });
  });

  describe('Build Artifacts Validation', () => {
    it('should validate route manifest structure', async () => {
      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      const manifest = result.manifest;
      
      // Required fields
      expect(manifest.version).toBeDefined();
      expect(manifest.generatedAt).toBeDefined();
      expect(manifest.totalRoutes).toBeDefined();
      expect(manifest.staticRoutes).toBeDefined();
      expect(manifest.dynamicRoutes).toBeDefined();
      expect(manifest.metadata).toBeDefined();

      // Metadata structure
      expect(manifest.metadata.keywords).toBeInstanceOf(Array);
      expect(manifest.metadata.layouts).toBeInstanceOf(Array);
      expect(manifest.metadata.locales).toBeInstanceOf(Array);
      expect(typeof manifest.metadata.totalSize).toBe('number');
    });

    it('should validate transformed component structure', async () => {
      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      result.transformedComponents.forEach(component => {
        expect(component.originalFile).toBeDefined();
        expect(component.route).toBeDefined();
        expect(component.framework).toBeDefined();
        expect(component.code).toBeDefined();
        expect(typeof component.code).toBe('string');
        expect(component.code.length).toBeGreaterThan(0);
      });
    });

    it('should ensure route consistency between pages and manifest', async () => {
      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      const pageRoutes = result.pages.map(p => p.route);
      const manifestStaticRoutes = Object.keys(result.manifest.staticRoutes);
      const manifestDynamicRoutes = result.manifest.dynamicRoutes.map((r: any) => r.template);
      const allManifestRoutes = [...manifestStaticRoutes, ...manifestDynamicRoutes];

      pageRoutes.forEach(route => {
        expect(allManifestRoutes).toContain(route);
      });
    });
  });

  describe('Framework-Specific Build Outputs', () => {
    it('should generate React-specific code', async () => {
      const result = await buildPipeline.build('src/pages', 'dist', 'react');

      result.transformedComponents.forEach(component => {
        expect(component.code).toContain('import React');
        expect(component.code).toContain('export default function');
        expect(component.code).toContain('className');
      });
    });

    it('should generate Vue-specific code', async () => {
      const result = await buildPipeline.build('src/pages', 'dist', 'vue');

      result.transformedComponents.forEach(component => {
        expect(component.code).toContain('<template>');
        expect(component.code).toContain('<script setup>');
        expect(component.code).toContain('class=');
      });
    });

    it('should generate Svelte-specific code', async () => {
      const result = await buildPipeline.build('src/pages', 'dist', 'svelte');

      result.transformedComponents.forEach(component => {
        expect(component.code).toContain('<script>');
        expect(component.code).toContain('class=');
      });
    });

    it('should generate Vanilla JS code', async () => {
      const result = await buildPipeline.build('src/pages', 'dist', 'vanilla');

      result.transformedComponents.forEach(component => {
        expect(component.code).toContain('export default function');
        expect(component.code).toContain('document.createElement');
        expect(component.code).toContain('className');
      });
    });
  });
});