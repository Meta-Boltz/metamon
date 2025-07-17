import * as path from 'path';
import * as fs from 'fs/promises';
import { DependencyGraph, MTMFileInfo } from '@metamon/core';
import {
  ModuleBundler,
  ModuleBundlerConfig,
  BundleInfo,
  BundleResult
} from './types/module-bundler.js';

/**
 * Implementation of module bundler for .mtm components
 */
export class MTMModuleBundler implements ModuleBundler {
  
  /**
   * Bundle components based on dependency graph
   */
  async bundle(graph: DependencyGraph, config: ModuleBundlerConfig): Promise<BundleResult> {
    const startTime = Date.now();
    const bundles: BundleInfo[] = [];
    const warnings: string[] = [];

    // Ensure output directory exists
    await fs.mkdir(config.outDir, { recursive: true });

    // Group files by framework and type for optimal bundling
    const fileGroups = this.groupFilesByFrameworkAndType(graph);

    // Bundle each group
    for (const [groupKey, files] of fileGroups) {
      const [framework, type] = groupKey.split(':');
      
      try {
        const bundleInfo = await this.bundleGroup(
          files,
          framework,
          type as 'page' | 'component',
          config
        );
        bundles.push(bundleInfo);
      } catch (error) {
        warnings.push(`Failed to bundle ${groupKey}: ${error}`);
      }
    }

    // Apply code splitting if enabled
    if (config.splitting?.enabled) {
      const optimizedBundles = await this.applySplitting(bundles, config);
      bundles.splice(0, bundles.length, ...optimizedBundles);
    }

    const buildTime = Date.now() - startTime;
    const analysis = this.analyzeBundles(bundles);

    return {
      bundles,
      buildTime,
      warnings,
      analysis: {
        totalSize: bundles.reduce((sum, bundle) => sum + bundle.size, 0),
        largestBundle: bundles.reduce((largest, current) => 
          current.size > largest.size ? current : largest, bundles[0]),
        duplicateDependencies: analysis.duplicateDependencies
      }
    };
  }

  /**
   * Generate a single bundle for a specific file
   */
  async bundleFile(filePath: string, config: ModuleBundlerConfig): Promise<BundleInfo> {
    // Read the compiled file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract dependencies from the compiled code
    const dependencies = this.extractDependenciesFromCode(content);
    
    // Determine framework and type from file path
    const framework = this.getFrameworkFromPath(filePath);
    const type = this.getTypeFromPath(filePath);
    
    // Generate bundle
    const bundlePath = path.join(
      config.outDir,
      `${path.basename(filePath, path.extname(filePath))}.bundle.js`
    );

    let bundledContent = content;
    
    // Apply minification if enabled
    if (config.minify) {
      bundledContent = this.minifyCode(bundledContent);
    }

    // Write bundle
    await fs.writeFile(bundlePath, bundledContent);
    
    // Generate source map if enabled
    if (config.sourceMaps) {
      const sourceMapPath = `${bundlePath}.map`;
      const sourceMap = this.generateSourceMap(filePath, bundlePath);
      await fs.writeFile(sourceMapPath, JSON.stringify(sourceMap));
      bundledContent += `\n//# sourceMappingURL=${path.basename(sourceMapPath)}`;
      await fs.writeFile(bundlePath, bundledContent);
    }

    const stats = await fs.stat(bundlePath);

    return {
      filePath: bundlePath,
      sources: [filePath],
      size: stats.size,
      dependencies,
      framework,
      type
    };
  }

  /**
   * Optimize bundle splitting based on dependencies
   */
  optimizeSplitting(graph: DependencyGraph): Map<string, string[]> {
    const chunks = new Map<string, string[]>();
    const sharedDependencies = this.findSharedDependencies(graph);
    
    // Create shared chunk for common dependencies
    if (sharedDependencies.length > 0) {
      chunks.set('shared', sharedDependencies);
    }

    // Group remaining files by framework
    for (const [filePath, fileInfo] of graph.files) {
      if (!sharedDependencies.includes(filePath)) {
        const chunkKey = `${fileInfo.framework}-${fileInfo.type}`;
        if (!chunks.has(chunkKey)) {
          chunks.set(chunkKey, []);
        }
        chunks.get(chunkKey)!.push(filePath);
      }
    }

    return chunks;
  }

  /**
   * Analyze bundle for optimization opportunities
   */
  analyzeBundles(bundles: BundleInfo[]): {
    duplicateDependencies: string[];
    optimizationSuggestions: string[];
  } {
    const allDependencies = new Map<string, number>();
    const duplicateDependencies: string[] = [];
    const optimizationSuggestions: string[] = [];

    // Count dependency usage across bundles
    for (const bundle of bundles) {
      for (const dep of bundle.dependencies) {
        const count = allDependencies.get(dep) || 0;
        allDependencies.set(dep, count + 1);
      }
    }

    // Find duplicates
    for (const [dep, count] of allDependencies) {
      if (count > 1) {
        duplicateDependencies.push(dep);
      }
    }

    // Generate optimization suggestions
    if (duplicateDependencies.length > 0) {
      optimizationSuggestions.push(
        `Consider creating a shared chunk for ${duplicateDependencies.length} duplicate dependencies`
      );
    }

    const largeBundles = bundles.filter(b => b.size > 500 * 1024); // > 500KB
    if (largeBundles.length > 0) {
      optimizationSuggestions.push(
        `${largeBundles.length} bundles are larger than 500KB, consider code splitting`
      );
    }

    return {
      duplicateDependencies,
      optimizationSuggestions
    };
  }

  /**
   * Group files by framework and type for optimal bundling
   */
  private groupFilesByFrameworkAndType(graph: DependencyGraph): Map<string, MTMFileInfo[]> {
    const groups = new Map<string, MTMFileInfo[]>();

    for (const [filePath, fileInfo] of graph.files) {
      const groupKey = `${fileInfo.framework}:${fileInfo.type}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      
      groups.get(groupKey)!.push(fileInfo);
    }

    return groups;
  }

  /**
   * Bundle a group of files
   */
  private async bundleGroup(
    files: MTMFileInfo[],
    framework: string,
    type: 'page' | 'component',
    config: ModuleBundlerConfig
  ): Promise<BundleInfo> {
    const bundleName = `${framework}-${type}.bundle.js`;
    const bundlePath = path.join(config.outDir, bundleName);
    
    let bundledContent = '';
    const allDependencies = new Set<string>();
    const sources: string[] = [];

    // Combine all files in the group
    for (const fileInfo of files) {
      try {
        const content = await fs.readFile(fileInfo.filePath, 'utf-8');
        bundledContent += `\n// Source: ${fileInfo.relativePath}\n${content}\n`;
        sources.push(fileInfo.filePath);
        
        // Extract dependencies
        const deps = this.extractDependenciesFromCode(content);
        deps.forEach(dep => allDependencies.add(dep));
      } catch (error) {
        console.warn(`Failed to read file ${fileInfo.filePath}: ${error}`);
      }
    }

    // Apply minification if enabled
    if (config.minify) {
      bundledContent = this.minifyCode(bundledContent);
    }

    // Write bundle
    await fs.writeFile(bundlePath, bundledContent);
    
    const stats = await fs.stat(bundlePath);

    return {
      filePath: bundlePath,
      sources,
      size: stats.size,
      dependencies: Array.from(allDependencies),
      framework,
      type
    };
  }

  /**
   * Apply code splitting to bundles
   */
  private async applySplitting(
    bundles: BundleInfo[],
    config: ModuleBundlerConfig
  ): Promise<BundleInfo[]> {
    const threshold = config.splitting!.chunkSizeThreshold;
    const splitBundles: BundleInfo[] = [];

    for (const bundle of bundles) {
      if (bundle.size > threshold) {
        // Split large bundles
        const chunks = await this.splitBundle(bundle, threshold);
        splitBundles.push(...chunks);
      } else {
        splitBundles.push(bundle);
      }
    }

    return splitBundles;
  }

  /**
   * Split a large bundle into smaller chunks
   */
  private async splitBundle(bundle: BundleInfo, threshold: number): Promise<BundleInfo[]> {
    // Simple splitting strategy: split by source files
    const chunks: BundleInfo[] = [];
    const sourcesPerChunk = Math.ceil(bundle.sources.length / Math.ceil(bundle.size / threshold));
    
    for (let i = 0; i < bundle.sources.length; i += sourcesPerChunk) {
      const chunkSources = bundle.sources.slice(i, i + sourcesPerChunk);
      const chunkPath = bundle.filePath.replace('.bundle.js', `.chunk${Math.floor(i / sourcesPerChunk)}.bundle.js`);
      
      // Create chunk content
      let chunkContent = '';
      const chunkDeps = new Set<string>();
      
      for (const source of chunkSources) {
        const content = await fs.readFile(source, 'utf-8');
        chunkContent += `\n// Source: ${path.relative(process.cwd(), source)}\n${content}\n`;
        
        const deps = this.extractDependenciesFromCode(content);
        deps.forEach(dep => chunkDeps.add(dep));
      }
      
      await fs.writeFile(chunkPath, chunkContent);
      const stats = await fs.stat(chunkPath);
      
      chunks.push({
        filePath: chunkPath,
        sources: chunkSources,
        size: stats.size,
        dependencies: Array.from(chunkDeps),
        framework: bundle.framework,
        type: bundle.type
      });
    }

    return chunks;
  }

  /**
   * Find dependencies shared across multiple files
   */
  private findSharedDependencies(graph: DependencyGraph): string[] {
    const dependencyCount = new Map<string, number>();
    
    for (const [filePath, fileInfo] of graph.files) {
      for (const dep of fileInfo.dependencies) {
        const count = dependencyCount.get(dep.importee) || 0;
        dependencyCount.set(dep.importee, count + 1);
      }
    }

    return Array.from(dependencyCount.entries())
      .filter(([dep, count]) => count > 1)
      .map(([dep]) => dep);
  }

  /**
   * Extract dependencies from compiled code
   */
  private extractDependenciesFromCode(code: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
    
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const dep = match[1];
      if (!dep.startsWith('.') && !dep.startsWith('/')) {
        dependencies.push(dep);
      }
    }

    return [...new Set(dependencies)];
  }

  /**
   * Get framework from file path
   */
  private getFrameworkFromPath(filePath: string): string {
    // Extract from filename or directory structure
    const basename = path.basename(filePath);
    if (basename.includes('react')) return 'react';
    if (basename.includes('vue')) return 'vue';
    if (basename.includes('solid')) return 'solid';
    if (basename.includes('svelte')) return 'svelte';
    return 'unknown';
  }

  /**
   * Get type from file path
   */
  private getTypeFromPath(filePath: string): 'page' | 'component' {
    return filePath.includes('/pages/') || filePath.includes('\\pages\\') ? 'page' : 'component';
  }

  /**
   * Simple code minification
   */
  private minifyCode(code: string): string {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Generate source map
   */
  private generateSourceMap(sourcePath: string, bundlePath: string): any {
    return {
      version: 3,
      file: path.basename(bundlePath),
      sources: [path.relative(path.dirname(bundlePath), sourcePath)],
      names: [],
      mappings: 'AAAA' // Simple mapping
    };
  }
}