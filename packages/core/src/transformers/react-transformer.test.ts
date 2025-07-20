/**
 * Unit tests for React transformer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReactTransformer } from './react-transformer.js';
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

describe('ReactTransformer', () => {
  let transformer: ReactTransformer;

  beforeEach(() => {
    transformer = new ReactTransformer();
  });

  describe('transformReactiveVariable', () => {
    it('should transform simple reactive variable to useState hook', () => {
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

      expect(result.hookName).toBe('useState');
      expect(result.stateName).toBe('counter');
      expect(result.setterName).toBe('setCounter');
      expect(result.hookCall).toBe('const [counter, setCounter] = useState(0);');
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

      expect(result.hookCall).toBe('const [name, setName] = useState("John");');
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

      expect(result.hookCall).toBe('const [total, setTotal] = useState(0);');
      // Dependencies should generate useEffect hooks
    });
  });

  describe('transformDollarFunction', () => {
    it('should transform arrow function to useCallback', () => {
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
      expect(result.functionDeclaration).toContain('const increment = useCallback(');
      expect(result.functionDeclaration).toContain('}, []);');
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

      expect(result.functionDeclaration).toContain('const add = useCallback((a, b) => {');
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

      expect(result.functionDeclaration).toContain('const fetchData = useCallback((url) => {');
    });
  });

  describe('transformTemplate', () => {
    it('should transform variable bindings to JSX', () => {
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

      expect(result.template).toBe('<h1>Hello, {name}</h1>');
      expect(result.bindings).toContain('{name}');
    });

    it('should transform event handlers to React events', () => {
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

      expect(result.template).toBe('<button onClick={increment}>Click Me</button>');
      expect(result.eventHandlers).toContain('onClick={increment}');
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

      expect(result.template).toBe('<div><span>{count}</span><button onClick={increment}>+</button></div>');
      expect(result.bindings).toHaveLength(2);
    });
  });

  describe('generateStateManagement', () => {
    it('should generate complete state management code', () => {
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

      const result = transformer.generateStateManagement(reactiveVars);

      expect(result.stateDeclarations).toHaveLength(2);
      expect(result.stateDeclarations[0]).toBe('const [counter, setCounter] = useState(0);');
      expect(result.stateDeclarations[1]).toBe('const [name, setName] = useState("John");');
      expect(result.stateUpdaters).toHaveLength(1); // Only counter has update triggers
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
      expect((result as any).metadata.framework).toBe('react');
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

  describe('utility functions', () => {
    it('should transform reactive variable using transformer method', () => {
      const reactiveVar: ReactiveVariableNode = {
        type: 'VariableDeclaration',
        name: 'count',
        hasDollarPrefix: true,
        hasReactiveSuffix: true,
        initializer: {
          type: 'Literal',
          value: 42,
          raw: '42',
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

      expect(result.hookCall).toBe('const [count, setCount] = useState(42);');
    });

    it('should transform dollar function using transformer method', () => {
      const dollarFunc: FunctionDeclarationNode = {
        type: 'FunctionDeclaration',
        name: 'handleClick',
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

      expect(result.functionDeclaration).toContain('const handleClick = useCallback(');
    });
  });

  describe('event name conversion', () => {
    it('should convert common event names to React format', () => {
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

      expect(result.template).toContain('onChange={handleChange}');
      expect(result.template).toContain('onFocus={handleFocus}');
      expect(result.template).toContain('onBlur={handleBlur}');
    });
  });
});