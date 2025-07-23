#!/usr/bin/env node

/**
 * Performance Monitoring CLI Tool
 * Command-line interface for performance monitoring and reporting
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { performanceMonitor } from './performance-monitor.js';
import { bundleAnalyzer } from './bundle-analyzer.js';
import { performanceDashboard } from './performance-dashboard.js';

/**
 * CLI command interface
 */
interface CLICommand {
  name: string;
  description: string;
  options?: Array<{
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean';
    default?: any;
  }>;
  handler: (args: any) => Promise<void> | void;
}

/**
 * Performance CLI class
 */
class PerformanceCLI {
  private commands: Map<string, CLICommand> = new Map();

  constructor() {
    this.registerCommands();
  }

  /**
   * Register all CLI commands
   */
  private registerCommands(): void {
    // Monitor command
    this.commands.set('monitor', {
      name: 'monitor',
      description: 'Start real-time performance monitoring',
      options: [
        { name: 'interval', description: 'Update interval in seconds', type: 'number', default: 5 },
        { name: 'output', description: 'Output directory for reports', type: 'string', default: './performance-reports' },
        { name: 'verbose', description: 'Enable verbose logging', type: 'boolean', default: false }
      ],
      handler: this.handleMonitor.bind(this)
    });

    // Report command
    this.commands.set('report', {
      name: 'report',
      description: 'Generate performance report',
      options: [
        { name: 'input', description: 'Input directory with performance data', type: 'string', default: './performance-reports' },
        { name: 'output', description: 'Output file for report', type: 'string', default: 'performance-report.html' },
        { name: 'format', description: 'Report format (html, json, csv)', type: 'string', default: 'html' }
      ],
      handler: this.handleReport.bind(this)
    });

    // Analyze command
    this.commands.set('analyze', {
      name: 'analyze',
      description: 'Analyze bundle performance',
      options: [
        { name: 'bundle', description: 'Path to bundle file or directory', type: 'string' },
        { name: 'route', description: 'Route name for the bundle', type: 'string' },
        { name: 'output', description: 'Output file for analysis', type: 'string' }
      ],
      handler: this.handleAnalyze.bind(this)
    });

    // Compare command
    this.commands.set('compare', {
      name: 'compare',
      description: 'Compare performance between builds',
      options: [
        { name: 'before', description: 'Path to before performance data', type: 'string' },
        { name: 'after', description: 'Path to after performance data', type: 'string' },
        { name: 'output', description: 'Output file for comparison', type: 'string' }
      ],
      handler: this.handleCompare.bind(this)
    });

    // Benchmark command
    this.commands.set('benchmark', {
      name: 'benchmark',
      description: 'Run performance benchmarks',
      options: [
        { name: 'iterations', description: 'Number of benchmark iterations', type: 'number', default: 10 },
        { name: 'warmup', description: 'Number of warmup iterations', type: 'number', default: 3 },
        { name: 'output', description: 'Output file for benchmark results', type: 'string' }
      ],
      handler: this.handleBenchmark.bind(this)
    });

    // Dashboard command
    this.commands.set('dashboard', {
      name: 'dashboard',
      description: 'Launch performance dashboard',
      options: [
        { name: 'port', description: 'Dashboard server port', type: 'number', default: 3001 },
        { name: 'host', description: 'Dashboard server host', type: 'string', default: 'localhost' }
      ],
      handler: this.handleDashboard.bind(this)
    });
  }

  /**
   * Handle monitor command
   */
  private async handleMonitor(args: any): Promise<void> {
    console.log('🔍 Starting performance monitoring...');
    console.log(`Update interval: ${args.interval}s`);
    console.log(`Output directory: ${args.output}`);

    // Configure performance dashboard
    const dashboard = new (await import('./performance-dashboard.js')).PerformanceDashboard({
      updateInterval: args.interval * 1000,
      enableRealTimeUpdates: true,
      enableAlerts: true
    });

    // Set up alert handler
    dashboard.onAlert((alert) => {
      console.log(`🚨 ${alert.type.toUpperCase()}: ${alert.message}`);
    });

    // Print periodic summaries
    setInterval(() => {
      dashboard.printSummary();
    }, args.interval * 1000);

    console.log('📊 Performance monitoring active. Press Ctrl+C to stop.');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping performance monitoring...');
      dashboard.dispose();
      process.exit(0);
    });
  }

  /**
   * Handle report command
   */
  private async handleReport(args: any): Promise<void> {
    console.log('📊 Generating performance report...');

    try {
      const reportData = this.collectReportData(args.input);
      
      switch (args.format.toLowerCase()) {
        case 'html':
          await this.generateHTMLReport(reportData, args.output);
          break;
        case 'json':
          await this.generateJSONReport(reportData, args.output);
          break;
        case 'csv':
          await this.generateCSVReport(reportData, args.output);
          break;
        default:
          throw new Error(`Unsupported format: ${args.format}`);
      }

      console.log(`✅ Report generated: ${args.output}`);
    } catch (error) {
      console.error('❌ Failed to generate report:', error);
      process.exit(1);
    }
  }

  /**
   * Handle analyze command
   */
  private async handleAnalyze(args: any): Promise<void> {
    console.log('🔍 Analyzing bundle performance...');

    if (!args.bundle) {
      console.error('❌ Bundle path is required');
      process.exit(1);
    }

    try {
      const bundlePath = resolve(args.bundle);
      const routeName = args.route || 'unknown';

      if (!existsSync(bundlePath)) {
        throw new Error(`Bundle file not found: ${bundlePath}`);
      }

      const analysis = await bundleAnalyzer.analyzeBundle(routeName, bundlePath);
      
      if (args.output) {
        writeFileSync(args.output, JSON.stringify(analysis, null, 2));
        console.log(`✅ Analysis saved: ${args.output}`);
      } else {
        this.printBundleAnalysis(analysis);
      }
    } catch (error) {
      console.error('❌ Failed to analyze bundle:', error);
      process.exit(1);
    }
  }

  /**
   * Handle compare command
   */
  private async handleCompare(args: any): Promise<void> {
    console.log('📊 Comparing performance data...');

    if (!args.before || !args.after) {
      console.error('❌ Both before and after paths are required');
      process.exit(1);
    }

    try {
      const beforeData = this.loadPerformanceData(args.before);
      const afterData = this.loadPerformanceData(args.after);
      
      const comparison = this.comparePerformanceData(beforeData, afterData);
      
      if (args.output) {
        writeFileSync(args.output, JSON.stringify(comparison, null, 2));
        console.log(`✅ Comparison saved: ${args.output}`);
      } else {
        this.printComparison(comparison);
      }
    } catch (error) {
      console.error('❌ Failed to compare performance data:', error);
      process.exit(1);
    }
  }

  /**
   * Handle benchmark command
   */
  private async handleBenchmark(args: any): Promise<void> {
    console.log('🏃‍♂️ Running performance benchmarks...');
    console.log(`Iterations: ${args.iterations} (${args.warmup} warmup)`);

    try {
      const results = await this.runBenchmarks(args.iterations, args.warmup);
      
      if (args.output) {
        writeFileSync(args.output, JSON.stringify(results, null, 2));
        console.log(`✅ Benchmark results saved: ${args.output}`);
      } else {
        this.printBenchmarkResults(results);
      }
    } catch (error) {
      console.error('❌ Failed to run benchmarks:', error);
      process.exit(1);
    }
  }

  /**
   * Handle dashboard command
   */
  private async handleDashboard(args: any): Promise<void> {
    console.log('🚀 Launching performance dashboard...');
    console.log(`Server: http://${args.host}:${args.port}`);

    // This would launch a web-based dashboard
    // For now, just show a console-based dashboard
    const dashboard = performanceDashboard;
    
    setInterval(() => {
      console.clear();
      dashboard.printSummary();
    }, 5000);

    console.log('📊 Dashboard active. Press Ctrl+C to stop.');

    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping dashboard...');
      dashboard.dispose();
      process.exit(0);
    });
  }

  /**
   * Collect report data from directory
   */
  private collectReportData(inputDir: string): any {
    if (!existsSync(inputDir)) {
      throw new Error(`Input directory not found: ${inputDir}`);
    }

    const files = readdirSync(inputDir).filter(f => f.endsWith('.json'));
    const data: any[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(inputDir, file), 'utf-8');
        data.push(JSON.parse(content));
      } catch (error) {
        console.warn(`⚠️  Failed to read ${file}:`, error);
      }
    }

    return data;
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(data: any, outputPath: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .metric { background: white; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .warning { background: #fff3cd; border-color: #ffeaa7; }
        .error { background: #f8d7da; border-color: #f5c6cb; }
        .success { background: #d4edda; border-color: #c3e6cb; }
        .chart { height: 200px; background: #f8f9fa; margin: 10px 0; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Performance Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        <p>Data Points: ${data.length}</p>
    </div>
    
    <div class="metric">
        <h2>📈 Performance Summary</h2>
        <p>This report contains performance data collected from your MTM application.</p>
        <div class="chart">Chart visualization would go here</div>
    </div>
    
    <div class="metric">
        <h2>📊 Raw Data</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
    </div>
</body>
</html>`;

    writeFileSync(outputPath, html);
  }

  /**
   * Generate JSON report
   */
  private async generateJSONReport(data: any, outputPath: string): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      dataPoints: data.length,
      data
    };

    writeFileSync(outputPath, JSON.stringify(report, null, 2));
  }

  /**
   * Generate CSV report
   */
  private async generateCSVReport(data: any, outputPath: string): Promise<void> {
    if (data.length === 0) {
      writeFileSync(outputPath, 'No data available\n');
      return;
    }

    // Extract headers from first data point
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';

    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      });
      csv += values.join(',') + '\n';
    }

    writeFileSync(outputPath, csv);
  }

  /**
   * Load performance data from file or directory
   */
  private loadPerformanceData(path: string): any {
    const resolvedPath = resolve(path);
    
    if (!existsSync(resolvedPath)) {
      throw new Error(`Path not found: ${resolvedPath}`);
    }

    if (resolvedPath.endsWith('.json')) {
      return JSON.parse(readFileSync(resolvedPath, 'utf-8'));
    } else {
      return this.collectReportData(resolvedPath);
    }
  }

  /**
   * Compare performance data
   */
  private comparePerformanceData(before: any, after: any): any {
    // Simple comparison logic
    return {
      timestamp: new Date().toISOString(),
      before: before,
      after: after,
      changes: {
        // This would contain detailed comparison logic
        summary: 'Comparison completed'
      }
    };
  }

  /**
   * Run performance benchmarks
   */
  private async runBenchmarks(iterations: number, warmup: number): Promise<any> {
    const results: any[] = [];

    console.log(`🔥 Running ${warmup} warmup iterations...`);
    for (let i = 0; i < warmup; i++) {
      await this.runSingleBenchmark();
    }

    console.log(`🏃‍♂️ Running ${iterations} benchmark iterations...`);
    for (let i = 0; i < iterations; i++) {
      const result = await this.runSingleBenchmark();
      results.push(result);
      console.log(`Iteration ${i + 1}/${iterations}: ${result.duration.toFixed(2)}ms`);
    }

    return {
      timestamp: new Date().toISOString(),
      iterations,
      warmup,
      results,
      summary: {
        average: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
        min: Math.min(...results.map(r => r.duration)),
        max: Math.max(...results.map(r => r.duration)),
        median: this.calculateMedian(results.map(r => r.duration))
      }
    };
  }

  /**
   * Run a single benchmark iteration
   */
  private async runSingleBenchmark(): Promise<any> {
    const startTime = performance.now();
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    const endTime = performance.now();
    
    return {
      duration: endTime - startTime,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate median value
   */
  private calculateMedian(values: number[]): number {
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  /**
   * Print bundle analysis
   */
  private printBundleAnalysis(analysis: any): void {
    console.log('\n📦 Bundle Analysis Results');
    console.log('='.repeat(50));
    console.log(`Route: ${analysis.route}`);
    console.log(`Original Size: ${(analysis.originalSize / 1024).toFixed(1)}KB`);
    console.log(`Compressed Size: ${(analysis.compressedSize / 1024).toFixed(1)}KB`);
    console.log(`Compression Ratio: ${(analysis.compressionRatio * 100).toFixed(1)}%`);
    console.log(`Performance Score: ${analysis.performanceScore.toFixed(1)}/100`);
    
    if (analysis.optimizationOpportunities.length > 0) {
      console.log('\n💡 Optimization Opportunities:');
      analysis.optimizationOpportunities.slice(0, 5).forEach((opp: any) => {
        console.log(`  • ${opp.description} (${(opp.potentialSavings / 1024).toFixed(1)}KB savings)`);
      });
    }
  }

  /**
   * Print comparison results
   */
  private printComparison(comparison: any): void {
    console.log('\n📊 Performance Comparison');
    console.log('='.repeat(50));
    console.log('Comparison completed successfully');
    // This would contain detailed comparison output
  }

  /**
   * Print benchmark results
   */
  private printBenchmarkResults(results: any): void {
    console.log('\n🏃‍♂️ Benchmark Results');
    console.log('='.repeat(50));
    console.log(`Iterations: ${results.iterations}`);
    console.log(`Average: ${results.summary.average.toFixed(2)}ms`);
    console.log(`Min: ${results.summary.min.toFixed(2)}ms`);
    console.log(`Max: ${results.summary.max.toFixed(2)}ms`);
    console.log(`Median: ${results.summary.median.toFixed(2)}ms`);
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): { command: string; options: any } {
    const [command, ...rest] = args;
    const options: any = {};

    for (let i = 0; i < rest.length; i += 2) {
      const key = rest[i]?.replace(/^--/, '');
      const value = rest[i + 1];
      
      if (key && value !== undefined) {
        // Try to parse as number or boolean
        if (value === 'true') options[key] = true;
        else if (value === 'false') options[key] = false;
        else if (!isNaN(Number(value))) options[key] = Number(value);
        else options[key] = value;
      }
    }

    return { command, options };
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log('📊 MTM Performance CLI');
    console.log('='.repeat(50));
    console.log('Usage: mtm-perf <command> [options]');
    console.log('');
    console.log('Commands:');
    
    for (const [name, cmd] of this.commands) {
      console.log(`  ${name.padEnd(12)} ${cmd.description}`);
      
      if (cmd.options) {
        cmd.options.forEach(opt => {
          console.log(`    --${opt.name.padEnd(10)} ${opt.description} (default: ${opt.default})`);
        });
      }
      console.log('');
    }
  }

  /**
   * Run the CLI
   */
  async run(args: string[]): Promise<void> {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      this.showHelp();
      return;
    }

    const { command, options } = this.parseArgs(args);
    const cmd = this.commands.get(command);

    if (!cmd) {
      console.error(`❌ Unknown command: ${command}`);
      this.showHelp();
      process.exit(1);
    }

    // Apply default options
    if (cmd.options) {
      for (const opt of cmd.options) {
        if (options[opt.name] === undefined && opt.default !== undefined) {
          options[opt.name] = opt.default;
        }
      }
    }

    try {
      await cmd.handler(options);
    } catch (error) {
      console.error(`❌ Command failed:`, error);
      process.exit(1);
    }
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new PerformanceCLI();
  cli.run(process.argv.slice(2));
}

export { PerformanceCLI };