/**
 * Bundle Optimization Orchestrator
 * 
 * Main orchestrator that coordinates all bundle optimization strategies:
 * - Shared dependency extraction
 * - Framework-specific chunk splitting
 * - HTTP/2 multiplexing optimization
 * - Cache strategy optimization
 */

import { BundleOptimizer, BundleOptimizationConfig, OptimizationResult } from './bundle-optimizer.js';
import { SharedDependencyExtractor, SharedDependencyConfig, ExtractionResult } from './shared-dependency-extractor.js';
import { HTTP2MultiplexingOptimizer, HTTP2OptimizationConfig, HTTP2OptimizationResult } from './http2-multiplexing-optimizer.js';
import { CacheStrategyOptimizer, CacheOptimizationResult } from './cache-strategy-optimizer.js';
import { BundleAnalyzer, CompleteBundleAnalysis } from '../bundle-analyzer.js';
import { OutputBundle } from 'rollup';

export interface ComprehensiveBundleOptimizationConfig {
  // Bundle optimization settings
  bundleOptimization: BundleOptimizationConfig;
  
  // Shared dependency extraction settings
  sharedDependencyExtraction: SharedDependencyConfig;
  
  // HTTP/2 multiplexing optimization settings
  http2Optimization: HTTP2OptimizationConfig;
  
  // Analysis settings
  analysis: {
    enabled: boolean;
    detailed: boolean;
    generateReports: boolean;
    outputPath?: string;
  };
  
  // Performance targets
  performanceTargets: {
    maxInitialBundleSize: number;
    targetCacheHitRate: number;
    maxLoadTime: number;
    minCompressionRatio: number;
  };
}

export interface ComprehensiveOptimizationResult {
  // Individual optimization results
  bundleOptimization: OptimizationResult;
  sharedDependencyExtraction: ExtractionResult;
  http2Optimization: HTTP2OptimizationResult;
  cacheOptimization: CacheOptimizationResult;
  
  // Combined metrics
  overallMetrics: {
    totalSizeReduction: number;
    estimatedLoadTimeImprovement: number;
    cacheEfficiencyImprovement: number;
    parallelLoadingImprovement: number;
    compressionImprovement: number;
  };
  
  // Final bundle manifest
  finalBundleManifest: {
    bundles: Array<{
      name: string;
      size: number;
      compressedSize: number;
      hash: string;
      dependencies: string[];
      framework: string;
      priority: string;
      cacheStrategy: string;
      loadingStrategy: string;
    }>;
    sharedChunks: Array<{
      name: string;
      size: number;
      frameworks: string[];
      dependencies: string[];
      cacheStrategy: string;
    }>;
    loadingSequences: any[];
    serverPushManifest: any;
  };
  
  // Consolidated recommendations
  recommendations: {
    critical: string[];
    important: string[];
    optional: string[];
  };
  
  // Performance report
  performanceReport: {
    beforeOptimization: {
      totalSize: number;
      bundleCount: number;
      estimatedLoadTime: number;
      cacheEfficiency: number;
    };
    afterOptimization: {
      totalSize: number;
      bundleCount: number;
      estimatedLoadTime: number;
      cacheEfficiency: number;
    };
    improvements: {
      sizeReduction: number;
      loadTimeReduction: number;
      cacheImprovement: number;
      parallelLoadingGain: number;
    };
  };
}

/**
 * Bundle Optimization Orchestrator
 * 
 * Coordinates all bundle optimization strategies for maximum performance
 */
export class BundleOptimizationOrchestrator {
  private config: ComprehensiveBundleOptimizationConfig;
  private bundleOptimizer: BundleOptimizer;
  private sharedDependencyExtractor: SharedDependencyExtractor;
  private http2Optimizer: HTTP2MultiplexingOptimizer;
  private cacheOptimizer: CacheStrategyOptimizer;
  private bundleAnalyzer: BundleAnalyzer;

  constructor(config: ComprehensiveBundleOptimizationConfig) {
    this.config = config;
    
    // Initialize optimizers
    this.bundleOptimizer = new BundleOptimizer(config.bundleOptimization);
    this.sharedDependencyExtractor = new SharedDependencyExtractor(config.sharedDependencyExtraction);
    this.http2Optimizer = new HTTP2MultiplexingOptimizer(config.http2Optimization);
    this.cacheOptimizer = new CacheStrategyOptimizer();
    
    // Initialize analyzer
    this.bundleAnalyzer = new BundleAnalyzer({
      detailed: config.analysis.detailed,
      sourceMaps: true,
      visualization: config.analysis.generateReports,
      thresholds: {
        warning: config.performanceTargets.maxInitialBundleSize * 0.8,
        error: config.performanceTargets.maxInitialBundleSize
      }
    });
  }

  /**
   * Perform comprehensive bundle optimization
   */
  async optimize(bundle: OutputBundle): Promise<ComprehensiveOptimizationResult> {
    console.log('🚀 Starting comprehensive bundle optimization...');

    // Step 1: Initial analysis
    const initialAnalysis = await this.performInitialAnalysis(bundle);
    console.log(`📊 Analyzed ${initialAnalysis.bundles.length} bundles`);

    // Step 2: Extract shared dependencies
    const sharedDependencyResult = await this.extractSharedDependencies(initialAnalysis);
    console.log(`🔗 Extracted ${sharedDependencyResult.sharedChunks.length} shared chunks`);

    // Step 3: Optimize bundle structure
    const bundleOptimizationResult = await this.optimizeBundleStructure(bundle, sharedDependencyResult);
    console.log(`📦 Optimized bundle structure with ${bundleOptimizationResult.bundles.length} bundles`);

    // Step 4: Optimize for HTTP/2
    const http2OptimizationResult = await this.optimizeForHTTP2(
      bundleOptimizationResult.bundles,
      sharedDependencyResult.sharedChunks
    );
    console.log(`🌐 Optimized for HTTP/2 with ${http2OptimizationResult.loadingSequences.length} loading phases`);

    // Step 5: Optimize cache strategies
    const cacheOptimizationResult = await this.optimizeCacheStrategies(
      bundleOptimizationResult.bundles,
      sharedDependencyResult.sharedChunks
    );
    console.log(`💾 Optimized cache strategies for ${cacheOptimizationResult.strategies.length} resources`);

    // Step 6: Generate comprehensive results
    const comprehensiveResult = await this.generateComprehensiveResult(
      initialAnalysis,
      bundleOptimizationResult,
      sharedDependencyResult,
      http2OptimizationResult,
      cacheOptimizationResult
    );

    console.log('✅ Bundle optimization complete!');
    console.log(`📈 Total size reduction: ${Math.floor(comprehensiveResult.overallMetrics.totalSizeReduction / 1024)}KB`);
    console.log(`⚡ Estimated load time improvement: ${Math.floor(comprehensiveResult.overallMetrics.estimatedLoadTimeImprovement * 100)}%`);

    return comprehensiveResult;
  }

  /**
   * Perform initial bundle analysis
   */
  private async performInitialAnalysis(bundle: OutputBundle): Promise<CompleteBundleAnalysis> {
    const bundleResult = await this.createBundleResult(bundle);
    return await this.bundleAnalyzer.analyze(bundleResult);
  }

  /**
   * Extract shared dependencies
   */
  private async extractSharedDependencies(analysis: CompleteBundleAnalysis): Promise<ExtractionResult> {
    const bundles = analysis.bundles.map(b => b.bundle);
    return await this.sharedDependencyExtractor.extract(bundles);
  }

  /**
   * Optimize bundle structure
   */
  private async optimizeBundleStructure(
    bundle: OutputBundle,
    sharedDependencyResult: ExtractionResult
  ): Promise<OptimizationResult> {
    return await this.bundleOptimizer.optimize(bundle);
  }

  /**
   * Optimize for HTTP/2 multiplexing
   */
  private async optimizeForHTTP2(bundles: any[], sharedChunks: any[]): Promise<HTTP2OptimizationResult> {
    return await this.http2Optimizer.optimize(bundles, sharedChunks);
  }

  /**
   * Optimize cache strategies
   */
  private async optimizeCacheStrategies(bundles: any[], sharedChunks: any[]): Promise<CacheOptimizationResult> {
    return await this.cacheOptimizer.optimize(bundles, sharedChunks);
  }

  /**
   * Generate comprehensive optimization result
   */
  private async generateComprehensiveResult(
    initialAnalysis: CompleteBundleAnalysis,
    bundleOptimization: OptimizationResult,
    sharedDependencyExtraction: ExtractionResult,
    http2Optimization: HTTP2OptimizationResult,
    cacheOptimization: CacheOptimizationResult
  ): Promise<ComprehensiveOptimizationResult> {
    // Calculate overall metrics
    const overallMetrics = this.calculateOverallMetrics(
      initialAnalysis,
      bundleOptimization,
      sharedDependencyExtraction,
      http2Optimization,
      cacheOptimization
    );

    // Generate final bundle manifest
    const finalBundleManifest = this.generateFinalBundleManifest(
      bundleOptimization,
      sharedDependencyExtraction,
      http2Optimization,
      cacheOptimization
    );

    // Consolidate recommendations
    const recommendations = this.consolidateRecommendations(
      bundleOptimization,
      sharedDependencyExtraction,
      http2Optimization,
      cacheOptimization
    );

    // Generate performance report
    const performanceReport = this.generatePerformanceReport(
      initialAnalysis,
      overallMetrics
    );

    return {
      bundleOptimization,
      sharedDependencyExtraction,
      http2Optimization,
      cacheOptimization,
      overallMetrics,
      finalBundleManifest,
      recommendations,
      performanceReport
    };
  }

  /**
   * Calculate overall optimization metrics
   */
  private calculateOverallMetrics(
    initialAnalysis: CompleteBundleAnalysis,
    bundleOpt: OptimizationResult,
    sharedDepOpt: ExtractionResult,
    http2Opt: HTTP2OptimizationResult,
    cacheOpt: CacheOptimizationResult
  ) {
    const originalSize = initialAnalysis.overview.totalSize;
    const optimizedSize = bundleOpt.bundles.reduce((sum, b) => sum + b.size, 0) +
                         sharedDepOpt.sharedChunks.reduce((sum, c) => sum + c.totalSize, 0);

    return {
      totalSizeReduction: originalSize - optimizedSize,
      estimatedLoadTimeImprovement: http2Opt.performanceProjections.estimatedLoadTime.improvement,
      cacheEfficiencyImprovement: cacheOpt.performanceProjections.estimatedHitRate,
      parallelLoadingImprovement: http2Opt.performanceProjections.parallelLoadingEfficiency,
      compressionImprovement: bundleOpt.metrics.compressionRatio
    };
  }

  /**
   * Generate final bundle manifest
   */
  private generateFinalBundleManifest(
    bundleOpt: OptimizationResult,
    sharedDepOpt: ExtractionResult,
    http2Opt: HTTP2OptimizationResult,
    cacheOpt: CacheOptimizationResult
  ) {
    return {
      bundles: bundleOpt.bundles.map(bundle => ({
        name: bundle.name,
        size: bundle.size,
        compressedSize: bundle.compressedSize,
        hash: bundle.hash,
        dependencies: bundle.dependencies,
        framework: bundle.framework,
        priority: bundle.priority,
        cacheStrategy: bundle.cacheStrategy,
        loadingStrategy: bundle.preloadStrategy
      })),
      sharedChunks: sharedDepOpt.sharedChunks.map(chunk => ({
        name: chunk.name,
        size: chunk.totalSize,
        frameworks: chunk.frameworks,
        dependencies: chunk.dependencies.map(d => d.name),
        cacheStrategy: chunk.cacheStrategy
      })),
      loadingSequences: http2Opt.loadingSequences,
      serverPushManifest: http2Opt.serverPushManifest
    };
  }

  /**
   * Consolidate recommendations from all optimizers
   */
  private consolidateRecommendations(
    bundleOpt: OptimizationResult,
    sharedDepOpt: ExtractionResult,
    http2Opt: HTTP2OptimizationResult,
    cacheOpt: CacheOptimizationResult
  ) {
    const allRecommendations = [
      ...bundleOpt.recommendations,
      ...sharedDepOpt.recommendations,
      ...http2Opt.recommendations,
      ...cacheOpt.recommendations
    ];

    // Categorize recommendations by importance
    const critical = allRecommendations.filter(r => 
      r.toLowerCase().includes('critical') || 
      r.toLowerCase().includes('error') ||
      r.toLowerCase().includes('warning')
    );

    const important = allRecommendations.filter(r => 
      !critical.includes(r) && (
        r.toLowerCase().includes('consider') ||
        r.toLowerCase().includes('optimize') ||
        r.toLowerCase().includes('improve')
      )
    );

    const optional = allRecommendations.filter(r => 
      !critical.includes(r) && !important.includes(r)
    );

    return { critical, important, optional };
  }

  /**
   * Generate performance report
   */
  private generatePerformanceReport(
    initialAnalysis: CompleteBundleAnalysis,
    overallMetrics: any
  ) {
    const beforeOptimization = {
      totalSize: initialAnalysis.overview.totalSize,
      bundleCount: initialAnalysis.bundles.length,
      estimatedLoadTime: this.estimateLoadTime(initialAnalysis.overview.totalSize, initialAnalysis.bundles.length),
      cacheEfficiency: 0.5 // Baseline assumption
    };

    const afterOptimization = {
      totalSize: initialAnalysis.overview.totalSize - overallMetrics.totalSizeReduction,
      bundleCount: initialAnalysis.bundles.length, // May change with splitting
      estimatedLoadTime: beforeOptimization.estimatedLoadTime * (1 - overallMetrics.estimatedLoadTimeImprovement),
      cacheEfficiency: overallMetrics.cacheEfficiencyImprovement
    };

    const improvements = {
      sizeReduction: overallMetrics.totalSizeReduction / beforeOptimization.totalSize,
      loadTimeReduction: overallMetrics.estimatedLoadTimeImprovement,
      cacheImprovement: afterOptimization.cacheEfficiency - beforeOptimization.cacheEfficiency,
      parallelLoadingGain: overallMetrics.parallelLoadingImprovement
    };

    return {
      beforeOptimization,
      afterOptimization,
      improvements
    };
  }

  /**
   * Create default configuration
   */
  static createDefaultConfig(): ComprehensiveBundleOptimizationConfig {
    return {
      bundleOptimization: {
        sharedDependencies: {
          enabled: true,
          minSharedCount: 2,
          maxSharedChunkSize: 200 * 1024, // 200KB
          priorityDependencies: ['react', 'vue', 'lodash']
        },
        frameworkOptimization: {
          enabled: true,
          chunkSizeTargets: {
            react: { core: 100 * 1024, adapter: 50 * 1024, utility: 30 * 1024 },
            vue: { core: 80 * 1024, adapter: 40 * 1024, utility: 25 * 1024 },
            svelte: { core: 60 * 1024, adapter: 30 * 1024, utility: 20 * 1024 },
            solid: { core: 70 * 1024, adapter: 35 * 1024, utility: 22 * 1024 }
          },
          preloadStrategies: {
            react: 'aggressive',
            vue: 'conservative',
            svelte: 'lazy',
            solid: 'conservative'
          }
        },
        http2Optimization: {
          enabled: true,
          maxConcurrentRequests: 6,
          optimalChunkSize: 100 * 1024,
          enableServerPush: true,
          pushPriorityMap: {
            core: 'high',
            adapter: 'medium',
            utility: 'low'
          }
        },
        cacheOptimization: {
          enabled: true,
          strategies: {
            '*.core.*': {
              strategy: 'cache-first',
              maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
              updateStrategy: 'background'
            },
            '*.adapter.*': {
              strategy: 'stale-while-revalidate',
              maxAge: 24 * 60 * 60 * 1000, // 1 day
              updateStrategy: 'background'
            },
            '*.utility.*': {
              strategy: 'network-first',
              maxAge: 60 * 60 * 1000, // 1 hour
              updateStrategy: 'immediate'
            }
          },
          versioningStrategy: 'hash',
          cacheInvalidationRules: {
            '*.core.*': ['framework-version-change'],
            '*.adapter.*': ['adapter-version-change'],
            '*.utility.*': ['content-change']
          }
        }
      },
      sharedDependencyExtraction: {
        minSharedCount: 2,
        maxSharedChunkSize: 200 * 1024,
        minDependencySize: 10 * 1024,
        priorityDependencies: ['react', 'react-dom', 'vue', 'lodash', 'axios'],
        frameworkSettings: {
          react: {
            coreLibraries: ['react', 'react-dom'],
            excludeFromSharing: [],
            preferredChunkSize: 100 * 1024
          },
          vue: {
            coreLibraries: ['vue'],
            excludeFromSharing: [],
            preferredChunkSize: 80 * 1024
          },
          svelte: {
            coreLibraries: ['svelte'],
            excludeFromSharing: [],
            preferredChunkSize: 60 * 1024
          },
          solid: {
            coreLibraries: ['solid-js'],
            excludeFromSharing: [],
            preferredChunkSize: 70 * 1024
          }
        },
        optimization: {
          enableTreeShaking: true,
          enableDeduplication: true,
          preserveModuleStructure: false,
          generateSourceMaps: true
        }
      },
      http2Optimization: {
        maxConcurrentStreams: 100,
        optimalChunkSize: 100 * 1024,
        minChunkSize: 10 * 1024,
        maxChunkSize: 500 * 1024,
        serverPush: {
          enabled: true,
          criticalResourceThreshold: 50 * 1024,
          maxPushResources: 5,
          pushPriorityMap: {
            core: 'highest',
            adapter: 'high',
            utility: 'medium',
            shared: 'high'
          }
        },
        loadingOptimization: {
          enablePreload: true,
          enablePrefetch: true,
          priorityHints: true,
          resourceHints: true
        }
      },
      analysis: {
        enabled: true,
        detailed: true,
        generateReports: true,
        outputPath: './bundle-analysis'
      },
      performanceTargets: {
        maxInitialBundleSize: 250 * 1024, // 250KB
        targetCacheHitRate: 0.8,
        maxLoadTime: 2000, // 2 seconds
        minCompressionRatio: 0.3
      }
    };
  }

  // Helper methods
  private async createBundleResult(bundle: OutputBundle): Promise<any> {
    const bundles = Object.entries(bundle)
      .filter(([_, chunk]) => chunk.type === 'chunk')
      .map(([fileName, chunk]) => ({
        filePath: fileName,
        sources: [fileName],
        size: (chunk as any).code.length,
        dependencies: this.extractDependencies(chunk as any),
        framework: this.detectFramework(chunk as any),
        type: 'component' as const
      }));

    return { bundles, buildTime: 0, warnings: [], analysis: {} };
  }

  private extractDependencies(chunk: any): string[] {
    const deps = new Set<string>();
    if (chunk.imports) chunk.imports.forEach((imp: string) => deps.add(imp));
    if (chunk.dynamicImports) chunk.dynamicImports.forEach((imp: string) => deps.add(imp));
    return Array.from(deps);
  }

  private detectFramework(chunk: any): string {
    const code = chunk.code.toLowerCase();
    if (code.includes('react')) return 'react';
    if (code.includes('vue')) return 'vue';
    if (code.includes('solid')) return 'solid';
    if (code.includes('svelte')) return 'svelte';
    return 'unknown';
  }

  private estimateLoadTime(totalSize: number, bundleCount: number): number {
    // Simple estimation: ~2ms per KB + 100ms per request
    return (totalSize / 1024) * 2 + bundleCount * 100;
  }
}