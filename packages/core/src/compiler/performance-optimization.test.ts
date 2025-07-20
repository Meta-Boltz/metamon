/**
 * Tests for compilation performance optimizations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { CompilationPerformanceOptimizer } from './performance-optimizer.js';
import { PerformanceBenchmarkRunner, defaultBenchmarkConfig } from './performance-benchmarks.js';

describe('CompilationPerformanceOptimizer', () => {
  let optimizer: CompilationPerformanceOptimizer;
  let testDir: string;
  let testFiles: string[];

  beforeEach(() => {
    optimizer = new CompilationPerformanceOptimizer();
    testDir = join(process.cwd(), 'test-temp');
    mkdirSync(testDir, { recursive: true });
    testFiles = [];
  });

  afterEach(() => {
    optimizer.dispose();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Incremental Parsing', () => {
    it('should detect when file needs recompilation', async () => {
      const testFile = join(testDir, 'test.mtm');
      const content = `---
target: reactjs
---
$counter! = 0`;

      writeFileSync(testFile, content);
      testFiles.push(testFile);

      // First compilation
      const result1 = await optimizer.compileWithOptimizations(testFile);
      expect(result1.fromCache).toBe(false);

      // Second compilation without changes (should use cache)
      const result2 = await optimizer.compileWithOptimizations(testFile);
      expect(result2.fromCache).toBe(true);

      // Modify file
      writeFileSync(testFile, content + '\n$name = "test"');

      // Third compilation after changes (should recompile)
      const result3 = await optimizer.compileWithOptimizations(testFile);
      expect(result3.fromCache).toBe(false);
    });

    it('should cache AST and type information', async () => {
      const testFile = join(testDir, 'test.mtm');
      const content = `---
target: reactjs
---
$counter! = 0
$name: string = "test"`;

      writeFileSync(testFile, content);
      testFiles.push(testFile);

      // First compilation
      const result1 = await optimizer.compileWithOptimizations(testFile);
      expect(result1.parseTime).toBeGreaterThan(0);

      // Second compilation (from cache)
      const result2 = await optimizer.compileWithOptimizations(testFile);
      expect(result2.fromCache).toBe(true);
      expect(result2.parseTime).toBe(0);
    });

    it('should handle cache size limits', async () => {
      const smallCacheOptimizer = new CompilationPerformanceOptimizer(
        { maxSize: 2, ttl: 3600000, persistToDisk: false },
        { maxWorkers: 1, jobTimeout: 30000, batchSize: 10 }
      );

      try {
        // Create multiple test files
        for (let i = 0; i < 5; i++) {
          const testFile = join(testDir, `test${i}.mtm`);
          const content = `---
target: reactjs
---
$counter${i}! = ${i}`;
          writeFileSync(testFile, content);
          testFiles.push(testFile);
          
          await smallCacheOptimizer.compileWithOptimizations(testFile);
        }

        const stats = smallCacheOptimizer.getCacheStats();
        expect(stats.astCacheSize).toBeLessThanOrEqual(2);
      } finally {
        smallCacheOptimizer.dispose();
      }
    });
  });

  describe('Parallel Processing', () => {
    it('should compile multiple files in parallel', async () => {
      // Create multiple test files
      for (let i = 0; i < 5; i++) {
        const testFile = join(testDir, `test${i}.mtm`);
        const content = `---
target: reactjs
---
$counter${i}! = ${i}
$increment${i} = () => $counter${i}++`;
        writeFileSync(testFile, content);
        testFiles.push(testFile);
      }

      const startTime = performance.now();
      const results = await optimizer.compileParallel(testFiles);
      const endTime = performance.now();

      expect(results.size).toBe(testFiles.length);
      expect(endTime - startTime).toBeLessThan(1000); // Should be reasonably fast

      // Verify all files were compiled
      for (const testFile of testFiles) {
        expect(results.has(testFile)).toBe(true);
        const result = results.get(testFile)!;
        expect(result.ast).toBeDefined();
      }
    });

    it('should handle parallel compilation errors gracefully', async () => {
      const validFile = join(testDir, 'valid.mtm');
      const invalidFile = join(testDir, 'invalid.mtm');

      writeFileSync(validFile, `---
target: reactjs
---
$counter! = 0`);

      writeFileSync(invalidFile, `invalid content without frontmatter`);

      testFiles.push(validFile, invalidFile);

      const results = await optimizer.compileParallel(testFiles);

      // Valid file should compile successfully
      expect(results.has(validFile)).toBe(true);
      
      // Invalid file should not be in results (error handled)
      expect(results.has(invalidFile)).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should clear expired cache entries', async () => {
      const shortTTLOptimizer = new CompilationPerformanceOptimizer(
        { maxSize: 1000, ttl: 100, persistToDisk: false }, // 100ms TTL
        { maxWorkers: 1, jobTimeout: 30000, batchSize: 10 }
      );

      try {
        const testFile = join(testDir, 'test.mtm');
        const content = `---
target: reactjs
---
$counter! = 0`;
        writeFileSync(testFile, content);
        testFiles.push(testFile);

        // Compile file
        await shortTTLOptimizer.compileWithOptimizations(testFile);
        
        let stats = shortTTLOptimizer.getCacheStats();
        expect(stats.astCacheSize).toBe(1);

        // Wait for TTL to expire
        await new Promise(resolve => setTimeout(resolve, 150));

        // Clear expired entries
        shortTTLOptimizer.clearExpiredCache();

        stats = shortTTLOptimizer.getCacheStats();
        expect(stats.astCacheSize).toBe(0);
      } finally {
        shortTTLOptimizer.dispose();
      }
    });

    it('should provide accurate cache statistics', async () => {
      const testFile = join(testDir, 'test.mtm');
      const content = `---
target: reactjs
---
$counter! = 0
$name: string = "test"`;
      writeFileSync(testFile, content);
      testFiles.push(testFile);

      await optimizer.compileWithOptimizations(testFile);

      const stats = optimizer.getCacheStats();
      expect(stats.astCacheSize).toBe(1);
      expect(stats.typeCacheSize).toBe(1);
      expect(stats.metadataCacheSize).toBe(1);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should track compilation metrics', async () => {
      const testFile = join(testDir, 'test.mtm');
      const content = `---
target: reactjs
---
$counter! = 0`;
      writeFileSync(testFile, content);
      testFiles.push(testFile);

      optimizer.resetMetrics();

      // Compile file multiple times
      await optimizer.compileWithOptimizations(testFile);
      await optimizer.compileWithOptimizations(testFile);
      await optimizer.compileWithOptimizations(testFile);

      const metrics = optimizer.getMetrics();
      expect(metrics.totalFiles).toBe(3);
      expect(metrics.cachedFiles).toBe(2); // First is parsed, next two are cached
      expect(metrics.parsedFiles).toBe(1);
      expect(metrics.cacheHitRate).toBeCloseTo(2/3);
      expect(metrics.averageParseTime).toBeGreaterThan(0);
    });

    it('should reset metrics correctly', async () => {
      const testFile = join(testDir, 'test.mtm');
      const content = `---
target: reactjs
---
$counter! = 0`;
      writeFileSync(testFile, content);
      testFiles.push(testFile);

      await optimizer.compileWithOptimizations(testFile);
      
      let metrics = optimizer.getMetrics();
      expect(metrics.totalFiles).toBe(1);

      optimizer.resetMetrics();
      
      metrics = optimizer.getMetrics();
      expect(metrics.totalFiles).toBe(0);
      expect(metrics.cachedFiles).toBe(0);
      expect(metrics.parsedFiles).toBe(0);
    });
  });
});

describe('PerformanceBenchmarkRunner', () => {
  let runner: PerformanceBenchmarkRunner;
  let testDir: string;
  let testFiles: string[];

  beforeEach(() => {
    runner = new PerformanceBenchmarkRunner();
    testDir = join(process.cwd(), 'benchmark-temp');
    mkdirSync(testDir, { recursive: true });
    testFiles = [];
  });

  afterEach(() => {
    runner.dispose();
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should run basic benchmark suite', async () => {
    // Create test files
    for (let i = 0; i < 3; i++) {
      const testFile = join(testDir, `test${i}.mtm`);
      const content = `---
target: reactjs
---
$counter${i}! = ${i}
$increment${i} = () => $counter${i}++`;
      writeFileSync(testFile, content);
      testFiles.push(testFile);
    }

    const config = {
      ...defaultBenchmarkConfig,
      iterations: 5,
      warmupIterations: 2,
      testFiles,
      measureMemory: true
    };

    const suite = await runner.runBenchmarkSuite(config);

    expect(suite.name).toBe('MTM Compilation Performance');
    expect(suite.results.length).toBeGreaterThan(0);
    expect(suite.summary.totalTests).toBeGreaterThan(0);
    expect(suite.summary.totalTime).toBeGreaterThan(0);
  });

  it('should handle empty test file list gracefully', async () => {
    const config = {
      ...defaultBenchmarkConfig,
      iterations: 2,
      warmupIterations: 1,
      testFiles: [],
      measureMemory: false
    };

    const suite = await runner.runBenchmarkSuite(config);

    expect(suite.results.length).toBeGreaterThan(0);
    // Some tests should still run even without test files
    const validResults = suite.results.filter(r => r.iterations > 0);
    expect(validResults.length).toBeGreaterThan(0);
  });

  it('should measure memory usage accurately', async () => {
    const testFile = join(testDir, 'test.mtm');
    const content = `---
target: reactjs
---
$counter! = 0
$name: string = "test"
$items = [1, 2, 3, 4, 5]`;
    writeFileSync(testFile, content);
    testFiles.push(testFile);

    const config = {
      ...defaultBenchmarkConfig,
      iterations: 3,
      warmupIterations: 1,
      testFiles,
      measureMemory: true
    };

    const suite = await runner.runBenchmarkSuite(config);
    
    const memoryTest = suite.results.find(r => r.testName === 'Memory Usage');
    expect(memoryTest).toBeDefined();
    expect(memoryTest!.memoryUsage).toBeDefined();
    expect(memoryTest!.memoryUsage!.heapUsed).toBeGreaterThanOrEqual(0);
  });

  it('should calculate benchmark statistics correctly', async () => {
    const testFile = join(testDir, 'test.mtm');
    const content = `---
target: reactjs
---
$counter! = 0`;
    writeFileSync(testFile, content);
    testFiles.push(testFile);

    const config = {
      ...defaultBenchmarkConfig,
      iterations: 10,
      warmupIterations: 2,
      testFiles,
      measureMemory: false
    };

    const suite = await runner.runBenchmarkSuite(config);

    expect(suite.summary.totalTests).toBeGreaterThan(0);
    expect(suite.summary.averageTestTime).toBeGreaterThan(0);
    expect(suite.summary.fastestTest).toBeTruthy();
    expect(suite.summary.slowestTest).toBeTruthy();

    // Check individual results have proper statistics
    const validResults = suite.results.filter(r => r.iterations > 0);
    for (const result of validResults) {
      expect(result.averageTime).toBeGreaterThanOrEqual(0);
      expect(result.minTime).toBeLessThanOrEqual(result.averageTime);
      expect(result.maxTime).toBeGreaterThanOrEqual(result.averageTime);
      expect(result.standardDeviation).toBeGreaterThanOrEqual(0);
    }
  });
});