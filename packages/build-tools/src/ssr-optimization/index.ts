/**
 * SSR Optimization Module
 * 
 * Exports all SSR optimization components for server-side rendering optimization,
 * selective hydration, framework requirement analysis, and progressive enhancement.
 */

// Main SSR Optimization Manager
export { SSROptimizationManager } from './ssr-optimization-manager.js';

// Selective Hydration Service
export { 
  SelectiveHydrationService,
  type HydrationStrategy,
  type HydrationScheduler
} from './selective-hydration-service.js';

// Framework Requirement Analyzer
export {
  FrameworkRequirementAnalyzer,
  type FrameworkAnalysisResult,
  type FrameworkMetadata
} from './framework-requirement-analyzer.js';

// Progressive Enhancement Fallback
export {
  ProgressiveEnhancementFallback,
  type FallbackConfig,
  type FallbackMetrics
} from './progressive-enhancement-fallback.js';

// Types
export * from '../types/ssr-optimization.js';

// Utility functions
export const createSSROptimizationManager = (config?: any) => {
  return new SSROptimizationManager(config);
};

export const createSelectiveHydrationService = () => {
  return new SelectiveHydrationService();
};

export const createFrameworkRequirementAnalyzer = () => {
  return new FrameworkRequirementAnalyzer();
};

export const createProgressiveEnhancementFallback = (config?: any) => {
  return new ProgressiveEnhancementFallback(config);
};