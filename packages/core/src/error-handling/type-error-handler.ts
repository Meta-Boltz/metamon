/**
 * Type error handler for modern MTM syntax
 * Handles type conflicts, inference failures, and provides quick fixes
 */

import type { 
  TypeInfo, 
  TypeConflict, 
  TypeInferenceResult, 
  TypeValidationResult 
} from '../types/type-inference.js';
import type { 
  VariableDeclarationNode, 
  TypeAnnotationNode, 
  SourceLocation 
} from '../types/unified-ast.js';
import { TypeInferenceEngine } from '../types/type-inference.js';

/**
 * Type error categories
 */
export enum TypeErrorType {
  TYPE_CONFLICT = 'type_conflict',
  INFERENCE_FAILURE = 'inference_failure',
  INCOMPATIBLE_ASSIGNMENT = 'incompatible_assignment',
  MISSING_TYPE_ANNOTATION = 'missing_type_annotation',
  INVALID_TYPE_ANNOTATION = 'invalid_type_annotation',
  REACTIVE_TYPE_MISMATCH = 'reactive_type_mismatch'
}

/**
 * Type error with detailed information
 */
export interface TypeErrorInfo {
  type: TypeErrorType;
  message: string;
  location: SourceLocation;
  expectedType?: TypeInfo;
  actualType?: TypeInfo;
  variableName?: string;
  suggestions: string[];
  quickFixes: TypeQuickFix[];
  severity: 'error' | 'warning' | 'info';
}

/**
 * Quick fix for type errors
 */
export interface TypeQuickFix {
  description: string;
  replacement: string;
  range: {
    start: SourceLocation;
    end: SourceLocation;
  };
  type: 'add_annotation' | 'remove_annotation' | 'change_type' | 'change_value';
}

/**
 * Type hint for ambiguous cases
 */
export interface TypeHint {
  location: SourceLocation;
  message: string;
  suggestedType: TypeInfo;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Type error recovery result
 */
export interface TypeErrorRecovery {
  fallbackType: TypeInfo;
  suggestions: string[];
  requiresExplicitType: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Type conflict resolution
 */
export interface ConflictResolution {
  resolution: 'use_explicit' | 'use_inferred' | 'require_clarification';
  resolvedType: TypeInfo;
  explanation: string;
  suggestions: string[];
}

/**
 * Enhanced type error handler
 */
export class TypeErrorHandler {
  private typeInferenceEngine: TypeInferenceEngine;

  constructor(typeInferenceEngine?: TypeInferenceEngine) {
    this.typeInferenceEngine = typeInferenceEngine || new TypeInferenceEngine();
  }

  /**
   * Handle type conflict detection and reporting
   */
  handleTypeConflict(
    declared: TypeAnnotationNode,
    inferred: TypeInfo,
    variableName: string,
    location: SourceLocation
  ): TypeErrorInfo {
    const conflict: TypeConflict = {
      expected: { baseType: declared.baseType as any, nullable: false },
      actual: inferred,
      location,
      message: `Type conflict for variable '${variableName}'`
    };

    return {
      type: TypeErrorType.TYPE_CONFLICT,
      message: `Type conflict: Variable '${variableName}' declared as '${declared.baseType}' but assigned value of type '${inferred.baseType}'`,
      location,
      expectedType: conflict.expected,
      actualType: conflict.actual,
      variableName,
      suggestions: this.generateConflictSuggestions(conflict),
      quickFixes: this.generateConflictQuickFixes(conflict, declared, location),
      severity: this.determineConflictSeverity(conflict)
    };
  }

  /**
   * Handle type inference failures
   */
  handleInferenceFailure(
    variableName: string,
    value: any,
    location: SourceLocation
  ): TypeErrorRecovery {
    const fallbackType: TypeInfo = { baseType: 'any', nullable: false };
    
    const suggestions = [
      `Unable to infer type for variable '${variableName}'. Consider adding explicit type annotation.`,
      `Example: $${variableName}: string = ${JSON.stringify(value)}`,
      'Use explicit type annotations for better type safety and IDE support'
    ];

    // Try to provide better suggestions based on the value
    const betterSuggestions = this.generateInferenceSuggestions(value, variableName);
    suggestions.push(...betterSuggestions);

    return {
      fallbackType,
      suggestions,
      requiresExplicitType: true,
      confidence: 'low'
    };
  }

  /**
   * Generate type hints for ambiguous cases
   */
  generateTypeHints(
    variableName: string,
    value: any,
    context: string,
    location: SourceLocation
  ): TypeHint[] {
    const hints: TypeHint[] = [];

    // Check if value could be multiple types
    if (typeof value === 'number') {
      const hasDecimal = value.toString().includes('.');
      if (hasDecimal) {
        hints.push({
          location,
          message: `Variable '${variableName}' could be 'number' or 'float'. Consider explicit annotation for precision.`,
          suggestedType: { baseType: 'float', nullable: false },
          confidence: 'medium'
        });
      }
    }

    // Check for empty arrays or objects (check arrays first to avoid null check)
    if (Array.isArray(value)) {
      if (value.length === 0) {
        hints.push({
          location,
          message: `Empty array for '${variableName}'. Consider explicit type annotation: Array<T>`,
          suggestedType: { baseType: 'array', nullable: false, generic: [{ baseType: 'any', nullable: false }] },
          confidence: 'high'
        });
      }
    } else if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
      hints.push({
        location,
        message: `Empty object for '${variableName}'. Consider explicit type annotation or interface.`,
        suggestedType: { baseType: 'object', nullable: false, properties: {} },
        confidence: 'high'
      });
    } else if (value === null || value === undefined) {
      // Check for null/undefined values (only if not array or object)
      hints.push({
        location,
        message: `Variable '${variableName}' is ${value}. Consider explicit type annotation with nullable flag.`,
        suggestedType: { baseType: 'any', nullable: true },
        confidence: 'high'
      });
    }

    return hints;
  }

  /**
   * Resolve type conflicts with intelligent suggestions
   */
  resolveTypeConflict(declared: TypeInfo, inferred: TypeInfo): ConflictResolution {
    // Handle number/float compatibility
    if ((declared.baseType === 'number' && inferred.baseType === 'float') ||
        (declared.baseType === 'float' && inferred.baseType === 'number')) {
      return {
        resolution: 'use_explicit',
        resolvedType: declared,
        explanation: 'Number and float types are compatible. Using declared type.',
        suggestions: [
          'Both number and float types can represent numeric values',
          'Use float for decimal precision, number for integers'
        ]
      };
    }

    // Handle string coercion cases
    if (declared.baseType === 'string' && inferred.baseType !== 'string') {
      return {
        resolution: 'require_clarification',
        resolvedType: declared,
        explanation: 'Value may need string conversion',
        suggestions: [
          'Wrap the value in quotes to make it a string literal',
          'Use String() constructor for explicit conversion',
          'Consider if the value should actually be a string'
        ]
      };
    }

    // Handle any type conflicts
    if (inferred.baseType === 'any') {
      return {
        resolution: 'use_explicit',
        resolvedType: declared,
        explanation: 'Using declared type since inferred type is ambiguous',
        suggestions: [
          'The declared type provides better type safety',
          'Consider refactoring the value to match the declared type'
        ]
      };
    }

    // Default: require clarification for incompatible types
    return {
      resolution: 'require_clarification',
      resolvedType: declared,
      explanation: `Incompatible types: declared '${declared.baseType}' vs inferred '${inferred.baseType}'`,
      suggestions: [
        `Change the type annotation to '${inferred.baseType}' if the value is correct`,
        `Change the value to match the declared type '${declared.baseType}'`,
        'Remove the type annotation to use automatic type inference'
      ]
    };
  }

  /**
   * Generate quick fix suggestions for type errors
   */
  generateQuickFixSuggestions(error: TypeErrorInfo): TypeQuickFix[] {
    return error.quickFixes;
  }

  /**
   * Validate reactive variable types
   */
  validateReactiveVariableType(
    variableName: string,
    type: TypeInfo,
    location: SourceLocation
  ): TypeErrorInfo | null {
    // Check if type is suitable for reactive variables
    const unsuitableTypes = ['function'];
    
    if (unsuitableTypes.includes(type.baseType)) {
      return {
        type: TypeErrorType.REACTIVE_TYPE_MISMATCH,
        message: `Reactive variable '${variableName}' cannot be of type '${type.baseType}'. Reactive variables should contain data, not functions.`,
        location,
        actualType: type,
        variableName,
        suggestions: [
          'Reactive variables should contain data that can trigger UI updates',
          'Use regular variables (without !) for functions',
          'Consider using reactive state objects instead of reactive functions'
        ],
        quickFixes: [{
          description: 'Remove reactive suffix (!)',
          replacement: variableName.replace('!', ''),
          range: { start: location, end: location },
          type: 'remove_annotation'
        }],
        severity: 'warning'
      };
    }

    return null;
  }

  /**
   * Check type consistency across multiple variables
   */
  checkTypeConsistency(
    variables: Array<{ name: string; type: TypeInfo; location: SourceLocation }>
  ): TypeErrorInfo[] {
    const errors: TypeErrorInfo[] = [];
    const typeGroups = new Map<string, Array<{ name: string; location: SourceLocation }>>();

    // Group variables by base type
    for (const variable of variables) {
      const baseType = variable.type.baseType;
      if (!typeGroups.has(baseType)) {
        typeGroups.set(baseType, []);
      }
      typeGroups.get(baseType)!.push({ name: variable.name, location: variable.location });
    }

    // Check for potential inconsistencies
    if (typeGroups.has('number') && typeGroups.has('float')) {
      const numberVars = typeGroups.get('number')!;
      const floatVars = typeGroups.get('float')!;
      
      errors.push({
        type: TypeErrorType.TYPE_CONFLICT,
        message: `Mixed numeric types detected. Consider standardizing on either 'number' or 'float'.`,
        location: numberVars[0].location,
        suggestions: [
          `Variables using 'number': ${numberVars.map(v => v.name).join(', ')}`,
          `Variables using 'float': ${floatVars.map(v => v.name).join(', ')}`,
          'Use float for decimal precision, number for integers',
          'Consider using consistent numeric types throughout your code'
        ],
        quickFixes: this.generateConsistencyQuickFixes(numberVars, floatVars),
        severity: 'warning'
      });
    }

    // Check for excessive use of 'any' type
    if (typeGroups.has('any')) {
      const anyVars = typeGroups.get('any')!;
      if (anyVars.length > 3) { // Threshold for warning
        errors.push({
          type: TypeErrorType.MISSING_TYPE_ANNOTATION,
          message: `Multiple variables with 'any' type detected. Consider adding explicit type annotations.`,
          location: anyVars[0].location,
          suggestions: [
            `Variables with 'any' type: ${anyVars.map(v => v.name).join(', ')}`,
            'Explicit type annotations improve code reliability and IDE support',
            'Use specific types instead of any for better type safety'
          ],
          quickFixes: [],
          severity: 'info'
        });
      }
    }

    return errors;
  }

  /**
   * Generate suggestions for type conflicts
   */
  private generateConflictSuggestions(conflict: TypeConflict): string[] {
    const suggestions: string[] = [];

    if (conflict.expected.baseType === 'number' && conflict.actual.baseType === 'float') {
      suggestions.push('Consider changing type annotation from number to float for decimal precision');
    } else if (conflict.expected.baseType === 'float' && conflict.actual.baseType === 'number') {
      suggestions.push('Add decimal places to the value (e.g., 42.0) or change type to number');
    } else if (conflict.expected.baseType === 'string' && conflict.actual.baseType !== 'string') {
      suggestions.push('Wrap the value in quotes to make it a string literal');
      suggestions.push('Use String() constructor for explicit string conversion');
    } else {
      suggestions.push(`Change the type annotation to '${conflict.actual.baseType}' if the value is correct`);
      suggestions.push(`Change the value to match the declared type '${conflict.expected.baseType}'`);
      suggestions.push('Remove the type annotation to use automatic type inference');
    }

    return suggestions;
  }

  /**
   * Generate quick fixes for type conflicts
   */
  private generateConflictQuickFixes(
    conflict: TypeConflict,
    declared: TypeAnnotationNode,
    location: SourceLocation
  ): TypeQuickFix[] {
    const fixes: TypeQuickFix[] = [];

    // Fix 1: Change type annotation to match inferred type
    fixes.push({
      description: `Change type annotation to '${conflict.actual.baseType}'`,
      replacement: conflict.actual.baseType,
      range: {
        start: declared.location || location,
        end: declared.location || location
      },
      type: 'change_type'
    });

    // Fix 2: Remove type annotation (use inference)
    fixes.push({
      description: 'Remove type annotation (use automatic inference)',
      replacement: '',
      range: {
        start: declared.location || location,
        end: declared.location || location
      },
      type: 'remove_annotation'
    });

    // Fix 3: Type-specific value fixes
    if (conflict.expected.baseType === 'string' && conflict.actual.baseType !== 'string') {
      fixes.push({
        description: 'Wrap value in quotes to make it a string',
        replacement: '"${value}"',
        range: { start: location, end: location },
        type: 'change_value'
      });
    }

    if (conflict.expected.baseType === 'float' && conflict.actual.baseType === 'number') {
      fixes.push({
        description: 'Add decimal point to make it a float (e.g., 42.0)',
        replacement: '${value}.0',
        range: { start: location, end: location },
        type: 'change_value'
      });
    }

    return fixes;
  }

  /**
   * Generate suggestions for inference failures
   */
  private generateInferenceSuggestions(value: any, variableName: string): string[] {
    const suggestions: string[] = [];

    if (value === null || value === undefined) {
      suggestions.push(`Consider: $${variableName}: string | null = ${value}`);
      suggestions.push('Use union types for nullable values');
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        suggestions.push(`Consider: $${variableName}: Array<string> = []`);
        suggestions.push('Specify array element type for empty arrays');
      } else {
        const elementType = typeof value[0];
        suggestions.push(`Consider: $${variableName}: Array<${elementType}> = [...]`);
      }
    } else if (typeof value === 'object') {
      suggestions.push(`Consider defining an interface for the object structure`);
      suggestions.push(`Or use: $${variableName}: Record<string, any> = {...}`);
    }

    return suggestions;
  }

  /**
   * Determine severity of type conflicts
   */
  private determineConflictSeverity(conflict: TypeConflict): 'error' | 'warning' | 'info' {
    // Number/float conflicts are warnings (compatible)
    if ((conflict.expected.baseType === 'number' && conflict.actual.baseType === 'float') ||
        (conflict.expected.baseType === 'float' && conflict.actual.baseType === 'number')) {
      return 'warning';
    }

    // Any type conflicts are info (ambiguous)
    if (conflict.actual.baseType === 'any') {
      return 'info';
    }

    // All other conflicts are errors
    return 'error';
  }

  /**
   * Generate quick fixes for type consistency issues
   */
  private generateConsistencyQuickFixes(
    numberVars: Array<{ name: string; location: SourceLocation }>,
    floatVars: Array<{ name: string; location: SourceLocation }>
  ): TypeQuickFix[] {
    const fixes: TypeQuickFix[] = [];

    // Option 1: Convert all to number
    fixes.push({
      description: 'Standardize all numeric variables to use number type',
      replacement: 'number',
      range: {
        start: floatVars[0].location,
        end: floatVars[0].location
      },
      type: 'change_type'
    });

    // Option 2: Convert all to float
    fixes.push({
      description: 'Standardize all numeric variables to use float type',
      replacement: 'float',
      range: {
        start: numberVars[0].location,
        end: numberVars[0].location
      },
      type: 'change_type'
    });

    return fixes;
  }

  /**
   * Clear internal state (useful for testing)
   */
  clear(): void {
    this.typeInferenceEngine.clear();
  }
}