import { DependencyGraph, MTMFileInfo } from '@metamon/core';
import { MetamonBuildOptions } from './types/build-options.js';
/**
 * Tracks dependencies and manages build optimization
 */
export declare class DependencyTracker {
    private resolver;
    private options;
    private dependencyGraph?;
    private lastBuildTime;
    constructor(options: MetamonBuildOptions);
    /**
     * Scan for all .mtm files in the project
     */
    scanMTMFiles(): Promise<string[]>;
    /**
     * Build dependency graph for the project
     */
    buildDependencyGraph(): Promise<DependencyGraph>;
    /**
     * Get files that need to be rebuilt based on changes
     */
    getFilesToRebuild(changedFiles: string[]): Promise<string[]>;
    /**
     * Get optimal build order for files
     */
    getBuildOrder(): string[];
    /**
     * Check if a file needs rebuilding based on modification time
     */
    needsRebuild(filePath: string): Promise<boolean>;
    /**
     * Mark a file as built
     */
    markAsBuilt(filePath: string): void;
    /**
     * Get dependency information for a specific file
     */
    getFileInfo(filePath: string): MTMFileInfo | undefined;
    /**
     * Get all pages in the project
     */
    getPages(): MTMFileInfo[];
    /**
     * Get all components in the project
     */
    getComponents(): MTMFileInfo[];
    /**
     * Get files grouped by framework
     */
    getFilesByFramework(): Map<string, MTMFileInfo[]>;
    /**
     * Detect circular dependencies
     */
    getCircularDependencies(): string[][];
    /**
     * Get statistics about the project
     */
    getProjectStats(): {
        totalFiles: number;
        pageCount: number;
        componentCount: number;
        frameworkBreakdown: Record<string, number>;
        circularDependencies: number;
        averageDependencies: number;
    };
    /**
     * Get all files that depend on a given file
     */
    private getDependents;
    /**
     * Recursively scan directory for files
     */
    private scanDirectory;
    /**
     * Validate the dependency graph for issues
     */
    private validateDependencyGraph;
}
