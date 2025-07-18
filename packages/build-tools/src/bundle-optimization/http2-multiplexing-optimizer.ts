/**
 * HTTP/2 Multiplexing Optimizer
 * 
 * Optimizes bundle sizes and loading strategies for HTTP/2 multiplexing,
 * server push, and parallel loading efficiency
 */

export interface HTTP2OptimizationConfig {
  // Multiplexing settings
  maxConcurrentStreams: number;
  optimalChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  
  // Server push configuration
  serverPush: {
    enabled: boolean;
    criticalResourceThreshold: number;
    maxPushResources: number;
    pushPriorityMap: {
      [resourceType: string]: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
    };
  };
  
  // Loading optimization
  loadingOptimization: {
    enablePreload: boolean;
    enablePrefetch: boolean;
    priorityHints: boolean;
    resourceHints: boolean;
  };
}

export interface HTTP2BundleMetrics {
  bundleName: string;
  size: number;
  compressedSize: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
  framework: string;
  type: string;
  dependencies: string[];
  estimatedLoadTime: number;
  parallelLoadingScore: number;
}

export interface HTTP2LoadingSequence {
  phase: 'critical' | 'high' | 'normal' | 'low';
  bundles: string[];
  maxParallel: number;
  estimatedTime: number;
  serverPushCandidates: string[];
}

export interface HTTP2OptimizationResult {
  // Optimized loading sequences
  loadingSequences: HTTP2LoadingSequence[];
  
  // Server push manifest
  serverPushManifest: {
    [route: string]: {
      resources: string[];
      priority: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
      condition: string;
      size: number;
    };
  };
  
  // Bundle size recommendations
  bundleOptimizations: {
    [bundleName: string]: {
      currentSize: number;
      recommendedSize: number;
      splitRecommendation?: {
        chunks: number;
        strategy: 'size-based' | 'dependency-based' | 'usage-based';
      };
    };
  };
  
  // Performance projections
  performanceProjections: {
    estimatedLoadTime: {
      http1: number;
      http2: number;
      improvement: number;
    };
    parallelLoadingEfficiency: number;
    serverPushBenefit: number;
    bandwidthUtilization: number;
  };
  
  // Resource hints
  resourceHints: {
    preload: string[];
    prefetch: string[];
    preconnect: string[];
    dnsPrefetch: string[];
  };
  
  recommendations: string[];
}

/**
 * HTTP/2 Multiplexing Optimizer
 */
export class HTTP2MultiplexingOptimizer {
  private config: HTTP2OptimizationConfig;
  private bundleMetrics: Map<string, HTTP2BundleMetrics> = new Map();

  constructor(config: HTTP2OptimizationConfig) {
    this.config = config;
  }

  /**
   * Optimize bundles for HTTP/2 multiplexing
   */
  async optimize(bundles: any[], sharedChunks: any[]): Promise<HTTP2OptimizationResult> {
    // Analyze bundles for HTTP/2 characteristics
    await this.analyzeBundlesForHTTP2(bundles, sharedChunks);

    // Create optimal loading sequences
    const loadingSequences = this.createLoadingSequences();

    // Generate server push manifest
    const serverPushManifest = this.generateServerPushManifest();

    // Create bundle size optimizations
    const bundleOptimizations = this.createBundleOptimizations();

    // Calculate performance projections
    const performanceProjections = this.calculatePerformanceProjections();

    // Generate resource hints
    const resourceHints = this.generateResourceHints();

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      loadingSequences,
      serverPushManifest,
      bundleOptimizations,
      performanceProjections,
      resourceHints,
      recommendations
    };
  }

  /**
   * Analyze bundles for HTTP/2 optimization characteristics
   */
  private async analyzeBundlesForHTTP2(bundles: any[], sharedChunks: any[]): Promise<void> {
    // Analyze regular bundles
    for (const bundle of bundles) {
      const metrics: HTTP2BundleMetrics = {
        bundleName: bundle.name || bundle.fileName,
        size: bundle.size || 0,
        compressedSize: bundle.compressedSize || Math.floor((bundle.size || 0) * 0.3),
        priority: this.determinePriority(bundle),
        framework: this.detectFramework(bundle),
        type: this.determineBundleType(bundle),
        dependencies: bundle.dependencies || [],
        estimatedLoadTime: this.estimateLoadTime(bundle),
        parallelLoadingScore: this.calculateParallelLoadingScore(bundle)
      };

      this.bundleMetrics.set(bundle.name || bundle.fileName, metrics);
    }

    // Analyze shared chunks
    for (const chunk of sharedChunks) {
      const metrics: HTTP2BundleMetrics = {
        bundleName: chunk.name || chunk.fileName,
        size: chunk.size || 0,
        compressedSize: chunk.compressedSize || Math.floor((chunk.size || 0) * 0.3),
        priority: 'high', // Shared chunks are typically high priority
        framework: 'shared',
        type: 'shared-chunk',
        dependencies: chunk.dependencies || [],
        estimatedLoadTime: this.estimateLoadTime(chunk),
        parallelLoadingScore: 0.9 // Shared chunks have high parallel loading benefit
      };

      this.bundleMetrics.set(chunk.name || chunk.fileName, metrics);
    }
  }

  /**
   * Create optimal loading sequences for HTTP/2
   */
  private createLoadingSequences(): HTTP2LoadingSequence[] {
    const sequences: HTTP2LoadingSequence[] = [];
    const bundlesByPriority = this.groupBundlesByPriority();

    // Create sequences for each priority level
    for (const [priority, bundles] of Object.entries(bundlesByPriority)) {
      const maxParallel = this.calculateOptimalParallelism(bundles, priority as any);
      const estimatedTime = this.estimateSequenceTime(bundles, maxParallel);
      const serverPushCandidates = this.identifyServerPushCandidates(bundles);

      sequences.push({
        phase: priority as any,
        bundles: bundles.map(b => b.bundleName),
        maxParallel,
        estimatedTime,
        serverPushCandidates
      });
    }

    return sequences.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.phase] - priorityOrder[b.phase];
    });
  }

  /**
   * Generate server push manifest for optimal resource delivery
   */
  private generateServerPushManifest(): {
    [route: string]: {
      resources: string[];
      priority: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
      condition: string;
      size: number;
    };
  } {
    if (!this.config.serverPush.enabled) {
      return {};
    }

    const manifest: any = {};
    const criticalBundles = Array.from(this.bundleMetrics.values())
      .filter(b => b.priority === 'critical' && b.size <= this.config.serverPush.criticalResourceThreshold);

    // Root route - push critical resources
    if (criticalBundles.length > 0) {
      const totalSize = criticalBundles.reduce((sum, b) => sum + b.compressedSize, 0);
      manifest['/'] = {
        resources: criticalBundles.slice(0, this.config.serverPush.maxPushResources).map(b => b.bundleName),
        priority: 'highest',
        condition: 'initial-load',
        size: totalSize
      };
    }

    // Framework-specific routes
    const frameworkGroups = this.groupBundlesByFramework();
    for (const [framework, bundles] of Object.entries(frameworkGroups)) {
      if (framework === 'shared') continue;

      const frameworkCritical = bundles.filter(b => b.priority === 'critical' || b.priority === 'high');
      if (frameworkCritical.length > 0) {
        const totalSize = frameworkCritical.reduce((sum, b) => sum + b.compressedSize, 0);
        manifest[`/${framework}/*`] = {
          resources: frameworkCritical.map(b => b.bundleName),
          priority: 'high',
          condition: `framework === '${framework}'`,
          size: totalSize
        };
      }
    }

    return manifest;
  }

  /**
   * Create bundle size optimization recommendations
   */
  private createBundleOptimizations(): {
    [bundleName: string]: {
      currentSize: number;
      recommendedSize: number;
      splitRecommendation?: {
        chunks: number;
        strategy: 'size-based' | 'dependency-based' | 'usage-based';
      };
    };
  } {
    const optimizations: any = {};

    for (const [bundleName, metrics] of this.bundleMetrics) {
      const currentSize = metrics.size;
      let recommendedSize = currentSize;
      let splitRecommendation: any = undefined;

      // Check if bundle exceeds optimal size for HTTP/2
      if (currentSize > this.config.maxChunkSize) {
        const chunks = Math.ceil(currentSize / this.config.optimalChunkSize);
        recommendedSize = this.config.optimalChunkSize;
        
        splitRecommendation = {
          chunks,
          strategy: this.determineSplitStrategy(metrics)
        };
      } else if (currentSize < this.config.minChunkSize && metrics.priority !== 'critical') {
        // Consider merging small bundles
        recommendedSize = this.config.minChunkSize;
      }

      if (recommendedSize !== currentSize || splitRecommendation) {
        optimizations[bundleName] = {
          currentSize,
          recommendedSize,
          splitRecommendation
        };
      }
    }

    return optimizations;
  }

  /**
   * Calculate performance projections for HTTP/2 optimization
   */
  private calculatePerformanceProjections(): {
    estimatedLoadTime: { http1: number; http2: number; improvement: number };
    parallelLoadingEfficiency: number;
    serverPushBenefit: number;
    bandwidthUtilization: number;
  } {
    const totalSize = Array.from(this.bundleMetrics.values()).reduce((sum, m) => sum + m.compressedSize, 0);
    const totalBundles = this.bundleMetrics.size;

    // Estimate HTTP/1.1 load time (sequential with limited parallelism)
    const http1LoadTime = this.estimateHTTP1LoadTime(totalSize, totalBundles);

    // Estimate HTTP/2 load time (parallel with multiplexing)
    const http2LoadTime = this.estimateHTTP2LoadTime();

    // Calculate improvement
    const improvement = (http1LoadTime - http2LoadTime) / http1LoadTime;

    // Calculate parallel loading efficiency
    const parallelLoadingEfficiency = this.calculateOverallParallelEfficiency();

    // Estimate server push benefit
    const serverPushBenefit = this.config.serverPush.enabled ? this.estimateServerPushBenefit() : 0;

    // Calculate bandwidth utilization
    const bandwidthUtilization = this.calculateBandwidthUtilization();

    return {
      estimatedLoadTime: {
        http1: http1LoadTime,
        http2: http2LoadTime,
        improvement
      },
      parallelLoadingEfficiency,
      serverPushBenefit,
      bandwidthUtilization
    };
  }

  /**
   * Generate resource hints for optimal loading
   */
  private generateResourceHints(): {
    preload: string[];
    prefetch: string[];
    preconnect: string[];
    dnsPrefetch: string[];
  } {
    const hints = {
      preload: [] as string[],
      prefetch: [] as string[],
      preconnect: [] as string[],
      dnsPrefetch: [] as string[]
    };

    if (!this.config.loadingOptimization.resourceHints) {
      return hints;
    }

    // Preload critical resources
    if (this.config.loadingOptimization.enablePreload) {
      const criticalBundles = Array.from(this.bundleMetrics.values())
        .filter(b => b.priority === 'critical')
        .sort((a, b) => a.size - b.size) // Smaller first for faster loading
        .slice(0, 5); // Limit to avoid overloading

      hints.preload = criticalBundles.map(b => b.bundleName);
    }

    // Prefetch likely-needed resources
    if (this.config.loadingOptimization.enablePrefetch) {
      const highPriorityBundles = Array.from(this.bundleMetrics.values())
        .filter(b => b.priority === 'high' && b.parallelLoadingScore > 0.7)
        .slice(0, 3);

      hints.prefetch = highPriorityBundles.map(b => b.bundleName);
    }

    return hints;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Bundle size recommendations
    const largeBundles = Array.from(this.bundleMetrics.values())
      .filter(b => b.size > this.config.maxChunkSize);
    
    if (largeBundles.length > 0) {
      recommendations.push(`Split ${largeBundles.length} large bundles (>${Math.floor(this.config.maxChunkSize / 1024)}KB) for better HTTP/2 performance`);
    }

    // Parallel loading recommendations
    const lowParallelBundles = Array.from(this.bundleMetrics.values())
      .filter(b => b.parallelLoadingScore < 0.5);
    
    if (lowParallelBundles.length > 0) {
      recommendations.push('Optimize bundle dependencies to improve parallel loading efficiency');
    }

    // Server push recommendations
    if (this.config.serverPush.enabled) {
      const pushCandidates = Array.from(this.bundleMetrics.values())
        .filter(b => b.priority === 'critical' && b.size <= this.config.serverPush.criticalResourceThreshold);
      
      if (pushCandidates.length > this.config.serverPush.maxPushResources) {
        recommendations.push('Consider increasing server push resource limit or reducing critical bundle sizes');
      }
    } else {
      recommendations.push('Enable HTTP/2 server push for critical resources to improve initial load time');
    }

    // Compression recommendations
    const totalSize = Array.from(this.bundleMetrics.values()).reduce((sum, m) => sum + m.size, 0);
    const totalCompressed = Array.from(this.bundleMetrics.values()).reduce((sum, m) => sum + m.compressedSize, 0);
    const compressionRatio = totalCompressed / totalSize;

    if (compressionRatio > 0.4) {
      recommendations.push('Improve compression ratio - consider Brotli compression or better minification');
    }

    return recommendations;
  }

  // Helper methods
  private determinePriority(bundle: any): 'critical' | 'high' | 'normal' | 'low' {
    const name = bundle.name || bundle.fileName || '';
    const type = this.determineBundleType(bundle);
    
    if (type === 'main' || name.includes('critical')) return 'critical';
    if (type === 'vendor' || name.includes('core')) return 'high';
    if (type === 'chunk') return 'normal';
    return 'low';
  }

  private detectFramework(bundle: any): string {
    const name = bundle.name || bundle.fileName || '';
    if (name.includes('react')) return 'react';
    if (name.includes('vue')) return 'vue';
    if (name.includes('svelte')) return 'svelte';
    if (name.includes('solid')) return 'solid';
    return 'unknown';
  }

  private determineBundleType(bundle: any): string {
    const name = bundle.name || bundle.fileName || '';
    if (name.includes('vendor')) return 'vendor';
    if (name.includes('chunk')) return 'chunk';
    if (name.includes('main') || name.includes('index')) return 'main';
    return 'other';
  }

  private estimateLoadTime(bundle: any): number {
    const size = bundle.compressedSize || bundle.size || 0;
    // Estimate based on typical connection speeds (assuming 10 Mbps)
    return Math.floor(size / (10 * 1024 * 1024 / 8) * 1000); // Convert to milliseconds
  }

  private calculateParallelLoadingScore(bundle: any): number {
    const dependencies = bundle.dependencies || [];
    const size = bundle.size || 0;
    
    // Score based on independence (fewer dependencies = higher score)
    let score = Math.max(0, 1 - (dependencies.length / 10));
    
    // Adjust for size (smaller bundles load better in parallel)
    if (size < this.config.optimalChunkSize) {
      score += 0.2;
    } else if (size > this.config.maxChunkSize) {
      score -= 0.3;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private groupBundlesByPriority(): { [priority: string]: HTTP2BundleMetrics[] } {
    const groups: { [priority: string]: HTTP2BundleMetrics[] } = {
      critical: [],
      high: [],
      normal: [],
      low: []
    };

    for (const metrics of this.bundleMetrics.values()) {
      groups[metrics.priority].push(metrics);
    }

    return groups;
  }

  private groupBundlesByFramework(): { [framework: string]: HTTP2BundleMetrics[] } {
    const groups: { [framework: string]: HTTP2BundleMetrics[] } = {};

    for (const metrics of this.bundleMetrics.values()) {
      if (!groups[metrics.framework]) {
        groups[metrics.framework] = [];
      }
      groups[metrics.framework].push(metrics);
    }

    return groups;
  }

  private calculateOptimalParallelism(bundles: HTTP2BundleMetrics[], priority: string): number {
    const baseConcurrency = Math.min(this.config.maxConcurrentStreams, bundles.length);
    
    // Adjust based on priority
    if (priority === 'critical') return Math.min(baseConcurrency, 4); // Limit critical to avoid overwhelming
    if (priority === 'high') return Math.min(baseConcurrency, 6);
    if (priority === 'normal') return Math.min(baseConcurrency, 8);
    return baseConcurrency;
  }

  private estimateSequenceTime(bundles: HTTP2BundleMetrics[], maxParallel: number): number {
    if (bundles.length === 0) return 0;
    
    const rounds = Math.ceil(bundles.length / maxParallel);
    const avgLoadTime = bundles.reduce((sum, b) => sum + b.estimatedLoadTime, 0) / bundles.length;
    
    return rounds * avgLoadTime;
  }

  private identifyServerPushCandidates(bundles: HTTP2BundleMetrics[]): string[] {
    if (!this.config.serverPush.enabled) return [];
    
    return bundles
      .filter(b => b.size <= this.config.serverPush.criticalResourceThreshold)
      .slice(0, this.config.serverPush.maxPushResources)
      .map(b => b.bundleName);
  }

  private determineSplitStrategy(metrics: HTTP2BundleMetrics): 'size-based' | 'dependency-based' | 'usage-based' {
    if (metrics.dependencies.length > 10) return 'dependency-based';
    if (metrics.type === 'main') return 'usage-based';
    return 'size-based';
  }

  private estimateHTTP1LoadTime(totalSize: number, totalBundles: number): number {
    // HTTP/1.1 with limited parallelism (typically 6 connections)
    const maxParallel = 6;
    const rounds = Math.ceil(totalBundles / maxParallel);
    const avgBundleSize = totalSize / totalBundles;
    const timePerBundle = avgBundleSize / (1024 * 1024) * 1000; // ~1s per MB
    
    return rounds * timePerBundle;
  }

  private estimateHTTP2LoadTime(): number {
    const sequences = this.createLoadingSequences();
    return sequences.reduce((total, seq) => total + seq.estimatedTime, 0);
  }

  private calculateOverallParallelEfficiency(): number {
    const scores = Array.from(this.bundleMetrics.values()).map(m => m.parallelLoadingScore);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private estimateServerPushBenefit(): number {
    const criticalBundles = Array.from(this.bundleMetrics.values())
      .filter(b => b.priority === 'critical');
    
    if (criticalBundles.length === 0) return 0;
    
    // Estimate time saved by pushing critical resources
    const avgCriticalLoadTime = criticalBundles.reduce((sum, b) => sum + b.estimatedLoadTime, 0) / criticalBundles.length;
    return Math.min(0.3, avgCriticalLoadTime / 1000); // Max 30% improvement
  }

  private calculateBandwidthUtilization(): number {
    const totalSize = Array.from(this.bundleMetrics.values()).reduce((sum, m) => sum + m.compressedSize, 0);
    const optimalParallelism = Math.min(this.config.maxConcurrentStreams, this.bundleMetrics.size);
    
    // Higher utilization with more parallel streams and optimal chunk sizes
    const sizeEfficiency = Math.min(1, totalSize / (this.config.optimalChunkSize * optimalParallelism));
    const parallelEfficiency = optimalParallelism / this.config.maxConcurrentStreams;
    
    return (sizeEfficiency * 0.6) + (parallelEfficiency * 0.4);
  }
}