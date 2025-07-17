import { DependencyGraph } from '@metamon/core';
import { ModuleBundler, ModuleBundlerConfig, BundleInfo, BundleResult } from './types/module-bundler.js';
/**
 * Implementation of module bundler for .mtm components
 */
export declare class MTMModuleBundler implements ModuleBundler {
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
    /**
     * Group files by framework and type for optimal bundling
     */
    private groupFilesByFrameworkAndType;
    /**
     * Bundle a group of files
     */
    private bundleGroup;
    /**
     * Apply code splitting to bundles
     */
    private applySplitting;
    /**
     * Split a large bundle into smaller chunks
     */
    private splitBundle;
    /**
     * Find dependencies shared across multiple files
     */
    private findSharedDependencies;
    /**
     * Extract dependencies from compiled code
     */
    private extractDependenciesFromCode;
    /**
     * Get framework from file path
     */
    private getFrameworkFromPath;
    /**
     * Get type from file path
     */
    private getTypeFromPath;
    /**
     * Simple code minification
     */
    private minifyCode;
    /**
     * Generate source map
     */
    private generateSourceMap;
}
