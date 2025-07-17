import { ImportResolver, ImportResolverConfig, MTMDependency, DependencyGraph } from '../types/import-resolver.js';
/**
 * Implementation of import resolver for .mtm files
 */
export declare class MTMImportResolver implements ImportResolver {
    private config;
    constructor(config: ImportResolverConfig);
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
     * Get build order respecting dependencies using topological sort
     */
    getBuildOrder(graph: DependencyGraph): string[];
    /**
     * Detect circular dependencies using DFS
     */
    detectCircularDependencies(graph: DependencyGraph): string[][];
    /**
     * Check if a file exists
     */
    private fileExists;
}
