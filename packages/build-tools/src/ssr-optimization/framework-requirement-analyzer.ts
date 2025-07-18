/**
 * Framework Requirement Analyzer
 * 
 * Analyzes component definitions to determine minimal framework requirements
 * for client-side loading, optimizing bundle size and loading performance.
 */

import {
  ComponentDefinition,
  FrameworkRequirement,
  FrameworkType,
  LoadPriority
} from '../types/ssr-optimization.js';

export interface FrameworkAnalysisResult {
  requirements: FrameworkRequirement[];
  totalEstimatedSize: number;
  criticalFrameworks: FrameworkType[];
  deferredFrameworks: FrameworkType[];
  sharedDependencies: string[];
}

export interface FrameworkMetadata {
  baseSize: number;
  dependencies: string[];
  chunkSizes: Map<string, number>;
  compatibilityMatrix: Map<FrameworkType, string[]>;
}

export class FrameworkRequirementAnalyzer {
  private frameworkMetadata: Map<FrameworkType, FrameworkMetadata> = new Map();
  private dependencyGraph: Map<string, string[]> = new Map();

  constructor() {
    this.initializeFrameworkMetadata();
  }

  /**
   * Analyzes components to determine framework requirements
   */
  analyzeRequirements(components: ComponentDefinition[]): FrameworkAnalysisResult {
    const frameworkUsage = this.groupComponentsByFramework(components);
    const requirements: FrameworkRequirement[] = [];
    const criticalFrameworks: FrameworkType[] = [];
    const deferredFrameworks: FrameworkType[] = [];
    let totalEstimatedSize = 0;

    for (const [framework, frameworkComponents] of frameworkUsage) {
      const requirement = this.analyzeFrameworkRequirement(framework, frameworkComponents);
      requirements.push(requirement);
      totalEstimatedSize += requirement.estimatedSize;

      // Categorize frameworks by loading priority
      if (requirement.priority === LoadPriority.CRITICAL || requirement.priority === LoadPriority.HIGH) {
        criticalFrameworks.push(framework);
      } else {
        deferredFrameworks.push(framework);
      }
    }

    const sharedDependencies = this.identifySharedDependencies(requirements);

    return {
      requirements: requirements.sort((a, b) => this.comparePriority(a.priority, b.priority)),
      totalEstimatedSize,
      criticalFrameworks,
      deferredFrameworks,
      sharedDependencies
    };
  }

  /**
   * Optimizes framework loading order based on dependencies and priorities
   */
  optimizeLoadingOrder(requirements: FrameworkRequirement[]): FrameworkRequirement[] {
    const dependencyGraph = this.buildDependencyGraph(requirements);
    const loadingOrder: FrameworkRequirement[] = [];
    const visited = new Set<FrameworkType>();
    const visiting = new Set<FrameworkType>();

    // Topological sort with priority consideration
    const visit = (framework: FrameworkType) => {
      if (visiting.has(framework)) {
        throw new Error(`Circular dependency detected involving ${framework}`);
      }
      if (visited.has(framework)) {
        return;
      }

      visiting.add(framework);
      
      const deps = dependencyGraph.get(framework) || [];
      for (const dep of deps) {
        visit(dep);
      }

      visiting.delete(framework);
      visited.add(framework);

      const requirement = requirements.find(r => r.framework === framework);
      if (requirement) {
        loadingOrder.push(requirement);
      }
    };

    // Start with critical frameworks
    const criticalFrameworks = requirements
      .filter(r => r.priority === LoadPriority.CRITICAL)
      .map(r => r.framework);

    for (const framework of criticalFrameworks) {
      visit(framework);
    }

    // Then process remaining frameworks
    for (const requirement of requirements) {
      if (!visited.has(requirement.framework)) {
        visit(requirement.framework);
      }
    }

    return loadingOrder;
  }

  /**
   * Calculates bundle splitting strategy for optimal caching
   */
  calculateBundleSplitting(requirements: FrameworkRequirement[]): Map<string, string[]> {
    const bundles = new Map<string, string[]>();
    const sharedDependencies = this.identifySharedDependencies(requirements);

    // Create shared bundle for common dependencies
    if (sharedDependencies.length > 0) {
      bundles.set('shared', sharedDependencies);
    }

    // Create framework-specific bundles
    for (const requirement of requirements) {
      const frameworkBundle: string[] = [];
      
      // Add framework core
      frameworkBundle.push(`${requirement.framework}-core`);
      
      // Add framework-specific dependencies (excluding shared ones)
      const specificDeps = requirement.dependencies.filter(
        dep => !sharedDependencies.includes(dep)
      );
      frameworkBundle.push(...specificDeps);

      bundles.set(`${requirement.framework}-bundle`, frameworkBundle);
    }

    return bundles;
  }

  /**
   * Estimates loading performance impact
   */
  estimatePerformanceImpact(requirements: FrameworkRequirement[]): {
    initialLoadTime: number;
    interactiveTime: number;
    totalTransferSize: number;
    cacheEfficiency: number;
  } {
    let initialLoadTime = 0;
    let interactiveTime = 0;
    let totalTransferSize = 0;

    const criticalRequirements = requirements.filter(
      r => r.priority === LoadPriority.CRITICAL || r.priority === LoadPriority.HIGH
    );

    // Calculate initial load time (critical frameworks)
    for (const requirement of criticalRequirements) {
      initialLoadTime += this.estimateFrameworkLoadTime(requirement);
      totalTransferSize += requirement.estimatedSize;
    }

    // Calculate time to interactive (all frameworks)
    interactiveTime = initialLoadTime;
    for (const requirement of requirements) {
      if (requirement.priority === LoadPriority.NORMAL || requirement.priority === LoadPriority.LOW) {
        interactiveTime += this.estimateFrameworkLoadTime(requirement) * 0.5; // Parallel loading
        totalTransferSize += requirement.estimatedSize;
      }
    }

    // Estimate cache efficiency
    const sharedDependencies = this.identifySharedDependencies(requirements);
    const cacheEfficiency = sharedDependencies.length / 
      (requirements.reduce((sum, r) => sum + r.dependencies.length, 0) || 1);

    return {
      initialLoadTime,
      interactiveTime,
      totalTransferSize,
      cacheEfficiency
    };
  }

  // Private methods

  private initializeFrameworkMetadata(): void {
    // React metadata
    this.frameworkMetadata.set('react', {
      baseSize: 45000,
      dependencies: ['react-dom', 'scheduler'],
      chunkSizes: new Map([
        ['react-core', 25000],
        ['react-dom', 20000]
      ]),
      compatibilityMatrix: new Map([
        ['svelte', ['react-svelte-bridge']]
      ])
    });

    // Vue metadata
    this.frameworkMetadata.set('vue', {
      baseSize: 35000,
      dependencies: ['@vue/runtime-dom', '@vue/shared'],
      chunkSizes: new Map([
        ['vue-core', 25000],
        ['vue-runtime', 10000]
      ]),
      compatibilityMatrix: new Map([
        ['react', ['vue-react-bridge']]
      ])
    });

    // Svelte metadata
    this.frameworkMetadata.set('svelte', {
      baseSize: 15000,
      dependencies: [],
      chunkSizes: new Map([
        ['svelte-core', 15000]
      ]),
      compatibilityMatrix: new Map()
    });

    // Solid metadata
    this.frameworkMetadata.set('solid', {
      baseSize: 25000,
      dependencies: ['solid-js/web'],
      chunkSizes: new Map([
        ['solid-core', 20000],
        ['solid-web', 5000]
      ]),
      compatibilityMatrix: new Map()
    });
  }

  private groupComponentsByFramework(components: ComponentDefinition[]): Map<FrameworkType, ComponentDefinition[]> {
    const frameworkGroups = new Map<FrameworkType, ComponentDefinition[]>();

    for (const component of components) {
      if (!frameworkGroups.has(component.framework)) {
        frameworkGroups.set(component.framework, []);
      }
      frameworkGroups.get(component.framework)!.push(component);
    }

    return frameworkGroups;
  }

  private analyzeFrameworkRequirement(
    framework: FrameworkType, 
    components: ComponentDefinition[]
  ): FrameworkRequirement {
    const metadata = this.frameworkMetadata.get(framework);
    if (!metadata) {
      throw new Error(`Unknown framework: ${framework}`);
    }

    // Determine priority based on component priorities
    const highestPriority = components.reduce((highest, component) => {
      return this.comparePriority(component.priority, highest) < 0 ? component.priority : highest;
    }, LoadPriority.LOW);

    // Calculate estimated size based on component usage
    const baseSize = metadata.baseSize;
    const componentCount = components.length;
    const interactiveCount = components.filter(c => c.isInteractive).length;
    
    // Add overhead for interactive components
    const interactiveOverhead = interactiveCount * 2000;
    const estimatedSize = baseSize + interactiveOverhead;

    return {
      framework,
      components: components.map(c => c.id),
      priority: highestPriority,
      estimatedSize,
      dependencies: [...metadata.dependencies]
    };
  }

  private identifySharedDependencies(requirements: FrameworkRequirement[]): string[] {
    const dependencyCounts = new Map<string, number>();
    
    // Count dependency usage across frameworks
    for (const requirement of requirements) {
      for (const dependency of requirement.dependencies) {
        dependencyCounts.set(dependency, (dependencyCounts.get(dependency) || 0) + 1);
      }
    }

    // Return dependencies used by multiple frameworks
    return Array.from(dependencyCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([dependency, _]) => dependency);
  }

  private buildDependencyGraph(requirements: FrameworkRequirement[]): Map<FrameworkType, FrameworkType[]> {
    const graph = new Map<FrameworkType, FrameworkType[]>();

    for (const requirement of requirements) {
      const deps: FrameworkType[] = [];
      
      // Check for framework compatibility requirements
      const metadata = this.frameworkMetadata.get(requirement.framework);
      if (metadata) {
        for (const [otherFramework, bridges] of metadata.compatibilityMatrix) {
          if (requirements.some(r => r.framework === otherFramework)) {
            deps.push(otherFramework);
          }
        }
      }

      graph.set(requirement.framework, deps);
    }

    return graph;
  }

  private estimateFrameworkLoadTime(requirement: FrameworkRequirement): number {
    // Base load time estimation (in milliseconds)
    const baseTime = 50;
    const sizeMultiplier = requirement.estimatedSize / 10000; // 10KB baseline
    const dependencyMultiplier = requirement.dependencies.length * 10;
    
    return baseTime + sizeMultiplier + dependencyMultiplier;
  }

  private comparePriority(a: LoadPriority, b: LoadPriority): number {
    const priorityOrder = {
      [LoadPriority.CRITICAL]: 0,
      [LoadPriority.HIGH]: 1,
      [LoadPriority.NORMAL]: 2,
      [LoadPriority.LOW]: 3
    };
    return priorityOrder[a] - priorityOrder[b];
  }
}