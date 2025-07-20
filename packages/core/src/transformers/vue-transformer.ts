/**
 * Vue-specific transformer for modern MTM syntax
 * Converts reactive variables, functions, and templates to Vue Composition API code
 */

import type {
  UnifiedAST,
  ProgramNode,
  VariableDeclarationNode,
  ReactiveVariableNode,
  FunctionDeclarationNode,
  TemplateNode,
  DataBindingNode,
  ExpressionNode,
  ASTTransformer
} from '../types/unified-ast.js';

/**
 * Vue ref code representation
 */
export interface VueRefCode {
  refName: string;
  refCall: string;
  variableName: string;
  isReactive: boolean;
}

/**
 * Vue method code representation
 */
export interface VueMethodCode {
  methodName: string;
  methodDeclaration: string;
  dependencies: string[];
}

/**
 * Vue template code representation
 */
export interface VueTemplateCode {
  template: string;
  bindings: string[];
  eventHandlers: string[];
}

/**
 * Vue setup code representation
 */
export interface VueSetupCode {
  imports: string[];
  refs: string[];
  methods: string[];
  computed: string[];
  watchers: string[];
  returns: string[];
}

/**
 * Vue transformer that converts modern MTM syntax to Vue Composition API code
 */
export class VueTransformer implements ASTTransformer {
  private imports = new Set<string>();
  private refs: string[] = [];
  private methods: string[] = [];
  private computed: string[] = [];
  private watchers: string[] = [];
  private returns: string[] = [];
  private reactiveVariables = new Map<string, VueRefCode>();

  constructor() {
    // Always include Vue Composition API imports
    this.imports.add("import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';");
  }

  /**
   * Transform unified AST to Vue-compatible AST
   */
  transform(ast: UnifiedAST): UnifiedAST {
    if (ast.type === 'LegacyProgram') {
      // For legacy AST, return as-is for now
      return ast;
    }

    const program = ast as ProgramNode;
    
    // Reset state for new transformation
    this.reset();

    // Process each statement in the program
    for (const statement of program.body) {
      this.transformNode(statement);
    }

    // Return transformed AST (for now, return original with metadata)
    return {
      ...program,
      metadata: {
        framework: 'vue',
        generatedCode: this.generateVueCode()
      }
    } as any;
  }

  /**
   * Transform individual AST node
   */
  transformNode(node: any): any {
    switch (node.type) {
      case 'VariableDeclaration':
        return this.transformVariableDeclaration(node);
      case 'FunctionDeclaration':
        return this.transformFunctionDeclaration(node);
      case 'Template':
        return this.transformTemplate(node);
      default:
        return node;
    }
  }

  /**
   * Transform reactive variable to Vue ref/reactive
   */
  transformReactiveVariable(variable: ReactiveVariableNode): VueRefCode {
    const variableName = variable.name;
    const initialValue = this.generateInitialValue(variable.initializer);
    
    // Use ref for primitive values, reactive for objects
    const isObject = this.isObjectValue(variable.initializer);
    const refType = isObject ? 'reactive' : 'ref';
    const refCall = `const ${variableName} = ${refType}(${initialValue});`;
    
    const refCode: VueRefCode = {
      refName: refType,
      refCall,
      variableName,
      isReactive: true
    };

    // Store for reference in other transformations
    this.reactiveVariables.set(variableName, refCode);
    this.refs.push(refCall);
    this.returns.push(variableName);

    // Generate watcher for dependency tracking if needed
    if (variable.dependencies.length > 0) {
      this.generateDependencyWatcher(variable);
    }

    return refCode;
  }

  /**
   * Transform dollar function to Vue method
   */
  transformDollarFunction(func: FunctionDeclarationNode): VueMethodCode {
    const methodName = func.name;
    const parameters = func.parameters.map(p => p.name).join(', ');
    const dependencies = this.extractDependencies(func);
    
    // Generate method declaration
    const methodDeclaration = `const ${methodName} = (${parameters}) => {
${this.generateFunctionBody(func.body)}
};`;

    const methodCode: VueMethodCode = {
      methodName,
      methodDeclaration,
      dependencies
    };

    this.methods.push(methodDeclaration);
    this.returns.push(methodName);
    return methodCode;
  }

  /**
   * Transform template to Vue template syntax
   */
  transformTemplate(template: TemplateNode): VueTemplateCode {
    let vueTemplate = template.content;
    const bindings: string[] = [];
    const eventHandlers: string[] = [];

    // Process data bindings
    for (const binding of template.bindings) {
      const vueBinding = this.transformDataBinding(binding);
      bindings.push(vueBinding);
      
      // Replace template syntax with Vue syntax
      if (binding.bindingType === 'variable') {
        vueTemplate = vueTemplate.replace(
          new RegExp(`\\{\\{\\$${binding.source}\\}\\}`, 'g'),
          `{{ ${binding.source} }}`
        );
      } else if (binding.bindingType === 'event') {
        const vueEventName = this.convertEventName(binding.target);
        const eventHandler = `${vueEventName}="${binding.source}"`;
        eventHandlers.push(eventHandler);
        
        // Replace the original event attribute with Vue event attribute
        const originalPattern = `${binding.target}="$${binding.source}()"`;
        const vuePattern = `${vueEventName}="${binding.source}"`;
        vueTemplate = vueTemplate.replace(originalPattern, vuePattern);
        
        // Also handle without quotes
        const originalPatternNoQuotes = `${binding.target}=$${binding.source}()`;
        vueTemplate = vueTemplate.replace(originalPatternNoQuotes, vuePattern);
      }
    }

    return {
      template: vueTemplate,
      bindings,
      eventHandlers
    };
  }

  /**
   * Generate Vue Composition API setup code
   */
  generateCompositionAPI(reactives: ReactiveVariableNode[]): VueSetupCode {
    const imports: string[] = [];
    const refs: string[] = [];
    const methods: string[] = [];
    const computed: string[] = [];
    const watchers: string[] = [];
    const returns: string[] = [];

    for (const reactive of reactives) {
      const refCode = this.transformReactiveVariable(reactive);
      refs.push(refCode.refCall);
      returns.push(refCode.variableName);

      // Generate watchers for dependencies
      if (reactive.dependencies.length > 0) {
        const watcher = this.generateReactiveWatcher(reactive, refCode);
        watchers.push(watcher);
      }
    }

    return {
      imports: Array.from(this.imports),
      refs,
      methods: this.methods,
      computed: this.computed,
      watchers: this.watchers,
      returns: this.returns
    };
  }

  /**
   * Generate complete Vue setup function
   */
  generateVueSetupFunction(): string {
    const setupCode = this.generateCompositionAPI([]);
    
    return `
export default {
  setup() {
    ${setupCode.refs.join('\n    ')}
    
    ${setupCode.methods.join('\n    ')}
    
    ${setupCode.computed.join('\n    ')}
    
    ${setupCode.watchers.join('\n    ')}
    
    return {
      ${setupCode.returns.join(',\n      ')}
    };
  }
};`;
  }

  /**
   * Generate complete Vue code
   */
  private generateVueCode(): any {
    return {
      imports: Array.from(this.imports),
      refs: this.refs,
      methods: this.methods,
      computed: this.computed,
      watchers: this.watchers,
      returns: this.returns,
      setupFunction: this.generateVueSetupFunction()
    };
  }

  /**
   * Transform variable declaration (reactive or regular)
   */
  private transformVariableDeclaration(node: VariableDeclarationNode): any {
    if (node.isReactive) {
      return this.transformReactiveVariable(node as ReactiveVariableNode);
    }

    // For non-reactive variables, convert to regular const declaration
    const initialValue = this.generateInitialValue(node.initializer);
    const declaration = `const ${node.name} = ${initialValue};`;
    
    return {
      ...node,
      vueCode: declaration
    };
  }

  /**
   * Transform function declaration
   */
  private transformFunctionDeclaration(node: FunctionDeclarationNode): any {
    return this.transformDollarFunction(node);
  }

  /**
   * Transform data binding to Vue-compatible format
   */
  private transformDataBinding(binding: DataBindingNode): string {
    switch (binding.bindingType) {
      case 'variable':
        return `{{ ${binding.source} }}`;
      case 'expression':
        return `{{ ${binding.source} }}`;
      case 'event':
        return `@${binding.target}="${binding.source}"`;
      default:
        return binding.source;
    }
  }

  /**
   * Convert MTM event names to Vue event names
   */
  private convertEventName(eventName: string): string {
    // Vue uses @ prefix for events
    return `@${eventName}`;
  }

  /**
   * Generate initial value for Vue ref/reactive
   */
  private generateInitialValue(initializer: ExpressionNode): string {
    switch (initializer.type) {
      case 'Literal':
        const literal = initializer as any;
        if (typeof literal.value === 'string') {
          return `'${literal.value}'`;
        }
        return String(literal.value);
      case 'Identifier':
        const identifier = initializer as any;
        return identifier.name;
      default:
        return 'null';
    }
  }

  /**
   * Check if the initializer represents an object value
   */
  private isObjectValue(initializer: ExpressionNode): boolean {
    return initializer.type === 'ObjectExpression' || 
           initializer.type === 'ArrayExpression';
  }

  /**
   * Generate dependency watcher for reactive variable
   */
  private generateDependencyWatcher(variable: ReactiveVariableNode): void {
    const dependencies = variable.dependencies.map(dep => `() => ${dep}`).join(', ');
    const watcher = `watch([${dependencies}], () => {
  // Update ${variable.name} when dependencies change
  // This would contain the reactive update logic
});`;

    this.watchers.push(watcher);
  }

  /**
   * Generate function body from AST
   */
  private generateFunctionBody(body: any): string {
    // Simplified function body generation
    // In a full implementation, this would traverse the AST
    return '  // Function body implementation';
  }

  /**
   * Extract dependencies from function
   */
  private extractDependencies(func: FunctionDeclarationNode): string[] {
    // Simplified dependency extraction
    // In a full implementation, this would analyze the function body
    return [];
  }

  /**
   * Generate reactive watcher
   */
  private generateReactiveWatcher(reactive: ReactiveVariableNode, refCode: VueRefCode): string {
    const dependencies = reactive.dependencies.join(', ');
    return `watch(() => [${dependencies}], () => {
  // Reactive watcher for ${reactive.name}
  // Update triggers: ${reactive.updateTriggers.join(', ')}
});`;
  }

  /**
   * Reset transformer state
   */
  private reset(): void {
    this.imports.clear();
    this.refs = [];
    this.methods = [];
    this.computed = [];
    this.watchers = [];
    this.returns = [];
    this.reactiveVariables.clear();
    
    // Re-add default imports
    this.imports.add("import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';");
  }
}

/**
 * Factory function to create Vue transformer
 */
export function createVueTransformer(): VueTransformer {
  return new VueTransformer();
}

/**
 * Transform reactive variable to Vue ref code
 * Example: $counter! = 0 → const counter = ref(0);
 */
export function transformReactiveVariableToRef(variable: ReactiveVariableNode): string {
  const transformer = new VueTransformer();
  const refCode = transformer.transformReactiveVariable(variable);
  return refCode.refCall;
}

/**
 * Transform dollar function to Vue method
 * Example: $increment = () => $counter++ → const increment = () => { counter.value++; };
 */
export function transformDollarFunctionToMethod(func: FunctionDeclarationNode): string {
  const transformer = new VueTransformer();
  const methodCode = transformer.transformDollarFunction(func);
  return methodCode.methodDeclaration;
}