/**
 * Unit tests for Vue transformer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VueTransformer } from './vue-transformer.js';
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

describe('VueTransformer', () => {
  let transformer: VueTransformer;

  beforeEach(() => {
    transformer = new VueTransformer();
  });

  describe('transformReactiveVariable', () => {
    it('should transform simple reactive variable to ref', () => {
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

      expect(result.refName).toBe('ref');
      expect(result.variableName).toBe('counter');
      expect(result.refCall).toBe('const counter = ref(0);');
      expect(result.isReactive).toBe(true);
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

      expect(result.refCall).toBe("const name = ref('John');");
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

      expect(result.refCall).toBe('const total = ref(0);');
      // Dependencies should generate watchers
    });
  });

  describe('transformDollarFunction', () => {
    it('should transform arrow function to Vue method', () => {
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

      expect(result.methodName).toBe('increment');
      expect(result.methodDeclaration).toContain('const increment = () => {');
      expect(result.methodDeclaration).toContain('};');
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

      expect(result.methodDeclaration).toContain('const add = (a, b) => {');
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

      expect(result.methodDeclaration).toContain('const fetchData = (url) => {');
    });
  });

  describe('transformTemplate', () => {
    it('should transform variable bindings to Vue template syntax', () => {
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

      expect(result.template).toBe('<h1>Hello, {{ name }}</h1>');
      expect(result.bindings).toContain('{{ name }}');
    });

    it('should transform event handlers to Vue events', () => {
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

      expect(result.template).toBe('<button @click="increment">Click Me</button>');
      expect(result.eventHandlers).toContain('@click="increment"');
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

      expect(result.template).toBe('<div><span>{{ count }}</span><button @click="increment">+</button></div>');
      expect(result.bindings).toHaveLength(2);
    });
  });

  describe('generateCompositionAPI', () => {
    it('should generate complete Composition API code', () => {
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

      const result = transformer.generateCompositionAPI(reactiveVars);

      expect(result.refs).toHaveLength(2);
      expect(result.refs[0]).toBe('const counter = ref(0);');
      expect(result.refs[1]).toBe("const name = ref('John');");
      expect(result.returns).toContain('counter');
      expect(result.returns).toContain('name');
    });
  });

  describe('generateVueSetupFunction', () => {
    it('should generate complete Vue setup function', () => {
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
      const result = transformer.generateVueSetupFunction();

      expect(result).toContain('export default {');
      expect(result).toContain('setup() {');
      expect(result).toContain('return {');
      expect(result).toContain('counter');
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
      expect((result as any).metadata.framework).toBe('vue');
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
    it('should convert event names to Vue format', () => {
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

      expect(result.template).toContain('@change="handleChange"');
      expect(result.template).toContain('@focus="handleFocus"');
      expect(result.template).toContain('@blur="handleBlur"');
    });
  });
});