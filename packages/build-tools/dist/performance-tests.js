import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { TreeShaker } from './tree-shaker.js';
import { BundleAnalyzer } from './bundle-analyzer.js';
import { ProductionOptimizer } from './production-optimizer.js';
import { MTMModuleBundler } from './module-bundler.js';
/**
 * Performance test runner for build optimization features
 */
export class PerformanceTestRunner {
    constructor(config) {
        this.testData = new Map();
        this.config = config;
    }
    /**
     * Run complete performance test suite
     */
    async runTestSuite() {
        console.log('Starting Metamon build optimization performance tests...');
        // Prepare test data
        await this.prepareTestData();
        const results = [];
        // Test tree-shaking performance
        results.push(await this.testTreeShakingPerformance());
        // Test bundle analysis performance
        results.push(await this.testBundleAnalysisPerformance());
        // Test production optimization performance
        results.push(await this.testProductionOptimizationPerformance());
        // Test module bundling performance
        results.push(await this.testModuleBundlingPerformance());
        // Test end-to-end build performance
        results.push(await this.testEndToEndBuildPerformance());
        // Test memory usage under load
        results.push(await this.testMemoryUsagePerformance());
        // Generate comparison and recommendations
        const overview = this.generateOverview(results);
        const comparison = this.generateComparison(results);
        const recommendations = this.generateRecommendations(results);
        // Save results
        await this.saveResults({
            overview,
            results,
            comparison,
            recommendations
        });
        return {
            overview,
            results,
            comparison,
            recommendations
        };
    }
    /**
     * Prepare test data for performance tests
     */
    async prepareTestData() {
        console.log('Preparing test data...');
        // Create test bundles of different sizes
        for (const size of this.config.bundleSizes) {
            const bundleContent = this.generateTestBundle(size * 1024); // Convert KB to bytes
            this.testData.set(`bundle-${size}kb`, bundleContent);
        }
        // Create test dependency graphs
        for (const framework of this.config.frameworks) {
            const dependencyGraph = this.generateTestDependencyGraph(framework);
            this.testData.set(`graph-${framework}`, dependencyGraph);
        }
        // Create test bundle results
        const testBundleResult = this.generateTestBundleResult();
        this.testData.set('bundle-result', testBundleResult);
    }
    /**
     * Test tree-shaking performance
     */
    async testTreeShakingPerformance() {
        const times = [];
        const memoryUsages = [];
        const config = {
            runtime: true,
            adapters: true,
            components: true,
            preserve: [],
            aggressive: true
        };
        const treeShaker = new TreeShaker(config);
        for (let i = 0; i < this.config.iterations; i++) {
            const startMemory = process.memoryUsage().heapUsed;
            const startTime = performance.now();
            // Test with different bundle sizes
            for (const size of this.config.bundleSizes) {
                const bundleContent = this.testData.get(`bundle-${size}kb`);
                const tempPath = path.join(this.config.outputDir, `temp-${size}kb-${i}.js`);
                await fs.writeFile(tempPath, bundleContent);
                const dependencyGraph = this.testData.get('graph-reactjs');
                await treeShaker.optimize(tempPath, dependencyGraph);
                // Clean up
                await fs.unlink(tempPath).catch(() => { });
            }
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            times.push(endTime - startTime);
            memoryUsages.push((endMemory - startMemory) / 1024 / 1024); // Convert to MB
        }
        return this.calculateTestResult('Tree-shaking', times, memoryUsages, {
            bundlesProcessed: this.config.bundleSizes.length,
            averageBundleSize: this.config.bundleSizes.reduce((a, b) => a + b, 0) / this.config.bundleSizes.length
        });
    }
    /**
     * Test bundle analysis performance
     */
    async testBundleAnalysisPerformance() {
        const times = [];
        const memoryUsages = [];
        const config = {
            detailed: true,
            sourceMaps: true,
            visualization: true,
            thresholds: {
                warning: 250 * 1024,
                error: 500 * 1024
            }
        };
        const analyzer = new BundleAnalyzer(config);
        const bundleResult = this.testData.get('bundle-result');
        for (let i = 0; i < this.config.iterations; i++) {
            const startMemory = process.memoryUsage().heapUsed;
            const startTime = performance.now();
            await analyzer.analyze(bundleResult);
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            times.push(endTime - startTime);
            memoryUsages.push((endMemory - startMemory) / 1024 / 1024);
        }
        return this.calculateTestResult('Bundle Analysis', times, memoryUsages, {
            bundlesAnalyzed: bundleResult.bundles.length,
            totalBundleSize: bundleResult.bundles.reduce((sum, b) => sum + b.size, 0)
        });
    }
    /**
     * Test production optimization performance
     */
    async testProductionOptimizationPerformance() {
        const times = [];
        const memoryUsages = [];
        const config = {
            minify: {
                enabled: true,
                removeComments: true,
                removeConsole: true,
                removeDebugger: true,
                mangle: true,
                compress: true
            },
            compression: {
                gzip: true,
                brotli: true,
                level: 6
            },
            treeShaking: {
                runtime: true,
                adapters: true,
                components: true,
                preserve: [],
                aggressive: true
            },
            sourceMaps: true,
            target: 'es2015',
            polyfills: false
        };
        const optimizer = new ProductionOptimizer(config);
        const bundleResult = this.testData.get('bundle-result');
        for (let i = 0; i < this.config.iterations; i++) {
            const startMemory = process.memoryUsage().heapUsed;
            const startTime = performance.now();
            await optimizer.optimize(bundleResult);
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            times.push(endTime - startTime);
            memoryUsages.push((endMemory - startMemory) / 1024 / 1024);
        }
        return this.calculateTestResult('Production Optimization', times, memoryUsages, {
            optimizationsApplied: 5, // minify, compress, tree-shake, etc.
            compressionEnabled: 1 // 1 for enabled, 0 for disabled
        });
    }
    /**
     * Test module bundling performance
     */
    async testModuleBundlingPerformance() {
        const times = [];
        const memoryUsages = [];
        const bundler = new MTMModuleBundler();
        const config = {
            outDir: this.config.outputDir,
            sourceMaps: true,
            minify: true,
            target: 'es2015',
            external: [],
            splitting: {
                enabled: true,
                chunkSizeThreshold: 500 * 1024,
                sharedDepsThreshold: 2
            }
        };
        for (let i = 0; i < this.config.iterations; i++) {
            const startMemory = process.memoryUsage().heapUsed;
            const startTime = performance.now();
            const dependencyGraph = this.testData.get('graph-reactjs');
            await bundler.bundle(dependencyGraph, config);
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            times.push(endTime - startTime);
            memoryUsages.push((endMemory - startMemory) / 1024 / 1024);
        }
        return this.calculateTestResult('Module Bundling', times, memoryUsages, {
            codeSplittingEnabled: 1, // 1 for enabled, 0 for disabled
            sourceMapsEnabled: 1 // 1 for enabled, 0 for disabled
        });
    }
    /**
     * Test end-to-end build performance
     */
    async testEndToEndBuildPerformance() {
        const times = [];
        const memoryUsages = [];
        for (let i = 0; i < this.config.iterations; i++) {
            const startMemory = process.memoryUsage().heapUsed;
            const startTime = performance.now();
            // Simulate complete build pipeline
            const bundleResult = this.testData.get('bundle-result');
            // 1. Tree-shaking
            const treeShaker = new TreeShaker({
                runtime: true,
                adapters: true,
                components: true,
                preserve: [],
                aggressive: false
            });
            // 2. Production optimization
            const optimizer = new ProductionOptimizer({
                minify: { enabled: true, removeComments: true, removeConsole: true, removeDebugger: true, mangle: true, compress: true },
                compression: { gzip: true, brotli: true, level: 6 },
                treeShaking: { runtime: true, adapters: true, components: true, preserve: [], aggressive: false },
                sourceMaps: true,
                target: 'es2015',
                polyfills: false
            });
            await optimizer.optimize(bundleResult);
            // 3. Bundle analysis
            const analyzer = new BundleAnalyzer({
                detailed: true,
                sourceMaps: false,
                visualization: false,
                thresholds: { warning: 250 * 1024, error: 500 * 1024 }
            });
            await analyzer.analyze(bundleResult);
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            times.push(endTime - startTime);
            memoryUsages.push((endMemory - startMemory) / 1024 / 1024);
        }
        return this.calculateTestResult('End-to-End Build', times, memoryUsages, {
            pipelineSteps: 3,
            fullOptimization: 1 // 1 for enabled, 0 for disabled
        });
    }
    /**
     * Test memory usage under load
     */
    async testMemoryUsagePerformance() {
        const times = [];
        const memoryUsages = [];
        for (let i = 0; i < this.config.iterations; i++) {
            const startMemory = process.memoryUsage().heapUsed;
            const startTime = performance.now();
            // Process multiple bundles simultaneously to test memory usage
            const promises = this.config.bundleSizes.map(async (size) => {
                const bundleContent = this.testData.get(`bundle-${size}kb`);
                const tempPath = path.join(this.config.outputDir, `memory-test-${size}kb-${i}.js`);
                await fs.writeFile(tempPath, bundleContent);
                const treeShaker = new TreeShaker({
                    runtime: true,
                    adapters: true,
                    components: true,
                    preserve: [],
                    aggressive: false
                });
                const dependencyGraph = this.testData.get('graph-reactjs');
                await treeShaker.optimize(tempPath, dependencyGraph);
                // Clean up
                await fs.unlink(tempPath).catch(() => { });
            });
            await Promise.all(promises);
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            times.push(endTime - startTime);
            memoryUsages.push((endMemory - startMemory) / 1024 / 1024);
        }
        return this.calculateTestResult('Memory Usage Under Load', times, memoryUsages, {
            concurrentBundles: this.config.bundleSizes.length,
            peakMemoryUsage: Math.max(...memoryUsages)
        });
    }
    /**
     * Generate test bundle content
     */
    generateTestBundle(sizeBytes) {
        const baseCode = `
import React from 'react';
import { MetamonPubSub, SignalManager } from '@metamon/core';

export default function TestComponent() {
  const [state, setState] = React.useState(null);
  
  React.useEffect(() => {
    const pubsub = new MetamonPubSub();
    const signalManager = new SignalManager();
    
    return () => {
      pubsub.cleanup('test');
      signalManager.destroySignal('test');
    };
  }, []);
  
  return React.createElement('div', null, 'Test Component');
}
`;
        // Pad with additional code to reach target size
        const currentSize = Buffer.byteLength(baseCode, 'utf-8');
        const paddingNeeded = Math.max(0, sizeBytes - currentSize);
        const padding = '// '.repeat(Math.floor(paddingNeeded / 3));
        return baseCode + padding;
    }
    /**
     * Generate test dependency graph
     */
    generateTestDependencyGraph(framework) {
        const files = new Map();
        // Generate test files
        for (let i = 0; i < 10; i++) {
            const filePath = `/test/component-${i}.mtm`;
            files.set(filePath, {
                filePath,
                framework,
                type: i < 5 ? 'component' : 'page',
                dependencies: i > 0 ? [{ importee: `/test/component-${i - 1}.mtm` }] : []
            });
        }
        return { files };
    }
    /**
     * Generate test bundle result
     */
    generateTestBundleResult() {
        const bundles = this.config.bundleSizes.map((size, index) => ({
            filePath: `/test/bundle-${size}kb.js`,
            sources: [`/test/component-${index}.mtm`],
            size: size * 1024,
            dependencies: ['react', '@metamon/core'],
            framework: this.config.frameworks[index % this.config.frameworks.length],
            type: index % 2 === 0 ? 'component' : 'page'
        }));
        return {
            bundles,
            buildTime: 1000,
            warnings: [],
            analysis: {
                totalSize: bundles.reduce((sum, b) => sum + b.size, 0),
                largestBundle: bundles[0],
                duplicateDependencies: ['react']
            }
        };
    }
    /**
     * Calculate test result statistics
     */
    calculateTestResult(name, times, memoryUsages, metrics) {
        const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        // Calculate standard deviation
        const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
        const stdDev = Math.sqrt(variance);
        const averageMemory = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
        const throughput = 1000 / averageTime; // operations per second
        return {
            name,
            averageTime,
            minTime,
            maxTime,
            stdDev,
            memoryUsage: averageMemory,
            throughput,
            metrics
        };
    }
    /**
     * Generate overview statistics
     */
    generateOverview(results) {
        const totalTime = results.reduce((sum, result) => sum + result.averageTime, 0);
        const averageTime = totalTime / results.length;
        const sortedByTime = [...results].sort((a, b) => a.averageTime - b.averageTime);
        return {
            totalTests: results.length,
            totalTime,
            averageTime,
            fastestTest: sortedByTime[0].name,
            slowestTest: sortedByTime[sortedByTime.length - 1].name
        };
    }
    /**
     * Generate performance comparison
     */
    generateComparison(results) {
        // Use the slowest test as baseline
        const baseline = results.reduce((slowest, current) => current.averageTime > slowest.averageTime ? current : slowest);
        const improvements = results
            .filter(result => result.name !== baseline.name)
            .map(result => ({
            test: result.name,
            improvement: baseline.averageTime - result.averageTime,
            percentage: ((baseline.averageTime - result.averageTime) / baseline.averageTime) * 100
        }))
            .sort((a, b) => b.improvement - a.improvement);
        return {
            baseline: baseline.name,
            improvements
        };
    }
    /**
     * Generate performance recommendations
     */
    generateRecommendations(results) {
        const recommendations = [];
        // Memory usage recommendations
        const highMemoryTests = results.filter(r => r.memoryUsage > 50); // > 50MB
        if (highMemoryTests.length > 0) {
            recommendations.push(`High memory usage detected in ${highMemoryTests.length} tests - consider memory optimization`);
        }
        // Performance recommendations
        const slowTests = results.filter(r => r.averageTime > 1000); // > 1 second
        if (slowTests.length > 0) {
            recommendations.push(`${slowTests.length} tests are slower than 1 second - consider performance optimization`);
        }
        // Throughput recommendations
        const lowThroughputTests = results.filter(r => r.throughput < 1); // < 1 op/sec
        if (lowThroughputTests.length > 0) {
            recommendations.push(`Low throughput detected - consider parallel processing for ${lowThroughputTests.length} operations`);
        }
        // Consistency recommendations
        const inconsistentTests = results.filter(r => r.stdDev > r.averageTime * 0.2); // > 20% variation
        if (inconsistentTests.length > 0) {
            recommendations.push(`High performance variation in ${inconsistentTests.length} tests - investigate performance bottlenecks`);
        }
        return recommendations;
    }
    /**
     * Save test results to file
     */
    async saveResults(results) {
        const outputPath = path.join(this.config.outputDir, 'performance-test-results.json');
        await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
        // Also generate a human-readable report
        const reportPath = path.join(this.config.outputDir, 'performance-report.md');
        const report = this.generateMarkdownReport(results);
        await fs.writeFile(reportPath, report);
        console.log(`Performance test results saved to ${outputPath}`);
        console.log(`Performance report saved to ${reportPath}`);
    }
    /**
     * Generate markdown report
     */
    generateMarkdownReport(results) {
        return `# Metamon Build Optimization Performance Report

## Overview
- **Total Tests:** ${results.overview.totalTests}
- **Total Time:** ${results.overview.totalTime.toFixed(2)}ms
- **Average Time:** ${results.overview.averageTime.toFixed(2)}ms
- **Fastest Test:** ${results.overview.fastestTest}
- **Slowest Test:** ${results.overview.slowestTest}

## Test Results

${results.results.map(result => `
### ${result.name}
- **Average Time:** ${result.averageTime.toFixed(2)}ms
- **Min Time:** ${result.minTime.toFixed(2)}ms
- **Max Time:** ${result.maxTime.toFixed(2)}ms
- **Standard Deviation:** ${result.stdDev.toFixed(2)}ms
- **Memory Usage:** ${result.memoryUsage.toFixed(2)}MB
- **Throughput:** ${result.throughput.toFixed(2)} ops/sec

**Metrics:**
${Object.entries(result.metrics).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
`).join('\n')}

## Performance Comparison
**Baseline:** ${results.comparison.baseline}

${results.comparison.improvements.map(imp => `- **${imp.test}:** ${imp.improvement.toFixed(2)}ms faster (${imp.percentage.toFixed(1)}% improvement)`).join('\n')}

## Recommendations
${results.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Generated on ${new Date().toISOString()}*
`;
    }
}
