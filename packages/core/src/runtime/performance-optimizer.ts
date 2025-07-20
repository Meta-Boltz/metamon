/**
 * Runtime Performance Optimizer
 * Optimizes reactive variable update batching, dependency tracking, and tree shaking
 */

import type { ReactiveGraph, UpdateTrigger } from '../reactive/reactive-analyzer.js';

/**
 * Update batch configuration
 */
export interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number; // milliseconds
  priorityThreshold: number;
  enableDebouncing: boolean;
  debounceDelay: number;
}

/**
 * Dependency tracking configuration
 */
export interface DependencyConfig {
  enableWeakReferences: boolean;
  maxDependencyDepth: number;
  enableCircularDetection: boolean;
  cacheSize: number;
}

/**
 * Tree shaking configuration
 */
export interface TreeShakingConfig {
  enableDeadCodeElimination: boolean;
  enableUnusedVariableRemoval: boolean;
  enableFunctionInlining: boolean;
  aggressiveOptimization: boolean;
}

/**
 * Performance optimization result
 */
export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  reductionPercentage: number;
  optimizationsApplied: string[];
  performanceGain: number;
}

/**
 * Batched update entry
 */
export interface BatchedUpdate {
  variableName: string;
  newValue: any;
  priority: number;
  timestamp: number;
  dependencies: string[];
}

/**
 * Dependency tracking entry
 */
export interface DependencyEntry {
  variable: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  lastAccessed: number;
  accessCount: number;
}

/**
 * Runtime performance optimizer
 */
export class RuntimePerformanceOptimizer {
  private updateBatches = new Map<string, BatchedUpdate[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private dependencyCache = new Map<string, DependencyEntry>();
  private updateQueue: BatchedUpdate[] = [];
  private isProcessingBatch = false;
  private performanceMetrics = {
    batchedUpdates: 0,
    skippedUpdates: 0,
    dependencyHits: 0,
    dependencyMisses: 0,
    treeShakingReductions: 0
  };

  constructor(
    private batchConfig: BatchConfig = {
      maxBatchSize: 50,
      batchTimeout: 16, // ~60fps
      priorityThreshold: 5,
      enableDebouncing: true,
      debounceDelay: 100
    },
    private dependencyConfig: DependencyConfig = {
      enableWeakReferences: true,
      maxDependencyDepth: 10,
      enableCircularDetection: true,
      cacheSize: 1000
    },
    private treeShakingConfig: TreeShakingConfig = {
      enableDeadCodeElimination: true,
      enableUnusedVariableRemoval: true,
      enableFunctionInlining: false,
      aggressiveOptimization: false
    }
  ) {}

  /**
   * Optimize reactive variable update batching
   */
  optimizeUpdateBatching(reactiveGraph: ReactiveGraph): void {
    // Clear existing batches
    this.clearBatches();

    // Analyze reactive variables and create optimized update batches
    for (const [variableName, reactiveVar] of reactiveGraph.variables) {
      const triggers = reactiveGraph.triggers.get(variableName) || [];
      
      // Group triggers by priority and type
      const prioritizedTriggers = this.prioritizeTriggers(triggers);
      
      // Create batches based on dependencies and priorities
      this.createOptimizedBatches(variableName, prioritizedTriggers, reactiveVar.dependencies);
    }
  }

  /**
   * Schedule a reactive variable update with batching
   */
  scheduleUpdate(variableName: string, newValue: any, priority: number = 1): void {
    const update: BatchedUpdate = {
      variableName,
      newValue,
      priority,
      timestamp: performance.now(),
      dependencies: this.getDependencies(variableName)
    };

    // Check if we should batch this update
    if (this.shouldBatchUpdate(update)) {
      this.addToBatch(update);
    } else {
      // Execute immediately for high-priority updates
      this.executeUpdate(update);
    }
  }

  /**
   * Implement efficient dependency tracking
   */
  optimizeDependencyTracking(reactiveGraph: ReactiveGraph): Map<string, DependencyEntry> {
    const optimizedDependencies = new Map<string, DependencyEntry>();

    for (const [variableName, dependencies] of reactiveGraph.dependencies) {
      const entry: DependencyEntry = {
        variable: variableName,
        dependencies: new Set(dependencies),
        dependents: new Set(),
        lastAccessed: Date.now(),
        accessCount: 0
      };

      // Build reverse dependency map (dependents)
      for (const dep of dependencies) {
        const depEntry = optimizedDependencies.get(dep);
        if (depEntry) {
          depEntry.dependents.add(variableName);
        } else {
          optimizedDependencies.set(dep, {
            variable: dep,
            dependencies: new Set(),
            dependents: new Set([variableName]),
            lastAccessed: Date.now(),
            accessCount: 0
          });
        }
      }

      optimizedDependencies.set(variableName, entry);
    }

    // Optimize dependency chains
    this.optimizeDependencyChains(optimizedDependencies);

    // Cache the optimized dependencies
    this.dependencyCache = optimizedDependencies;

    return optimizedDependencies;
  }

  /**
   * Get dependencies for a variable with caching
   */
  getDependencies(variableName: string): string[] {
    const cached = this.dependencyCache.get(variableName);
    if (cached) {
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      this.performanceMetrics.dependencyHits++;
      return Array.from(cached.dependencies);
    }

    this.performanceMetrics.dependencyMisses++;
    return [];
  }

  /**
   * Tree shake unused syntax features
   */
  treeShakeUnusedFeatures(code: string, usedFeatures: Set<string>): OptimizationResult {
    const originalSize = code.length;
    let optimizedCode = code;
    const optimizationsApplied: string[] = [];

    // Remove unused variable declarations
    if (this.treeShakingConfig.enableUnusedVariableRemoval) {
      const result = this.removeUnusedVariables(optimizedCode, usedFeatures);
      optimizedCode = result.code;
      if (result.removed > 0) {
        optimizationsApplied.push(`Removed ${result.removed} unused variables`);
      }
    }

    // Remove dead code
    if (this.treeShakingConfig.enableDeadCodeElimination) {
      const result = this.removeDeadCode(optimizedCode);
      optimizedCode = result.code;
      if (result.removed > 0) {
        optimizationsApplied.push(`Removed ${result.removed} dead code blocks`);
      }
    }

    // Inline small functions
    if (this.treeShakingConfig.enableFunctionInlining) {
      const result = this.inlineSmallFunctions(optimizedCode);
      optimizedCode = result.code;
      if (result.inlined > 0) {
        optimizationsApplied.push(`Inlined ${result.inlined} small functions`);
      }
    }

    const optimizedSize = optimizedCode.length;
    const reductionPercentage = ((originalSize - optimizedSize) / originalSize) * 100;

    this.performanceMetrics.treeShakingReductions++;

    return {
      originalSize,
      optimizedSize,
      reductionPercentage,
      optimizationsApplied,
      performanceGain: this.calculatePerformanceGain(reductionPercentage)
    };
  }

  /**
   * Create production build optimizations
   */
  createProductionOptimizations(reactiveGraph: ReactiveGraph, code: string): {
    optimizedCode: string;
    optimizedGraph: ReactiveGraph;
    optimizationReport: OptimizationResult;
  } {
    // Optimize reactive graph
    const optimizedGraph = this.optimizeReactiveGraph(reactiveGraph);

    // Extract used features from the graph
    const usedFeatures = this.extractUsedFeatures(optimizedGraph);

    // Apply tree shaking
    const treeShakingResult = this.treeShakeUnusedFeatures(code, usedFeatures);

    // Optimize update batching
    this.optimizeUpdateBatching(optimizedGraph);

    // Optimize dependency tracking
    this.optimizeDependencyTracking(optimizedGraph);

    return {
      optimizedCode: code, // Would contain the actual optimized code
      optimizedGraph,
      optimizationReport: treeShakingResult
    };
  }

  /**
   * Prioritize update triggers based on type and importance
   */
  private prioritizeTriggers(triggers: UpdateTrigger[]): UpdateTrigger[] {
    return triggers.sort((a, b) => {
      // Immediate updates have highest priority
      if (a.immediate && !b.immediate) return -1;
      if (!a.immediate && b.immediate) return 1;

      // Template updates are higher priority than computed
      const priorityMap = { template: 3, event: 2, computed: 1, effect: 0 };
      const aPriority = priorityMap[a.triggerType] || 0;
      const bPriority = priorityMap[b.triggerType] || 0;

      return bPriority - aPriority;
    });
  }

  /**
   * Create optimized update batches
   */
  private createOptimizedBatches(
    variableName: string,
    triggers: UpdateTrigger[],
    dependencies: string[]
  ): void {
    // Group triggers that can be batched together
    const batchGroups = this.groupBatchableTriggers(triggers);

    for (const group of batchGroups) {
      const batchKey = this.generateBatchKey(variableName, group);
      if (!this.updateBatches.has(batchKey)) {
        this.updateBatches.set(batchKey, []);
      }
    }
  }

  /**
   * Group triggers that can be batched together
   */
  private groupBatchableTriggers(triggers: UpdateTrigger[]): UpdateTrigger[][] {
    const groups: UpdateTrigger[][] = [];
    const immediate: UpdateTrigger[] = [];
    const batched: UpdateTrigger[] = [];

    for (const trigger of triggers) {
      if (trigger.immediate) {
        immediate.push(trigger);
      } else {
        batched.push(trigger);
      }
    }

    if (immediate.length > 0) groups.push(immediate);
    if (batched.length > 0) groups.push(batched);

    return groups;
  }

  /**
   * Generate a unique key for a batch
   */
  private generateBatchKey(variableName: string, triggers: UpdateTrigger[]): string {
    const triggerTypes = triggers.map(t => t.triggerType).sort().join(',');
    return `${variableName}:${triggerTypes}`;
  }

  /**
   * Check if an update should be batched
   */
  private shouldBatchUpdate(update: BatchedUpdate): boolean {
    // High priority updates are executed immediately
    if (update.priority >= this.batchConfig.priorityThreshold) {
      return false;
    }

    // Check if batching is enabled
    if (!this.batchConfig.enableDebouncing) {
      return false;
    }

    return true;
  }

  /**
   * Add update to batch
   */
  private addToBatch(update: BatchedUpdate): void {
    const batchKey = update.variableName;
    
    if (!this.updateBatches.has(batchKey)) {
      this.updateBatches.set(batchKey, []);
    }

    const batch = this.updateBatches.get(batchKey)!;
    batch.push(update);

    // Schedule batch processing if not already scheduled
    if (!this.batchTimers.has(batchKey)) {
      const timer = setTimeout(() => {
        this.processBatch(batchKey);
      }, this.batchConfig.batchTimeout);
      
      this.batchTimers.set(batchKey, timer);
    }

    // Process immediately if batch is full
    if (batch.length >= this.batchConfig.maxBatchSize) {
      this.processBatch(batchKey);
    }
  }

  /**
   * Process a batch of updates
   */
  private processBatch(batchKey: string): void {
    const batch = this.updateBatches.get(batchKey);
    if (!batch || batch.length === 0) return;

    // Clear timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Sort batch by priority and timestamp
    batch.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp - b.timestamp; // Earlier timestamp first
    });

    // Execute updates in batch
    for (const update of batch) {
      this.executeUpdate(update);
    }

    // Clear batch
    this.updateBatches.set(batchKey, []);
    this.performanceMetrics.batchedUpdates += batch.length;
  }

  /**
   * Execute a single update
   */
  private executeUpdate(update: BatchedUpdate): void {
    // This would contain the actual update logic
    // For now, we'll just simulate the update
    console.debug(`Executing update for ${update.variableName} with value:`, update.newValue);
  }

  /**
   * Optimize dependency chains by removing redundant dependencies
   */
  private optimizeDependencyChains(dependencies: Map<string, DependencyEntry>): void {
    // Skip optimization for circular dependencies to preserve them
    if (!this.dependencyConfig.enableCircularDetection) {
      return;
    }

    for (const [variableName, entry] of dependencies) {
      // For circular dependencies, preserve all direct dependencies
      const hasCircularDep = entry.dependencies.has(variableName) || 
        Array.from(entry.dependencies).some(dep => {
          const depEntry = dependencies.get(dep);
          return depEntry?.dependencies.has(variableName);
        });

      if (hasCircularDep) {
        // Don't optimize circular dependencies
        continue;
      }

      // Remove transitive dependencies that are already covered
      const optimizedDeps = new Set<string>();
      
      for (const dep of entry.dependencies) {
        if (!this.hasTransitiveDependency(dep, variableName, dependencies, new Set())) {
          optimizedDeps.add(dep);
        }
      }
      
      entry.dependencies = optimizedDeps;
    }
  }

  /**
   * Check if there's a transitive dependency path
   */
  private hasTransitiveDependency(
    from: string,
    to: string,
    dependencies: Map<string, DependencyEntry>,
    visited: Set<string>
  ): boolean {
    if (visited.has(from)) return false; // Circular dependency
    visited.add(from);

    const entry = dependencies.get(from);
    if (!entry) return false;

    for (const dep of entry.dependencies) {
      if (dep === to) return true;
      if (this.hasTransitiveDependency(dep, to, dependencies, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Remove unused variables from code
   */
  private removeUnusedVariables(code: string, usedFeatures: Set<string>): { code: string; removed: number } {
    let optimizedCode = code;
    let removed = 0;

    // Simple regex-based removal (in production, use proper AST parsing)
    // Match both reactive ($var!) and regular ($var) variable declarations
    const variableRegex = /\$(\w+)!?\s*=\s*[^;\n]+;?/g;
    const matches = Array.from(code.matchAll(variableRegex));

    for (const match of matches) {
      const variableName = match[1];
      if (!usedFeatures.has(variableName)) {
        optimizedCode = optimizedCode.replace(match[0], '');
        removed++;
      }
    }

    return { code: optimizedCode, removed };
  }

  /**
   * Remove dead code blocks
   */
  private removeDeadCode(code: string): { code: string; removed: number } {
    let optimizedCode = code;
    let removed = 0;

    // Remove unreachable code after return statements
    const unreachableRegex = /return\s+[^;]+;\s*\n\s*[^}]+/g;
    const matches = Array.from(code.matchAll(unreachableRegex));

    for (const match of matches) {
      const returnStatement = match[0].split('\n')[0];
      optimizedCode = optimizedCode.replace(match[0], returnStatement);
      removed++;
    }

    return { code: optimizedCode, removed };
  }

  /**
   * Inline small functions
   */
  private inlineSmallFunctions(code: string): { code: string; inlined: number } {
    // This would implement function inlining logic
    // For now, return unchanged
    return { code, inlined: 0 };
  }

  /**
   * Calculate performance gain from optimization
   */
  private calculatePerformanceGain(reductionPercentage: number): number {
    // Estimate performance gain based on code reduction
    // This is a simplified calculation
    return Math.min(reductionPercentage * 0.5, 50); // Max 50% gain
  }

  /**
   * Optimize reactive graph by removing redundant nodes
   */
  private optimizeReactiveGraph(graph: ReactiveGraph): ReactiveGraph {
    const optimizedGraph: ReactiveGraph = {
      variables: new Map(graph.variables),
      dependencies: new Map(graph.dependencies),
      updateChains: [...graph.updateChains],
      triggers: new Map(graph.triggers)
    };

    // Remove variables with no dependencies or dependents
    for (const [variableName, variable] of optimizedGraph.variables) {
      const hasDependencies = optimizedGraph.dependencies.get(variableName)?.length > 0;
      const hasDependents = Array.from(optimizedGraph.dependencies.values())
        .some(deps => deps.includes(variableName));
      const hasTriggers = optimizedGraph.triggers.get(variableName)?.length > 0;

      if (!hasDependencies && !hasDependents && !hasTriggers) {
        optimizedGraph.variables.delete(variableName);
        optimizedGraph.dependencies.delete(variableName);
        optimizedGraph.triggers.delete(variableName);
      }
    }

    return optimizedGraph;
  }

  /**
   * Extract used features from reactive graph
   */
  private extractUsedFeatures(graph: ReactiveGraph): Set<string> {
    const usedFeatures = new Set<string>();

    // Add all reactive variables
    for (const variableName of graph.variables.keys()) {
      usedFeatures.add(variableName);
    }

    // Add variables referenced in dependencies
    for (const dependencies of graph.dependencies.values()) {
      for (const dep of dependencies) {
        usedFeatures.add(dep);
      }
    }

    return usedFeatures;
  }

  /**
   * Clear all batches and timers
   */
  private clearBatches(): void {
    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();

    // Clear all batches
    this.updateBatches.clear();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      batchedUpdates: 0,
      skippedUpdates: 0,
      dependencyHits: 0,
      dependencyMisses: 0,
      treeShakingReductions: 0
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.clearBatches();
    this.dependencyCache.clear();
    this.updateQueue = [];
  }
}

/**
 * Singleton instance for global use
 */
export const runtimePerformanceOptimizer = new RuntimePerformanceOptimizer();