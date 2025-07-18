/**
 * Bundle Optimization Module
 * 
 * Comprehensive bundle optimization system for Metamon framework
 * with intelligent bundling, shared dependency extraction, HTTP/2 optimization,
 * and cache strategy optimization for maximum hit rates.
 */

// Main orchestrator
export { 
  BundleOptimizationOrchestrator,
  type ComprehensiveBundleOptimizationConfig,
  type ComprehensiveOptimizationResult
} from './bundle-optimization-orchestrator.js';

// Core bundle optimizer
export {
  BundleOptimizer,
  type BundleOptimizationConfig,
  type OptimizationResult,
  type OptimizedBundle,
  type SharedDependencyChunk,
  type CacheStrategyManifest,
  type HTTP2OptimizationManifest,
  type OptimizationMetrics
} from './bundle-optimizer.js';

// Shared dependency extractor
export {
  SharedDependencyExtractor,
  type SharedDependencyConfig,
  type DependencyAnalysis,
  type SharedChunk,
  type ExtractionResult
} from './shared-dependency-extractor.js';

// HTTP/2 multiplexing optimizer
export {
  HTTP2MultiplexingOptimizer,
  type HTTP2OptimizationConfig,
  type HTTP2BundleMetrics,
  type HTTP2LoadingSequence,
  type HTTP2OptimizationResult
} from './http2-multiplexing-optimizer.js';

// Cache strategy optimizer
export {
  CacheStrategyOptimizer,
  type CachePattern,
  type CacheAnalytics,
  type OptimizedCacheStrategy,
  type CacheOptimizationResult
} from './cache-strategy-optimizer.js';

/**
 * Create a bundle optimization orchestrator with default configuration
 */
export function createBundleOptimizer(
  overrides?: Partial<ComprehensiveBundleOptimizationConfig>
): BundleOptimizationOrchestrator {
  const defaultConfig = BundleOptimizationOrchestrator.createDefaultConfig();
  const config = overrides ? { ...defaultConfig, ...overrides } : defaultConfig;
  return new BundleOptimizationOrchestrator(config);
}

/**
 * Quick optimization function for simple use cases
 */
export async function optimizeBundle(
  bundle: any,
  config?: Partial<ComprehensiveBundleOptimizationConfig>
): Promise<ComprehensiveOptimizationResult> {
  const optimizer = createBundleOptimizer(config);
  return await optimizer.optimize(bundle);
}