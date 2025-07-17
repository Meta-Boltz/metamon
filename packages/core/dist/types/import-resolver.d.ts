/**
 * Types for import resolution and dependency tracking
 */
/**
 * Represents a dependency between .mtm files
 */
export interface MTMDependency {
    /** The file that imports */
    importer: string;
    /** The file being imported */
    importee: string;
    /** Import specifier (e.g., './Button.mtm') */
    specifier: string;
    /** Resolved absolute path */
    resolvedPath: string;
    /** Whether this is a dynamic import */
    isDynamic: boolean;
}
/**
 * Information about an .mtm file's type and location
 */
export interface MTMFileInfo {
    /** Absolute file path */
    filePath: string;
    /** Relative path from project root */
    relativePath: string;
    /** Whether this is a page or component */
    type: 'page' | 'component';
    /** Target framework */
    framework: string;
    /** Dependencies of this file */
    dependencies: MTMDependency[];
    /** Files that depend on this file */
    dependents: string[];
}
/**
 * Dependency graph for the entire project
 */
export interface DependencyGraph {
    /** Map of file path to file info */
    files: Map<string, MTMFileInfo>;
    /** Topologically sorted file paths for build order */
    buildOrder: string[];
    /** Circular dependencies if any */
    circularDependencies: string[][];
}
/**
 * Import resolution configuration
 */
export interface ImportResolverConfig {
    /** Project root directory */
    root: string;
    /** Pages directory relative to root */
    pagesDir: string;
    /** Components directory relative to root */
    componentsDir: string;
    /** File extensions to resolve */
    extensions: string[];
    /** Alias mappings */
    alias?: Record<string, string>;
}
/**
 * Interface for resolving imports in .mtm files
 */
export interface ImportResolver {
    /**
     * Resolve an import specifier to an absolute path
     */
    resolve(specifier: string, importer: string): string | null;
    /**
     * Determine if a file is a page or component based on location
     */
    getFileType(filePath: string): 'page' | 'component';
    /**
     * Extract dependencies from an .mtm file
     */
    extractDependencies(filePath: string, content: string): MTMDependency[];
    /**
     * Build dependency graph for all .mtm files
     */
    buildDependencyGraph(files: string[]): DependencyGraph;
    /**
     * Get build order respecting dependencies
     */
    getBuildOrder(graph: DependencyGraph): string[];
    /**
     * Detect circular dependencies
     */
    detectCircularDependencies(graph: DependencyGraph): string[][];
}
/**
 * Result of import resolution
 */
export interface ImportResolutionResult {
    /** Resolved absolute path */
    resolvedPath: string | null;
    /** Whether resolution was successful */
    success: boolean;
    /** Error message if resolution failed */
    error?: string;
}
