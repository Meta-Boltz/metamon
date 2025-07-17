import * as path from 'path';
import * as fs from 'fs/promises';
import { MTMImportResolver, DependencyGraph, MTMFileInfo } from '@metamon/core';
import { MetamonBuildOptions } from './types/build-options.js';

/**
 * Tracks dependencies and manages build optimization
 */
export class DependencyTracker {
  private resolver: MTMImportResolver;
  private options: MetamonBuildOptions;
  private dependencyGraph?: DependencyGraph;
  private lastBuildTime = new Map<string, number>();

  constructor(options: MetamonBuildOptions) {
    this.options = options;
    this.resolver = new MTMImportResolver({
      root: options.root || process.cwd(),
      pagesDir: options.pagesDir || 'pages',
      componentsDir: options.componentsDir || 'components',
      extensions: ['.mtm'],
      alias: {
        '@': options.root || process.cwd(),
        '@components': path.join(options.root || process.cwd(), options.componentsDir || 'components'),
        '@pages': path.join(options.root || process.cwd(), options.pagesDir || 'pages')
      }
    });
  }

  /**
   * Scan for all .mtm files in the project
   */
  async scanMTMFiles(): Promise<string[]> {
    const files: string[] = [];
    const rootDir = this.options.root || process.cwd();
    
    await this.scanDirectory(rootDir, files);
    
    return files.filter(file => file.endsWith('.mtm'));
  }

  /**
   * Build dependency graph for the project
   */
  async buildDependencyGraph(): Promise<DependencyGraph> {
    const files = await this.scanMTMFiles();
    this.dependencyGraph = this.resolver.buildDependencyGraph(files);
    
    // Validate the graph
    await this.validateDependencyGraph(this.dependencyGraph);
    
    return this.dependencyGraph;
  }

  /**
   * Get files that need to be rebuilt based on changes
   */
  async getFilesToRebuild(changedFiles: string[]): Promise<string[]> {
    if (!this.dependencyGraph) {
      await this.buildDependencyGraph();
    }

    const toRebuild = new Set<string>();
    
    for (const changedFile of changedFiles) {
      // Add the changed file itself
      toRebuild.add(changedFile);
      
      // Add all files that depend on this file
      const dependents = this.getDependents(changedFile);
      dependents.forEach(dep => toRebuild.add(dep));
    }

    return Array.from(toRebuild);
  }

  /**
   * Get optimal build order for files
   */
  getBuildOrder(): string[] {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not built. Call buildDependencyGraph() first.');
    }

    return this.dependencyGraph.buildOrder;
  }

  /**
   * Check if a file needs rebuilding based on modification time
   */
  async needsRebuild(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtime.getTime();
      const lastBuild = this.lastBuildTime.get(filePath) || 0;
      
      return lastModified > lastBuild;
    } catch {
      return true; // File doesn't exist, needs build
    }
  }

  /**
   * Mark a file as built
   */
  markAsBuilt(filePath: string): void {
    this.lastBuildTime.set(filePath, Date.now());
  }

  /**
   * Get dependency information for a specific file
   */
  getFileInfo(filePath: string): MTMFileInfo | undefined {
    return this.dependencyGraph?.files.get(filePath);
  }

  /**
   * Get all pages in the project
   */
  getPages(): MTMFileInfo[] {
    if (!this.dependencyGraph) {
      return [];
    }

    return Array.from(this.dependencyGraph.files.values())
      .filter(file => file.type === 'page');
  }

  /**
   * Get all components in the project
   */
  getComponents(): MTMFileInfo[] {
    if (!this.dependencyGraph) {
      return [];
    }

    return Array.from(this.dependencyGraph.files.values())
      .filter(file => file.type === 'component');
  }

  /**
   * Get files grouped by framework
   */
  getFilesByFramework(): Map<string, MTMFileInfo[]> {
    if (!this.dependencyGraph) {
      return new Map();
    }

    const byFramework = new Map<string, MTMFileInfo[]>();
    
    for (const fileInfo of this.dependencyGraph.files.values()) {
      if (!byFramework.has(fileInfo.framework)) {
        byFramework.set(fileInfo.framework, []);
      }
      byFramework.get(fileInfo.framework)!.push(fileInfo);
    }

    return byFramework;
  }

  /**
   * Detect circular dependencies
   */
  getCircularDependencies(): string[][] {
    return this.dependencyGraph?.circularDependencies || [];
  }

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
  } {
    if (!this.dependencyGraph) {
      return {
        totalFiles: 0,
        pageCount: 0,
        componentCount: 0,
        frameworkBreakdown: {},
        circularDependencies: 0,
        averageDependencies: 0
      };
    }

    const files = Array.from(this.dependencyGraph.files.values());
    const frameworkBreakdown: Record<string, number> = {};
    let totalDependencies = 0;

    for (const file of files) {
      frameworkBreakdown[file.framework] = (frameworkBreakdown[file.framework] || 0) + 1;
      totalDependencies += file.dependencies.length;
    }

    return {
      totalFiles: files.length,
      pageCount: files.filter(f => f.type === 'page').length,
      componentCount: files.filter(f => f.type === 'component').length,
      frameworkBreakdown,
      circularDependencies: this.dependencyGraph.circularDependencies.length,
      averageDependencies: files.length > 0 ? totalDependencies / files.length : 0
    };
  }

  /**
   * Get all files that depend on a given file
   */
  private getDependents(filePath: string): string[] {
    if (!this.dependencyGraph) {
      return [];
    }

    const fileInfo = this.dependencyGraph.files.get(filePath);
    return fileInfo ? fileInfo.dependents : [];
  }

  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(dir: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            await this.scanDirectory(fullPath, files);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dir}: ${error}`);
    }
  }

  /**
   * Validate the dependency graph for issues
   */
  private async validateDependencyGraph(graph: DependencyGraph): Promise<void> {
    const issues: string[] = [];

    // Check for circular dependencies
    if (graph.circularDependencies.length > 0) {
      issues.push(`Found ${graph.circularDependencies.length} circular dependencies`);
      for (const cycle of graph.circularDependencies) {
        issues.push(`  Circular dependency: ${cycle.join(' -> ')}`);
      }
    }

    // Check for missing dependencies
    for (const [filePath, fileInfo] of graph.files) {
      for (const dep of fileInfo.dependencies) {
        if (!graph.files.has(dep.importee)) {
          issues.push(`Missing dependency: ${dep.specifier} in ${filePath}`);
        }
      }
    }

    // Check for framework mismatches in dependencies
    for (const [filePath, fileInfo] of graph.files) {
      for (const dep of fileInfo.dependencies) {
        const depInfo = graph.files.get(dep.importee);
        if (depInfo && depInfo.framework !== fileInfo.framework && depInfo.framework !== 'unknown') {
          issues.push(`Framework mismatch: ${filePath} (${fileInfo.framework}) depends on ${dep.importee} (${depInfo.framework})`);
        }
      }
    }

    if (issues.length > 0) {
      console.warn('Dependency graph validation issues:');
      issues.forEach(issue => console.warn(`  ${issue}`));
    }
  }
}