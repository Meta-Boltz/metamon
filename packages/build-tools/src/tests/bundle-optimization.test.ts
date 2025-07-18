/**
 * Bundle Optimization Tests
 * 
 * Comprehensive tests for the bundle optimization system including:
 * - Intelligent bundling with shared dependency extraction
 * - Framework-specific chunk splitting for optimal caching
 * - Bundle analysis and size optimization for HTTP/2 multiplexing
 * - Cache strategy optimization for maximum hit rates
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  BundleOptimizationOrchestrator,
  BundleOptimizer,
  SharedDependencyExtractor,
  HTTP2MultiplexingOptimizer,
  CacheStrategyOptimizer,
  createBundleOptimizer,
  optimizeBundle
} from '../bundle-optimization/index.js';

describe('Bundle Optimization System', () => {
  let mockBundle: any;
  let orchestrator: BundleOptimizationOrchestrator;

  beforeEach(() => {
    // Create mock bundle data
    mockBundle = {
      'main.js': {
        type: 'chunk',
        code: 'import React from "react"; import { render } from "react-dom"; console.log("main");',
        imports: ['react', 'react-dom'],
        dynamicImports: [],
        size: 50000
      },
      'vue-component.js': {
        type: 'chunk',
        code: 'import Vue from "vue"; import axios from "axios"; console.log("vue");',
        imports: ['vue', 'axios'],
        dynamicImports: [],
        size: 30000
      },
      'shared-utils.js': {
        type: 'chunk',
        code: 'import lodash from "lodash"; import axios from "axios"; console.log("utils");',
        imports: ['lodash', 'axios'],
        dynamicImports: [],
        size: 20000
      },
      'svelte-component.js': {
        type: 'chunk',
        code: 'import { onMount } from "svelte"; import axios from "axios"; console.log("svelte");',
        imports: ['svelte', 'axios'],
        dynamicImports: [],
        size: 15000
      }
    };

    orchestrator = createBundleOptimizer();
  });

  describe('BundleOptimizationOrchestrator', () => {
    it('should create orchestrator with default configuration', () => {
      expect(orchestrator).toBeInstanceOf(BundleOptimizationOrchestrator);
    });

    it('should perform comprehensive bundle optimization', async () => {
      const result = await orchestrator.optimize(mockBundle);

      expect(result).toBeDefined();
      expect(result.bundleOptimization).toBeDefined();
      expect(result.sharedDependencyExtraction).toBeDefined();
      expect(result.http2Optimization).toBeDefined();
      expect(result.cacheOptimization).toBeDefined();
      expect(result.overallMetrics).toBeDefined();
      expect(result.finalBundleManifest).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.performanceReport).toBeDefined();
    });

    it('should generate meaningful optimization metrics', async () => {
      const result = await orchestrator.optimize(mockBundle);

      expect(result.overallMetrics.totalSizeReduction).toBeGreaterThanOrEqual(0);
      expect(result.overallMetrics.estimatedLoadTimeImprovement).toBeGreaterThanOrEqual(0);
      expect(result.overallMetrics.cacheEfficiencyImprovement).toBeGreaterThan(0);
      expect(result.overallMetrics.parallelLoadingImprovement).toBeGreaterThan(0);
    });

    it('should provide categorized recommendations', async () => {
      const result = await orchestrator.optimize(mockBundle);

      expect(result.recommendations.critical).toBeInstanceOf(Array);
      expect(result.recommendations.important).toBeInstanceOf(Array);
      expect(result.recommendations.optional).toBeInstanceOf(Array);
    });

    it('should generate performance report with before/after comparison', async () => {
      const result = await orchestrator.optimize(mockBundle);

      expect(result.performanceReport.beforeOptimization).toBeDefined();
      expect(result.performanceReport.afterOptimization).toBeDefined();
      expect(result.performanceReport.improvements).toBeDefined();
      
      expect(result.performanceReport.beforeOptimization.totalSize).toBeGreaterThan(0);
      expect(result.performanceReport.afterOptimization.totalSize).toBeLessThanOrEqual(
        result.performanceReport.beforeOptimization.totalSize
      );
    });
  });

  describe('BundleOptimizer', () => {
    it('should optimize bundle structure with intelligent bundling', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      const optimizer = new BundleOptimizer(config.bundleOptimization);
      
      const result = await optimizer.optimize(mockBundle);

      expect(result.bundles).toBeInstanceOf(Array);
      expect(result.sharedChunks).toBeInstanceOf(Array);
      expect(result.cacheManifest).toBeDefined();
      expect(result.http2Manifest).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should extract shared dependencies when enabled', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      config.bundleOptimization.sharedDependencies.enabled = true;
      const optimizer = new BundleOptimizer(config.bundleOptimization);
      
      const result = await optimizer.optimize(mockBundle);

      // Should identify axios as shared dependency (used in multiple bundles)
      expect(result.sharedChunks.length).toBeGreaterThan(0);
      
      const sharedDeps = result.sharedChunks.flatMap(chunk => chunk.dependencies);
      expect(sharedDeps).toContain('axios');
    });

    it('should apply framework-specific optimizations', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      config.bundleOptimization.frameworkOptimization.enabled = true;
      const optimizer = new BundleOptimizer(config.bundleOptimization);
      
      const result = await optimizer.optimize(mockBundle);

      // Should have different preload strategies for different frameworks
      const reactBundle = result.bundles.find(b => b.framework === 'react');
      const vueBundle = result.bundles.find(b => b.framework === 'vue');
      
      if (reactBundle && vueBundle) {
        expect(reactBundle.preloadStrategy).toBe('aggressive');
        expect(vueBundle.preloadStrategy).toBe('conservative');
      }
    });

    it('should generate cache strategies for optimal hit rates', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      const optimizer = new BundleOptimizer(config.bundleOptimization);
      
      const result = await optimizer.optimize(mockBundle);

      expect(result.cacheManifest.strategies).toBeDefined();
      expect(Object.keys(result.cacheManifest.strategies).length).toBeGreaterThan(0);
      
      // Should have different cache strategies based on bundle characteristics
      const strategies = Object.values(result.cacheManifest.strategies);
      const cacheFirstStrategies = strategies.filter(s => s.strategy === 'cache-first');
      const networkFirstStrategies = strategies.filter(s => s.strategy === 'network-first');
      
      expect(cacheFirstStrategies.length + networkFirstStrategies.length).toBeGreaterThan(0);
    });
  });

  describe('SharedDependencyExtractor', () => {
    it('should identify shared dependencies across frameworks', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      const extractor = new SharedDependencyExtractor(config.sharedDependencyExtraction);
      
      const bundles = Object.entries(mockBundle).map(([name, chunk]) => ({
        name,
        dependencies: (chunk as any).imports || [],
        size: (chunk as any).size || 0
      }));
      
      const result = await extractor.extract(bundles);

      expect(result.sharedChunks).toBeInstanceOf(Array);
      expect(result.modifiedBundles).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
      
      // Should identify axios as shared (used in 3 bundles)
      const sharedDeps = result.sharedChunks.flatMap(chunk => 
        chunk.dependencies.map(d => d.name)
      );
      expect(sharedDeps).toContain('axios');
    });

    it('should calculate extraction benefits correctly', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      const extractor = new SharedDependencyExtractor(config.sharedDependencyExtraction);
      
      const bundles = Object.entries(mockBundle).map(([name, chunk]) => ({
        name,
        dependencies: (chunk as any).imports || [],
        size: (chunk as any).size || 0
      }));
      
      const result = await extractor.extract(bundles);

      expect(result.metrics.totalSizeReduction).toBeGreaterThanOrEqual(0);
      expect(result.metrics.duplicateCodeEliminated).toBeGreaterThanOrEqual(0);
      expect(result.metrics.cacheEfficiencyImprovement).toBeGreaterThanOrEqual(0);
    });

    it('should respect priority dependencies configuration', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      config.sharedDependencyExtraction.priorityDependencies = ['react'];
      const extractor = new SharedDependencyExtractor(config.sharedDependencyExtraction);
      
      const bundles = [{
        name: 'single-react-bundle',
        dependencies: ['react'], // Only used in one bundle
        size: 50000
      }];
      
      const result = await extractor.extract(bundles);

      // Should extract react even though it's only used in one bundle (priority dependency)
      const sharedDeps = result.sharedChunks.flatMap(chunk => 
        chunk.dependencies.map(d => d.name)
      );
      expect(sharedDeps).toContain('react');
    });
  });

  describe('HTTP2MultiplexingOptimizer', () => {
    it('should optimize bundles for HTTP/2 multiplexing', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      const optimizer = new HTTP2MultiplexingOptimizer(config.http2Optimization);
      
      const bundles = Object.entries(mockBundle).map(([name, chunk]) => ({
        name,
        size: (chunk as any).size || 0,
        dependencies: (chunk as any).imports || []
      }));
      
      const result = await optimizer.optimize(bundles, []);

      expect(result.loadingSequences).toBeInstanceOf(Array);
      expect(result.serverPushManifest).toBeDefined();
      expect(result.bundleOptimizations).toBeDefined();
      expect(result.performanceProjections).toBeDefined();
      expect(result.resourceHints).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should create optimal loading sequences by priority', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      const optimizer = new HTTP2MultiplexingOptimizer(config.http2Optimization);
      
      const bundles = Object.entries(mockBundle).map(([name, chunk]) => ({
        name,
        size: (chunk as any).size || 0,
        dependencies: (chunk as any).imports || []
      }));
      
      const result = await optimizer.optimize(bundles, []);

      // Should have sequences ordered by priority
      const phases = result.loadingSequences.map(seq => seq.phase);
      expect(phases).toContain('critical');
      expect(phases).toContain('high');
      
      // Critical phase should come first
      const criticalIndex = phases.indexOf('critical');
      const highIndex = phases.indexOf('high');
      if (criticalIndex !== -1 && highIndex !== -1) {
        expect(criticalIndex).toBeLessThan(highIndex);
      }
    });

    it('should generate server push manifest when enabled', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      config.http2Optimization.serverPush.enabled = true;
      const optimizer = new HTTP2MultiplexingOptimizer(config.http2Optimization);
      
      const bundles = Object.entries(mockBundle).map(([name, chunk]) => ({
        name,
        size: (chunk as any).size || 0,
        dependencies: (chunk as any).imports || []
      }));
      
      const result = await optimizer.optimize(bundles, []);

      expect(Object.keys(result.serverPushManifest).length).toBeGreaterThan(0);
      
      // Should have root route push configuration
      expect(result.serverPushManifest['/']).toBeDefined();
    });

    it('should calculate performance projections', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      const optimizer = new HTTP2MultiplexingOptimizer(config.http2Optimization);
      
      const bundles = Object.entries(mockBundle).map(([name, chunk]) => ({
        name,
        size: (chunk as any).size || 0,
        dependencies: (chunk as any).imports || []
      }));
      
      const result = await optimizer.optimize(bundles, []);

      expect(result.performanceProjections.estimatedLoadTime.http1).toBeGreaterThan(0);
      expect(result.performanceProjections.estimatedLoadTime.http2).toBeGreaterThan(0);
      expect(result.performanceProjections.estimatedLoadTime.improvement).toBeGreaterThanOrEqual(0);
      expect(result.performanceProjections.parallelLoadingEfficiency).toBeGreaterThan(0);
      expect(result.performanceProjections.bandwidthUtilization).toBeGreaterThan(0);
    });
  });

  describe('CacheStrategyOptimizer', () => {
    it('should optimize cache strategies for maximum hit rates', async () => {
      const optimizer = new CacheStrategyOptimizer();
      
      const bundles = Object.entries(mockBundle).map(([name, chunk]) => ({
        name,
        size: (chunk as any).size || 0,
        dependencies: (chunk as any).imports || []
      }));
      
      const result = await optimizer.optimize(bundles, []);

      expect(result.strategies).toBeInstanceOf(Array);
      expect(result.globalRules).toBeDefined();
      expect(result.performanceProjections).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should assign appropriate cache strategies based on bundle characteristics', async () => {
      const optimizer = new CacheStrategyOptimizer();
      
      const bundles = [
        { name: 'vendor.js', size: 200000, framework: 'unknown', type: 'vendor' },
        { name: 'main.js', size: 50000, framework: 'react', type: 'main' },
        { name: 'chunk.js', size: 30000, framework: 'vue', type: 'chunk' }
      ];
      
      const result = await optimizer.optimize(bundles, []);

      // Vendor bundles should typically use cache-first strategy
      const vendorStrategy = result.strategies.find(s => s.bundleName === 'vendor.js');
      expect(vendorStrategy?.strategy).toBe('cache-first');
      
      // Should have different max ages based on bundle characteristics
      const strategies = result.strategies;
      const maxAges = strategies.map(s => s.maxAge);
      expect(new Set(maxAges).size).toBeGreaterThan(1); // Should have variety
    });

    it('should calculate realistic performance projections', async () => {
      const optimizer = new CacheStrategyOptimizer();
      
      const bundles = Object.entries(mockBundle).map(([name, chunk]) => ({
        name,
        size: (chunk as any).size || 0,
        dependencies: (chunk as any).imports || []
      }));
      
      const result = await optimizer.optimize(bundles, []);

      expect(result.performanceProjections.estimatedHitRate).toBeGreaterThan(0);
      expect(result.performanceProjections.estimatedHitRate).toBeLessThanOrEqual(1);
      expect(result.performanceProjections.estimatedLoadTimeReduction).toBeGreaterThanOrEqual(0);
      expect(result.performanceProjections.estimatedBandwidthSavings).toBeGreaterThanOrEqual(0);
      expect(result.performanceProjections.cacheEfficiencyScore).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    it('should work with the convenience function optimizeBundle', async () => {
      const result = await optimizeBundle(mockBundle);

      expect(result).toBeDefined();
      expect(result.overallMetrics.totalSizeReduction).toBeGreaterThanOrEqual(0);
      expect(result.finalBundleManifest.bundles.length).toBeGreaterThan(0);
    });

    it('should handle custom configuration overrides', async () => {
      const customConfig = {
        bundleOptimization: {
          sharedDependencies: {
            enabled: false,
            minSharedCount: 1,
            maxSharedChunkSize: 100 * 1024,
            priorityDependencies: []
          }
        }
      };

      const result = await optimizeBundle(mockBundle, customConfig);

      // With shared dependencies disabled, should have no shared chunks
      expect(result.sharedDependencyExtraction.sharedChunks.length).toBe(0);
    });

    it('should provide comprehensive recommendations across all optimizers', async () => {
      const result = await orchestrator.optimize(mockBundle);

      const allRecommendations = [
        ...result.recommendations.critical,
        ...result.recommendations.important,
        ...result.recommendations.optional
      ];

      expect(allRecommendations.length).toBeGreaterThan(0);
      
      // Should have recommendations from different optimizers
      const hasSharedDepRecommendation = allRecommendations.some(r => 
        r.toLowerCase().includes('shared') || r.toLowerCase().includes('dependency')
      );
      const hasCacheRecommendation = allRecommendations.some(r => 
        r.toLowerCase().includes('cache') || r.toLowerCase().includes('hit')
      );
      
      expect(hasSharedDepRecommendation || hasCacheRecommendation).toBe(true);
    });

    it('should maintain bundle integrity after optimization', async () => {
      const result = await orchestrator.optimize(mockBundle);

      // Total size should be accounted for
      const originalSize = Object.values(mockBundle).reduce((sum, chunk: any) => sum + (chunk.size || 0), 0);
      const optimizedSize = result.finalBundleManifest.bundles.reduce((sum, bundle) => sum + bundle.size, 0) +
                           result.finalBundleManifest.sharedChunks.reduce((sum, chunk) => sum + chunk.size, 0);

      // Optimized size should be less than or equal to original (due to shared dependency extraction)
      expect(optimizedSize).toBeLessThanOrEqual(originalSize);
    });
  });

  describe('Performance Targets', () => {
    it('should respect performance targets in configuration', async () => {
      const config = BundleOptimizationOrchestrator.createDefaultConfig();
      config.performanceTargets.maxInitialBundleSize = 100 * 1024; // 100KB
      config.performanceTargets.targetCacheHitRate = 0.9;
      
      const customOrchestrator = new BundleOptimizationOrchestrator(config);
      const result = await customOrchestrator.optimize(mockBundle);

      // Should provide recommendations if targets are not met
      const sizeRecommendations = result.recommendations.critical.filter(r => 
        r.toLowerCase().includes('size') || r.toLowerCase().includes('split')
      );
      
      // If any bundle exceeds the target, should have size-related recommendations
      const largeBundles = result.finalBundleManifest.bundles.filter(b => 
        b.size > config.performanceTargets.maxInitialBundleSize
      );
      
      if (largeBundles.length > 0) {
        expect(sizeRecommendations.length).toBeGreaterThan(0);
      }
    });

    it('should track performance improvements against targets', async () => {
      const result = await orchestrator.optimize(mockBundle);

      expect(result.performanceReport.improvements.sizeReduction).toBeGreaterThanOrEqual(0);
      expect(result.performanceReport.improvements.loadTimeReduction).toBeGreaterThanOrEqual(0);
      expect(result.performanceReport.improvements.cacheImprovement).toBeGreaterThanOrEqual(0);
    });
  });
});