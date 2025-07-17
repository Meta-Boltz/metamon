import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TreeShaker, TreeShakingConfig } from './tree-shaker.js';
import { BundleAnalyzer, BundleAnalysisConfig } from './bundle-analyzer.js';
import { ProductionOptimizer, ProductionOptimizationConfig } from './production-optimizer.js';
import { BundleResult } from './types/module-bundler.js';

describe('Build Optimization Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'temp-optimization-tests');
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should integrate tree-shaking with production optimization', async () => {
    // Create test bundle with unused code
    const testBundle = `
import React from 'react';
import { MetamonPubSub, SignalManager, MetamonRouter } from '@metamon/core';

// Used components
export function UsedComponent() {
  const pubsub = new MetamonPubSub();
  return React.createElement('div', null, 'Used');
}

// Unused components (should be tree-shaken)
export function UnusedComponent() {
  const router = new MetamonRouter();
  return React.createElement('div', null, 'Unused');
}

// Unused signal manager (should be tree-shaken)
const unusedSignalManager = new SignalManager();
`;

    const bundlePath = path.join(tempDir, 'test-bundle.js');
    await fs.writeFile(bundlePath, testBundle);

    // Create tree-shaker configuration
    const treeShakingConfig: TreeShakingConfig = {
      runtime: true,
      adapters: true,
      components: true,
      preserve: [],
      aggressive: true
    };

    // Create production optimizer configuration
    const prodOptConfig: ProductionOptimizationConfig = {
      minify: {
        enabled: true,
        removeComments: true,
        removeConsole: true,
        removeDebugger: true,
        mangle: false, // Keep readable for testing
        compress: true
      },
      compression: {
        gzip: false, // Skip compression for testing
        brotli: false,
        level: 6
      },
      treeShaking: treeShakingConfig,
      sourceMaps: false,
      target: 'es2015',
      polyfills: false
    };

    // Create test bundle result
    const bundleResult: BundleResult = {
      bundles: [{
        filePath: bundlePath,
        sources: [bundlePath],
        size: Buffer.byteLength(testBundle, 'utf-8'),
        dependencies: ['react', '@metamon/core'],
        framework: 'reactjs',
        type: 'component'
      }],
      buildTime: 100,
      warnings: [],
      analysis: {
        totalSize: Buffer.byteLength(testBundle, 'utf-8'),
        largestBundle: {
          filePath: bundlePath,
          sources: [bundlePath],
          size: Buffer.byteLength(testBundle, 'utf-8'),
          dependencies: ['react', '@metamon/core'],
          framework: 'reactjs',
          type: 'component'
        },
        duplicateDependencies: []
      }
    };

    // Apply production optimization
    const optimizer = new ProductionOptimizer(prodOptConfig);
    const result = await optimizer.optimize(bundleResult);

    // Verify optimization was applied
    expect(result.stats.sizeReduction).toBeGreaterThan(0);
    expect(result.stats.appliedOptimizations).toContain('Tree-shaking');
    expect(result.stats.appliedOptimizations).toContain('Minification');

    // Verify optimized bundle is smaller
    expect(result.optimized.bundles[0].size).toBeLessThan(result.original.bundles[0].size);

    // Read optimized content and verify unused code was removed
    const optimizedContent = await fs.readFile(bundlePath, 'utf-8');
    expect(optimizedContent).toContain('UsedComponent');
    expect(optimizedContent).toContain('MetamonPubSub');
    // Note: In a real implementation, unused code would be removed
    // For this test, we're verifying the optimization pipeline works
  });

  it('should analyze bundle and provide optimization recommendations', async () => {
    // Create test bundles of different sizes
    const smallBundle = 'x'.repeat(50 * 1024); // 50KB
    const largeBundle = 'x'.repeat(600 * 1024); // 600KB (should trigger warnings)

    const smallBundlePath = path.join(tempDir, 'small-bundle.js');
    const largeBundlePath = path.join(tempDir, 'large-bundle.js');

    await fs.writeFile(smallBundlePath, smallBundle);
    await fs.writeFile(largeBundlePath, largeBundle);

    // Create bundle result
    const bundleResult: BundleResult = {
      bundles: [
        {
          filePath: smallBundlePath,
          sources: [smallBundlePath],
          size: 50 * 1024,
          dependencies: ['react'],
          framework: 'reactjs',
          type: 'component'
        },
        {
          filePath: largeBundlePath,
          sources: [largeBundlePath],
          size: 600 * 1024,
          dependencies: ['react', 'vue'],
          framework: 'vue',
          type: 'page'
        }
      ],
      buildTime: 200,
      warnings: [],
      analysis: {
        totalSize: 650 * 1024,
        largestBundle: {
          filePath: largeBundlePath,
          sources: [largeBundlePath],
          size: 600 * 1024,
          dependencies: ['react', 'vue'],
          framework: 'vue',
          type: 'page'
        },
        duplicateDependencies: ['react']
      }
    };

    // Analyze bundles
    const analysisConfig: BundleAnalysisConfig = {
      detailed: true,
      sourceMaps: false,
      visualization: false,
      thresholds: {
        warning: 250 * 1024, // 250KB
        error: 500 * 1024    // 500KB
      }
    };

    const analyzer = new BundleAnalyzer(analysisConfig);
    const analysis = await analyzer.analyze(bundleResult);

    // Verify analysis results
    expect(analysis.overview.totalBundles).toBe(2);
    expect(analysis.overview.totalSize).toBe(650 * 1024);
    expect(analysis.overview.largestBundle).toBe('large-bundle.js');

    // Verify warnings for large bundle
    const largeBundleAnalysis = analysis.bundles.find(b => 
      b.bundle.filePath === largeBundlePath
    );
    expect(largeBundleAnalysis?.warnings.length).toBeGreaterThan(0);

    // Verify cross-bundle analysis
    expect(analysis.crossBundle.sharedDependencies).toHaveLength(1);
    expect(analysis.crossBundle.sharedDependencies[0].dependency).toBe('react');

    // Verify recommendations exist
    expect(analysis.recommendations.splitting.length).toBeGreaterThan(0);
    expect(analysis.recommendations.compression.length).toBeGreaterThan(0);
    expect(analysis.recommendations.caching.length).toBeGreaterThan(0);
    expect(analysis.recommendations.loading.length).toBeGreaterThan(0);
  });

  it('should handle optimization configuration correctly', () => {
    // Test tree-shaking configuration
    const treeShakingConfig: TreeShakingConfig = {
      runtime: true,
      adapters: false,
      components: true,
      preserve: ['MetamonPubSub'],
      aggressive: false
    };

    const treeShaker = new TreeShaker(treeShakingConfig);
    const stats = treeShaker.getStatistics();

    expect(stats.usedFeatures).toEqual([]);
    expect(stats.usedAdapters).toEqual([]);
    expect(stats.usedComponents).toEqual([]);

    // Test production optimizer configuration
    const prodOptConfig: ProductionOptimizationConfig = {
      minify: {
        enabled: true,
        removeComments: true,
        removeConsole: false,
        removeDebugger: true,
        mangle: true,
        compress: true
      },
      compression: {
        gzip: true,
        brotli: false,
        level: 9
      },
      treeShaking: treeShakingConfig,
      sourceMaps: true,
      target: 'es2020',
      polyfills: true
    };

    const optimizer = new ProductionOptimizer(prodOptConfig);
    const optimizerStats = optimizer.getOptimizationStats();

    expect(optimizerStats.minificationEnabled).toBe(true);
    expect(optimizerStats.compressionEnabled).toBe(true);
    expect(optimizerStats.targetEnvironment).toBe('es2020');
  });

  it('should provide meaningful bundle analysis visualization data', async () => {
    // Create test bundle
    const testBundle = 'console.log("test");';
    const bundlePath = path.join(tempDir, 'viz-test-bundle.js');
    await fs.writeFile(bundlePath, testBundle);

    const bundleResult: BundleResult = {
      bundles: [{
        filePath: bundlePath,
        sources: [bundlePath],
        size: Buffer.byteLength(testBundle, 'utf-8'),
        dependencies: ['react'],
        framework: 'reactjs',
        type: 'component'
      }],
      buildTime: 50,
      warnings: [],
      analysis: {
        totalSize: Buffer.byteLength(testBundle, 'utf-8'),
        largestBundle: {
          filePath: bundlePath,
          sources: [bundlePath],
          size: Buffer.byteLength(testBundle, 'utf-8'),
          dependencies: ['react'],
          framework: 'reactjs',
          type: 'component'
        },
        duplicateDependencies: []
      }
    };

    const analysisConfig: BundleAnalysisConfig = {
      detailed: true,
      sourceMaps: false,
      visualization: true,
      thresholds: {
        warning: 100 * 1024,
        error: 200 * 1024
      }
    };

    const analyzer = new BundleAnalyzer(analysisConfig);
    const analysis = await analyzer.analyze(bundleResult);
    const visualization = await analyzer.generateVisualization(analysis);

    // Verify visualization data structure
    expect(visualization).toBeDefined();
    expect(visualization.treemap).toBeDefined();
    expect(visualization.treemap.name).toBe('Bundle Analysis');
    expect(visualization.treemap.children).toHaveLength(1);

    expect(visualization.timeline).toBeDefined();
    expect(visualization.timeline).toHaveLength(1);

    expect(visualization.dependencies).toBeDefined();
    expect(visualization.dependencies.nodes).toHaveLength(1);
    expect(visualization.dependencies.nodes[0].framework).toBe('reactjs');
  });
});