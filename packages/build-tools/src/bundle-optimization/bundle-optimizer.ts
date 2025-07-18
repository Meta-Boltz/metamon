/**
 * Bundle Optimizer for Metamon Performance Optimization
 * 
 * Implements intelligent bundling with shared dependency extraction,
 * framework-specific chunk splitting, and cache strategy optimization
 */

import { OutputBundle, OutputChunk } from 'rollup';
import { FrameworkBundleSplitter, FrameworkBundleConfig, BundleSplitResult } from '../service-worker/framework-bundle-splitter.js';
import { BundleAnalyzer, CompleteBundleAnalysis } from '../bundle-analyzer.js';
import { CacheStrategyOptimizer, CacheOptimizationResult } from './cache-strategy-optimizer.js';

export interface BundleOptimizationConfig {
  // Shared dependency extraction
  sharedDependencies: {
    enabled: boolean;
    minSharedCount: number; // Minimum frameworks sharing a dependency
    maxSharedChunkSize: number; // Maximum size for shared chunks
    priorityDependencies: string[]; // Dependencies to always extract
  };
  
  // Framework-specific optimization
  frameworkOptimization: {
    enabled: boolean;
    chunkSizeTargets: {
      [framework: string]: {
        core: number;
        adapter: number;
        utility: number;
      };
    };
    preloadStrategies: {
      [framework: string]: 'aggressive' | 'conservative' | 'lazy';
    };
  };
  
  // HTTP/2 multiplexing optimization
  http2Optimization: {
    enabled: boolean;
    maxConcurrentRequests: number;
    optimalChunkSize: number;
    enableServerPush: boolean;
    pushPriorityMap: {
      [chunkType: string]: 'high' | 'medium' | 'low';
    };
  };
  
  // Cache strategy optimization
  cacheOptimization: {
    enabled: boolean;
    strategies: {
      [pattern: string]: {
        strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
        maxAge: number;
        updateStrategy: 'background' | 'immediate' | 'lazy';
      };
    };
    versioningStrategy: 'hash' | 'timestamp' | 'semantic';
    cacheInvalidationRules: {
      [pattern: string]: string[]; // Dependencies that invalidate this pattern
    };
  };
}

export interface OptimizationResult {
  // Optimized bundle information
  bundles: OptimizedBundle[];
  
  // Shared dependency chunks
  sharedChunks: SharedDependencyChunk[];
  
  // Cache strategy manifest
  cacheManifest: CacheStrategyManifest;
  
  // HTTP/2 optimization data
  http2Manifest: HTTP2OptimizationManifest;
  
  // Performance metrics
  metrics: OptimizationMetrics;
  
  // Recommendations
  recommendations: string[];
}

export interface OptimizedBundle {
  name: string;
  framework: string;
  type: 'core' | 'adapter' | 'utility' | 'shared';
  size: number;
  compressedSize: number;
  dependencies: string[];
  sharedDependencies: string[];
  hash: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  preloadStrategy: 'aggressive' | 'conservative' | 'lazy';
  cacheStrategy: string;
  http2Priority: 'high' | 'medium' | 'low';
}

export interface SharedDependencyChunk {
  name: string;
  dependencies: string[];
  frameworks: string[];
  size: number;
  compressedSize: number;
  hash: string;
  cacheStrategy: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CacheStrategyManifest {
  version: string;
  strategies: {
    [bundleName: string]: {
      strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
      maxAge: number;
      updateStrategy: 'background' | 'immediate' | 'lazy';
      invalidationTriggers: string[];
    };
  };
  versioningStrategy: 'hash' | 'timestamp' | 'semantic';
  globalInvalidationRules: {
    [pattern: string]: string[];
  };
}

export interface HTTP2OptimizationManifest {
  maxConcurrentRequests: number;
  optimalChunkSize: number;
  serverPushEnabled: boolean;
  pushManifest: {
    [route: string]: {
      bundles: string[];
      priority: 'high' | 'medium' | 'low';
      condition: string;
    };
  };
  loadingSequence: {
    [framework: string]: {
      critical: string[];
      high: string[];
      normal: string[];
      low: string[];
    };
  };
}

export interface OptimizationMetrics {
  // Size metrics
  originalTotalSize: number;
  optimizedTotalSize: number;
  compressionRatio: number;
  sharedDependencySavings: number;
  
  // Performance metrics
  estimatedLoadTime: {
    http1: number;
    http2: number;
  };
  cacheHitRateProjection: number;
  parallelLoadingEfficiency: number;
  
  // Bundle metrics
  totalBundles: number;
  sharedChunks: number;
  averageBundleSize: number;
  largestBundle: string;
  smallestBundle: string;
}

/**
 * Bundle Optimizer - Main optimization orchestrator
 */
export class BundleOptimizer {
  private config: BundleOptimizationConfig;
  private bundleSplitter: FrameworkBundleSplitter;
  private bundleAnalyzer: BundleAnalyzer;

  constructor(config: BundleOptimizationConfig) {
    this.config = config;
    this.bundleSplitter = new FrameworkBundleSplitter(this.createSplitterConfig());
    this.bundleAnalyzer = new BundleAnalyzer({
      detailed: true,
      sourceMaps: true,
      visualization: true,
      thresholds: {
        warning: 200 * 1024, // 200KB
        error: 500 * 1024    // 500KB
      }
    });
  }

  /**
   * Optimize bundle for performance and caching
   */
  async optimize(bundle: OutputBundle): Promise<OptimizationResult> {
    // Step 1: Analyze current bundle structure
    const bundleResult = await this.createBundleResult(bundle);
    const analysis = await this.bundleAnalyzer.analyze(bundleResult);

    // Step 2: Extract shared dependencies
    const sharedChunks = await this.extractSharedDependencies(bundle, analysis);

    // Step 3: Optimize framework-specific chunks
    const optimizedBundles = await this.optimizeFrameworkChunks(bundle, analysis, sharedChunks);

    // Step 4: Apply HTTP/2 optimizations
    const http2Manifest = await this.optimizeForHTTP2(optimizedBundles, sharedChunks);

    // Step 5: Generate cache strategies
    const cacheManifest = await this.generateCacheStrategies(optimizedBundles, sharedChunks);

    // Step 6: Calculate metrics and recommendations
    const metrics = await this.calculateOptimizationMetrics(analysis, optimizedBundles, sharedChunks);
    const recommendations = await this.generateRecommendations(analysis, metrics);

    return {
      bundles: optimizedBundles,
      sharedChunks,
      cacheManifest,
      http2Manifest,
      metrics,
      recommendations
    };
  }

  /**
   * Extract shared dependencies into separate chunks
   */
  private async extractSharedDependencies(
    bundle: OutputBundle,
    analysis: CompleteBundleAnalysis
  ): Promise<SharedDependencyChunk[]> {
    if (!this.config.sharedDependencies.enabled) {
      return [];
    }

    const sharedChunks: SharedDependencyChunk[] = [];
    const { minSharedCount, maxSharedChunkSize, priorityDependencies } = this.config.sharedDependencies;

    // Find dependencies shared across multiple frameworks
    const dependencyMap = new Map<string, Set<string>>();
    
    for (const bundleAnalysis of analysis.bundles) {
      const framework = bundleAnalysis.bundle.framework;
      
      for (const dep of bundleAnalysis.bundle.dependencies) {
        if (!dependencyMap.has(dep)) {
          dependencyMap.set(dep, new Set());
        }
        dependencyMap.get(dep)!.add(framework);
      }
    }

    // Create shared chunks for qualifying dependencies
    const sharedDependencies = Array.from(dependencyMap.entries())
      .filter(([dep, frameworks]) => 
        frameworks.size >= minSharedCount || priorityDependencies.includes(dep)
      );

    // Group dependencies into optimally-sized chunks
    let currentChunk: { deps: string[], frameworks: Set<string>, size: number } = {
      deps: [],
      frameworks: new Set(),
      size: 0
    };

    for (const [dep, frameworks] of sharedDependencies) {
      const estimatedSize = this.estimateDependencySize(dep);
      
      if (currentChunk.size + estimatedSize > maxSharedChunkSize && currentChunk.deps.length > 0) {
        // Create chunk from current group
        sharedChunks.push(await this.createSharedChunk(currentChunk));
        
        // Start new chunk
        currentChunk = { deps: [], frameworks: new Set(), size: 0 };
      }
      
      currentChunk.deps.push(dep);
      frameworks.forEach(fw => currentChunk.frameworks.add(fw));
      currentChunk.size += estimatedSize;
    }

    // Create final chunk if needed
    if (currentChunk.deps.length > 0) {
      sharedChunks.push(await this.createSharedChunk(currentChunk));
    }

    return sharedChunks;
  }

  /**
   * Create a shared dependency chunk
   */
  private async createSharedChunk(chunkData: {
    deps: string[];
    frameworks: Set<string>;
    size: number;
  }): Promise<SharedDependencyChunk> {
    const name = `shared-${chunkData.deps.slice(0, 3).join('-').replace(/[^a-zA-Z0-9]/g, '-')}`;
    const hash = this.generateHash(chunkData.deps.join(''));
    const compressedSize = Math.floor(chunkData.size * 0.3); // Estimated compression

    return {
      name,
      dependencies: chunkData.deps,
      frameworks: Array.from(chunkData.frameworks),
      size: chunkData.size,
      compressedSize,
      hash,
      cacheStrategy: 'cache-first', // Shared dependencies are stable
      priority: chunkData.frameworks.size > 2 ? 'high' : 'medium'
    };
  }

  /**
   * Optimize framework-specific chunks
   */
  private async optimizeFrameworkChunks(
    bundle: OutputBundle,
    analysis: CompleteBundleAnalysis,
    sharedChunks: SharedDependencyChunk[]
  ): Promise<OptimizedBundle[]> {
    const optimizedBundles: OptimizedBundle[] = [];
    const sharedDependencies = new Set(sharedChunks.flatMap(chunk => chunk.dependencies));

    for (const bundleAnalysis of analysis.bundles) {
      const framework = bundleAnalysis.bundle.framework;
      const frameworkConfig = this.config.frameworkOptimization;

      if (!frameworkConfig.enabled) {
        // Simple conversion without optimization
        optimizedBundles.push(await this.convertToOptimizedBundle(bundleAnalysis, sharedDependencies));
        continue;
      }

      // Apply framework-specific optimizations
      const chunkTargets = frameworkConfig.chunkSizeTargets[framework];
      const preloadStrategy = frameworkConfig.preloadStrategies[framework] || 'conservative';

      if (chunkTargets) {
        // Split bundle based on size targets
        const splitBundles = await this.splitBundleByTargets(bundleAnalysis, chunkTargets, sharedDependencies);
        
        for (const splitBundle of splitBundles) {
          splitBundle.preloadStrategy = preloadStrategy;
          optimizedBundles.push(splitBundle);
        }
      } else {
        const optimizedBundle = await this.convertToOptimizedBundle(bundleAnalysis, sharedDependencies);
        optimizedBundle.preloadStrategy = preloadStrategy;
        optimizedBundles.push(optimizedBundle);
      }
    }

    return optimizedBundles;
  }

  /**
   * Split bundle based on size targets
   */
  private async splitBundleByTargets(
    bundleAnalysis: any,
    targets: { core: number; adapter: number; utility: number },
    sharedDependencies: Set<string>
  ): Promise<OptimizedBundle[]> {
    const bundles: OptimizedBundle[] = [];
    const { bundle, sizeBreakdown } = bundleAnalysis;

    // Determine how to split based on current size vs targets
    const coreSize = sizeBreakdown.runtime + sizeBreakdown.framework;
    const adapterSize = sizeBreakdown.framework;
    const utilitySize = sizeBreakdown.code;

    // Create core bundle
    if (coreSize > 0) {
      bundles.push({
        name: `${bundle.framework}-core`,
        framework: bundle.framework,
        type: 'core',
        size: Math.min(coreSize, targets.core),
        compressedSize: Math.floor(Math.min(coreSize, targets.core) * 0.3),
        dependencies: bundle.dependencies.filter((dep: string) => !sharedDependencies.has(dep)),
        sharedDependencies: bundle.dependencies.filter((dep: string) => sharedDependencies.has(dep)),
        hash: this.generateHash(`${bundle.framework}-core`),
        priority: 'critical',
        preloadStrategy: 'aggressive',
        cacheStrategy: 'cache-first',
        http2Priority: 'high'
      });
    }

    // Create adapter bundle if needed
    if (adapterSize > targets.adapter) {
      bundles.push({
        name: `${bundle.framework}-adapter`,
        framework: bundle.framework,
        type: 'adapter',
        size: targets.adapter,
        compressedSize: Math.floor(targets.adapter * 0.3),
        dependencies: [],
        sharedDependencies: [],
        hash: this.generateHash(`${bundle.framework}-adapter`),
        priority: 'high',
        preloadStrategy: 'conservative',
        cacheStrategy: 'stale-while-revalidate',
        http2Priority: 'medium'
      });
    }

    // Create utility bundles if needed
    if (utilitySize > targets.utility) {
      const utilityChunks = Math.ceil(utilitySize / targets.utility);
      
      for (let i = 0; i < utilityChunks; i++) {
        bundles.push({
          name: `${bundle.framework}-utility-${i}`,
          framework: bundle.framework,
          type: 'utility',
          size: Math.min(targets.utility, utilitySize - (i * targets.utility)),
          compressedSize: Math.floor(Math.min(targets.utility, utilitySize - (i * targets.utility)) * 0.3),
          dependencies: [],
          sharedDependencies: [],
          hash: this.generateHash(`${bundle.framework}-utility-${i}`),
          priority: 'normal',
          preloadStrategy: 'lazy',
          cacheStrategy: 'network-first',
          http2Priority: 'low'
        });
      }
    }

    return bundles;
  }

  /**
   * Convert bundle analysis to optimized bundle
   */
  private async convertToOptimizedBundle(
    bundleAnalysis: any,
    sharedDependencies: Set<string>
  ): Promise<OptimizedBundle> {
    const { bundle } = bundleAnalysis;
    
    return {
      name: bundle.filePath.split('/').pop()?.replace('.js', '') || 'unknown',
      framework: bundle.framework,
      type: 'core',
      size: bundle.size,
      compressedSize: Math.floor(bundle.size * 0.3),
      dependencies: bundle.dependencies.filter((dep: string) => !sharedDependencies.has(dep)),
      sharedDependencies: bundle.dependencies.filter((dep: string) => sharedDependencies.has(dep)),
      hash: this.generateHash(bundle.filePath),
      priority: 'normal',
      preloadStrategy: 'conservative',
      cacheStrategy: 'stale-while-revalidate',
      http2Priority: 'medium'
    };
  }

  /**
   * Optimize for HTTP/2 multiplexing
   */
  private async optimizeForHTTP2(
    bundles: OptimizedBundle[],
    sharedChunks: SharedDependencyChunk[]
  ): Promise<HTTP2OptimizationManifest> {
    if (!this.config.http2Optimization.enabled) {
      return this.createDefaultHTTP2Manifest(bundles);
    }

    const { maxConcurrentRequests, optimalChunkSize, enableServerPush } = this.config.http2Optimization;

    // Optimize chunk sizes for HTTP/2
    const optimizedBundles = await this.optimizeChunkSizesForHTTP2(bundles, optimalChunkSize);

    // Create loading sequences
    const loadingSequence = this.createLoadingSequences(optimizedBundles);

    // Generate server push manifest
    const pushManifest = enableServerPush ? this.generateServerPushManifest(optimizedBundles, sharedChunks) : {};

    return {
      maxConcurrentRequests,
      optimalChunkSize,
      serverPushEnabled: enableServerPush,
      pushManifest,
      loadingSequence
    };
  }

  /**
   * Create loading sequences for optimal HTTP/2 performance
   */
  private createLoadingSequences(bundles: OptimizedBundle[]): {
    [framework: string]: {
      critical: string[];
      high: string[];
      normal: string[];
      low: string[];
    };
  } {
    const sequences: any = {};

    // Group bundles by framework
    const frameworkGroups = new Map<string, OptimizedBundle[]>();
    for (const bundle of bundles) {
      if (!frameworkGroups.has(bundle.framework)) {
        frameworkGroups.set(bundle.framework, []);
      }
      frameworkGroups.get(bundle.framework)!.push(bundle);
    }

    // Create sequences for each framework
    for (const [framework, frameworkBundles] of frameworkGroups) {
      sequences[framework] = {
        critical: frameworkBundles.filter(b => b.priority === 'critical').map(b => b.name),
        high: frameworkBundles.filter(b => b.priority === 'high').map(b => b.name),
        normal: frameworkBundles.filter(b => b.priority === 'normal').map(b => b.name),
        low: frameworkBundles.filter(b => b.priority === 'low').map(b => b.name)
      };
    }

    return sequences;
  }

  /**
   * Generate server push manifest
   */
  private generateServerPushManifest(
    bundles: OptimizedBundle[],
    sharedChunks: SharedDependencyChunk[]
  ): { [route: string]: { bundles: string[]; priority: 'high' | 'medium' | 'low'; condition: string } } {
    const pushManifest: any = {};

    // Create push rules for different route patterns
    const criticalBundles = bundles.filter(b => b.priority === 'critical').map(b => b.name);
    const highPriorityShared = sharedChunks.filter(c => c.priority === 'high').map(c => c.name);

    // Root route - push critical bundles
    pushManifest['/'] = {
      bundles: [...criticalBundles, ...highPriorityShared],
      priority: 'high',
      condition: 'always'
    };

    // Framework-specific routes
    const frameworkGroups = new Map<string, string[]>();
    for (const bundle of bundles) {
      if (!frameworkGroups.has(bundle.framework)) {
        frameworkGroups.set(bundle.framework, []);
      }
      if (bundle.priority === 'critical' || bundle.priority === 'high') {
        frameworkGroups.get(bundle.framework)!.push(bundle.name);
      }
    }

    for (const [framework, bundleNames] of frameworkGroups) {
      pushManifest[`/${framework}/*`] = {
        bundles: bundleNames,
        priority: 'medium',
        condition: `framework === '${framework}'`
      };
    }

    return pushManifest;
  }

  /**
   * Generate cache strategies for optimal hit rates
   */
  private async generateCacheStrategies(
    bundles: OptimizedBundle[],
    sharedChunks: SharedDependencyChunk[]
  ): Promise<CacheStrategyManifest> {
    if (!this.config.cacheOptimization.enabled) {
      return this.createDefaultCacheManifest(bundles, sharedChunks);
    }

    const strategies: any = {};
    const { versioningStrategy, cacheInvalidationRules } = this.config.cacheOptimization;

    // Apply strategies to bundles
    for (const bundle of bundles) {
      const strategy = this.determineCacheStrategy(bundle);
      strategies[bundle.name] = {
        strategy: strategy.strategy,
        maxAge: strategy.maxAge,
        updateStrategy: strategy.updateStrategy,
        invalidationTriggers: this.getInvalidationTriggers(bundle, cacheInvalidationRules)
      };
    }

    // Apply strategies to shared chunks
    for (const chunk of sharedChunks) {
      strategies[chunk.name] = {
        strategy: chunk.cacheStrategy,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for shared chunks
        updateStrategy: 'background',
        invalidationTriggers: []
      };
    }

    return {
      version: this.generateVersion(),
      strategies,
      versioningStrategy,
      globalInvalidationRules: cacheInvalidationRules
    };
  }

  /**
   * Determine optimal cache strategy for bundle
   */
  private determineCacheStrategy(bundle: OptimizedBundle): {
    strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
    maxAge: number;
    updateStrategy: 'background' | 'immediate' | 'lazy';
  } {
    // Core bundles - cache aggressively
    if (bundle.type === 'core' || bundle.priority === 'critical') {
      return {
        strategy: 'cache-first',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        updateStrategy: 'background'
      };
    }

    // Adapter bundles - balance freshness and performance
    if (bundle.type === 'adapter') {
      return {
        strategy: 'stale-while-revalidate',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        updateStrategy: 'background'
      };
    }

    // Utility bundles - prefer fresh content
    return {
      strategy: 'network-first',
      maxAge: 60 * 60 * 1000, // 1 hour
      updateStrategy: 'immediate'
    };
  }

  /**
   * Get invalidation triggers for bundle
   */
  private getInvalidationTriggers(
    bundle: OptimizedBundle,
    rules: { [pattern: string]: string[] }
  ): string[] {
    const triggers: string[] = [];

    for (const [pattern, ruleTriggers] of Object.entries(rules)) {
      const regex = new RegExp(pattern);
      if (regex.test(bundle.name)) {
        triggers.push(...ruleTriggers);
      }
    }

    return triggers;
  }

  /**
   * Calculate optimization metrics
   */
  private async calculateOptimizationMetrics(
    analysis: CompleteBundleAnalysis,
    optimizedBundles: OptimizedBundle[],
    sharedChunks: SharedDependencyChunk[]
  ): Promise<OptimizationMetrics> {
    const originalTotalSize = analysis.overview.totalSize;
    const optimizedTotalSize = optimizedBundles.reduce((sum, b) => sum + b.size, 0) +
                              sharedChunks.reduce((sum, c) => sum + c.size, 0);

    const sharedDependencySavings = this.calculateSharedDependencySavings(sharedChunks, optimizedBundles);

    return {
      originalTotalSize,
      optimizedTotalSize,
      compressionRatio: optimizedTotalSize / originalTotalSize,
      sharedDependencySavings,
      estimatedLoadTime: {
        http1: this.estimateLoadTime(optimizedBundles, sharedChunks, 'http1'),
        http2: this.estimateLoadTime(optimizedBundles, sharedChunks, 'http2')
      },
      cacheHitRateProjection: this.estimateCacheHitRate(optimizedBundles, sharedChunks),
      parallelLoadingEfficiency: this.calculateParallelLoadingEfficiency(optimizedBundles),
      totalBundles: optimizedBundles.length,
      sharedChunks: sharedChunks.length,
      averageBundleSize: optimizedTotalSize / (optimizedBundles.length + sharedChunks.length),
      largestBundle: optimizedBundles.reduce((largest, current) => 
        current.size > largest.size ? current : largest, optimizedBundles[0])?.name || '',
      smallestBundle: optimizedBundles.reduce((smallest, current) => 
        current.size < smallest.size ? current : smallest, optimizedBundles[0])?.name || ''
    };
  }

  /**
   * Generate optimization recommendations
   */
  private async generateRecommendations(
    analysis: CompleteBundleAnalysis,
    metrics: OptimizationMetrics
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Size-based recommendations
    if (metrics.compressionRatio > 0.9) {
      recommendations.push('Bundle optimization had minimal impact - consider more aggressive code splitting');
    }

    if (metrics.sharedDependencySavings < 50 * 1024) {
      recommendations.push('Low shared dependency savings - review shared dependency extraction thresholds');
    }

    // Performance recommendations
    if (metrics.estimatedLoadTime.http2 > 2000) {
      recommendations.push('Estimated HTTP/2 load time >2s - consider reducing bundle sizes or increasing parallelization');
    }

    if (metrics.cacheHitRateProjection < 0.7) {
      recommendations.push('Low projected cache hit rate - review cache strategies and invalidation rules');
    }

    // Bundle structure recommendations
    if (metrics.totalBundles > 20) {
      recommendations.push('High bundle count may impact HTTP/1.1 performance - consider bundle consolidation');
    }

    if (metrics.averageBundleSize < 10 * 1024) {
      recommendations.push('Very small average bundle size - consider merging small bundles to reduce overhead');
    }

    return recommendations;
  }

  // Helper methods
  private createSplitterConfig(): FrameworkBundleConfig {
    // Convert optimization config to splitter config
    return {
      frameworks: {
        reactjs: { entry: 'react', dependencies: ['react', 'react-dom'], priority: 'high', preload: true },
        vue: { entry: 'vue', dependencies: ['vue'], priority: 'high', preload: true },
        solid: { entry: 'solid-js', dependencies: ['solid-js'], priority: 'normal', preload: false },
        svelte: { entry: 'svelte', dependencies: ['svelte'], priority: 'normal', preload: false }
      },
      chunkSplitting: {
        maxChunkSize: this.config.http2Optimization.optimalChunkSize || 100 * 1024,
        minChunkSize: 10 * 1024,
        sharedDependencyThreshold: this.config.sharedDependencies.minSharedCount || 2,
        enableTreeShaking: true
      },
      caching: {
        enableVersioning: true,
        hashLength: 8,
        cacheGroups: {
          core: { pattern: /core|runtime/, priority: 10, maxAge: 7 * 24 * 60 * 60 * 1000 },
          adapters: { pattern: /adapter|metamon/, priority: 5, maxAge: 24 * 60 * 60 * 1000 },
          shared: { pattern: /shared|common/, priority: 8, maxAge: 3 * 24 * 60 * 60 * 1000 }
        }
      },
      serviceWorker: {
        generateManifest: true,
        manifestPath: '/metamon-manifest.json',
        enableBackgroundSync: true
      }
    };
  }

  private async createBundleResult(bundle: OutputBundle): Promise<any> {
    // Convert Rollup bundle to our bundle result format
    const bundles = Object.entries(bundle)
      .filter(([_, chunk]) => chunk.type === 'chunk')
      .map(([fileName, chunk]) => ({
        filePath: fileName,
        sources: [fileName],
        size: (chunk as OutputChunk).code.length,
        dependencies: this.extractDependencies(chunk as OutputChunk),
        framework: this.detectFramework(chunk as OutputChunk),
        type: 'component' as const
      }));

    return { bundles, buildTime: 0, warnings: [], analysis: {} };
  }

  private extractDependencies(chunk: OutputChunk): string[] {
    const deps = new Set<string>();
    if (chunk.imports) chunk.imports.forEach(imp => deps.add(imp));
    if (chunk.dynamicImports) chunk.dynamicImports.forEach(imp => deps.add(imp));
    return Array.from(deps);
  }

  private detectFramework(chunk: OutputChunk): string {
    const code = chunk.code.toLowerCase();
    if (code.includes('react')) return 'reactjs';
    if (code.includes('vue')) return 'vue';
    if (code.includes('solid')) return 'solid';
    if (code.includes('svelte')) return 'svelte';
    return 'unknown';
  }

  private estimateDependencySize(dep: string): number {
    // Rough size estimates for common dependencies
    const sizeMap: { [key: string]: number } = {
      'react': 45 * 1024,
      'react-dom': 130 * 1024,
      'vue': 85 * 1024,
      'solid-js': 25 * 1024,
      'svelte': 15 * 1024,
      'lodash': 70 * 1024,
      'axios': 15 * 1024
    };
    
    return sizeMap[dep] || 10 * 1024; // Default 10KB
  }

  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private generateVersion(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
  }

  private createDefaultHTTP2Manifest(bundles: OptimizedBundle[]): HTTP2OptimizationManifest {
    return {
      maxConcurrentRequests: 6,
      optimalChunkSize: 100 * 1024,
      serverPushEnabled: false,
      pushManifest: {},
      loadingSequence: {}
    };
  }

  private createDefaultCacheManifest(bundles: OptimizedBundle[], sharedChunks: SharedDependencyChunk[]): CacheStrategyManifest {
    const strategies: any = {};
    
    bundles.forEach(bundle => {
      strategies[bundle.name] = {
        strategy: 'stale-while-revalidate',
        maxAge: 24 * 60 * 60 * 1000,
        updateStrategy: 'background',
        invalidationTriggers: []
      };
    });

    return {
      version: this.generateVersion(),
      strategies,
      versioningStrategy: 'hash',
      globalInvalidationRules: {}
    };
  }

  private async optimizeChunkSizesForHTTP2(bundles: OptimizedBundle[], optimalSize: number): Promise<OptimizedBundle[]> {
    // For now, return bundles as-is. In a full implementation, this would
    // split or merge bundles to match optimal HTTP/2 chunk sizes
    return bundles;
  }

  private calculateSharedDependencySavings(sharedChunks: SharedDependencyChunk[], bundles: OptimizedBundle[]): number {
    // Calculate how much space is saved by extracting shared dependencies
    let savings = 0;
    
    for (const chunk of sharedChunks) {
      const frameworkCount = chunk.frameworks.length;
      if (frameworkCount > 1) {
        // Each additional framework would have duplicated these dependencies
        savings += chunk.size * (frameworkCount - 1);
      }
    }
    
    return savings;
  }

  private estimateLoadTime(bundles: OptimizedBundle[], sharedChunks: SharedDependencyChunk[], protocol: 'http1' | 'http2'): number {
    const totalSize = bundles.reduce((sum, b) => sum + b.compressedSize, 0) +
                     sharedChunks.reduce((sum, c) => sum + c.compressedSize, 0);
    
    // Rough estimates based on protocol capabilities
    if (protocol === 'http2') {
      // HTTP/2 can load multiple resources in parallel
      const maxParallel = 6;
      const totalRequests = bundles.length + sharedChunks.length;
      const rounds = Math.ceil(totalRequests / maxParallel);
      return (totalSize / 1024) * 2 * rounds; // ~2ms per KB per round
    } else {
      // HTTP/1.1 is more sequential
      const totalRequests = bundles.length + sharedChunks.length;
      return (totalSize / 1024) * 3 + totalRequests * 100; // ~3ms per KB + 100ms per request
    }
  }

  private estimateCacheHitRate(bundles: OptimizedBundle[], sharedChunks: SharedDependencyChunk[]): number {
    // Estimate cache hit rate based on bundle characteristics
    let totalWeight = 0;
    let cacheableWeight = 0;
    
    for (const bundle of bundles) {
      totalWeight += bundle.size;
      
      if (bundle.type === 'core' || bundle.type === 'shared') {
        cacheableWeight += bundle.size * 0.9; // High cache hit rate for stable bundles
      } else if (bundle.type === 'adapter') {
        cacheableWeight += bundle.size * 0.7; // Medium cache hit rate
      } else {
        cacheableWeight += bundle.size * 0.5; // Lower cache hit rate for utility bundles
      }
    }
    
    for (const chunk of sharedChunks) {
      totalWeight += chunk.size;
      cacheableWeight += chunk.size * 0.95; // Very high cache hit rate for shared chunks
    }
    
    return totalWeight > 0 ? cacheableWeight / totalWeight : 0.7;
  }

  private calculateParallelLoadingEfficiency(bundles: OptimizedBundle[]): number {
    // Calculate how efficiently bundles can be loaded in parallel
    const criticalBundles = bundles.filter(b => b.priority === 'critical');
    const totalBundles = bundles.length;
    
    if (totalBundles === 0) return 1.0;
    
    // Efficiency is higher when critical bundles are smaller and more parallelizable
    const criticalRatio = criticalBundles.length / totalBundles;
    const avgCriticalSize = criticalBundles.reduce((sum, b) => sum + b.size, 0) / Math.max(criticalBundles.length, 1);
    
    // Smaller critical bundles and more parallel bundles = higher efficiency
    const sizeEfficiency = Math.max(0, 1 - (avgCriticalSize / (200 * 1024))); // Penalty for >200KB critical bundles
    const parallelEfficiency = Math.min(1, totalBundles / 6); // Optimal around 6 parallel requests
    
    return (sizeEfficiency * 0.6) + (parallelEfficiency * 0.4);
  }

  private estimateCacheHitRate(bundles: OptimizedBundle[], sharedChunks: SharedDependencyChunk[]): number {
    let totalWeight = 0;
    let cacheableWeight = 0;
    
    for (const bundle of bundles) {
      totalWeight += bundle.size;
      
      if (bundle.type === 'core' || bundle.type === 'shared') {
        cacheableWeight += bundle.size * 0.9; // 90% hit rate for stable bundles
      } else {
        cacheableWeight += bundle.size * 0.6; // 60% hit rate for dynamic bundles
      }
    }
    
    for (const chunk of sharedChunks) {
      totalWeight += chunk.size;
      cacheableWeight += chunk.size * 0.95; // 95% hit rate for shared chunks
    }
    
    return totalWeight > 0 ? cacheableWeight / totalWeight : 0;
  }

  private calculateParallelLoadingEfficiency(bundles: OptimizedBundle[]): number {
    // Calculate how efficiently bundles can be loaded in parallel
    const criticalBundles = bundles.filter(b => b.priority === 'critical').length;
    const totalBundles = bundles.length;
    
    // More critical bundles that can load in parallel = higher efficiency
    const parallelizationRatio = Math.min(criticalBundles / 6, 1); // Max 6 parallel requests
    const sizeVariance = this.calculateSizeVariance(bundles);
    
    // Lower size variance = better parallel loading
    const sizeEfficiency = Math.max(0, 1 - sizeVariance);
    
    return (parallelizationRatio + sizeEfficiency) / 2;
  }

  private calculateSizeVariance(bundles: OptimizedBundle[]): number {
    if (bundles.length === 0) return 0;
    
    const sizes = bundles.map(b => b.size);
    const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length;
    
    // Normalize variance to 0-1 range
    return Math.min(variance / (mean * mean), 1);
  }
}