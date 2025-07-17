#!/usr/bin/env node

import * as fs from 'fs/promises';
import * as path from 'path';
import { PerformanceTestRunner, PerformanceTestConfig } from './performance-tests.js';
import { BundleAnalyzer, BundleAnalysisConfig } from './bundle-analyzer.js';
import { ProductionOptimizer, ProductionOptimizationConfig } from './production-optimizer.js';
import { BundleResult } from './types/module-bundler.js';

/**
 * CLI for Metamon build optimization tools
 */
class MetamonBuildCLI {
  private args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async run(): Promise<void> {
    const command = this.args[0];

    switch (command) {
      case 'analyze':
        await this.runBundleAnalysis();
        break;
      case 'optimize':
        await this.runProductionOptimization();
        break;
      case 'perf-test':
        await this.runPerformanceTests();
        break;
      case 'help':
      case '--help':
      case '-h':
        this.showHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        this.showHelp();
        process.exit(1);
    }
  }

  private async runBundleAnalysis(): Promise<void> {
    console.log('🔍 Running bundle analysis...');

    const bundleDir = this.args[1] || './dist';
    const outputDir = this.args[2] || './analysis';

    try {
      // Find bundle files
      const bundleFiles = await this.findBundleFiles(bundleDir);
      
      if (bundleFiles.length === 0) {
        console.error(`No bundle files found in ${bundleDir}`);
        process.exit(1);
      }

      console.log(`Found ${bundleFiles.length} bundle files`);

      // Create bundle result from files
      const bundleResult = await this.createBundleResultFromFiles(bundleFiles);

      // Configure analyzer
      const config: BundleAnalysisConfig = {
        detailed: true,
        sourceMaps: true,
        visualization: true,
        thresholds: {
          warning: 250 * 1024, // 250KB
          error: 500 * 1024    // 500KB
        }
      };

      const analyzer = new BundleAnalyzer(config);
      const analysis = await analyzer.analyze(bundleResult);

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Save analysis results
      const analysisPath = path.join(outputDir, 'bundle-analysis.json');
      await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2));

      // Generate visualization data
      const visualization = await analyzer.generateVisualization(analysis);
      if (visualization) {
        const vizPath = path.join(outputDir, 'bundle-visualization.json');
        await fs.writeFile(vizPath, JSON.stringify(visualization, null, 2));
      }

      // Print summary
      console.log('\n📊 Bundle Analysis Summary:');
      console.log(`  Total bundles: ${analysis.overview.totalBundles}`);
      console.log(`  Total size: ${Math.floor(analysis.overview.totalSize / 1024)}KB`);
      console.log(`  Largest bundle: ${analysis.overview.largestBundle}`);
      console.log(`  Smallest bundle: ${analysis.overview.smallestBundle}`);

      if (analysis.crossBundle.optimizationOpportunities.length > 0) {
        console.log('\n💡 Optimization opportunities:');
        analysis.crossBundle.optimizationOpportunities.forEach(opp => {
          console.log(`  - ${opp}`);
        });
      }

      console.log(`\n✅ Analysis complete! Results saved to ${outputDir}`);

    } catch (error) {
      console.error('❌ Bundle analysis failed:', error);
      process.exit(1);
    }
  }

  private async runProductionOptimization(): Promise<void> {
    console.log('⚡ Running production optimization...');

    const bundleDir = this.args[1] || './dist';
    const configFile = this.args[2];

    try {
      // Find bundle files
      const bundleFiles = await this.findBundleFiles(bundleDir);
      
      if (bundleFiles.length === 0) {
        console.error(`No bundle files found in ${bundleDir}`);
        process.exit(1);
      }

      // Load configuration
      let config: ProductionOptimizationConfig;
      if (configFile && await fs.access(configFile).then(() => true).catch(() => false)) {
        const configContent = await fs.readFile(configFile, 'utf-8');
        config = JSON.parse(configContent);
      } else {
        // Default configuration
        config = {
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
            aggressive: false
          },
          sourceMaps: false,
          target: 'es2015',
          polyfills: false
        };
      }

      // Create bundle result
      const bundleResult = await this.createBundleResultFromFiles(bundleFiles);

      // Apply optimization
      const optimizer = new ProductionOptimizer(config);
      const result = await optimizer.optimize(bundleResult);

      // Print results
      console.log('\n🎯 Optimization Results:');
      console.log(`  Size reduction: ${Math.floor(result.stats.sizeReduction / 1024)}KB`);
      console.log(`  Reduction percentage: ${result.stats.reductionPercentage.toFixed(1)}%`);
      console.log(`  Optimization time: ${result.stats.optimizationTime}ms`);
      console.log(`  Applied optimizations: ${result.stats.appliedOptimizations.join(', ')}`);

      if (result.compressed) {
        console.log('\n📦 Compression Results:');
        if (result.compressed.gzip) {
          console.log(`  Gzip: ${(result.compressed.gzip.ratio * 100).toFixed(1)}% reduction`);
        }
        if (result.compressed.brotli) {
          console.log(`  Brotli: ${(result.compressed.brotli.ratio * 100).toFixed(1)}% reduction`);
        }
      }

      console.log('\n✅ Optimization complete!');

    } catch (error) {
      console.error('❌ Production optimization failed:', error);
      process.exit(1);
    }
  }

  private async runPerformanceTests(): Promise<void> {
    console.log('🏃 Running performance tests...');

    const outputDir = this.args[1] || './perf-results';

    try {
      const config: PerformanceTestConfig = {
        iterations: 5,
        bundleSizes: [10, 50, 100, 250], // KB
        frameworks: ['reactjs', 'vue', 'solid', 'svelte'],
        detailed: true,
        outputDir
      };

      const testRunner = new PerformanceTestRunner(config);
      const results = await testRunner.runTestSuite();

      // Print summary
      console.log('\n🏁 Performance Test Results:');
      console.log(`  Total tests: ${results.overview.totalTests}`);
      console.log(`  Total time: ${results.overview.totalTime.toFixed(2)}ms`);
      console.log(`  Average time: ${results.overview.averageTime.toFixed(2)}ms`);
      console.log(`  Fastest test: ${results.overview.fastestTest}`);
      console.log(`  Slowest test: ${results.overview.slowestTest}`);

      if (results.comparison.improvements.length > 0) {
        console.log('\n📈 Performance Improvements:');
        results.comparison.improvements.slice(0, 3).forEach(imp => {
          console.log(`  - ${imp.test}: ${imp.percentage.toFixed(1)}% faster`);
        });
      }

      if (results.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        results.recommendations.forEach(rec => {
          console.log(`  - ${rec}`);
        });
      }

      console.log(`\n✅ Performance tests complete! Results saved to ${outputDir}`);

    } catch (error) {
      console.error('❌ Performance tests failed:', error);
      process.exit(1);
    }
  }

  private async findBundleFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.findBundleFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  private async createBundleResultFromFiles(bundleFiles: string[]): Promise<BundleResult> {
    const bundles = await Promise.all(
      bundleFiles.map(async (filePath) => {
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Extract dependencies from content (simple heuristic)
        const dependencies = this.extractDependencies(content);
        
        // Determine framework from filename or content
        const framework = this.determineFramework(filePath, content);
        
        // Determine type from path
        const type = filePath.includes('/pages/') || filePath.includes('\\pages\\') ? 'page' : 'component';

        return {
          filePath,
          sources: [filePath],
          size: stats.size,
          dependencies,
          framework,
          type: type as 'page' | 'component'
        };
      })
    );

    const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0);
    const largestBundle = bundles.reduce((largest, current) => 
      current.size > largest.size ? current : largest, bundles[0]);

    return {
      bundles,
      buildTime: 0,
      warnings: [],
      analysis: {
        totalSize,
        largestBundle,
        duplicateDependencies: this.findDuplicateDependencies(bundles)
      }
    };
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const dep = match[1];
      if (!dep.startsWith('.') && !dep.startsWith('/')) {
        dependencies.push(dep);
      }
    }

    return [...new Set(dependencies)];
  }

  private determineFramework(filePath: string, content: string): string {
    const filename = path.basename(filePath).toLowerCase();
    
    if (filename.includes('react') || content.includes('React.')) {
      return 'reactjs';
    }
    if (filename.includes('vue') || content.includes('Vue.')) {
      return 'vue';
    }
    if (filename.includes('solid') || content.includes('solid-js')) {
      return 'solid';
    }
    if (filename.includes('svelte') || content.includes('svelte')) {
      return 'svelte';
    }
    
    return 'unknown';
  }

  private findDuplicateDependencies(bundles: any[]): string[] {
    const dependencyCount = new Map<string, number>();
    
    bundles.forEach(bundle => {
      bundle.dependencies.forEach((dep: string) => {
        const count = dependencyCount.get(dep) || 0;
        dependencyCount.set(dep, count + 1);
      });
    });

    return Array.from(dependencyCount.entries())
      .filter(([dep, count]) => count > 1)
      .map(([dep]) => dep);
  }

  private showHelp(): void {
    console.log(`
🚀 Metamon Build Optimization CLI

Usage:
  metamon-build <command> [options]

Commands:
  analyze <bundle-dir> [output-dir]     Analyze bundle sizes and dependencies
  optimize <bundle-dir> [config-file]   Apply production optimizations
  perf-test [output-dir]                Run performance benchmarks
  help                                  Show this help message

Examples:
  metamon-build analyze ./dist ./analysis
  metamon-build optimize ./dist ./metamon.config.json
  metamon-build perf-test ./perf-results

For more information, visit: https://github.com/metamon/metamon
`);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new MetamonBuildCLI(process.argv.slice(2));
  cli.run().catch(error => {
    console.error('CLI error:', error);
    process.exit(1);
  });
}

export { MetamonBuildCLI };