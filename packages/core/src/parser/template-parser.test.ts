import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateParser } from './template-parser.js';
import type { TemplateNode, DataBindingNode } from '../types/unified-ast.js';

describe('TemplateParser', () => {
  let parser: TemplateParser;

  beforeEach(() => {
    parser = new TemplateParser();
  });

  describe('parseTemplate', () => {
    it('should parse simple variable binding', () => {
      const content = '<h1>Hello, {{$name}}</h1>';
      const result = parser.parseTemplate(content);

      expect(result.type).toBe('Template');
      expect(result.content).toBe(content);
      expect(result.bindings).toHaveLength(1);
      expect(result.expressions).toHaveLength(1);

      const binding = result.bindings[0];
      expect(binding.type).toBe('DataBinding');
      expect(binding.bindingType).toBe('variable');
      expect(binding.source).toBe('$name');
      expect(binding.isReactive).toBe(true);
    });

    it('should parse multiple variable bindings', () => {
      const content = '<div>{{$firstName}} {{$lastName}}</div>';
      const result = parser.parseTemplate(content);

      expect(result.bindings).toHaveLength(2);
      expect(result.expressions).toHaveLength(2);

      expect(result.bindings[0].source).toBe('$firstName');
      expect(result.bindings[1].source).toBe('$lastName');
    });

    it('should parse function call expressions', () => {
      const content = '<p>{{$formatName($user)}}</p>';
      const result = parser.parseTemplate(content);

      expect(result.bindings).toHaveLength(1);
      expect(result.expressions).toHaveLength(1);

      const expression = result.expressions[0];
      expect(expression.type).toBe('TemplateExpression');
      expect(expression.raw).toBe('$formatName($user)');
      expect(expression.expression.type).toBe('CallExpression');
    });

    it('should parse event handler bindings', () => {
      const content = '<button click="$handleClick()">Click Me</button>';
      const result = parser.parseTemplate(content);

      expect(result.bindings).toHaveLength(1);

      const binding = result.bindings[0];
      expect(binding.type).toBe('DataBinding');
      expect(binding.bindingType).toBe('event');
      expect(binding.source).toBe('$handleClick()');
      expect(binding.target).toBe('click');
      expect(binding.isReactive).toBe(false);
    });

    it('should parse event handlers with parameters', () => {
      const content = '<button click="$increment($counter, 1)">Increment</button>';
      const result = parser.parseTemplate(content);

      expect(result.bindings).toHaveLength(1);

      const binding = result.bindings[0];
      expect(binding.bindingType).toBe('event');
      expect(binding.source).toBe('$increment($counter, 1)');
      expect(binding.target).toBe('click');
    });

    it('should handle mixed bindings and events', () => {
      const content = `
        <div>
          <h1>{{$title}}</h1>
          <p>Count: {{$counter}}</p>
          <button click="$increment()">+</button>
          <button click="$decrement()">-</button>
        </div>
      `;
      const result = parser.parseTemplate(content);

      expect(result.bindings).toHaveLength(4);
      
      // Variable bindings
      const variableBindings = result.bindings.filter(b => b.bindingType === 'variable');
      expect(variableBindings).toHaveLength(2);
      expect(variableBindings[0].source).toBe('$title');
      expect(variableBindings[1].source).toBe('$counter');

      // Event bindings
      const eventBindings = result.bindings.filter(b => b.bindingType === 'event');
      expect(eventBindings).toHaveLength(2);
      expect(eventBindings[0].source).toBe('$increment()');
      expect(eventBindings[1].source).toBe('$decrement()');
    });

    it('should handle empty template', () => {
      const content = '<div>No bindings here</div>';
      const result = parser.parseTemplate(content);

      expect(result.bindings).toHaveLength(0);
      expect(result.expressions).toHaveLength(0);
    });

    it('should handle whitespace in bindings', () => {
      const content = '<span>{{ $name }}</span>';
      const result = parser.parseTemplate(content);

      expect(result.bindings).toHaveLength(1);
      expect(result.bindings[0].source).toBe('$name');
    });

    it('should handle complex expressions', () => {
      const content = '<div>{{$user.name || "Anonymous"}}</div>';
      const result = parser.parseTemplate(content);

      expect(result.bindings).toHaveLength(1);
      expect(result.bindings[0].bindingType).toBe('expression');
      expect(result.bindings[0].source).toBe('$user.name || "Anonymous"');
    });
  });

  describe('extractVariableReferences', () => {
    it('should extract all variable references', () => {
      const content = '<div>{{$name}} {{$age}} {{$formatName($name)}}</div>';
      const template = parser.parseTemplate(content);
      const variables = parser.extractVariableReferences(template);

      expect(variables).toContain('$name');
      expect(variables).toContain('$age');
      expect(variables).toContain('$formatName');
      expect(variables).toHaveLength(3);
    });

    it('should deduplicate variable references', () => {
      const content = '<div>{{$name}} {{$name}} {{$name}}</div>';
      const template = parser.parseTemplate(content);
      const variables = parser.extractVariableReferences(template);

      expect(variables).toEqual(['$name']);
    });

    it('should handle empty template', () => {
      const content = '<div>No variables</div>';
      const template = parser.parseTemplate(content);
      const variables = parser.extractVariableReferences(template);

      expect(variables).toHaveLength(0);
    });
  });

  describe('extractEventHandlers', () => {
    it('should extract all event handlers', () => {
      const content = `
        <button click="$handleClick()">Click</button>
        <input change="$handleChange($event)">
        <form submit="$handleSubmit()">
      `;
      const template = parser.parseTemplate(content);
      const handlers = parser.extractEventHandlers(template);

      expect(handlers).toHaveLength(3);
      expect(handlers[0]).toEqual({ event: 'click', handler: '$handleClick()' });
      expect(handlers[1]).toEqual({ event: 'change', handler: '$handleChange($event)' });
      expect(handlers[2]).toEqual({ event: 'submit', handler: '$handleSubmit()' });
    });

    it('should handle template with no event handlers', () => {
      const content = '<div>{{$message}}</div>';
      const template = parser.parseTemplate(content);
      const handlers = parser.extractEventHandlers(template);

      expect(handlers).toHaveLength(0);
    });
  });

  describe('validateTemplate', () => {
    it('should validate correct template', () => {
      const content = '<div>{{$name}} <button click="$handleClick()">Click</button></div>';
      const template = parser.parseTemplate(content);
      const validation = parser.validateTemplate(template);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect unclosed bindings', () => {
      const content = '<div>{{$name} {{$age}}</div>';
      const template = parser.parseTemplate(content);
      const validation = parser.validateTemplate(template);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Mismatched template bindings: 2 opening, 1 closing');
    });

    it('should detect invalid variable references', () => {
      // This test would require manually creating an invalid template
      // since our parser wouldn't normally create invalid bindings
      const template: TemplateNode = {
        type: 'Template',
        content: '<div>{{name}}</div>',
        bindings: [{
          type: 'DataBinding',
          bindingType: 'variable',
          source: 'name', // Invalid - missing $
          target: 'dom-element',
          isReactive: false,
          updateStrategy: 'immediate',
          location: { line: 1, column: 1, index: 0 }
        }],
        expressions: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const validation = parser.validateTemplate(template);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid variable reference: name. Variables must start with $');
    });

    it('should detect invalid event handlers', () => {
      const template: TemplateNode = {
        type: 'Template',
        content: '<button click="handleClick">Click</button>',
        bindings: [{
          type: 'DataBinding',
          bindingType: 'event',
          source: 'handleClick', // Invalid - missing $ and ()
          target: 'click',
          isReactive: false,
          updateStrategy: 'immediate',
          location: { line: 1, column: 1, index: 0 }
        }],
        expressions: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const validation = parser.validateTemplate(template);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid event handler: handleClick. Must be in format $function()');
    });
  });

  describe('error handling', () => {
    it('should throw error for unclosed binding', () => {
      const content = '<div>{{$name</div>';
      
      expect(() => {
        parser.parseTemplate(content);
      }).toThrow('Unclosed template binding at line 1, column 1');
    });

    it('should handle complex nested structures', () => {
      const content = `
        <div class="container">
          <header>
            <h1>{{$title}}</h1>
            <nav>
              <a href="#" click="$navigate('home')">Home</a>
              <a href="#" click="$navigate('about')">About</a>
            </nav>
          </header>
          <main>
            <p>Welcome, {{$user.name || 'Guest'}}!</p>
            <div class="counter">
              <span>Count: {{$counter}}</span>
              <button click="$increment()">+</button>
              <button click="$decrement()">-</button>
              <button click="$reset()">Reset</button>
            </div>
          </main>
        </div>
      `;

      const result = parser.parseTemplate(content);
      
      expect(result.bindings.length).toBeGreaterThan(0);
      expect(result.expressions.length).toBeGreaterThan(0);
      
      const variableBindings = result.bindings.filter(b => b.bindingType === 'variable' || b.bindingType === 'expression');
      const eventBindings = result.bindings.filter(b => b.bindingType === 'event');
      
      expect(variableBindings.length).toBeGreaterThan(0);
      expect(eventBindings.length).toBeGreaterThan(0);
    });
  });

  describe('binding types and strategies', () => {
    it('should set correct binding types', () => {
      const content = `
        <div>
          {{$simpleVar}}
          {{$computedValue()}}
          <button click="$handleClick()">Click</button>
        </div>
      `;
      const result = parser.parseTemplate(content);

      expect(result.bindings[0].bindingType).toBe('variable');
      expect(result.bindings[1].bindingType).toBe('expression');
      expect(result.bindings[2].bindingType).toBe('event');
    });

    it('should set correct update strategies', () => {
      const content = `
        <div>
          {{$reactiveVar}}
          <button click="$handleClick()">Click</button>
        </div>
      `;
      const result = parser.parseTemplate(content);

      // Variable bindings should be batched for reactive variables
      expect(result.bindings[0].updateStrategy).toBe('batched');
      
      // Event bindings should be immediate
      expect(result.bindings[1].updateStrategy).toBe('immediate');
    });

    it('should detect reactive expressions', () => {
      const content = '<div>{{$reactiveVar}}</div>';
      const result = parser.parseTemplate(content);

      expect(result.bindings[0].isReactive).toBe(true);
    });
  });
});