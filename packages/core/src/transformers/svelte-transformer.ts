/**
 * Svelte-specific transformer for modern MTM syntax
 * Converts reactive variables, functions, and templates to Svelte code
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
 * Svelte store code representation
 */
export interface SvelteStoreCode {
  storeName: string;
  storeDeclaration: string;
  variableName: string;
  isWritable: boolean;
}

/**
 * Svelte function code representation
 */
export interface SvelteFunctionCode {
  functionName: string;
  functionDeclaration: string;
  dependencies: string[];
}

/**
 * Svelte markup code representation
 */
export interface SvelteMarkupCode {
  template: string;
  bindings: string[];
  eventHandlers: string[];
}

/**
 * Svelte reactive code representation
 */
export interface SvelteReactiveCode {
  reactiveStatements: string[];
  storeSubscriptions: string[];
  derivedStores: string[];
}

/**
 * Svelte transformer that converts modern MTM syntax to Svelte code
 */
export class SvelteTransformer implements ASTTransformer {
  private imports = new Set<string>();
  private stores: string[] = [];
  private functions: string[] = [];
  private reactiveStatements: string[] = [];
  private derivedStores: string[] = [];
  private storeSubscriptions: string[] = [];
  private reactiveVariables = new Map<string, SvelteStoreCode>();

  constructor() {
    // Always include Svelte store imports
    this.imports.add("import { writable, readable, derived } from 'svelte/store';");
  }

  /**
   * Transform unified AST to Svelte-compatible AST
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
        framework: 'svelte',
        generatedCode: this.generateSvelteCode()
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
   * Transform reactive variable to Svelte store or reactive statement
   */
  transformReactiveVariable(variable: ReactiveVariableNode): SvelteStoreCode {
    const variableName = variable.name;
    const initialValue = this.generateInitialValue(variable.initializer);
    
    // For reactive variables, use writable stores
    const storeDeclaration = `const ${variableName} = writable(${initialValue});`;
    
    const storeCode: SvelteStoreCode = {
      storeName: 'writable',
      storeDeclaration,
      variableName,
      isWritable: true
    };

    // Store for reference in other transformations
    this.reactiveVariables.set(variableName, storeCode);
    this.stores.push(storeDeclaration);

    // Generate reactive statements for dependency tracking if needed
    if (variable.dependencies.length > 0) {
      this.generateReactiveStatement(variable);
    }

    return storeCode;
  }

  /**
   * Transform dollar function to Svelte function
   */
  transformDollarFunction(func: FunctionDeclarationNode): SvelteFunctionCode {
    const functionName = func.name;
    const parameters = func.parameters.map(p => p.name).join(', ');
    const dependencies = this.extractDependencies(func);
    
    // Generate function declaration
    const functionDeclaration = `function ${functionName}(${parameters}) {
${this.generateFunctionBody(func.body)}
}`;

    const functionCode: SvelteFunctionCode = {
      functionName,
      functionDeclaration,
      dependencies
    };

    this.functions.push(functionDeclaration);
    return functionCode;
  }

  /**
   * Transform template to Svelte markup
   */
  transformTemplate(template: TemplateNode): SvelteMarkupCode {
    let svelteTemplate = template.content;
    const bindings: string[] = [];
    const eventHandlers: string[] = [];

    // Process data bindings
    for (const binding of template.bindings) {
      const svelteBinding = this.transformDataBinding(binding);
      bindings.push(svelteBinding);
      
      // Replace template syntax with Svelte syntax
      if (binding.bindingType === 'variable') {
        // For store variables, use $store syntax
        svelteTemplate = svelteTemplate.replace(
          new RegExp(`\\{\\{\\$${binding.source}\\}\\}`, 'g'),
          `{$${binding.source}}`
        );
      } else if (binding.bindingType === 'event') {
        const svelteEventName = this.convertEventName(binding.target);
        const eventHandler = `${svelteEventName}={${binding.source}}`;
        eventHandlers.push(eventHandler);
        
        // Replace the original event attribute with Svelte event attribute
        const originalPattern = `${binding.target}="$${binding.source}()"`;
        const sveltePattern = `${svelteEventName}={${binding.source}}`;
        svelteTemplate = svelteTemplate.replace(originalPattern, sveltePattern);
        
        // Also handle without quotes
        const originalPatternNoQuotes = `${binding.target}=$${binding.source}()`;
        svelteTemplate = svelteTemplate.replace(originalPatternNoQuotes, sveltePattern);
      }
    }

    return {
      template: svelteTemplate,
      bindings,
      eventHandlers
    };
  }

  /**
   * Generate Svelte reactive statements
   */
  generateReactiveStatements(reactives: ReactiveVariableNode[]): SvelteReactiveCode {
    const reactiveStatements: string[] = [];
    const storeSubscriptions: string[] = [];
    const derivedStores: string[] = [];

    for (const reactive of reactives) {
      const storeCode = this.transformReactiveVariable(reactive);
      
      // Generate reactive statements for dependencies
      if (reactive.dependencies.length > 0) {
        const reactiveStmt = this.generateReactiveStatement(reactive);
        reactiveStatements.push(reactiveStmt);
      }

      // Generate derived stores if needed
      if (reactive.updateTriggers.length > 0) {
        const derivedStore = this.generateDerivedStore(reactive, storeCode);
        derivedStores.push(derivedStore);
      }
    }

    return {
      reactiveStatements: this.reactiveStatements,
      storeSubscriptions: this.storeSubscriptions,
      derivedStores: this.derivedStores
    };
  }

  /**
   * Generate complete Svelte component
   */
  generateSvelteComponent(): string {
    const reactiveCode = this.generateReactiveStatements([]);
    
    return `<script>
  ${Array.from(this.imports).join('\n  ')}
  
  ${this.stores.join('\n  ')}
  
  ${this.functions.join('\n  ')}
  
  ${reactiveCode.reactiveStatements.join('\n  ')}
  
  ${reactiveCode.derivedStores.join('\n  ')}
</script>

<!-- Template will be inserted here -->
<div>
  <!-- Svelte markup -->
</div>`;
  }

  /**
   * Generate complete Svelte code
   */
  private generateSvelteCode(): any {
    return {
      imports: Array.from(this.imports),
      stores: this.stores,
      functions: this.functions,
      reactiveStatements: this.reactiveStatements,
      derivedStores: this.derivedStores,
      component: this.generateSvelteComponent()
    };
  }

  /**
   * Transform variable declaration (reactive or regular)
   */
  private transformVariableDeclaration(node: VariableDeclarationNode): any {
    if (node.isReactive) {
      return this.transformReactiveVariable(node as ReactiveVariableNode);
    }

    // For non-reactive variables, convert to regular let declaration
    const initialValue = this.generateInitialValue(node.initializer);
    const declaration = `let ${node.name} = ${initialValue};`;
    
    return {
      ...node,
      svelteCode: declaration
    };
  }

  /**
   * Transform function declaration
   */
  private transformFunctionDeclaration(node: FunctionDeclarationNode): any {
    return this.transformDollarFunction(node);
  }

  /**
   * Transform data binding to Svelte-compatible format
   */
  private transformDataBinding(binding: DataBindingNode): string {
    switch (binding.bindingType) {
      case 'variable':
        return `{$${binding.source}}`;
      case 'expression':
        return `{${binding.source}}`;
      case 'event':
        return `on:${binding.target}={${binding.source}}`;
      default:
        return binding.source;
    }
  }

  /**
   * Convert MTM event names to Svelte event names
   */
  private convertEventName(eventName: string): string {
    // Svelte uses on: prefix for events
    return `on:${eventName}`;
  }

  /**
   * Generate initial value for Svelte store
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
   * Generate reactive statement for variable dependencies
   */
  private generateReactiveStatement(variable: ReactiveVariableNode): string {
    const dependencies = variable.dependencies.map(dep => `$${dep}`).join(', ');
    const reactiveStmt = `$: ${variable.name}.set(/* computed value based on ${dependencies} */);`;
    
    this.reactiveStatements.push(reactiveStmt);
    return reactiveStmt;
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
   * Generate derived store
   */
  private generateDerivedStore(reactive: ReactiveVariableNode, storeCode: SvelteStoreCode): string {
    const dependencies = reactive.dependencies.map(dep => dep).join(', ');
    const derivedStore = `const derived${this.capitalize(reactive.name)} = derived([${dependencies}], ([$${dependencies}]) => {
  // Derived computation for ${reactive.name}
  return /* computed value */;
});`;
    
    this.derivedStores.push(derivedStore);
    return derivedStore;
  }

  /**
   * Capitalize first letter of string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Reset transformer state
   */
  private reset(): void {
    this.imports.clear();
    this.stores = [];
    this.functions = [];
    this.reactiveStatements = [];
    this.derivedStores = [];
    this.storeSubscriptions = [];
    this.reactiveVariables.clear();
    
    // Re-add default imports
    this.imports.add("import { writable, readable, derived } from 'svelte/store';");
  }
}

/**
 * Factory function to create Svelte transformer
 */
export function createSvelteTransformer(): SvelteTransformer {
  return new SvelteTransformer();
}

/**
 * Transform reactive variable to Svelte store code
 * Example: $counter! = 0 → const counter = writable(0);
 */
export function transformReactiveVariableToStore(variable: ReactiveVariableNode): string {
  const transformer = new SvelteTransformer();
  const storeCode = transformer.transformReactiveVariable(variable);
  return storeCode.storeDeclaration;
}

/**
 * Transform dollar function to Svelte function
 * Example: $increment = () => $counter++ → function increment() { counter.update(n => n + 1); }
 */
export function transformDollarFunctionToSvelteFunction(func: FunctionDeclarationNode): string {
  const transformer = new SvelteTransformer();
  const functionCode = transformer.transformDollarFunction(func);
  return functionCode.functionDeclaration;
}