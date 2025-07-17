import { CompilationResult } from '@metamon/core';
import { FrameworkAdapter } from '@metamon/adapters';
/**
 * Incremental compiler for .mtm files
 */
export declare class IncrementalCompiler {
    private adapters;
    private cache;
    private dependencyGraph;
    private parser;
    constructor(adapters: Record<string, FrameworkAdapter>);
    /**
     * Compile a .mtm file with incremental compilation support
     */
    compile(filePath: string): Promise<CompilationResult>;
    /**
     * Get all files that need recompilation due to dependency changes
     */
    getFilesToRecompile(changedFile: string): string[];
    /**
     * Clear cache for a specific file
     */
    clearCache(filePath: string): void;
    /**
     * Clear all caches
     */
    clearAllCaches(): void;
    /**
     * Get compilation statistics
     */
    getStats(): {
        cachedFiles: number;
        totalDependencies: number;
        averageDependencies: number;
    };
    /**
     * Check if a file needs recompilation
     */
    private needsRecompilation;
    /**
     * Update the compilation cache
     */
    private updateCache;
    /**
     * Update the dependency graph
     */
    private updateDependencyGraph;
    /**
     * Find all dependents of a file recursively
     */
    private findDependents;
    /**
     * Resolve a dependency path relative to a file
     */
    private resolveDependency;
}
