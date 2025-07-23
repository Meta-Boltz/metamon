/**
 * Bundle Analyzer
 * Analyzes bundle sizes, dependencies, and optimization effectiveness
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { performanceMonitor } from './performance-monitor.js';

/**
 * Bundle analysis result
 */
export interface BundleAnalysis {
  route: string;
  bundlePath: string;
  originalSize: number;
  compressedSize: number;
  gzipSize: number;
  compressionRatio: number;
  dependencies: DependencyInfo[];
  chunks: ChunkInfo[];
  duplicatedModules: DuplicatedModule[];
  unusedExports: UnusedExport[];
  optimizationOpportunities: OptimizationOpportunity[];
  performanceScore: number;
}

/**
 * Dependency information
 */
export interface DependencyInfo {
  name: string;
  version?: string;
  size: number;
  type: 'npm' | 'local' | 'builtin';
  path: string;
  usedExports: string[];
  unusedExports: string[];
  isTreeShakeable: boolean;
}

/**
 * Chunk information
 */
export interface ChunkInfo {
  name: string;
  size: number;
  modules: string[];
  isAsync: boolean;
  priority: 'high' | 'medium' | 'low';
  loadTime?: number;
}

/**
 * Duplicated module information
 */
export interface DuplicatedModule {
  moduleName: string;
  occurrences: number;
  totalSize: number;
  chunks: string[];
  potentialSavings: number;
}

/**
 * Unused export information
 */
export interface UnusedExport {
  modulePath: string;
  exportName: string;
  size: number;
}

/**
 * Optimization opportunity
 */
export interface OptimizationOpportunity {
  type: 'tree-shaking' | 'code-splitting' | 'compression' | 'deduplication' | 'lazy-loading';
  description: string;
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

/**
 * Bundle comparison result
 */
export interface BundleComparison {
  route: string;
  before: BundleAnalysis;
  after: BundleAnalysis;
  sizeDelta: number;
  compressionDelta: number;
  performanceDelta: number;
  improvements: string[];
  regressions: string[];
}

/**
 * Bundle size thresholds
 */
export interface BundleSizeThresholds {
  small: number;    // < 50KB
  medium: number;   // < 250KB
  large: number;    // < 500KB
  critical: number; // >= 500KB
}

/**
 * Bundle analyzer configuration
 */
export interface BundleAnalyzerConfig {
  outputDirectory: string;
  thresholds: BundleSizeThresholds;
  enableGzipAnalysis: boolean;
  enableDependencyAnalysis: boolean;
  enableDuplicationDetection: boolean;
  enableUnusedExportDetection: boolean;
  generateReports: boolean;
}

/**
 * Bundle analyzer
 */
export class BundleAnalyzer {
  private analyses = new Map<string, BundleAnalysis>();
  private comparisons: BundleComparison[] = [];

  constructor(
    private config: BundleAnalyzerConfig = {
      outputDirectory: './bundle-analysis',
      thresholds: {
        small: 50 * 1024,      // 50KB
        medium: 250 * 1024,    // 250KB
        large: 500 * 1024,     // 500KB
        critical: 1024 * 1024  // 1MB
      },
      enableGzipAnalysis: true,
      enableDependencyAnalysis: true,
      enableDuplicationDetection: true,
      enableUnusedExportDetection: true,
      generateReports: true
    }
  ) {}

  /**
   * Analyze a bundle file
   */
  async analyzeBundle(route: string, bundlePath: string): Promise<BundleAnalysis> {
    console.log(`🔍 Analyzing bundle for route: ${route}`);

    if (!existsSync(bundlePath)) {
      throw new Error(`Bundle file not found: ${bundlePath}`);
    }

    const bundleContent = readFileSync(bundlePath, 'utf-8');
    const stats = statSync(bundlePath);
    const originalSize = stats.size;

    // Calculate compressed sizes
    const compressedSize = this.calculateCompressedSize(bundleContent);
    const gzipSize = this.config.enableGzipAnalysis ? this.calculateGzipSize(bundleContent) : compressedSize;
    const compressionRatio = compressedSize / originalSize;

    // Analyze dependencies
    const dependencies = this.config.enableDependencyAnalysis 
      ? this.analyzeDependencies(bundleContent)
      : [];

    // Analyze chunks
    const chunks = this.analyzeChunks(bundleContent, bundlePath);

    // Detect duplicated modules
    const duplicatedModules = this.config.enableDuplicationDetection
      ? this.detectDuplicatedModules(bundleContent)
      : [];

    // Detect unused exports
    const unusedExports = this.config.enableUnusedExportDetection
      ? this.detectUnusedExports(bundleContent)
      : [];

    // Identify optimization opportunities
    const optimizationOpportunities = this.identifyOptimizationOpportunities(
      originalSize,
      dependencies,
      duplicatedModules,
      unusedExports
    );

    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore(
      originalSize,
      compressionRatio,
      optimizationOpportunities
    );

    const analysis: BundleAnalysis = {
      route,
      bundlePath,
      originalSize,
      compressedSize,
      gzipSize,
      compressionRatio,
      dependencies,
      chunks,
      duplicatedModules,
      unusedExports,
      optimizationOpportunities,
      performanceScore
    };

    // Store analysis
    this.analyses.set(route, analysis);

    // Track in performance monitor
    performanceMonitor.trackBundleSize(
      route,
      originalSize,
      compressedSize,
      chunks.length,
      dependencies.map(d => d.name)
    );

    // Print analysis summary
    this.printAnalysisSummary(analysis);

    return analysis;
  }

  /**
   * Calculate compressed size (simplified simulation)
   */
  private calculateCompressedSize(content: string): number {
    // Simulate minification compression
    // Remove comments, whitespace, and apply basic compression
    const minified = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '')         // Remove line comments
      .replace(/\s+/g, ' ')             // Collapse whitespace
      .trim();
    
    return Buffer.byteLength(minified, 'utf-8');
  }

  /**
   * Calculate gzip size (simplified simulation)
   */
  private calculateGzipSize(content: string): number {
    // Simulate gzip compression (typically 70-80% reduction for JS)
    const minifiedSize = this.calculateCompressedSize(content);
    return Math.floor(minifiedSize * 0.3); // Assume 70% compression
  }

  /**
   * Analyze bundle dependencies
   */
  private analyzeDependencies(bundleContent: string): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    
    // Extract import/require statements
    const importRegex = /(?:import|require)\s*\(?['"`]([^'"`]+)['"`]\)?/g;
    const matches = Array.from(bundleContent.matchAll(importRegex));
    
    const dependencyMap = new Map<string, { count: number; size: number }>();
    
    for (const match of matches) {
      const depName = match[1];
      if (!dependencyMap.has(depName)) {
        dependencyMap.set(depName, { count: 0, size: 0 });
      }
      const dep = dependencyMap.get(depName)!;
      dep.count++;
      dep.size += this.estimateModuleSize(depName, bundleContent);
    }

    for (const [name, info] of dependencyMap) {
      const type = this.getDependencyType(name);
      const isTreeShakeable = this.isTreeShakeable(name, bundleContent);
      
      dependencies.push({
        name,
        size: info.size,
        type,
        path: name,
        usedExports: this.extractUsedExports(name, bundleContent),
        unusedExports: this.extractUnusedExports(name, bundleContent),
        isTreeShakeable
      });
    }

    return dependencies.sort((a, b) => b.size - a.size);
  }

  /**
   * Estimate module size within bundle
   */
  private estimateModuleSize(moduleName: string, bundleContent: string): number {
    // Simple heuristic: count occurrences and estimate size
    const occurrences = (bundleContent.match(new RegExp(moduleName, 'g')) || []).length;
    const baseSize = moduleName.length * occurrences;
    
    // Add estimated code size based on module type
    if (moduleName.includes('react')) return baseSize + 5000;
    if (moduleName.includes('lodash')) return baseSize + 2000;
    if (moduleName.includes('moment')) return baseSize + 8000;
    if (moduleName.startsWith('./') || moduleName.startsWith('../')) return baseSize + 1000;
    
    return baseSize + 500; // Default estimate
  }

  /**
   * Determine dependency type
   */
  private getDependencyType(name: string): 'npm' | 'local' | 'builtin' {
    if (name.startsWith('./') || name.startsWith('../')) return 'local';
    if (['fs', 'path', 'http', 'https', 'crypto', 'util'].includes(name)) return 'builtin';
    return 'npm';
  }

  /**
   * Check if dependency is tree-shakeable
   */
  private isTreeShakeable(name: string, bundleContent: string): boolean {
    // Check for ES6 imports (tree-shakeable) vs require (not tree-shakeable)
    const esImportRegex = new RegExp(`import\\s+.*\\s+from\\s+['"\`]${name}['"\`]`, 'g');
    const requireRegex = new RegExp(`require\\s*\\(['"\`]${name}['"\`]\\)`, 'g');
    
    const esImports = bundleContent.match(esImportRegex) || [];
    const requires = bundleContent.match(requireRegex) || [];
    
    return esImports.length > requires.length;
  }

  /**
   * Extract used exports from a module
   */
  private extractUsedExports(moduleName: string, bundleContent: string): string[] {
    const usedExports: string[] = [];
    
    // Match named imports: import { a, b, c } from 'module'
    const namedImportRegex = new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+['"\`]${moduleName}['"\`]`, 'g');
    const matches = Array.from(bundleContent.matchAll(namedImportRegex));
    
    for (const match of matches) {
      const exports = match[1].split(',').map(e => e.trim());
      usedExports.push(...exports);
    }
    
    return [...new Set(usedExports)];
  }

  /**
   * Extract unused exports (simplified heuristic)
   */
  private extractUnusedExports(moduleName: string, bundleContent: string): string[] {
    // This would require more sophisticated analysis in a real implementation
    // For now, return empty array
    return [];
  }

  /**
   * Analyze bundle chunks
   */
  private analyzeChunks(bundleContent: string, bundlePath: string): ChunkInfo[] {
    const chunks: ChunkInfo[] = [];
    
    // Look for webpack chunk patterns
    const chunkRegex = /webpackChunkName:\s*['"`]([^'"`]+)['"`]/g;
    const chunkMatches = Array.from(bundleContent.matchAll(chunkRegex));
    
    for (const match of chunkMatches) {
      const chunkName = match[1];
      const chunkSize = this.estimateChunkSize(chunkName, bundleContent);
      
      chunks.push({
        name: chunkName,
        size: chunkSize,
        modules: this.extractChunkModules(chunkName, bundleContent),
        isAsync: this.isAsyncChunk(chunkName, bundleContent),
        priority: this.determineChunkPriority(chunkName)
      });
    }
    
    // If no chunks found, treat entire bundle as one chunk
    if (chunks.length === 0) {
      chunks.push({
        name: basename(bundlePath, extname(bundlePath)),
        size: bundleContent.length,
        modules: ['main'],
        isAsync: false,
        priority: 'high'
      });
    }
    
    return chunks;
  }

  /**
   * Estimate chunk size
   */
  private estimateChunkSize(chunkName: string, bundleContent: string): number {
    // Simple heuristic based on chunk name occurrences
    const occurrences = (bundleContent.match(new RegExp(chunkName, 'g')) || []).length;
    return Math.max(1000, occurrences * 100); // Minimum 1KB
  }

  /**
   * Extract modules in a chunk
   */
  private extractChunkModules(chunkName: string, bundleContent: string): string[] {
    // Simplified extraction - would need more sophisticated parsing
    return [chunkName];
  }

  /**
   * Check if chunk is loaded asynchronously
   */
  private isAsyncChunk(chunkName: string, bundleContent: string): boolean {
    const asyncPatterns = [
      `import\\(['"\`][^'"\`]*${chunkName}`,
      `require\\.ensure.*${chunkName}`,
      `lazy\\(.*${chunkName}`
    ];
    
    return asyncPatterns.some(pattern => 
      new RegExp(pattern).test(bundleContent)
    );
  }

  /**
   * Determine chunk priority
   */
  private determineChunkPriority(chunkName: string): 'high' | 'medium' | 'low' {
    if (chunkName.includes('vendor') || chunkName.includes('common')) return 'high';
    if (chunkName.includes('route') || chunkName.includes('page')) return 'medium';
    return 'low';
  }

  /**
   * Detect duplicated modules
   */
  private detectDuplicatedModules(bundleContent: string): DuplicatedModule[] {
    const duplicates: DuplicatedModule[] = [];
    const moduleOccurrences = new Map<string, number>();
    
    // Find module patterns
    const moduleRegex = /(?:__webpack_require__\(|require\(['"`])([^'"`\)]+)/g;
    const matches = Array.from(bundleContent.matchAll(moduleRegex));
    
    for (const match of matches) {
      const moduleName = match[1];
      moduleOccurrences.set(moduleName, (moduleOccurrences.get(moduleName) || 0) + 1);
    }
    
    for (const [moduleName, occurrences] of moduleOccurrences) {
      if (occurrences > 1) {
        const moduleSize = this.estimateModuleSize(moduleName, bundleContent);
        const totalSize = moduleSize * occurrences;
        const potentialSavings = totalSize - moduleSize;
        
        duplicates.push({
          moduleName,
          occurrences,
          totalSize,
          chunks: ['main'], // Simplified
          potentialSavings
        });
      }
    }
    
    return duplicates.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Detect unused exports
   */
  private detectUnusedExports(bundleContent: string): UnusedExport[] {
    // This would require sophisticated static analysis
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOptimizationOpportunities(
    bundleSize: number,
    dependencies: DependencyInfo[],
    duplicatedModules: DuplicatedModule[],
    unusedExports: UnusedExport[]
  ): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];
    
    // Bundle size opportunities
    if (bundleSize > this.config.thresholds.large) {
      opportunities.push({
        type: 'code-splitting',
        description: 'Bundle is large and could benefit from code splitting',
        potentialSavings: bundleSize * 0.3, // Estimate 30% reduction
        effort: 'medium',
        priority: bundleSize > this.config.thresholds.critical ? 'critical' : 'high',
        recommendation: 'Split bundle into smaller chunks based on routes or features'
      });
    }
    
    // Tree shaking opportunities
    const nonTreeShakeableDeps = dependencies.filter(d => !d.isTreeShakeable);
    if (nonTreeShakeableDeps.length > 0) {
      const potentialSavings = nonTreeShakeableDeps.reduce((sum, d) => sum + d.size * 0.2, 0);
      opportunities.push({
        type: 'tree-shaking',
        description: `${nonTreeShakeableDeps.length} dependencies could benefit from tree shaking`,
        potentialSavings,
        effort: 'low',
        priority: potentialSavings > 10000 ? 'high' : 'medium',
        recommendation: 'Convert CommonJS imports to ES6 imports where possible'
      });
    }
    
    // Deduplication opportunities
    if (duplicatedModules.length > 0) {
      const totalSavings = duplicatedModules.reduce((sum, d) => sum + d.potentialSavings, 0);
      opportunities.push({
        type: 'deduplication',
        description: `${duplicatedModules.length} modules are duplicated across chunks`,
        potentialSavings: totalSavings,
        effort: 'medium',
        priority: totalSavings > 20000 ? 'high' : 'medium',
        recommendation: 'Extract common modules into shared chunks'
      });
    }
    
    // Compression opportunities
    const compressionRatio = this.calculateCompressedSize(bundleSize.toString()) / bundleSize;
    if (compressionRatio > 0.7) {
      opportunities.push({
        type: 'compression',
        description: 'Bundle could benefit from better compression',
        potentialSavings: bundleSize * (compressionRatio - 0.3),
        effort: 'low',
        priority: 'medium',
        recommendation: 'Enable gzip compression and minification optimizations'
      });
    }
    
    // Large dependencies
    const largeDeps = dependencies.filter(d => d.size > 50000); // > 50KB
    if (largeDeps.length > 0) {
      opportunities.push({
        type: 'lazy-loading',
        description: `${largeDeps.length} large dependencies could be lazy loaded`,
        potentialSavings: largeDeps.reduce((sum, d) => sum + d.size * 0.8, 0),
        effort: 'high',
        priority: 'medium',
        recommendation: 'Implement lazy loading for large dependencies'
      });
    }
    
    return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(
    bundleSize: number,
    compressionRatio: number,
    opportunities: OptimizationOpportunity[]
  ): number {
    let score = 100;
    
    // Penalize large bundle sizes
    if (bundleSize > this.config.thresholds.critical) {
      score -= 40;
    } else if (bundleSize > this.config.thresholds.large) {
      score -= 25;
    } else if (bundleSize > this.config.thresholds.medium) {
      score -= 10;
    }
    
    // Penalize poor compression
    if (compressionRatio > 0.8) {
      score -= 15;
    } else if (compressionRatio > 0.6) {
      score -= 5;
    }
    
    // Penalize optimization opportunities
    const criticalOpportunities = opportunities.filter(o => o.priority === 'critical').length;
    const highOpportunities = opportunities.filter(o => o.priority === 'high').length;
    
    score -= criticalOpportunities * 20;
    score -= highOpportunities * 10;
    
    return Math.max(0, score);
  }

  /**
   * Compare two bundle analyses
   */
  compareBundles(routeBefore: string, routeAfter: string): BundleComparison | null {
    const before = this.analyses.get(routeBefore);
    const after = this.analyses.get(routeAfter);
    
    if (!before || !after) {
      return null;
    }
    
    const sizeDelta = after.originalSize - before.originalSize;
    const compressionDelta = after.compressionRatio - before.compressionRatio;
    const performanceDelta = after.performanceScore - before.performanceScore;
    
    const improvements: string[] = [];
    const regressions: string[] = [];
    
    if (sizeDelta < 0) {
      improvements.push(`Bundle size reduced by ${Math.abs(sizeDelta)} bytes`);
    } else if (sizeDelta > 0) {
      regressions.push(`Bundle size increased by ${sizeDelta} bytes`);
    }
    
    if (compressionDelta > 0) {
      improvements.push(`Compression ratio improved by ${(compressionDelta * 100).toFixed(1)}%`);
    } else if (compressionDelta < 0) {
      regressions.push(`Compression ratio decreased by ${(Math.abs(compressionDelta) * 100).toFixed(1)}%`);
    }
    
    if (performanceDelta > 0) {
      improvements.push(`Performance score improved by ${performanceDelta.toFixed(1)} points`);
    } else if (performanceDelta < 0) {
      regressions.push(`Performance score decreased by ${Math.abs(performanceDelta).toFixed(1)} points`);
    }
    
    const comparison: BundleComparison = {
      route: routeAfter,
      before,
      after,
      sizeDelta,
      compressionDelta,
      performanceDelta,
      improvements,
      regressions
    };
    
    this.comparisons.push(comparison);
    return comparison;
  }

  /**
   * Print analysis summary
   */
  private printAnalysisSummary(analysis: BundleAnalysis): void {
    console.log(`\n📦 Bundle Analysis: ${analysis.route}`);
    console.log('='.repeat(50));
    console.log(`Original Size: ${(analysis.originalSize / 1024).toFixed(1)}KB`);
    console.log(`Compressed Size: ${(analysis.compressedSize / 1024).toFixed(1)}KB`);
    if (analysis.gzipSize !== analysis.compressedSize) {
      console.log(`Gzip Size: ${(analysis.gzipSize / 1024).toFixed(1)}KB`);
    }
    console.log(`Compression Ratio: ${(analysis.compressionRatio * 100).toFixed(1)}%`);
    console.log(`Performance Score: ${analysis.performanceScore.toFixed(1)}/100`);
    
    if (analysis.dependencies.length > 0) {
      console.log(`\n📚 Top Dependencies:`);
      analysis.dependencies.slice(0, 5).forEach(dep => {
        console.log(`  ${dep.name}: ${(dep.size / 1024).toFixed(1)}KB (${dep.type})`);
      });
    }
    
    if (analysis.duplicatedModules.length > 0) {
      console.log(`\n🔄 Duplicated Modules:`);
      analysis.duplicatedModules.slice(0, 3).forEach(dup => {
        console.log(`  ${dup.moduleName}: ${dup.occurrences}x (${(dup.potentialSavings / 1024).toFixed(1)}KB savings)`);
      });
    }
    
    if (analysis.optimizationOpportunities.length > 0) {
      console.log(`\n💡 Top Optimization Opportunities:`);
      analysis.optimizationOpportunities.slice(0, 3).forEach(opp => {
        console.log(`  ${opp.type}: ${(opp.potentialSavings / 1024).toFixed(1)}KB potential savings`);
        console.log(`    ${opp.recommendation}`);
      });
    }
    
    console.log('');
  }

  /**
   * Get analysis for a route
   */
  getAnalysis(route: string): BundleAnalysis | undefined {
    return this.analyses.get(route);
  }

  /**
   * Get all analyses
   */
  getAllAnalyses(): BundleAnalysis[] {
    return Array.from(this.analyses.values());
  }

  /**
   * Get bundle comparisons
   */
  getComparisons(): BundleComparison[] {
    return [...this.comparisons];
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport(): {
    totalBundles: number;
    totalSize: number;
    averageScore: number;
    topOpportunities: OptimizationOpportunity[];
    recommendations: string[];
  } {
    const analyses = this.getAllAnalyses();
    
    if (analyses.length === 0) {
      return {
        totalBundles: 0,
        totalSize: 0,
        averageScore: 0,
        topOpportunities: [],
        recommendations: []
      };
    }
    
    const totalSize = analyses.reduce((sum, a) => sum + a.originalSize, 0);
    const averageScore = analyses.reduce((sum, a) => sum + a.performanceScore, 0) / analyses.length;
    
    // Collect all optimization opportunities
    const allOpportunities: OptimizationOpportunity[] = [];
    for (const analysis of analyses) {
      allOpportunities.push(...analysis.optimizationOpportunities);
    }
    
    // Get top opportunities by potential savings
    const topOpportunities = allOpportunities
      .sort((a, b) => b.potentialSavings - a.potentialSavings)
      .slice(0, 10);
    
    // Generate recommendations
    const recommendations = this.generateGlobalRecommendations(analyses, topOpportunities);
    
    return {
      totalBundles: analyses.length,
      totalSize,
      averageScore,
      topOpportunities,
      recommendations
    };
  }

  /**
   * Generate global recommendations
   */
  private generateGlobalRecommendations(
    analyses: BundleAnalysis[],
    opportunities: OptimizationOpportunity[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Bundle size recommendations
    const largeBundles = analyses.filter(a => a.originalSize > this.config.thresholds.large);
    if (largeBundles.length > 0) {
      recommendations.push(`${largeBundles.length} bundles are larger than recommended. Consider code splitting.`);
    }
    
    // Compression recommendations
    const poorCompression = analyses.filter(a => a.compressionRatio > 0.7);
    if (poorCompression.length > 0) {
      recommendations.push(`${poorCompression.length} bundles have poor compression. Enable minification and gzip.`);
    }
    
    // Duplication recommendations
    const duplicatedModules = analyses.reduce((sum, a) => sum + a.duplicatedModules.length, 0);
    if (duplicatedModules > 0) {
      recommendations.push(`${duplicatedModules} duplicated modules found. Extract common dependencies.`);
    }
    
    // Performance score recommendations
    const lowScoreBundles = analyses.filter(a => a.performanceScore < 70);
    if (lowScoreBundles.length > 0) {
      recommendations.push(`${lowScoreBundles.length} bundles have low performance scores. Review optimization opportunities.`);
    }
    
    return recommendations;
  }

  /**
   * Reset all analyses
   */
  reset(): void {
    this.analyses.clear();
    this.comparisons = [];
  }
}

/**
 * Singleton bundle analyzer
 */
export const bundleAnalyzer = new BundleAnalyzer();