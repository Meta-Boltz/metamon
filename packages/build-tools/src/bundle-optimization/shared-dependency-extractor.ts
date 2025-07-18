/**
 * Shared Dependency Extractor
 * 
 * Intelligently extracts shared dependencies across framework bundles
 * to optimize caching and reduce duplicate code
 */

export interface SharedDependencyConfig {
  // Extraction thresholds
  minSharedCount: number; // Minimum frameworks sharing a dependency
  maxSharedChunkSize: number; // Maximum size for shared chunks
  minDependencySize: number; // Minimum size to consider for extraction
  
  // Priority dependencies (always extract regardless of count)
  priorityDependencies: string[];
  
  // Framework-specific settings
  frameworkSettings: {
    [framework: string]: {
      coreLibraries: string[]; // Libraries that should be shared
      excludeFromSharing: string[]; // Libraries that should not be shared
      preferredChunkSize: number;
    };
  };
  
  // Optimization settings
  optimization: {
    enableTreeShaking: boolean;
    enableDeduplication: boolean;
    preserveModuleStructure: boolean;
    generateSourceMaps: boolean;
  };
}

export interface DependencyAnalysis {
  name: string;
  size: number;
  frameworks: string[];
  usageCount: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
  stability: number; // 0-1, higher = more stable
  extractionBenefit: number; // Estimated bytes saved by extraction
}

export interface SharedChunk {
  name: string;
  dependencies: DependencyAnalysis[];
  frameworks: string[];
  totalSize: number;
  compressedSize: number;
  hash: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  cacheStrategy: 'cache-first' | 'stale-while-revalidate' | 'network-first';
  loadingStrategy: 'eager' | 'lazy' | 'preload';
}

export interface ExtractionResult {
  sharedChunks: SharedChunk[];
  modifiedBundles: {
    [bundleName: string]: {
      removedDependencies: string[];
      addedSharedChunks: string[];
      sizeReduction: number;
    };
  };
  metrics: {
    totalSizeReduction: number;
    duplicateCodeEliminated: number;
    cacheEfficiencyImprovement: number;
    loadingPerformanceImpact: number;
  };
  recommendations: string[];
}

/**
 * Shared Dependency Extractor
 */
export class SharedDependencyExtractor {
  private config: SharedDependencyConfig;
  private dependencyAnalysis: Map<string, DependencyAnalysis> = new Map();

  constructor(config: SharedDependencyConfig) {
    this.config = config;
  }

  /**
   * Extract shared dependencies from bundles
   */
  async extract(bundles: any[]): Promise<ExtractionResult> {
    // Analyze dependencies across all bundles
    await this.analyzeDependencies(bundles);

    // Identify candidates for extraction
    const extractionCandidates = this.identifyExtractionCandidates();

    // Create optimal shared chunks
    const sharedChunks = await this.createSharedChunks(extractionCandidates);

    // Calculate bundle modifications
    const modifiedBundles = this.calculateBundleModifications(bundles, sharedChunks);

    // Calculate metrics
    const metrics = this.calculateExtractionMetrics(bundles, sharedChunks, modifiedBundles);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, sharedChunks);

    return {
      sharedChunks,
      modifiedBundles,
      metrics,
      recommendations
    };
  }

  /**
   * Analyze dependencies across all bundles
   */
  private async analyzeDependencies(bundles: any[]): Promise<void> {
    const dependencyMap = new Map<string, {
      frameworks: Set<string>;
      totalSize: number;
      usageCount: number;
      bundles: string[];
    }>();

    // Collect dependency information from all bundles
    for (const bundle of bundles) {
      const framework = this.detectFramework(bundle);
      const dependencies = bundle.dependencies || [];

      for (const dep of dependencies) {
        if (!dependencyMap.has(dep)) {
          dependencyMap.set(dep, {
            frameworks: new Set(),
            totalSize: 0,
            usageCount: 0,
            bundles: []
          });
        }

        const depInfo = dependencyMap.get(dep)!;
        depInfo.frameworks.add(framework);
        depInfo.usageCount++;
        depInfo.bundles.push(bundle.name || bundle.fileName);
        depInfo.totalSize += this.estimateDependencySize(dep);
      }
    }

    // Create dependency analysis
    for (const [depName, depInfo] of dependencyMap) {
      const analysis: DependencyAnalysis = {
        name: depName,
        size: this.estimateDependencySize(depName),
        frameworks: Array.from(depInfo.frameworks),
        usageCount: depInfo.usageCount,
        importance: this.determineDependencyImportance(depName, depInfo),
        stability: this.calculateDependencyStability(depName),
        extractionBenefit: this.calculateExtractionBenefit(depName, depInfo)
      };

      this.dependencyAnalysis.set(depName, analysis);
    }
  }

  /**
   * Identify candidates for shared dependency extraction
   */
  private identifyExtractionCandidates(): DependencyAnalysis[] {
    const candidates: DependencyAnalysis[] = [];

    for (const analysis of this.dependencyAnalysis.values()) {
      // Check if dependency meets extraction criteria
      if (this.shouldExtractDependency(analysis)) {
        candidates.push(analysis);
      }
    }

    // Sort by extraction benefit (highest first)
    return candidates.sort((a, b) => b.extractionBenefit - a.extractionBenefit);
  }

  /**
   * Check if dependency should be extracted
   */
  private shouldExtractDependency(analysis: DependencyAnalysis): boolean {
    // Always extract priority dependencies
    if (this.config.priorityDependencies.includes(analysis.name)) {
      return true;
    }

    // Check minimum sharing threshold
    if (analysis.frameworks.length < this.config.minSharedCount) {
      return false;
    }

    // Check minimum size threshold
    if (analysis.size < this.config.minDependencySize) {
      return false;
    }

    // Check framework-specific exclusions
    for (const framework of analysis.frameworks) {
      const frameworkConfig = this.config.frameworkSettings[framework];
      if (frameworkConfig?.excludeFromSharing.includes(analysis.name)) {
        return false;
      }
    }

    // Check extraction benefit threshold
    return analysis.extractionBenefit > analysis.size * 0.5; // Must save at least 50% of size
  }

  /**
   * Create optimal shared chunks from extraction candidates
   */
  private async createSharedChunks(candidates: DependencyAnalysis[]): Promise<SharedChunk[]> {
    const chunks: SharedChunk[] = [];
    let currentChunk: {
      dependencies: DependencyAnalysis[];
      frameworks: Set<string>;
      size: number;
    } = {
      dependencies: [],
      frameworks: new Set(),
      size: 0
    };

    for (const candidate of candidates) {
      const candidateSize = candidate.size;

      // Check if adding this dependency would exceed max chunk size
      if (currentChunk.size + candidateSize > this.config.maxSharedChunkSize && currentChunk.dependencies.length > 0) {
        // Create chunk from current group
        chunks.push(await this.createSharedChunk(currentChunk));

        // Start new chunk
        currentChunk = {
          dependencies: [],
          frameworks: new Set(),
          size: 0
        };
      }

      // Add candidate to current chunk
      currentChunk.dependencies.push(candidate);
      candidate.frameworks.forEach(fw => currentChunk.frameworks.add(fw));
      currentChunk.size += candidateSize;
    }

    // Create final chunk if needed
    if (currentChunk.dependencies.length > 0) {
      chunks.push(await this.createSharedChunk(currentChunk));
    }

    return chunks;
  }

  /**
   * Create a shared chunk from dependency group
   */
  private async createSharedChunk(chunkData: {
    dependencies: DependencyAnalysis[];
    frameworks: Set<string>;
    size: number;
  }): Promise<SharedChunk> {
    const frameworks = Array.from(chunkData.frameworks);
    const name = this.generateChunkName(chunkData.dependencies, frameworks);
    const hash = this.generateHash(chunkData.dependencies.map(d => d.name).join(''));
    const compressedSize = Math.floor(chunkData.size * 0.3); // Estimated compression

    // Determine chunk characteristics
    const priority = this.determineChunkPriority(chunkData.dependencies);
    const cacheStrategy = this.determineCacheStrategy(chunkData.dependencies);
    const loadingStrategy = this.determineLoadingStrategy(chunkData.dependencies, priority);

    return {
      name,
      dependencies: chunkData.dependencies,
      frameworks,
      totalSize: chunkData.size,
      compressedSize,
      hash,
      priority,
      cacheStrategy,
      loadingStrategy
    };
  }

  /**
   * Calculate bundle modifications after shared dependency extraction
   */
  private calculateBundleModifications(bundles: any[], sharedChunks: SharedChunk[]): {
    [bundleName: string]: {
      removedDependencies: string[];
      addedSharedChunks: string[];
      sizeReduction: number;
    };
  } {
    const modifications: any = {};

    // Create lookup for shared dependencies
    const sharedDependencies = new Set<string>();
    const chunksByDependency = new Map<string, string[]>();

    for (const chunk of sharedChunks) {
      for (const dep of chunk.dependencies) {
        sharedDependencies.add(dep.name);
        if (!chunksByDependency.has(dep.name)) {
          chunksByDependency.set(dep.name, []);
        }
        chunksByDependency.get(dep.name)!.push(chunk.name);
      }
    }

    // Calculate modifications for each bundle
    for (const bundle of bundles) {
      const bundleName = bundle.name || bundle.fileName;
      const dependencies = bundle.dependencies || [];
      
      const removedDependencies: string[] = [];
      const addedSharedChunks = new Set<string>();
      let sizeReduction = 0;

      for (const dep of dependencies) {
        if (sharedDependencies.has(dep)) {
          removedDependencies.push(dep);
          sizeReduction += this.estimateDependencySize(dep);

          // Add shared chunks that contain this dependency
          const chunks = chunksByDependency.get(dep) || [];
          chunks.forEach(chunk => addedSharedChunks.add(chunk));
        }
      }

      if (removedDependencies.length > 0) {
        modifications[bundleName] = {
          removedDependencies,
          addedSharedChunks: Array.from(addedSharedChunks),
          sizeReduction
        };
      }
    }

    return modifications;
  }

  /**
   * Calculate extraction metrics
   */
  private calculateExtractionMetrics(
    bundles: any[],
    sharedChunks: SharedChunk[],
    modifiedBundles: any
  ): {
    totalSizeReduction: number;
    duplicateCodeEliminated: number;
    cacheEfficiencyImprovement: number;
    loadingPerformanceImpact: number;
  } {
    // Calculate total size reduction
    const totalSizeReduction = Object.values(modifiedBundles)
      .reduce((sum: number, mod: any) => sum + mod.sizeReduction, 0);

    // Calculate duplicate code eliminated
    const duplicateCodeEliminated = sharedChunks.reduce((sum, chunk) => {
      // Each framework that uses this chunk saves the full chunk size
      return sum + (chunk.totalSize * (chunk.frameworks.length - 1));
    }, 0);

    // Estimate cache efficiency improvement
    const sharedChunkSize = sharedChunks.reduce((sum, chunk) => sum + chunk.totalSize, 0);
    const totalBundleSize = bundles.reduce((sum, bundle) => sum + (bundle.size || 0), 0);
    const cacheEfficiencyImprovement = sharedChunkSize / totalBundleSize;

    // Estimate loading performance impact
    const avgChunkSize = sharedChunks.length > 0 ? 
      sharedChunks.reduce((sum, chunk) => sum + chunk.compressedSize, 0) / sharedChunks.length : 0;
    const loadingPerformanceImpact = Math.max(0, 1 - (sharedChunks.length * 50) / 1000); // Penalty for additional requests

    return {
      totalSizeReduction,
      duplicateCodeEliminated,
      cacheEfficiencyImprovement,
      loadingPerformanceImpact
    };
  }

  /**
   * Generate recommendations based on extraction results
   */
  private generateRecommendations(metrics: any, sharedChunks: SharedChunk[]): string[] {
    const recommendations: string[] = [];

    // Size reduction recommendations
    if (metrics.totalSizeReduction > 100 * 1024) {
      recommendations.push(`Excellent: Shared dependency extraction saves ${Math.floor(metrics.totalSizeReduction / 1024)}KB`);
    } else if (metrics.totalSizeReduction > 50 * 1024) {
      recommendations.push(`Good: Shared dependency extraction saves ${Math.floor(metrics.totalSizeReduction / 1024)}KB`);
    } else {
      recommendations.push('Consider adjusting extraction thresholds - limited size savings achieved');
    }

    // Cache efficiency recommendations
    if (metrics.cacheEfficiencyImprovement > 0.3) {
      recommendations.push('High cache efficiency improvement - shared chunks will significantly reduce repeat downloads');
    } else if (metrics.cacheEfficiencyImprovement > 0.1) {
      recommendations.push('Moderate cache efficiency improvement - consider extracting more shared dependencies');
    }

    // Loading performance recommendations
    if (metrics.loadingPerformanceImpact < 0.8) {
      recommendations.push('Warning: Many shared chunks may impact loading performance - consider consolidating');
    }

    // Chunk-specific recommendations
    const largeChunks = sharedChunks.filter(chunk => chunk.totalSize > this.config.maxSharedChunkSize * 0.8);
    if (largeChunks.length > 0) {
      recommendations.push(`Consider splitting ${largeChunks.length} large shared chunks for better caching granularity`);
    }

    const criticalChunks = sharedChunks.filter(chunk => chunk.priority === 'critical');
    if (criticalChunks.length > 0) {
      recommendations.push(`${criticalChunks.length} critical shared chunks should be preloaded for optimal performance`);
    }

    return recommendations;
  }

  // Helper methods
  private detectFramework(bundle: any): string {
    const name = bundle.name || bundle.fileName || '';
    if (name.includes('react')) return 'react';
    if (name.includes('vue')) return 'vue';
    if (name.includes('svelte')) return 'svelte';
    if (name.includes('solid')) return 'solid';
    return 'unknown';
  }

  private estimateDependencySize(depName: string): number {
    // Size estimates for common dependencies
    const sizeMap: { [key: string]: number } = {
      'react': 45 * 1024,
      'react-dom': 130 * 1024,
      'vue': 85 * 1024,
      'solid-js': 25 * 1024,
      'svelte': 15 * 1024,
      'lodash': 70 * 1024,
      'axios': 15 * 1024,
      'moment': 67 * 1024,
      'date-fns': 20 * 1024,
      'rxjs': 45 * 1024
    };

    return sizeMap[depName] || 10 * 1024; // Default 10KB
  }

  private determineDependencyImportance(
    depName: string,
    depInfo: any
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Check if it's a priority dependency
    if (this.config.priorityDependencies.includes(depName)) {
      return 'critical';
    }

    // Framework core libraries are high importance
    const coreLibraries = ['react', 'react-dom', 'vue', 'solid-js', 'svelte'];
    if (coreLibraries.includes(depName)) {
      return 'high';
    }

    // Widely used dependencies are medium importance
    if (depInfo.usageCount > 3) {
      return 'medium';
    }

    return 'low';
  }

  private calculateDependencyStability(depName: string): number {
    // Estimate stability based on dependency type
    const stableLibraries = ['react', 'vue', 'lodash', 'moment'];
    const moderateLibraries = ['axios', 'rxjs', 'date-fns'];

    if (stableLibraries.includes(depName)) return 0.9;
    if (moderateLibraries.includes(depName)) return 0.7;
    return 0.5; // Default moderate stability
  }

  private calculateExtractionBenefit(depName: string, depInfo: any): number {
    const depSize = this.estimateDependencySize(depName);
    const frameworkCount = depInfo.frameworks.size;

    // Benefit = size saved by not duplicating across frameworks
    return depSize * (frameworkCount - 1);
  }

  private generateChunkName(dependencies: DependencyAnalysis[], frameworks: string[]): string {
    // Create descriptive name based on main dependencies
    const mainDeps = dependencies
      .filter(d => d.importance === 'critical' || d.importance === 'high')
      .slice(0, 2)
      .map(d => d.name.replace(/[^a-zA-Z0-9]/g, ''));

    const frameworkSuffix = frameworks.length > 2 ? 'shared' : frameworks.join('-');
    
    if (mainDeps.length > 0) {
      return `shared-${mainDeps.join('-')}-${frameworkSuffix}`;
    }

    return `shared-deps-${frameworkSuffix}`;
  }

  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private determineChunkPriority(dependencies: DependencyAnalysis[]): 'critical' | 'high' | 'medium' | 'low' {
    const maxImportance = dependencies.reduce((max, dep) => {
      const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const depOrder = importanceOrder[dep.importance];
      const maxOrder = importanceOrder[max];
      return depOrder > maxOrder ? dep.importance : max;
    }, 'low' as 'critical' | 'high' | 'medium' | 'low');

    return maxImportance;
  }

  private determineCacheStrategy(dependencies: DependencyAnalysis[]): 'cache-first' | 'stale-while-revalidate' | 'network-first' {
    const avgStability = dependencies.reduce((sum, dep) => sum + dep.stability, 0) / dependencies.length;
    
    if (avgStability > 0.8) return 'cache-first';
    if (avgStability > 0.6) return 'stale-while-revalidate';
    return 'network-first';
  }

  private determineLoadingStrategy(
    dependencies: DependencyAnalysis[],
    priority: 'critical' | 'high' | 'medium' | 'low'
  ): 'eager' | 'lazy' | 'preload' {
    if (priority === 'critical') return 'eager';
    if (priority === 'high') return 'preload';
    return 'lazy';
  }
}