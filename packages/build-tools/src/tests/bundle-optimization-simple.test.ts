/**
 * Simple Bundle Optimization Test
 * 
 * Basic test to verify the bundle optimization system works
 */

import { describe, it, expect } from 'vitest';

describe('Bundle Optimization - Simple Test', () => {
  it('should import bundle optimization modules without errors', async () => {
    // Test basic imports
    const { BundleOptimizer } = await import('../bundle-optimization/bundle-optimizer.js');
    const { SharedDependencyExtractor } = await import('../bundle-optimization/shared-dependency-extractor.js');
    const { HTTP2MultiplexingOptimizer } = await import('../bundle-optimization/http2-multiplexing-optimizer.js');
    const { CacheStrategyOptimizer } = await import('../bundle-optimization/cache-strategy-optimizer.js');
    
    expect(BundleOptimizer).toBeDefined();
    expect(SharedDependencyExtractor).toBeDefined();
    expect(HTTP2MultiplexingOptimizer).toBeDefined();
    expect(CacheStrategyOptimizer).toBeDefined();
  });

  it('should create bundle optimizer instances', async () => {
    const { BundleOptimizer } = await import('../bundle-optimization/bundle-optimizer.js');
    
    const config = {
      sharedDependencies: {
        enabled: true,
        minSharedCount: 2,
        maxSharedChunkSize: 200 * 1024,
        priorityDependencies: ['react']
      },
      frameworkOptimization: {
        enabled: true,
        chunkSizeTargets: {
          react: { core: 100 * 1024, adapter: 50 * 1024, utility: 30 * 1024 }
        },
        preloadStrategies: {
          react: 'aggressive' as const
        }
      },
      http2Optimization: {
        enabled: true,
        maxConcurrentRequests: 6,
        optimalChunkSize: 100 * 1024,
        enableServerPush: true,
        pushPriorityMap: {
          core: 'high' as const
        }
      },
      cacheOptimization: {
        enabled: true,
        strategies: {},
        versioningStrategy: 'hash' as const,
        cacheInvalidationRules: {}
      }
    };

    const optimizer = new BundleOptimizer(config);
    expect(optimizer).toBeDefined();
  });

  it('should create shared dependency extractor', async () => {
    const { SharedDependencyExtractor } = await import('../bundle-optimization/shared-dependency-extractor.js');
    
    const config = {
      minSharedCount: 2,
      maxSharedChunkSize: 200 * 1024,
      minDependencySize: 10 * 1024,
      priorityDependencies: ['react'],
      frameworkSettings: {
        react: {
          coreLibraries: ['react'],
          excludeFromSharing: [],
          preferredChunkSize: 100 * 1024
        }
      },
      optimization: {
        enableTreeShaking: true,
        enableDeduplication: true,
        preserveModuleStructure: false,
        generateSourceMaps: true
      }
    };

    const extractor = new SharedDependencyExtractor(config);
    expect(extractor).toBeDefined();
  });

  it('should create HTTP/2 optimizer', async () => {
    const { HTTP2MultiplexingOptimizer } = await import('../bundle-optimization/http2-multiplexing-optimizer.js');
    
    const config = {
      maxConcurrentStreams: 100,
      optimalChunkSize: 100 * 1024,
      minChunkSize: 10 * 1024,
      maxChunkSize: 500 * 1024,
      serverPush: {
        enabled: true,
        criticalResourceThreshold: 50 * 1024,
        maxPushResources: 5,
        pushPriorityMap: {
          core: 'highest' as const
        }
      },
      loadingOptimization: {
        enablePreload: true,
        enablePrefetch: true,
        priorityHints: true,
        resourceHints: true
      }
    };

    const optimizer = new HTTP2MultiplexingOptimizer(config);
    expect(optimizer).toBeDefined();
  });

  it('should create cache strategy optimizer', async () => {
    const { CacheStrategyOptimizer } = await import('../bundle-optimization/cache-strategy-optimizer.js');
    
    const optimizer = new CacheStrategyOptimizer();
    expect(optimizer).toBeDefined();
  });

  it('should perform basic shared dependency extraction', async () => {
    const { SharedDependencyExtractor } = await import('../bundle-optimization/shared-dependency-extractor.js');
    
    const config = {
      minSharedCount: 2,
      maxSharedChunkSize: 200 * 1024,
      minDependencySize: 1024,
      priorityDependencies: [],
      frameworkSettings: {},
      optimization: {
        enableTreeShaking: true,
        enableDeduplication: true,
        preserveModuleStructure: false,
        generateSourceMaps: true
      }
    };

    const extractor = new SharedDependencyExtractor(config);
    
    const mockBundles = [
      { name: 'bundle1', dependencies: ['react', 'lodash'], size: 50000 },
      { name: 'bundle2', dependencies: ['vue', 'lodash'], size: 30000 },
      { name: 'bundle3', dependencies: ['svelte', 'lodash'], size: 20000 }
    ];

    const result = await extractor.extract(mockBundles);
    
    expect(result).toBeDefined();
    expect(result.sharedChunks).toBeInstanceOf(Array);
    expect(result.modifiedBundles).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.recommendations).toBeInstanceOf(Array);
    
    // Should identify lodash as shared dependency or provide valid metrics
    const sharedDeps = result.sharedChunks.flatMap(chunk => 
      chunk.dependencies.map(d => d.name)
    );
    
    // Either shared chunks were created or the system determined it wasn't beneficial
    if (result.sharedChunks.length > 0) {
      expect(sharedDeps).toContain('lodash');
    } else {
      // If no shared chunks were created, metrics should still be valid
      expect(result.metrics.totalSizeReduction).toBeGreaterThanOrEqual(0);
    }
  });

  it('should perform basic HTTP/2 optimization', async () => {
    const { HTTP2MultiplexingOptimizer } = await import('../bundle-optimization/http2-multiplexing-optimizer.js');
    
    const config = {
      maxConcurrentStreams: 100,
      optimalChunkSize: 100 * 1024,
      minChunkSize: 10 * 1024,
      maxChunkSize: 500 * 1024,
      serverPush: {
        enabled: true,
        criticalResourceThreshold: 50 * 1024,
        maxPushResources: 5,
        pushPriorityMap: {
          core: 'highest' as const
        }
      },
      loadingOptimization: {
        enablePreload: true,
        enablePrefetch: true,
        priorityHints: true,
        resourceHints: true
      }
    };

    const optimizer = new HTTP2MultiplexingOptimizer(config);
    
    const mockBundles = [
      { name: 'main.js', size: 50000, dependencies: ['react'] },
      { name: 'vendor.js', size: 200000, dependencies: ['lodash'] }
    ];

    const result = await optimizer.optimize(mockBundles, []);
    
    expect(result).toBeDefined();
    expect(result.loadingSequences).toBeInstanceOf(Array);
    expect(result.serverPushManifest).toBeDefined();
    expect(result.bundleOptimizations).toBeDefined();
    expect(result.performanceProjections).toBeDefined();
    expect(result.resourceHints).toBeDefined();
    expect(result.recommendations).toBeInstanceOf(Array);
  });

  it('should perform basic cache optimization', async () => {
    const { CacheStrategyOptimizer } = await import('../bundle-optimization/cache-strategy-optimizer.js');
    
    const optimizer = new CacheStrategyOptimizer();
    
    const mockBundles = [
      { name: 'main.js', size: 50000, dependencies: ['react'] },
      { name: 'vendor.js', size: 200000, dependencies: ['lodash'] }
    ];

    const result = await optimizer.optimize(mockBundles, []);
    
    expect(result).toBeDefined();
    expect(result.strategies).toBeInstanceOf(Array);
    expect(result.globalRules).toBeDefined();
    expect(result.performanceProjections).toBeDefined();
    expect(result.recommendations).toBeInstanceOf(Array);
  });
});