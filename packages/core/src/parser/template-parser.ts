import type { 
  TemplateNode, 
  DataBindingNode, 
  TemplateExpressionNode,
  ExpressionNode,
  SourceLocation
} from '../types/unified-ast.js';

/**
 * Template parsing context
 */
export interface TemplateParseContext {
  content: string;
  position: number;
  line: number;
  column: number;
}

/**
 * Template parser for MTM template syntax
 * Handles {{$variable}} bindings and event handlers like click="$function()"
 */
export class TemplateParser {
  
  /**
   * Parse template content and extract bindings and expressions
   */
  parseTemplate(content: string): TemplateNode {
    const context: TemplateParseContext = {
      content,
      position: 0,
      line: 1,
      column: 1
    };

    const bindings: DataBindingNode[] = [];
    const expressions: TemplateExpressionNode[] = [];

    // Parse the template content
    this.parseTemplateContent(context, bindings, expressions);

    return {
      type: 'Template',
      content,
      bindings,
      expressions,
      location: { line: 1, column: 1, index: 0 }
    };
  }

  /**
   * Parse template content and extract bindings
   */
  private parseTemplateContent(
    context: TemplateParseContext,
    bindings: DataBindingNode[],
    expressions: TemplateExpressionNode[]
  ): void {
    while (context.position < context.content.length) {
      // Look for template bindings {{$variable}}
      const bindingMatch = this.findNextBinding(context);
      if (bindingMatch) {
        const expression = this.parseBindingExpression(bindingMatch.content, bindingMatch.location);
        expressions.push(expression);
        
        const binding = this.createDataBinding(expression, bindingMatch.location);
        bindings.push(binding);
        
        context.position = bindingMatch.endPosition;
        this.updatePosition(context, bindingMatch.content.length + 4); // +4 for {{ and }}
        continue;
      }

      // Look for event handler attributes like click="$function()"
      const eventMatch = this.findNextEventHandler(context);
      if (eventMatch) {
        const binding = this.createEventBinding(
          eventMatch.event,
          eventMatch.handler,
          eventMatch.location
        );
        bindings.push(binding);
        
        context.position = eventMatch.endPosition;
        this.updatePosition(context, eventMatch.matchLength);
        continue;
      }

      // Move to next character if no matches found
      if (context.content[context.position] === '\n') {
        context.line++;
        context.column = 1;
      } else {
        context.column++;
      }
      context.position++;
    }
  }

  /**
   * Find next template binding {{...}}
   */
  private findNextBinding(context: TemplateParseContext): {
    content: string;
    location: SourceLocation;
    endPosition: number;
  } | null {
    const startIndex = context.content.indexOf('{{', context.position);
    if (startIndex === -1) return null;

    const endIndex = context.content.indexOf('}}', startIndex + 2);
    if (endIndex === -1) {
      throw new Error(`Unclosed template binding at line ${context.line}, column ${context.column}`);
    }

    const content = context.content.slice(startIndex + 2, endIndex).trim();
    const location = this.getLocationAtIndex(context, startIndex);

    return {
      content,
      location,
      endPosition: endIndex + 2
    };
  }

  /**
   * Find next event handler attribute
   */
  private findNextEventHandler(context: TemplateParseContext): {
    event: string;
    handler: string;
    location: SourceLocation;
    endPosition: number;
    matchLength: number;
  } | null {
    // Look for event handler patterns like click="$function()" or @click="$function()"
    const eventPattern = /(\w+)\s*=\s*["'](\$\w+\([^)]*\))["']/g;
    eventPattern.lastIndex = context.position;
    
    const match = eventPattern.exec(context.content);
    if (!match) return null;

    const [fullMatch, eventName, handlerExpression] = match;
    const location = this.getLocationAtIndex(context, match.index);

    return {
      event: eventName,
      handler: handlerExpression,
      location,
      endPosition: match.index + fullMatch.length,
      matchLength: fullMatch.length
    };
  }

  /**
   * Parse binding expression content
   */
  private parseBindingExpression(content: string, location: SourceLocation): TemplateExpressionNode {
    // Create a simple expression node for the binding content
    const expression = this.createExpressionFromString(content, location);
    
    return {
      type: 'TemplateExpression',
      expression,
      raw: content,
      location
    };
  }

  /**
   * Create expression node from string content
   */
  private createExpressionFromString(content: string, location: SourceLocation): ExpressionNode {
    const trimmed = content.trim();
    
    // Check if it's a simple variable reference like $variable
    if (/^\$\w+$/.test(trimmed)) {
      return {
        type: 'Identifier',
        name: trimmed,
        location
      };
    }

    // Check if it's a function call like $function()
    const functionCallMatch = trimmed.match(/^(\$\w+)\s*\(([^)]*)\)$/);
    if (functionCallMatch) {
      const [, functionName, argsString] = functionCallMatch;
      const args = this.parseArgumentList(argsString, location);
      
      return {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: functionName,
          location
        },
        arguments: args,
        location
      };
    }

    // For more complex expressions, treat as literal for now
    return {
      type: 'Literal',
      value: trimmed,
      raw: trimmed,
      location
    };
  }

  /**
   * Parse argument list from string
   */
  private parseArgumentList(argsString: string, location: SourceLocation): ExpressionNode[] {
    if (!argsString.trim()) return [];

    // Simple argument parsing - split by comma and create literals
    return argsString.split(',').map((arg, index) => {
      const trimmed = arg.trim();
      return {
        type: 'Literal',
        value: trimmed,
        raw: trimmed,
        location: {
          ...location,
          column: location.column + index * 2 // Rough approximation
        }
      };
    });
  }

  /**
   * Create data binding node for variable/expression binding
   */
  private createDataBinding(expression: TemplateExpressionNode, location: SourceLocation): DataBindingNode {
    const isReactive = this.isReactiveExpression(expression);
    const bindingType = this.determineBindingType(expression);
    
    return {
      type: 'DataBinding',
      bindingType,
      source: expression.raw,
      target: 'dom-element',
      isReactive,
      updateStrategy: isReactive ? 'batched' : 'immediate',
      location
    };
  }

  /**
   * Create event binding node for event handlers
   */
  private createEventBinding(
    eventName: string,
    handlerExpression: string,
    location: SourceLocation
  ): DataBindingNode {
    return {
      type: 'DataBinding',
      bindingType: 'event',
      source: handlerExpression,
      target: eventName,
      isReactive: false,
      updateStrategy: 'immediate',
      location
    };
  }

  /**
   * Determine if expression is reactive (contains reactive variables)
   */
  private isReactiveExpression(expression: TemplateExpressionNode): boolean {
    // Check if the expression contains reactive variable references
    const content = expression.raw;
    
    // For now, we'll assume any $variable reference could be reactive
    return /\$\w+/.test(content);
  }

  /**
   * Determine binding type based on expression content
   */
  private determineBindingType(expression: TemplateExpressionNode): 'variable' | 'expression' | 'event' {
    if (expression.expression.type === 'CallExpression') {
      return 'expression';
    }
    
    if (expression.expression.type === 'Identifier') {
      return 'variable';
    }
    
    return 'expression';
  }

  /**
   * Get source location at specific index
   */
  private getLocationAtIndex(context: TemplateParseContext, index: number): SourceLocation {
    let line = 1;
    let column = 1;
    
    for (let i = 0; i < index && i < context.content.length; i++) {
      if (context.content[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    
    return { line, column, index };
  }

  /**
   * Update position tracking
   */
  private updatePosition(context: TemplateParseContext, length: number): void {
    for (let i = 0; i < length; i++) {
      if (context.position + i < context.content.length) {
        if (context.content[context.position + i] === '\n') {
          context.line++;
          context.column = 1;
        } else {
          context.column++;
        }
      }
    }
  }

  /**
   * Extract all variable references from template
   */
  extractVariableReferences(template: TemplateNode): string[] {
    const variables = new Set<string>();
    
    for (const binding of template.bindings) {
      if (binding.bindingType === 'variable' || binding.bindingType === 'expression') {
        const matches = binding.source.match(/\$\w+/g);
        if (matches) {
          matches.forEach(match => variables.add(match));
        }
      }
    }
    
    return Array.from(variables);
  }

  /**
   * Extract all event handlers from template
   */
  extractEventHandlers(template: TemplateNode): Array<{ event: string; handler: string }> {
    return template.bindings
      .filter(binding => binding.bindingType === 'event')
      .map(binding => ({
        event: binding.target,
        handler: binding.source
      }));
  }

  /**
   * Validate template syntax
   */
  validateTemplate(template: TemplateNode): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for unclosed bindings
    const openBindings = (template.content.match(/\{\{/g) || []).length;
    const closeBindings = (template.content.match(/\}\}/g) || []).length;
    
    if (openBindings !== closeBindings) {
      errors.push(`Mismatched template bindings: ${openBindings} opening, ${closeBindings} closing`);
    }
    
    // Validate variable references
    for (const binding of template.bindings) {
      if (binding.bindingType === 'variable' || binding.bindingType === 'expression') {
        if (!binding.source.includes('$')) {
          errors.push(`Invalid variable reference: ${binding.source}. Variables must start with $`);
        }
      }
    }
    
    // Validate event handlers
    for (const binding of template.bindings) {
      if (binding.bindingType === 'event') {
        if (!binding.source.match(/^\$\w+\([^)]*\)$/)) {
          errors.push(`Invalid event handler: ${binding.source}. Must be in format $function()`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}