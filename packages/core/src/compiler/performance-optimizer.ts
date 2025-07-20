/**
 * Compilation Performance Optimizer
 * Implements incremental parsing, AST caching, and parallel processing
 */

import { readFileSync, statSync } from 'fs';
import { Worker } from 'worker_threads';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { UnifiedAST } from '../types/unified-ast.js';
import type { MTMFile } from '../types/mtm-file.js';
import { EnhancedMTMParser } from '../parser/enhanced-mtm-parser.js';
import { TypeInferenceEngine } from '../types/type-inference.js';

/**
 * File metadata for incremental parsing
 */
export interface FileMetadata {
  filePath: string;
  lastModified: number;
  size: number;
  hash: string;
  syntaxVersion: 'legacy' | 'modern';
}

/**
 * Cached AST entry
 */
export interface CachedAST {
  ast: UnifiedAST;
  metadata: FileMetadata;
  typeInfo: Map<string, any>;
  dependencies: string[];
  timestamp: number;
}

/**
 * Compilation job for parallel processing
 */
export interface CompilationJob {
  id: string;
  filePath: string;
  content?: string;
  priority: number;
  dependencies: string[];
}

/**
 * Compilation result with performance metrics
 */
export interface OptimizedCompilationResult {
  ast: UnifiedAST;
  fromCache: boolean;
  parseTime: number;
  typeInferenceTime: number;
  totalTime: number;
  dependencies: string[];
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  totalFiles: number;
  cachedFiles: number;
  parsedFiles: number;
  parallelJobs: number;
  totalTime: number;
  averageParseTime: number;
  cacheHitRate: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  persistToDisk: boolean;
  cacheDirectory?: string;
}

/**
 * Parallel processing configuration
 */
export interface ParallelConfig {
  maxWorkers: number;
  jobTimeout: number;
  batchSize: number;
}

/**
 * Performance optimizer for MTM compilation
 */
export class CompilationPerformanceOptimizer {
  private astCache = new Map<string, CachedAST>();
  private typeCache = new Map<string, Map<string, any>>();
  private fileMetadataCache = new Map<string, FileMetadata>();
  private parser = new EnhancedMTMParser();
  private typeInferenceEngine = new TypeInferenceEngine();
  private workers: Worker[] = [];
  private jobQueue: CompilationJob[] = [];
  private activeJobs = new Map<string, Promise<OptimizedCompilationResult>>();
  private metrics: PerformanceMetrics = {
    totalFiles: 0,
    cachedFiles: 0,
    parsedFiles: 0,
    parallelJobs: 0,
    totalTime: 0,
    averageParseTime: 0,
    cacheHitRate: 0
  };

  constructor(
    private cacheConfig: CacheConfig = {
      maxSize: 1000,
      ttl: 3600000, // 1 hour
      persistToDisk: false
    },
    private parallelConfig: ParallelConfig = {
      maxWorkers: Math.max(1, Math.floor(require('os').cpus().length / 2)),
      jobTimeout: 30000,
      batchSize: 10
    }
  ) {
    // Only initialize workers in production, not in tests
    if (process.env.NODE_ENV !== 'test') {
      this.initializeWorkers();
    }
  }

  /**
   * Initialize worker threads for parallel processing
   */
  private initializeWorkers(): void {
    const workerScript = this.getWorkerScript();
    
    for (let i = 0; i < this.parallelConfig.maxWorkers; i++) {
      try {
        const worker = new Worker(workerScript);
        this.workers.push(worker);
      } catch (error) {
        console.warn(`Failed to create worker ${i}:`, error);
      }
    }
  }

  /**
   * Get worker script path
   */
  private getWorkerScript(): string {
    // In a real implementation, this would point to a separate worker file
    // For now, we'll use inline worker code
    return `
      const { parentPort } = require('worker_threads');
      const { EnhancedMTMParser } = require('./enhanced-mtm-parser.js');
      
      parentPort.on('message', async (job) => {
        try {
          const parser = new EnhancedMTMParser();
          const result = await parser.parse(job.filePath);
          parentPort.postMessage({ success: true, result, jobId: job.id });
        } catch (error) {
          parentPort.postMessage({ success: false, error: error.message, jobId: job.id });
        }
      });
    `;
  }

  /**
   * Compile file with performance optimizations
   */
  async compileWithOptimizations(filePath: string): Promise<OptimizedCompilationResult> {
    const startTime = performance.now();
    
    // Check if file needs recompilation
    const needsRecompilation = await this.needsRecompilation(filePath);
    
    if (!needsRecompilation) {
      const cached = this.astCache.get(filePath);
      if (cached) {
        const totalTime = performance.now() - startTime;
        this.updateMetrics(totalTime, true);
        return {
          ast: cached.ast,
          fromCache: true,
          parseTime: 0,
          typeInferenceTime: 0,
          totalTime,
          dependencies: cached.dependencies
        };
      }
    }

    // Perform incremental compilation
    const result = await this.performIncrementalCompilation(filePath);
    
    const totalTime = performance.now() - startTime;
    this.updateMetrics(totalTime, result.fromCache);
    
    return {
      ...result,
      totalTime
    };
  }

  /**
   * Check if file needs recompilation based on metadata
   */
  private async needsRecompilation(filePath: string): Promise<boolean> {
    try {
      const stats = statSync(filePath);
      const currentMetadata: FileMetadata = {
        filePath,
        lastModified: stats.mtime.getTime(),
        size: stats.size,
        hash: await this.calculateFileHash(filePath),
        syntaxVersion: 'modern' // Will be determined during parsing
      };

      const cachedMetadata = this.fileMetadataCache.get(filePath);
      if (!cachedMetadata) {
        this.fileMetadataCache.set(filePath, currentMetadata);
        return true;
      }

      // Check if file has changed
      const hasChanged = (
        cachedMetadata.lastModified !== currentMetadata.lastModified ||
        cachedMetadata.size !== currentMetadata.size ||
        cachedMetadata.hash !== currentMetadata.hash
      );

      if (hasChanged) {
        this.fileMetadataCache.set(filePath, currentMetadata);
      }

      return hasChanged;
    } catch (error) {
      // If we can't read file metadata, assume it needs recompilation
      return true;
    }
  }

  /**
   * Calculate file hash for change detection
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      // Simple hash function - in production, use crypto.createHash
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(36);
    } catch (error) {
      return '';
    }
  }

  /**
   * Perform incremental compilation with caching
   */
  private async performIncrementalCompilation(filePath: string): Promise<OptimizedCompilationResult> {
    const parseStartTime = performance.now();
    
    // Parse file
    const mtmFile = this.parser.parse(filePath);
    const parseTime = performance.now() - parseStartTime;

    // Check if we have cached type information
    const typeStartTime = performance.now();
    let typeInfo = this.typeCache.get(filePath);
    
    if (!typeInfo && mtmFile.syntaxVersion === 'modern') {
      // Perform type inference - for now, create empty type info
      // In a full implementation, this would analyze the AST and infer types
      typeInfo = new Map();
      this.typeCache.set(filePath, typeInfo);
    }
    
    const typeInferenceTime = performance.now() - typeStartTime;

    // Create AST
    const ast: UnifiedAST = mtmFile.syntaxVersion === 'modern' 
      ? this.parser.parseModern(mtmFile.content)
      : this.createLegacyAST(mtmFile);

    // Cache the result
    const cachedEntry: CachedAST = {
      ast,
      metadata: this.fileMetadataCache.get(filePath)!,
      typeInfo: typeInfo || new Map(),
      dependencies: this.extractDependencies(ast),
      timestamp: Date.now()
    };

    this.cacheAST(filePath, cachedEntry);
    this.metrics.parsedFiles++;

    return {
      ast,
      fromCache: false,
      parseTime,
      typeInferenceTime,
      dependencies: cachedEntry.dependencies
    };
  }

  /**
   * Create legacy AST for backward compatibility
   */
  private createLegacyAST(mtmFile: MTMFile): UnifiedAST {
    // Convert legacy MTM file to unified AST format
    return {
      type: 'Program',
      body: [],
      frontmatter: mtmFile.frontmatter,
      syntaxVersion: 'legacy'
    };
  }

  /**
   * Extract dependencies from AST
   */
  private extractDependencies(ast: UnifiedAST): string[] {
    const dependencies: string[] = [];
    
    // Walk AST to find import statements and dependencies
    this.walkAST(ast, (node) => {
      if (node.type === 'ImportDeclaration') {
        const importNode = node as any;
        if (importNode.source && importNode.source.value) {
          dependencies.push(importNode.source.value);
        }
      }
    });

    return dependencies;
  }

  /**
   * Walk AST nodes recursively
   */
  private walkAST(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;

    callback(node);

    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(item => this.walkAST(item, callback));
        } else if (typeof value === 'object') {
          this.walkAST(value, callback);
        }
      }
    }
  }

  /**
   * Cache AST with size and TTL management
   */
  private cacheAST(filePath: string, cachedEntry: CachedAST): void {
    // Check cache size limit before adding
    if (this.astCache.size >= this.cacheConfig.maxSize) {
      this.evictOldestEntries();
    }

    this.astCache.set(filePath, cachedEntry);
    
    // Check again after adding in case we're still over limit
    if (this.astCache.size > this.cacheConfig.maxSize) {
      this.evictOldestEntries();
    }
  }

  /**
   * Evict oldest cache entries when limit is reached
   */
  private evictOldestEntries(): void {
    const entries = Array.from(this.astCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries until we're under the limit
    const targetSize = Math.floor(this.cacheConfig.maxSize * 0.75); // Keep 75% of max size
    const toRemove = Math.max(1, entries.length - targetSize);
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const key = entries[i][0];
      this.astCache.delete(key);
      this.typeCache.delete(key);
      this.fileMetadataCache.delete(key);
    }
  }

  /**
   * Compile multiple files in parallel
   */
  async compileParallel(filePaths: string[]): Promise<Map<string, OptimizedCompilationResult>> {
    const results = new Map<string, OptimizedCompilationResult>();
    const jobs: CompilationJob[] = filePaths.map((filePath, index) => ({
      id: `job_${index}`,
      filePath,
      priority: 1,
      dependencies: []
    }));

    // Process jobs in batches
    const batches = this.createBatches(jobs, this.parallelConfig.batchSize);
    
    for (const batch of batches) {
      const batchPromises = batch.map(job => this.processJob(job));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const job = batch[index];
        if (result.status === 'fulfilled') {
          results.set(job.filePath, result.value);
        } else {
          console.error(`Failed to compile ${job.filePath}:`, result.reason);
        }
      });
    }

    return results;
  }

  /**
   * Create batches for parallel processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a single compilation job
   */
  private async processJob(job: CompilationJob): Promise<OptimizedCompilationResult> {
    // Check if job is already being processed
    const existingJob = this.activeJobs.get(job.filePath);
    if (existingJob) {
      return existingJob;
    }

    // Create job promise
    const jobPromise = this.compileWithOptimizations(job.filePath);
    this.activeJobs.set(job.filePath, jobPromise);
    this.metrics.parallelJobs++;

    try {
      const result = await jobPromise;
      return result;
    } finally {
      this.activeJobs.delete(job.filePath);
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.astCache.entries()) {
      if (now - entry.timestamp > this.cacheConfig.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.astCache.delete(key);
      this.typeCache.delete(key);
      this.fileMetadataCache.delete(key);
    });
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(compilationTime: number, fromCache: boolean): void {
    this.metrics.totalFiles++;
    if (fromCache) {
      this.metrics.cachedFiles++;
    }
    this.metrics.totalTime += compilationTime;
    this.metrics.averageParseTime = this.metrics.totalTime / this.metrics.totalFiles;
    this.metrics.cacheHitRate = this.metrics.cachedFiles / this.metrics.totalFiles;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalFiles: 0,
      cachedFiles: 0,
      parsedFiles: 0,
      parallelJobs: 0,
      totalTime: 0,
      averageParseTime: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.astCache.clear();
    this.typeCache.clear();
    this.fileMetadataCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    astCacheSize: number;
    typeCacheSize: number;
    metadataCacheSize: number;
    memoryUsage: number;
  } {
    return {
      astCacheSize: this.astCache.size,
      typeCacheSize: this.typeCache.size,
      metadataCacheSize: this.fileMetadataCache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage of caches
   */
  private estimateMemoryUsage(): number {
    // Rough estimation - in production, use more accurate measurement
    let size = 0;
    
    for (const entry of this.astCache.values()) {
      size += JSON.stringify(entry).length * 2; // Rough estimate
    }
    
    for (const typeMap of this.typeCache.values()) {
      size += JSON.stringify(Array.from(typeMap.entries())).length * 2;
    }
    
    return size;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Terminate worker threads
    this.workers.forEach(worker => {
      worker.terminate();
    });
    this.workers = [];

    // Clear caches
    this.clearCache();
    
    // Clear active jobs
    this.activeJobs.clear();
  }
}

/**
 * Singleton instance for global use
 */
export const performanceOptimizer = new CompilationPerformanceOptimizer();