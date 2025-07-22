/**
 * Tests for Bundle Analyzer
 * Testing bundle analysis, optimization detection, and tree shaking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBundleAnalyzer } from '../build-tools/bundle-analyzer.js';
import fs from 'fs/promises';
import path from 'path';

// Mock fs operations
vi.mock('fs/promises');

describe('BundleAnalyzer', () => {
  let bundleAnalyzer;
  let mockFiles;

  beforeEach(() => {
    bundleAnalyzer = createBundleAnalyzer({
      outputDir: 'dist',
      analyzeDir: 'src',
      generateReport: true,
      enableTreeShaking: true,
      chunkSizeLimit: 250000,
      assetSizeLimit: 100000
    });

    // Mock file system structure
    mockFiles = {
      'dist/main.js': {
        content: `
          import { component } from './component.js';
          export default function App() {
            return component();
          }
        `,
        size: 1024,
        mtime: new Date('2024-01-01')
      },
      'dist/vendor.js': {
        content: `
          // Large vendor bundle
          ${'/* vendor code */'.repeat(10000)}
        `,
        size: 300000,
        mtime: new Date('2024-01-01')
      },
      'dist/chunk-abc123.js': {
        content: `
          export function lazyComponent() {
            return '<div>Lazy Component</div>';
          }
        `,
        size: 512,
        mtime: new Date('2024-01-01')
      },
      'dist/styles.css': {
        content: `
          .app { color: blue; }
          .component { margin: 10px; }
        `,
        size: 256,
        mtime: new Date('2024-01-01')
      }
    };

    // Mock fs.readdir
    fs.readdir.mockImplementation(async (dir) => {
      if (dir === 'dist') {
        return Object.keys(mockFiles)
          .filter(file => file.startsWith('dist/'))
          .map(file => ({
            name: path.basename(file),
            isDirectory: () => false,
            isFile: () => true
          }));
      }
      return [];
    });

    // Mock fs.stat
    fs.stat.mockImplementation(async (filePath) => {
      const file = mockFiles[filePath];
      if (file) {
        return {
          size: file.size,
          mtime: file.mtime,
          isFile: () => true,
          isDirectory: () => false
        };
      }
      throw new Error('File not found');
    });

    // Mock fs.readFile
    fs.readFile.mockImplementation(async (filePath, encoding) => {
      const file = mockFiles[filePath];
      if (file) {
        return file.content;
      }
      throw new Error('File not found');
    });

    // Mock fs.writeFile
    fs.writeFile.mockResolvedValue();

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bundle File Detection', () => {
    it('should identify bundle files correctly', () => {
      expect(bundleAnalyzer.isBundleFile('main.js')).toBe(true);
      expect(bundleAnalyzer.isBundleFile('vendor.js')).toBe(true);
      expect(bundleAnalyzer.isBundleFile('chunk-abc123.js')).toBe(true);
      expect(bundleAnalyzer.isBundleFile('app.bundle.js')).toBe(true);
      expect(bundleAnalyzer.isBundleFile('styles.css')).toBe(true);

      expect(bundleAnalyzer.isBundleFile('config.json')).toBe(false);
      expect(bundleAnalyzer.isBundleFile('README.md')).toBe(false);
      expect(bundleAnalyzer.isBundleFile('package.json')).toBe(false);
    });

    it('should find bundle files in directory', async () => {
      const files = await bundleAnalyzer.findBundleFiles('dist');

      expect(files).toContain('dist/main.js');
      expect(files).toContain('dist/vendor.js');
      expect(files).toContain('dist/chunk-abc123.js');
      expect(files).toContain('dist/styles.css');
    });
  });

  describe('Bundle Type Classification', () => {
    it('should classify bundle types correctly', () => {
      expect(bundleAnalyzer.getBundleType('dist/vendor.js')).toBe('vendor');
      expect(bundleAnalyzer.getBundleType('dist/main.js')).toBe('main');
      expect(bundleAnalyzer.getBundleType('dist/chunk-abc123.js')).toBe('chunk');
      expect(bundleAnalyzer.getBundleType('dist/styles.css')).toBe('styles');
      expect(bundleAnalyzer.getBundleType('dist/app.js')).toBe('app');
    });
  });

  describe('Module Extraction', () => {
    it('should extract ES modules from bundle content', () => {
      const content = `
        import { component } from './component.js';
        import utils from '../utils/index.js';
        export default function App() {
          return component();
        }
      `;

      const modules = bundleAnalyzer.extractModules(content);
      const esModules = modules.filter(m => m.type === 'es_module');

      expect(esModules).toHaveLength(2);
      expect(esModules.some(m => m.path === './component.js')).toBe(true);
      expect(esModules.some(m => m.path === '../utils/index.js')).toBe(true);
    });

    it('should extract imports correctly', () => {
      const content = `
        import { component } from './component.js';
        import('./lazy-component.js').then(module => {
          // Dynamic import
        });
      `;

      const imports = bundleAnalyzer.extractImports(content);

      expect(imports).toHaveLength(2);
      expect(imports[0]).toEqual({
        module: './component.js',
        statement: expect.stringContaining('import { component }'),
        dynamic: false
      });
      expect(imports[1]).toEqual({
        module: './lazy-component.js',
        statement: expect.stringContaining("import('./lazy-component.js')"),
        dynamic: true
      });
    });

    it('should extract exports correctly', () => {
      const content = `
        export const utils = {};
        export default function App() {}
        export { component } from './component.js';
      `;

      const exports = bundleAnalyzer.extractExports(content);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports.some(exp => exp.name === 'utils')).toBe(true);
    });
  });

  describe('Bundle Analysis', () => {
    it('should analyze bundles and generate results', async () => {
      const results = await bundleAnalyzer.analyzeBundles('dist');

      expect(results.bundles).toHaveLength(4);
      expect(results.totalSize).toBeGreaterThan(0);
      expect(results.gzippedSize).toBeGreaterThan(0);
      expect(results.gzippedSize).toBeLessThan(results.totalSize);
    });

    it('should detect large bundles', async () => {
      const results = await bundleAnalyzer.analyzeBundles('dist');

      const largeBundleWarning = results.optimizationOpportunities.find(
        op => op.type === 'large_bundle'
      );

      expect(largeBundleWarning).toBeDefined();
      expect(largeBundleWarning.file).toBe('vendor.js');
      expect(largeBundleWarning.severity).toBe('warning');
    });

    it('should calculate compression ratios', async () => {
      const results = await bundleAnalyzer.analyzeBundles('dist');

      results.bundles.forEach(bundle => {
        expect(bundle.gzippedSize).toBeLessThan(bundle.size);
        expect(bundle.gzippedSize).toBeGreaterThan(0);
      });
    });
  });

  describe('Dependency Analysis', () => {
    it('should analyze dependencies across bundles', async () => {
      await bundleAnalyzer.analyzeBundles('dist');

      expect(bundleAnalyzer.analysisResults.dependencies).toBeInstanceOf(Map);
      expect(bundleAnalyzer.analysisResults.dependencies.size).toBeGreaterThan(0);
    });

    it('should identify external modules', () => {
      expect(bundleAnalyzer.isExternalModule('react')).toBe(true);
      expect(bundleAnalyzer.isExternalModule('lodash')).toBe(true);
      expect(bundleAnalyzer.isExternalModule('./component.js')).toBe(false);
      expect(bundleAnalyzer.isExternalModule('/absolute/path.js')).toBe(false);
      expect(bundleAnalyzer.isExternalModule('src/utils.js')).toBe(false);
    });
  });

  describe('Tree Shaking Analysis', () => {
    beforeEach(() => {
      // Mock source files for tree shaking analysis
      const sourceFiles = {
        'src/utils.js': `
          export function usedFunction() {}
          export function unusedFunction() {}
          export const usedConstant = 'value';
          export const unusedConstant = 'unused';
        `,
        'src/component.js': `
          import { usedFunction, usedConstant } from './utils.js';
          export default function Component() {
            return usedFunction() + usedConstant;
          }
        `
      };

      // Update fs.readdir mock for source directory
      const originalReaddir = fs.readdir.getMockImplementation();
      fs.readdir.mockImplementation(async (dir) => {
        if (dir === 'src') {
          return Object.keys(sourceFiles)
            .filter(file => file.startsWith('src/'))
            .map(file => ({
              name: path.basename(file),
              isDirectory: () => false,
              isFile: () => true
            }));
        }
        return originalReaddir(dir);
      });

      // Update fs.readFile mock for source files
      const originalReadFile = fs.readFile.getMockImplementation();
      fs.readFile.mockImplementation(async (filePath, encoding) => {
        if (sourceFiles[filePath]) {
          return sourceFiles[filePath];
        }
        return originalReadFile(filePath, encoding);
      });
    });

    it('should find unused exports', async () => {
      await bundleAnalyzer.findUnusedExports();

      expect(bundleAnalyzer.analysisResults.unusedExports.length).toBeGreaterThan(0);

      const unusedExports = bundleAnalyzer.analysisResults.unusedExports;
      expect(unusedExports.some(exp => exp.export === 'unusedFunction')).toBe(true);
      expect(unusedExports.some(exp => exp.export === 'unusedConstant')).toBe(true);
    });

    it('should generate tree shaking recommendations', async () => {
      await bundleAnalyzer.findUnusedExports();
      bundleAnalyzer.generateOptimizationRecommendations();

      const treeShakingOp = bundleAnalyzer.analysisResults.optimizationOpportunities.find(
        op => op.type === 'unused_exports'
      );

      expect(treeShakingOp).toBeDefined();
      expect(treeShakingOp.severity).toBe('info');
      expect(treeShakingOp.count).toBeGreaterThan(0);
    });
  });

  describe('Duplicate Module Detection', () => {
    beforeEach(() => {
      // Mock bundles with duplicate modules
      bundleAnalyzer.analysisResults.bundles = [
        {
          name: 'main.js',
          modules: [
            { path: './shared-module.js', size: 1000 },
            { path: './unique-module.js', size: 500 }
          ]
        },
        {
          name: 'vendor.js',
          modules: [
            { path: './shared-module.js', size: 1000 },
            { path: './vendor-specific.js', size: 2000 }
          ]
        }
      ];
    });

    it('should find duplicate modules', async () => {
      await bundleAnalyzer.findDuplicateModules();

      expect(bundleAnalyzer.analysisResults.duplicateModules.length).toBeGreaterThan(0);

      const duplicate = bundleAnalyzer.analysisResults.duplicateModules.find(
        dup => dup.module === './shared-module.js'
      );

      expect(duplicate).toBeDefined();
      expect(duplicate.bundles).toContain('main.js');
      expect(duplicate.bundles).toContain('vendor.js');
      expect(duplicate.totalWastedSize).toBe(1000);
    });

    it('should generate duplicate module recommendations', async () => {
      await bundleAnalyzer.findDuplicateModules();
      bundleAnalyzer.generateOptimizationRecommendations();

      const duplicateOp = bundleAnalyzer.analysisResults.optimizationOpportunities.find(
        op => op.type === 'duplicate_modules'
      );

      expect(duplicateOp).toBeDefined();
      expect(duplicateOp.severity).toBe('warning');
      expect(duplicateOp.wastedSize).toBeGreaterThan(0);
    });
  });

  describe('Optimization Recommendations', () => {
    beforeEach(() => {
      // Set up test data for optimization recommendations
      bundleAnalyzer.analysisResults.bundles = [
        { name: 'vendor.js', type: 'vendor', size: 300000 },
        { name: 'chunk1.js', type: 'chunk', size: 5000 },
        { name: 'chunk2.js', type: 'chunk', size: 3000 },
        { name: 'chunk3.js', type: 'chunk', size: 2000 }
      ];
      bundleAnalyzer.analysisResults.totalSize = 310000;
      bundleAnalyzer.analysisResults.gzippedSize = 250000; // Poor compression ratio
    });

    it('should detect large vendor bundles', () => {
      bundleAnalyzer.generateOptimizationRecommendations();

      const largeVendorOp = bundleAnalyzer.analysisResults.optimizationOpportunities.find(
        op => op.type === 'large_vendor_bundle'
      );

      expect(largeVendorOp).toBeDefined();
      expect(largeVendorOp.severity).toBe('warning');
      expect(largeVendorOp.bundles).toContain('vendor.js');
    });

    it('should detect too many small chunks', () => {
      // Add more small chunks
      for (let i = 4; i <= 15; i++) {
        bundleAnalyzer.analysisResults.bundles.push({
          name: `chunk${i}.js`,
          type: 'chunk',
          size: 5000
        });
      }

      bundleAnalyzer.generateOptimizationRecommendations();

      const tooManyChunksOp = bundleAnalyzer.analysisResults.optimizationOpportunities.find(
        op => op.type === 'too_many_small_chunks'
      );

      expect(tooManyChunksOp).toBeDefined();
      expect(tooManyChunksOp.severity).toBe('info');
      expect(tooManyChunksOp.count).toBeGreaterThan(10);
    });

    it('should detect poor compression ratio', () => {
      bundleAnalyzer.generateOptimizationRecommendations();

      const poorCompressionOp = bundleAnalyzer.analysisResults.optimizationOpportunities.find(
        op => op.type === 'poor_compression'
      );

      expect(poorCompressionOp).toBeDefined();
      expect(poorCompressionOp.severity).toBe('info');
      expect(poorCompressionOp.ratio).toBeGreaterThan(0.7);
    });
  });

  describe('Configuration Optimization Suggestions', () => {
    beforeEach(() => {
      bundleAnalyzer.analysisResults.duplicateModules = [
        { module: 'shared.js', bundles: ['main.js', 'vendor.js'] }
      ];
      bundleAnalyzer.analysisResults.unusedExports = [
        { export: 'unusedFunction', file: 'utils.js' }
      ];
    });

    it('should suggest splitChunks configuration', () => {
      const suggestions = bundleAnalyzer.getConfigOptimizations();

      const splitChunksSuggestion = suggestions.find(s => s.type === 'splitChunks');
      expect(splitChunksSuggestion).toBeDefined();
      expect(splitChunksSuggestion.config).toHaveProperty('chunks', 'all');
      expect(splitChunksSuggestion.config).toHaveProperty('cacheGroups');
    });

    it('should suggest tree shaking configuration', () => {
      const suggestions = bundleAnalyzer.getConfigOptimizations();

      const treeShakingSuggestion = suggestions.find(s => s.type === 'treeShaking');
      expect(treeShakingSuggestion).toBeDefined();
      expect(treeShakingSuggestion.config).toHaveProperty('usedExports', true);
      expect(treeShakingSuggestion.config).toHaveProperty('sideEffects', false);
    });
  });

  describe('Report Generation', () => {
    it('should generate analysis report', async () => {
      await bundleAnalyzer.analyzeBundles('dist');
      const report = await bundleAnalyzer.generateAnalysisReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('bundles');
      expect(report).toHaveProperty('optimizations');
      expect(report).toHaveProperty('generatedAt');

      expect(report.summary.totalBundles).toBeGreaterThan(0);
      expect(report.summary.totalSize).toBeDefined();
      expect(report.summary.gzippedSize).toBeDefined();
      expect(report.summary.compressionRatio).toBeDefined();
    });

    it('should save report to file', async () => {
      await bundleAnalyzer.analyzeBundles('dist');
      await bundleAnalyzer.generateAnalysisReport();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('bundle-analysis.json'),
        expect.any(String)
      );
    });
  });

  describe('Size Formatting', () => {
    it('should format file sizes correctly', () => {
      expect(bundleAnalyzer.formatSize(1024)).toBe('1.0 KB');
      expect(bundleAnalyzer.formatSize(1048576)).toBe('1.0 MB');
      expect(bundleAnalyzer.formatSize(1073741824)).toBe('1.0 GB');
      expect(bundleAnalyzer.formatSize(512)).toBe('512.0 B');
    });
  });

  describe('Gzip Size Estimation', () => {
    it('should estimate gzipped size', async () => {
      const content = 'test content'.repeat(100);
      const gzipSize = await bundleAnalyzer.estimateGzipSize(content);

      expect(gzipSize).toBeLessThan(content.length);
      expect(gzipSize).toBeGreaterThan(0);
      expect(gzipSize).toBe(Math.floor(content.length * 0.7));
    });
  });
});