/**
 * Framework Bundle Splitter for Metamon Performance Optimization
 * 
 * Splits framework bundles into optimized chunks for lazy loading and caching
 */

import { Plugin } from 'vite';
import { OutputBundle, OutputChunk, OutputAsset } from 'rollup';

export interface FrameworkBundleConfig {
  // Framework splitting configuration
  frameworks: {
    [key: string]: {
      entry: string;
      dependencies: string[];
      priority: 'critical' | 'high' | 'normal' | 'low';
      preload: boolean;
    };
  };
  
  // Chunk splitting configuration
  chunkSplitting: {
    maxChunkSize: number;
    minChunkSize: number;
    sharedDependencyThreshold: number;
    enableTreeShaking: boolean;
  };
  
  // Caching configuration
  caching: {
    enableVersioning: boolean;
    hashLength: number;
    cacheGroups: {
      [key: string]: {
        pattern: RegExp;
        priority: number;
        maxAge: number;
      };
    };
  };
  
  // Service worker configuration
  serviceWorker: {
    generateManifest: boolean;
    manifestPath: string;
    enableBackgroundSync: boolean;
  };
}

export interface FrameworkChunk {
  name: string;
  framework: string;
  type: 'core' | 'adapter' | 'utility' | 'shared';
  size: number;
  dependencies: string[];
  hash: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  preloadTriggers: string[];
}

export interface BundleSplitResult {
  chunks: FrameworkChunk[];
  manifest: FrameworkManifest;
  stats: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    chunkCount: number;
    sharedChunks: number;
  };
}

export interface FrameworkManifest {
  version: string;
  timestamp: number;
  frameworks: {
    [key: string]: {
      chunks: string[];
      dependencies: string[];
      size: number;
      priority: string;
      preload: boolean;
    };
  };
  chunks: {
    [key: string]: {
      path: string;
      size: number;
      hash: string;
      dependencies: string[];
      type: string;
    };
  };
  cacheStrategy: {
    [key: string]: {
      maxAge: number;
      strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
    };
  };
}

/**
 * Framework Bundle Splitter
 */
export class FrameworkBundleSplitter {
  private config: FrameworkBundleConfig;
  private chunks: Map<string, FrameworkChunk> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();

  constructor(config: FrameworkBundleConfig) {
    this.config = config;
  }

  /**
   * Analyze bundle and create splitting strategy
   */
  async analyzeBundles(bundle: OutputBundle): Promise<BundleSplitResult> {
    // Reset state
    this.chunks.clear();
    this.dependencies.clear();

    // Analyze chunks and dependencies
    await this.analyzeChunks(bundle);
    await this.analyzeDependencies(bundle);

    // Create optimized chunks
    const optimizedChunks = await this.createOptimizedChunks();

    // Generate manifest
    const manifest = this.generateManifest(optimizedChunks);

    // Calculate statistics
    const stats = this.calculateStats(bundle, optimizedChunks);

    return {
      chunks: optimizedChunks,
      manifest,
      stats
    };
  }

  /**
   * Analyze existing chunks
   */
  private async analyzeChunks(bundle: OutputBundle): Promise<void> {
    for (const [fileName, chunk] of Object.entries(bundle)) {
      if (chunk.type === 'chunk') {
        await this.analyzeChunk(fileName, chunk as OutputChunk);
      }
    }
  }

  /**
   * Analyze individual chunk
   */
  private async analyzeChunk(fileName: string, chunk: OutputChunk): Promise<void> {
    // Determine framework type from chunk
    const framework = this.detectFramework(chunk);
    if (!framework) return;

    // Determine chunk type
    const chunkType = this.determineChunkType(chunk, framework);

    // Calculate size
    const size = chunk.code.length;

    // Extract dependencies
    const dependencies = this.extractDependencies(chunk);

    // Create framework chunk
    const frameworkChunk: FrameworkChunk = {
      name: fileName,
      framework,
      type: chunkType,
      size,
      dependencies,
      hash: this.generateHash(chunk.code),
      priority: this.config.frameworks[framework]?.priority || 'normal',
      preloadTriggers: this.determinePreloadTriggers(framework, chunkType)
    };

    this.chunks.set(fileName, frameworkChunk);
  }

  /**
   * Detect framework from chunk content
   */
  private detectFramework(chunk: OutputChunk): string | null {
    const code = chunk.code.toLowerCase();
    
    // Check for framework-specific patterns
    if (code.includes('react') || code.includes('jsx')) {
      return 'reactjs';
    } else if (code.includes('vue') || code.includes('createapp')) {
      return 'vue';
    } else if (code.includes('solid') || code.includes('createeffect')) {
      return 'solid';
    } else if (code.includes('svelte') || code.includes('sveltecomponent')) {
      return 'svelte';
    }

    // Check module names
    for (const moduleName of Object.keys(chunk.modules || {})) {
      if (moduleName.includes('react')) return 'reactjs';
      if (moduleName.includes('vue')) return 'vue';
      if (moduleName.includes('solid')) return 'solid';
      if (moduleName.includes('svelte')) return 'svelte';
    }

    return null;
  }

  /**
   * Determine chunk type
   */
  private determineChunkType(chunk: OutputChunk, framework: string): FrameworkChunk['type'] {
    const fileName = chunk.fileName || chunk.name || '';
    
    if (fileName.includes('core') || fileName.includes('runtime')) {
      return 'core';
    } else if (fileName.includes('adapter') || fileName.includes('metamon')) {
      return 'adapter';
    } else if (fileName.includes('util') || fileName.includes('helper')) {
      return 'utility';
    } else if (chunk.isEntry) {
      return 'core';
    } else {
      return 'shared';
    }
  }

  /**
   * Extract dependencies from chunk
   */
  private extractDependencies(chunk: OutputChunk): string[] {
    const dependencies = new Set<string>();

    // Add imports
    if (chunk.imports) {
      chunk.imports.forEach(imp => dependencies.add(imp));
    }

    // Add dynamic imports
    if (chunk.dynamicImports) {
      chunk.dynamicImports.forEach(imp => dependencies.add(imp));
    }

    // Extract from module dependencies
    if (chunk.modules) {
      Object.keys(chunk.modules).forEach(moduleName => {
        if (moduleName.includes('node_modules')) {
          const packageName = this.extractPackageName(moduleName);
          if (packageName) {
            dependencies.add(packageName);
          }
        }
      });
    }

    return Array.from(dependencies);
  }

  /**
   * Extract package name from module path
   */
  private extractPackageName(modulePath: string): string | null {
    const match = modulePath.match(/node_modules\/(@?[^\/]+(?:\/[^\/]+)?)/);
    return match ? match[1] : null;
  }

  /**
   * Analyze dependencies between chunks
   */
  private async analyzeDependencies(bundle: OutputBundle): Promise<void> {
    for (const [fileName, chunk] of this.chunks.entries()) {
      const deps = new Set<string>();

      // Find chunks that this chunk depends on
      for (const dep of chunk.dependencies) {
        for (const [otherFileName, otherChunk] of this.chunks.entries()) {
          if (otherFileName !== fileName && 
              (otherChunk.name === dep || otherChunk.dependencies.includes(dep))) {
            deps.add(otherFileName);
          }
        }
      }

      this.dependencies.set(fileName, deps);
    }
  }

  /**
   * Create optimized chunks
   */
  private async createOptimizedChunks(): Promise<FrameworkChunk[]> {
    const optimizedChunks: FrameworkChunk[] = [];

    // Group chunks by framework
    const frameworkGroups = new Map<string, FrameworkChunk[]>();
    for (const chunk of this.chunks.values()) {
      if (!frameworkGroups.has(chunk.framework)) {
        frameworkGroups.set(chunk.framework, []);
      }
      frameworkGroups.get(chunk.framework)!.push(chunk);
    }

    // Optimize each framework group
    for (const [framework, chunks] of frameworkGroups.entries()) {
      const optimized = await this.optimizeFrameworkChunks(framework, chunks);
      optimizedChunks.push(...optimized);
    }

    // Create shared chunks for common dependencies
    const sharedChunks = await this.createSharedChunks(optimizedChunks);
    optimizedChunks.push(...sharedChunks);

    return optimizedChunks;
  }

  /**
   * Optimize chunks for a specific framework
   */
  private async optimizeFrameworkChunks(framework: string, chunks: FrameworkChunk[]): Promise<FrameworkChunk[]> {
    const optimized: FrameworkChunk[] = [];

    // Sort chunks by type priority (core first, then adapters, utilities, shared)
    const typePriority = { core: 0, adapter: 1, utility: 2, shared: 3 };
    chunks.sort((a, b) => typePriority[a.type] - typePriority[b.type]);

    // Merge small chunks
    const mergedChunks = this.mergeSmallChunks(chunks);

    // Split large chunks
    const splitChunks = await this.splitLargeChunks(mergedChunks);

    optimized.push(...splitChunks);

    return optimized;
  }

  /**
   * Merge small chunks to reduce HTTP requests
   */
  private mergeSmallChunks(chunks: FrameworkChunk[]): FrameworkChunk[] {
    const merged: FrameworkChunk[] = [];
    const { minChunkSize } = this.config.chunkSplitting;

    let currentGroup: FrameworkChunk[] = [];
    let currentSize = 0;

    for (const chunk of chunks) {
      if (chunk.size >= minChunkSize) {
        // Chunk is large enough, add any accumulated small chunks first
        if (currentGroup.length > 0) {
          merged.push(this.mergeChunkGroup(currentGroup));
          currentGroup = [];
          currentSize = 0;
        }
        merged.push(chunk);
      } else {
        // Accumulate small chunks
        currentGroup.push(chunk);
        currentSize += chunk.size;

        if (currentSize >= minChunkSize) {
          merged.push(this.mergeChunkGroup(currentGroup));
          currentGroup = [];
          currentSize = 0;
        }
      }
    }

    // Handle remaining small chunks
    if (currentGroup.length > 0) {
      merged.push(this.mergeChunkGroup(currentGroup));
    }

    return merged;
  }

  /**
   * Merge a group of chunks
   */
  private mergeChunkGroup(chunks: FrameworkChunk[]): FrameworkChunk {
    const firstChunk = chunks[0];
    const mergedDependencies = new Set<string>();
    const mergedPreloadTriggers = new Set<string>();
    let totalSize = 0;

    for (const chunk of chunks) {
      chunk.dependencies.forEach(dep => mergedDependencies.add(dep));
      chunk.preloadTriggers.forEach(trigger => mergedPreloadTriggers.add(trigger));
      totalSize += chunk.size;
    }

    return {
      name: `${firstChunk.framework}-merged-${Date.now()}`,
      framework: firstChunk.framework,
      type: firstChunk.type,
      size: totalSize,
      dependencies: Array.from(mergedDependencies),
      hash: this.generateHash(chunks.map(c => c.hash).join('')),
      priority: firstChunk.priority,
      preloadTriggers: Array.from(mergedPreloadTriggers)
    };
  }

  /**
   * Split large chunks for better caching
   */
  private async splitLargeChunks(chunks: FrameworkChunk[]): Promise<FrameworkChunk[]> {
    const split: FrameworkChunk[] = [];
    const { maxChunkSize } = this.config.chunkSplitting;

    for (const chunk of chunks) {
      if (chunk.size <= maxChunkSize) {
        split.push(chunk);
      } else {
        // Split large chunk
        const splitChunks = await this.splitChunk(chunk, maxChunkSize);
        split.push(...splitChunks);
      }
    }

    return split;
  }

  /**
   * Split a single chunk into smaller pieces
   */
  private async splitChunk(chunk: FrameworkChunk, maxSize: number): Promise<FrameworkChunk[]> {
    const splitCount = Math.ceil(chunk.size / maxSize);
    const splitChunks: FrameworkChunk[] = [];
    const sizePerSplit = Math.floor(chunk.size / splitCount);

    for (let i = 0; i < splitCount; i++) {
      splitChunks.push({
        name: `${chunk.name}-split-${i}`,
        framework: chunk.framework,
        type: chunk.type,
        size: i === splitCount - 1 ? chunk.size - (sizePerSplit * i) : sizePerSplit,
        dependencies: chunk.dependencies,
        hash: this.generateHash(`${chunk.hash}-${i}`),
        priority: chunk.priority,
        preloadTriggers: chunk.preloadTriggers
      });
    }

    return splitChunks;
  }

  /**
   * Create shared chunks for common dependencies
   */
  private async createSharedChunks(chunks: FrameworkChunk[]): Promise<FrameworkChunk[]> {
    const sharedChunks: FrameworkChunk[] = [];
    const { sharedDependencyThreshold } = this.config.chunkSplitting;

    // Find dependencies shared across multiple frameworks
    const dependencyCount = new Map<string, Set<string>>();

    for (const chunk of chunks) {
      for (const dep of chunk.dependencies) {
        if (!dependencyCount.has(dep)) {
          dependencyCount.set(dep, new Set());
        }
        dependencyCount.get(dep)!.add(chunk.framework);
      }
    }

    // Create shared chunks for frequently used dependencies
    for (const [dep, frameworks] of dependencyCount.entries()) {
      if (frameworks.size >= sharedDependencyThreshold) {
        sharedChunks.push({
          name: `shared-${dep.replace(/[^a-zA-Z0-9]/g, '-')}`,
          framework: 'shared',
          type: 'shared',
          size: 1000, // Estimated size, would be calculated from actual bundle
          dependencies: [dep],
          hash: this.generateHash(dep),
          priority: 'high',
          preloadTriggers: ['viewport', 'interaction']
        });
      }
    }

    return sharedChunks;
  }

  /**
   * Determine preload triggers for chunk
   */
  private determinePreloadTriggers(framework: string, chunkType: FrameworkChunk['type']): string[] {
    const triggers: string[] = [];

    // Core chunks should be preloaded aggressively
    if (chunkType === 'core') {
      triggers.push('viewport', 'interaction', 'idle');
    }

    // Adapter chunks should be preloaded on interaction
    if (chunkType === 'adapter') {
      triggers.push('interaction', 'navigation');
    }

    // Utility chunks can be preloaded on idle
    if (chunkType === 'utility') {
      triggers.push('idle');
    }

    // Framework-specific triggers
    const frameworkConfig = this.config.frameworks[framework];
    if (frameworkConfig?.preload) {
      triggers.push('viewport');
    }

    return triggers;
  }

  /**
   * Generate manifest for service worker
   */
  private generateManifest(chunks: FrameworkChunk[]): FrameworkManifest {
    const manifest: FrameworkManifest = {
      version: this.generateVersion(),
      timestamp: Date.now(),
      frameworks: {},
      chunks: {},
      cacheStrategy: {}
    };

    // Group chunks by framework
    const frameworkGroups = new Map<string, FrameworkChunk[]>();
    for (const chunk of chunks) {
      if (!frameworkGroups.has(chunk.framework)) {
        frameworkGroups.set(chunk.framework, []);
      }
      frameworkGroups.get(chunk.framework)!.push(chunk);
    }

    // Build framework entries
    for (const [framework, frameworkChunks] of frameworkGroups.entries()) {
      manifest.frameworks[framework] = {
        chunks: frameworkChunks.map(c => c.name),
        dependencies: Array.from(new Set(frameworkChunks.flatMap(c => c.dependencies))),
        size: frameworkChunks.reduce((sum, c) => sum + c.size, 0),
        priority: frameworkChunks[0]?.priority || 'normal',
        preload: this.config.frameworks[framework]?.preload || false
      };
    }

    // Build chunk entries
    for (const chunk of chunks) {
      manifest.chunks[chunk.name] = {
        path: `/metamon-framework/${chunk.framework}/${chunk.name}`,
        size: chunk.size,
        hash: chunk.hash,
        dependencies: chunk.dependencies,
        type: chunk.type
      };

      // Determine cache strategy
      const cacheGroup = this.findCacheGroup(chunk);
      manifest.cacheStrategy[chunk.name] = {
        maxAge: cacheGroup?.maxAge || 86400000, // 24 hours default
        strategy: this.determineCacheStrategy(chunk)
      };
    }

    return manifest;
  }

  /**
   * Find cache group for chunk
   */
  private findCacheGroup(chunk: FrameworkChunk): FrameworkBundleConfig['caching']['cacheGroups'][string] | null {
    for (const [groupName, group] of Object.entries(this.config.caching.cacheGroups)) {
      if (group.pattern.test(chunk.name)) {
        return group;
      }
    }
    return null;
  }

  /**
   * Determine cache strategy for chunk
   */
  private determineCacheStrategy(chunk: FrameworkChunk): 'cache-first' | 'network-first' | 'stale-while-revalidate' {
    if (chunk.type === 'core' || chunk.priority === 'critical') {
      return 'cache-first';
    } else if (chunk.type === 'shared') {
      return 'stale-while-revalidate';
    } else {
      return 'network-first';
    }
  }

  /**
   * Calculate optimization statistics
   */
  private calculateStats(originalBundle: OutputBundle, optimizedChunks: FrameworkChunk[]): BundleSplitResult['stats'] {
    const originalSize = Object.values(originalBundle)
      .filter(chunk => chunk.type === 'chunk')
      .reduce((sum, chunk) => sum + (chunk as OutputChunk).code.length, 0);

    const optimizedSize = optimizedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const sharedChunks = optimizedChunks.filter(chunk => chunk.framework === 'shared').length;

    return {
      originalSize,
      optimizedSize,
      compressionRatio: originalSize > 0 ? optimizedSize / originalSize : 1,
      chunkCount: optimizedChunks.length,
      sharedChunks
    };
  }

  /**
   * Generate hash for content
   */
  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate version string
   */
  private generateVersion(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${timestamp}-${random}`;
  }
}

/**
 * Default framework bundle configuration
 */
export const defaultFrameworkBundleConfig: FrameworkBundleConfig = {
  frameworks: {
    reactjs: {
      entry: 'react',
      dependencies: ['react', 'react-dom'],
      priority: 'high',
      preload: true
    },
    vue: {
      entry: 'vue',
      dependencies: ['vue'],
      priority: 'high',
      preload: true
    },
    solid: {
      entry: 'solid-js',
      dependencies: ['solid-js'],
      priority: 'normal',
      preload: false
    },
    svelte: {
      entry: 'svelte',
      dependencies: ['svelte'],
      priority: 'normal',
      preload: false
    }
  },
  chunkSplitting: {
    maxChunkSize: 100 * 1024, // 100KB
    minChunkSize: 10 * 1024,  // 10KB
    sharedDependencyThreshold: 2,
    enableTreeShaking: true
  },
  caching: {
    enableVersioning: true,
    hashLength: 8,
    cacheGroups: {
      core: {
        pattern: /core|runtime/,
        priority: 10,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      },
      adapters: {
        pattern: /adapter|metamon/,
        priority: 5,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      },
      shared: {
        pattern: /shared|common/,
        priority: 8,
        maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
      }
    }
  },
  serviceWorker: {
    generateManifest: true,
    manifestPath: '/metamon-manifest.json',
    enableBackgroundSync: true
  }
};