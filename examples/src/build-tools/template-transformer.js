/**
 * Ultra-Modern MTM Template Transformer
 * Transforms ultra-modern MTM syntax to framework-specific code
 */

import TemplateParser from './template-parser.js';

export class TemplateTransformer {
  constructor() {
    this.parser = new TemplateParser();
  }

  /**
   * Transform MTM code to target framework
   * @param {string} code - MTM source code
   * @param {string} framework - Target framework (react, vue, svelte, vanilla)
   * @param {Object} options - Transformation options
   * @returns {TransformResult}
   */
  transform(code, framework = 'react', options = {}) {
    const defaultOptions = {
      generateSourceMap: false,
      preserveComments: false,
      optimizeOutput: true,
      includeTypeAnnotations: true
    };

    const opts = { ...defaultOptions, ...options };

    try {
      // Parse the MTM code
      const parsed = this.parser.parse(code);

      if (parsed.errors.length > 0) {
        return {
          code: this.generateErrorComponent(parsed.errors, framework),
          map: null,
          errors: parsed.errors,
          warnings: []
        };
      }

      // Transform based on target framework
      let transformedCode;
      switch (framework.toLowerCase()) {
        case 'react':
          transformedCode = this.transformToReact(parsed, opts);
          break;
        case 'vue':
          transformedCode = this.transformToVue(parsed, opts);
          break;
        case 'svelte':
          transformedCode = this.transformToSvelte(parsed, opts);
          break;
        case 'vanilla':
        case 'javascript':
        case 'js':
          transformedCode = this.transformToVanilla(parsed, opts);
          break;
        default:
          throw new Error(`Unsupported framework: ${framework}`);
      }

      return {
        code: transformedCode,
        map: opts.generateSourceMap ? this.generateSourceMap(code, transformedCode) : null,
        errors: [],
        warnings: [],
        parsed
      };

    } catch (error) {
      return {
        code: this.generateErrorComponent([{
          type: 'transform_error',
          message: error.message,
          suggestion: 'Check MTM syntax and framework compatibility'
        }], framework),
        map: null,
        errors: [error],
        warnings: []
      };
    }
  }

  /**
   * Transform to React
   */
  transformToReact(parsed, options) {
    let code = '';

    // Imports
    code += "import React, { useState, useCallback, useEffect, useMemo } from 'react';\n";
    code += "import { signal } from '../shared/ultra-modern-signal.js';\n";

    // Add custom imports
    parsed.imports.forEach(imp => {
      if (imp.source !== 'react' && !imp.source.includes('signal')) {
        code += `${imp.raw}\n`;
      }
    });

    code += '\n';

    // Component function
    const componentName = this.getComponentName(parsed);
    code += `export default function ${componentName}(props = {}) {\n`;

    // State variables
    const stateCode = this.generateReactState(parsed.variables);
    code += stateCode;

    // Functions
    const functionsCode = this.generateReactFunctions(parsed.functions, parsed.variables);
    code += functionsCode;

    // Template
    const templateCode = this.generateReactTemplate(parsed.template, parsed.bindings, parsed.events, parsed.controlFlow, parsed.variables, parsed.functions);
    code += `\n  return (\n${templateCode}\n  );\n`;

    code += '}\n';

    return code;
  }

  /**
   * Transform to Vue
   */
  transformToVue(parsed, options) {
    let template = '';
    let script = '';

    // Template section
    if (parsed.template) {
      const vueTemplate = this.generateVueTemplate(parsed.template, parsed.bindings, parsed.events, parsed.controlFlow);
      template = `<template>\n${vueTemplate}\n</template>\n\n`;
    }

    // Script section
    script += '<script setup>\n';
    script += "import { ref, computed, watch } from 'vue';\n";
    script += "import { signal } from '../shared/ultra-modern-signal.js';\n";

    // Add custom imports
    parsed.imports.forEach(imp => {
      if (!imp.source.includes('vue') && !imp.source.includes('signal')) {
        script += `${imp.raw}\n`;
      }
    });

    script += '\n';

    // State variables
    script += this.generateVueState(parsed.variables);

    // Functions
    script += this.generateVueFunctions(parsed.functions, parsed.variables);

    script += '</script>\n';

    return template + script;
  }

  /**
   * Transform to Svelte
   */
  transformToSvelte(parsed, options) {
    let script = '';
    let template = '';

    // Script section
    script += '<script>\n';
    script += "import { signal } from '../shared/ultra-modern-signal.js';\n";

    // Add custom imports
    parsed.imports.forEach(imp => {
      if (!imp.source.includes('signal')) {
        script += `${imp.raw}\n`;
      }
    });

    script += '\n';

    // State variables
    script += this.generateSvelteState(parsed.variables);

    // Functions
    script += this.generateSvelteFunctions(parsed.functions, parsed.variables);

    script += '</script>\n\n';

    // Template
    if (parsed.template) {
      template = this.generateSvelteTemplate(parsed.template, parsed.bindings, parsed.events, parsed.controlFlow);
    }

    return script + template;
  }

  /**
   * Transform to Vanilla JavaScript
   */
  transformToVanilla(parsed, options) {
    let code = '';

    // Imports
    code += "import { signal } from '../shared/ultra-modern-signal.js';\n";

    // Add custom imports
    parsed.imports.forEach(imp => {
      if (!imp.source.includes('signal')) {
        code += `${imp.raw}\n`;
      }
    });

    code += '\n';

    // Component function
    const componentName = this.getComponentName(parsed);
    code += `export default function ${componentName}() {\n`;

    // State variables
    code += this.generateVanillaState(parsed.variables);

    // Functions
    code += this.generateVanillaFunctions(parsed.functions, parsed.variables);

    // DOM creation
    code += this.generateVanillaDOM(parsed.template, parsed.bindings, parsed.events, parsed.controlFlow, parsed.variables, parsed.functions);

    code += '}\n';

    return code;
  }

  /**
   * Generate React state declarations
   */
  generateReactState(variables) {
    let code = '';

    variables.forEach((variable, name) => {
      if (variable.reactive) {
        if (variable.value?.type === 'signal') {
          code += `  const [${name}, set${this.capitalize(name)}] = signal.use('${variable.value.key}', ${this.valueToString(variable.value.initialValue)});\n`;
        } else {
          code += `  const [${name}, set${this.capitalize(name)}] = useState(${this.valueToString(variable.value)});\n`;
        }
      } else if (variable.computed) {
        code += `  const ${name} = useMemo(() => ${this.transformExpression(variable.value.value || variable.value, variables)}, [${this.getDependencies(variable.value.value || variable.value, variables).join(', ')}]);\n`;
      } else {
        code += `  const ${name} = ${this.valueToString(variable.value)};\n`;
      }
    });

    return code;
  }

  /**
   * Generate React functions
   */
  generateReactFunctions(functions, variables) {
    let code = '';

    functions.forEach((func, name) => {
      const transformedBody = this.transformFunctionBody(func.body, variables, 'react');
      const deps = this.getFunctionDependencies(func.body, variables, functions);

      if (func.isAsync) {
        code += `  const ${name} = useCallback(async (${this.paramsToString(func.params)}) => {\n    ${transformedBody}\n  }, [${deps.join(', ')}]);\n`;
      } else {
        code += `  const ${name} = useCallback((${this.paramsToString(func.params)}) => {\n    ${transformedBody}\n  }, [${deps.join(', ')}]);\n`;
      }
    });

    return code;
  }

  /**
   * Generate React template
   */
  generateReactTemplate(template, bindings, events, controlFlow, variables, functions) {
    if (!template) return '    <div>No content</div>';

    let transformed = template;

    // Transform control flow
    controlFlow.forEach(control => {
      transformed = this.transformReactControlFlow(transformed, control, variables);
    });

    // Transform data bindings
    bindings.forEach(binding => {
      if (binding.type === 'data') {
        const reactExpression = this.transformReactExpression(binding.expression, variables);
        transformed = transformed.replace(binding.raw, `{${reactExpression}}`);
      }
    });

    // Transform event bindings
    events.forEach(event => {
      const reactEvent = this.transformReactEvent(event, functions);
      transformed = transformed.replace(event.raw, reactEvent);
    });

    // Transform attributes
    transformed = this.transformReactAttributes(transformed);

    // Indent properly
    return this.indentCode(transformed, 4);
  }

  /**
   * Generate Vue state declarations
   */
  generateVueState(variables) {
    let code = '';

    variables.forEach((variable, name) => {
      if (variable.reactive) {
        if (variable.value?.type === 'signal') {
          code += `const [${name}, set${this.capitalize(name)}] = signal.use('${variable.value.key}', ${this.valueToString(variable.value.initialValue)});\n`;
        } else {
          code += `const ${name} = ref(${this.valueToString(variable.value)});\n`;
        }
      } else if (variable.computed) {
        code += `const ${name} = computed(() => ${this.transformExpression(variable.value.value || variable.value, variables, 'vue')});\n`;
      } else {
        code += `const ${name} = ${this.valueToString(variable.value)};\n`;
      }
    });

    return code;
  }

  /**
   * Generate Vue functions
   */
  generateVueFunctions(functions, variables) {
    let code = '';

    functions.forEach((func, name) => {
      const transformedBody = this.transformFunctionBody(func.body, variables, 'vue');

      if (func.isAsync) {
        code += `const ${name} = async (${this.paramsToString(func.params)}) => {\n  ${transformedBody}\n};\n`;
      } else {
        code += `const ${name} = (${this.paramsToString(func.params)}) => {\n  ${transformedBody}\n};\n`;
      }
    });

    return code;
  }

  /**
   * Generate Vue template
   */
  generateVueTemplate(template, bindings, events, controlFlow) {
    let transformed = template;

    // Transform control flow
    controlFlow.forEach(control => {
      transformed = this.transformVueControlFlow(transformed, control);
    });

    // Transform data bindings
    bindings.forEach(binding => {
      if (binding.type === 'data') {
        const vueExpression = this.transformVueExpression(binding.expression);
        transformed = transformed.replace(binding.raw, `{{ ${vueExpression} }}`);
      }
    });

    // Transform event bindings
    events.forEach(event => {
      const vueEvent = this.transformVueEvent(event);
      transformed = transformed.replace(event.raw, vueEvent);
    });

    return this.indentCode(transformed, 2);
  }

  /**
   * Transform function body for different frameworks
   */
  transformFunctionBody(body, variables, framework) {
    let transformed = body;

    // Transform variable references and updates
    variables.forEach((variable, name) => {
      if (variable.reactive) {
        switch (framework) {
          case 'react':
            // Transform $variable++ to setter calls
            transformed = transformed.replace(new RegExp(`\\$${name}\\+\\+`, 'g'), `set${this.capitalize(name)}(prev => prev + 1)`);
            transformed = transformed.replace(new RegExp(`\\$${name}--`, 'g'), `set${this.capitalize(name)}(prev => prev - 1)`);
            transformed = transformed.replace(new RegExp(`\\$${name}\\s*=\\s*([^;\\n]+)`, 'g'), `set${this.capitalize(name)}($1)`);
            transformed = transformed.replace(new RegExp(`\\$${name}(?!\\w)`, 'g'), name);
            break;
          case 'vue':
            if (variable.value?.type === 'signal') {
              transformed = transformed.replace(new RegExp(`\\$${name}(?!\\w)`, 'g'), name);
            } else {
              transformed = transformed.replace(new RegExp(`\\$${name}\\+\\+`, 'g'), `${name}.value++`);
              transformed = transformed.replace(new RegExp(`\\$${name}--`, 'g'), `${name}.value--`);
              transformed = transformed.replace(new RegExp(`\\$${name}\\s*=\\s*`, 'g'), `${name}.value = `);
              transformed = transformed.replace(new RegExp(`\\$${name}(?!\\w)`, 'g'), `${name}.value`);
            }
            break;
          case 'svelte':
            transformed = transformed.replace(new RegExp(`\\$${name}(?!\\w)`, 'g'), name);
            break;
          case 'vanilla':
            transformed = transformed.replace(new RegExp(`\\$${name}(?!\\w)`, 'g'), name);
            break;
        }
      } else {
        transformed = transformed.replace(new RegExp(`\\$${name}(?!\\w)`, 'g'), name);
      }
    });

    return transformed;
  }

  /**
   * Transform React control flow
   */
  transformReactControlFlow(template, control, variables) {
    switch (control.type) {
      case 'conditional':
        const condition = this.transformReactExpression(control.condition, variables);
        let replacement = `{${condition} && (\n${control.ifContent}\n)}`;

        if (control.elseContent) {
          replacement = `{${condition} ? (\n${control.ifContent}\n) : (\n${control.elseContent}\n)}`;
        }

        return template.replace(control.raw, replacement);

      case 'loop':
        const iterable = this.transformReactExpression(control.iterable, variables);
        const mapFunction = control.indexName
          ? `${iterable}.map((${control.itemName}, ${control.indexName}) => (\n${control.content}\n))`
          : `${iterable}.map(${control.itemName} => (\n${control.content}\n))`;

        return template.replace(control.raw, `{${mapFunction}}`);

      case 'for':
        const range = `Array.from({length: ${control.end - control.start + 1}}, (_, i) => i + ${control.start})`;
        return template.replace(control.raw, `{${range}.map(${control.variable} => (\n${control.content}\n))}`);

      case 'while':
        // While loops are complex in React, convert to conditional with warning
        console.warn('While loops are not directly supported in React templates, converting to conditional');
        const whileCondition = this.transformReactExpression(control.condition, variables);
        return template.replace(control.raw, `{${whileCondition} && (\n${control.content}\n)}`);

      default:
        return template;
    }
  }

  /**
   * Transform React expressions
   */
  transformReactExpression(expression, variables) {
    let transformed = expression;

    // Transform $variable references
    variables.forEach((variable, name) => {
      transformed = transformed.replace(new RegExp(`\\$${name}(?!\\w)`, 'g'), name);
    });

    return transformed;
  }

  /**
   * Transform React events
   */
  transformReactEvent(event, functions) {
    const reactEventName = `on${this.capitalize(event.type)}`;

    if (event.isFunction && functions.has(event.functionName)) {
      return `${reactEventName}={${event.functionName}}`;
    } else if (event.isInline) {
      return `${reactEventName}={${event.handler}}`;
    } else {
      return `${reactEventName}={${event.handler}}`;
    }
  }

  /**
   * Transform React attributes
   */
  transformReactAttributes(template) {
    return template
      .replace(/class=/g, 'className=')
      .replace(/for=/g, 'htmlFor=');
  }

  /**
   * Helper methods
   */
  getComponentName(parsed) {
    const defaultExport = parsed.exports.find(exp => exp.type === 'default');
    return defaultExport ? defaultExport.name : 'Component';
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  valueToString(value) {
    if (typeof value === 'object' && value !== null) {
      if (value.type === 'string') return `"${value.value}"`;
      if (value.type === 'number') return value.value.toString();
      if (value.type === 'boolean') return value.value.toString();
      if (value.type === 'array') return JSON.stringify(value.value);
      if (value.type === 'object') return JSON.stringify(value.value);
      if (value.type === 'expression') return value.value;
      return JSON.stringify(value);
    }
    return JSON.stringify(value);
  }

  paramsToString(params) {
    return params.map(param => param.name).join(', ');
  }

  transformExpression(expression, variables, framework = 'react') {
    let transformed = expression;

    variables.forEach((variable, name) => {
      if (framework === 'vue' && variable.reactive && variable.value?.type !== 'signal') {
        transformed = transformed.replace(new RegExp(`\\$${name}(?!\\w)`, 'g'), `${name}.value`);
      } else {
        transformed = transformed.replace(new RegExp(`\\$${name}(?!\\w)`, 'g'), name);
      }
    });

    return transformed;
  }

  getDependencies(expression, variables) {
    const deps = [];
    variables.forEach((variable, name) => {
      if (expression.includes(`$${name}`)) {
        deps.push(name);
      }
    });
    return deps;
  }

  getFunctionDependencies(body, variables, functions) {
    const deps = [];

    variables.forEach((variable, name) => {
      if (body.includes(`$${name}`)) {
        deps.push(name);
      }
    });

    functions.forEach((func, name) => {
      if (body.includes(`$${name}`) && name !== body) {
        deps.push(name);
      }
    });

    return deps;
  }

  indentCode(code, spaces) {
    const indent = ' '.repeat(spaces);
    return code.split('\n').map(line => line.trim() ? indent + line : line).join('\n');
  }

  generateErrorComponent(errors, framework) {
    const errorMessage = errors.map(e => e.message).join('; ');

    switch (framework) {
      case 'react':
        return `
import React from 'react';
export default function ErrorComponent() {
  return React.createElement('div', { 
    style: { color: 'red', padding: '20px', border: '2px solid red', borderRadius: '8px' } 
  }, 'MTM Transform Error: ${errorMessage}');
}`;
      case 'vue':
        return `
<template>
  <div style="color: red; padding: 20px; border: 2px solid red; border-radius: 8px;">
    MTM Transform Error: ${errorMessage}
  </div>
</template>`;
      case 'svelte':
        return `<div style="color: red; padding: 20px; border: 2px solid red; border-radius: 8px;">MTM Transform Error: ${errorMessage}</div>`;
      default:
        return `
export default function ErrorComponent() {
  const element = document.createElement('div');
  element.style.cssText = 'color: red; padding: 20px; border: 2px solid red; border-radius: 8px;';
  element.textContent = 'MTM Transform Error: ${errorMessage}';
  return element;
}`;
    }
  }

  generateSourceMap(original, transformed) {
    // Basic source map - in production would use proper source map library
    return {
      version: 3,
      sources: ['input.mtm'],
      sourcesContent: [original],
      mappings: 'AAAA',
      names: []
    };
  }

  // Additional Vue-specific methods
  transformVueControlFlow(template, control) {
    switch (control.type) {
      case 'conditional':
        let replacement = `<template v-if="${control.condition}">\n${control.ifContent}\n</template>`;
        if (control.elseContent) {
          replacement += `\n<template v-else>\n${control.elseContent}\n</template>`;
        }
        return template.replace(control.raw, replacement);

      case 'loop':
        const vFor = control.indexName
          ? `v-for="(${control.itemName}, ${control.indexName}) in ${control.iterable}"`
          : `v-for="${control.itemName} in ${control.iterable}"`;
        return template.replace(control.raw, `<template ${vFor}>\n${control.content}\n</template>`);

      default:
        return template;
    }
  }

  transformVueExpression(expression) {
    return expression.replace(/^\$/, '');
  }

  transformVueEvent(event) {
    return `@${event.type}="${event.handler.replace(/^\$/, '')}"`;
  }

  // Additional Svelte-specific methods
  generateSvelteState(variables) {
    let code = '';

    variables.forEach((variable, name) => {
      if (variable.reactive) {
        if (variable.value?.type === 'signal') {
          code += `  const [${name}, set${this.capitalize(name)}] = signal.use('${variable.value.key}', ${this.valueToString(variable.value.initialValue)});\n`;
        } else {
          code += `  let ${name} = ${this.valueToString(variable.value)};\n`;
        }
      } else {
        code += `  const ${name} = ${this.valueToString(variable.value)};\n`;
      }
    });

    return code;
  }

  generateSvelteFunctions(functions, variables) {
    let code = '';

    functions.forEach((func, name) => {
      const transformedBody = this.transformFunctionBody(func.body, variables, 'svelte');

      if (func.isAsync) {
        code += `  async function ${name}(${this.paramsToString(func.params)}) {\n    ${transformedBody}\n  }\n`;
      } else {
        code += `  function ${name}(${this.paramsToString(func.params)}) {\n    ${transformedBody}\n  }\n`;
      }
    });

    return code;
  }

  generateSvelteTemplate(template, bindings, events, controlFlow) {
    let transformed = template;

    // Transform control flow
    controlFlow.forEach(control => {
      transformed = this.transformSvelteControlFlow(transformed, control);
    });

    // Transform data bindings
    bindings.forEach(binding => {
      if (binding.type === 'data') {
        const svelteExpression = binding.expression.replace(/^\$/, '');
        transformed = transformed.replace(binding.raw, `{${svelteExpression}}`);
      }
    });

    // Transform event bindings
    events.forEach(event => {
      const svelteEvent = `on:${event.type}={${event.handler.replace(/^\$/, '')}}`;
      transformed = transformed.replace(event.raw, svelteEvent);
    });

    return transformed;
  }

  transformSvelteControlFlow(template, control) {
    switch (control.type) {
      case 'conditional':
        let replacement = `{#if ${control.condition}}\n${control.ifContent}\n{/if}`;
        if (control.elseContent) {
          replacement = `{#if ${control.condition}}\n${control.ifContent}\n{:else}\n${control.elseContent}\n{/if}`;
        }
        return template.replace(control.raw, replacement);

      case 'loop':
        const each = control.indexName
          ? `{#each ${control.iterable} as ${control.itemName}, ${control.indexName}}`
          : `{#each ${control.iterable} as ${control.itemName}}`;
        return template.replace(control.raw, `${each}\n${control.content}\n{/each}`);

      default:
        return template;
    }
  }

  // Vanilla JavaScript methods
  generateVanillaState(variables) {
    let code = '';

    variables.forEach((variable, name) => {
      if (variable.reactive) {
        if (variable.value?.type === 'signal') {
          code += `  const [${name}, set${this.capitalize(name)}] = signal.use('${variable.value.key}', ${this.valueToString(variable.value.initialValue)});\n`;
        } else {
          code += `  let ${name} = ${this.valueToString(variable.value)};\n`;
        }
      } else {
        code += `  const ${name} = ${this.valueToString(variable.value)};\n`;
      }
    });

    return code;
  }

  generateVanillaFunctions(functions, variables) {
    let code = '';

    functions.forEach((func, name) => {
      const transformedBody = this.transformFunctionBody(func.body, variables, 'vanilla');

      if (func.isAsync) {
        code += `  const ${name} = async (${this.paramsToString(func.params)}) => {\n    ${transformedBody}\n  };\n`;
      } else {
        code += `  const ${name} = (${this.paramsToString(func.params)}) => {\n    ${transformedBody}\n  };\n`;
      }
    });

    return code;
  }

  generateVanillaDOM(template, bindings, events, controlFlow, variables, functions) {
    let code = '\n  // Create DOM element\n';
    code += '  const element = document.createElement("div");\n';
    code += '  element.className = "mtm-component";\n\n';

    if (template) {
      // Simple template processing for vanilla JS
      let processedTemplate = template;

      // Replace data bindings
      bindings.forEach(binding => {
        if (binding.type === 'data') {
          const varName = binding.expression.replace(/^\$/, '');
          processedTemplate = processedTemplate.replace(binding.raw, `\${${varName}}`);
        }
      });

      code += `  element.innerHTML = \`${processedTemplate}\`;\n\n`;

      // Add event listeners
      events.forEach(event => {
        const funcName = event.handler.replace(/^\$/, '');
        if (functions.has(funcName)) {
          code += `  element.addEventListener('${event.type}', ${funcName});\n`;
        }
      });

      // Add reactive updates
      variables.forEach((variable, name) => {
        if (variable.reactive && variable.value?.type === 'signal') {
          code += `  signal.on('${variable.value.key}', (newValue) => {\n`;
          code += `    // Update DOM when ${name} changes\n`;
          code += `    element.innerHTML = element.innerHTML.replace(/\\$\\{${name}\\}/g, newValue);\n`;
          code += `  });\n`;
        }
      });
    }

    code += '\n  return element;\n';

    return code;
  }
}

export default TemplateTransformer;