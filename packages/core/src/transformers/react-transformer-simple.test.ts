/**
 * Simple test for React transformer to verify basic functionality
 */

import { describe, it, expect } from 'vitest';
import { ReactTransformer } from './react-transformer.js';

describe('ReactTransformer Simple Test', () => {
  it('should be able to create the transformer', () => {
    const transformer = new ReactTransformer();
    expect(transformer).toBeDefined();
    expect(typeof transformer.transform).toBe('function');
    expect(typeof transformer.transformReactiveVariable).toBe('function');
    expect(typeof transformer.transformDollarFunction).toBe('function');
    expect(typeof transformer.transformTemplate).toBe('function');
  });

  it('should transform a simple reactive variable', () => {
    const transformer = new ReactTransformer();
    
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
    expect(result.hookName).toBe('useState');
    expect(result.stateName).toBe('counter');
    expect(result.setterName).toBe('setCounter');
    expect(result.hookCall).toBe('const [counter, setCounter] = useState(0);');
  });

  it('should transform a simple template', () => {
    const transformer = new ReactTransformer();
    
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
    expect(result.template).toBe('<h1>Hello, {name}</h1>');
    expect(result.bindings).toContain('{name}');
  });
});