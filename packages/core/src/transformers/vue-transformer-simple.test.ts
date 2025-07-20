/**
 * Simple test for Vue transformer to verify basic functionality
 */

import { describe, it, expect } from 'vitest';
import { VueTransformer } from './vue-transformer.js';

describe('VueTransformer Simple Test', () => {
  it('should be able to create the transformer', () => {
    const transformer = new VueTransformer();
    expect(transformer).toBeDefined();
    expect(typeof transformer.transform).toBe('function');
    expect(typeof transformer.transformReactiveVariable).toBe('function');
    expect(typeof transformer.transformDollarFunction).toBe('function');
    expect(typeof transformer.transformTemplate).toBe('function');
  });

  it('should transform a simple reactive variable', () => {
    const transformer = new VueTransformer();
    
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
    expect(result.refName).toBe('ref');
    expect(result.variableName).toBe('counter');
    expect(result.refCall).toBe('const counter = ref(0);');
  });

  it('should transform a simple template', () => {
    const transformer = new VueTransformer();
    
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
    expect(result.template).toBe('<h1>Hello, {{ name }}</h1>');
    expect(result.bindings).toContain('{{ name }}');
  });

  it('should transform event handlers to Vue events', () => {
    const transformer = new VueTransformer();
    
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
    expect(result.template).toBe('<button @click="increment">Click Me</button>');
    expect(result.eventHandlers).toContain('@click="increment"');
  });
});