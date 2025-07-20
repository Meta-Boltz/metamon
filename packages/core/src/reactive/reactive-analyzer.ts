/**
 * Reactive variable analyzer for MTM modern syntax
 * Implements dependency graph generation and update trigger analysis
 */

import type {
  UnifiedAST,
  VariableDeclarationNode,
  ReactiveVariableNode,
  ExpressionNode,
  IdentifierNode,
  CallExpressionNode,
  MemberExpressionNode,
  ASTNode,
  ProgramNode
} from '../types/unified-ast.js';

/**
 * Reactive dependency graph representation
 */
export interface ReactiveGraph {
  variables: Map<string, ReactiveVariableNode>;
  dependencies: Map<string, string[]>;
  updateChains: UpdateChain[];
  triggers: Map<string, UpdateTrigger[]>;
}

/**
 * Update chain represents a sequence of reactive updates
 */
export interface UpdateChain {
  source: string;
  targets: string[];
  depth: number;
  circular: boolean;
}

/**
 * Update trigger represents UI elements that should update when a reactive variable changes
 */
export interface UpdateTrigger {
  variableName: string;
  triggerType: 'template' | 'event' | 'computed' | 'effect';
  targetElement?: string;
  expression?: string;
  immediate: boolean;
}

/**
 * Dependency analysis result
 */
export interface DependencyAnalysis {
  directDependencies: string[];
  indirectDependencies: string[];
  circularDependencies: string[];
  updateOrder: string[];
}

/**
 * Change detection metadata
 */
export interface ChangeDetection {
  variableName: string;
  changeType: 'assignment' | 'mutation' | 'increment' | 'decrement';
  location: { line: number; column: number };
  affectedVariables: string[];
}

/**
 * Reactive variable analyzer implementation
 */
export class ReactiveVariableAnalyzer {
  private reactiveGraph: ReactiveGraph;
  private visitedNodes: Set<ASTNode>;

  constructor() {
    this.reactiveGraph = {
      variables: new Map(),
      dependencies: new Map(),
      updateChains: [],
      triggers: new Map()
    };
    this.visitedNodes = new Set();
  }

  /**
   * Analyze an AST and build reactive dependency graph
   */
  analyzeAST(ast: UnifiedAST): ReactiveGraph {
    this.reset();
    
    if (ast.type === 'Program') {
      this.analyzeProgram(ast as ProgramNode);
    }
    
    // Build update chains after analyzing all variables
    this.buildUpdateChains();
    
    // Detect circular dependencies
    this.detectCircularDependencies();
    
    return this.reactiveGraph;
  }

  /**
   * Alias for analyzeAST for backward compatibility
   */
  analyzeReactiveVariables(ast: UnifiedAST): ReactiveGraph {
    return this.analyzeAST(ast);
  }

  /**
   * Analyze a program node
   */
  private analyzeProgram(program: ProgramNode): void {
    for (const statement of program.body) {
      this.analyzeStatement(statement);
    }
  }

  /**
   * Analyze a statement for reactive variables
   */
  private analyzeStatement(statement: ASTNode): void {
    if (this.visitedNodes.has(statement)) {
      return;
    }
    this.visitedNodes.add(statement);

    switch (statement.type) {
      case 'VariableDeclaration':
        this.analyzeVariableDeclaration(statement as VariableDeclarationNode);
        break;
      case 'ExpressionStatement':
        this.analyzeExpression((statement as any).expression);
        break;
      case 'BlockStatement':
        for (const stmt of (statement as any).body) {
          this.analyzeStatement(stmt);
        }
        break;
      default:
        // Handle other statement types as needed
        break;
    }
  }

  /**
   * Analyze variable declaration for reactive properties
   */
  private analyzeVariableDeclaration(declaration: VariableDeclarationNode): void {
    if (declaration.isReactive) {
      const reactiveVar: ReactiveVariableNode = {
        ...declaration,
        isReactive: true,
        updateTriggers: this.analyzeUpdateTriggers(declaration.name, declaration.initializer),
        dependencies: this.analyzeDependencies(declaration.initializer)
      };

      this.reactiveGraph.variables.set(declaration.name, reactiveVar);
      this.reactiveGraph.dependencies.set(declaration.name, reactiveVar.dependencies);
      
      // Generate update triggers
      const triggers = this.generateUpdateTriggers(reactiveVar);
      this.reactiveGraph.triggers.set(declaration.name, triggers);
    }

    // Analyze initializer for dependencies
    this.analyzeExpression(declaration.initializer);
  }

  /**
   * Analyze expression for variable dependencies
   */
  private analyzeExpression(expression: ExpressionNode): string[] {
    const dependencies: string[] = [];

    switch (expression.type) {
      case 'Identifier':
        const identifier = expression as IdentifierNode;
        if (identifier.name.startsWith('$')) {
          const varName = identifier.name.substring(1);
          dependencies.push(varName);
        }
        break;

      case 'CallExpression':
        const callExpr = expression as CallExpressionNode;
        dependencies.push(...this.analyzeExpression(callExpr.callee));
        for (const arg of callExpr.arguments) {
          dependencies.push(...this.analyzeExpression(arg));
        }
        break;

      case 'MemberExpression':
        const memberExpr = expression as MemberExpressionNode;
        dependencies.push(...this.analyzeExpression(memberExpr.object));
        if (memberExpr.computed) {
          dependencies.push(...this.analyzeExpression(memberExpr.property));
        }
        break;

      case 'ArrayExpression':
        const arrayExpr = expression as any;
        if (arrayExpr.elements) {
          for (const element of arrayExpr.elements) {
            if (element) {
              dependencies.push(...this.analyzeExpression(element));
            }
          }
        }
        break;

      case 'ObjectExpression':
        const objectExpr = expression as any;
        if (objectExpr.properties) {
          for (const prop of objectExpr.properties) {
            dependencies.push(...this.analyzeExpression(prop.value));
          }
        }
        break;

      default:
        // Handle other expression types as needed
        break;
    }

    return dependencies;
  }

  /**
   * Analyze update triggers for a reactive variable
   */
  private analyzeUpdateTriggers(variableName: string, initializer: ExpressionNode): string[] {
    const triggers: string[] = [];
    
    // For now, we'll identify common UI update patterns
    // This would be expanded based on template analysis
    triggers.push(`template:${variableName}`);
    
    // If the variable is used in computed expressions, add those as triggers
    const dependencies = this.analyzeDependencies(initializer);
    for (const dep of dependencies) {
      if (this.reactiveGraph.variables.has(dep)) {
        triggers.push(`computed:${dep}`);
      }
    }
    
    return triggers;
  }

  /**
   * Analyze dependencies of an expression
   */
  private analyzeDependencies(expression: ExpressionNode): string[] {
    return this.analyzeExpression(expression);
  }

  /**
   * Generate update triggers for a reactive variable
   */
  private generateUpdateTriggers(reactiveVar: ReactiveVariableNode): UpdateTrigger[] {
    const triggers: UpdateTrigger[] = [];

    // Template binding trigger
    triggers.push({
      variableName: reactiveVar.name,
      triggerType: 'template',
      targetElement: `[data-bind="${reactiveVar.name}"]`,
      immediate: true
    });

    // Event handler trigger
    triggers.push({
      variableName: reactiveVar.name,
      triggerType: 'event',
      expression: `update_${reactiveVar.name}`,
      immediate: false
    });

    // Computed property triggers for dependent variables
    for (const dependency of reactiveVar.dependencies) {
      if (this.reactiveGraph.variables.has(dependency)) {
        triggers.push({
          variableName: reactiveVar.name,
          triggerType: 'computed',
          expression: `compute_${reactiveVar.name}_from_${dependency}`,
          immediate: false
        });
      }
    }

    return triggers;
  }

  /**
   * Build update chains showing how changes propagate
   */
  private buildUpdateChains(): void {
    const chains: UpdateChain[] = [];

    for (const [varName, dependencies] of this.reactiveGraph.dependencies) {
      if (dependencies.length > 0) {
        const chain = this.buildChainForVariable(varName, dependencies, 0, new Set());
        chains.push(chain);
      }
    }

    this.reactiveGraph.updateChains = chains;
  }

  /**
   * Build update chain for a specific variable
   */
  private buildChainForVariable(
    source: string,
    dependencies: string[],
    depth: number,
    visited: Set<string>
  ): UpdateChain {
    const targets: string[] = [];
    let circular = false;

    if (visited.has(source)) {
      circular = true;
    } else {
      visited.add(source);

      for (const dep of dependencies) {
        targets.push(dep);
        
        // Recursively find targets of dependencies
        const depDependencies = this.reactiveGraph.dependencies.get(dep);
        if (depDependencies && depDependencies.length > 0) {
          const subChain = this.buildChainForVariable(dep, depDependencies, depth + 1, new Set(visited));
          targets.push(...subChain.targets);
          if (subChain.circular) {
            circular = true;
          }
        }
      }
    }

    return {
      source,
      targets: [...new Set(targets)], // Remove duplicates
      depth,
      circular
    };
  }

  /**
   * Detect circular dependencies in reactive variables
   */
  private detectCircularDependencies(): void {
    for (const chain of this.reactiveGraph.updateChains) {
      if (chain.circular) {
        console.warn(`Circular dependency detected in reactive variable chain starting with: ${chain.source}`);
      }
    }
  }

  /**
   * Analyze change detection for reactive variables
   */
  analyzeChangeDetection(ast: UnifiedAST): ChangeDetection[] {
    const changes: ChangeDetection[] = [];
    
    // This would analyze assignment expressions, increment/decrement operations, etc.
    // For now, we'll return a basic implementation
    
    return changes;
  }

  /**
   * Get dependency analysis for a specific variable
   */
  getDependencyAnalysis(variableName: string): DependencyAnalysis {
    const directDependencies = this.reactiveGraph.dependencies.get(variableName) || [];
    const indirectDependencies: string[] = [];
    const circularDependencies: string[] = [];
    
    // Find indirect dependencies
    for (const directDep of directDependencies) {
      const subDeps = this.reactiveGraph.dependencies.get(directDep) || [];
      indirectDependencies.push(...subDeps);
    }

    // Find circular dependencies
    const chain = this.reactiveGraph.updateChains.find(c => c.source === variableName);
    if (chain && chain.circular) {
      circularDependencies.push(...chain.targets.filter(t => 
        this.reactiveGraph.dependencies.get(t)?.includes(variableName)
      ));
    }

    // Calculate update order (topological sort)
    const updateOrder = this.calculateUpdateOrder(variableName);

    return {
      directDependencies,
      indirectDependencies: [...new Set(indirectDependencies)],
      circularDependencies,
      updateOrder
    };
  }

  /**
   * Calculate optimal update order for reactive variables
   */
  private calculateUpdateOrder(startVariable: string): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (variable: string): void => {
      if (visiting.has(variable)) {
        // Circular dependency detected
        return;
      }
      
      if (visited.has(variable)) {
        return;
      }

      visiting.add(variable);
      
      const dependencies = this.reactiveGraph.dependencies.get(variable) || [];
      for (const dep of dependencies) {
        visit(dep);
      }
      
      visiting.delete(variable);
      visited.add(variable);
      order.push(variable);
    };

    visit(startVariable);
    return order;
  }

  /**
   * Get reactive graph
   */
  getReactiveGraph(): ReactiveGraph {
    return this.reactiveGraph;
  }

  /**
   * Reset analyzer state
   */
  private reset(): void {
    this.reactiveGraph = {
      variables: new Map(),
      dependencies: new Map(),
      updateChains: [],
      triggers: new Map()
    };
    this.visitedNodes.clear();
  }

  /**
   * Check if a variable is reactive
   */
  isReactive(variableName: string): boolean {
    return this.reactiveGraph.variables.has(variableName);
  }

  /**
   * Get all reactive variables
   */
  getReactiveVariables(): ReactiveVariableNode[] {
    return Array.from(this.reactiveGraph.variables.values());
  }

  /**
   * Get update triggers for a variable
   */
  getUpdateTriggers(variableName: string): UpdateTrigger[] {
    return this.reactiveGraph.triggers.get(variableName) || [];
  }
}