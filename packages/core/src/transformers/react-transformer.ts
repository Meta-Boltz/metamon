/**
 * React-specific transformer for modern MTM syntax
 * Converts reactive variables, functions, and templates to React code
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
 * React hook code representation
 */
export interface ReactHookCode {
  hookName: string;
  hookCall: string;
  stateName: string;
  setterName: string;
}

/**
 * React component code representation
 */
export interface ReactComponentCode {
  functionName: string;
  functionDeclaration: string;
  dependencies: string[];
}

/**
 * JSX code representation
 */
export interface JSXCode {
  template: string;
  bindings: string[];
  eventHandlers: string[];
}

/**
 * React state management code
 */
export interface ReactStateCode {
  stateDeclarations: string[];
  stateUpdaters: string[];
  effectHooks: string[];
}

/**
 * React transformer that converts modern MTM syntax to React code
 */
export class ReactTransformer implements ASTTransformer {
  private imports = new Set<string>();
  private hooks: string[] = [];
  private functions: string[] = [];
  private effects: string[] = [];
  private reactiveVariables = new Map<string, ReactHookCode>();

  constructor() {
    // Always include React hooks
    this.imports.add("import { useState, useCallback, useEffect } from 'react';");
  }

  /**
   * Transform unified AST to React-compatible AST
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
        framework: 'react',
        generatedCode: this.generateReactCode()
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
   * Transform reactive variable to React useState hook
   */
  transformReactiveVariable(variable: ReactiveVariableNode): ReactHookCode {
    const stateName = variable.name;
    const setterName = `set${this.capitalize(stateName)}`;
    const initialValue = this.generateInitialValue(variable.initializer);
    
    const hookCall = `const [${stateName}, ${setterName}] = useState(${initialValue});`;
    
    const hookCode: ReactHookCode = {
      hookName: 'useState',
      hookCall,
      stateName,
      setterName
    };

    // Store for reference in other transformations
    this.reactiveVariables.set(stateName, hookCode);
    this.hooks.push(hookCall);

    // Generate effect hook for dependency tracking if needed
    if (variable.dependencies.length > 0) {
      this.generateDependencyEffect(variable);
    }

    return hookCode;
  }

  /**
   * Transform dollar function to React component function
   */
  transformDollarFunction(func: FunctionDeclarationNode): ReactComponentCode {
    const functionName = func.name;
    const parameters = func.parameters.map(p => p.name).join(', ');
    const dependencies = this.extractDependencies(func);
    
    // Generate useCallback hook for function
    const functionDeclaration = `const ${functionName} = useCallback((${parameters}) => {
${this.generateFunctionBody(func.body)}
}, [${dependencies.join(', ')}]);`;

    const componentCode: ReactComponentCode = {
      functionName,
      functionDeclaration,
      dependencies
    };

    this.functions.push(functionDeclaration);
    return componentCode;
  }

  /**
   * Transform template to JSX
   */
  transformTemplate(template: TemplateNode): JSXCode {
    let jsxTemplate = template.content;
    const bindings: string[] = [];
    const eventHandlers: string[] = [];

    // Process data bindings
    for (const binding of template.bindings) {
      const jsxBinding = this.transformDataBinding(binding);
      bindings.push(jsxBinding);
      
      // Replace template syntax with JSX syntax
      if (binding.bindingType === 'variable') {
        jsxTemplate = jsxTemplate.replace(
          new RegExp(`\\{\\{\\$${binding.source}\\}\\}`, 'g'),
          `{${binding.source}}`
        );
      } else if (binding.bindingType === 'event') {
        const reactEventName = this.convertEventName(binding.target);
        const eventHandler = `${reactEventName}={${binding.source}}`;
        eventHandlers.push(eventHandler);
        
        // Replace the original event attribute with React event attribute
        const originalPattern = `${binding.target}="$${binding.source}()"`;
        const reactPattern = `${reactEventName}={${binding.source}}`;
        jsxTemplate = jsxTemplate.replace(originalPattern, reactPattern);
        
        // Also handle without quotes
        const originalPatternNoQuotes = `${binding.target}=$${binding.source}()`;
        jsxTemplate = jsxTemplate.replace(originalPatternNoQuotes, reactPattern);
      }
    }

    return {
      template: jsxTemplate,
      bindings,
      eventHandlers
    };
  }

  /**
   * Generate state management code for reactive variables
   */
  generateStateManagement(reactives: ReactiveVariableNode[]): ReactStateCode {
    const stateDeclarations: string[] = [];
    const stateUpdaters: string[] = [];
    const effectHooks: string[] = [];

    for (const reactive of reactives) {
      const hookCode = this.transformReactiveVariable(reactive);
      stateDeclarations.push(hookCode.hookCall);

      // Generate updater functions if needed
      if (reactive.updateTriggers.length > 0) {
        const updater = this.generateStateUpdater(reactive, hookCode);
        stateUpdaters.push(updater);
      }

      // Generate effect hooks for dependencies
      if (reactive.dependencies.length > 0) {
        const effect = this.generateReactiveEffect(reactive, hookCode);
        effectHooks.push(effect);
      }
    }

    return {
      stateDeclarations,
      stateUpdaters,
      effectHooks
    };
  }

  /**
   * Generate complete React code
   */
  private generateReactCode(): any {
    return {
      imports: Array.from(this.imports),
      hooks: this.hooks,
      functions: this.functions,
      jsx: '', // Will be populated by template transformation
      exports: []
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
      reactCode: declaration
    };
  }

  /**
   * Transform function declaration
   */
  private transformFunctionDeclaration(node: FunctionDeclarationNode): any {
    return this.transformDollarFunction(node);
  }

  /**
   * Transform data binding to JSX-compatible format
   */
  private transformDataBinding(binding: DataBindingNode): string {
    switch (binding.bindingType) {
      case 'variable':
        return `{${binding.source}}`;
      case 'expression':
        return `{${binding.source}}`;
      case 'event':
        return `{${binding.source}}`;
      default:
        return binding.source;
    }
  }

  /**
   * Convert MTM event names to React event names
   */
  private convertEventName(eventName: string): string {
    const eventMap: Record<string, string> = {
      'click': 'onClick',
      'change': 'onChange',
      'input': 'onInput',
      'submit': 'onSubmit',
      'focus': 'onFocus',
      'blur': 'onBlur',
      'keydown': 'onKeyDown',
      'keyup': 'onKeyUp',
      'mouseenter': 'onMouseEnter',
      'mouseleave': 'onMouseLeave'
    };

    return eventMap[eventName] || `on${this.capitalize(eventName)}`;
  }

  /**
   * Generate initial value for React state
   */
  private generateInitialValue(initializer: ExpressionNode): string {
    switch (initializer.type) {
      case 'Literal':
        const literal = initializer as any;
        if (typeof literal.value === 'string') {
          return `"${literal.value}"`;
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
   * Generate dependency effect for reactive variable
   */
  private generateDependencyEffect(variable: ReactiveVariableNode): void {
    const dependencies = variable.dependencies.join(', ');
    const effect = `useEffect(() => {
  // Update ${variable.name} when dependencies change
  // This would contain the reactive update logic
}, [${dependencies}]);`;

    this.effects.push(effect);
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
   * Generate state updater function
   */
  private generateStateUpdater(reactive: ReactiveVariableNode, hookCode: ReactHookCode): string {
    return `const update${this.capitalize(reactive.name)} = useCallback((newValue) => {
  ${hookCode.setterName}(newValue);
}, []);`;
  }

  /**
   * Generate reactive effect hook
   */
  private generateReactiveEffect(reactive: ReactiveVariableNode, hookCode: ReactHookCode): string {
    const dependencies = reactive.dependencies.join(', ');
    return `useEffect(() => {
  // Reactive effect for ${reactive.name}
  // Update triggers: ${reactive.updateTriggers.join(', ')}
}, [${dependencies}]);`;
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
    this.hooks = [];
    this.functions = [];
    this.effects = [];
    this.reactiveVariables.clear();
    
    // Re-add default imports
    this.imports.add("import { useState, useCallback, useEffect } from 'react';");
  }
}

/**
 * Factory function to create React transformer
 */
export function createReactTransformer(): ReactTransformer {
  return new ReactTransformer();
}