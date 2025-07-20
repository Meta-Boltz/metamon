/**
 * Unit tests for TypeErrorHandler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  TypeErrorHandler, 
  TypeErrorType,
  type TypeErrorInfo,
  type TypeHint,
  type TypeErrorRecovery,
  type ConflictResolution
} from './type-error-handler.js';
import type { TypeInfo, TypeAnnotationNode, SourceLocation } from '../types/unified-ast.js';
import { TypeInferenceEngine } from '../types/type-inference.js';

describe('TypeErrorHandler', () => {
  let typeErrorHandler: TypeErrorHandler;
  let mockLocation: SourceLocation;

  beforeEach(() => {
    typeErrorHandler = new TypeErrorHandler();
    mockLocation = { line: 1, column: 1, index: 0 };
  });

  describe('Type Conflict Detection', () => {
    it('should detect type conflicts between declared and inferred types', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'string',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'number', nullable: false };

      const result = typeErrorHandler.handleTypeConflict(declared, inferred, 'testVar', mockLocation);

      expect(result.type).toBe(TypeErrorType.TYPE_CONFLICT);
      expect(result.message).toContain('Type conflict');
      expect(result.message).toContain('testVar');
      expect(result.expectedType?.baseType).toBe('string');
      expect(result.actualType?.baseType).toBe('number');
      expect(result.severity).toBe('error');
    });

    it('should handle number/float compatibility with warning severity', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'number',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'float', nullable: false };

      const result = typeErrorHandler.handleTypeConflict(declared, inferred, 'price', mockLocation);

      expect(result.severity).toBe('warning');
      expect(result.suggestions).toContain('Consider changing type annotation from number to float for decimal precision');
    });

    it('should provide appropriate quick fixes for type conflicts', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'string',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'number', nullable: false };

      const result = typeErrorHandler.handleTypeConflict(declared, inferred, 'value', mockLocation);

      expect(result.quickFixes).toHaveLength(3);
      expect(result.quickFixes[0].description).toContain('Change type annotation to');
      expect(result.quickFixes[1].description).toContain('Remove type annotation');
      expect(result.quickFixes[2].description).toContain('Wrap value in quotes');
    });
  });

  describe('Type Inference Failure Handling', () => {
    it('should handle inference failures with fallback type', () => {
      const result = typeErrorHandler.handleInferenceFailure('unknownVar', null, mockLocation);

      expect(result.fallbackType.baseType).toBe('any');
      expect(result.requiresExplicitType).toBe(true);
      expect(result.confidence).toBe('low');
      expect(result.suggestions).toContain('Unable to infer type for variable \'unknownVar\'. Consider adding explicit type annotation.');
    });

    it('should provide better suggestions for specific value types', () => {
      const result = typeErrorHandler.handleInferenceFailure('emptyArray', [], mockLocation);

      expect(result.suggestions.some(s => s.includes('Array<string>'))).toBe(true);
    });

    it('should handle null values with appropriate suggestions', () => {
      const result = typeErrorHandler.handleInferenceFailure('nullVar', null, mockLocation);

      expect(result.suggestions.some(s => s.includes('string | null'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('union types'))).toBe(true);
    });
  });

  describe('Type Hint Generation', () => {
    it('should generate hints for ambiguous numeric types', () => {
      const hints = typeErrorHandler.generateTypeHints('price', 99.99, 'variable', mockLocation);

      expect(hints).toHaveLength(1);
      expect(hints[0].message).toContain('could be \'number\' or \'float\'');
      expect(hints[0].suggestedType.baseType).toBe('float');
      expect(hints[0].confidence).toBe('medium');
    });

    it('should generate hints for empty arrays', () => {
      const hints = typeErrorHandler.generateTypeHints('items', [], 'variable', mockLocation);

      expect(hints).toHaveLength(1);
      expect(hints[0].message).toContain('Empty array');
      expect(hints[0].message).toContain('Array<T>');
      expect(hints[0].confidence).toBe('high');
    });

    it('should generate hints for empty objects', () => {
      const hints = typeErrorHandler.generateTypeHints('config', {}, 'variable', mockLocation);

      expect(hints).toHaveLength(1);
      expect(hints[0].message).toContain('Empty object');
      expect(hints[0].message).toContain('interface');
      expect(hints[0].confidence).toBe('high');
    });

    it('should generate hints for null values', () => {
      const hints = typeErrorHandler.generateTypeHints('data', null, 'variable', mockLocation);

      expect(hints).toHaveLength(1);
      expect(hints[0].message).toContain('is null');
      expect(hints[0].message).toContain('nullable flag');
      expect(hints[0].suggestedType.nullable).toBe(true);
    });
  });

  describe('Type Conflict Resolution', () => {
    it('should resolve number/float conflicts by using explicit type', () => {
      const declared: TypeInfo = { baseType: 'number', nullable: false };
      const inferred: TypeInfo = { baseType: 'float', nullable: false };

      const result = typeErrorHandler.resolveTypeConflict(declared, inferred);

      expect(result.resolution).toBe('use_explicit');
      expect(result.resolvedType.baseType).toBe('number');
      expect(result.explanation).toContain('compatible');
    });

    it('should require clarification for string coercion cases', () => {
      const declared: TypeInfo = { baseType: 'string', nullable: false };
      const inferred: TypeInfo = { baseType: 'number', nullable: false };

      const result = typeErrorHandler.resolveTypeConflict(declared, inferred);

      expect(result.resolution).toBe('require_clarification');
      expect(result.suggestions).toContain('Wrap the value in quotes to make it a string literal');
    });

    it('should use explicit type when inferred type is any', () => {
      const declared: TypeInfo = { baseType: 'number', nullable: false };
      const inferred: TypeInfo = { baseType: 'any', nullable: false };

      const result = typeErrorHandler.resolveTypeConflict(declared, inferred);

      expect(result.resolution).toBe('use_explicit');
      expect(result.explanation).toContain('ambiguous');
    });

    it('should require clarification for incompatible types', () => {
      const declared: TypeInfo = { baseType: 'boolean', nullable: false };
      const inferred: TypeInfo = { baseType: 'string', nullable: false };

      const result = typeErrorHandler.resolveTypeConflict(declared, inferred);

      expect(result.resolution).toBe('require_clarification');
      expect(result.explanation).toContain('Incompatible types');
      expect(result.suggestions).toHaveLength(3);
    });
  });

  describe('Reactive Variable Type Validation', () => {
    it('should validate reactive variable types', () => {
      const functionType: TypeInfo = { baseType: 'function', nullable: false };

      const result = typeErrorHandler.validateReactiveVariableType('myFunc!', functionType, mockLocation);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(TypeErrorType.REACTIVE_TYPE_MISMATCH);
      expect(result!.message).toContain('cannot be of type \'function\'');
      expect(result!.severity).toBe('warning');
      expect(result!.quickFixes[0].description).toContain('Remove reactive suffix');
    });

    it('should allow suitable types for reactive variables', () => {
      const stringType: TypeInfo = { baseType: 'string', nullable: false };

      const result = typeErrorHandler.validateReactiveVariableType('name!', stringType, mockLocation);

      expect(result).toBeNull();
    });

    it('should allow number types for reactive variables', () => {
      const numberType: TypeInfo = { baseType: 'number', nullable: false };

      const result = typeErrorHandler.validateReactiveVariableType('counter!', numberType, mockLocation);

      expect(result).toBeNull();
    });
  });

  describe('Type Consistency Checking', () => {
    it('should detect mixed numeric types', () => {
      const variables = [
        { name: 'count', type: { baseType: 'number', nullable: false } as TypeInfo, location: mockLocation },
        { name: 'price', type: { baseType: 'float', nullable: false } as TypeInfo, location: mockLocation },
        { name: 'total', type: { baseType: 'number', nullable: false } as TypeInfo, location: mockLocation }
      ];

      const errors = typeErrorHandler.checkTypeConsistency(variables);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(TypeErrorType.TYPE_CONFLICT);
      expect(errors[0].message).toContain('Mixed numeric types');
      expect(errors[0].severity).toBe('warning');
    });

    it('should detect excessive use of any type', () => {
      const variables = [
        { name: 'var1', type: { baseType: 'any', nullable: false } as TypeInfo, location: mockLocation },
        { name: 'var2', type: { baseType: 'any', nullable: false } as TypeInfo, location: mockLocation },
        { name: 'var3', type: { baseType: 'any', nullable: false } as TypeInfo, location: mockLocation },
        { name: 'var4', type: { baseType: 'any', nullable: false } as TypeInfo, location: mockLocation }
      ];

      const errors = typeErrorHandler.checkTypeConsistency(variables);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe(TypeErrorType.MISSING_TYPE_ANNOTATION);
      expect(errors[0].message).toContain('Multiple variables with \'any\' type');
      expect(errors[0].severity).toBe('info');
    });

    it('should not report errors for consistent types', () => {
      const variables = [
        { name: 'name', type: { baseType: 'string', nullable: false } as TypeInfo, location: mockLocation },
        { name: 'title', type: { baseType: 'string', nullable: false } as TypeInfo, location: mockLocation },
        { name: 'count', type: { baseType: 'number', nullable: false } as TypeInfo, location: mockLocation }
      ];

      const errors = typeErrorHandler.checkTypeConsistency(variables);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Quick Fix Generation', () => {
    it('should generate appropriate quick fixes for type conflicts', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'string',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'number', nullable: false };

      const error = typeErrorHandler.handleTypeConflict(declared, inferred, 'value', mockLocation);
      const quickFixes = typeErrorHandler.generateQuickFixSuggestions(error);

      expect(quickFixes).toHaveLength(3);
      expect(quickFixes[0].type).toBe('change_type');
      expect(quickFixes[1].type).toBe('remove_annotation');
      expect(quickFixes[2].type).toBe('change_value');
    });

    it('should generate specific fixes for float/number conflicts', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'float',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'number', nullable: false };

      const error = typeErrorHandler.handleTypeConflict(declared, inferred, 'value', mockLocation);

      const decimalFix = error.quickFixes.find(fix => fix.description.includes('decimal point'));
      expect(decimalFix).toBeDefined();
      expect(decimalFix?.type).toBe('change_value');
    });
  });

  describe('Error Severity Classification', () => {
    it('should classify incompatible types as errors', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'boolean',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'string', nullable: false };

      const result = typeErrorHandler.handleTypeConflict(declared, inferred, 'flag', mockLocation);

      expect(result.severity).toBe('error');
    });

    it('should classify number/float conflicts as warnings', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'number',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'float', nullable: false };

      const result = typeErrorHandler.handleTypeConflict(declared, inferred, 'value', mockLocation);

      expect(result.severity).toBe('warning');
    });

    it('should classify any type conflicts as info', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'string',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'any', nullable: false };

      const result = typeErrorHandler.handleTypeConflict(declared, inferred, 'data', mockLocation);

      expect(result.severity).toBe('info');
    });
  });

  describe('Integration with Type Inference Engine', () => {
    it('should work with custom type inference engine', () => {
      const customEngine = new TypeInferenceEngine();
      const handler = new TypeErrorHandler(customEngine);

      expect(handler).toBeDefined();
      // Test that it uses the custom engine
      handler.clear(); // Should not throw
    });

    it('should create default type inference engine when none provided', () => {
      const handler = new TypeErrorHandler();

      expect(handler).toBeDefined();
      handler.clear(); // Should not throw
    });
  });

  describe('Complex Type Scenarios', () => {
    it('should handle array type conflicts', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'array',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'string', nullable: false };

      const result = typeErrorHandler.handleTypeConflict(declared, inferred, 'items', mockLocation);

      expect(result.type).toBe(TypeErrorType.TYPE_CONFLICT);
      expect(result.suggestions).toContain('Change the type annotation to \'string\' if the value is correct');
    });

    it('should handle object type conflicts', () => {
      const declared: TypeAnnotationNode = {
        type: 'TypeAnnotation',
        baseType: 'object',
        location: mockLocation
      };
      const inferred: TypeInfo = { baseType: 'array', nullable: false };

      const result = typeErrorHandler.handleTypeConflict(declared, inferred, 'data', mockLocation);

      expect(result.type).toBe(TypeErrorType.TYPE_CONFLICT);
      expect(result.expectedType?.baseType).toBe('object');
      expect(result.actualType?.baseType).toBe('array');
    });
  });

  describe('Error Recovery', () => {
    it('should provide recovery suggestions for complex objects', () => {
      const complexObject = { nested: { value: 42 }, array: [1, 2, 3] };

      const result = typeErrorHandler.handleInferenceFailure('config', complexObject, mockLocation);

      expect(result.suggestions.some(s => s.includes('interface'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('Record<string, any>'))).toBe(true);
    });

    it('should handle arrays with mixed types', () => {
      const mixedArray = [1, 'string', true];

      const result = typeErrorHandler.handleInferenceFailure('mixed', mixedArray, mockLocation);

      expect(result.fallbackType.baseType).toBe('any');
      expect(result.requiresExplicitType).toBe(true);
    });
  });
});