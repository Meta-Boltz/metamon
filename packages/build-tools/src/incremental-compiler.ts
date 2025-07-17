import { readFileSync, statSync, existsSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { MTMParser, CompilationResult } from '@metamon/core';
import { FrameworkAdapter } from '@metamon/adapters';

/**
 * Compilation cache entry
 */
interface CacheEntry {
  result: CompilationResult;
  lastModified: number;
  dependencies: string[];
  dependencyHashes: Map<string, number>;
}

/**
 * Dependency graph node
 */
interface DependencyNode {
  filePath: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  lastModified: number;
}

/**
 * Incremental compiler for .mtm files
 */
export class IncrementalCompiler {
  private cache = new Map<string, CacheEntry>();
  private dependencyGraph = new Map<string, DependencyNode>();
  private parser = new MTMParser();

  constructor(private adapters: Record<string, FrameworkAdapter>) {}

  /**
   * Compile a .mtm file with incremental compilation support
   */
  async compile(filePath: string): Promise<CompilationResult> {
    const resolvedPath = resolve(filePath);
    
    // Check if we need to recompile
    if (!this.needsRecompilation(resolvedPath)) {
      const cached = this.cache.get(resolvedPath);
      if (cached) {
        return cached.result;
      }
    }

    // Parse and compile the file
    const mtmFile = this.parser.parse(resolvedPath);
    const adapter = this.adapters[mtmFile.frontmatter.target];
    
    if (!adapter) {
      throw new Error(`Unsupported framework: ${mtmFile.frontmatter.target}`);
    }

    const result = adapter.compile(mtmFile);
    
    // Update cache and dependency graph
    this.updateCache(resolvedPath, result);
    this.updateDependencyGraph(resolvedPath, result.dependencies);
    
    return result;
  }

  /**
   * Get all files that need recompilation due to dependency changes
   */
  getFilesToRecompile(changedFile: string): string[] {
    const resolvedPath = resolve(changedFile);
    const filesToRecompile = new Set<string>();
    
    // Add the changed file itself if it's a .mtm file
    if (changedFile.endsWith('.mtm')) {
      filesToRecompile.add(resolvedPath);
    }
    
    // Find all dependents recursively
    this.findDependents(resolvedPath, filesToRecompile);
    
    return Array.from(filesToRecompile);
  }

  /**
   * Clear cache for a specific file
   */
  clearCache(filePath: string): void {
    const resolvedPath = resolve(filePath);
    this.cache.delete(resolvedPath);
    this.dependencyGraph.delete(resolvedPath);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear();
    this.dependencyGraph.clear();
  }

  /**
   * Get compilation statistics
   */
  getStats(): {
    cachedFiles: number;
    totalDependencies: number;
    averageDependencies: number;
  } {
    const cachedFiles = this.cache.size;
    const totalDependencies = Array.from(this.dependencyGraph.values())
      .reduce((sum, node) => sum + node.dependencies.size, 0);
    
    return {
      cachedFiles,
      totalDependencies,
      averageDependencies: cachedFiles > 0 ? totalDependencies / cachedFiles : 0
    };
  }

  /**
   * Check if a file needs recompilation
   */
  private needsRecompilation(filePath: string): boolean {
    const cached = this.cache.get(filePath);
    if (!cached) {
      return true;
    }

    // Check if the main file has changed
    try {
      const stats = statSync(filePath);
      if (stats.mtime.getTime() > cached.lastModified) {
        return true;
      }
    } catch {
      // File doesn't exist, needs recompilation
      return true;
    }

    // Check if any dependencies have changed
    for (const [depPath, cachedHash] of cached.dependencyHashes) {
      if (!existsSync(depPath)) {
        return true;
      }
      
      try {
        const stats = statSync(depPath);
        if (stats.mtime.getTime() !== cachedHash) {
          return true;
        }
      } catch {
        return true;
      }
    }

    return false;
  }

  /**
   * Update the compilation cache
   */
  private updateCache(filePath: string, result: CompilationResult): void {
    const stats = statSync(filePath);
    const dependencyHashes = new Map<string, number>();
    
    // Hash all dependencies
    result.dependencies.forEach(dep => {
      const depPath = this.resolveDependency(filePath, dep);
      if (depPath && existsSync(depPath)) {
        try {
          const depStats = statSync(depPath);
          dependencyHashes.set(depPath, depStats.mtime.getTime());
        } catch {
          // Ignore errors for dependencies that can't be stat'd
        }
      }
    });

    this.cache.set(filePath, {
      result,
      lastModified: stats.mtime.getTime(),
      dependencies: result.dependencies,
      dependencyHashes
    });
  }

  /**
   * Update the dependency graph
   */
  private updateDependencyGraph(filePath: string, dependencies: string[]): void {
    const stats = statSync(filePath);
    const resolvedDeps = dependencies
      .map(dep => this.resolveDependency(filePath, dep))
      .filter((dep): dep is string => dep !== null);

    // Update or create the node for this file
    const node: DependencyNode = this.dependencyGraph.get(filePath) || {
      filePath,
      dependencies: new Set(),
      dependents: new Set(),
      lastModified: 0
    };

    // Clear old dependencies
    node.dependencies.forEach(oldDep => {
      const depNode = this.dependencyGraph.get(oldDep);
      if (depNode) {
        depNode.dependents.delete(filePath);
      }
    });

    // Set new dependencies
    node.dependencies = new Set(resolvedDeps);
    node.lastModified = stats.mtime.getTime();

    // Update dependent relationships
    resolvedDeps.forEach(dep => {
      let depNode = this.dependencyGraph.get(dep);
      if (!depNode) {
        depNode = {
          filePath: dep,
          dependencies: new Set(),
          dependents: new Set(),
          lastModified: 0
        };
        this.dependencyGraph.set(dep, depNode);
      }
      depNode.dependents.add(filePath);
    });

    this.dependencyGraph.set(filePath, node);
  }

  /**
   * Find all dependents of a file recursively
   */
  private findDependents(filePath: string, result: Set<string>): void {
    const node = this.dependencyGraph.get(filePath);
    if (!node) return;

    node.dependents.forEach(dependent => {
      if (!result.has(dependent)) {
        result.add(dependent);
        this.findDependents(dependent, result);
      }
    });
  }

  /**
   * Resolve a dependency path relative to a file
   */
  private resolveDependency(fromFile: string, dependency: string): string | null {
    if (dependency.startsWith('./') || dependency.startsWith('../')) {
      // Relative import
      const basePath = dirname(fromFile);
      return resolve(basePath, dependency);
    } else if (!dependency.startsWith('@') && !dependency.includes('/')) {
      // Could be a local file without extension
      const basePath = dirname(fromFile);
      const possiblePaths = [
        resolve(basePath, dependency + '.mtm'),
        resolve(basePath, dependency + '.ts'),
        resolve(basePath, dependency + '.tsx'),
        resolve(basePath, dependency + '.js'),
        resolve(basePath, dependency + '.jsx')
      ];
      
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          return path;
        }
      }
    }
    
    // External dependency or not found
    return null;
  }
}