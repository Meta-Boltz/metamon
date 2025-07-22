/**
 * Ultra-Modern MTM Template Parser
 * Parses template blocks and extracts reactive variables, event bindings, and data bindings
 */

export class TemplateParser {
  constructor() {
    this.variables = new Map();
    this.functions = new Map();
    this.bindings = [];
    this.events = [];
    this.controlFlow = [];
  }

  /**
   * Parse ultra-modern MTM syntax
   * @param {string} code - The MTM file content
   * @returns {ParseResult} Parsed components
   */
  parse(code) {
    const result = {
      variables: new Map(),
      functions: new Map(),
      template: '',
      bindings: [],
      events: [],
      controlFlow: [],
      imports: [],
      exports: [],
      errors: []
    };

    try {
      // Extract imports
      result.imports = this.extractImports(code);

      // Extract exports
      result.exports = this.extractExports(code);

      // Extract reactive variables ($variable! = value)
      result.variables = this.extractVariables(code);

      // Extract functions ($functionName = () => {...})
      result.functions = this.extractFunctions(code);

      // Extract template block
      result.template = this.extractTemplate(code);

      // Parse template for bindings and control flow
      if (result.template) {
        const templateAnalysis = this.analyzeTemplate(result.template);
        result.bindings = templateAnalysis.bindings;
        result.events = templateAnalysis.events;
        result.controlFlow = templateAnalysis.controlFlow;
      }

    } catch (error) {
      result.errors.push({
        type: 'parse_error',
        message: error.message,
        line: this.getErrorLine(code, error),
        suggestion: 'Check syntax for proper MTM format'
      });
    }

    return result;
  }

  /**
   * Extract import statements
   */
  extractImports(code) {
    const imports = [];
    const importRegex = /import\s+(?:(\w+)|{([^}]+)}|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"];?/g;

    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const [fullMatch, defaultImport, namedImports, namespaceImport, source] = match;

      imports.push({
        type: defaultImport ? 'default' : namedImports ? 'named' : 'namespace',
        defaultImport,
        namedImports: namedImports ? namedImports.split(',').map(s => s.trim()) : [],
        namespaceImport,
        source,
        raw: fullMatch
      });
    }

    return imports;
  }

  /**
   * Extract export statements
   */
  extractExports(code) {
    const exports = [];

    // Default export function
    const defaultExportMatch = code.match(/export\s+default\s+function\s+(\w+)\s*\([^)]*\)\s*\{/);
    if (defaultExportMatch) {
      exports.push({
        type: 'default',
        name: defaultExportMatch[1],
        isFunction: true
      });
    }

    // Named exports
    const namedExportRegex = /export\s+(?:const|let|var|function)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(code)) !== null) {
      exports.push({
        type: 'named',
        name: match[1]
      });
    }

    return exports;
  }

  /**
   * Extract reactive and non-reactive variables
   */
  extractVariables(code) {
    const variables = new Map();

    // Reactive variables with type annotations: $variable: type = value
    const typedReactiveRegex = /\$(\w+):\s*(\w+)\s*=\s*([^;\n]+)/g;
    let match;
    while ((match = typedReactiveRegex.exec(code)) !== null) {
      variables.set(match[1], {
        name: match[1],
        value: this.parseValue(match[3].trim()),
        type: match[2],
        reactive: true,
        hasTypeAnnotation: true,
        line: this.getLineNumber(code, match.index)
      });
    }

    // Reactive variables: $variable! = value
    const reactiveRegex = /\$(\w+)!\s*=\s*([^;\n]+)/g;
    while ((match = reactiveRegex.exec(code)) !== null) {
      if (!variables.has(match[1])) {
        variables.set(match[1], {
          name: match[1],
          value: this.parseValue(match[2].trim()),
          type: this.inferType(match[2].trim()),
          reactive: true,
          hasTypeAnnotation: false,
          line: this.getLineNumber(code, match.index)
        });
      }
    }

    // Non-reactive variables: $variable = value
    const nonReactiveRegex = /\$(\w+)\s*=\s*([^;\n]+)/g;
    while ((match = nonReactiveRegex.exec(code)) !== null) {
      if (!variables.has(match[1])) {
        variables.set(match[1], {
          name: match[1],
          value: this.parseValue(match[2].trim()),
          type: this.inferType(match[2].trim()),
          reactive: false,
          computed: this.isComputedExpression(match[2].trim()),
          line: this.getLineNumber(code, match.index)
        });
      }
    }

    return variables;
  }

  /**
   * Extract function declarations
   */
  extractFunctions(code) {
    const functions = new Map();

    // Arrow functions: $functionName = (params) => { body }
    const arrowFunctionRegex = /\$(\w+)\s*=\s*(\([^)]*\)\s*=>\s*\{[^}]*\}|\([^)]*\)\s*=>\s*[^;\n]+|[^;\n]*=>\s*\{[^}]*\}|[^;\n]*=>\s*[^;\n]+)/g;

    let match;
    while ((match = arrowFunctionRegex.exec(code)) !== null) {
      const functionBody = match[2].trim();
      const params = this.extractFunctionParams(functionBody);
      const body = this.extractFunctionBody(functionBody);
      const isAsync = functionBody.includes('async');

      functions.set(match[1], {
        name: match[1],
        params,
        body,
        isAsync,
        isArrow: true,
        raw: functionBody,
        line: this.getLineNumber(code, match.index)
      });
    }

    return functions;
  }

  /**
   * Extract template block
   */
  extractTemplate(code) {
    const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/);
    return templateMatch ? templateMatch[1].trim() : '';
  }

  /**
   * Analyze template for bindings and control flow
   */
  analyzeTemplate(template) {
    const analysis = {
      bindings: [],
      events: [],
      controlFlow: []
    };

    // Data bindings: {$variable} or {expression}
    const bindingRegex = /\{([^}]+)\}/g;
    let match;
    while ((match = bindingRegex.exec(template)) !== null) {
      const expression = match[1].trim();
      analysis.bindings.push({
        type: 'data',
        expression,
        isVariable: expression.startsWith('$'),
        variableName: expression.startsWith('$') ? expression.substring(1) : null,
        raw: match[0],
        position: match.index
      });
    }

    // Event bindings: click={$function}, input={(e) => ...}
    const eventRegex = /(\w+)=\{([^}]+)\}/g;
    while ((match = eventRegex.exec(template)) !== null) {
      const eventType = match[1];
      const handler = match[2].trim();

      // Skip if it's not an event (like class, style, etc.)
      if (this.isEventAttribute(eventType)) {
        analysis.events.push({
          type: eventType,
          handler,
          isFunction: handler.startsWith('$'),
          functionName: handler.startsWith('$') ? handler.substring(1) : null,
          isInline: handler.includes('=>'),
          raw: match[0],
          position: match.index
        });
      }
    }

    // Control flow structures
    analysis.controlFlow = this.extractControlFlow(template);

    return analysis;
  }

  /**
   * Extract control flow structures
   */
  extractControlFlow(template) {
    const controlFlow = [];

    // Conditional rendering: {#if condition} ... {/if}
    const ifRegex = /\{#if\s+([^}]+)\}([\s\S]*?)\{\/if\}/g;
    let match;
    while ((match = ifRegex.exec(template)) !== null) {
      const condition = match[1].trim();
      const content = match[2].trim();

      // Check for else clause
      const elseMatch = content.match(/([\s\S]*?)\{:else\}([\s\S]*)/);

      controlFlow.push({
        type: 'conditional',
        condition,
        ifContent: elseMatch ? elseMatch[1].trim() : content,
        elseContent: elseMatch ? elseMatch[2].trim() : null,
        raw: match[0],
        position: match.index
      });
    }

    // List rendering: {#each items as item} ... {/each}
    const eachRegex = /\{#each\s+([^}]+)\s+as\s+(\w+)(?:\s*,\s*(\w+))?\}([\s\S]*?)\{\/each\}/g;
    while ((match = eachRegex.exec(template)) !== null) {
      controlFlow.push({
        type: 'loop',
        iterable: match[1].trim(),
        itemName: match[2],
        indexName: match[3] || null,
        content: match[4].trim(),
        raw: match[0],
        position: match.index
      });
    }

    // For loops: {#for i=0 to 9} ... {/for}
    const forRegex = /\{#for\s+(\w+)=(\d+)\s+to\s+(\d+)\}([\s\S]*?)\{\/for\}/g;
    while ((match = forRegex.exec(template)) !== null) {
      controlFlow.push({
        type: 'for',
        variable: match[1],
        start: parseInt(match[2]),
        end: parseInt(match[3]),
        content: match[4].trim(),
        raw: match[0],
        position: match.index
      });
    }

    // While loops: {#while condition} ... {/while}
    const whileRegex = /\{#while\s+([^}]+)\}([\s\S]*?)\{\/while\}/g;
    while ((match = whileRegex.exec(template)) !== null) {
      controlFlow.push({
        type: 'while',
        condition: match[1].trim(),
        content: match[2].trim(),
        raw: match[0],
        position: match.index
      });
    }

    return controlFlow;
  }

  /**
   * Parse value and determine its type
   */
  parseValue(valueStr) {
    if (typeof valueStr !== 'string') {
      return {
        type: 'expression',
        value: valueStr
      };
    }

    const trimmed = valueStr.trim();

    // Handle signal() calls
    if (trimmed.startsWith('signal(')) {
      const signalMatch = trimmed.match(/signal\(\s*['"]([^'"]+)['"]\s*,\s*(.+)\s*\)/);
      if (signalMatch) {
        return {
          type: 'signal',
          key: signalMatch[1],
          initialValue: this.parseValue(signalMatch[2])
        };
      }
    }

    // Handle quoted strings
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return {
        type: 'string',
        value: trimmed.slice(1, -1)
      };
    }

    // Handle arrays
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return {
          type: 'array',
          value: JSON.parse(trimmed)
        };
      } catch {
        return {
          type: 'array',
          value: [],
          raw: trimmed
        };
      }
    }

    // Handle objects
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return {
          type: 'object',
          value: JSON.parse(trimmed)
        };
      } catch {
        return {
          type: 'object',
          value: {},
          raw: trimmed
        };
      }
    }

    // Handle booleans
    if (trimmed === 'true' || trimmed === 'false') {
      return {
        type: 'boolean',
        value: trimmed === 'true'
      };
    }

    // Handle numbers
    if (/^-?\d+$/.test(trimmed)) {
      return {
        type: 'number',
        value: parseInt(trimmed, 10)
      };
    }

    if (/^-?\d*\.\d+$/.test(trimmed)) {
      return {
        type: 'number',
        value: parseFloat(trimmed)
      };
    }

    // Handle expressions
    return {
      type: 'expression',
      value: trimmed
    };
  }

  /**
   * Infer type from value string
   */
  inferType(valueStr) {
    const parsed = this.parseValue(valueStr);

    switch (parsed.type) {
      case 'signal':
        return this.inferType(parsed.initialValue.value || parsed.initialValue);
      case 'string':
        return 'string';
      case 'number':
        return Number.isInteger(parsed.value) ? 'number' : 'float';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      case 'object':
        return 'object';
      default:
        return 'any';
    }
  }

  /**
   * Check if expression is computed (references other variables)
   */
  isComputedExpression(valueStr) {
    return valueStr.includes('$') && !valueStr.startsWith('signal(');
  }

  /**
   * Extract function parameters
   */
  extractFunctionParams(functionBody) {
    const paramMatch = functionBody.match(/^\(([^)]*)\)/);
    if (!paramMatch) return [];

    const paramStr = paramMatch[1].trim();
    if (!paramStr) return [];

    return paramStr.split(',').map(param => {
      const trimmed = param.trim();
      const typeMatch = trimmed.match(/(\$?\w+):\s*(\w+)/);

      if (typeMatch) {
        return {
          name: typeMatch[1],
          type: typeMatch[2],
          hasTypeAnnotation: true
        };
      }

      return {
        name: trimmed,
        type: 'any',
        hasTypeAnnotation: false
      };
    });
  }

  /**
   * Extract function body
   */
  extractFunctionBody(functionBody) {
    // Remove parameters
    const withoutParams = functionBody.replace(/^\([^)]*\)\s*=>\s*/, '');

    // Check if it's a block or expression
    if (withoutParams.startsWith('{')) {
      // Block body - remove outer braces
      return withoutParams.slice(1, -1).trim();
    } else {
      // Expression body
      return withoutParams.trim();
    }
  }

  /**
   * Check if attribute is an event
   */
  isEventAttribute(attr) {
    const eventAttributes = [
      'click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout',
      'mousemove', 'mouseenter', 'mouseleave', 'contextmenu',
      'keydown', 'keyup', 'keypress',
      'focus', 'blur', 'change', 'input', 'submit', 'reset',
      'load', 'unload', 'resize', 'scroll',
      'touchstart', 'touchend', 'touchmove', 'touchcancel'
    ];

    return eventAttributes.includes(attr.toLowerCase());
  }

  /**
   * Get line number for error reporting
   */
  getLineNumber(code, index) {
    return code.substring(0, index).split('\n').length;
  }

  /**
   * Get error line from error object
   */
  getErrorLine(code, error) {
    if (error.index !== undefined) {
      return this.getLineNumber(code, error.index);
    }
    return null;
  }
}

export default TemplateParser;