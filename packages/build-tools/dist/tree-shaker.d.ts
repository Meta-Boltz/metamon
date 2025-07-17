import { DependencyGraph } from '@metamon/core';
/**
 * Configuration for tree-shaking optimization
 */
export interface TreeShakingConfig {
    /** Enable tree-shaking for runtime features */
    runtime: boolean;
    /** Enable tree-shaking for framework adapters */
    adapters: boolean;
    /** Enable tree-shaking for unused components */
    components: boolean;
    /** Preserve specific exports even if unused */
    preserve: string[];
    /** Enable aggressive tree-shaking (may break some edge cases) */
    aggressive: boolean;
}
/**
 * Result of tree-shaking analysis
 */
export interface TreeShakingResult {
    /** Original bundle size */
    originalSize: number;
    /** Optimized bundle size */
    optimizedSize: number;
    /** Bytes saved */
    bytesSaved: number;
    /** Percentage reduction */
    reductionPercentage: number;
    /** Removed features */
    removedFeatures: string[];
    /** Warnings about potentially unsafe removals */
    warnings: string[];
}
/**
 * Tree-shaking optimizer for Metamon bundles
 */
export declare class TreeShaker {
    private config;
    private usedFeatures;
    private usedAdapters;
    private usedComponents;
    constructor(config: TreeShakingConfig);
    /**
     * Analyze and optimize bundle by removing unused code
     */
    optimize(bundlePath: string, dependencyGraph: DependencyGraph): Promise<TreeShakingResult>;
    /**
     * Analyze which features are actually used in the dependency graph
     */
    private analyzeUsage;
    /**
     * Analyze runtime feature usage in code
     */
    private analyzeRuntimeUsage;
    /**
     * Remove unused runtime features
     */
    private shakeRuntimeFeatures;
    /**
     * Remove unused framework adapters
     */
    private shakeFrameworkAdapters;
    /**
     * Remove unused component imports and definitions
     */
    private shakeUnusedComponents;
    /**
     * Extract component name from import statement
     */
    private extractComponentName;
    /**
     * Eliminate dead code (unreachable code, unused variables, etc.)
     */
    private eliminateDeadCode;
    /**
     * Get tree-shaking statistics for analysis
     */
    getStatistics(): {
        usedFeatures: string[];
        usedAdapters: string[];
        usedComponents: string[];
    };
}
