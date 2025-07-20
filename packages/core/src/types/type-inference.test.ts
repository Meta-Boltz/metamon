import { describe, it, expect, beforeEach } from 'vitest';
import { TypeInferenceEngine } from './type-inference.js';
import type { LiteralNode, IdentifierNode, TypeAnnotationNode } from './unified-ast.js';

describe('TypeInferenceEngine', () => {
  let engine: TypeInferenceEngine;

  beforeEach(() => {
    engine = new TypeInferenceEngine();
  });

  describe('literal type inference', () => {
    it('should infer string type from string literal', () => {
      const literal: LiteralNode = {
        type: 'Literal',
        value: 'hello',
        raw: '"hello"'
      };

      const result = engine.inferType(literal);
      
      expect(result.inferredType.baseType).toBe('string');
      expect(result.inferredType.nullable).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should infer number type from integer literal', () => {
      const literal: LiteralNode = {
        type: 'Literal',
        value: 42,
        raw: '42'
      };

      const result = engine.inferType(literal);
      
      expect(result.inferredType.baseType).toBe('number');
      expect(result.inferredType.nullable).toBe(false);
    });

    it('should infer float type from decimal literal', () => {
      const literal: LiteralNode = {
        type: 'Literal',
        value: 3.14,
        raw: '3.14'
      };

      const result = engine.inferType(literal);
      
      expect(result.inferredType.baseType).toBe('float');
      expect(result.inferredType.nullable).toBe(false);
    });

    it('should infer boolean type from boolean literal', () => {
      const literal: LiteralNode = {
        type: 'Literal',
        value: true,
        raw: 'true'
      };

      const result = engine.inferType(literal);
      
      expect(result.inferredType.baseType).toBe('boolean');
      expect(result.inferredType.nullable).toBe(false);
    });

    it('should infer nullable any type from null literal', () => {
      const literal: LiteralNode = {
        type: 'Literal',
        value: null,
        raw: 'null'
      };

      const result = engine.inferType(literal);
      
      expect(result.inferredType.baseType).toBe('any');
      expect(result.inferredType.nullable).toBe(true);
    });
  });

  describe('identifier type inference', () => {
    it('should infer type from registered variable', () => {
      // Register a variable first
      engine.registerVariable('count', { baseType: 'number', nullable: false });

      const identifier: IdentifierNode = {
        type: 'Identifier',
        name: '$count'
      };

      const result = engine.inferType(identifier);
      
      expect(result.inferredType.baseType).toBe('number');
      expect(result.inferredType.nullable).toBe(false);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should suggest declaration for undefined variable', () => {
      const identifier: IdentifierNode = {
        type: 'Identifier',
        name: '$undefined'
      };

      const result = engine.inferType(identifier);
      
      expect(result.inferredType.baseType).toBe('any');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toContain('not defined');
    });

    it('should handle regular JavaScript identifiers', () => {
      const identifier: IdentifierNode = {
        type: 'Identifier',
        name: 'regularVar'
      };

      const result = engine.inferType(identifier);
      
      expect(result.inferredType.baseType).toBe('any');
      expect(result.suggestions).toHaveLength(1);
    });
  });

  describe('type annotation validation', () => {
    it('should validate matching explicit and inferred types', () => {
      const explicitType: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        typeKind: 'primitive',
        baseType: 'string'
      };

      const inferredType = { baseType: 'string' as const, nullable: false };

      const result = engine.validateTypeAnnotation(explicitType, inferredType, 'testVar');
      
      expect(result.isValid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect type conflicts', () => {
      const explicitType: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        typeKind: 'primitive',
        baseType: 'string'
      };

      const inferredType = { baseType: 'number' as const, nullable: false };

      const result = engine.validateTypeAnnotation(explicitType, inferredType, 'testVar');
      
      expect(result.isValid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].message).toContain('Type conflict');
      expect(result.conflicts[0].expected.baseType).toBe('string');
      expect(result.conflicts[0].actual.baseType).toBe('number');
    });

    it('should handle number/float compatibility with warning', () => {
      const explicitType: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        typeKind: 'primitive',
        baseType: 'number'
      };

      const inferredType = { baseType: 'float' as const, nullable: false };

      const result = engine.validateTypeAnnotation(explicitType, inferredType, 'testVar');
      
      expect(result.isValid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('compatible');
    });

    it('should handle float/number compatibility with warning', () => {
      const explicitType: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        typeKind: 'primitive',
        baseType: 'float'
      };

      const inferredType = { baseType: 'number' as const, nullable: false };

      const result = engine.validateTypeAnnotation(explicitType, inferredType, 'testVar');
      
      expect(result.isValid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('compatible');
    });
  });

  describe('variable registration and retrieval', () => {
    it('should register and retrieve variable types', () => {
      const type = { baseType: 'string' as const, nullable: false };
      
      engine.registerVariable('testVar', type);
      const retrieved = engine.getVariableType('testVar');
      
      expect(retrieved).toEqual(type);
    });

    it('should return undefined for unregistered variables', () => {
      const retrieved = engine.getVariableType('nonexistent');
      
      expect(retrieved).toBeUndefined();
    });

    it('should clear all registered variables', () => {
      engine.registerVariable('var1', { baseType: 'string', nullable: false });
      engine.registerVariable('var2', { baseType: 'number', nullable: false });
      
      engine.clear();
      
      expect(engine.getVariableType('var1')).toBeUndefined();
      expect(engine.getVariableType('var2')).toBeUndefined();
    });
  });

  describe('type conflict resolution', () => {
    it('should provide resolution for number/float conflicts', () => {
      const conflicts = [{
        expected: { baseType: 'number' as const, nullable: false },
        actual: { baseType: 'float' as const, nullable: false },
        message: 'Type conflict'
      }];

      const resolutions = engine.resolveTypeConflicts(conflicts);
      
      expect(resolutions).toHaveLength(1);
      expect(resolutions[0]).toContain('float');
      expect(resolutions[0]).toContain('precision');
    });

    it('should provide resolution for float/number conflicts', () => {
      const conflicts = [{
        expected: { baseType: 'float' as const, nullable: false },
        actual: { baseType: 'number' as const, nullable: false },
        message: 'Type conflict'
      }];

      const resolutions = engine.resolveTypeConflicts(conflicts);
      
      expect(resolutions).toHaveLength(1);
      expect(resolutions[0]).toContain('decimal places');
    });

    it('should provide resolution for string/any conflicts', () => {
      const conflicts = [{
        expected: { baseType: 'string' as const, nullable: false },
        actual: { baseType: 'any' as const, nullable: false },
        message: 'Type conflict'
      }];

      const resolutions = engine.resolveTypeConflicts(conflicts);
      
      expect(resolutions).toHaveLength(1);
      expect(resolutions[0]).toContain('quotes');
    });

    it('should provide generic resolution for other conflicts', () => {
      const conflicts = [{
        expected: { baseType: 'boolean' as const, nullable: false },
        actual: { baseType: 'string' as const, nullable: false },
        message: 'Type conflict'
      }];

      const resolutions = engine.resolveTypeConflicts(conflicts);
      
      expect(resolutions).toHaveLength(1);
      expect(resolutions[0]).toContain('Change either');
    });

    it('should handle multiple conflicts', () => {
      const conflicts = [
        {
          expected: { baseType: 'number' as const, nullable: false },
          actual: { baseType: 'float' as const, nullable: false },
          message: 'Type conflict 1'
        },
        {
          expected: { baseType: 'string' as const, nullable: false },
          actual: { baseType: 'any' as const, nullable: false },
          message: 'Type conflict 2'
        }
      ];

      const resolutions = engine.resolveTypeConflicts(conflicts);
      
      expect(resolutions).toHaveLength(2);
    });
  });

  describe('array type inference', () => {
    it('should infer array type from homogeneous elements', () => {
      const arrayExpr = {
        type: 'ArrayExpression',
        elements: [
          { type: 'Literal', value: 1, raw: '1' },
          { type: 'Literal', value: 2, raw: '2' },
          { type: 'Literal', value: 3, raw: '3' }
        ]
      };

      const result = engine.inferType(arrayExpr);
      
      expect(result.inferredType.baseType).toBe('array');
      expect(result.inferredType.generic?.[0]?.baseType).toBe('number');
      expect(result.inferredType.nullable).toBe(false);
    });

    it('should infer array type from mixed numeric elements', () => {
      const arrayExpr = {
        type: 'ArrayExpression',
        elements: [
          { type: 'Literal', value: 1, raw: '1' },
          { type: 'Literal', value: 2.5, raw: '2.5' }
        ]
      };

      const result = engine.inferType(arrayExpr);
      
      expect(result.inferredType.baseType).toBe('array');
      expect(result.inferredType.generic?.[0]?.baseType).toBe('float');
    });

    it('should handle empty arrays with suggestions', () => {
      const arrayExpr = {
        type: 'ArrayExpression',
        elements: []
      };

      const result = engine.inferType(arrayExpr);
      
      expect(result.inferredType.baseType).toBe('array');
      expect(result.inferredType.generic?.[0]?.baseType).toBe('any');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toContain('Empty array');
    });

    it('should handle mixed type arrays with suggestions', () => {
      const arrayExpr = {
        type: 'ArrayExpression',
        elements: [
          { type: 'Literal', value: 1, raw: '1' },
          { type: 'Literal', value: 'hello', raw: '"hello"' }
        ]
      };

      const result = engine.inferType(arrayExpr);
      
      expect(result.inferredType.baseType).toBe('array');
      expect(result.inferredType.generic?.[0]?.baseType).toBe('any');
      expect(result.suggestions.some(s => s.includes('Mixed array'))).toBe(true);
    });
  });

  describe('object type inference', () => {
    it('should infer object type from properties', () => {
      const objectExpr = {
        type: 'ObjectExpression',
        properties: [
          {
            key: { name: 'name' },
            value: { type: 'Literal', value: 'John', raw: '"John"' }
          },
          {
            key: { name: 'age' },
            value: { type: 'Literal', value: 30, raw: '30' }
          }
        ]
      };

      const result = engine.inferType(objectExpr);
      
      expect(result.inferredType.baseType).toBe('object');
      expect(result.inferredType.properties?.name?.baseType).toBe('string');
      expect(result.inferredType.properties?.age?.baseType).toBe('number');
    });

    it('should handle empty objects with suggestions', () => {
      const objectExpr = {
        type: 'ObjectExpression',
        properties: []
      };

      const result = engine.inferType(objectExpr);
      
      expect(result.inferredType.baseType).toBe('object');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toContain('Empty object');
    });
  });

  describe('call expression type inference', () => {
    it('should handle function calls with suggestions', () => {
      const callExpr = {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'someFunction' },
        arguments: []
      };

      const result = engine.inferType(callExpr);
      
      expect(result.inferredType.baseType).toBe('any');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toContain('Function call detected');
    });
  });

  describe('type hint generation', () => {
    it('should generate hints for any type', () => {
      const expr = { type: 'Identifier', name: 'unknown' };
      
      const hints = engine.generateTypeHints(expr, 'test variable');
      
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(h => h.includes('explicit type annotation'))).toBe(true);
    });

    it('should generate hints for arrays with any elements', () => {
      const arrayExpr = {
        type: 'ArrayExpression',
        elements: []
      };
      
      const hints = engine.generateTypeHints(arrayExpr);
      
      expect(hints.some(h => h.includes('Array with mixed'))).toBe(true);
    });

    it('should generate hints for empty objects', () => {
      const objectExpr = {
        type: 'ObjectExpression',
        properties: []
      };
      
      const hints = engine.generateTypeHints(objectExpr);
      
      expect(hints.some(h => h.includes('Empty object'))).toBe(true);
    });
  });

  describe('type consistency checking', () => {
    it('should detect mixed number types', () => {
      const variables = [
        { name: 'count', type: { baseType: 'number' as const, nullable: false } },
        { name: 'price', type: { baseType: 'float' as const, nullable: false } }
      ];

      const warnings = engine.checkTypeConsistency(variables);
      
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Mixed number types');
    });

    it('should detect any types mixed with specific types', () => {
      const variables = [
        { name: 'typed', type: { baseType: 'string' as const, nullable: false } },
        { name: 'untyped', type: { baseType: 'any' as const, nullable: false } }
      ];

      const warnings = engine.checkTypeConsistency(variables);
      
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('any');
    });

    it('should not warn for consistent types', () => {
      const variables = [
        { name: 'name1', type: { baseType: 'string' as const, nullable: false } },
        { name: 'name2', type: { baseType: 'string' as const, nullable: false } }
      ];

      const warnings = engine.checkTypeConsistency(variables);
      
      expect(warnings).toHaveLength(0);
    });
  });

  describe('unknown expression types', () => {
    it('should handle unknown expression types with suggestions', () => {
      const unknownExpression = {
        type: 'UnknownExpression' as any
      };

      const result = engine.inferType(unknownExpression);
      
      expect(result.inferredType.baseType).toBe('any');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toContain('Unable to infer type');
      expect(result.suggestions[0]).toContain('explicit type annotation');
    });
  });
});