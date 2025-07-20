import type { 
  DataBindingNode, 
  ExpressionNode,
  SourceLocation 
} from '../types/unified-ast.js';

/**
 * Event handler parsing utilities
 */
export interface EventHandlerInfo {
  eventName: string;
  handlerFunction: string;
  parameters: string[];
  isInline: boolean;
  location: SourceLocation;
}

/**
 * Supported event types
 */
export const SUPPORTED_EVENTS = [
  'click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'mousemove',
  'keydown', 'keyup', 'keypress',
  'focus', 'blur', 'change', 'input', 'submit', 'reset',
  'load', 'unload', 'resize', 'scroll',
  'touchstart', 'touchend', 'touchmove', 'touchcancel'
] as const;

export type SupportedEvent = typeof SUPPORTED_EVENTS[number];

/**
 * Event handler parser for MTM template syntax
 */
export class EventHandlerParser {
  
  /**
   * Parse event handler attribute and extract handler information
   */
  parseEventHandler(
    eventName: string, 
    handlerExpression: string, 
    location: SourceLocation
  ): EventHandlerInfo {
    // Validate event name
    this.validateEventName(eventName);
    
    // Parse handler expression
    const { functionName, parameters, isInline } = this.parseHandlerExpression(handlerExpression);
    
    return {
      eventName,
      handlerFunction: functionName,
      parameters,
      isInline,
      location
    };
  }

  /**
   * Create data binding node for event handler
   */
  createEventBinding(
    eventInfo: EventHandlerInfo,
    target: string = 'dom-element'
  ): DataBindingNode {
    return {
      type: 'DataBinding',
      bindingType: 'event',
      source: this.reconstructHandlerExpression(eventInfo),
      target: eventInfo.eventName,
      isReactive: false, // Event handlers are not reactive
      updateStrategy: 'immediate',
      location: eventInfo.location
    };
  }

  /**
   * Parse handler expression like "$handleClick()" or "$increment($counter, 1)"
   */
  private parseHandlerExpression(expression: string): {
    functionName: string;
    parameters: string[];
    isInline: boolean;
  } {
    const trimmed = expression.trim();
    
    // Check if it starts with $ and has function call pattern
    if (!trimmed.startsWith('$')) {
      throw new Error(`Invalid event handler expression: ${expression}. Must be in format $function()`);
    }

    // Find the function name (everything up to the first opening parenthesis)
    const openParenIndex = trimmed.indexOf('(');
    if (openParenIndex === -1) {
      throw new Error(`Invalid event handler expression: ${expression}. Must be in format $function()`);
    }

    const functionName = trimmed.slice(0, openParenIndex).trim();
    
    // Validate function name format
    if (!/^\$[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName)) {
      throw new Error(`Invalid function name: ${functionName}`);
    }

    // Find matching closing parenthesis
    const parametersString = this.extractParametersString(trimmed, openParenIndex);
    const parameters = this.parseParameterList(parametersString);
    
    // Determine if this is an inline handler (has parameters or complex logic)
    const isInline = parameters.length > 0 || this.hasComplexLogic(trimmed);

    return {
      functionName,
      parameters,
      isInline
    };
  }

  /**
   * Extract parameters string from function call, handling nested parentheses
   */
  private extractParametersString(expression: string, openParenIndex: number): string {
    let depth = 0;
    let i = openParenIndex;
    
    for (; i < expression.length; i++) {
      if (expression[i] === '(') {
        depth++;
      } else if (expression[i] === ')') {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }
    
    if (depth !== 0) {
      throw new Error(`Unmatched parentheses in expression: ${expression}`);
    }
    
    return expression.slice(openParenIndex + 1, i);
  }

  /**
   * Parse parameter list from string
   */
  private parseParameterList(parametersString: string): string[] {
    if (!parametersString.trim()) {
      return [];
    }

    // Split by comma and clean up each parameter
    return parametersString
      .split(',')
      .map(param => param.trim())
      .filter(param => param.length > 0);
  }

  /**
   * Check if handler expression contains complex logic
   */
  private hasComplexLogic(expression: string): boolean {
    // Look for operators, method chaining, etc.
    return /[+\-*/%&|<>=!]/.test(expression) || /\.\w+/.test(expression);
  }

  /**
   * Validate event name
   */
  private validateEventName(eventName: string): void {
    if (!eventName || typeof eventName !== 'string') {
      throw new Error('Event name must be a non-empty string');
    }

    // Check if it's a supported event (with warning for unsupported)
    if (!SUPPORTED_EVENTS.includes(eventName as SupportedEvent)) {
      console.warn(`Warning: '${eventName}' is not a standard DOM event. Make sure it's supported by your target framework.`);
    }

    // Validate event name format
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(eventName)) {
      throw new Error(`Invalid event name format: ${eventName}. Event names must start with a letter and contain only letters and numbers.`);
    }
  }

  /**
   * Reconstruct handler expression from parsed info
   */
  private reconstructHandlerExpression(eventInfo: EventHandlerInfo): string {
    if (eventInfo.parameters.length === 0) {
      return `${eventInfo.handlerFunction}()`;
    }
    
    return `${eventInfo.handlerFunction}(${eventInfo.parameters.join(', ')})`;
  }

  /**
   * Extract all event handlers from template content
   */
  extractEventHandlers(content: string): EventHandlerInfo[] {
    const handlers: EventHandlerInfo[] = [];
    
    // Pattern to match event handler attributes
    const eventPattern = /(\w+)\s*=\s*["'](\$\w+\([^)]*\))["']/g;
    let match;
    
    while ((match = eventPattern.exec(content)) !== null) {
      const [fullMatch, eventName, handlerExpression] = match;
      const location = this.getLocationFromIndex(content, match.index);
      
      try {
        const eventInfo = this.parseEventHandler(eventName, handlerExpression, location);
        handlers.push(eventInfo);
      } catch (error) {
        console.warn(`Failed to parse event handler: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return handlers;
  }

  /**
   * Validate event handler syntax
   */
  validateEventHandler(eventInfo: EventHandlerInfo): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate function name format
    if (!eventInfo.handlerFunction.startsWith('$')) {
      errors.push(`Handler function must start with $: ${eventInfo.handlerFunction}`);
    }
    
    if (!/^\$[a-zA-Z_][a-zA-Z0-9_]*$/.test(eventInfo.handlerFunction)) {
      errors.push(`Invalid handler function name: ${eventInfo.handlerFunction}`);
    }
    
    // Validate parameters
    for (const param of eventInfo.parameters) {
      if (param.includes('$') && !/^\$[a-zA-Z_][a-zA-Z0-9_]*$/.test(param.trim())) {
        errors.push(`Invalid parameter format: ${param}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate framework-specific event handler code
   */
  generateFrameworkEventHandler(
    eventInfo: EventHandlerInfo, 
    framework: 'react' | 'vue' | 'svelte'
  ): string {
    switch (framework) {
      case 'react':
        return this.generateReactEventHandler(eventInfo);
      case 'vue':
        return this.generateVueEventHandler(eventInfo);
      case 'svelte':
        return this.generateSvelteEventHandler(eventInfo);
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  /**
   * Generate React event handler
   */
  private generateReactEventHandler(eventInfo: EventHandlerInfo): string {
    const eventName = `on${eventInfo.eventName.charAt(0).toUpperCase()}${eventInfo.eventName.slice(1)}`;
    const handlerName = eventInfo.handlerFunction.slice(1); // Remove $ prefix
    
    if (eventInfo.parameters.length === 0) {
      return `${eventName}={${handlerName}}`;
    }
    
    const params = eventInfo.parameters.map(p => p.startsWith('$') ? p.slice(1) : p).join(', ');
    return `${eventName}={() => ${handlerName}(${params})}`;
  }

  /**
   * Generate Vue event handler
   */
  private generateVueEventHandler(eventInfo: EventHandlerInfo): string {
    const handlerName = eventInfo.handlerFunction.slice(1); // Remove $ prefix
    
    if (eventInfo.parameters.length === 0) {
      return `@${eventInfo.eventName}="${handlerName}"`;
    }
    
    const params = eventInfo.parameters.map(p => p.startsWith('$') ? p.slice(1) : p).join(', ');
    return `@${eventInfo.eventName}="${handlerName}(${params})"`;
  }

  /**
   * Generate Svelte event handler
   */
  private generateSvelteEventHandler(eventInfo: EventHandlerInfo): string {
    const handlerName = eventInfo.handlerFunction.slice(1); // Remove $ prefix
    
    if (eventInfo.parameters.length === 0) {
      return `on:${eventInfo.eventName}={${handlerName}}`;
    }
    
    const params = eventInfo.parameters.map(p => p.startsWith('$') ? p.slice(1) : p).join(', ');
    return `on:${eventInfo.eventName}={() => ${handlerName}(${params})}`;
  }

  /**
   * Get source location from string index
   */
  private getLocationFromIndex(content: string, index: number): SourceLocation {
    let line = 1;
    let column = 1;
    
    for (let i = 0; i < index && i < content.length; i++) {
      if (content[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }
    
    return { line, column, index };
  }

  /**
   * Check if content contains event handlers
   */
  hasEventHandlers(content: string): boolean {
    return /\w+\s*=\s*["']?\$\w+\([^)]*\)["']?/.test(content);
  }

  /**
   * Get supported events list
   */
  getSupportedEvents(): readonly SupportedEvent[] {
    return SUPPORTED_EVENTS;
  }
}