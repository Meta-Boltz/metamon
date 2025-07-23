/**
 * Build-Time Performance Tracker
 * Integrates with the build pipeline to track compilation, route generation, and optimization performance
 */

import { performance } from 'perf_hooks';
import { performanceMonitor } from './performance-monitor.js';
import type { CompilationPerformanceOptimizer } from '../compiler/performance-optimizer.js';
import type { RouteManifest } from '../routing/types.js';

/**
 * Build phase tracking
 */
export interface BuildPhase {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter?: NodeJS.MemoryUsage;
  filesProcessed?: number;
  cacheHits?: number;
  errors?: string[];
}

/**
 * Build performance statistics
 */
export interface BuildPerformanceStats {
  totalDuration: number;
  phases: BuildPhase[];
  filesProcessed: number;
  cacheHitRate: number;
  memoryPeak: number;
  optimizationEffectiveness: number;
  bottlenecks: string[];
  recommendations: string[];
}

/**
 * File processing metrics
 */
export interface FileProcessingMetrics {
  filePath: string;
  size: number;
  processingTime: number;
  fromCache: boolean;
  transformations: string[];
  dependencies: string[];
}

/**
 * Build-time performance tracker
 */
export class BuildPerformanceTracker {
  private phases: BuildPhase[] = [];
  private currentPhase?: BuildPhase;
  private fileMetrics: FileProcessingMetrics[] = [];
  private startTime: number = 0;
  private totalFilesProcessed: number = 0;
  private totalCacheHits: number = 0;
  private peakMemoryUsage: number = 0;

  constructor(
    private optimizer?: CompilationPerformanceOptimizer
  ) {}

  /**
   * Start tracking the entire build process
   */
  startBuild(): void {
    this.startTime = performance.now();
    this.phases = [];
    this.fileMetrics = [];
    this.totalFilesProcessed = 0;
    this.totalCacheHits = 0;
    this.peakMemoryUsage = 0;
    
    performanceMonitor.startBuildTracking();
    console.log('🚀 Starting build performance tracking...');
  }

  /**
   * Start tracking a specific build phase
   */
  startPhase(phaseName: string): void {
    // End current phase if one is active
    if (this.currentPhase) {
      this.endPhase();
    }

    const memoryUsage = process.memoryUsage();
    this.peakMemoryUsage = Math.max(this.peakMemoryUsage, memoryUsage.heapUsed);

    this.currentPhase = {
      name: phaseName,
      startTime: performance.now(),
      memoryBefore: memoryUsage,
      filesProcessed: 0,
      cacheHits: 0,
      errors: []
    };

    // Start specific phase tracking in performance monitor
    switch (phaseName) {
      case 'compilation':
        performanceMonitor.startCompilationTracking();
        break;
      case 'route-generation':
        performanceMonitor.startRouteGenerationTracking();
        break;
      case 'bundle-generation':
        performanceMonitor.startBundleGenerationTracking();
        break;
      case 'optimization':
        performanceMonitor.startOptimizationTracking();
        break;
    }

    console.log(`📊 Starting phase: ${phaseName}`);
  }

  /**
   * End the current build phase
   */
  endPhase(): void {
    if (!this.currentPhase) return;

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    this.peakMemoryUsage = Math.max(this.peakMemoryUsage, memoryAfter.heapUsed);

    this.currentPhase.endTime = endTime;
    this.currentPhase.duration = endTime - this.currentPhase.startTime;
    this.currentPhase.memoryAfter = memoryAfter;

    // End specific phase tracking in performance monitor
    switch (this.currentPhase.name) {
      case 'compilation':
        performanceMonitor.endCompilationTracking();
        break;
      case 'route-generation':
        performanceMonitor.endRouteGenerationTracking();
        break;
      case 'bundle-generation':
        performanceMonitor.endBundleGenerationTracking();
        break;
      case 'optimization':
        performanceMonitor.endOptimizationTracking();
        break;
    }

    this.phases.push({ ...this.currentPhase });
    
    console.log(`✅ Completed phase: ${this.currentPhase.name} (${this.currentPhase.duration.toFixed(2)}ms)`);
    this.currentPhase = undefined;
  }

  /**
   * Track file processing performance
   */
  trackFileProcessing(
    filePath: string,
    size: number,
    processingTime: number,
    fromCache: boolean,
    transformations: string[] = [],
    dependencies: string[] = []
  ): void {
    const metric: FileProcessingMetrics = {
      filePath,
      size,
      processingTime,
      fromCache,
      transformations,
      dependencies
    };

    this.fileMetrics.push(metric);
    this.totalFilesProcessed++;
    
    if (fromCache) {
      this.totalCacheHits++;
    }

    // Update current phase metrics
    if (this.currentPhase) {
      this.currentPhase.filesProcessed = (this.currentPhase.filesProcessed || 0) + 1;
      if (fromCache) {
        this.currentPhase.cacheHits = (this.currentPhase.cacheHits || 0) + 1;
      }
    }

    // Track slow file processing
    if (processingTime > 1000 && !fromCache) { // More than 1 second
      console.warn(`⚠️  Slow file processing: ${filePath} (${processingTime.toFixed(2)}ms)`);
    }
  }

  /**
   * Track route generation performance
   */
  trackRouteGeneration(routeCount: number, manifestSize: number, generationTime: number): void {
    console.log(`📍 Generated ${routeCount} routes (manifest: ${manifestSize} bytes) in ${generationTime.toFixed(2)}ms`);
    
    if (this.currentPhase && this.currentPhase.name === 'route-generation') {
      this.currentPhase.filesProcessed = routeCount;
    }
  }

  /**
   * Track bundle generation performance
   */
  trackBundleGeneration(
    route: string,
    originalSize: number,
    compressedSize: number,
    chunkCount: number,
    dependencies: string[]
  ): void {
    performanceMonitor.trackBundleSize(route, originalSize, compressedSize, chunkCount, dependencies);
    
    const compressionRatio = compressedSize / originalSize;
    console.log(`📦 Bundle for ${route}: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${(compressionRatio * 100).toFixed(1)}% compression)`);
  }

  /**
   * Track optimization effectiveness
   */
  trackOptimization(
    originalSize: number,
    optimizedSize: number,
    optimizationsApplied: string[]
  ): void {
    const reduction = ((originalSize - optimizedSize) / originalSize) * 100;
    console.log(`⚡ Optimization: ${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB (${reduction.toFixed(1)}% reduction)`);
    
    if (optimizationsApplied.length > 0) {
      console.log(`   Applied: ${optimizationsApplied.join(', ')}`);
    }
  }

  /**
   * Add error to current phase
   */
  addError(error: string): void {
    if (this.currentPhase) {
      this.currentPhase.errors = this.currentPhase.errors || [];
      this.currentPhase.errors.push(error);
    }
    console.error(`❌ Build error: ${error}`);
  }

  /**
   * End build tracking and generate report
   */
  endBuild(): BuildPerformanceStats {
    // End current phase if still active
    if (this.currentPhase) {
      this.endPhase();
    }

    const totalDuration = performance.now() - this.startTime;
    const cacheHitRate = this.totalFilesProcessed > 0 ? this.totalCacheHits / this.totalFilesProcessed : 0;

    // End build tracking in performance monitor
    performanceMonitor.endBuildTracking(this.totalFilesProcessed, cacheHitRate);

    const stats: BuildPerformanceStats = {
      totalDuration,
      phases: [...this.phases],
      filesProcessed: this.totalFilesProcessed,
      cacheHitRate,
      memoryPeak: this.peakMemoryUsage,
      optimizationEffectiveness: this.calculateOptimizationEffectiveness(),
      bottlenecks: this.identifyBottlenecks(),
      recommendations: this.generateRecommendations()
    };

    this.printBuildSummary(stats);
    return stats;
  }

  /**
   * Calculate optimization effectiveness score
   */
  private calculateOptimizationEffectiveness(): number {
    if (this.fileMetrics.length === 0) return 0;

    const totalOriginalSize = this.fileMetrics.reduce((sum, m) => sum + m.size, 0);
    const cacheEfficiency = this.cacheHitRate * 100;
    const processingEfficiency = this.calculateProcessingEfficiency();

    // Combine cache efficiency and processing efficiency
    return (cacheEfficiency + processingEfficiency) / 2;
  }

  /**
   * Calculate processing efficiency based on file processing times
   */
  private calculateProcessingEfficiency(): number {
    if (this.fileMetrics.length === 0) return 100;

    const avgProcessingTime = this.fileMetrics.reduce((sum, m) => sum + m.processingTime, 0) / this.fileMetrics.length;
    const avgFileSize = this.fileMetrics.reduce((sum, m) => sum + m.size, 0) / this.fileMetrics.length;
    
    // Calculate processing speed (bytes per millisecond)
    const processingSpeed = avgFileSize / avgProcessingTime;
    
    // Normalize to a 0-100 score (arbitrary baseline of 1000 bytes/ms = 100%)
    return Math.min(100, (processingSpeed / 1000) * 100);
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(): string[] {
    const bottlenecks: string[] = [];

    // Find slowest phases
    const sortedPhases = [...this.phases].sort((a, b) => (b.duration || 0) - (a.duration || 0));
    const slowestPhase = sortedPhases[0];
    
    if (slowestPhase && slowestPhase.duration && slowestPhase.duration > 5000) {
      bottlenecks.push(`Slow ${slowestPhase.name} phase (${slowestPhase.duration.toFixed(0)}ms)`);
    }

    // Find slow file processing
    const slowFiles = this.fileMetrics.filter(m => m.processingTime > 1000 && !m.fromCache);
    if (slowFiles.length > 0) {
      bottlenecks.push(`${slowFiles.length} slow file(s) processing`);
    }

    // Check cache hit rate
    if (this.cacheHitRate < 0.5) {
      bottlenecks.push(`Low cache hit rate (${(this.cacheHitRate * 100).toFixed(1)}%)`);
    }

    // Check memory usage
    const memoryUsageMB = this.peakMemoryUsage / (1024 * 1024);
    if (memoryUsageMB > 500) {
      bottlenecks.push(`High memory usage (${memoryUsageMB.toFixed(0)}MB peak)`);
    }

    return bottlenecks;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Cache recommendations
    if (this.cacheHitRate < 0.7) {
      recommendations.push('Improve caching strategy to increase cache hit rate');
    }

    // File processing recommendations
    const slowFiles = this.fileMetrics.filter(m => m.processingTime > 1000 && !m.fromCache);
    if (slowFiles.length > 0) {
      recommendations.push('Optimize slow file processing or enable parallel processing');
    }

    // Memory recommendations
    const memoryUsageMB = this.peakMemoryUsage / (1024 * 1024);
    if (memoryUsageMB > 300) {
      recommendations.push('Consider reducing memory usage through streaming or batch processing');
    }

    // Phase-specific recommendations
    const compilationPhase = this.phases.find(p => p.name === 'compilation');
    if (compilationPhase && compilationPhase.duration && compilationPhase.duration > 10000) {
      recommendations.push('Enable incremental compilation to reduce compilation time');
    }

    const optimizationPhase = this.phases.find(p => p.name === 'optimization');
    if (optimizationPhase && optimizationPhase.duration && optimizationPhase.duration > 5000) {
      recommendations.push('Review optimization settings to balance speed vs. output quality');
    }

    return recommendations;
  }

  /**
   * Print build performance summary
   */
  private printBuildSummary(stats: BuildPerformanceStats): void {
    console.log('\n🏁 Build Performance Summary');
    console.log('='.repeat(50));
    console.log(`Total Duration: ${stats.totalDuration.toFixed(2)}ms`);
    console.log(`Files Processed: ${stats.filesProcessed}`);
    console.log(`Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`Peak Memory: ${(stats.memoryPeak / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Optimization Score: ${stats.optimizationEffectiveness.toFixed(1)}%`);

    // Phase breakdown
    if (stats.phases.length > 0) {
      console.log('\n📊 Phase Breakdown:');
      for (const phase of stats.phases) {
        const duration = phase.duration || 0;
        const percentage = (duration / stats.totalDuration) * 100;
        const memoryDelta = phase.memoryAfter && phase.memoryBefore 
          ? (phase.memoryAfter.heapUsed - phase.memoryBefore.heapUsed) / 1024 / 1024
          : 0;
        
        console.log(`  ${phase.name}: ${duration.toFixed(2)}ms (${percentage.toFixed(1)}%)`);
        if (phase.filesProcessed) {
          console.log(`    Files: ${phase.filesProcessed}, Cache hits: ${phase.cacheHits || 0}`);
        }
        if (memoryDelta !== 0) {
          console.log(`    Memory: ${memoryDelta > 0 ? '+' : ''}${memoryDelta.toFixed(1)}MB`);
        }
        if (phase.errors && phase.errors.length > 0) {
          console.log(`    Errors: ${phase.errors.length}`);
        }
      }
    }

    // Bottlenecks
    if (stats.bottlenecks.length > 0) {
      console.log('\n⚠️  Performance Bottlenecks:');
      stats.bottlenecks.forEach(bottleneck => console.log(`  • ${bottleneck}`));
    }

    // Recommendations
    if (stats.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      stats.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    console.log('');
  }

  /**
   * Get detailed file processing metrics
   */
  getFileMetrics(): FileProcessingMetrics[] {
    return [...this.fileMetrics];
  }

  /**
   * Get phase metrics
   */
  getPhaseMetrics(): BuildPhase[] {
    return [...this.phases];
  }

  /**
   * Get cache hit rate
   */
  get cacheHitRate(): number {
    return this.totalFilesProcessed > 0 ? this.totalCacheHits / this.totalFilesProcessed : 0;
  }

  /**
   * Reset tracking data
   */
  reset(): void {
    this.phases = [];
    this.currentPhase = undefined;
    this.fileMetrics = [];
    this.startTime = 0;
    this.totalFilesProcessed = 0;
    this.totalCacheHits = 0;
    this.peakMemoryUsage = 0;
  }
}

/**
 * Singleton build performance tracker
 */
export const buildPerformanceTracker = new BuildPerformanceTracker();