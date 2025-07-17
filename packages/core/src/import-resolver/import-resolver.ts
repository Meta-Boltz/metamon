import * as path from 'path';
import * as fs from 'fs';
import {
  ImportResolver,
  ImportResolverConfig,
  MTMDependency,
  MTMFileInfo,
  DependencyGraph,
  ImportResolutionResult
} from '../types/import-resolver.js';

/**
 * Implementation of import resolver for .mtm files
 */
export class MTMImportResolver implements ImportResolver {
  private config: ImportResolverConfig;

  constructor(config: ImportResolverConfig) {
    this.config = config;
  }

  /**
   * Resolve an import specifier to an absolute path
   */
  resolve(specifier: string, importer: string): string | null {
    // Handle relative imports
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const importerDir = path.dirname(importer);
      const resolved = path.resolve(importerDir, specifier);
      
      // Try with .mtm extension if not present
      if (this.fileExists(resolved)) {
        return resolved;
      }
      
      const withExtension = resolved.endsWith('.mtm') ? resolved : `${resolved}.mtm`;
      if (this.fileExists(withExtension)) {
        return withExtension;
      }
      
      return null;
    }

    // Handle alias imports
    if (this.config.alias) {
      for (const [alias, aliasPath] of Object.entries(this.config.alias)) {
        if (specifier.startsWith(alias)) {
          const resolved = specifier.replace(alias, aliasPath);
          const absolutePath = path.resolve(this.config.root, resolved);
          
          if (this.fileExists(absolutePath)) {
            return absolutePath;
          }
          
          const withExtension = absolutePath.endsWith('.mtm') ? absolutePath : `${absolutePath}.mtm`;
          if (this.fileExists(withExtension)) {
            return withExtension;
          }
        }
      }
    }

    // Handle absolute imports from project root
    const fromRoot = path.resolve(this.config.root, specifier);
    if (this.fileExists(fromRoot)) {
      return fromRoot;
    }
    
    const fromRootWithExt = fromRoot.endsWith('.mtm') ? fromRoot : `${fromRoot}.mtm`;
    if (this.fileExists(fromRootWithExt)) {
      return fromRootWithExt;
    }

    return null;
  }

  /**
   * Determine if a file is a page or component based on location
   */
  getFileType(filePath: string): 'page' | 'component' {
    const relativePath = path.relative(this.config.root, filePath);
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    if (normalizedPath.startsWith(this.config.pagesDir)) {
      return 'page';
    }
    
    return 'component';
  }

  /**
   * Extract dependencies from an .mtm file
   */
  extractDependencies(filePath: string, content: string): MTMDependency[] {
    const dependencies: MTMDependency[] = [];
    
    // Regular expressions to match import statements
    const importRegexes = [
      // ES6 imports: import ... from '...'
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"];?/g,
      // Dynamic imports: import('...')
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // Require statements: require('...')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    ];

    for (const regex of importRegexes) {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const specifier = match[1];
        
        // Only process .mtm imports or relative imports that could be .mtm
        if (specifier.endsWith('.mtm') || specifier.startsWith('./') || specifier.startsWith('../')) {
          const resolvedPath = this.resolve(specifier, filePath);
          
          if (resolvedPath) {
            dependencies.push({
              importer: filePath,
              importee: resolvedPath,
              specifier,
              resolvedPath,
              isDynamic: regex.source.includes('import\\s*\\(')
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Build dependency graph for all .mtm files
   */
  buildDependencyGraph(files: string[]): DependencyGraph {
    const graph: DependencyGraph = {
      files: new Map(),
      buildOrder: [],
      circularDependencies: []
    };

    // First pass: create file info for all files
    for (const filePath of files) {
      if (!this.fileExists(filePath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const dependencies = this.extractDependencies(filePath, content);
      
      // Extract framework from frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let framework = 'unknown';
      if (frontmatterMatch) {
        const yamlContent = frontmatterMatch[1];
        const targetMatch = yamlContent.match(/target:\s*(\w+)/);
        if (targetMatch) {
          framework = targetMatch[1];
        }
      }

      const fileInfo: MTMFileInfo = {
        filePath,
        relativePath: path.relative(this.config.root, filePath),
        type: this.getFileType(filePath),
        framework,
        dependencies,
        dependents: []
      };

      graph.files.set(filePath, fileInfo);
    }

    // Second pass: populate dependents
    for (const [filePath, fileInfo] of graph.files) {
      for (const dep of fileInfo.dependencies) {
        const dependentFile = graph.files.get(dep.importee);
        if (dependentFile) {
          dependentFile.dependents.push(filePath);
        }
      }
    }

    // Calculate build order and detect circular dependencies
    graph.buildOrder = this.getBuildOrder(graph);
    graph.circularDependencies = this.detectCircularDependencies(graph);

    return graph;
  }

  /**
   * Get build order respecting dependencies using topological sort
   */
  getBuildOrder(graph: DependencyGraph): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (filePath: string): boolean => {
      if (visiting.has(filePath)) {
        // Circular dependency detected
        return false;
      }
      
      if (visited.has(filePath)) {
        return true;
      }

      visiting.add(filePath);
      
      const fileInfo = graph.files.get(filePath);
      if (fileInfo) {
        // Visit all dependencies first
        for (const dep of fileInfo.dependencies) {
          if (!visit(dep.importee)) {
            return false;
          }
        }
      }

      visiting.delete(filePath);
      visited.add(filePath);
      result.push(filePath);
      
      return true;
    };

    // Visit all files
    for (const filePath of graph.files.keys()) {
      if (!visited.has(filePath)) {
        visit(filePath);
      }
    }

    return result;
  }

  /**
   * Detect circular dependencies using DFS
   */
  detectCircularDependencies(graph: DependencyGraph): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (filePath: string, path: string[]): void => {
      if (recursionStack.has(filePath)) {
        // Found a cycle
        const cycleStart = path.indexOf(filePath);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), filePath]);
        }
        return;
      }

      if (visited.has(filePath)) {
        return;
      }

      visited.add(filePath);
      recursionStack.add(filePath);
      path.push(filePath);

      const fileInfo = graph.files.get(filePath);
      if (fileInfo) {
        for (const dep of fileInfo.dependencies) {
          dfs(dep.importee, [...path]);
        }
      }

      recursionStack.delete(filePath);
      path.pop();
    };

    for (const filePath of graph.files.keys()) {
      if (!visited.has(filePath)) {
        dfs(filePath, []);
      }
    }

    return cycles;
  }

  /**
   * Check if a file exists
   */
  private fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }
}