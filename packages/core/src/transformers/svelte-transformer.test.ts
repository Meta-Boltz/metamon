/**
 * Unit tests for Svelte transformer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SvelteTransformer } from './svelte-transformer.js';
import type {
  ReactiveVariableNode,
  FunctionDeclarationNode,
  TemplateNode,
  DataBindingNode,
  LiteralNode,
  IdentifierNode,
  BlockStatementNode,
  ProgramNode
} from '../types/unified-ast.js';

describe('SvelteTransformer', () => {
  let transformer: SvelteTransformer;

  beforeEach(() => {
    transformer = new SvelteTransformer();
  });

  describe('transformReactiveVariable', () => {
    it('should transform simple reactive variable to writable store', () => {
      const reactiveVar: ReactiveVariableNode = {
        type: 'VariableDeclaration',
        name: 'counter',
        hasDollarPrefix: true,
        hasReactiveSuffix: true,
        initializer: {
          type: 'Literal',
          value: 0,
          raw: '0',
          location: { line: 1, column: 1, index: 0 }
        } as LiteralNode,
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

      const result = transformer.transformReactiveVariable(reactiveVar);

      expect(result.storeName).toBe('writable');
      expect(result.variableName).toBe('counter');
      expect(result.storeDeclaration).toBe('const counter = writable(0);');
      expect(result.isWritable).toBe(true);
    });

    it('should transform string reactive variable correctly', () => {
      const reactiveVar: ReactiveVariableNode = {
        type: 'VariableDeclaration',
        name: 'name',
        hasDollarPrefix: true,
        hasReactiveSuffix: true,
        initializer: {
          type: 'Literal',
          value: 'John',
          raw: '"John"',
          location: { line: 1, column: 1, index: 0 }
        } as LiteralNode,
        inferredType: {
          baseType: 'string',
          nullable: false
        },
        scope: 'local',
        isReactive: true,
        updateTriggers: [],
        dependencies: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transformReactiveVariable(reactiveVar);

      expect(result.storeDeclaration).toBe("const name = writable('John');");
    });

    it('should handle reactive variable with dependencies', () => {
      const reactiveVar: ReactiveVariableNode = {
        type: 'VariableDeclaration',
        name: 'total',
        hasDollarPrefix: true,
        hasReactiveSuffix: true,
        initializer: {
          type: 'Literal',
          value: 0,
          raw: '0',
          location: { line: 1, column: 1, index: 0 }
        } as LiteralNode,
        inferredType: {
          baseType: 'number',
          nullable: false
        },
        scope: 'local',
        isReactive: true,
        updateTriggers: ['ui-total'],
        dependencies: ['price', 'quantity'],
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transformReactiveVariable(reactiveVar);

      expect(result.storeDeclaration).toBe('const total = writable(0);');
      // Dependencies should generate reactive statements
    });
  });

  describe('transformDollarFunction', () => {
    it('should transform arrow function to Svelte function', () => {
      const dollarFunc: FunctionDeclarationNode = {
        type: 'FunctionDeclaration',
        name: 'increment',
        hasDollarPrefix: true,
        parameters: [],
        body: {
          type: 'BlockStatement',
          body: [],
          location: { line: 1, column: 1, index: 0 }
        } as BlockStatementNode,
        isArrow: true,
        autoBindThis: true,
        async: false,
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transformDollarFunction(dollarFunc);

      expect(result.functionName).toBe('increment');
      expect(result.functionDeclaration).toContain('function increment() {');
      expect(result.functionDeclaration).toContain('}');
    });

    it('should transform function with parameters', () => {
      const dollarFunc: FunctionDeclarationNode = {
        type: 'FunctionDeclaration',
        name: 'add',
        hasDollarPrefix: true,
        parameters: [
          {
            type: 'Parameter',
            name: 'a',
            location: { line: 1, column: 1, index: 0 }
          },
          {
            type: 'Parameter',
            name: 'b',
            location: { line: 1, column: 1, index: 0 }
          }
        ],
        body: {
          type: 'BlockStatement',
          body: [],
          location: { line: 1, column: 1, index: 0 }
        } as BlockStatementNode,
        isArrow: true,
        autoBindThis: true,
        async: false,
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transformDollarFunction(dollarFunc);

      expect(result.functionDeclaration).toContain('function add(a, b) {');
    });

    it('should handle async functions', () => {
      const asyncFunc: FunctionDeclarationNode = {
        type: 'FunctionDeclaration',
        name: 'fetchData',
        hasDollarPrefix: true,
        parameters: [
          {
            type: 'Parameter',
            name: 'url',
            location: { line: 1, column: 1, index: 0 }
          }
        ],
        body: {
          type: 'BlockStatement',
          body: [],
          location: { line: 1, column: 1, index: 0 }
        } as BlockStatementNode,
        isArrow: true,
        autoBindThis: true,
        async: true,
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transformDollarFunction(asyncFunc);

      expect(result.functionDeclaration).toContain('function fetchData(url) {');
    });
  });

  describe('transformTemplate', () => {
    it('should transform variable bindings to Svelte markup', () => {
      const template: TemplateNode = {
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
          } as DataBindingNode
        ],
        expressions: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transformTemplate(template);

      expect(result.template).toBe('<h1>Hello, {$name}</h1>');
      expect(result.bindings).toContain('{$name}');
    });

    it('should transform event handlers to Svelte events', () => {
      const template: TemplateNode = {
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
          } as DataBindingNode
        ],
        expressions: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transformTemplate(template);

      expect(result.template).toBe('<button on:click={increment}>Click Me</button>');
      expect(result.eventHandlers).toContain('on:click={increment}');
    });

    it('should handle multiple bindings', () => {
      const template: TemplateNode = {
        type: 'Template',
        content: '<div><span>{{$count}}</span><button click="$increment()">+</button></div>',
        bindings: [
          {
            type: 'DataBinding',
            bindingType: 'variable',
            source: 'count',
            target: 'text',
            isReactive: true,
            updateStrategy: 'immediate',
            location: { line: 1, column: 1, index: 0 }
          } as DataBindingNode,
          {
            type: 'DataBinding',
            bindingType: 'event',
            source: 'increment',
            target: 'click',
            isReactive: false,
            updateStrategy: 'immediate',
            location: { line: 1, column: 1, index: 0 }
          } as DataBindingNode
        ],
        expressions: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transformTemplate(template);

      expect(result.template).toBe('<div><span>{$count}</span><button on:click={increment}>+</button></div>');
      expect(result.bindings).toHaveLength(2);
    });
  });

  describe('generateReactiveStatements', () => {
    it('should generate complete reactive statements', () => {
      const reactiveVars: ReactiveVariableNode[] = [
        {
          type: 'VariableDeclaration',
          name: 'counter',
          hasDollarPrefix: true,
          hasReactiveSuffix: true,
          initializer: {
            type: 'Literal',
            value: 0,
            raw: '0',
            location: { line: 1, column: 1, index: 0 }
          } as LiteralNode,
          inferredType: {
            baseType: 'number',
            nullable: false
          },
          scope: 'local',
          isReactive: true,
          updateTriggers: ['ui-counter'],
          dependencies: [],
          location: { line: 1, column: 1, index: 0 }
        },
        {
          type: 'VariableDeclaration',
          name: 'name',
          hasDollarPrefix: true,
          hasReactiveSuffix: true,
          initializer: {
            type: 'Literal',
            value: 'John',
            raw: '"John"',
            location: { line: 1, column: 1, index: 0 }
          } as LiteralNode,
          inferredType: {
            baseType: 'string',
            nullable: false
          },
          scope: 'local',
          isReactive: true,
          updateTriggers: [],
          dependencies: [],
          location: { line: 1, column: 1, index: 0 }
        }
      ];

      const result = transformer.generateReactiveStatements(reactiveVars);

      expect(result.reactiveStatements).toBeDefined();
      expect(result.storeSubscriptions).toBeDefined();
      expect(result.derivedStores).toBeDefined();
    });
  });

  describe('generateSvelteComponent', () => {
    it('should generate complete Svelte component', () => {
      // Add some reactive variables first
      const reactiveVar: ReactiveVariableNode = {
        type: 'VariableDeclaration',
        name: 'counter',
        hasDollarPrefix: true,
        hasReactiveSuffix: true,
        initializer: {
          type: 'Literal',
          value: 0,
          raw: '0',
          location: { line: 1, column: 1, index: 0 }
        } as LiteralNode,
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

      transformer.transformReactiveVariable(reactiveVar);
      const result = transformer.generateSvelteComponent();

      expect(result).toContain('<script>');
      expect(result).toContain('import { writable, readable, derived }');
      expect(result).toContain('const counter = writable(0);');
      expect(result).toContain('</script>');
      expect(result).toContain('<div>');
    });
  });

  describe('transform', () => {
    it('should transform complete program AST', () => {
      const program: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'counter',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 0,
              raw: '0',
              location: { line: 1, column: 1, index: 0 }
            } as LiteralNode,
            inferredType: {
              baseType: 'number',
              nullable: false
            },
            scope: 'local',
            isReactive: true,
            updateTriggers: [],
            dependencies: [],
            location: { line: 1, column: 1, index: 0 }
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern',
        modernFeatures: {
          dollarPrefixVariables: true,
          reactiveVariables: true,
          enhancedTypeInference: true,
          optionalSemicolons: false,
          autoThisBinding: true
        },
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transform(program);

      expect(result.type).toBe('Program');
      expect((result as any).metadata).toBeDefined();
      expect((result as any).metadata.framework).toBe('svelte');
    });

    it('should handle legacy AST without transformation', () => {
      const legacyAST = {
        type: 'LegacyProgram',
        content: 'legacy content',
        frontmatter: {}
      };

      const result = transformer.transform(legacyAST);

      expect(result).toBe(legacyAST);
    });
  });

  describe('event name conversion', () => {
    it('should convert event names to Svelte format', () => {
      const template: TemplateNode = {
        type: 'Template',
        content: '<input change="$handleChange()" focus="$handleFocus()" blur="$handleBlur()">',
        bindings: [
          {
            type: 'DataBinding',
            bindingType: 'event',
            source: 'handleChange',
            target: 'change',
            isReactive: false,
            updateStrategy: 'immediate',
            location: { line: 1, column: 1, index: 0 }
          } as DataBindingNode,
          {
            type: 'DataBinding',
            bindingType: 'event',
            source: 'handleFocus',
            target: 'focus',
            isReactive: false,
            updateStrategy: 'immediate',
            location: { line: 1, column: 1, index: 0 }
          } as DataBindingNode,
          {
            type: 'DataBinding',
            bindingType: 'event',
            source: 'handleBlur',
            target: 'blur',
            isReactive: false,
            updateStrategy: 'immediate',
            location: { line: 1, column: 1, index: 0 }
          } as DataBindingNode
        ],
        expressions: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const result = transformer.transformTemplate(template);

      expect(result.template).toContain('on:change={handleChange}');
      expect(result.template).toContain('on:focus={handleFocus}');
      expect(result.template).toContain('on:blur={handleBlur}');
    });
  });
});