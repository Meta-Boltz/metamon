import { DependencyGraph } from '@metamon/core';
/**
 * Configuration for module bundling
 */
export interface ModuleBundlerConfig {
    /** Output directory for bundled modules */
    outDir: string;
    /** Whether to generate source maps */
    sourceMaps: boolean;
    /** Whether to minify output */
    minify: boolean;
    /** Target environment (es2015, es2020, etc.) */
    target: string;
    /** External dependencies to exclude from bundle */
    external: string[];
    /** Code splitting configuration */
    splitting?: {
        /** Enable code splitting */
        enabled: boolean;
        /** Chunk size threshold for splitting */
        chunkSizeThreshold: number;
        /** Shared dependencies threshold */
        sharedDepsThreshold: number;
    };
}
/**
 * Information about a generated bundle
 */
export interface BundleInfo {
    /** Bundle file path */
    filePath: string;
    /** Original .mtm files included in this bundle */
    sources: string[];
    /** Bundle size in bytes */
    size: number;
    /** Dependencies of this bundle */
    dependencies: string[];
    /** Framework this bundle targets */
    framework: string;
    /** Whether this is a page or component bundle */
    type: 'page' | 'component';
}
/**
 * Result of bundling operation
 */
export interface BundleResult {
    /** Generated bundles */
    bundles: BundleInfo[];
    /** Total build time in milliseconds */
    buildTime: number;
    /** Any warnings generated during bundling */
    warnings: string[];
    /** Bundle analysis information */
    analysis: {
        /** Total bundle size */
        totalSize: number;
        /** Largest bundle */
        largestBundle: BundleInfo;
        /** Duplicate dependencies across bundles */
        duplicateDependencies: string[];
    };
}
/**
 * Interface for bundling generated .mtm components
 */
export interface ModuleBundler {
    /**
     * Bundle components based on dependency graph
     */
    bundle(graph: DependencyGraph, config: ModuleBundlerConfig): Promise<BundleResult>;
    /**
     * Generate a single bundle for a specific file
     */
    bundleFile(filePath: string, config: ModuleBundlerConfig): Promise<BundleInfo>;
    /**
     * Optimize bundle splitting based on dependencies
     */
    optimizeSplitting(graph: DependencyGraph): Map<string, string[]>;
    /**
     * Analyze bundle for optimization opportunities
     */
    analyzeBundles(bundles: BundleInfo[]): {
        duplicateDependencies: string[];
        optimizationSuggestions: string[];
    };
}
