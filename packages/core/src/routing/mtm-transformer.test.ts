/**
 * Unit Tests for MTM Content Transformation and Code Generation
 * Tests MTM template transformation to different frameworks
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock MTM Transformer implementation for testing
interface ParsedMTM {
  imports: Array<{ source: string; raw: string }>;
  variables: Map<string, any>;
  functions: Map<string, any>;
  template: string;
  bindings: Array<{ type: string; expression: string; raw: string }>;
  events: Array<{ type: string; handler: string; raw: string; isFunction?: boolean; functionName?: string; isInline?: boolean }>;
  controlFlow: Array<{ type: string; condition?: string; raw: string; ifContent?: string; elseContent?: string; iterable?: string; itemName?: string; indexName?: string; content?: string }>;
  exports: Array<{ type: string; name: string }>;
  errors: Array<{ type: string; message: string; suggestion?: string }>;
}

class MTMTransformer {
  transform(code: string, framework: string = 'react', options: any = {}): any {
    const defaultOptions = {
      generateSourceMap: false,
      preserveComments: false,
      optimizeOutput: true,
      includeTypeAnnotations: true
    };

    const opts = { ...defaultOptions, ...options };

    try {
      // Parse the MTM code
      const parsed = this.parse(code);

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

    } catch (error: any) {
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

  private parse(code: string): ParsedMTM {
    // Simple parser for testing - in real implementation this would be much more complex
    const imports: Array<{ source: string; raw: string }> = [];
    const variables = new Map();
    const functions = new Map();
    const bindings: Array<{ type: string; expression: string; raw: string }> = [];
    const events: Array<{ type: string; handler: string; raw: string; isFunction?: boolean; functionName?: string; isInline?: boolean }> = [];
    const controlFlow: Array<{ type: string; condition?: string; raw: string; ifContent?: string; elseContent?: string; iterable?: string; itemName?: string; indexName?: string; content?: string }> = [];
    const exports: Array<{ type: string; name: string }> = [];
    const errors: Array<{ type: string; message: string; suggestion?: string }> = [];

    // Extract frontmatter
    const frontmatterMatch = code.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    let template = '';
    
    if (frontmatterMatch) {
      template = frontmatterMatch[2];
    } else {
      template = code;
    }

    // Parse imports
    const importMatches = code.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      imports.push({
        source: match[1],
        raw: match[0]
      });
    }

    // Parse variables (simple detection)
    const variableMatches = code.matchAll(/let\s+(\w+)\s*=\s*([^;]+)/g);
    for (const match of variableMatches) {
      variables.set(match[1], {
        reactive: true,
        value: this.parseValue(match[2])
      });
    }

    // Parse functions
    const functionMatches = code.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*\}/g);
    for (const match of functionMatches) {
      functions.set(match[1], {
        isAsync: false,
        params: [],
        body: match[0]
      });
    }

    // Parse data bindings
    const bindingMatches = template.matchAll(/\{([^}]+)\}/g);
    for (const match of bindingMatches) {
      bindings.push({
        type: 'data',
        expression: match[1],
        raw: match[0]
      });
    }

    // Parse event bindings
    const eventMatches = template.matchAll(/on(\w+)=\{([^}]+)\}/g);
    for (const match of eventMatches) {
      events.push({
        type: match[1].toLowerCase(),
        handler: match[2],
        raw: match[0],
        isFunction: functions.has(match[2]),
        functionName: match[2]
      });
    }

    // Parse control flow
    const ifMatches = template.matchAll(/\{#if\s+([^}]+)\}([\s\S]*?)\{\/if\}/g);
    for (const match of ifMatches) {
      controlFlow.push({
        type: 'conditional',
        condition: match[1],
        raw: match[0],
        ifContent: match[2]
      });
    }

    const eachMatches = template.matchAll(/\{#each\s+(\w+)\s+as\s+(\w+)\}([\s\S]*?)\{\/each\}/g);
    for (const match of eachMatches) {
      controlFlow.push({
        type: 'loop',
        iterable: match[1],
        itemName: match[2],
        raw: match[0],
        content: match[3]
      });
    }

    return {
      imports,
      variables,
      functions,
      template,
      bindings,
      events,
      controlFlow,
      exports,
      errors
    };
  }

  private parseValue(value: string): any {
    const trimmed = value.trim();
    
    if (trimmed === 'true') return { type: 'boolean', value: true };
    if (trimmed === 'false') return { type: 'boolean', value: false };
    if (/^\d+$/.test(trimmed)) return { type: 'number', value: parseInt(trimmed) };
    if (/^\d*\.\d+$/.test(trimmed)) return { type: 'number', value: parseFloat(trimmed) };
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return { type: 'string', value: trimmed.slice(1, -1) };
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) return { type: 'array', value: JSON.parse(trimmed) };
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return { type: 'object', value: JSON.parse(trimmed) };
    
    return { type: 'expression', value: trimmed };
  }

  private transformToReact(parsed: ParsedMTM, options: any): string {
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
    const componentName = 'Component';
    code += `export default function ${componentName}(props = {}) {\n`;

    // State variables
    parsed.variables.forEach((variable, name) => {
      if (variable.reactive) {
        code += `  const [${name}, set${this.capitalize(name)}] = useState(${this.valueToString(variable.value)});\n`;
      } else {
        code += `  const ${name} = ${this.valueToString(variable.value)};\n`;
      }
    });

    // Functions
    parsed.functions.forEach((func, name) => {
      code += `  const ${name} = useCallback(() => {\n    // Function body\n  }, []);\n`;
    });

    // Template
    let templateCode = parsed.template;

    // Transform control flow
    parsed.controlFlow.forEach(control => {
      if (control.type === 'conditional') {
        const replacement = `{${control.condition} && (\n${control.ifContent}\n)}`;
        templateCode = templateCode.replace(control.raw, replacement);
      } else if (control.type === 'loop') {
        const replacement = `{${control.iterable}.map(${control.itemName} => (\n${control.content}\n))}`;
        templateCode = templateCode.replace(control.raw, replacement);
      }
    });

    // Transform data bindings
    parsed.bindings.forEach(binding => {
      if (binding.type === 'data') {
        templateCode = templateCode.replace(binding.raw, `{${binding.expression}}`);
      }
    });

    // Transform event bindings
    parsed.events.forEach(event => {
      const reactEvent = `on${this.capitalize(event.type)}={${event.handler}}`;
      templateCode = templateCode.replace(event.raw, reactEvent);
    });

    // Transform attributes
    templateCode = templateCode.replace(/class=/g, 'className=');

    code += `\n  return (\n${this.indentCode(templateCode, 4)}\n  );\n`;
    code += '}\n';

    return code;
  }

  private transformToVue(parsed: ParsedMTM, options: any): string {
    let template = '';
    let script = '';

    // Template section
    if (parsed.template) {
      let vueTemplate = parsed.template;

      // Transform control flow
      parsed.controlFlow.forEach(control => {
        if (control.type === 'conditional') {
          const replacement = `<template v-if="${control.condition}">\n${control.ifContent}\n</template>`;
          vueTemplate = vueTemplate.replace(control.raw, replacement);
        } else if (control.type === 'loop') {
          const replacement = `<template v-for="${control.itemName} in ${control.iterable}">\n${control.content}\n</template>`;
          vueTemplate = vueTemplate.replace(control.raw, replacement);
        }
      });

      // Transform data bindings
      parsed.bindings.forEach(binding => {
        vueTemplate = vueTemplate.replace(binding.raw, `{{ ${binding.expression} }}`);
      });

      // Transform event bindings
      parsed.events.forEach(event => {
        const vueEvent = `@${event.type}="${event.handler}"`;
        vueTemplate = vueTemplate.replace(event.raw, vueEvent);
      });

      template = `<template>\n${this.indentCode(vueTemplate, 2)}\n</template>\n\n`;
    }

    // Script section
    script += '<script setup>\n';
    script += "import { ref, computed } from 'vue';\n";

    // Add custom imports
    parsed.imports.forEach(imp => {
      if (!imp.source.includes('vue')) {
        script += `${imp.raw}\n`;
      }
    });

    script += '\n';

    // State variables
    parsed.variables.forEach((variable, name) => {
      if (variable.reactive) {
        script += `const ${name} = ref(${this.valueToString(variable.value)});\n`;
      } else {
        script += `const ${name} = ${this.valueToString(variable.value)};\n`;
      }
    });

    // Functions
    parsed.functions.forEach((func, name) => {
      script += `const ${name} = () => {\n  // Function body\n};\n`;
    });

    script += '</script>\n';

    return template + script;
  }

  private transformToSvelte(parsed: ParsedMTM, options: any): string {
    let script = '';
    let template = '';

    // Script section
    script += '<script>\n';

    // Add custom imports
    parsed.imports.forEach(imp => {
      script += `${imp.raw}\n`;
    });

    script += '\n';

    // State variables
    parsed.variables.forEach((variable, name) => {
      script += `let ${name} = ${this.valueToString(variable.value)};\n`;
    });

    // Functions
    parsed.functions.forEach((func, name) => {
      script += `function ${name}() {\n  // Function body\n}\n`;
    });

    script += '</script>\n\n';

    // Template
    if (parsed.template) {
      template = parsed.template;

      // Transform control flow (already in Svelte format from parse)
      // Transform data bindings
      parsed.bindings.forEach(binding => {
        template = template.replace(binding.raw, `{${binding.expression}}`);
      });

      // Transform event bindings
      parsed.events.forEach(event => {
        const svelteEvent = `on:${event.type}={${event.handler}}`;
        template = template.replace(event.raw, svelteEvent);
      });
    }

    return script + template;
  }

  private transformToVanilla(parsed: ParsedMTM, options: any): string {
    let code = '';

    // Imports
    parsed.imports.forEach(imp => {
      code += `${imp.raw}\n`;
    });

    code += '\n';

    // Component function
    code += 'export default function Component() {\n';

    // State variables
    parsed.variables.forEach((variable, name) => {
      code += `  let ${name} = ${this.valueToString(variable.value)};\n`;
    });

    // Functions
    parsed.functions.forEach((func, name) => {
      code += `  const ${name} = () => {\n    // Function body\n  };\n`;
    });

    // DOM creation
    code += '\n  // Create DOM element\n';
    code += '  const element = document.createElement("div");\n';
    code += '  element.className = "mtm-component";\n\n';

    if (parsed.template) {
      let processedTemplate = parsed.template;

      // Replace data bindings
      parsed.bindings.forEach(binding => {
        processedTemplate = processedTemplate.replace(binding.raw, `\${${binding.expression}}`);
      });

      code += `  element.innerHTML = \`${processedTemplate}\`;\n\n`;

      // Add event listeners
      parsed.events.forEach(event => {
        code += `  element.addEventListener('${event.type}', ${event.handler});\n`;
      });
    }

    code += '\n  return element;\n';
    code += '}\n';

    return code;
  }

  private generateErrorComponent(errors: any[], framework: string): string {
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

  private generateSourceMap(original: string, transformed: string): any {
    return {
      version: 3,
      sources: ['input.mtm'],
      sourcesContent: [original],
      mappings: 'AAAA',
      names: []
    };
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private valueToString(value: any): string {
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

  private indentCode(code: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return code.split('\n').map(line => line.trim() ? indent + line : line).join('\n');
  }
}

describe('MTM Content Transformer', () => {
  let transformer: MTMTransformer;

  beforeEach(() => {
    transformer = new MTMTransformer();
  });

  describe('Basic Transformation', () => {
    it('should transform simple MTM to React', () => {
      const mtmCode = `---
route: /test
title: Test Page
---
<div>
  <h1>{title}</h1>
  <button onClick={handleClick}>Click me</button>
</div>`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('import React');
      expect(result.code).toContain('export default function Component');
      expect(result.code).toContain('return (');
      expect(result.errors).toHaveLength(0);
    });

    it('should transform simple MTM to Vue', () => {
      const mtmCode = `---
route: /test
title: Test Page
---
<div>
  <h1>{title}</h1>
  <button onClick={handleClick}>Click me</button>
</div>`;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('<template>');
      expect(result.code).toContain('<script setup>');
      expect(result.code).toContain('import { ref, computed } from \'vue\'');
      expect(result.errors).toHaveLength(0);
    });

    it('should transform simple MTM to Svelte', () => {
      const mtmCode = `---
route: /test
title: Test Page
---
<div>
  <h1>{title}</h1>
  <button onClick={handleClick}>Click me</button>
</div>`;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.code).toContain('<script>');
      expect(result.code).toContain('<div>');
      expect(result.errors).toHaveLength(0);
    });

    it('should transform simple MTM to Vanilla JavaScript', () => {
      const mtmCode = `---
route: /test
title: Test Page
---
<div>
  <h1>{title}</h1>
  <button onClick={handleClick}>Click me</button>
</div>`;

      const result = transformer.transform(mtmCode, 'vanilla');

      expect(result.code).toContain('export default function Component');
      expect(result.code).toContain('document.createElement');
      expect(result.code).toContain('addEventListener');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Variable Transformation', () => {
    it('should transform reactive variables in React', () => {
      const mtmCode = `let count = 0;
<div>{count}</div>`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('useState(0)');
      expect(result.code).toContain('const [count, setCount]');
    });

    it('should transform reactive variables in Vue', () => {
      const mtmCode = `let count = 0;
<div>{count}</div>`;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('const count = ref(0)');
    });

    it('should transform reactive variables in Svelte', () => {
      const mtmCode = `let count = 0;
<div>{count}</div>`;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.code).toContain('let count = 0');
    });

    it('should handle different variable types', () => {
      const mtmCode = `let name = "John";
let age = 25;
let active = true;
let items = ["a", "b", "c"];
<div>{name} - {age} - {active}</div>`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('useState("John")');
      expect(result.code).toContain('useState(25)');
      expect(result.code).toContain('useState(true)');
      expect(result.code).toContain('useState(["a","b","c"])');
    });
  });

  describe('Function Transformation', () => {
    it('should transform functions in React', () => {
      const mtmCode = `function handleClick() {
  console.log('clicked');
}
<button onClick={handleClick}>Click</button>`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('const handleClick = useCallback');
    });

    it('should transform functions in Vue', () => {
      const mtmCode = `function handleClick() {
  console.log('clicked');
}
<button onClick={handleClick}>Click</button>`;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('const handleClick = () =>');
    });

    it('should transform functions in Svelte', () => {
      const mtmCode = `function handleClick() {
  console.log('clicked');
}
<button onClick={handleClick}>Click</button>`;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.code).toContain('function handleClick()');
    });
  });

  describe('Control Flow Transformation', () => {
    it('should transform conditional statements in React', () => {
      const mtmCode = `let show = true;
{#if show}
  <div>Visible</div>
{/if}`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('{show && (');
      expect(result.code).toContain('<div>Visible</div>');
    });

    it('should transform conditional statements in Vue', () => {
      const mtmCode = `let show = true;
{#if show}
  <div>Visible</div>
{/if}`;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('v-if="show"');
    });

    it('should transform loops in React', () => {
      const mtmCode = `let items = ["a", "b", "c"];
{#each items as item}
  <div>{item}</div>
{/each}`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('items.map(item =>');
    });

    it('should transform loops in Vue', () => {
      const mtmCode = `let items = ["a", "b", "c"];
{#each items as item}
  <div>{item}</div>
{/each}`;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('v-for="item in items"');
    });
  });

  describe('Event Binding Transformation', () => {
    it('should transform event bindings in React', () => {
      const mtmCode = `<button onClick={handleClick}>Click</button>`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('onClick={handleClick}');
    });

    it('should transform event bindings in Vue', () => {
      const mtmCode = `<button onClick={handleClick}>Click</button>`;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('@click="handleClick"');
    });

    it('should transform event bindings in Svelte', () => {
      const mtmCode = `<button onClick={handleClick}>Click</button>`;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.code).toContain('on:click={handleClick}');
    });

    it('should transform event bindings in Vanilla JS', () => {
      const mtmCode = `<button onClick={handleClick}>Click</button>`;

      const result = transformer.transform(mtmCode, 'vanilla');

      expect(result.code).toContain('addEventListener(\'click\', handleClick)');
    });
  });

  describe('Attribute Transformation', () => {
    it('should transform class attribute in React', () => {
      const mtmCode = `<div class="container">Content</div>`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('className="container"');
    });

    it('should preserve class attribute in Vue', () => {
      const mtmCode = `<div class="container">Content</div>`;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('class="container"');
    });

    it('should preserve class attribute in Svelte', () => {
      const mtmCode = `<div class="container">Content</div>`;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.code).toContain('class="container"');
    });
  });

  describe('Import Handling', () => {
    it('should handle custom imports', () => {
      const mtmCode = `import { helper } from './utils';
import axios from 'axios';
<div>Content</div>`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('import { helper } from \'./utils\'');
      expect(result.code).toContain('import axios from \'axios\'');
      expect(result.code).toContain('import React');
    });

    it('should filter out framework-specific imports', () => {
      const mtmCode = `import React from 'react';
import { ref } from 'vue';
<div>Content</div>`;

      const reactResult = transformer.transform(mtmCode, 'react');
      const vueResult = transformer.transform(mtmCode, 'vue');

      expect(reactResult.code).not.toContain('import { ref } from \'vue\'');
      expect(vueResult.code).not.toContain('import React from \'react\'');
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported framework', () => {
      const mtmCode = `<div>Content</div>`;

      const result = transformer.transform(mtmCode, 'unsupported');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Unsupported framework');
    });

    it('should generate error component for parsing errors', () => {
      const mtmCode = `invalid MTM syntax {{{`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('MTM Transform Error');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed templates gracefully', () => {
      const mtmCode = `<div><span>Unclosed tags`;

      const result = transformer.transform(mtmCode, 'react');

      // Should not crash, even with malformed HTML
      expect(result.code).toBeDefined();
    });
  });

  describe('Options and Configuration', () => {
    it('should respect generateSourceMap option', () => {
      const mtmCode = `<div>Content</div>`;

      const resultWithMap = transformer.transform(mtmCode, 'react', { generateSourceMap: true });
      const resultWithoutMap = transformer.transform(mtmCode, 'react', { generateSourceMap: false });

      expect(resultWithMap.map).toBeTruthy();
      expect(resultWithoutMap.map).toBe(null);
    });

    it('should handle different optimization levels', () => {
      const mtmCode = `<div>Content</div>`;

      const optimized = transformer.transform(mtmCode, 'react', { optimizeOutput: true });
      const unoptimized = transformer.transform(mtmCode, 'react', { optimizeOutput: false });

      expect(optimized.code).toBeDefined();
      expect(unoptimized.code).toBeDefined();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle complex MTM with multiple features', () => {
      const mtmCode = `---
route: /complex
title: Complex Page
---
import { api } from './api';

let count = 0;
let items = ["a", "b", "c"];
let showItems = true;

function increment() {
  count++;
}

function fetchData() {
  return api.getData();
}

<div class="container">
  <h1>{title}</h1>
  <p>Count: {count}</p>
  <button onClick={increment}>Increment</button>
  
  {#if showItems}
    <ul>
      {#each items as item}
        <li>{item}</li>
      {/each}
    </ul>
  {/if}
  
  <button onClick={fetchData}>Fetch Data</button>
</div>`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('import React');
      expect(result.code).toContain('useState');
      expect(result.code).toContain('useCallback');
      expect(result.code).toContain('className="container"');
      expect(result.code).toContain('onClick={increment}');
      expect(result.code).toContain('showItems &&');
      expect(result.code).toContain('items.map');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle nested control structures', () => {
      const mtmCode = `let users = [{name: "John", active: true}];
{#each users as user}
  {#if user.active}
    <div>{user.name}</div>
  {/if}
{/each}`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('users.map');
      expect(result.code).toContain('user.active &&');
    });
  });

  describe('Framework-Specific Features', () => {
    it('should generate React hooks correctly', () => {
      const mtmCode = `let count = 0;
function increment() { count++; }
<button onClick={increment}>{count}</button>`;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('useState');
      expect(result.code).toContain('useCallback');
      expect(result.code).toContain('setCount');
    });

    it('should generate Vue composition API correctly', () => {
      const mtmCode = `let count = 0;
<div>{count}</div>`;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('ref(0)');
      expect(result.code).toContain('<script setup>');
    });

    it('should generate Svelte reactive statements correctly', () => {
      const mtmCode = `let count = 0;
<div>{count}</div>`;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.code).toContain('let count = 0');
      expect(result.code).toContain('<script>');
    });

    it('should generate vanilla DOM manipulation correctly', () => {
      const mtmCode = `let count = 0;
function increment() { count++; }
<button onClick={increment}>{count}</button>`;

      const result = transformer.transform(mtmCode, 'vanilla');

      expect(result.code).toContain('document.createElement');
      expect(result.code).toContain('addEventListener');
      expect(result.code).toContain('innerHTML');
    });
  });
});