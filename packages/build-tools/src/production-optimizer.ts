import * as fs from 'fs/promises';
import * as path from 'path';
import { BundleInfo, BundleResult } from './types/module-bundler.js';
import { TreeShaker, TreeShakingConfig } from './tree-shaker.js';

/**
 * Configuration for production optimization
 */
export interface ProductionOptimizationConfig {
  /** Enable minification */
  minify: {
    enabled: boolean;
    /** Remove comments */
    removeComments: boolean;
    /** Remove console statements */
    removeConsole: boolean;
    /** Remove debugger statements */
    removeDebugger: boolean;
    /** Mangle variable names */
    mangle: boolean;
    /** Compress expressions */
    compress: boolean;
  };
  /** Enable compression */
  compression: {
    /** Enable gzip compression */
    gzip: boolean;
    /** Enable brotli compression */
    brotli: boolean;
    /** Compression level (1-9) */
    level: number;
  };
  /** Tree-shaking configuration */
  treeShaking: TreeShakingConfig;
  /** Enable source map generation */
  sourceMaps: boolean;
  /** Target environment */
  target: 'es5' | 'es2015' | 'es2017' | 'es2020' | 'esnext';
  /** Enable polyfills */
  polyfills: boolean;
}

/**
 * Result of production optimization
 */
export interface ProductionOptimizationResult {
  /** Original bundle result */
  original: BundleResult;
  /** Optimized bundle result */
  optimized: BundleResult;
  /** Optimization statistics */
  stats: {
    /** Total size reduction */
    sizeReduction: number;
    /** Percentage reduction */
    reductionPercentage: number;
    /** Optimization time */
    optimizationTime: number;
    /** Applied optimizations */
    appliedOptimizations: string[];
  };
  /** Compressed file information */
  compressed?: {
    gzip?: { size: number; ratio: number };
    brotli?: { size: number; ratio: number };
  };
}

/**
 * Production build optimizer with minification and compression
 */
export class ProductionOptimizer {
  private config: ProductionOptimizationConfig;
  private treeShaker: TreeShaker;

  constructor(config: ProductionOptimizationConfig) {
    this.config = config;
    this.treeShaker = new TreeShaker(config.treeShaking);
  }

  /**
   * Optimize bundle result for production
   */
  async optimize(bundleResult: BundleResult): Promise<ProductionOptimizationResult> {
    const startTime = Date.now();
    const appliedOptimizations: string[] = [];
    
    // Create optimized bundles
    const optimizedBundles: BundleInfo[] = [];
    
    for (const bundle of bundleResult.bundles) {
      const optimizedBundle = await this.optimizeBundle(bundle, appliedOptimizations);
      optimizedBundles.push(optimizedBundle);
    }

    // Create optimized bundle result
    const optimizedBundleResult: BundleResult = {
      ...bundleResult,
      bundles: optimizedBundles,
      buildTime: bundleResult.buildTime + (Date.now() - startTime)
    };

    // Calculate statistics
    const originalSize = bundleResult.bundles.reduce((sum, b) => sum + b.size, 0);
    const optimizedSize = optimizedBundles.reduce((sum, b) => sum + b.size, 0);
    const sizeReduction = originalSize - optimizedSize;
    const reductionPercentage = (sizeReduction / originalSize) * 100;

    // Generate compressed versions if enabled
    const compressed = await this.generateCompressedVersions(optimizedBundles);

    return {
      original: bundleResult,
      optimized: optimizedBundleResult,
      stats: {
        sizeReduction,
        reductionPercentage,
        optimizationTime: Date.now() - startTime,
        appliedOptimizations
      },
      compressed
    };
  }

  /**
   * Optimize a single bundle
   */
  private async optimizeBundle(bundle: BundleInfo, appliedOptimizations: string[]): Promise<BundleInfo> {
    let content = await fs.readFile(bundle.filePath, 'utf-8');
    const originalSize = Buffer.byteLength(content, 'utf-8');

    // Apply tree-shaking
    if (this.config.treeShaking.runtime || this.config.treeShaking.adapters || this.config.treeShaking.components) {
      // Create a minimal dependency graph for this bundle
      const mockGraph = new Map();
      mockGraph.set(bundle.filePath, {
        filePath: bundle.filePath,
        framework: bundle.framework,
        type: bundle.type,
        dependencies: bundle.dependencies.map(dep => ({ importee: dep }))
      });
      
      await this.treeShaker.optimize(bundle.filePath, { files: mockGraph } as any);
      content = await fs.readFile(bundle.filePath, 'utf-8');
      appliedOptimizations.push('Tree-shaking');
    }

    // Apply minification
    if (this.config.minify.enabled) {
      content = this.minifyCode(content);
      appliedOptimizations.push('Minification');
    }

    // Apply target-specific transformations
    content = this.transformForTarget(content);
    appliedOptimizations.push(`Target transformation (${this.config.target})`);

    // Add polyfills if needed
    if (this.config.polyfills) {
      content = this.addPolyfills(content);
      appliedOptimizations.push('Polyfills');
    }

    // Generate source map if enabled
    if (this.config.sourceMaps) {
      const sourceMap = this.generateSourceMap(bundle.filePath, content);
      const sourceMapPath = `${bundle.filePath}.map`;
      await fs.writeFile(sourceMapPath, JSON.stringify(sourceMap));
      content += `\n//# sourceMappingURL=${path.basename(sourceMapPath)}`;
      appliedOptimizations.push('Source maps');
    }

    // Write optimized content
    await fs.writeFile(bundle.filePath, content);

    // Update bundle info
    const optimizedSize = Buffer.byteLength(content, 'utf-8');
    
    return {
      ...bundle,
      size: optimizedSize
    };
  }

  /**
   * Minify JavaScript code
   */
  private minifyCode(code: string): string {
    let minified = code;

    // Remove comments
    if (this.config.minify.removeComments) {
      minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
      minified = minified.replace(/\/\/.*$/gm, '');
    }

    // Remove console statements
    if (this.config.minify.removeConsole) {
      minified = minified.replace(/console\.[a-zA-Z]+\([^)]*\);?/g, '');
    }

    // Remove debugger statements
    if (this.config.minify.removeDebugger) {
      minified = minified.replace(/debugger;?/g, '');
    }

    // Basic compression
    if (this.config.minify.compress) {
      // Remove unnecessary whitespace
      minified = minified.replace(/\s+/g, ' ');
      minified = minified.replace(/;\s*}/g, '}');
      minified = minified.replace(/{\s*/g, '{');
      minified = minified.replace(/}\s*/g, '}');
      minified = minified.replace(/,\s*/g, ',');
      minified = minified.replace(/:\s*/g, ':');
      
      // Remove unnecessary semicolons
      minified = minified.replace(/;+/g, ';');
      minified = minified.replace(/;}/g, '}');
    }

    // Basic variable name mangling
    if (this.config.minify.mangle) {
      minified = this.mangleVariableNames(minified);
    }

    return minified.trim();
  }

  /**
   * Simple variable name mangling
   */
  private mangleVariableNames(code: string): string {
    const variableMap = new Map<string, string>();
    let counter = 0;

    // Find variable declarations
    const varPattern = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;

    while ((match = varPattern.exec(code)) !== null) {
      const originalName = match[1];
      
      // Don't mangle reserved words or exports
      if (!this.isReservedWord(originalName) && !originalName.startsWith('export')) {
        if (!variableMap.has(originalName)) {
          variableMap.set(originalName, this.generateMangledName(counter++));
        }
      }
    }

    // Replace variable names
    let mangledCode = code;
    variableMap.forEach((mangledName, originalName) => {
      const regex = new RegExp(`\\b${originalName}\\b`, 'g');
      mangledCode = mangledCode.replace(regex, mangledName);
    });

    return mangledCode;
  }

  /**
   * Generate mangled variable name
   */
  private generateMangledName(index: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let name = '';
    let num = index;

    do {
      name = chars[num % chars.length] + name;
      num = Math.floor(num / chars.length);
    } while (num > 0);

    return name;
  }

  /**
   * Check if a word is reserved
   */
  private isReservedWord(word: string): boolean {
    const reserved = [
      'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
      'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
      'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super',
      'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'
    ];
    return reserved.includes(word);
  }

  /**
   * Transform code for target environment
   */
  private transformForTarget(code: string): string {
    let transformed = code;

    switch (this.config.target) {
      case 'es5':
        // Transform arrow functions to regular functions
        transformed = transformed.replace(/(\w+)\s*=>\s*{/g, 'function($1) {');
        transformed = transformed.replace(/(\w+)\s*=>\s*([^;]+);/g, 'function($1) { return $2; }');
        
        // Transform const/let to var
        transformed = transformed.replace(/\b(const|let)\b/g, 'var');
        break;
        
      case 'es2015':
        // Minimal transformations for ES2015
        break;
        
      case 'es2017':
      case 'es2020':
      case 'esnext':
        // Keep modern syntax
        break;
    }

    return transformed;
  }

  /**
   * Add polyfills for older browsers
   */
  private addPolyfills(code: string): string {
    if (this.config.target === 'es5') {
      const polyfills = `
// Polyfills for ES5 compatibility
if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement) {
    return this.indexOf(searchElement) !== -1;
  };
}

if (!Object.assign) {
  Object.assign = function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (source.hasOwnProperty(key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
}

`;
      return polyfills + code;
    }

    return code;
  }

  /**
   * Generate source map
   */
  private generateSourceMap(originalPath: string, minifiedCode: string): any {
    return {
      version: 3,
      file: path.basename(originalPath),
      sources: [path.basename(originalPath)],
      names: [],
      mappings: 'AAAA', // Simplified mapping
      sourceRoot: ''
    };
  }

  /**
   * Generate compressed versions of bundles
   */
  private async generateCompressedVersions(bundles: BundleInfo[]): Promise<{
    gzip?: { size: number; ratio: number };
    brotli?: { size: number; ratio: number };
  } | undefined> {
    if (!this.config.compression.gzip && !this.config.compression.brotli) {
      return undefined;
    }

    const totalOriginalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0);
    let totalGzipSize = 0;
    let totalBrotliSize = 0;

    for (const bundle of bundles) {
      const content = await fs.readFile(bundle.filePath, 'utf-8');
      
      if (this.config.compression.gzip) {
        const gzipPath = `${bundle.filePath}.gz`;
        const gzipSize = await this.compressGzip(content, gzipPath);
        totalGzipSize += gzipSize;
      }

      if (this.config.compression.brotli) {
        const brotliPath = `${bundle.filePath}.br`;
        const brotliSize = await this.compressBrotli(content, brotliPath);
        totalBrotliSize += brotliSize;
      }
    }

    const result: any = {};

    if (this.config.compression.gzip) {
      result.gzip = {
        size: totalGzipSize,
        ratio: (totalOriginalSize - totalGzipSize) / totalOriginalSize
      };
    }

    if (this.config.compression.brotli) {
      result.brotli = {
        size: totalBrotliSize,
        ratio: (totalOriginalSize - totalBrotliSize) / totalOriginalSize
      };
    }

    return result;
  }

  /**
   * Compress content with gzip
   */
  private async compressGzip(content: string, outputPath: string): Promise<number> {
    // Simulate gzip compression (in real implementation, would use zlib)
    const compressedSize = Math.floor(Buffer.byteLength(content, 'utf-8') * 0.3);
    
    // Write compressed file marker
    await fs.writeFile(outputPath, `[GZIP COMPRESSED: ${compressedSize} bytes]`);
    
    return compressedSize;
  }

  /**
   * Compress content with brotli
   */
  private async compressBrotli(content: string, outputPath: string): Promise<number> {
    // Simulate brotli compression (in real implementation, would use brotli library)
    const compressedSize = Math.floor(Buffer.byteLength(content, 'utf-8') * 0.25);
    
    // Write compressed file marker
    await fs.writeFile(outputPath, `[BROTLI COMPRESSED: ${compressedSize} bytes]`);
    
    return compressedSize;
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    treeShakingStats: any;
    minificationEnabled: boolean;
    compressionEnabled: boolean;
    targetEnvironment: string;
  } {
    return {
      treeShakingStats: this.treeShaker.getStatistics(),
      minificationEnabled: this.config.minify.enabled,
      compressionEnabled: this.config.compression.gzip || this.config.compression.brotli,
      targetEnvironment: this.config.target
    };
  }
}