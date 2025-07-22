/**
 * Tests for Production Optimizer
 * Testing minification, SEO generation, and build optimizations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createProductionOptimizer } from '../build-tools/production-optimizer.js';
import fs from 'fs/promises';
import path from 'path';

// Mock fs operations
vi.mock('fs/promises');

// Mock bundle analyzer and route manifest generator
vi.mock('../build-tools/bundle-analyzer.js', () => ({
  createBundleAnalyzer: vi.fn(() => ({
    analyzeBundles: vi.fn().mockResolvedValue({
      totalSize: 100000,
      bundles: [],
      optimizationOpportunities: []
    })
  }))
}));

vi.mock('../build-tools/route-manifest-generator.js', () => ({
  createRouteManifestGenerator: vi.fn(() => ({
    generateRouteManifest: vi.fn().mockResolvedValue({
      staticRoutes: {
        '/': { path: '/', title: 'Home' },
        '/docs': { path: '/docs', title: 'Documentation' }
      },
      dynamicRoutes: []
    }),
    close: vi.fn()
  }))
}));

describe('ProductionOptimizer', () => {
  let optimizer;
  let mockFiles;

  beforeEach(() => {
    optimizer = createProductionOptimizer({
      outputDir: 'test-dist',
      pagesDir: 'test-pages',
      baseUrl: 'https://test.com',
      minifyJS: true,
      minifyCSS: true,
      generateSitemap: true,
      generateRobotsTxt: true,
      generateManifest: true
    });

    // Mock file system
    mockFiles = {
      'test-dist/main.js': `
        // This is a comment
        function hello() {
          console.log("Hello World");
          return "test";
        }
        
        export default hello;
      `,
      'test-dist/styles.css': `
        /* CSS Comment */
        .app {
          color: blue;
          margin: 10px;
        }
        
        .component {
          padding: 5px;
        }
      `,
      'test-dist/image.png': 'fake-image-data'
    };

    // Mock fs.readdir
    fs.readdir.mockImplementation(async (dir) => {
      const files = Object.keys(mockFiles)
        .filter(file => file.startsWith(dir))
        .map(file => ({
          name: path.basename(file),
          isDirectory: () => false,
          isFile: () => true
        }));
      return files;
    });

    // Mock fs.readFile
    fs.readFile.mockImplementation(async (filePath, encoding) => {
      if (mockFiles[filePath]) {
        return mockFiles[filePath];
      }
      throw new Error('File not found');
    });

    // Mock fs.writeFile
    fs.writeFile.mockResolvedValue();

    // Mock fs.stat
    fs.stat.mockImplementation(async (filePath) => {
      const file = mockFiles[filePath];
      if (file) {
        return {
          size: file.length,
          isFile: () => true,
          isDirectory: () => false
        };
      }
      throw new Error('File not found');
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    optimizer.destroy();
    vi.restoreAllMocks();
  });

  describe('Asset Minification', () => {
    it('should minify JavaScript files', async () => {
      const originalJS = `
        // This is a comment
        function hello() {
          console.log("Hello World");
          return "test";
        }
      `;

      const minified = await optimizer.minifyJavaScript(originalJS);

      expect(minified).not.toContain('// This is a comment');
      expect(minified).not.toContain('\n');
      expect(minified.length).toBeLessThan(originalJS.length);
      expect(minified).toContain('function hello()');
      expect(minified).toContain('console.log("Hello World")');
    });

    it('should minify CSS files', async () => {
      const originalCSS = `
        /* CSS Comment */
        .app {
          color: blue;
          margin: 10px;
        }
      `;

      const minified = await optimizer.minifyCSS(originalCSS);

      expect(minified).not.toContain('/* CSS Comment */');
      expect(minified).not.toContain('\n');
      expect(minified.length).toBeLessThan(originalCSS.length);
      expect(minified).toContain('.app{color:blue;margin:10px}');
    });

    it('should process asset files during optimization', async () => {
      await optimizer.minifyAssets();

      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/main.js',
        expect.any(String)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/styles.css',
        expect.any(String)
      );
    });
  });

  describe('SEO File Generation', () => {
    it('should generate XML sitemap', async () => {
      await optimizer.generateSitemap();

      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/sitemap.xml',
        expect.stringContaining('<?xml version="1.0" encoding="UTF-8"?>')
      );

      const sitemapCall = fs.writeFile.mock.calls.find(call =>
        call[0] === 'test-dist/sitemap.xml'
      );
      const sitemapContent = sitemapCall[1];

      expect(sitemapContent).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemapContent).toContain('<loc>https://test.com/</loc>');
      expect(sitemapContent).toContain('<loc>https://test.com/docs</loc>');
    });

    it('should generate robots.txt', async () => {
      await optimizer.generateRobotsTxt();

      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/robots.txt',
        expect.stringContaining('User-agent: *')
      );

      const robotsCall = fs.writeFile.mock.calls.find(call =>
        call[0] === 'test-dist/robots.txt'
      );
      const robotsContent = robotsCall[1];

      expect(robotsContent).toContain('Allow: /');
      expect(robotsContent).toContain('Sitemap: https://test.com/sitemap.xml');
    });

    it('should generate web app manifest', async () => {
      await optimizer.generateWebManifest();

      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/manifest.json',
        expect.any(String)
      );

      const manifestCall = fs.writeFile.mock.calls.find(call =>
        call[0] === 'test-dist/manifest.json'
      );
      const manifestContent = JSON.parse(manifestCall[1]);

      expect(manifestContent).toHaveProperty('name');
      expect(manifestContent).toHaveProperty('short_name');
      expect(manifestContent).toHaveProperty('start_url', '/');
      expect(manifestContent).toHaveProperty('display', 'standalone');
      expect(manifestContent.icons).toHaveLength(2);
    });
  });

  describe('Route Manifest Optimization', () => {
    it('should generate optimized route manifest', async () => {
      await optimizer.generateOptimizedRouteManifest();

      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/route-manifest.json',
        expect.any(String)
      );

      const manifestCall = fs.writeFile.mock.calls.find(call =>
        call[0] === 'test-dist/route-manifest.json'
      );
      const manifestContent = manifestCall[1];

      // Should be minified (no pretty printing)
      expect(manifestContent).not.toContain('\n  ');
      expect(JSON.parse(manifestContent)).toHaveProperty('staticRoutes');
    });

    it('should optimize manifest for production', () => {
      const testManifest = {
        staticRoutes: {
          '/': {
            path: '/',
            title: 'Home',
            preload: false,
            lazy: false,
            priority: 'normal',
            lastModified: new Date(),
            size: 1000
          }
        },
        metadata: {
          buildInfo: { nodeVersion: 'v18.0.0' },
          totalSize: 1000
        }
      };

      optimizer.optimizeManifestForProduction(testManifest);

      // Should remove development fields
      expect(testManifest.staticRoutes['/'].lastModified).toBeUndefined();
      expect(testManifest.staticRoutes['/'].size).toBeUndefined();
      expect(testManifest.metadata.buildInfo).toBeUndefined();

      // Should remove default values
      expect(testManifest.staticRoutes['/'].preload).toBeUndefined();
      expect(testManifest.staticRoutes['/'].lazy).toBeUndefined();
      expect(testManifest.staticRoutes['/'].priority).toBeUndefined();
    });
  });

  describe('File Discovery', () => {
    it('should find asset files to minify', async () => {
      const files = await optimizer.findAssetFiles();

      expect(files).toContain('test-dist/main.js');
      expect(files).toContain('test-dist/styles.css');
      expect(files).not.toContain('test-dist/image.png');
    });

    it('should find image files to optimize', async () => {
      const files = await optimizer.findImageFiles();

      expect(files).toContain('test-dist/image.png');
      expect(files).not.toContain('test-dist/main.js');
    });

    it('should find compressible files', async () => {
      const files = await optimizer.findCompressibleFiles();

      expect(files).toContain('test-dist/main.js');
      expect(files).toContain('test-dist/styles.css');
      expect(files).not.toContain('test-dist/image.png');
    });
  });

  describe('Size Formatting', () => {
    it('should format file sizes correctly', () => {
      expect(optimizer.formatSize(1024)).toBe('1.0 KB');
      expect(optimizer.formatSize(1048576)).toBe('1.0 MB');
      expect(optimizer.formatSize(1073741824)).toBe('1.0 GB');
      expect(optimizer.formatSize(512)).toBe('512.0 B');
    });
  });

  describe('Optimization Report', () => {
    it('should generate optimization report', async () => {
      optimizer.optimizationResults = {
        originalSize: 100000,
        optimizedSize: 80000,
        compressionRatio: 0.2,
        filesProcessed: 5,
        assetsOptimized: 3,
        seoFilesGenerated: ['sitemap.xml', 'robots.txt'],
        errors: [],
        warnings: ['Test warning']
      };

      await optimizer.generateOptimizationReport();

      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/optimization-report.json',
        expect.any(String)
      );

      const reportCall = fs.writeFile.mock.calls.find(call =>
        call[0] === 'test-dist/optimization-report.json'
      );
      const report = JSON.parse(reportCall[1]);

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('optimization');
      expect(report).toHaveProperty('files');
      expect(report).toHaveProperty('seo');
      expect(report).toHaveProperty('issues');
      expect(report).toHaveProperty('recommendations');

      expect(report.optimization.originalSize).toBe(100000);
      expect(report.optimization.optimizedSize).toBe(80000);
      expect(report.files.processed).toBe(5);
      expect(report.seo.filesGenerated).toContain('sitemap.xml');
      expect(report.issues.warnings).toContain('Test warning');
    });

    it('should generate recommendations', () => {
      optimizer.optimizationResults = {
        compressionRatio: 0.05,
        warnings: ['Warning 1', 'Warning 2'],
        assetsOptimized: 0
      };

      const recommendations = optimizer.generateRecommendations();

      expect(recommendations).toHaveLength(3);
      expect(recommendations.some(r => r.type === 'compression')).toBe(true);
      expect(recommendations.some(r => r.type === 'warnings')).toBe(true);
      expect(recommendations.some(r => r.type === 'assets')).toBe(true);
    });
  });

  describe('Full Optimization Process', () => {
    it('should run complete optimization process', async () => {
      const results = await optimizer.optimize();

      expect(results).toHaveProperty('originalSize');
      expect(results).toHaveProperty('optimizedSize');
      expect(results).toHaveProperty('compressionRatio');
      expect(results).toHaveProperty('filesProcessed');
      expect(results).toHaveProperty('assetsOptimized');
      expect(results).toHaveProperty('seoFilesGenerated');

      // Should have generated SEO files
      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/sitemap.xml',
        expect.any(String)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/robots.txt',
        expect.any(String)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/manifest.json',
        expect.any(String)
      );

      // Should have generated optimization report
      expect(fs.writeFile).toHaveBeenCalledWith(
        'test-dist/optimization-report.json',
        expect.any(String)
      );
    });

    it('should handle optimization errors gracefully', async () => {
      // Mock an error in minification
      fs.readFile.mockRejectedValueOnce(new Error('Read error'));

      const results = await optimizer.optimize();

      expect(results.errors.length).toBeGreaterThan(0);
      expect(results.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Management', () => {
    it('should cleanup resources on destroy', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      optimizer.destroy();

      expect(consoleSpy).toHaveBeenCalledWith('🔒 Production optimizer destroyed');

      consoleSpy.mockRestore();
    });

    it('should return optimization results', () => {
      optimizer.optimizationResults.filesProcessed = 5;

      const results = optimizer.getResults();

      expect(results.filesProcessed).toBe(5);
      expect(results).not.toBe(optimizer.optimizationResults); // Should be a copy
    });
  });
});