/**
 * Simple test for Svelte transformer to verify basic functionality
 */

import { describe, it, expect } from 'vitest';
import { SvelteTransformer } from './svelte-transformer.js';

describe('SvelteTransformer Simple Test', () => {
  it('should be able to create the transformer', () => {
    const transformer = new SvelteTransformer();
    expect(transformer).toBeDefined();
    expect(typeof transformer.transform).toBe('function');
    expect(typeof transformer.transformReactiveVariable).toBe('function');
    expect(typeof transformer.transformDollarFunction).toBe('function');
    expect(typeof transformer.transformTemplate).toBe('function');
  });

  it('should transform a simple reactive variable', () => {
    const transformer = new SvelteTransformer();
    
    const reactiveVar = {
      type: 'VariableDeclaration',
      name: 'counter',
      hasDollarPrefix: true,
      hasReactiveSuffix: true,
      initializer: {
        type: 'Literal',
        value: 0,
        raw: '0',
        location: { line: 1, column: 1, index: 0 }
      },
      inferredType: {
        baseType: 'number',
        nullable: false
      },
      scope: 'local',
      isReactive: true,
      updateTriggers: [],
      dependencies: [],
      location: { line: 1, column: 1, index: 0 }
    };

    const result = transformer.transformReactiveVariable(reactiveVar as any);
    
    expect(result).toBeDefined();
    expect(result.storeName).toBe('writable');
    expect(result.variableName).toBe('counter');
    expect(result.storeDeclaration).toBe('const counter = writable(0);');
  });

  it('should transform a simple template', () => {
    const transformer = new SvelteTransformer();
    
    const template = {
      type: 'Template',
      content: '<h1>Hello, {{$name}}</h1>',
      bindings: [
        {
          type: 'DataBinding',
          bindingType: 'variable',
          source: 'name',
          target: 'text',
          isReactive: true,
          updateStrategy: 'immediate',
          location: { line: 1, column: 1, index: 0 }
        }
      ],
      expressions: [],
      location: { line: 1, column: 1, index: 0 }
    };

    const result = transformer.transformTemplate(template as any);
    
    expect(result).toBeDefined();
    expect(result.template).toBe('<h1>Hello, {$name}</h1>');
    expect(result.bindings).toContain('{$name}');
  });

  it('should transform event handlers to Svelte events', () => {
    const transformer = new SvelteTransformer();
    
    const template = {
      type: 'Template',
      content: '<button click="$increment()">Click Me</button>',
      bindings: [
        {
          type: 'DataBinding',
          bindingType: 'event',
          source: 'increment',
          target: 'click',
          isReactive: false,
          updateStrategy: 'immediate',
          location: { line: 1, column: 1, index: 0 }
        }
      ],
      expressions: [],
      location: { line: 1, column: 1, index: 0 }
    };

    const result = transformer.transformTemplate(template as any);
    
    expect(result).toBeDefined();
    expect(result.template).toBe('<button on:click={increment}>Click Me</button>');
    expect(result.eventHandlers).toContain('on:click={increment}');
  });

  it('should generate Svelte component structure', () => {
    const transformer = new SvelteTransformer();
    
    // Add a reactive variable
    const reactiveVar = {
      type: 'VariableDeclaration',
      name: 'counter',
      hasDollarPrefix: true,
      hasReactiveSuffix: true,
      initializer: {
        type: 'Literal',
        value: 0,
        raw: '0',
        location: { line: 1, column: 1, index: 0 }
      },
      inferredType: {
        baseType: 'number',
        nullable: false
      },
      scope: 'local',
      isReactive: true,
      updateTriggers: [],
      dependencies: [],
      location: { line: 1, column: 1, index: 0 }
    };

    transformer.transformReactiveVariable(reactiveVar as any);
    const result = transformer.generateSvelteComponent();
    
    expect(result).toBeDefined();
    expect(result).toContain('<script>');
    expect(result).toContain('import { writable, readable, derived }');
    expect(result).toContain('const counter = writable(0);');
    expect(result).toContain('</script>');
  });
});