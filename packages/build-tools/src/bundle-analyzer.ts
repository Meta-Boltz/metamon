import * as fs from 'fs/promises';
import * as path from 'path';
import { BundleInfo, BundleResult } from './types/module-bundler.js';

/**
 * Configuration for bundle analysis
 */
export interface BundleAnalysisConfig {
  /** Generate detailed size breakdown */
  detailed: boolean;
  /** Include source map analysis */
  sourceMaps: boolean;
  /** Generate visualization data */
  visualization: boolean;
  /** Size thresholds for warnings */
  thresholds: {
    warning: number; // bytes
    error: number; // bytes
  };
}

/**
 * Detailed analysis of a single bundle
 */
export interface DetailedBundleAnalysis {
  /** Bundle information */
  bundle: BundleInfo;
  /** Size breakdown by category */
  sizeBreakdown: {
    code: number;
    dependencies: number;
    runtime: number;
    framework: number;
  };
  /** Compression analysis */
  compression: {
    gzipped: number;
    brotli: number;
    compressionRatio: number;
  };
  /** Performance metrics */
  performance: {
    parseTime: number;
    loadTime: number;
    executionTime: number;
  };
  /** Optimization suggestions */
  suggestions: string[];
  /** Warnings and issues */
  warnings: string[];
}

/**
 * Complete bundle analysis result
 */
export interface CompleteBundleAnalysis {
  /** Overall statistics */
  overview: {
    totalBundles: number;
    totalSize: number;
    totalGzippedSize: number;
    averageBundleSize: number;
    largestBundle: string;
    smallestBundle: string;
  };
  /** Per-bundle analysis */
  bundles: DetailedBundleAnalysis[];
  /** Cross-bundle analysis */
  crossBundle: {
    duplicatedCode: Array<{
      code: string;
      size: number;
      bundles: string[];
    }>;
    sharedDependencies: Array<{
      dependency: string;
      size: number;
      bundles: string[];
    }>;
    optimizationOpportunities: string[];
  };
  /** Performance recommendations */
  recommendations: {
    splitting: string[];
    compression: string[];
    caching: string[];
    loading: string[];
  };
}

/**
 * Bundle analyzer for size optimization and performance insights
 */
export class BundleAnalyzer {
  private config: BundleAnalysisConfig;

  constructor(config: BundleAnalysisConfig) {
    this.config = config;
  }

  /**
   * Analyze bundle result and generate comprehensive report
   */
  async analyze(bundleResult: BundleResult): Promise<CompleteBundleAnalysis> {
    const bundleAnalyses: DetailedBundleAnalysis[] = [];

    // Analyze each bundle individually
    for (const bundle of bundleResult.bundles) {
      const analysis = await this.analyzeSingleBundle(bundle);
      bundleAnalyses.push(analysis);
    }

    // Perform cross-bundle analysis
    const crossBundleAnalysis = await this.analyzeCrossBundlePatterns(bundleResult.bundles);

    // Generate overview statistics
    const overview = this.generateOverview(bundleAnalyses);

    // Generate recommendations
    const recommendations = this.generateRecommendations(bundleAnalyses, crossBundleAnalysis);

    return {
      overview,
      bundles: bundleAnalyses,
      crossBundle: crossBundleAnalysis,
      recommendations
    };
  }

  /**
   * Analyze a single bundle in detail
   */
  private async analyzeSingleBundle(bundle: BundleInfo): Promise<DetailedBundleAnalysis> {
    const bundleContent = await fs.readFile(bundle.filePath, 'utf-8');
    
    // Size breakdown analysis
    const sizeBreakdown = await this.analyzeSizeBreakdown(bundleContent, bundle);
    
    // Compression analysis
    const compression = await this.analyzeCompression(bundle.filePath);
    
    // Performance analysis
    const performance = await this.analyzePerformance(bundleContent);
    
    // Generate suggestions and warnings
    const suggestions = this.generateBundleSuggestions(bundle, sizeBreakdown, compression);
    const warnings = this.generateBundleWarnings(bundle, sizeBreakdown);

    return {
      bundle,
      sizeBreakdown,
      compression,
      performance,
      suggestions,
      warnings
    };
  }

  /**
   * Analyze size breakdown by category
   */
  private async analyzeSizeBreakdown(content: string, bundle: BundleInfo): Promise<{
    code: number;
    dependencies: number;
    runtime: number;
    framework: number;
  }> {
    const totalSize = Buffer.byteLength(content, 'utf-8');
    
    // Estimate runtime code size
    const runtimePatterns = [
      /class MetamonPubSub[\s\S]*?^}/gm,
      /class SignalManager[\s\S]*?^}/gm,
      /class MetamonRouter[\s\S]*?^}/gm
    ];
    
    let runtimeSize = 0;
    runtimePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        runtimeSize += matches.reduce((sum, match) => sum + Buffer.byteLength(match, 'utf-8'), 0);
      }
    });

    // Estimate framework adapter size
    const frameworkPatterns = [
      new RegExp(`class ${bundle.framework}Adapter[\\s\\S]*?^}`, 'gmi'),
      new RegExp(`${bundle.framework}.*integration[\\s\\S]*?^}`, 'gmi')
    ];
    
    let frameworkSize = 0;
    frameworkPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        frameworkSize += matches.reduce((sum, match) => sum + Buffer.byteLength(match, 'utf-8'), 0);
      }
    });

    // Estimate dependencies size
    const importStatements = content.match(/import.*from.*['"][^'"]*['"]/g) || [];
    const dependenciesSize = Math.floor(totalSize * 0.3); // Rough estimate

    // Remaining is application code
    const codeSize = totalSize - runtimeSize - frameworkSize - dependenciesSize;

    return {
      code: Math.max(0, codeSize),
      dependencies: dependenciesSize,
      runtime: runtimeSize,
      framework: frameworkSize
    };
  }

  /**
   * Analyze compression ratios
   */
  private async analyzeCompression(bundlePath: string): Promise<{
    gzipped: number;
    brotli: number;
    compressionRatio: number;
  }> {
    const originalSize = (await fs.stat(bundlePath)).size;
    
    // Simulate compression analysis (in real implementation, would use actual compression)
    const gzippedSize = Math.floor(originalSize * 0.3); // Typical gzip ratio
    const brotliSize = Math.floor(originalSize * 0.25); // Typical brotli ratio
    const compressionRatio = (originalSize - gzippedSize) / originalSize;

    return {
      gzipped: gzippedSize,
      brotli: brotliSize,
      compressionRatio
    };
  }

  /**
   * Analyze performance characteristics
   */
  private async analyzePerformance(content: string): Promise<{
    parseTime: number;
    loadTime: number;
    executionTime: number;
  }> {
    const size = Buffer.byteLength(content, 'utf-8');
    
    // Estimate performance metrics based on bundle size and complexity
    const complexity = (content.match(/function|class|const|let|var/g) || []).length;
    
    return {
      parseTime: Math.floor(size / 1000), // ~1ms per KB
      loadTime: Math.floor(size / 500), // ~2ms per KB over network
      executionTime: Math.floor(complexity / 10) // ~0.1ms per construct
    };
  }

  /**
   * Generate optimization suggestions for a bundle
   */
  private generateBundleSuggestions(
    bundle: BundleInfo,
    sizeBreakdown: any,
    compression: any
  ): string[] {
    const suggestions: string[] = [];

    // Size-based suggestions
    if (bundle.size > 500 * 1024) { // > 500KB
      suggestions.push('Consider code splitting - bundle is larger than 500KB');
    }

    if (sizeBreakdown.dependencies > bundle.size * 0.5) {
      suggestions.push('Dependencies make up >50% of bundle - consider external dependencies');
    }

    if (sizeBreakdown.runtime > bundle.size * 0.2) {
      suggestions.push('Runtime code is >20% of bundle - enable tree-shaking for unused features');
    }

    // Compression suggestions
    if (compression.compressionRatio < 0.6) {
      suggestions.push('Low compression ratio - consider minification or different bundling strategy');
    }

    // Framework-specific suggestions
    if (bundle.framework === 'react' && bundle.size > 200 * 1024) {
      suggestions.push('Consider React lazy loading for large components');
    }

    if (bundle.framework === 'vue' && bundle.size > 150 * 1024) {
      suggestions.push('Consider Vue async components for better loading performance');
    }

    return suggestions;
  }

  /**
   * Generate warnings for potential issues
   */
  private generateBundleWarnings(bundle: BundleInfo, sizeBreakdown: any): string[] {
    const warnings: string[] = [];

    if (bundle.size > this.config.thresholds.error) {
      warnings.push(`Bundle size (${Math.floor(bundle.size / 1024)}KB) exceeds error threshold`);
    } else if (bundle.size > this.config.thresholds.warning) {
      warnings.push(`Bundle size (${Math.floor(bundle.size / 1024)}KB) exceeds warning threshold`);
    }

    if (bundle.dependencies.length > 50) {
      warnings.push(`High dependency count (${bundle.dependencies.length}) may impact loading performance`);
    }

    if (sizeBreakdown.framework > 100 * 1024) {
      warnings.push('Framework adapter code is >100KB - check for unused adapter features');
    }

    return warnings;
  }

  /**
   * Analyze patterns across multiple bundles
   */
  private async analyzeCrossBundlePatterns(bundles: BundleInfo[]): Promise<{
    duplicatedCode: Array<{ code: string; size: number; bundles: string[] }>;
    sharedDependencies: Array<{ dependency: string; size: number; bundles: string[] }>;
    optimizationOpportunities: string[];
  }> {
    const duplicatedCode: Array<{ code: string; size: number; bundles: string[] }> = [];
    const sharedDependencies: Array<{ dependency: string; size: number; bundles: string[] }> = [];
    const optimizationOpportunities: string[] = [];

    // Find shared dependencies
    const dependencyMap = new Map<string, string[]>();
    
    bundles.forEach(bundle => {
      bundle.dependencies.forEach(dep => {
        if (!dependencyMap.has(dep)) {
          dependencyMap.set(dep, []);
        }
        dependencyMap.get(dep)!.push(bundle.filePath);
      });
    });

    // Identify shared dependencies
    dependencyMap.forEach((bundlePaths, dependency) => {
      if (bundlePaths.length > 1) {
        sharedDependencies.push({
          dependency,
          size: 10 * 1024, // Estimated size
          bundles: bundlePaths
        });
      }
    });

    // Generate optimization opportunities
    if (sharedDependencies.length > 5) {
      optimizationOpportunities.push('Create shared chunk for common dependencies');
    }

    const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0);
    if (totalSize > 2 * 1024 * 1024) { // > 2MB
      optimizationOpportunities.push('Consider lazy loading for non-critical bundles');
    }

    const frameworkCounts = bundles.reduce((counts, bundle) => {
      counts[bundle.framework] = (counts[bundle.framework] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    if (Object.keys(frameworkCounts).length > 2) {
      optimizationOpportunities.push('Multiple frameworks detected - consider framework-specific entry points');
    }

    return {
      duplicatedCode,
      sharedDependencies,
      optimizationOpportunities
    };
  }

  /**
   * Generate overview statistics
   */
  private generateOverview(analyses: DetailedBundleAnalysis[]): {
    totalBundles: number;
    totalSize: number;
    totalGzippedSize: number;
    averageBundleSize: number;
    largestBundle: string;
    smallestBundle: string;
  } {
    const totalSize = analyses.reduce((sum, analysis) => sum + analysis.bundle.size, 0);
    const totalGzippedSize = analyses.reduce((sum, analysis) => sum + analysis.compression.gzipped, 0);
    const averageBundleSize = totalSize / analyses.length;

    const sortedBySize = [...analyses].sort((a, b) => b.bundle.size - a.bundle.size);

    return {
      totalBundles: analyses.length,
      totalSize,
      totalGzippedSize,
      averageBundleSize,
      largestBundle: path.basename(sortedBySize[0]?.bundle.filePath || ''),
      smallestBundle: path.basename(sortedBySize[sortedBySize.length - 1]?.bundle.filePath || '')
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    analyses: DetailedBundleAnalysis[],
    crossBundle: any
  ): {
    splitting: string[];
    compression: string[];
    caching: string[];
    loading: string[];
  } {
    const recommendations = {
      splitting: [] as string[],
      compression: [] as string[],
      caching: [] as string[],
      loading: [] as string[]
    };

    // Code splitting recommendations
    const largeBundles = analyses.filter(a => a.bundle.size > 300 * 1024);
    if (largeBundles.length > 0) {
      recommendations.splitting.push(`Split ${largeBundles.length} large bundles using dynamic imports`);
    }

    if (crossBundle.sharedDependencies.length > 3) {
      recommendations.splitting.push('Create vendor chunk for shared dependencies');
    }

    // Compression recommendations
    const lowCompressionBundles = analyses.filter(a => a.compression.compressionRatio < 0.5);
    if (lowCompressionBundles.length > 0) {
      recommendations.compression.push('Enable better minification for low-compression bundles');
    }

    recommendations.compression.push('Enable Brotli compression for better compression ratios');

    // Caching recommendations
    recommendations.caching.push('Use content-based hashing for long-term caching');
    recommendations.caching.push('Separate vendor dependencies for better cache efficiency');

    // Loading recommendations
    const totalSize = analyses.reduce((sum, a) => sum + a.bundle.size, 0);
    if (totalSize > 1024 * 1024) { // > 1MB
      recommendations.loading.push('Implement progressive loading for large applications');
    }

    recommendations.loading.push('Use resource hints (preload/prefetch) for critical bundles');

    return recommendations;
  }

  /**
   * Generate visualization data for bundle analysis
   */
  async generateVisualization(analysis: CompleteBundleAnalysis): Promise<any> {
    if (!this.config.visualization) {
      return null;
    }

    return {
      treemap: {
        name: 'Bundle Analysis',
        children: analysis.bundles.map(bundleAnalysis => ({
          name: path.basename(bundleAnalysis.bundle.filePath),
          size: bundleAnalysis.bundle.size,
          children: [
            { name: 'Code', size: bundleAnalysis.sizeBreakdown.code },
            { name: 'Dependencies', size: bundleAnalysis.sizeBreakdown.dependencies },
            { name: 'Runtime', size: bundleAnalysis.sizeBreakdown.runtime },
            { name: 'Framework', size: bundleAnalysis.sizeBreakdown.framework }
          ]
        }))
      },
      timeline: analysis.bundles.map(bundleAnalysis => ({
        name: path.basename(bundleAnalysis.bundle.filePath),
        parseTime: bundleAnalysis.performance.parseTime,
        loadTime: bundleAnalysis.performance.loadTime,
        executionTime: bundleAnalysis.performance.executionTime
      })),
      dependencies: {
        nodes: analysis.bundles.map(bundleAnalysis => ({
          id: bundleAnalysis.bundle.filePath,
          size: bundleAnalysis.bundle.size,
          framework: bundleAnalysis.bundle.framework
        })),
        links: analysis.crossBundle.sharedDependencies.map(dep => ({
          source: dep.bundles[0],
          target: dep.bundles[1],
          dependency: dep.dependency
        }))
      }
    };
  }
}