/**
 * Bundle Analyzer for Ultra-Modern MTM
 * Analyzes bundle sizes, identifies optimization opportunities, and enables tree shaking
 */

import fs from 'fs/promises';
import path from 'path';

export class BundleAnalyzer {
  constructor(options = {}) {
    this.options = {
      outputDir: 'dist',
      analyzeDir: 'src',
      generateReport: true,
      enableTreeShaking: true,
      chunkSizeLimit: 250000, // 250KB
      assetSizeLimit: 100000,  // 100KB
      ...options
    };

    this.analysisResults = {
      bundles: [],
      chunks: [],
      assets: [],
      dependencies: new Map(),
      unusedExports: [],
      duplicateModules: [],
      optimizationOpportunities: [],
      totalSize: 0,
      gzippedSize: 0
    };
  }

  /**
   * Analyze the bundle and generate optimization recommendations
   */
  async analyzeBundles(buildDir = this.options.outputDir) {
    console.log('📊 Analyzing bundle composition...');

    try {
      const bundleFiles = await this.findBundleFiles(buildDir);

      for (const file of bundleFiles) {
        await this.analyzeBundle(file);
      }

      await this.analyzeDependencies();
      await this.findUnusedExports();
      await this.findDuplicateModules();
      this.generateOptimizationRecommendations();

      if (this.options.generateReport) {
        await this.generateAnalysisReport();
      }

      console.log(`✅ Bundle analysis complete. Total size: ${this.formatSize(this.analysisResults.totalSize)}`);
      return this.analysisResults;

    } catch (error) {
      console.error('❌ Bundle analysis failed:', error);
      throw error;
    }
  }

  /**
   * Find all bundle files in the build directory
   */
  async findBundleFiles(buildDir) {
    const files = [];

    try {
      const entries = await fs.readdir(buildDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(buildDir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.findBundleFiles(fullPath);
          files.push(...subFiles);
        } else if (this.isBundleFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${buildDir}:`, error.message);
    }

    return files;
  }

  /**
   * Check if a file is a bundle file
   */
  isBundleFile(filename) {
    const bundleExtensions = ['.js', '.mjs', '.css'];
    const bundlePatterns = [
      /^index\./,
      /^main\./,
      /^app\./,
      /^chunk-/,
      /^vendor\./,
      /\.chunk\./,
      /-[a-f0-9]{8,}\./  // Hash pattern
    ];

    const hasValidExtension = bundleExtensions.some(ext => filename.endsWith(ext));
    const matchesPattern = bundlePatterns.some(pattern => pattern.test(filename));

    return hasValidExtension && (matchesPattern || filename.includes('bundle'));
  }

  /**
   * Analyze a single bundle file
   */
  async analyzeBundle(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');

      const bundleInfo = {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        gzippedSize: await this.estimateGzipSize(content),
        type: this.getBundleType(filePath),
        modules: this.extractModules(content),
        imports: this.extractImports(content),
        exports: this.extractExports(content),
        chunks: this.extractChunkInfo(content),
        lastModified: stats.mtime
      };

      this.analysisResults.bundles.push(bundleInfo);
      this.analysisResults.totalSize += bundleInfo.size;
      this.analysisResults.gzippedSize += bundleInfo.gzippedSize;

      // Check for size warnings
      if (bundleInfo.size > this.options.chunkSizeLimit) {
        this.analysisResults.optimizationOpportunities.push({
          type: 'large_bundle',
          severity: 'warning',
          file: bundleInfo.name,
          size: bundleInfo.size,
          recommendation: `Bundle ${bundleInfo.name} is ${this.formatSize(bundleInfo.size)}. Consider code splitting.`
        });
      }

    } catch (error) {
      console.warn(`Warning: Could not analyze bundle ${filePath}:`, error.message);
    }
  }

  /**
   * Determine bundle type from file path and content
   */
  getBundleType(filePath) {
    const filename = path.basename(filePath);

    if (filename.includes('vendor') || filename.includes('node_modules')) {
      return 'vendor';
    } else if (filename.includes('chunk')) {
      return 'chunk';
    } else if (filename.includes('main') || filename.includes('index')) {
      return 'main';
    } else if (filePath.endsWith('.css')) {
      return 'styles';
    } else {
      return 'app';
    }
  }

  /**
   * Extract module information from bundle content
   */
  extractModules(content) {
    const modules = [];

    // Look for webpack-style module definitions
    const webpackModuleRegex = /\/\*\*\*\/ \(function\(module, exports, __webpack_require__\) \{[\s\S]*?\n\/\*\*\*\/ \}\),?/g;
    let match;

    while ((match = webpackModuleRegex.exec(content)) !== null) {
      modules.push({
        content: match[0],
        size: match[0].length,
        id: modules.length
      });
    }

    // Look for ES modules
    const esModuleRegex = /(?:import|export)[\s\S]*?from\s+['"`]([^'"`]+)['"`]/g;
    const esModules = new Set();

    while ((match = esModuleRegex.exec(content)) !== null) {
      esModules.add(match[1]);
    }

    // Add ES modules to the list
    esModules.forEach(modulePath => {
      modules.push({
        path: modulePath,
        type: 'es_module',
        size: 0 // Size not easily determinable from bundle
      });
    });

    return modules;
  }

  /**
   * Extract import statements from bundle
   */
  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        module: match[1],
        statement: match[0],
        dynamic: false
      });
    }

    // Look for dynamic imports
    const dynamicImportRegex = /import\(['"`]([^'"`]+)['"`]\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push({
        module: match[1],
        statement: match[0],
        dynamic: true
      });
    }

    return imports;
  }

  /**
   * Extract export statements from bundle
   */
  extractExports(content) {
    const exports = [];
    const exportRegex = /export\s+(?:default\s+)?(?:(?:const|let|var|function|class)\s+(\w+)|(?:\{[^}]*\})|(?:\*\s+from\s+['"`][^'"`]+['"`]))/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push({
        name: match[1] || 'anonymous',
        statement: match[0],
        type: match[0].includes('default') ? 'default' : 'named'
      });
    }

    return exports;
  }

  /**
   * Extract chunk information from bundle
   */
  extractChunkInfo(content) {
    const chunks = [];

    // Look for webpack chunk loading code
    const chunkRegex = /__webpack_require__\.e\((\d+)\)/g;
    let match;

    while ((match = chunkRegex.exec(content)) !== null) {
      chunks.push({
        id: match[1],
        type: 'async'
      });
    }

    return chunks;
  }

  /**
   * Analyze dependencies across bundles
   */
  async analyzeDependencies() {
    console.log('🔍 Analyzing dependencies...');

    const allDependencies = new Map();

    this.analysisResults.bundles.forEach(bundle => {
      bundle.imports.forEach(imp => {
        if (!allDependencies.has(imp.module)) {
          allDependencies.set(imp.module, {
            module: imp.module,
            usedBy: [],
            isDynamic: false,
            isExternal: this.isExternalModule(imp.module)
          });
        }

        const dep = allDependencies.get(imp.module);
        dep.usedBy.push(bundle.name);
        if (imp.dynamic) {
          dep.isDynamic = true;
        }
      });
    });

    this.analysisResults.dependencies = allDependencies;
  }

  /**
   * Find unused exports that can be tree-shaken
   */
  async findUnusedExports() {
    if (!this.options.enableTreeShaking) return;

    console.log('🌳 Analyzing for tree shaking opportunities...');

    try {
      const sourceFiles = await this.findSourceFiles();
      const unusedExports = [];

      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const exports = this.extractExports(content);

        for (const exp of exports) {
          const isUsed = await this.isExportUsed(exp.name, file);
          if (!isUsed) {
            unusedExports.push({
              file,
              export: exp.name,
              type: exp.type,
              statement: exp.statement
            });
          }
        }
      }

      this.analysisResults.unusedExports = unusedExports;

      if (unusedExports.length > 0) {
        this.analysisResults.optimizationOpportunities.push({
          type: 'unused_exports',
          severity: 'info',
          count: unusedExports.length,
          recommendation: `Found ${unusedExports.length} unused exports that can be removed for better tree shaking.`
        });
      }

    } catch (error) {
      console.warn('Warning: Could not analyze unused exports:', error.message);
    }
  }

  /**
   * Find source files for analysis
   */
  async findSourceFiles() {
    const files = [];

    const scanDir = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.ts'))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore directories we can't read
      }
    };

    await scanDir(this.options.analyzeDir);
    return files;
  }

  /**
   * Check if an export is used anywhere
   */
  async isExportUsed(exportName, sourceFile) {
    // This is a simplified check - in a real implementation,
    // you'd want to do more sophisticated static analysis
    try {
      const sourceFiles = await this.findSourceFiles();

      for (const file of sourceFiles) {
        if (file === sourceFile) continue;

        const content = await fs.readFile(file, 'utf-8');

        // Look for imports of this export
        const importRegex = new RegExp(`import\\s+(?:\\{[^}]*\\b${exportName}\\b[^}]*\\}|${exportName})\\s+from`, 'g');
        if (importRegex.test(content)) {
          return true;
        }

        // Look for direct usage
        const usageRegex = new RegExp(`\\b${exportName}\\b`, 'g');
        if (usageRegex.test(content)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      // If we can't determine usage, assume it's used to be safe
      return true;
    }
  }

  /**
   * Find duplicate modules across bundles
   */
  async findDuplicateModules() {
    console.log('🔍 Finding duplicate modules...');

    const moduleMap = new Map();

    this.analysisResults.bundles.forEach(bundle => {
      bundle.modules.forEach(module => {
        if (module.path) {
          if (!moduleMap.has(module.path)) {
            moduleMap.set(module.path, []);
          }
          moduleMap.get(module.path).push({
            bundle: bundle.name,
            size: module.size
          });
        }
      });
    });

    const duplicates = [];
    moduleMap.forEach((bundles, modulePath) => {
      if (bundles.length > 1) {
        duplicates.push({
          module: modulePath,
          bundles: bundles.map(b => b.bundle),
          totalWastedSize: bundles.slice(1).reduce((sum, b) => sum + b.size, 0)
        });
      }
    });

    this.analysisResults.duplicateModules = duplicates;

    if (duplicates.length > 0) {
      const totalWasted = duplicates.reduce((sum, dup) => sum + dup.totalWastedSize, 0);
      this.analysisResults.optimizationOpportunities.push({
        type: 'duplicate_modules',
        severity: 'warning',
        count: duplicates.length,
        wastedSize: totalWasted,
        recommendation: `Found ${duplicates.length} duplicate modules wasting ${this.formatSize(totalWasted)}. Consider better code splitting.`
      });
    }
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations() {
    console.log('💡 Generating optimization recommendations...');

    // Check for large vendor bundles
    const vendorBundles = this.analysisResults.bundles.filter(b => b.type === 'vendor');
    const largeVendorBundles = vendorBundles.filter(b => b.size > this.options.chunkSizeLimit);

    if (largeVendorBundles.length > 0) {
      this.analysisResults.optimizationOpportunities.push({
        type: 'large_vendor_bundle',
        severity: 'warning',
        bundles: largeVendorBundles.map(b => b.name),
        recommendation: 'Consider splitting large vendor bundles into smaller chunks for better caching.'
      });
    }

    // Check for too many small chunks
    const smallChunks = this.analysisResults.bundles.filter(b => b.size < 10000 && b.type === 'chunk');
    if (smallChunks.length > 10) {
      this.analysisResults.optimizationOpportunities.push({
        type: 'too_many_small_chunks',
        severity: 'info',
        count: smallChunks.length,
        recommendation: `You have ${smallChunks.length} small chunks. Consider combining some for fewer HTTP requests.`
      });
    }

    // Check compression ratio
    const compressionRatio = this.analysisResults.gzippedSize / this.analysisResults.totalSize;
    if (compressionRatio > 0.7) {
      this.analysisResults.optimizationOpportunities.push({
        type: 'poor_compression',
        severity: 'info',
        ratio: compressionRatio,
        recommendation: 'Poor compression ratio detected. Consider minification and removing unused code.'
      });
    }
  }

  /**
   * Check if a module is external (from node_modules)
   */
  isExternalModule(modulePath) {
    return !modulePath.startsWith('.') && !modulePath.startsWith('/') && !modulePath.includes('src/');
  }

  /**
   * Estimate gzipped size of content
   */
  async estimateGzipSize(content) {
    // Simple estimation - actual gzip would be more accurate
    // This is roughly 70% of original size for typical JS content
    return Math.floor(content.length * 0.7);
  }

  /**
   * Format file size for display
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Generate analysis report
   */
  async generateAnalysisReport() {
    const report = {
      summary: {
        totalBundles: this.analysisResults.bundles.length,
        totalSize: this.formatSize(this.analysisResults.totalSize),
        gzippedSize: this.formatSize(this.analysisResults.gzippedSize),
        compressionRatio: (this.analysisResults.gzippedSize / this.analysisResults.totalSize * 100).toFixed(1) + '%',
        optimizationOpportunities: this.analysisResults.optimizationOpportunities.length
      },
      bundles: this.analysisResults.bundles.map(bundle => ({
        name: bundle.name,
        type: bundle.type,
        size: this.formatSize(bundle.size),
        gzippedSize: this.formatSize(bundle.gzippedSize),
        modules: bundle.modules.length,
        imports: bundle.imports.length,
        exports: bundle.exports.length
      })),
      optimizations: this.analysisResults.optimizationOpportunities,
      unusedExports: this.analysisResults.unusedExports.slice(0, 20), // Top 20
      duplicateModules: this.analysisResults.duplicateModules.slice(0, 10), // Top 10
      generatedAt: new Date().toISOString()
    };

    try {
      const reportPath = path.join(this.options.outputDir, 'bundle-analysis.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Bundle analysis report saved to ${reportPath}`);
    } catch (error) {
      console.warn('Warning: Could not save bundle analysis report:', error.message);
    }

    return report;
  }

  /**
   * Get optimization suggestions for webpack/vite config
   */
  getConfigOptimizations() {
    const suggestions = [];

    // Suggest splitChunks configuration
    if (this.analysisResults.duplicateModules.length > 0) {
      suggestions.push({
        type: 'splitChunks',
        config: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5
            }
          }
        },
        reason: 'Reduce duplicate modules across bundles'
      });
    }

    // Suggest tree shaking configuration
    if (this.analysisResults.unusedExports.length > 0) {
      suggestions.push({
        type: 'treeShaking',
        config: {
          usedExports: true,
          sideEffects: false
        },
        reason: 'Remove unused exports to reduce bundle size'
      });
    }

    return suggestions;
  }
}

export function createBundleAnalyzer(options = {}) {
  return new BundleAnalyzer(options);
}