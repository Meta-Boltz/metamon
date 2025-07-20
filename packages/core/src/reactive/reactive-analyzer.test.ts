/**
 * Unit tests for ReactiveVariableAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReactiveVariableAnalyzer } from './reactive-analyzer.js';
import type {
  ProgramNode,
  VariableDeclarationNode,
  ReactiveVariableNode,
  LiteralNode,
  IdentifierNode,
  CallExpressionNode
} from '../types/unified-ast.js';

describe('ReactiveVariableAnalyzer', () => {
  let analyzer: ReactiveVariableAnalyzer;

  beforeEach(() => {
    analyzer = new ReactiveVariableAnalyzer();
  });

  describe('Basic Reactive Variable Analysis', () => {
    it('should identify reactive variables with ! suffix', () => {
      const ast: ProgramNode = {
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
              raw: '0'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);

      expect(graph.variables.has('counter')).toBe(true);
      expect(graph.variables.get('counter')?.isReactive).toBe(true);
      expect(graph.variables.get('counter')?.hasReactiveSuffix).toBe(true);
    });

    it('should not identify non-reactive variables', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'normalVar',
            hasDollarPrefix: true,
            hasReactiveSuffix: false,
            initializer: {
              type: 'Literal',
              value: 'hello',
              raw: '"hello"'
            } as LiteralNode,
            scope: 'local',
            isReactive: false
          } as VariableDeclarationNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);

      expect(graph.variables.has('normalVar')).toBe(false);
    });

    it('should generate update triggers for reactive variables', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'message',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 'Hello World',
              raw: '"Hello World"'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);
      const triggers = analyzer.getUpdateTriggers('message');

      expect(triggers).toHaveLength(2);
      expect(triggers[0].triggerType).toBe('template');
      expect(triggers[0].variableName).toBe('message');
      expect(triggers[0].immediate).toBe(true);
      expect(triggers[1].triggerType).toBe('event');
    });
  });

  describe('Dependency Analysis', () => {
    it('should detect dependencies between reactive variables', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'firstName',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 'John',
              raw: '"John"'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'lastName',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 'Doe',
              raw: '"Doe"'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'fullName',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: {
                  type: 'Identifier',
                  name: '$firstName'
                } as IdentifierNode,
                property: {
                  type: 'Identifier',
                  name: 'concat'
                } as IdentifierNode,
                computed: false
              },
              arguments: [
                {
                  type: 'Literal',
                  value: ' ',
                  raw: '" "'
                } as LiteralNode,
                {
                  type: 'Identifier',
                  name: '$lastName'
                } as IdentifierNode
              ]
            } as CallExpressionNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);

      expect(graph.dependencies.has('fullName')).toBe(true);
      const fullNameDeps = graph.dependencies.get('fullName') || [];
      expect(fullNameDeps).toContain('firstName');
      expect(fullNameDeps).toContain('lastName');
    });

    it('should build update chains for dependent variables', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'count',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 0,
              raw: '0'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'doubleCount',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Identifier',
              name: '$count'
            } as IdentifierNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);

      expect(graph.updateChains).toHaveLength(1);
      const chain = graph.updateChains[0];
      expect(chain.source).toBe('doubleCount');
      expect(chain.targets).toContain('count');
      expect(chain.circular).toBe(false);
    });

    it('should detect circular dependencies', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'a',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Identifier',
              name: '$b'
            } as IdentifierNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'b',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Identifier',
              name: '$a'
            } as IdentifierNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);

      // Check that circular dependency is detected
      const chainA = graph.updateChains.find(c => c.source === 'a');
      const chainB = graph.updateChains.find(c => c.source === 'b');
      
      expect(chainA?.circular || chainB?.circular).toBe(true);
    });
  });

  describe('Dependency Analysis Methods', () => {
    it('should provide detailed dependency analysis for a variable', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'base',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 10,
              raw: '10'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'derived',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Identifier',
              name: '$base'
            } as IdentifierNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'computed',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Identifier',
              name: '$derived'
            } as IdentifierNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      analyzer.analyzeAST(ast);
      const analysis = analyzer.getDependencyAnalysis('computed');

      expect(analysis.directDependencies).toContain('derived');
      expect(analysis.indirectDependencies).toContain('base');
      expect(analysis.updateOrder).toContain('computed');
    });

    it('should calculate correct update order', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'x',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 1,
              raw: '1'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'y',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Identifier',
              name: '$x'
            } as IdentifierNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'z',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Identifier',
              name: '$y'
            } as IdentifierNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      analyzer.analyzeAST(ast);
      const analysis = analyzer.getDependencyAnalysis('z');

      // Update order should be: x -> y -> z
      const updateOrder = analysis.updateOrder;
      expect(updateOrder.indexOf('x')).toBeLessThan(updateOrder.indexOf('y'));
      expect(updateOrder.indexOf('y')).toBeLessThan(updateOrder.indexOf('z'));
    });
  });

  describe('Utility Methods', () => {
    it('should check if a variable is reactive', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'reactive',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 'test',
              raw: '"test"'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      analyzer.analyzeAST(ast);

      expect(analyzer.isReactive('reactive')).toBe(true);
      expect(analyzer.isReactive('nonexistent')).toBe(false);
    });

    it('should return all reactive variables', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'var1',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 1,
              raw: '1'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'var2',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 2,
              raw: '2'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      analyzer.analyzeAST(ast);
      const reactiveVars = analyzer.getReactiveVariables();

      expect(reactiveVars).toHaveLength(2);
      expect(reactiveVars.map(v => v.name)).toContain('var1');
      expect(reactiveVars.map(v => v.name)).toContain('var2');
    });

    it('should return update triggers for a specific variable', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'testVar',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 'test',
              raw: '"test"'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      analyzer.analyzeAST(ast);
      const triggers = analyzer.getUpdateTriggers('testVar');

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers.every(t => t.variableName === 'testVar')).toBe(true);
    });
  });

  describe('Complex Dependency Scenarios', () => {
    it('should handle array expressions with reactive dependencies', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'item1',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 'first',
              raw: '"first"'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'item2',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 'second',
              raw: '"second"'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'items',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'ArrayExpression',
              elements: [
                {
                  type: 'Identifier',
                  name: '$item1'
                } as IdentifierNode,
                {
                  type: 'Identifier',
                  name: '$item2'
                } as IdentifierNode
              ]
            } as any,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);
      const itemsDeps = graph.dependencies.get('items') || [];

      expect(itemsDeps).toContain('item1');
      expect(itemsDeps).toContain('item2');
    });

    it('should handle object expressions with reactive dependencies', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'name',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 'John',
              raw: '"John"'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'age',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 30,
              raw: '30'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode,
          {
            type: 'VariableDeclaration',
            name: 'person',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'ObjectExpression',
              properties: [
                {
                  type: 'Property',
                  key: {
                    type: 'Identifier',
                    name: 'name'
                  } as IdentifierNode,
                  value: {
                    type: 'Identifier',
                    name: '$name'
                  } as IdentifierNode,
                  kind: 'init',
                  method: false,
                  shorthand: false,
                  computed: false
                },
                {
                  type: 'Property',
                  key: {
                    type: 'Identifier',
                    name: 'age'
                  } as IdentifierNode,
                  value: {
                    type: 'Identifier',
                    name: '$age'
                  } as IdentifierNode,
                  kind: 'init',
                  method: false,
                  shorthand: false,
                  computed: false
                }
              ]
            } as any,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);
      const personDeps = graph.dependencies.get('person') || [];

      expect(personDeps).toContain('name');
      expect(personDeps).toContain('age');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty AST', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);

      expect(graph.variables.size).toBe(0);
      expect(graph.dependencies.size).toBe(0);
      expect(graph.updateChains).toHaveLength(0);
    });

    it('should handle variables with no dependencies', () => {
      const ast: ProgramNode = {
        type: 'Program',
        body: [
          {
            type: 'VariableDeclaration',
            name: 'standalone',
            hasDollarPrefix: true,
            hasReactiveSuffix: true,
            initializer: {
              type: 'Literal',
              value: 42,
              raw: '42'
            } as LiteralNode,
            scope: 'local',
            isReactive: true
          } as ReactiveVariableNode
        ],
        frontmatter: {},
        syntaxVersion: 'modern'
      };

      const graph = analyzer.analyzeAST(ast);
      const analysis = analyzer.getDependencyAnalysis('standalone');

      expect(analysis.directDependencies).toHaveLength(0);
      expect(analysis.indirectDependencies).toHaveLength(0);
      expect(analysis.circularDependencies).toHaveLength(0);
    });
  });
});