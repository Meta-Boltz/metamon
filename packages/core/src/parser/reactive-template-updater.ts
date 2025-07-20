import type { 
  TemplateNode, 
  DataBindingNode, 
  ReactiveVariableNode,
  SourceLocation 
} from '../types/unified-ast.js';

/**
 * Template update strategy
 */
export type TemplateUpdateStrategy = 'immediate' | 'batched' | 'debounced' | 'selective';

/**
 * DOM update operation
 */
export interface DOMUpdateOperation {
  type: 'text' | 'attribute' | 'property' | 'event';
  target: string; // CSS selector or element identifier
  property: string; // Property/attribute name
  value: string; // New value
  binding: DataBindingNode;
  priority: number; // Update priority (lower = higher priority)
}

/**
 * Template change detection result
 */
export interface TemplateChangeDetection {
  hasChanges: boolean;
  changedBindings: DataBindingNode[];
  affectedElements: string[];
  updateOperations: DOMUpdateOperation[];
}

/**
 * Reactive template update configuration
 */
export interface ReactiveUpdateConfig {
  strategy: TemplateUpdateStrategy;
  batchSize: number;
  debounceDelay: number;
  enableOptimization: boolean;
  trackDependencies: boolean;
}

/**
 * Template dependency graph
 */
export interface TemplateDependencyGraph {
  variables: Map<string, Set<string>>; // variable -> dependent elements
  elements: Map<string, Set<string>>; // element -> dependent variables
  bindings: Map<string, DataBindingNode[]>; // variable -> bindings
}

/**
 * Reactive template updater for automatic DOM updates
 */
export class ReactiveTemplateUpdater {
  private config: ReactiveUpdateConfig;
  private dependencyGraph: TemplateDependencyGraph;
  private updateQueue: DOMUpdateOperation[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<ReactiveUpdateConfig> = {}) {
    this.config = {
      strategy: 'batched',
      batchSize: 10,
      debounceDelay: 16, // ~60fps
      enableOptimization: true,
      trackDependencies: true,
      ...config
    };

    this.dependencyGraph = {
      variables: new Map(),
      elements: new Map(),
      bindings: new Map()
    };
  }

  /**
   * Analyze template and build dependency graph
   */
  analyzeTemplate(template: TemplateNode): TemplateDependencyGraph {
    this.dependencyGraph = {
      variables: new Map(),
      elements: new Map(),
      bindings: new Map()
    };

    // Process each binding to build dependency relationships
    for (const binding of template.bindings) {
      this.processBinding(binding);
    }

    return this.dependencyGraph;
  }

  /**
   * Process a single binding to extract dependencies
   */
  private processBinding(binding: DataBindingNode): void {
    const variables = this.extractVariablesFromBinding(binding);
    const elementId = this.generateElementId(binding);

    for (const variable of variables) {
      // Add variable -> element dependency
      if (!this.dependencyGraph.variables.has(variable)) {
        this.dependencyGraph.variables.set(variable, new Set());
      }
      this.dependencyGraph.variables.get(variable)!.add(elementId);

      // Add element -> variable dependency
      if (!this.dependencyGraph.elements.has(elementId)) {
        this.dependencyGraph.elements.set(elementId, new Set());
      }
      this.dependencyGraph.elements.get(elementId)!.add(variable);

      // Add variable -> binding mapping
      if (!this.dependencyGraph.bindings.has(variable)) {
        this.dependencyGraph.bindings.set(variable, []);
      }
      this.dependencyGraph.bindings.get(variable)!.push(binding);
    }
  }

  /**
   * Extract variable references from binding
   */
  private extractVariablesFromBinding(binding: DataBindingNode): string[] {
    const variables: string[] = [];
    const matches = binding.source.match(/\$\w+/g);
    
    if (matches) {
      variables.push(...matches);
    }

    return [...new Set(variables)]; // Remove duplicates
  }

  /**
   * Generate unique element identifier for binding
   */
  private generateElementId(binding: DataBindingNode): string {
    return `element_${binding.location?.line || 0}_${binding.location?.column || 0}_${binding.bindingType}`;
  }

  /**
   * Detect changes in template based on variable updates
   */
  detectTemplateChanges(
    template: TemplateNode,
    changedVariables: string[]
  ): TemplateChangeDetection {
    const changedBindings: DataBindingNode[] = [];
    const affectedElements = new Set<string>();
    const updateOperations: DOMUpdateOperation[] = [];

    for (const variable of changedVariables) {
      const bindings = this.dependencyGraph.bindings.get(variable) || [];
      const elements = this.dependencyGraph.variables.get(variable) || new Set();

      for (const binding of bindings) {
        if (!changedBindings.includes(binding)) {
          changedBindings.push(binding);
          
          // Create update operation
          const operation = this.createUpdateOperation(binding, variable);
          updateOperations.push(operation);
        }
      }

      elements.forEach(element => affectedElements.add(element));
    }

    return {
      hasChanges: changedBindings.length > 0,
      changedBindings,
      affectedElements: Array.from(affectedElements),
      updateOperations: this.optimizeUpdateOperations(updateOperations)
    };
  }

  /**
   * Create DOM update operation for binding
   */
  private createUpdateOperation(
    binding: DataBindingNode,
    changedVariable: string
  ): DOMUpdateOperation {
    const elementId = this.generateElementId(binding);
    let type: DOMUpdateOperation['type'] = 'text';
    let property = 'textContent';
    let priority = 1;

    switch (binding.bindingType) {
      case 'variable':
        type = 'text';
        property = 'textContent';
        priority = 1;
        break;
      case 'expression':
        type = 'text';
        property = 'innerHTML';
        priority = 2;
        break;
      case 'event':
        type = 'event';
        property = binding.target;
        priority = 3;
        break;
    }

    return {
      type,
      target: elementId,
      property,
      value: this.evaluateBindingValue(binding, changedVariable),
      binding,
      priority
    };
  }

  /**
   * Evaluate binding value (simplified - in real implementation would use expression evaluator)
   */
  private evaluateBindingValue(binding: DataBindingNode, changedVariable: string): string {
    // This is a simplified implementation
    // In a real implementation, we'd evaluate the expression with current variable values
    return `{{${binding.source}}}`;
  }

  /**
   * Optimize update operations to minimize DOM manipulation
   */
  private optimizeUpdateOperations(operations: DOMUpdateOperation[]): DOMUpdateOperation[] {
    if (!this.config.enableOptimization) {
      return operations;
    }

    // Sort by priority (lower number = higher priority)
    operations.sort((a, b) => a.priority - b.priority);

    // Remove duplicate operations for the same target/property
    const seen = new Set<string>();
    const optimized: DOMUpdateOperation[] = [];

    for (const operation of operations) {
      const key = `${operation.target}:${operation.property}`;
      if (!seen.has(key)) {
        seen.add(key);
        optimized.push(operation);
      }
    }

    return optimized;
  }

  /**
   * Schedule template updates based on strategy
   */
  scheduleTemplateUpdate(
    template: TemplateNode,
    changedVariables: string[]
  ): Promise<void> {
    const changes = this.detectTemplateChanges(template, changedVariables);
    
    if (!changes.hasChanges) {
      return Promise.resolve();
    }

    switch (this.config.strategy) {
      case 'immediate':
        return this.executeImmediateUpdate(changes);
      case 'batched':
        return this.executeBatchedUpdate(changes);
      case 'debounced':
        return this.executeDebouncedUpdate(changes);
      case 'selective':
        return this.executeSelectiveUpdate(changes);
      default:
        return this.executeBatchedUpdate(changes);
    }
  }

  /**
   * Execute immediate template update
   */
  private async executeImmediateUpdate(changes: TemplateChangeDetection): Promise<void> {
    for (const operation of changes.updateOperations) {
      await this.applyDOMUpdate(operation);
    }
  }

  /**
   * Execute batched template update
   */
  private async executeBatchedUpdate(changes: TemplateChangeDetection): Promise<void> {
    this.updateQueue.push(...changes.updateOperations);

    if (this.updateQueue.length >= this.config.batchSize) {
      await this.flushUpdateQueue();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushUpdateQueue();
      }, this.config.debounceDelay);
    }
  }

  /**
   * Execute debounced template update
   */
  private async executeDebouncedUpdate(changes: TemplateChangeDetection): Promise<void> {
    this.updateQueue.push(...changes.updateOperations);

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flushUpdateQueue();
    }, this.config.debounceDelay);
  }

  /**
   * Execute selective template update (only update changed elements)
   */
  private async executeSelectiveUpdate(changes: TemplateChangeDetection): Promise<void> {
    // Group operations by element to minimize DOM queries
    const elementOperations = new Map<string, DOMUpdateOperation[]>();
    
    for (const operation of changes.updateOperations) {
      if (!elementOperations.has(operation.target)) {
        elementOperations.set(operation.target, []);
      }
      elementOperations.get(operation.target)!.push(operation);
    }

    // Apply updates element by element
    for (const [elementId, operations] of elementOperations) {
      await this.applyElementUpdates(elementId, operations);
    }
  }

  /**
   * Flush the update queue
   */
  private async flushUpdateQueue(): Promise<void> {
    if (this.updateQueue.length === 0) return;

    const operations = [...this.updateQueue];
    this.updateQueue = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const optimized = this.optimizeUpdateOperations(operations);
    
    for (const operation of optimized) {
      await this.applyDOMUpdate(operation);
    }
  }

  /**
   * Apply DOM update operation
   */
  private async applyDOMUpdate(operation: DOMUpdateOperation): Promise<void> {
    // This is a placeholder - in a real implementation, this would interact with the DOM
    // or generate framework-specific update code
    console.debug(`DOM Update: ${operation.type} ${operation.target}.${operation.property} = ${operation.value}`);
  }

  /**
   * Apply multiple updates to a single element
   */
  private async applyElementUpdates(elementId: string, operations: DOMUpdateOperation[]): Promise<void> {
    console.debug(`Updating element ${elementId} with ${operations.length} operations`);
    
    for (const operation of operations) {
      await this.applyDOMUpdate(operation);
    }
  }

  /**
   * Generate framework-specific update code
   */
  generateFrameworkUpdateCode(
    changes: TemplateChangeDetection,
    framework: 'react' | 'vue' | 'svelte'
  ): string {
    switch (framework) {
      case 'react':
        return this.generateReactUpdateCode(changes);
      case 'vue':
        return this.generateVueUpdateCode(changes);
      case 'svelte':
        return this.generateSvelteUpdateCode(changes);
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  /**
   * Generate React update code
   */
  private generateReactUpdateCode(changes: TemplateChangeDetection): string {
    const updates = changes.updateOperations.map(op => {
      switch (op.type) {
        case 'text':
          return `// Update ${op.target}: ${op.property} = ${op.value}`;
        case 'attribute':
          return `// Set attribute ${op.property} = ${op.value}`;
        case 'event':
          return `// Bind event ${op.property}`;
        default:
          return `// Unknown update type: ${op.type}`;
      }
    });

    return `// React update code\n${updates.join('\n')}`;
  }

  /**
   * Generate Vue update code
   */
  private generateVueUpdateCode(changes: TemplateChangeDetection): string {
    const updates = changes.updateOperations.map(op => {
      switch (op.type) {
        case 'text':
          return `// Update ${op.target}: ${op.property} = ${op.value}`;
        case 'attribute':
          return `// Set attribute ${op.property} = ${op.value}`;
        case 'event':
          return `// Bind event @${op.property}`;
        default:
          return `// Unknown update type: ${op.type}`;
      }
    });

    return `// Vue update code\n${updates.join('\n')}`;
  }

  /**
   * Generate Svelte update code
   */
  private generateSvelteUpdateCode(changes: TemplateChangeDetection): string {
    const updates = changes.updateOperations.map(op => {
      switch (op.type) {
        case 'text':
          return `// Update ${op.target}: ${op.property} = ${op.value}`;
        case 'attribute':
          return `// Set attribute ${op.property} = ${op.value}`;
        case 'event':
          return `// Bind event on:${op.property}`;
        default:
          return `// Unknown update type: ${op.type}`;
      }
    });

    return `// Svelte update code\n${updates.join('\n')}`;
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(): TemplateDependencyGraph {
    return this.dependencyGraph;
  }

  /**
   * Get current configuration
   */
  getConfig(): ReactiveUpdateConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ReactiveUpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clear update queue and reset state
   */
  reset(): void {
    this.updateQueue = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.dependencyGraph = {
      variables: new Map(),
      elements: new Map(),
      bindings: new Map()
    };
  }
}