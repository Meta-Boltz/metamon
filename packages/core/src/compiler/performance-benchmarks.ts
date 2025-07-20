/**
 * Performance benchmarks for MTM compilation
 * Measures parsing speed, memory usage, and optimization effectiveness
 */

import { performance } from 'perf_hooks';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { CompilationPerformanceOptimizer } from './performance-optimizer.js';
import { EnhancedMTMParser } from '../parser/enhanced-mtm-parser.js';
import { TypeInferenceEngine } from '../types/type-inference.js';

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  testFiles: string[];
  outputFile?: string;
  measureMemory: boolean;
}

/**
 * Benchmark result for a single test
 */
export interface BenchmarkResult {
  testName: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  memoryUsage?: MemoryUsage;
  cacheHitRate?: number;
}

/**
 * Memory usage measurement
 */
export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Comprehensive benchmark suite
 */
export interface BenchmarkSuite {
  name: string;
  timestamp: number;
  config: BenchmarkConfig;
  results: BenchmarkResult[];
  summary: BenchmarkSummary;
}

/**
 * Benchmark summary statistics
 */
export interface BenchmarkSummary {
  totalTests: number;
  totalTime: number;
  averageTestTime: number;
  fastestTest: string;
  slowestTest: string;
  memoryEfficiency: number;
  cacheEffectiveness: number;
}

/**
 * Performance benchmark runner
 */
export class PerformanceBenchmarkRunner {
  private optimizer: CompilationPerformanceOptimizer;
  private parser: EnhancedMTMParser;
  private typeInferenceEngine: TypeInferenceEngine;

  constructor() {
    this.optimizer = new CompilationPerformanceOptimizer();
    this.parser = new EnhancedMTMParser();
    this.typeInferenceEngine = new TypeInferenceEngine();
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarkSuite(config: BenchmarkConfig): Promise<BenchmarkSuite> {
    console.log('Starting MTM compilation performance benchmarks...');
    
    const suite: BenchmarkSuite = {
      name: 'MTM Compilation Performance',
      timestamp: Date.now(),
      config,
      results: [],
      summary: {
        totalTests: 0,
        totalTime: 0,
        averageTestTime: 0,
        fastestTest: '',
        slowestTest: '',
        memoryEfficiency: 0,
        cacheEffectiveness: 0
      }
    };

    // Run individual benchmarks
    suite.results.push(await this.benchmarkBasicParsing(config));
    suite.results.push(await this.benchmarkModernSyntaxParsing(config));
    suite.results.push(await this.benchmarkTypeInference(config));
    suite.results.push(await this.benchmarkIncrementalParsing(config));
    suite.results.push(await this.benchmarkParallelCompilation(config));
    suite.results.push(await this.benchmarkCachePerformance(config));
    suite.results.push(await this.benchmarkLargeFileParsing(config));
    suite.results.push(await this.benchmarkMemoryUsage(config));

    // Calculate summary
    suite.summary = this.calculateSummary(suite.results);

    // Output results
    if (config.outputFile) {
      this.outputResults(suite, config.outputFile);
    }

    console.log('Benchmark suite completed.');
    return suite;
  }

  /**
   * Benchmark basic parsing performance
   */
  private async benchmarkBasicParsing(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const testName = 'Basic Parsing';
    const times: number[] = [];
    let memoryUsage: MemoryUsage | undefined;

    // Warmup
    for (let i = 0; i < config.warmupIterations; i++) {
      for (const filePath of config.testFiles) {
        this.parser.parse(filePath);
      }
    }

    // Actual benchmark
    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();
      
      for (const filePath of config.testFiles) {
        this.parser.parse(filePath);
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    if (config.measureMemory) {
      memoryUsage = this.measureMemoryUsage();
    }

    return this.calculateBenchmarkResult(testName, times, config.iterations, memoryUsage);
  }

  /**
   * Benchmark modern syntax parsing
   */
  private async benchmarkModernSyntaxParsing(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const testName = 'Modern Syntax Parsing';
    const times: number[] = [];
    let memoryUsage: MemoryUsage | undefined;

    // Create test content with modern syntax
    const modernSyntaxContent = this.generateModernSyntaxContent();
    const testFile = join(process.cwd(), 'temp_modern_test.mtm');
    writeFileSync(testFile, modernSyntaxContent);

    // Warmup
    for (let i = 0; i < config.warmupIterations; i++) {
      const mtmFile = this.parser.parse(testFile);
      if (mtmFile.syntaxVersion === 'modern') {
        this.parser.parseModern(mtmFile.content);
      }
    }

    // Actual benchmark
    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();
      
      const mtmFile = this.parser.parse(testFile);
      if (mtmFile.syntaxVersion === 'modern') {
        this.parser.parseModern(mtmFile.content);
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    if (config.measureMemory) {
      memoryUsage = this.measureMemoryUsage();
    }

    return this.calculateBenchmarkResult(testName, times, config.iterations, memoryUsage);
  }

  /**
   * Benchmark type inference performance
   */
  private async benchmarkTypeInference(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const testName = 'Type Inference';
    const times: number[] = [];
    let memoryUsage: MemoryUsage | undefined;

    // Create test AST
    const testAST = this.generateTestAST();

    // Warmup
    for (let i = 0; i < config.warmupIterations; i++) {
      // Simulate type inference on test expressions
      for (const stmt of testAST.body) {
        if (stmt.initializer) {
          this.typeInferenceEngine.inferType(stmt.initializer);
        }
      }
    }

    // Actual benchmark
    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();
      // Simulate type inference on test expressions
      for (const stmt of testAST.body) {
        if (stmt.initializer) {
          this.typeInferenceEngine.inferType(stmt.initializer);
        }
      }
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    if (config.measureMemory) {
      memoryUsage = this.measureMemoryUsage();
    }

    return this.calculateBenchmarkResult(testName, times, config.iterations, memoryUsage);
  }

  /**
   * Benchmark incremental parsing performance
   */
  private async benchmarkIncrementalParsing(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const testName = 'Incremental Parsing';
    const times: number[] = [];
    let memoryUsage: MemoryUsage | undefined;
    let cacheHitRate = 0;

    if (config.testFiles.length === 0) {
      return this.createEmptyResult(testName);
    }

    const testFile = config.testFiles[0];

    // First compilation (cache miss)
    await this.optimizer.compileWithOptimizations(testFile);

    // Warmup with cached compilation
    for (let i = 0; i < config.warmupIterations; i++) {
      await this.optimizer.compileWithOptimizations(testFile);
    }

    // Actual benchmark
    let cacheHits = 0;
    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();
      const result = await this.optimizer.compileWithOptimizations(testFile);
      const endTime = performance.now();
      
      times.push(endTime - startTime);
      if (result.fromCache) {
        cacheHits++;
      }
    }

    cacheHitRate = cacheHits / config.iterations;

    if (config.measureMemory) {
      memoryUsage = this.measureMemoryUsage();
    }

    const result = this.calculateBenchmarkResult(testName, times, config.iterations, memoryUsage);
    result.cacheHitRate = cacheHitRate;
    return result;
  }

  /**
   * Benchmark parallel compilation performance
   */
  private async benchmarkParallelCompilation(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const testName = 'Parallel Compilation';
    const times: number[] = [];
    let memoryUsage: MemoryUsage | undefined;

    if (config.testFiles.length === 0) {
      return this.createEmptyResult(testName);
    }

    // Warmup
    for (let i = 0; i < config.warmupIterations; i++) {
      await this.optimizer.compileParallel(config.testFiles);
    }

    // Actual benchmark
    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();
      await this.optimizer.compileParallel(config.testFiles);
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    if (config.measureMemory) {
      memoryUsage = this.measureMemoryUsage();
    }

    return this.calculateBenchmarkResult(testName, times, config.iterations, memoryUsage);
  }

  /**
   * Benchmark cache performance
   */
  private async benchmarkCachePerformance(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const testName = 'Cache Performance';
    const times: number[] = [];
    let memoryUsage: MemoryUsage | undefined;

    if (config.testFiles.length === 0) {
      return this.createEmptyResult(testName);
    }

    // Clear cache first
    this.optimizer.clearCache();

    // Benchmark cache population and retrieval
    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();
      
      // First access (cache miss)
      await this.optimizer.compileWithOptimizations(config.testFiles[0]);
      
      // Second access (cache hit)
      await this.optimizer.compileWithOptimizations(config.testFiles[0]);
      
      const endTime = performance.now();
      times.push(endTime - startTime);
      
      // Clear cache for next iteration
      this.optimizer.clearCache();
    }

    if (config.measureMemory) {
      memoryUsage = this.measureMemoryUsage();
    }

    return this.calculateBenchmarkResult(testName, times, config.iterations, memoryUsage);
  }

  /**
   * Benchmark large file parsing
   */
  private async benchmarkLargeFileParsing(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const testName = 'Large File Parsing';
    const times: number[] = [];
    let memoryUsage: MemoryUsage | undefined;

    // Generate large test file
    const largeContent = this.generateLargeFileContent(10000); // 10k lines
    const testFile = join(process.cwd(), 'temp_large_test.mtm');
    writeFileSync(testFile, largeContent);

    // Warmup
    for (let i = 0; i < Math.min(config.warmupIterations, 3); i++) {
      this.parser.parse(testFile);
    }

    // Actual benchmark
    for (let i = 0; i < Math.min(config.iterations, 10); i++) {
      const startTime = performance.now();
      this.parser.parse(testFile);
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    if (config.measureMemory) {
      memoryUsage = this.measureMemoryUsage();
    }

    return this.calculateBenchmarkResult(testName, times, Math.min(config.iterations, 10), memoryUsage);
  }

  /**
   * Benchmark memory usage patterns
   */
  private async benchmarkMemoryUsage(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const testName = 'Memory Usage';
    const times: number[] = [];
    const memoryMeasurements: MemoryUsage[] = [];

    if (config.testFiles.length === 0) {
      return this.createEmptyResult(testName);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = this.measureMemoryUsage();

    // Benchmark memory usage during compilation
    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();
      
      for (const filePath of config.testFiles) {
        await this.optimizer.compileWithOptimizations(filePath);
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
      
      memoryMeasurements.push(this.measureMemoryUsage());
    }

    // Calculate memory efficiency
    const finalMemory = this.measureMemoryUsage();
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    
    const result = this.calculateBenchmarkResult(testName, times, config.iterations);
    result.memoryUsage = {
      heapUsed: memoryGrowth,
      heapTotal: finalMemory.heapTotal,
      external: finalMemory.external,
      rss: finalMemory.rss
    };

    return result;
  }

  /**
   * Generate modern syntax test content
   */
  private generateModernSyntaxContent(): string {
    return `---
target: reactjs
---

$counter! = 0
$name: string = "Test"
$items = [1, 2, 3, 4, 5]

$increment = () => {
  $counter = $counter + 1
}

$greet = (name: string): string => {
  return \`Hello, \${name}!\`
}

$asyncFetch = async (url: string) => {
  const response = await fetch(url)
  return response.json()
}

template(\`
  <div>
    <h1>{{$name}}</h1>
    <p>Counter: {{$counter}}</p>
    <button click="$increment()">Increment</button>
    <ul>
      {{#each $items as item}}
        <li>{{item}}</li>
      {{/each}}
    </ul>
  </div>
\`)`;
  }

  /**
   * Generate test AST for type inference benchmarks
   */
  private generateTestAST(): any {
    return {
      type: 'Program',
      body: [
        {
          type: 'VariableDeclaration',
          name: 'counter',
          hasDollarPrefix: true,
          hasReactiveSuffix: true,
          typeAnnotation: null,
          initializer: { type: 'Literal', value: 0 },
          isReactive: true
        },
        {
          type: 'VariableDeclaration',
          name: 'name',
          hasDollarPrefix: true,
          hasReactiveSuffix: false,
          typeAnnotation: { type: 'TypeAnnotation', baseType: 'string' },
          initializer: { type: 'Literal', value: 'Test' },
          isReactive: false
        }
      ]
    };
  }

  /**
   * Generate large file content for stress testing
   */
  private generateLargeFileContent(lines: number): string {
    let content = `---
target: reactjs
---

`;

    for (let i = 0; i < lines; i++) {
      content += `$var${i}! = ${i}\n`;
      if (i % 100 === 0) {
        content += `$func${i} = () => { return $var${i} * 2 }\n`;
      }
    }

    content += `
template(\`
  <div>
`;

    for (let i = 0; i < Math.min(lines, 1000); i++) {
      content += `    <p>{{$var${i}}}</p>\n`;
    }

    content += `  </div>
\`)`;

    return content;
  }

  /**
   * Measure current memory usage
   */
  private measureMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
  }

  /**
   * Calculate benchmark result statistics
   */
  private calculateBenchmarkResult(
    testName: string,
    times: number[],
    iterations: number,
    memoryUsage?: MemoryUsage
  ): BenchmarkResult {
    if (times.length === 0) {
      return this.createEmptyResult(testName);
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    // Calculate standard deviation
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      testName,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      standardDeviation,
      memoryUsage
    };
  }

  /**
   * Create empty result for tests that couldn't run
   */
  private createEmptyResult(testName: string): BenchmarkResult {
    return {
      testName,
      iterations: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: 0,
      maxTime: 0,
      standardDeviation: 0
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(results: BenchmarkResult[]): BenchmarkSummary {
    const validResults = results.filter(r => r.iterations > 0);
    
    if (validResults.length === 0) {
      return {
        totalTests: 0,
        totalTime: 0,
        averageTestTime: 0,
        fastestTest: '',
        slowestTest: '',
        memoryEfficiency: 0,
        cacheEffectiveness: 0
      };
    }

    const totalTime = validResults.reduce((sum, result) => sum + result.totalTime, 0);
    const averageTestTime = totalTime / validResults.length;
    
    const fastestResult = validResults.reduce((fastest, current) => 
      current.averageTime < fastest.averageTime ? current : fastest
    );
    
    const slowestResult = validResults.reduce((slowest, current) => 
      current.averageTime > slowest.averageTime ? current : slowest
    );

    const cacheResults = validResults.filter(r => r.cacheHitRate !== undefined);
    const cacheEffectiveness = cacheResults.length > 0 
      ? cacheResults.reduce((sum, r) => sum + (r.cacheHitRate || 0), 0) / cacheResults.length
      : 0;

    return {
      totalTests: validResults.length,
      totalTime,
      averageTestTime,
      fastestTest: fastestResult.testName,
      slowestTest: slowestResult.testName,
      memoryEfficiency: this.calculateMemoryEfficiency(validResults),
      cacheEffectiveness
    };
  }

  /**
   * Calculate memory efficiency score
   */
  private calculateMemoryEfficiency(results: BenchmarkResult[]): number {
    const memoryResults = results.filter(r => r.memoryUsage);
    if (memoryResults.length === 0) return 0;

    // Simple efficiency calculation based on memory usage vs performance
    const avgMemory = memoryResults.reduce((sum, r) => sum + (r.memoryUsage?.heapUsed || 0), 0) / memoryResults.length;
    const avgTime = memoryResults.reduce((sum, r) => sum + r.averageTime, 0) / memoryResults.length;
    
    // Lower memory usage and faster time = higher efficiency
    return Math.max(0, 100 - (avgMemory / 1024 / 1024) - avgTime);
  }

  /**
   * Output benchmark results to file
   */
  private outputResults(suite: BenchmarkSuite, outputFile: string): void {
    try {
      const outputDir = dirname(outputFile);
      mkdirSync(outputDir, { recursive: true });
      
      const output = {
        ...suite,
        generatedAt: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      };
      
      writeFileSync(outputFile, JSON.stringify(output, null, 2));
      console.log(`Benchmark results written to: ${outputFile}`);
    } catch (error) {
      console.error('Failed to write benchmark results:', error);
    }
  }

  /**
   * Print benchmark results to console
   */
  printResults(suite: BenchmarkSuite): void {
    console.log('\n=== MTM Compilation Performance Benchmark Results ===\n');
    
    console.log(`Suite: ${suite.name}`);
    console.log(`Timestamp: ${new Date(suite.timestamp).toISOString()}`);
    console.log(`Total Tests: ${suite.summary.totalTests}`);
    console.log(`Total Time: ${suite.summary.totalTime.toFixed(2)}ms`);
    console.log(`Average Test Time: ${suite.summary.averageTestTime.toFixed(2)}ms`);
    console.log(`Fastest Test: ${suite.summary.fastestTest}`);
    console.log(`Slowest Test: ${suite.summary.slowestTest}`);
    console.log(`Cache Effectiveness: ${(suite.summary.cacheEffectiveness * 100).toFixed(1)}%`);
    console.log(`Memory Efficiency: ${suite.summary.memoryEfficiency.toFixed(1)}`);
    
    console.log('\n--- Individual Test Results ---\n');
    
    for (const result of suite.results) {
      console.log(`${result.testName}:`);
      console.log(`  Iterations: ${result.iterations}`);
      console.log(`  Average Time: ${result.averageTime.toFixed(2)}ms`);
      console.log(`  Min Time: ${result.minTime.toFixed(2)}ms`);
      console.log(`  Max Time: ${result.maxTime.toFixed(2)}ms`);
      console.log(`  Std Deviation: ${result.standardDeviation.toFixed(2)}ms`);
      
      if (result.cacheHitRate !== undefined) {
        console.log(`  Cache Hit Rate: ${(result.cacheHitRate * 100).toFixed(1)}%`);
      }
      
      if (result.memoryUsage) {
        console.log(`  Memory Usage: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }
      
      console.log('');
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.optimizer.dispose();
  }
}

/**
 * Default benchmark configuration
 */
export const defaultBenchmarkConfig: BenchmarkConfig = {
  iterations: 100,
  warmupIterations: 10,
  testFiles: [],
  measureMemory: true
};

/**
 * Run benchmarks with default configuration
 */
export async function runDefaultBenchmarks(testFiles: string[] = []): Promise<BenchmarkSuite> {
  const runner = new PerformanceBenchmarkRunner();
  const config = { ...defaultBenchmarkConfig, testFiles };
  
  try {
    const suite = await runner.runBenchmarkSuite(config);
    runner.printResults(suite);
    return suite;
  } finally {
    runner.dispose();
  }
}